import { Router, Response } from 'express';
import { activityLogService, LogActivityInput } from '../services/activityLog.service.js';
import { authenticateToken, optionalAuth, requireAdmin } from '../middleware/auth.middleware.js';
import { asyncHandler } from '../middleware/error.middleware.js';
import { AuthRequest } from '../types/index.js';
import { z } from 'zod';

const router = Router();

// Valid verbs and object types
const validVerbs = [
  'enrolled', 'unenrolled', 'viewed', 'started', 'completed', 'progressed',
  'paused', 'resumed', 'seeked', 'scrolled', 'downloaded', 'submitted',
  'graded', 'messaged', 'received', 'cleared', 'interacted',
] as const;

const validObjectTypes = [
  'course', 'module', 'lecture', 'section', 'video',
  'assignment', 'chatbot', 'file', 'quiz',
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
});

const batchLogSchema = z.object({
  activities: z.array(logActivitySchema).min(1).max(100),
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
  const { activities } = batchLogSchema.parse(req.body);
  const results = await Promise.all(
    activities.map((activity) =>
      activityLogService.logActivity({
        ...activity,
        userId: req.user!.id,
        verb: activity.verb,
        objectType: activity.objectType,
      })
    )
  );
  res.status(201).json({ success: true, data: results, count: results.length });
}));

// ============================================================================
// QUERY ENDPOINTS (Admin only)
// ============================================================================

/**
 * GET /api/activity-log
 * Query logs with filters
 */
router.get('/', authenticateToken, asyncHandler(async (req: AuthRequest, res: Response) => {
  const filters = {
    userId: req.query.userId ? parseInt(req.query.userId as string) : undefined,
    courseId: req.query.courseId ? parseInt(req.query.courseId as string) : undefined,
    verb: req.query.verb as string | undefined,
    objectType: req.query.objectType as string | undefined,
    startDate: req.query.startDate ? new Date(req.query.startDate as string) : undefined,
    endDate: req.query.endDate ? new Date(req.query.endDate as string) : undefined,
    page: req.query.page ? parseInt(req.query.page as string) : 1,
    limit: req.query.limit ? Math.min(parseInt(req.query.limit as string), 100) : 50,
  };

  const result = await activityLogService.queryLogs(filters);
  res.json({ success: true, ...result });
}));

/**
 * GET /api/activity-log/stats
 * Get aggregated statistics
 */
router.get('/stats', authenticateToken, asyncHandler(async (req: AuthRequest, res: Response) => {
  const filters = {
    courseId: req.query.courseId ? parseInt(req.query.courseId as string) : undefined,
    startDate: req.query.startDate ? new Date(req.query.startDate as string) : undefined,
    endDate: req.query.endDate ? new Date(req.query.endDate as string) : undefined,
  };

  const stats = await activityLogService.getStats(filters);
  res.json({ success: true, data: stats });
}));

/**
 * GET /api/activity-log/export
 * Export logs as CSV or JSON
 */
router.get('/export', authenticateToken, asyncHandler(async (req: AuthRequest, res: Response) => {
  const filters = {
    userId: req.query.userId ? parseInt(req.query.userId as string) : undefined,
    courseId: req.query.courseId ? parseInt(req.query.courseId as string) : undefined,
    verb: req.query.verb as string | undefined,
    objectType: req.query.objectType as string | undefined,
    startDate: req.query.startDate ? new Date(req.query.startDate as string) : undefined,
    endDate: req.query.endDate ? new Date(req.query.endDate as string) : undefined,
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

export default router;
