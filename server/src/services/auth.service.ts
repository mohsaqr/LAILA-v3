import bcrypt from 'bcryptjs';
import prisma from '../utils/prisma.js';
import { generateToken, invalidateUserStatusCache } from '../middleware/auth.middleware.js';
import { RegisterInput, LoginInput } from '../utils/validation.js';
import { AppError } from '../middleware/error.middleware.js';
import { UserPayload } from '../types/index.js';
import { learningAnalyticsService, AuthEventData } from './learningAnalytics.service.js';
import { authLogger } from '../utils/logger.js';
import { userService } from './user.service.js';
import { emailService } from './email.service.js';
import crypto from 'crypto';

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
      if (existingUser.isConfirmed) {
        throw new AppError('Email already registered', 409);
      }
      // Unverified user — delete old record so they can re-register
      await prisma.user.delete({ where: { id: existingUser.id } });
    }

    // Hash password
    const passwordHash = await bcrypt.hash(data.password, 10);

    // Create user (unconfirmed until code verification)
    const user = await prisma.user.create({
      data: {
        fullname: data.fullname,
        email: data.email,
        passwordHash,
        isConfirmed: false,
      },
      select: {
        id: true,
        fullname: true,
        email: true,
        isAdmin: true,
        isInstructor: true,
        avatarUrl: true,
        tokenVersion: true,
        createdAt: true,
      },
    });

    // Generate 6-digit verification code
    const code = crypto.randomInt(100000, 999999).toString();
    const expiresAt = new Date(Date.now() + 2 * 60 * 1000); // 10 minutes

    // Delete any existing codes for this user, then create new one
    await prisma.verificationCode.deleteMany({ where: { userId: user.id } });
    await prisma.verificationCode.create({
      data: { userId: user.id, code, expiresAt },
    });

    // Send verification email (non-blocking)
    emailService.sendVerificationCode(user.email, code, user.fullname).catch((err) => {
      authLogger.warn({ err, email: user.email }, 'Failed to send verification email');
    });

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

    // Return email only — no token until verified
    return { email: user.email, message: 'Verification code sent' };
  }

  async verifyCode(email: string, code: string) {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) throw new AppError('User not found', 404);

    const record = await prisma.verificationCode.findFirst({
      where: { userId: user.id, code },
    });

    if (!record) {
      throw new AppError('Invalid verification code', 400);
    }

    if (record.expiresAt < new Date()) {
      // Expired — delete and reject
      await prisma.verificationCode.deleteMany({ where: { userId: user.id } });
      throw new AppError('Verification code has expired', 400);
    }

    // Confirm user and delete code
    const confirmedUser = await prisma.user.update({
      where: { id: user.id },
      data: { isConfirmed: true },
      select: {
        id: true,
        fullname: true,
        email: true,
        isAdmin: true,
        isInstructor: true,
        avatarUrl: true,
        tokenVersion: true,
      },
    });

    await prisma.verificationCode.deleteMany({ where: { userId: user.id } });

    // Generate token
    const payload: UserPayload = {
      id: confirmedUser.id,
      email: confirmedUser.email,
      fullname: confirmedUser.fullname,
      isAdmin: confirmedUser.isAdmin,
      isInstructor: confirmedUser.isInstructor,
      tokenVersion: confirmedUser.tokenVersion,
    };
    const token = generateToken(payload);

    return { user: confirmedUser, token };
  }

  async resendCode(email: string) {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) throw new AppError('User not found', 404);
    if (user.isConfirmed) throw new AppError('User already verified', 400);

    const code = crypto.randomInt(100000, 999999).toString();
    const expiresAt = new Date(Date.now() + 2 * 60 * 1000);

    await prisma.verificationCode.deleteMany({ where: { userId: user.id } });
    await prisma.verificationCode.create({
      data: { userId: user.id, code, expiresAt },
    });

    // Send verification email (non-blocking)
    emailService.sendVerificationCode(user.email, code, user.fullname).catch((err) => {
      authLogger.warn({ err, email: user.email }, 'Failed to send verification email');
    });

    return { message: 'Verification code resent' };
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

    if (!user.isConfirmed) {
      throw new AppError('Your account is not verified. Please sign up again and complete the verification.', 403);
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

    // Fetch user's language preference
    const languagePreference = await userService.getLanguagePreference(user.id);

    return {
      user: {
        id: user.id,
        fullname: user.fullname,
        email: user.email,
        isAdmin: user.isAdmin,
        isInstructor: user.isInstructor,
        avatarUrl: user.avatarUrl,
        language: languagePreference,
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
        avatarUrl: true,
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

  async forgotPassword(email: string) {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) throw new AppError('User not found', 404);

    // Delete any existing verification codes for this user
    await prisma.verificationCode.deleteMany({ where: { userId: user.id } });

    // Generate 6-digit verification code
    const code = crypto.randomInt(100000, 999999).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    await prisma.verificationCode.create({
      data: { userId: user.id, code, expiresAt },
    });

    // Send verification email (non-blocking)
    emailService.sendVerificationCode(user.email, code, user.fullname).catch((err) => {
      authLogger.warn({ err, email: user.email }, 'Failed to send password reset verification email');
    });

    return { email, message: 'Verification code sent' };
  }

  async resetPassword(email: string, code: string, newPassword: string) {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) throw new AppError('User not found', 404);

    const record = await prisma.verificationCode.findFirst({
      where: { userId: user.id },
    });

    if (!record) {
      throw new AppError('Invalid verification code', 400);
    }

    if (record.expiresAt < new Date()) {
      await prisma.verificationCode.deleteMany({ where: { userId: user.id } });
      throw new AppError('Verification code has expired', 400);
    }

    if (record.code !== code) {
      throw new AppError('Invalid verification code', 400);
    }

    // Hash new password
    const passwordHash = await bcrypt.hash(newPassword, 10);

    // Update user: new password, increment tokenVersion, reset lockout
    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        tokenVersion: { increment: 1 },
        failedLoginAttempts: 0,
        lockedUntil: null,
      },
      select: {
        id: true,
        fullname: true,
        email: true,
        isAdmin: true,
        isInstructor: true,
        avatarUrl: true,
        tokenVersion: true,
      },
    });

    // Delete the verification code
    await prisma.verificationCode.deleteMany({ where: { userId: user.id } });

    // Invalidate user status cache
    invalidateUserStatusCache(user.id);

    // Generate token
    const payload: UserPayload = {
      id: updatedUser.id,
      email: updatedUser.email,
      fullname: updatedUser.fullname,
      isAdmin: updatedUser.isAdmin,
      isInstructor: updatedUser.isInstructor,
      tokenVersion: updatedUser.tokenVersion,
    };
    const token = generateToken(payload);

    return { user: updatedUser, token };
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
