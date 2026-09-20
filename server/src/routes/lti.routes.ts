/**
 * LTI 1.3 endpoints — LAILA as the platform.
 *
 * Three audiences:
 *
 *   - **a signed-in user** starts a launch (`POST /api/lti/launch`), which
 *     returns an auto-submitting form aimed at the tool's login URL;
 *   - **the tool** comes back to `/api/lti/authorize` to collect the signed
 *     `id_token`, and posts a Deep Linking response to `/api/lti/deep-link`;
 *   - **an admin** registers tools.
 *
 * Two details differ from `oidc.routes` and will break a launch if missed:
 *
 *   1. **`response_mode=form_post`.** The token goes back as an auto-submitting
 *      HTML form, not a redirect. A redirect would put a signed identity
 *      assertion in a URL, where it lands in logs and `Referer` headers.
 *   2. **`prompt=none`.** The user is already signed in to LAILA. A launch must
 *      never render a login screen — it happens inside the tool's iframe,
 *      often a few hundred pixels wide, and the user has no idea what it is.
 *      A missing session is `login_required`, returned to the tool.
 */

import { Router, Response, Request } from 'express';
import { authenticateToken, optionalAuth, requireAdmin } from '../middleware/auth.middleware.js';
import { asyncHandler, AppError } from '../middleware/error.middleware.js';
import { AuthRequest } from '../types/index.js';
import prisma from '../utils/prisma.js';
import { authLogger } from '../utils/logger.js';
import { isOidcEnabled } from '../services/oidc.service.js';
import {
  LtiError,
  MESSAGE_TYPE,
  buildClaims,
  consumeLaunch,
  contentItemsFrom,
  findToolByClientId,
  newNonce,
  pruneExpiredLaunches,
  rolesFor,
  signLaunchToken,
  standingIn,
  startLaunch,
  validateRedirectUri,
  verifyToolToken,
  type LtiMessageType,
  type LtiToolRecord,
} from '../services/lti.service.js';
import crypto from 'crypto';

const router = Router();

/** Escape a value for embedding in HTML. Every form field below is untrusted. */
const esc = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/**
 * An auto-submitting form.
 *
 * Used for both legs. It is the mechanism `response_mode=form_post` names, and
 * the reason a launch keeps its token out of the URL. `noscript` gives a
 * working button rather than a blank page when scripting is blocked.
 */
