# MySwitzerland Redis Cache

## Overview

Every request to `/api/v1/myswitzerland/*` (destinations, destinations-by-geobox, single destination, top attractions, attractions list, single attraction, attraction search) currently proxies straight through to the external MySwitzerland API via axios on every call — no caching. This data is largely static reference content and identical across users, so we're adding a **shared backend cache in Redis**, keyed per request (path + query string), with a **24-hour TTL** so upstream content edits are picked up within a day. If Redis is unreachable, requests fall back to today's behaviour (direct API call) — caching is an optimization, not a hard dependency.

---

## 1. Redis service (infra)

`@infra/docker-compose.yml`:

- Add a `redis` service: `redis:7-alpine`, `restart: unless-stopped`, on `app_network`. No persistent volume (pure cache).
- Add `redis` to `backend`'s `depends_on`.

---

## 2. Backend dependency

`npm install redis` in `backend/` (official Node client, v4+, promise-based).

---

## 3. Redis connection — `backend/src/middleware/redis.js`

New file, mirrors the style of `backend/src/middleware/mongodb.js` (colors logging) but **does not exit the process on failure** — caching is optional:

```js
import { createClient } from 'redis';
import 'colors';

const redisClient = createClient({
  socket: {
    host: process.env.REDIS_HOST || 'localhost',
    port: process.env.REDIS_PORT || 6379,
  },
});

redisClient.on('error', (err) => console.error(`Redis Client Error: ${err.message}`.red));

export const connectRedis = async () => {
  try {
    await redisClient.connect();
    console.log('Redis Connected'.cyan.underline.bold);
  } catch (error) {
    console.error(`Redis connection failed, continuing without cache: ${error.message}`.red.bold);
  }
};

export default redisClient;
```

`@backend/src/server.js`: call `connectRedis()` next to the existing `connectDB()` call, same `NODE_ENV !== 'test'` guard.

---

## 4. Cache middleware — `backend/src/middleware/cache.js`

New file, generic factory, default TTL = 24h:

```js
import redisClient from './redis.js';

export const ONE_DAY_SECONDS = 60 * 60 * 24;

export const cacheResponse = (ttl = ONE_DAY_SECONDS) => async (req, res, next) => {
  if (!redisClient.isOpen) return next();

  const key = `mys:${req.originalUrl}`;

  try {
    const cached = await redisClient.get(key);
    if (cached) return res.status(200).json(JSON.parse(cached));
  } catch (error) {
    console.error(`Redis GET error: ${error.message}`.red);
    return next();
  }

  const originalJson = res.json.bind(res);
  res.json = (body) => {
    if (res.statusCode === 200) {
      redisClient.set(key, JSON.stringify(body), { EX: ttl })
        .catch((error) => console.error(`Redis SET error: ${error.message}`.red));
    }
    return originalJson(body);
  };

  next();
};
```

Key = `mys:` + full `req.originalUrl` (path + query string) — different languages/pages/filters/IDs naturally get distinct entries, no extra key-building logic needed.

---

## 5. Apply to routes — `backend/src/routes/myswitzerland.js`

Apply `cacheResponse()` to all 7 existing GET routes (`/destinations`, `/destinationsbygeobbox`, `/destinations/:id`, `/topattractions`, `/attractions`, `/attractions/:id`, `/searchattractions`) — uniform 24h TTL, no per-route tuning.

```js
router.get('/destinations', cacheResponse(), getDestinations);
router.get('/destinationsbygeobbox', cacheResponse(), getDestinationsByGeobBox);
router.get('/destinations/:id', cacheResponse(), getDestination);
router.get('/topattractions', cacheResponse(), getTopAttractions);
router.get('/attractions', cacheResponse(), getAttractions);
router.get('/attractions/:id', cacheResponse(), getAttraction);
router.get('/searchattractions', cacheResponse(), searchAttractions);
```

---

## 6. Env vars

Append to `backend/config/.env` (append-only, existing contents untouched):

```
REDIS_HOST=redis
REDIS_PORT=6379
```

Code defaults to `localhost`/`6379` for local dev outside Docker.

---

## Out of Scope

- No frontend changes — `DestinationsService`/`AttractionsService` call the backend as-is; caching is transparent.
- No manual cache-invalidation endpoint or admin tooling — 24h TTL is the agreed invalidation mechanism.
- No per-route TTL tuning — uniform 24h across all 7 routes.

---

## Verification

- `docker compose up -d` — confirm backend log shows `Redis Connected`.
- Hit e.g. `GET /api/v1/myswitzerland/destinations?language=en&page=1&hitsPerPage=10...` twice — second call served from cache (faster, no MySwitzerland call).
- `redis-cli -h localhost KEYS "mys:*"` and `TTL <key>` — confirm key exists with TTL ≈ 86400s.
- Stop the `redis` container and re-hit an endpoint — confirm it still returns data normally (fail-open), no errors surfaced to client.

---

## References

- @backend/src/controllers/myswitzerland.js
- @backend/src/routes/myswitzerland.js
- @backend/src/middleware/mongodb.js
- @backend/src/server.js
- @infra/docker-compose.yml
- @backend/config/.env
