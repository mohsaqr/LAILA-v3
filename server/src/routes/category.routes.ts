import { Router, Response } from 'express';
import { categoryService } from '../services/category.service.js';
import { authenticateToken, requireAdmin } from '../middleware/auth.middleware.js';
import { asyncHandler } from '../middleware/error.middleware.js';
import { AuthRequest } from '../types/index.js';

const router = Router();

// GET /api/categories — public
router.get('/', asyncHandler(async (_req, res: Response) => {
  const categories = await categoryService.getCategories();
  res.json({ success: true, data: categories });
}));

// POST /api/categories — admin only
router.post('/', authenticateToken, requireAdmin, asyncHandler(async (req: AuthRequest, res: Response) => {
  const { title } = req.body;
  if (!title || typeof title !== 'string' || !title.trim()) {
    res.status(400).json({ success: false, error: 'Title is required' });
    return;
  }
  const category = await categoryService.createCategory(title.trim());
  res.status(201).json({ success: true, data: category });
}));

// PUT /api/categories/:id — admin only
router.put('/:id', authenticateToken, requireAdmin, asyncHandler(async (req: AuthRequest, res: Response) => {
  const id = parseInt(req.params.id);
  const { title } = req.body;
  if (!title || typeof title !== 'string' || !title.trim()) {
    res.status(400).json({ success: false, error: 'Title is required' });
    return;
  }
  const category = await categoryService.updateCategory(id, title.trim());
  res.json({ success: true, data: category });
}));

// DELETE /api/categories/:id — admin only
router.delete('/:id', authenticateToken, requireAdmin, asyncHandler(async (req: AuthRequest, res: Response) => {
  const id = parseInt(req.params.id);
  const result = await categoryService.deleteCategory(id);
  res.json({ success: true, ...result });
}));

export default router;
