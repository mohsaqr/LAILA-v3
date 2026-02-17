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
  'emotional_pulse', 'tutor_agent', 'tutor_session', 'tutor_conversation',
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
 * Query logs with filters, search, and sorting
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
  const filters = {
    courseId: req.query.courseId ? parseInt(req.query.courseId as string) : undefined,
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
router.get('/filter-options', authenticateToken, asyncHandler(async (_req: AuthRequest, res: Response) => {
  const options = await activityLogService.getFilterOptions();
  res.json({ success: true, data: options });
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
  const filters = {
    userId: req.query.userId ? parseInt(req.query.userId as string) : undefined,
    courseId: req.query.courseId ? parseInt(req.query.courseId as string) : undefined,
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
 * Get activity verb sequences grouped by user for TNA analysis (admin only)
 */
router.get('/tna-sequences', authenticateToken, requireAdmin, asyncHandler(async (req: AuthRequest, res: Response) => {
  const filters = {
    courseId: req.query.courseId ? parseInt(req.query.courseId as string) : undefined,
    startDate: req.query.startDate ? new Date(req.query.startDate as string) : undefined,
    endDate: req.query.endDate ? new Date(req.query.endDate as string) : undefined,
    minSequenceLength: req.query.minSequenceLength ? parseInt(req.query.minSequenceLength as string) : undefined,
    minVerbPct: req.query.minVerbPct !== undefined ? parseFloat(req.query.minVerbPct as string) : undefined,
  };

  const result = await activityLogService.getTnaSequences(filters);
  res.json({ success: true, data: result });
}));

export default router;
