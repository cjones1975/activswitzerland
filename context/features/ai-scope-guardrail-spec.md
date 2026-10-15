# AI Assistant Scope Guardrail

## Overview

The AI chat assistant currently answers anything (e.g. "What is 10 x 45632" returns the product plus a nudge back to trip planning). It should instead recognise questions unrelated to Switzerland or to what ActivSwitzerland provides and reply with a fixed redirect, without calling any tools.

## Confirmed decisions

- **System-prompt rule, not a separate classifier call.** A pre-flight classifier would add a model round trip (latency + cost) to every message, including legitimate ones. A rule in the existing system prompt costs nothing extra, and off-topic messages get *faster* because the model skips the tool loop.
- **Canonical reply (English):** "I'm happy to help you with questions on Switzerland and spending a great time here. Let's put together a trip."
- **Reply in the user's language.** The app ships en/de/fr/it/es; the model replies with the canonical sentence translated into the language the user wrote in. No locale-file changes (the text is model output, not UI copy).
- **In scope (answer normally):** destinations, attractions, things to do, weather, hikes/bikes, public transport, trip planning, and practical questions about visiting Switzerland (money/CHF, visas, customs, languages, etiquette). Greetings and thanks ("hi", "thanks") are allowed and answered briefly.
- **Out of scope (redirect):** general maths, coding, trivia, writing tasks, other countries' travel, and anything else unrelated to Switzerland.
- **Redirect uses no tools.** The rule is placed first in the prompt's Rules list and states that no tool is called for an out-of-scope message.

## Changes

- `backend/src/utils/aiAgent.js` — add the scope rule to `SYSTEM_PROMPT`. No other files.

## Non-goals

- Hard server-side enforcement. This is prompt-level steering; a determined user may occasionally get an off-topic answer. Token/cost abuse protection (message length caps, tool-loop cap, subscriber turn cap) is a separate concern, not part of this change.
