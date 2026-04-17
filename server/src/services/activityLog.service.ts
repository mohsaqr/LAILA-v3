import prisma from '../utils/prisma.js';
import { Prisma } from '@prisma/client';
import ExcelJS from 'exceljs';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('activity-log');

const isPostgres = (process.env.DATABASE_URL || '').startsWith('postgres');

// Standardized verb types
export type ActivityVerb =
  | 'enrolled' | 'unenrolled' | 'viewed' | 'started' | 'completed'
  | 'progressed' | 'paused' | 'resumed' | 'seeked' | 'scrolled'
  | 'downloaded' | 'submitted' | 'unsubmitted' | 'graded' | 'messaged' | 'received'
  | 'cleared' | 'interacted' | 'expressed' | 'selected' | 'switched'
  | 'designed'
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
  | 'code_lab' | 'ai_tool' | 'prompt_block' | 'user' | 'submission';

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
  actionSubtype?: string;
  eventUuid?: string;
  route?: string;
  /**
   * Client-stamped wall-clock timestamp captured at event push time.
   * Overrides the row's `@default(now())` so parallel batch writes
   * can't shuffle chronological order.
   */
  clientTimestamp?: string;
}

export interface LogQueryFilters {
  userId?: number;
  courseId?: number;
  verb?: string;
  objectType?: string;
  /**
   * Exact match on `action_subtype`, or a prefix with a trailing dot
   * (e.g. `agent_design.` matches every agent design event).
   */
  actionSubtype?: string;
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
    logger.debug({
      userId: input.userId,
      verb: input.verb,
      objectType: input.objectType,
      objectId: input.objectId,
      courseId: input.courseId,
    }, 'logActivity called');

    // Fetch user data
    const user = await prisma.user.findUnique({
      where: { id: input.userId },
      select: { email: true, fullname: true, isAdmin: true, isInstructor: true },
    });

    if (!user) {
      logger.warn({ userId: input.userId }, 'User not found for activity log');
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
      actionSubtype: input.actionSubtype,
      eventUuid: input.eventUuid,
      route: input.route,
      // Honour the client-stamped timestamp when present so the row's
      // chronological position reflects when the user actually did the
      // thing, not when parallel batch writes finished on the server.
      // Falls back to Prisma's @default(now()) when omitted.
      ...(input.clientTimestamp
        ? { timestamp: new Date(input.clientTimestamp) }
        : {}),
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

    logger.debug({
      verb: logData.verb,
      objectType: logData.objectType,
      objectId: logData.objectId,
      hasCourse: !!logData.course,
    }, 'Creating activity log entry');

    // Idempotent insert: if the same (userId, eventUuid) was already logged
    // (e.g. retried batch after a dropped connection), return the existing row
    // instead of creating a duplicate. Legacy events with no eventUuid fall
    // through to a plain create — multiple NULLs are allowed by the unique.
    if (input.eventUuid) {
      try {
        const result = await prisma.learningActivityLog.create({ data: logData });
        logger.debug({ logId: result.id }, 'Activity log entry created');
        return result;
      } catch (err) {
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
          const existing = await prisma.learningActivityLog.findFirst({
            where: { userId: input.userId, eventUuid: input.eventUuid },
          });
          if (existing) {
            logger.debug({ logId: existing.id, eventUuid: input.eventUuid }, 'Activity log dedupe hit');
            return existing;
          }
        }
        throw err;
      }
    }

