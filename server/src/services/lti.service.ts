/**
 * LTI 1.3 — LAILA as the **platform**.
 *
 * LTI 1.3's security model is OpenID Connect with RS256, which `oidc.service`
 * already implements properly. This module reuses that key, that `kid` and that
 * issuer, and adds only what LTI needs on top: a different claim set, a tool
 * registry, and a launch record.
 *
 * ## The rule this module is built around
 *
 * `oidc.service.signIdToken` states, deliberately and in capitals, that it
 * asserts **no role claim** — because replaying LAILA's `isAdmin`/`isInstructor`
 * into another application would mean a bug here silently grants someone
 * elevated access to someone else's data.
 *
 * LTI **requires** roles. So rather than weaken that function, this module
 * signs its own tokens and narrows the rule instead of breaking it:
 *
 *   - `signIdToken` is never called from here and never modified. Chatoyon and
 *     any future plain-OIDC relying party are untouched.
 *   - LTI roles are derived **only** from this user's relationship to **this
 *     course** (`Course.instructorId` and `CourseRole.role`).
 *   - `isAdmin` and `isInstructor` are never read, never mapped, never sent. A
 *     platform admin who is not enrolled in the course launches as nobody —
 *     the launch is refused.
 *
 * The substance of the original rule survives: LAILA's global authorization
 * model does not leave the building.
 *
 * See `docs/LTI_PLAN.md`.
 */

import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import prisma from '../utils/prisma.js';
import { authLogger } from '../utils/logger.js';
import { AppError } from '../middleware/error.middleware.js';
import { privateKey, keyId, issuer } from './oidc.service.js';

/** LTI claim URIs. Long, exact, and a typo is a silent launch failure. */
const C = {
  messageType: 'https://purl.imsglobal.org/spec/lti/claim/message_type',
  version: 'https://purl.imsglobal.org/spec/lti/claim/version',
  deploymentId: 'https://purl.imsglobal.org/spec/lti/claim/deployment_id',
  targetLinkUri: 'https://purl.imsglobal.org/spec/lti/claim/target_link_uri',
  resourceLink: 'https://purl.imsglobal.org/spec/lti/claim/resource_link',
  context: 'https://purl.imsglobal.org/spec/lti/claim/context',
  roles: 'https://purl.imsglobal.org/spec/lti/claim/roles',
  launchPresentation: 'https://purl.imsglobal.org/spec/lti/claim/launch_presentation',
  custom: 'https://purl.imsglobal.org/spec/lti/claim/custom',
  deepLinkingSettings: 'https://purl.imsglobal.org/spec/lti-dl/claim/deep_linking_settings',
  contentItems: 'https://purl.imsglobal.org/spec/lti-dl/claim/content_items',
  deepLinkingData: 'https://purl.imsglobal.org/spec/lti-dl/claim/data',
} as const;

const ROLE = {
  instructor: 'http://purl.imsglobal.org/vocab/lis/v2/membership#Instructor',
  learner: 'http://purl.imsglobal.org/vocab/lis/v2/membership#Learner',
  ta: 'http://purl.imsglobal.org/vocab/lis/v2/membership#TeachingAssistant',
  contextAdmin: 'http://purl.imsglobal.org/vocab/lis/v2/membership#Administrator',
} as const;

export const MESSAGE_TYPE = {
  resourceLink: 'LtiResourceLinkRequest',
  deepLinking: 'LtiDeepLinkingRequest',
} as const;
export type LtiMessageType = (typeof MESSAGE_TYPE)[keyof typeof MESSAGE_TYPE];

/** A launch must be redeemed promptly; it is two redirects, not a session. */
const LAUNCH_TTL_MS = 5 * 60 * 1000;
/** The id_token is consumed the moment it arrives at the tool. */
const ID_TOKEN_TTL_SECONDS = 300;

export class LtiError extends AppError {
  /** The OAuth/OIDC error code a tool expects to see. */
  readonly code: string;
  constructor(code: string, message: string, status = 400) {
    super(message, status);
    this.code = code;
  }
}

// ---------------------------------------------------------------------------
// Roles
// ---------------------------------------------------------------------------

export interface CourseStanding {
  isOwner: boolean;
  /** `ta` | `co_instructor` | `course_admin`, or null. */
  courseRole: string | null;
  isEnrolled: boolean;
}

/**
 * Map a user's standing **in one course** to LTI roles.
 *
 * Exported and pure so the mapping is testable on its own — it is the part of
 * this module where a mistake hands a student an instructor's view of a tool.
 *
 * @returns the LTI role URIs, or an empty array when the user has no standing
 *   in this course at all. An empty array means **refuse the launch**; it is
 *   never sent as a claim, because a launch with no roles is one a tool will
 *   interpret however it likes.
 */
