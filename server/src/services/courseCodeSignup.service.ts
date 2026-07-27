import { Prisma } from '@prisma/client';
import prisma from '../utils/prisma.js';
import { AppError } from '../middleware/error.middleware.js';

/**
 * Sign up with a teacher's course code.
 *
 * A course activation code already exists and is already validated by
 * enrollment.service.enroll(): "here is a course id, and here is the code —
 * do they match?". SIGNUP NEEDS THE INVERSE. At the point a stranger types a
 * code into the register form there is no course id, so the code has to be
 * resolved globally, code -> course. That is why courses.activation_code
 * carries a UNIQUE index as of 20260727153257_add_course_code_signup.
 *
 * THE CODE IS THE SPONSORSHIP. A teacher handing out their course code is
 * vouching for whoever turns up with it, which is why a valid code satisfies
 * invite_only mode and skips the approval queue (see
 * registrationPolicy.service). It is deliberately a WEAKER sponsorship than an
 * admin's invitation: it does not choose a role and it does not override the
 * platform's email domain lists, because a teacher must not be able to
 * overrule an administrator's decision about who may hold an account here.
 *
 * WHAT IT MUST NOT LEAK. Every failure below — unknown code, malformed code,
 * a course that is not published — returns the SAME message and the SAME
 * status. An unauthenticated caller can therefore learn nothing from probing
 * except what actually redeeming a working code would have told them anyway,
 * and never a course's existence, title or state. The only course detail that
 * ever reaches the client is the title of the course they just joined, which
 * they need in order to confirm they landed in the right place.
 */

/** The one message every failure uses. Do not add a more specific variant. */
const REJECTION = 'That course code is not valid.';

/**
 * Codes are 8 characters today (CourseService.generateActivationCode) but an
 * instructor may supply their own, so the bound is generous. It exists to stop
 * a megabyte of text reaching the database, not to validate the format.
 */
const MIN_CODE_LENGTH = 3;
const MAX_CODE_LENGTH = 32;

/** Just enough of the course to enrol into it and name it back to the learner. */
export interface SignupCourse {
  id: number;
  title: string;
}

/**
 * Uppercase + trim, matching how codes are stored and how
 * enrollment.service.enroll() compares them. Exported so tests and callers
 * agree on one normalisation rather than each rolling their own.
 */
export function normalizeCourseCode(code: string): string {
  return code.trim().toUpperCase();
}

/**
 * Resolve a course code offered at signup, or throw.
 *
 * Throwing is the point: register() must NEVER fall through to a plain signup
 * when a code was supplied but did not resolve. The learner would end up with
 * an account silently missing the course they were trying to join, and would
 * have no reason to suspect it.
 *
 * `published` is required because enrollment.service.enroll() requires it —
 * signup enrols people, so it must respect the same rule rather than becoming
 * a side door into a draft or archived course.
 */
export async function resolveCourseCodeForSignup(rawCode: string): Promise<SignupCourse> {
  const code = normalizeCourseCode(rawCode);
  if (code.length < MIN_CODE_LENGTH || code.length > MAX_CODE_LENGTH) {
    throw new AppError(REJECTION, 403);
  }

  const course = await prisma.course.findUnique({
    where: { activationCode: code },
    select: { id: true, title: true, status: true },
  });

  // One branch, one message: "no such code" and "that course is not open" are
  // indistinguishable from the outside on purpose.
  if (!course || course.status !== 'published') {
    throw new AppError(REJECTION, 403);
  }

  return { id: course.id, title: course.title };
}

/**
 * Enrol a brand-new account into the sponsoring course.
 *
 * Takes a transaction client because account creation and enrolment are ONE
 * transaction: a code that promises a course either delivers it or leaves no
 * account behind. A half-done signup would hand the learner an account that
 * looks like an ordinary public registration, with no trace of the code they
 * used and no way for them to tell.
 */
export async function enrollSignupCourse(
  tx: Prisma.TransactionClient,
  userId: number,
  courseId: number
): Promise<void> {
  await tx.enrollment.create({ data: { userId, courseId } });
}
