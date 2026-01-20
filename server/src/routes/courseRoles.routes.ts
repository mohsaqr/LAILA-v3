import { Router, Response } from 'express';
import { courseRoleService, CourseRoleType, Permission } from '../services/courseRole.service.js';
import { authenticateToken, requireInstructor } from '../middleware/auth.middleware.js';
import { asyncHandler, AppError } from '../middleware/error.middleware.js';
import { courseRoleSchema, updateCourseRoleSchema } from '../utils/validation.js';
import { AuthRequest } from '../types/index.js';

const router = Router();

// All routes require authentication and instructor role
router.use(authenticateToken, requireInstructor);

// Get course roles
router.get(
  '/courses/:courseId/roles',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const courseId = parseInt(req.params.courseId);

    // Check if user can view roles
    const canManage = await courseRoleService.canManageRoles(
      req.user!.id,
      courseId,
      req.user!.isAdmin
    );

    if (!canManage) {
      throw new AppError('Not authorized to view course roles', 403);
    }

    const roles = await courseRoleService.getCourseRoles(courseId);
    res.json({ success: true, data: roles });
  })
);

// Assign role
router.post(
  '/courses/:courseId/roles',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const courseId = parseInt(req.params.courseId);
    const data = courseRoleSchema.parse(req.body);
    const ipAddress = (req.headers['x-forwarded-for'] as string)?.split(',')[0] || req.ip;

    // Check if user can manage roles
    const canManage = await courseRoleService.canManageRoles(
      req.user!.id,
      courseId,
      req.user!.isAdmin
    );

    if (!canManage) {
      throw new AppError('Not authorized to manage course roles', 403);
    }

    const role = await courseRoleService.assignRole(
      courseId,
      data.userId,
      data.role as CourseRoleType,
      data.permissions as Permission[] | undefined,
      {
        adminId: req.user!.id,
        adminEmail: req.user!.email,
        ipAddress,
      }
    );

    res.status(201).json({ success: true, data: role });
  })
);

// Update role
router.put(
  '/courses/:courseId/roles/:roleId',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const courseId = parseInt(req.params.courseId);
    const roleId = parseInt(req.params.roleId);
    const data = updateCourseRoleSchema.parse(req.body);
    const ipAddress = (req.headers['x-forwarded-for'] as string)?.split(',')[0] || req.ip;

    // Check if user can manage roles
    const canManage = await courseRoleService.canManageRoles(
      req.user!.id,
      courseId,
      req.user!.isAdmin
    );

    if (!canManage) {
      throw new AppError('Not authorized to manage course roles', 403);
    }

    const role = await courseRoleService.updateRole(
      courseId,
      roleId,
      {
        role: data.role as CourseRoleType | undefined,
        permissions: data.permissions as Permission[] | undefined,
      },
      {
        adminId: req.user!.id,
        adminEmail: req.user!.email,
        ipAddress,
      }
    );

    res.json({ success: true, data: role });
  })
);

// Remove role
router.delete(
  '/courses/:courseId/roles/:roleId',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const courseId = parseInt(req.params.courseId);
    const roleId = parseInt(req.params.roleId);
    const ipAddress = (req.headers['x-forwarded-for'] as string)?.split(',')[0] || req.ip;

    // Check if user can manage roles
    const canManage = await courseRoleService.canManageRoles(
      req.user!.id,
      courseId,
      req.user!.isAdmin
    );

    if (!canManage) {
      throw new AppError('Not authorized to manage course roles', 403);
    }

    const result = await courseRoleService.removeRole(courseId, roleId, {
      adminId: req.user!.id,
      adminEmail: req.user!.email,
      ipAddress,
    });

    res.json({ success: true, ...result });
  })
);

export default router;
