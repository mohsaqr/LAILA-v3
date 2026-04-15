import apiClient from '../api/client';
import { useAuthStore } from '../store/authStore';

// Activity verbs and object types matching the server schema
export type ActivityVerb =
  | 'enrolled' | 'unenrolled' | 'viewed' | 'started' | 'completed'
  | 'progressed' | 'submitted' | 'unsubmitted' | 'interacted'
  | 'downloaded' | 'selected' | 'designed';

export type ObjectType =
  | 'course' | 'module' | 'lecture' | 'section' | 'video'
  | 'assignment' | 'chatbot' | 'file' | 'quiz' | 'emotional_pulse'
  | 'tutor_agent' | 'tutor_session' | 'tutor_conversation'
  | 'course_tutor' | 'course_tutor_conversation'
  | 'assignment_agent' | 'agent_conversation' | 'lab'
  | 'forum' | 'certificate' | 'survey' | 'gradebook';

export interface LogActivityInput {
  verb: ActivityVerb;
  objectType: ObjectType;
  objectId?: number;
  objectTitle?: string;
  objectSubtype?: string;
  courseId?: number;
  moduleId?: number;
  lectureId?: number;
  sectionId?: number;
  success?: boolean;
  score?: number;
  maxScore?: number;
  progress?: number;
  duration?: number;
  extensions?: Record<string, unknown>;
  /**
   * Fine-grained event subtype, e.g. `agent_design.field.change`,
   * `quiz.answer_changed`, `admin.llm.health_check`. Indexed server-side so
   * this is the primary axis the Activity Logs tab and TNA pipeline can
   * filter on when the 10-verb taxonomy is too coarse.
   */
  actionSubtype?: string;
  /** Client-generated UUID used for server-side idempotent dedupe on retry. */
  eventUuid?: string;
  /** Page route when the event fired, e.g. `/teach/courses/12/agent-assignment/5`. */
  route?: string;
  /**
   * ISO 8601 timestamp captured at queue-push time on the client.
   * The server uses this to set the row's `timestamp` column so batch
   * ordering and parallel Prisma writes can't shuffle the events' true
   * chronological order.
   */
  clientTimestamp?: string;
}

function detectDeviceType(): 'desktop' | 'tablet' | 'mobile' {
  const ua = navigator.userAgent;
  if (ua.includes('iPad') || (ua.includes('Android') && !ua.includes('Mobile'))) {
    return 'tablet';
  }
  if (/iPhone|iPod|Android.*Mobile|webOS|BlackBerry|IEMobile|Opera Mini/i.test(ua)) {
    return 'mobile';
  }
  return 'desktop';
}

function detectBrowserName(): string {
  const ua = navigator.userAgent;
  if (ua.includes('Chrome') && !ua.includes('Edg')) return 'Chrome';
  if (ua.includes('Firefox')) return 'Firefox';
  if (ua.includes('Safari') && !ua.includes('Chrome')) return 'Safari';
  if (ua.includes('Edg')) return 'Edge';
  return 'Unknown';
}

function currentRoute(): string | undefined {
  if (typeof window === 'undefined') return undefined;
  try {
    return window.location.pathname + window.location.search;
  } catch {
    return undefined;
  }
}

