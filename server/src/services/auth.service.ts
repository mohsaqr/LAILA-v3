import bcrypt from 'bcryptjs';
import prisma from '../utils/prisma.js';
import { generateToken, invalidateUserStatusCache } from '../middleware/auth.middleware.js';
import { RegisterInput, LoginInput } from '../utils/validation.js';
import { AppError } from '../middleware/error.middleware.js';
import { UserPayload } from '../types/index.js';
import { learningAnalyticsService, AuthEventData } from './learningAnalytics.service.js';
import { authLogger } from '../utils/logger.js';
import { userService } from './user.service.js';
import { emailService, VERIFICATION_CODE_TTL_MS } from './email.service.js';
import { asRegistrationRole, registrationPolicyService } from './registrationPolicy.service.js';
import { invitationService, type InvitationRecord } from './invitation.service.js';
import {
  resolveCourseCodeForSignup,
  enrollSignupCourse,
  type SignupCourse,
} from './courseCodeSignup.service.js';
import { notificationService } from './notification.service.js';
import {
  DEFAULT_USER_STATUS,
  USER_STATUS_FAILURE_REASONS,
  USER_STATUS_LOGIN_ERRORS,
  type UserStatus,
} from '../utils/userStatus.js';
import crypto from 'crypto';

/**
 * Constant-time string comparison for secrets (verification codes). A plain
 * `===` short-circuits on the first differing character, leaking match length
 * through timing; timingSafeEqual does not. The length guard is required
 * because timingSafeEqual throws on unequal-length buffers.
 */
