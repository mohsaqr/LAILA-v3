import { Router, Response } from 'express';
import { customLabService } from '../services/customLab.service.js';
import { authenticateToken, requireInstructor, optionalAuth } from '../middleware/auth.middleware.js';
import { asyncHandler } from '../middleware/error.middleware.js';
import { AuthRequest } from '../types/index.js';
import { z } from 'zod';

const router = Router();

// Validation schemas
const createLabSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  labType: z.string().min(1),
  config: z.string().optional(),
  isPublic: z.boolean().optional(),
  addDefaultTemplates: z.boolean().optional(),
});

const updateLabSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().optional(),
  labType: z.string().min(1).optional(),
  config: z.string().optional(),
  isPublic: z.boolean().optional(),
});

const createTemplateSchema = z.object({
  title: z.string().min(1).max(255),
  description: z.string().optional(),
  code: z.string().min(1),
  orderIndex: z.number().int().min(0).optional(),
});

const updateTemplateSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  description: z.string().optional(),
  code: z.string().min(1).optional(),
  orderIndex: z.number().int().min(0).optional(),
});

const assignLabSchema = z.object({
  courseId: z.number().int().positive(),
  moduleId: z.number().int().positive().nullable().optional(),
});

const reorderSchema = z.object({
  ids: z.array(z.number().int().positive()),
});

// ============= LAB TYPES =============

// Get available lab types
router.get('/types', asyncHandler(async (_req: AuthRequest, res: Response) => {
  const types = customLabService.getLabTypes();
  res.json({ success: true, data: types });
}));

// ============= CUSTOM LABS =============

// Get all accessible labs
router.get('/', authenticateToken, asyncHandler(async (req: AuthRequest, res: Response) => {
  const { labType, search } = req.query;
  const labs = await customLabService.getLabs(
    req.user!.id,
    req.user!.isInstructor,
    req.user!.isAdmin,
    {
      labType: labType as string | undefined,
      search: search as string | undefined,
    }
  );
  res.json({ success: true, data: labs });
}));

// Get instructor's labs (for management)
router.get('/my-labs', authenticateToken, requireInstructor, asyncHandler(async (req: AuthRequest, res: Response) => {
  const labs = await customLabService.getInstructorLabs(req.user!.id);
  res.json({ success: true, data: labs });
}));

// Get lab by ID
router.get('/:id', authenticateToken, asyncHandler(async (req: AuthRequest, res: Response) => {
  const id = parseInt(req.params.id);
  const lab = await customLabService.getLabById(id, req.user!.id, req.user!.isAdmin);
  res.json({ success: true, data: lab });
}));

// Create lab
router.post('/', authenticateToken, requireInstructor, asyncHandler(async (req: AuthRequest, res: Response) => {
  const data = createLabSchema.parse(req.body);
  const lab = await customLabService.createLab(
    req.user!.id,
    {
      name: data.name,
      description: data.description,
      labType: data.labType,
      config: data.config,
      isPublic: data.isPublic,
    },
    data.addDefaultTemplates ?? true
  );
  res.status(201).json({ success: true, data: lab });
}));

// Update lab
router.put('/:id', authenticateToken, requireInstructor, asyncHandler(async (req: AuthRequest, res: Response) => {
  const id = parseInt(req.params.id);
  const data = updateLabSchema.parse(req.body);
  const lab = await customLabService.updateLab(id, req.user!.id, data, req.user!.isAdmin);
  res.json({ success: true, data: lab });
}));

// Delete lab
router.delete('/:id', authenticateToken, requireInstructor, asyncHandler(async (req: AuthRequest, res: Response) => {
  const id = parseInt(req.params.id);
  const result = await customLabService.deleteLab(id, req.user!.id, req.user!.isAdmin);
  res.json({ success: true, ...result });
}));

// ============= LAB TEMPLATES =============

// Add template to lab
router.post('/:id/templates', authenticateToken, requireInstructor, asyncHandler(async (req: AuthRequest, res: Response) => {
  const labId = parseInt(req.params.id);
  const data = createTemplateSchema.parse(req.body);
  const template = await customLabService.addTemplate(labId, req.user!.id, data, req.user!.isAdmin);
  res.status(201).json({ success: true, data: template });
}));

// Update template
router.put('/:id/templates/:templateId', authenticateToken, requireInstructor, asyncHandler(async (req: AuthRequest, res: Response) => {
  const templateId = parseInt(req.params.templateId);
  const data = updateTemplateSchema.parse(req.body);
  const template = await customLabService.updateTemplate(templateId, req.user!.id, data, req.user!.isAdmin);
  res.json({ success: true, data: template });
}));

// Delete template
router.delete('/:id/templates/:templateId', authenticateToken, requireInstructor, asyncHandler(async (req: AuthRequest, res: Response) => {
  const templateId = parseInt(req.params.templateId);
  const result = await customLabService.deleteTemplate(templateId, req.user!.id, req.user!.isAdmin);
  res.json({ success: true, ...result });
}));

// Reorder templates
router.put('/:id/templates/reorder', authenticateToken, requireInstructor, asyncHandler(async (req: AuthRequest, res: Response) => {
  const labId = parseInt(req.params.id);
  const { ids } = reorderSchema.parse(req.body);
  const result = await customLabService.reorderTemplates(labId, req.user!.id, ids, req.user!.isAdmin);
  res.json({ success: true, ...result });
}));

// ============= LAB ASSIGNMENTS =============

// Assign lab to course
router.post('/:id/assign', authenticateToken, requireInstructor, asyncHandler(async (req: AuthRequest, res: Response) => {
  const labId = parseInt(req.params.id);
  const { courseId, moduleId } = assignLabSchema.parse(req.body);
  const assignment = await customLabService.assignToCourse(
    labId,
    courseId,
    moduleId ?? null,
    req.user!.id,
    req.user!.isAdmin
  );
  res.status(201).json({ success: true, data: assignment });
}));

// Unassign lab from course
router.delete('/:id/assign/:courseId', authenticateToken, requireInstructor, asyncHandler(async (req: AuthRequest, res: Response) => {
  const labId = parseInt(req.params.id);
  const courseId = parseInt(req.params.courseId);
  const result = await customLabService.unassignFromCourse(labId, courseId, req.user!.id, req.user!.isAdmin);
  res.json({ success: true, ...result });
}));

// Get labs for a course
router.get('/course/:courseId', authenticateToken, asyncHandler(async (req: AuthRequest, res: Response) => {
  const courseId = parseInt(req.params.courseId);
  const assignments = await customLabService.getLabsForCourse(courseId);
  res.json({ success: true, data: assignments });
}));

export default router;
