import apiClient from '../api/client';
import { useAuthStore } from '../store/authStore';

// Activity verbs and object types matching the server schema
export type ActivityVerb =
  | 'enrolled' | 'unenrolled' | 'viewed' | 'started' | 'completed'
  | 'progressed' | 'submitted' | 'interacted' | 'downloaded' | 'selected';

export type ObjectType =
  | 'course' | 'module' | 'lecture' | 'section' | 'video'
  | 'assignment' | 'chatbot' | 'file' | 'quiz' | 'emotional_pulse'
  | 'tutor_agent' | 'tutor_session' | 'tutor_conversation'
  | 'course_tutor' | 'course_tutor_conversation' | 'lab'
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

class ActivityLogger {
  private sessionId: string;
  private pendingActivities: LogActivityInput[] = [];
  private flushTimeout: number | null = null;
  private isEnabled = true;

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

    this.pendingActivities.push(activity);
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

  async logLectureStarted(lectureId: number, lectureTitle?: string, courseId?: number, moduleId?: number) {
    return this.log({
      verb: 'started',
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
