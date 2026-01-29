import prisma from '../utils/prisma.js';

// ============================================================================
// INTERFACES
// ============================================================================

export interface ContentEventData {
  userId?: number;
  sessionId?: string;
  courseId?: number;
  moduleId?: number;
  lectureId?: number;
  sectionId?: number;
  eventType: 'lecture_view' | 'video_play' | 'video_pause' | 'video_complete' | 'video_seek' | 'document_download' | 'scroll_depth_update' | 'lecture_complete';
  videoPosition?: number;
  videoDuration?: number;
  videoPercentWatched?: number;
  scrollDepthPercent?: number;
  timeOnPageSeconds?: number;
  documentFileName?: string;
  documentFileType?: string;
  timestamp?: number;
  // Client info
  deviceType?: string;
  browserName?: string;
  timezone?: string;
}

export interface AssessmentEventData {
  userId?: number;
  sessionId?: string;
  courseId?: number;
  assignmentId?: number;
  submissionId?: number;
  eventType: 'assignment_view' | 'assignment_submit' | 'grade_received' | 'feedback_view' | 'assignment_start';
  grade?: number;
  maxPoints?: number;
  previousGrade?: number;
  attemptNumber?: number;
  timeSpentSeconds?: number;
  feedbackLength?: number;
  timestamp?: number;
  // Client info
  deviceType?: string;
  browserName?: string;
}

export interface SystemEventData {
  actorId?: number;
  eventType: string; // course_create, lecture_update, chatbot_config_change, etc.
  eventCategory: 'content_mgmt' | 'grading' | 'user_mgmt' | 'enrollment' | 'settings' | 'auth';
  changeType?: 'create' | 'update' | 'delete' | 'publish' | 'unpublish';
  targetType?: 'course' | 'module' | 'lecture' | 'section' | 'assignment' | 'chatbot' | 'user' | 'enrollment';
  targetId?: number;
  targetTitle?: string;
  courseId?: number;
  targetUserId?: number;
  previousValues?: Record<string, unknown>;
  newValues?: Record<string, unknown>;
}

export interface AuthEventData {
  userId?: number;
  userEmail: string;
  sessionId?: string;
  sessionDuration?: number;
  eventType: 'login_success' | 'login_failure' | 'logout' | 'password_reset' | 'password_change' | 'session_timeout' | 'register';
  failureReason?: string;
  attemptCount?: number;
  // Client info
  userAgent?: string;
  deviceType?: string;
  browserName?: string;
  browserVersion?: string;
  osName?: string;
  osVersion?: string;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

async function getUserSnapshot(userId?: number): Promise<{ fullname: string; email: string } | null> {
  if (!userId) return null;
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { fullname: true, email: true },
  });
  return user;
}

async function getActorSnapshot(actorId?: number): Promise<{ fullname: string; email: string; isAdmin: boolean; isInstructor: boolean } | null> {
  if (!actorId) return null;
  const actor = await prisma.user.findUnique({
    where: { id: actorId },
    select: { fullname: true, email: true, isAdmin: true, isInstructor: true },
  });
  return actor;
}

async function getCourseSnapshot(courseId?: number): Promise<{ title: string } | null> {
  if (!courseId) return null;
  const course = await prisma.course.findUnique({
    where: { id: courseId },
    select: { title: true },
  });
  return course;
}

async function getModuleSnapshot(moduleId?: number): Promise<{ title: string } | null> {
  if (!moduleId) return null;
  const module = await prisma.courseModule.findUnique({
    where: { id: moduleId },
    select: { title: true },
  });
  return module;
}

async function getLectureSnapshot(lectureId?: number): Promise<{ title: string } | null> {
  if (!lectureId) return null;
  const lecture = await prisma.lecture.findUnique({
    where: { id: lectureId },
    select: { title: true },
  });
  return lecture;
}

async function getSectionSnapshot(sectionId?: number): Promise<{ title: string | null } | null> {
  if (!sectionId) return null;
  const section = await prisma.lectureSection.findUnique({
    where: { id: sectionId },
    select: { title: true },
  });
  return section;
}

