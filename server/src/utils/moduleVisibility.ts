import { availabilityWindowWhere } from './availability.js';

/**
 * Visibility filters for course modules, including subsections.
 *
 * A subsection is a CourseModule with a `parentId`. It is served in the same
 * flat `modules` array as everything else — only the renderers group by parent
 * — so a subsection whose parent is hidden would otherwise still be sent to the
 * student. These fragments close that: a subsection is never more visible than
 * the section that contains it.
 *
 * Top-level modules (`parentId: null`) are unaffected by both helpers.
 */

/**
 * Prisma `where` fragment: keep top-level modules, and subsections whose parent
 * is published. Contributes an `OR` key, so it composes with
 * `availabilityWindowWhere()` (which contributes `AND`):
 *
 *   where: { isPublished: true, ...availabilityWindowWhere(), ...parentPublishedWhere() }
 */
export function parentPublishedWhere() {
  return {
    OR: [
      { parentId: null },
      { parent: { isPublished: true } },
    ],
  };
}

/**
 * The full student-facing module filter: published, inside its availability
 * window, and not stranded under a parent that is hidden or not yet open.
 *
 * The parent's own window is checked too — a subsection of a section scheduled
 * for next week should not appear this week.
 */
export function studentVisibleModuleWhere(now: Date = new Date()) {
  return {
    isPublished: true,
    ...availabilityWindowWhere(now),
    OR: [
      { parentId: null },
      { parent: { isPublished: true, ...availabilityWindowWhere(now) } },
    ],
  };
}
