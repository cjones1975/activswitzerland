import ErrorResponse from '../utils/errorResponse.js';
import asyncHandler from '../middleware/async.js';
import AiConversation from '../models/AiConversation.js';
import User from '../models/User.js';
import { runConversation } from '../utils/aiAgent.js';

const FREE_MESSAGE_LIMIT = 5;

// @desc    Send a message to the AI chat assistant — starts a new conversation when
//          conversationId is omitted, otherwise continues an existing one. Streamed as
//          Server-Sent Events: zero or more {type:'status', tool, input} progress events while
//          tool calls run, then one {type:'done', conversationId, reply} or {type:'error'}.
// @route   POST /api/v1/ai/chat
// @access  Private
export const postChatMessage = asyncHandler(async (req, res, next) => {
    const { conversationId, message, context } = req.body;
    if (!message || !String(message).trim()) {
        return next(new ErrorResponse('message is required', 400));
    }

    // protect's User.findById doesn't select these (select: false on the schema) — re-fetch
    // rather than widening protect's projection for every other route. Gate applies per message,
    // not per conversation-start — a single lifetime trial conversation capped at
    // FREE_MESSAGE_LIMIT user messages, not multiple free conversations.
    const billingUser = await User.findById(req.user.id).select('+isPro +isExempt +aiMessagesUsed');
    const hasUnlimitedAccess = billingUser.isPro || billingUser.isExempt;
    if (!hasUnlimitedAccess && billingUser.aiMessagesUsed >= FREE_MESSAGE_LIMIT) {
        return next(new ErrorResponse('Free message limit reached', 402));
    }

    let conversation;
    if (conversationId) {
        conversation = await AiConversation.findOne({ _id: conversationId, user: req.user.id });
        if (!conversation) {
            return next(new ErrorResponse('Conversation not found', 404));
        }
    } else {
        conversation = await AiConversation.create({ user: req.user.id, messages: [] });
    }

    if (!hasUnlimitedAccess) {
        billingUser.aiMessagesUsed += 1;
        await billingUser.save();
    }

    conversation.messages.push({ role: 'user', content: message });

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    const sendEvent = (data) => res.write(`data: ${JSON.stringify(data)}\n\n`);

    try {
        const { text, cards, messages } = await runConversation({
            messages: conversation.messages.map(m => ({ role: m.role, content: m.content })),
            context,
            onStatus: (tool, input) => sendEvent({ type: 'status', tool, input }),
        });
        conversation.messages = messages;
        await conversation.save();
        sendEvent({ type: 'done', conversationId: conversation._id, reply: { text, cards } });
    } catch (error) {
        console.error(error);
        sendEvent({ type: 'error' });
    } finally {
        res.end();
    }
});

// @desc    Free-trial message usage, for the frontend to show remaining-count/paywall UI
// @route   GET /api/v1/ai/usage
// @access  Private
export const getChatUsage = asyncHandler(async (req, res) => {
    const user = await User.findById(req.user.id).select('+isPro +isExempt +aiMessagesUsed');
    res.status(200).json({
        success: true,
        data: {
            messagesUsed: user.aiMessagesUsed,
            freeLimit: FREE_MESSAGE_LIMIT,
            isPro: user.isPro,
            hasUnlimitedAccess: user.isPro || user.isExempt,
        },
    });
});
