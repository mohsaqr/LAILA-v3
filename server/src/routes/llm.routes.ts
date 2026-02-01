// =============================================================================
// LLM PROVIDER ROUTES - AI/LLM Configuration API
// =============================================================================

import { Router, Response } from 'express';
import { llmService } from '../services/llm.service.js';
import { authenticateToken, requireAdmin } from '../middleware/auth.middleware.js';
import { asyncHandler } from '../middleware/error.middleware.js';
import { AuthRequest } from '../types/index.js';
import { PROVIDER_DEFAULTS, COMMON_MODELS, LLMProviderName } from '../types/llm.types.js';
import { z } from 'zod';

const router = Router();

// =============================================================================
// VALIDATION SCHEMAS
// =============================================================================

const createProviderSchema = z.object({
  name: z.string().min(1),
  displayName: z.string().optional(),
  description: z.string().optional(),
  isEnabled: z.boolean().optional(),
  isDefault: z.boolean().optional(),
  priority: z.number().int().optional(),
  baseUrl: z.string().optional(), // Allow any string for local URLs
  apiKey: z.string().optional(),
  apiVersion: z.string().optional(),
  organizationId: z.string().optional(),
  projectId: z.string().optional(),
  defaultModel: z.string().optional(),
  defaultTemperature: z.number().min(0).max(2).optional(),
  defaultMaxTokens: z.number().int().min(1).optional(),
  defaultTopP: z.number().min(0).max(1).optional(),
  defaultTopK: z.number().int().min(1).optional().nullable(),
  defaultFrequencyPenalty: z.number().min(-2).max(2).optional(),
  defaultPresencePenalty: z.number().min(-2).max(2).optional(),
  defaultRepeatPenalty: z.number().min(0).max(2).optional().nullable(),
  maxContextLength: z.number().int().optional().nullable(),
  maxOutputTokens: z.number().int().optional().nullable(),
  defaultStopSequences: z.array(z.string()).optional(),
  defaultResponseFormat: z.enum(['text', 'json', 'json_object']).optional(),
  requestTimeout: z.number().int().min(1000).optional(),
  connectTimeout: z.number().int().min(1000).optional(),
  maxRetries: z.number().int().min(0).max(10).optional(),
  retryDelay: z.number().int().min(0).optional(),
  retryBackoffMultiplier: z.number().min(1).max(5).optional(),
  rateLimitRpm: z.number().int().optional().nullable(),
  rateLimitTpm: z.number().int().optional().nullable(),
  rateLimitRpd: z.number().int().optional().nullable(),
  concurrencyLimit: z.number().int().min(1).optional(),
  defaultStreaming: z.boolean().optional(),
  proxyUrl: z.string().optional(),
  proxyUsername: z.string().optional(),
  proxyPassword: z.string().optional(),
  customHeaders: z.record(z.string()).optional(),
  skipTlsVerify: z.boolean().optional(),
  customCaCert: z.string().optional(),
  healthCheckEnabled: z.boolean().optional(),
  healthCheckInterval: z.number().int().min(10000).optional(),
  metadata: z.record(z.unknown()).optional(),
  notes: z.string().optional(),
}).passthrough();

const updateProviderSchema = createProviderSchema.partial().extend({
  id: z.number().int(),
});

const createModelSchema = z.object({
  providerId: z.number().int(),
  modelId: z.string().min(1),
  name: z.string().min(1),
  description: z.string().optional(),
  modelType: z.enum(['chat', 'completion', 'embedding', 'vision', 'multimodal']).optional(),
  isEnabled: z.boolean().optional(),
  isDefault: z.boolean().optional(),
  contextLength: z.number().int().optional(),
  maxOutputTokens: z.number().int().optional(),
  defaultTemperature: z.number().min(0).max(2).optional(),
  defaultMaxTokens: z.number().int().optional(),
  defaultTopP: z.number().min(0).max(1).optional(),
  defaultTopK: z.number().int().optional(),
  supportsVision: z.boolean().optional(),
  supportsFunctionCalling: z.boolean().optional(),
  supportsJsonMode: z.boolean().optional(),
  supportsStreaming: z.boolean().optional(),
  inputPricePer1M: z.number().optional(),
  outputPricePer1M: z.number().optional(),
  metadata: z.record(z.unknown()).optional(),
});

// =============================================================================
// PUBLIC ROUTES (for getting available providers/models in chat)
// =============================================================================

// Get active providers (minimal info for chat UI)
router.get('/active', authenticateToken, asyncHandler(async (req: AuthRequest, res: Response) => {
  const providers = await llmService.getProviders(false);

  // Return minimal info without sensitive data
  const publicProviders = providers.map(p => ({
    id: p.id,
    name: p.name,
    displayName: p.displayName,
    isDefault: p.isDefault,
    defaultModel: p.defaultModel,
    supportsVision: p.supportsVision,
    supportsStreaming: p.supportsStreaming,
    models: p.models?.filter(m => m.isEnabled).map(m => ({
      id: m.id,
      modelId: m.modelId,
      name: m.name,
      isDefault: m.isDefault,
      contextLength: m.contextLength,
      supportsVision: m.supportsVision,
    })),
  }));

  res.json({ success: true, data: publicProviders });
}));

