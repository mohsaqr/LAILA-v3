import { Router, Response } from 'express';
import { tutorService } from '../services/tutor.service.js';
import { authenticateToken, requireAdmin } from '../middleware/auth.middleware.js';
import { asyncHandler } from '../middleware/error.middleware.js';
import { AuthRequest } from '../types/index.js';
import { TutorMode } from '../types/tutor.types.js';

const router = Router();

// =============================================================================
// SESSION ENDPOINTS
// =============================================================================

/**
 * GET /api/tutors/session
 * Get or create session + conversations for current user
 */
router.get(
  '/session',
  authenticateToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const userId = req.user!.id;
    const sessionData = await tutorService.getOrCreateSession(userId);
    res.json({ success: true, data: sessionData });
  })
);

/**
 * PUT /api/tutors/session/mode
 * Update mode { mode: 'manual' | 'router' | 'collaborative' }
 */
router.put(
  '/session/mode',
  authenticateToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const userId = req.user!.id;
    const { mode } = req.body;

    if (!mode || !['manual', 'router', 'collaborative'].includes(mode)) {
      res.status(400).json({
        success: false,
        error: 'Invalid mode. Must be manual, router, or collaborative',
      });
      return;
    }

    const session = await tutorService.updateMode(userId, mode as TutorMode);
    res.json({ success: true, data: session });
  })
);

/**
 * PUT /api/tutors/session/active-agent
 * Set active agent { chatbotId: number }
 */
router.put(
  '/session/active-agent',
  authenticateToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const userId = req.user!.id;
    const { chatbotId } = req.body;

    if (!chatbotId || typeof chatbotId !== 'number') {
      res.status(400).json({
        success: false,
        error: 'chatbotId is required and must be a number',
      });
      return;
    }

    const session = await tutorService.setActiveAgent(userId, chatbotId);
    res.json({ success: true, data: session });
  })
);

// =============================================================================
// CONVERSATION ENDPOINTS
// =============================================================================

/**
 * GET /api/tutors/conversations
 * List all conversations with previews
 */
router.get(
  '/conversations',
  authenticateToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const userId = req.user!.id;
    const conversations = await tutorService.getConversations(userId);
    res.json({ success: true, data: conversations });
  })
);

/**
 * GET /api/tutors/conversations/:chatbotId
 * Get specific conversation + history
 */
router.get(
  '/conversations/:chatbotId',
  authenticateToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const userId = req.user!.id;
    const chatbotId = parseInt(req.params.chatbotId);

    if (isNaN(chatbotId)) {
      res.status(400).json({ success: false, error: 'Invalid chatbotId' });
      return;
    }

    const conversation = await tutorService.getOrCreateConversation(userId, chatbotId);
    res.json({ success: true, data: conversation });
  })
);

/**
 * DELETE /api/tutors/conversations/:chatbotId
 * Clear conversation
 */
router.delete(
  '/conversations/:chatbotId',
  authenticateToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const userId = req.user!.id;
    const chatbotId = parseInt(req.params.chatbotId);

    if (isNaN(chatbotId)) {
      res.status(400).json({ success: false, error: 'Invalid chatbotId' });
      return;
    }

    await tutorService.clearConversation(userId, chatbotId);
    res.json({ success: true, message: 'Conversation cleared' });
  })
);

// =============================================================================
// MESSAGING ENDPOINTS
// =============================================================================

/**
 * POST /api/tutors/conversations/:chatbotId/message
 * Send message { message: string, collaborativeSettings?: CollaborativeSettings }
 */
router.post(
  '/conversations/:chatbotId/message',
  authenticateToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const userId = req.user!.id;
    const chatbotId = parseInt(req.params.chatbotId);
    const { message, collaborativeSettings } = req.body;

    if (isNaN(chatbotId)) {
      res.status(400).json({ success: false, error: 'Invalid chatbotId' });
      return;
    }

    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      res.status(400).json({ success: false, error: 'Message is required' });
      return;
    }

    // Get client info for logging
    const clientInfo = {
      ipAddress: req.ip || req.socket.remoteAddress,
      userAgent: req.headers['user-agent'],
      deviceType: detectDeviceType(req.headers['user-agent']),
    };

    const response = await tutorService.sendMessage(
      userId,
      chatbotId,
      message.trim(),
      clientInfo,
      collaborativeSettings
    );

    res.json({ success: true, data: response });
  })
);

// =============================================================================
// AGENTS ENDPOINTS
// =============================================================================

/**
 * GET /api/tutors/agents
 * List available agents
 */
router.get(
  '/agents',
  authenticateToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const agents = await tutorService.getAvailableAgents();
    res.json({ success: true, data: agents });
  })
);

// =============================================================================
// ADMIN/ANALYTICS ENDPOINTS
// =============================================================================

/**
 * GET /api/tutors/logs
 * Get interaction logs (admin)
 */
router.get(
  '/logs',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const filters = {
      userId: req.query.userId ? parseInt(req.query.userId as string) : undefined,
      sessionId: req.query.sessionId
        ? parseInt(req.query.sessionId as string)
        : undefined,
      eventType: req.query.eventType as string | undefined,
      startDate: req.query.startDate
        ? new Date(req.query.startDate as string)
        : undefined,
      endDate: req.query.endDate ? new Date(req.query.endDate as string) : undefined,
      limit: req.query.limit ? parseInt(req.query.limit as string) : 100,
    };

    const logs = await tutorService.getInteractionLogs(filters);
    res.json({ success: true, data: logs });
  })
);

/**
 * GET /api/tutors/logs/stats
 * Get aggregate stats (admin)
 */
router.get(
  '/logs/stats',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const startDate = req.query.startDate
      ? new Date(req.query.startDate as string)
      : undefined;
    const endDate = req.query.endDate
      ? new Date(req.query.endDate as string)
      : undefined;

    const stats = await tutorService.getStats(startDate, endDate);
    res.json({ success: true, data: stats });
  })
);

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

function detectDeviceType(userAgent?: string): string {
  if (!userAgent) return 'unknown';

  const ua = userAgent.toLowerCase();
  if (ua.includes('mobile') || ua.includes('android') || ua.includes('iphone')) {
    return 'mobile';
  }
  if (ua.includes('tablet') || ua.includes('ipad')) {
    return 'tablet';
  }
  return 'desktop';
}

export default router;
