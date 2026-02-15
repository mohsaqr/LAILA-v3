import rateLimit from 'express-rate-limit';

/**
 * Rate limiter for authentication routes (login, register).
 * Strict limits to prevent brute force attacks.
 */
export const authLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 5, // 5 requests per minute
  message: {
    success: false,
    error: 'Too many authentication attempts. Please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Rate limiter for file upload routes.
 * Moderate limits to prevent abuse while allowing normal usage.
 */
export const uploadLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // 10 requests per minute
  message: {
    success: false,
    error: 'Too many upload requests. Please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * General API rate limiter.
 * Higher limits for regular API usage.
 */
export const apiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100, // 100 requests per minute
  message: {
    success: false,
    error: 'Too many requests. Please slow down.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Rate limiter for AI/LLM endpoints.
 * Stricter limits to prevent API cost abuse and denial of wallet attacks.
 */
export const llmLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 60, // 60 requests per minute
  message: {
    success: false,
    error: 'Too many AI requests. Please slow down to avoid service abuse.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Rate limiter for forum AI agent requests.
 * Strict limits to prevent abuse of AI tutor features in forums.
 */
export const forumAiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 3, // 3 AI requests per minute per user
  message: {
    success: false,
    error: 'AI request limit reached. Please wait before asking another AI tutor.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});
