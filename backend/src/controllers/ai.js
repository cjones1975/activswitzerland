import ErrorResponse from '../utils/errorResponse.js';
import asyncHandler from '../middleware/async.js';
import AiConversation from '../models/AiConversation.js';
import { runConversation } from '../utils/aiAgent.js';

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

    let conversation;
    if (conversationId) {
        conversation = await AiConversation.findOne({ _id: conversationId, user: req.user.id });
        if (!conversation) {
            return next(new ErrorResponse('Conversation not found', 404));
        }
    } else {
        conversation = await AiConversation.create({ user: req.user.id, messages: [] });
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
