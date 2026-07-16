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

// Bound conversion cost.
const RENDER_DPI = '150';
const MAX_SLIDES = 300;
const CONVERT_TIMEOUT_MS = 120_000;
// After a failed conversion, wait this long before auto-retrying (so a genuinely
// broken deck doesn't respawn the binaries on every view, but installing the
// binaries / fixing config self-heals on the next visit).
const RETRY_COOLDOWN_MS = 60_000;

// Directories where soffice/pdftoppm commonly live, so we work even when the
// server process runs with a minimal PATH (systemd, pm2, launchd, …).
const EXTRA_PATHS = ['/opt/homebrew/bin', '/usr/local/bin', '/usr/bin', '/bin'];

export interface SlideManifest {
  status: 'ready' | 'processing' | 'failed';
  slideCount?: number;
  /** Public `/uploads/slides/...` URLs, one per slide, in order. */
  images?: string[];
  /** Pixel dimensions of the rendered slides (for the client aspect box). */
  width?: number;
  height?: number;
  error?: string;
  /** Epoch ms of the last failure, used to throttle auto-retries. */
  failedAt?: number;
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

    await this.assertAccess(section.lecture.module.course, user);

    if (!isPresentationFile(section.fileName, section.fileType) || !section.fileUrl) {
      throw new AppError('This section is not a PowerPoint presentation', 400);
    }

    const pptxPath = this.resolvePptxPath(section.fileUrl);
    if (!existsSync(pptxPath)) throw new AppError('Presentation file not found', 404);

    const base = this.cacheBase(pptxPath);
    const cacheDir = path.join(SLIDES_DIR, base);
    const manifestPath = path.join(cacheDir, 'manifest.json');

    const cached = await this.readManifest(manifestPath, base);
    if (cached?.status === 'ready' && cached.images) return cached;
    // A prior failure is retried after a cooldown (so installing the binaries or
    // fixing config recovers automatically); within the window, report failed.
    if (cached?.status === 'failed' && Date.now() - (cached.failedAt ?? 0) < RETRY_COOLDOWN_MS) {
      return { status: 'failed' };
    }

    // Conversion already running for this deck.
    if (this.inFlight.has(base)) return { status: 'processing' };

    const job = this.convert(pptxPath, cacheDir, base).finally(() => this.inFlight.delete(base));
    this.inFlight.set(base, job);
    // Don't block the request on the (slow) conversion — the client polls.
    return { status: 'processing' };
  }

  private async assertAccess(
    course: { id: number; instructorId: number },
    user: AccessUser,
  ): Promise<void> {
    if (user.isAdmin) return;
    if (course.instructorId === user.id) return;
    if (await courseRoleService.isTeamMember(user.id, course.id)) return;
    const enrollment = await prisma.enrollment.findUnique({
      where: { userId_courseId: { userId: user.id, courseId: course.id } },
    });
    if (enrollment) return;
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
   * soffice → PDF → pdftoppm → per-slide PNGs. Writes a `ready` manifest on
   * success or a terminal `failed` manifest otherwise (so we don't respawn the
   * binaries on every view). Never throws — the caller only awaits for dedupe.
   */
  private async convert(pptxPath: string, cacheDir: string, base: string): Promise<SlideManifest> {
    const tmpDir = path.join(cacheDir, '.tmp');
    const manifestPath = path.join(cacheDir, 'manifest.json');
    try {
      // Start from a clean cache dir so a retry can't mix with stale output.
      await fs.rm(cacheDir, { recursive: true, force: true });
      await fs.mkdir(tmpDir, { recursive: true });

      // 1) PowerPoint → PDF. A unique UserInstallation profile lets concurrent
      //    conversions run without colliding on soffice's shared profile.
      await execFileAsync(
        resolveSofficeBin(),
        [
          '--headless',
          `-env:UserInstallation=file://${path.join(tmpDir, 'profile')}`,
          '--convert-to',
          'pdf',
          '--outdir',
          tmpDir,
          pptxPath,
        ],
        { timeout: CONVERT_TIMEOUT_MS, env: execEnv() },
      );
      const pdfPath = path.join(tmpDir, `${path.parse(pptxPath).name}.pdf`);
      if (!existsSync(pdfPath)) throw new Error('LibreOffice did not produce a PDF');

      // 2) PDF → per-page PNGs (written as page-1.png / page-01.png / …).
      await execFileAsync(
        resolvePdftoppmBin(),
        ['-png', '-r', RENDER_DPI, pdfPath, path.join(tmpDir, 'page')],
        { timeout: CONVERT_TIMEOUT_MS, env: execEnv() },
      );

      const pages = (await fs.readdir(tmpDir))
        .filter((f) => /^page-\d+\.png$/.test(f))
        .sort((a, b) => pageNum(a) - pageNum(b))
        .slice(0, MAX_SLIDES);
      if (pages.length === 0) throw new Error('No slides were rendered');

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
      const message = err instanceof Error ? err.message : String(err);
      // ENOENT on the binary → surface an actionable hint in the server log.
      if (/ENOENT/.test(message)) {
        console.warn(
          '[presentation] Conversion failed: soffice/pdftoppm not found. ' +
            'Install with `apt-get install -y libreoffice poppler-utils` (or set SOFFICE_BIN/PDFTOPPM_BIN).',
        );
      } else {
        console.warn('[presentation] Conversion failed:', message);
      }
      const failed: SlideManifest = { status: 'failed', error: 'conversion_failed', failedAt: Date.now() };
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
