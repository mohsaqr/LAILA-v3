/**
 * OIDC provider endpoints — LAILA issuing identity to relying parties.
 *
 * Mounted twice in index.ts:
 *   /.well-known/openid-configuration  (discovery must sit at the issuer root)
 *   /api/oidc/*                        (jwks, authorize, token)
 *
 * The user-facing authorize step is NOT here — it is a React page at
 * /oidc/authorize that reads the localStorage token and POSTs to
 * /api/oidc/authorize below. See services/oidc.service.ts for why.
 *
 * Every endpoint 404s when OIDC is unconfigured, so a default LAILA install
 * exposes no identity-provider surface at all.
 */
import { Router, type RequestHandler } from 'express';
import { authenticateToken } from '../middleware/auth.middleware.js';
import { asyncHandler } from '../middleware/error.middleware.js';
import prisma from '../utils/prisma.js';
import { authLogger } from '../utils/logger.js';
import {
  consumeAuthCode,
  discoveryDocument,
  findClient,
  isOidcEnabled,
  jwks,
  mintAuthCode,
  signIdToken,
  validateRedirectUri,
  verifyClientSecret,
} from '../services/oidc.service.js';

/** Fail closed: no OIDC config means the provider does not exist. */
const requireOidcEnabled: RequestHandler = (_req, res, next) => {
  if (!isOidcEnabled()) {
    res.status(404).json({ success: false, error: 'Not found' });
    return;
  }
  next();
};

/**
 * GET /.well-known/openid-configuration
 *
 * Mounted at the issuer ROOT, not under /api — the path is fixed by RFC 8414
 * and a relying party derives it from the issuer, so it cannot be relocated.
 * Kept in its own router for that reason.
 */
export const discoveryRouter = Router();
discoveryRouter.get(
  '/.well-known/openid-configuration',
  requireOidcEnabled,
  asyncHandler(async (_req, res) => {
    res.set('Cache-Control', 'public, max-age=300');
    res.json(discoveryDocument());
  })
);

const router = Router();
router.use(requireOidcEnabled);

/**
 * GET /api/oidc/jwks
 * The public half of the signing key. Cacheable — relying parties re-fetch on
 * an unknown kid, which is how key rotation recovers.
 */
router.get(
  '/jwks',
  asyncHandler(async (_req, res) => {
    res.set('Cache-Control', 'public, max-age=300');
    res.json(jwks());
  })
);

/**
 * POST /api/oidc/authorize   (requires a live LAILA session)
 *
 * Called by the /oidc/authorize React page with the query parameters the
 * relying party sent. Returns the redirect target; the SPA performs the
 * navigation. Responding with JSON rather than a 302 keeps the browser from
 * following a redirect the page has not yet validated.
 */
router.post(
  '/authorize',
  authenticateToken,
  asyncHandler(async (req, res) => {
    const sessionUser = (req as any).user as { id: number };
    const { client_id, redirect_uri, state, nonce, code_challenge, code_challenge_method, scope } =
      (req.body ?? {}) as Record<string, string | undefined>;

    const client = findClient(client_id);
    // An unregistered client or an unregistered redirect_uri must NOT be
    // redirected to — that is the open-redirect hole. Report in-band instead.
    if (!client) {
      res.status(400).json({ success: false, error: 'Unknown client' });
      return;
    }
    if (!validateRedirectUri(client, redirect_uri)) {
      res.status(400).json({ success: false, error: 'redirect_uri is not registered for this client' });
      return;
    }

    // Past this point the redirect_uri is trusted, so protocol errors can be
    // reported to the relying party the way the spec expects.
    const errorRedirect = (code: string, description: string) => {
      const url = new URL(redirect_uri!);
      url.searchParams.set('error', code);
      url.searchParams.set('error_description', description);
      if (state) url.searchParams.set('state', state);
      res.json({ success: true, data: { redirectTo: url.toString() } });
    };

    if (code_challenge_method !== 'S256' || !code_challenge) {
      errorRedirect('invalid_request', 'PKCE with code_challenge_method=S256 is required');
      return;
    }
    if (scope && !scope.split(/\s+/).includes('openid')) {
      errorRedirect('invalid_scope', 'The openid scope is required');
      return;
    }

    // Re-read the user rather than trusting the JWT payload: a token minted 29
    // days ago says nothing about whether the account is still active today,
    // and this is the moment we vouch for them to another system.
    const user = await prisma.user.findUnique({
      where: { id: sessionUser.id },
      select: { id: true, isActive: true, isConfirmed: true },
    });
    if (!user || !user.isActive || !user.isConfirmed) {
      errorRedirect('access_denied', 'This account may not sign in to external applications');
      return;
    }

    const code = await mintAuthCode({
      userId: user.id,
      clientId: client.clientId,
      redirectUri: redirect_uri!,
      nonce,
      codeChallenge: code_challenge,
    });

    const url = new URL(redirect_uri!);
    url.searchParams.set('code', code);
    if (state) url.searchParams.set('state', state);

    authLogger.info({ userId: user.id, clientId: client.clientId }, 'oidc: authorization code issued');
    res.json({ success: true, data: { redirectTo: url.toString() } });
  })
);

