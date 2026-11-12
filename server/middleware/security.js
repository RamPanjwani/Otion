const rateLimit = require('express-rate-limit');

const jsonRateLimitResponse = (req, res) => res.status(429).json({
  error: {
    code: 'RATE_LIMITED',
    message: 'Too many requests. Please try again later.',
    requestId: req.id,
  },
});

const createLimiter = (options) => rateLimit({
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV === 'test',
  handler: jsonRateLimitResponse,
  ...options,
});

// Defaults are the production ceilings; the overrides exist so a load test or a
// staging soak run measures the API instead of the limiter.
const apiLimiter = createLimiter({ windowMs: 15 * 60 * 1_000, limit: Number(process.env.API_RATE_LIMIT) || 500 });
const authLimiter = createLimiter({ windowMs: 15 * 60 * 1_000, limit: Number(process.env.AUTH_RATE_LIMIT) || 30 });
const publicUnlockLimiter = createLimiter({ windowMs: 15 * 60 * 1_000, limit: 20 });

module.exports = { apiLimiter, authLimiter, publicUnlockLimiter };
