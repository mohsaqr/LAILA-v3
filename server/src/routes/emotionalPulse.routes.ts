import { Router, Response } from 'express';
import { emotionalPulseService } from '../services/emotionalPulse.service.js';
import { authenticateToken, requireInstructor } from '../middleware/auth.middleware.js';
import { asyncHandler } from '../middleware/error.middleware.js';
import { AuthRequest } from '../types/index.js';
import { z } from 'zod';

const router = Router();

// Validation schemas
const logPulseSchema = z.object({
  emotion: z.string().min(1, 'Emotion is required'),
  context: z.string().optional(),
  contextId: z.number().optional(),
  agentId: z.number().optional(),
});

// =============================================================================
// LOG PULSE (Student)
// =============================================================================

// POST /api/emotional-pulse - Log an emotional pulse
router.post(
  '/',
  authenticateToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const data = logPulseSchema.parse(req.body);
    const pulse = await emotionalPulseService.logPulse(req.user!.id, data);
    res.status(201).json({ success: true, data: pulse });
  })
);

// =============================================================================
// USER HISTORY
// =============================================================================

// GET /api/emotional-pulse/my-history - Get user's own pulse history
router.get(
  '/my-history',
  authenticateToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const context = req.query.context as string | undefined;
    const contextId = req.query.contextId
      ? parseInt(req.query.contextId as string)
      : undefined;
    const agentId = req.query.agentId
      ? parseInt(req.query.agentId as string)
      : undefined;
    const limit = req.query.limit
      ? parseInt(req.query.limit as string)
      : undefined;
    const offset = req.query.offset
      ? parseInt(req.query.offset as string)
      : undefined;

    const result = await emotionalPulseService.getMyHistory(req.user!.id, {
      context,
      contextId,
      agentId,
      limit,
      offset,
    });
    res.json({ success: true, data: result });
  })
);

// =============================================================================
// STATS (Instructor/Admin)
// =============================================================================

// GET /api/emotional-pulse/stats - Get aggregated stats
router.get(
  '/stats',
  authenticateToken,
  requireInstructor,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const context = req.query.context as string | undefined;
    const contextId = req.query.contextId
      ? parseInt(req.query.contextId as string)
      : undefined;
    const agentId = req.query.agentId
      ? parseInt(req.query.agentId as string)
      : undefined;
    const startDate = req.query.startDate
      ? new Date(req.query.startDate as string)
      : undefined;
    const endDate = req.query.endDate
      ? new Date(req.query.endDate as string)
      : undefined;

    const stats = await emotionalPulseService.getStats({
      context,
      contextId,
      agentId,
      startDate,
      endDate,
    });
    res.json({ success: true, data: stats });
  })
);

// GET /api/emotional-pulse/timeline - Get timeline data for charts
router.get(
  '/timeline',
  authenticateToken,
  requireInstructor,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const context = req.query.context as string | undefined;
    const contextId = req.query.contextId
      ? parseInt(req.query.contextId as string)
      : undefined;
    const agentId = req.query.agentId
      ? parseInt(req.query.agentId as string)
      : undefined;
    const days = req.query.days ? parseInt(req.query.days as string) : undefined;

    const timeline = await emotionalPulseService.getTimeline({
      context,
      contextId,
      agentId,
      days,
    });
    res.json({ success: true, data: timeline });
  })
);

export default router;