export function rolesFor(standing: CourseStanding): string[] {
  if (standing.isOwner) return [ROLE.instructor];
  switch (standing.courseRole) {
    case 'course_admin':
      return [ROLE.instructor, ROLE.contextAdmin];
    case 'co_instructor':
      return [ROLE.instructor];
    case 'ta':
      return [ROLE.ta];
    default:
      return standing.isEnrolled ? [ROLE.learner] : [];
  }
}

/**
 * Read a user's standing in a course.
 *
 * Deliberately does not look at `isAdmin`/`isInstructor`. See the module note.
 */
export async function standingIn(userId: number, courseId: number): Promise<CourseStanding> {
  const [course, role, enrollment] = await Promise.all([
    prisma.course.findUnique({ where: { id: courseId }, select: { instructorId: true } }),
    prisma.courseRole.findUnique({
      where: { userId_courseId: { userId, courseId } },
      select: { role: true },
    }),
    prisma.enrollment.findUnique({
      where: { userId_courseId: { userId, courseId } },
      select: { id: true, status: true },
    }),
  ]);
  return {
    isOwner: course?.instructorId === userId,
    courseRole: role?.role ?? null,
    isEnrolled: !!enrollment && enrollment.status !== 'unenrolled',
  };
}

// ---------------------------------------------------------------------------
// Tools
// ---------------------------------------------------------------------------

export interface LtiToolRecord {
  id: string;
  name: string;
  clientId: string;
  deploymentId: string;
  loginUrl: string;
  targetLinkUri: string;
  redirectUris: string;
  jwksUrl: string | null;
  publicKeyPem: string | null;
  deepLinkingUrl: string | null;
  sendPii: boolean;
  isActive: boolean;
}

/** Parse the stored JSON array of redirect URIs, tolerating a corrupt value. */
export function redirectUrisOf(tool: { redirectUris: string }): string[] {
  try {
    const parsed = JSON.parse(tool.redirectUris) as unknown;
    return Array.isArray(parsed) ? parsed.filter((u): u is string => typeof u === 'string') : [];
  } catch {
    return [];
  }
}

/**
 * Exact-match the redirect URI a tool asked us to post to.
 *
 * Exact, never a prefix or origin check — the same reasoning as
 * `oidc.service.validateRedirectUri`: an open redirect here hands a signed
 * launch token, containing a real user's identity, to whoever asked.
 */
export function validateRedirectUri(tool: { redirectUris: string }, uri: string | undefined): boolean {
  if (!uri) return false;
  return redirectUrisOf(tool).includes(uri);
}

export async function findToolByClientId(clientId: string | undefined): Promise<LtiToolRecord | null> {
  if (!clientId) return null;
  return prisma.ltiTool.findUnique({ where: { clientId } });
}

// ---------------------------------------------------------------------------
// Launches
// ---------------------------------------------------------------------------

export interface StartLaunchInput {
  toolId: string;
  userId: number;
  courseId: number | null;
  sectionId: number | null;
  messageType: LtiMessageType;
}

/**
 * Record a launch and return its id, which travels as `lti_message_hint`.
 *
 * This is the reason the hint exists rather than passing ids in the URL:
 * **which** resource and **which** course a launch is for is decided here, by
 * LAILA, and cannot be altered by the browser between initiation and token
 * issue. A hint carrying ids in the clear would let a student launch any
 * resource in any course as themselves.
 */
export async function startLaunch(input: StartLaunchInput): Promise<string> {
  const launch = await prisma.ltiLaunch.create({
    data: {
      toolId: input.toolId,
      userId: input.userId,
      courseId: input.courseId,
      sectionId: input.sectionId,
      messageType: input.messageType,
      expiresAt: new Date(Date.now() + LAUNCH_TTL_MS),
    },
    select: { id: true },
  });
  return launch.id;
}

export interface ConsumedLaunch {
  id: string;
  toolId: string;
  userId: number;
  courseId: number | null;
  sectionId: number | null;
  messageType: string;
}

/**
 * Redeem a launch exactly once.
 *
 * Single-use and time-bounded for the same reason `consumeAuthCode` is: a
 * replayed launch is a replayed identity assertion.
 *
 * @throws {LtiError} when the hint is unknown, expired, already used, or
 *   belongs to a different tool or a different signed-in user
 */