async function getAssignmentSnapshot(assignmentId?: number): Promise<{ title: string; points: number; courseId: number } | null> {
  if (!assignmentId) return null;
  const assignment = await prisma.assignment.findUnique({
    where: { id: assignmentId },
    select: { title: true, points: true, courseId: true },
  });
  return assignment;
}

async function getTargetUserSnapshot(targetUserId?: number): Promise<{ fullname: string; email: string } | null> {
  if (!targetUserId) return null;
  const user = await prisma.user.findUnique({
    where: { id: targetUserId },
    select: { fullname: true, email: true },
  });
  return user;
}

// ============================================================================
// LEARNING ANALYTICS SERVICE
// ============================================================================

export class LearningAnalyticsService {
  /**
   * Log content consumption events (lecture views, video events, downloads)
   */
  async logContentEvent(data: ContentEventData, ipAddress?: string) {
    // Fetch snapshots for context
    const [userSnapshot, courseSnapshot, moduleSnapshot, lectureSnapshot, sectionSnapshot] = await Promise.all([
      getUserSnapshot(data.userId),
      getCourseSnapshot(data.courseId),
      getModuleSnapshot(data.moduleId),
      getLectureSnapshot(data.lectureId),
      getSectionSnapshot(data.sectionId),
    ]);

    const log = await prisma.contentEventLog.create({
      data: {
        userId: data.userId,
        userFullname: userSnapshot?.fullname,
        userEmail: userSnapshot?.email,
        sessionId: data.sessionId,
        courseId: data.courseId,
        courseTitle: courseSnapshot?.title,
        moduleId: data.moduleId,
        moduleTitle: moduleSnapshot?.title,
        lectureId: data.lectureId,
        lectureTitle: lectureSnapshot?.title,
        sectionId: data.sectionId,
        sectionTitle: sectionSnapshot?.title,
        eventType: data.eventType,
        videoPosition: data.videoPosition,
        videoDuration: data.videoDuration,
        videoPercentWatched: data.videoPercentWatched,
        scrollDepthPercent: data.scrollDepthPercent,
        timeOnPageSeconds: data.timeOnPageSeconds,
        documentFileName: data.documentFileName,
        documentFileType: data.documentFileType,
        ipAddress,
        deviceType: data.deviceType,
        browserName: data.browserName,
        timezone: data.timezone,
        timestamp: data.timestamp ? new Date(data.timestamp) : new Date(),
        timestampMs: data.timestamp ? BigInt(data.timestamp) : BigInt(Date.now()),
      },
    });

    return log;
  }

  /**
   * Log assessment events (submissions, grades, feedback)
   */
  async logAssessmentEvent(data: AssessmentEventData, ipAddress?: string) {
    // Fetch snapshots for context
    const [userSnapshot, assignmentSnapshot] = await Promise.all([
      getUserSnapshot(data.userId),
      getAssignmentSnapshot(data.assignmentId),
    ]);

    // Use courseId from data or assignment
    const courseId = data.courseId || assignmentSnapshot?.courseId;
    const courseSnapshot = courseId ? await getCourseSnapshot(courseId) : null;

    const log = await prisma.assessmentEventLog.create({
      data: {
        userId: data.userId,
        userFullname: userSnapshot?.fullname,
        userEmail: userSnapshot?.email,
        sessionId: data.sessionId,
        courseId,
        courseTitle: courseSnapshot?.title,
        assignmentId: data.assignmentId,
        assignmentTitle: assignmentSnapshot?.title,
        submissionId: data.submissionId,
        eventType: data.eventType,
        grade: data.grade,
        maxPoints: data.maxPoints || assignmentSnapshot?.points,
        previousGrade: data.previousGrade,
        attemptNumber: data.attemptNumber,
        timeSpentSeconds: data.timeSpentSeconds,
        feedbackLength: data.feedbackLength,
        ipAddress,
        deviceType: data.deviceType,
        browserName: data.browserName,
        timestamp: data.timestamp ? new Date(data.timestamp) : new Date(),
      },
    });

    return log;
  }

