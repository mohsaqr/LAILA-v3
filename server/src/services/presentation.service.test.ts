import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import { PresentationService } from './presentation.service.js';
import { AppError } from '../middleware/error.middleware.js';
import prisma from '../utils/prisma.js';
import { courseRoleService } from './courseRole.service.js';

vi.mock('../utils/prisma.js', () => ({
  default: {
    lectureSection: { findUnique: vi.fn() },
    enrollment: { findUnique: vi.fn() },
  },
}));
vi.mock('./courseRole.service.js', () => ({
  courseRoleService: { isTeamMember: vi.fn() },
}));

const mockSection = (overrides: Record<string, unknown> = {}) => ({
  id: 1,
  fileName: 'deck.pptx',
  fileType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  fileUrl: '/uploads/does-not-exist.pptx',
  lecture: { module: { course: { id: 10, instructorId: 99 } } },
  ...overrides,
});

const admin = { id: 1, isAdmin: true };
const student = { id: 2, isAdmin: false };

describe('PresentationService.getSlides', () => {
  let service: PresentationService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new PresentationService();
    vi.mocked(courseRoleService.isTeamMember).mockResolvedValue(false);
    vi.mocked(prisma.enrollment.findUnique).mockResolvedValue(null as never);
  });

  it('throws 404 when the section does not exist', async () => {
    vi.mocked(prisma.lectureSection.findUnique).mockResolvedValue(null as never);
    await expect(service.getSlides(1, admin)).rejects.toMatchObject({ statusCode: 404 });
  });

  it('throws 403 for a user with no access to the course', async () => {
    vi.mocked(prisma.lectureSection.findUnique).mockResolvedValue(mockSection() as never);
    await expect(service.getSlides(1, student)).rejects.toBeInstanceOf(AppError);
    await expect(service.getSlides(1, student)).rejects.toMatchObject({ statusCode: 403 });
  });

  it('allows an enrolled student through the access check', async () => {
    vi.mocked(prisma.lectureSection.findUnique).mockResolvedValue(mockSection() as never);
    vi.mocked(prisma.enrollment.findUnique).mockResolvedValue({ id: 5 } as never);
    // Access passes; fails later at the missing file (404), not 403.
    await expect(service.getSlides(1, student)).rejects.toMatchObject({ statusCode: 404 });
  });

  it('throws 400 when the section file is not a presentation', async () => {
    vi.mocked(prisma.lectureSection.findUnique).mockResolvedValue(
      mockSection({ fileName: 'notes.pdf', fileType: 'application/pdf' }) as never,
    );
    await expect(service.getSlides(1, admin)).rejects.toMatchObject({ statusCode: 400 });
  });

  it('throws 404 when the presentation file is missing on disk', async () => {
    vi.mocked(prisma.lectureSection.findUnique).mockResolvedValue(mockSection() as never);
    await expect(service.getSlides(1, admin)).rejects.toMatchObject({ statusCode: 404 });
  });

  it('reports whether conversion binaries are available', async () => {
    expect(typeof (await service.binariesAvailable())).toBe('boolean');
  });
});

// warm() is the eager, author-time pre-render. It must never throw (it's called
// fire-and-forget from section create/update) and must skip the access check and
// any conversion when there's nothing to render.
describe('PresentationService.warm', () => {
  let service: PresentationService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new PresentationService();
  });

  const inFlightSize = (s: PresentationService) =>
    (s as unknown as { inFlight: Map<string, unknown> }).inFlight.size;

  it('no-ops (no throw) when the section does not exist', async () => {
    vi.mocked(prisma.lectureSection.findUnique).mockResolvedValue(null as never);
    await expect(service.warm(1)).resolves.toBeUndefined();
    expect(inFlightSize(service)).toBe(0);
  });

  it('no-ops for a non-presentation file', async () => {
    vi.mocked(prisma.lectureSection.findUnique).mockResolvedValue(
      mockSection({ fileName: 'notes.pdf', fileType: 'application/pdf' }) as never,
    );
    await expect(service.warm(1)).resolves.toBeUndefined();
    expect(inFlightSize(service)).toBe(0);
  });

  it('no-ops when the presentation file is missing on disk', async () => {
    vi.mocked(prisma.lectureSection.findUnique).mockResolvedValue(mockSection() as never);
    await expect(service.warm(1)).resolves.toBeUndefined();
    expect(inFlightSize(service)).toBe(0);
  });

  it('does not perform an access check (never touches enrollment/team lookups)', async () => {
    vi.mocked(prisma.lectureSection.findUnique).mockResolvedValue(mockSection() as never);
    await service.warm(1);
    expect(prisma.enrollment.findUnique).not.toHaveBeenCalled();
    expect(courseRoleService.isTeamMember).not.toHaveBeenCalled();
  });
});