function autoPostForm(action: string, fields: Record<string, string>, title: string): string {
  const inputs = Object.entries(fields)
    .filter(([, v]) => v !== undefined && v !== null)
    .map(([k, v]) => `<input type="hidden" name="${esc(k)}" value="${esc(String(v))}">`)
    .join('\n    ');
  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><title>${esc(title)}</title></head>
<body onload="document.forms[0].submit()">
  <form method="POST" action="${esc(action)}">
    ${inputs}
    <noscript><button type="submit">Continue</button></noscript>
  </form>
</body></html>`;
}

/** Report an error the way a tool expects, without leaking internals. */
function ltiErrorResponse(res: Response, err: unknown): void {
  const isLti = err instanceof LtiError;
  const code = isLti ? err.code : 'server_error';
  const description = isLti ? err.message : 'The launch could not be completed.';
  authLogger.warn({ code, description }, 'lti: launch refused');
  res.status(isLti ? err.statusCode : 500).json({ error: code, error_description: description });
}

// ---------------------------------------------------------------------------
// Starting a launch (from LAILA)
// ---------------------------------------------------------------------------

/**
 * Begin a launch. Returns the HTML that kicks off the OIDC third-party
 * initiated login against the tool.
 *
 * The caller says *which tool* and *where from*; it does not say who they are
 * or what role they hold — both are derived server-side.
 */
router.post(
  '/launch',
  authenticateToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!isOidcEnabled()) throw new AppError('LTI is not configured on this instance', 503);

    const { toolId, courseId, sectionId, messageType } = req.body as {
      toolId?: string;
      courseId?: number;
      sectionId?: number;
      messageType?: LtiMessageType;
    };
    if (!toolId) throw new AppError('toolId is required', 400);

    const tool = await prisma.ltiTool.findUnique({ where: { id: toolId } });
    if (!tool || !tool.isActive) throw new AppError('Tool not available', 404);

    const kind: LtiMessageType =
      messageType === MESSAGE_TYPE.deepLinking ? MESSAGE_TYPE.deepLinking : MESSAGE_TYPE.resourceLink;

    // Deep Linking is authoring: only someone who may edit the course may pick
    // content for it.
    if (kind === MESSAGE_TYPE.deepLinking) {
      if (!courseId) throw new AppError('Deep Linking needs a courseId', 400);
      const standing = await standingIn(req.user!.id, courseId);
      const mayAuthor = standing.isOwner || ['co_instructor', 'course_admin'].includes(standing.courseRole ?? '');
      if (!mayAuthor && !req.user!.isAdmin) {
        throw new AppError('Only course staff can pick content from a tool', 403);
      }
    } else if (courseId) {
      // A resource-link launch requires standing in the course. An admin who is
      // not enrolled is refused, deliberately — see lti.service's module note.
      const roles = rolesFor(await standingIn(req.user!.id, courseId));
      if (!roles.length) throw new AppError('You are not a member of this course', 403);
    }

    const hint = await startLaunch({
      toolId: tool.id,
      userId: req.user!.id,
      courseId: courseId ?? null,
      sectionId: sectionId ?? null,
      messageType: kind,
    });

    // Opportunistic cleanup; a failure here must not fail a launch.
    void pruneExpiredLaunches().catch(() => undefined);

    const html = autoPostForm(
      tool.loginUrl,
      {
        iss: process.env.OIDC_ISSUER || '',
        login_hint: String(req.user!.id),
        lti_message_hint: hint,
        target_link_uri: tool.targetLinkUri,
        client_id: tool.clientId,
        lti_deployment_id: tool.deploymentId,
      },
      `Opening ${tool.name}`,
    );
    res.type('html').send(html);
  }),
);

// ---------------------------------------------------------------------------
// The tool collects the signed launch
// ---------------------------------------------------------------------------

/**
 * The authorization endpoint a tool redirects the browser to.
 *
 * Accepts GET and POST: the spec permits both, and tools differ.
 */
const authorize = asyncHandler(async (req: AuthRequest, res: Response) => {
  const q = { ...(req.query as Record<string, string>), ...(req.body as Record<string, string>) };

  try {
    if (!isOidcEnabled()) throw new LtiError('temporarily_unavailable', 'LTI is not configured', 503);

    const tool = await findToolByClientId(q.client_id);
    if (!tool || !tool.isActive) throw new LtiError('unauthorized_client', 'Unknown or disabled tool');

    // Exact match. A prefix check here is an open redirect for a signed
    // identity assertion.
    if (!validateRedirectUri(tool, q.redirect_uri)) {
      throw new LtiError('invalid_request', 'redirect_uri is not registered for this tool');
    }

    // Protocol validation first, and deliberately BEFORE the session check.
    // None of it depends on who is signed in, and a tool being integrated for
    // the first time is far better served by "your response_mode is wrong"
    // than by "log in" — which it cannot act on and which sends the developer
    // looking in entirely the wrong place. These are request-shape errors, so
    // answering them without a session leaks nothing.
    if (q.response_type && q.response_type !== 'id_token') {
      throw new LtiError('unsupported_response_type', 'Only id_token is supported');
    }
    if (q.response_mode && q.response_mode !== 'form_post') {
      throw new LtiError('invalid_request', 'Only form_post is supported');
    }
    if (!q.nonce) throw new LtiError('invalid_request', 'nonce is required');

    // The launch must never show a login screen: it renders inside the tool's
    // iframe. `prompt=none` is what the tool asked for, and the honest answer
    // to a missing session is an error the tool can act on.
    if (!req.user) throw new LtiError('login_required', 'No LAILA session for this launch', 401);

    const launch = await consumeLaunch(q.lti_message_hint, tool.id, req.user.id);

    const user = await prisma.user.findUniqueOrThrow({
      where: { id: launch.userId },
      select: { id: true, email: true, fullname: true, isConfirmed: true },
    });

    let roles: string[] = [];
    let context = null as { courseId: number; title: string; slug: string } | null;
    let returnUrl: string | null = null;

    if (launch.courseId) {
      const course = await prisma.course.findUnique({
        where: { id: launch.courseId },
        select: { id: true, title: true, slug: true },
      });
      if (course) {
        context = { courseId: course.id, title: course.title, slug: course.slug };
        returnUrl = `${process.env.CLIENT_URL?.split(',')[0] ?? ''}/courses/${course.id}`;
      }
      roles = rolesFor(await standingIn(launch.userId, launch.courseId));
      // Standing is re-read at token time, not trusted from initiation: an
      // unenrolment between the two must take effect.
      if (!roles.length) throw new LtiError('access_denied', 'No longer a member of this course', 403);
    }

    let resourceLink: { id: string; title: string } | null = null;
    if (launch.sectionId) {
      const section = await prisma.lectureSection.findUnique({
        where: { id: launch.sectionId },
        select: { id: true, title: true },
      });
      if (section) {
        resourceLink = { id: `section-${section.id}`, title: section.title ?? tool.name };
      }
    }

    const messageType = launch.messageType as LtiMessageType;
    const deepLinkingData =
      messageType === MESSAGE_TYPE.deepLinking
        ? crypto.createHmac('sha256', process.env.JWT_SECRET ?? '')
            .update(`${launch.id}:${launch.courseId ?? ''}`)
            .digest('hex')
        : undefined;

    const claims = buildClaims({
      tool: tool as LtiToolRecord,
      user,
      roles,
      context,
      resourceLink,
      returnUrl,
      nonce: q.nonce,
      messageType,
      deepLinkingReturnUrl: `${process.env.OIDC_ISSUER || ''}/api/lti/deep-link`,
      deepLinkingData,
    });

    const idToken = signLaunchToken(claims, tool as LtiToolRecord, user.id);

    authLogger.info(
      { tool: tool.clientId, user: user.id, course: launch.courseId, messageType },
      'lti: launch issued',
    );

    res.type('html').send(
      autoPostForm(
        q.redirect_uri,
        { id_token: idToken, ...(q.state ? { state: q.state } : {}) },
        `Launching ${tool.name}`,
      ),
    );
  } catch (err) {
    ltiErrorResponse(res, err);
  }
});

// `optionalAuth`, deliberately, not `authenticateToken`: the strict middleware
// answers a missing session with LAILA's own `{ error: 'Authentication
// required' }`, which a tool cannot interpret. The handler needs to reach its
// own `login_required` — the code the spec defines and the code a tool acts on
// by sending the user through a full login. The launch is still refused
// without a session; only the shape of the refusal differs.
router.get('/authorize', optionalAuth, authorize);
router.post('/authorize', optionalAuth, authorize);

// ---------------------------------------------------------------------------
// Deep Linking return
// ---------------------------------------------------------------------------

/**
 * Where a tool posts its Deep Linking response.
 *
 * This is the only endpoint that trusts a signature LAILA did not make, so it
 * verifies strictly (RS256 only, issuer = the tool's client id, audience = us)
 * and checks the `data` value we round-tripped.
 */
router.post(
  '/deep-link',
  asyncHandler(async (req: Request, res: Response) => {
    try {
      const token = (req.body as { JWT?: string }).JWT;
      if (!token) throw new LtiError('invalid_request', 'Missing JWT');

      // The token names its own issuer; look the tool up by it, then verify.
      const unverified = (await import('jsonwebtoken')).default.decode(token) as { iss?: string } | null;
      const tool = await findToolByClientId(unverified?.iss);
      if (!tool || !tool.isActive) throw new LtiError('unauthorized_client', 'Unknown tool');

      const claims = await verifyToolToken(token, tool as LtiToolRecord);
      const items = contentItemsFrom(claims);

      authLogger.info({ tool: tool.clientId, items: items.length }, 'lti: deep linking response');

      // The items are handed to the opener, which is the teacher's editor;
      // persisting them is the client's job, under the teacher's control.
      res.type('html').send(`<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><title>Content selected</title></head>
<body>
  <p>Returning your selection…</p>
  <script>
    window.opener && window.opener.postMessage(
      { source: 'laila-lti-deep-link', toolId: ${JSON.stringify(tool.id)}, items: ${JSON.stringify(items)} },
      ${JSON.stringify(process.env.CLIENT_URL?.split(',')[0] ?? '*')}
    );
    window.close();
  </script>
</body></html>`);
    } catch (err) {
      ltiErrorResponse(res, err);
    }
  }),
);

// ---------------------------------------------------------------------------
// Admin: tool registration
// ---------------------------------------------------------------------------

const toolView = (t: {
  id: string; name: string; description: string | null; clientId: string; deploymentId: string;
  loginUrl: string; targetLinkUri: string; redirectUris: string; jwksUrl: string | null;
  deepLinkingUrl: string | null; sendPii: boolean; isActive: boolean; createdAt: Date;
}) => ({
  id: t.id,
  name: t.name,
  description: t.description,
  clientId: t.clientId,
  deploymentId: t.deploymentId,
  loginUrl: t.loginUrl,
  targetLinkUri: t.targetLinkUri,
  redirectUris: (() => {
    try {
      return JSON.parse(t.redirectUris) as string[];
    } catch {
      return [];
    }
  })(),
  jwksUrl: t.jwksUrl,
  deepLinkingUrl: t.deepLinkingUrl,
  supportsDeepLinking: !!t.deepLinkingUrl,
  sendPii: t.sendPii,
  isActive: t.isActive,
  createdAt: t.createdAt,
});

router.get(
  '/tools',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (_req: AuthRequest, res: Response) => {
    const tools = await prisma.ltiTool.findMany({ orderBy: { name: 'asc' } });
    res.json({ success: true, data: tools.map(toolView) });
  }),
);

/** What a tool's own configuration screen needs from us. */
router.get(
  '/platform-config',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (_req: AuthRequest, res: Response) => {
    const iss = process.env.OIDC_ISSUER || '';
    res.json({
      success: true,
      data: {
        issuer: iss,
        authorizationEndpoint: `${iss}/api/lti/authorize`,
        jwksUri: `${iss}/api/oidc/jwks`,
        // No token endpoint is advertised: AGS is not implemented, and naming
        // an endpoint that does not exist would send tools down a dead end.
        tokenEndpoint: null,
        deepLinkingReturnUrl: `${iss}/api/lti/deep-link`,
      },
    });
  }),
);

