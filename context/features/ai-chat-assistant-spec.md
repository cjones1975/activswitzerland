# AI Conversation Assistant

## Overview

A conversational, natural-language interface ("Ask me anything about Switzerland") backed by the Claude API, letting users ask things like *"What can I do in Bern"*, *"Weather in Zermatt today?"*, *"Recommend a 10km hike near Lauterbrunnen"*, *"Can I take a train to Spiez?"*, or *"Propose a 3-day trip including the Eiger"*. The assistant answers by calling tools that wrap the app's four existing external data sources — MySwitzerland (destinations/attractions), Open-Meteo (weather), opentransportdata.swiss (transport), and SchweizMobil hike/bike routes — rather than by exposing an MCP server (see rationale below).

Gated behind login, with a 3-free-conversations trial before a Stripe subscription is required — the user bears the marginal Claude API cost, not the business.

This is a large feature, broken into five phases: (1) the backend agent core, (2) the frontend chat UI with app-wide context passing, (3) auth gating, (4) usage metering, (5) Stripe subscription.

**Current build target: Phases 1-3 only** (branch `feature/ai-chat-assistant`), with Phases 4-5 deferred to a later stage. This means the shipped result is login-gated but **not** cost-capped — no free-conversation limit, no subscription requirement, only the per-IP `chatLimiter` from Phase 1. Acceptable for internal testing/dev, but the trigger should stay unlinked from any public rollout until Phase 4 (usage metering) lands — an unmetered chat endpoint is an open-ended Claude API cost exposure for as long as it's reachable by real users.

## Confirmed decisions