// A stale `failed` manifest must auto-retry (so installing the binaries / fixing
// config recovers without manually clearing the cache); a recent one must not.
describe('PresentationService failed-manifest retry', () => {
  const uploadsDir = path.join(process.cwd(), 'uploads');
  const dummyName = 'test-retry-fixture.pptx';
  const base = 'test-retry-fixture';
  const cacheDir = path.join(uploadsDir, 'slides', base);
  const manifestPath = path.join(cacheDir, 'manifest.json');

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(courseRoleService.isTeamMember).mockResolvedValue(false);
    fs.mkdirSync(uploadsDir, { recursive: true });
    fs.writeFileSync(path.join(uploadsDir, dummyName), Buffer.from('not a real pptx'));
    // Point at a non-existent binary so a triggered retry fails instantly
    // (ENOENT) instead of spawning real LibreOffice during the test.
    process.env.SOFFICE_BIN = '/nonexistent/soffice';
    vi.mocked(prisma.lectureSection.findUnique).mockResolvedValue({
      id: 1,
      fileName: dummyName,
      fileType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      fileUrl: `/uploads/${dummyName}`,
      lecture: { module: { course: { id: 10, instructorId: 1 } } },
    } as never);
  });

  afterEach(() => {
    delete process.env.SOFFICE_BIN;
    fs.rmSync(path.join(uploadsDir, dummyName), { force: true });
    fs.rmSync(cacheDir, { recursive: true, force: true });
  });

  it('reports failed while the retry cooldown is active', async () => {
    fs.mkdirSync(cacheDir, { recursive: true });
    fs.writeFileSync(
      manifestPath,
      JSON.stringify({
        status: 'failed',
        error: 'timeout',
        errorMessage: 'poppler (pdftoppm) exceeded its 120s time limit',
        errorDetail: { stage: 'pdftoppm', timedOut: true },
        failedAt: Date.now(),
      }),
    );
    const res = await new PresentationService().getSlides(1, { id: 1, isAdmin: true });
    expect(res.status).toBe('failed');
  });

  it('re-runs a legacy failure that carries no diagnostics', async () => {
    fs.mkdirSync(cacheDir, { recursive: true });
    // Written by a build that recorded only a status — returning it verbatim
    // would report `failed` with no reason, so it must be retried instead.
    fs.writeFileSync(
      manifestPath,
      JSON.stringify({ status: 'failed', error: 'conversion_failed', failedAt: Date.now() }),
    );
    const service = new PresentationService();
    const res = await service.getSlides(1, { id: 1, isAdmin: true });
    expect(res.status).toBe('processing');
    // Drain the fire-and-forget retry (fails fast under the bogus SOFFICE_BIN).
    await (service as unknown as { inFlight: Map<string, Promise<unknown>> }).inFlight
      .get(base)
      ?.catch(() => {});
  });

  it('attaches a reason when an old manifest recorded none', async () => {
    fs.mkdirSync(cacheDir, { recursive: true });
    fs.writeFileSync(manifestPath, JSON.stringify({ status: 'failed', failedAt: Date.now() }));
    const service = new PresentationService();
    const manifest = await (
      service as unknown as {
        readManifest: (p: string, b: string) => Promise<{ error?: string; errorMessage?: string }>;
      }
    ).readManifest(manifestPath, base);
    expect(manifest.error).toBe('conversion_failed');
    expect(manifest.errorMessage).toMatch(/retried/i);
  });

  it('surfaces the recorded failure reason during the cooldown', async () => {
    fs.mkdirSync(cacheDir, { recursive: true });
    fs.writeFileSync(
      manifestPath,
      JSON.stringify({
        status: 'failed',
        error: 'timeout',
        errorMessage: 'poppler (pdftoppm) exceeded its 120s time limit',
        errorDetail: { stage: 'pdftoppm', timedOut: true, durationMs: 120_004, command: '/usr/bin/pdftoppm' },
        failedAt: Date.now(),
      }),
    );
    const res = await new PresentationService().getSlides(1, { id: 1, isAdmin: true });
    expect(res.status).toBe('failed');
    expect(res.error).toBe('timeout');
    expect(res.errorMessage).toContain('120s');
    expect(res.errorDetail?.stage).toBe('pdftoppm');
    expect(res.errorDetail?.timedOut).toBe(true);
  });

  it('hides raw diagnostics from enrolled students', async () => {
    fs.mkdirSync(cacheDir, { recursive: true });
    fs.writeFileSync(
      manifestPath,
      JSON.stringify({
        status: 'failed',
        error: 'timeout',
        errorMessage: 'poppler (pdftoppm) exceeded its 120s time limit',
        errorDetail: { stage: 'pdftoppm', command: '/usr/bin/pdftoppm', stderr: 'sensitive path detail' },
        failedAt: Date.now(),
      }),
    );
    vi.mocked(prisma.enrollment.findUnique).mockResolvedValue({ id: 1 } as never);
    // Not the instructor (instructorId is 1), not an admin — an enrolled student.
    const res = await new PresentationService().getSlides(1, { id: 99, isAdmin: false });
    expect(res.status).toBe('failed');
    expect(res.error).toBe('timeout');
    expect(res.errorMessage).toContain('120s'); // friendly reason still shown
    expect(res.errorDetail).toBeUndefined(); // raw diagnostics stripped
  });

  it('retries (processing) once the cooldown has elapsed', async () => {
    fs.mkdirSync(cacheDir, { recursive: true });
    fs.writeFileSync(manifestPath, JSON.stringify({ status: 'failed', failedAt: Date.now() - 120_000 }));
    const service = new PresentationService();
    const res = await service.getSlides(1, { id: 1, isAdmin: true });
    expect(res.status).toBe('processing');
    // Drain the fire-and-forget retry so it fails fast (ENOENT under the bogus
    // SOFFICE_BIN) before afterEach restores the env — no real soffice spawn.
    await (service as unknown as { inFlight: Map<string, Promise<unknown>> }).inFlight
      .get(base)
      ?.catch(() => {});
  });
});

