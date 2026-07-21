import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

vi.mock('../middleware/auth.middleware.js', () => ({
  authenticateToken: (req: express.Request & { user?: unknown }, _res: express.Response, next: express.NextFunction) => {
    req.user = { id: 1, isAdmin: true };
    next();
  },
}));

const getSlides = vi.fn();
vi.mock('../services/presentation.service.js', () => ({
  presentationService: { getSlides: (...args: unknown[]) => getSlides(...args) },
}));

// vi.mock is hoisted above these imports, so the router picks up the mocks.
import router from './presentation.routes.js';
import { errorHandler } from '../middleware/error.middleware.js';

const app = express();
app.use('/api/presentations', router);
app.use(errorHandler);

const get = () => request(app).get('/api/presentations/sections/5/slides');

describe('GET /presentations/sections/:sectionId/slides', () => {
  beforeEach(() => vi.clearAllMocks());

  it('answers success:false with the reason when the conversion failed', async () => {
    getSlides.mockResolvedValue({
      status: 'failed',
      error: 'timeout',
      errorMessage: 'poppler (pdftoppm) exceeded its 120s time limit (killed after 120s).',
      errorDetail: { stage: 'pdftoppm', timedOut: true, durationMs: 120_004 },
    });

    const res = await get();

    // 200, because "this deck cannot be converted" answers the request; the
    // polling client has to read the body to know it should stop.
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(false);
    expect(res.body.code).toBe('timeout');
    expect(res.body.error).toContain('120s');
    expect(res.body.data.status).toBe('failed');
    expect(res.body.data.errorDetail.stage).toBe('pdftoppm');
  });

  it('keeps success:true for a ready deck', async () => {
    getSlides.mockResolvedValue({
      status: 'ready',
      slideCount: 1,
      images: ['/uploads/slides/abc/slide-1.png'],
    });

    const res = await get();

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.images).toHaveLength(1);
  });

  it('keeps success:true while still processing', async () => {
    getSlides.mockResolvedValue({ status: 'processing' });

    const res = await get();

    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('processing');
  });

  it('describes an unexpected throw rather than returning an opaque 500', async () => {
    getSlides.mockRejectedValue(new Error('EACCES: permission denied, open uploads/slides'));

    const res = await get();

    expect(res.status).toBe(500);
    expect(res.body.success).toBe(false);
    expect(res.body.code).toBe('internal_error');
    expect(res.body.error).toContain('EACCES');
    expect(res.body.data.errorMessage).toContain('EACCES');
  });

  it('rejects a non-numeric section id', async () => {
    const res = await request(app).get('/api/presentations/sections/abc/slides');

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(getSlides).not.toHaveBeenCalled();
  });
});
