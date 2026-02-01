import bcrypt from 'bcryptjs';
import prisma from '../utils/prisma.js';
import { generateToken, invalidateUserStatusCache } from '../middleware/auth.middleware.js';
import { RegisterInput, LoginInput } from '../utils/validation.js';
import { AppError } from '../middleware/error.middleware.js';
import { UserPayload } from '../types/index.js';
import { learningAnalyticsService, AuthEventData } from './learningAnalytics.service.js';
import { authLogger } from '../utils/logger.js';

// Context for auth logging
export interface AuthContext {
  ipAddress?: string;
  userAgent?: string;
  deviceType?: string;
  browserName?: string;
  browserVersion?: string;
  osName?: string;
  osVersion?: string;
  sessionId?: string;
}

export class AuthService {
  async register(data: RegisterInput, context?: AuthContext) {
    // Check if user exists
    const existingUser = await prisma.user.findUnique({
      where: { email: data.email },
    });

    if (existingUser) {
      throw new AppError('Email already registered', 409);
    }

    // Hash password
    const passwordHash = await bcrypt.hash(data.password, 10);

    // Create user
    const user = await prisma.user.create({
      data: {
        fullname: data.fullname,
        email: data.email,
        passwordHash,
        isConfirmed: true, // Auto-confirm for now
      },
      select: {
        id: true,
        fullname: true,
        email: true,
        isAdmin: true,
        isInstructor: true,
        tokenVersion: true,
        createdAt: true,
      },
    });

    // Generate token with tokenVersion for invalidation support
    const payload: UserPayload = {
      id: user.id,
      email: user.email,
      fullname: user.fullname,
      isAdmin: user.isAdmin,
      isInstructor: user.isInstructor,
      tokenVersion: user.tokenVersion,
    };
    const token = generateToken(payload);

    // Log registration event
    try {
      await learningAnalyticsService.logAuthEvent({
        userId: user.id,
        userEmail: user.email,
        eventType: 'register',
        sessionId: context?.sessionId,
        userAgent: context?.userAgent,
        deviceType: context?.deviceType,
        browserName: context?.browserName,
        browserVersion: context?.browserVersion,
        osName: context?.osName,
        osVersion: context?.osVersion,
      }, context?.ipAddress);
    } catch (error) {
      authLogger.warn({ err: error, userId: user.id }, 'Failed to log registration event');
    }

    return { user, token };
  }

  // Account lockout settings
  private static readonly MAX_FAILED_ATTEMPTS = 5;
  private static readonly LOCKOUT_DURATION_MINUTES = 15;

