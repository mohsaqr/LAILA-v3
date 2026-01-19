import { Router, Response } from 'express';
import { chatService } from '../services/chat.service.js';
import { authenticateToken, optionalAuth } from '../middleware/auth.middleware.js';
import { asyncHandler } from '../middleware/error.middleware.js';
import { chatMessageSchema } from '../utils/validation.js';
import { AuthRequest } from '../types/index.js';

const router = Router();

// Send chat message
router.post('/', optionalAuth, asyncHandler(async (req: AuthRequest, res: Response) => {
  const data = chatMessageSchema.parse(req.body);
  const result = await chatService.chat(data, req.user?.id);
  res.json({ success: true, data: result });
}));

// Get chat history by session
router.get('/session/:sessionId', authenticateToken, asyncHandler(async (req: AuthRequest, res: Response) => {
  const { sessionId } = req.params;
  const limit = parseInt(req.query.limit as string) || 50;

  const history = await chatService.getChatHistory(sessionId, limit);
  res.json({ success: true, data: history });
}));

// Get user's chat history
router.get('/history', authenticateToken, asyncHandler(async (req: AuthRequest, res: Response) => {
  const module = req.query.module as string;
  const limit = parseInt(req.query.limit as string) || 100;

  const history = await chatService.getUserChatHistory(req.user!.id, module, limit);
  res.json({ success: true, data: history });
}));

// Data analysis endpoint
router.post('/analyze', optionalAuth, asyncHandler(async (req: AuthRequest, res: Response) => {
  const { data, prompt } = req.body;

  if (!data || !prompt) {
    res.status(400).json({ success: false, error: 'Data and prompt are required' });
    return;
  }

  const result = await chatService.analyzeData(data, prompt, req.user?.id);
  res.json({ success: true, data: result });
}));

// Get AI configuration (for UI)
router.get('/config', authenticateToken, asyncHandler(async (req: AuthRequest, res: Response) => {
  const config = await chatService.getAIConfig();
  res.json({
    success: true,
    data: config ? {
      provider: config.provider,
      model: config.model,
      available: true,
    } : {
      available: false,
    }
  });
}));

export default router;
