import { Router, Response } from 'express';
import { userManagementService } from '../services/userManagement.service.js';
import { authenticateToken, requireAdmin } from '../middleware/auth.middleware.js';
import { asyncHandler } from '../middleware/error.middleware.js';
import {
  adminUpdateUserSchema,
  updateUserRolesSchema,
  createEnrollmentSchema,
  parsePaginationLimit,
} from '../utils/validation.js';
import { AuthRequest } from '../types/index.js';

const router = Router();

// All routes require admin authentication
router.use(authenticateToken, requireAdmin);

// Get all users (paginated, searchable)
router.get('/users', asyncHandler(async (req: AuthRequest, res: Response) => {
  const page = parseInt(req.query.page as string) || 1;
  const limit = parsePaginationLimit(req.query.limit as string, 20);
  const search = req.query.search as string;
  const role = req.query.role as 'admin' | 'instructor' | 'student' | undefined;
  const isActive = req.query.isActive === 'true' ? true : req.query.isActive === 'false' ? false : undefined;

  const result = await userManagementService.getUsers(page, limit, {
    search,
    role,
    isActive,
  });

  res.json({ success: true, ...result });
}));

// Get user stats
router.get('/users/stats', asyncHandler(async (req: AuthRequest, res: Response) => {
  const stats = await userManagementService.getUserStats();
  res.json({ success: true, data: stats });
}));

// Get user by ID
router.get('/users/:id', asyncHandler(async (req: AuthRequest, res: Response) => {
  const id = parseInt(req.params.id);
  const user = await userManagementService.getUserById(id);
  res.json({ success: true, data: user });
}));

// Get user with full details (enrollments, courses, roles)
router.get('/users/:id/details', asyncHandler(async (req: AuthRequest, res: Response) => {
  const id = parseInt(req.params.id);
  const user = await userManagementService.getUserWithEnrollments(id);
  res.json({ success: true, data: user });
}));

// Update user
router.put('/users/:id', asyncHandler(async (req: AuthRequest, res: Response) => {
  const id = parseInt(req.params.id);
  const data = adminUpdateUserSchema.parse(req.body);
  const ipAddress = (req.headers['x-forwarded-for'] as string)?.split(',')[0] || req.ip;

  const user = await userManagementService.updateUser(id, data, {
    adminId: req.user!.id,
    adminEmail: req.user!.email,
    ipAddress,
  });

  res.json({ success: true, data: user });
}));

// Delete user
router.delete('/users/:id', asyncHandler(async (req: AuthRequest, res: Response) => {
  const id = parseInt(req.params.id);
  const ipAddress = (req.headers['x-forwarded-for'] as string)?.split(',')[0] || req.ip;

  // Prevent self-deletion
  if (req.user!.id === id) {
    res.status(400).json({ success: false, error: 'Cannot delete your own account' });
    return;
  }

  const result = await userManagementService.deleteUser(id, {
    adminId: req.user!.id,
    adminEmail: req.user!.email,
    ipAddress,
  });

  res.json({ success: true, ...result });
}));

// Update user roles
router.put('/users/:id/roles', asyncHandler(async (req: AuthRequest, res: Response) => {
  const id = parseInt(req.params.id);
  const roles = updateUserRolesSchema.parse(req.body);
  const ipAddress = (req.headers['x-forwarded-for'] as string)?.split(',')[0] || req.ip;

  const user = await userManagementService.updateUserRoles(id, roles, {
    adminId: req.user!.id,
    adminEmail: req.user!.email,
    ipAddress,
  });

  res.json({ success: true, data: user });
}));

// Get user's enrollments
router.get('/users/:id/enrollments', asyncHandler(async (req: AuthRequest, res: Response) => {
  const id = parseInt(req.params.id);
  const page = parseInt(req.query.page as string) || 1;
  const limit = parsePaginationLimit(req.query.limit as string, 20);

  const result = await userManagementService.getUserEnrollments(id, page, limit);
  res.json({ success: true, ...result });
}));

// Add enrollment for user
router.post('/users/:id/enrollments', asyncHandler(async (req: AuthRequest, res: Response) => {
  const userId = parseInt(req.params.id);
  const { courseId } = createEnrollmentSchema.parse({ ...req.body, userId });
  const ipAddress = (req.headers['x-forwarded-for'] as string)?.split(',')[0] || req.ip;

  const enrollment = await userManagementService.addUserEnrollment(userId, courseId, {
    adminId: req.user!.id,
    adminEmail: req.user!.email,
    ipAddress,
  });

  res.status(201).json({ success: true, data: enrollment });
}));

// Remove enrollment for user
router.delete('/users/:id/enrollments/:enrollmentId', asyncHandler(async (req: AuthRequest, res: Response) => {
  const userId = parseInt(req.params.id);
  const enrollmentId = parseInt(req.params.enrollmentId);
  const ipAddress = (req.headers['x-forwarded-for'] as string)?.split(',')[0] || req.ip;

  const result = await userManagementService.removeUserEnrollment(userId, enrollmentId, {
    adminId: req.user!.id,
    adminEmail: req.user!.email,
    ipAddress,
  });

  res.json({ success: true, ...result });
}));

export default router;
