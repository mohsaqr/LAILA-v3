import { Router, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { v4 as uuid } from 'uuid';
import { authenticateToken, requireInstructor } from '../middleware/auth.middleware.js';
import { AuthRequest } from '../types/index.js';
import prisma from '../utils/prisma.js';

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

// Upload assignment file endpoint - instructors only, 3MB limit, csv/xlsx/png/jpg/pdf
const assignmentFileFilter = (req: Express.Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const ext = path.extname(file.originalname).toLowerCase();
  const assignmentFileExts = ['.csv', '.xlsx', '.png', '.jpg', '.jpeg', '.pdf'];
  if (!assignmentFileExts.includes(ext)) {
    cb(new Error('Only csv, xlsx, png, jpg, jpeg, pdf files are allowed'));
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
  limits: { fileSize: 3 * 1024 * 1024 }, // 3MB
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

    // If assignmentId is provided, enforce per-assignment file constraints
    const assignmentIdRaw = req.query.assignmentId;
    if (assignmentIdRaw) {
      const assignmentId = parseInt(assignmentIdRaw as string, 10);
      if (!Number.isNaN(assignmentId)) {
        const assignment = await prisma.assignment.findUnique({
          where: { id: assignmentId },
          select: { allowedFileTypes: true, maxFileSize: true },
        });

        if (assignment) {
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
