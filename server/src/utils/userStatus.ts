/**
 * The registration lifecycle of a user account — `User.status`.
 *
 * This is ORTHOGONAL to `User.isActive` and to `User.isConfirmed`; the three
 * gates answer three different questions and each has its own login error:
 *
 *   isConfirmed  — has this person proved they own the email address?
 *   status       — has an administrator agreed to let them in at all?
 *   isActive     — has an administrator since switched the account off?
 *
 * Collapsing `pending_approval` into `isActive: false` would show a waiting
 * applicant "Account is deactivated" and file them in the admin's deactivated
 * bucket rather than the approval queue, so the two stay separate.
 *
 * Kept dependency-free so the services, the zod schemas and the tests can all
 * read the same definition without dragging prisma or settings in with it.
 */

export const USER_STATUSES = ['active', 'pending_approval', 'rejected'] as const;
export type UserStatus = (typeof USER_STATUSES)[number];

/** The default for every account, and for every row that predates the queue. */
export const DEFAULT_USER_STATUS: UserStatus = 'active';

/**
 * Login rejection copy, one distinct message per blocked status. Distinct
 * wording matters: "awaiting approval" tells an applicant to wait, whereas
 * "deactivated" or "rejected" tells them not to.
 */
export const USER_STATUS_LOGIN_ERRORS: Partial<Record<UserStatus, string>> = {
  pending_approval: 'Your account is awaiting administrator approval',
  rejected: 'Your registration request was declined. Contact an administrator.',
};

/** The analytics `failureReason` for a login blocked by status. */
export const USER_STATUS_FAILURE_REASONS: Partial<Record<UserStatus, string>> = {
  pending_approval: 'account_pending_approval',
  rejected: 'account_rejected',
};
