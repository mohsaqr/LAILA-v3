import prisma from '../utils/prisma.js';
import { Prisma } from '@prisma/client';
import ExcelJS from 'exceljs';

// Standardized verb types
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
  search?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

class ActivityLogService {
  /**
   * Log an activity with automatic context enrichment
   */
  async logActivity(input: LogActivityInput) {
    console.log('[ActivityLogService] logActivity called:', {
      userId: input.userId,
      verb: input.verb,
      objectType: input.objectType,
      objectId: input.objectId,
      courseId: input.courseId,
      hasExtensions: !!input.extensions,
    });

    // Fetch user data
    const user = await prisma.user.findUnique({
      where: { id: input.userId },
      select: { email: true, fullname: true, isAdmin: true, isInstructor: true },
    });

    if (!user) {
      console.error('[ActivityLogService] User not found:', input.userId);
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

    console.log('[ActivityLogService] Creating log entry with data:', {
      verb: logData.verb,
      objectType: logData.objectType,
      objectId: logData.objectId,
      courseId: logData.course ? 'connected' : 'none',
      hasExtensions: !!logData.extensions,
    });

    const result = await prisma.learningActivityLog.create({ data: logData });
    console.log('[ActivityLogService] Log entry created successfully, id:', result.id);
    return result;
  }

  /**
   * Query logs with filters, pagination, search and sorting
   */
  async queryLogs(filters: LogQueryFilters) {
    const { userId, courseId, verb, objectType, startDate, endDate, page = 1, limit = 50, search, sortBy = 'timestamp', sortOrder = 'desc' } = filters;

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

    // Search across multiple fields
    if (search) {
      where.OR = [
        { userEmail: { contains: search } },
        { userFullname: { contains: search } },
        { objectTitle: { contains: search } },
        { courseTitle: { contains: search } },
        { lectureTitle: { contains: search } },
        { moduleTitle: { contains: search } },
        { sectionTitle: { contains: search } },
      ];
    }

    // Build orderBy based on sortBy field
    const validSortFields = ['timestamp', 'userFullname', 'userEmail', 'verb', 'objectType', 'objectTitle', 'courseTitle', 'progress', 'duration'];
    const orderByField = validSortFields.includes(sortBy) ? sortBy : 'timestamp';
    const orderBy: Prisma.LearningActivityLogOrderByWithRelationInput = { [orderByField]: sortOrder };

    const [logs, total] = await Promise.all([
      prisma.learningActivityLog.findMany({
        where,
        orderBy,
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.learningActivityLog.count({ where }),
    ]);

    // Parse extensions JSON string for each log
    const parsedLogs = logs.map(log => ({
      ...log,
      extensions: log.extensions ? JSON.parse(log.extensions) : null,
    }));

    return { logs: parsedLogs, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
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
   * Export logs to CSV with all 28+ fields
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

    // Search support for CSV export
    if (filters.search) {
      where.OR = [
        { userEmail: { contains: filters.search } },
        { userFullname: { contains: filters.search } },
        { objectTitle: { contains: filters.search } },
        { courseTitle: { contains: filters.search } },
        { lectureTitle: { contains: filters.search } },
        { moduleTitle: { contains: filters.search } },
      ];
    }

    const logs = await prisma.learningActivityLog.findMany({
      where,
      orderBy: { timestamp: 'desc' },
      take: 10000,
    });

    if (logs.length === 0) return 'No data to export';

    const headers = [
      'id', 'timestamp', 'userId', 'userEmail', 'userFullname', 'userRole', 'sessionId',
      'verb', 'objectType', 'objectId', 'objectTitle', 'objectSubtype',
      'courseId', 'courseTitle', 'courseSlug',
      'moduleId', 'moduleTitle', 'moduleOrder',
      'lectureId', 'lectureTitle', 'lectureOrder',
      'sectionId', 'sectionTitle', 'sectionOrder',
      'success', 'score', 'maxScore', 'progress', 'duration',
      'deviceType', 'browserName', 'extensions',
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

  /**
   * Get filter options for dropdowns (users, courses, verbs, objectTypes)
   */
  async getFilterOptions() {
    const [users, courses, verbs, objectTypes] = await Promise.all([
      prisma.learningActivityLog.findMany({
        select: { userId: true, userFullname: true, userEmail: true },
        distinct: ['userId'],
        orderBy: { userFullname: 'asc' },
      }),
      prisma.learningActivityLog.findMany({
        select: { courseId: true, courseTitle: true },
        distinct: ['courseId'],
        where: { courseId: { not: null } },
        orderBy: { courseTitle: 'asc' },
      }),
      prisma.learningActivityLog.groupBy({
        by: ['verb'],
        _count: { id: true },
        orderBy: { verb: 'asc' },
      }),
      prisma.learningActivityLog.groupBy({
        by: ['objectType'],
        _count: { id: true },
        orderBy: { objectType: 'asc' },
      }),
    ]);

    return {
      users: users.map(u => ({ id: u.userId, fullname: u.userFullname, email: u.userEmail })),
      courses: courses.filter(c => c.courseId !== null).map(c => ({ id: c.courseId, title: c.courseTitle })),
      verbs: verbs.map(v => ({ verb: v.verb, count: v._count.id })),
      objectTypes: objectTypes.map(o => ({ objectType: o.objectType, count: o._count.id })),
    };
  }

  /**
   * Export logs to Excel with multiple sheets
   */
  async exportToExcel(filters: LogQueryFilters): Promise<Buffer> {
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

    // Search support
    if (filters.search) {
      where.OR = [
        { userEmail: { contains: filters.search } },
        { userFullname: { contains: filters.search } },
        { objectTitle: { contains: filters.search } },
        { courseTitle: { contains: filters.search } },
        { lectureTitle: { contains: filters.search } },
        { moduleTitle: { contains: filters.search } },
      ];
    }

    const logs = await prisma.learningActivityLog.findMany({
      where,
      orderBy: { timestamp: 'desc' },
      take: 10000,
    });

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'LAILA Learning Analytics';
    workbook.created = new Date();

    // Sheet 1: All Activity Logs (28+ columns)
    const mainSheet = workbook.addWorksheet('Activity Logs');
    mainSheet.columns = [
      { header: 'ID', key: 'id', width: 10 },
      { header: 'Timestamp', key: 'timestamp', width: 20 },
      { header: 'User ID', key: 'userId', width: 10 },
      { header: 'User Email', key: 'userEmail', width: 25 },
      { header: 'User Name', key: 'userFullname', width: 20 },
      { header: 'User Role', key: 'userRole', width: 12 },
      { header: 'Session ID', key: 'sessionId', width: 20 },
      { header: 'Verb', key: 'verb', width: 12 },
      { header: 'Object Type', key: 'objectType', width: 15 },
      { header: 'Object ID', key: 'objectId', width: 10 },
      { header: 'Object Title', key: 'objectTitle', width: 30 },
      { header: 'Object Subtype', key: 'objectSubtype', width: 15 },
      { header: 'Course ID', key: 'courseId', width: 10 },
      { header: 'Course Title', key: 'courseTitle', width: 25 },
      { header: 'Course Slug', key: 'courseSlug', width: 20 },
      { header: 'Module ID', key: 'moduleId', width: 10 },
      { header: 'Module Title', key: 'moduleTitle', width: 20 },
      { header: 'Module Order', key: 'moduleOrder', width: 12 },
      { header: 'Lecture ID', key: 'lectureId', width: 10 },
      { header: 'Lecture Title', key: 'lectureTitle', width: 20 },
      { header: 'Lecture Order', key: 'lectureOrder', width: 12 },
      { header: 'Section ID', key: 'sectionId', width: 10 },
      { header: 'Section Title', key: 'sectionTitle', width: 20 },
      { header: 'Section Order', key: 'sectionOrder', width: 12 },
      { header: 'Success', key: 'success', width: 10 },
      { header: 'Score', key: 'score', width: 10 },
      { header: 'Max Score', key: 'maxScore', width: 10 },
      { header: 'Progress (%)', key: 'progress', width: 12 },
      { header: 'Duration (s)', key: 'duration', width: 12 },
      { header: 'Device Type', key: 'deviceType', width: 12 },
      { header: 'Browser', key: 'browserName', width: 15 },
      { header: 'Extensions', key: 'extensions', width: 50 },
    ];

    // Style header row
    mainSheet.getRow(1).font = { bold: true };
    mainSheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE0E0E0' },
    };

    // Add data rows
    logs.forEach(log => {
      mainSheet.addRow({
        ...log,
        timestamp: log.timestamp.toISOString(),
        extensions: log.extensions || '',
      });
    });

    // Sheet 2: Summary Statistics
    const summarySheet = workbook.addWorksheet('Summary');
    summarySheet.columns = [
      { header: 'Metric', key: 'metric', width: 25 },
      { header: 'Value', key: 'value', width: 20 },
    ];
    summarySheet.getRow(1).font = { bold: true };

    // Calculate summary stats
    const verbCounts: Record<string, number> = {};
    const objectTypeCounts: Record<string, number> = {};
    const userCounts: Record<string, number> = {};
    const courseCounts: Record<string, number> = {};

    logs.forEach(log => {
      verbCounts[log.verb] = (verbCounts[log.verb] || 0) + 1;
      objectTypeCounts[log.objectType] = (objectTypeCounts[log.objectType] || 0) + 1;
      if (log.userEmail) userCounts[log.userEmail] = (userCounts[log.userEmail] || 0) + 1;
      if (log.courseTitle) courseCounts[log.courseTitle] = (courseCounts[log.courseTitle] || 0) + 1;
    });

    summarySheet.addRow({ metric: 'Total Activities', value: logs.length });
    summarySheet.addRow({ metric: 'Unique Users', value: Object.keys(userCounts).length });
    summarySheet.addRow({ metric: 'Unique Courses', value: Object.keys(courseCounts).length });
    summarySheet.addRow({ metric: '', value: '' });
    summarySheet.addRow({ metric: 'Activities by Verb', value: '' });
    Object.entries(verbCounts).forEach(([verb, count]) => {
      summarySheet.addRow({ metric: `  ${verb}`, value: count });
    });
    summarySheet.addRow({ metric: '', value: '' });
    summarySheet.addRow({ metric: 'Activities by Object Type', value: '' });
    Object.entries(objectTypeCounts).forEach(([type, count]) => {
      summarySheet.addRow({ metric: `  ${type}`, value: count });
    });

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }
}

export const activityLogService = new ActivityLogService();
export default activityLogService;
