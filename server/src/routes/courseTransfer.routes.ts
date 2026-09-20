/**
 * Course export / import / duplicate. Mounted under /api/courses, ahead of the
 * main course router so `/import` is never mistaken for a course id. Auth is
 * per route, never `router.use`: this router sees every /api/courses request,
 * including the public catalog, before passing it on.
 */
import { Router, Response } from 'express';
import multer from 'multer';
import { authenticateToken, requireInstructor } from '../middleware/auth.middleware.js';
import { asyncHandler, AppError } from '../middleware/error.middleware.js';
import { AuthRequest } from '../types/index.js';
import { courseExportService } from '../services/courseExport.service.js';
import { courseImportService } from '../services/courseImport.service.js';
import { COURSE_PACKAGE_EXTENSION } from '../services/coursePackage.schema.js';
import {
  parseSelection,
  EXPORT_SECTIONS,
  PERSONAL_DATA_SECTIONS,
  DESIGN_SECTIONS,
} from '../services/coursePackage.selection.js';

const router = Router();

/** Uploaded packages are read fully into memory by the zip parser. */
const MAX_UPLOAD_BYTES = 512 * 1024 * 1024;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_UPLOAD_BYTES, files: 1 },
  fileFilter: (_req, file, cb) => {
    if (/\.zip$/i.test(file.originalname)) cb(null, true);
    else cb(new AppError(`Expected a ${COURSE_PACKAGE_EXTENSION} package`, 400));
  },
});

const courseIdParam = (raw: string): number => {
  const id = Number.parseInt(raw, 10);
  if (!Number.isInteger(id) || id <= 0) throw new AppError('Invalid course id', 400);
  return id;
};

/** Import a package as a new draft course owned by the caller. */
router.post(
  '/import',
  authenticateToken,
  requireInstructor,
  upload.single('package'),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!req.file) throw new AppError('No package uploaded (field "package")', 400);
    const title = typeof req.body?.title === 'string' && req.body.title.trim() ? req.body.title.trim() : undefined;
    const report = await courseImportService.importZip(req.file.buffer, req.user!.id, { title });
    res.status(201).json({ success: true, data: report });
  }),
);

/**
 * What this instance can put in an export, so the UI can build its checklist
 * from the server's catalogue rather than a copy that drifts.
 */
router.get(
  '/export/sections',
  authenticateToken,
  requireInstructor,
  asyncHandler(async (_req: AuthRequest, res: Response) => {
    res.json({
      success: true,
      data: {
        sections: EXPORT_SECTIONS,
        personal: PERSONAL_DATA_SECTIONS,
        default: DESIGN_SECTIONS,
      },
    });
  }),
);

/**
 * Download a course as a package.
 *
 * `?include=design,grades` selects sections; `?include=all` takes everything;
 * omitting it keeps the historical design-only behaviour, so existing links
 * and bookmarks are unaffected. Sections covering other people's data are
 * additionally gated inside the service on course-owner rights.
 */
router.get(
  '/:id/export',
  authenticateToken,
  requireInstructor,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const courseId = courseIdParam(req.params.id);
    let selection;
    try {
      selection = parseSelection(req.query.include);
    } catch {
      throw new AppError(
        `Unknown export section. Valid sections: ${EXPORT_SECTIONS.join(', ')}`,
        400,
      );
    }
    const { archive, fileName, missingFiles, warnings } = await courseExportService.streamZip(
      courseId,
      req.user!.id,
      req.user!.isAdmin,
      selection,
    );
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(fileName)}"`);
    res.setHeader('X-Laila-Missing-Files', String(missingFiles.length));
    // Lets a client confirm what it actually received without opening the zip.
    res.setHeader('X-Laila-Sections', selection.join(','));
    // A capped activity log is the main case: the download succeeds, but the
    // caller needs to know it is not the whole history. Headers must be ASCII
    // and single-line, so the text is sanitised rather than sent raw.
    if (warnings.length) {
      res.setHeader(
        'X-Laila-Warnings',
        warnings.map((w) => w.replace(/[^\x20-\x7E]/g, ' ')).join(' | ').slice(0, 900),
      );
    }
    archive.on('error', (err: Error) => {
      // Headers are already out; the only honest option is to cut the stream so
      // the client sees a broken download rather than a truncated "valid" zip.
      console.error('[course-export] archive error:', err);
      res.destroy(err);
    });
    archive.pipe(res);
  }),
);

/** Copy a course inside this instance; the copy is a draft owned by the caller. */
router.post(
  '/:id/duplicate',
  authenticateToken,
  requireInstructor,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const courseId = courseIdParam(req.params.id);
    const title = typeof req.body?.title === 'string' && req.body.title.trim() ? req.body.title.trim() : undefined;
    const report = await courseImportService.duplicateCourse(courseId, req.user!.id, req.user!.isAdmin, { title });
    res.status(201).json({ success: true, data: report });
  }),
);

export default router;
