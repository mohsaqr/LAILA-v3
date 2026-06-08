import { AppError } from '../middleware/error.middleware.js';

/**
 * Availability-window helpers for instructor-scheduled resources.
 *
 * Resources (modules, lectures, code labs, assignments, quizzes, forum threads)
 * carry an optional `availableFrom` / `availableUntil` window. A null bound is
 * open-ended: null `availableFrom` means available since forever, null
 * `availableUntil` means available indefinitely.
 *
 * These helpers are applied ONLY to non-privileged enrolled students. Course
 * owners, admins, the global instructor role, and team members bypass the
 * window entirely (handled by the caller before invoking these helpers).
 */

/**
 * Prisma `where` fragment that keeps only rows whose availability window is
 * currently open. Spread into an existing `where` (it contributes an `AND`):
 *
 *   where: { ...existing, ...availabilityWindowWhere() }
 *
 * Mirrors the quiz list filter (quiz.service.ts).
 */
export function availabilityWindowWhere(now: Date = new Date()) {
  return {
    AND: [
      { OR: [{ availableFrom: null }, { availableFrom: { lte: now } }] },
      { OR: [{ availableUntil: null }, { availableUntil: { gte: now } }] },
    ],
  };
}

interface AvailabilityWindow {
  availableFrom?: Date | null;
  availableUntil?: Date | null;
}

/**
 * Throw a 403 AppError if `now` falls outside the entity's availability window.
 * `label` is the user-facing resource name (e.g. 'Lecture', 'Code Lab').
 *
 * Mirrors the quiz open-time assert (quiz.service.ts).
 */
export function assertWithinAvailability(
  entity: AvailabilityWindow,
  label: string,
  now: Date = new Date()
): void {
  if (entity.availableFrom && now < entity.availableFrom) {
    throw new AppError(`${label} is not yet available`, 403);
  }
  if (entity.availableUntil && now > entity.availableUntil) {
    throw new AppError(`${label} is no longer available`, 403);
  }
}
