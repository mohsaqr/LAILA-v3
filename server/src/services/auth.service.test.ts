import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AuthService } from './auth.service.js';
import { AppError } from '../middleware/error.middleware.js';

// Mock bcrypt
vi.mock('bcryptjs', () => ({
  default: {
    hash: vi.fn().mockResolvedValue('hashed_password'),
    compare: vi.fn(),
  },
}));

// Mock prisma
vi.mock('../utils/prisma.js', () => ({
  default: {
    user: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
  },
}));

// Mock auth middleware
vi.mock('../middleware/auth.middleware.js', () => ({
  generateToken: vi.fn().mockReturnValue('mock_jwt_token'),
  invalidateUserStatusCache: vi.fn(),
}));

// Mock learning analytics (fire and forget)
vi.mock('./learningAnalytics.service.js', () => ({
  learningAnalyticsService: {
    logAuthEvent: vi.fn().mockResolvedValue(undefined),
  },
}));

// Mock logger
vi.mock('../utils/logger.js', () => ({
  authLogger: {
    warn: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
  },
}));

import prisma from '../utils/prisma.js';
import bcrypt from 'bcryptjs';
import { generateToken } from '../middleware/auth.middleware.js';

describe('AuthService', () => {
  let authService: AuthService;

  beforeEach(() => {
    authService = new AuthService();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('register', () => {
    const validRegistration = {
      fullname: 'Test User',
      email: 'test@example.com',
      password: 'StrongPass123!',
    };

    it('should successfully register a new user', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(null);
      vi.mocked(prisma.user.create).mockResolvedValue({
        id: 1,
        fullname: 'Test User',
        email: 'test@example.com',
        isAdmin: false,
        isInstructor: false,
        tokenVersion: 0,
        createdAt: new Date(),
      } as any);

      const result = await authService.register(validRegistration);

      expect(result.user.email).toBe('test@example.com');
      expect(result.token).toBe('mock_jwt_token');
      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { email: 'test@example.com' },
      });
      expect(prisma.user.create).toHaveBeenCalled();
      expect(generateToken).toHaveBeenCalled();
    });

    it('should throw error if email already exists', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        id: 1,
        email: 'test@example.com',
      } as any);

      await expect(authService.register(validRegistration)).rejects.toThrow(AppError);
      await expect(authService.register(validRegistration)).rejects.toThrow('Email already registered');
    });

    it('should hash the password before storing', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(null);
      vi.mocked(prisma.user.create).mockResolvedValue({
        id: 1,
        fullname: 'Test User',
        email: 'test@example.com',
        isAdmin: false,
        isInstructor: false,
        tokenVersion: 0,
        createdAt: new Date(),
      } as any);

      await authService.register(validRegistration);

      expect(bcrypt.hash).toHaveBeenCalledWith('StrongPass123!', 10);
    });
  });

  describe('login', () => {
    const validLogin = {
      email: 'test@example.com',
      password: 'StrongPass123!',
    };

    const mockUser = {
      id: 1,
      fullname: 'Test User',
      email: 'test@example.com',
      passwordHash: 'hashed_password',
      isAdmin: false,
      isInstructor: false,
      isActive: true,
      tokenVersion: 0,
      failedLoginAttempts: 0,
      lockedUntil: null,
    };

    it('should successfully login with correct credentials', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser as any);
      vi.mocked(bcrypt.compare).mockResolvedValue(true as never);
      vi.mocked(prisma.user.update).mockResolvedValue(mockUser as any);

      const result = await authService.login(validLogin);

      expect(result.user.email).toBe('test@example.com');
      expect(result.token).toBe('mock_jwt_token');
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: expect.objectContaining({
          lastLogin: expect.any(Date),
          failedLoginAttempts: 0,
          lockedUntil: null,
        }),
      });
    });

    it('should throw error for non-existent user', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(null);

      await expect(authService.login(validLogin)).rejects.toThrow(AppError);
      await expect(authService.login(validLogin)).rejects.toThrow('Invalid credentials');
    });

    it('should throw error for incorrect password', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser as any);
      vi.mocked(bcrypt.compare).mockResolvedValue(false as never);
      vi.mocked(prisma.user.update).mockResolvedValue({ ...mockUser, failedLoginAttempts: 1 } as any);

      await expect(authService.login(validLogin)).rejects.toThrow(AppError);
      await expect(authService.login(validLogin)).rejects.toThrow('Invalid credentials');
    });

    it('should throw error for deactivated account', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        ...mockUser,
        isActive: false,
      } as any);

      await expect(authService.login(validLogin)).rejects.toThrow(AppError);
      await expect(authService.login(validLogin)).rejects.toThrow('Account is deactivated');
    });

    it('should throw error for locked account', async () => {
      const futureDate = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes from now
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        ...mockUser,
        lockedUntil: futureDate,
      } as any);

      await expect(authService.login(validLogin)).rejects.toThrow(AppError);
      await expect(authService.login(validLogin)).rejects.toThrow(/Account is locked/);
    });

    it('should increment failed login attempts on wrong password', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser as any);
      vi.mocked(bcrypt.compare).mockResolvedValue(false as never);
      vi.mocked(prisma.user.update).mockResolvedValue({ ...mockUser, failedLoginAttempts: 1 } as any);

      await expect(authService.login(validLogin)).rejects.toThrow('Invalid credentials');

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: expect.objectContaining({
          failedLoginAttempts: 1,
        }),
      });
    });

    it('should lock account after 5 failed attempts', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        ...mockUser,
        failedLoginAttempts: 4, // This will be the 5th attempt
      } as any);
      vi.mocked(bcrypt.compare).mockResolvedValue(false as never);
      vi.mocked(prisma.user.update).mockResolvedValue({ ...mockUser, failedLoginAttempts: 5 } as any);

      await expect(authService.login(validLogin)).rejects.toThrow(/Account locked/);

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: expect.objectContaining({
          failedLoginAttempts: 5,
          lockedUntil: expect.any(Date),
        }),
      });
    });
  });

  describe('getProfile', () => {
    it('should return user profile', async () => {
      const mockProfile = {
        id: 1,
        fullname: 'Test User',
        email: 'test@example.com',
        isAdmin: false,
        isInstructor: true,
        isConfirmed: true,
        createdAt: new Date(),
        lastLogin: new Date(),
        settings: null,
      };

      vi.mocked(prisma.user.findUnique).mockResolvedValue(mockProfile as any);

      const result = await authService.getProfile(1);

      expect(result.email).toBe('test@example.com');
      expect(result.isInstructor).toBe(true);
    });

    it('should throw error for non-existent user', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(null);

      await expect(authService.getProfile(999)).rejects.toThrow(AppError);
      await expect(authService.getProfile(999)).rejects.toThrow('User not found');
    });
  });

  describe('updatePassword', () => {
    const mockUser = {
      id: 1,
      email: 'test@example.com',
      passwordHash: 'old_hashed_password',
    };

    it('should successfully update password', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser as any);
      vi.mocked(bcrypt.compare).mockResolvedValue(true as never);
      vi.mocked(prisma.user.update).mockResolvedValue(mockUser as any);

      const result = await authService.updatePassword(1, 'oldPassword', 'NewPassword123!');

      expect(result.message).toBe('Password updated successfully');
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: expect.objectContaining({
          passwordHash: 'hashed_password',
          tokenVersion: { increment: 1 },
        }),
      });
    });

    it('should throw error for incorrect current password', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser as any);
      vi.mocked(bcrypt.compare).mockResolvedValue(false as never);

      await expect(authService.updatePassword(1, 'wrongPassword', 'NewPassword123!')).rejects.toThrow(AppError);
      await expect(authService.updatePassword(1, 'wrongPassword', 'NewPassword123!')).rejects.toThrow(
        'Current password is incorrect'
      );
    });

    it('should throw error for non-existent user', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(null);

      await expect(authService.updatePassword(999, 'oldPassword', 'NewPassword123!')).rejects.toThrow(AppError);
      await expect(authService.updatePassword(999, 'oldPassword', 'NewPassword123!')).rejects.toThrow('User not found');
    });

    it('should increment token version to invalidate existing tokens', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser as any);
      vi.mocked(bcrypt.compare).mockResolvedValue(true as never);
      vi.mocked(prisma.user.update).mockResolvedValue(mockUser as any);

      await authService.updatePassword(1, 'oldPassword', 'NewPassword123!');

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: expect.objectContaining({
          tokenVersion: { increment: 1 },
        }),
      });
    });
  });
});