export async function consumeLaunch(
  hint: string | undefined,
  toolId: string,
  userId: number,
): Promise<ConsumedLaunch> {
  if (!hint) throw new LtiError('invalid_request', 'Missing lti_message_hint');

  const launch = await prisma.ltiLaunch.findUnique({ where: { id: hint } });
  if (!launch) throw new LtiError('invalid_request', 'Unknown launch');
  if (launch.consumedAt) throw new LtiError('invalid_request', 'This launch has already been used');
  if (launch.expiresAt.getTime() < Date.now()) {
    throw new LtiError('invalid_request', 'This launch has expired');
  }
  // A hint is not a bearer token: it must belong to the tool asking and to the
  // person currently signed in, or a stolen hint would be a stolen launch.
  if (launch.toolId !== toolId) throw new LtiError('invalid_request', 'Launch does not belong to this tool');
  if (launch.userId !== userId) throw new LtiError('login_required', 'Launch belongs to another user');

  await prisma.ltiLaunch.update({ where: { id: hint }, data: { consumedAt: new Date() } });
  return launch;
}

/** Remove launches that were never redeemed. Called opportunistically. */
export async function pruneExpiredLaunches(): Promise<number> {
  const { count } = await prisma.ltiLaunch.deleteMany({
    where: { expiresAt: { lt: new Date() } },
  });
  return count;
}

// ---------------------------------------------------------------------------
// The token
// ---------------------------------------------------------------------------

export interface LaunchSubject {
  id: number;
  email: string;
  fullname: string;
  isConfirmed: boolean;
}

export interface LaunchContext {
  courseId: number;
  title: string;
  slug: string;
}

export interface BuildClaimsInput {
  tool: LtiToolRecord;
  user: LaunchSubject;
  roles: string[];
  context: LaunchContext | null;
  resourceLink: { id: string; title: string } | null;
  returnUrl: string | null;
  nonce: string;
  messageType: LtiMessageType;
  /** Deep Linking only: where the tool posts its response. */
  deepLinkingReturnUrl?: string;
  /** Deep Linking only: opaque round-trip value we verify on return. */
  deepLinkingData?: string;
}

/**
 * Build the claim set for a launch.
 *
 * Pure and exported so the shape can be asserted directly — LTI is a
 * certification-driven spec and a missing or misspelled claim is a launch that
 * fails inside someone else's iframe with no useful error.
 */
export function buildClaims(input: BuildClaimsInput): Record<string, unknown> {
  const { tool, user, roles, context, resourceLink } = input;

  const claims: Record<string, unknown> = {
    [C.messageType]: input.messageType,
    [C.version]: '1.3.0',
    [C.deploymentId]: tool.deploymentId,
    [C.targetLinkUri]: tool.targetLinkUri,
    [C.roles]: roles,
    nonce: input.nonce,
  };

  // PII is opt-in per tool. A launch discloses to a third party, and LTI
  // explicitly permits omitting these — many tools work fine without them.
  if (tool.sendPii) {
    claims.name = user.fullname;
    claims.email = user.email;
    claims.email_verified = user.isConfirmed;
  }

  if (context) {
    claims[C.context] = {
      id: `course-${context.courseId}`,
      label: context.slug,
      title: context.title,
      type: ['http://purl.imsglobal.org/vocab/lis/v2/course#CourseOffering'],
    };
  }

  if (input.messageType === MESSAGE_TYPE.resourceLink) {
    // A resource-link launch without a resource link is malformed; fall back to
    // the course so a tool never receives a launch it must guess about.
    claims[C.resourceLink] = resourceLink ?? {
      id: context ? `course-${context.courseId}` : `tool-${tool.id}`,
      title: context?.title ?? tool.name,
    };
  }

  if (input.messageType === MESSAGE_TYPE.deepLinking) {
    claims[C.deepLinkingSettings] = {
      deep_link_return_url: input.deepLinkingReturnUrl,
      accept_types: ['ltiResourceLink'],
      accept_presentation_document_targets: ['iframe', 'window'],
      accept_multiple: true,
      auto_create: false,
      ...(input.deepLinkingData ? { data: input.deepLinkingData } : {}),
    };
  }

  claims[C.launchPresentation] = {
    document_target: 'iframe',
    ...(input.returnUrl ? { return_url: input.returnUrl } : {}),
  };

  return claims;
}

/**
 * Sign a launch.
 *
 * Shares `privateKey()`, `keyId()` and `issuer()` with `oidc.service` — one key,
 * one JWKS, one issuer — but deliberately does **not** go through
 * `signIdToken`, whose contract excludes roles.
 *
 * `sub` is `String(user.id)`, matching `signIdToken`'s existing contract and
 * its comment about stability: a tool stores this as its external id.
 */
export function signLaunchToken(claims: Record<string, unknown>, tool: LtiToolRecord, userId: number): string {
  return jwt.sign(claims, privateKey(), {
    algorithm: 'RS256',
    keyid: keyId(),
    issuer: issuer(),
    audience: tool.clientId,
    subject: String(userId),
    expiresIn: ID_TOKEN_TTL_SECONDS,
  });
}

/** A nonce for a launch. The tool echoes it; we never need to store it. */
export const newNonce = (): string => crypto.randomBytes(16).toString('hex');

