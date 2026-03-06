import { Router, Response } from 'express';
import { chatbotService } from '../services/chatbot.service.js';
import { authenticateToken, requireAdmin, requireInstructor, optionalAuth } from '../middleware/auth.middleware.js';
import { asyncHandler } from '../middleware/error.middleware.js';
import { createChatbotSchema, updateChatbotSchema } from '../utils/validation.js';
import { AuthRequest } from '../types/index.js';

const router = Router();

// Get all chatbots (authenticated - protects system prompts)
router.get('/', authenticateToken, asyncHandler(async (req: AuthRequest, res: Response) => {
  const includeInactive = req.query.includeInactive === 'true';
  const chatbots = await chatbotService.getChatbots(
    includeInactive,
    req.user!.id,
    req.user!.isAdmin,
    req.user!.isInstructor,
  );
  res.json({ success: true, data: chatbots });
}));

// Get chatbot by name (authenticated - protects system prompts)
router.get('/name/:name', authenticateToken, asyncHandler(async (req: AuthRequest, res: Response) => {
  const chatbot = await chatbotService.getChatbotByName(req.params.name);
  res.json({ success: true, data: chatbot });
}));

// Get chatbot by ID (authenticated - protects system prompts)
router.get('/:id', authenticateToken, asyncHandler(async (req: AuthRequest, res: Response) => {
  const id = parseInt(req.params.id);
  const chatbot = await chatbotService.getChatbotById(id);
  res.json({ success: true, data: chatbot });
}));

// Create chatbot (admins and instructors)
router.post('/', authenticateToken, requireInstructor, asyncHandler(async (req: AuthRequest, res: Response) => {
  const data = createChatbotSchema.parse(req.body);
  // Instructors store their userId as creatorId; admins create with no creatorId (admin-owned)
  const creatorId = req.user!.isAdmin ? undefined : req.user!.id;
  const chatbot = await chatbotService.createChatbot(data, creatorId);
  res.status(201).json({ success: true, data: chatbot });
}));

// Update chatbot (admins can edit any; instructors can only edit their own)
router.put('/:id', authenticateToken, requireInstructor, asyncHandler(async (req: AuthRequest, res: Response) => {
  const id = parseInt(req.params.id);
  const data = updateChatbotSchema.parse(req.body);
  const chatbot = await chatbotService.updateChatbot(id, data, req.user!.id, req.user!.isAdmin);
  res.json({ success: true, data: chatbot });
}));

// Delete chatbot (admins can delete any non-system; instructors can only delete their own)
router.delete('/:id', authenticateToken, requireInstructor, asyncHandler(async (req: AuthRequest, res: Response) => {
  const id = parseInt(req.params.id);
  const result = await chatbotService.deleteChatbot(id, req.user!.id, req.user!.isAdmin);
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
