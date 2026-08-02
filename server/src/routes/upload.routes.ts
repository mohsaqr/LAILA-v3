import { Router, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { v4 as uuid } from 'uuid';
import { authenticateToken, requireInstructor } from '../middleware/auth.middleware.js';
import { AuthRequest } from '../types/index.js';
import prisma from '../utils/prisma.js';
import { courseRoleService } from '../services/courseRole.service.js';

const router = Router();

// Ensure uploads directory exists
const uploadsDir = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Configure multer storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const uniqueName = `${uuid()}${ext}`;
    cb(null, uniqueName);
  },
});

// Map of allowed extensions to their expected MIME types
const allowedExtensions: Record<string, string[]> = {
  // Documents
  '.pdf': ['application/pdf'],
  '.doc': ['application/msword'],
  '.docx': ['application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
  '.ppt': ['application/vnd.ms-powerpoint'],
  '.pptx': ['application/vnd.openxmlformats-officedocument.presentationml.presentation'],
  '.xls': ['application/vnd.ms-excel'],
  '.xlsx': ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
  '.txt': ['text/plain'],
  '.csv': ['text/csv', 'application/vnd.ms-excel'],
  // Images (SVG excluded due to XSS risk)
  '.jpg': ['image/jpeg'],
  '.jpeg': ['image/jpeg'],
  '.png': ['image/png'],
  '.gif': ['image/gif'],
  '.webp': ['image/webp'],
  // Video
  '.mp4': ['video/mp4'],
  '.mov': ['video/quicktime'],
  '.webm': ['video/webm'],
  // Audio
  '.mp3': ['audio/mpeg'],
  '.wav': ['audio/wav', 'audio/wave', 'audio/x-wav'],
  '.ogg': ['audio/ogg'],
  // Archives
  '.zip': ['application/zip', 'application/x-zip-compressed'],
  '.rar': ['application/x-rar-compressed', 'application/vnd.rar'],
  '.7z': ['application/x-7z-compressed'],
};

// File filter with extension and MIME type validation
const fileFilter = (req: Express.Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const ext = path.extname(file.originalname).toLowerCase();

  // Block SVG files explicitly (XSS risk)
  if (ext === '.svg' || file.mimetype === 'image/svg+xml') {
    cb(new Error('SVG files are not allowed for security reasons'));
    return;
  }

  // Check if extension is allowed
  const allowedMimes = allowedExtensions[ext];
  if (!allowedMimes) {
    cb(new Error(`File extension ${ext} is not allowed`));
    return;
  }

  // Validate that MIME type matches the extension
  if (!allowedMimes.includes(file.mimetype)) {
    cb(new Error(`File type mismatch: ${ext} file with ${file.mimetype} MIME type is not allowed`));
    return;
  }

  cb(null, true);
};

// Configure upload with 50MB limit
const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB
  },
});

// Upload file endpoint - requires authentication and instructor role
router.post(
  '/file',
  authenticateToken,
  requireInstructor,
  upload.single('file'),
  (req: AuthRequest, res: Response) => {
    if (!req.file) {
      res.status(400).json({
        success: false,
        error: 'No file uploaded',
      });
      return;
    }

    // Return the URL path that can be used to access the file
    const fileUrl = `/uploads/${req.file.filename}`;

    res.json({
      success: true,
      data: {
        url: fileUrl,
        path: fileUrl,
        originalName: req.file.originalname,
        filename: req.file.filename,
        size: req.file.size,
        mimetype: req.file.mimetype,
      },
    });
  }
);

// Upload (lecture) video endpoint — instructors only. Stored in a dedicated
// uploads/courses/videos folder, larger size cap, mp4/mov/webm only.
const videosDir = path.join(uploadsDir, 'courses', 'videos');
if (!fs.existsSync(videosDir)) {
  fs.mkdirSync(videosDir, { recursive: true });
}

const videoStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, videosDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${uuid()}${ext}`);
  },
});

const videoFilter = (req: Express.Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const ext = path.extname(file.originalname).toLowerCase();
  const videoExts = ['.mp4', '.mov', '.webm'];
  if (!videoExts.includes(ext)) {
    cb(new Error('Only mp4, mov, webm video files are allowed'));
    return;
  }
  const allowedMimes = allowedExtensions[ext];
  if (!allowedMimes || !allowedMimes.includes(file.mimetype)) {
    cb(new Error(`File type mismatch: ${ext} file with ${file.mimetype} MIME type`));
    return;
  }
  cb(null, true);
};

const videoUpload = multer({
  storage: videoStorage,
  fileFilter: videoFilter,
  limits: { fileSize: 200 * 1024 * 1024 }, // 200MB
});

router.post(
  '/video',
  authenticateToken,
  requireInstructor,
  videoUpload.single('file'),
  (req: AuthRequest, res: Response) => {
    if (!req.file) {
      res.status(400).json({ success: false, error: 'No file uploaded' });
      return;
    }
    const fileUrl = `/uploads/courses/videos/${req.file.filename}`;
    res.json({
      success: true,
      data: {
        url: fileUrl,
        path: fileUrl,
        originalName: req.file.originalname,
        filename: req.file.filename,
        size: req.file.size,
        mimetype: req.file.mimetype,
      },
    });
  }
);

// Upload image endpoint - any authenticated user (for forum posts, etc.)
const imageFilter = (req: Express.Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const ext = path.extname(file.originalname).toLowerCase();
  const imageExts = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
  if (!imageExts.includes(ext)) {
    cb(new Error('Only image files (jpg, png, gif, webp) are allowed'));
    return;
  }
  const allowedMimes = allowedExtensions[ext];
  if (!allowedMimes || !allowedMimes.includes(file.mimetype)) {
    cb(new Error(`File type mismatch: ${ext} file with ${file.mimetype} MIME type`));
    return;
  }
  cb(null, true);
};

const imageUpload = multer({
  storage,
  fileFilter: imageFilter,
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB
});

router.post(
  '/image',
  authenticateToken,
  imageUpload.single('file'),
  (req: AuthRequest, res: Response) => {
    if (!req.file) {
      res.status(400).json({ success: false, error: 'No file uploaded' });
      return;
    }
    const fileUrl = `/uploads/${req.file.filename}`;
    res.json({
      success: true,
      data: {
        url: fileUrl,
        path: fileUrl,
        originalName: req.file.originalname,
        filename: req.file.filename,
        size: req.file.size,
        mimetype: req.file.mimetype,
      },
    });
  }
);

// Upload thumbnail endpoint - instructors only, 1MB limit, png/jpg/jpeg only
const thumbnailFilter = (req: Express.Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const ext = path.extname(file.originalname).toLowerCase();
  const thumbnailExts = ['.jpg', '.jpeg', '.png'];
  if (!thumbnailExts.includes(ext)) {
    cb(new Error('Only image files (jpg, jpeg, png) are allowed for thumbnails'));
    return;
  }
  const allowedMimes = allowedExtensions[ext];
  if (!allowedMimes || !allowedMimes.includes(file.mimetype)) {
    cb(new Error(`File type mismatch: ${ext} file with ${file.mimetype} MIME type`));
    return;
  }
  cb(null, true);
};

const thumbnailUpload = multer({
  storage,
  fileFilter: thumbnailFilter,
  limits: { fileSize: 1 * 1024 * 1024 }, // 1MB
});

router.post(
  '/thumbnail',
  authenticateToken,
  requireInstructor,
  thumbnailUpload.single('file'),
  (req: AuthRequest, res: Response) => {
    if (!req.file) {
      res.status(400).json({ success: false, error: 'No file uploaded' });
      return;
    }
    const fileUrl = `/uploads/${req.file.filename}`;
    res.json({
      success: true,
      data: {
        url: fileUrl,
        originalName: req.file.originalname,
        filename: req.file.filename,
        size: req.file.size,
        mimetype: req.file.mimetype,
      },
    });
  }
);

// Upload agent avatar endpoint - any authenticated user, 1MB limit, png/jpg/jpeg only
const agentAvatarUpload = multer({
  storage,
  fileFilter: thumbnailFilter,
  limits: { fileSize: 1 * 1024 * 1024 }, // 1MB
});

router.post(
  '/agent-avatar',
  authenticateToken,
  agentAvatarUpload.single('file'),
  (req: AuthRequest, res: Response) => {
    if (!req.file) {
      res.status(400).json({ success: false, error: 'No file uploaded' });
      return;
    }
    const fileUrl = `/uploads/${req.file.filename}`;
    res.json({
      success: true,
      data: {
        url: fileUrl,
        originalName: req.file.originalname,
        filename: req.file.filename,
        size: req.file.size,
        mimetype: req.file.mimetype,
      },
    });
  }
);

/**
 * Formats an instructor may attach to an assignment: the documents, data files,
 * images and archives that make up course material.
 *
 * Wider than the original six (csv/xlsx/png/jpg/jpeg/pdf), which could not carry
 * a Word brief, a slide deck or a starter zip. Still narrower than
 * `allowedExtensions` — video and audio are excluded because the size cap below
 * cannot serve them and lectures already have their own media path.
 *
 * Every entry must also exist in `allowedExtensions`: the filter below still
 * runs the extension↔MIME cross-check, so a renamed binary is rejected. `.svg`
 * is absent from both, which is what blocks it (XSS).
 */
export const ASSIGNMENT_FILE_EXTENSIONS = [
  '.pdf', '.doc', '.docx', '.ppt', '.pptx', '.xls', '.xlsx', '.txt', '.csv',
  '.jpg', '.jpeg', '.png', '.gif', '.webp',
  '.zip', '.rar', '.7z',
];

/** 3MB, unchanged. Mirrored client-side in `client/src/constants/assignmentFiles.ts`. */
export const ASSIGNMENT_FILE_MAX_BYTES = 3 * 1024 * 1024;

// Upload assignment file endpoint - instructors only
const assignmentFileFilter = (req: Express.Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const ext = path.extname(file.originalname).toLowerCase();
  if (!ASSIGNMENT_FILE_EXTENSIONS.includes(ext)) {
    cb(new Error(`File extension ${ext || '(none)'} is not allowed for assignment attachments`));
    return;
  }
  const allowedMimes = allowedExtensions[ext];
  if (!allowedMimes || !allowedMimes.includes(file.mimetype)) {
    cb(new Error(`File type mismatch: ${ext} file with ${file.mimetype} MIME type`));
    return;
  }
  cb(null, true);
};

const assignmentFileUpload = multer({
  storage,
  fileFilter: assignmentFileFilter,
  limits: { fileSize: ASSIGNMENT_FILE_MAX_BYTES },
});

router.post(
  '/assignment-file',
  authenticateToken,
  requireInstructor,
  assignmentFileUpload.single('file'),
  (req: AuthRequest, res: Response) => {
    if (!req.file) {
      res.status(400).json({ success: false, error: 'No file uploaded' });
      return;
    }
    const fileUrl = `/uploads/${req.file.filename}`;
    res.json({
      success: true,
      data: {
        url: fileUrl,
        originalName: req.file.originalname,
        filename: req.file.filename,
        size: req.file.size,
        mimetype: req.file.mimetype,
      },
    });
  }
);

// Lab submission upload — any authenticated student, PDF only, 20MB limit
const labSubmissionFilter = (req: Express.Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const ext = path.extname(file.originalname).toLowerCase();
  if (ext !== '.pdf') {
    cb(new Error('Only PDF files are allowed for lab submissions'));
    return;
  }
  const allowedMimes = allowedExtensions[ext];
  if (!allowedMimes || !allowedMimes.includes(file.mimetype)) {
    cb(new Error(`File type mismatch: ${ext} file with ${file.mimetype} MIME type`));
    return;
  }
  cb(null, true);
};

const labSubmissionUpload = multer({
  storage,
  fileFilter: labSubmissionFilter,
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB
});

router.post(
  '/lab-submission',
  authenticateToken,
  labSubmissionUpload.single('file'),
  (req: AuthRequest, res: Response) => {
    if (!req.file) {
      res.status(400).json({ success: false, error: 'No file uploaded' });
      return;
    }
    const fileUrl = `/uploads/${req.file.filename}`;
    res.json({
      success: true,
      data: {
        url: fileUrl,
        originalName: req.file.originalname,
        filename: req.file.filename,
        size: req.file.size,
        mimetype: req.file.mimetype,
      },
    });
  }
);

// Assignment submission upload — any authenticated student, common formats, 10MB
const assignmentSubmissionFilter = (req: Express.Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const ext = path.extname(file.originalname).toLowerCase();
  const submissionExts = ['.pdf', '.doc', '.docx', '.txt', '.png', '.jpg', '.jpeg', '.xlsx', '.csv'];
  if (!submissionExts.includes(ext)) {
    cb(new Error('Only pdf, doc, docx, txt, png, jpg, jpeg, xlsx, csv files are allowed'));
    return;
  }
  const allowedMimes = allowedExtensions[ext];
  if (!allowedMimes || !allowedMimes.includes(file.mimetype)) {
    cb(new Error(`File type mismatch: ${ext} file with ${file.mimetype} MIME type`));
    return;
  }
  cb(null, true);
};

const assignmentSubmissionUpload = multer({
  storage,
  fileFilter: assignmentSubmissionFilter,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
});

router.post(
  '/assignment-submission',
  authenticateToken,
  assignmentSubmissionUpload.single('file'),
  async (req: AuthRequest, res: Response) => {
    if (!req.file) {
      res.status(400).json({ success: false, error: 'No file uploaded' });
      return;
    }

    // If assignmentId is provided, verify the caller may submit to it and then
    // enforce per-assignment file constraints.
    const assignmentIdRaw = req.query.assignmentId;
    if (assignmentIdRaw) {
      const assignmentId = parseInt(assignmentIdRaw as string, 10);
      if (!Number.isNaN(assignmentId)) {
        const assignment = await prisma.assignment.findUnique({
          where: { id: assignmentId },
          select: { allowedFileTypes: true, maxFileSize: true, courseId: true },
        });

        if (assignment) {
          // Access check BEFORE keeping the file: the submitter must be enrolled
          // in (or be staff/admin of) the assignment's course. Otherwise any
          // authenticated user could stash files against someone else's course.
          const userId = req.user!.id;
          const isStaff = req.user!.isAdmin
            || (await courseRoleService.isTeamMember(userId, assignment.courseId))
            || !!(await prisma.course.findFirst({
              where: { id: assignment.courseId, instructorId: userId },
              select: { id: true },
            }));
          if (!isStaff) {
            const enrollment = await prisma.enrollment.findUnique({
              where: { userId_courseId: { userId, courseId: assignment.courseId } },
              select: { id: true },
            });
            if (!enrollment) {
              fs.unlinkSync(req.file.path);
              res.status(403).json({
                success: false,
                error: 'You must be enrolled in this course to submit to this assignment.',
              });
              return;
            }
          }

          // Check allowed file types (comma-separated extensions like ".pdf,.docx")
          if (assignment.allowedFileTypes) {
            const ext = path.extname(req.file.originalname).toLowerCase();
            const allowed = assignment.allowedFileTypes
              .split(',')
              .map(t => t.trim().toLowerCase())
              .filter(Boolean);
            if (allowed.length > 0 && !allowed.includes(ext)) {
              fs.unlinkSync(req.file.path);
              res.status(400).json({
                success: false,
                error: `File type ${ext} is not allowed. Accepted types: ${assignment.allowedFileTypes}`,
              });
              return;
            }
          }

          // Check max file size (stored as MB in the database)
          if (assignment.maxFileSize) {
            const maxBytes = assignment.maxFileSize * 1024 * 1024;
            if (req.file.size > maxBytes) {
              fs.unlinkSync(req.file.path);
              res.status(400).json({
                success: false,
                error: `File size (${(req.file.size / (1024 * 1024)).toFixed(1)} MB) exceeds the ${assignment.maxFileSize} MB limit for this assignment.`,
              });
              return;
            }
          }
        }
      }
    }

    const fileUrl = `/uploads/${req.file.filename}`;
    res.json({
      success: true,
      data: {
        url: fileUrl,
        originalName: req.file.originalname,
        filename: req.file.filename,
        size: req.file.size,
        mimetype: req.file.mimetype,
      },
    });
  }
);

// Error handling for multer errors
router.use((err: Error, req: AuthRequest, res: Response, next: Function) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      res.status(400).json({
        success: false,
        error: 'File too large for this upload type.',
      });
      return;
    }
    res.status(400).json({
      success: false,
      error: `Upload error: ${err.message}`,
    });
    return;
  }
  if (err) {
    res.status(400).json({
      success: false,
      error: err.message,
    });
    return;
  }
  next();
});

export default router;