/**
 * POST /api/oidc/token   (server-to-server; authenticated by client secret)
 *
 * Exchanges a one-time code for an id_token. Uses the flat OAuth error shape
 * (`{ error, error_description }`) rather than LAILA's `{ success, data }`
 * envelope, because RP libraries parse the former per RFC 6749 §5.2.
 */
router.post(
  '/token',
  asyncHandler(async (req, res) => {
    const body = (req.body ?? {}) as Record<string, string | undefined>;
    const fail = (status: number, error: string, description: string) =>
      res.status(status).json({ error, error_description: description });

    if (body.grant_type !== 'authorization_code') {
      fail(400, 'unsupported_grant_type', 'Only authorization_code is supported');
      return;
    }

    // Accept both client_secret_basic (the openid-client default) and
    // client_secret_post, as advertised in the discovery document.
    let clientId = body.client_id;
    let clientSecret = body.client_secret;
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith('Basic ')) {
      const decoded = Buffer.from(authHeader.slice(6), 'base64').toString('utf8');
      const separator = decoded.indexOf(':');
      if (separator > 0) {
        // Credentials are form-encoded before base64 per RFC 6749 §2.3.1.
        clientId = decodeURIComponent(decoded.slice(0, separator));
        clientSecret = decodeURIComponent(decoded.slice(separator + 1));
      }
    }

    const client = findClient(clientId);
    if (!client || !verifyClientSecret(client, clientSecret)) {
      // 401 + WWW-Authenticate is what RFC 6749 §5.2 requires for a bad client.
      res.set('WWW-Authenticate', 'Basic realm="oidc"');
      fail(401, 'invalid_client', 'Client authentication failed');
      return;
    }

    const redeemed = await consumeAuthCode(body.code, client.clientId, body.redirect_uri, body.code_verifier);
    if (!redeemed) {
      fail(400, 'invalid_grant', 'The authorization code is invalid, expired, or already used');
      return;
    }

    const user = await prisma.user.findUnique({
      where: { id: redeemed.userId },
      select: { id: true, email: true, fullname: true, isConfirmed: true, isActive: true },
    });
    // Re-checked here as well as at authorize: the account can be deactivated
    // in the seconds between issuing the code and redeeming it.
    if (!user || !user.isActive) {
      fail(400, 'invalid_grant', 'The account is no longer active');
      return;
    }

    const idToken = signIdToken(user, client.clientId, redeemed.nonce);
    authLogger.info({ userId: user.id, clientId: client.clientId }, 'oidc: id_token issued');

    res.set('Cache-Control', 'no-store');
    res.json({
      access_token: idToken, // no userinfo endpoint; the id_token is the whole response
      token_type: 'Bearer',
      expires_in: 300,
      id_token: idToken,
    });
  })
);

export default router;