router.post(
  '/tools',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const body = req.body as {
      name?: string; description?: string; loginUrl?: string; targetLinkUri?: string;
      redirectUris?: string[]; jwksUrl?: string; publicKeyPem?: string; deepLinkingUrl?: string;
      sendPii?: boolean;
    };

    const httpsOnly = (u: string | undefined, field: string): string => {
      if (!u) throw new AppError(`${field} is required`, 400);
      let parsed: URL;
      try {
        parsed = new URL(u);
      } catch {
        throw new AppError(`${field} is not a valid URL`, 400);
      }
      // A launch carries a signed identity assertion; http would put it on the
      // wire in clear text. localhost is allowed so a tool can be developed.
      if (parsed.protocol !== 'https:' && parsed.hostname !== 'localhost' && parsed.hostname !== '127.0.0.1') {
        throw new AppError(`${field} must use https`, 400);
      }
      return u;
    };

    if (!body.name?.trim()) throw new AppError('name is required', 400);
    const loginUrl = httpsOnly(body.loginUrl, 'loginUrl');
    const targetLinkUri = httpsOnly(body.targetLinkUri, 'targetLinkUri');
    const redirectUris = (body.redirectUris ?? []).filter((u) => typeof u === 'string' && u);
    if (!redirectUris.length) throw new AppError('At least one redirectUri is required', 400);
    redirectUris.forEach((u, i) => httpsOnly(u, `redirectUris[${i}]`));
    if (body.deepLinkingUrl) httpsOnly(body.deepLinkingUrl, 'deepLinkingUrl');
    if (body.jwksUrl) httpsOnly(body.jwksUrl, 'jwksUrl');

    const tool = await prisma.ltiTool.create({
      data: {
        name: body.name.trim(),
        description: body.description ?? null,
        // LAILA issues both; a tool never chooses its own client id.
        clientId: `laila-${crypto.randomBytes(12).toString('hex')}`,
        deploymentId: crypto.randomBytes(8).toString('hex'),
        loginUrl,
        targetLinkUri,
        redirectUris: JSON.stringify(redirectUris),
        jwksUrl: body.jwksUrl ?? null,
        publicKeyPem: body.publicKeyPem ?? null,
        deepLinkingUrl: body.deepLinkingUrl ?? null,
        sendPii: !!body.sendPii,
        createdById: req.user!.id,
      },
    });
    authLogger.info({ tool: tool.clientId, by: req.user!.id }, 'lti: tool registered');
    res.status(201).json({ success: true, data: toolView(tool) });
  }),
);

router.patch(
  '/tools/:id',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const body = req.body as { isActive?: boolean; sendPii?: boolean; name?: string };
    const tool = await prisma.ltiTool.update({
      where: { id: req.params.id },
      data: {
        ...(body.isActive !== undefined ? { isActive: body.isActive } : {}),
        ...(body.sendPii !== undefined ? { sendPii: body.sendPii } : {}),
        ...(body.name ? { name: body.name.trim() } : {}),
      },
    });
    res.json({ success: true, data: toolView(tool) });
  }),
);

router.delete(
  '/tools/:id',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    await prisma.ltiTool.delete({ where: { id: req.params.id } });
    authLogger.warn({ tool: req.params.id, by: req.user!.id }, 'lti: tool removed');
    res.json({ success: true });
  }),
);

export default router;
