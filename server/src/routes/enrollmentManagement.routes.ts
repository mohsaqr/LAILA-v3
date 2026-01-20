import { Router, Response } from 'express';
import { enrollmentManagementService } from '../services/enrollmentManagement.service.js';
import { authenticateToken, requireAdmin, requireInstructor } from '../middleware/auth.middleware.js';
import { asyncHandler, AppError } from '../middleware/error.middleware.js';
import {
  createEnrollmentSchema,
  addUserToCourseSchema,
} from '../utils/validation.js';
import { AuthRequest } from '../types/index.js';

const router = Router();

// All routes require authentication
router.use(authenticateToken);

// ============================================================================
// ADMIN ONLY ROUTES
// ============================================================================

// Get all enrollments (admin only)
router.get('/enrollments', requireAdmin, asyncHandler(async (req: AuthRequest, res: Response) => {
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 20;
  const courseId = req.query.courseId ? parseInt(req.query.courseId as string) : undefined;
  const userId = req.query.userId ? parseInt(req.query.userId as string) : undefined;
  const status = req.query.status as string | undefined;
  const search = req.query.search as string | undefined;

  const result = await enrollmentManagementService.getEnrollments(page, limit, {
    courseId,
    userId,
    status,
    search,
  });

  res.json({ success: true, ...result });
}));

// Create enrollment (admin only)
router.post('/enrollments', requireAdmin, asyncHandler(async (req: AuthRequest, res: Response) => {
  const { userId, courseId } = createEnrollmentSchema.parse(req.body);
  const ipAddress = (req.headers['x-forwarded-for'] as string)?.split(',')[0] || req.ip;

  const enrollment = await enrollmentManagementService.createEnrollment(userId, courseId, {
    adminId: req.user!.id,
    adminEmail: req.user!.email,
    ipAddress,
  });

  res.status(201).json({ success: true, data: enrollment });
}));

// Delete enrollment by ID (admin only)
router.delete('/enrollments/:id', requireAdmin, asyncHandler(async (req: AuthRequest, res: Response) => {
  const enrollmentId = parseInt(req.params.id);
  const ipAddress = (req.headers['x-forwarded-for'] as string)?.split(',')[0] || req.ip;

  const result = await enrollmentManagementService.deleteEnrollment(enrollmentId, {
    adminId: req.user!.id,
    adminEmail: req.user!.email,
    ipAddress,
  });

  res.json({ success: true, ...result });
}));

// Get enrollment stats (admin only)
router.get('/enrollments/stats', requireAdmin, asyncHandler(async (req: AuthRequest, res: Response) => {
  const stats = await enrollmentManagementService.getEnrollmentStats();
  res.json({ success: true, data: stats });
}));

// ============================================================================
// COURSE-SPECIFIC ROUTES (Admin or Instructor)
// ============================================================================

// Get course enrollments
router.get('/courses/:courseId/enrollments', requireInstructor, asyncHandler(async (req: AuthRequest, res: Response) => {
  const courseId = parseInt(req.params.courseId);
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 20;
  const search = req.query.search as string | undefined;

  // Check if user is admin or has access to this course
  if (!req.user!.isAdmin) {
    const hasAccess = await enrollmentManagementService.hasInstructorAccess(req.user!.id, courseId);
    if (!hasAccess) {
      throw new AppError('Not authorized to manage this course', 403);
    }
  }

  const result = await enrollmentManagementService.getCourseEnrollments(courseId, page, limit, search);
  res.json({ success: true, ...result });
}));

// Add user to course by email
router.post('/courses/:courseId/enrollments', requireInstructor, asyncHandler(async (req: AuthRequest, res: Response) => {
  const courseId = parseInt(req.params.courseId);
  const { email } = addUserToCourseSchema.parse(req.body);
  const ipAddress = (req.headers['x-forwarded-for'] as string)?.split(',')[0] || req.ip;

  // Check if user is admin or has access to this course
  if (!req.user!.isAdmin) {
    const hasAccess = await enrollmentManagementService.hasInstructorAccess(req.user!.id, courseId);
    if (!hasAccess) {
      throw new AppError('Not authorized to manage this course', 403);
    }
  }

  const enrollment = await enrollmentManagementService.addUserToCourse(courseId, email, {
    adminId: req.user!.id,
    adminEmail: req.user!.email,
    ipAddress,
  });

  res.status(201).json({ success: true, data: enrollment });
}));

// Remove user from course
router.delete('/courses/:courseId/users/:userId', requireInstructor, asyncHandler(async (req: AuthRequest, res: Response) => {
  const courseId = parseInt(req.params.courseId);
  const userId = parseInt(req.params.userId);
  const ipAddress = (req.headers['x-forwarded-for'] as string)?.split(',')[0] || req.ip;

  // Check if user is admin or has access to this course
  if (!req.user!.isAdmin) {
    const hasAccess = await enrollmentManagementService.hasInstructorAccess(req.user!.id, courseId);
    if (!hasAccess) {
      throw new AppError('Not authorized to manage this course', 403);
    }
  }

  const result = await enrollmentManagementService.removeUserFromCourse(courseId, userId, {
    adminId: req.user!.id,
    adminEmail: req.user!.email,
    ipAddress,
  });

  res.json({ success: true, ...result });
}));

export default router;
