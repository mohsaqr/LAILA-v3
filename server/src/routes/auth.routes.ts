import { Router, Response, Request } from 'express';
import { authService, AuthContext } from '../services/auth.service.js';
import { authenticateToken } from '../middleware/auth.middleware.js';
import { asyncHandler } from '../middleware/error.middleware.js';
import { registerSchema, loginSchema } from '../utils/validation.js';
import { AuthRequest } from '../types/index.js';

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

// Logout (client-side token removal, but useful for logging)
router.post('/logout', authenticateToken, asyncHandler(async (req: AuthRequest, res: Response) => {
  const context = getAuthContext(req);
  const sessionDuration = req.body.sessionDuration;

  // Log the logout event
  await authService.logLogout(req.user!.id, req.user!.email, context, sessionDuration);

  res.json({ success: true, message: 'Logged out successfully' });
}));

export default router;