  /**
   * Log system events (CRUD operations by teachers/admins)
   */
  async logSystemEvent(data: SystemEventData, ipAddress?: string) {
    // Fetch snapshots for context
    const [actorSnapshot, courseSnapshot, targetUserSnapshot] = await Promise.all([
      getActorSnapshot(data.actorId),
      getCourseSnapshot(data.courseId),
      getTargetUserSnapshot(data.targetUserId),
    ]);

    // Determine actor role
    let actorRole: string | undefined;
    if (actorSnapshot) {
      if (actorSnapshot.isAdmin) actorRole = 'admin';
      else if (actorSnapshot.isInstructor) actorRole = 'instructor';
      else actorRole = 'user';
    }

    const log = await prisma.systemEventLog.create({
      data: {
        actorId: data.actorId,
        actorFullname: actorSnapshot?.fullname,
        actorEmail: actorSnapshot?.email,
        actorRole,
        eventType: data.eventType,
        eventCategory: data.eventCategory,
        changeType: data.changeType,
        targetType: data.targetType,
        targetId: data.targetId,
        targetTitle: data.targetTitle,
        courseId: data.courseId,
        courseTitle: courseSnapshot?.title,
        targetUserId: data.targetUserId,
        targetUserFullname: targetUserSnapshot?.fullname,
        targetUserEmail: targetUserSnapshot?.email,
        previousValues: data.previousValues ? JSON.stringify(data.previousValues) : null,
        newValues: data.newValues ? JSON.stringify(data.newValues) : null,
        ipAddress,
      },
    });

    return log;
  }

  /**
   * Log authentication events (login, logout, password changes)
   */
  async logAuthEvent(data: AuthEventData, ipAddress?: string) {
    // Fetch user snapshot if we have userId
    const userSnapshot = await getUserSnapshot(data.userId);

    const log = await prisma.authEventLog.create({
      data: {
        userId: data.userId,
        userFullname: userSnapshot?.fullname || data.userEmail.split('@')[0], // Fallback to email prefix
        userEmail: data.userEmail,
        sessionId: data.sessionId,
        sessionDuration: data.sessionDuration,
        eventType: data.eventType,
        failureReason: data.failureReason,
        attemptCount: data.attemptCount,
        ipAddress,
        userAgent: data.userAgent,
        deviceType: data.deviceType,
        browserName: data.browserName,
        browserVersion: data.browserVersion,
        osName: data.osName,
        osVersion: data.osVersion,
      },
    });

    return log;
  }

  // ============================================================================
  // QUERY METHODS FOR ANALYTICS
  // ============================================================================

  /**
   * Get content event summary
   */
  async getContentEventSummary(filters: {
    startDate?: Date;
    endDate?: Date;
    userId?: number;
    courseId?: number;
    lectureId?: number;
    eventType?: string;
  } = {}) {
    const where: Record<string, unknown> = {};

    if (filters.startDate || filters.endDate) {
      where.timestamp = {};
      if (filters.startDate) (where.timestamp as Record<string, unknown>).gte = filters.startDate;
      if (filters.endDate) (where.timestamp as Record<string, unknown>).lte = filters.endDate;
    }
    if (filters.userId) where.userId = filters.userId;
    if (filters.courseId) where.courseId = filters.courseId;
    if (filters.lectureId) where.lectureId = filters.lectureId;
    if (filters.eventType) where.eventType = filters.eventType;

    const [totalEvents, byEventType, byCourse, byLecture, byUser, recentEvents] = await Promise.all([
      prisma.contentEventLog.count({ where }),
      prisma.contentEventLog.groupBy({
        by: ['eventType'],
        where,
        _count: { _all: true },
      }),
      prisma.contentEventLog.groupBy({
        by: ['courseId', 'courseTitle'],
        where: { ...where, courseId: { not: null } },
        _count: { _all: true },
      }),
      prisma.contentEventLog.groupBy({
        by: ['lectureId', 'lectureTitle'],
        where: { ...where, lectureId: { not: null } },
        _count: { _all: true },
      }),
      prisma.contentEventLog.groupBy({
        by: ['userId', 'userFullname'],
        where: { ...where, userId: { not: null } },
        _count: { _all: true },
      }),
      prisma.contentEventLog.findMany({
        where,
        orderBy: { timestamp: 'desc' },
        take: 100,
      }),
    ]);

    return {
      totalEvents,
      byEventType: byEventType.map(e => ({ eventType: e.eventType, count: e._count._all })),
      byCourse: byCourse.map(c => ({ courseId: c.courseId, courseTitle: c.courseTitle, count: c._count._all })).slice(0, 10),
      byLecture: byLecture.map(l => ({ lectureId: l.lectureId, lectureTitle: l.lectureTitle, count: l._count._all })).slice(0, 10),
      byUser: byUser.map(u => ({ userId: u.userId, userName: u.userFullname, count: u._count._all })).slice(0, 10),
      recentEvents,
    };
  }

