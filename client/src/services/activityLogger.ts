import apiClient from '../api/client';
import { useAuthStore } from '../store/authStore';

// Activity verbs and object types matching the server schema
export type ActivityVerb =
  | 'enrolled' | 'unenrolled' | 'viewed' | 'started' | 'completed'
  | 'progressed' | 'submitted' | 'unsubmitted' | 'interacted'
  | 'downloaded' | 'selected' | 'designed'
  | 'created' | 'updated' | 'deleted';

export type ObjectType =
  | 'course' | 'module' | 'lecture' | 'section' | 'video'
  | 'assignment' | 'chatbot' | 'file' | 'quiz' | 'emotional_pulse'
  | 'tutor_agent' | 'tutor_session' | 'tutor_conversation'
  | 'course_tutor' | 'course_tutor_conversation'
  | 'assignment_agent' | 'agent_conversation' | 'lab'
  | 'forum' | 'certificate' | 'survey' | 'gradebook'
  | 'dashboard' | 'profile' | 'catalog' | 'analytics'
  | 'settings' | 'calendar' | 'enrollment' | 'curriculum'
  | 'code_lab' | 'ai_tool' | 'prompt_block' | 'user' | 'submission'
  | 'page';

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

  async logDashboardViewed() {
    return this.log({ verb: 'viewed', objectType: 'dashboard', objectTitle: 'Dashboard' });
  }

  async logMyLearningViewed() {
    return this.log({ verb: 'viewed', objectType: 'course', objectTitle: 'My Learning' });
  }

  async logProfileViewed() {
    return this.log({ verb: 'viewed', objectType: 'profile', objectTitle: 'Profile' });
  }

  async logProfileUpdated(extensions?: Record<string, unknown>) {
    return this.log({ verb: 'interacted', objectType: 'profile', objectTitle: 'Profile Updated', extensions });
  }

  async logCatalogSearched(query: string) {
    return this.log({
      verb: 'interacted',
      objectType: 'catalog',
      objectTitle: 'Catalog Search',
      extensions: { searchQuery: query },
    });
  }

  async logCatalogFiltered(extensions: Record<string, unknown>) {
    return this.log({
      verb: 'interacted',
      objectType: 'catalog',
      objectTitle: 'Catalog Filter',
      extensions,
    });
  }

  async logCatalogViewed() {
    return this.log({ verb: 'viewed', objectType: 'catalog', objectTitle: 'Course Catalog' });
  }

  // Settings
  async logSettingsViewed() {
    return this.log({ verb: 'viewed', objectType: 'settings', objectTitle: 'User Settings' });
  }

  async logSettingsUpdated(extensions?: Record<string, unknown>) {
    return this.log({ verb: 'updated', objectType: 'settings', objectTitle: 'User Settings', extensions });
  }

  // Calendar
  async logCalendarViewed() {
    return this.log({ verb: 'viewed', objectType: 'calendar', objectTitle: 'Dashboard Calendar' });
  }

  // Gradebook
  async logDashboardGradebookViewed() {
    return this.log({ verb: 'viewed', objectType: 'gradebook', objectTitle: 'Dashboard Gradebook' });
  }

  // Assignment viewing (not just submission)
  async logAssignmentViewed(assignmentId: number, assignmentTitle?: string, courseId?: number) {
    return this.log({ verb: 'viewed', objectType: 'assignment', objectId: assignmentId, objectTitle: assignmentTitle, courseId });
  }

  // Quiz
  async logQuizViewed(quizId: number, quizTitle?: string, courseId?: number) {
    return this.log({ verb: 'viewed', objectType: 'quiz', objectId: quizId, objectTitle: quizTitle, courseId });
  }

  async logQuizResultsViewed(quizId: number, quizTitle?: string, courseId?: number, extensions?: Record<string, unknown>) {
    return this.log({ verb: 'viewed', objectType: 'quiz', objectId: quizId, objectTitle: quizTitle, courseId, actionSubtype: 'quiz.results_viewed', extensions });
  }

  async logQuizListViewed(courseId?: number) {
    return this.log({ verb: 'viewed', objectType: 'quiz', objectTitle: 'Quiz List', courseId });
  }

  // Forum viewing
  async logForumViewed(forumId: number, forumTitle?: string, courseId?: number) {
    return this.log({ verb: 'viewed', objectType: 'forum', objectId: forumId, objectTitle: forumTitle, courseId });
  }

  async logForumListViewed(courseId?: number) {
    return this.log({ verb: 'viewed', objectType: 'forum', objectTitle: 'Forum List', courseId });
  }

  // Certificate list
  async logCertificateListViewed(courseId?: number) {
    return this.log({ verb: 'viewed', objectType: 'certificate', objectTitle: 'Certificate List', courseId });
  }

  // Code Lab
  async logCodeLabViewed(codeLabId: number, codeLabTitle?: string, courseId?: number) {
    return this.log({ verb: 'viewed', objectType: 'code_lab', objectId: codeLabId, objectTitle: codeLabTitle, courseId });
  }

  async logCodeLabStarted(codeLabId: number, codeLabTitle?: string, courseId?: number) {
    return this.log({ verb: 'started', objectType: 'code_lab', objectId: codeLabId, objectTitle: codeLabTitle, courseId });
  }

  async logCodeLabSubmitted(codeLabId: number, codeLabTitle?: string, courseId?: number, extensions?: Record<string, unknown>) {
    return this.log({ verb: 'submitted', objectType: 'code_lab', objectId: codeLabId, objectTitle: codeLabTitle, courseId, extensions });
  }

  // AI Tutors
  async logAITutorsViewed() {
    return this.log({ verb: 'viewed', objectType: 'tutor_agent', objectTitle: 'AI Tutors' });
  }

  async logTutorAgentSelected(agentId: number, agentTitle?: string, courseId?: number) {
    return this.log({ verb: 'selected', objectType: 'tutor_agent', objectId: agentId, objectTitle: agentTitle, courseId });
  }

  async logTutorSessionStarted(agentId: number, agentTitle?: string, courseId?: number) {
    return this.log({ verb: 'started', objectType: 'tutor_session', objectId: agentId, objectTitle: agentTitle, courseId });
  }

  async logTutorMessage(agentId: number, courseId?: number, extensions?: Record<string, unknown>) {
    return this.log({ verb: 'interacted', objectType: 'tutor_conversation', objectId: agentId, courseId, extensions });
  }

  // Labs
  async logLabsViewed(courseId?: number) {
    return this.log({ verb: 'viewed', objectType: 'lab', objectTitle: 'Labs Catalog', courseId });
  }

  // Content
  async logContentViewed(contentId: number, contentTitle?: string, contentType?: string, courseId?: number) {
    return this.log({ verb: 'viewed', objectType: 'section', objectId: contentId, objectTitle: contentTitle, objectSubtype: contentType, courseId });
  }

  // Agent usage
  async logAgentUsed(agentId: number, agentTitle?: string, courseId?: number) {
    return this.log({ verb: 'interacted', objectType: 'assignment_agent', objectId: agentId, objectTitle: agentTitle, courseId, actionSubtype: 'agent.use' });
  }

  async logAgentTested(agentId: number, agentTitle?: string, courseId?: number) {
    return this.log({ verb: 'interacted', objectType: 'assignment_agent', objectId: agentId, objectTitle: agentTitle, courseId, actionSubtype: 'agent.test' });
  }

  async logAgentDatasetsViewed(agentId: number, courseId?: number) {
    return this.log({ verb: 'viewed', objectType: 'assignment_agent', objectId: agentId, objectTitle: 'Agent Datasets', courseId, actionSubtype: 'agent.datasets_viewed' });
  }

  // Survey
  async logSurveyViewed(surveyId: number, surveyTitle?: string, courseId?: number) {
    return this.log({ verb: 'viewed', objectType: 'survey', objectId: surveyId, objectTitle: surveyTitle, courseId });
  }

  // Assignments list
  async logAssignmentListViewed(courseId: number) {
    return this.log({ verb: 'viewed', objectType: 'assignment', objectTitle: 'Assignment List', courseId });
  }

  // ============ INSTRUCTOR PAGES ============

  // Course management
  async logCourseCreateViewed() {
    return this.log({ verb: 'viewed', objectType: 'course', objectTitle: 'Course Create', actionSubtype: 'course.create_viewed' });
  }

  async logCourseCreated(courseId: number, courseTitle?: string) {
    return this.log({ verb: 'created', objectType: 'course', objectId: courseId, objectTitle: courseTitle, courseId });
  }

  async logCourseEditViewed(courseId: number, courseTitle?: string) {
    return this.log({ verb: 'viewed', objectType: 'course', objectId: courseId, objectTitle: courseTitle, courseId, actionSubtype: 'course.edit_viewed' });
  }

  async logCourseUpdated(courseId: number, courseTitle?: string, extensions?: Record<string, unknown>) {
    return this.log({ verb: 'updated', objectType: 'course', objectId: courseId, objectTitle: courseTitle, courseId, extensions });
  }

  async logCourseDeleted(courseId: number, courseTitle?: string) {
    return this.log({ verb: 'deleted', objectType: 'course', objectId: courseId, objectTitle: courseTitle, courseId });
  }

  // Curriculum
  async logCurriculumViewed(courseId: number, courseTitle?: string) {
    return this.log({ verb: 'viewed', objectType: 'curriculum', objectTitle: courseTitle, courseId });
  }

  async logModuleCreated(moduleId: number, moduleTitle?: string, courseId?: number) {
    return this.log({ verb: 'created', objectType: 'module', objectId: moduleId, objectTitle: moduleTitle, courseId, moduleId });
  }

  async logModuleUpdated(moduleId: number, moduleTitle?: string, courseId?: number) {
    return this.log({ verb: 'updated', objectType: 'module', objectId: moduleId, objectTitle: moduleTitle, courseId, moduleId });
  }

  async logModuleDeleted(moduleId: number, moduleTitle?: string, courseId?: number) {
    return this.log({ verb: 'deleted', objectType: 'module', objectId: moduleId, objectTitle: moduleTitle, courseId });
  }

  async logLectureCreated(lectureId: number, lectureTitle?: string, courseId?: number, moduleId?: number) {
    return this.log({ verb: 'created', objectType: 'lecture', objectId: lectureId, objectTitle: lectureTitle, courseId, moduleId, lectureId });
  }

  async logLectureUpdated(lectureId: number, lectureTitle?: string, courseId?: number, moduleId?: number) {
    return this.log({ verb: 'updated', objectType: 'lecture', objectId: lectureId, objectTitle: lectureTitle, courseId, moduleId, lectureId });
  }

  async logLectureDeleted(lectureId: number, lectureTitle?: string, courseId?: number) {
    return this.log({ verb: 'deleted', objectType: 'lecture', objectId: lectureId, objectTitle: lectureTitle, courseId });
  }

  // Lecture editor
  async logLectureEditorViewed(lectureId: number, lectureTitle?: string, courseId?: number) {
    return this.log({ verb: 'viewed', objectType: 'lecture', objectId: lectureId, objectTitle: lectureTitle, courseId, lectureId, actionSubtype: 'lecture.editor_viewed' });
  }

  // Code Lab editor
  async logCodeLabEditorViewed(codeLabId: number, codeLabTitle?: string, courseId?: number) {
    return this.log({ verb: 'viewed', objectType: 'code_lab', objectId: codeLabId, objectTitle: codeLabTitle, courseId, actionSubtype: 'code_lab.editor_viewed' });
  }

  async logCodeLabCreated(codeLabId: number, codeLabTitle?: string, courseId?: number) {
    return this.log({ verb: 'created', objectType: 'code_lab', objectId: codeLabId, objectTitle: codeLabTitle, courseId });
  }

  async logCodeLabUpdated(codeLabId: number, codeLabTitle?: string, courseId?: number) {
    return this.log({ verb: 'updated', objectType: 'code_lab', objectId: codeLabId, objectTitle: codeLabTitle, courseId });
  }

  // Quiz management
  async logQuizManagerViewed(courseId: number) {
    return this.log({ verb: 'viewed', objectType: 'quiz', objectTitle: 'Quiz Manager', courseId, actionSubtype: 'quiz.manager_viewed' });
  }

  async logQuizCreated(quizId: number, quizTitle?: string, courseId?: number) {
    return this.log({ verb: 'created', objectType: 'quiz', objectId: quizId, objectTitle: quizTitle, courseId });
  }

  async logQuizUpdated(quizId: number, quizTitle?: string, courseId?: number, extensions?: Record<string, unknown>) {
    return this.log({ verb: 'updated', objectType: 'quiz', objectId: quizId, objectTitle: quizTitle, courseId, extensions });
  }

  async logQuizDeleted(quizId: number, quizTitle?: string, courseId?: number) {
    return this.log({ verb: 'deleted', objectType: 'quiz', objectId: quizId, objectTitle: quizTitle, courseId });
  }

  async logQuizEditorViewed(quizId: number, quizTitle?: string, courseId?: number) {
    return this.log({ verb: 'viewed', objectType: 'quiz', objectId: quizId, objectTitle: quizTitle, courseId, actionSubtype: 'quiz.editor_viewed' });
  }

  // Assignment management
  async logAssignmentManagerViewed(courseId: number) {
    return this.log({ verb: 'viewed', objectType: 'assignment', objectTitle: 'Assignment Manager', courseId, actionSubtype: 'assignment.manager_viewed' });
  }

  async logAssignmentCreated(assignmentId: number, assignmentTitle?: string, courseId?: number) {
    return this.log({ verb: 'created', objectType: 'assignment', objectId: assignmentId, objectTitle: assignmentTitle, courseId });
  }

  async logAssignmentUpdated(assignmentId: number, assignmentTitle?: string, courseId?: number, extensions?: Record<string, unknown>) {
    return this.log({ verb: 'updated', objectType: 'assignment', objectId: assignmentId, objectTitle: assignmentTitle, courseId, extensions });
  }

  async logAssignmentDeleted(assignmentId: number, assignmentTitle?: string, courseId?: number) {
    return this.log({ verb: 'deleted', objectType: 'assignment', objectId: assignmentId, objectTitle: assignmentTitle, courseId });
  }

  // Submission review
  async logSubmissionListViewed(assignmentId: number, courseId?: number) {
    return this.log({ verb: 'viewed', objectType: 'submission', objectTitle: 'Submission List', objectId: assignmentId, courseId, actionSubtype: 'submission.list_viewed' });
  }

  async logSubmissionViewed(submissionId: number, courseId?: number, extensions?: Record<string, unknown>) {
    return this.log({ verb: 'viewed', objectType: 'submission', objectId: submissionId, courseId, extensions });
  }

  async logSubmissionGraded(submissionId: number, courseId?: number, score?: number, maxScore?: number) {
    return this.log({ verb: 'interacted', objectType: 'submission', objectId: submissionId, courseId, score, maxScore, actionSubtype: 'submission.graded' });
  }

  // Teacher gradebook
  async logTeacherGradebookViewed(courseId: number) {
    return this.log({ verb: 'viewed', objectType: 'gradebook', objectTitle: 'Teacher Gradebook', courseId, actionSubtype: 'gradebook.teacher_viewed' });
  }

  // Forum management
  async logForumManagerViewed(courseId: number) {
    return this.log({ verb: 'viewed', objectType: 'forum', objectTitle: 'Forum Manager', courseId, actionSubtype: 'forum.manager_viewed' });
  }

  async logForumCreated(forumId: number, forumTitle?: string, courseId?: number) {
    return this.log({ verb: 'created', objectType: 'forum', objectId: forumId, objectTitle: forumTitle, courseId });
  }

  async logForumUpdated(forumId: number, forumTitle?: string, courseId?: number) {
    return this.log({ verb: 'updated', objectType: 'forum', objectId: forumId, objectTitle: forumTitle, courseId });
  }

  async logForumDeleted(forumId: number, forumTitle?: string, courseId?: number) {
    return this.log({ verb: 'deleted', objectType: 'forum', objectId: forumId, objectTitle: forumTitle, courseId });
  }

  // Certificate management
  async logCertificateManagerViewed(courseId?: number) {
    return this.log({ verb: 'viewed', objectType: 'certificate', objectTitle: 'Certificate Manager', courseId, actionSubtype: 'certificate.manager_viewed' });
  }

  async logCertificateCreated(certificateId: number, courseId?: number) {
    return this.log({ verb: 'created', objectType: 'certificate', objectId: certificateId, courseId });
  }

  // Tutor management
  async logTutorManagerViewed(courseId: number) {
    return this.log({ verb: 'viewed', objectType: 'course_tutor', objectTitle: 'Tutor Manager', courseId, actionSubtype: 'tutor.manager_viewed' });
  }

  async logTutorConfigured(tutorId: number, courseId?: number, extensions?: Record<string, unknown>) {
    return this.log({ verb: 'updated', objectType: 'course_tutor', objectId: tutorId, courseId, extensions });
  }

  // Chatbot logs
  async logChatbotLogsViewed(courseId: number) {
    return this.log({ verb: 'viewed', objectType: 'chatbot', objectTitle: 'Chatbot Logs', courseId, actionSubtype: 'chatbot.logs_viewed' });
  }

  // Survey management
  async logSurveyManagerViewed(courseId?: number) {
    return this.log({ verb: 'viewed', objectType: 'survey', objectTitle: 'Survey Manager', courseId, actionSubtype: 'survey.manager_viewed' });
  }

  async logSurveyCreated(surveyId: number, surveyTitle?: string, courseId?: number) {
    return this.log({ verb: 'created', objectType: 'survey', objectId: surveyId, objectTitle: surveyTitle, courseId });
  }

  async logSurveyUpdated(surveyId: number, surveyTitle?: string, courseId?: number) {
    return this.log({ verb: 'updated', objectType: 'survey', objectId: surveyId, objectTitle: surveyTitle, courseId });
  }

  async logSurveyResponsesViewed(surveyId: number, courseId?: number) {
    return this.log({ verb: 'viewed', objectType: 'survey', objectId: surveyId, courseId, actionSubtype: 'survey.responses_viewed' });
  }

  // Lab management
  async logLabManagerViewed() {
    return this.log({ verb: 'viewed', objectType: 'lab', objectTitle: 'Lab Manager', actionSubtype: 'lab.manager_viewed' });
  }

  // Course analytics
  async logCourseAnalyticsViewed(courseId: number) {
    return this.log({ verb: 'viewed', objectType: 'analytics', objectTitle: 'Course Analytics', courseId, actionSubtype: 'analytics.course_viewed' });
  }

  // Course logs
  async logCourseLogsViewed(courseId: number) {
    return this.log({ verb: 'viewed', objectType: 'analytics', objectTitle: 'Course Logs', courseId, actionSubtype: 'analytics.course_logs_viewed' });
  }

  // Agent submission review
  async logAgentSubmissionViewed(submissionId: number, courseId?: number) {
    return this.log({ verb: 'viewed', objectType: 'submission', objectId: submissionId, courseId, actionSubtype: 'submission.agent_viewed' });
  }

  async logConversationReplayViewed(conversationId: number, courseId?: number) {
    return this.log({ verb: 'viewed', objectType: 'agent_conversation', objectId: conversationId, courseId, actionSubtype: 'conversation.replay_viewed' });
  }

  // ============ ADMIN PAGES ============

  async logAdminDashboardViewed() {
    return this.log({ verb: 'viewed', objectType: 'dashboard', objectTitle: 'Admin Dashboard', actionSubtype: 'admin.dashboard_viewed' });
  }

  async logAdminSettingsViewed(extensions?: Record<string, unknown>) {
    return this.log({ verb: 'viewed', objectType: 'settings', objectTitle: 'Admin Settings', actionSubtype: 'admin.settings_viewed', extensions });
  }

  async logAdminSettingsUpdated(extensions?: Record<string, unknown>) {
    return this.log({ verb: 'updated', objectType: 'settings', objectTitle: 'Admin Settings', actionSubtype: 'admin.settings_updated', extensions });
  }

  async logUserManagementViewed() {
    return this.log({ verb: 'viewed', objectType: 'user', objectTitle: 'User Management', actionSubtype: 'admin.users_viewed' });
  }

  async logUserDetailViewed(userId: number, extensions?: Record<string, unknown>) {
    return this.log({ verb: 'viewed', objectType: 'user', objectId: userId, actionSubtype: 'admin.user_detail_viewed', extensions });
  }

  async logUserCreated(userId: number, extensions?: Record<string, unknown>) {
    return this.log({ verb: 'created', objectType: 'user', objectId: userId, extensions });
  }

  async logUserUpdated(userId: number, extensions?: Record<string, unknown>) {
    return this.log({ verb: 'updated', objectType: 'user', objectId: userId, extensions });
  }

  async logUserDeleted(userId: number) {
    return this.log({ verb: 'deleted', objectType: 'user', objectId: userId });
  }

  async logEnrollmentManagementViewed() {
    return this.log({ verb: 'viewed', objectType: 'enrollment', objectTitle: 'Enrollment Management', actionSubtype: 'admin.enrollments_viewed' });
  }

  async logBatchEnrollmentViewed() {
    return this.log({ verb: 'viewed', objectType: 'enrollment', objectTitle: 'Batch Enrollment', actionSubtype: 'admin.batch_enrollment_viewed' });
  }

  async logBatchEnrollmentSubmitted(extensions?: Record<string, unknown>) {
    return this.log({ verb: 'submitted', objectType: 'enrollment', objectTitle: 'Batch Enrollment', extensions, actionSubtype: 'admin.batch_enrollment_submitted' });
  }

  async logAdminLogsViewed(extensions?: Record<string, unknown>) {
    return this.log({ verb: 'viewed', objectType: 'analytics', objectTitle: 'Admin Logs Dashboard', actionSubtype: 'admin.logs_viewed', extensions });
  }

  async logAdminAnalyticsViewed() {
    return this.log({ verb: 'viewed', objectType: 'analytics', objectTitle: 'Admin Analytics', actionSubtype: 'admin.analytics_viewed' });
  }

  async logPromptBlocksViewed() {
    return this.log({ verb: 'viewed', objectType: 'prompt_block', objectTitle: 'Prompt Blocks', actionSubtype: 'admin.prompt_blocks_viewed' });
  }

  async logPromptBlockCreated(blockId: number, blockTitle?: string) {
    return this.log({ verb: 'created', objectType: 'prompt_block', objectId: blockId, objectTitle: blockTitle });
  }

  async logPromptBlockUpdated(blockId: number, blockTitle?: string) {
    return this.log({ verb: 'updated', objectType: 'prompt_block', objectId: blockId, objectTitle: blockTitle });
  }

  async logPromptBlockDeleted(blockId: number, blockTitle?: string) {
    return this.log({ verb: 'deleted', objectType: 'prompt_block', objectId: blockId, objectTitle: blockTitle });
  }

  async logChatbotRegistryViewed() {
    return this.log({ verb: 'viewed', objectType: 'chatbot', objectTitle: 'Chatbot Registry', actionSubtype: 'admin.chatbot_registry_viewed' });
  }

  // ============ AI TOOLS ============

  async logAIToolsViewed() {
    return this.log({ verb: 'viewed', objectType: 'ai_tool', objectTitle: 'AI Tools Hub' });
  }

  async logAIToolViewed(toolName: string, extensions?: Record<string, unknown>) {
    return this.log({ verb: 'viewed', objectType: 'ai_tool', objectTitle: toolName, extensions, actionSubtype: `ai_tool.${toolName.toLowerCase().replace(/\s+/g, '_')}_viewed` });
  }

  async logAIToolInteracted(toolName: string, extensions?: Record<string, unknown>) {
    return this.log({ verb: 'interacted', objectType: 'ai_tool', objectTitle: toolName, extensions, actionSubtype: `ai_tool.${toolName.toLowerCase().replace(/\s+/g, '_')}_interacted` });
  }

  async logAIBuilderViewed() {
    return this.log({ verb: 'viewed', objectType: 'ai_tool', objectTitle: 'AI Builder', actionSubtype: 'ai_tool.builder_viewed' });
  }

  async logAIComponentCreated(componentId: number, componentTitle?: string) {
    return this.log({ verb: 'created', objectType: 'chatbot', objectId: componentId, objectTitle: componentTitle, actionSubtype: 'ai_tool.component_created' });
  }

  async logAIComponentUpdated(componentId: number, componentTitle?: string) {
    return this.log({ verb: 'updated', objectType: 'chatbot', objectId: componentId, objectTitle: componentTitle, actionSubtype: 'ai_tool.component_updated' });
  }

  async logAIComponentDeleted(componentId: number, componentTitle?: string) {
    return this.log({ verb: 'deleted', objectType: 'chatbot', objectId: componentId, objectTitle: componentTitle, actionSubtype: 'ai_tool.component_deleted' });
  }

  // ============ GENERIC TAB/ACTION HELPERS ============

  async logTabSwitched(objectType: ObjectType, tabName: string, objectId?: number, courseId?: number) {
    return this.log({ verb: 'interacted', objectType, objectId, courseId, actionSubtype: `${objectType}.tab_switched`, extensions: { tab: tabName } });
  }

  async logSearchPerformed(objectType: ObjectType, query: string, courseId?: number) {
    return this.log({ verb: 'interacted', objectType, courseId, actionSubtype: `${objectType}.searched`, extensions: { searchQuery: query } });
  }

  async logFilterApplied(objectType: ObjectType, filterType: string, filterValue: string, courseId?: number) {
    return this.log({ verb: 'interacted', objectType, courseId, actionSubtype: `${objectType}.filtered`, extensions: { filterType, filterValue } });
  }

  async logExportRequested(objectType: ObjectType, format: string, courseId?: number) {
    return this.log({ verb: 'downloaded', objectType, courseId, actionSubtype: `${objectType}.exported`, extensions: { format } });
  }
}

export const activityLogger = new ActivityLogger();
export default activityLogger;
