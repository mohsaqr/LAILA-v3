import { Router, Response } from 'express';
import { activityLogService, LogActivityInput } from '../services/activityLog.service.js';
import { authenticateToken } from '../middleware/auth.middleware.js';
import { asyncHandler, AppError } from '../middleware/error.middleware.js';
import { AuthRequest, UserPayload } from '../types/index.js';
import { courseRoleService } from '../services/courseRole.service.js';
import { z } from 'zod';
import prisma from '../utils/prisma.js';

const router = Router();

/**
 * Resolve which activity-log data this caller may read.
 *
 * The activity trail is per-user xAPI data, so every read/export endpoint must
 * be scoped. This mirrors the policy already enforced inline by /tna-sequences:
 *   - Admin: unrestricted (any user, any course, or platform-wide aggregates).
 *   - Instructor: must scope to a course they own or hold `view_analytics` in;
 *     may query any student within that course.
 *   - Student: must scope to an enrolled course and is forced to their own id,
 *     regardless of the userId they asked for.
 *
 * Returns the effective { courseId, userId } to feed into the service filters,
 * or throws AppError(403) when the requested scope is not permitted.
 */
async function resolveActivityLogScope(
  user: UserPayload,
  requestedCourseId: number | undefined,
  requestedUserId: number | undefined,
): Promise<{ courseId: number | undefined; userId: number | undefined }> {
  if (user.isAdmin) {
    return { courseId: requestedCourseId, userId: requestedUserId };
  }

  if (!requestedCourseId) {
    throw new AppError('Course ID is required', 403);
  }

  if (user.isInstructor) {
    const owns = await prisma.course.findFirst({
      where: { id: requestedCourseId, instructorId: user.id },
      select: { id: true },
    });
    if (!owns) {
      const canView = await courseRoleService.hasPermission(user.id, requestedCourseId, 'view_analytics');
      if (!canView) {
        throw new AppError('Access denied to this course', 403);
      }
    }
    return { courseId: requestedCourseId, userId: requestedUserId };
  }

  // Student: must be enrolled, and only ever sees their own trail.
  const enrollment = await prisma.enrollment.findFirst({
    where: { courseId: requestedCourseId, userId: user.id },
    select: { id: true },
  });
  if (!enrollment) {
    throw new AppError('Access denied to this course', 403);
  }
  return { courseId: requestedCourseId, userId: user.id };
}

// Valid verbs and object types
const validVerbs = [
  'enrolled', 'unenrolled', 'viewed', 'started', 'completed', 'progressed',
  'submitted', 'unsubmitted', 'interacted', 'downloaded', 'selected',
  'designed', 'created', 'updated', 'deleted',
  // xAPI Video Profile verbs for lesson video tracking (see client
  // services/videoXapi.ts). `progressed` stays the watch-progress heartbeat.
  'initialized', 'played', 'paused', 'seeked', 'abandoned', 'terminated',
  'playback-rate-changed',
] as const;

const validObjectTypes = [
  'course', 'module', 'lecture', 'section', 'video',
  'assignment', 'chatbot', 'file', 'quiz',
  'emotional_pulse', 'tutor_agent', 'tutor_session', 'tutor_conversation',
  'course_tutor', 'course_tutor_conversation',
  'assignment_agent', 'agent_conversation',
  'lab', 'forum', 'certificate', 'survey', 'gradebook',
  'dashboard', 'profile', 'catalog', 'analytics',
  'settings', 'calendar', 'enrollment', 'curriculum',
  'code_lab', 'ai_tool', 'prompt_block', 'user', 'submission',
  'page',
] as const;

// Validation schemas
const logActivitySchema = z.object({
  verb: z.enum(validVerbs),
  objectType: z.enum(validObjectTypes),
  objectId: z.number().optional(),
  objectTitle: z.string().optional(),
  objectSubtype: z.string().optional(),
  courseId: z.number().optional(),
  moduleId: z.number().optional(),
  lectureId: z.number().optional(),
  sectionId: z.number().optional(),
  success: z.boolean().optional(),
  score: z.number().optional(),
  maxScore: z.number().optional(),
  progress: z.number().min(0).max(100).optional(),
  duration: z.number().min(0).optional(),
  extensions: z.record(z.unknown()).optional(),
  sessionId: z.string().optional(),
  deviceType: z.enum(['desktop', 'tablet', 'mobile']).optional(),
  browserName: z.string().optional(),
  actionSubtype: z.string().max(128).optional(),
  eventUuid: z.string().max(64).optional(),
  route: z.string().max(512).optional(),
  clientTimestamp: z.string().datetime().optional(),
});

