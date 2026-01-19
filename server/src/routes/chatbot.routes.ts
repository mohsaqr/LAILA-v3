import { Router, Response } from 'express';
import { chatbotService } from '../services/chatbot.service.js';
import { authenticateToken, requireAdmin, optionalAuth } from '../middleware/auth.middleware.js';
import { asyncHandler } from '../middleware/error.middleware.js';
import { createChatbotSchema, updateChatbotSchema } from '../utils/validation.js';
import { AuthRequest } from '../types/index.js';

const router = Router();

// Get all chatbots
router.get('/', asyncHandler(async (req: AuthRequest, res: Response) => {
  const includeInactive = req.query.includeInactive === 'true';
  const chatbots = await chatbotService.getChatbots(includeInactive);
  res.json({ success: true, data: chatbots });
}));

// Get chatbot by name
router.get('/name/:name', asyncHandler(async (req: AuthRequest, res: Response) => {
  const chatbot = await chatbotService.getChatbotByName(req.params.name);
  res.json({ success: true, data: chatbot });
}));

// Get chatbot by ID
router.get('/:id', asyncHandler(async (req: AuthRequest, res: Response) => {
  const id = parseInt(req.params.id);
  const chatbot = await chatbotService.getChatbotById(id);
  res.json({ success: true, data: chatbot });
}));

// Create chatbot (admin only)
router.post('/', authenticateToken, requireAdmin, asyncHandler(async (req: AuthRequest, res: Response) => {
  const data = createChatbotSchema.parse(req.body);
  const chatbot = await chatbotService.createChatbot(data);
  res.status(201).json({ success: true, data: chatbot });
}));

// Update chatbot (admin only)
router.put('/:id', authenticateToken, requireAdmin, asyncHandler(async (req: AuthRequest, res: Response) => {
  const id = parseInt(req.params.id);
  const data = updateChatbotSchema.parse(req.body);
  const chatbot = await chatbotService.updateChatbot(id, data);
  res.json({ success: true, data: chatbot });
}));

// Delete chatbot (admin only)
router.delete('/:id', authenticateToken, requireAdmin, asyncHandler(async (req: AuthRequest, res: Response) => {
  const id = parseInt(req.params.id);
  const result = await chatbotService.deleteChatbot(id);
  res.json({ success: true, ...result });
}));

// Chat with a specific chatbot
router.post('/:name/chat', optionalAuth, asyncHandler(async (req: AuthRequest, res: Response) => {
  const { name } = req.params;
  const { message, sessionId } = req.body;

  if (!message) {
    res.status(400).json({ success: false, error: 'Message is required' });
    return;
  }

  const result = await chatbotService.chatWithBot(name, message, sessionId, req.user?.id);
  res.json({ success: true, data: result });
}));

// Seed default chatbots (admin only)
router.post('/seed', authenticateToken, requireAdmin, asyncHandler(async (req: AuthRequest, res: Response) => {
  const result = await chatbotService.seedDefaultChatbots();
  res.json({ success: true, ...result });
}));

export default router;
