import { Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { AuthRequest, UserPayload } from '../types/index.js';
import prisma from '../utils/prisma.js';

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error('JWT_SECRET environment variable is required');
}

// =============================================================================
// USER STATUS CACHE - Reduces DB queries on every authenticated request
// =============================================================================

interface CachedUserStatus {
  tokenVersion: number;
  isActive: boolean;
  cachedAt: number;
}

const userStatusCache = new Map<number, CachedUserStatus>();
const USER_STATUS_CACHE_TTL = 30 * 1000; // 30 seconds TTL

function getCachedUserStatus(userId: number): CachedUserStatus | null {
  const cached = userStatusCache.get(userId);
  if (!cached) return null;

  // Check if cache is still valid
  if (Date.now() - cached.cachedAt > USER_STATUS_CACHE_TTL) {
    userStatusCache.delete(userId);
    return null;
  }

  return cached;
}

function setCachedUserStatus(userId: number, status: { tokenVersion: number; isActive: boolean }): void {
  userStatusCache.set(userId, {
    ...status,
    cachedAt: Date.now(),
  });
}

// Invalidate cache when user status changes (call from auth.service on logout/password change)
export function invalidateUserStatusCache(userId: number): void {
  userStatusCache.delete(userId);
}

// Clear entire cache (for admin operations)
export function clearUserStatusCache(): void {
  userStatusCache.clear();
}

export const authenticateToken = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const authHeader = req.headers.authorization;
  const token = authHeader?.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    res.status(401).json({ success: false, error: 'Authentication required' });
    return;
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as UserPayload;

    // Validate tokenVersion against database to support token invalidation
    if (decoded.tokenVersion !== undefined) {
      // Check cache first to reduce DB load
      let cachedStatus = getCachedUserStatus(decoded.id);
      let tokenVersion: number;
      let isActive: boolean;

      if (cachedStatus) {
        // Cache hit
        tokenVersion = cachedStatus.tokenVersion;
        isActive = cachedStatus.isActive;
      } else {
        // Cache miss - query database
        const user = await prisma.user.findUnique({
          where: { id: decoded.id },
          select: { tokenVersion: true, isActive: true },
        });

        if (!user) {
          res.status(403).json({ success: false, error: 'Account not found' });
          return;
        }

        tokenVersion = user.tokenVersion;
        isActive = user.isActive;

        // Cache the result
        setCachedUserStatus(decoded.id, { tokenVersion, isActive });
      }

      if (!isActive) {
        res.status(403).json({ success: false, error: 'Account is deactivated' });
        return;
      }

      if (tokenVersion !== decoded.tokenVersion) {
        res.status(403).json({ success: false, error: 'Token has been invalidated. Please log in again.' });
        return;
      }
    }

    req.user = decoded;
    next();
  } catch (error) {
    res.status(403).json({ success: false, error: 'Invalid or expired token' });
  }
};

export const optionalAuth = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): void => {
  const authHeader = req.headers.authorization;
  const token = authHeader?.split(' ')[1];

  if (token) {
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as UserPayload;
      req.user = decoded;
    } catch {
      // Token invalid, but continue without user
    }
  }
  next();
};

export const requireAdmin = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): void => {
  if (!req.user) {
    res.status(401).json({ success: false, error: 'Authentication required' });
    return;
  }

  if (!req.user.isAdmin) {
    res.status(403).json({ success: false, error: 'Admin access required' });
    return;
  }

  next();
};

export const requireInstructor = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): void => {
  if (!req.user) {
    res.status(401).json({ success: false, error: 'Authentication required' });
    return;
  }

  if (!req.user.isInstructor && !req.user.isAdmin) {
    res.status(403).json({ success: false, error: 'Instructor access required' });
    return;
  }

  next();
};

export const generateToken = (user: UserPayload): string => {
  return jwt.sign(user, JWT_SECRET, { expiresIn: '7d' });
};

export const verifyToken = (token: string): UserPayload | null => {
  try {
    return jwt.verify(token, JWT_SECRET) as UserPayload;
  } catch {
    return null;
  }
};