const BATCH_MAX = 500;
const batchLogSchema = z.object({
  activities: z.array(logActivitySchema).min(1).max(BATCH_MAX),
});

// ============================================================================
// LOG ACTIVITY ENDPOINTS
// ============================================================================

/**
 * POST /api/activity-log
 * Log a single activity (requires authentication)
 */
router.post('/', authenticateToken, asyncHandler(async (req: AuthRequest, res: Response) => {
  const data = logActivitySchema.parse(req.body);
  const input: LogActivityInput = {
    ...data,
    userId: req.user!.id,
    verb: data.verb,
    objectType: data.objectType,
  };
  const log = await activityLogService.logActivity(input);
  res.status(201).json({ success: true, data: log });
}));

/**
 * POST /api/activity-log/batch
 * Log multiple activities
 */
router.post('/batch', authenticateToken, asyncHandler(async (req: AuthRequest, res: Response) => {
  // Validate the batch wrapper (must have activities array)
  const rawActivities = req.body?.activities;
  if (!Array.isArray(rawActivities) || rawActivities.length === 0 || rawActivities.length > BATCH_MAX) {
    res.status(400).json({ success: false, error: `activities must be an array with 1-${BATCH_MAX} items` });
    return;
  }

  // Per-item validation: skip invalid events instead of rejecting the entire batch
  const validActivities: z.infer<typeof logActivitySchema>[] = [];
  const errors: Array<{ index: number; error: string }> = [];

  for (let i = 0; i < rawActivities.length; i++) {
    const result = logActivitySchema.safeParse(rawActivities[i]);
    if (result.success) {
      validActivities.push(result.data);
    } else {
      errors.push({ index: i, error: result.error.issues[0]?.message || 'Validation failed' });
    }
  }

  const results = await Promise.all(
    validActivities.map((activity) =>
      activityLogService.logActivity({
        ...activity,
        userId: req.user!.id,
        verb: activity.verb,
        objectType: activity.objectType,
      })
    )
  );

  res.status(201).json({
    success: true,
    data: results,
    count: results.length,
    ...(errors.length > 0 ? { skipped: errors.length, errors } : {}),
  });
}));

// ============================================================================
// QUERY ENDPOINTS (Admin only)
// ============================================================================

/**
 * GET /api/activity-log
 * Query logs with filters, search, and sorting
 */
router.get('/', authenticateToken, asyncHandler(async (req: AuthRequest, res: Response) => {
  const scope = await resolveActivityLogScope(
    req.user!,
    req.query.courseId ? parseInt(req.query.courseId as string) : undefined,
    req.query.userId ? parseInt(req.query.userId as string) : undefined,
  );

  const filters = {
    userId: scope.userId,
    courseId: scope.courseId,
    verb: req.query.verb as string | undefined,
    objectType: req.query.objectType as string | undefined,
    actionSubtype: req.query.actionSubtype as string | undefined,
    startDate: req.query.startDate ? new Date(req.query.startDate as string) : undefined,
    endDate: req.query.endDate ? new Date(req.query.endDate as string) : undefined,
    page: req.query.page ? parseInt(req.query.page as string) : 1,
    limit: req.query.limit ? Math.min(parseInt(req.query.limit as string), 200) : 50,
    search: req.query.search as string | undefined,
    sortBy: req.query.sortBy as string | undefined,
    sortOrder: (req.query.sortOrder as 'asc' | 'desc') || 'desc',
  };

  const result = await activityLogService.queryLogs(filters);
  res.json({ success: true, ...result });
}));

/**
 * GET /api/activity-log/stats
 * Get aggregated statistics
 */
router.get('/stats', authenticateToken, asyncHandler(async (req: AuthRequest, res: Response) => {
  const scope = await resolveActivityLogScope(
    req.user!,
    req.query.courseId ? parseInt(req.query.courseId as string) : undefined,
    undefined,
  );

  const filters = {
    courseId: scope.courseId,
    userId: scope.userId,
    startDate: req.query.startDate ? new Date(req.query.startDate as string) : undefined,
    endDate: req.query.endDate ? new Date(req.query.endDate as string) : undefined,
  };

  const stats = await activityLogService.getStats(filters);
  res.json({ success: true, data: stats });
}));

/**
 * GET /api/activity-log/filter-options
 * Get available filter options for dropdowns (users, courses, verbs, objectTypes)
 */
