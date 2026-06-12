import 'colors';
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
