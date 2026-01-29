/**
 * Prompt Block Routes
 *
 * API endpoints for managing customizable prompt building blocks.
 * Public endpoints for reading, admin-only for mutations.
 */

import { Router, Response, NextFunction } from 'express';
import { authenticateToken, optionalAuth } from '../middleware/auth.middleware.js';
import { promptBlockService } from '../services/promptBlock.service.js';
import { AppError } from '../middleware/error.middleware.js';
import { AuthRequest } from '../types/index.js';
import { z } from 'zod';

const router = Router();

// Validation schemas
const createBlockSchema = z.object({
  category: z.string().min(1, 'Category is required'),
  label: z.string().min(1, 'Label is required').max(100),
  promptText: z.string().min(1, 'Prompt text is required'),
  description: z.string().max(500).optional(),
  popular: z.boolean().optional(),
  orderIndex: z.number().int().min(0).optional(),
});

const updateBlockSchema = createBlockSchema.partial().extend({
  isActive: z.boolean().optional(),
});

const createCategorySchema = z.object({
  slug: z.string().min(1).max(50).regex(/^[a-z0-9_]+$/, 'Slug must be lowercase alphanumeric with underscores'),
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  icon: z.string().max(50).optional(),
  orderIndex: z.number().int().min(0).optional(),
});

const updateCategorySchema = createCategorySchema.partial().omit({ slug: true }).extend({
  isActive: z.boolean().optional(),
});

const reorderSchema = z.object({
  ids: z.array(z.number().int().positive()),
});

// Helper to check admin/instructor access
const requireAdminOrInstructor = (req: AuthRequest): void => {
  if (!req.user?.isAdmin && !req.user?.isInstructor) {
    throw new AppError('Admin or instructor access required', 403);
  }
};

// ==================== PUBLIC ROUTES ====================

/**
 * GET /api/prompt-blocks
 * Get all active blocks and categories (for student UI)
 */
router.get('/', optionalAuth, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const result = await promptBlockService.getBlocksWithCategories();
    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/prompt-blocks/categories
 * Get all active categories
 */
router.get('/categories', optionalAuth, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const categories = await promptBlockService.getAllCategories();
    res.json({
      success: true,
      data: categories,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/prompt-blocks/blocks
 * Get all active blocks, optionally filtered by category
 */
router.get('/blocks', optionalAuth, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { category } = req.query;
    const blocks = await promptBlockService.getAllBlocks(category as string | undefined);
    res.json({
      success: true,
      data: blocks,
    });
  } catch (error) {
    next(error);
  }
});

// ==================== ADMIN ROUTES ====================

/**
 * GET /api/prompt-blocks/admin
 * Get all blocks including inactive (admin only)
 */
router.get('/admin', authenticateToken, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    requireAdminOrInstructor(req);

    const [categories, blocks] = await Promise.all([
      promptBlockService.getAllCategoriesAdmin(),
      promptBlockService.getAllBlocksAdmin(),
    ]);

    res.json({
      success: true,
      data: { categories, blocks },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/prompt-blocks/blocks
 * Create a new block (admin only)
 */
router.post('/blocks', authenticateToken, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    requireAdminOrInstructor(req);

    const data = createBlockSchema.parse(req.body);
    const block = await promptBlockService.createBlock(data, req.user!.id);

    res.status(201).json({
      success: true,
      data: block,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /api/prompt-blocks/blocks/:id
 * Update a block (admin only)
 */
router.put('/blocks/:id', authenticateToken, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    requireAdminOrInstructor(req);

    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      throw new AppError('Invalid block ID', 400);
    }

    const data = updateBlockSchema.parse(req.body);
    const block = await promptBlockService.updateBlock(id, data);

    res.json({
      success: true,
      data: block,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/prompt-blocks/blocks/:id
 * Soft delete a block (admin only)
 */
router.delete('/blocks/:id', authenticateToken, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    requireAdminOrInstructor(req);

    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      throw new AppError('Invalid block ID', 400);
    }

    const hard = req.query.hard === 'true';
    if (hard) {
      await promptBlockService.hardDeleteBlock(id);
    } else {
      await promptBlockService.deleteBlock(id);
    }

    res.json({
      success: true,
      message: hard ? 'Block permanently deleted' : 'Block deactivated',
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/prompt-blocks/blocks/reorder
 * Reorder blocks (admin only)
 */
router.post('/blocks/reorder', authenticateToken, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    requireAdminOrInstructor(req);

    const { ids } = reorderSchema.parse(req.body);
    await promptBlockService.reorderBlocks(ids);

    res.json({
      success: true,
      message: 'Blocks reordered',
    });
  } catch (error) {
    next(error);
  }
});

// ==================== CATEGORY ADMIN ROUTES ====================

/**
 * POST /api/prompt-blocks/categories
 * Create a new category (admin only)
 */
router.post('/categories', authenticateToken, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    requireAdminOrInstructor(req);

    const data = createCategorySchema.parse(req.body);

    // Check if slug already exists
    const existing = await promptBlockService.getCategoryBySlug(data.slug);
    if (existing) {
      throw new AppError('Category with this slug already exists', 400);
    }

    const category = await promptBlockService.createCategory(data);

    res.status(201).json({
      success: true,
      data: category,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /api/prompt-blocks/categories/:id
 * Update a category (admin only)
 */
router.put('/categories/:id', authenticateToken, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    requireAdminOrInstructor(req);

    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      throw new AppError('Invalid category ID', 400);
    }

    const data = updateCategorySchema.parse(req.body);
    const category = await promptBlockService.updateCategory(id, data);

    res.json({
      success: true,
      data: category,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/prompt-blocks/categories/:id
 * Soft delete a category (admin only)
 */
router.delete('/categories/:id', authenticateToken, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    requireAdminOrInstructor(req);

    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      throw new AppError('Invalid category ID', 400);
    }

    await promptBlockService.deleteCategory(id);

    res.json({
      success: true,
      message: 'Category deactivated',
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/prompt-blocks/categories/reorder
 * Reorder categories (admin only)
 */
router.post('/categories/reorder', authenticateToken, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    requireAdminOrInstructor(req);

    const { ids } = reorderSchema.parse(req.body);
    await promptBlockService.reorderCategories(ids);

    res.json({
      success: true,
      message: 'Categories reordered',
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/prompt-blocks/seed
 * Seed default blocks and categories (admin only)
 */
router.post('/seed', authenticateToken, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    requireAdminOrInstructor(req);

    const result = await promptBlockService.seedDefaults();

    res.json({
      success: true,
      data: result,
      message: result.blocksSeeded || result.categoriesSeeded
        ? 'Default data seeded successfully'
        : 'Default data already exists',
    });
  } catch (error) {
    next(error);
  }
});

export default router;
