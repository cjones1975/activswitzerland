# MySwitzerland Bot-Traffic Resilience

## Overview

Scrapers on Hetzner (AS24940) and OVH (AS16276) walked the sitemap (every destination × 5 languages, one page every few seconds — ~8.8k of 13.3k requests in 24h on 2026-10-07) and exhausted the MySwitzerland API quota (`429 {"message":"Limit Exceeded"}`). The existing Redis cache (`myswitzerland-redis-cache-spec.md`) made that worse once the quota was hit: failures weren't cached, so every bot hit retried upstream; entries vanished after a hard 24h with no fallback; concurrent misses each called upstream; Redis had no persistence, so every deploy restarted cold. Worse for SEO, a failed destination fetch during SSR rendered a `noindex, nofollow` page with HTTP 200 — telling Googlebot to drop real pages.

---

## 1. Cloudflare WAF rule (done in dashboard, not in repo)

Security → WAF → Custom rules, action **Managed Challenge**:

```
(ip.src.asnum in {24940 16276} and not cf.client.bot and not starts_with(http.request.uri.path, "/api/v1/billing/webhook"))
```

`cf.client.bot` exempts verified search engines; the webhook path keeps Stripe (cloud-hosted) unchallenged. Bot Fight Mode deliberately not used — on the free plan it can't exempt the Stripe webhook path.

---

## 2. Cache middleware — `backend/src/middleware/cache.js`

Applies to every route using `cacheResponse()` (MySwitzerland, hikes, bikes):

- **Stale-if-error:** entries stored as `{ __cache: 1, freshUntil, body }`, fresh for `ttl` (24h + up to 20% jitter), kept a further 7 days. A stale entry triggers one upstream refresh; if that fails (≥500), the stale body is served as 200.
- **Failure cache:** an upstream failure sets `fail:<key>` for 60s — requests in that window are served stale (or 503 + `Retry-After: 60` if nothing stale) without calling upstream.
- **Request coalescing:** `lock:<key>` (`SET NX`, 30s) — only one request refreshes a key; others serve stale, or poll up to 5s for the refresher's result, else 503.
- **Legacy entries** (bare body, written before this change) are served as fresh until their own EX runs out, so deploying doesn't empty a warm cache.
- `X-Cache: HIT | MISS | STALE` response header for debugging.

---

## 3. Upstream status mapping — `backend/src/controllers/myswitzerland.js`

New `upstreamStatus(error)`: upstream 404 → 404; 429 / 5xx / network failure → 503; otherwise 500. Replaces the hardcoded 500 in all 7 handlers.

---

## 4. SSR destination page — `frontend/src/app/shell/destinations-layout/destinations-layout.ts`

On a failed `getDestination` during SSR (via `RESPONSE_INIT`): 404 → HTTP 404 + `noindex` (unchanged meta); anything else → HTTP 503 + `Retry-After: 300`, **no** `noindex`. Browser-side behaviour (toast, error title) unchanged.

---

## 5. Redis — `infra/docker-compose.yml`, `infra/docker-compose.prod.yml`

`redis-server --appendonly yes --maxmemory 256mb --maxmemory-policy allkeys-lru`, named volume `redis_data:/data`. Persistence keeps the cache across deploys/restarts; the memory cap bounds the 7-day stale retention.

---

## Out of scope / follow-ups

- AI agent's MySwitzerland calls (`backend/src/utils/myswitzerland.js`) still uncached.
- Nightly paced sync of destinations into Mongo so page renders don't depend on MySwitzerland at all.
- Cloudflare edge caching of destination HTML (`cf-cache-status: DYNAMIC` today).
- `context/deployment-plan.md` predates the move to Cloudflare (tunnel token in `.env.prod`) and needs updating.

---

## Verification

- `node --check` on both backend files; `tsc --noEmit -p tsconfig.app.json` clean; both compose files pass `docker compose config`.
- Middleware tested against the real dev Redis in a throwaway container from the backend image (edited `src` mounted read-only, isolated `/__cachetest` keys, cleaned up): miss/hit, TTL ≈ 1d+jitter+7d, stale served on upstream failure, failure cache (stale and 503 paths) skips upstream, stale refreshed on recovery, 5 concurrent misses → 1 upstream call, legacy entry served — all pass.
- Not verified: MySwitzerland's response to an unknown destination id (dev key quota exhausted during testing) — if it isn't 404, the page gets a 503 rather than noindex, the safe direction.