router.get('/filter-options', authenticateToken, asyncHandler(async (req: AuthRequest, res: Response) => {
  const courseId = req.query.courseId ? parseInt(req.query.courseId as string) : undefined;
  // A non-privileged user (student) is pinned to their own id via
  // restrictToUserId, so the user dropdown — and the course/verb lists — are
  // built only from their own activity, never the whole platform or an
  // arbitrary course roster. Instructors/admins keep the course-scoped view.
  const isPrivileged = req.user!.isAdmin || req.user!.isInstructor;
  const options = await activityLogService.getFilterOptions({
    courseId,
    restrictToUserId: isPrivileged ? undefined : req.user!.id,
    instructorId: req.user!.isInstructor && !req.user!.isAdmin ? req.user!.id : undefined,
    isAdmin: req.user!.isAdmin,
  });
  res.json({ success: true, data: options });
}));

/**
 * GET /api/activity-log/summary
 * Get summary stats (total, unique users, unique sessions, avg per user)
 */
router.get('/summary', authenticateToken, asyncHandler(async (req: AuthRequest, res: Response) => {
  const scope = await resolveActivityLogScope(
    req.user!,
    req.query.courseId ? parseInt(req.query.courseId as string) : undefined,
    req.query.userId ? parseInt(req.query.userId as string) : undefined,
  );

  const filters = {
    courseId: scope.courseId,
    userId: scope.userId,
    startDate: req.query.startDate ? new Date(req.query.startDate as string) : undefined,
    endDate: req.query.endDate ? new Date(req.query.endDate as string) : undefined,
  };

  const data = await activityLogService.getSummary(filters);
  res.json({ success: true, data });
}));

/**
 * GET /api/activity-log/hourly-counts
 * Get activity counts grouped by day-of-week and hour
 */
router.get('/hourly-counts', authenticateToken, asyncHandler(async (req: AuthRequest, res: Response) => {
  const scope = await resolveActivityLogScope(
    req.user!,
    req.query.courseId ? parseInt(req.query.courseId as string) : undefined,
    req.query.userId ? parseInt(req.query.userId as string) : undefined,
  );

  const filters = {
    courseId: scope.courseId,
    userId: scope.userId,
    startDate: req.query.startDate ? new Date(req.query.startDate as string) : undefined,
    endDate: req.query.endDate ? new Date(req.query.endDate as string) : undefined,
  };

  const timezone = (req.query.timezone as string) || undefined;
  const data = await activityLogService.getHourlyCounts({ ...filters, timezone });
  res.json({ success: true, data });
}));

/**
 * GET /api/activity-log/top-resources
 * Get top N most visited resources/activities
 */
router.get('/top-resources', authenticateToken, asyncHandler(async (req: AuthRequest, res: Response) => {
  const scope = await resolveActivityLogScope(
    req.user!,
    req.query.courseId ? parseInt(req.query.courseId as string) : undefined,
    req.query.userId ? parseInt(req.query.userId as string) : undefined,
  );

  const filters = {
    courseId: scope.courseId,
    userId: scope.userId,
    startDate: req.query.startDate ? new Date(req.query.startDate as string) : undefined,
    endDate: req.query.endDate ? new Date(req.query.endDate as string) : undefined,
    limit: req.query.limit ? parseInt(req.query.limit as string) : 10,
  };

  const data = await activityLogService.getTopResources(filters);
  res.json({ success: true, data });
}));

/**
 * GET /api/activity-log/resource-metrics
 * Per-resource usage metrics (volume, reach, recency, verb breakdown)
 * for the analytics Resources tab
 */
router.get('/resource-metrics', authenticateToken, asyncHandler(async (req: AuthRequest, res: Response) => {
  const scope = await resolveActivityLogScope(
    req.user!,
    req.query.courseId ? parseInt(req.query.courseId as string) : undefined,
    req.query.userId ? parseInt(req.query.userId as string) : undefined,
  );

  const filters = {
    courseId: scope.courseId,
    userId: scope.userId,
    startDate: req.query.startDate ? new Date(req.query.startDate as string) : undefined,
    endDate: req.query.endDate ? new Date(req.query.endDate as string) : undefined,
    limit: req.query.limit ? parseInt(req.query.limit as string) : undefined,
  };

  const data = await activityLogService.getResourceMetrics(filters);
  res.json({ success: true, data });
}));

/**
 * GET /api/activity-log/resource-detail
 * Analytics drill-down for a single resource (objectType + objectId/objectTitle)
 */
