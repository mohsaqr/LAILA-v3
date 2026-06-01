import { Router } from 'express';
import { authenticateToken } from '../middleware/auth.middleware.js';
import { asyncHandler } from '../middleware/error.middleware.js';
import { meService } from '../services/me.service.js';

const router = Router();

/**
 * GET /api/me/continue-learning
 * Returns the lecture the student should resume in each active
 * enrollment, ordered by most-recently viewed. Cap of 6 rows.
 */
router.get(
  '/continue-learning',
  authenticateToken,
  asyncHandler(async (req, res) => {
    const userId = (req as any).user.id as number;
    const data = await meService.getContinueLearning(userId);
    res.json({ success: true, data });
  })
);

/**
 * GET /api/me/grading-queue
 * Aggregates ungraded submissions across every course the instructor
 * owns or co-teaches with grade permission.
 */
router.get(
  '/grading-queue',
  authenticateToken,
  asyncHandler(async (req, res) => {
    const userId = (req as any).user.id as number;
    const data = await meService.getGradingQueue(userId);
    res.json({ success: true, data });
  })
);

/**
 * GET /api/me/teaching-overview
 * Engagement timeline + per-course completion + KPI totals + activity
 * verb distribution for the courses the instructor owns. One round
 * trip so the instructor dashboard avoids client-side fan-out.
 */
router.get(
  '/teaching-overview',
  authenticateToken,
  asyncHandler(async (req, res) => {
    const userId = (req as any).user.id as number;
    const data = await meService.getTeachingOverview(userId);
    res.json({ success: true, data });
  })
);

export default router;
