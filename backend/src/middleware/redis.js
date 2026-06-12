import { createClient } from 'redis';
import 'colors';

const redisClient = createClient({
  socket: {
    host: process.env.REDIS_HOST || 'localhost',
    port: process.env.REDIS_PORT || 6379,
    connectTimeout: 1000,
    reconnectStrategy: (retries) => Math.min(retries * 1000, 30000),
  },
  disableOfflineQueue: true,
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
