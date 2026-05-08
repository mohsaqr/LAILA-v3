import type { CourseFormData } from '../CourseForm';

export type StepId = 'setting' | 'content' | 'tutors' | 'team' | 'publish';

export const STEP_ORDER: StepId[] = ['setting', 'content', 'tutors', 'team', 'publish'];

export interface WizardCtx {
  /** Course id once the draft is saved; null on the create page. */
  courseId: number | null;
  /** Current modules-with-lectures count (1 module + 1 lecture is the minimum to publish). */
  modulesCount: number;
  publishedLecturesCount: number;
}

/**
 * Returns the set of step ids the user can currently navigate to.
 * Gating progresses left-to-right; later steps unlock as their
 * preconditions are satisfied.
 */
export const computeUnlockedSteps = (ctx: WizardCtx): Set<StepId> => {
  // Setting is always reachable. Once the draft has been saved (courseId
  // exists), every other step is freely navigable — the instructor can
  // skip ahead, come back, and revisit in any order. The Publish step
  // shows its own blockers if the course isn't ready yet.
  const unlocked = new Set<StepId>(['setting']);
  if (ctx.courseId != null) {
    unlocked.add('content');
    unlocked.add('tutors');
    unlocked.add('team');
    unlocked.add('publish');
  }
  return unlocked;
};

export interface ValidationResult {
  valid: boolean;
  errors: Record<string, string>;
}

/**
 * Mirrors the server-side rules for a course draft. Runs before
 * createCourse / updateCourse is fired so the user sees the error
 * inline instead of a generic toast.
 */
export const validateSetting = (data: CourseFormData): ValidationResult => {
  const errors: Record<string, string> = {};
  const title = data.title.trim();
  if (title.length === 0) {
    errors.title = 'title_required';
  } else if (title.length < 3) {
    errors.title = 'title_min_length';
  } else if (title.length > 200) {
    errors.title = 'title_max_length';
  }
  if (data.categoryIds.length === 0) {
    errors.categoryIds = 'category_required';
  }
  if (!data.difficulty) {
    errors.difficulty = 'difficulty_required';
  }
  return { valid: Object.keys(errors).length === 0, errors };
};

export interface PublishCheck {
  blockers: string[];
  warnings: string[];
}

export const validatePublish = (
  ctx: WizardCtx,
  teamMembersCount: number,
  isPublic: boolean,
): PublishCheck => {
  const blockers: string[] = [];
  const warnings: string[] = [];
  if (ctx.modulesCount < 1) {
    blockers.push('publish_blocker_no_module');
  }
  if (ctx.publishedLecturesCount < 1) {
    blockers.push('publish_blocker_no_lecture');
  }
  if (teamMembersCount === 0) {
    warnings.push('publish_warning_no_team');
  }
  if (!isPublic) {
    warnings.push('publish_warning_private');
  }
  return { blockers, warnings };
};