// =============================================================================
// ADMIN ROUTES
// =============================================================================

// All subsequent routes require admin
router.use(authenticateToken, requireAdmin);

// =============================================================================
// PROVIDER MANAGEMENT
// =============================================================================

// Get all providers (with full details)
router.get('/providers', asyncHandler(async (req: AuthRequest, res: Response) => {
  const includeDisabled = req.query.includeDisabled === 'true';
  const providers = await llmService.getProviders(includeDisabled);

  // Mask sensitive fields in response
  const maskedProviders = providers.map(p => ({
    ...p,
    apiKey: p.apiKey ? '••••••••' : null,
    proxyPassword: p.proxyPassword ? '••••••••' : null,
    customCaCert: p.customCaCert ? '••••••••' : null,
  }));

  res.json({ success: true, data: maskedProviders });
}));

// Get single provider
router.get('/providers/:nameOrId', asyncHandler(async (req: AuthRequest, res: Response) => {
  const nameOrId = isNaN(Number(req.params.nameOrId))
    ? req.params.nameOrId
    : Number(req.params.nameOrId);

  const provider = await llmService.getProvider(nameOrId);

  if (!provider) {
    return res.status(404).json({ success: false, error: 'Provider not found' });
  }

  res.json({
    success: true,
    data: {
      ...provider,
      apiKey: provider.apiKey ? '••••••••' : null,
      proxyPassword: provider.proxyPassword ? '••••••••' : null,
      customCaCert: provider.customCaCert ? '••••••••' : null,
    },
  });
}));

// Create provider
router.post('/providers', asyncHandler(async (req: AuthRequest, res: Response) => {
  const data = createProviderSchema.parse(req.body);
  const provider = await llmService.createProvider(data as any);

  res.status(201).json({
    success: true,
    data: {
      ...provider,
      apiKey: provider.apiKey ? '••••••••' : null,
      proxyPassword: provider.proxyPassword ? '••••••••' : null,
      customCaCert: provider.customCaCert ? '••••••••' : null,
    },
  });
}));

// Update provider
router.put('/providers/:id', asyncHandler(async (req: AuthRequest, res: Response) => {
  const id = Number(req.params.id);
  const data = updateProviderSchema.parse({ ...req.body, id });
  const provider = await llmService.updateProvider(data as any);

  res.json({
    success: true,
    data: {
      ...provider,
      apiKey: provider.apiKey ? '••••••••' : null,
      proxyPassword: provider.proxyPassword ? '••••••••' : null,
      customCaCert: provider.customCaCert ? '••••••••' : null,
    },
  });
}));

// Delete provider
router.delete('/providers/:id', asyncHandler(async (req: AuthRequest, res: Response) => {
  const id = Number(req.params.id);
  await llmService.deleteProvider(id);
  res.json({ success: true, message: 'Provider deleted' });
}));

// Test provider connection
router.post('/providers/:nameOrId/test', asyncHandler(async (req: AuthRequest, res: Response) => {
  const nameOrId = isNaN(Number(req.params.nameOrId))
    ? req.params.nameOrId
    : Number(req.params.nameOrId);

  const result = await llmService.testProvider(nameOrId);
  res.json({ success: true, data: result });
}));

// Set provider as default
router.post('/providers/:id/set-default', asyncHandler(async (req: AuthRequest, res: Response) => {
  const id = Number(req.params.id);
  const provider = await llmService.updateProvider({ id, isDefault: true });

  res.json({
    success: true,
    data: {
      ...provider,
      apiKey: provider.apiKey ? '••••••••' : null,
      proxyPassword: provider.proxyPassword ? '••••••••' : null,
      customCaCert: provider.customCaCert ? '••••••••' : null,
    },
  });
}));

// Enable/disable provider
router.post('/providers/:id/toggle', asyncHandler(async (req: AuthRequest, res: Response) => {
  const id = Number(req.params.id);
  const currentProvider = await llmService.getProvider(id);

  if (!currentProvider) {
    return res.status(404).json({ success: false, error: 'Provider not found' });
  }

  const provider = await llmService.updateProvider({
    id,
    isEnabled: !currentProvider.isEnabled,
  });

  res.json({
    success: true,
    data: {
      ...provider,
      apiKey: provider.apiKey ? '••••••••' : null,
      proxyPassword: provider.proxyPassword ? '••••••••' : null,
      customCaCert: provider.customCaCert ? '••••••••' : null,
    },
  });
}));

