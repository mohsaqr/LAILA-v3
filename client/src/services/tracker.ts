/**
 * Unified tracker facade.
 *
 * Thin wrapper around `activityLogger.track()` that gives call sites a
 * declarative API with an implicit `area` prefix. Use this for every new
 * instrumentation site so events land in `LearningActivityLog` with a
 * consistent `actionSubtype` dotted namespace.
 *
 * Existing callers of `activityLogger.log*()` and `analytics.track*()` keep
 * working unchanged — this module is additive.
 *
 * Example:
 *   // in a component:
 *   const track = useTracker('quiz');
 *   track('question_answered', { questionId, previousLen, newLen });
 *
 *   // or call directly:
 *   trackEvent('admin.llm.health_check', { providerId });
 */

import { useCallback, useMemo } from 'react';
import activityLogger, {
  type TrackOptions,
  type ActivityVerb,
  type ObjectType,
} from './activityLogger';

export interface TrackEventDetails {
  verb?: ActivityVerb;
  objectType?: ObjectType;
  objectId?: number;
  objectTitle?: string;
  courseId?: number;
  moduleId?: number;
  lectureId?: number;
  sectionId?: number;
  success?: boolean;
  score?: number;
  maxScore?: number;
  progress?: number;
  duration?: number;
  /**
   * Arbitrary structured payload. Stored as JSON on the server in the
   * `extensions` column so it's searchable/extractable later without a
   * schema migration.
   */
  payload?: Record<string, unknown>;
}

/**
 * Emit a single activity log row with a fully-qualified dotted subtype.
 * The `(verb, objectType)` pair is resolved from
 * `activityLogger.SUBTYPE_VERB_MAP` when possible so the 10-verb TNA
 * pipeline keeps working; pass explicit `verb` / `objectType` to override.
 */
export function trackEvent(
  actionSubtype: string,
  details: TrackEventDetails = {}
): void {
  const options: TrackOptions = {
    actionSubtype,
    verb: details.verb,
    objectType: details.objectType,
    objectId: details.objectId,
    objectTitle: details.objectTitle,
    courseId: details.courseId,
    moduleId: details.moduleId,
    lectureId: details.lectureId,
    sectionId: details.sectionId,
    success: details.success,
    score: details.score,
    maxScore: details.maxScore,
    progress: details.progress,
    duration: details.duration,
    extensions: details.payload,
  };
  void activityLogger.track(options);
}

/**
 * React hook that binds an area prefix. All events fired through the
 * returned function are prefixed with `${area}.`, so a component doesn't
 * repeat its namespace.
 *
 *   const track = useTracker('admin.logs');
 *   track('tab_switched', { payload: { from, to } });
 *   // → actionSubtype = 'admin.logs.tab_switched'
 */
export function useTracker(area: string) {
  return useCallback(
    (event: string, details?: TrackEventDetails) => {
      const subtype = event.includes('.') ? event : `${area}.${event}`;
      trackEvent(subtype, details);
    },
    [area]
  );
}

/**
 * Non-hook binding — useful in non-component modules (services, stores).
 */
export function boundTracker(area: string) {
  return (event: string, details?: TrackEventDetails) => {
    const subtype = event.includes('.') ? event : `${area}.${event}`;
    trackEvent(subtype, details);
  };
}

/** Memoised identity-stable wrapper used internally by useTracker. */
export function useTrackerMemo(area: string) {
  return useMemo(() => boundTracker(area), [area]);
}
