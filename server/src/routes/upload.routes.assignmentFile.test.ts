import { describe, it, expect, vi, afterAll } from 'vitest';
import express from 'express';
import request from 'supertest';
import path from 'path';
import fs from 'fs';

// Instructor-authenticated by default; the filter, not the guard, is under test.
vi.mock('../middleware/auth.middleware.js', () => ({
  authenticateToken: vi.fn((req, _res, next) => {
    req.user = { id: 1, email: 'teacher@laila.edu', isAdmin: false, isInstructor: true };
    next();
  }),
  requireInstructor: vi.fn((_req, _res, next) => next()),
}));

vi.mock('../utils/prisma.js', () => ({ default: {} }));
vi.mock('../services/courseRole.service.js', () => ({ courseRoleService: {} }));

import uploadRoutes, { ASSIGNMENT_FILE_EXTENSIONS, ASSIGNMENT_FILE_MAX_BYTES } from './upload.routes.js';

const app = express();
app.use('/api/uploads', uploadRoutes);

const uploadsDir = path.join(process.cwd(), 'uploads');
const written: string[] = [];

const post = (filename: string, contentType: string, body: Buffer | string = 'x') =>
  request(app)
    .post('/api/uploads/assignment-file')
    .attach('file', Buffer.isBuffer(body) ? body : Buffer.from(body), { filename, contentType });

afterAll(() => {
  // Accepted uploads land on disk for real; take them back out.
  for (const f of written) {
    const p = path.join(uploadsDir, f);
    if (fs.existsSync(p)) fs.unlinkSync(p);
  }
});

const expectAccepted = async (filename: string, contentType: string) => {
  const res = await post(filename, contentType);
  expect(res.status, `${filename} (${contentType}) should be accepted: ${res.body?.error}`).toBe(200);
  written.push(res.body.data.filename);
};

describe('POST /api/uploads/assignment-file', () => {
  it('accepts the document formats an instructor actually distributes', async () => {
    // The original filter allowed only csv/xlsx/png/jpg/jpeg/pdf, so a Word
    // brief or a slide deck could not be attached at all. These four are the
    // regression: each used to be rejected outright.
    await expectAccepted('brief.doc', 'application/msword');
    await expectAccepted(
      'brief.docx',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    );
    await expectAccepted(
      'slides.pptx',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation'
    );
    await expectAccepted('notes.txt', 'text/plain');
  });

  it('accepts data files, images and archives', async () => {
    await expectAccepted('data.csv', 'text/csv');
    await expectAccepted('sheet.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    await expectAccepted('figure.png', 'image/png');
    await expectAccepted('figure.webp', 'image/webp');
    await expectAccepted('starter.zip', 'application/zip');
    await expectAccepted('report.pdf', 'application/pdf');
  });

  it('rejects SVG, which is a script vector rather than an image here', async () => {
    const res = await post('logo.svg', 'image/svg+xml');
    expect(res.status).toBe(400);
    expect(ASSIGNMENT_FILE_EXTENSIONS).not.toContain('.svg');
  });

  it('rejects an extension outside the list', async () => {
    for (const [name, mime] of [
      ['payload.exe', 'application/octet-stream'],
      ['script.js', 'text/javascript'],
      ['lecture.mp4', 'video/mp4'], // vetted elsewhere, but not assignment material
      ['noextension', 'application/pdf'],
    ] as const) {
      const res = await post(name, mime);
      expect(res.status, `${name} should be rejected`).toBe(400);
    }
  });

  it('rejects a MIME type that contradicts the extension', async () => {
    // The widened list must not become a way in for a renamed binary: .pdf is
    // allowed, but only when the content announces itself as a PDF.
    const res = await post('payload.pdf', 'application/x-msdownload');
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('File type mismatch');
  });

  it('rejects a file over the size limit', async () => {
    const tooBig = Buffer.alloc(ASSIGNMENT_FILE_MAX_BYTES + 1024, 0);
    const res = await post('huge.pdf', 'application/pdf', tooBig);
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('File too large');
  });

  it('keeps the original name in the stored filename', async () => {
    // Storing only `<uuid><ext>` left the UI nothing to show but ".png".
    // The name has to survive into the filename, because that is the only
    // place a submission's fileUrls JSON can carry it.
    const res = await post('network report.pdf', 'application/pdf');
    expect(res.status).toBe(200);
    written.push(res.body.data.filename);

    expect(res.body.data.filename).toMatch(/^[\w-]{36}-network-report\.pdf$/);
    expect(res.body.data.originalName).toBe('network report.pdf');
  });

  it('strips path traversal and URL-breaking characters from the stored name', async () => {
    // `originalname` is attacker-controlled and lands on disk verbatim unless
    // sanitised, so a name must never escape the uploads directory or smuggle
    // characters that change how the resulting URL parses.
    for (const hostile of ['../../etc/passwd.pdf', 'a/b/c.pdf', 'we%20ird#frag?q.pdf']) {
      const res = await post(hostile, 'application/pdf');
      expect(res.status).toBe(200);
      const name: string = res.body.data.filename;
      written.push(name);

      expect(name).not.toContain('/');
      expect(name).not.toContain('..');
      expect(name).not.toMatch(/[%#?\\]/);
      expect(path.resolve(uploadsDir, name).startsWith(uploadsDir)).toBe(true);
    }
  });

  it('keeps non-ASCII names rather than flattening them', async () => {
    const res = await post('tehtävä.pdf', 'application/pdf');
    expect(res.status).toBe(200);
    written.push(res.body.data.filename);
    expect(res.body.data.filename).toContain('tehtävä');
  });

  it('keeps every allowed extension lowercase and dotted', async () => {
    // A typo'd entry would be silently unusable: it passes the extension check
    // and then fails the MIME lookup for every real file.
    for (const ext of ASSIGNMENT_FILE_EXTENSIONS) {
      expect(ext).toMatch(/^\.[a-z0-9]+$/);
    }
  });
});
