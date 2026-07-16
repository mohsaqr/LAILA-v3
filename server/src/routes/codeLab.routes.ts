import { Router, Response } from 'express';
import { codeLabService } from '../services/codeLab.service.js';
import { authenticateToken, requireInstructor, optionalAuth } from '../middleware/auth.middleware.js';
import { asyncHandler } from '../middleware/error.middleware.js';
import { AuthRequest } from '../types/index.js';
import { z } from 'zod';
import { AppError } from '../middleware/error.middleware.js';

const router = Router();

/** Route params must be numeric ids; anything else is a 400, not a Prisma NaN. */
const parseId = (value: string): number => {
  const id = parseInt(value, 10);
  if (Number.isNaN(id)) {
    throw new AppError('Invalid id', 400);
  }
  return id;
};

// Validation schemas
const createCodeLabSchema = z.object({
  moduleId: z.number().int().positive(),
  title: z.string().min(1).max(255),
  description: z.string().optional(),
  isPublished: z.boolean().optional(),
  availableFrom: z.string().datetime().optional().nullable(),
  availableUntil: z.string().datetime().optional().nullable(),
});

const updateCodeLabSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  description: z.string().optional(),
  isPublished: z.boolean().optional(),
  orderIndex: z.number().int().min(0).optional(),
  aiChatbotId: z.number().int().positive().nullable().optional(),
});

const createCodeBlockSchema = z.object({
  title: z.string().min(1).max(255),
  instructions: z.string().optional(),
  starterCode: z.string().optional(),
  locked: z.boolean().optional(),
  position: z.number().int().min(0).optional(),
  cellType: z.enum(['code', 'markdown']).optional(),
});

const updateCodeBlockSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  instructions: z.string().optional(),
  starterCode: z.string().optional(),
  // orderIndex deliberately absent — ordering changes only via reorder/position.
  locked: z.boolean().optional(),
  cellType: z.enum(['code', 'markdown']).optional(),
});

const reorderSchema = z.object({
  ids: z.array(z.number().int().positive()),
});

// ============= CODE LABS =============

// Get code labs for a module (requires authentication and enrollment)
router.get('/module/:moduleId', authenticateToken, asyncHandler(async (req: AuthRequest, res: Response) => {
  const moduleId = parseId(req.params.moduleId);
  const codeLabs = await codeLabService.getCodeLabsForModule(moduleId, req.user!.id, req.user!.isInstructor, req.user!.isAdmin);
  res.json({ success: true, data: codeLabs });
}));

// Get code lab by ID (requires authentication and enrollment)
router.get('/:id', authenticateToken, asyncHandler(async (req: AuthRequest, res: Response) => {
  const id = parseId(req.params.id);
  const codeLab = await codeLabService.getCodeLabById(id, req.user!.id);
  res.json({ success: true, data: codeLab });
}));

// Create code lab
router.post('/', authenticateToken, requireInstructor, asyncHandler(async (req: AuthRequest, res: Response) => {
  const data = createCodeLabSchema.parse(req.body);
  const codeLab = await codeLabService.createCodeLab(
    data.moduleId,
    req.user!.id,
    { title: data.title, description: data.description, isPublished: data.isPublished, availableFrom: data.availableFrom, availableUntil: data.availableUntil },
    req.user!.isAdmin
  );
  res.status(201).json({ success: true, data: codeLab });
}));

// Update code lab
router.put('/:id', authenticateToken, requireInstructor, asyncHandler(async (req: AuthRequest, res: Response) => {
  const id = parseId(req.params.id);
  const data = updateCodeLabSchema.parse(req.body);
  const codeLab = await codeLabService.updateCodeLab(id, req.user!.id, data, req.user!.isAdmin);
  res.json({ success: true, data: codeLab });
}));

// Delete code lab
router.delete('/:id', authenticateToken, requireInstructor, asyncHandler(async (req: AuthRequest, res: Response) => {
  const id = parseId(req.params.id);
  const result = await codeLabService.deleteCodeLab(id, req.user!.id, req.user!.isAdmin);
  res.json({ success: true, ...result });
}));

// Reorder code labs in a module
router.put('/module/:moduleId/reorder', authenticateToken, requireInstructor, asyncHandler(async (req: AuthRequest, res: Response) => {
  const moduleId = parseId(req.params.moduleId);
  const { ids } = reorderSchema.parse(req.body);
  const result = await codeLabService.reorderCodeLabs(moduleId, req.user!.id, ids, req.user!.isAdmin);
  res.json({ success: true, ...result });
}));

// ============= CODE BLOCKS =============

// Create code block
router.post('/:labId/blocks', authenticateToken, requireInstructor, asyncHandler(async (req: AuthRequest, res: Response) => {
  const labId = parseId(req.params.labId);
  const data = createCodeBlockSchema.parse(req.body);
  const block = await codeLabService.createCodeBlock(labId, req.user!.id, data, req.user!.isAdmin);
  res.status(201).json({ success: true, data: block });
}));

// Reorder code blocks in a code lab
// NOTE: must be registered before /:labId/blocks/:blockId, otherwise Express
// matches this path with blockId="reorder" and the handler never runs.
router.put('/:labId/blocks/reorder', authenticateToken, requireInstructor, asyncHandler(async (req: AuthRequest, res: Response) => {
  const labId = parseId(req.params.labId);
  const { ids } = reorderSchema.parse(req.body);
  const result = await codeLabService.reorderCodeBlocks(labId, req.user!.id, ids, req.user!.isAdmin);
  res.json({ success: true, ...result });
}));

// Update code block
router.put('/:labId/blocks/:blockId', authenticateToken, requireInstructor, asyncHandler(async (req: AuthRequest, res: Response) => {
  const blockId = parseId(req.params.blockId);
  const data = updateCodeBlockSchema.parse(req.body);
  const block = await codeLabService.updateCodeBlock(blockId, req.user!.id, data, req.user!.isAdmin);
  res.json({ success: true, data: block });
}));

// Delete code block
router.delete('/:labId/blocks/:blockId', authenticateToken, requireInstructor, asyncHandler(async (req: AuthRequest, res: Response) => {
  const blockId = parseId(req.params.blockId);
  const result = await codeLabService.deleteCodeBlock(blockId, req.user!.id, req.user!.isAdmin);
  res.json({ success: true, ...result });
}));

export default router;