    const result = await prisma.learningActivityLog.create({ data: logData });
    logger.debug({ logId: result.id }, 'Activity log entry created');
    return result;
  }

  /**
   * Query logs with filters, pagination, search and sorting
   */
  async queryLogs(filters: LogQueryFilters) {
    const { userId, courseId, verb, objectType, actionSubtype, startDate, endDate, page = 1, limit = 50, search, sortBy = 'timestamp', sortOrder = 'desc' } = filters;

    const where: Prisma.LearningActivityLogWhereInput = {};
    if (userId) where.userId = userId;
    if (courseId) where.courseId = courseId;
    if (verb) where.verb = verb;
    if (objectType) where.objectType = objectType;
    if (actionSubtype) {
      // Prefix filter when caller passes "agent_design.", exact otherwise.
      if (actionSubtype.endsWith('.')) {
        where.actionSubtype = { startsWith: actionSubtype };
      } else {
        where.actionSubtype = actionSubtype;
      }
    }
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
   * Get daily activity counts grouped by verb.
   */
  private buildFilters(filters?: { courseId?: number; userId?: number; startDate?: Date; endDate?: Date }) {
    const conditions: string[] = [];
    const params: (string | number | Date)[] = [];
    let idx = 1;
    const ph = () => isPostgres ? `$${idx++}` : '?';

    if (filters?.courseId) {
      conditions.push(`course_id = ${ph()}`);
      params.push(filters.courseId);
    }
    if (filters?.userId) {
      conditions.push(`user_id = ${ph()}`);
      params.push(filters.userId);
    }
    if (filters?.startDate) {
      conditions.push(`timestamp >= ${ph()}`);
      params.push(isPostgres ? filters.startDate : filters.startDate.getTime());
    }
    if (filters?.endDate) {
      conditions.push(`timestamp <= ${ph()}`);
      params.push(isPostgres ? filters.endDate : filters.endDate.getTime());
    }
    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    return { whereClause, params, ph };
  }

  async getDailyCounts(filters?: { courseId?: number; userId?: number; startDate?: Date; endDate?: Date; timezone?: string }) {
    const { whereClause, params } = this.buildFilters(filters);
    const tz = filters?.timezone || 'UTC';

    const dateExpr = isPostgres
      ? `to_char(timestamp AT TIME ZONE '${tz.replace(/'/g, '')}', 'YYYY-MM-DD')`
      : `date(timestamp / 1000, 'unixepoch', 'localtime')`;

    const rows = await prisma.$queryRawUnsafe<Array<{ day: string; verb: string; count: bigint }>>(
      `SELECT ${dateExpr} as day, verb, COUNT(*) as count
       FROM learning_activity_logs
       ${whereClause}
       GROUP BY day, verb
       ORDER BY day ASC, verb ASC`,
      ...params,
    );

    // Build structured response: { days: string[], verbs: string[], series: Record<verb, number[]> }
    const daySet = new Set<string>();
    const verbSet = new Set<string>();
    for (const row of rows) {
      if (!row.day || !row.verb) continue;
      daySet.add(row.day);
      verbSet.add(row.verb);
    }

    const days = Array.from(daySet).sort();
    const verbs = Array.from(verbSet).sort();
    const dayIndex = new Map(days.map((d, i) => [d, i]));

    const series: Record<string, number[]> = {};
    for (const verb of verbs) {
      series[verb] = new Array(days.length).fill(0);
    }
    for (const row of rows) {
      if (!row.day || !row.verb) continue;
      series[row.verb][dayIndex.get(row.day)!] = Number(row.count);
    }

    return { days, verbs, series };
  }

  /**
   * Get summary stats: total activities, unique users, unique sessions, avg per user
   */
  async getSummary(filters?: { courseId?: number; userId?: number; startDate?: Date; endDate?: Date }) {
    const { whereClause, params } = this.buildFilters(filters);

    const rows = await prisma.$queryRawUnsafe<Array<{ total: bigint; uniqueUsers: bigint; uniqueSessions: bigint }>>(
      `SELECT COUNT(*) as total,
              COUNT(DISTINCT user_id) as "uniqueUsers",
              COUNT(DISTINCT session_id) as "uniqueSessions"
       FROM learning_activity_logs
       ${whereClause}`,
      ...params,
    );

    const row = rows[0];
    const totalActivities = Number(row?.total ?? 0);
    const uniqueUsers = Number(row?.uniqueUsers ?? 0);
    const uniqueSessions = Number(row?.uniqueSessions ?? 0);
    const avgPerUser = uniqueUsers > 0 ? Math.round((totalActivities / uniqueUsers) * 10) / 10 : 0;

    return { totalActivities, uniqueUsers, uniqueSessions, avgPerUser };
  }

  /**
   * Get hourly activity counts grouped by day-of-week and hour
   */
  async getHourlyCounts(filters?: { courseId?: number; userId?: number; startDate?: Date; endDate?: Date; timezone?: string }) {
    const { whereClause, params } = this.buildFilters(filters);
    const tz = filters?.timezone || 'UTC';

    const tsExpr = isPostgres ? `timestamp AT TIME ZONE '${tz.replace(/'/g, '')}'` : 'timestamp/1000';
    const dowExpr = isPostgres
      ? `EXTRACT(DOW FROM ${tsExpr})::integer`
      : `cast(strftime('%w', ${tsExpr}, 'unixepoch', 'localtime') as integer)`;
    const hourExpr = isPostgres
      ? `EXTRACT(HOUR FROM ${tsExpr})::integer`
      : `cast(strftime('%H', ${tsExpr}, 'unixepoch', 'localtime') as integer)`;

    const rows = await prisma.$queryRawUnsafe<Array<{ dow: bigint; hour: bigint; count: bigint }>>(
      `SELECT ${dowExpr} as dow,
              ${hourExpr} as hour,
              COUNT(*) as count
       FROM learning_activity_logs
       ${whereClause}
       GROUP BY dow, hour
       ORDER BY dow, hour`,
      ...params,
    );

    return {
      data: rows.map(r => ({ dow: Number(r.dow), hour: Number(r.hour), count: Number(r.count) })),
    };
  }

  /**
   * Get top N most visited resources/activities by count
   */
  async getTopResources(filters?: { courseId?: number; userId?: number; startDate?: Date; endDate?: Date; limit?: number }) {
    const { whereClause: baseWhere, params, ph } = this.buildFilters(filters);

    const extraConditions = ["object_title IS NOT NULL", "object_title != ''"];
    const whereClause = baseWhere
      ? `${baseWhere} AND ${extraConditions.join(' AND ')}`
      : `WHERE ${extraConditions.join(' AND ')}`;

    const lim = filters?.limit ?? 10;
    const limPh = ph();
    params.push(lim);

    const rows = await prisma.$queryRawUnsafe<Array<{
      objectType: string;
      objectTitle: string | null;
      objectId: number | null;
      count: bigint;
      uniqueUsers: bigint;
    }>>(
      `SELECT object_type as "objectType",
              object_title as "objectTitle",
              object_id as "objectId",
              COUNT(*) as count,
              COUNT(DISTINCT user_id) as "uniqueUsers"
       FROM learning_activity_logs
       ${whereClause}
       GROUP BY object_type, object_title, object_id
       ORDER BY count DESC
       LIMIT ${limPh}`,
      ...params,
    );

    return {
      data: rows.map(r => ({
        objectType: r.objectType,
        objectTitle: r.objectTitle ?? 'Unknown',
        objectId: r.objectId ? Number(r.objectId) : null,
        count: Number(r.count),
        uniqueUsers: Number(r.uniqueUsers),
      })),
    };
  }

  /**
   * Parse the stringified `extensions` JSON on each row and collect the
   * union of all top-level keys found across the corpus. Used by the
   * CSV and Excel exporters to flatten extensions into first-class
   * columns — admins get readable per-field columns instead of a single
   * mega-JSON string that Excel can't parse.
   *
   * Returns the per-row parsed objects (in the same order as `logs`)
   * and the sorted union of keys.
   */
  private flattenExtensions<T extends { extensions: string | null }>(
    logs: T[]
  ): { parsed: Array<Record<string, unknown>>; keys: string[] } {
    const keys = new Set<string>();
    const parsed: Array<Record<string, unknown>> = logs.map((log) => {
      if (!log.extensions) return {};
      try {
        const obj = JSON.parse(log.extensions);
        if (obj && typeof obj === 'object' && !Array.isArray(obj)) {
          for (const k of Object.keys(obj)) keys.add(k);
          return obj as Record<string, unknown>;
        }
      } catch {
        /* malformed — fall through to empty object */
      }
      return {};
    });
    return { parsed, keys: Array.from(keys).sort() };
  }

  /** Render an extension value as a single cell (primitive → string,
   *  object/array → JSON, null/undefined → empty). */
  private renderExtensionCell(value: unknown): string {
    if (value === null || value === undefined) return '';
    if (typeof value === 'object') {
      try {
        return JSON.stringify(value);
      } catch {
        return String(value);
      }
    }
    return String(value);
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

    // Flatten extensions into first-class `ext_*` columns so admins can
    // actually read the export in Excel/Sheets. The original JSON blob
    // is kept as the final column so anyone using it programmatically
    // still has the raw source.
    const { parsed: parsedExtensions, keys: extensionKeys } =
      this.flattenExtensions(logs);

    const baseHeaders = [
      'id', 'timestamp', 'userId', 'userEmail', 'userFullname', 'userRole', 'sessionId',
      'verb', 'objectType', 'objectId', 'objectTitle', 'objectSubtype',
      'actionSubtype', 'route',
      'courseId', 'courseTitle', 'courseSlug',
      'moduleId', 'moduleTitle', 'moduleOrder',
      'lectureId', 'lectureTitle', 'lectureOrder',
      'sectionId', 'sectionTitle', 'sectionOrder',
      'success', 'score', 'maxScore', 'progress', 'duration',
      'deviceType', 'browserName',
    ];
    const extensionHeaders = extensionKeys.map((k) => `ext_${k}`);
    const headers = [...baseHeaders, ...extensionHeaders, 'extensions_raw'];

    const escapeCSV = (value: unknown): string => {
      if (value === null || value === undefined) return '';
      const str = String(value);
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const rows = logs.map((log, idx) => {
      const baseCells = baseHeaders.map((h) =>
        escapeCSV((log as Record<string, unknown>)[h])
      );
      const extensionCells = extensionKeys.map((k) =>
        escapeCSV(this.renderExtensionCell(parsedExtensions[idx][k]))
      );
      const rawCell = escapeCSV(log.extensions ?? '');
      return [...baseCells, ...extensionCells, rawCell].join(',');
    });

    return [headers.join(','), ...rows].join('\n');
  }

  /**
   * Get filter options for dropdowns (users, courses, verbs, objectTypes)
   */
  async getFilterOptions(options?: { courseId?: number; instructorId?: number; isAdmin?: boolean }) {
    // Build course filter for instructors (only their own courses)
    let courseWhere: any = { courseId: { not: null } };
    let courseIds: number[] | undefined;

    if (options?.instructorId && !options?.isAdmin) {
      // Instructor: only courses they own or are a team member of
      const ownedCourses = await prisma.course.findMany({
        where: { instructorId: options.instructorId },
        select: { id: true },
      });
      const teamCourses = await prisma.courseRole.findMany({
        where: { userId: options.instructorId },
        select: { courseId: true },
      });
      courseIds = [...new Set([...ownedCourses.map(c => c.id), ...teamCourses.map(c => c.courseId)])];
      courseWhere = { courseId: { in: courseIds } };
    }

    // If a specific course is selected, filter users by enrollment in that course
    let userQuery;
    if (options?.courseId) {
      userQuery = prisma.enrollment.findMany({
        where: { courseId: options.courseId },
        select: { user: { select: { id: true, fullname: true, email: true } } },
        orderBy: { user: { fullname: 'asc' } },
      }).then(enrollments => enrollments.map(e => ({
        id: e.user.id,
        fullname: e.user.fullname,
        email: e.user.email,
      })));
    } else {
      userQuery = prisma.learningActivityLog.findMany({
        select: { userId: true, userFullname: true, userEmail: true },
        distinct: ['userId'],
        orderBy: { userFullname: 'asc' },
      }).then(users => users.map(u => ({
        id: u.userId,
        fullname: u.userFullname,
        email: u.userEmail,
      })));
    }

    const [users, courses, verbs, objectTypes] = await Promise.all([
      userQuery,
      prisma.learningActivityLog.findMany({
        select: { courseId: true, courseTitle: true },
        distinct: ['courseId'],
        where: courseWhere,
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
      users,
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

    // Flatten extensions into first-class `ext_*` columns so the sheet
    // is actually readable instead of a single JSON-blob column.
    const { parsed: parsedExtensions, keys: extensionKeys } =
      this.flattenExtensions(logs);

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'LAILA Learning Analytics';
    workbook.created = new Date();

    // Sheet 1: All Activity Logs — core columns + one column per
    // discovered extension key + the raw JSON as a safety net.
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
      { header: 'Action Subtype', key: 'actionSubtype', width: 28 },
      { header: 'Route', key: 'route', width: 30 },
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
      // One column per discovered extension key
      ...extensionKeys.map((k) => ({
        header: `ext_${k}`,
        key: `ext_${k}`,
        width: 22,
      })),
      { header: 'Extensions (raw JSON)', key: 'extensions_raw', width: 50 },
    ];

    // Style header row
    mainSheet.getRow(1).font = { bold: true };
    mainSheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE0E0E0' },
    };

    // Add data rows
    logs.forEach((log, idx) => {
      const extCells: Record<string, string> = {};
      for (const k of extensionKeys) {
        extCells[`ext_${k}`] = this.renderExtensionCell(parsedExtensions[idx][k]);
      }
      mainSheet.addRow({
        ...log,
        timestamp: log.timestamp.toISOString(),
        ...extCells,
        extensions_raw: log.extensions || '',
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

  /**
   * Merge map: semantically similar verbs → canonical label.
   * Applied before frequency filtering so merged verbs pool their counts.
   */
  static readonly VERB_MERGES: Record<string, string> = {};

  /**
   * Get TNA sequences: groups activity verbs per user into sequences.
   *
   * @param minVerbPct – verbs whose share of total events falls below this
   *   fraction (0–1, default 0.05 = 5%) are replaced with "other".
   *   Pass 0 to disable frequency filtering.
   */
  async getTnaSequences(filters?: {
    courseId?: number;
    userId?: number;
    startDate?: Date;
    endDate?: Date;
    minSequenceLength?: number;
    minVerbPct?: number;
    skipMerges?: boolean;
    groupBy?: 'actor' | 'actor-session';
  }) {
    const where: Prisma.LearningActivityLogWhereInput = {};
    if (filters?.courseId) where.courseId = filters.courseId;
    if (filters?.userId) where.userId = filters.userId;
    if (filters?.startDate || filters?.endDate) {
      where.timestamp = {};
      if (filters?.startDate) where.timestamp.gte = filters.startDate;
      if (filters?.endDate) where.timestamp.lte = filters.endDate;
    }

    const minLen = filters?.minSequenceLength ?? 2;
    const minVerbPct = filters?.minVerbPct ?? 0.05;
    const groupBy = filters?.groupBy ?? 'actor';

    const logs = await prisma.learningActivityLog.findMany({
      where,
      select: { userId: true, verb: true, objectType: true, timestamp: true, courseTitle: true, sessionId: true },
      orderBy: [{ userId: 'asc' }, { timestamp: 'asc' }],
      take: 50000,
    });

    // 1. Apply verb merges (unless skipped — client handles its own merging)
    if (!filters?.skipMerges) {
      const merges = ActivityLogService.VERB_MERGES;
      for (const log of logs) {
        if (merges[log.verb]) log.verb = merges[log.verb];
      }
    }

    // 2. Count verb frequencies across all events
    const verbCounts: Record<string, number> = {};
    for (const log of logs) {
      verbCounts[log.verb] = (verbCounts[log.verb] ?? 0) + 1;
    }

    // 3. Determine which verbs fall below the threshold
    const totalEvents = logs.length;
    const rareVerbs = new Set<string>();
    if (minVerbPct > 0 && totalEvents > 0) {
      for (const [verb, count] of Object.entries(verbCounts)) {
        if (count / totalEvents < minVerbPct) {
          rareVerbs.add(verb);
        }
      }
    }

    // 4. Group into sequences by actor or actor-session
    const seqMap: Record<string, string[]> = {};
    const objMap: Record<string, string[]> = {};
    for (const log of logs) {
      const key = groupBy === 'actor-session' && log.sessionId
        ? `${log.userId}::${log.sessionId}`
        : String(log.userId);
      if (!seqMap[key]) {
        seqMap[key] = [];
        objMap[key] = [];
      }
      const verb = rareVerbs.has(log.verb) ? 'other' : log.verb;
      seqMap[key].push(verb);
      objMap[key].push(log.objectType);
    }

    // Filter by min sequence length
    const rawSeqs: string[][] = [];
    const rawObjSeqs: string[][] = [];
    for (const key of Object.keys(seqMap)) {
      if (seqMap[key].length >= minLen) {
        rawSeqs.push(seqMap[key]);
        rawObjSeqs.push(objMap[key]);
      }
    }

    // Split overly long sequences (beyond 95th percentile) into chunks
    const sequences: string[][] = [];
    const objectTypeSequences: string[][] = [];
    if (rawSeqs.length > 0) {
      const lengths = rawSeqs.map(s => s.length).sort((a, b) => a - b);
      const p95Idx = Math.floor(lengths.length * 0.95);
      const p95 = lengths[Math.min(p95Idx, lengths.length - 1)];
      const maxLen = Math.max(p95, minLen * 2); // never split below 2× minLen

      for (let i = 0; i < rawSeqs.length; i++) {
        if (rawSeqs[i].length <= maxLen) {
          sequences.push(rawSeqs[i]);
          objectTypeSequences.push(rawObjSeqs[i]);
        } else {
          // Split into chunks of maxLen with no overlap
          for (let start = 0; start < rawSeqs[i].length; start += maxLen) {
            const chunk = rawSeqs[i].slice(start, start + maxLen);
            const objChunk = rawObjSeqs[i].slice(start, start + maxLen);
            if (chunk.length >= minLen) {
              sequences.push(chunk);
              objectTypeSequences.push(objChunk);
            }
          }
        }
      }
    }

    // Collect unique verbs and object types
    const uniqueVerbs = new Set<string>();
    const uniqueObjectTypes = new Set<string>();
    for (let i = 0; i < sequences.length; i++) {
      for (const v of sequences[i]) uniqueVerbs.add(v);
      for (const o of objectTypeSequences[i]) uniqueObjectTypes.add(o);
    }

    // Date range
    let dateRange: { start: string; end: string } | null = null;
    if (logs.length > 0) {
      dateRange = {
        start: logs[0].timestamp.toISOString(),
        end: logs[logs.length - 1].timestamp.toISOString(),
      };
    }

    // Course title (from first log with a course)
    const courseTitle = logs.find(l => l.courseTitle)?.courseTitle || null;

    return {
      sequences,
      objectTypeSequences,
      metadata: {
        totalSequences: sequences.length,
        totalEvents: totalEvents,
        groupBy,
        uniqueVerbs: Array.from(uniqueVerbs).sort(),
        uniqueObjectTypes: Array.from(uniqueObjectTypes).sort(),
        courseTitle,
        dateRange,
      },
    };
  }
}

export const activityLogService = new ActivityLogService();
export default activityLogService;
