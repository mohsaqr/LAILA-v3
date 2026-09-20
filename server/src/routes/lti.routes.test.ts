/**
 * The launch endpoint's wire behaviour.
 *
 * The property worth a route test rather than a unit test: **a tool must
 * receive an LTI-shaped error**, never LAILA's own. The strict
 * `authenticateToken` middleware answers a missing session with
 * `{ error: 'Authentication required' }`, which a tool cannot interpret and
 * which renders as a dead end inside its iframe. `/authorize` therefore uses
 * `optionalAuth` and produces `login_required` itself — a distinction no unit
 * test of the handler would catch, because the middleware short-circuits first.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

vi.mock('../utils/logger.js', () => {
  const noop = () => {};
  return {
    createLogger: () => ({ error: noop, warn: noop, info: noop, debug: noop }),
    authLogger: { error: noop, warn: noop, info: noop, debug: noop },
  };
});

const tool = {
  id: 'tool1',
  name: 'Example Tool',
  clientId: 'laila-abc',
  deploymentId: 'dep1',
  loginUrl: 'https://tool.example/login',
  targetLinkUri: 'https://tool.example/launch',
  redirectUris: JSON.stringify(['https://tool.example/cb']),
  jwksUrl: null,
  publicKeyPem: null,
  deepLinkingUrl: null,
  sendPii: false,
  isActive: true,
};

vi.mock('../utils/prisma.js', () => ({
  default: {
    ltiTool: { findUnique: vi.fn(), findMany: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() },
    ltiLaunch: { create: vi.fn(), findUnique: vi.fn(), update: vi.fn(), deleteMany: vi.fn() },
    user: { findUniqueOrThrow: vi.fn() },
    course: { findUnique: vi.fn() },
    courseRole: { findUnique: vi.fn() },
    enrollment: { findUnique: vi.fn() },
    lectureSection: { findUnique: vi.fn() },
  },
}));

vi.mock('../services/oidc.service.js', () => ({
  isOidcEnabled: () => true,
  privateKey: () => 'unused-in-these-tests',
  keyId: () => 'kid',
  issuer: () => 'https://laila.example.edu',
}));

// No session: exactly the state /authorize must handle itself.
vi.mock('../middleware/auth.middleware.js', () => ({
  authenticateToken: (_req: unknown, res: { status: (n: number) => { json: (b: unknown) => void } }) =>
    res.status(401).json({ success: false, error: 'Authentication required' }),
  optionalAuth: (_req: unknown, _res: unknown, next: () => void) => next(),
  requireAdmin: (_req: unknown, _res: unknown, next: () => void) => next(),
}));

import prisma from '../utils/prisma.js';
import ltiRoutes from './lti.routes.js';

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/api/lti', ltiRoutes);

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(prisma.ltiTool.findUnique).mockResolvedValue(tool as never);
});

describe('GET /api/lti/authorize', () => {
  // The reason this file exists.
  it('answers a missing session with login_required, not LAILA\'s own error', async () => {
    const res = await request(app).get('/api/lti/authorize').query({
      client_id: tool.clientId,
      redirect_uri: 'https://tool.example/cb',
      nonce: 'n1',
      lti_message_hint: 'hint',
    });

    expect(res.status).toBe(401);
    expect(res.body.error).toBe('login_required');
    expect(res.body).not.toHaveProperty('success');
    expect(JSON.stringify(res.body)).not.toMatch(/Authentication required/);
  });

  it('refuses an unknown tool before looking at anything else', async () => {
    vi.mocked(prisma.ltiTool.findUnique).mockResolvedValue(null as never);
    const res = await request(app)
      .get('/api/lti/authorize')
      .query({ client_id: 'nope', redirect_uri: 'https://tool.example/cb', nonce: 'n' });
    expect(res.body.error).toBe('unauthorized_client');
  });

  it('refuses a disabled tool', async () => {
    vi.mocked(prisma.ltiTool.findUnique).mockResolvedValue({ ...tool, isActive: false } as never);
    const res = await request(app)
      .get('/api/lti/authorize')
      .query({ client_id: tool.clientId, redirect_uri: 'https://tool.example/cb', nonce: 'n' });
    expect(res.body.error).toBe('unauthorized_client');
  });

  // An open redirect here hands a signed identity assertion to whoever asked.
  it.each([
    'https://tool.example/cb/extra',
    'https://evil.example/cb',
    'https://tool.example/cb?x=1',
  ])('refuses the unregistered redirect_uri %s', async (redirect_uri) => {
    const res = await request(app)
      .get('/api/lti/authorize')
      .query({ client_id: tool.clientId, redirect_uri, nonce: 'n' });
    expect(res.body.error).toBe('invalid_request');
    expect(res.body.error_description).toMatch(/redirect_uri/);
  });

  it('refuses a response_type other than id_token', async () => {
    const res = await request(app).get('/api/lti/authorize').query({
      client_id: tool.clientId,
      redirect_uri: 'https://tool.example/cb',
      nonce: 'n',
      response_type: 'code',
    });
    expect(res.body.error).toBe('unsupported_response_type');
  });

  it('refuses a response_mode other than form_post', async () => {
    const res = await request(app).get('/api/lti/authorize').query({
      client_id: tool.clientId,
      redirect_uri: 'https://tool.example/cb',
      nonce: 'n',
      response_mode: 'fragment',
    });
    expect(res.body.error).toBe('invalid_request');
  });

  it('accepts POST as well as GET, as the spec permits', async () => {
    vi.mocked(prisma.ltiTool.findUnique).mockResolvedValue(null as never);
    const res = await request(app)
      .post('/api/lti/authorize')
      .type('form')
      .send({ client_id: 'nope', redirect_uri: 'https://tool.example/cb', nonce: 'n' });
    expect(res.body.error).toBe('unauthorized_client');
  });

  it('never reveals internals in an error description', async () => {
    vi.mocked(prisma.ltiTool.findUnique).mockRejectedValue(new Error('connect ECONNREFUSED 5432'));
    const res = await request(app)
      .get('/api/lti/authorize')
      .query({ client_id: tool.clientId, redirect_uri: 'https://tool.example/cb', nonce: 'n' });
    expect(res.status).toBe(500);
    expect(res.body.error).toBe('server_error');
    expect(JSON.stringify(res.body)).not.toMatch(/ECONNREFUSED|5432/);
  });
});

describe('POST /api/lti/launch', () => {
  // Starting a launch is a different matter: it is a LAILA user acting in
  // LAILA's own UI, so LAILA's own auth error is the right answer there.
  it('requires a real session', async () => {
    const res = await request(app).post('/api/lti/launch').send({ toolId: 'tool1' });
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('Authentication required');
  });
});
