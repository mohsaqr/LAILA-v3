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
    ltiLaunch: { create: vi.fn(), findUnique: vi.fn(), update: vi.fn(), updateMany: vi.fn(), deleteMany: vi.fn() },
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

// No session by default: exactly the state /authorize must handle itself.
// Tests that need a signed-in caller set `currentUser` before the request.
let currentUser: { id: number; isAdmin: boolean; isInstructor: boolean } | null = null;
vi.mock('../middleware/auth.middleware.js', () => ({
  authenticateToken: (
    req: { user?: unknown },
    res: { status: (n: number) => { json: (b: unknown) => void } },
    next: () => void,
  ) => {
    if (!currentUser) {
      return res.status(401).json({ success: false, error: 'Authentication required' });
    }
    req.user = currentUser;
    next();
  },
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
  currentUser = null;
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


/**
 * The Content-Security-Policy on the documents this router emits.
 *
 * These tests exist because the feature shipped completely non-functional and
 * the whole suite stayed green. The app applies helmet globally with
 * `script-src-attr 'none'` and `form-action 'self'`; both block a launch, and
 * neither was visible to a test that mounts a bare `express()` with no helmet.
 * Reproduced in Chromium before the fix: the auto-submit raised "Executing
 * inline event handler violates … script-src-attr 'none'", and a manual submit
 * raised "Sending form data to '<tool>' violates … form-action 'self'".
 *
 * So these assert the properties that make a launch possible at all, rather
 * than re-testing helmet: the document must carry its OWN policy, that policy
 * must name the tool's origin, and the submit must not be an inline handler.
 */
describe('GET /api/lti/launch/:launchId/start — document CSP', () => {
  const launch = {
    id: 'lnch1',
    toolId: tool.id,
    userId: 3,
    courseId: 9,
    sectionId: null,
    messageType: 'LtiResourceLinkRequest',
    consumedAt: null as Date | null,
    expiresAt: new Date(Date.now() + 300_000),
  };

  beforeEach(() => {
    vi.mocked(prisma.ltiLaunch.findUnique).mockResolvedValue(launch as never);
    vi.mocked(prisma.ltiTool.findUnique).mockResolvedValue(tool as never);
    process.env.OIDC_ISSUER = 'https://laila.example.edu';
  });

  it('sends its own CSP instead of inheriting the app policy', async () => {
    const res = await request(app).get('/api/lti/launch/lnch1/start');
    expect(res.status).toBe(200);

    const csp = res.headers['content-security-policy'];
    expect(csp).toBeTruthy();
    // The tool's origin — without this the POST carrying the launch is blocked.
    expect(csp).toContain('form-action https://tool.example');
    expect(csp).not.toContain("form-action 'self'");
    // Tighter than the app policy everywhere else.
    expect(csp).toContain("default-src 'none'");
    expect(csp).toContain("base-uri 'none'");
  });

  it('submits from a nonce\'d script, not an inline event handler', async () => {
    const res = await request(app).get('/api/lti/launch/lnch1/start');

    // `script-src-attr` governs inline handlers and NO nonce can satisfy it,
    // so an onload= attribute is unfixable rather than merely untidy.
    expect(res.text).not.toMatch(/onload\s*=/i);

    const nonce = /<script nonce="([^"]+)">/.exec(res.text)?.[1];
    expect(nonce).toBeTruthy();
    // The nonce in the document must be the one the header authorises.
    expect(res.headers['content-security-policy']).toContain(`script-src 'nonce-${nonce}'`);
  });

  it('posts the initiation parameters to the tool login URL', async () => {
    const res = await request(app).get('/api/lti/launch/lnch1/start');

    expect(res.text).toContain(`action="${tool.loginUrl}"`);
    expect(res.text).toContain('name="lti_message_hint" value="lnch1"');
    expect(res.text).toContain(`name="client_id" value="${tool.clientId}"`);
    // Initiation carries no assertion — that is why this endpoint needs no session.
    expect(res.text).not.toMatch(/id_token/);
  });

  it.each([
    ['unknown', null],
    ['already used', { ...launch, consumedAt: new Date() }],
    ['expired', { ...launch, expiresAt: new Date(Date.now() - 1000) }],
  ])('refuses a %s launch with an indistinguishable 404', async (_label, row) => {
    vi.mocked(prisma.ltiLaunch.findUnique).mockResolvedValue(row as never);
    const res = await request(app).get('/api/lti/launch/lnch1/start');
    // One answer for all three: otherwise this is an oracle for guessing ids.
    expect(res.status).toBe(404);
    expect(res.text).not.toMatch(/consumed|expired|unknown/i);
  });
});


/**
 * Starting a launch: the two rows of the negative matrix in
 * docs/TEST_PLAN.md §6.3 that had no test.
 *
 * Both are about the *initiation* step, which happens in LAILA's own UI before
 * any tool is involved — so unlike /authorize, LAILA's own error shapes are the
 * right answer here.
 */
describe('POST /api/lti/launch — initiation guards', () => {
  const COURSE = 10;
  const OTHER_COURSE = 20;
  const SECTION_IN_OTHER_COURSE = 991;

  beforeEach(() => {
    currentUser = { id: 5, isAdmin: false, isInstructor: false };
    process.env.OIDC_ISSUER = 'https://laila.example.edu';
    // Enrolled student of COURSE: enough standing for a resource-link launch,
    // not enough to author with Deep Linking.
    vi.mocked(prisma.course.findUnique).mockResolvedValue({ instructorId: 999 } as never);
    vi.mocked(prisma.courseRole.findUnique).mockResolvedValue(null as never);
    vi.mocked(prisma.enrollment.findUnique).mockResolvedValue({ id: 1, status: 'active' } as never);
    vi.mocked(prisma.ltiLaunch.create).mockResolvedValue({ id: 'lnch1' } as never);
  });

  // Row 14. The section title travels to the third-party tool in the
  // resource-link claim, so an unchecked id leaks another course's section name.
  it('refuses a sectionId from a different course', async () => {
    vi.mocked(prisma.lectureSection.findUnique).mockResolvedValue({
      id: SECTION_IN_OTHER_COURSE,
      lecture: { module: { courseId: OTHER_COURSE } },
    } as never);

    const res = await request(app)
      .post('/api/lti/launch')
      .send({ toolId: tool.id, courseId: COURSE, sectionId: SECTION_IN_OTHER_COURSE });

    expect(res.status).toBe(400);
    // Only the status is asserted, not the message: this app is a bare
    // `express()` with no error-handler middleware, so an AppError's body never
    // gets rendered here. That is blind spot §2.1 in docs/TEST_PLAN.md — the
    // same structural gap that hid the LTI CSP failure — visible in miniature.
    // No launch record may be created for a refused initiation.
    expect(prisma.ltiLaunch.create).not.toHaveBeenCalled();
  });

  it('accepts a sectionId that does belong to the course', async () => {
    vi.mocked(prisma.lectureSection.findUnique).mockResolvedValue({
      id: 77,
      lecture: { module: { courseId: COURSE } },
    } as never);

    const res = await request(app)
      .post('/api/lti/launch')
      .send({ toolId: tool.id, courseId: COURSE, sectionId: 77 });

    expect(res.status).toBe(200);
    expect(res.body.data.startUrl).toBe('/api/lti/launch/lnch1/start');
  });

  it.each([['abc'], [-1], [0], [1.5]])('refuses the non-id sectionId %s', async (sectionId) => {
    const res = await request(app)
      .post('/api/lti/launch')
      .send({ toolId: tool.id, courseId: COURSE, sectionId });
    expect(res.status).toBe(400);
    expect(prisma.ltiLaunch.create).not.toHaveBeenCalled();
  });

  // Row 15. Deep Linking is authoring — it writes content into the course.
  it('refuses Deep Linking from a role that may not author the course', async () => {
    const res = await request(app)
      .post('/api/lti/launch')
      .send({ toolId: tool.id, courseId: COURSE, messageType: 'LtiDeepLinkingRequest' });

    expect(res.status).toBe(403);
    expect(prisma.ltiLaunch.create).not.toHaveBeenCalled();
  });

  it('allows Deep Linking for the course owner', async () => {
    vi.mocked(prisma.course.findUnique).mockResolvedValue({ instructorId: 5 } as never);

    const res = await request(app)
      .post('/api/lti/launch')
      .send({ toolId: tool.id, courseId: COURSE, messageType: 'LtiDeepLinkingRequest' });

    expect(res.status).toBe(200);
  });

  it('refuses a resource-link launch from someone with no standing in the course', async () => {
    vi.mocked(prisma.enrollment.findUnique).mockResolvedValue(null as never);

    const res = await request(app)
      .post('/api/lti/launch')
      .send({ toolId: tool.id, courseId: COURSE });

    expect(res.status).toBe(403);
  });
});
