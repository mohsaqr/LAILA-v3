import apiClient from '../api/client';

// Activity verbs and object types matching the server schema
export type ActivityVerb =
  | 'enrolled' | 'unenrolled' | 'viewed' | 'started' | 'completed'
  | 'progressed' | 'paused' | 'resumed' | 'seeked' | 'scrolled'
  | 'downloaded' | 'submitted' | 'graded' | 'messaged' | 'received'
  | 'cleared' | 'interacted' | 'expressed' | 'selected' | 'switched';

export type ObjectType =
  | 'course' | 'module' | 'lecture' | 'section' | 'video'
  | 'assignment' | 'chatbot' | 'file' | 'quiz' | 'emotional_pulse'
  | 'tutor_agent' | 'tutor_session' | 'tutor_conversation';

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
  }

  // Disable logging (e.g., for admin "view as" mode)
  disable() {
    this.isEnabled = false;
  }

  enable() {
    this.isEnabled = true;
  }

  // Log a single activity
  async log(activity: LogActivityInput): Promise<void> {
    if (!this.isEnabled) return;

    // Always log activity events for debugging
    console.log('[ActivityLogger] Sending activity:', activity.verb, activity.objectType, {
      objectId: activity.objectId,
      courseId: activity.courseId,
      hasExtensions: !!activity.extensions,
    });

    try {
      await apiClient.post('/activity-log', {
        ...activity,
        sessionId: this.sessionId,
        deviceType: detectDeviceType(),
        browserName: detectBrowserName(),
      });
      console.log('[ActivityLogger] Activity logged successfully:', activity.verb, activity.objectType);
    } catch (error) {
      console.error('[ActivityLogger] Failed to log activity:', error);
      // Queue for batch send
      this.pendingActivities.push(activity);
      this.scheduleBatchFlush();
    }
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
    }, 5000);
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
      verb: 'paused',
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
    console.log('[ActivityLogger] logChatbotMessage called:', {
      sectionId,
      lectureId,
      courseId,
      hasUserMessage: !!messageContent?.userMessage,
      hasAssistantMessage: !!messageContent?.assistantMessage,
    });

    return this.log({
      verb: 'messaged',
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
}

export const activityLogger = new ActivityLogger();
export default activityLogger;