router.get('/resource-detail', authenticateToken, asyncHandler(async (req: AuthRequest, res: Response) => {
  const objectType = req.query.objectType as string | undefined;
  if (!objectType) {
    res.status(400).json({ success: false, error: 'objectType is required' });
    return;
  }

  const scope = await resolveActivityLogScope(
    req.user!,
    req.query.courseId ? parseInt(req.query.courseId as string) : undefined,
    req.query.userId ? parseInt(req.query.userId as string) : undefined,
  );

  const data = await activityLogService.getResourceDetail({
    objectType,
    // objectId=null (explicit "null") matches rows with no id; absent = don't filter on id
    objectId: req.query.objectId === 'null' ? null
      : req.query.objectId ? parseInt(req.query.objectId as string) : undefined,
    objectTitle: (req.query.objectTitle as string) || undefined,
    courseId: scope.courseId,
    userId: scope.userId,
    startDate: req.query.startDate ? new Date(req.query.startDate as string) : undefined,
    endDate: req.query.endDate ? new Date(req.query.endDate as string) : undefined,
    timezone: (req.query.timezone as string) || undefined,
  });
  res.json({ success: true, data });
}));

/**
 * GET /api/activity-log/top-users
 * Most-active users, optionally filtered by a name/email search
 */
router.get('/top-users', authenticateToken, asyncHandler(async (req: AuthRequest, res: Response) => {
  const scope = await resolveActivityLogScope(
    req.user!,
    req.query.courseId ? parseInt(req.query.courseId as string) : undefined,
    req.query.userId ? parseInt(req.query.userId as string) : undefined,
  );

  const data = await activityLogService.getTopUsers({
    courseId: scope.courseId,
    userId: scope.userId,
    startDate: req.query.startDate ? new Date(req.query.startDate as string) : undefined,
    endDate: req.query.endDate ? new Date(req.query.endDate as string) : undefined,
    search: (req.query.search as string) || undefined,
    limit: req.query.limit ? parseInt(req.query.limit as string) : 10,
  });
  res.json({ success: true, data });
}));

/**
 * GET /api/activity-log/user-detail
 * Analytics drill-down for a single user (students only ever see themselves)
 */
router.get('/user-detail', authenticateToken, asyncHandler(async (req: AuthRequest, res: Response) => {
  const scope = await resolveActivityLogScope(
    req.user!,
    req.query.courseId ? parseInt(req.query.courseId as string) : undefined,
    req.query.userId ? parseInt(req.query.userId as string) : undefined,
  );

  const userId = scope.userId;
  if (!userId) {
    res.status(400).json({ success: false, error: 'userId is required' });
    return;
  }

  const data = await activityLogService.getUserDetail({
    userId,
    courseId: scope.courseId,
    startDate: req.query.startDate ? new Date(req.query.startDate as string) : undefined,
    endDate: req.query.endDate ? new Date(req.query.endDate as string) : undefined,
    timezone: (req.query.timezone as string) || undefined,
  });
  res.json({ success: true, data });
}));

/**
 * GET /api/activity-log/daily-counts
 * Get daily activity counts grouped by verb
 */
router.get('/daily-counts', authenticateToken, asyncHandler(async (req: AuthRequest, res: Response) => {
  const scope = await resolveActivityLogScope(
    req.user!,
    req.query.courseId ? parseInt(req.query.courseId as string) : undefined,
    req.query.userId ? parseInt(req.query.userId as string) : undefined,
  );

  const filters = {
    courseId: scope.courseId,
    userId: scope.userId,
    startDate: req.query.startDate ? new Date(req.query.startDate as string) : undefined,
    endDate: req.query.endDate ? new Date(req.query.endDate as string) : undefined,
  };

  const timezone = (req.query.timezone as string) || undefined;
  const data = await activityLogService.getDailyCounts({ ...filters, timezone });
  res.json({ success: true, data });
}));

/**
 * GET /api/activity-log/events
 * Slim raw-event feed (timestamp, user, verb, objectType, objectTitle) for
 * the client-side Carmdash visualizations. Capped at 50k rows.
 */
router.get('/events', authenticateToken, asyncHandler(async (req: AuthRequest, res: Response) => {
  const scope = await resolveActivityLogScope(
    req.user!,
    req.query.courseId ? parseInt(req.query.courseId as string) : undefined,
    req.query.userId ? parseInt(req.query.userId as string) : undefined,
  );

  const data = await activityLogService.getEvents({
    courseId: scope.courseId,
    userId: scope.userId,
    startDate: req.query.startDate ? new Date(req.query.startDate as string) : undefined,
    endDate: req.query.endDate ? new Date(req.query.endDate as string) : undefined,
    limit: Number.isFinite(parseInt(req.query.limit as string)) ? parseInt(req.query.limit as string) : undefined,
  });
  res.json({ success: true, data });
}));

/**
 * GET /api/activity-log/export
 * Export logs as CSV or JSON
 */