  /**
   * Get assessment event summary
   */
  async getAssessmentEventSummary(filters: {
    startDate?: Date;
    endDate?: Date;
    userId?: number;
    courseId?: number;
    assignmentId?: number;
    eventType?: string;
  } = {}) {
    const where: Record<string, unknown> = {};

    if (filters.startDate || filters.endDate) {
      where.timestamp = {};
      if (filters.startDate) (where.timestamp as Record<string, unknown>).gte = filters.startDate;
      if (filters.endDate) (where.timestamp as Record<string, unknown>).lte = filters.endDate;
    }
    if (filters.userId) where.userId = filters.userId;
    if (filters.courseId) where.courseId = filters.courseId;
    if (filters.assignmentId) where.assignmentId = filters.assignmentId;
    if (filters.eventType) where.eventType = filters.eventType;

    const [totalEvents, byEventType, byCourse, byAssignment, byUser, gradeStats, recentEvents] = await Promise.all([
      prisma.assessmentEventLog.count({ where }),
      prisma.assessmentEventLog.groupBy({
        by: ['eventType'],
        where,
        _count: { _all: true },
      }),
      prisma.assessmentEventLog.groupBy({
        by: ['courseId', 'courseTitle'],
        where: { ...where, courseId: { not: null } },
        _count: { _all: true },
      }),
      prisma.assessmentEventLog.groupBy({
        by: ['assignmentId', 'assignmentTitle'],
        where: { ...where, assignmentId: { not: null } },
        _count: { _all: true },
      }),
      prisma.assessmentEventLog.groupBy({
        by: ['userId', 'userFullname'],
        where: { ...where, userId: { not: null } },
        _count: { _all: true },
      }),
      prisma.assessmentEventLog.aggregate({
        where: { ...where, eventType: 'grade_received', grade: { not: null } },
        _avg: { grade: true },
        _min: { grade: true },
        _max: { grade: true },
      }),
      prisma.assessmentEventLog.findMany({
        where,
        orderBy: { timestamp: 'desc' },
        take: 100,
      }),
    ]);

    return {
      totalEvents,
      byEventType: byEventType.map(e => ({ eventType: e.eventType, count: e._count._all })),
      byCourse: byCourse.map(c => ({ courseId: c.courseId, courseTitle: c.courseTitle, count: c._count._all })).slice(0, 10),
      byAssignment: byAssignment.map(a => ({ assignmentId: a.assignmentId, assignmentTitle: a.assignmentTitle, count: a._count._all })).slice(0, 10),
      byUser: byUser.map(u => ({ userId: u.userId, userName: u.userFullname, count: u._count._all })).slice(0, 10),
      gradeStats: {
        avg: gradeStats._avg.grade || 0,
        min: gradeStats._min.grade || 0,
        max: gradeStats._max.grade || 0,
      },
      recentEvents,
    };
  }

