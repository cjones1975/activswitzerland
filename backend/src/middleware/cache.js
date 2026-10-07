import 'colors';
import redisClient from './redis.js';

export const ONE_DAY_SECONDS = 60 * 60 * 24;

// An entry stays "fresh" for its ttl, then is kept this much longer as a stale
// fallback — served when the upstream call to refresh it fails (e.g. a
// MySwitzerland 429), so a rate-limited upstream degrades to day-old content
// instead of errors.
const STALE_SECONDS = ONE_DAY_SECONDS * 7;
// After an upstream failure, requests for the same key skip the upstream call
// for this long (served stale, or a 503 if there's nothing stale) — without it,
// every request during a rate-limit window retries upstream and keeps it there.
const FAILURE_SECONDS = 60;
// Only one request refreshes a given key at a time; the rest serve stale, or
// briefly wait for the refresher's result when there's nothing stale yet.
const LOCK_SECONDS = 30;
const WAIT_MS = 5000;
const POLL_MS = 250;

// Up to +20% so entries written together in one crawl burst don't all expire
// together 24h later and trigger the next burst.
const withJitter = (ttl) => Math.round(ttl * (1 + Math.random() * 0.2));

const logError = (op) => (error) => console.error(`Redis ${op} error: ${error.message}`.red);

const readEntry = async (key) => {
  const raw = await redisClient.get(key);
  if (!raw) return null;
  const parsed = JSON.parse(raw);
  // Entries written before stale-while-revalidate are the bare response body —
  // treated as fresh until their own 24h EX runs out, so a deploy doesn't throw
  // away a warm cache.
  if (parsed?.__cache !== 1) return { body: parsed, fresh: true };
  return { body: parsed.body, fresh: Date.now() < parsed.freshUntil };
};

const waitForEntry = async (key) => {
  for (let waited = 0; waited < WAIT_MS; waited += POLL_MS) {
    await new Promise((resolve) => setTimeout(resolve, POLL_MS));
    const entry = await readEntry(key);
    if (entry) return entry;
  }
  return null;
};

const sendCached = (res, body, status) => {
  res.set('X-Cache', status);
  return res.status(200).json(body);
};

const sendUnavailable = (res) => {
  res.set('Retry-After', String(FAILURE_SECONDS));
  return res.status(503).json({ success: false, err: 'Upstream temporarily unavailable' });
};

export const cacheResponse = (ttl = ONE_DAY_SECONDS) => async (req, res, next) => {
  if (!redisClient.isOpen) return next();

  const key = `mys:${req.originalUrl}`;
  const lockKey = `lock:${key}`;
  const failKey = `fail:${key}`;

  let entry;
  try {
    entry = await readEntry(key);
    if (entry?.fresh) return sendCached(res, entry.body, 'HIT');

    if (await redisClient.exists(failKey)) {
      return entry ? sendCached(res, entry.body, 'STALE') : sendUnavailable(res);
    }

    const gotLock = await redisClient.set(lockKey, '1', { NX: true, EX: LOCK_SECONDS });
    if (!gotLock) {
      if (entry) return sendCached(res, entry.body, 'STALE');
      const awaited = await waitForEntry(key);
      return awaited ? sendCached(res, awaited.body, 'HIT') : sendUnavailable(res);
    }
  } catch (error) {
    logError('GET')(error);
    return next();
  }

  const originalJson = res.json.bind(res);
  res.json = (body) => {
    redisClient.del(lockKey).catch(logError('DEL'));

    if (res.statusCode === 200) {
      const freshTtl = withJitter(ttl);
      const envelope = { __cache: 1, freshUntil: Date.now() + freshTtl * 1000, body };
      redisClient.set(key, JSON.stringify(envelope), { EX: freshTtl + STALE_SECONDS })
        .catch(logError('SET'));
      res.set('X-Cache', 'MISS');
      return originalJson(body);
    }

    if (res.statusCode >= 500) {
      redisClient.set(failKey, '1', { EX: FAILURE_SECONDS }).catch(logError('SET'));
      if (entry) {
        res.status(200).set('X-Cache', 'STALE');
        return originalJson(entry.body);
      }
      res.set('Retry-After', String(FAILURE_SECONDS));
    }

    return originalJson(body);
  };

  next();
};
