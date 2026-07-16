import { Router, Response } from 'express';
import { presentationService } from '../services/presentation.service.js';
import { authenticateToken } from '../middleware/auth.middleware.js';
import { asyncHandler } from '../middleware/error.middleware.js';
import { AuthRequest } from '../types/index.js';

const router = Router();

/**
 * Return the per-slide image manifest for a lecture section's PowerPoint,
 * converting it (via LibreOffice + poppler) on first request and caching the
 * result. Responds with `{ status: 'processing' | 'ready' | 'failed', ... }`;
 * the client polls while `processing`.
 */
router.get(
  '/sections/:sectionId/slides',
  authenticateToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const sectionId = parseInt(req.params.sectionId);
    const data = await presentationService.getSlides(sectionId, {
      id: req.user!.id,
      isAdmin: req.user!.isAdmin,
    });
    res.json({ success: true, data });
  }),
);

export default router;