  /**
   * Get system event summary
   */
  async getSystemEventSummary(filters: {
    startDate?: Date;
    endDate?: Date;
    actorId?: number;
    eventCategory?: string;
    eventType?: string;
    courseId?: number;
  } = {}) {
    const where: Record<string, unknown> = {};

    if (filters.startDate || filters.endDate) {
      where.timestamp = {};
      if (filters.startDate) (where.timestamp as Record<string, unknown>).gte = filters.startDate;
      if (filters.endDate) (where.timestamp as Record<string, unknown>).lte = filters.endDate;
    }
    if (filters.actorId) where.actorId = filters.actorId;
    if (filters.eventCategory) where.eventCategory = filters.eventCategory;
    if (filters.eventType) where.eventType = filters.eventType;
    if (filters.courseId) where.courseId = filters.courseId;

    const [totalEvents, byEventType, byCategory, byChangeType, byTargetType, byActor, byCourse, recentEvents] = await Promise.all([
      prisma.systemEventLog.count({ where }),
      prisma.systemEventLog.groupBy({
        by: ['eventType'],
        where,
        _count: true,
        orderBy: { _count: { eventType: 'desc' } },
      }),
      prisma.systemEventLog.groupBy({
        by: ['eventCategory'],
        where,
        _count: true,
        orderBy: { _count: { eventCategory: 'desc' } },
      }),
      prisma.systemEventLog.groupBy({
        by: ['changeType'],
        where: { ...where, changeType: { not: null } },
        _count: true,
      }),
      prisma.systemEventLog.groupBy({
        by: ['targetType'],
        where: { ...where, targetType: { not: null } },
        _count: true,
      }),
      prisma.systemEventLog.groupBy({
        by: ['actorId', 'actorFullname', 'actorRole'],
        where: { ...where, actorId: { not: null } },
        _count: true,
        orderBy: { _count: { actorId: 'desc' } },
        take: 10,
      }),
      prisma.systemEventLog.groupBy({
        by: ['courseId', 'courseTitle'],
        where: { ...where, courseId: { not: null } },
        _count: true,
        orderBy: { _count: { courseId: 'desc' } },
        take: 10,
      }),
      prisma.systemEventLog.findMany({
        where,
        orderBy: { timestamp: 'desc' },
        take: 100,
      }),
    ]);

    return {
      totalEvents,
      byEventType: byEventType.map(e => ({ eventType: e.eventType, count: e._count })),
      byCategory: byCategory.map(c => ({ category: c.eventCategory, count: c._count })),
      byChangeType: byChangeType.map(c => ({ changeType: c.changeType, count: c._count })),
      byTargetType: byTargetType.map(t => ({ targetType: t.targetType, count: t._count })),
      byActor: byActor.map(a => ({ actorId: a.actorId, actorName: a.actorFullname, actorRole: a.actorRole, count: a._count })),
      byCourse: byCourse.map(c => ({ courseId: c.courseId, courseTitle: c.courseTitle, count: c._count })),
      recentEvents: recentEvents.map(e => ({
        ...e,
        previousValues: e.previousValues ? JSON.parse(e.previousValues) : null,
        newValues: e.newValues ? JSON.parse(e.newValues) : null,
      })),
    };
  }

  /**
   * Get auth event summary
   */
  async getAuthEventSummary(filters: {
    startDate?: Date;
    endDate?: Date;
    userId?: number;
    userEmail?: string;
    eventType?: string;
  } = {}) {
    const where: Record<string, unknown> = {};

    if (filters.startDate || filters.endDate) {
      where.timestamp = {};
      if (filters.startDate) (where.timestamp as Record<string, unknown>).gte = filters.startDate;
      if (filters.endDate) (where.timestamp as Record<string, unknown>).lte = filters.endDate;
    }
    if (filters.userId) where.userId = filters.userId;
    if (filters.userEmail) where.userEmail = filters.userEmail;
    if (filters.eventType) where.eventType = filters.eventType;

    const [totalEvents, byEventType, byUser, byDevice, byBrowser, byFailureReason, recentEvents] = await Promise.all([
      prisma.authEventLog.count({ where }),
      prisma.authEventLog.groupBy({
        by: ['eventType'],
        where,
        _count: true,
        orderBy: { _count: { eventType: 'desc' } },
      }),
      prisma.authEventLog.groupBy({
        by: ['userId', 'userFullname'],
        where: { ...where, userId: { not: null } },
        _count: true,
        orderBy: { _count: { userId: 'desc' } },
        take: 10,
      }),
      prisma.authEventLog.groupBy({
        by: ['deviceType'],
        where: { ...where, deviceType: { not: null } },
        _count: true,
      }),
      prisma.authEventLog.groupBy({
        by: ['browserName'],
        where: { ...where, browserName: { not: null } },
        _count: true,
      }),
      prisma.authEventLog.groupBy({
        by: ['failureReason'],
        where: { ...where, failureReason: { not: null } },
        _count: true,
      }),
      prisma.authEventLog.findMany({
        where,
        orderBy: { timestamp: 'desc' },
        take: 100,
      }),
    ]);

    return {
      totalEvents,
      byEventType: byEventType.map(e => ({ eventType: e.eventType, count: e._count })),
      byUser: byUser.map(u => ({ userId: u.userId, userName: u.userFullname, count: u._count })),
      byDevice: byDevice.map(d => ({ device: d.deviceType, count: d._count })),
      byBrowser: byBrowser.map(b => ({ browser: b.browserName, count: b._count })),
      byFailureReason: byFailureReason.map(f => ({ reason: f.failureReason, count: f._count })),
      recentEvents,
    };
  }

