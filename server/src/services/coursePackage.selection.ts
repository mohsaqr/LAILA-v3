/**
 * What an export carries.
 *
 * Before this, an export was one fixed shape: the course design, never any
 * student data. That answered "give me this course to reuse" and nothing else.
 * A selection turns the export into a question the exporter answers — reuse a
 * course, archive a finished cohort, hand a colleague the quizzes, take the
 * data to a statistics package.
 *
 * ## Sections
 *
 * Each section is independent and separately consented to. They divide on the
 * line that actually matters, which is **whose data it is**:
 *
 *   - `design` … `plugins` describe what an instructor *authored*. Exporting
 *     them is moving your own work.
 *   - `enrollments` … `activity` describe what *students did*. Exporting them
 *     is a disclosure of other people's personal data, so they are opt-in,
 *     require course-admin rights, and are recorded in the manifest.
 *
 * `design` is not optional: a package of submissions with no idea what was
 * submitted to is not something anyone can use or import.
 *
 * ## Why the manifest records the selection
 *
 * A `.laila.zip` on someone's laptop is anonymous about its own contents.
 * Writing the selection into the manifest means the importer can say exactly
 * what it is about to add before it adds it, and an admin looking at an old
 * archive can tell whether it holds personal data without unpacking it.
 */

import { z } from 'zod';

/** Everything that can travel, in the order the UI shows it. */
export const EXPORT_SECTIONS = [
  /** Course settings, modules, lectures, sections. Always included. */
  'design',
  /** Assignments, quizzes, surveys, rubrics — the graded structure. */
  'assessments',
  /** Code labs, custom labs and their cells. */
  'labs',
  /** Course tutors and the chatbot definitions behind them. */
  'tutors',
  /** Forum settings and staff-opened threads. */
  'forums',
  /** Uploaded files everything above refers to. */
  'files',
  /** Installed plugins' configuration for this course, and their block data. */
  'plugins',
  // --- below this line: other people's data -------------------------------
  /** Who is enrolled, with their role and enrollment date. */
  'enrollments',
  /** Assignment submissions and their attachments. */
  'submissions',
  /** Grades, quiz attempts and survey responses. */
  'grades',
  /** Per-student lecture and module completion. */
  'progress',
  /** Student-opened forum threads and every reply. */
  'discussions',
  /** Tutor and chatbot conversation transcripts. */
  'conversations',
  /** The learning activity log for this course. */
  'activity',
] as const;

export type ExportSection = (typeof EXPORT_SECTIONS)[number];

/**
 * Sections that disclose data belonging to someone other than the exporter.
 *
 * Kept as data rather than a naming convention so the UI, the permission check
 * and the manifest all read the same list, and adding a section forces a
 * decision about which side of the line it falls on.
 */
export const PERSONAL_DATA_SECTIONS: readonly ExportSection[] = [
  'enrollments',
  'submissions',
  'grades',
  'progress',
  'discussions',
  'conversations',
  'activity',
] as const;

/** The design-only default: what every export did before selections existed. */
export const DESIGN_SECTIONS: readonly ExportSection[] = [
  'design',
  'assessments',
  'labs',
  'tutors',
  'forums',
  'files',
  'plugins',
] as const;

export const exportSectionSchema = z.enum(EXPORT_SECTIONS);

/**
 * A selection, as it arrives from a client and as it is stored in a manifest.
 *
 * `design` is forced on rather than rejected when missing: a caller asking for
 * "just the submissions" wants a usable package, and an error would only teach
 * them to tick a box they had no reason to think about.
 */
export const exportSelectionSchema = z
  .array(exportSectionSchema)
  .max(EXPORT_SECTIONS.length)
  .transform((sections) => {
    const set = new Set<ExportSection>(sections);
    set.add('design');
    // Submissions and discussions carry attachments; a package promising them
    // without the blobs would import as a wall of broken links.
    if (set.has('submissions') || set.has('discussions')) set.add('files');
    // Return in canonical order so two equal selections serialise identically
    // and a manifest diff is meaningful.
    return EXPORT_SECTIONS.filter((s) => set.has(s));
  });

export type ExportSelection = ExportSection[];

/** Does this selection disclose anyone else's data? */
export const includesPersonalData = (selection: readonly ExportSection[]): boolean =>
  selection.some((s) => PERSONAL_DATA_SECTIONS.includes(s));

/** The personal-data sections in a selection, for the confirmation prompt. */
export const personalDataIn = (selection: readonly ExportSection[]): ExportSection[] =>
  selection.filter((s) => PERSONAL_DATA_SECTIONS.includes(s));

/**
 * Parse a selection from a query string or a JSON body.
 *
 * Accepts `?include=design,grades`, a repeated `?include=` parameter, or an
 * array in a body. An absent selection means the design-only default, which
 * keeps every existing caller — and every existing link — working unchanged.
 */
export function parseSelection(raw: unknown): ExportSelection {
  if (raw === undefined || raw === null || raw === '') return [...DESIGN_SECTIONS];
  const list = Array.isArray(raw)
    ? raw.flatMap((r) => String(r).split(','))
    : String(raw).split(',');
  const cleaned = list.map((s) => s.trim()).filter(Boolean);
  if (!cleaned.length) return [...DESIGN_SECTIONS];
  if (cleaned.length === 1 && cleaned[0] === 'all') return [...EXPORT_SECTIONS];
  return exportSelectionSchema.parse(cleaned);
}

/** A human-readable one-liner for a log or a confirmation dialog. */
export function describeSelection(selection: readonly ExportSection[]): string {
  const personal = personalDataIn(selection);
  if (!personal.length) return `${selection.length} section(s), design only`;
  return `${selection.length} section(s), including personal data: ${personal.join(', ')}`;
}
