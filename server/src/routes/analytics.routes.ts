import { Router, Response, Request } from 'express';
import { analyticsService } from '../services/analytics.service.js';
import { authenticateToken, optionalAuth, requireAdmin } from '../middleware/auth.middleware.js';
import { asyncHandler } from '../middleware/error.middleware.js';
import { AuthRequest } from '../types/index.js';
import { z } from 'zod';

const router = Router();

// ============================================================================
// VALIDATION SCHEMAS
// ============================================================================

const interactionEventSchema = z.object({
  type: z.enum(['click', 'page_view', 'form_submit', 'scroll', 'focus', 'blur', 'hover', 'custom']),
  page: z.string(),
  pageUrl: z.string().optional(),
  pageTitle: z.string().optional(),
  referrerUrl: z.string().optional(),
  action: z.string(),
  category: z.string().optional(),
  label: z.string().optional(),
  value: z.number().optional(),
  elementId: z.string().optional(),
  elementType: z.string().optional(),
  elementText: z.string().optional(),
  elementHref: z.string().optional(),
  elementClasses: z.string().optional(),
  elementName: z.string().optional(),
  elementValue: z.string().optional(),
  scrollDepth: z.number().optional(),
  viewportWidth: z.number().optional(),
  viewportHeight: z.number().optional(),
  metadata: z.record(z.unknown()).optional(),
  timestamp: z.number().optional(),
  sessionDuration: z.number().optional(),
  timeOnPage: z.number().optional(),
  // Course context
  courseId: z.number().optional(),
  moduleId: z.number().optional(),
  lectureId: z.number().optional(),
});

const bulkInteractionSchema = z.object({
  sessionId: z.string(),
  sessionStartTime: z.number().optional(),
  events: z.array(interactionEventSchema),
  testMode: z.string().nullable().optional(), // 'test_instructor', 'test_student' for admin "View As" feature
  // Client info
  userAgent: z.string().optional(),
  browserName: z.string().optional(),
  browserVersion: z.string().optional(),
  osName: z.string().optional(),
  osVersion: z.string().optional(),
  deviceType: z.string().optional(),
  screenWidth: z.number().optional(),
  screenHeight: z.number().optional(),
  language: z.string().optional(),
  timezone: z.string().optional(),
});

const chatbotInteractionSchema = z.object({
  sessionId: z.string(),
  sessionStartTime: z.number().optional(),
  sectionId: z.number(),
  conversationId: z.number().optional(),
  conversationMessageCount: z.number().optional(),
  messageIndex: z.number().optional(),
  eventType: z.enum(['conversation_start', 'message_sent', 'message_received', 'conversation_cleared', 'error']),
  eventSequence: z.number().optional(),
  chatbotParams: z.object({
    title: z.string().nullable().optional(),
    intro: z.string().nullable().optional(),
    imageUrl: z.string().nullable().optional(),
    systemPrompt: z.string().nullable().optional(),
    welcomeMessage: z.string().nullable().optional(),
  }),
  messageContent: z.string().optional(),
  responseContent: z.string().optional(),
  responseTime: z.number().optional(),
  aiModel: z.string().optional(),
  aiProvider: z.string().optional(),
  promptTokens: z.number().optional(),
  completionTokens: z.number().optional(),
  totalTokens: z.number().optional(),
  errorMessage: z.string().optional(),
  errorCode: z.string().optional(),
  errorStack: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
  timestamp: z.number().optional(),
  testMode: z.string().nullable().optional(), // 'test_instructor', 'test_student' for admin "View As" feature
  // Client info
  userAgent: z.string().optional(),
  browserName: z.string().optional(),
  browserVersion: z.string().optional(),
  osName: z.string().optional(),
  osVersion: z.string().optional(),
  deviceType: z.string().optional(),
  screenWidth: z.number().optional(),
  screenHeight: z.number().optional(),
  language: z.string().optional(),
  timezone: z.string().optional(),
});

// ============================================================================
// HELPERS
// ============================================================================

function getClientIp(req: Request): string | undefined {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    return (typeof forwarded === 'string' ? forwarded : forwarded[0]).split(',')[0].trim();
  }
  return req.socket.remoteAddress;
}

// ============================================================================
// USER INTERACTION LOGGING
// ============================================================================

// Store bulk interaction events (with optional auth for non-logged-in tracking)
router.post('/interactions', optionalAuth, asyncHandler(async (req: AuthRequest, res: Response) => {
  const data = bulkInteractionSchema.parse(req.body);
  const result = await analyticsService.storeInteractions(
    data,
    req.user?.id,
    getClientIp(req)
  );
  res.json({ success: true, data: result });
}));

// ============================================================================
// CHATBOT INTERACTION LOGGING
// ============================================================================

// Store chatbot interaction with full params and context
router.post('/chatbot-interaction', optionalAuth, asyncHandler(async (req: AuthRequest, res: Response) => {
  const data = chatbotInteractionSchema.parse(req.body);
  const result = await analyticsService.storeChatbotInteraction(
    data,
    req.user?.id,
    getClientIp(req)
  );
  res.json({ success: true, data: { id: result.id } });
}));

