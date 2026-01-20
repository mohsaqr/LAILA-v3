import prisma from '../utils/prisma.js';
import { Prisma } from '@prisma/client';

// Standardized verb types
export type ActivityVerb =
  | 'enrolled' | 'unenrolled' | 'viewed' | 'started' | 'completed'
  | 'progressed' | 'paused' | 'resumed' | 'seeked' | 'scrolled'
  | 'downloaded' | 'submitted' | 'graded' | 'messaged' | 'received'
  | 'cleared' | 'interacted';

export type ObjectType =
  | 'course' | 'module' | 'lecture' | 'section' | 'video'
  | 'assignment' | 'chatbot' | 'file' | 'quiz';

export interface LogActivityInput {
  userId: number;
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
  sessionId?: string;
  deviceType?: string;
  browserName?: string;
}

export interface LogQueryFilters {
  userId?: number;
  courseId?: number;
  verb?: string;
  objectType?: string;
  startDate?: Date;
  endDate?: Date;
  page?: number;
  limit?: number;
}

class ActivityLogService {
  /**
   * Log an activity with automatic context enrichment
   */
  async logActivity(input: LogActivityInput) {
    // Fetch user data
    const user = await prisma.user.findUnique({
      where: { id: input.userId },
      select: { email: true, fullname: true, isAdmin: true, isInstructor: true },
    });

    if (!user) {
      throw new Error(`User with id ${input.userId} not found`);
    }

    const userRole = user.isAdmin ? 'admin' : user.isInstructor ? 'instructor' : 'student';

    let logData: Prisma.LearningActivityLogCreateInput = {
      user: { connect: { id: input.userId } },
      userEmail: user.email,
      userFullname: user.fullname,
      userRole,
      sessionId: input.sessionId,
      verb: input.verb,
      objectType: input.objectType,
      objectId: input.objectId,
      objectTitle: input.objectTitle,
      objectSubtype: input.objectSubtype,
      success: input.success ?? true,
      score: input.score,
      maxScore: input.maxScore,
      progress: input.progress,
      duration: input.duration,
      extensions: input.extensions ? JSON.stringify(input.extensions) : null,
      deviceType: input.deviceType,
      browserName: input.browserName,
    };

    // Enrich with course hierarchy context
    if (input.courseId) {
      const course = await prisma.course.findUnique({
        where: { id: input.courseId },
        select: { id: true, title: true, slug: true },
      });
      if (course) {
        logData.course = { connect: { id: course.id } };
        logData.courseTitle = course.title;
        logData.courseSlug = course.slug;
      }
    }

    if (input.moduleId) {
      const module = await prisma.courseModule.findUnique({
        where: { id: input.moduleId },
        select: { id: true, title: true, orderIndex: true, courseId: true, course: true },
      });
      if (module) {
        logData.moduleId = module.id;
        logData.moduleTitle = module.title;
        logData.moduleOrder = module.orderIndex;
        if (!input.courseId && module.course) {
          logData.course = { connect: { id: module.course.id } };
          logData.courseTitle = module.course.title;
          logData.courseSlug = module.course.slug;
        }
      }
    }

    if (input.lectureId) {
      const lecture = await prisma.lecture.findUnique({
        where: { id: input.lectureId },
        select: {
          id: true, title: true, orderIndex: true,
          module: {
            select: {
              id: true, title: true, orderIndex: true,
              course: { select: { id: true, title: true, slug: true } },
            },
          },
        },
      });
      if (lecture) {
        logData.lectureId = lecture.id;
        logData.lectureTitle = lecture.title;
        logData.lectureOrder = lecture.orderIndex;
        if (!input.moduleId && lecture.module) {
          logData.moduleId = lecture.module.id;
          logData.moduleTitle = lecture.module.title;
          logData.moduleOrder = lecture.module.orderIndex;
        }
        if (!input.courseId && lecture.module?.course) {
          logData.course = { connect: { id: lecture.module.course.id } };
          logData.courseTitle = lecture.module.course.title;
          logData.courseSlug = lecture.module.course.slug;
        }
      }
    }

    if (input.sectionId) {
      const section = await prisma.lectureSection.findUnique({
        where: { id: input.sectionId },
        select: {
          id: true, title: true, order: true, type: true,
          lecture: {
            select: {
              id: true, title: true, orderIndex: true,
              module: {
                select: {
                  id: true, title: true, orderIndex: true,
                  course: { select: { id: true, title: true, slug: true } },
                },
              },
            },
          },
        },
      });
      if (section) {
        logData.sectionId = section.id;
        logData.sectionTitle = section.title;
        logData.sectionOrder = section.order;
        logData.objectSubtype = input.objectSubtype || section.type;
        if (!input.lectureId && section.lecture) {
          logData.lectureId = section.lecture.id;
          logData.lectureTitle = section.lecture.title;
          logData.lectureOrder = section.lecture.orderIndex;
        }
        if (!input.moduleId && section.lecture?.module) {
          logData.moduleId = section.lecture.module.id;
          logData.moduleTitle = section.lecture.module.title;
          logData.moduleOrder = section.lecture.module.orderIndex;
        }
        if (!input.courseId && section.lecture?.module?.course) {
          logData.course = { connect: { id: section.lecture.module.course.id } };
          logData.courseTitle = section.lecture.module.course.title;
          logData.courseSlug = section.lecture.module.course.slug;
        }
      }
    }

    return prisma.learningActivityLog.create({ data: logData });
  }

