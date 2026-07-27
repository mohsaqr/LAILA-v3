import crypto from 'crypto';
import { Prisma } from '@prisma/client';
import prisma from '../utils/prisma.js';
import { AppError } from '../middleware/error.middleware.js';
import { adminAuditService } from './adminAudit.service.js';
import { REGISTRATION_ROLES, type RegistrationRole } from './registrationPolicy.service.js';

/**
 * Admin-issued invitations.
 *
 * An invitation is a named administrator's decision to let one person (or,
 * for an open link, whoever holds it) create an account even while the
 * platform is not open to the public. It is the counterpart to the
 * registration policy engine: the policy says who may sign up *in general*,
 * an invitation says who may sign up *anyway*.
 *
 * TWO REDEMPTION FORMS, ONE ROW.
 *   - `token` is a 32-byte random string carried in a shareable URL.
 *   - the human-readable `code` (XXXX-XXXX-XXXX) is for someone typing it in
 *     or reading it out over a phone.
 * Both point at the same invitation and consume the same use budget.
 *
 * THE CODE IS NEVER STORED. Only an HMAC-SHA256 digest of the normalized code
 * goes into the database. The plaintext is returned exactly once, from
 * `create()`, and is unrecoverable afterwards — a leaked database dump does
 * not hand the attacker a pile of working registration codes. `codeHint` (the
 * last four characters) exists so an admin can still tell two codes apart in a
 * list; four characters out of a 60-bit code is not enough to redeem anything.
 */

// ---------------------------------------------------------------------------
// Code + token minting
// ---------------------------------------------------------------------------

/**
 * Crockford-ish alphabet with the four worst look-alikes removed: no 0/O and
 * no 1/I. Someone copying a code off a whiteboard or reading it down a phone
 * line should not be able to produce a *different* valid code by misreading
 * one character.
 *
 * Exactly 32 symbols, which is what makes the `b & 31` masking below uniform —
 * every symbol is equally likely. Dropping a fifth character (L, say) would
 * cost that uniformity, so the trade stops here.
 */
const CODE_ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
const CODE_LENGTH = 12;

/** Long, opaque, URL-safe. This is the secret in an invitation link. */
export function newInviteToken(): string {
  return crypto.randomBytes(32).toString('base64url');
}

/** A 60-bit human-readable code, grouped for legibility: XXXX-XXXX-XXXX. */
export function newInviteCode(): string {
  const bytes = crypto.randomBytes(CODE_LENGTH);
  const raw = Array.from(bytes, b => CODE_ALPHABET[b & 31]).join('');
  return `${raw.slice(0, 4)}-${raw.slice(4, 8)}-${raw.slice(8, 12)}`;
}

/**
 * Strip everything a human might add or drop — case, dashes, spaces — so that
 * "abcd efgh-ijkl" and "ABCD-EFGH-IJKL" hash to the same digest.
 */