// Real end-to-end conversion — only runs where LibreOffice + poppler exist
// (e.g. the deploy VM / CI with the binaries). Skipped locally without them.
describe('PresentationService conversion (integration)', () => {
  const uploadsDir = path.join(process.cwd(), 'uploads');
  const samplePptx = fs.existsSync(uploadsDir)
    ? fs.readdirSync(uploadsDir).find((f) => f.toLowerCase().endsWith('.pptx'))
    : undefined;

  it('converts a real .pptx into per-slide PNGs', async () => {
    const service = new PresentationService();
    if (!samplePptx || !(await service.binariesAvailable())) return; // soft-skip

    vi.mocked(prisma.lectureSection.findUnique).mockResolvedValue({
      id: 1,
      fileName: samplePptx,
      fileType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      fileUrl: `/uploads/${samplePptx}`,
      lecture: { module: { course: { id: 10, instructorId: 1 } } },
    } as never);

    const base = path.parse(samplePptx).name.replace(/[^A-Za-z0-9_-]/g, '_');
    const cacheDir = path.join(uploadsDir, 'slides', base);
    fs.rmSync(cacheDir, { recursive: true, force: true });

    // First call kicks off conversion; poll the on-disk manifest until ready.
    await service.getSlides(1, { id: 1, isAdmin: true });
    const manifestPath = path.join(cacheDir, 'manifest.json');
    const deadline = Date.now() + 120_000;
    while (Date.now() < deadline && !fs.existsSync(manifestPath)) {
      await new Promise((r) => setTimeout(r, 1000));
    }

    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
    expect(manifest.status).toBe('ready');
    expect(manifest.slideCount).toBeGreaterThan(0);
    const firstPng = path.join(cacheDir, 'slide-1.png');
    expect(fs.existsSync(firstPng)).toBe(true);
    expect(fs.readFileSync(firstPng).subarray(0, 4).toString('hex')).toBe('89504e47'); // PNG magic
  }, 150_000);
});