  // ============================================================================
  // RAW DATA ACCESS FOR EXPORT
  // ============================================================================

  async getAllContentEvents(filters: {
    startDate?: Date;
    endDate?: Date;
    courseId?: number;
    userId?: number;
  } = {}) {
    const where: Record<string, unknown> = {};
    if (filters.startDate || filters.endDate) {
      where.timestamp = {};
      if (filters.startDate) (where.timestamp as Record<string, unknown>).gte = filters.startDate;
      if (filters.endDate) (where.timestamp as Record<string, unknown>).lte = filters.endDate;
    }
    if (filters.courseId) where.courseId = filters.courseId;
    if (filters.userId) where.userId = filters.userId;

    return prisma.contentEventLog.findMany({
      where,
      orderBy: { timestamp: 'desc' },
    });
  }

  async getAllAssessmentEvents(filters: {
    startDate?: Date;
    endDate?: Date;
    courseId?: number;
    userId?: number;
  } = {}) {
    const where: Record<string, unknown> = {};
    if (filters.startDate || filters.endDate) {
      where.timestamp = {};
      if (filters.startDate) (where.timestamp as Record<string, unknown>).gte = filters.startDate;
      if (filters.endDate) (where.timestamp as Record<string, unknown>).lte = filters.endDate;
    }
    if (filters.courseId) where.courseId = filters.courseId;
    if (filters.userId) where.userId = filters.userId;

    return prisma.assessmentEventLog.findMany({
      where,
      orderBy: { timestamp: 'desc' },
    });
  }

  async getAllSystemEvents(filters: {
    startDate?: Date;
    endDate?: Date;
    courseId?: number;
    actorId?: number;
  } = {}) {
    const where: Record<string, unknown> = {};
    if (filters.startDate || filters.endDate) {
      where.timestamp = {};
      if (filters.startDate) (where.timestamp as Record<string, unknown>).gte = filters.startDate;
      if (filters.endDate) (where.timestamp as Record<string, unknown>).lte = filters.endDate;
    }
    if (filters.courseId) where.courseId = filters.courseId;
    if (filters.actorId) where.actorId = filters.actorId;

    return prisma.systemEventLog.findMany({
      where,
      orderBy: { timestamp: 'desc' },
    });
  }

  async getAllAuthEvents(filters: {
    startDate?: Date;
    endDate?: Date;
    userId?: number;
  } = {}) {
    const where: Record<string, unknown> = {};
    if (filters.startDate || filters.endDate) {
      where.timestamp = {};
      if (filters.startDate) (where.timestamp as Record<string, unknown>).gte = filters.startDate;
      if (filters.endDate) (where.timestamp as Record<string, unknown>).lte = filters.endDate;
    }
    if (filters.userId) where.userId = filters.userId;

    return prisma.authEventLog.findMany({
      where,
      orderBy: { timestamp: 'desc' },
    });
  }
}

export const learningAnalyticsService = new LearningAnalyticsService();
