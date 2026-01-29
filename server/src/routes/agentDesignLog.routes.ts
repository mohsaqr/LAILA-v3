/**
 * Agent Design Log Routes
 *
 * API endpoints for agent design event logging and analytics.
 */

import { Router, Response, NextFunction } from 'express';
import { authenticateToken } from '../middleware/auth.middleware.js';
import { agentDesignLogService } from '../services/agentDesignLog.service.js';
import { AppError } from '../middleware/error.middleware.js';
import { AuthRequest } from '../types/index.js';

const router = Router();

// All routes require authentication
router.use(authenticateToken);

/**
 * POST /api/agent-design-logs/batch
 * Log a batch of design events (student endpoint)
 */
router.post(
  '/batch',
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { events } = req.body;

      if (!Array.isArray(events)) {
        throw new AppError('Events must be an array', 400);
      }

      // Filter events to only include user's own events
      const userId = req.user!.id;
      const userEvents = events.filter((e: { userId: number }) => e.userId === userId);

      // Extract client IP, accounting for proxies
      const clientIp = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip || undefined;

      const result = await agentDesignLogService.logEventBatch(userEvents, {
        ipAddress: clientIp,
      });

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/agent-design-logs/assignment/:assignmentId
 * Get design events for an assignment (student's own events)
 */
router.get(
  '/assignment/:assignmentId',
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const assignmentId = parseInt(req.params.assignmentId);
      const userId = req.user!.id;

      const events = await agentDesignLogService.getDesignEventsByAssignment(
        assignmentId,
        userId
      );

      res.json({
        success: true,
        data: events,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/agent-design-logs/config/:agentConfigId
 * Get design events for a specific agent config (instructor endpoint)
 */
router.get(
  '/config/:agentConfigId',
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const agentConfigId = parseInt(req.params.agentConfigId);
      const instructorId = req.user!.id;
      const isAdmin = req.user!.isAdmin;

      const result = await agentDesignLogService.getDesignEventsForConfig(
        agentConfigId,
        instructorId,
        isAdmin
      );

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/agent-design-logs/config/:agentConfigId/timeline
 * Get design timeline for instructor view
 */
router.get(
  '/config/:agentConfigId/timeline',
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const agentConfigId = parseInt(req.params.agentConfigId);
      const instructorId = req.user!.id;
      const isAdmin = req.user!.isAdmin;
      const category = req.query.category as string | undefined;
      const limit = req.query.limit ? parseInt(req.query.limit as string) : undefined;
      const offset = req.query.offset ? parseInt(req.query.offset as string) : undefined;

      const result = await agentDesignLogService.getDesignTimeline(
        agentConfigId,
        instructorId,
        isAdmin,
        { category: category as any, limit, offset }
      );

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/agent-design-logs/config/:agentConfigId/snapshot
 * Get point-in-time config snapshot
 */
router.get(
  '/config/:agentConfigId/snapshot',
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const agentConfigId = parseInt(req.params.agentConfigId);
      const instructorId = req.user!.id;
      const isAdmin = req.user!.isAdmin;
      const timestamp = new Date(req.query.timestamp as string);

      if (isNaN(timestamp.getTime())) {
        throw new AppError('Invalid timestamp', 400);
      }

      const snapshot = await agentDesignLogService.getConfigAtTime(
        agentConfigId,
        timestamp,
        instructorId,
        isAdmin
      );

      res.json({
        success: true,
        data: snapshot,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/agent-design-logs/config/:agentConfigId/reflections
 * Get reflection responses for a student's config
 */
router.get(
  '/config/:agentConfigId/reflections',
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const agentConfigId = parseInt(req.params.agentConfigId);
      const instructorId = req.user!.id;
      const isAdmin = req.user!.isAdmin;

      const reflections = await agentDesignLogService.getReflectionResponses(
        agentConfigId,
        instructorId,
        isAdmin
      );

      res.json({
        success: true,
        data: reflections,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/agent-design-logs/assignment/:assignmentId/analytics
 * Get design analytics for an assignment (instructor summary)
 */
router.get(
  '/assignment/:assignmentId/analytics',
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const assignmentId = parseInt(req.params.assignmentId);
      const instructorId = req.user!.id;
      const isAdmin = req.user!.isAdmin;

      const analytics = await agentDesignLogService.getAssignmentDesignAnalytics(
        assignmentId,
        instructorId,
        isAdmin
      );

      res.json({
        success: true,
        data: analytics,
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
