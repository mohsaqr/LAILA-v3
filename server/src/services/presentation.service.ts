import { execFile } from 'child_process';
import { promisify } from 'util';
import { existsSync } from 'fs';
import fs from 'fs/promises';
import path from 'path';
import prisma from '../utils/prisma.js';
import { AppError } from '../middleware/error.middleware.js';
import { courseRoleService } from './courseRole.service.js';

const execFileAsync = promisify(execFile);

const UPLOADS_DIR = path.join(process.cwd(), 'uploads');
const SLIDES_DIR = path.join(UPLOADS_DIR, 'slides');

/** Positive integer from env, or the fallback when unset/invalid. */
const envInt = (name: string, fallback: number): number => {
  const parsed = Number.parseInt(process.env[name] ?? '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

// Bound conversion cost. Overridable per-deployment: a large deck on a small
// server can legitimately need more than the default two minutes, and dropping
// the DPI is the cheapest way to bring a slow render back under the limit.
const RENDER_DPI = String(envInt('PRESENTATION_RENDER_DPI', 150));
const MAX_SLIDES = envInt('PRESENTATION_MAX_SLIDES', 300);
const CONVERT_TIMEOUT_MS = envInt('PRESENTATION_CONVERT_TIMEOUT_MS', 120_000);
// After a failed conversion, wait this long before auto-retrying (so a genuinely
// broken deck doesn't respawn the binaries on every view, but installing the
// binaries / fixing config self-heals on the next visit).
const RETRY_COOLDOWN_MS = 60_000;

// Directories where soffice/pdftoppm commonly live, so we work even when the
// server process runs with a minimal PATH (systemd, pm2, launchd, …).
const EXTRA_PATHS = ['/opt/homebrew/bin', '/usr/local/bin', '/usr/bin', '/bin'];

/** Machine-readable reason a conversion failed. */
export type SlideErrorCode =
  | 'timeout'
  | 'binary_missing'
  | 'no_pdf'
  | 'no_slides'
  | 'source_missing'
  | 'conversion_failed';

/**
 * Full diagnostic for a failed conversion. Returned only to instructors/admins
 * — it carries absolute paths and raw binary stderr, which students shouldn't
 * see.
 */
export interface SlideFailureDetail {
  /** Which pipeline step failed. */
  stage: 'libreoffice' | 'pdftoppm' | 'collect';
  /** Absolute path of the binary that was invoked. */
  command?: string;
  /** Exit code, when the binary ran and exited non-zero. */
  exitCode?: number | string;
  /** Signal that killed the process (SIGTERM = our own timeout). */
  signal?: string;
  /** True when the step was killed by our timeout rather than failing itself. */
  timedOut?: boolean;
  /** The timeout the step was given, in ms. */
  timeoutMs?: number;
  /** Wall-clock ms the step consumed before succeeding or failing. */
  durationMs?: number;
  /** Truncated stderr from the binary. */
  stderr?: string;
  /** Per-step wall-clock timings recorded before the failure. */
  timings?: Record<string, number>;
}

export interface SlideManifest {
  status: 'ready' | 'processing' | 'failed';
  slideCount?: number;
  /** Public `/uploads/slides/...` URLs, one per slide, in order. */
  images?: string[];
  /** Pixel dimensions of the rendered slides (for the client aspect box). */
  width?: number;
  height?: number;
  /** Machine-readable failure reason. */
  error?: SlideErrorCode | string;
  /** Human-readable, actionable description of the failure. */
  errorMessage?: string;
  /** Full diagnostic; stripped for non-privileged viewers. */
  errorDetail?: SlideFailureDetail;
  /** Epoch ms of the last failure, used to throttle auto-retries. */
  failedAt?: number;
}

/** Truncate binary output so a runaway log can't bloat the manifest/response. */
const trimOutput = (text?: string | null): string | undefined => {
  if (!text) return undefined;
  const clean = text.trim();
  if (!clean) return undefined;
  return clean.length > 2000 ? `${clean.slice(0, 2000)}… (truncated)` : clean;
};

/** A conversion step failure carrying its classification and diagnostics. */
class ConversionError extends Error {
  constructor(
    readonly code: SlideErrorCode,
    message: string,
    readonly detail: SlideFailureDetail,
  ) {
    super(message);
    this.name = 'ConversionError';
  }
}

interface AccessUser {
  id: number;
  isAdmin: boolean;
}

const firstExisting = (candidates: string[]): string | undefined =>
  candidates.find((c) => {
    try {
      return existsSync(c);
    } catch {
      return false;
    }
  });

/** Resolve LibreOffice: env override → known absolute paths → bare command. */
const resolveSofficeBin = (): string =>
  process.env.SOFFICE_BIN ||
  firstExisting([
    '/Applications/LibreOffice.app/Contents/MacOS/soffice',
    '/opt/homebrew/bin/soffice',
    '/usr/local/bin/soffice',
    '/usr/bin/soffice',
    '/usr/bin/libreoffice',
  ]) ||
  'soffice';

/** Resolve poppler's pdftoppm: env override → known absolute paths → bare. */
const resolvePdftoppmBin = (): string =>
  process.env.PDFTOPPM_BIN ||
  firstExisting(['/opt/homebrew/bin/pdftoppm', '/usr/local/bin/pdftoppm', '/usr/bin/pdftoppm']) ||
  'pdftoppm';

/** child_process env with common bin dirs prepended so bare commands resolve. */
const execEnv = (): NodeJS.ProcessEnv => ({
  ...process.env,
  PATH: [...EXTRA_PATHS, process.env.PATH ?? ''].filter(Boolean).join(':'),
});

/** Whether the section's file looks like a PowerPoint presentation. */
const isPresentationFile = (fileName?: string | null, fileType?: string | null): boolean => {
  const name = (fileName ?? '').toLowerCase();
  const type = (fileType ?? '').toLowerCase();
  return (
    name.endsWith('.pptx') ||
    name.endsWith('.ppt') ||
    type.includes('presentationml') ||
    type.includes('ms-powerpoint')
  );
};

/** Read a PNG's IHDR width/height without a decoder (bytes 16–24, big-endian). */
const readPngSize = async (pngPath: string): Promise<{ width: number; height: number }> => {
  const fh = await fs.open(pngPath, 'r');
  try {
    const buf = Buffer.alloc(24);
    await fh.read(buf, 0, 24, 0);
    return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
  } finally {
    await fh.close();
  }
};

/**
 * Converts a lecture section's PowerPoint into per-slide PNG images using the
 * LibreOffice (`soffice`) + poppler (`pdftoppm`) system binaries, caching the
 * result on disk. Conversion is lazy (triggered on first view) and deduped.
 */
export class PresentationService {
  /** In-flight conversions keyed by cache base name, to avoid double work. */
  private inFlight = new Map<string, Promise<SlideManifest>>();

  /** Whether the conversion binaries are runnable (used by tests to skip). */
  async binariesAvailable(): Promise<boolean> {
    try {
      await execFileAsync(resolveSofficeBin(), ['--version'], { timeout: 20_000, env: execEnv() });
      await execFileAsync(resolvePdftoppmBin(), ['-v'], { timeout: 20_000, env: execEnv() });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Return the slide manifest for a section's presentation, kicking off (and
   * caching) the conversion on first request. Access is restricted to the
   * course's instructor/team, admins, or enrolled students.
   */
  async getSlides(sectionId: number, user: AccessUser): Promise<SlideManifest> {
    const section = await prisma.lectureSection.findUnique({
      where: { id: sectionId },
      include: { lecture: { include: { module: { include: { course: true } } } } },
    });
    if (!section) throw new AppError('Section not found', 404);

    const privileged = await this.assertAccess(section.lecture.module.course, user);

    if (!isPresentationFile(section.fileName, section.fileType) || !section.fileUrl) {
      throw new AppError('This section is not a PowerPoint presentation', 400);
    }

    const pptxPath = this.resolvePptxPath(section.fileUrl);
    if (!existsSync(pptxPath)) throw new AppError('Presentation file not found', 404);

    // Don't block the request on the (slow) conversion — the client polls.
    const manifest = await this.ensureConversion(pptxPath);

    // Students see the friendly reason but not absolute paths or raw stderr.
    if (!privileged && manifest.errorDetail) {
      const { errorDetail: _detail, ...rest } = manifest;
      return rest;
    }
    return manifest;
  }

  /**
   * Eagerly render a section's presentation (if it is one) so the disk cache is
   * `ready` before any student opens the lecture. Fire-and-forget: never throws
   * and reuses the same cache + in-flight dedupe as `getSlides`. Intended to be
   * called (unawaited) when an instructor creates/updates a file section, so the
   * authoring instructor "pays" for the conversion instead of the first student.
   */
  async warm(sectionId: number): Promise<void> {
    try {
      const section = await prisma.lectureSection.findUnique({
        where: { id: sectionId },
        select: { fileName: true, fileType: true, fileUrl: true },
      });
      if (!section?.fileUrl) return;
      if (!isPresentationFile(section.fileName, section.fileType)) return;

      const pptxPath = this.resolvePptxPath(section.fileUrl);
      if (!existsSync(pptxPath)) return;

      // Kicks off conversion (fire-and-forget) if not already ready/in-flight.
      await this.ensureConversion(pptxPath);
    } catch (err) {
      // Best effort — a warm failure just means the first viewer falls back to
      // the existing lazy path; never surface it to the caller's request.
      console.warn('[presentation] Warm failed:', err instanceof Error ? err.message : String(err));
    }
  }

  /**
   * Return the cached manifest for a resolved pptx path, or kick off (and cache)
   * the conversion if it isn't ready yet. Shared by `getSlides` (lazy, at view
   * time) and `warm` (eager, at author time). Does not block on the conversion.
   */
  private async ensureConversion(pptxPath: string): Promise<SlideManifest> {
    const base = this.cacheBase(pptxPath);
    const cacheDir = path.join(SLIDES_DIR, base);
    const manifestPath = path.join(cacheDir, 'manifest.json');

    const cached = await this.readManifest(manifestPath, base);
    if (cached?.status === 'ready' && cached.images) return cached;
    // A prior failure is retried after a cooldown (so installing the binaries or
    // fixing config recovers automatically); within the window, report failed.
    if (cached?.status === 'failed' && Date.now() - (cached.failedAt ?? 0) < RETRY_COOLDOWN_MS) {
      // Report *why* it failed — this branch previously dropped the reason,
      // leaving the client with a bare `failed` and nothing to act on.
      return cached;
    }

    // Conversion already running for this deck.
    if (this.inFlight.has(base)) return { status: 'processing' };

    const job = this.convert(pptxPath, cacheDir, base).finally(() => this.inFlight.delete(base));
    this.inFlight.set(base, job);
    return { status: 'processing' };
  }

  /**
   * Throws unless the user may view the deck. Resolves to `true` for those who
   * can act on a conversion failure (admins, the instructor, course team) —
   * enrolled students get access but not the raw diagnostics.
   */
  private async assertAccess(
    course: { id: number; instructorId: number },
    user: AccessUser,
  ): Promise<boolean> {
    if (user.isAdmin) return true;
    if (course.instructorId === user.id) return true;
    if (await courseRoleService.isTeamMember(user.id, course.id)) return true;
    const enrollment = await prisma.enrollment.findUnique({
      where: { userId_courseId: { userId: user.id, courseId: course.id } },
    });
    if (enrollment) return false;
    throw new AppError('Not authorized to view this presentation', 403);
  }

  /** Map a `/uploads/...` URL to an on-disk path, guarding against traversal. */
  private resolvePptxPath(fileUrl: string): string {
    const rel = fileUrl.replace(/^\/uploads\//, '');
    const full = path.join(UPLOADS_DIR, rel);
    if (full !== UPLOADS_DIR && !full.startsWith(UPLOADS_DIR + path.sep)) {
      throw new AppError('Invalid file path', 400);
    }
    return full;
  }

  /** Stable, filesystem-safe cache key derived from the (UUID) file name. */
  private cacheBase(pptxPath: string): string {
    return path.parse(pptxPath).name.replace(/[^A-Za-z0-9_-]/g, '_');
  }

  private async readManifest(manifestPath: string, base: string): Promise<SlideManifest | null> {
    try {
      const raw = await fs.readFile(manifestPath, 'utf-8');
      const manifest = JSON.parse(raw) as SlideManifest;
      if (manifest.status === 'ready' && manifest.images) {
        // Rehydrate URLs from stored file names in case the app moved.
        manifest.images = manifest.images.map((name) =>
          name.startsWith('/uploads/') ? name : `/uploads/slides/${base}/${name}`,
        );
      }
      return manifest;
    } catch {
      return null; // no manifest yet
    }
  }

  /**
   * Run one conversion binary, classifying any failure into a `ConversionError`
   * that carries enough detail to tell a timeout apart from a missing binary or
   * a genuine crash. Returns the step's wall-clock duration in ms.
   */
  private async runStep(
    stage: 'libreoffice' | 'pdftoppm',
    bin: string,
    args: string[],
    timeoutMs: number,
    timings: Record<string, number>,
  ): Promise<number> {
    const startedAt = Date.now();
    try {
      await execFileAsync(bin, args, {
        timeout: timeoutMs,
        env: execEnv(),
        maxBuffer: 10 * 1024 * 1024,
      });
      const durationMs = Date.now() - startedAt;
      timings[stage] = durationMs;
      return durationMs;
    } catch (err) {
      const e = err as NodeJS.ErrnoException & {
        killed?: boolean;
        signal?: string;
        stderr?: string;
        code?: number | string;
      };
      const durationMs = Date.now() - startedAt;
      timings[stage] = durationMs;

      // execFile enforces `timeout` by killing the child with SIGTERM, so a
      // SIGTERM kill is indistinguishable from our own timeout firing.
      const timedOut = e.signal === 'SIGTERM' || Boolean(e.killed) || e.code === 'ETIMEDOUT';
      const missing = e.code === 'ENOENT';
      const code: SlideErrorCode = missing
        ? 'binary_missing'
        : timedOut
          ? 'timeout'
          : 'conversion_failed';

      const label = stage === 'libreoffice' ? 'LibreOffice (soffice)' : 'poppler (pdftoppm)';
      const seconds = Math.round(durationMs / 1000);
      const message = missing
        ? `${label} was not found at "${bin}". Install it with \`apt-get install -y libreoffice poppler-utils fonts-liberation\`, or set ${stage === 'libreoffice' ? 'SOFFICE_BIN' : 'PDFTOPPM_BIN'}.`
        : timedOut
          ? `${label} exceeded its ${Math.round(timeoutMs / 1000)}s time limit (killed after ${seconds}s). Large decks can need more time than this on smaller servers — raise PRESENTATION_CONVERT_TIMEOUT_MS or lower PRESENTATION_RENDER_DPI.`
          : `${label} failed after ${seconds}s with exit code ${String(e.code ?? 'unknown')}.`;

      throw new ConversionError(code, message, {
        stage,
        command: bin,
        exitCode: typeof e.code === 'number' || typeof e.code === 'string' ? e.code : undefined,
        signal: e.signal,
        timedOut,
        timeoutMs,
        durationMs,
        stderr: trimOutput(e.stderr),
        timings: { ...timings },
      });
    }
  }

  /**
   * soffice → PDF → pdftoppm → per-slide PNGs. Writes a `ready` manifest on
   * success or a terminal `failed` manifest otherwise (so we don't respawn the
   * binaries on every view). Never throws — the caller only awaits for dedupe.
   */
  private async convert(pptxPath: string, cacheDir: string, base: string): Promise<SlideManifest> {
    const tmpDir = path.join(cacheDir, '.tmp');
    const manifestPath = path.join(cacheDir, 'manifest.json');
    const timings: Record<string, number> = {};
    try {
      // Start from a clean cache dir so a retry can't mix with stale output.
      await fs.rm(cacheDir, { recursive: true, force: true });
      await fs.mkdir(tmpDir, { recursive: true });

      // 1) PowerPoint → PDF. A unique UserInstallation profile lets concurrent
      //    conversions run without colliding on soffice's shared profile.
      const sofficeBin = resolveSofficeBin();
      await this.runStep(
        'libreoffice',
        sofficeBin,
        [
          '--headless',
          `-env:UserInstallation=file://${path.join(tmpDir, 'profile')}`,
          '--convert-to',
          'pdf',
          '--outdir',
          tmpDir,
          pptxPath,
        ],
        CONVERT_TIMEOUT_MS,
        timings,
      );
      const pdfPath = path.join(tmpDir, `${path.parse(pptxPath).name}.pdf`);
      if (!existsSync(pdfPath)) {
        throw new ConversionError(
          'no_pdf',
          'LibreOffice exited successfully but produced no PDF. This usually means the deck is corrupt, password-protected, or LibreOffice lacks a writable HOME/profile directory.',
          { stage: 'libreoffice', command: sofficeBin, durationMs: timings.libreoffice, timings: { ...timings } },
        );
      }

      // 2) PDF → per-page PNGs (written as page-1.png / page-01.png / …).
      const pdftoppmBin = resolvePdftoppmBin();
      await this.runStep(
        'pdftoppm',
        pdftoppmBin,
        ['-png', '-r', RENDER_DPI, pdfPath, path.join(tmpDir, 'page')],
        CONVERT_TIMEOUT_MS,
        timings,
      );

      const pages = (await fs.readdir(tmpDir))
        .filter((f) => /^page-\d+\.png$/.test(f))
        .sort((a, b) => pageNum(a) - pageNum(b))
        .slice(0, MAX_SLIDES);
      if (pages.length === 0) {
        throw new ConversionError(
          'no_slides',
          'The PDF rendered but produced no page images. Check free disk space in the uploads directory.',
          { stage: 'collect', command: pdftoppmBin, timings: { ...timings } },
        );
      }

      // 3) Normalize to slide-1.png … slide-N.png in the cache dir.
      const images: string[] = [];
      for (let i = 0; i < pages.length; i++) {
        const name = `slide-${i + 1}.png`;
        await fs.rename(path.join(tmpDir, pages[i]), path.join(cacheDir, name));
        images.push(name);
      }
      const { width, height } = await readPngSize(path.join(cacheDir, images[0]));

      const manifest: SlideManifest = {
        status: 'ready',
        slideCount: images.length,
        images: images.map((name) => `/uploads/slides/${base}/${name}`),
        width,
        height,
      };
      await fs.rm(tmpDir, { recursive: true, force: true });
      await fs.writeFile(manifestPath, JSON.stringify(manifest));
      return manifest;
    } catch (err) {
      const conv =
        err instanceof ConversionError
          ? err
          : new ConversionError(
              'conversion_failed',
              err instanceof Error ? err.message : String(err),
              { stage: 'collect', timings: { ...timings } },
            );

      console.warn(
        `[presentation] Conversion failed (${conv.code}) for ${path.basename(pptxPath)}: ${conv.message}` +
          (conv.detail.stderr ? `\n[presentation] stderr: ${conv.detail.stderr}` : ''),
      );

      const failed: SlideManifest = {
        status: 'failed',
        error: conv.code,
        errorMessage: conv.message,
        errorDetail: conv.detail,
        failedAt: Date.now(),
      };
      try {
        await fs.mkdir(cacheDir, { recursive: true });
        await fs.rm(tmpDir, { recursive: true, force: true });
        await fs.writeFile(manifestPath, JSON.stringify(failed));
      } catch {
        /* best effort */
      }
      return failed;
    }
  }
}

/** Numeric page index from a `page-<n>.png` file name. */
const pageNum = (file: string): number => parseInt(file.replace(/\D/g, ''), 10) || 0;

export const presentationService = new PresentationService();
