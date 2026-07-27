/**
 * Minimal OpenID Connect provider — LAILA as the identity provider.
 *
 * Scope is deliberately narrow: the authorization-code flow with mandatory
 * PKCE, RS256 id_tokens, and nothing else. No refresh tokens, no userinfo, no
 * dynamic client registration, no implicit/hybrid flows. A relying party
 * (today: chatoyon) discovers us, redirects the learner here, and exchanges a
 * one-time code for a signed id_token server-to-server.
 *
 * WHY ASYMMETRIC. The relying party only ever holds our *public* key, so a
 * compromise of chatoyon cannot forge a LAILA identity. A shared HMAC secret
 * would let either side mint logins for the other; RS256 makes the trust
 * strictly one-directional, which is the whole point of this integration.
 *
 * WHAT WE DO NOT ASSERT. The id_token carries identity only — sub, email,
 * name. It deliberately carries NO role claim. LAILA's isAdmin/isInstructor
 * are LAILA's authorization model, and replaying them into another app would
 * mean a bug here silently grants elevated access to someone else's data.
 * The relying party assigns its own roles.
 */
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import prisma from '../utils/prisma.js';
import { authLogger } from '../utils/logger.js';

/** Authorization codes are redeemed immediately by a server; they need no human latency. */
const CODE_TTL_MS = 60 * 1000;
/** The id_token is consumed the moment it is issued; a short life limits replay if logged. */
const ID_TOKEN_TTL_SECONDS = 300;

export interface OidcClient {
  clientId: string;
  /** sha256 hex of the client secret. The plaintext never lives in LAILA's config. */
  clientSecretHash: string;
  /** Exact-match allow-list. No wildcards, no prefix matching — see validateRedirectUri. */
  redirectUris: string[];
  name?: string;
}

// ---------------------------------------------------------------------------
// Configuration (read lazily — imports are hoisted above dotenv.config())
// ---------------------------------------------------------------------------

let cachedIssuer: string | null = null;
let cachedPrivateKey: string | null = null;
let cachedKeyId: string | null = null;
let cachedClients: OidcClient[] | null = null;

/** True when the operator has configured OIDC. Routes 404 when this is false. */
export function isOidcEnabled(): boolean {
  return Boolean(process.env.OIDC_ISSUER && process.env.OIDC_PRIVATE_KEY);
}

export function issuer(): string {
  if (cachedIssuer) return cachedIssuer;
  const value = process.env.OIDC_ISSUER;
  if (!value) throw new Error('OIDC_ISSUER environment variable is required');
  // Trailing slashes break issuer comparison in strict RP libraries (the
  // id_token `iss` must byte-match the discovery `issuer`), so normalise once.
  cachedIssuer = value.replace(/\/+$/, '');
  return cachedIssuer;
}

/**
 * The RS256 private key in PEM (PKCS#8). Accepts base64-encoded PEM too, because
 * multi-line values survive .env files badly and operators reliably get it wrong.
 */
export function privateKey(): string {
  if (cachedPrivateKey) return cachedPrivateKey;
  const raw = process.env.OIDC_PRIVATE_KEY;
  if (!raw) throw new Error('OIDC_PRIVATE_KEY environment variable is required');
  const pem = raw.includes('-----BEGIN') ? raw.replace(/\\n/g, '\n') : Buffer.from(raw, 'base64').toString('utf8');
  if (!pem.includes('-----BEGIN')) throw new Error('OIDC_PRIVATE_KEY is neither PEM nor base64-encoded PEM');
  cachedPrivateKey = pem;
  return pem;
}

/**
 * Key id published in the JWKS and stamped into every id_token header. Derived
 * from the key itself when unset, so rotating the key rotates the kid — a
 * relying party then re-fetches the JWKS instead of failing closed forever.
 */
export function keyId(): string {
  if (cachedKeyId) return cachedKeyId;
  cachedKeyId =
    process.env.OIDC_KEY_ID ||
    crypto.createHash('sha256').update(publicKeyPem()).digest('base64url').slice(0, 16);
  return cachedKeyId;
}