  async login(data: LoginInput, context?: AuthContext) {
    // Find user
    const user = await prisma.user.findUnique({
      where: { email: data.email },
    });

    if (!user) {
      // Log failed login attempt - user not found
      try {
        await learningAnalyticsService.logAuthEvent({
          userEmail: data.email,
          eventType: 'login_failure',
          failureReason: 'user_not_found',
          sessionId: context?.sessionId,
          userAgent: context?.userAgent,
          deviceType: context?.deviceType,
          browserName: context?.browserName,
          browserVersion: context?.browserVersion,
          osName: context?.osName,
          osVersion: context?.osVersion,
        }, context?.ipAddress);
      } catch (error) {
        authLogger.warn({ err: error, email: data.email }, 'Failed to log login failure event');
      }
      throw new AppError('Invalid credentials', 401);
    }

    // Check if account is locked
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      const remainingMinutes = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60000);
      try {
        await learningAnalyticsService.logAuthEvent({
          userId: user.id,
          userEmail: user.email,
          eventType: 'login_failure',
          failureReason: 'account_locked',
          sessionId: context?.sessionId,
          userAgent: context?.userAgent,
          deviceType: context?.deviceType,
          browserName: context?.browserName,
          browserVersion: context?.browserVersion,
          osName: context?.osName,
          osVersion: context?.osVersion,
        }, context?.ipAddress);
      } catch (error) {
        authLogger.warn({ err: error, email: data.email }, 'Failed to log login failure event');
      }
      throw new AppError(`Account is locked. Please try again in ${remainingMinutes} minute(s).`, 423);
    }

    if (!user.isActive) {
      // Log failed login attempt - account deactivated
      try {
        await learningAnalyticsService.logAuthEvent({
          userId: user.id,
          userEmail: user.email,
          eventType: 'login_failure',
          failureReason: 'account_deactivated',
          sessionId: context?.sessionId,
          userAgent: context?.userAgent,
          deviceType: context?.deviceType,
          browserName: context?.browserName,
          browserVersion: context?.browserVersion,
          osName: context?.osName,
          osVersion: context?.osVersion,
        }, context?.ipAddress);
      } catch (error) {
        authLogger.warn({ err: error, email: data.email }, 'Failed to log login failure event');
      }
      throw new AppError('Account is deactivated', 403);
    }

    // Check password
    const isValidPassword = await bcrypt.compare(data.password, user.passwordHash);
    if (!isValidPassword) {
      // Increment failed login attempts
      const newFailedAttempts = user.failedLoginAttempts + 1;
      const updateData: { failedLoginAttempts: number; lockedUntil?: Date } = {
        failedLoginAttempts: newFailedAttempts,
      };

      // Lock account if max attempts reached
      if (newFailedAttempts >= AuthService.MAX_FAILED_ATTEMPTS) {
        updateData.lockedUntil = new Date(Date.now() + AuthService.LOCKOUT_DURATION_MINUTES * 60000);
      }

      await prisma.user.update({
        where: { id: user.id },
        data: updateData,
      });

      // Log failed login attempt - invalid password
      try {
        await learningAnalyticsService.logAuthEvent({
          userId: user.id,
          userEmail: user.email,
          eventType: 'login_failure',
          failureReason: newFailedAttempts >= AuthService.MAX_FAILED_ATTEMPTS ? 'account_locked' : 'invalid_password',
          attemptCount: newFailedAttempts,
          sessionId: context?.sessionId,
          userAgent: context?.userAgent,
          deviceType: context?.deviceType,
          browserName: context?.browserName,
          browserVersion: context?.browserVersion,
          osName: context?.osName,
          osVersion: context?.osVersion,
        }, context?.ipAddress);
      } catch (error) {
        authLogger.warn({ err: error, email: data.email }, 'Failed to log login failure event');
      }

      if (newFailedAttempts >= AuthService.MAX_FAILED_ATTEMPTS) {
        throw new AppError(`Account locked due to too many failed attempts. Please try again in ${AuthService.LOCKOUT_DURATION_MINUTES} minutes.`, 423);
      }

      throw new AppError('Invalid credentials', 401);
    }

    // Successful login - reset failed attempts and lockout
    await prisma.user.update({
      where: { id: user.id },
      data: {
        lastLogin: new Date(),
        failedLoginAttempts: 0,
        lockedUntil: null,
      },
    });

    // Generate token with tokenVersion for invalidation support
    const payload: UserPayload = {
      id: user.id,
      email: user.email,
      fullname: user.fullname,
      isAdmin: user.isAdmin,
      isInstructor: user.isInstructor,
      tokenVersion: user.tokenVersion,
    };
    const token = generateToken(payload);

    // Log successful login
    try {
      await learningAnalyticsService.logAuthEvent({
        userId: user.id,
        userEmail: user.email,
        eventType: 'login_success',
        sessionId: context?.sessionId,
        userAgent: context?.userAgent,
        deviceType: context?.deviceType,
        browserName: context?.browserName,
        browserVersion: context?.browserVersion,
        osName: context?.osName,
        osVersion: context?.osVersion,
      }, context?.ipAddress);
    } catch (error) {
      authLogger.warn({ err: error, userId: user.id }, 'Failed to log login success event');
    }

    return {
      user: {
        id: user.id,
        fullname: user.fullname,
        email: user.email,
        isAdmin: user.isAdmin,
        isInstructor: user.isInstructor,
      },
      token,
    };
  }

  async getProfile(userId: number) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        fullname: true,
        email: true,
        isAdmin: true,
        isInstructor: true,
        isConfirmed: true,
        createdAt: true,
        lastLogin: true,
        settings: true,
      },
    });

    if (!user) {
      throw new AppError('User not found', 404);
    }

    return user;
  }

  async updatePassword(userId: number, currentPassword: string, newPassword: string, context?: AuthContext) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new AppError('User not found', 404);
    }

    const isValidPassword = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!isValidPassword) {
      throw new AppError('Current password is incorrect', 401);
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);
    // Increment tokenVersion to invalidate all existing tokens
    await prisma.user.update({
      where: { id: userId },
      data: {
        passwordHash,
        tokenVersion: { increment: 1 },
      },
    });

    // Invalidate user status cache so new tokenVersion takes effect immediately
    invalidateUserStatusCache(userId);

    // Log password change event
    try {
      await learningAnalyticsService.logAuthEvent({
        userId: user.id,
        userEmail: user.email,
        eventType: 'password_change',
        sessionId: context?.sessionId,
        userAgent: context?.userAgent,
        deviceType: context?.deviceType,
        browserName: context?.browserName,
        browserVersion: context?.browserVersion,
        osName: context?.osName,
        osVersion: context?.osVersion,
      }, context?.ipAddress);
    } catch (error) {
      authLogger.warn({ err: error, userId: user.id }, 'Failed to log password change event');
    }

    return { message: 'Password updated successfully' };
  }

  /**
   * Log a logout event
   */
  async logLogout(userId: number, userEmail: string, context?: AuthContext, sessionDuration?: number) {
    try {
      await learningAnalyticsService.logAuthEvent({
        userId,
        userEmail,
        eventType: 'logout',
        sessionId: context?.sessionId,
        sessionDuration,
        userAgent: context?.userAgent,
        deviceType: context?.deviceType,
        browserName: context?.browserName,
        browserVersion: context?.browserVersion,
        osName: context?.osName,
        osVersion: context?.osVersion,
      }, context?.ipAddress);
    } catch (error) {
      authLogger.warn({ err: error, userId }, 'Failed to log logout event');
    }
  }
}

export const authService = new AuthService();
