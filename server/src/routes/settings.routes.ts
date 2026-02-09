import { Router, Response } from 'express';
import { settingsService } from '../services/settings.service.js';
import { mcqGenerationService } from '../services/mcqGeneration.service.js';
import { authenticateToken, requireAdmin } from '../middleware/auth.middleware.js';
import { asyncHandler } from '../middleware/error.middleware.js';
import { updateApiConfigSchema } from '../utils/validation.js';
import { AuthRequest } from '../types/index.js';
import { z } from 'zod';

const router = Router();

// All routes require admin
router.use(authenticateToken, requireAdmin);

// ============= SYSTEM SETTINGS =============

// Get all system settings
router.get('/', asyncHandler(async (req: AuthRequest, res: Response) => {
  const settings = await settingsService.getSystemSettings();
  res.json({ success: true, data: settings });
}));

// Get single setting
router.get('/:key', asyncHandler(async (req: AuthRequest, res: Response) => {
  const setting = await settingsService.getSystemSetting(req.params.key);
  res.json({ success: true, data: setting });
}));

// Update setting
router.put('/:key', asyncHandler(async (req: AuthRequest, res: Response) => {
  const { value, type, description, isEncrypted } = req.body;
  const setting = await settingsService.updateSystemSetting(req.params.key, value, {
    type,
    description,
    isEncrypted,
  });
  res.json({ success: true, data: setting });
}));

// Delete setting
router.delete('/:key', asyncHandler(async (req: AuthRequest, res: Response) => {
  const result = await settingsService.deleteSystemSetting(req.params.key);
  res.json({ success: true, ...result });
}));

// ============= API CONFIGURATIONS =============

// Get all API configs
router.get('/api/configs', asyncHandler(async (req: AuthRequest, res: Response) => {
  const configs = await settingsService.getApiConfigurations();
  res.json({ success: true, data: configs });
}));

// Get single API config
router.get('/api/configs/:serviceName', asyncHandler(async (req: AuthRequest, res: Response) => {
  const config = await settingsService.getApiConfiguration(req.params.serviceName);
  res.json({
    success: true,
    data: {
      ...config,
      apiKey: config.apiKey ? '********' : null,
    }
  });
}));

// Update API config
router.put('/api/configs/:serviceName', asyncHandler(async (req: AuthRequest, res: Response) => {
  const data = updateApiConfigSchema.parse(req.body);
  const config = await settingsService.updateApiConfiguration(req.params.serviceName, data);
  res.json({ success: true, data: config });
}));

// Test API connection
router.post('/api/configs/:serviceName/test', asyncHandler(async (req: AuthRequest, res: Response) => {
  const result = await settingsService.testApiConfiguration(req.params.serviceName);
  res.json({ success: true, data: result });
}));

// ============= SEED DEFAULTS =============

// Seed default settings
router.post('/seed', asyncHandler(async (req: AuthRequest, res: Response) => {
  const result = await settingsService.seedDefaultSettings();
  res.json({ success: true, ...result });
}));

// ============= MCQ GENERATION SETTINGS =============

const mcqSettingsUpdateSchema = z.object({
  systemPrompt: z.string().optional(),
  formatInstructions: z.string().optional(),
  defaults: z.object({
    optionCount: z.number().min(3).max(5).optional(),
    maxQuestions: z.number().min(1).max(20).optional(),
    defaultDifficulty: z.enum(['easy', 'medium', 'hard']).optional(),
    includeExplanations: z.boolean().optional(),
    temperature: z.number().min(0).max(1).optional(),
  }).optional(),
});

// Get MCQ generation settings
router.get('/mcq-generation', asyncHandler(async (req: AuthRequest, res: Response) => {
  const settings = await mcqGenerationService.getGenerationSettings();
  res.json({ success: true, data: settings });
}));

// Update MCQ generation settings
router.put('/mcq-generation', asyncHandler(async (req: AuthRequest, res: Response) => {
  const data = mcqSettingsUpdateSchema.parse(req.body);
  const settings = await mcqGenerationService.updateGenerationSettings(data);
  res.json({ success: true, data: settings });
}));

// Test MCQ generation with current settings
router.post('/mcq-generation/test', asyncHandler(async (req: AuthRequest, res: Response) => {
  const testInput = {
    topic: req.body.topic || 'General knowledge',
    questionCount: 2,
    difficulty: 'medium' as const,
    includeExplanations: true,
  };

  const result = await mcqGenerationService.generateQuestions(testInput);
  res.json({ success: true, data: result });
}));

export default router;