function newEventUuid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 12)}-${Math.random().toString(36).slice(2, 12)}`;
}

/**
 * TNA-friendly mapping from a `actionSubtype` prefix to the coarse
 * `(verb, objectType)` pair the 10-verb taxonomy allows. Keeps verb sequences
 * meaningful for the Dashboard TNA pipeline while the fine-grained story
 * lives in actionSubtype + extensions.
 *
 * Extend this table when you add a new domain — keep verbs in the existing
 * 10-item set so existing consumers stay intact.
 */
export const SUBTYPE_VERB_MAP: Record<string, { verb: ActivityVerb; objectType: ObjectType }> = {
  // Agent builder (student AI agent assignment) — every edit the student
  // makes while designing their agent maps here.
  //
  // Conventions (agreed with product):
  //   - design authoring actions (name/title/welcome/avatar/systemPrompt/
  //     personaDescription/temperature/responseStyle field edits,
  //     template/role/personality/suggestion/prompt block picks, rule
  //     add/remove/edit/reorder)                  → 'designed'
  //   - tab switch / tab time / draft save        → 'progressed'
  //   - submission_attempted                      → 'submitted'
  //   - submission_completed                      → 'completed'
  //   - unsubmit click                            → 'unsubmitted'
  //   - session.start / session.end               → 'started' / 'completed'
  //
  // Object type for design events is `assignment_agent` (distinct from the
  // platform's instructor-built `tutor_agent`). Test-conversation events
  // still use `tutor_conversation` because they represent an actual chat.
  'agent_design.session.start':             { verb: 'started',     objectType: 'assignment_agent' },
  'agent_design.session.viewed':            { verb: 'viewed',      objectType: 'assignment_agent' },
  'agent_design.session.end':               { verb: 'completed',   objectType: 'assignment_agent' },
  // session.pause / session.resume / tab.time_recorded are intentionally
  // unmapped — they're blocked by BRIDGE_SKIP_EVENT_TYPES and must never
  // produce a `progressed` row. The only legitimate `progressed` triggers
  // are real tab button clicks and explicit save button clicks below.
  'agent_design.tab.switch':                { verb: 'progressed',  objectType: 'assignment_agent' },
  'agent_design.field.focus':               { verb: 'viewed',      objectType: 'assignment_agent' },
  'agent_design.field.blur':                { verb: 'viewed',      objectType: 'assignment_agent' },
  'agent_design.field.change':              { verb: 'designed',    objectType: 'assignment_agent' },
  'agent_design.field.paste':               { verb: 'designed',    objectType: 'assignment_agent' },
  'agent_design.field.clear':               { verb: 'designed',    objectType: 'assignment_agent' },
  'agent_design.role.selected':             { verb: 'designed',    objectType: 'assignment_agent' },
  'agent_design.template.viewed':           { verb: 'viewed',      objectType: 'assignment_agent' },
  'agent_design.template.applied':          { verb: 'designed',    objectType: 'assignment_agent' },
  'agent_design.template.modified':         { verb: 'designed',    objectType: 'assignment_agent' },
  'agent_design.personality.selected':      { verb: 'designed',    objectType: 'assignment_agent' },
  'agent_design.suggestion.viewed':         { verb: 'viewed',      objectType: 'assignment_agent' },
  'agent_design.suggestion.applied':        { verb: 'designed',    objectType: 'assignment_agent' },
  'agent_design.prompt_block.selected':     { verb: 'designed',    objectType: 'assignment_agent' },
  'agent_design.prompt_block.removed':      { verb: 'designed',    objectType: 'assignment_agent' },
  'agent_design.prompt_block.reordered':    { verb: 'designed',    objectType: 'assignment_agent' },
  'agent_design.prompt_block.custom_added': { verb: 'designed',    objectType: 'assignment_agent' },
  'agent_design.rule.added':                { verb: 'designed',    objectType: 'assignment_agent' },
  'agent_design.rule.removed':              { verb: 'designed',    objectType: 'assignment_agent' },
  'agent_design.rule.edited':               { verb: 'designed',    objectType: 'assignment_agent' },
  'agent_design.rule.reordered':            { verb: 'designed',    objectType: 'assignment_agent' },
  'agent_design.test.conversation_started': { verb: 'started',     objectType: 'agent_conversation' },
  'agent_design.test.message_sent':         { verb: 'interacted',  objectType: 'agent_conversation' },
  'agent_design.test.response_received':    { verb: 'interacted',  objectType: 'agent_conversation' },
  'agent_design.test.conversation_reset':   { verb: 'interacted',  objectType: 'agent_conversation' },
  'agent_design.test.post_test_edit':       { verb: 'designed',    objectType: 'assignment_agent' },
  'agent_design.save.draft':                { verb: 'progressed',  objectType: 'assignment_agent' },
  'agent_design.save.submission_attempted': { verb: 'submitted',   objectType: 'assignment_agent' },
  'agent_design.save.submission_completed': { verb: 'completed',   objectType: 'assignment_agent' },
  'agent_design.save.unsubmit_requested':   { verb: 'unsubmitted', objectType: 'assignment_agent' },
};

export interface TrackOptions {
  actionSubtype: string;
  /** Fallback verb if the subtype isn't in SUBTYPE_VERB_MAP. Defaults to 'interacted'. */
  verb?: ActivityVerb;
  /** Fallback objectType if the subtype isn't in SUBTYPE_VERB_MAP. */
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
  extensions?: Record<string, unknown>;
}

class ActivityLogger {
  private sessionId: string;
  private pendingActivities: LogActivityInput[] = [];
  private flushTimeout: number | null = null;
  private isEnabled = true;
  // Short-window in-memory dedupe: suppresses identical (verb, objectType,
  // objectId, actionSubtype) events fired within DEDUPE_WINDOW_MS. This
  // covers React 18 StrictMode double-invoked effects and any other
  // accidental double-fire; intentional repeat events in real user flows
  // happen seconds apart at minimum, never within this window.
  private recentEventKeys: Map<string, number> = new Map();
  private readonly DEDUPE_WINDOW_MS = 500;

  constructor() {
    this.sessionId = `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;

    // Flush pending activities when page is being closed
    window.addEventListener('beforeunload', () => {
      if (this.pendingActivities.length === 0) return;

      const enrichedActivities = this.pendingActivities.map(a => ({
        ...a,
        sessionId: this.sessionId,
        deviceType: detectDeviceType(),
        browserName: detectBrowserName(),
        route: a.route ?? currentRoute(),
        eventUuid: a.eventUuid ?? newEventUuid(),
      }));

      const baseURL = apiClient.defaults.baseURL || '/api';
      const token = useAuthStore.getState().token;

      // Use fetch with keepalive to survive page unload (sendBeacon can't set auth headers)
      fetch(`${baseURL}/activity-log/batch`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ activities: enrichedActivities }),
        keepalive: true,
      });

      this.pendingActivities = [];
    });
  }

  // Disable logging (e.g., for admin "view as" mode)
  disable() {
    this.isEnabled = false;
  }

  enable() {
    this.isEnabled = true;
  }

  // Queue activity for batch sending
  async log(activity: LogActivityInput): Promise<void> {
    if (!this.isEnabled) return;
    if (this.isDuplicate(activity)) return;

    // Stamp with the client-side wall-clock time RIGHT NOW so the row's
    // eventual `timestamp` column reflects when the user actually did
    // the thing, not when the 3-second batch flushed or which parallel
    // Prisma create finished first on the server.
    this.pendingActivities.push({
      ...activity,
      clientTimestamp: activity.clientTimestamp ?? new Date().toISOString(),
    });
    this.scheduleBatchFlush();
  }

  /**
   * Returns true if an identical event was already queued within the
   * dedupe window. Used to swallow React StrictMode double-invocations
   * and any other accidental double-fire at the source.
   */
  private isDuplicate(activity: LogActivityInput): boolean {
    const key = [
      activity.verb,
      activity.objectType,
      activity.objectId ?? '',
      activity.actionSubtype ?? '',
    ].join('|');
    const now = Date.now();
    const last = this.recentEventKeys.get(key);
    if (last !== undefined && now - last < this.DEDUPE_WINDOW_MS) {
      return true;
    }
    this.recentEventKeys.set(key, now);
    // Keep the map small — prune entries older than 10x the window.
    if (this.recentEventKeys.size > 128) {
      const cutoff = now - this.DEDUPE_WINDOW_MS * 10;
      for (const [k, t] of this.recentEventKeys) {
        if (t < cutoff) this.recentEventKeys.delete(k);
      }
    }
    return false;
  }

  /**
   * Universal fine-grained tracker. Prefer this for all new call sites — it
   * resolves the coarse (verb, objectType) pair automatically from
   * `SUBTYPE_VERB_MAP` so existing TNA consumers keep working, and stores the
   * full detail on `actionSubtype` + `extensions`.
   *
   * Example: `activityLogger.track({ actionSubtype: 'agent_design.field.change',
   *   extensions: { fieldName: 'agentName', previousValue, newValue } })`.
   */
  async track(options: TrackOptions): Promise<void> {
    if (!this.isEnabled) return;

    const mapped = SUBTYPE_VERB_MAP[options.actionSubtype];
    const verb = options.verb ?? mapped?.verb ?? 'interacted';
    const objectType = options.objectType ?? mapped?.objectType ?? 'assignment_agent';

    const activity: LogActivityInput = {
      verb,
      objectType,
      objectId: options.objectId,
      objectTitle: options.objectTitle,
      courseId: options.courseId,
      moduleId: options.moduleId,
      lectureId: options.lectureId,
      sectionId: options.sectionId,
      success: options.success,
      score: options.score,
      maxScore: options.maxScore,
      progress: options.progress,
      duration: options.duration,
      extensions: options.extensions,
      actionSubtype: options.actionSubtype,
    };

    // Route through the same dedupe as log() so bridged events from
    // agentDesignLogger get the same StrictMode-safe double-fire
    // suppression that direct log() callers get.
    if (this.isDuplicate(activity)) return;

    this.pendingActivities.push({
      ...activity,
      clientTimestamp: new Date().toISOString(),
    });
    this.scheduleBatchFlush();
  }

  // Batch log multiple activities
  async logBatch(activities: LogActivityInput[]): Promise<void> {
    if (!this.isEnabled || activities.length === 0) return;

    const enrichedActivities = activities.map(a => ({
      ...a,
      sessionId: this.sessionId,
      deviceType: detectDeviceType(),
      browserName: detectBrowserName(),
      route: a.route ?? currentRoute(),
      eventUuid: a.eventUuid ?? newEventUuid(),
    }));

    try {
      await apiClient.post('/activity-log/batch', { activities: enrichedActivities });
    } catch (error) {
      console.error('[ActivityLogger] Failed to log batch:', error);
    }
  }

  private scheduleBatchFlush() {
    if (this.flushTimeout) return;
    this.flushTimeout = window.setTimeout(() => {
      this.flushPending();
      this.flushTimeout = null;
    }, 3000);
  }

  private async flushPending() {
    if (this.pendingActivities.length === 0) return;
    const activities = [...this.pendingActivities];
    this.pendingActivities = [];
    await this.logBatch(activities);
  }

  // Convenience methods for common activities
  async logCourseEnrolled(courseId: number, courseTitle?: string) {
    return this.log({
      verb: 'enrolled',
      objectType: 'course',
      objectId: courseId,
      objectTitle: courseTitle,
      courseId,
    });
  }

  async logCourseViewed(courseId: number, courseTitle?: string) {
    return this.log({
      verb: 'viewed',
      objectType: 'course',
      objectId: courseId,
      objectTitle: courseTitle,
      courseId,
    });
  }

  async logLectureViewed(lectureId: number, lectureTitle?: string, courseId?: number, moduleId?: number) {
    return this.log({
      verb: 'viewed',
      objectType: 'lecture',
      objectId: lectureId,
      objectTitle: lectureTitle,
      courseId,
      moduleId,
      lectureId,
    });
  }

  async logLectureCompleted(lectureId: number, lectureTitle?: string, courseId?: number, moduleId?: number, progress?: number) {
    return this.log({
      verb: 'completed',
      objectType: 'lecture',
      objectId: lectureId,
      objectTitle: lectureTitle,
      courseId,
      moduleId,
      lectureId,
      progress,
      success: true,
    });
  }

  async logLectureProgressed(lectureId: number, progress: number, courseId?: number, moduleId?: number) {
    return this.log({
      verb: 'progressed',
      objectType: 'lecture',
      objectId: lectureId,
      courseId,
      moduleId,
      lectureId,
      progress,
    });
  }

  async logSectionViewed(sectionId: number, sectionTitle?: string, sectionType?: string, lectureId?: number, courseId?: number, moduleId?: number) {
    return this.log({
      verb: 'viewed',
      objectType: 'section',
      objectId: sectionId,
      objectTitle: sectionTitle,
      objectSubtype: sectionType,
      courseId,
      moduleId,
      lectureId,
      sectionId,
    });
  }

  async logVideoStarted(sectionId: number, lectureId?: number, courseId?: number) {
    return this.log({
      verb: 'started',
      objectType: 'video',
      objectId: sectionId,
      courseId,
      lectureId,
      sectionId,
    });
  }

  async logVideoPaused(sectionId: number, progress?: number, lectureId?: number, courseId?: number) {
    return this.log({
      verb: 'progressed',
      objectType: 'video',
      objectId: sectionId,
      courseId,
      lectureId,
      sectionId,
      progress,
    });
  }

  async logVideoCompleted(sectionId: number, duration?: number, lectureId?: number, courseId?: number) {
    return this.log({
      verb: 'completed',
      objectType: 'video',
      objectId: sectionId,
      courseId,
      lectureId,
      sectionId,
      duration,
      success: true,
    });
  }

  async logAssignmentSubmitted(assignmentId: number, assignmentTitle?: string, courseId?: number) {
    return this.log({
      verb: 'submitted',
      objectType: 'assignment',
      objectId: assignmentId,
      objectTitle: assignmentTitle,
      courseId,
    });
  }

  async logChatbotInteracted(sectionId: number, lectureId?: number, courseId?: number) {
    return this.log({
      verb: 'interacted',
      objectType: 'chatbot',
      objectId: sectionId,
      courseId,
      lectureId,
      sectionId,
    });
  }

  async logChatbotMessage(
    sectionId: number,
    lectureId?: number,
    courseId?: number,
    messageContent?: { userMessage?: string; assistantMessage?: string; aiModel?: string }
  ) {
    return this.log({
      verb: 'interacted',
      objectType: 'chatbot',
      objectId: sectionId,
      courseId,
      lectureId,
      sectionId,
      extensions: messageContent ? {
        userMessage: messageContent.userMessage,
        assistantMessage: messageContent.assistantMessage,
        messageLength: messageContent.userMessage?.length,
        responseLength: messageContent.assistantMessage?.length,
        aiModel: messageContent.aiModel,
      } : undefined,
    });
  }

  async logFileDownloaded(fileId: number, fileName?: string, lectureId?: number, courseId?: number) {
    return this.log({
      verb: 'downloaded',
      objectType: 'file',
      objectId: fileId,
      objectTitle: fileName,
      courseId,
      lectureId,
    });
  }

  async logLabDatasetSelected(labType: string, datasetName: string, courseId: number, extensions?: Record<string, unknown>) {
    return this.log({ verb: 'selected', objectType: 'lab', objectTitle: `${labType}: ${datasetName}`, courseId, extensions });
  }

  async logLabModelBuilt(labType: string, courseId: number, extensions?: Record<string, unknown>) {
    return this.log({ verb: 'interacted', objectType: 'lab', objectTitle: `${labType}: model built`, courseId, extensions });
  }

  async logLabAnalysisViewed(labType: string, analysisKey: string, courseId: number, extensions?: Record<string, unknown>) {
    return this.log({ verb: 'selected', objectType: 'lab', objectTitle: `${labType}: ${analysisKey}`, courseId, extensions });
  }

  async logLabSubmitted(labType: string, assignmentId: number, courseId: number, extensions?: Record<string, unknown>) {
    return this.log({ verb: 'submitted', objectType: 'lab', objectId: assignmentId, objectTitle: `${labType}: submitted`, courseId, extensions });
  }

  async logQuizStarted(quizId: number, quizTitle?: string, courseId?: number) {
    return this.log({ verb: 'started', objectType: 'quiz', objectId: quizId, objectTitle: quizTitle, courseId });
  }

  async logQuizSubmitted(quizId: number, quizTitle?: string, courseId?: number, score?: number, maxScore?: number) {
    return this.log({ verb: 'submitted', objectType: 'quiz', objectId: quizId, objectTitle: quizTitle, courseId, score, maxScore, success: score != null && maxScore != null ? score >= maxScore * 0.5 : undefined });
  }

  async logForumPostCreated(forumId: number, postTitle?: string, courseId?: number, extensions?: Record<string, unknown>) {
    return this.log({ verb: 'interacted', objectType: 'forum', objectId: forumId, objectTitle: postTitle, courseId, extensions });
  }

  async logCertificateViewed(certificateId: number, courseId?: number) {
    return this.log({ verb: 'viewed', objectType: 'certificate', objectId: certificateId, courseId });
  }

  async logCertificateDownloaded(certificateId: number, courseId?: number) {
    return this.log({ verb: 'downloaded', objectType: 'certificate', objectId: certificateId, courseId });
  }

  async logSurveySubmitted(surveyId: number, surveyTitle?: string, courseId?: number, extensions?: Record<string, unknown>) {
    return this.log({ verb: 'submitted', objectType: 'survey', objectId: surveyId, objectTitle: surveyTitle, courseId, extensions });
  }

  async logGradebookViewed(courseId: number) {
    return this.log({ verb: 'viewed', objectType: 'gradebook', courseId });
  }
}

export const activityLogger = new ActivityLogger();
export default activityLogger;
