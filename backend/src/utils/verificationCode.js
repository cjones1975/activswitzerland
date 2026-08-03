import crypto from 'crypto';
import redisClient from '../middleware/redis.js';
import ErrorResponse from './errorResponse.js';

export const CODE_TTL_SECONDS = 300; // 5 minutes
export const MAX_ATTEMPTS = 5;

const codeKey = (prefix, id) => `verify:${prefix}:${id}`;
const attemptsKey = (prefix, id) => `verify:${prefix}:${id}:attempts`;

// crypto.randomInt, not Math.random — the code is a security-sensitive secret
export function generateCode() {
  return crypto.randomInt(0, 100000).toString().padStart(5, '0');
}

// Creates + stores a code, returns the plain code for the caller to email.
// `extra` is merged into the stored value (e.g. { newEmail } for email-change).
export async function createVerificationCode(prefix, id, extra = {}) {
  if (!redisClient.isOpen) {
    throw new ErrorResponse('Verification service is temporarily unavailable', 500);
  }
  const code = generateCode();
  await redisClient.set(codeKey(prefix, id), JSON.stringify({ code, ...extra }), { EX: CODE_TTL_SECONDS });
  await redisClient.del(attemptsKey(prefix, id));
  return code;
}

// Verifies + consumes (deletes) the code. Returns the stored payload (incl. `extra`) on success.
// Throws ErrorResponse(400/429/500) on failure.
export async function verifyAndConsumeCode(prefix, id, submittedCode) {
  if (!redisClient.isOpen) {
    throw new ErrorResponse('Verification service is temporarily unavailable', 500);
  }

  const raw = await redisClient.get(codeKey(prefix, id));
  if (!raw) {
    throw new ErrorResponse('Code expired or not found. Please request a new one.', 400);
  }

  const attempts = parseInt((await redisClient.get(attemptsKey(prefix, id))) || '0', 10);
  if (attempts >= MAX_ATTEMPTS) {
    await redisClient.del(codeKey(prefix, id));
    await redisClient.del(attemptsKey(prefix, id));
    throw new ErrorResponse('Too many incorrect attempts. Please request a new code.', 429);
  }

  const stored = JSON.parse(raw);
  if (stored.code !== submittedCode) {
    await redisClient.multi()
      .incr(attemptsKey(prefix, id))
      .expire(attemptsKey(prefix, id), CODE_TTL_SECONDS)
      .exec();
    throw new ErrorResponse('Incorrect code.', 400);
  }

  await redisClient.del(codeKey(prefix, id));
  await redisClient.del(attemptsKey(prefix, id));
  return stored;
}
