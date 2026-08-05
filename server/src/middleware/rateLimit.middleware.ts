import rateLimit from 'express-rate-limit';

/**
 * Rate limiter for authentication routes (login, register, password reset).
 *
 * This counts FAILED attempts only, which is the whole design.
 *
 * History: it was originally five requests a minute per IP counting every
 * request, and it locked the operator out of their own deployment repeatedly
 * during testing — so on 2026-08-03 it was switched off entirely with
 * `skip: () => true`. That left no throttle whatsoever on password guessing,
 * because the account lockout in `auth.service.ts` had been disabled on the
 * same day. Shipping with both off is not an option.
 *
 * `skipSuccessfulRequests` is what makes a finite limit safe to restore. The
 * old limiter charged a legitimate person for the request that finally
 * succeeded, so a handful of fumbled passwords plus one good one hit the same
 * ceiling an attacker did. Now only a 4xx/5xx response is counted: someone who
 * eventually gets in spends nothing, and the budget is reachable only by
 * sustained failure.
 *
 * The numbers are deliberately generous — 30 failures per 15 minutes rather
 * than the old 5 per minute — because a university NAT puts an entire campus
 * behind one address, and first-day-of-term login is exactly when a shared-IP
 * false positive would hurt most. For an attacker the same budget is 120
 * guesses an hour against bcrypt, which is useless for online brute force.
 *
 * Per-ACCOUNT protection is separate and lives in `auth.service.ts` — this
 * limiter is per-IP and so cannot stop a botnet spread across many addresses
 * from targeting one admin account. The two layers are complementary; neither
 * substitutes for the other.
 *
 * Note the counters are in-memory (no `store` configured), so a
 * `systemctl restart laila` clears every limiter in this file instantly — the
 * escape hatch if a real user is ever stuck behind one.
 */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 30, // failed attempts per IP per window
  // Only failures count toward the budget. See the rationale above.
  skipSuccessfulRequests: true,
  message: {
    success: false,
    error: 'Too many failed authentication attempts. Please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Rate limiter for signup attempts that carry a course code.
 *
 * A course activation code is only 8 characters from a 32-symbol alphabet, and
 * unlike an invitation code it is meant to be short enough to read out in a
 * lecture theatre. That makes it the one guessable secret on the register form,
 * so the code path gets a budget of its own on top of authLimiter's five
 * requests a minute: an attacker willing to wait out the minute window still
 * only gets ten guesses an hour per IP.
 *
 * `skip` is what keeps this from punishing everyone else — a registration with
 * no course code is not counted at all, so ordinary signup is unaffected. Note
 * this middleware must be mounted AFTER the JSON body parser, which index.ts
 * installs globally before any route.
 */
export const courseCodeLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10,
  message: {
    success: false,
    error: 'Too many course code attempts. Please try again later.',
  },
  skip: (req) => !req.body?.courseCode,
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
  max: 300, // 300 requests per minute
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
 * Rate limiter for presentation slide conversion/status polling.
 * The heavy conversion is deduped in the service, so this mainly bounds the
 * ~2s client poll while still allowing normal viewing.
 */
export const presentationLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 60, // 60 requests per minute
  message: {
    success: false,
    error: 'Too many presentation requests. Please slow down.',
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