function publicKeyPem(): string {
  return crypto.createPublicKey(privateKey()).export({ type: 'spki', format: 'pem' }).toString();
}

/** Parse the OIDC_CLIENTS registry. Exported for tests; throws on malformed entries. */
export function parseClients(json: string | undefined): OidcClient[] {
  if (!json) return [];
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    throw new Error('OIDC_CLIENTS is not valid JSON');
  }
  if (!Array.isArray(raw)) throw new Error('OIDC_CLIENTS must be a JSON array');
  return raw.map((entry, i) => {
    const c = entry as Partial<OidcClient>;
    if (!c.clientId) throw new Error(`OIDC_CLIENTS[${i}] is missing clientId`);
    if (!c.clientSecretHash) throw new Error(`OIDC_CLIENTS[${i}] is missing clientSecretHash`);
    if (!Array.isArray(c.redirectUris) || c.redirectUris.length === 0) {
      throw new Error(`OIDC_CLIENTS[${i}] needs at least one redirectUri`);
    }
    return {
      clientId: c.clientId,
      clientSecretHash: c.clientSecretHash.toLowerCase(),
      redirectUris: c.redirectUris,
      name: c.name,
    };
  });
}

export function clients(): OidcClient[] {
  if (cachedClients) return cachedClients;
  cachedClients = parseClients(process.env.OIDC_CLIENTS);
  return cachedClients;
}

/** Test seam: drop memoised config so a test can swap env between cases. */
export function resetOidcConfigCache(): void {
  cachedIssuer = null;
  cachedPrivateKey = null;
  cachedKeyId = null;
  cachedClients = null;
}

export function findClient(clientId: string | undefined): OidcClient | null {
  if (!clientId) return null;
  return clients().find((c) => c.clientId === clientId) ?? null;
}

/**
 * Exact string match against the registered redirect URIs.
 *
 * Deliberately not a prefix or origin check: an open redirect here hands the
 * authorization code to an attacker, which is the single most damaging bug an
 * OIDC provider can ship.
 */
export function validateRedirectUri(client: OidcClient, redirectUri: string | undefined): boolean {
  if (!redirectUri) return false;
  return client.redirectUris.includes(redirectUri);
}

/** Constant-time client-secret check against the stored sha256 hash. */
export function verifyClientSecret(client: OidcClient, presented: string | undefined): boolean {
  if (!presented) return false;
  const actual = Buffer.from(crypto.createHash('sha256').update(presented).digest('hex'));
  const expected = Buffer.from(client.clientSecretHash);
  if (actual.length !== expected.length) return false;
  return crypto.timingSafeEqual(actual, expected);
}

// ---------------------------------------------------------------------------
// PKCE
// ---------------------------------------------------------------------------

/**
 * Verify an S256 PKCE challenge. Only S256 is supported — "plain" offers no
 * protection at all and exists in the spec purely for constrained clients.
 */
