import { Router, Response } from 'express';
import { userService } from '../services/user.service.js';
import { authenticateToken, requireAdmin } from '../middleware/auth.middleware.js';
import { asyncHandler } from '../middleware/error.middleware.js';
import { updateUserSchema } from '../utils/validation.js';
import { AuthRequest } from '../types/index.js';

const router = Router();

// Get all users (admin only)
router.get('/', authenticateToken, requireAdmin, asyncHandler(async (req: AuthRequest, res: Response) => {
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 20;
  const search = req.query.search as string;

  const result = await userService.getUsers(page, limit, search);
  res.json({ success: true, ...result });
}));

// Get user by ID (admin or self)
router.get('/:id', authenticateToken, asyncHandler(async (req: AuthRequest, res: Response) => {
  const id = parseInt(req.params.id);

  // Only admin or self can view
  if (req.user!.id !== id && !req.user!.isAdmin) {
    res.status(403).json({ success: false, error: 'Not authorized' });
    return;
  }

  const user = await userService.getUserById(id);
  res.json({ success: true, data: user });
}));

// Update user (admin or self)
router.put('/:id', authenticateToken, asyncHandler(async (req: AuthRequest, res: Response) => {
  const id = parseInt(req.params.id);

  // Only admin or self can update
  if (req.user!.id !== id && !req.user!.isAdmin) {
    res.status(403).json({ success: false, error: 'Not authorized' });
    return;
  }

  const data = updateUserSchema.parse(req.body);
  const user = await userService.updateUser(id, data, req.user!.isAdmin);
  res.json({ success: true, data: user });
}));

// Delete user (admin only)
router.delete('/:id', authenticateToken, requireAdmin, asyncHandler(async (req: AuthRequest, res: Response) => {
  const id = parseInt(req.params.id);
  const result = await userService.deleteUser(id);
  res.json({ success: true, ...result });
}));

// Get user settings
router.get('/:id/settings', authenticateToken, asyncHandler(async (req: AuthRequest, res: Response) => {
  const id = parseInt(req.params.id);

  if (req.user!.id !== id && !req.user!.isAdmin) {
    res.status(403).json({ success: false, error: 'Not authorized' });
    return;
  }

  const settings = await userService.getUserSettings(id);
  res.json({ success: true, data: settings });
}));

// Update user setting
router.put('/:id/settings/:key', authenticateToken, asyncHandler(async (req: AuthRequest, res: Response) => {
  const id = parseInt(req.params.id);
  const key = req.params.key;
  const { value } = req.body;

  if (req.user!.id !== id && !req.user!.isAdmin) {
    res.status(403).json({ success: false, error: 'Not authorized' });
    return;
  }

  const setting = await userService.updateUserSetting(id, key, value);
  res.json({ success: true, data: setting });
}));

// Get user stats (for dashboard)
router.get('/:id/stats', authenticateToken, asyncHandler(async (req: AuthRequest, res: Response) => {
  const id = parseInt(req.params.id);

  if (req.user!.id !== id && !req.user!.isAdmin) {
    res.status(403).json({ success: false, error: 'Not authorized' });
    return;
  }

  const stats = await userService.getUserStats(id);
  res.json({ success: true, data: stats });
}));

// Get instructor stats
router.get('/:id/instructor-stats', authenticateToken, asyncHandler(async (req: AuthRequest, res: Response) => {
  const id = parseInt(req.params.id);

  if (req.user!.id !== id && !req.user!.isAdmin) {
    res.status(403).json({ success: false, error: 'Not authorized' });
    return;
  }

  const stats = await userService.getInstructorStats(id);
  res.json({ success: true, data: stats });
}));

export default router;
