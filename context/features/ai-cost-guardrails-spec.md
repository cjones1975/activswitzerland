# AI Assistant Cost Guardrails

## Overview

The AI chat endpoint is protected against free-tier abuse (5 lifetime messages, login required, per-IP `chatLimiter`, `max_tokens: 4096`), but a paying or exempt user has unlimited messages and nothing bounds the cost of any single one. This adds hard limits on input size, tool-loop depth and conversation length so a subscriber (or a stolen Pro account) can't run up the Claude API bill.

Separate from `ai-scope-guardrail-spec.md`, which steers *what* the assistant answers; this bounds *how much* any one request or conversation can cost.

## Confirmed decisions

- **Message length cap: 1,000 characters.** Checked in `postChatMessage` before any billing or DB work; over-limit returns `400` with `code: 'message_too_long'`. Generous for travel questions, far too small for pasted-document abuse. The global `express.json({ limit: '10mb' })` stays as is (other routes need it); the controller check is the enforcement point.
- **Tool-loop cap: 6 iterations** in `runConversation` (`aiAgent.js`). After the 6th tool round, make one final `requestTurn` with `tool_choice: { type: 'none' }` so the model must answer in text with what it has, rather than erroring or looping. `tools` is still passed (required while the history contains `tool_use` blocks).
- **Conversation cap: 20 user turns**, as proposed in `ai-chat-assistant-spec.md`. Enforced as a hard stop, not a sliding window — dropping old turns would make the assistant silently forget trip context.
  - Counted as `messages.filter(m => m.role === 'user' && typeof m.content === 'string').length` (tool results are also `role: 'user'` but have array content).
  - Checked after the conversation is loaded and **before** the `aiMessagesUsed` increment and SSE headers, so a rejected message is neither charged nor sent to the model. Returns `409` with `code: 'conversation_limit'`.
  - Bounds a conversation, not a user — a subscriber can start a new one. Acceptable because each conversation is individually capped.
- **Free users are unaffected** by the turn cap; their lifetime limit of 5 is always hit first.

## Changes

### Backend
- `backend/src/controllers/ai.js` — message length check, turn-count check, `MAX_MESSAGE_LENGTH` / `MAX_CONVERSATION_TURNS` constants; `ErrorResponse` carries the `code` (check how `ErrorResponse`/the error handler expose extra fields and extend minimally if needed).
- `backend/src/utils/aiAgent.js` — `MAX_TOOL_ITERATIONS` constant, iteration counter in the loop, final no-tools turn on cap.

### Frontend (`ai-chat-drawer.ts` + template)
- Cap the textarea at 1,000 chars with `maxlength` (the server check remains authoritative).
- Handle `conversation_limit`: show an inline notice with a **Start new conversation** button that clears the stored `conversationId`; disable the input once the limit is reached (the client can count user turns it already holds, so the user doesn't need to hit the error to find out).
- Handle `message_too_long` defensively with a generic inline error.
- i18n: new strings for the notice, button and error across en/de/fr/it/es, translated in the same pass.

## Decided out of scope

- **Per-user rate limit.** `chatLimiter` stays keyed on IP only. A second limiter keyed on `req.user.id` was considered and explicitly excluded (2026-10-15); revisit if account-level abuse shows up.

## Open questions

- **Exact numbers** (1,000 chars / 6 iterations / 20 turns) are cost/UX judgement calls; each is a single constant and easy to tune.

## Non-goals

- Per-user monthly token budgets or usage billing.
- Changing `max_tokens`, model, or `effort` settings.
- Trimming stored conversation history for storage reasons.