// ============================================================================
// ADMIN ANALYTICS ENDPOINTS
// ============================================================================

// Get interaction summary (admin only)
router.get('/interactions/summary', authenticateToken, requireAdmin, asyncHandler(async (req: AuthRequest, res: Response) => {
  const filters: Record<string, unknown> = {};

  if (req.query.startDate) filters.startDate = new Date(req.query.startDate as string);
  if (req.query.endDate) filters.endDate = new Date(req.query.endDate as string);
  if (req.query.userId) filters.userId = parseInt(req.query.userId as string);
  if (req.query.page) filters.page = req.query.page as string;
  if (req.query.interactionType) filters.interactionType = req.query.interactionType as string;
  if (req.query.courseId) filters.courseId = parseInt(req.query.courseId as string);

  const summary = await analyticsService.getInteractionSummary(filters);
  res.json({ success: true, data: summary });
}));

// Query interactions with filters, pagination, search, and sorting (admin only)
router.get('/interactions/query', authenticateToken, requireAdmin, asyncHandler(async (req: AuthRequest, res: Response) => {
  const filters = {
    userId: req.query.userId ? parseInt(req.query.userId as string) : undefined,
    courseId: req.query.courseId ? parseInt(req.query.courseId as string) : undefined,
    eventType: req.query.eventType as string | undefined,
    pagePath: req.query.pagePath as string | undefined,
    startDate: req.query.startDate ? new Date(req.query.startDate as string) : undefined,
    endDate: req.query.endDate ? new Date(req.query.endDate as string) : undefined,
    search: req.query.search as string | undefined,
    page: req.query.page ? parseInt(req.query.page as string) : 1,
    limit: req.query.limit ? Math.min(parseInt(req.query.limit as string), 100) : 50,
    sortBy: req.query.sortBy as string | undefined,
    sortOrder: (req.query.sortOrder as 'asc' | 'desc') || 'desc',
  };

  const result = await analyticsService.queryInteractions(filters);
  res.json({ success: true, ...result });
}));

// Get filter options for interactions dropdowns (admin only)
router.get('/interactions/filter-options', authenticateToken, requireAdmin, asyncHandler(async (_req: AuthRequest, res: Response) => {
  const options = await analyticsService.getInteractionFilterOptions();
  res.json({ success: true, data: options });
}));

// Export interactions as CSV (admin only)
router.get('/interactions/export/csv', authenticateToken, requireAdmin, asyncHandler(async (req: AuthRequest, res: Response) => {
  const filters = {
    userId: req.query.userId ? parseInt(req.query.userId as string) : undefined,
    courseId: req.query.courseId ? parseInt(req.query.courseId as string) : undefined,
    eventType: req.query.eventType as string | undefined,
    startDate: req.query.startDate ? new Date(req.query.startDate as string) : undefined,
    endDate: req.query.endDate ? new Date(req.query.endDate as string) : undefined,
    search: req.query.search as string | undefined,
  };

  const csv = await analyticsService.exportInteractionsToCsv(filters);
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="interactions-${new Date().toISOString().split('T')[0]}.csv"`);
  res.send(csv);
}));

// Get chatbot interaction summary (admin only)
router.get('/chatbot/summary', authenticateToken, requireAdmin, asyncHandler(async (req: AuthRequest, res: Response) => {
  const filters: Record<string, unknown> = {};

  if (req.query.startDate) filters.startDate = new Date(req.query.startDate as string);
  if (req.query.endDate) filters.endDate = new Date(req.query.endDate as string);
  if (req.query.userId) filters.userId = parseInt(req.query.userId as string);
  if (req.query.sectionId) filters.sectionId = parseInt(req.query.sectionId as string);
  if (req.query.courseId) filters.courseId = parseInt(req.query.courseId as string);

  const summary = await analyticsService.getChatbotInteractionSummary(filters);
  res.json({ success: true, data: summary });
}));

// Get detailed chatbot logs for a section (admin only)
router.get('/chatbot/section/:sectionId', authenticateToken, requireAdmin, asyncHandler(async (req: AuthRequest, res: Response) => {
  const sectionId = parseInt(req.params.sectionId);
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 50;

  const logs = await analyticsService.getChatbotLogsForSection(sectionId, page, limit);
  res.json({ success: true, data: logs });
}));

// ============================================================================
// EXPORT ENDPOINTS
// ============================================================================

// Export interaction logs
router.get('/export/interactions', authenticateToken, asyncHandler(async (req: AuthRequest, res: Response) => {
  const summary = await analyticsService.getInteractionSummary({});

  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', `attachment; filename="interactions-${Date.now()}.json"`);
  res.json(summary.recentInteractions);
}));

// Export chatbot logs
router.get('/export/chatbot', authenticateToken, asyncHandler(async (req: AuthRequest, res: Response) => {
  const summary = await analyticsService.getChatbotInteractionSummary({});

  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', `attachment; filename="chatbot-logs-${Date.now()}.json"`);
  res.json(summary.recentLogs);
}));

export default router;
