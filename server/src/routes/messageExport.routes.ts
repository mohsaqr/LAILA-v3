import { Router, Response, Request } from 'express';
import { messageExportService } from '../services/messageExport.service.js';
import { authenticateToken, requireAdmin } from '../middleware/auth.middleware.js';
import { asyncHandler } from '../middleware/error.middleware.js';
import { AuthRequest } from '../types/index.js';

const router = Router();

// All message export routes require admin authentication
router.use(authenticateToken);
router.use(requireAdmin);

// ============================================================================
// HELPERS
// ============================================================================

function parseFilters(query: Request['query']) {
  return {
    startDate: query.startDate ? new Date(query.startDate as string) : undefined,
    endDate: query.endDate ? new Date(query.endDate as string) : undefined,
    systemType: query.systemType as 'chatbot' | 'tutor' | 'agent' | undefined,
    courseId: query.courseId ? parseInt(query.courseId as string) : undefined,
    userId: query.userId ? parseInt(query.userId as string) : undefined,
    page: query.page ? parseInt(query.page as string) : undefined,
    limit: query.limit ? parseInt(query.limit as string) : undefined,
  };
}

function getFilename(base: string, extension: string) {
  const timestamp = new Date().toISOString().slice(0, 10);
  return `${base}_${timestamp}.${extension}`;
}

// ============================================================================
// QUERY ENDPOINTS
// ============================================================================

/**
 * GET /api/admin/messages
 * Query unified messages with pagination and filters
 */
router.get('/', asyncHandler(async (req: AuthRequest, res: Response) => {
  const filters = parseFilters(req.query);
  const result = await messageExportService.getUnifiedMessages(filters);

  res.json({
    success: true,
    data: result.messages,
    pagination: result.pagination,
  });
}));

/**
 * GET /api/admin/messages/stats
 * Get statistics across all message systems
 */
router.get('/stats', asyncHandler(async (req: AuthRequest, res: Response) => {
  const filters = parseFilters(req.query);
  const stats = await messageExportService.getStats(filters);

  res.json({
    success: true,
    data: stats,
  });
}));

// ============================================================================
// EXPORT ENDPOINTS
// ============================================================================

/**
 * GET /api/admin/messages/export/csv
 * Export unified messages to CSV
 */
router.get('/export/csv', asyncHandler(async (req: AuthRequest, res: Response) => {
  const filters = parseFilters(req.query);
  const csv = await messageExportService.exportCSV(filters);

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="${getFilename('unified_messages', 'csv')}"`);
  res.send(csv);
}));

/**
 * GET /api/admin/messages/export/excel
 * Export unified messages to Excel with multiple sheets
 */
router.get('/export/excel', asyncHandler(async (req: AuthRequest, res: Response) => {
  const filters = parseFilters(req.query);
  const buffer = await messageExportService.exportExcel(filters);

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${getFilename('unified_messages', 'xlsx')}"`);
  res.send(buffer);
}));

export default router;
