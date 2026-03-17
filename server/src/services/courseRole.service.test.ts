import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AppError } from '../middleware/error.middleware.js';

// Mock prisma
vi.mock('../utils/prisma.js', () => ({
  default: {
    course: {
      findUnique: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
    },
    courseRole: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  },
}));

vi.mock('./adminAudit.service.js', () => ({
  adminAuditService: {
    log: vi.fn(),
  },
}));

import prisma from '../utils/prisma.js';
import { courseRoleService } from './courseRole.service.js';
import type { AuditContext } from './courseRole.service.js';

describe('CourseRoleService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockContext: AuditContext = {
    adminId: 1,
    adminEmail: 'admin@uef.fi',
  };

  describe('assignRole', () => {
    it('should assign a role to an instructor', async () => {
      vi.mocked(prisma.course.findUnique).mockResolvedValue({ id: 1, instructorId: 10 } as any);
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        id: 5,
        fullname: 'Instructor User',
        email: 'inst@uef.fi',
        isInstructor: true,
        isAdmin: false,
      } as any);
      vi.mocked(prisma.courseRole.findUnique).mockResolvedValue(null);
      vi.mocked(prisma.courseRole.create).mockResolvedValue({
        id: 1,
        userId: 5,
        courseId: 1,
        role: 'ta',
        permissions: '["grade","view_analytics"]',
        user: { id: 5, fullname: 'Instructor User', email: 'inst@uef.fi' },
      } as any);

      const result = await courseRoleService.assignRole(1, 5, 'ta', undefined, mockContext);

      expect(result).toBeDefined();
      expect(prisma.courseRole.create).toHaveBeenCalled();
    });

    it('should assign a role to an admin user', async () => {
      vi.mocked(prisma.course.findUnique).mockResolvedValue({ id: 1, instructorId: 10 } as any);
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        id: 2,
        fullname: 'Admin',
        email: 'admin@uef.fi',
        isInstructor: false,
        isAdmin: true,
      } as any);
      vi.mocked(prisma.courseRole.findUnique).mockResolvedValue(null);
      vi.mocked(prisma.courseRole.create).mockResolvedValue({
        id: 2,
        userId: 2,
        courseId: 1,
        role: 'course_admin',
        permissions: '["grade","edit_content","manage_students","view_analytics"]',
        user: { id: 2, fullname: 'Admin', email: 'admin@uef.fi' },
      } as any);

      const result = await courseRoleService.assignRole(1, 2, 'course_admin', undefined, mockContext);

      expect(result).toBeDefined();
      expect(prisma.courseRole.create).toHaveBeenCalled();
    });

    it('should reject assigning a role to a student', async () => {
      vi.mocked(prisma.course.findUnique).mockResolvedValue({ id: 1, instructorId: 10 } as any);
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        id: 20,
        fullname: 'Student User',
        email: 'student@uef.fi',
        isInstructor: false,
        isAdmin: false,
      } as any);

      await expect(
        courseRoleService.assignRole(1, 20, 'ta', undefined, mockContext)
      ).rejects.toThrow('Only instructors can be assigned as team members');

      expect(prisma.courseRole.create).not.toHaveBeenCalled();
    });

    it('should throw 404 when course not found', async () => {
      vi.mocked(prisma.course.findUnique).mockResolvedValue(null);

      await expect(
        courseRoleService.assignRole(999, 5, 'ta', undefined, mockContext)
      ).rejects.toThrow('Course not found');
    });

    it('should throw 404 when user not found', async () => {
      vi.mocked(prisma.course.findUnique).mockResolvedValue({ id: 1 } as any);
      vi.mocked(prisma.user.findUnique).mockResolvedValue(null);

      await expect(
        courseRoleService.assignRole(1, 999, 'ta', undefined, mockContext)
      ).rejects.toThrow('User not found');
    });

    it('should throw 400 when user already has a role', async () => {
      vi.mocked(prisma.course.findUnique).mockResolvedValue({ id: 1 } as any);
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        id: 5,
        isInstructor: true,
        isAdmin: false,
      } as any);
      vi.mocked(prisma.courseRole.findUnique).mockResolvedValue({ id: 1 } as any);

      await expect(
        courseRoleService.assignRole(1, 5, 'ta', undefined, mockContext)
      ).rejects.toThrow('User already has a role in this course');
    });

    it('should use default permissions when none provided', async () => {
      vi.mocked(prisma.course.findUnique).mockResolvedValue({ id: 1, instructorId: 10 } as any);
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        id: 5,
        isInstructor: true,
        isAdmin: false,
      } as any);
      vi.mocked(prisma.courseRole.findUnique).mockResolvedValue(null);
      vi.mocked(prisma.courseRole.create).mockResolvedValue({ id: 1 } as any);

      await courseRoleService.assignRole(1, 5, 'co_instructor', undefined, mockContext);

      expect(prisma.courseRole.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            permissions: JSON.stringify(['grade', 'edit_content', 'view_analytics']),
          }),
        })
      );
    });

    it('should use custom permissions when provided', async () => {
      vi.mocked(prisma.course.findUnique).mockResolvedValue({ id: 1, instructorId: 10 } as any);
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        id: 5,
        isInstructor: true,
        isAdmin: false,
      } as any);
      vi.mocked(prisma.courseRole.findUnique).mockResolvedValue(null);
      vi.mocked(prisma.courseRole.create).mockResolvedValue({ id: 1 } as any);

      await courseRoleService.assignRole(1, 5, 'ta', ['grade'], mockContext);

      expect(prisma.courseRole.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            permissions: JSON.stringify(['grade']),
          }),
        })
      );
    });
  });

  describe('canManageRoles', () => {
    it('should allow admin', async () => {
      const result = await courseRoleService.canManageRoles(1, 1, true);
      expect(result).toBe(true);
      expect(prisma.course.findUnique).not.toHaveBeenCalled();
    });

    it('should allow course owner instructor', async () => {
      vi.mocked(prisma.course.findUnique).mockResolvedValue({ id: 1, instructorId: 5 } as any);

      const result = await courseRoleService.canManageRoles(5, 1, false);
      expect(result).toBe(true);
    });

    it('should allow team member with manage_students permission', async () => {
      vi.mocked(prisma.course.findUnique).mockResolvedValue({ id: 1, instructorId: 99 } as any);
      vi.mocked(prisma.courseRole.findUnique).mockResolvedValue({
        id: 1,
        permissions: JSON.stringify(['manage_students', 'view_analytics']),
      } as any);

      const result = await courseRoleService.canManageRoles(5, 1, false);
      expect(result).toBe(true);
    });

    it('should deny team member without manage_students permission', async () => {
      vi.mocked(prisma.course.findUnique).mockResolvedValue({ id: 1, instructorId: 99 } as any);
      vi.mocked(prisma.courseRole.findUnique).mockResolvedValue({
        id: 1,
        permissions: JSON.stringify(['grade', 'view_analytics']),
      } as any);

      const result = await courseRoleService.canManageRoles(5, 1, false);
      expect(result).toBe(false);
    });

    it('should deny non-team member non-owner instructor', async () => {
      vi.mocked(prisma.course.findUnique).mockResolvedValue({ id: 1, instructorId: 99 } as any);
      vi.mocked(prisma.courseRole.findUnique).mockResolvedValue(null);

      const result = await courseRoleService.canManageRoles(5, 1, false);
      expect(result).toBe(false);
    });

    it('should return false for non-existent course', async () => {
      vi.mocked(prisma.course.findUnique).mockResolvedValue(null);

      const result = await courseRoleService.canManageRoles(5, 999, false);
      expect(result).toBe(false);
    });
  });
});
