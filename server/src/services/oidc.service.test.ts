import { describe, it, expect, vi, beforeEach } from 'vitest';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';

vi.mock('../utils/prisma.js', () => ({
  default: {
    oidcAuthCode: {
      create: vi.fn(),
      delete: vi.fn(),
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
  },
}));

vi.mock('../utils/logger.js', () => ({
  authLogger: { warn: vi.fn(), info: vi.fn(), error: vi.fn() },
}));

import prisma from '../utils/prisma.js';
import {
  consumeAuthCode,
  discoveryDocument,
  findClient,
  isOidcEnabled,
  jwks,
  mintAuthCode,
  parseClients,
  resetOidcConfigCache,
  signIdToken,
  validateRedirectUri,
  verifyClientSecret,
  verifyPkce,
} from './oidc.service.js';

// A real 2048-bit key: these tests verify signatures end to end rather than
// asserting on a stub, so the RS256 wiring itself is under test.
const { privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
const PRIVATE_PEM = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
const PUBLIC_PEM = crypto.createPublicKey(privateKey).export({ type: 'spki', format: 'pem' }).toString();

const SECRET = 'super-secret-value';
const SECRET_HASH = crypto.createHash('sha256').update(SECRET).digest('hex');
const REDIRECT = 'https://chatoyon.example/api/auth/sso/abc-123/callback';

const CLIENTS = JSON.stringify([
  { clientId: 'chatoyon', clientSecretHash: SECRET_HASH, redirectUris: [REDIRECT] },
]);

function sha256Url(input: string): string {
  return crypto.createHash('sha256').update(input).digest('base64url');
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(prisma.oidcAuthCode.deleteMany).mockResolvedValue({ count: 0 } as never);
  process.env.OIDC_ISSUER = 'https://laila.example';
  process.env.OIDC_PRIVATE_KEY = Buffer.from(PRIVATE_PEM, 'utf8').toString('base64');
  process.env.OIDC_CLIENTS = CLIENTS;
  delete process.env.OIDC_KEY_ID;
  resetOidcConfigCache();
});

describe('isOidcEnabled', () => {
  it('is false until both issuer and key are configured, so a default install exposes nothing', () => {
    delete process.env.OIDC_PRIVATE_KEY;
    expect(isOidcEnabled()).toBe(false);
    process.env.OIDC_PRIVATE_KEY = 'x';
    expect(isOidcEnabled()).toBe(true);
  });
});

describe('parseClients', () => {
  it('returns an empty registry when unset', () => {
    expect(parseClients(undefined)).toEqual([]);
  });

  it('rejects a client with no redirect URIs rather than defaulting to permissive', () => {
    const bad = JSON.stringify([{ clientId: 'x', clientSecretHash: 'y', redirectUris: [] }]);
    expect(() => parseClients(bad)).toThrow(/redirectUri/);
  });

  it('rejects malformed JSON and non-arrays loudly', () => {
    expect(() => parseClients('{')).toThrow(/valid JSON/);
    expect(() => parseClients('{"a":1}')).toThrow(/array/);
  });

  it('requires a secret hash, never allowing a secretless client', () => {
    const bad = JSON.stringify([{ clientId: 'x', redirectUris: ['https://a'] }]);
    expect(() => parseClients(bad)).toThrow(/clientSecretHash/);
  });
});

describe('validateRedirectUri', () => {
  const client = { clientId: 'chatoyon', clientSecretHash: SECRET_HASH, redirectUris: [REDIRECT] };

  it('accepts the exact registered URI', () => {
    expect(validateRedirectUri(client, REDIRECT)).toBe(true);
  });

  // Each of these is a real open-redirect technique. Exact matching is the
  // only defence that turns all of them away at once.
  it.each([
    ['a path suffix', `${REDIRECT}/../../evil`],
    ['an appended path', `${REDIRECT}.evil.com`],
    ['a different host on the same path', 'https://evil.example/api/auth/sso/abc-123/callback'],
    ['an added query string', `${REDIRECT}?next=https://evil.example`],
    ['a scheme downgrade', REDIRECT.replace('https', 'http')],
    ['nothing at all', undefined],
  ])('rejects %s', (_label, candidate) => {
    expect(validateRedirectUri(client, candidate as string | undefined)).toBe(false);
  });
});

describe('verifyClientSecret', () => {
  const client = { clientId: 'chatoyon', clientSecretHash: SECRET_HASH, redirectUris: [REDIRECT] };

  it('accepts the correct secret', () => {
    expect(verifyClientSecret(client, SECRET)).toBe(true);
  });

  it('rejects a wrong or missing secret', () => {
    expect(verifyClientSecret(client, 'wrong')).toBe(false);
    expect(verifyClientSecret(client, undefined)).toBe(false);
    expect(verifyClientSecret(client, '')).toBe(false);
  });

  it('rejects the stored hash presented as if it were the secret', () => {
    // Guards against a comparison that forgets to hash the presented value.
    expect(verifyClientSecret(client, SECRET_HASH)).toBe(false);
  });
});

describe('verifyPkce', () => {
  const verifier = crypto.randomBytes(40).toString('base64url'); // ~54 chars
  const challenge = sha256Url(verifier);

  it('accepts the verifier that produced the challenge', () => {
    expect(verifyPkce(verifier, challenge)).toBe(true);
  });

  it('rejects a different verifier', () => {
    expect(verifyPkce(crypto.randomBytes(40).toString('base64url'), challenge)).toBe(false);
  });

  it('rejects a missing verifier', () => {
    expect(verifyPkce(undefined, challenge)).toBe(false);
  });

  it('rejects verifiers outside the RFC 7636 length bounds', () => {
    expect(verifyPkce('short', sha256Url('short'))).toBe(false);
    const long = 'a'.repeat(129);
    expect(verifyPkce(long, sha256Url(long))).toBe(false);
  });

  it('rejects a plain (unhashed) challenge, so downgrade to plain PKCE is impossible', () => {
    expect(verifyPkce(verifier, verifier)).toBe(false);
  });
});

describe('discoveryDocument', () => {
  it('advertises only the code flow with S256 PKCE', () => {
    const doc = discoveryDocument();
    expect(doc.response_types_supported).toEqual(['code']);
    expect(doc.grant_types_supported).toEqual(['authorization_code']);
    expect(doc.code_challenge_methods_supported).toEqual(['S256']);
    expect(doc.id_token_signing_alg_values_supported).toEqual(['RS256']);
  });

  it('normalises a trailing slash so `iss` byte-matches the discovered issuer', () => {
    process.env.OIDC_ISSUER = 'https://laila.example/';
    resetOidcConfigCache();
    expect(discoveryDocument().issuer).toBe('https://laila.example');
  });

  it('points authorize at the SPA route and token/jwks at the API', () => {
    const doc = discoveryDocument();
    expect(doc.authorization_endpoint).toBe('https://laila.example/oidc/authorize');
    expect(doc.token_endpoint).toBe('https://laila.example/api/oidc/token');
    expect(doc.jwks_uri).toBe('https://laila.example/api/oidc/jwks');
  });
});

describe('jwks', () => {
  it('publishes the public key only — never the private half', () => {
    const key = jwks().keys[0];
    expect(key.kty).toBe('RSA');
    expect(key.alg).toBe('RS256');
    expect(key.use).toBe('sig');
    expect(key.n).toBeTruthy();
    expect(key.e).toBeTruthy();
    // RSA private components must never appear in a published JWKS.
    for (const secretField of ['d', 'p', 'q', 'dp', 'dq', 'qi']) {
      expect(key[secretField]).toBeUndefined();
    }
  });

  it('accepts a raw PEM key as well as base64, since operators supply both', () => {
    process.env.OIDC_PRIVATE_KEY = PRIVATE_PEM;
    resetOidcConfigCache();
    expect(jwks().keys[0].n).toBeTruthy();
  });

  it('derives a kid from the key so rotation changes it', () => {
    const first = jwks().keys[0].kid;
    const other = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
    process.env.OIDC_PRIVATE_KEY = Buffer.from(
      other.privateKey.export({ type: 'pkcs8', format: 'pem' }).toString(),
      'utf8'
    ).toString('base64');
    resetOidcConfigCache();
    expect(jwks().keys[0].kid).not.toBe(first);
  });
});

describe('signIdToken', () => {
  const user = { id: 42, email: 'learner@laila.example', fullname: 'A Learner', isConfirmed: true };

  it('produces a token the public key verifies, with the expected claims', () => {
    const token = signIdToken(user, 'chatoyon', 'nonce-abc');
    const claims = jwt.verify(token, PUBLIC_PEM, {
      algorithms: ['RS256'],
      audience: 'chatoyon',
      issuer: 'https://laila.example',
    }) as Record<string, unknown>;

    expect(claims.sub).toBe('42');
    expect(claims.email).toBe('learner@laila.example');
    expect(claims.email_verified).toBe(true);
    expect(claims.name).toBe('A Learner');
    expect(claims.nonce).toBe('nonce-abc');
  });

  it('stamps the kid in the header so the RP can select the key', () => {
    const token = signIdToken(user, 'chatoyon', null);
    const header = JSON.parse(Buffer.from(token.split('.')[0], 'base64url').toString());
    expect(header.alg).toBe('RS256');
    expect(header.kid).toBe(jwks().keys[0].kid);
  });

  it('omits nonce entirely when the RP did not send one', () => {
    const token = signIdToken(user, 'chatoyon', null);
    const claims = jwt.decode(token) as Record<string, unknown>;
    expect('nonce' in claims).toBe(false);
  });

  // The load-bearing privacy/authorization invariant: LAILA asserts identity,
  // never authorization. A role claim here would let a bug in LAILA grant
  // educator access to another system's student data.
  it('carries no role claim of any kind', () => {
    const claims = jwt.decode(signIdToken(user, 'chatoyon', null)) as Record<string, unknown>;
    for (const forbidden of ['role', 'roles', 'isAdmin', 'isInstructor', 'is_admin', 'is_instructor']) {
      expect(claims[forbidden]).toBeUndefined();
    }
  });

  it('reports an unconfirmed email as unverified rather than hiding it', () => {
    const claims = jwt.decode(
      signIdToken({ ...user, isConfirmed: false }, 'chatoyon', null)
    ) as Record<string, unknown>;
    expect(claims.email_verified).toBe(false);
  });

  it('is rejected by a different audience', () => {
    const token = signIdToken(user, 'chatoyon', null);
    expect(() =>
      jwt.verify(token, PUBLIC_PEM, { algorithms: ['RS256'], audience: 'someone-else' })
    ).toThrow();
  });
});

describe('findClient', () => {
  it('resolves a registered client and refuses everything else', () => {
    expect(findClient('chatoyon')?.clientId).toBe('chatoyon');
    expect(findClient('unknown')).toBeNull();
    expect(findClient(undefined)).toBeNull();
  });
});

describe('mintAuthCode', () => {
  it('stores a high-entropy code with a short expiry', async () => {
    vi.mocked(prisma.oidcAuthCode.create).mockResolvedValue({} as never);
    const before = Date.now();
    const code = await mintAuthCode({
      userId: 42,
      clientId: 'chatoyon',
      redirectUri: REDIRECT,
      nonce: 'n',
      codeChallenge: 'c',
    });

    expect(code.length).toBeGreaterThanOrEqual(43); // 32 random bytes, base64url
    const { data } = vi.mocked(prisma.oidcAuthCode.create).mock.calls[0][0] as {
      data: { expiresAt: Date; userId: number };
    };
    expect(data.userId).toBe(42);
    // The clock advances between `before` and the mint, so the expiry lands in
    // [before + TTL, after + TTL] — bounding it against `after` keeps this from
    // flaking while still failing if the TTL is widened.
    const after = Date.now();
    expect(data.expiresAt.getTime()).toBeGreaterThanOrEqual(before + 60_000);
    expect(data.expiresAt.getTime()).toBeLessThanOrEqual(after + 60_000);
  });

  it('sweeps expired codes so the table cannot grow without bound', async () => {
    vi.mocked(prisma.oidcAuthCode.create).mockResolvedValue({} as never);
    await mintAuthCode({ userId: 1, clientId: 'chatoyon', redirectUri: REDIRECT, codeChallenge: 'c' });
    expect(prisma.oidcAuthCode.deleteMany).toHaveBeenCalled();
  });
});

describe('consumeAuthCode', () => {
  const verifier = crypto.randomBytes(40).toString('base64url');
  const challenge = sha256Url(verifier);

  const stored = (overrides: Record<string, unknown> = {}) => ({
    code: 'the-code',
    userId: 42,
    clientId: 'chatoyon',
    redirectUri: REDIRECT,
    nonce: 'nonce-abc',
    codeChallenge: challenge,
    expiresAt: new Date(Date.now() + 30_000),
    createdAt: new Date(),
    ...overrides,
  });

  it('redeems a valid code once and returns the subject', async () => {
    vi.mocked(prisma.oidcAuthCode.delete).mockResolvedValue(stored() as never);
    const result = await consumeAuthCode('the-code', 'chatoyon', REDIRECT, verifier);
    expect(result).toEqual({ userId: 42, nonce: 'nonce-abc' });
  });

  // The delete IS the concurrency control. If validation happened first, two
  // racing redemptions could both pass and mint two sessions from one code.
  it('deletes before validating, so a replay finds nothing to redeem', async () => {
    vi.mocked(prisma.oidcAuthCode.delete)
      .mockResolvedValueOnce(stored() as never)
      .mockRejectedValueOnce(new Error('P2025: record not found'));

    expect(await consumeAuthCode('the-code', 'chatoyon', REDIRECT, verifier)).not.toBeNull();
    expect(await consumeAuthCode('the-code', 'chatoyon', REDIRECT, verifier)).toBeNull();
  });

  it('consumes the code even when a later check fails, denying a retry with corrected inputs', async () => {
    vi.mocked(prisma.oidcAuthCode.delete).mockResolvedValue(stored() as never);
    await consumeAuthCode('the-code', 'chatoyon', REDIRECT, 'wrong-verifier');
    expect(prisma.oidcAuthCode.delete).toHaveBeenCalledWith({ where: { code: 'the-code' } });
  });

  it('rejects an unknown code', async () => {
    vi.mocked(prisma.oidcAuthCode.delete).mockRejectedValue(new Error('P2025'));
    expect(await consumeAuthCode('nope', 'chatoyon', REDIRECT, verifier)).toBeNull();
  });

  it('rejects a missing code without touching the database', async () => {
    expect(await consumeAuthCode(undefined, 'chatoyon', REDIRECT, verifier)).toBeNull();
    expect(prisma.oidcAuthCode.delete).not.toHaveBeenCalled();
  });

  it('rejects an expired code', async () => {
    vi.mocked(prisma.oidcAuthCode.delete).mockResolvedValue(
      stored({ expiresAt: new Date(Date.now() - 1) }) as never
    );
    expect(await consumeAuthCode('the-code', 'chatoyon', REDIRECT, verifier)).toBeNull();
  });

  it('rejects redemption by a different client than the one it was issued to', async () => {
    vi.mocked(prisma.oidcAuthCode.delete).mockResolvedValue(stored() as never);
    expect(await consumeAuthCode('the-code', 'other-client', REDIRECT, verifier)).toBeNull();
  });

  it('rejects a redirect_uri that differs from the one the code was bound to', async () => {
    vi.mocked(prisma.oidcAuthCode.delete).mockResolvedValue(stored() as never);
    expect(
      await consumeAuthCode('the-code', 'chatoyon', 'https://evil.example/callback', verifier)
    ).toBeNull();
    expect(await consumeAuthCode('the-code', 'chatoyon', undefined, verifier)).toBeNull();
  });

  it('rejects a wrong or absent PKCE verifier', async () => {
    vi.mocked(prisma.oidcAuthCode.delete).mockResolvedValue(stored() as never);
    expect(await consumeAuthCode('the-code', 'chatoyon', REDIRECT, 'wrong')).toBeNull();
    expect(await consumeAuthCode('the-code', 'chatoyon', REDIRECT, undefined)).toBeNull();
  });
});
