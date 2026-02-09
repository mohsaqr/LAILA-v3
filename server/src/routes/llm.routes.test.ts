import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import { ZodError } from 'zod';

// Mock services and middleware
vi.mock('../services/llm.service.js', () => ({
  llmService: {
    getProviders: vi.fn(),
    getProvider: vi.fn(),
    createProvider: vi.fn(),
    updateProvider: vi.fn(),
    deleteProvider: vi.fn(),
    testProvider: vi.fn(),
    getModels: vi.fn(),
    createModel: vi.fn(),
    deleteModel: vi.fn(),
    seedCommonModels: vi.fn(),
    getOllamaModels: vi.fn(),
    pullOllamaModel: vi.fn(),
    getLMStudioModels: vi.fn(),
    seedDefaultProviders: vi.fn(),
    chat: vi.fn(),
  },
}));

vi.mock('../middleware/auth.middleware.js', () => ({
  authenticateToken: (req: any, res: any, next: any) => {
    req.user = { id: 1, email: 'admin@test.com', fullname: 'Admin User', isAdmin: true, isInstructor: true };
    next();
  },
  requireAdmin: (req: any, res: any, next: any) => {
    if (req.user?.isAdmin) {
      next();
    } else {
      res.status(403).json({ success: false, error: 'Admin access required' });
    }
  },
}));

import { llmService } from '../services/llm.service.js';
import llmRoutes from './llm.routes.js';

// Create test app helper
const createTestApp = (isAdmin = true) => {
  const app = express();
  app.use(express.json());

  // Override user
  app.use((req: any, res, next) => {
    req.user = { id: 1, email: 'user@test.com', fullname: 'User', isAdmin, isInstructor: isAdmin };
    next();
  });

  app.use('/api/llm', llmRoutes);

  // Error handler
  app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    if (err instanceof ZodError) {
      return res.status(400).json({
        success: false,
        error: err.errors.map(e => e.message).join(', '),
      });
    }
    const statusCode = err.statusCode || 500;
    res.status(statusCode).json({
      success: false,
      error: err.message || 'Internal server error',
    });
  });

  return app;
};

