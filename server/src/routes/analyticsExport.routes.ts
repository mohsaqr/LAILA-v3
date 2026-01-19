import { Router, Response, Request } from 'express';
import { analyticsExportService } from '../services/analyticsExport.service.js';
import { learningAnalyticsService } from '../services/learningAnalytics.service.js';
import { authenticateToken, requireAdmin } from '../middleware/auth.middleware.js';
import { asyncHandler } from '../middleware/error.middleware.js';
import { AuthRequest } from '../types/index.js';

const router = Router();

// All export routes require admin authentication
router.use(authenticateToken);
router.use(requireAdmin);

// ============================================================================
// HELPERS
// ============================================================================

function parseFilters(query: Request['query']) {
  return {
    startDate: query.startDate ? new Date(query.startDate as string) : undefined,
    endDate: query.endDate ? new Date(query.endDate as string) : undefined,
    courseId: query.courseId ? parseInt(query.courseId as string) : undefined,
    userId: query.userId ? parseInt(query.userId as string) : undefined,
  };
}

function getFilename(base: string, extension: string) {
  const timestamp = new Date().toISOString().slice(0, 10);
  return `${base}_${timestamp}.${extension}`;
}

// ============================================================================
// CSV EXPORT ENDPOINTS
// ============================================================================

// Export chatbot logs as CSV
router.get('/csv/chatbot-logs', asyncHandler(async (req: AuthRequest, res: Response) => {
  const filters = parseFilters(req.query);
  const csv = await analyticsExportService.exportChatbotLogsCSV(filters);

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="${getFilename('chatbot_logs', 'csv')}"`);
  res.send(csv);
}));

// Export user interactions as CSV
router.get('/csv/user-interactions', asyncHandler(async (req: AuthRequest, res: Response) => {
  const filters = parseFilters(req.query);
  const csv = await analyticsExportService.exportUserInteractionsCSV(filters);

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="${getFilename('user_interactions', 'csv')}"`);
  res.send(csv);
}));

// Export auth logs as CSV
router.get('/csv/auth-logs', asyncHandler(async (req: AuthRequest, res: Response) => {
  const filters = parseFilters(req.query);
  const csv = await analyticsExportService.exportAuthLogsCSV(filters);

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="${getFilename('auth_logs', 'csv')}"`);
  res.send(csv);
}));

// Export system events as CSV
router.get('/csv/system-events', asyncHandler(async (req: AuthRequest, res: Response) => {
  const filters = parseFilters(req.query);
  const csv = await analyticsExportService.exportSystemEventsCSV(filters);

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="${getFilename('system_events', 'csv')}"`);
  res.send(csv);
}));

// Export assessment logs as CSV
router.get('/csv/assessment-logs', asyncHandler(async (req: AuthRequest, res: Response) => {
  const filters = parseFilters(req.query);
  const csv = await analyticsExportService.exportAssessmentLogsCSV(filters);

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="${getFilename('assessment_logs', 'csv')}"`);
  res.send(csv);
}));

// Export content events as CSV
router.get('/csv/content-events', asyncHandler(async (req: AuthRequest, res: Response) => {
  const filters = parseFilters(req.query);
  const csv = await analyticsExportService.exportContentEventsCSV(filters);

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="${getFilename('content_events', 'csv')}"`);
  res.send(csv);
}));

// ============================================================================
// EXCEL EXPORT ENDPOINT
// ============================================================================

// Export all analytics as Excel workbook (multiple sheets)
router.get('/excel/all', asyncHandler(async (req: AuthRequest, res: Response) => {
  const filters = parseFilters(req.query);
  const buffer = await analyticsExportService.exportAllAnalyticsExcel(filters);

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${getFilename('analytics_export', 'xlsx')}"`);
  res.send(buffer);
}));

// ============================================================================
// ZIP EXPORT ENDPOINT
// ============================================================================