- **Claude API tool-use, not MCP.** MCP exposes tools *to* external AI clients (Claude Desktop, other agents) — the reverse of what's needed here, which is an AI experience *inside* this app calling *this app's own* APIs. A plain tool-use agent in the backend is the right shape; MCP would only become relevant if ActivSwitzerland's data ever needed to be queryable *from* a third-party AI client, which is out of scope.
- **Manual tool-use loop, not the SDK's beta Tool Runner.** The Tool Runner's JS/TS helper (`betaZodTool`) requires `zod`, which isn't a dependency of this (plain JS, non-TypeScript) backend, and pulls in a beta surface for no real benefit at this tool count (5-6 tools, no need for per-turn hooks). A manual `while (stop_reason === 'tool_use')` loop in a new `utils/aiAgent.js` keeps the same minimal-dependency style as the existing `utils/translate.js` (direct `client.messages.create`, no beta).
- **Model: `claude-sonnet-5`**, not Opus — per the cost discussion earlier in this session, travel Q&A/itinerary synthesis doesn't need Opus-tier reasoning, and Sonnet is ~5x cheaper. `thinking: { type: 'adaptive' }`, `output_config: { effort: 'medium' }` (tunable — a single constant in `aiAgent.js`).
- **Read-only tool surface for v1.** No tool can create, save, or modify a trip, booking, or any user data — the agent only answers/recommends. "Save this as a trip" (wiring into the Trip Planner's data model) is a deliberate non-goal for now, flagged as a future phase, not a v1 gap.
- **Context-aware, ask-don't-guess.** When a required detail (usually location) is missing, the agent must ask rather than silently default to a broad scope ("all of Switzerland"). Resolve order, cheapest/least-friction first: (1) explicit context passed with the request (current page/entity), (2) conversation history, (3) ask the user. Browser geolocation is a possible future addition, not in v1 — no existing geolocation plumbing in the app today to build on.
- **Entry point is app-wide, not homepage-only.** The chat UI is one reusable component (living in the existing drawer system) that accepts an optional context payload; the trigger to open it is exposed globally (header/nav), not just on the homepage. Building it context-agnostic-but-context-*capable* from day one avoids re-wiring every future entry point later.
- **Trigger placement: a header-nav icon, not the footer nav or a floating button.** Footer nav is already full (5 fixed slots: Home/Search/Trip Planner/Explore Trips/Profile), and a floating action button risks colliding with things already anchored at the bottom of map-heavy screens (zoom controls, distance badges). A chat icon next to the header's menu toggle is always visible and doesn't compete for space.
- **Drawer chrome matches the existing convention exactly — not a bespoke bottom-sheet.** `position="right"` `p-drawer`, same header pattern as `auth-drawer` (navy-900 background, avatar circle + title + close button), full-width on mobile like every other content drawer. Reviewed as a 4-state mockup (trigger, empty/context-aware state, active conversation, paywall) and approved 2026-08-20.
- **Empty state shows a context chip + suggested prompts, not a blank input.** When opened with context, a chip at the top states what's in scope ("Viewing: Staubbachfall Trail — Lauterbrunnen"); below it, 3-4 tappable suggested-prompt rows (adapted to context where available) address the discoverability problem of a brand-new interaction pattern.
- **Tool results that map to a real entity render as cards, not prose-only text.** A hike/bike recommendation renders as a compact card reusing the existing `trail-card` visual language (thumbnail, name, category badge, distance/attribution row); a weather answer renders a compact summary card. Both are tappable straight into the real `hike-detail`/`bike-detail` drawer — consistent with the rest of the app and more useful than a wall of text. This means the backend response can't be plain text alone; see Phase 1's response shape below.
- **Gating: login required, 3 free conversations, then Stripe subscription.** Reuses existing JWT auth (`middleware/auth.js`) and the already-scaffolded-but-unused `isPro`/`stripeCustomerId`/`stripeSubscriptionId` fields on `User.js`.
- **A "conversation" is a session, capped at a fixed message count** (proposed: 20 user turns), not unlimited-length — needed so free-tier cost is bounded per grant, and so a paying subscriber's session budget is predictable. Exact cap is a business/cost call, flagged as an open question below, not blocking the spec.
- **Stripe Checkout + Customer Portal (hosted), no custom payment UI.** Standard, low-code, PCI compliance handled entirely by Stripe.

## Phase 1 — Backend: AI agent core

### New: `backend/src/utils/aiTools.js`

Tool definitions (plain JSON Schema, same style as `translate.js`'s `TRANSLATION_SCHEMA`) plus their handler functions. Each handler calls an extracted utility function, not the Express controller directly (controllers are `req`/`res`/`next`-coupled; extracting the core logic mirrors the precedent already set by `utils/schweizMobilRoutes.js` and `utils/ojp.js`).

| Tool | Wraps | Extraction needed? |
|---|---|---|
| `resolve_location(query)` | `searchDestinations` (myswitzerland.js) | Yes — controller inlines the axios call; extract `searchDestinations({ query })` into a new `utils/myswitzerland.js` |
| `get_destination_info(destinationId)` | `getDestination` + `getAttractions` (myswitzerland.js) | Yes — same extraction as above, plus `fetchDestination(id)` / `fetchAttractionsFor(destinationId)` |
| `get_weather(lat, lon)` | `getWeather` (weather.js) | Yes — extract `fetchWeatherForecast({ lat, lon })` into a new `utils/weather.js` |
| `search_hikes(query, lang)` / `search_bikes(query, lang, bikeType)` | `searchSchweizMobilRoutes` (`utils/schweizMobilRoutes.js`) | No — already a plain callable function, no controller extraction needed |
| `get_transit_connections(from, to, date, time)` | `resolveStopRef` + `buildTripRequest`/`parseTripResponse` (transport.js / `utils/ojp.js`) | Yes — `resolveStopRef` currently lives inline in `controllers/transport.js`; move it (and a new `fetchConnections({ from, to, date, time })` wrapper) into `utils/ojp.js` alongside the request/response builders it already calls |

Each extraction is a pure lift-and-shift of existing logic into a plain async function the controller then calls too (controllers keep their current behavior and response shape — this is refactoring for reuse, not a behavior change).

`resolve_location` is the linchpin: most example prompts name a place ("Zermatt", "Bern", "Lauterbrunnen"), but `get_weather`/hike-search/etc. need coordinates or a destination id, not a free-text name. The agent is expected to call `resolve_location` first whenever a place name appears and isn't already resolved from context, then use the returned lat/lon/id for subsequent tool calls.

### New: `backend/src/utils/aiAgent.js`

- System prompt: describes the assistant's scope (Switzerland travel: destinations, weather, hikes/bikes, trains), states the ask-don't-guess rule for missing location, and instructs the agent to use passed context (see Phase 2) before asking.
- `runConversation({ messages, context })`:
  - Prepends the current app context (if any) as a system-role-ish note in the first user turn (e.g. `[Current context: viewing Zermatt destination page]`), not a mid-conversation system message (Sonnet 5 doesn't support that beta) — the caller decides fresh context should only apply to the newest turn.
  - Manual loop: `client.messages.create({ model: 'claude-sonnet-5', thinking: { type: 'adaptive' }, output_config: { effort: 'medium' }, tools: AI_TOOLS, messages })`; while `response.stop_reason === 'tool_use'`, execute each `tool_use` block via the matching handler from `aiTools.js`, append one `user` message containing all `tool_result` blocks (parallel calls returned together, matching the "single user message" rule), call again.
  - Returns the final assistant text, a `cards` array, plus the full updated `messages` array (so the caller can persist it for the next turn).
  - **`cards` extraction**: while looping, `runConversation` tracks which `tool_use` calls were `search_hikes`/`search_bikes`/`get_weather` (the "presentable" tools) and carries their raw results forward; once the model produces its final text turn, those tracked results become the response's `cards: [{ type: 'hike' | 'bike', route: TrailRoute }, { type: 'weather', data }]`. The model still narrates around them in `reply.text` ("Here are two options close by:") — `cards` is what lets the frontend render them as tappable components instead of parsing prose.
  - Tool execution errors returned as `tool_result` with `is_error: true`, not thrown — a single failed MySwitzerland/Open-Meteo/opentransportdata.swiss call shouldn't kill the whole answer if other tool calls still succeeded.
  - **Tool-status granularity is a scope decision, not resolved here**: the mockup's per-call status line ("Checking the forecast for Lauterbrunnen…") needs the backend to emit a progress event as each tool call starts — a lightweight form of streaming (event-level, not full token streaming), pulling part of the "Streaming responses" open question forward into Phase 1. Default for a first cut: a single generic "Thinking…" state client-side (no backend changes needed) — upgrade to per-tool-call status once Phase 1 is live, if the wait feels long enough to warrant it.

### New: `backend/src/models/AiConversation.js`

Minimal persisted session so multi-turn conversations survive across requests:
```js
{
  user: { type: ObjectId, ref: 'User', required: true },
  messages: [{ role: String, content: mongoose.Schema.Types.Mixed }], // raw Anthropic message shape
  createdAt: { type: Date, default: Date.now },
}
```
One document per conversation; its `_id` is the session id the frontend holds onto for follow-up turns.

### New: `backend/src/controllers/ai.js`

- `postChatMessage` — `POST /api/v1/ai/chat`, body `{ conversationId?, message, context? }`:
  1. Auth required (`protect` middleware — see Phase 3).
  2. If `conversationId` absent: **starting a new conversation** — check the usage/paywall gate (Phase 4) before creating the `AiConversation` doc.
  3. If `conversationId` present: load the existing conversation, append the new user turn (with `context` folded in per `aiAgent.js`'s rule above), skip the paywall gate (an in-progress conversation isn't cut off mid-way just because the free count ticked over).
  4. Call `runConversation`, persist the updated `messages`, respond `{ conversationId, reply: { text, cards } }`.
- `getChatUsage` — `GET /api/v1/ai/usage` → `{ conversationsUsed, freeLimit: 3, isPro }`, for the frontend to show remaining-count / paywall UI without guessing.

### New: `backend/src/routes/ai.js`

```js
router.post('/chat', protect, chatLimiter, postChatMessage);
router.get('/usage', protect, getChatUsage);
```
`chatLimiter`: a new `express-rate-limit` instance in `middleware/rateLimiter.js`, same pattern as `loginLimiter`/`verifyLimiter` — the free/paid gate controls *conversation count*, but a compromised or scripted account could still hammer individual messages; a per-IP request-rate ceiling on `/chat` is a cheap second layer given each request's real cost (unlike the existing limiters, which guard cheap auth endpoints).

Mount in `server.js`: `import ai from './routes/ai.js'; app.use('/api/v1/ai', ai);`

### Config

Reuses `ANTHROPIC_API_KEY` — already present from the Trip Content Translation feature, no new key needed.

## Phase 2 — Frontend: chat UI + context passing

### New: `frontend/src/app/shared/services/ai-chat.ts`

- `AiChat` service: `conversationId` signal, `messages` signal, `sendMessage(text: string)`.
- Builds the `context` payload from whatever's currently active — reads the active route and, where relevant, the currently-open drawer's payload (e.g. `hike-detail`'s `route.name`, `destination-detail`'s destination) via the existing `Drawer` service, the same way `drawer-host.ts`'s `*Source`/`*DestinationName` computeds already read active payloads. `null`/absent on routes with nothing specific open (e.g. homepage).
- Posts to `/api/v1/ai/chat` with `{ conversationId, message, context }`.

### `frontend/src/app/shared/services/drawer.ts`

Add `'ai-chat'` to `DrawerKey`.

### New: `frontend/src/app/features/ai-chat/ai-chat-drawer/`

- Chat transcript UI (message bubbles, input box, send button), structurally closer to `connections-drawer` (a self-contained drawer, not a multi-step wizard) than to `auth-layout`. Drawer header mirrors `auth-drawer`'s exact pattern (navy-900 background, 40px avatar circle + title + close button) — avatar icon `fa-solid fa-sparkles` (or nearest available in the app's Font Awesome kit), reused for every assistant message's small inline avatar too, so the same icon consistently means "the AI" everywhere it appears. `position="right"`, full-width on mobile via the same breakpoint pattern `drawer-host.css` already applies to `auth-drawer`/`connections-drawer`.
- Reads `AiChat.messages()`, calls `sendMessage()` on submit.
- **Empty state** (no messages yet): a context chip at the top when opened with context (map-pin icon + "Viewing: {entity name}"), then a short intro + 3-4 suggested-prompt rows (icon, text, chevron), adapted to context where available, generic ("What can I do in Bern?" etc.) on the homepage.
- **Assistant messages with `cards`**: render `reply.text` as a normal bubble, then any `cards` below it as tappable components — a new lightweight `chat-trail-card` (condensed `trail-card`: thumbnail, name, category badge, distance/attribution row) for `hike`/`bike` cards opening the real `hike-detail`/`bike-detail` drawer on tap, and a compact weather-summary chip (icon + temp/condition) for `weather` cards, styled with the existing info-blue toast palette (`#eff6ff`/`#bfdbfe`/`#2563eb`).
- **Tool-status line**: a generic "Thinking…" state shown while awaiting the response (see Phase 1's note on per-tool-call status as a possible fast-follow, not v1).
- Not logged in → don't call the endpoint at all; open the `'auth'` drawer instead, mirroring the existing `downloadGpx()` gate in `hike-detail.ts`/`bike-detail.ts`.
- Usage exhausted + not pro → renders the Phase 5 paywall/subscribe CTA in place of the input box (transcript stays visible above it, scrolled to the last exchange), driven by `GET /api/v1/ai/usage`.

### `frontend/src/app/shared/drawer-host/drawer-host.ts` / `.html`

Register the new drawer component, same registration pattern as every existing drawer (`imports` array + `<p-drawer>` block).

### Trigger

`frontend/src/app/shell/header-nav/header-nav.html` gains a second icon button next to the existing hamburger `.toggle-btn`, same `fa-solid fa-sparkles` icon as the drawer's own avatar (so it visually reads as "opens the AI"). Functionally just `drawerSvc.open('ai-chat')`.

## Phase 3 — Auth gating

- `protect` middleware (already applied in the Phase 1 route table) handles the backend side — no new auth code, pure reuse.
- Frontend: `AiChat.sendMessage()` checks `auth.isLoggedIn()` before posting; the drawer component opens `'auth'` instead when logged out, same as the GPX-download precedent.

## Phase 4 — Usage metering

### `backend/src/models/User.js`

Add:
```js
aiConversationsUsed: { type: Number, default: 0, select: false },
```

### `backend/src/controllers/ai.js`

- New-conversation gate: `if (!req.user.isPro && req.user.aiConversationsUsed >= 3) return next(new ErrorResponse('Free conversation limit reached', 402));`
- On successfully starting a new conversation (step 2 in `postChatMessage` above), `req.user.aiConversationsUsed += 1; await req.user.save();` — incremented once per *conversation*, not per message.

### Frontend

- `AiChat` service checks `GET /api/v1/ai/usage` before allowing "start a new conversation" (a "New chat" action, if the UI offers one) and renders the paywall CTA when `!isPro && conversationsUsed >= freeLimit`.

## Phase 5 — Stripe subscription

### Setup (user-side, before any code)

- Create a Stripe account, get test-mode API keys.
- Define one Product + recurring Price in the Stripe dashboard for the subscription.

### `backend/package.json`

Add `stripe` dependency.

### New: `backend/src/controllers/billing.js`

- `createCheckoutSession` — `POST /api/v1/billing/checkout` (auth required): creates a Stripe Checkout Session for the configured Price, `customer_email` from `req.user`, `success_url`/`cancel_url` back into the app; returns the session URL for the frontend to redirect to.
- `createPortalSession` — `POST /api/v1/billing/portal` (auth required): requires an existing `stripeCustomerId` on the user; returns a Customer Portal URL for managing/cancelling.
- `handleWebhook` — `POST /api/v1/billing/webhook`: verifies the Stripe signature (needs the **raw** request body, not JSON-parsed — must be mounted with `express.raw({ type: 'application/json' })` on this one route, ahead of the global `express.json()` in `server.js`, or signature verification will fail). Handles `checkout.session.completed` (set `isPro: true`, store `stripeCustomerId`/`stripeSubscriptionId`) and `customer.subscription.deleted`/`customer.subscription.updated` with a non-active status (set `isPro: false`).

### `backend/src/routes/billing.js`

```js
router.post('/checkout', protect, createCheckoutSession);
router.post('/portal', protect, createPortalSession);
router.post('/webhook', handleWebhook); // no protect — Stripe calls this directly, verified by signature instead
```

### Config — **both env files**

`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_ID` need adding to **both** `backend/config/.env` (direct `npm run dev`) and `infra/.env` (what the actual Docker container reads) — the Trip Content Translation feature hit exactly this gap (spec only updated one file, translations silently no-op'd in the running container until diagnosed). Do both from the start this time.

### Frontend

- Paywall CTA (Phase 4) calls `POST /api/v1/billing/checkout`, redirects `window.location` to the returned URL.
- Profile page gets a "Manage subscription" link (visible when `isPro`) calling `POST /api/v1/billing/portal`.
- `Auth.getMe()`'s `CurrentUser` interface gains `isPro: boolean` (backend's `/auth/me` needs to actually select+return it — currently `select: false` on the schema means it's excluded from every query by default).

## i18n

New `aiChat.*` namespace, mirrored across en/de/fr/it in the same pass:
- `aiChat.placeholder`, `aiChat.send`
- `aiChat.signInPrompt` (logged-out state)
- `aiChat.freeRemaining` (e.g. "{{count}} free conversations left")
- `aiChat.paywallTitle` / `aiChat.paywallBody` / `aiChat.subscribeCta`
- `aiChat.manageSubscription` (Profile page)

## Open questions (flag, not blocking)

- **Exact free-conversation cap unit** — this spec assumes 3 *sessions*, each capped at ~20 user turns, but the turn-cap number is a placeholder pending a real cost-per-session model once Phase 1 is live and real usage data exists.
- **Subscription price point** — business decision, out of scope for this spec.
- **Streaming responses** (typing-effect UI) — Claude API supports streaming; v1 as specified is request/response (simpler, matches `translate.js`'s existing non-streaming style). Worth revisiting once the chat UI is live and response latency (multi-tool-call turns can take several seconds) is felt to be a problem.
- **Saving an agent-proposed itinerary as a real trip** — deliberately out of scope (see Confirmed decisions), flagged as a natural future phase once this ships.
- **Browser geolocation** as a context source for ambiguous "near me" queries — not built in v1, no existing geolocation plumbing to extend.

## References

- @backend/src/controllers/weather.js
- @backend/src/controllers/myswitzerland.js
- @backend/src/controllers/transport.js
- @backend/src/utils/ojp.js
- @backend/src/utils/schweizMobilRoutes.js
- @backend/src/utils/translate.js (existing Claude API usage precedent — model/error-handling conventions mirrored here)
- @backend/src/middleware/auth.js
- @backend/src/middleware/rateLimiter.js
- @backend/src/models/User.js (`isPro`/`stripeCustomerId`/`stripeSubscriptionId` already scaffolded)
- @backend/src/server.js
- @frontend/src/app/shared/services/drawer.ts
- @frontend/src/app/shared/drawer-host/drawer-host.ts
- @frontend/src/app/core/services/auth.ts
- @frontend/src/app/features/hikes/hike-detail/hike-detail.ts (`downloadGpx()` auth-gate pattern mirrored for the chat trigger)
- @context/features/trip-content-translation-spec.md (prior Claude API feature — dual-env-file gotcha called out here to avoid repeating)