router.get('/export', authenticateToken, asyncHandler(async (req: AuthRequest, res: Response) => {
  const scope = await resolveActivityLogScope(
    req.user!,
    req.query.courseId ? parseInt(req.query.courseId as string) : undefined,
    req.query.userId ? parseInt(req.query.userId as string) : undefined,
  );

  const filters = {
    userId: scope.userId,
    courseId: scope.courseId,
    verb: req.query.verb as string | undefined,
    objectType: req.query.objectType as string | undefined,
    startDate: req.query.startDate ? new Date(req.query.startDate as string) : undefined,
    endDate: req.query.endDate ? new Date(req.query.endDate as string) : undefined,
    search: req.query.search as string | undefined,
  };

  const format = (req.query.format as string) || 'csv';

  if (format === 'json') {
    const result = await activityLogService.queryLogs({ ...filters, page: 1, limit: 10000 });
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="activity-logs-${new Date().toISOString().split('T')[0]}.json"`);
    res.json(result.logs);
  } else {
    const csv = await activityLogService.exportToCsv(filters);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="activity-logs-${new Date().toISOString().split('T')[0]}.csv"`);
    res.send(csv);
  }
}));

/**
 * GET /api/activity-log/export/excel
 * Export logs as Excel file with multiple sheets
 */
router.get('/export/excel', authenticateToken, asyncHandler(async (req: AuthRequest, res: Response) => {
  const scope = await resolveActivityLogScope(
    req.user!,
    req.query.courseId ? parseInt(req.query.courseId as string) : undefined,
    req.query.userId ? parseInt(req.query.userId as string) : undefined,
  );

  const filters = {
    userId: scope.userId,
    courseId: scope.courseId,
    verb: req.query.verb as string | undefined,
    objectType: req.query.objectType as string | undefined,
    startDate: req.query.startDate ? new Date(req.query.startDate as string) : undefined,
    endDate: req.query.endDate ? new Date(req.query.endDate as string) : undefined,
    search: req.query.search as string | undefined,
  };

  const buffer = await activityLogService.exportToExcel(filters);
  const filename = `activity-logs-${new Date().toISOString().split('T')[0]}.xlsx`;

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(buffer);
}));

/**
 * GET /api/activity-log/tna-sequences
 * Get activity verb sequences grouped by user for TNA analysis.
 *
 * Authorization:
 * - Admin: full access, any courseId or none (all courses)
 * - Instructor: must provide courseId, must own the course
 * - Student: must provide courseId, must be enrolled, results filtered to own userId
 */
router.get('/tna-sequences', authenticateToken, asyncHandler(async (req: AuthRequest, res: Response) => {
  const user = req.user!;
  const courseId = req.query.courseId ? parseInt(req.query.courseId as string) : undefined;
  let userId = req.query.userId ? parseInt(req.query.userId as string) : undefined;

  // Authorization checks
  if (!user.isAdmin) {
    // Non-admins must specify a courseId
    if (!courseId) {
      res.status(403).json({ success: false, error: 'Course ID is required' });
      return;
    }

    if (user.isInstructor) {
      // Instructors must own the course
      const course = await prisma.course.findFirst({
        where: { id: courseId, instructorId: user.id },
        select: { id: true },
      });
      if (!course) {
        // Also check course roles (TA, co-instructor)
        const courseRole = await prisma.courseRole.findFirst({
          where: { courseId, userId: user.id },
          select: { id: true },
        });
        if (!courseRole) {
          res.status(403).json({ success: false, error: 'Access denied to this course' });
          return;
        }
      }
    } else {
      // Students must be enrolled and can only see their own data
      const enrollment = await prisma.enrollment.findFirst({
        where: { courseId, userId: user.id },
        select: { id: true },
      });
      if (!enrollment) {
        res.status(403).json({ success: false, error: 'Access denied to this course' });
        return;
      }
      // Force userId to their own
      userId = user.id;
    }
  }

  const filters = {
    courseId,
    userId,
    startDate: req.query.startDate ? new Date(req.query.startDate as string) : undefined,
    endDate: req.query.endDate ? new Date(req.query.endDate as string) : undefined,
    minSequenceLength: req.query.minSequenceLength ? parseInt(req.query.minSequenceLength as string) : undefined,
    minVerbPct: req.query.minVerbPct !== undefined ? parseFloat(req.query.minVerbPct as string) : undefined,
    skipMerges: req.query.skipMerges === 'true',
    groupBy: (req.query.groupBy === 'actor' ? 'actor' : 'actor-session') as 'actor' | 'actor-session',
  };

  const result = await activityLogService.getTnaSequences(filters);
  res.json({ success: true, data: result });
}));

export default router;
