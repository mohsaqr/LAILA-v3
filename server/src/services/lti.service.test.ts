/**
 * LTI 1.3 platform behaviour.
 *
 * `docs/LTI_PLAN.md` says the negative cases are first-class here, because LTI
 * is certification-driven and "it worked with the one tool we tried" is not
 * evidence. Every refusal below is asserted, not assumed.
 *
 * The role mapping gets the most attention: a mistake there hands a student an
 * instructor's view of somebody else's tool.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';

vi.mock('../utils/logger.js', () => {
  const noop = () => {};
  return {
    createLogger: () => ({ error: noop, warn: noop, info: noop, debug: noop }),
    authLogger: { error: noop, warn: noop, info: noop, debug: noop },
  };
});
vi.mock('../utils/prisma.js', () => ({
  default: {
    course: { findUnique: vi.fn() },
    courseRole: { findUnique: vi.fn() },
    enrollment: { findUnique: vi.fn() },
    ltiTool: { findUnique: vi.fn() },
    ltiLaunch: { create: vi.fn(), findUnique: vi.fn(), update: vi.fn(), updateMany: vi.fn(), deleteMany: vi.fn() },
  },
}));

// A real RSA pair, so signing and verification are genuinely exercised.
const platformKeys = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
const platformPem = platformKeys.privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
const platformPub = platformKeys.publicKey.export({ type: 'spki', format: 'pem' }).toString();

vi.mock('./oidc.service.js', () => ({
  privateKey: () => platformPem,
  keyId: () => 'test-kid',
  issuer: () => 'https://laila.example.edu',
  isOidcEnabled: () => true,
}));

import prisma from '../utils/prisma.js';
import {
  rolesFor,
  standingIn,
  buildClaims,
  signLaunchToken,
  validateRedirectUri,
  redirectUrisOf,
  consumeLaunch,
  verifyToolToken,
  contentItemsFrom,
  resetJwksCache,
  newNonce,
  LtiError,
  MESSAGE_TYPE,
  LTI_CLAIMS,
  LTI_ROLES,
  type LtiToolRecord,
} from './lti.service.js';

const tool: LtiToolRecord = {
  id: 'tool1',
  name: 'Example Tool',
  clientId: 'laila-abc123',
  deploymentId: 'dep1',
  loginUrl: 'https://tool.example/login',
  targetLinkUri: 'https://tool.example/launch',
  redirectUris: JSON.stringify(['https://tool.example/callback']),
  jwksUrl: null,
  publicKeyPem: null,
  deepLinkingUrl: null,
  sendPii: false,
  isActive: true,
};

const user = { id: 42, email: 'ada@x.edu', fullname: 'Ada Lovelace', isConfirmed: true };
const context = { courseId: 7, title: 'Learning Analytics', slug: 'la-101' };

beforeEach(() => {
  vi.clearAllMocks();
  resetJwksCache();
});

describe('role mapping', () => {
  it('maps the course owner to Instructor', () => {
    expect(rolesFor({ isOwner: true, courseRole: null, isEnrolled: false })).toEqual([
      LTI_ROLES.instructor,
    ]);
  });

  it('maps course_admin to Instructor plus context Administrator', () => {
    expect(rolesFor({ isOwner: false, courseRole: 'course_admin', isEnrolled: true })).toEqual([
      LTI_ROLES.instructor,
      LTI_ROLES.contextAdmin,
    ]);
  });

  it('maps co_instructor to Instructor and ta to TeachingAssistant', () => {
    expect(rolesFor({ isOwner: false, courseRole: 'co_instructor', isEnrolled: true })).toEqual([
      LTI_ROLES.instructor,
    ]);
    expect(rolesFor({ isOwner: false, courseRole: 'ta', isEnrolled: true })).toEqual([LTI_ROLES.ta]);
  });

  it('maps a plain enrolled user to Learner', () => {
    expect(rolesFor({ isOwner: false, courseRole: null, isEnrolled: true })).toEqual([
      LTI_ROLES.learner,
    ]);
  });

  // The decision the whole module is built around: an empty array means refuse.
  it('gives no roles to someone with no standing in the course', () => {
    expect(rolesFor({ isOwner: false, courseRole: null, isEnrolled: false })).toEqual([]);
  });

  it('never emits an Administrator role at any level other than context', () => {
    const all = [
      rolesFor({ isOwner: true, courseRole: null, isEnrolled: true }),
      rolesFor({ isOwner: false, courseRole: 'course_admin', isEnrolled: true }),
      rolesFor({ isOwner: false, courseRole: 'ta', isEnrolled: true }),
      rolesFor({ isOwner: false, courseRole: null, isEnrolled: true }),
    ].flat();
    // system#Administrator or institution#Administrator would export LAILA's
    // global model, which is exactly what oidc.service refuses to do.
    expect(all.some((r) => r.includes('system#'))).toBe(false);
    expect(all.some((r) => r.includes('institution#'))).toBe(false);
  });
});

describe('standingIn', () => {
  const stub = (opts: { instructorId?: number; role?: string; enrolled?: boolean | string }) => {
    vi.mocked(prisma.course.findUnique).mockResolvedValue(
      { instructorId: opts.instructorId ?? 999 } as never,
    );
    vi.mocked(prisma.courseRole.findUnique).mockResolvedValue(
      opts.role ? ({ role: opts.role } as never) : (null as never),
    );
    vi.mocked(prisma.enrollment.findUnique).mockResolvedValue(
      opts.enrolled
        ? ({ id: 1, status: typeof opts.enrolled === 'string' ? opts.enrolled : 'active' } as never)
        : (null as never),
    );
  };

  it('recognises the owner', async () => {
    stub({ instructorId: 42 });
    expect(await standingIn(42, 7)).toMatchObject({ isOwner: true });
  });

  it('treats an unenrolled status as not enrolled', async () => {
    stub({ enrolled: 'unenrolled' });
    const standing = await standingIn(42, 7);
    expect(standing.isEnrolled).toBe(false);
    expect(rolesFor(standing)).toEqual([]);
  });

  // The load-bearing guarantee: global flags are never consulted.
  it('does not read isAdmin or isInstructor', async () => {
    stub({});
    await standingIn(42, 7);
    const selects = [
      vi.mocked(prisma.course.findUnique).mock.calls[0][0],
      vi.mocked(prisma.courseRole.findUnique).mock.calls[0][0],
      vi.mocked(prisma.enrollment.findUnique).mock.calls[0][0],
    ];
    const asText = JSON.stringify(selects);
    expect(asText).not.toMatch(/isAdmin/);
    expect(asText).not.toMatch(/isInstructor/);
  });
});

describe('claims', () => {
  const base = {
    tool,
    user,
    roles: [LTI_ROLES.learner],
    context,
    resourceLink: { id: 'section-91', title: 'Try the simulator' },
    returnUrl: 'https://laila.example.edu/courses/7',
    nonce: 'n-1',
    messageType: MESSAGE_TYPE.resourceLink,
  };

  it('carries every claim a resource-link launch requires', () => {
    const c = buildClaims(base);
    expect(c[LTI_CLAIMS.messageType]).toBe('LtiResourceLinkRequest');
    expect(c[LTI_CLAIMS.version]).toBe('1.3.0');
    expect(c[LTI_CLAIMS.deploymentId]).toBe('dep1');
    expect(c[LTI_CLAIMS.targetLinkUri]).toBe(tool.targetLinkUri);
    expect(c[LTI_CLAIMS.roles]).toEqual([LTI_ROLES.learner]);
    expect(c[LTI_CLAIMS.resourceLink]).toEqual({ id: 'section-91', title: 'Try the simulator' });
    expect(c[LTI_CLAIMS.context]).toMatchObject({ id: 'course-7', title: 'Learning Analytics' });
    expect(c.nonce).toBe('n-1');
  });

  // PII is opt-in per tool: a launch discloses to a third party.
  it('omits name and email unless the tool is allowed them', () => {
    const without = buildClaims(base);
    expect(without.name).toBeUndefined();
    expect(without.email).toBeUndefined();

    const with_ = buildClaims({ ...base, tool: { ...tool, sendPii: true } });
    expect(with_.name).toBe('Ada Lovelace');
    expect(with_.email).toBe('ada@x.edu');
  });

  it('falls back to the course when a resource link is missing', () => {
    const c = buildClaims({ ...base, resourceLink: null });
    expect(c[LTI_CLAIMS.resourceLink]).toEqual({ id: 'course-7', title: 'Learning Analytics' });
  });

  it('builds deep linking settings only for a deep linking message', () => {
    expect(buildClaims(base)[LTI_CLAIMS.deepLinkingSettings]).toBeUndefined();
    const dl = buildClaims({
      ...base,
      messageType: MESSAGE_TYPE.deepLinking,
      deepLinkingReturnUrl: 'https://laila.example.edu/api/lti/deep-link',
      deepLinkingData: 'opaque',
    });
    expect(dl[LTI_CLAIMS.deepLinkingSettings]).toMatchObject({
      deep_link_return_url: 'https://laila.example.edu/api/lti/deep-link',
      accept_types: ['ltiResourceLink'],
      data: 'opaque',
    });
    // A deep linking message describes no resource link yet — that is the point.
    expect(dl[LTI_CLAIMS.resourceLink]).toBeUndefined();
  });

  it('asks tools to render in an iframe and offers a way back', () => {
    expect(buildClaims(base)[LTI_CLAIMS.launchPresentation]).toEqual({
      document_target: 'iframe',
      return_url: 'https://laila.example.edu/courses/7',
    });
  });
});

describe('signLaunchToken', () => {
  it('signs RS256 with the shared kid, issuer, audience and stable subject', () => {
    const token = signLaunchToken(
      buildClaims({
        tool, user, roles: [LTI_ROLES.learner], context,
        resourceLink: null, returnUrl: null, nonce: 'n', messageType: MESSAGE_TYPE.resourceLink,
      }),
      tool,
      user.id,
    );
    const decoded = jwt.decode(token, { complete: true }) as {
      header: { alg: string; kid: string };
      payload: Record<string, unknown>;
    };
    expect(decoded.header.alg).toBe('RS256');
    expect(decoded.header.kid).toBe('test-kid');
    expect(decoded.payload.iss).toBe('https://laila.example.edu');
    expect(decoded.payload.aud).toBe('laila-abc123');
    // Matches signIdToken's contract: a tool stores this as its external id.
    expect(decoded.payload.sub).toBe('42');

    // And it genuinely verifies against the platform's public key.
    expect(() => jwt.verify(token, platformPub, { algorithms: ['RS256'] })).not.toThrow();
  });
});

describe('redirect URIs', () => {
  it('matches exactly', () => {
    expect(validateRedirectUri(tool, 'https://tool.example/callback')).toBe(true);
  });

  // An open redirect here hands a signed identity assertion to whoever asked.
  it.each([
    'https://tool.example/callback/extra',
    'https://tool.example/callback?x=1',
    'https://tool.example.evil/callback',
    'https://evil/callback',
    undefined,
  ])('refuses %s', (uri) => {
    expect(validateRedirectUri(tool, uri as string | undefined)).toBe(false);
  });

  it('treats a corrupt stored list as empty rather than throwing', () => {
    expect(redirectUrisOf({ redirectUris: '{not json' })).toEqual([]);
    expect(validateRedirectUri({ redirectUris: '{not json' }, 'https://x')).toBe(false);
  });
});

describe('consumeLaunch', () => {
  const launch = {
    id: 'hint1', toolId: 'tool1', userId: 42, courseId: 7, sectionId: 91,
    messageType: MESSAGE_TYPE.resourceLink, consumedAt: null,
    expiresAt: new Date(Date.now() + 60_000),
  };

  it('redeems a valid launch once', async () => {
    vi.mocked(prisma.ltiLaunch.findUnique).mockResolvedValue(launch as never);
    vi.mocked(prisma.ltiLaunch.updateMany).mockResolvedValue({ count: 1 } as never);
    const got = await consumeLaunch('hint1', 'tool1', 42);
    expect(got.courseId).toBe(7);
    expect(vi.mocked(prisma.ltiLaunch.updateMany).mock.calls[0][0].data).toMatchObject({
      consumedAt: expect.any(Date),
    });
  });

  // The read-then-write version of this passed the sequential replay test above
  // while still allowing two concurrent redemptions to both succeed — two signed
  // id_tokens for one launch. The claim is now a conditional write, so the
  // database decides the winner.
  it('claims the launch with a write conditioned on it being unconsumed', async () => {
    vi.mocked(prisma.ltiLaunch.findUnique).mockResolvedValue(launch as never);
    vi.mocked(prisma.ltiLaunch.updateMany).mockResolvedValue({ count: 1 } as never);

    await consumeLaunch('hint1', 'tool1', 42);

    expect(vi.mocked(prisma.ltiLaunch.updateMany).mock.calls[0][0].where).toMatchObject({
      id: 'hint1',
      consumedAt: null,
    });
  });

  it('refuses the loser of a concurrent redemption', async () => {
    // Both callers read consumedAt: null; only one conditional write matches.
    vi.mocked(prisma.ltiLaunch.findUnique).mockResolvedValue(launch as never);
    vi.mocked(prisma.ltiLaunch.updateMany).mockResolvedValue({ count: 0 } as never);

    await expect(consumeLaunch('hint1', 'tool1', 42)).rejects.toThrow(/already been used/);
  });

  it('refuses a missing hint', async () => {
    await expect(consumeLaunch(undefined, 'tool1', 42)).rejects.toThrow(/Missing lti_message_hint/);
  });

  it('refuses an unknown launch', async () => {
    vi.mocked(prisma.ltiLaunch.findUnique).mockResolvedValue(null as never);
    await expect(consumeLaunch('nope', 'tool1', 42)).rejects.toThrow(/Unknown launch/);
  });

  // A replayed launch is a replayed identity assertion.
  it('refuses a replay', async () => {
    vi.mocked(prisma.ltiLaunch.findUnique).mockResolvedValue(
      { ...launch, consumedAt: new Date() } as never,
    );
    await expect(consumeLaunch('hint1', 'tool1', 42)).rejects.toThrow(/already been used/);
  });

  it('refuses an expired launch', async () => {
    vi.mocked(prisma.ltiLaunch.findUnique).mockResolvedValue(
      { ...launch, expiresAt: new Date(Date.now() - 1) } as never,
    );
    await expect(consumeLaunch('hint1', 'tool1', 42)).rejects.toThrow(/expired/);
  });

  // A hint is not a bearer token.
  it('refuses a hint presented by a different tool', async () => {
    vi.mocked(prisma.ltiLaunch.findUnique).mockResolvedValue(launch as never);
    await expect(consumeLaunch('hint1', 'otherTool', 42)).rejects.toThrow(/does not belong/);
  });

  it('refuses a hint belonging to another user', async () => {
    vi.mocked(prisma.ltiLaunch.findUnique).mockResolvedValue(launch as never);
    await expect(consumeLaunch('hint1', 'tool1', 99)).rejects.toThrow(/another user/);
  });

  it('reports errors with an LTI error code a tool can act on', async () => {
    vi.mocked(prisma.ltiLaunch.findUnique).mockResolvedValue(launch as never);
    await expect(consumeLaunch('hint1', 'tool1', 99)).rejects.toMatchObject({
      code: 'login_required',
    });
  });
});

describe('verifying a token the tool signed', () => {
  const toolKeys = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
  const toolPem = toolKeys.privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
  const toolPub = toolKeys.publicKey.export({ type: 'spki', format: 'pem' }).toString();
  const pinned: LtiToolRecord = { ...tool, publicKeyPem: toolPub };

  const toolToken = (over: Record<string, unknown> = {}, key = toolPem, alg = 'RS256') =>
    jwt.sign(
      {
        [LTI_CLAIMS.contentItems]: [
          { type: 'ltiResourceLink', url: 'https://tool.example/item/1', title: 'Item 1' },
          { type: 'image', url: 'https://tool.example/pic.png' },
        ],
        ...over,
      },
      key,
      {
        algorithm: alg as jwt.Algorithm,
        issuer: tool.clientId,
        audience: 'https://laila.example.edu',
        expiresIn: 300,
      },
    );

  it('accepts a correctly signed response and extracts resource links', async () => {
    const claims = await verifyToolToken(toolToken(), pinned);
    const items = contentItemsFrom(claims);
    // The image is dropped: we advertised accept_types ltiResourceLink.
    expect(items).toHaveLength(1);
    expect(items[0].url).toBe('https://tool.example/item/1');
  });

  // An HMAC would let anyone holding our public key mint a "tool" response.
  it('refuses HS256 even when the secret would verify', async () => {
    const hs = jwt.sign({ a: 1 }, 'shared', {
      algorithm: 'HS256',
      issuer: tool.clientId,
      audience: 'https://laila.example.edu',
    });
    await expect(verifyToolToken(hs, pinned)).rejects.toThrow(/RS256 required/);
  });

  it('refuses a token signed by the wrong key', async () => {
    const other = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
    const wrong = other.privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
    await expect(verifyToolToken(toolToken({}, wrong), pinned)).rejects.toThrow(/rejected/);
  });

  it('refuses a token addressed to someone else', async () => {
    const wrongAud = jwt.sign({}, toolPem, {
      algorithm: 'RS256',
      issuer: tool.clientId,
      audience: 'https://elsewhere.example',
    });
    await expect(verifyToolToken(wrongAud, pinned)).rejects.toThrow(/rejected/);
  });

  it('refuses an expired token', async () => {
    const expired = jwt.sign({}, toolPem, {
      algorithm: 'RS256',
      issuer: tool.clientId,
      audience: 'https://laila.example.edu',
      expiresIn: -10,
    });
    await expect(verifyToolToken(expired, pinned)).rejects.toThrow(/rejected/);
  });

  it('refuses a malformed token', async () => {
    await expect(verifyToolToken('not.a.jwt', pinned)).rejects.toThrow(/Malformed/);
  });

  it('refuses a tool with no registered key at all', async () => {
    await expect(verifyToolToken(toolToken(), tool)).rejects.toThrow(/no registered public key/);
  });

  it('fetches and uses a JWKS when no PEM is pinned', async () => {
    const jwk = crypto.createPublicKey(toolPub).export({ format: 'jwk' }) as Record<string, string>;
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ keys: [{ ...jwk, kid: 'tool-kid' }] }), { status: 200 }),
    );
    const token = jwt.sign({}, toolPem, {
      algorithm: 'RS256',
      keyid: 'tool-kid',
      issuer: tool.clientId,
      audience: 'https://laila.example.edu',
      expiresIn: 300,
    });
    await expect(
      verifyToolToken(token, { ...tool, jwksUrl: 'https://tool.example/jwks' }),
    ).resolves.toBeTruthy();
    expect(fetchSpy).toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it('reports a JWKS that cannot be reached rather than hanging', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('ECONNREFUSED'));
    await expect(
      verifyToolToken(toolToken(), { ...tool, jwksUrl: 'https://tool.example/jwks' }),
    ).rejects.toThrow(/public keys/);
    fetchSpy.mockRestore();
  });
});

describe('contentItemsFrom', () => {
  it('returns nothing for a response with no items', () => {
    expect(contentItemsFrom({})).toEqual([]);
    expect(contentItemsFrom({ [LTI_CLAIMS.contentItems]: 'not an array' })).toEqual([]);
  });
});

describe('newNonce', () => {
  it('is unguessable and unique', () => {
    const a = newNonce();
    expect(a).toMatch(/^[0-9a-f]{32}$/);
    expect(new Set(Array.from({ length: 50 }, newNonce)).size).toBe(50);
  });
});

describe('LtiError', () => {
  it('carries an OAuth error code and an HTTP status', () => {
    const e = new LtiError('login_required', 'no session', 401);
    expect(e.code).toBe('login_required');
    expect(e.statusCode).toBe(401);
  });
});
