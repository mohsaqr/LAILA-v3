import { Router, Response } from 'express';
import multer from 'multer';
import { batchEnrollmentService } from '../services/batchEnrollment.service.js';
import { authenticateToken, requireInstructor } from '../middleware/auth.middleware.js';
import { asyncHandler, AppError } from '../middleware/error.middleware.js';
import { AuthRequest } from '../types/index.js';

const router = Router();

// Configure multer for CSV upload
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'text/csv' || file.originalname.endsWith('.csv')) {
      cb(null, true);
    } else {
      cb(new Error('Only CSV files are allowed'));
    }
  },
});

// All routes require authentication and instructor role
router.use(authenticateToken, requireInstructor);

// Upload CSV and create batch enrollment job
router.post(
  '/courses/:courseId/upload',
  upload.single('file'),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const courseId = parseInt(req.params.courseId);

    // Check access
    const hasAccess = await batchEnrollmentService.hasAccessToCourse(
      req.user!.id,
      courseId,
      req.user!.isAdmin
    );

    if (!hasAccess) {
      throw new AppError('Not authorized to manage enrollments for this course', 403);
    }

    if (!req.file) {
      throw new AppError('No file uploaded', 400);
    }

    const csvContent = req.file.buffer.toString('utf-8');
    const rows = batchEnrollmentService.parseCSV(csvContent);

    // Create job
    const job = await batchEnrollmentService.createJob(
      courseId,
      req.file.originalname,
      rows.length,
      req.user!.id
    );

    // Process job (in real app, this would be queued)
    const ipAddress = (req.headers['x-forwarded-for'] as string)?.split(',')[0] || req.ip;

    const completedJob = await batchEnrollmentService.processJob(job.id, rows, {
      adminId: req.user!.id,
      adminEmail: req.user!.email,
      ipAddress,
    });

    res.status(201).json({ success: true, data: completedJob });
  })
);

// Get batch enrollment jobs
router.get('/jobs', asyncHandler(async (req: AuthRequest, res: Response) => {
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 20;
  const courseId = req.query.courseId ? parseInt(req.query.courseId as string) : undefined;
  const status = req.query.status as string | undefined;

  // If not admin, only show jobs they created or for courses they teach
  let filters: any = {
    courseId,
    status,
  };

  if (!req.user!.isAdmin) {
    filters.createdBy = req.user!.id;
  }

  const result = await batchEnrollmentService.getJobs(page, limit, filters);
  res.json({ success: true, ...result });
}));

// Get job by ID
router.get('/jobs/:id', asyncHandler(async (req: AuthRequest, res: Response) => {
  const jobId = parseInt(req.params.id);

  const hasAccess = await batchEnrollmentService.hasAccessToJob(
    req.user!.id,
    jobId,
    req.user!.isAdmin
  );

  if (!hasAccess) {
    throw new AppError('Not authorized to view this job', 403);
  }

  const job = await batchEnrollmentService.getJobById(jobId);
  res.json({ success: true, data: job });
}));

// Get job results
router.get('/jobs/:id/results', asyncHandler(async (req: AuthRequest, res: Response) => {
  const jobId = parseInt(req.params.id);
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 50;
  const status = req.query.status as string | undefined;

  const hasAccess = await batchEnrollmentService.hasAccessToJob(
    req.user!.id,
    jobId,
    req.user!.isAdmin
  );

  if (!hasAccess) {
    throw new AppError('Not authorized to view this job', 403);
  }

  const result = await batchEnrollmentService.getJobResults(jobId, page, limit, status);
  res.json({ success: true, ...result });
}));

// Download CSV template
router.get('/template', asyncHandler(async (req: AuthRequest, res: Response) => {
  const template = batchEnrollmentService.getCSVTemplate();
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename=enrollment_template.csv');
  res.send(template);
}));

export default router;
