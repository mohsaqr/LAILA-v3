import { Router, Response } from 'express';
import { presentationService } from '../services/presentation.service.js';
import { authenticateToken } from '../middleware/auth.middleware.js';
import { asyncHandler, AppError } from '../middleware/error.middleware.js';
import { AuthRequest } from '../types/index.js';

const router = Router();

/**
 * Return the per-slide image manifest for a lecture section's PowerPoint,
 * converting it (via LibreOffice + poppler) on first request and caching the
 * result. Responds with `{ status: 'processing' | 'ready' | 'failed', ... }`;
 * the client polls while `processing`.
 *
 * A `failed` conversion answers `success: false` with the reason in both
 * `error` and `data.error`/`data.errorMessage`. The HTTP status stays 200:
 * "this deck could not be converted" is a valid answer to a valid request, and
 * the polling client must be able to read the body to know it should stop.
 */
router.get(
  '/sections/:sectionId/slides',
  authenticateToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const sectionId = parseInt(req.params.sectionId);
    if (Number.isNaN(sectionId)) throw new AppError('Invalid section id', 400);

    try {
      const data = await presentationService.getSlides(sectionId, {
        id: req.user!.id,
        isAdmin: req.user!.isAdmin,
      });

      if (data.status === 'failed') {
        const reason =
          data.errorMessage || data.error || 'The presentation could not be converted';
        console.warn(
          `[presentation] section ${sectionId} failed (${data.error ?? 'unknown'}): ${reason}`,
        );
        res.status(200).json({
          success: false,
          error: reason,
          code: data.error ?? 'conversion_failed',
          data,
        });
        return;
      }

      res.json({ success: true, data });
    } catch (err) {
      // Access/validation problems keep their own status via the error handler.
      if (err instanceof AppError) throw err;

      // Anything else would otherwise surface as an opaque 500 with no reason.
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[presentation] section ${sectionId} slides lookup threw:`, err);
      res.status(500).json({
        success: false,
        error: `Failed to load slides: ${message}`,
        code: 'internal_error',
        data: {
          status: 'failed',
          error: 'internal_error',
          errorMessage: message,
          errorDetail: {
            stage: 'lookup',
            stack: err instanceof Error ? err.stack : undefined,
          },
        },
      });
    }
  }),
);

export default router;
