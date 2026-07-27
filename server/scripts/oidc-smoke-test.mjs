#!/usr/bin/env node
/**
 * End-to-end smoke test for LAILA's OIDC provider, against a RUNNING server.
 *
 *   node scripts/oidc-smoke-test.mjs \
 *     --issuer http://127.0.0.1:5001 \
 *     --client-id chatoyon \
 *     --client-secret <secret> \
 *     --redirect http://127.0.0.1:3000/api/auth/sso/<providerId>/callback \
 *     --user-id 4
 *
 * Complements the unit tests in src/services/oidc.service.test.ts: those cover
 * the logic in isolation, this drives the real HTTP protocol — discovery, JWKS,
 * authorize, token exchange — and asserts that the attacks fail.
 *
 * The authorize step needs a logged-in LAILA user. Rather than require a
 * password, this mints a bearer with JWT_SECRET exactly as generateToken()
 * does, then lets authenticateToken validate it normally.
 *
 * Uses only jsonwebtoken + node:crypto, both already present — the published
 * JWK is turned into a key object with crypto.createPublicKey({format:'jwk'}),
 * so no JOSE library is needed. If the relying party's `openid-client` happens
 * to be resolvable, discovery is additionally validated through it.
 *
 * Requires: server running with OIDC_* configured, and JWT_SECRET in the
 * environment (e.g. `node --env-file=.env scripts/oidc-smoke-test.mjs ...`).
 */
import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';

