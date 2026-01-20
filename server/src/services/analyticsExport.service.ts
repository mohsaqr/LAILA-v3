import { stringify } from 'csv-stringify/sync';
import ExcelJS from 'exceljs';
import archiver from 'archiver';
import { Readable } from 'stream';
import prisma from '../utils/prisma.js';

// ============================================================================
// INTERFACES
// ============================================================================

export interface ExportFilters {
  startDate?: Date;
  endDate?: Date;
  courseId?: number;
  userId?: number;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function formatTimestamp(date: Date | null | undefined): string {
  if (!date) return '';
  return date.toISOString();
}

function formatTimestampReadable(date: Date | null | undefined): string {
  if (!date) return '';
  return date.toLocaleString('en-US', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
}

// ============================================================================
// ANALYTICS EXPORT SERVICE
// ============================================================================

export class AnalyticsExportService {
  /**
   * Export chatbot interaction logs to CSV with FULL context
   */
  async exportChatbotLogsCSV(filters: ExportFilters = {}): Promise<string> {
    const where: Record<string, unknown> = {};
    if (filters.startDate || filters.endDate) {
      where.timestamp = {};
      if (filters.startDate) (where.timestamp as Record<string, unknown>).gte = filters.startDate;
      if (filters.endDate) (where.timestamp as Record<string, unknown>).lte = filters.endDate;
    }
    if (filters.courseId) where.courseId = filters.courseId;
    if (filters.userId) where.userId = filters.userId;

    // Fetch logs with related section data for type info
    const logs = await prisma.chatbotInteractionLog.findMany({
      where,
      orderBy: { timestamp: 'desc' },
      include: {
        section: {
          select: {
            id: true,
            title: true,
            type: true,
            order: true,
            lecture: {
              select: {
                id: true,
                title: true,
                contentType: true,
                orderIndex: true,
                module: {
                  select: {
                    id: true,
                    title: true,
                    orderIndex: true,
                    course: {
                      select: {
                        id: true,
                        title: true,
                        slug: true,
                        category: true,
                        difficulty: true,
                        instructor: {
                          select: {
                            id: true,
                            fullname: true,
                            email: true,
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    const data = logs.map(log => {
      // Use live data from relations as fallback for snapshots
      const section = log.section;
      const lecture = section?.lecture;
      const module = lecture?.module;
      const course = module?.course;
      const instructor = course?.instructor;

      return {
        // === IDs ===
        id: log.id,

        // === TIMING ===
        timestamp: formatTimestamp(log.timestamp),
        timestamp_readable: formatTimestampReadable(log.timestamp),
        timestamp_ms: log.timestampMs?.toString() || '',
        session_id: log.sessionId || '',
        session_start_time: formatTimestamp(log.sessionStartTime),
        session_duration_seconds: log.sessionDuration || '',
        event_sequence: log.eventSequence || '',

        // === USER CONTEXT ===
        user_id: log.userId || '',
        user_fullname: log.userFullname || '',
        user_email: log.userEmail || '',

        // === COURSE CONTEXT ===
        course_id: log.courseId || course?.id || '',
        course_title: log.courseTitle || course?.title || '',
        course_slug: log.courseSlug || course?.slug || '',
        course_category: course?.category || '',
        course_difficulty: course?.difficulty || '',
        instructor_id: instructor?.id || '',
        instructor_name: instructor?.fullname || '',
        instructor_email: instructor?.email || '',

        // === MODULE CONTEXT ===
        module_id: log.moduleId || module?.id || '',
        module_title: log.moduleTitle || module?.title || '',
        module_order_index: log.moduleOrderIndex ?? module?.orderIndex ?? '',

        // === LECTURE CONTEXT ===
        lecture_id: log.lectureId || lecture?.id || '',
        lecture_title: log.lectureTitle || lecture?.title || '',
        lecture_content_type: lecture?.contentType || '',
        lecture_order_index: log.lectureOrderIndex ?? lecture?.orderIndex ?? '',

        // === SECTION CONTEXT ===
        section_id: log.sectionId,
        section_title: section?.title || '',
        section_type: section?.type || 'chatbot',
        section_order_index: log.sectionOrderIndex ?? section?.order ?? '',

        // === CHATBOT CONFIG (SNAPSHOT) ===
        chatbot_title: log.chatbotTitle || '',
        chatbot_intro: log.chatbotIntro || '',
        chatbot_system_prompt: log.chatbotSystemPrompt || '',
        chatbot_welcome_message: log.chatbotWelcomeMessage || '',
        chatbot_image_url: log.chatbotImageUrl || '',

        // === CONVERSATION CONTEXT ===
        conversation_id: log.conversationId || '',
        message_index: log.messageIndex || '',
        conversation_message_count: log.conversationMessageCount || '',
        event_type: log.eventType,

        // === MESSAGE CONTENT ===
        message_content: log.messageContent || '',
        message_char_count: log.messageCharCount || '',
        message_word_count: log.messageWordCount || '',

        // === RESPONSE CONTENT ===
        response_content: log.responseContent || '',
        response_char_count: log.responseCharCount || '',
        response_word_count: log.responseWordCount || '',

        // === AI METRICS ===
        response_time_seconds: log.responseTime || '',
        ai_model: log.aiModel || '',
        ai_provider: log.aiProvider || '',
        prompt_tokens: log.promptTokens || '',
        completion_tokens: log.completionTokens || '',
        total_tokens: log.totalTokens || '',

        // === ERROR INFO ===
        error_message: log.errorMessage || '',
        error_code: log.errorCode || '',

        // === CLIENT CONTEXT ===
        ip_address: log.ipAddress || '',
        user_agent: log.userAgent || '',
        device_type: log.deviceType || '',
        browser_name: log.browserName || '',
        browser_version: log.browserVersion || '',
        os_name: log.osName || '',
        os_version: log.osVersion || '',
        screen_width: log.screenWidth || '',
        screen_height: log.screenHeight || '',
        language: log.language || '',
        timezone: log.timezone || '',
      };
    });

    return stringify(data, { header: true });
  }

  /**
   * Export user interaction logs to CSV with FULL context
   */
  async exportUserInteractionsCSV(filters: ExportFilters = {}): Promise<string> {
    const where: Record<string, unknown> = {};
    if (filters.startDate || filters.endDate) {
      where.timestamp = {};
      if (filters.startDate) (where.timestamp as Record<string, unknown>).gte = filters.startDate;
      if (filters.endDate) (where.timestamp as Record<string, unknown>).lte = filters.endDate;
    }
    if (filters.courseId) where.courseId = filters.courseId;
    if (filters.userId) where.userId = filters.userId;

    const logs = await prisma.userInteractionLog.findMany({
      where,
      orderBy: { timestamp: 'desc' },
    });

    // Fetch course info for additional context
    const courseIds = [...new Set(logs.map(l => l.courseId).filter(Boolean))] as number[];
    const courses = courseIds.length > 0 ? await prisma.course.findMany({
      where: { id: { in: courseIds } },
      select: {
        id: true,
        title: true,
        slug: true,
        category: true,
        difficulty: true,
        instructor: {
          select: { id: true, fullname: true, email: true },
        },
      },
    }) : [];
    const courseMap = new Map(courses.map(c => [c.id, c]));

    // Fetch lecture info for content type
    const lectureIds = [...new Set(logs.map(l => l.lectureId).filter(Boolean))] as number[];
    const lectures = lectureIds.length > 0 ? await prisma.lecture.findMany({
      where: { id: { in: lectureIds } },
      select: { id: true, contentType: true, orderIndex: true },
    }) : [];
    const lectureMap = new Map(lectures.map(l => [l.id, l]));

    // Fetch module info for order
    const moduleIds = [...new Set(logs.map(l => l.moduleId).filter(Boolean))] as number[];
    const modules = moduleIds.length > 0 ? await prisma.courseModule.findMany({
      where: { id: { in: moduleIds } },
      select: { id: true, orderIndex: true },
    }) : [];
    const moduleMap = new Map(modules.map(m => [m.id, m]));

    const data = logs.map(log => {
      const course = log.courseId ? courseMap.get(log.courseId) : null;
      const lecture = log.lectureId ? lectureMap.get(log.lectureId) : null;
      const module = log.moduleId ? moduleMap.get(log.moduleId) : null;

      return {
        // === IDs ===
        id: log.id,

        // === TIMING ===
        timestamp: formatTimestamp(log.timestamp),
        timestamp_readable: formatTimestampReadable(log.timestamp),
        timestamp_ms: log.timestampMs?.toString() || '',
        session_id: log.sessionId || '',
        session_start_time: formatTimestamp(log.sessionStartTime),
        session_duration_seconds: log.sessionDuration || '',
        time_on_page_seconds: log.timeOnPage || '',
        event_sequence: log.eventSequence || '',

        // === USER CONTEXT ===
        user_id: log.userId || '',
        user_fullname: log.userFullname || '',
        user_email: log.userEmail || '',

        // === COURSE CONTEXT ===
        course_id: log.courseId || '',
        course_title: log.courseTitle || course?.title || '',
        course_slug: course?.slug || '',
        course_category: course?.category || '',
        course_difficulty: course?.difficulty || '',
        instructor_id: course?.instructor?.id || '',
        instructor_name: course?.instructor?.fullname || '',

        // === MODULE CONTEXT ===
        module_id: log.moduleId || '',
        module_title: log.moduleTitle || '',
        module_order_index: module?.orderIndex ?? '',

        // === LECTURE CONTEXT ===
        lecture_id: log.lectureId || '',
        lecture_title: log.lectureTitle || '',
        lecture_content_type: lecture?.contentType || '',
        lecture_order_index: lecture?.orderIndex ?? '',

        // === SECTION CONTEXT ===
        section_id: (log as any).sectionId || '',
        section_title: (log as any).sectionTitle || '',
        section_type: (log as any).sectionType || '',

        // === PAGE CONTEXT ===
        page_url: log.pageUrl || '',
        page_path: log.pagePath || '',
        page_title: log.pageTitle || '',
        referrer_url: log.referrerUrl || '',

        // === EVENT DETAILS ===
        event_type: log.eventType,
        event_category: log.eventCategory || '',
        event_action: log.eventAction || '',
        event_label: log.eventLabel || '',
        event_value: log.eventValue || '',

        // === ELEMENT DETAILS ===
        element_id: log.elementId || '',
        element_type: log.elementType || '',
        element_text: log.elementText || '',
        element_href: log.elementHref || '',
        element_classes: log.elementClasses || '',
        element_name: log.elementName || '',
        element_value: log.elementValue || '',

        // === SCROLL/VIEWPORT ===
        scroll_depth_percent: log.scrollDepth || '',
        viewport_width: log.viewportWidth || '',
        viewport_height: log.viewportHeight || '',

        // === CLIENT CONTEXT ===
        ip_address: log.ipAddress || '',
        user_agent: log.userAgent || '',
        device_type: log.deviceType || '',
        browser_name: log.browserName || '',
        browser_version: log.browserVersion || '',
        os_name: log.osName || '',
        os_version: log.osVersion || '',
        screen_width: log.screenWidth || '',
        screen_height: log.screenHeight || '',
        language: log.language || '',
        timezone: log.timezone || '',

        // === ADDITIONAL DATA ===
        metadata: log.metadata || '',
      };
    });

    return stringify(data, { header: true });
  }

  /**
   * Export authentication logs to CSV
   */
  async exportAuthLogsCSV(filters: ExportFilters = {}): Promise<string> {
    const where: Record<string, unknown> = {};
    if (filters.startDate || filters.endDate) {
      where.timestamp = {};
      if (filters.startDate) (where.timestamp as Record<string, unknown>).gte = filters.startDate;
      if (filters.endDate) (where.timestamp as Record<string, unknown>).lte = filters.endDate;
    }
    if (filters.userId) where.userId = filters.userId;

    const logs = await prisma.authEventLog.findMany({
      where,
      orderBy: { timestamp: 'desc' },
    });

    const data = logs.map(log => ({
      id: log.id,
      timestamp: formatTimestamp(log.timestamp),
      timestamp_iso: formatTimestampReadable(log.timestamp),
      user_id: log.userId || '',
      user_fullname: log.userFullname || '',
      user_email: log.userEmail,
      event_type: log.eventType,
      session_id: log.sessionId || '',
      session_duration_seconds: log.sessionDuration || '',
      failure_reason: log.failureReason || '',
      attempt_count: log.attemptCount || '',
      ip_address: log.ipAddress || '',
      device_type: log.deviceType || '',
      browser_name: log.browserName || '',
      browser_version: log.browserVersion || '',
      os_name: log.osName || '',
      os_version: log.osVersion || '',
    }));

    return stringify(data, { header: true });
  }

  /**
   * Export system events to CSV
   */
  async exportSystemEventsCSV(filters: ExportFilters = {}): Promise<string> {
    const where: Record<string, unknown> = {};
    if (filters.startDate || filters.endDate) {
      where.timestamp = {};
      if (filters.startDate) (where.timestamp as Record<string, unknown>).gte = filters.startDate;
      if (filters.endDate) (where.timestamp as Record<string, unknown>).lte = filters.endDate;
    }
    if (filters.courseId) where.courseId = filters.courseId;

    const logs = await prisma.systemEventLog.findMany({
      where,
      orderBy: { timestamp: 'desc' },
    });

    const data = logs.map(log => ({
      id: log.id,
      timestamp: formatTimestamp(log.timestamp),
      timestamp_iso: formatTimestampReadable(log.timestamp),
      actor_id: log.actorId || '',
      actor_fullname: log.actorFullname || '',
      actor_email: log.actorEmail || '',
      actor_role: log.actorRole || '',
      event_type: log.eventType,
      event_category: log.eventCategory,
      change_type: log.changeType || '',
      target_type: log.targetType || '',
      target_id: log.targetId || '',
      target_title: log.targetTitle || '',
      course_id: log.courseId || '',
      course_title: log.courseTitle || '',
      target_user_id: log.targetUserId || '',
      target_user_fullname: log.targetUserFullname || '',
      target_user_email: log.targetUserEmail || '',
      previous_values: log.previousValues || '',
      new_values: log.newValues || '',
      ip_address: log.ipAddress || '',
    }));

    return stringify(data, { header: true });
  }

  /**
   * Export assessment logs to CSV
   */
  async exportAssessmentLogsCSV(filters: ExportFilters = {}): Promise<string> {
    const where: Record<string, unknown> = {};
    if (filters.startDate || filters.endDate) {
      where.timestamp = {};
      if (filters.startDate) (where.timestamp as Record<string, unknown>).gte = filters.startDate;
      if (filters.endDate) (where.timestamp as Record<string, unknown>).lte = filters.endDate;
    }
    if (filters.courseId) where.courseId = filters.courseId;
    if (filters.userId) where.userId = filters.userId;

    const logs = await prisma.assessmentEventLog.findMany({
      where,
      orderBy: { timestamp: 'desc' },
    });

    const data = logs.map(log => ({
      id: log.id,
      timestamp: formatTimestamp(log.timestamp),
      timestamp_iso: formatTimestampReadable(log.timestamp),
      session_id: log.sessionId || '',
      user_id: log.userId || '',
      user_fullname: log.userFullname || '',
      user_email: log.userEmail || '',
      course_id: log.courseId || '',
      course_title: log.courseTitle || '',
      assignment_id: log.assignmentId || '',
      assignment_title: log.assignmentTitle || '',
      submission_id: log.submissionId || '',
      event_type: log.eventType,
      grade: log.grade ?? '',
      max_points: log.maxPoints ?? '',
      previous_grade: log.previousGrade ?? '',
      attempt_number: log.attemptNumber || '',
      time_spent_seconds: log.timeSpentSeconds || '',
      feedback_length: log.feedbackLength || '',
      ip_address: log.ipAddress || '',
      device_type: log.deviceType || '',
      browser_name: log.browserName || '',
    }));

    return stringify(data, { header: true });
  }

  /**
   * Export content events to CSV
   */
  async exportContentEventsCSV(filters: ExportFilters = {}): Promise<string> {
    const where: Record<string, unknown> = {};
    if (filters.startDate || filters.endDate) {
      where.timestamp = {};
      if (filters.startDate) (where.timestamp as Record<string, unknown>).gte = filters.startDate;
      if (filters.endDate) (where.timestamp as Record<string, unknown>).lte = filters.endDate;
    }
    if (filters.courseId) where.courseId = filters.courseId;
    if (filters.userId) where.userId = filters.userId;

    const logs = await prisma.contentEventLog.findMany({
      where,
      orderBy: { timestamp: 'desc' },
    });

    const data = logs.map(log => ({
      id: log.id,
      timestamp: formatTimestamp(log.timestamp),
      timestamp_iso: formatTimestampReadable(log.timestamp),
      session_id: log.sessionId || '',
      user_id: log.userId || '',
      user_fullname: log.userFullname || '',
      user_email: log.userEmail || '',
      course_id: log.courseId || '',
      course_title: log.courseTitle || '',
      module_id: log.moduleId || '',
      module_title: log.moduleTitle || '',
      lecture_id: log.lectureId || '',
      lecture_title: log.lectureTitle || '',
      section_id: log.sectionId || '',
      section_title: log.sectionTitle || '',
      section_type: (log as any).sectionType || '',
      event_type: log.eventType,
      video_position: log.videoPosition ?? '',
      video_duration: log.videoDuration ?? '',
      video_percent_watched: log.videoPercentWatched ?? '',
      scroll_depth_percent: log.scrollDepthPercent ?? '',
      time_on_page_seconds: log.timeOnPageSeconds ?? '',
      document_file_name: log.documentFileName || '',
      document_file_type: log.documentFileType || '',
      ip_address: log.ipAddress || '',
      device_type: log.deviceType || '',
      browser_name: log.browserName || '',
      timezone: log.timezone || '',
    }));

    return stringify(data, { header: true });
  }

  /**
   * Export all analytics to Excel workbook with multiple sheets
   */
  async exportAllAnalyticsExcel(filters: ExportFilters = {}): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'LAILA Analytics Export';
    workbook.created = new Date();

    // Common where clause builder
    const buildWhere = (hasUserId = true, hasCourseId = true) => {
      const where: Record<string, unknown> = {};
      if (filters.startDate || filters.endDate) {
        where.timestamp = {};
        if (filters.startDate) (where.timestamp as Record<string, unknown>).gte = filters.startDate;
        if (filters.endDate) (where.timestamp as Record<string, unknown>).lte = filters.endDate;
      }
      if (hasCourseId && filters.courseId) where.courseId = filters.courseId;
      if (hasUserId && filters.userId) where.userId = filters.userId;
      return where;
    };

    // 1. Chatbot Logs Sheet
    const chatbotLogs = await prisma.chatbotInteractionLog.findMany({
      where: buildWhere(),
      orderBy: { timestamp: 'desc' },
    });

    const chatbotSheet = workbook.addWorksheet('Chatbot Logs');
    chatbotSheet.columns = [
      { header: 'ID', key: 'id', width: 10 },
      { header: 'Timestamp', key: 'timestamp', width: 20 },
      { header: 'Session ID', key: 'sessionId', width: 36 },
      { header: 'User ID', key: 'userId', width: 10 },
      { header: 'User Name', key: 'userFullname', width: 20 },
      { header: 'User Email', key: 'userEmail', width: 25 },
      { header: 'Course ID', key: 'courseId', width: 10 },
      { header: 'Course Title', key: 'courseTitle', width: 30 },
      { header: 'Module Title', key: 'moduleTitle', width: 25 },
      { header: 'Lecture Title', key: 'lectureTitle', width: 25 },
      { header: 'Event Type', key: 'eventType', width: 18 },
      { header: 'Chatbot Title', key: 'chatbotTitle', width: 20 },
      { header: 'Message', key: 'messageContent', width: 50 },
      { header: 'Response', key: 'responseContent', width: 50 },
      { header: 'Response Time (s)', key: 'responseTime', width: 15 },
      { header: 'AI Model', key: 'aiModel', width: 20 },
      { header: 'Total Tokens', key: 'totalTokens', width: 12 },
      { header: 'Device Type', key: 'deviceType', width: 12 },
      { header: 'Browser', key: 'browserName', width: 12 },
    ];
    chatbotLogs.forEach(log => {
      chatbotSheet.addRow({
        ...log,
        timestamp: formatTimestampReadable(log.timestamp),
      });
    });

    // 2. User Interactions Sheet
    const userInteractions = await prisma.userInteractionLog.findMany({
      where: buildWhere(),
      orderBy: { timestamp: 'desc' },
    });

    const interactionsSheet = workbook.addWorksheet('User Interactions');
    interactionsSheet.columns = [
      { header: 'ID', key: 'id', width: 10 },
      { header: 'Timestamp', key: 'timestamp', width: 20 },
      { header: 'Session ID', key: 'sessionId', width: 36 },
      { header: 'User ID', key: 'userId', width: 10 },
      { header: 'User Name', key: 'userFullname', width: 20 },
      { header: 'User Email', key: 'userEmail', width: 25 },
      { header: 'Event Type', key: 'eventType', width: 15 },
      { header: 'Event Action', key: 'eventAction', width: 20 },
      { header: 'Page Path', key: 'pagePath', width: 30 },
      { header: 'Course ID', key: 'courseId', width: 10 },
      { header: 'Course Title', key: 'courseTitle', width: 25 },
      { header: 'Element Type', key: 'elementType', width: 12 },
      { header: 'Element Text', key: 'elementText', width: 25 },
      { header: 'Scroll Depth', key: 'scrollDepth', width: 12 },
      { header: 'Device Type', key: 'deviceType', width: 12 },
      { header: 'Browser', key: 'browserName', width: 12 },
    ];
    userInteractions.forEach(log => {
      interactionsSheet.addRow({
        ...log,
        timestamp: formatTimestampReadable(log.timestamp),
      });
    });

    // 3. Auth Events Sheet
    const authLogs = await prisma.authEventLog.findMany({
      where: buildWhere(true, false),
      orderBy: { timestamp: 'desc' },
    });

    const authSheet = workbook.addWorksheet('Auth Events');
    authSheet.columns = [
      { header: 'ID', key: 'id', width: 10 },
      { header: 'Timestamp', key: 'timestamp', width: 20 },
      { header: 'User ID', key: 'userId', width: 10 },
      { header: 'User Name', key: 'userFullname', width: 20 },
      { header: 'User Email', key: 'userEmail', width: 25 },
      { header: 'Event Type', key: 'eventType', width: 15 },
      { header: 'Session ID', key: 'sessionId', width: 36 },
      { header: 'Session Duration (s)', key: 'sessionDuration', width: 15 },
      { header: 'Failure Reason', key: 'failureReason', width: 25 },
      { header: 'Attempt Count', key: 'attemptCount', width: 12 },
      { header: 'IP Address', key: 'ipAddress', width: 15 },
      { header: 'Device Type', key: 'deviceType', width: 12 },
      { header: 'Browser', key: 'browserName', width: 15 },
      { header: 'OS', key: 'osName', width: 12 },
    ];
    authLogs.forEach(log => {
      authSheet.addRow({
        ...log,
        timestamp: formatTimestampReadable(log.timestamp),
      });
    });

    // 4. System Events Sheet
    const systemLogs = await prisma.systemEventLog.findMany({
      where: buildWhere(false, true),
      orderBy: { timestamp: 'desc' },
    });

    const systemSheet = workbook.addWorksheet('System Events');
    systemSheet.columns = [
      { header: 'ID', key: 'id', width: 10 },
      { header: 'Timestamp', key: 'timestamp', width: 20 },
      { header: 'Actor ID', key: 'actorId', width: 10 },
      { header: 'Actor Name', key: 'actorFullname', width: 20 },
      { header: 'Actor Email', key: 'actorEmail', width: 25 },
      { header: 'Actor Role', key: 'actorRole', width: 12 },
      { header: 'Event Type', key: 'eventType', width: 20 },
      { header: 'Category', key: 'eventCategory', width: 15 },
      { header: 'Change Type', key: 'changeType', width: 12 },
      { header: 'Target Type', key: 'targetType', width: 12 },
      { header: 'Target ID', key: 'targetId', width: 10 },
      { header: 'Target Title', key: 'targetTitle', width: 25 },
      { header: 'Course ID', key: 'courseId', width: 10 },
      { header: 'Course Title', key: 'courseTitle', width: 25 },
      { header: 'Previous Values', key: 'previousValues', width: 40 },
      { header: 'New Values', key: 'newValues', width: 40 },
      { header: 'IP Address', key: 'ipAddress', width: 15 },
    ];
    systemLogs.forEach(log => {
      systemSheet.addRow({
        ...log,
        timestamp: formatTimestampReadable(log.timestamp),
      });
    });

    // 5. Assessment Events Sheet
    const assessmentLogs = await prisma.assessmentEventLog.findMany({
      where: buildWhere(),
      orderBy: { timestamp: 'desc' },
    });

    const assessmentSheet = workbook.addWorksheet('Assessment Events');
    assessmentSheet.columns = [
      { header: 'ID', key: 'id', width: 10 },
      { header: 'Timestamp', key: 'timestamp', width: 20 },
      { header: 'Session ID', key: 'sessionId', width: 36 },
      { header: 'User ID', key: 'userId', width: 10 },
      { header: 'User Name', key: 'userFullname', width: 20 },
      { header: 'User Email', key: 'userEmail', width: 25 },
      { header: 'Course ID', key: 'courseId', width: 10 },
      { header: 'Course Title', key: 'courseTitle', width: 25 },
      { header: 'Assignment ID', key: 'assignmentId', width: 12 },
      { header: 'Assignment Title', key: 'assignmentTitle', width: 25 },
      { header: 'Submission ID', key: 'submissionId', width: 12 },
      { header: 'Event Type', key: 'eventType', width: 18 },
      { header: 'Grade', key: 'grade', width: 10 },
      { header: 'Max Points', key: 'maxPoints', width: 12 },
      { header: 'Previous Grade', key: 'previousGrade', width: 12 },
      { header: 'Attempt #', key: 'attemptNumber', width: 10 },
      { header: 'Time Spent (s)', key: 'timeSpentSeconds', width: 12 },
      { header: 'Device Type', key: 'deviceType', width: 12 },
      { header: 'Browser', key: 'browserName', width: 12 },
    ];
    assessmentLogs.forEach(log => {
      assessmentSheet.addRow({
        ...log,
        timestamp: formatTimestampReadable(log.timestamp),
      });
    });

    // 6. Content Events Sheet
    const contentLogs = await prisma.contentEventLog.findMany({
      where: buildWhere(),
      orderBy: { timestamp: 'desc' },
    });

    const contentSheet = workbook.addWorksheet('Content Events');
    contentSheet.columns = [
      { header: 'ID', key: 'id', width: 10 },
      { header: 'Timestamp', key: 'timestamp', width: 20 },
      { header: 'Session ID', key: 'sessionId', width: 36 },
      { header: 'User ID', key: 'userId', width: 10 },
      { header: 'User Name', key: 'userFullname', width: 20 },
      { header: 'User Email', key: 'userEmail', width: 25 },
      { header: 'Course ID', key: 'courseId', width: 10 },
      { header: 'Course Title', key: 'courseTitle', width: 25 },
      { header: 'Module Title', key: 'moduleTitle', width: 25 },
      { header: 'Lecture ID', key: 'lectureId', width: 10 },
      { header: 'Lecture Title', key: 'lectureTitle', width: 25 },
      { header: 'Section Title', key: 'sectionTitle', width: 20 },
      { header: 'Event Type', key: 'eventType', width: 18 },
      { header: 'Video Position', key: 'videoPosition', width: 12 },
      { header: 'Video Duration', key: 'videoDuration', width: 12 },
      { header: 'Video %', key: 'videoPercentWatched', width: 10 },
      { header: 'Scroll Depth %', key: 'scrollDepthPercent', width: 12 },
      { header: 'Time on Page (s)', key: 'timeOnPageSeconds', width: 14 },
      { header: 'Document Name', key: 'documentFileName', width: 25 },
      { header: 'Device Type', key: 'deviceType', width: 12 },
      { header: 'Browser', key: 'browserName', width: 12 },
    ];
    contentLogs.forEach(log => {
      contentSheet.addRow({
        ...log,
        timestamp: formatTimestampReadable(log.timestamp),
      });
    });

    // 7. Agent Config Logs Sheet
    const agentConfigLogs = await prisma.agentConfigurationLog.findMany({
      where: buildWhere(),
      orderBy: { timestamp: 'desc' },
    });

    const agentConfigSheet = workbook.addWorksheet('Agent Config Logs');
    agentConfigSheet.columns = [
      { header: 'ID', key: 'id', width: 10 },
      { header: 'Timestamp', key: 'timestamp', width: 20 },
      { header: 'User ID', key: 'userId', width: 10 },
      { header: 'User Name', key: 'userFullname', width: 20 },
      { header: 'User Email', key: 'userEmail', width: 25 },
      { header: 'Course ID', key: 'courseId', width: 10 },
      { header: 'Course Title', key: 'courseTitle', width: 25 },
      { header: 'Assignment ID', key: 'assignmentId', width: 12 },
      { header: 'Assignment Title', key: 'assignmentTitle', width: 25 },
      { header: 'Agent Config ID', key: 'agentConfigId', width: 12 },
      { header: 'Version', key: 'version', width: 10 },
      { header: 'Change Type', key: 'changeType', width: 12 },
      { header: 'Session ID', key: 'sessionId', width: 36 },
    ];
    agentConfigLogs.forEach(log => {
      agentConfigSheet.addRow({
        ...log,
        timestamp: formatTimestampReadable(log.timestamp),
      });
    });

    // 8. Agent Test Logs Sheet
    const agentTestLogs = await prisma.agentTestInteractionLog.findMany({
      where: buildWhere(),
      orderBy: { timestamp: 'desc' },
    });

    const agentTestSheet = workbook.addWorksheet('Agent Test Logs');
    agentTestSheet.columns = [
      { header: 'ID', key: 'id', width: 10 },
      { header: 'Timestamp', key: 'timestamp', width: 20 },
      { header: 'Session ID', key: 'sessionId', width: 36 },
      { header: 'User ID', key: 'userId', width: 10 },
      { header: 'User Name', key: 'userFullname', width: 20 },
      { header: 'User Role', key: 'userRole', width: 12 },
      { header: 'Course ID', key: 'courseId', width: 10 },
      { header: 'Assignment ID', key: 'assignmentId', width: 12 },
      { header: 'Agent Name', key: 'agentName', width: 20 },
      { header: 'Agent Version', key: 'agentVersion', width: 12 },
      { header: 'Event Type', key: 'eventType', width: 18 },
      { header: 'Message', key: 'messageContent', width: 50 },
      { header: 'Response', key: 'responseContent', width: 50 },
      { header: 'Response Time (s)', key: 'responseTime', width: 15 },
      { header: 'AI Model', key: 'aiModel', width: 20 },
      { header: 'Total Tokens', key: 'totalTokens', width: 12 },
      { header: 'Device Type', key: 'deviceType', width: 12 },
    ];
    agentTestLogs.forEach(log => {
      agentTestSheet.addRow({
        ...log,
        timestamp: formatTimestampReadable(log.timestamp),
      });
    });

    // 9. Agent Grade Logs Sheet
    const agentGradeLogs = await prisma.agentGradeLog.findMany({
      where: buildWhere(false, true),
      orderBy: { timestamp: 'desc' },
    });

    const agentGradeSheet = workbook.addWorksheet('Agent Grade Logs');
    agentGradeSheet.columns = [
      { header: 'ID', key: 'id', width: 10 },
      { header: 'Timestamp', key: 'timestamp', width: 20 },
      { header: 'Grader ID', key: 'graderId', width: 10 },
      { header: 'Grader Name', key: 'graderFullname', width: 20 },
      { header: 'Student ID', key: 'studentId', width: 10 },
      { header: 'Student Name', key: 'studentFullname', width: 20 },
      { header: 'Course ID', key: 'courseId', width: 10 },
      { header: 'Course Title', key: 'courseTitle', width: 25 },
      { header: 'Assignment ID', key: 'assignmentId', width: 12 },
      { header: 'Assignment Title', key: 'assignmentTitle', width: 25 },
      { header: 'Max Points', key: 'maxPoints', width: 10 },
      { header: 'Previous Grade', key: 'previousGrade', width: 14 },
      { header: 'New Grade', key: 'newGrade', width: 10 },
      { header: 'Config Version', key: 'configVersion', width: 12 },
    ];
    agentGradeLogs.forEach(log => {
      agentGradeSheet.addRow({
        ...log,
        timestamp: formatTimestampReadable(log.timestamp),
      });
    });

    // Generate buffer
    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }

  /**
   * Export all CSVs as a ZIP file
   */
  async exportAllCSVsAsZip(filters: ExportFilters = {}): Promise<Readable> {
    const archive = archiver('zip', {
      zlib: { level: 9 },
    });

    // Get all CSV data in parallel
    const [
      chatbotCsv,
      interactionsCsv,
      authCsv,
      systemCsv,
      assessmentCsv,
      contentCsv,
      agentConfigCsv,
      agentTestCsv,
      agentGradeCsv,
    ] = await Promise.all([
      this.exportChatbotLogsCSV(filters),
      this.exportUserInteractionsCSV(filters),
      this.exportAuthLogsCSV(filters),
      this.exportSystemEventsCSV(filters),
      this.exportAssessmentLogsCSV(filters),
      this.exportContentEventsCSV(filters),
      this.exportAgentConfigLogsCSV(filters),
      this.exportAgentTestLogsCSV(filters),
      this.exportAgentGradeLogsCSV(filters),
    ]);

    // Add each CSV to the archive
    archive.append(chatbotCsv, { name: 'chatbot_logs.csv' });
    archive.append(interactionsCsv, { name: 'user_interactions.csv' });
    archive.append(authCsv, { name: 'auth_logs.csv' });
    archive.append(systemCsv, { name: 'system_events.csv' });
    archive.append(assessmentCsv, { name: 'assessment_logs.csv' });
    archive.append(contentCsv, { name: 'content_events.csv' });
    archive.append(agentConfigCsv, { name: 'agent_config_logs.csv' });
    archive.append(agentTestCsv, { name: 'agent_test_logs.csv' });
    archive.append(agentGradeCsv, { name: 'agent_grade_logs.csv' });

    // Finalize the archive
    archive.finalize();

    return archive;
  }

  // ============================================================================
  // AGENT ASSIGNMENT LOGS
  // ============================================================================

  /**
   * Export agent configuration logs to CSV
   */
  async exportAgentConfigLogsCSV(filters: ExportFilters = {}): Promise<string> {
    const where: Record<string, unknown> = {};
    if (filters.startDate || filters.endDate) {
      where.timestamp = {};
      if (filters.startDate) (where.timestamp as Record<string, unknown>).gte = filters.startDate;
      if (filters.endDate) (where.timestamp as Record<string, unknown>).lte = filters.endDate;
    }
    if (filters.courseId) where.courseId = filters.courseId;
    if (filters.userId) where.userId = filters.userId;

    const logs = await prisma.agentConfigurationLog.findMany({
      where,
      orderBy: { timestamp: 'desc' },
    });

    const data = logs.map(log => ({
      id: log.id,
      timestamp: formatTimestamp(log.timestamp),
      timestamp_readable: formatTimestampReadable(log.timestamp),

      // User context
      user_id: log.userId || '',
      user_fullname: log.userFullname || '',
      user_email: log.userEmail || '',

      // Course/Assignment context
      course_id: log.courseId || '',
      course_title: log.courseTitle || '',
      assignment_id: log.assignmentId || '',
      assignment_title: log.assignmentTitle || '',

      // Config context
      agent_config_id: log.agentConfigId || '',
      version: log.version || '',
      change_type: log.changeType,

      // Snapshots
      previous_config_snapshot: log.previousConfigSnapshot || '',
      new_config_snapshot: log.newConfigSnapshot || '',
      changed_fields: log.changedFields || '',

      // Client context
      ip_address: log.ipAddress || '',
      user_agent: log.userAgent || '',
      session_id: log.sessionId || '',
    }));

    return stringify(data, { header: true });
  }

  /**
   * Export agent test interaction logs to CSV
   */
  async exportAgentTestLogsCSV(filters: ExportFilters = {}): Promise<string> {
    const where: Record<string, unknown> = {};
    if (filters.startDate || filters.endDate) {
      where.timestamp = {};
      if (filters.startDate) (where.timestamp as Record<string, unknown>).gte = filters.startDate;
      if (filters.endDate) (where.timestamp as Record<string, unknown>).lte = filters.endDate;
    }
    if (filters.courseId) where.courseId = filters.courseId;
    if (filters.userId) where.userId = filters.userId;

    const logs = await prisma.agentTestInteractionLog.findMany({
      where,
      orderBy: { timestamp: 'desc' },
    });

    const data = logs.map(log => ({
      id: log.id,
      timestamp: formatTimestamp(log.timestamp),
      timestamp_readable: formatTimestampReadable(log.timestamp),
      timestamp_ms: log.timestampMs?.toString() || '',
      session_id: log.sessionId || '',

      // User context
      user_id: log.userId || '',
      user_fullname: log.userFullname || '',
      user_email: log.userEmail || '',
      user_role: log.userRole || '',

      // Course/Assignment context
      course_id: log.courseId || '',
      course_title: log.courseTitle || '',
      assignment_id: log.assignmentId || '',
      assignment_title: log.assignmentTitle || '',

      // Agent config context
      agent_config_id: log.agentConfigId || '',
      agent_name: log.agentName || '',
      agent_version: log.agentVersion || '',
      agent_config_snapshot: log.agentConfigSnapshot || '',

      // Conversation context
      conversation_id: log.conversationId || '',
      message_index: log.messageIndex || '',
      conversation_message_count: log.conversationMessageCount || '',
      event_type: log.eventType,

      // Message content
      message_content: log.messageContent || '',
      message_char_count: log.messageCharCount || '',
      message_word_count: log.messageWordCount || '',

      // Response content
      response_content: log.responseContent || '',
      response_char_count: log.responseCharCount || '',
      response_word_count: log.responseWordCount || '',

      // AI metrics
      response_time_seconds: log.responseTime || '',
      ai_model: log.aiModel || '',
      ai_provider: log.aiProvider || '',
      prompt_tokens: log.promptTokens || '',
      completion_tokens: log.completionTokens || '',
      total_tokens: log.totalTokens || '',

      // Error info
      error_message: log.errorMessage || '',
      error_code: log.errorCode || '',

      // Client context
      ip_address: log.ipAddress || '',
      user_agent: log.userAgent || '',
      device_type: log.deviceType || '',
      browser_name: log.browserName || '',
      browser_version: log.browserVersion || '',
      os_name: log.osName || '',
      os_version: log.osVersion || '',
      screen_width: log.screenWidth || '',
      screen_height: log.screenHeight || '',
      language: log.language || '',
      timezone: log.timezone || '',
    }));

    return stringify(data, { header: true });
  }

  /**
   * Export agent grade logs to CSV
   */
  async exportAgentGradeLogsCSV(filters: ExportFilters = {}): Promise<string> {
    const where: Record<string, unknown> = {};
    if (filters.startDate || filters.endDate) {
      where.timestamp = {};
      if (filters.startDate) (where.timestamp as Record<string, unknown>).gte = filters.startDate;
      if (filters.endDate) (where.timestamp as Record<string, unknown>).lte = filters.endDate;
    }
    if (filters.courseId) where.courseId = filters.courseId;
    if (filters.userId) where.graderId = filters.userId;

    const logs = await prisma.agentGradeLog.findMany({
      where,
      orderBy: { timestamp: 'desc' },
    });

    const data = logs.map(log => ({
      id: log.id,
      timestamp: formatTimestamp(log.timestamp),
      timestamp_readable: formatTimestampReadable(log.timestamp),

      // Grader context
      grader_id: log.graderId || '',
      grader_fullname: log.graderFullname || '',
      grader_email: log.graderEmail || '',

      // Student context
      student_id: log.studentId || '',
      student_fullname: log.studentFullname || '',
      student_email: log.studentEmail || '',

      // Course/Assignment context
      course_id: log.courseId || '',
      course_title: log.courseTitle || '',
      assignment_id: log.assignmentId || '',
      assignment_title: log.assignmentTitle || '',
      max_points: log.maxPoints || '',

      // Config context
      agent_config_id: log.agentConfigId || '',
      config_version: log.configVersion || '',
      config_snapshot: log.configSnapshot || '',

      // Grade details
      previous_grade: log.previousGrade ?? '',
      new_grade: log.newGrade ?? '',
      previous_feedback: log.previousFeedback || '',
      new_feedback: log.newFeedback || '',

      // Client context
      ip_address: log.ipAddress || '',
      user_agent: log.userAgent || '',
      session_id: log.sessionId || '',
    }));

    return stringify(data, { header: true });
  }

  /**
   * Export course/chatbot settings as JSON
   */
  async exportCourseSettingsJSON(courseId?: number): Promise<string> {
    const where = courseId ? { id: courseId } : {};

    const courses = await prisma.course.findMany({
      where,
      include: {
        instructor: {
          select: { id: true, fullname: true, email: true },
        },
        modules: {
          orderBy: { orderIndex: 'asc' },
          include: {
            lectures: {
              orderBy: { orderIndex: 'asc' },
              include: {
                sections: {
                  orderBy: { order: 'asc' },
                  select: {
                    id: true,
                    title: true,
                    type: true,
                    order: true,
                    chatbotTitle: true,
                    chatbotIntro: true,
                    chatbotSystemPrompt: true,
                    chatbotWelcome: true,
                    chatbotImageUrl: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    // Extract chatbot configurations
    const courseSettings = courses.map(course => ({
      course: {
        id: course.id,
        title: course.title,
        slug: course.slug,
        description: course.description,
        category: course.category,
        difficulty: course.difficulty,
        status: course.status,
        instructor: course.instructor,
        createdAt: course.createdAt,
        updatedAt: course.updatedAt,
      },
      modules: course.modules.map(module => ({
        id: module.id,
        title: module.title,
        description: module.description,
        orderIndex: module.orderIndex,
        lectures: module.lectures.map(lecture => ({
          id: lecture.id,
          title: lecture.title,
          contentType: lecture.contentType,
          orderIndex: lecture.orderIndex,
          chatbotSections: lecture.sections
            .filter(s => s.type === 'chatbot')
            .map(section => ({
              id: section.id,
              title: section.title,
              order: section.order,
              chatbotConfig: {
                title: section.chatbotTitle,
                intro: section.chatbotIntro,
                systemPrompt: section.chatbotSystemPrompt,
                welcomeMessage: section.chatbotWelcome,
                imageUrl: section.chatbotImageUrl,
              },
            })),
        })),
      })),
    }));

    return JSON.stringify(courseSettings, null, 2);
  }
}

export const analyticsExportService = new AnalyticsExportService();