export function verifyPkce(codeVerifier: string | undefined, codeChallenge: string): boolean {
  if (!codeVerifier) return false;
  // RFC 7636: verifier is 43-128 chars of unreserved ASCII.
  if (codeVerifier.length < 43 || codeVerifier.length > 128) return false;
  const computed = crypto.createHash('sha256').update(codeVerifier).digest('base64url');
  const a = Buffer.from(computed);
  const b = Buffer.from(codeChallenge);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

// ---------------------------------------------------------------------------
// Discovery + JWKS
// ---------------------------------------------------------------------------

export function discoveryDocument(): Record<string, unknown> {
  const iss = issuer();
  return {
    issuer: iss,
    // The authorize step is a React page, not an API route: LAILA's session
    // token lives in localStorage and a browser redirect cannot carry an
    // Authorization header, so the SPA has to read it and call the API itself.
    authorization_endpoint: `${iss}/oidc/authorize`,
    token_endpoint: `${iss}/api/oidc/token`,
    jwks_uri: `${iss}/api/oidc/jwks`,
    response_types_supported: ['code'],
    grant_types_supported: ['authorization_code'],
    subject_types_supported: ['public'],
    id_token_signing_alg_values_supported: ['RS256'],
    scopes_supported: ['openid', 'email', 'profile'],
    token_endpoint_auth_methods_supported: ['client_secret_basic', 'client_secret_post'],
    code_challenge_methods_supported: ['S256'],
    claims_supported: ['sub', 'iss', 'aud', 'exp', 'iat', 'nonce', 'email', 'email_verified', 'name'],
  };
}

export function jwks(): { keys: Array<Record<string, unknown>> } {
  const jwk = crypto.createPublicKey(privateKey()).export({ format: 'jwk' }) as Record<string, unknown>;
  return { keys: [{ ...jwk, kid: keyId(), use: 'sig', alg: 'RS256' }] };
}

// ---------------------------------------------------------------------------
// Authorization codes
// ---------------------------------------------------------------------------

export interface MintCodeInput {
  userId: number;
  clientId: string;
  redirectUri: string;
  nonce?: string;
  codeChallenge: string;
}

export async function mintAuthCode(input: MintCodeInput): Promise<string> {
  // Opportunistic sweep — there is no scheduler in LAILA and expired codes are
  // unusable anyway, so piggy-backing on the mint keeps the table from growing.
  prisma.oidcAuthCode
    .deleteMany({ where: { expiresAt: { lt: new Date() } } })
    .catch((err: unknown) => authLogger.warn({ err }, 'oidc: expired-code sweep failed'));

  const code = crypto.randomBytes(32).toString('base64url');
  await prisma.oidcAuthCode.create({
    data: {
      code,
      userId: input.userId,
      clientId: input.clientId,
      redirectUri: input.redirectUri,
      nonce: input.nonce ?? null,
      codeChallenge: input.codeChallenge,
      expiresAt: new Date(Date.now() + CODE_TTL_MS),
    },
  });
  return code;
}

export interface RedeemedCode {
  userId: number;
  nonce: string | null;
}

/**
 * Atomically consume an authorization code, enforcing single use.
 *
 * The delete happens FIRST and is the concurrency control: `code` is the
 * primary key, so exactly one of two racing redemptions succeeds and the other
 * gets P2025. Validating before deleting would leave a window in which both
 * requests pass their checks and two sessions are minted from one code.
 */
export async function consumeAuthCode(
  code: string | undefined,
  clientId: string,
  redirectUri: string | undefined,
  codeVerifier: string | undefined,
): Promise<RedeemedCode | null> {
  if (!code) return null;

  let row;
  try {
    row = await prisma.oidcAuthCode.delete({ where: { code } });
  } catch {
    return null; // unknown or already-redeemed code
  }

  if (row.expiresAt.getTime() < Date.now()) return null;
  if (row.clientId !== clientId) return null;
  // The redirect_uri must match the one the code was issued against (RFC 6749
  // §4.1.3) — it stops a code stolen from one registered URI being redeemed
  // against another.
  if (!redirectUri || row.redirectUri !== redirectUri) return null;
  if (!verifyPkce(codeVerifier, row.codeChallenge)) return null;

  return { userId: row.userId, nonce: row.nonce };
}

// ---------------------------------------------------------------------------
// id_token
// ---------------------------------------------------------------------------

export interface IdTokenSubject {
  id: number;
  email: string;
  fullname: string;
  isConfirmed: boolean;
}

export function signIdToken(user: IdTokenSubject, clientId: string, nonce: string | null): string {
  return jwt.sign(
    {
      email: user.email,
      email_verified: user.isConfirmed,
      name: user.fullname,
      ...(nonce ? { nonce } : {}),
    },
    privateKey(),
    {
      algorithm: 'RS256',
      keyid: keyId(),
      issuer: issuer(),
      audience: clientId,
      // The relying party stores this as its externalId, so it must be stable
      // for the life of the account — LAILA's autoincrement id is.
      subject: String(user.id),
      expiresIn: ID_TOKEN_TTL_SECONDS,
    },
  );
}
