import rateLimit from 'express-rate-limit';

// Rate limiter for login route
export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 login attempts per `windowMs`
  message: {
    success: false,
    error: 'Too many login attempts from this IP, please try again after 15 minutes',
  },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});

// Rate limiter for verification-code submission (login/register + email-change)
export const verifyLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: {
    success: false,
    error: 'Too many verification attempts from this IP, please try again after 15 minutes',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Rate limiter for resending a verification code
export const resendLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 3,
  message: {
    success: false,
    error: 'Too many resend requests from this IP, please try again after 15 minutes',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Rate limiter for the AI chat endpoint — the free/paid conversation gate (Phase 4, not yet
// built) controls *conversation count*, but a compromised or scripted account could still hammer
// individual messages; this is a cheap per-IP second layer given each request's real Claude API
// cost, unlike the auth limiters above which guard cheap endpoints.
export const chatLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 20,
  message: {
    success: false,
    error: 'Too many chat requests from this IP, please try again in a few minutes',
  },
  standardHeaders: true,
  legacyHeaders: false,
});