export function normalizeInviteCode(code: string): string {
  return code.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

// The HMAC key. Read LAZILY: module-level imports are hoisted above the
// dotenv.config() call in index.ts, so reading process.env at import time
// would capture an unset value. Same pattern (and same test seam) as
// services/oidc.service.ts.
let cachedCodeSecret: string | null = null;

function codeSecret(): string {
  if (cachedCodeSecret) return cachedCodeSecret;
  const value = process.env.SESSION_SECRET;
  // index.ts already refuses to boot without SESSION_SECRET, so this only
  // fires in a misconfigured test or script — fail loudly rather than fall
  // back to a constant, which would make every deployment's digests
  // interchangeable.
  if (!value) throw new Error('SESSION_SECRET environment variable is required to hash invitation codes');
  cachedCodeSecret = value;
  return value;
}

/** Test seam: drop the memoised secret so a test can swap env between cases. */
export function resetInvitationSecretCache(): void {
  cachedCodeSecret = null;
}

/**
 * The stored form of a code. Keyed by SESSION_SECRET so a digest is only
 * meaningful to this deployment, and domain-separated by a version prefix so
 * the scheme can be rotated later without colliding with old rows.
 */
export function inviteCodeDigest(code: string): string {
  return crypto
    .createHmac('sha256', codeSecret())
    .update(`laila-invite-code:v1:${normalizeInviteCode(code)}`)
    .digest('base64url');
}

// ---------------------------------------------------------------------------
// Status
// ---------------------------------------------------------------------------

export const INVITATION_STATUSES = ['pending', 'used', 'expired', 'revoked'] as const;
export type InvitationStatus = (typeof INVITATION_STATUSES)[number];

export interface InvitationLifecycle {
  useCount: number;
  maxUses: number;
  expiresAt: Date | null;
  revokedAt: Date | null;
}

/**
 * Which of the four things an admin needs to distinguish this row is.
 *
 * Order matters and is deliberate: an admin's explicit withdrawal outranks
 * everything, a fully-redeemed invitation reads "used" even after its expiry
 * date passes (it did its job), and only a still-unused invitation can be
 * "expired".
 */
export function invitationStatus(inv: InvitationLifecycle, now: Date = new Date()): InvitationStatus {
  if (inv.revokedAt) return 'revoked';
  if (inv.useCount >= inv.maxUses) return 'used';
  if (inv.expiresAt && inv.expiresAt.getTime() <= now.getTime()) return 'expired';
  return 'pending';
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** The columns every read in this service selects. Never includes codeDigest. */
const INVITATION_SELECT = {
  id: true,
  email: true,
  role: true,
  courseId: true,
  token: true,
  codeHint: true,
  invitedById: true,
  maxUses: true,
  useCount: true,
  expiresAt: true,
  acceptedAt: true,
  revokedAt: true,
  createdAt: true,
} as const;

export type InvitationRecord = Prisma.InvitationGetPayload<{ select: typeof INVITATION_SELECT }>;

/** A list row: the record plus its derived status and the inviter's name. */
export interface InvitationListItem extends InvitationRecord {
  status: InvitationStatus;
  invitedByName: string | null;
  courseTitle: string | null;
}

export interface CreateInvitationInput {
  email?: string | null;
  role?: RegistrationRole;
  courseId?: number | null;
  maxUses?: number;
  expiresInDays?: number | null;
}

/** The one and only time the plaintext code exists outside the requester's hands. */
export interface CreatedInvitation {
  invitation: InvitationRecord;
  /** Plaintext, returned once. Not stored, not recoverable. */
  code: string;
}

export interface ActorContext {
  adminId: number;
  adminEmail?: string;
  ipAddress?: string;
}

export type InvitationCheck =
  | { valid: true; invitation: InvitationRecord }
  | { valid: false; reason: string };

/** Anything that can run a query: the client, or a transaction client. */
type PrismaLike = Pick<typeof prisma, 'invitation'> | Prisma.TransactionClient;

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

const DEFAULT_EXPIRY_DAYS = 14;
const DAY_MS = 24 * 60 * 60 * 1000;

export class InvitationService {
  /**
   * Mint an invitation. Returns the plaintext code alongside the row — this
   * is the only moment it exists; the caller must surface it to the admin now
   * or it is gone.
   */
  async create(input: CreateInvitationInput, actor: ActorContext): Promise<CreatedInvitation> {
    const role = this.resolveRole(input.role);
    const email = this.normalizeEmail(input.email);
    const maxUses = input.maxUses ?? 1;

    if (!Number.isInteger(maxUses) || maxUses < 1) {
      throw new AppError('An invitation must allow at least one use.', 400);
    }
    // An invitation addressed to one person is, by definition, for that one
    // person. Letting it be multi-use would silently turn a targeted invite
    // into a shareable link the admin did not ask for.
    if (email && maxUses > 1) {
      throw new AppError('An invitation addressed to an email address can only be used once.', 400);
    }
    if (input.courseId != null) await this.assertCourseExists(input.courseId);

    const code = newInviteCode();
    const invitation = await prisma.invitation.create({
      data: {
        email,
        role,
        courseId: input.courseId ?? null,
        token: newInviteToken(),
        codeDigest: inviteCodeDigest(code),
        codeHint: normalizeInviteCode(code).slice(-4),
        invitedById: actor.adminId,
        maxUses,
        expiresAt: this.resolveExpiry(input.expiresInDays),
      },
      select: INVITATION_SELECT,
    });

    await this.audit('invitation.create', invitation, actor);
    return { invitation, code };
  }

  /**
   * One single-use invitation per address. Emails are de-duplicated first, so
   * a pasted roster with repeats yields one invitation each rather than two
   * competing invites for the same person.
   *
   * Created sequentially and independently: a single failure (a colliding
   * digest, a database hiccup) costs that one address, not the batch.
   */
  async createBulk(
    emails: string[],
    input: Omit<CreateInvitationInput, 'email' | 'maxUses'>,
    actor: ActorContext
  ): Promise<{ created: CreatedInvitation[]; failed: string[] }> {
    const role = this.resolveRole(input.role);
    if (input.courseId != null) await this.assertCourseExists(input.courseId);

    const unique = [...new Set(emails.map(e => this.normalizeEmail(e)).filter((e): e is string => !!e))];

    const created: CreatedInvitation[] = [];
    const failed: string[] = [];
    for (const email of unique) {
      try {
        created.push(await this.create({ ...input, role, email, maxUses: 1 }, actor));
      } catch {
        failed.push(email);
      }
    }
    return { created, failed };
  }

  /** Every invitation, newest first, with its derived status. */
  async list(filters: { status?: InvitationStatus } = {}): Promise<InvitationListItem[]> {
    const rows = await prisma.invitation.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        ...INVITATION_SELECT,
        invitedBy: { select: { fullname: true } },
        course: { select: { title: true } },
      },
    });

    const now = new Date();
    const items = rows.map(({ invitedBy, course, ...rest }) => ({
      ...rest,
      status: invitationStatus(rest, now),
      invitedByName: invitedBy?.fullname ?? null,
      courseTitle: course?.title ?? null,
    }));

    return filters.status ? items.filter(i => i.status === filters.status) : items;
  }

  /**
   * Withdraw an invitation. The row survives so the admin list can keep
   * showing that it existed and was withdrawn — deleting it would make a
   * revoked invitation indistinguishable from one that never happened.
   */
  async revoke(id: number, actor: ActorContext): Promise<InvitationRecord> {
    const existing = await prisma.invitation.findUnique({ where: { id }, select: INVITATION_SELECT });
    if (!existing) throw new AppError('Invitation not found', 404);
    if (existing.revokedAt) throw new AppError('Invitation is already revoked', 409);

    const invitation = await prisma.invitation.update({
      where: { id },
      data: { revokedAt: new Date() },
      select: INVITATION_SELECT,
    });

    await this.audit('invitation.revoke', invitation, actor, existing);
    return invitation;
  }

  /** Validate a link token against expiry, revocation, use budget and email. */
  async validateByToken(token: string, email?: string): Promise<InvitationCheck> {
    const invitation = await prisma.invitation.findUnique({
      where: { token },
      select: INVITATION_SELECT,
    });
    return this.checkUsable(invitation, email);
  }

  /**
   * Validate a human-readable code. The lookup is by digest, so an
   * unrecognised code costs exactly one indexed miss and reveals nothing.
   */
  async validateByCode(code: string, email?: string): Promise<InvitationCheck> {
    const normalized = normalizeInviteCode(code);
    if (normalized.length !== CODE_LENGTH) {
      return { valid: false, reason: 'That invitation code is not valid.' };
    }
    const invitation = await prisma.invitation.findUnique({
      where: { codeDigest: inviteCodeDigest(normalized) },
      select: INVITATION_SELECT,
    });
    return this.checkUsable(invitation, email);
  }

  /**
   * Spend one use of an invitation.
   *
   * The limit check and the increment are ONE conditional UPDATE. Reading the
   * row and then updating it would leave a window in which two concurrent
   * registrations both see `useCount = 0` and both proceed; here the database
   * decides, and exactly one of them gets `count === 1`.
   *
   * Expiry and revocation are re-checked in the same WHERE for the same
   * reason — an invitation revoked between validation and consumption must
   * not still be spendable.
   *
   * Returns false when nothing was consumed; the caller MUST reject the
   * registration in that case.
   */
  async consume(id: number, client: PrismaLike = prisma): Promise<boolean> {
    const now = new Date();
    const result = await client.invitation.updateMany({
      where: {
        id,
        revokedAt: null,
        // Field reference: compared column-to-column inside the database, so
        // the bound is whatever the row actually says right now.
        useCount: { lt: prisma.invitation.fields.maxUses },
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      },
      data: { useCount: { increment: 1 }, acceptedAt: now },
    });
    return result.count === 1;
  }

  /**
   * Resolve the invitation for a registration attempt, if one was offered.
   *
   * A supplied-but-unusable invitation is a HARD failure. It must never fall
   * through to ordinary open signup: a mistyped code on an invite-only site
   * would then quietly create a public registration, which is exactly the
   * outcome the invitation exists to prevent.
   *
   * Returns null only when the caller offered no invitation at all.
   */
  async resolveForRegistration(input: {
    token?: string;
    code?: string;
    email: string;
  }): Promise<InvitationRecord | null> {
    const { token, code, email } = input;

    // Belt-and-braces: the register schema already rejects both at once, but
    // this function is the security boundary and should not depend on that.
    if (token && code) {
      throw new AppError('Provide either an invitation link or an invitation code, not both.', 400);
    }
    if (!token && !code) return null;

    const check = token
      ? await this.validateByToken(token, email)
      : await this.validateByCode(code!, email);

    if (!check.valid) throw new AppError(check.reason, 403);
    return check.invitation;
  }

  // -------------------------------------------------------------------------
  // Internals
  // -------------------------------------------------------------------------

  /** Shared usability rules for both redemption forms. */
  private checkUsable(invitation: InvitationRecord | null, email?: string): InvitationCheck {
    if (!invitation) return { valid: false, reason: 'That invitation is not valid.' };

    const status = invitationStatus(invitation);
    if (status === 'revoked') return { valid: false, reason: 'That invitation has been revoked.' };
    if (status === 'expired') return { valid: false, reason: 'That invitation has expired.' };
    if (status === 'used') return { valid: false, reason: 'That invitation has already been used.' };

    const target = this.normalizeEmail(email);
    if (invitation.email && target && invitation.email !== target) {
      return { valid: false, reason: 'That invitation was issued to a different email address.' };
    }
    // An email-bound invitation redeemed with no address at all is not usable
    // either — the binding is the point.
    if (invitation.email && !target) {
      return { valid: false, reason: 'That invitation was issued to a specific email address.' };
    }

    return { valid: true, invitation };
  }

  /**
   * Self-service registration never grants admin, invited or not — see
   * REGISTRATION_ROLES. An admin account is only ever conferred by an existing
   * admin through user management, where it is a visible, audited act.
   */
  private resolveRole(role: RegistrationRole | undefined): RegistrationRole {
    if (!role) return 'student';
    if (!REGISTRATION_ROLES.includes(role)) {
      throw new AppError('An invitation may only grant the student or instructor role.', 400);
    }
    return role;
  }

  private normalizeEmail(email: string | null | undefined): string | null {
    const trimmed = email?.trim().toLowerCase();
    return trimmed ? trimmed : null;
  }

  private resolveExpiry(days: number | null | undefined): Date | null {
    if (days === null) return null; // explicit "never expires"
    return new Date(Date.now() + (days ?? DEFAULT_EXPIRY_DAYS) * DAY_MS);
  }

  private async assertCourseExists(courseId: number): Promise<void> {
    const course = await prisma.course.findUnique({ where: { id: courseId }, select: { id: true } });
    if (!course) throw new AppError('Course not found', 404);
  }

  /**
   * Audit trail. Deliberately records the codeHint and never the token or the
   * digest: the log has to answer "which invitation was this" without itself
   * becoming a way to redeem one.
   */
  private async audit(
    action: string,
    invitation: InvitationRecord,
    actor: ActorContext,
    previous?: InvitationRecord
  ): Promise<void> {
    await adminAuditService.log({
      adminId: actor.adminId,
      adminEmail: actor.adminEmail,
      action,
      targetType: 'invitation',
      targetId: invitation.id,
      previousValues: previous ? { revokedAt: previous.revokedAt } : undefined,
      newValues: {
        email: invitation.email,
        role: invitation.role,
        courseId: invitation.courseId,
        maxUses: invitation.maxUses,
        expiresAt: invitation.expiresAt,
        revokedAt: invitation.revokedAt,
        codeHint: invitation.codeHint,
      },
      ipAddress: actor.ipAddress,
    });
  }
}

export const invitationService = new InvitationService();
