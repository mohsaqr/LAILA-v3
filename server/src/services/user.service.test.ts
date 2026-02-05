import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { UserService } from './user.service.js';
import { AppError } from '../middleware/error.middleware.js';

// Mock prisma
vi.mock('../utils/prisma.js', () => ({
  default: {
    user: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      count: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    userSetting: {
      findMany: vi.fn(),
      upsert: vi.fn(),
    },
    enrollment: {
      count: vi.fn(),
    },
    lectureProgress: {
      aggregate: vi.fn(),
    },
    assignmentSubmission: {
      count: vi.fn(),
    },
    course: {
      count: vi.fn(),
    },
    assignment: {
      count: vi.fn(),
    },
  },
}));

// Mock bcrypt
vi.mock('bcryptjs', () => ({
  default: {
    hash: vi.fn().mockResolvedValue('hashed_password'),
  },
}));

import prisma from '../utils/prisma.js';
import bcrypt from 'bcryptjs';

describe('UserService', () => {
  let userService: UserService;

  const mockUser = {
    id: 1,
    fullname: 'Test User',
    email: 'test@example.com',
    isAdmin: false,
    isInstructor: false,
    isActive: true,
    isConfirmed: true,
    createdAt: new Date(),
    lastLogin: new Date(),
    _count: {
      enrollments: 3,
      taughtCourses: 0,
      chatLogs: 10,
    },
  };

  beforeEach(() => {
    userService = new UserService();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ===========================================================================
  // getUsers
  // ===========================================================================

  describe('getUsers', () => {
    it('should return paginated users', async () => {
      vi.mocked(prisma.user.findMany).mockResolvedValue([mockUser] as any);
      vi.mocked(prisma.user.count).mockResolvedValue(1);

      const result = await userService.getUsers(1, 20);

      expect(result.users).toHaveLength(1);
      expect(result.pagination.page).toBe(1);
      expect(result.pagination.total).toBe(1);
      expect(prisma.user.findMany).toHaveBeenCalledWith({
        where: {},
        select: expect.any(Object),
        orderBy: { createdAt: 'desc' },
        skip: 0,
        take: 20,
      });
    });

    it('should apply search filter', async () => {
      vi.mocked(prisma.user.findMany).mockResolvedValue([mockUser] as any);
      vi.mocked(prisma.user.count).mockResolvedValue(1);

      await userService.getUsers(1, 20, 'test');

      expect(prisma.user.findMany).toHaveBeenCalledWith({
        where: {
          OR: [
            { fullname: { contains: 'test' } },
            { email: { contains: 'test' } },
          ],
        },
        select: expect.any(Object),
        orderBy: { createdAt: 'desc' },
        skip: 0,
        take: 20,
      });
    });

    it('should calculate pagination correctly', async () => {
      vi.mocked(prisma.user.findMany).mockResolvedValue([]);
      vi.mocked(prisma.user.count).mockResolvedValue(45);

      const result = await userService.getUsers(2, 20);

      expect(result.pagination.totalPages).toBe(3);
      expect(prisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 20,
          take: 20,
        })
      );
    });
  });

  // ===========================================================================
  // getUserById
  // ===========================================================================

  describe('getUserById', () => {
    it('should return user by id', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser as any);

      const result = await userService.getUserById(1);

      expect(result.id).toBe(1);
      expect(result.email).toBe('test@example.com');
      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: 1 },
        select: expect.any(Object),
      });
    });

    it('should throw 404 if user not found', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(null);

      await expect(userService.getUserById(999)).rejects.toThrow(AppError);
      await expect(userService.getUserById(999)).rejects.toThrow('User not found');
    });
  });

  // ===========================================================================
  // updateUser
  // ===========================================================================

  describe('updateUser', () => {
    it('should update user basic fields', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser as any);
      vi.mocked(prisma.user.update).mockResolvedValue({
        ...mockUser,
        fullname: 'Updated Name',
      } as any);

      const result = await userService.updateUser(1, { fullname: 'Updated Name' });

      expect(result.fullname).toBe('Updated Name');
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { fullname: 'Updated Name' },
        select: expect.any(Object),
      });
    });

    it('should hash password when updating', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser as any);
      vi.mocked(prisma.user.update).mockResolvedValue(mockUser as any);

      await userService.updateUser(1, { password: 'newpassword123' });

      expect(bcrypt.hash).toHaveBeenCalledWith('newpassword123', 10);
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { passwordHash: 'hashed_password' },
        select: expect.any(Object),
      });
    });

    it('should allow admin to update isAdmin/isInstructor/isActive', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser as any);
      vi.mocked(prisma.user.update).mockResolvedValue({
        ...mockUser,
        isInstructor: true,
      } as any);

      await userService.updateUser(1, { isInstructor: true }, true);

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { isInstructor: true },
        select: expect.any(Object),
      });
    });

    it('should ignore admin fields for non-admin callers', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser as any);
      vi.mocked(prisma.user.update).mockResolvedValue(mockUser as any);

      await userService.updateUser(1, { isAdmin: true, fullname: 'Test' }, false);

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { fullname: 'Test' },
        select: expect.any(Object),
      });
    });

    it('should throw 404 if user not found', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(null);

      await expect(userService.updateUser(999, { fullname: 'Test' })).rejects.toThrow(AppError);
      await expect(userService.updateUser(999, { fullname: 'Test' })).rejects.toThrow('User not found');
    });
  });

  // ===========================================================================
  // deleteUser
  // ===========================================================================

  describe('deleteUser', () => {
    it('should delete non-admin user', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser as any);
      vi.mocked(prisma.user.delete).mockResolvedValue(mockUser as any);

      const result = await userService.deleteUser(1);

      expect(result.message).toBe('User deleted successfully');
      expect(prisma.user.delete).toHaveBeenCalledWith({ where: { id: 1 } });
    });

    it('should allow deleting admin if not the last one', async () => {
      const adminUser = { ...mockUser, isAdmin: true };
      vi.mocked(prisma.user.findUnique).mockResolvedValue(adminUser as any);
      vi.mocked(prisma.user.count).mockResolvedValue(2);
      vi.mocked(prisma.user.delete).mockResolvedValue(adminUser as any);

      const result = await userService.deleteUser(1);

      expect(result.message).toBe('User deleted successfully');
    });

    it('should throw 400 when trying to delete the last admin', async () => {
      const adminUser = { ...mockUser, isAdmin: true };
      vi.mocked(prisma.user.findUnique).mockResolvedValue(adminUser as any);
      vi.mocked(prisma.user.count).mockResolvedValue(1);

      await expect(userService.deleteUser(1)).rejects.toThrow(AppError);
      await expect(userService.deleteUser(1)).rejects.toThrow('Cannot delete the last admin');
    });

    it('should throw 404 if user not found', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(null);

      await expect(userService.deleteUser(999)).rejects.toThrow(AppError);
      await expect(userService.deleteUser(999)).rejects.toThrow('User not found');
    });
  });

  // ===========================================================================
  // getUserSettings
  // ===========================================================================

  describe('getUserSettings', () => {
    it('should return settings as object', async () => {
      vi.mocked(prisma.userSetting.findMany).mockResolvedValue([
        { settingKey: 'theme', settingValue: 'dark' },
        { settingKey: 'notifications', settingValue: 'true' },
      ] as any);

      const result = await userService.getUserSettings(1);

      expect(result.theme).toBe('dark');
      expect(result.notifications).toBe('true');
    });

    it('should return empty object when no settings', async () => {
      vi.mocked(prisma.userSetting.findMany).mockResolvedValue([]);

      const result = await userService.getUserSettings(1);

      expect(result).toEqual({});
    });
  });

  // ===========================================================================
  // updateUserSetting
  // ===========================================================================

  describe('updateUserSetting', () => {
    it('should upsert user setting', async () => {
      const mockSetting = { userId: 1, settingKey: 'theme', settingValue: 'dark' };
      vi.mocked(prisma.userSetting.upsert).mockResolvedValue(mockSetting as any);

      const result = await userService.updateUserSetting(1, 'theme', 'dark');

      expect(result.settingValue).toBe('dark');
      expect(prisma.userSetting.upsert).toHaveBeenCalledWith({
        where: { userId_settingKey: { userId: 1, settingKey: 'theme' } },
        create: { userId: 1, settingKey: 'theme', settingValue: 'dark' },
        update: { settingValue: 'dark' },
      });
    });

    it('should allow null value to clear setting', async () => {
      vi.mocked(prisma.userSetting.upsert).mockResolvedValue({ settingValue: null } as any);

      await userService.updateUserSetting(1, 'theme', null);

      expect(prisma.userSetting.upsert).toHaveBeenCalledWith({
        where: { userId_settingKey: { userId: 1, settingKey: 'theme' } },
        create: { userId: 1, settingKey: 'theme', settingValue: null },
        update: { settingValue: null },
      });
    });
  });

  // ===========================================================================
  // getUserStats
  // ===========================================================================

  describe('getUserStats', () => {
    it('should return user stats', async () => {
      vi.mocked(prisma.enrollment.count)
        .mockResolvedValueOnce(5) // enrollments
        .mockResolvedValueOnce(2); // completed
      vi.mocked(prisma.lectureProgress.aggregate).mockResolvedValue({
        _sum: { timeSpent: 3600 },
      } as any);
      vi.mocked(prisma.assignmentSubmission.count).mockResolvedValue(10);

      const result = await userService.getUserStats(1);

      expect(result.enrolledCourses).toBe(5);
      expect(result.completedCourses).toBe(2);
      expect(result.totalTimeSpent).toBe(3600);
      expect(result.submittedAssignments).toBe(10);
    });

    it('should handle null timeSpent sum', async () => {
      vi.mocked(prisma.enrollment.count).mockResolvedValue(0);
      vi.mocked(prisma.lectureProgress.aggregate).mockResolvedValue({
        _sum: { timeSpent: null },
      } as any);
      vi.mocked(prisma.assignmentSubmission.count).mockResolvedValue(0);

      const result = await userService.getUserStats(1);

      expect(result.totalTimeSpent).toBe(0);
    });
  });

  // ===========================================================================
  // getInstructorStats
  // ===========================================================================

  describe('getInstructorStats', () => {
    it('should return instructor stats', async () => {
      vi.mocked(prisma.course.count).mockResolvedValue(3);
      vi.mocked(prisma.enrollment.count).mockResolvedValue(50);
      vi.mocked(prisma.assignment.count).mockResolvedValue(12);
      vi.mocked(prisma.assignmentSubmission.count).mockResolvedValue(8);

      const result = await userService.getInstructorStats(1);

      expect(result.totalCourses).toBe(3);
      expect(result.totalStudents).toBe(50);
      expect(result.totalAssignments).toBe(12);
      expect(result.pendingGrading).toBe(8);
    });
  });
});
