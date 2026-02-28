import { Router, Response, Request } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { v4 as uuid } from 'uuid';
import { authService, AuthContext } from '../services/auth.service.js';
import { authenticateToken } from '../middleware/auth.middleware.js';
import { asyncHandler } from '../middleware/error.middleware.js';
import { registerSchema, loginSchema, updateProfileSchema } from '../utils/validation.js';
import { AuthRequest } from '../types/index.js';
import prisma from '../utils/prisma.js';

// Multer setup for profile avatar uploads
const profilesDir = path.join(process.cwd(), 'uploads', 'profiles');
if (!fs.existsSync(profilesDir)) {
  fs.mkdirSync(profilesDir, { recursive: true });
}

const avatarStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, profilesDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${uuid()}${ext}`);
  },
});

const avatarFilter = (_req: Express.Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowed = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
  const ext = path.extname(file.originalname).toLowerCase();
  if (!allowed.includes(ext)) {
    cb(new Error('Only image files (jpg, jpeg, png, gif, webp) are allowed'));
    return;
  }
  cb(null, true);
};

const avatarUpload = multer({
  storage: avatarStorage,
  fileFilter: avatarFilter,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
});

const router = Router();

// Helper to extract client info for logging
function getClientIp(req: Request): string | undefined {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    return (typeof forwarded === 'string' ? forwarded : forwarded[0]).split(',')[0].trim();
  }
  return req.socket.remoteAddress;
}

function getAuthContext(req: Request): AuthContext {
  // Extract client info from request body (sent by frontend) or headers
  const body = req.body || {};
  return {
    ipAddress: getClientIp(req),
    userAgent: req.headers['user-agent'],
    sessionId: body.sessionId,
    deviceType: body.deviceType,
    browserName: body.browserName,
    browserVersion: body.browserVersion,
    osName: body.osName,
    osVersion: body.osVersion,
  };
}

// Register
router.post('/register', asyncHandler(async (req, res: Response) => {
  const data = registerSchema.parse(req.body);
  const context = getAuthContext(req);
  const result = await authService.register(data, context);
  res.status(201).json({ success: true, data: result });
}));

// Login
router.post('/login', asyncHandler(async (req, res: Response) => {
  const data = loginSchema.parse(req.body);
  const context = getAuthContext(req);
  const result = await authService.login(data, context);
  res.json({ success: true, data: result });
}));

// Get current user profile
router.get('/me', authenticateToken, asyncHandler(async (req: AuthRequest, res: Response) => {
  const user = await authService.getProfile(req.user!.id);
  res.json({ success: true, data: user });
}));

// Update password
router.put('/password', authenticateToken, asyncHandler(async (req: AuthRequest, res: Response) => {
  const { currentPassword, newPassword } = req.body;
  const context = getAuthContext(req);
  const result = await authService.updatePassword(req.user!.id, currentPassword, newPassword, context);
  res.json({ success: true, data: result });
}));

// Verify token
router.get('/verify', authenticateToken, asyncHandler(async (req: AuthRequest, res: Response) => {
  res.json({
    success: true,
    data: {
      valid: true,
      user: req.user
    }
  });
}));

// Update profile (fullname only — self-service, no ID in URL)
router.put('/profile', authenticateToken, asyncHandler(async (req: AuthRequest, res: Response) => {
  const { fullname } = updateProfileSchema.parse(req.body);
  const updated = await prisma.user.update({
    where: { id: req.user!.id },
    data: { fullname },
    select: {
      id: true,
      fullname: true,
      email: true,
      isAdmin: true,
      isInstructor: true,
      avatarUrl: true,
    },
  });
  res.json({ success: true, data: updated });
}));

// Upload avatar
router.post('/avatar', authenticateToken, (req: AuthRequest, res: Response, next: Function) => {
  avatarUpload.single('avatar')(req as any, res, (err) => {
    if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
      res.status(400).json({ success: false, error: 'Image must be 5MB or smaller.' });
      return;
    }
    if (err) {
      res.status(400).json({ success: false, error: err.message });
      return;
    }
    next();
  });
}, asyncHandler(async (req: AuthRequest, res: Response) => {
  if (!req.file) {
    res.status(400).json({ success: false, error: 'No file uploaded' });
    return;
  }
  const avatarUrl = `/uploads/profiles/${req.file.filename}`;
  const updated = await prisma.user.update({
    where: { id: req.user!.id },
    data: { avatarUrl },
    select: { id: true, avatarUrl: true },
  });
  res.json({ success: true, data: { avatarUrl: updated.avatarUrl } });
}));

// Logout (client-side token removal, but useful for logging)
router.post('/logout', authenticateToken, asyncHandler(async (req: AuthRequest, res: Response) => {
  const context = getAuthContext(req);
  const sessionDuration = req.body.sessionDuration;

  // Log the logout event
  await authService.logLogout(req.user!.id, req.user!.email, context, sessionDuration);

  res.json({ success: true, message: 'Logged out successfully' });
}));

export default router;