// =============================================================================
// MODEL MANAGEMENT
// =============================================================================

// Get all models
router.get('/models', asyncHandler(async (req: AuthRequest, res: Response) => {
  const providerId = req.query.providerId ? Number(req.query.providerId) : undefined;
  const models = await llmService.getModels(providerId);
  res.json({ success: true, data: models });
}));

// Create model
router.post('/models', asyncHandler(async (req: AuthRequest, res: Response) => {
  const data = createModelSchema.parse(req.body);
  const model = await llmService.createModel(data);
  res.status(201).json({ success: true, data: model });
}));

// Delete model
router.delete('/models/:id', asyncHandler(async (req: AuthRequest, res: Response) => {
  const id = Number(req.params.id);
  await llmService.deleteModel(id);
  res.json({ success: true, message: 'Model deleted' });
}));

// Seed common models for a provider
router.post('/providers/:id/seed-models', asyncHandler(async (req: AuthRequest, res: Response) => {
  const id = Number(req.params.id);
  const provider = await llmService.getProvider(id);

  if (!provider) {
    return res.status(404).json({ success: false, error: 'Provider not found' });
  }

  await llmService.seedCommonModels(id, provider.name as LLMProviderName);
  const models = await llmService.getModels(id);

  res.json({ success: true, data: models });
}));

// =============================================================================
// PROVIDER DEFAULTS & COMMON MODELS
// =============================================================================

// Get provider defaults
router.get('/defaults', asyncHandler(async (req: AuthRequest, res: Response) => {
  res.json({ success: true, data: PROVIDER_DEFAULTS });
}));

// Get common models for a provider
router.get('/defaults/:providerName/models', asyncHandler(async (req: AuthRequest, res: Response) => {
  const providerName = req.params.providerName as LLMProviderName;
  const models = COMMON_MODELS[providerName] || [];
  res.json({ success: true, data: models });
}));

// =============================================================================
// LOCAL PROVIDER UTILITIES
// =============================================================================

// Helper to sanitize error messages for production
const sanitizeErrorMessage = (error: any, defaultMessage: string): string => {
  // In production, don't expose internal error details
  if (process.env.NODE_ENV === 'production') {
    return defaultMessage;
  }
  return error.message || defaultMessage;
};

// Get Ollama models
router.get('/ollama/models', asyncHandler(async (req: AuthRequest, res: Response) => {
  const baseUrl = req.query.baseUrl as string | undefined;

  try {
    const models = await llmService.getOllamaModels(baseUrl);
    res.json({ success: true, data: models });
  } catch (error: any) {
    res.json({
      success: false,
      error: sanitizeErrorMessage(error, 'Failed to connect to Ollama. Please check if the service is running.'),
      data: [],
    });
  }
}));

// Pull Ollama model
router.post('/ollama/pull', asyncHandler(async (req: AuthRequest, res: Response) => {
  const { modelName, baseUrl } = req.body;

  if (!modelName) {
    return res.status(400).json({ success: false, error: 'Model name required' });
  }

  try {
    await llmService.pullOllamaModel(modelName, baseUrl);
    res.json({ success: true, message: `Started pulling model: ${modelName}` });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: sanitizeErrorMessage(error, 'Failed to pull model. Please check if Ollama is running.'),
    });
  }
}));

// Get LM Studio models
router.get('/lmstudio/models', asyncHandler(async (req: AuthRequest, res: Response) => {
  const baseUrl = req.query.baseUrl as string | undefined;

  try {
    const models = await llmService.getLMStudioModels(baseUrl);
    res.json({ success: true, data: models });
  } catch (error: any) {
    res.json({
      success: false,
      error: sanitizeErrorMessage(error, 'Failed to connect to LM Studio. Please check if the service is running.'),
      data: [],
    });
  }
}));

// =============================================================================
// SEEDING
// =============================================================================

// Seed default providers
router.post('/seed', asyncHandler(async (req: AuthRequest, res: Response) => {
  await llmService.seedDefaultProviders();
  const providers = await llmService.getProviders(true);

  res.json({
    success: true,
    message: 'Default providers seeded',
    data: providers.map(p => ({
      ...p,
      apiKey: p.apiKey ? '••••••••' : null,
      proxyPassword: p.proxyPassword ? '••••••••' : null,
      customCaCert: p.customCaCert ? '••••••••' : null,
    })),
  });
}));

// =============================================================================
// QUICK CHAT (for testing)
// =============================================================================

// Test chat endpoint
router.post('/chat/test', asyncHandler(async (req: AuthRequest, res: Response) => {
  const { message, provider, model } = req.body;

  if (!message) {
    return res.status(400).json({ success: false, error: 'Message required' });
  }

  const response = await llmService.chat({
    messages: [{ role: 'user', content: message }],
    provider,
    model,
  });

  res.json({ success: true, data: response });
}));

export default router;