describe('LLM Routes', () => {
  let app: express.Application;

  beforeEach(() => {
    app = createTestApp();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ===========================================================================
  // PUBLIC ROUTES
  // ===========================================================================

  describe('GET /api/llm/active', () => {
    it('should return active providers with minimal info', async () => {
      const mockProviders = [
        {
          id: 1,
          name: 'openai',
          displayName: 'OpenAI',
          isDefault: true,
          defaultModel: 'gpt-4o-mini',
          supportsVision: true,
          supportsStreaming: true,
          models: [
            { id: 1, modelId: 'gpt-4o-mini', name: 'GPT-4o Mini', isEnabled: true, isDefault: true },
          ],
        },
      ];
      vi.mocked(llmService.getProviders).mockResolvedValue(mockProviders as any);

      const response = await request(app)
        .get('/api/llm/active')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].name).toBe('openai');
      expect(llmService.getProviders).toHaveBeenCalledWith(false);
    });
  });

  // ===========================================================================
  // PROVIDER MANAGEMENT (Admin)
  // ===========================================================================

  describe('GET /api/llm/providers', () => {
    it('should return all providers with masked sensitive fields', async () => {
      const mockProviders = [
        { id: 1, name: 'openai', apiKey: 'sk-secret', proxyPassword: 'secret', customCaCert: 'cert' },
      ];
      vi.mocked(llmService.getProviders).mockResolvedValue(mockProviders as any);

      const response = await request(app)
        .get('/api/llm/providers')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data[0].apiKey).toBe('••••••••');
      expect(response.body.data[0].proxyPassword).toBe('••••••••');
    });

    it('should include disabled providers when requested', async () => {
      vi.mocked(llmService.getProviders).mockResolvedValue([]);

      await request(app)
        .get('/api/llm/providers?includeDisabled=true')
        .expect(200);

      expect(llmService.getProviders).toHaveBeenCalledWith(true);
    });
  });

  describe('GET /api/llm/providers/:nameOrId', () => {
    it('should return provider by id', async () => {
      const mockProvider = { id: 1, name: 'openai', apiKey: 'secret' };
      vi.mocked(llmService.getProvider).mockResolvedValue(mockProvider as any);

      const response = await request(app)
        .get('/api/llm/providers/1')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.apiKey).toBe('••••••••');
      expect(llmService.getProvider).toHaveBeenCalledWith(1);
    });

    it('should return provider by name', async () => {
      const mockProvider = { id: 1, name: 'openai', apiKey: null };
      vi.mocked(llmService.getProvider).mockResolvedValue(mockProvider as any);

      const response = await request(app)
        .get('/api/llm/providers/openai')
        .expect(200);

      expect(response.body.data.apiKey).toBeNull();
      expect(llmService.getProvider).toHaveBeenCalledWith('openai');
    });

    it('should return 404 if not found', async () => {
      vi.mocked(llmService.getProvider).mockResolvedValue(null);

      const response = await request(app)
        .get('/api/llm/providers/999')
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('not found');
    });
  });

  describe('POST /api/llm/providers', () => {
    it('should create provider', async () => {
      const mockProvider = { id: 1, name: 'new-provider', apiKey: 'secret' };
      vi.mocked(llmService.createProvider).mockResolvedValue(mockProvider as any);

      const response = await request(app)
        .post('/api/llm/providers')
        .send({ name: 'new-provider', apiKey: 'secret' })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.apiKey).toBe('••••••••');
    });

    it('should validate required fields', async () => {
      const response = await request(app)
        .post('/api/llm/providers')
        .send({})
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe('PUT /api/llm/providers/:id', () => {
    it('should update provider', async () => {
      const mockProvider = { id: 1, name: 'openai', displayName: 'Updated', apiKey: 'secret' };
      vi.mocked(llmService.updateProvider).mockResolvedValue(mockProvider as any);

      const response = await request(app)
        .put('/api/llm/providers/1')
        .send({ displayName: 'Updated' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.displayName).toBe('Updated');
    });
  });

  describe('DELETE /api/llm/providers/:id', () => {
    it('should delete provider', async () => {
      vi.mocked(llmService.deleteProvider).mockResolvedValue(undefined);

      const response = await request(app)
        .delete('/api/llm/providers/1')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Provider deleted');
    });
  });

  describe('POST /api/llm/providers/:nameOrId/test', () => {
    it('should test provider connection', async () => {
      vi.mocked(llmService.testProvider).mockResolvedValue({
        success: true,
        message: 'Connection successful',
        responseTime: 500,
      } as any);

      const response = await request(app)
        .post('/api/llm/providers/openai/test')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.success).toBe(true);
    });
  });

  describe('POST /api/llm/providers/:id/set-default', () => {
    it('should set provider as default', async () => {
      const mockProvider = { id: 1, name: 'openai', isDefault: true, apiKey: null };
      vi.mocked(llmService.updateProvider).mockResolvedValue(mockProvider as any);

      const response = await request(app)
        .post('/api/llm/providers/1/set-default')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.isDefault).toBe(true);
    });
  });

  describe('POST /api/llm/providers/:id/toggle', () => {
    it('should toggle provider enabled state', async () => {
      vi.mocked(llmService.getProvider).mockResolvedValue({ id: 1, isEnabled: true } as any);
      vi.mocked(llmService.updateProvider).mockResolvedValue({ id: 1, isEnabled: false, apiKey: null } as any);

      const response = await request(app)
        .post('/api/llm/providers/1/toggle')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.isEnabled).toBe(false);
      expect(llmService.updateProvider).toHaveBeenCalledWith({ id: 1, isEnabled: false });
    });

    it('should return 404 if provider not found', async () => {
      vi.mocked(llmService.getProvider).mockResolvedValue(null);

      const response = await request(app)
        .post('/api/llm/providers/999/toggle')
        .expect(404);

      expect(response.body.error).toContain('not found');
    });
  });

  // ===========================================================================
  // MODEL MANAGEMENT
  // ===========================================================================

  describe('GET /api/llm/models', () => {
    it('should return all models', async () => {
      const mockModels = [
        { id: 1, modelId: 'gpt-4o-mini', name: 'GPT-4o Mini' },
        { id: 2, modelId: 'gpt-4o', name: 'GPT-4o' },
      ];
      vi.mocked(llmService.getModels).mockResolvedValue(mockModels as any);

      const response = await request(app)
        .get('/api/llm/models')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(2);
    });

    it('should filter by providerId', async () => {
      vi.mocked(llmService.getModels).mockResolvedValue([]);

      await request(app)
        .get('/api/llm/models?providerId=1')
        .expect(200);

      expect(llmService.getModels).toHaveBeenCalledWith(1);
    });
  });

  describe('POST /api/llm/models', () => {
    it('should create model', async () => {
      const mockModel = { id: 1, modelId: 'custom-model', name: 'Custom Model' };
      vi.mocked(llmService.createModel).mockResolvedValue(mockModel as any);

      const response = await request(app)
        .post('/api/llm/models')
        .send({ providerId: 1, modelId: 'custom-model', name: 'Custom Model' })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.modelId).toBe('custom-model');
    });
  });

  describe('DELETE /api/llm/models/:id', () => {
    it('should delete model', async () => {
      vi.mocked(llmService.deleteModel).mockResolvedValue(undefined);

      const response = await request(app)
        .delete('/api/llm/models/1')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Model deleted');
    });
  });

  describe('POST /api/llm/providers/:id/seed-models', () => {
    it('should seed common models', async () => {
      vi.mocked(llmService.getProvider).mockResolvedValue({ id: 1, name: 'openai' } as any);
      vi.mocked(llmService.seedCommonModels).mockResolvedValue(undefined);
      vi.mocked(llmService.getModels).mockResolvedValue([
        { id: 1, modelId: 'gpt-4o-mini', name: 'GPT-4o Mini' },
      ] as any);

      const response = await request(app)
        .post('/api/llm/providers/1/seed-models')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(llmService.seedCommonModels).toHaveBeenCalledWith(1, 'openai');
    });

    it('should return 404 if provider not found', async () => {
      vi.mocked(llmService.getProvider).mockResolvedValue(null);

      const response = await request(app)
        .post('/api/llm/providers/999/seed-models')
        .expect(404);

      expect(response.body.error).toContain('not found');
    });
  });

  // ===========================================================================
  // LOCAL PROVIDER UTILITIES
  // ===========================================================================

  describe('GET /api/llm/ollama/models', () => {
    it('should return Ollama models', async () => {
      const mockModels = [
        { name: 'llama2', size: 3800000000 },
        { name: 'mistral', size: 4100000000 },
      ];
      vi.mocked(llmService.getOllamaModels).mockResolvedValue(mockModels as any);

      const response = await request(app)
        .get('/api/llm/ollama/models')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(2);
    });

    it('should handle connection error', async () => {
      vi.mocked(llmService.getOllamaModels).mockRejectedValue(new Error('Connection refused'));

      const response = await request(app)
        .get('/api/llm/ollama/models')
        .expect(200);

      expect(response.body.success).toBe(false);
      expect(response.body.data).toEqual([]);
    });

    it('should return error message when getOllamaModels fails', async () => {
      vi.mocked(llmService.getOllamaModels).mockRejectedValue(new Error('Internal database error - sensitive info'));

      const response = await request(app)
        .get('/api/llm/ollama/models')
        .expect(200);

      expect(response.body.success).toBe(false);
      // Route returns the error message directly
      expect(response.body.error).toBe('Internal database error - sensitive info');
      expect(response.body.data).toEqual([]);
    });
  });

  describe('POST /api/llm/ollama/pull', () => {
    it('should pull Ollama model', async () => {
      vi.mocked(llmService.pullOllamaModel).mockResolvedValue(undefined);

      const response = await request(app)
        .post('/api/llm/ollama/pull')
        .send({ modelName: 'llama2' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('llama2');
    });

    it('should return 400 if modelName missing', async () => {
      const response = await request(app)
        .post('/api/llm/ollama/pull')
        .send({})
        .expect(400);

      expect(response.body.error).toContain('Model name required');
    });

    it('should return 500 when pull fails', async () => {
      vi.mocked(llmService.pullOllamaModel).mockRejectedValue(new Error('Pull failed'));

      const response = await request(app)
        .post('/api/llm/ollama/pull')
        .send({ modelName: 'llama2' })
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Pull failed');
    });
  });

  describe('GET /api/llm/lmstudio/models', () => {
    it('should return LM Studio models', async () => {
      const mockModels = [{ id: 'local-model-1' }];
      vi.mocked(llmService.getLMStudioModels).mockResolvedValue(mockModels as any);

      const response = await request(app)
        .get('/api/llm/lmstudio/models')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(1);
    });

    it('should handle connection error', async () => {
      vi.mocked(llmService.getLMStudioModels).mockRejectedValue(new Error('Connection refused'));

      const response = await request(app)
        .get('/api/llm/lmstudio/models')
        .expect(200);

      expect(response.body.success).toBe(false);
      expect(response.body.data).toEqual([]);
    });
  });

  // ===========================================================================
  // SEEDING & CHAT
  // ===========================================================================

  describe('POST /api/llm/seed', () => {
    it('should seed default providers', async () => {
      vi.mocked(llmService.seedDefaultProviders).mockResolvedValue(undefined);
      vi.mocked(llmService.getProviders).mockResolvedValue([
        { id: 1, name: 'openai', apiKey: 'secret' },
      ] as any);

      const response = await request(app)
        .post('/api/llm/seed')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Default providers seeded');
      expect(response.body.data[0].apiKey).toBe('••••••••');
    });
  });

  describe('POST /api/llm/chat/test', () => {
    it('should test chat', async () => {
      vi.mocked(llmService.chat).mockResolvedValue({
        content: 'Hello! How can I help?',
        model: 'gpt-4o-mini',
        usage: { totalTokens: 50 },
      } as any);

      const response = await request(app)
        .post('/api/llm/chat/test')
        .send({ message: 'Hello' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.content).toBe('Hello! How can I help?');
    });

    it('should return 400 if message missing', async () => {
      const response = await request(app)
        .post('/api/llm/chat/test')
        .send({})
        .expect(400);

      expect(response.body.error).toContain('Message required');
    });
  });

  // ===========================================================================
  // DEFAULTS
  // ===========================================================================

  describe('GET /api/llm/defaults', () => {
    it('should return provider defaults', async () => {
      const response = await request(app)
        .get('/api/llm/defaults')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
    });
  });

  describe('GET /api/llm/defaults/:providerName/models', () => {
    it('should return common models for provider', async () => {
      const response = await request(app)
        .get('/api/llm/defaults/openai/models')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
    });
  });
});
