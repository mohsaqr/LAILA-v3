import bcrypt from 'bcryptjs';
import prisma from '../utils/prisma.js';
import { generateToken } from '../middleware/auth.middleware.js';
import { RegisterInput, LoginInput } from '../utils/validation.js';
import { AppError } from '../middleware/error.middleware.js';
import { UserPayload } from '../types/index.js';
import { learningAnalyticsService, AuthEventData } from './learningAnalytics.service.js';

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
        createdAt: true,
      },
    });

    // Generate token
    const payload: UserPayload = {
      id: user.id,
      email: user.email,
      fullname: user.fullname,
      isAdmin: user.isAdmin,
      isInstructor: user.isInstructor,
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
      console.error('Failed to log registration event:', error);
    }

    return { user, token };
  }

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
        console.error('Failed to log login failure event:', error);
      }
      throw new AppError('Invalid credentials', 401);
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
        console.error('Failed to log login failure event:', error);
      }
      throw new AppError('Account is deactivated', 403);
    }

    // Check password
    const isValidPassword = await bcrypt.compare(data.password, user.passwordHash);
    if (!isValidPassword) {
      // Log failed login attempt - invalid password
      try {
        await learningAnalyticsService.logAuthEvent({
          userId: user.id,
          userEmail: user.email,
          eventType: 'login_failure',
          failureReason: 'invalid_password',
          sessionId: context?.sessionId,
          userAgent: context?.userAgent,
          deviceType: context?.deviceType,
          browserName: context?.browserName,
          browserVersion: context?.browserVersion,
          osName: context?.osName,
          osVersion: context?.osVersion,
        }, context?.ipAddress);
      } catch (error) {
        console.error('Failed to log login failure event:', error);
      }
      throw new AppError('Invalid credentials', 401);
    }

    // Update last login
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLogin: new Date() },
    });

    // Generate token
    const payload: UserPayload = {
      id: user.id,
      email: user.email,
      fullname: user.fullname,
      isAdmin: user.isAdmin,
      isInstructor: user.isInstructor,
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
      console.error('Failed to log login success event:', error);
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
    await prisma.user.update({
      where: { id: userId },
      data: { passwordHash },
    });

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
      console.error('Failed to log password change event:', error);
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
      console.error('Failed to log logout event:', error);
    }
  }
}

export const authService = new AuthService();
