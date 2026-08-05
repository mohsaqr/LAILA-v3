import { describe, it, expect } from 'vitest';
import express from 'express';
import request from 'supertest';
import { authLimiter, uploadLimiter, apiLimiter, courseCodeLimiter } from './rateLimit.middleware';

/**
 * Behavioural tests for the auth limiter.
 *
 * The previous version of this file only asserted each limiter `toBeDefined()`.
 * Those tests passed unchanged through the entire period when authLimiter was
 * disabled with `skip: () => true` — a limiter that blocks nothing is still
 * defined and still a function. Anything that cannot fail when protection is
 * removed is not testing the protection, so the assertions below drive real
 * requests through the middleware and count the responses.
 */

/** Minimal app whose handler returns `status`, so we can control pass/fail. */
const appReturning = (status: number) => {
  const app = express();
  // Each test needs its own IP bucket. The limiters key on req.ip, and the
  // in-memory store is shared across the whole module for the process, so two
  // tests hitting the same key would leak counts into each other.
  app.set('trust proxy', true);
  app.use(authLimiter);
  app.get('/login', (_req, res) => {
    res.status(status).json({ ok: status < 400 });
  });
  return app;
};

/** Distinct client IP per test, via the proxy header trust set above. */
const asClient = (agent: request.Test, ip: string) => agent.set('X-Forwarded-For', ip);

describe('authLimiter', () => {
  it('eventually blocks a client that keeps failing', async () => {
    const app = appReturning(401);
    const ip = '198.51.100.10';

    // Drain the budget. The limit is 30 failures per window.
    for (let i = 0; i < 30; i++) {
      await asClient(request(app).get('/login'), ip);
    }

    const blocked = await asClient(request(app).get('/login'), ip);
    // 429 rather than the handler's 401 proves the limiter, not the route,
    // answered — brute-force protection is actually engaged.
    expect(blocked.status).toBe(429);
  });

  it('does not charge a client for successful requests', async () => {
    const app = appReturning(200);
    const ip = '198.51.100.11';

    // Well past the limit, but all succeeding. This is the property that makes
    // a finite limit safe to run: the old limiter counted these too, which is
    // why it locked the operator out of their own deployment.
    for (let i = 0; i < 45; i++) {
      await asClient(request(app).get('/login'), ip);
    }

    const stillAllowed = await asClient(request(app).get('/login'), ip);
    expect(stillAllowed.status).toBe(200);
  });

  it('budgets each client separately', async () => {
    const app = appReturning(401);
    const attacker = '198.51.100.12';

    for (let i = 0; i < 31; i++) {
      await asClient(request(app).get('/login'), attacker);
    }
    expect((await asClient(request(app).get('/login'), attacker)).status).toBe(429);

    // A bystander must not inherit someone else's exhausted budget.
    const bystander = await asClient(request(app).get('/login'), '198.51.100.13');
    expect(bystander.status).toBe(401);
  });

  it('leaves room for a person fumbling a password a few times', async () => {
    const app = appReturning(401);
    const ip = '198.51.100.14';

    // Five wrong passwords is an ordinary human afternoon, not an attack.
    for (let i = 0; i < 5; i++) {
      const res = await asClient(request(app).get('/login'), ip);
      expect(res.status).toBe(401);
    }
  });
});

describe('other limiters', () => {
  // These remain shape-only on purpose: they are ordinary finite limiters with
  // no skip logic, and the behaviour above already covers the library wiring.
  it.each([
    ['uploadLimiter', uploadLimiter],
    ['apiLimiter', apiLimiter],
    ['courseCodeLimiter', courseCodeLimiter],
  ])('%s is mounted as middleware', (_name, limiter) => {
    expect(typeof limiter).toBe('function');
  });
});
