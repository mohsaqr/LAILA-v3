import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import express from 'express';
import request from 'supertest';

// Mock the services and middleware before importing the router
vi.mock('../services/tutor.service.js', () => ({
  tutorService: {
    getOrCreateSession: vi.fn(),
    updateMode: vi.fn(),
    setActiveAgent: vi.fn(),
    getConversations: vi.fn(),
    getOrCreateConversation: vi.fn(),
    clearConversation: vi.fn(),
    sendMessage: vi.fn(),
    getAvailableAgents: vi.fn(),
    getInteractionLogs: vi.fn(),
  },
}));

vi.mock('../middleware/auth.middleware.js', () => ({
  authenticateToken: (req: any, res: any, next: any) => {
    req.user = { id: 1, email: 'test@test.com', fullname: 'Test User', isAdmin: false, isInstructor: false };
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

import { tutorService } from '../services/tutor.service.js';
import tutorRoutes from './tutor.routes.js';

// Create test app
const createTestApp = (isAdmin = false) => {
  const app = express();
  app.use(express.json());

  // Override auth middleware for admin tests
  if (isAdmin) {
    app.use((req: any, res, next) => {
      req.user = { id: 1, email: 'admin@test.com', fullname: 'Admin User', isAdmin: true, isInstructor: true };
      next();
    });
  }

  app.use('/api/tutors', tutorRoutes);
  return app;
};

describe('Tutor Routes', () => {
  let app: express.Application;

  beforeEach(() => {
    app = createTestApp();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ==========================================================================
  // SESSION ENDPOINTS
  // ==========================================================================

  describe('GET /api/tutors/session', () => {
    it('should return session data for authenticated user', async () => {
      const mockSessionData = {
        session: { id: 1, userId: 1, mode: 'manual' },
        conversations: [],
        agents: [{ id: 1, name: 'socratic-tutor', displayName: 'Socratic Guide' }],
      };

      vi.mocked(tutorService.getOrCreateSession).mockResolvedValue(mockSessionData);

      const response = await request(app)
        .get('/api/tutors/session')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.session.mode).toBe('manual');
      expect(tutorService.getOrCreateSession).toHaveBeenCalledWith(1);
    });
  });

  describe('PUT /api/tutors/session/mode', () => {
    it('should update session mode', async () => {
      const mockSession = { id: 1, userId: 1, mode: 'router' };
      vi.mocked(tutorService.updateMode).mockResolvedValue(mockSession);

      const response = await request(app)
        .put('/api/tutors/session/mode')
        .send({ mode: 'router' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.mode).toBe('router');
      expect(tutorService.updateMode).toHaveBeenCalledWith(1, 'router');
    });

    it('should reject invalid mode', async () => {
      const response = await request(app)
        .put('/api/tutors/session/mode')
        .send({ mode: 'invalid' })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Invalid mode');
    });

    it('should reject missing mode', async () => {
      const response = await request(app)
        .put('/api/tutors/session/mode')
        .send({})
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe('PUT /api/tutors/session/active-agent', () => {
    it('should set active agent', async () => {
      const mockSession = { id: 1, userId: 1, mode: 'manual', activeAgentId: 5 };
      vi.mocked(tutorService.setActiveAgent).mockResolvedValue(mockSession);

      const response = await request(app)
        .put('/api/tutors/session/active-agent')
        .send({ chatbotId: 5 })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(tutorService.setActiveAgent).toHaveBeenCalledWith(1, 5);
    });

    it('should reject missing chatbotId', async () => {
      const response = await request(app)
        .put('/api/tutors/session/active-agent')
        .send({})
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  // ==========================================================================
  // CONVERSATION ENDPOINTS
  // ==========================================================================

  describe('GET /api/tutors/conversations', () => {
    it('should return all conversations', async () => {
      const mockConversations = [
        { id: 1, chatbotId: 1, messageCount: 5 },
        { id: 2, chatbotId: 2, messageCount: 3 },
      ];
      vi.mocked(tutorService.getConversations).mockResolvedValue(mockConversations);

      const response = await request(app)
        .get('/api/tutors/conversations')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(2);
    });
  });

  describe('GET /api/tutors/conversations/:chatbotId', () => {
    it('should return conversation with messages', async () => {
      const mockConversation = {
        id: 1,
        chatbotId: 5,
        messages: [
          { id: 1, role: 'user', content: 'Hello' },
          { id: 2, role: 'assistant', content: 'Hi there!' },
        ],
      };
      vi.mocked(tutorService.getOrCreateConversation).mockResolvedValue(mockConversation);

      const response = await request(app)
        .get('/api/tutors/conversations/5')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.messages).toHaveLength(2);
    });
  });

  describe('DELETE /api/tutors/conversations/:chatbotId', () => {
    it('should clear conversation', async () => {
      vi.mocked(tutorService.clearConversation).mockResolvedValue(undefined);

      const response = await request(app)
        .delete('/api/tutors/conversations/5')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Conversation cleared');
      expect(tutorService.clearConversation).toHaveBeenCalledWith(1, 5);
    });
  });

  // ==========================================================================
  // MESSAGING ENDPOINTS
  // ==========================================================================

  describe('POST /api/tutors/conversations/:chatbotId/message', () => {
    it('should send message and return response', async () => {
      const mockResponse = {
        userMessage: { id: 1, role: 'user', content: 'Hello' },
        assistantMessage: { id: 2, role: 'assistant', content: 'Hi! How can I help?' },
        model: 'gpt-4o-mini',
        responseTimeMs: 1500,
      };
      vi.mocked(tutorService.sendMessage).mockResolvedValue(mockResponse);

      const response = await request(app)
        .post('/api/tutors/conversations/5/message')
        .send({ message: 'Hello' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.assistantMessage.content).toBe('Hi! How can I help?');
      expect(tutorService.sendMessage).toHaveBeenCalledWith(
        1,
        5,
        'Hello',
        expect.any(Object)
      );
    });

    it('should reject empty message', async () => {
      const response = await request(app)
        .post('/api/tutors/conversations/5/message')
        .send({ message: '' })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Message is required');
    });

    it('should reject missing message', async () => {
      const response = await request(app)
        .post('/api/tutors/conversations/5/message')
        .send({})
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  // ==========================================================================
  // AGENT ENDPOINTS
  // ==========================================================================

  describe('GET /api/tutors/agents', () => {
    it('should return available agents', async () => {
      const mockAgents = [
        { id: 1, name: 'socratic-tutor', displayName: 'Socratic Guide' },
        { id: 2, name: 'helper-tutor', displayName: 'Helpful Guide' },
        { id: 3, name: 'beatrice-peer', displayName: 'Beatrice' },
      ];
      vi.mocked(tutorService.getAvailableAgents).mockResolvedValue(mockAgents);

      const response = await request(app)
        .get('/api/tutors/agents')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(3);
      expect(response.body.data[0].displayName).toBe('Socratic Guide');
    });
  });

  // ==========================================================================
  // ADMIN ENDPOINTS
  // ==========================================================================

  describe('GET /api/tutors/logs (Admin)', () => {
    it('should reject non-admin user', async () => {
      const response = await request(app)
        .get('/api/tutors/logs')
        .expect(403);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Admin');
    });
  });

  // ==========================================================================
  // ERROR HANDLING
  // ==========================================================================

  describe('Error Handling', () => {
    it('should handle invalid chatbotId by returning 400', async () => {
      // Route validates chatbotId as number
      const response = await request(app)
        .get('/api/tutors/conversations/invalid')
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Invalid');
    });
  });
});