function timingSafeEqualStr(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

// Context for auth logging
export interface AuthContext {
  ipAddress?: string;
  userAgent?: string;
  deviceType?: string;
  browserName?: string;
  browserVersion?: string;
  osName?: string;
  osVersion?: string;
  sessionId?: string;
}

/** The shape register() hands back to its caller. */
const NEW_USER_SELECT = {
  id: true,
  fullname: true,
  email: true,
  isAdmin: true,
  isInstructor: true,
  avatarUrl: true,
  tokenVersion: true,
  createdAt: true,
} as const;

export class AuthService {
  async register(data: RegisterInput, context?: AuthContext) {
    // Invitation gate, FIRST — an invitation changes what the policy is allowed
    // to conclude, so it has to be settled before the policy is consulted.
    //
    // resolveForRegistration throws when an invitation was offered but is not
    // usable. That hard failure is the whole point: falling back to open signup
    // on a bad token would turn one mistyped character into an unintended
    // public registration on a site the admin deliberately closed.
    const invitation = await invitationService.resolveForRegistration({
      token: data.inviteToken,
      code: data.inviteCode,
      email: data.email,
    });

    // Course-code gate, SECOND, and for exactly the same reason as the
    // invitation above: a supplied-but-unresolvable code must hard-fail rather
    // than fall through to a plain signup. A learner who typed their teacher's
    // code and got an ordinary account instead would have no way to tell that
    // the course they came here for is missing.
    //
    // A code and an invitation may both be present. They are not in conflict:
    // the invitation governs the role, the course code governs enrolment. See
    // registerSchema and RegistrationSponsorship.
    const sponsorCourse: SignupCourse | null = data.courseCode
      ? await resolveCourseCodeForSignup(data.courseCode)
      : null;

    // Registration policy gate. The admin-configured posture (mode + email
    // domain lists) is the single authority on whether this signup may happen
    // at all — see services/registrationPolicy.service.ts. Evaluated before any
    // writes so that a rejected signup touches nothing, not even a stale
    // unverified row.
    //
    // A resolved course code is passed as sponsorship: it satisfies invite_only
    // and stands in for the approval, but it deliberately does NOT waive email
    // verification. Proving the mailbox is the applicant's own work, and no
    // teacher's code can vouch for an address nobody has shown they own.
    const decision = await registrationPolicyService.evaluate(
      data.email,
      invitation ? { role: asRegistrationRole(invitation.role) } : null,
      sponsorCourse !== null
    );
    if (!decision.allowed) {
      throw new AppError(decision.reason || 'Registration is not available.', 403);
    }
    // Approval and email verification are INDEPENDENT gates and both may
    // apply. The account is created as pending_approval and still receives its
    // code: proving the mailbox is the applicant's own work and can happen
    // while they wait, whereas an admin reviewing an unverified address would
    // be approving something nobody has shown they own. Verification therefore
    // runs first, approval second — login enforces both regardless of order.

    // Check if user exists
    const existingUser = await prisma.user.findUnique({
      where: { email: data.email },
    });

    if (existingUser) {
      if (existingUser.isConfirmed) {
        throw new AppError('Email already registered', 409);
      }
      // An administrator's verdict outlives an unverified row. Deleting purely
      // on isConfirmed let a rejected applicant clear their rejection by
      // submitting the form a second time, and let a pending one silently
      // restart their place in the queue.
      if (existingUser.status === 'rejected') {
        throw new AppError(
          USER_STATUS_LOGIN_ERRORS.rejected ?? 'Registration is not available.',
          403
        );
      }
      if (existingUser.status === 'pending_approval') {
        throw new AppError('Your registration is already awaiting administrator approval.', 409);
      }
      // Unverified user — delete old record so they can re-register
      await prisma.user.delete({ where: { id: existingUser.id } });
    }

    // Hash password
    const passwordHash = await bcrypt.hash(data.password, 10);

    // Create user (unconfirmed until code verification, unless the policy has
    // email verification switched off). `decision.role` is authoritative: for
    // an invited signup it came from the invitation, never from the client.
    const newUser = {
      fullname: data.fullname,
      email: data.email,
      passwordHash,
      isConfirmed: !decision.requiresEmailVerification,
      isInstructor: decision.role === 'instructor',
      status: decision.requiresApproval ? 'pending_approval' : DEFAULT_USER_STATUS,
    };

    // The code is minted BEFORE the write so it can be stored in the same
    // transaction as the account. Creating it afterwards meant an interruption
    // between the two left a spent invitation and an account with no way to
    // verify it — and the retry then failed, because the invitation was gone.
    const verification = decision.requiresEmailVerification
      ? {
          code: crypto.randomInt(100000, 999999).toString(),
          expiresAt: new Date(Date.now() + VERIFICATION_CODE_TTL_MS),
        }
      : null;

    // A transaction is only opened when something has to happen ATOMICALLY with
    // the insert — spending an invitation, or delivering a promised enrolment.
    // An ordinary public signup still takes the plain single-statement path.
    const user = invitation || sponsorCourse
      ? await this.createSponsoredUser(invitation, sponsorCourse, newUser, verification)
      : await prisma.user.create({ data: newUser, select: NEW_USER_SELECT });

    // The plain path writes its code after the insert. That is not atomic, but
    // nothing irreversible was spent: if it fails the applicant has an account
    // with no code, and "resend code" recovers it. A sponsored signup has no
    // such fallback — its retry would need an invitation that is already
    // consumed — so there the code is written inside the transaction instead.
    if (verification && !invitation && !sponsorCourse) {
      await prisma.verificationCode.deleteMany({ where: { userId: user.id, purpose: 'signup' } });
      await prisma.verificationCode.create({
        data: { userId: user.id, code: verification.code, purpose: 'signup', expiresAt: verification.expiresAt },
      });
    }

    if (verification) {
      // Sending is not transactional and must not be: a mail failure should
      // cost the applicant a resend, not their account.
      emailService.sendVerificationCode(user.email, verification.code, user.fullname).catch(err => {
        authLogger.warn({ err, email: user.email }, 'Failed to send verification email');
      });
    }

    // Log registration event
    try {
      await learningAnalyticsService.logAuthEvent({
        userId: user.id,
        userEmail: user.email,
        eventType: 'register',
        sessionId: context?.sessionId,
        userAgent: context?.userAgent,
        deviceType: context?.deviceType,
        browserName: context?.browserName,
        browserVersion: context?.browserVersion,
        osName: context?.osName,
        osVersion: context?.osVersion,
      }, context?.ipAddress);
    } catch (error) {
      authLogger.warn({ err: error, userId: user.id }, 'Failed to log registration event');
    }

    // Tell the admins someone is waiting. Non-blocking and best-effort, like
    // the verification email above: a notification failure must never cost the
    // applicant their account.
    if (decision.requiresApproval) {
      this.notifyAdminsOfPendingRegistration(user.id, user.fullname, user.email).catch(err => {
        authLogger.warn({ err, userId: user.id }, 'Failed to notify admins of pending registration');
      });
    }

    // Return email only — no token until verified. When the policy waives
    // verification the account is already usable, so the client sends the
    // learner straight to the sign-in screen instead of the code step.
    return {
      email: user.email,
      verificationRequired: decision.requiresEmailVerification,
      approvalRequired: decision.requiresApproval,
      // The ONE course detail that ever reaches an unauthenticated caller, and
      // only after they successfully redeemed the code: the title of the course
      // they are now in, so they can confirm they landed in the right place.
      // Never the id, the instructor, or anything a probe could mine.
      courseTitle: sponsorCourse?.title ?? null,
      message: decision.requiresApproval
        ? 'Your registration is awaiting administrator approval.'
        : decision.requiresEmailVerification
          ? 'Verification code sent'
          : 'Account created. You can sign in now.',
    };
  }

  /**
   * Create an account that somebody vouched for: spend the invitation (if
   * there is one), create the user, and enrol them into every course the
   * sponsorship promised — all in ONE transaction.
   *
   * The transaction is what makes the use budget honest in both directions. If
   * the user insert fails, the consumed use rolls back, so a transient error
   * cannot burn someone's single-use invitation and leave them with nothing. If
   * the consume loses a race, nothing is created, so two people cannot share
   * one use.
   *
   * It is equally what makes a course code honest: a failed enrolment rolls the
   * account back, so a learner never ends up holding an account that quietly
   * lacks the course they signed up for. Either both exist or neither does.
   *
   * consume() runs FIRST because it is the operation that can legitimately
   * fail on a race; doing it before the expensive insert keeps the losing
   * request short.
   */
  /**
   * Create a sponsored account and everything that must be true the moment it
   * exists: the invitation spent, the promised enrolments in place, and the
   * verification code stored. One transaction, so a failure anywhere leaves no
   * half-registered user and, crucially, no invitation burned for nothing.
   */
  private async createSponsoredUser(
    invitation: InvitationRecord | null,
    sponsorCourse: SignupCourse | null,
    newUser: {
      fullname: string;
      email: string;
      passwordHash: string;
      isConfirmed: boolean;
      isInstructor: boolean;
      status: string;
    },
    verification: { code: string; expiresAt: Date } | null
  ) {
    return prisma.$transaction(async tx => {
      if (invitation) {
        const consumed = await invitationService.consume(invitation.id, tx);
        if (!consumed) {
          throw new AppError('That invitation is no longer valid.', 403);
        }
      }

      const user = await tx.user.create({ data: newUser, select: NEW_USER_SELECT });

      // Auto-enrol. A Set because an invitation and a course code can name the
      // SAME course, and enrolling twice would trip the (userId, courseId)
      // unique constraint and roll the whole signup back over nothing.
      const courseIds = new Set<number>();
      if (invitation?.courseId != null) courseIds.add(invitation.courseId);
      if (sponsorCourse) courseIds.add(sponsorCourse.id);

      for (const courseId of courseIds) {
        await enrollSignupCourse(tx, user.id, courseId);
      }

      if (verification) {
        await tx.verificationCode.deleteMany({ where: { userId: user.id, purpose: 'signup' } });
        await tx.verificationCode.create({
          data: { userId: user.id, code: verification.code, purpose: 'signup', expiresAt: verification.expiresAt },
        });
      }

      return user;
    });
  }

  /** Fan a pending-registration notice out to every admin who can act on it. */
  private async notifyAdminsOfPendingRegistration(
    userId: number,
    fullname: string,
    email: string
  ): Promise<void> {
    const admins = await prisma.user.findMany({
      where: { isAdmin: true, isActive: true, status: DEFAULT_USER_STATUS },
      select: { id: true },
    });
    await Promise.all(
      admins.map(admin =>
        notificationService.create({
          userId: admin.id,
          type: 'account_approval',
          title: 'Registration awaiting approval',
          message: `${fullname} (${email}) is waiting for review.`,
          link: '/admin/settings?tab=users',
          data: { pendingUserId: userId },
        })
      )
    );
  }

  async verifyCode(email: string, code: string) {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) throw new AppError('User not found', 404);

    // A signup code confirms an unconfirmed account. Refusing an already-
    // confirmed user closes the takeover path where an attacker triggers
    // forgot-password for a live account and then brute-forces this endpoint
    // to re-confirm it and mint a token.
    if (user.isConfirmed) throw new AppError('Account is already verified', 400);

    // Look the code up by purpose, NOT by value: matching on `code` would make
    // a wrong guess indistinguishable from "no code" and leave nothing to count
    // attempts against, so the 6-digit code could be brute-forced for free.
    const record = await prisma.verificationCode.findFirst({
      where: { userId: user.id, purpose: 'signup' },
    });

    if (!record) {
      throw new AppError('Invalid verification code', 400);
    }

    if (record.expiresAt < new Date()) {
      // Expired — delete and reject
      await prisma.verificationCode.deleteMany({ where: { userId: user.id } });
      throw new AppError('Verification code has expired', 400);
    }

    if (!timingSafeEqualStr(record.code, code)) {
      await this.registerFailedCodeAttempt(record.id, user.id, record.attempts);
      throw new AppError('Invalid verification code', 400);
    }

    // Confirm user and delete code
    const confirmedUser = await prisma.user.update({
      where: { id: user.id },
      data: { isConfirmed: true },
      select: {
        id: true,
        fullname: true,
        email: true,
        isAdmin: true,
        isInstructor: true,
        avatarUrl: true,
        tokenVersion: true,
        status: true,
      },
    });

    await prisma.verificationCode.deleteMany({ where: { userId: user.id, purpose: 'signup' } });

    // Proving you own the mailbox does not get you in on its own. Verification
    // and approval are independent gates and this path consulted only the
    // first, so an applicant could sign in simply by verifying their email
    // before an administrator had approved them.
    const statusError = USER_STATUS_LOGIN_ERRORS[confirmedUser.status as UserStatus];
    if (statusError) {
      return { user: confirmedUser, token: null, statusMessage: statusError };
    }

    // Generate token
    const payload: UserPayload = {
      id: confirmedUser.id,
      email: confirmedUser.email,
      fullname: confirmedUser.fullname,
      isAdmin: confirmedUser.isAdmin,
      isInstructor: confirmedUser.isInstructor,
      tokenVersion: confirmedUser.tokenVersion,
    };
    const token = generateToken(payload);

    return { user: confirmedUser, token, statusMessage: null };
  }

  async resendCode(email: string) {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) throw new AppError('User not found', 404);
    if (user.isConfirmed) throw new AppError('User already verified', 400);

    const code = crypto.randomInt(100000, 999999).toString();
    const expiresAt = new Date(Date.now() + VERIFICATION_CODE_TTL_MS);

    await prisma.verificationCode.deleteMany({ where: { userId: user.id, purpose: 'signup' } });
    await prisma.verificationCode.create({
      data: { userId: user.id, code, purpose: 'signup', expiresAt },
    });

    // Send verification email (non-blocking)
    emailService.sendVerificationCode(user.email, code, user.fullname).catch((err) => {
      authLogger.warn({ err, email: user.email }, 'Failed to send verification email');
    });

    return { message: 'Verification code resent' };
  }

  // Account lockout settings.
  //
  // This is the per-ACCOUNT half of brute-force protection; the per-IP half is
  // `authLimiter` in middleware/rateLimit.middleware.ts. Only this half can stop
  // a botnet spread across many addresses from grinding away at one admin
  // account, so it cannot simply be delegated to the rate limiter.
  //
  // It was disabled on 2026-08-03 for a good reason, now fixed. At 5 attempts /
  // 15 minutes it behaved far worse than those numbers suggest: nothing reset
  // the counter when a lock expired — only a successful login or a password
  // reset did — so a locked-out account came back with the counter still at the
  // maximum and re-locked on the very next wrong password. That meant one guess
  // per 15 minutes, indefinitely, for anyone who had merely forgotten their
  // password. It was a ratchet, not a lockout.
  //
  // Re-enabled with that ratchet fixed (see `lockExpired` in login(), which
  // starts a fresh budget once a lock lapses) and with a threshold doubled to
  // 10, so a legitimate person gets ten tries every 15 minutes rather than one.
  // An attacker gets at most 40 bcrypt-cost-10 guesses an hour per account.
  //
  // Escape hatch: a password reset clears both the counter and the lock, so a
  // locked-out operator can always recover through email without a DB edit.
  private static readonly LOCKOUT_ENABLED = true;
  private static readonly MAX_FAILED_ATTEMPTS = 10;
  private static readonly LOCKOUT_DURATION_MINUTES = 15;

  async login(data: LoginInput, context?: AuthContext) {
    // Find user
    const user = await prisma.user.findUnique({
      where: { email: data.email },
    });

    if (!user) {
      // Log failed login attempt - user not found
      try {
        await learningAnalyticsService.logAuthEvent({
          userEmail: data.email,
          eventType: 'login_failure',
          failureReason: 'user_not_found',
          sessionId: context?.sessionId,
          userAgent: context?.userAgent,
          deviceType: context?.deviceType,
          browserName: context?.browserName,
          browserVersion: context?.browserVersion,
          osName: context?.osName,
          osVersion: context?.osVersion,
        }, context?.ipAddress);
      } catch (error) {
        authLogger.warn({ err: error, email: data.email }, 'Failed to log login failure event');
      }
      throw new AppError('Invalid credentials', 401);
    }

    // A lock that has already lapsed must start the next attempt from a clean
    // slate. Leaving the counter at its maximum is what turned the old lockout
    // into a one-guess-per-15-minutes ratchet; see MAX_FAILED_ATTEMPTS above.
    const lockExpired = user.lockedUntil != null && user.lockedUntil <= new Date();

    // Check if account is locked. A row locked before the feature was disabled
    // still carries a future lockedUntil, so this must gate on the flag too or
    // those users stay locked until the timestamp lapses.
    if (AuthService.LOCKOUT_ENABLED && user.lockedUntil && user.lockedUntil > new Date()) {
      const remainingMinutes = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60000);
      try {
        await learningAnalyticsService.logAuthEvent({
          userId: user.id,
          userEmail: user.email,
          eventType: 'login_failure',
          failureReason: 'account_locked',
          sessionId: context?.sessionId,
          userAgent: context?.userAgent,
          deviceType: context?.deviceType,
          browserName: context?.browserName,
          browserVersion: context?.browserVersion,
          osName: context?.osName,
          osVersion: context?.osVersion,
        }, context?.ipAddress);
      } catch (error) {
        authLogger.warn({ err: error, email: data.email }, 'Failed to log login failure event');
      }
      throw new AppError(`Account is locked. Please try again in ${remainingMinutes} minute(s).`, 423);
    }

    if (!user.isConfirmed) {
      throw new AppError('Your account is not verified. Please sign up again and complete the verification.', 403);
    }

    // Approval gate. Checked between verification and deactivation so each of
    // the three answers a distinct question and reports a distinct reason —
    // an applicant still in the queue must not be told "deactivated".
    const statusError = USER_STATUS_LOGIN_ERRORS[user.status as UserStatus];
    if (statusError) {
      try {
        await learningAnalyticsService.logAuthEvent({
          userId: user.id,
          userEmail: user.email,
          eventType: 'login_failure',
          failureReason:
            USER_STATUS_FAILURE_REASONS[user.status as UserStatus] ?? 'account_status_blocked',
          sessionId: context?.sessionId,
          userAgent: context?.userAgent,
          deviceType: context?.deviceType,
          browserName: context?.browserName,
          browserVersion: context?.browserVersion,
          osName: context?.osName,
          osVersion: context?.osVersion,
        }, context?.ipAddress);
      } catch (error) {
        authLogger.warn({ err: error, email: data.email }, 'Failed to log login failure event');
      }
      throw new AppError(statusError, 403);
    }

    if (!user.isActive) {
      // Log failed login attempt - account deactivated
      try {
        await learningAnalyticsService.logAuthEvent({
          userId: user.id,
          userEmail: user.email,
          eventType: 'login_failure',
          failureReason: 'account_deactivated',
          sessionId: context?.sessionId,
          userAgent: context?.userAgent,
          deviceType: context?.deviceType,
          browserName: context?.browserName,
          browserVersion: context?.browserVersion,
          osName: context?.osName,
          osVersion: context?.osVersion,
        }, context?.ipAddress);
      } catch (error) {
        authLogger.warn({ err: error, email: data.email }, 'Failed to log login failure event');
      }
      throw new AppError('Account is deactivated', 403);
    }

    // Check password
    const isValidPassword = await bcrypt.compare(data.password, user.passwordHash);
    if (!isValidPassword) {
      // Increment failed login attempts. A lapsed lock resets the budget first,
      // so serving a lock costs the user their counter rather than leaving them
      // permanently one wrong password away from the next lock.
      const newFailedAttempts = (lockExpired ? 0 : user.failedLoginAttempts) + 1;
      const updateData: { failedLoginAttempts: number; lockedUntil?: Date | null } = {
        failedLoginAttempts: newFailedAttempts,
      };

      // Lock account if max attempts reached
      const shouldLock =
        AuthService.LOCKOUT_ENABLED && newFailedAttempts >= AuthService.MAX_FAILED_ATTEMPTS;
      if (shouldLock) {
        updateData.lockedUntil = new Date(Date.now() + AuthService.LOCKOUT_DURATION_MINUTES * 60000);
      } else if (lockExpired) {
        // Clear the spent timestamp too, so `lockedUntil` never lingers as a
        // stale value that later reads as "this account has a lock".
        updateData.lockedUntil = null;
      }

      await prisma.user.update({
        where: { id: user.id },
        data: updateData,
      });

      // Log failed login attempt - invalid password
      try {
        await learningAnalyticsService.logAuthEvent({
          userId: user.id,
          userEmail: user.email,
          eventType: 'login_failure',
          failureReason: shouldLock ? 'account_locked' : 'invalid_password',
          attemptCount: newFailedAttempts,
          sessionId: context?.sessionId,
          userAgent: context?.userAgent,
          deviceType: context?.deviceType,
          browserName: context?.browserName,
          browserVersion: context?.browserVersion,
          osName: context?.osName,
          osVersion: context?.osVersion,
        }, context?.ipAddress);
      } catch (error) {
        authLogger.warn({ err: error, email: data.email }, 'Failed to log login failure event');
      }

      if (shouldLock) {
        throw new AppError(`Account locked due to too many failed attempts. Please try again in ${AuthService.LOCKOUT_DURATION_MINUTES} minutes.`, 423);
      }

      throw new AppError('Invalid credentials', 401);
    }

    // Successful login - reset failed attempts and lockout
    await prisma.user.update({
      where: { id: user.id },
      data: {
        lastLogin: new Date(),
        failedLoginAttempts: 0,
        lockedUntil: null,
      },
    });

    // Generate token with tokenVersion for invalidation support
    const payload: UserPayload = {
      id: user.id,
      email: user.email,
      fullname: user.fullname,
      isAdmin: user.isAdmin,
      isInstructor: user.isInstructor,
      tokenVersion: user.tokenVersion,
    };
    const token = generateToken(payload);

    // Log successful login
    try {
      await learningAnalyticsService.logAuthEvent({
        userId: user.id,
        userEmail: user.email,
        eventType: 'login_success',
        sessionId: context?.sessionId,
        userAgent: context?.userAgent,
        deviceType: context?.deviceType,
        browserName: context?.browserName,
        browserVersion: context?.browserVersion,
        osName: context?.osName,
        osVersion: context?.osVersion,
      }, context?.ipAddress);
    } catch (error) {
      authLogger.warn({ err: error, userId: user.id }, 'Failed to log login success event');
    }

    // Fetch user's language preference
    const languagePreference = await userService.getLanguagePreference(user.id);

    return {
      user: {
        id: user.id,
        fullname: user.fullname,
        email: user.email,
        isAdmin: user.isAdmin,
        isInstructor: user.isInstructor,
        avatarUrl: user.avatarUrl,
        language: languagePreference,
      },
      token,
    };
  }

  async getProfile(userId: number) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        fullname: true,
        email: true,
        isAdmin: true,
        isInstructor: true,
        isConfirmed: true,
        avatarUrl: true,
        createdAt: true,
        lastLogin: true,
        settings: true,
      },
    });

    if (!user) {
      throw new AppError('User not found', 404);
    }

    return user;
  }

  async updatePassword(userId: number, currentPassword: string, newPassword: string, context?: AuthContext) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new AppError('User not found', 404);
    }

    const isValidPassword = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!isValidPassword) {
      throw new AppError('Current password is incorrect', 401);
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);
    // Increment tokenVersion to invalidate all existing tokens
    await prisma.user.update({
      where: { id: userId },
      data: {
        passwordHash,
        tokenVersion: { increment: 1 },
      },
    });

    // Invalidate user status cache so new tokenVersion takes effect immediately
    invalidateUserStatusCache(userId);

    // Log password change event
    try {
      await learningAnalyticsService.logAuthEvent({
        userId: user.id,
        userEmail: user.email,
        eventType: 'password_change',
        sessionId: context?.sessionId,
        userAgent: context?.userAgent,
        deviceType: context?.deviceType,
        browserName: context?.browserName,
        browserVersion: context?.browserVersion,
        osName: context?.osName,
        osVersion: context?.osVersion,
      }, context?.ipAddress);
    } catch (error) {
      authLogger.warn({ err: error, userId: user.id }, 'Failed to log password change event');
    }

    return { message: 'Password updated successfully' };
  }

  async forgotPassword(email: string) {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) throw new AppError('User not found', 404);

    // Clear only prior reset codes; a signup code the user is mid-verification
    // on must survive.
    await prisma.verificationCode.deleteMany({ where: { userId: user.id, purpose: 'reset' } });

    // Generate 6-digit verification code
    const code = crypto.randomInt(100000, 999999).toString();
    const expiresAt = new Date(Date.now() + VERIFICATION_CODE_TTL_MS);

    await prisma.verificationCode.create({
      data: { userId: user.id, code, purpose: 'reset', expiresAt },
    });

    // Send verification email (non-blocking)
    emailService.sendVerificationCode(user.email, code, user.fullname).catch((err) => {
      authLogger.warn({ err, email: user.email }, 'Failed to send password reset verification email');
    });

    return { email, message: 'Verification code sent' };
  }

  // A 6-digit code has only ~900k possibilities; without a per-code cap it can
  // be brute-forced within the 10-minute window. After this many wrong guesses
  // the code is destroyed and the user must request a fresh one.
  private static readonly MAX_CODE_ATTEMPTS = 5;

  async verifyResetCode(email: string, code: string) {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) throw new AppError('User not found', 404);

    const record = await prisma.verificationCode.findFirst({
      where: { userId: user.id, purpose: 'reset' },
    });

    if (!record) {
      throw new AppError('Invalid verification code', 400);
    }

    if (record.expiresAt < new Date()) {
      await prisma.verificationCode.deleteMany({ where: { userId: user.id, purpose: 'reset' } });
      throw new AppError('Verification code has expired', 400);
    }

    if (!timingSafeEqualStr(record.code, code)) {
      await this.registerFailedCodeAttempt(record.id, user.id, record.attempts);
      throw new AppError('Invalid verification code', 400);
    }

    return { valid: true };
  }

  // Increment the failed-attempt counter for a code; once the cap is exceeded,
  // delete every code for the user so a fresh request is required.
  private async registerFailedCodeAttempt(recordId: number, userId: number, currentAttempts: number) {
    if (currentAttempts + 1 >= AuthService.MAX_CODE_ATTEMPTS) {
      await prisma.verificationCode.deleteMany({ where: { userId } });
      throw new AppError('Too many incorrect attempts. Please request a new code.', 429);
    }
    await prisma.verificationCode.update({
      where: { id: recordId },
      data: { attempts: { increment: 1 } },
    });
  }

  async resetPassword(email: string, code: string, newPassword: string) {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) throw new AppError('User not found', 404);

    const record = await prisma.verificationCode.findFirst({
      where: { userId: user.id, purpose: 'reset' },
    });

    if (!record) {
      throw new AppError('Invalid verification code', 400);
    }

    if (record.expiresAt < new Date()) {
      await prisma.verificationCode.deleteMany({ where: { userId: user.id, purpose: 'reset' } });
      throw new AppError('Verification code has expired', 400);
    }

    if (!timingSafeEqualStr(record.code, code)) {
      await this.registerFailedCodeAttempt(record.id, user.id, record.attempts);
      throw new AppError('Invalid verification code', 400);
    }

    // Hash new password
    const passwordHash = await bcrypt.hash(newPassword, 10);

    // Update user: new password, increment tokenVersion, reset lockout.
    // isConfirmed is set because completing a reset proves mailbox ownership —
    // the same proof signup verification requires. Without it, resetting an
    // unconfirmed account left it in a state login later rejects as "sign up
    // again", stranding the account.
    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        isConfirmed: true,
        tokenVersion: { increment: 1 },
        failedLoginAttempts: 0,
        lockedUntil: null,
      },
      select: {
        id: true,
        fullname: true,
        email: true,
        isAdmin: true,
        isInstructor: true,
        avatarUrl: true,
        tokenVersion: true,
        status: true,
      },
    });

    // Delete the verification code
    await prisma.verificationCode.deleteMany({ where: { userId: user.id, purpose: 'reset' } });

    // Invalidate user status cache
    invalidateUserStatusCache(user.id);

    // Same rule as verifyCode: a password reset proves mailbox control, which
    // is not the approval gate. Issuing a token here would let a pending or
    // rejected applicant in through the forgot-password flow.
    const statusError = USER_STATUS_LOGIN_ERRORS[updatedUser.status as UserStatus];
    if (statusError) {
      return { user: updatedUser, token: null, statusMessage: statusError };
    }

    // Generate token
    const payload: UserPayload = {
      id: updatedUser.id,
      email: updatedUser.email,
      fullname: updatedUser.fullname,
      isAdmin: updatedUser.isAdmin,
      isInstructor: updatedUser.isInstructor,
      tokenVersion: updatedUser.tokenVersion,
    };
    const token = generateToken(payload);

    return { user: updatedUser, token, statusMessage: null };
  }

  /**
   * Log a logout event
   */
  async logLogout(userId: number, userEmail: string, context?: AuthContext, sessionDuration?: number) {
    try {
      await learningAnalyticsService.logAuthEvent({
        userId,
        userEmail,
        eventType: 'logout',
        sessionId: context?.sessionId,
        sessionDuration,
        userAgent: context?.userAgent,
        deviceType: context?.deviceType,
        browserName: context?.browserName,
        browserVersion: context?.browserVersion,
        osName: context?.osName,
        osVersion: context?.osVersion,
      }, context?.ipAddress);
    } catch (error) {
      authLogger.warn({ err: error, userId }, 'Failed to log logout event');
    }
  }

  /**
   * Revoke every outstanding token for a user by bumping tokenVersion, so a
   * logged-out (or stolen) token stops authenticating immediately instead of
   * riding out the 30-day expiry.
   *
   * NOTE: tokens carry no per-session identity, so this necessarily ends ALL of
   * the user's sessions across every device. Device-local logout would require
   * short-lived access tokens + a refresh-token store (see report P1-5/Q5).
   */
  async revokeTokens(userId: number) {
    await prisma.user.update({
      where: { id: userId },
      data: { tokenVersion: { increment: 1 } },
    });
    invalidateUserStatusCache(userId);
  }
}

export const authService = new AuthService();