// Export all CSVs as ZIP file
router.get('/zip/all', asyncHandler(async (req: AuthRequest, res: Response) => {
  const filters = parseFilters(req.query);
  const archive = await analyticsExportService.exportAllCSVsAsZip(filters);

  res.setHeader('Content-Type', 'application/zip');
  res.setHeader('Content-Disposition', `attachment; filename="${getFilename('analytics_export', 'zip')}"`);

  archive.pipe(res);
}));

// ============================================================================
// JSON SETTINGS EXPORT ENDPOINT
// ============================================================================

// Export course/chatbot settings as JSON
router.get('/json/course-settings', asyncHandler(async (req: AuthRequest, res: Response) => {
  const courseId = req.query.courseId ? parseInt(req.query.courseId as string) : undefined;
  const json = await analyticsExportService.exportCourseSettingsJSON(courseId);

  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', `attachment; filename="${getFilename('course_settings', 'json')}"`);
  res.send(json);
}));

// ============================================================================
// ANALYTICS SUMMARY ENDPOINTS
// ============================================================================

// Get content events summary
router.get('/summary/content-events', asyncHandler(async (req: AuthRequest, res: Response) => {
  const filters: Record<string, unknown> = {};
  if (req.query.startDate) filters.startDate = new Date(req.query.startDate as string);
  if (req.query.endDate) filters.endDate = new Date(req.query.endDate as string);
  if (req.query.userId) filters.userId = parseInt(req.query.userId as string);
  if (req.query.courseId) filters.courseId = parseInt(req.query.courseId as string);
  if (req.query.lectureId) filters.lectureId = parseInt(req.query.lectureId as string);
  if (req.query.eventType) filters.eventType = req.query.eventType as string;

  const summary = await learningAnalyticsService.getContentEventSummary(filters);
  res.json({ success: true, data: summary });
}));

// Get assessment events summary
router.get('/summary/assessment-events', asyncHandler(async (req: AuthRequest, res: Response) => {
  const filters: Record<string, unknown> = {};
  if (req.query.startDate) filters.startDate = new Date(req.query.startDate as string);
  if (req.query.endDate) filters.endDate = new Date(req.query.endDate as string);
  if (req.query.userId) filters.userId = parseInt(req.query.userId as string);
  if (req.query.courseId) filters.courseId = parseInt(req.query.courseId as string);
  if (req.query.assignmentId) filters.assignmentId = parseInt(req.query.assignmentId as string);
  if (req.query.eventType) filters.eventType = req.query.eventType as string;

  const summary = await learningAnalyticsService.getAssessmentEventSummary(filters);
  res.json({ success: true, data: summary });
}));

// Get system events summary
router.get('/summary/system-events', asyncHandler(async (req: AuthRequest, res: Response) => {
  const filters: Record<string, unknown> = {};
  if (req.query.startDate) filters.startDate = new Date(req.query.startDate as string);
  if (req.query.endDate) filters.endDate = new Date(req.query.endDate as string);
  if (req.query.actorId) filters.actorId = parseInt(req.query.actorId as string);
  if (req.query.eventCategory) filters.eventCategory = req.query.eventCategory as string;
  if (req.query.eventType) filters.eventType = req.query.eventType as string;
  if (req.query.courseId) filters.courseId = parseInt(req.query.courseId as string);

  const summary = await learningAnalyticsService.getSystemEventSummary(filters);
  res.json({ success: true, data: summary });
}));

// Get auth events summary
router.get('/summary/auth-events', asyncHandler(async (req: AuthRequest, res: Response) => {
  const filters: Record<string, unknown> = {};
  if (req.query.startDate) filters.startDate = new Date(req.query.startDate as string);
  if (req.query.endDate) filters.endDate = new Date(req.query.endDate as string);
  if (req.query.userId) filters.userId = parseInt(req.query.userId as string);
  if (req.query.userEmail) filters.userEmail = req.query.userEmail as string;
  if (req.query.eventType) filters.eventType = req.query.eventType as string;

  const summary = await learningAnalyticsService.getAuthEventSummary(filters);
  res.json({ success: true, data: summary });
}));

export default router;
