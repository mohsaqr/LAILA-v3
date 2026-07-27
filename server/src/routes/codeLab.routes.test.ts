import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import express from 'express';
import request from 'supertest';

vi.mock('../services/codeLab.service.js', () => ({
  codeLabService: {
    getCodeLabsForModule: vi.fn(),
    getCodeLabById: vi.fn(),
    createCodeLab: vi.fn(),
    updateCodeLab: vi.fn(),
    deleteCodeLab: vi.fn(),
    reorderCodeLabs: vi.fn(),
    createCodeBlock: vi.fn(),
    updateCodeBlock: vi.fn(),
    deleteCodeBlock: vi.fn(),
    reorderCodeBlocks: vi.fn(),
  },
}));

vi.mock('../middleware/auth.middleware.js', () => ({
  authenticateToken: (req: any, _res: any, next: any) => {
    req.user = { id: 1, email: 'teacher@test.com', fullname: 'Teacher', isAdmin: false, isInstructor: true };
    next();
  },
  requireInstructor: (_req: any, _res: any, next: any) => next(),
  optionalAuth: (_req: any, _res: any, next: any) => next(),
}));

import { codeLabService } from '../services/codeLab.service.js';
import codeLabRoutes from './codeLab.routes.js';

describe('Code Lab Routes', () => {
  let app: express.Application;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api/code-labs', codeLabRoutes);
    app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
      res.status(err.statusCode || 500).json({ success: false, error: err.message || 'Internal server error' });
    });
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // Regression: `/:labId/blocks/:blockId` used to be registered before
  // `/:labId/blocks/reorder`, so Express matched reorder requests as an update
  // with blockId="reorder" -> parseInt -> NaN, and reorder never ran.
  describe('PUT /api/code-labs/:labId/blocks/reorder', () => {
    it('routes to reorderCodeBlocks, not updateCodeBlock', async () => {
      vi.mocked(codeLabService.reorderCodeBlocks).mockResolvedValue({ success: true } as any);

      const res = await request(app)
        .put('/api/code-labs/7/blocks/reorder')
        .send({ ids: [3, 1, 2] });

      expect(res.status).toBe(200);
      expect(codeLabService.reorderCodeBlocks).toHaveBeenCalledWith(7, 1, [3, 1, 2], false);
      expect(codeLabService.updateCodeBlock).not.toHaveBeenCalled();
    });

    it('rejects a non-numeric id list', async () => {
      const res = await request(app)
        .put('/api/code-labs/7/blocks/reorder')
        .send({ ids: ['reorder'] });

      expect(res.status).toBe(500);
      expect(codeLabService.reorderCodeBlocks).not.toHaveBeenCalled();
    });
  });

  describe('PUT /api/code-labs/:labId/blocks/:blockId', () => {
    it('still updates a numeric block id', async () => {
      vi.mocked(codeLabService.updateCodeBlock).mockResolvedValue({ id: 5, title: 'Updated' } as any);

      const res = await request(app)
        .put('/api/code-labs/7/blocks/5')
        .send({ title: 'Updated' });

      expect(res.status).toBe(200);
      expect(codeLabService.updateCodeBlock).toHaveBeenCalledWith(5, 1, { title: 'Updated' }, false);
      expect(codeLabService.reorderCodeBlocks).not.toHaveBeenCalled();
    });

    // `locked` is what makes a cell run-only for students; if the schema were
    // to drop it the flag would be silently discarded rather than rejected.
    it('passes locked through to the service', async () => {
      vi.mocked(codeLabService.updateCodeBlock).mockResolvedValue({ id: 5, locked: true } as any);

      const res = await request(app)
        .put('/api/code-labs/7/blocks/5')
        .send({ locked: true });

      expect(res.status).toBe(200);
      expect(codeLabService.updateCodeBlock).toHaveBeenCalledWith(5, 1, { locked: true }, false);
    });

    it('rejects a non-boolean locked value', async () => {
      const res = await request(app)
        .put('/api/code-labs/7/blocks/5')
        .send({ locked: 'yes' });

      expect(res.status).toBe(500);
      expect(codeLabService.updateCodeBlock).not.toHaveBeenCalled();
    });
  });
});