  /**
   * Query logs with filters and pagination
   */
  async queryLogs(filters: LogQueryFilters) {
    const { userId, courseId, verb, objectType, startDate, endDate, page = 1, limit = 50 } = filters;

    const where: Prisma.LearningActivityLogWhereInput = {};
    if (userId) where.userId = userId;
    if (courseId) where.courseId = courseId;
    if (verb) where.verb = verb;
    if (objectType) where.objectType = objectType;
    if (startDate || endDate) {
      where.timestamp = {};
      if (startDate) where.timestamp.gte = startDate;
      if (endDate) where.timestamp.lte = endDate;
    }

    const [logs, total] = await Promise.all([
      prisma.learningActivityLog.findMany({
        where,
        orderBy: { timestamp: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.learningActivityLog.count({ where }),
    ]);

    return { logs, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  /**
   * Get aggregated statistics
   */
  async getStats(filters?: { courseId?: number; startDate?: Date; endDate?: Date }) {
    const where: Prisma.LearningActivityLogWhereInput = {};
    if (filters?.courseId) where.courseId = filters.courseId;
    if (filters?.startDate || filters?.endDate) {
      where.timestamp = {};
      if (filters?.startDate) where.timestamp.gte = filters.startDate;
      if (filters?.endDate) where.timestamp.lte = filters.endDate;
    }

    const [totalActivities, verbGroups, objectTypeGroups] = await Promise.all([
      prisma.learningActivityLog.count({ where }),
      prisma.learningActivityLog.groupBy({ by: ['verb'], where, _count: { id: true } }),
      prisma.learningActivityLog.groupBy({ by: ['objectType'], where, _count: { id: true } }),
    ]);

    const activitiesByVerb: Record<string, number> = {};
    verbGroups.forEach((g) => { activitiesByVerb[g.verb] = g._count.id; });

    const activitiesByObjectType: Record<string, number> = {};
    objectTypeGroups.forEach((g) => { activitiesByObjectType[g.objectType] = g._count.id; });

    return { totalActivities, activitiesByVerb, activitiesByObjectType };
  }

  /**
   * Export logs to CSV
   */
  async exportToCsv(filters: LogQueryFilters): Promise<string> {
    const where: Prisma.LearningActivityLogWhereInput = {};
    if (filters.userId) where.userId = filters.userId;
    if (filters.courseId) where.courseId = filters.courseId;
    if (filters.verb) where.verb = filters.verb;
    if (filters.objectType) where.objectType = filters.objectType;
    if (filters.startDate || filters.endDate) {
      where.timestamp = {};
      if (filters.startDate) where.timestamp.gte = filters.startDate;
      if (filters.endDate) where.timestamp.lte = filters.endDate;
    }

    const logs = await prisma.learningActivityLog.findMany({
      where,
      orderBy: { timestamp: 'desc' },
      take: 10000,
    });

    if (logs.length === 0) return 'No data to export';

    const headers = [
      'id', 'timestamp', 'userId', 'userEmail', 'userFullname', 'userRole', 'verb',
      'objectType', 'objectId', 'objectTitle', 'objectSubtype', 'courseId', 'courseTitle',
      'moduleId', 'moduleTitle', 'lectureId', 'lectureTitle', 'sectionId', 'sectionTitle',
      'success', 'score', 'maxScore', 'progress', 'duration', 'deviceType', 'browserName',
    ];

    const escapeCSV = (value: unknown): string => {
      if (value === null || value === undefined) return '';
      const str = String(value);
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const rows = logs.map((log) =>
      headers.map((h) => escapeCSV((log as Record<string, unknown>)[h])).join(',')
    );

    return [headers.join(','), ...rows].join('\n');
  }
}

export const activityLogService = new ActivityLogService();
export default activityLogService;