function arg(name, fallback = null) {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

const ISSUER = (arg('issuer') || 'http://127.0.0.1:5001').replace(/\/+$/, '');
const CLIENT_ID = arg('client-id', 'chatoyon');
const CLIENT_SECRET = arg('client-secret');
const REDIRECT = arg('redirect');
const USER_ID = Number(arg('user-id', '1'));

if (!CLIENT_SECRET || !REDIRECT) {
  console.error('Required: --client-secret and --redirect (must match OIDC_CLIENTS exactly)');
  process.exit(1);
}
if (!process.env.JWT_SECRET) {
  console.error('JWT_SECRET must be set. Try: node --env-file=.env scripts/oidc-smoke-test.mjs ...');
  process.exit(1);
}

let pass = 0;
let fail = 0;
const ok = (label, cond, detail = '') => {
  if (cond) { pass++; console.log(`  PASS  ${label}`); }
  else { fail++; console.log(`  FAIL  ${label}${detail ? ` — ${detail}` : ''}`); }
};

const b64url = (b) => Buffer.from(b).toString('base64url');
const pkceVerifier = () => b64url(crypto.randomBytes(40));
const pkceChallenge = (v) => crypto.createHash('sha256').update(v).digest('base64url');
const basicAuth = (id, secret) =>
  'Basic ' + Buffer.from(`${encodeURIComponent(id)}:${encodeURIComponent(secret)}`).toString('base64');

async function tokenPost(body, auth = basicAuth(CLIENT_ID, CLIENT_SECRET)) {
  const res = await fetch(`${ISSUER}/api/oidc/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Authorization: auth },
    body: new URLSearchParams(body),
  });
  return { status: res.status, json: await res.json().catch(() => ({})) };
}

// --- 1. Discovery -----------------------------------------------------------
console.log('\n1. Discovery');
const disco = await (await fetch(`${ISSUER}/.well-known/openid-configuration`)).json();
ok('issuer matches exactly (no trailing slash drift)', disco.issuer === ISSUER, disco.issuer);
ok('only the authorization_code grant is offered', JSON.stringify(disco.grant_types_supported) === '["authorization_code"]');
ok('only S256 PKCE is offered', JSON.stringify(disco.code_challenge_methods_supported) === '["S256"]');

try {
  const oidcLib = await import('openid-client');
  const config = await oidcLib.discovery(new URL(ISSUER), CLIENT_ID, CLIENT_SECRET, undefined, {
    execute: ISSUER.startsWith('http://') ? [oidcLib.allowInsecureRequests] : [],
  });
  ok("the relying party's openid-client accepts the metadata", config.serverMetadata().issuer === ISSUER);
} catch (e) {
  console.log(`  SKIP  openid-client check (${e.code === 'ERR_MODULE_NOT_FOUND' ? 'not resolvable here' : e.message})`);
}

// --- 2. JWKS ----------------------------------------------------------------
console.log('\n2. JWKS');
const jwksBody = await (await fetch(`${ISSUER}/api/oidc/jwks`)).json();
ok('publishes one RSA signing key', jwksBody.keys?.length === 1 && jwksBody.keys[0].kty === 'RSA');
ok('does NOT leak private key components', !['d', 'p', 'q', 'dp', 'dq', 'qi'].some((f) => f in jwksBody.keys[0]));

// --- 3. Session -------------------------------------------------------------
console.log('\n3. LAILA session');
const bearer = jwt.sign({ id: USER_ID, tokenVersion: 0 }, process.env.JWT_SECRET, { expiresIn: '5m' });
ok(`minted a bearer for user ${USER_ID}`, Boolean(bearer));

// --- 4. Authorize -----------------------------------------------------------
console.log('\n4. Authorize');
const verifier = pkceVerifier();
const challenge = pkceChallenge(verifier);
const nonce = b64url(crypto.randomBytes(16));

async function authorize(overrides = {}, token = bearer) {
  const res = await fetch(`${ISSUER}/api/oidc/authorize`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      client_id: CLIENT_ID,
      redirect_uri: REDIRECT,
      state: 'state-123',
      nonce,
      scope: 'openid email profile',
      code_challenge: challenge,
      code_challenge_method: 'S256',
      ...overrides,
    }),
  });
  return { status: res.status, json: await res.json().catch(() => ({})) };
}

const authed = await authorize();
ok('issues an authorization code', authed.status === 200 && /[?&]code=/.test(authed.json?.data?.redirectTo || ''), JSON.stringify(authed.json).slice(0, 200));
if (fail) { console.log('\nCannot continue without a code.'); process.exit(1); }

const authedUrl = new URL(authed.json.data.redirectTo);
const code = authedUrl.searchParams.get('code');
ok('round-trips state', authedUrl.searchParams.get('state') === 'state-123');
ok('redirects only to the registered URI', authedUrl.origin + authedUrl.pathname === REDIRECT);
ok('refuses an unauthenticated caller', [401, 403].includes((await authorize({}, 'garbage')).status));

// The open-redirect check: an unregistered redirect_uri must be refused IN-BAND,
// never by bouncing the browser to the attacker's URL.
const evil = await authorize({ redirect_uri: 'https://evil.example/steal' });
ok('refuses an unregistered redirect_uri without redirecting', evil.status === 400 && !evil.json?.data?.redirectTo);
ok('refuses an unknown client', (await authorize({ client_id: 'no-such-client' })).status === 400);

const noPkce = await authorize({ code_challenge: undefined, code_challenge_method: undefined });
ok('refuses a request without PKCE', /error=invalid_request/.test(noPkce.json?.data?.redirectTo || ''));

// --- 5. Token exchange ------------------------------------------------------
console.log('\n5. Token exchange');
ok(
  'rejects a bad client secret',
  (await tokenPost(
    { grant_type: 'authorization_code', code, redirect_uri: REDIRECT, code_verifier: verifier },
    basicAuth(CLIENT_ID, 'wrong-secret'),
  )).status === 401,
);

const wrongVerifier = await tokenPost({ grant_type: 'authorization_code', code, redirect_uri: REDIRECT, code_verifier: pkceVerifier() });
ok('rejects a wrong PKCE verifier', wrongVerifier.json.error === 'invalid_grant');

// Single use is enforced by consuming the code BEFORE validating it, so even a
// failed attempt burns it. Retrying with correct inputs must still fail.
const retry = await tokenPost({ grant_type: 'authorization_code', code, redirect_uri: REDIRECT, code_verifier: verifier });
ok('a code burned by a failed attempt cannot be retried', retry.json.error === 'invalid_grant');

const fresh = await authorize();
const freshCode = new URL(fresh.json.data.redirectTo).searchParams.get('code');
ok(
  'rejects redemption against a different redirect_uri',
  (await tokenPost({ grant_type: 'authorization_code', code: freshCode, redirect_uri: 'https://evil.example/steal', code_verifier: verifier })).json.error === 'invalid_grant',
);

const finalAuth = await authorize();
const finalCode = new URL(finalAuth.json.data.redirectTo).searchParams.get('code');
const good = await tokenPost({ grant_type: 'authorization_code', code: finalCode, redirect_uri: REDIRECT, code_verifier: verifier });
ok('exchanges a valid code for an id_token', good.status === 200 && Boolean(good.json.id_token), JSON.stringify(good.json).slice(0, 200));
ok(
  'refuses to replay a spent code',
  (await tokenPost({ grant_type: 'authorization_code', code: finalCode, redirect_uri: REDIRECT, code_verifier: verifier })).json.error === 'invalid_grant',
);
ok('refuses non-authorization_code grants', (await tokenPost({ grant_type: 'password' })).json.error === 'unsupported_grant_type');

// --- 6. id_token ------------------------------------------------------------
console.log('\n6. id_token');
if (good.json.id_token) {
  // Reconstruct the verifying key from the PUBLISHED JWKS rather than from the
  // local private key — that is what a relying party actually does, so a broken
  // JWKS shows up here instead of passing on a technicality.
  const header = JSON.parse(Buffer.from(good.json.id_token.split('.')[0], 'base64url').toString());
  const jwk = jwksBody.keys.find((k) => k.kid === header.kid);
  ok('the id_token kid resolves to a published key', Boolean(jwk), `kid=${header.kid}`);

  if (jwk) {
    const publicKey = crypto.createPublicKey({ key: jwk, format: 'jwk' });
    try {
      const payload = jwt.verify(good.json.id_token, publicKey, {
        algorithms: ['RS256'],
        issuer: ISSUER,
        audience: CLIENT_ID,
      });
      ok('verifies against the published JWKS', true);
      ok('is signed with RS256', header.alg === 'RS256');
      ok('sub is the LAILA user id', payload.sub === String(USER_ID), String(payload.sub));
      ok('carries an email claim', typeof payload.email === 'string');
      ok('echoes the nonce', payload.nonce === nonce);
      ok('is short-lived (<= 5 min)', payload.exp - payload.iat <= 300);
      // The invariant that keeps LAILA's authorization model out of other apps.
      ok('carries NO role claim', !['role', 'roles', 'isAdmin', 'isInstructor'].some((c) => c in payload), JSON.stringify(payload));
    } catch (e) {
      ok('verifies against the published JWKS', false, e.message);
    }

    let wrongAudienceRejected = false;
    try {
      jwt.verify(good.json.id_token, publicKey, { algorithms: ['RS256'], audience: 'someone-else' });
    } catch {
      wrongAudienceRejected = true;
    }
    ok('is rejected by the wrong audience', wrongAudienceRejected);

    // An RP that trusts the header's alg can be tricked into verifying an
    // HS256 token using the public key as the HMAC secret. Confirm ours is
    // genuinely asymmetric by checking the token is not accepted as HS256.
    let algConfusionRejected = false;
    try {
      jwt.verify(good.json.id_token, crypto.createPublicKey({ key: jwk, format: 'jwk' }).export({ type: 'spki', format: 'pem' }), {
        algorithms: ['HS256'],
      });
    } catch {
      algConfusionRejected = true;
    }
    ok('is not verifiable as HS256 (no algorithm confusion)', algConfusionRejected);
  }
}

console.log(`\n${'='.repeat(52)}\n  ${pass} passed, ${fail} failed\n${'='.repeat(52)}`);
process.exit(fail ? 1 : 0);
