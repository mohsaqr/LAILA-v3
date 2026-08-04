import { describe, it, expect, vi } from 'vitest';

vi.mock('../utils/prisma.js', () => ({ default: {} }));
vi.mock('../middleware/auth.middleware.js', () => ({
  authenticateToken: vi.fn(),
  requireInstructor: vi.fn(),
  requireAdmin: vi.fn(),
  optionalAuth: vi.fn(),
}));

import { fileFilter } from './upload.routes.js';

/** Run the multer filter and report what it decided. */
const check = (originalname: string, mimetype: string) =>
  new Promise<{ accepted: boolean; error?: string }>((resolve) => {
    fileFilter({} as any, { originalname, mimetype } as any, ((err: any, ok?: boolean) => {
      if (err) resolve({ accepted: false, error: err.message });
      else resolve({ accepted: !!ok });
    }) as any);
  });

describe('upload fileFilter', () => {
  // Course material for the network-analysis modules. A .gephi project is a
  // zipped XML bundle with no registered MIME type, so the browser's guess
  // varies by platform — every one of these is the same file.
  describe('.gephi (network analysis course files)', () => {
    it.each([
      'application/octet-stream',
      'application/zip',
      'application/x-zip-compressed',
      'application/gzip',
      'application/xml',
      'text/xml',
      '',
    ])('accepts a .gephi sent as "%s"', async (mime) => {
      expect(await check('network.gephi', mime)).toEqual({ accepted: true });
    });

    it('accepts a .gephi when the browser sends no type at all', async () => {
      expect(await check('network.gephi', undefined as any)).toEqual({ accepted: true });
    });

    it('accepts uppercase .GEPHI', async () => {
      expect(await check('NETWORK.GEPHI', 'application/octet-stream')).toEqual({ accepted: true });
    });
  });

  describe('existing behaviour is unchanged', () => {
    it('still accepts a csv', async () => {
      expect(await check('data.csv', 'text/csv')).toEqual({ accepted: true });
    });

    it('still accepts a png', async () => {
      expect(await check('plot.png', 'image/png')).toEqual({ accepted: true });
    });

    it('still rejects an unlisted extension', async () => {
      const r = await check('run.exe', 'application/octet-stream');
      expect(r.accepted).toBe(false);
      expect(r.error).toMatch(/not allowed/);
    });

    it('still blocks svg regardless of type', async () => {
      const r = await check('x.svg', 'image/svg+xml');
      expect(r.accepted).toBe(false);
      expect(r.error).toMatch(/security/i);
    });

    it('still rejects a mismatched type on an allowed extension', async () => {
      // Widening .gephi must not have widened everything: a .png claiming to be
      // an executable is still a mismatch.
      const r = await check('sneaky.png', 'application/x-msdownload');
      expect(r.accepted).toBe(false);
      expect(r.error).toMatch(/mismatch/i);
    });

    it('does not let an empty type through for extensions that expect one', async () => {
      const r = await check('data.csv', '');
      expect(r.accepted).toBe(false);
    });
  });
});