// ---------------------------------------------------------------------------
// Verifying what a tool sends back (Deep Linking)
// ---------------------------------------------------------------------------

interface Jwk {
  kid?: string;
  kty: string;
  n?: string;
  e?: string;
  alg?: string;
  use?: string;
}

/** Fetched JWKS, cached briefly so a Deep Linking return is not a cold fetch. */
const jwksCache = new Map<string, { keys: Jwk[]; fetchedAt: number }>();
const JWKS_TTL_MS = 10 * 60 * 1000;
const JWKS_FETCH_TIMEOUT_MS = 5_000;

/** Test seam. */
export function resetJwksCache(): void {
  jwksCache.clear();
}

async function fetchJwks(url: string): Promise<Jwk[]> {
  const cached = jwksCache.get(url);
  if (cached && Date.now() - cached.fetchedAt < JWKS_TTL_MS) return cached.keys;

  // A hung tool must not hold our request open.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), JWKS_FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) throw new LtiError('invalid_client', `Tool JWKS returned ${res.status}`);
    const body = (await res.json()) as { keys?: Jwk[] };
    const keys = body.keys ?? [];
    jwksCache.set(url, { keys, fetchedAt: Date.now() });
    return keys;
  } catch (err) {
    if (cached) {
      // A stale key beats refusing a legitimate return because the tool's
      // JWKS endpoint blipped.
      authLogger.warn({ url, err: String(err) }, 'lti: JWKS fetch failed; using cached keys');
      return cached.keys;
    }
    throw new LtiError('invalid_client', 'Could not fetch the tool\'s public keys');
  } finally {
    clearTimeout(timer);
  }
}

/** Convert an RSA JWK to PEM, so `jsonwebtoken` can verify with it. */
function jwkToPem(jwk: Jwk): string {
  if (jwk.kty !== 'RSA' || !jwk.n || !jwk.e) {
    throw new LtiError('invalid_client', 'Only RSA keys are supported');
  }
  const key = crypto.createPublicKey({
    key: { kty: 'RSA', n: jwk.n, e: jwk.e } as crypto.JsonWebKey,
    format: 'jwk',
  });
  return key.export({ type: 'spki', format: 'pem' }).toString();
}

/**
 * Verify a JWT a **tool** signed (the Deep Linking response).
 *
 * This is the first and only place LAILA trusts someone else's signature, so
 * it is strict: RS256 only (never `none`, never HS256 — an HMAC would let a
 * holder of our public key mint a response), issuer must be the tool's client
 * id, audience must be us.
 *
 * @throws {LtiError} on any verification failure
 */
export async function verifyToolToken(
  token: string,
  tool: LtiToolRecord,
): Promise<Record<string, unknown>> {
  const decoded = jwt.decode(token, { complete: true });
  if (!decoded || typeof decoded === 'string') {
    throw new LtiError('invalid_request', 'Malformed token from tool');
  }
  if (decoded.header.alg !== 'RS256') {
    throw new LtiError('invalid_request', `Tool signed with ${decoded.header.alg}; RS256 required`);
  }

  let pem: string;
  if (tool.publicKeyPem) {
    pem = tool.publicKeyPem;
  } else if (tool.jwksUrl) {
    const keys = await fetchJwks(tool.jwksUrl);
    const match = decoded.header.kid ? keys.find((k) => k.kid === decoded.header.kid) : keys[0];
    if (!match) throw new LtiError('invalid_client', 'No matching key in the tool\'s JWKS');
    pem = jwkToPem(match);
  } else {
    throw new LtiError('invalid_client', 'This tool has no registered public key');
  }

  try {
    return jwt.verify(token, pem, {
      algorithms: ['RS256'],
      issuer: tool.clientId,
      audience: issuer(),
    }) as Record<string, unknown>;
  } catch (err) {
    throw new LtiError('invalid_request', `Tool token rejected: ${(err as Error).message}`);
  }
}

/** One item a tool returned from Deep Linking. */
export interface ContentItem {
  type: string;
  url?: string;
  title?: string;
  text?: string;
}

/**
 * Pull the resource links out of a verified Deep Linking response.
 *
 * Non-`ltiResourceLink` items are dropped rather than imported blindly: the
 * accept_types we advertised said resource links, and honouring only what we
 * asked for is the whole point of advertising it.
 */
export function contentItemsFrom(claims: Record<string, unknown>): ContentItem[] {
  const items = claims[C.contentItems];
  if (!Array.isArray(items)) return [];
  return items
    .filter((i): i is ContentItem => !!i && typeof i === 'object' && 'type' in i)
    .filter((i) => i.type === 'ltiResourceLink');
}

export const LTI_CLAIMS = C;
export const LTI_ROLES = ROLE;
