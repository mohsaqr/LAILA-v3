import prisma from '../utils/prisma.js';
import { AppError } from '../middleware/error.middleware.js';
import { chatService } from './chat.service.js';
import { activityLogService } from './activityLog.service.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('tutor');
import {
  TutorMode,
  TutorSessionData,
  TutorConversationData,
  TutorMessageData,
  TutorMessageResponse,
  ConversationWithPreview,
  TutorAgent,
  TutorSessionResponse,
  TutorInteractionLogData,
  RoutingInfo,
  CollaborativeInfo,
  CollaborativeSettings,
  CollaborativeStyle,
  AgentContribution,
} from '../types/tutor.types.js';

export class TutorService {
  // ==========================================================================
  // SESSION MANAGEMENT
  // ==========================================================================

  /**
   * Get or create tutor session for user
   * Creates session with default settings if doesn't exist
   */
  async getOrCreateSession(userId: number): Promise<TutorSessionResponse> {
    let session = await prisma.tutorSession.findUnique({
      where: { userId },
      include: {
        conversations: {
          include: {
            chatbot: {
              select: {
                id: true,
                name: true,
                displayName: true,
                description: true,
                avatarUrl: true,
                welcomeMessage: true,
                personality: true,
              },
            },
            messages: {
              orderBy: { createdAt: 'desc' },
              take: 1,
            },
          },
        },
      },
    });

    if (!session) {
      session = await prisma.tutorSession.create({
        data: {
          userId,
          mode: 'manual',
        },
        include: {
          conversations: {
            include: {
              chatbot: {
                select: {
                  id: true,
                  name: true,
                  displayName: true,
                  description: true,
                  avatarUrl: true,
                  welcomeMessage: true,
                  personality: true,
                },
              },
              messages: {
                orderBy: { createdAt: 'desc' },
                take: 1,
              },
            },
          },
        },
      });

      // Log session start
      await this.logInteraction({
        userId,
        sessionId: session.id,
        eventType: 'session_start',
        mode: 'manual',
      });

      // Log to unified activity log
      activityLogService.logActivity({
        userId,
        verb: 'started',
        objectType: 'tutor_session',
        objectId: session.id,
        objectTitle: 'AI Tutor Session',
        objectSubtype: 'manual',
        extensions: { mode: 'manual' },
      }).catch(err => logger.warn({ err }, 'Failed to log session start activity'));
    }

    // Get available agents
    const agents = await this.getAvailableAgents();

    // Transform conversations to include preview
    const conversations: ConversationWithPreview[] = session.conversations.map((conv) => ({
      id: conv.id,
      sessionId: conv.sessionId,
      chatbotId: conv.chatbotId,
      lastMessageAt: conv.lastMessageAt,
      messageCount: conv.messageCount,
      createdAt: conv.createdAt,
      chatbot: conv.chatbot,
      lastMessage: conv.messages[0]
        ? {
            role: conv.messages[0].role,
            content: conv.messages[0].content,
            createdAt: conv.messages[0].createdAt,
          }
        : null,
    }));

    return {
      session: {
        id: session.id,
        userId: session.userId,
        mode: session.mode as TutorMode,
        activeAgentId: session.activeAgentId,
        createdAt: session.createdAt,
        updatedAt: session.updatedAt,
      },
      conversations,
      agents,
    };
  }

  /**
   * Update session mode (manual/router/collaborative)
   */
  async updateMode(userId: number, mode: TutorMode): Promise<TutorSessionData> {
    const session = await prisma.tutorSession.update({
      where: { userId },
      data: { mode },
    });

    // Log mode change
    await this.logInteraction({
      userId,
      sessionId: session.id,
      eventType: 'mode_change',
      mode,
    });

    // Log to unified activity log
    activityLogService.logActivity({
      userId,
      verb: 'switched',
      objectType: 'tutor_session',
      objectId: session.id,
      objectTitle: `Mode: ${mode}`,
      objectSubtype: mode,
      extensions: { mode, previousMode: session.mode },
    }).catch(err => logger.warn({ err }, 'Failed to log mode change activity'));

    return {
      id: session.id,
      userId: session.userId,
      mode: session.mode as TutorMode,
      activeAgentId: session.activeAgentId,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
    };
  }

  /**
   * Set active agent for manual mode
   */
  async setActiveAgent(userId: number, chatbotId: number): Promise<TutorSessionData> {
    // Verify chatbot exists and is active
    const chatbot = await prisma.chatbot.findUnique({
      where: { id: chatbotId },
    });

    if (!chatbot || !chatbot.isActive) {
      throw new AppError('Agent not found or inactive', 404);
    }

    const session = await prisma.tutorSession.update({
      where: { userId },
      data: { activeAgentId: chatbotId },
    });

    // Log agent switch
    await this.logInteraction({
      userId,
      sessionId: session.id,
      eventType: 'agent_switch',
      chatbotId,
      chatbotName: chatbot.name,
      chatbotDisplayName: chatbot.displayName,
      mode: session.mode as TutorMode,
    });

    // Log to unified activity log
    activityLogService.logActivity({
      userId,
      verb: 'selected',
      objectType: 'tutor_agent',
      objectId: chatbotId,
      objectTitle: chatbot.displayName,
      objectSubtype: chatbot.personality || 'tutor',
      extensions: {
        agentName: chatbot.name,
        agentDisplayName: chatbot.displayName,
        sessionId: session.id,
        mode: session.mode,
      },
    }).catch(err => logger.warn({ err }, 'Failed to log agent switch activity'));

    return {
      id: session.id,
      userId: session.userId,
      mode: session.mode as TutorMode,
      activeAgentId: session.activeAgentId,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
    };
  }

  // ==========================================================================
  // CONVERSATION MANAGEMENT
  // ==========================================================================

  /**
   * Get all conversations for user with recent message preview
   */
  async getConversations(userId: number): Promise<ConversationWithPreview[]> {
    const session = await prisma.tutorSession.findUnique({
      where: { userId },
    });

    if (!session) {
      return [];
    }

    const conversations = await prisma.tutorConversation.findMany({
      where: { sessionId: session.id },
      include: {
        chatbot: {
          select: {
            id: true,
            name: true,
            displayName: true,
            description: true,
            avatarUrl: true,
            welcomeMessage: true,
            personality: true,
          },
        },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
      orderBy: { lastMessageAt: 'desc' },
    });

    return conversations.map((conv) => ({
      id: conv.id,
      sessionId: conv.sessionId,
      chatbotId: conv.chatbotId,
      lastMessageAt: conv.lastMessageAt,
      messageCount: conv.messageCount,
      createdAt: conv.createdAt,
      chatbot: conv.chatbot,
      lastMessage: conv.messages[0]
        ? {
            role: conv.messages[0].role,
            content: conv.messages[0].content,
            createdAt: conv.messages[0].createdAt,
          }
        : null,
    }));
  }

  /**
   * Get or create conversation with specific agent
   */
  async getOrCreateConversation(
    userId: number,
    chatbotId: number
  ): Promise<TutorConversationData & { messages: TutorMessageData[] }> {
    const session = await prisma.tutorSession.findUnique({
      where: { userId },
    });

    if (!session) {
      throw new AppError('Session not found', 404);
    }

    let conversation = await prisma.tutorConversation.findUnique({
      where: {
        sessionId_chatbotId: {
          sessionId: session.id,
          chatbotId,
        },
      },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!conversation) {
      conversation = await prisma.tutorConversation.create({
        data: {
          sessionId: session.id,
          chatbotId,
        },
        include: {
          messages: {
            orderBy: { createdAt: 'asc' },
          },
        },
      });
    }

    return {
      id: conversation.id,
      sessionId: conversation.sessionId,
      chatbotId: conversation.chatbotId,
      lastMessageAt: conversation.lastMessageAt,
      messageCount: conversation.messageCount,
      createdAt: conversation.createdAt,
      messages: conversation.messages.map((m) => ({
        id: m.id,
        conversationId: m.conversationId,
        role: m.role as 'user' | 'assistant',
        content: m.content,
        aiModel: m.aiModel,
        aiProvider: m.aiProvider,
        promptTokens: m.promptTokens,
        completionTokens: m.completionTokens,
        totalTokens: m.totalTokens,
        responseTimeMs: m.responseTimeMs,
        temperature: m.temperature,
        routingReason: m.routingReason,
        routingConfidence: m.routingConfidence,
        synthesizedFrom: m.synthesizedFrom,
        createdAt: m.createdAt,
      })),
    };
  }

  /**
   * Get message history for conversation
   */
  async getMessageHistory(conversationId: number, limit = 50): Promise<TutorMessageData[]> {
    const messages = await prisma.tutorMessage.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'asc' },
      take: limit,
    });

    return messages.map((m) => ({
      id: m.id,
      conversationId: m.conversationId,
      role: m.role as 'user' | 'assistant',
      content: m.content,
      aiModel: m.aiModel,
      aiProvider: m.aiProvider,
      promptTokens: m.promptTokens,
      completionTokens: m.completionTokens,
      totalTokens: m.totalTokens,
      responseTimeMs: m.responseTimeMs,
      temperature: m.temperature,
      routingReason: m.routingReason,
      routingConfidence: m.routingConfidence,
      synthesizedFrom: m.synthesizedFrom,
      createdAt: m.createdAt,
    }));
  }

  /**
   * Clear conversation messages
   */
  async clearConversation(userId: number, chatbotId: number): Promise<void> {
    const session = await prisma.tutorSession.findUnique({
      where: { userId },
    });

    if (!session) {
      throw new AppError('Session not found', 404);
    }

    const conversation = await prisma.tutorConversation.findUnique({
      where: {
        sessionId_chatbotId: {
          sessionId: session.id,
          chatbotId,
        },
      },
      include: {
        chatbot: {
          select: { name: true, displayName: true },
        },
      },
    });

    if (!conversation) {
      throw new AppError('Conversation not found', 404);
    }

    await prisma.tutorMessage.deleteMany({
      where: { conversationId: conversation.id },
    });

    await prisma.tutorConversation.update({
      where: { id: conversation.id },
      data: {
        messageCount: 0,
        lastMessageAt: null,
      },
    });

    // Log conversation clear
    await this.logInteraction({
      userId,
      sessionId: session.id,
      conversationId: conversation.id,
      chatbotId,
      chatbotName: conversation.chatbot.name,
      chatbotDisplayName: conversation.chatbot.displayName,
      eventType: 'conversation_clear',
      mode: session.mode as TutorMode,
    });

    // Log to unified activity log
    activityLogService.logActivity({
      userId,
      verb: 'cleared',
      objectType: 'tutor_conversation',
      objectId: conversation.id,
      objectTitle: `Conversation with ${conversation.chatbot.displayName}`,
      objectSubtype: conversation.chatbot.name,
      extensions: {
        agentId: chatbotId,
        agentName: conversation.chatbot.name,
        agentDisplayName: conversation.chatbot.displayName,
        sessionId: session.id,
      },
    }).catch(err => logger.warn({ err }, 'Failed to log conversation clear activity'));
  }

  // ==========================================================================
  // MESSAGE HANDLING
  // ==========================================================================

  /**
   * Send message to agent - routes through appropriate mode handler
   */
  async sendMessage(
    userId: number,
    chatbotId: number,
    message: string,
    clientInfo?: { ipAddress?: string; userAgent?: string; deviceType?: string },
    collaborativeSettings?: CollaborativeSettings
  ): Promise<TutorMessageResponse> {
    const session = await prisma.tutorSession.findUnique({
      where: { userId },
    });

    if (!session) {
      throw new AppError('Session not found', 404);
    }

    const chatbot = await prisma.chatbot.findUnique({
      where: { id: chatbotId },
    });

    if (!chatbot || !chatbot.isActive) {
      throw new AppError('Agent not found or inactive', 404);
    }

    // Get or create conversation
    const conversationData = await this.getOrCreateConversation(userId, chatbotId);

    const mode = session.mode as TutorMode;

    // Route to appropriate handler based on mode
    switch (mode) {
      case 'router':
        return this.handleRouterMode(session, message, clientInfo);
      case 'collaborative':
        return this.handleCollaborativeMode(session, message, clientInfo, collaborativeSettings);
      case 'random':
        return this.handleRandomMode(session, message, clientInfo);
      case 'manual':
      default:
        return this.handleManualMode(
          session,
          conversationData,
          chatbot,
          message,
          clientInfo
        );
    }
  }

  /**
   * Handle manual mode - direct chat with selected agent
   */
  private async handleManualMode(
    session: { id: number; userId: number; mode: string },
    conversation: TutorConversationData & { messages: TutorMessageData[] },
    chatbot: any,
    message: string,
    clientInfo?: { ipAddress?: string; userAgent?: string; deviceType?: string }
  ): Promise<TutorMessageResponse> {
    const startTime = Date.now();

    // Save user message
    const userMsg = await prisma.tutorMessage.create({
      data: {
        conversationId: conversation.id,
        role: 'user',
        content: message,
      },
    });

    // Log message sent
    await this.logInteraction({
      userId: session.userId,
      sessionId: session.id,
      conversationId: conversation.id,
      messageId: userMsg.id,
      chatbotId: chatbot.id,
      chatbotName: chatbot.name,
      chatbotDisplayName: chatbot.displayName,
      eventType: 'message_sent',
      userMessage: message,
      messageCharCount: message.length,
      mode: session.mode as TutorMode,
      ...clientInfo,
    });

    // Log to unified activity log
    activityLogService.logActivity({
      userId: session.userId,
      verb: 'messaged',
      objectType: 'tutor_agent',
      objectId: chatbot.id,
      objectTitle: chatbot.displayName,
      objectSubtype: 'user_message',
      extensions: {
        agentName: chatbot.name,
        conversationId: conversation.id,
        messageId: userMsg.id,
        messageLength: message.length,
        mode: session.mode,
      },
      deviceType: clientInfo?.deviceType,
    }).catch(err => logger.warn({ err }, 'Failed to log message sent activity'));

    // Build conversation history for multi-turn context (last 10 messages)
    const conversationHistory = conversation.messages.slice(-10).map((m) => ({
      role: m.role as 'user' | 'assistant' | 'system',
      content: m.content,
    }));

    // Build the system prompt with chatbot configuration
    let systemPrompt = chatbot.systemPrompt;

    // Add agent identity reminder and response guidelines
    systemPrompt += `\n\nIMPORTANT: You are ${chatbot.displayName}. Stay in character throughout the conversation. Remember what the user has told you and refer back to previous messages when relevant.

CRITICAL - HOW TO RESPOND:
- Address the STUDENT directly (the human learner) - they are your audience
- Use "you" to refer to the student
- NEVER start with ANY name followed by colon (no "Beatrice:", no "Tutor:", etc.)
- NEVER repeat or copy previous responses - just give YOUR fresh perspective
- If other tutors responded, briefly build on their IDEAS, then add YOUR insight
- Jump straight into your helpful response - no preamble, no name prefix

RESPONSE GUIDELINES:
- Keep responses SHORT: 300-500 characters max (about 2-3 sentences)
- NO markdown formatting: no headers, no tables, no horizontal rules, no code blocks unless showing code
- Use plain text with occasional **bold** for emphasis only
- Get to the point immediately - be direct and helpful
- One concept, one example max - no lengthy explanations`;

    if (chatbot.dosRules) {
      try {
        const dos = JSON.parse(chatbot.dosRules);
        if (Array.isArray(dos) && dos.length > 0) {
          systemPrompt += `\n\nDO:\n${dos.map((d: string) => `- ${d}`).join('\n')}`;
        }
      } catch {}
    }

    if (chatbot.dontsRules) {
      try {
        const donts = JSON.parse(chatbot.dontsRules);
        if (Array.isArray(donts) && donts.length > 0) {
          systemPrompt += `\n\nDON'T:\n${donts.map((d: string) => `- ${d}`).join('\n')}`;
        }
      } catch {}
    }

    // Get AI response
    let aiResponse: string;
    let aiModel = 'gpt-4o-mini';
    let aiProvider = 'openai';

    try {
      const response = await chatService.chat(
        {
          message,
          module: `tutor-${chatbot.name}`,
          systemPrompt,
          conversationHistory, // Pass actual message history for true multi-turn awareness
          temperature: chatbot.temperature ?? 0.7,
        },
        session.userId
      );

      aiResponse = response.reply;
      aiModel = response.model;
    } catch (error: any) {
      // Log error
      await this.logInteraction({
        userId: session.userId,
        sessionId: session.id,
        conversationId: conversation.id,
        chatbotId: chatbot.id,
        chatbotName: chatbot.name,
        chatbotDisplayName: chatbot.displayName,
        eventType: 'error',
        errorMessage: error.message,
        errorCode: 'AI_ERROR',
        mode: session.mode as TutorMode,
        ...clientInfo,
      });
      throw new AppError('Failed to get AI response', 500);
    }

    const responseTimeMs = Date.now() - startTime;

    // Save assistant message
    const assistantMsg = await prisma.tutorMessage.create({
      data: {
        conversationId: conversation.id,
        role: 'assistant',
        content: aiResponse,
        aiModel,
        aiProvider,
        responseTimeMs,
        temperature: chatbot.temperature,
      },
    });

    // Update conversation metadata
    await prisma.tutorConversation.update({
      where: { id: conversation.id },
      data: {
        lastMessageAt: new Date(),
        messageCount: { increment: 2 },
      },
    });

    // Log message received
    await this.logInteraction({
      userId: session.userId,
      sessionId: session.id,
      conversationId: conversation.id,
      messageId: assistantMsg.id,
      chatbotId: chatbot.id,
      chatbotName: chatbot.name,
      chatbotDisplayName: chatbot.displayName,
      eventType: 'message_received',
      assistantMessage: aiResponse,
      responseCharCount: aiResponse.length,
      mode: session.mode as TutorMode,
      aiModel,
      aiProvider,
      responseTimeMs,
      ...clientInfo,
    });

    // Log to unified activity log
    activityLogService.logActivity({
      userId: session.userId,
      verb: 'received',
      objectType: 'tutor_agent',
      objectId: chatbot.id,
      objectTitle: chatbot.displayName,
      objectSubtype: 'assistant_message',
      duration: responseTimeMs,
      extensions: {
        agentName: chatbot.name,
        conversationId: conversation.id,
        messageId: assistantMsg.id,
        responseLength: aiResponse.length,
        mode: session.mode,
        aiModel,
        aiProvider,
        responseTimeMs,
      },
      deviceType: clientInfo?.deviceType,
    }).catch(err => logger.warn({ err }, 'Failed to log message received activity'));

    return {
      userMessage: {
        id: userMsg.id,
        conversationId: userMsg.conversationId,
        role: 'user',
        content: userMsg.content,
        createdAt: userMsg.createdAt,
      },
      assistantMessage: {
        id: assistantMsg.id,
        conversationId: assistantMsg.conversationId,
        role: 'assistant',
        content: assistantMsg.content,
        aiModel: assistantMsg.aiModel,
        aiProvider: assistantMsg.aiProvider,
        responseTimeMs: assistantMsg.responseTimeMs,
        temperature: assistantMsg.temperature,
        createdAt: assistantMsg.createdAt,
      },
    };
  }

  /**
   * Handle router mode - AI analyzes message and routes to best agent
   */
  private async handleRouterMode(
    session: { id: number; userId: number; mode: string },
    message: string,
    clientInfo?: { ipAddress?: string; userAgent?: string; deviceType?: string }
  ): Promise<TutorMessageResponse> {
    // Get all available tutor agents
    const agents = await this.getAvailableAgents();

    if (agents.length === 0) {
      throw new AppError('No agents available', 500);
    }

    // Analyze message to determine best agent
    const routingResult = await this.analyzeAndRoute(message, agents);

    // Get or create conversation with the selected agent
    const conversationData = await this.getOrCreateConversation(
      session.userId,
      routingResult.selectedAgent.id
    );

    const chatbot = await prisma.chatbot.findUnique({
      where: { id: routingResult.selectedAgent.id },
    });

    if (!chatbot) {
      throw new AppError('Selected agent not found', 500);
    }

    // Handle the message with the selected agent
    const response = await this.handleManualMode(
      session,
      conversationData,
      chatbot,
      message,
      clientInfo
    );

    // Update messages with routing info
    await prisma.tutorMessage.update({
      where: { id: response.userMessage.id },
      data: {
        routingReason: routingResult.reason,
        routingConfidence: routingResult.confidence,
      },
    });

    await prisma.tutorMessage.update({
      where: { id: response.assistantMessage.id },
      data: {
        routingReason: routingResult.reason,
        routingConfidence: routingResult.confidence,
      },
    });

    // Log routing decision
    await this.logInteraction({
      userId: session.userId,
      sessionId: session.id,
      conversationId: conversationData.id,
      chatbotId: routingResult.selectedAgent.id,
      chatbotName: routingResult.selectedAgent.name,
      chatbotDisplayName: routingResult.selectedAgent.displayName,
      eventType: 'message_sent',
      mode: 'router',
      routingReason: routingResult.reason,
      routingConfidence: routingResult.confidence,
      routingAlternatives: JSON.stringify(routingResult.alternatives),
      ...clientInfo,
    });

    return {
      ...response,
      routingInfo: routingResult,
    };
  }

  /**
   * Handle random mode - pick a single random tutor to respond
   */
  private async handleRandomMode(
    session: { id: number; userId: number; mode: string },
    message: string,
    clientInfo?: { ipAddress?: string; userAgent?: string; deviceType?: string }
  ): Promise<TutorMessageResponse> {
    // Get all available tutor agents
    const agents = await this.getAvailableAgents();

    if (agents.length === 0) {
      throw new AppError('No agents available', 500);
    }

    // Pick a random agent
    const randomIndex = Math.floor(Math.random() * agents.length);
    const selectedAgent = agents[randomIndex];

    // Get or create conversation with the selected agent
    const conversationData = await this.getOrCreateConversation(
      session.userId,
      selectedAgent.id
    );

    const chatbot = await prisma.chatbot.findUnique({
      where: { id: selectedAgent.id },
    });

    if (!chatbot) {
      throw new AppError('Selected agent not found', 500);
    }

    // Handle the message with the randomly selected agent
    const response = await this.handleManualMode(
      session,
      conversationData,
      chatbot,
      message,
      clientInfo
    );

    // Log random selection
    await this.logInteraction({
      userId: session.userId,
      sessionId: session.id,
      conversationId: conversationData.id,
      chatbotId: selectedAgent.id,
      chatbotName: selectedAgent.name,
      chatbotDisplayName: selectedAgent.displayName,
      eventType: 'message_sent',
      mode: 'random',
      routingReason: 'Random selection',
      routingConfidence: 1.0,
      ...clientInfo,
    });

    return {
      ...response,
      routingInfo: {
        selectedAgent: {
          id: selectedAgent.id,
          name: selectedAgent.name,
          displayName: selectedAgent.displayName,
        },
        reason: 'Randomly selected',
        confidence: 1.0,
      },
    };
  }

  /**
   * Analyze message and route to best agent - FAST keyword-based by default
   * This is the super-fast routing mechanism that doesn't require AI calls
   */
  private async analyzeAndRoute(
    message: string,
    agents: TutorAgent[],
    useAI: boolean = false
  ): Promise<RoutingInfo> {
    // Use fast keyword-based routing by default
    // Only use AI if explicitly requested (for deeper analysis)
    if (useAI) {
      try {
        return await this.analyzeWithAI(message, agents);
      } catch (error) {
        logger.warn({ err: error }, 'AI routing failed, falling back to keyword-based');
      }
    }
    return this.analyzeWithKeywords(message, agents);
  }

  /**
   * AI-based intent analysis and routing
   */
  private async analyzeWithAI(
    message: string,
    agents: TutorAgent[]
  ): Promise<RoutingInfo> {
    const agentDescriptions = agents.map(a =>
      `- ${a.name} (${a.displayName}): ${a.description}`
    ).join('\n');

    const routingPrompt = `You are a routing assistant. Analyze the student's message and determine which tutor agent would be best suited to help them.

Available agents:
${agentDescriptions}

Student's message: "${message}"

Respond in this exact JSON format (no markdown, just JSON):
{
  "selectedAgent": "agent-name-here",
  "reason": "Brief explanation of why this agent is best",
  "confidence": 0.85,
  "scores": {
    "agent-name-1": 0.85,
    "agent-name-2": 0.60,
    "agent-name-3": 0.40
  }
}

Consider:
- Emotional tone (frustrated, curious, casual, urgent)
- Type of help needed (conceptual understanding, step-by-step guidance, project work, emotional support)
- Complexity of the question
- Whether they need encouragement or direct answers`;

    const response = await chatService.chat({
      message: routingPrompt,
      module: 'tutor-router',
      systemPrompt: 'You are a routing assistant. Always respond with valid JSON only, no markdown formatting.',
      temperature: 0.3, // Low temperature for consistent routing
    });

    // Parse AI response
    let parsed;
    try {
      // Extract JSON from response (handle potential markdown wrapping)
      const jsonMatch = response.reply.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('No JSON found in response');
      parsed = JSON.parse(jsonMatch[0]);
    } catch (parseError) {
      logger.warn({ err: parseError }, 'Failed to parse AI routing response');
      throw new Error('Invalid AI response format');
    }

    // Find the selected agent
    const selectedAgent = agents.find(a => a.name === parsed.selectedAgent);
    if (!selectedAgent) {
      // Fallback to first agent if AI selected an invalid one
      logger.warn({ selectedAgent: parsed.selectedAgent }, 'AI selected unknown agent, falling back to keyword routing');
      return this.analyzeWithKeywords(message, agents);
    }

    // Build alternatives from scores
    const alternatives = agents
      .filter(a => a.id !== selectedAgent.id)
      .map(a => ({
        agentId: a.id,
        agentName: a.name,
        score: parsed.scores?.[a.name] || 0.5,
      }))
      .sort((a, b) => b.score - a.score);

    return {
      selectedAgent: {
        id: selectedAgent.id,
        name: selectedAgent.name,
        displayName: selectedAgent.displayName,
      },
      reason: parsed.reason || 'AI-based routing',
      confidence: parsed.confidence || 0.8,
      alternatives,
    };
  }

  /**
   * Keyword-based routing - SUPER FAST, no AI calls
   * Scores all agents based on keyword matching for better relevance
   */
  private analyzeWithKeywords(
    message: string,
    agents: TutorAgent[]
  ): RoutingInfo {
    const messageLower = message.toLowerCase();

    // Score each agent based on keywords
    const agentScores: Map<number, { score: number; reason: string }> = new Map();

    // Initialize all agents with base score
    agents.forEach(a => agentScores.set(a.id, { score: 0.3, reason: 'Available tutor' }));

    // Keyword scoring rules - each match increases score
    const scoringRules: Array<{
      keywords: string[];
      agentNames: string[];
      boost: number;
      reason: string;
    }> = [
      // Emotional support
      {
        keywords: ['frustrated', 'stressed', 'overwhelmed', 'dumb', 'stupid', 'give up', 'cant do this', 'anxious', 'scared', 'worried', 'nervous'],
        agentNames: ['beatrice-peer', 'friendly-tutor'],
        boost: 0.6,
        reason: 'Emotional support needed',
      },
      // Discussion/debate
      {
        keywords: ['disagree', 'think about', 'opinion', 'what do you think', 'argue', 'debate', 'discuss', 'perspective'],
        agentNames: ['laila-peer', 'socratic-tutor'],
        boost: 0.5,
        reason: 'Intellectual discussion',
      },
      // Conceptual understanding
      {
        keywords: ['why', 'what if', 'explain', 'understand', 'concept', 'theory', 'meaning', 'difference between'],
        agentNames: ['socratic-tutor', 'laila-peer'],
        boost: 0.5,
        reason: 'Conceptual exploration',
      },
      // Step-by-step guidance
      {
        keywords: ['how do', 'how to', 'show me', 'steps', 'guide', 'tutorial', 'walk me through', 'example'],
        agentNames: ['helper-tutor', 'project-tutor'],
        boost: 0.5,
        reason: 'Practical guidance needed',
      },
      // Project/coding work
      {
        keywords: ['project', 'build', 'code', 'implement', 'debug', 'error', 'fix', 'program', 'function', 'bug'],
        agentNames: ['project-tutor', 'helper-tutor'],
        boost: 0.5,
        reason: 'Hands-on technical work',
      },
      // Casual support
      {
        keywords: ['hey', 'hi ', 'stuck', 'confused', 'lost', 'help me', 'quick question'],
        agentNames: ['carmen-peer', 'beatrice-peer', 'friendly-tutor'],
        boost: 0.4,
        reason: 'Casual peer support',
      },
      // Encouragement
      {
        keywords: ['trying', 'learning', 'new to', 'beginner', 'first time', 'not sure'],
        agentNames: ['beatrice-peer', 'friendly-tutor', 'carmen-peer'],
        boost: 0.4,
        reason: 'Encouragement for learner',
      },
    ];

    // Apply scoring rules
    for (const rule of scoringRules) {
      const hasKeyword = rule.keywords.some(kw => messageLower.includes(kw));
      if (hasKeyword) {
        for (const agentName of rule.agentNames) {
          const agent = agents.find(a => a.name === agentName);
          if (agent) {
            const current = agentScores.get(agent.id)!;
            agentScores.set(agent.id, {
              score: Math.min(0.95, current.score + rule.boost),
              reason: rule.reason,
            });
          }
        }
      }
    }

    // Also boost agents whose personality/description matches
    agents.forEach(agent => {
      const desc = (agent.description || '').toLowerCase();
      const personality = (agent.personality || '').toLowerCase();

      // Check if message terms appear in agent description
      const words = messageLower.split(/\s+/).filter(w => w.length > 4);
      const matchCount = words.filter(w => desc.includes(w) || personality.includes(w)).length;
      if (matchCount > 0) {
        const current = agentScores.get(agent.id)!;
        agentScores.set(agent.id, {
          score: Math.min(0.95, current.score + matchCount * 0.1),
          reason: current.reason,
        });
      }
    });

    // Find best agent
    let bestAgent = agents[0];
    let bestScore = 0;
    let bestReason = 'Default selection';

    agentScores.forEach((data, agentId) => {
      if (data.score > bestScore) {
        bestScore = data.score;
        bestReason = data.reason;
        bestAgent = agents.find(a => a.id === agentId) || agents[0];
      }
    });

    // Build alternatives with actual scores
    const alternatives = agents
      .filter(a => a.id !== bestAgent.id)
      .map(a => ({
        agentId: a.id,
        agentName: a.name,
        score: agentScores.get(a.id)?.score || 0.3,
      }))
      .sort((a, b) => b.score - a.score);

    return {
      selectedAgent: {
        id: bestAgent.id,
        name: bestAgent.name,
        displayName: bestAgent.displayName,
      },
      reason: bestReason,
      confidence: bestScore,
      alternatives,
    };
  }

  /**
   * Parse @mentions from message to identify specific tutors
   * Returns array of mentioned agent names (lowercase, normalized)
   */
  private parseMentions(message: string, availableAgents: TutorAgent[]): TutorAgent[] {
    // Match @name patterns (handles display names with spaces using quotes, or simple names)
    const mentionPatterns = [
      /@"([^"]+)"/gi,  // @"Display Name"
      /@'([^']+)'/gi,  // @'Display Name'
      /@(\S+)/gi,      // @simple-name or @SimpleName
    ];

    const mentionedNames: string[] = [];

    for (const pattern of mentionPatterns) {
      let match;
      while ((match = pattern.exec(message)) !== null) {
        mentionedNames.push(match[1].toLowerCase().trim());
      }
    }

    if (mentionedNames.length === 0) {
      return [];
    }

    // Match mentions to available agents (by name or displayName)
    const mentionedAgents = availableAgents.filter(agent => {
      const nameLower = agent.name.toLowerCase();
      const displayNameLower = agent.displayName.toLowerCase();

      return mentionedNames.some(mention =>
        nameLower.includes(mention) ||
        displayNameLower.includes(mention) ||
        mention.includes(nameLower) ||
        mention.includes(displayNameLower)
      );
    });

    return mentionedAgents;
  }

  /**
   * Remove @mentions from message for cleaner AI input
   */
  private stripMentions(message: string): string {
    return message
      .replace(/@"[^"]+"/g, '')
      .replace(/@'[^']+'/g, '')
      .replace(/@\S+/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Select relevant tutors for the message using FAST keyword-based routing
   * Super fast - no AI calls, just keyword matching
   */
  private async selectRelevantAgents(
    message: string,
    allAgents: TutorAgent[],
    maxAgents: number = 3
  ): Promise<TutorAgent[]> {
    if (allAgents.length <= maxAgents) return allAgents;

    // Use fast keyword-based routing (no AI call)
    const routingResult = this.analyzeWithKeywords(message, allAgents);

    // Get top agents by score
    const agentScores = new Map<number, number>();
    agentScores.set(routingResult.selectedAgent.id, routingResult.confidence);

    routingResult.alternatives?.forEach(alt => {
      agentScores.set(alt.agentId, alt.score);
    });

    // Sort agents by score and take top N
    const sortedAgents = [...allAgents].sort((a, b) => {
      const scoreA = agentScores.get(a.id) || 0;
      const scoreB = agentScores.get(b.id) || 0;
      return scoreB - scoreA;
    });

    return sortedAgents.slice(0, maxAgents);
  }

  /**
   * Get a single agent response with formatting guidelines
   */
  private async getAgentResponse(
    agent: TutorAgent,
    message: string,
    conversationHistory: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>,
    userId: number,
    context?: string,
    maxChars: number = 500
  ): Promise<AgentContribution> {
    const startTime = Date.now();
    try {
      let systemPrompt = agent.systemPrompt;
      systemPrompt += `\n\nYou are ${agent.displayName}. ${context || 'Provide your unique perspective.'}

CRITICAL - HOW TO RESPOND:
- Address the STUDENT directly - they are your audience
- Use "you" to refer to the student
- NEVER start with ANY name followed by colon (no "Beatrice:", no "Socratic Guide:", etc.)
- NEVER repeat or copy previous tutor responses - just give YOUR fresh perspective
- Do NOT include the previous tutor's text in your response
- Build on their IDEAS briefly, then add YOUR unique insight

RESPONSE GUIDELINES:
- Keep response under ${maxChars} characters (about 2-3 sentences)
- NO markdown: no headers, tables, code blocks, or horizontal rules
- Plain text only with occasional **bold** for emphasis
- Be direct and concise`;

      const response = await chatService.chat(
        {
          message,
          module: `tutor-collab-${agent.name}`,
          systemPrompt,
          conversationHistory,
          temperature: agent.temperature ?? 0.7,
        },
        userId
      );

      // Strip any name-like prefix from start of response (UI already shows the name)
      // This catches: "Name:", "**Name**:", "Name:\n", etc.
      let cleanedReply = response.reply;
      // Remove any "Name:" or "**Name**:" pattern at the start (up to 30 chars for the name)
      cleanedReply = cleanedReply
        .replace(/^\*\*[^*]{1,30}\*\*[:\s]*/i, '') // **Name**:
        .replace(/^[A-Z][a-zA-Z\s]{0,25}:\s*/m, '') // Name: (capitalized word followed by colon)
        .trim();

      return {
        agentId: agent.id,
        agentName: agent.name,
        agentDisplayName: agent.displayName,
        avatarUrl: agent.avatarUrl,
        contribution: cleanedReply.trim(),
        responseTimeMs: Date.now() - startTime,
      };
    } catch {
      return {
        agentId: agent.id,
        agentName: agent.name,
        agentDisplayName: agent.displayName,
        avatarUrl: agent.avatarUrl,
        contribution: `[${agent.displayName} was unable to respond]`,
        responseTimeMs: Date.now() - startTime,
      };
    }
  }

  /**
   * Handle collaborative mode with multiple styles
   * Styles: parallel, sequential, debate, random
   */
  private async handleCollaborativeMode(
    session: { id: number; userId: number; mode: string },
    message: string,
    clientInfo?: { ipAddress?: string; userAgent?: string; deviceType?: string },
    settings?: CollaborativeSettings
  ): Promise<TutorMessageResponse> {
    const startTime = Date.now();
    const style: CollaborativeStyle = settings?.style || 'parallel';
    const maxAgents = settings?.maxAgents || 2; // Default to 2 agents for tighter discussions
    const maxChars = settings?.maxResponseLength || 500;

    logger.info({ style, maxAgents, maxChars, selectedAgentIds: settings?.selectedAgentIds }, 'Collaborative mode settings');

    // Get all available tutor agents
    const allAgents = await this.getAvailableAgents();
    if (allAgents.length === 0) {
      throw new AppError('No agents available', 500);
    }

    // Determine which agents participate
    let agents: TutorAgent[];
    const mentionedAgents = this.parseMentions(message, allAgents);
    let selectionMethod = 'auto';

    if (mentionedAgents.length > 0) {
      // Use @mentioned agents
      agents = mentionedAgents;
      selectionMethod = 'mentioned';
    } else if (settings?.selectedAgentIds?.length) {
      // Use picker-selected agents
      agents = allAgents.filter(a => settings.selectedAgentIds!.includes(a.id));
      selectionMethod = 'picker';
    } else {
      // Select 2 relevant agents by default (not all!)
      agents = await this.selectRelevantAgents(message, allAgents, maxAgents);
      selectionMethod = 'auto-relevant';
    }

    logger.info({
      selectionMethod,
      agentCount: agents.length,
      agentNames: agents.map(a => a.displayName),
      totalAvailable: allAgents.length,
    }, 'Collaborative agents selected');

    const cleanMessage = this.stripMentions(message);

    // ALWAYS use the first available agent for team chat storage (unified conversation)
    // This ensures all collaborative messages go to the same place regardless of which agents respond
    const teamChatAgent = allAgents[0];
    const conversationData = await this.getOrCreateConversation(session.userId, teamChatAgent.id);
    const conversationHistory = conversationData.messages.slice(-10).map(m => ({
      role: m.role as 'user' | 'assistant' | 'system',
      content: m.content,
    }));

    // Save user message
    const userMsg = await prisma.tutorMessage.create({
      data: {
        conversationId: conversationData.id,
        role: 'user',
        content: message,
      },
    });

    let agentContributions: AgentContribution[] = [];
    let synthesis: string | undefined;
    let totalRounds = 1;

    // Execute based on style
    switch (style) {
      case 'sequential':
        // Each agent responds in order, building on previous responses
        let runningContext = '';
        for (let i = 0; i < agents.length; i++) {
          const agent = agents[i];
          const contextMsg = runningContext
            ? `Student's question: ${cleanMessage}\n\nPrevious tutor responses:\n${runningContext}\n\nBuild on what was said above. Acknowledge the previous points, then add your perspective for the student.`
            : cleanMessage;

          const contribution = await this.getAgentResponse(
            agent, contextMsg, conversationHistory, session.userId,
            i === 0 ? 'Answer the student directly.' : 'Reference what was said before, then add your perspective for the student.', maxChars
          );
          contribution.round = i + 1;
          agentContributions.push(contribution);
          runningContext += `\n${agent.displayName}: ${contribution.contribution}\n`;
        }
        break;

      case 'debate':
        // 2-3 rounds of back-and-forth - building on each other's viewpoints
        totalRounds = 2;
        let debateContext = '';
        for (let round = 1; round <= totalRounds; round++) {
          for (const agent of agents) {
            const debatePrompt = round === 1
              ? `Student's question: ${cleanMessage}\n\nShare your perspective.`
              : `Student's question: ${cleanMessage}\n\nPrevious viewpoints:\n${debateContext}\n\nBuild on what was said. You may agree, disagree, or add nuance. Address the student while engaging with the previous points.`;

            const contribution = await this.getAgentResponse(
              agent, debatePrompt, conversationHistory, session.userId,
              round === 1 ? 'Share your view with the student.' : 'Engage with previous points, then share your view with the student.', maxChars
            );
            contribution.round = round;
            agentContributions.push(contribution);
            debateContext += `\n[Round ${round}] ${agent.displayName}: ${contribution.contribution}\n`;
          }
        }
        break;

      case 'random':
        // Completely random: pick 1-3 from ALL available agents
        // Each agent builds on previous responses
        const shuffledAll = [...allAgents].sort(() => Math.random() - 0.5);
        const randomCount = Math.min(1 + Math.floor(Math.random() * 3), shuffledAll.length); // 1-3
        const randomSelected = shuffledAll.slice(0, randomCount);

        // Sequential - each agent sees and builds on what came before
        let discussionContext = '';
        for (let i = 0; i < randomSelected.length; i++) {
          const agent = randomSelected[i];
          const discussionPrompt = discussionContext
            ? `Student's question: ${cleanMessage}\n\nPrevious responses:\n${discussionContext}\n\nBuild on what was said above. Acknowledge the previous points, then add your perspective for the student.`
            : cleanMessage;

          const contribution = await this.getAgentResponse(
            agent, discussionPrompt, conversationHistory, session.userId,
            i === 0 ? 'Answer the student directly.' : 'Reference what was said before, then add your perspective for the student.', maxChars
          );
          contribution.round = i + 1;
          agentContributions.push(contribution);
          discussionContext += `\n${agent.displayName}: ${contribution.contribution}\n`;
        }
        break;

      case 'parallel':
      default:
        // All selected agents respond simultaneously
        agentContributions = await Promise.all(
          agents.map(agent => this.getAgentResponse(
            agent, cleanMessage, conversationHistory, session.userId, undefined, maxChars
          ))
        );
        break;
    }

    // Build display content (individual responses shown, optional synthesis)
    const displayParts = agentContributions.map(c =>
      `**${c.agentDisplayName}**${c.round ? ` (Round ${c.round})` : ''}:\n${c.contribution}`
    );
    const displayContent = displayParts.join('\n\n---\n\n');

    const responseTimeMs = Date.now() - startTime;

    // Save assistant message
    const assistantMsg = await prisma.tutorMessage.create({
      data: {
        conversationId: conversationData.id,
        role: 'assistant',
        content: displayContent,
        aiModel: 'gpt-4o-mini',
        aiProvider: 'openai',
        responseTimeMs,
        synthesizedFrom: JSON.stringify({ style, agentContributions }),
      },
    });

    // Update conversation
    await prisma.tutorConversation.update({
      where: { id: conversationData.id },
      data: { lastMessageAt: new Date(), messageCount: { increment: 2 } },
    });

    // Log interaction
    await this.logInteraction({
      userId: session.userId,
      sessionId: session.id,
      conversationId: conversationData.id,
      messageId: assistantMsg.id,
      eventType: 'message_received',
      mode: 'collaborative',
      assistantMessage: displayContent,
      responseCharCount: displayContent.length,
      responseTimeMs,
      agentContributions: JSON.stringify(agentContributions),
      ...clientInfo,
    });

    activityLogService.logActivity({
      userId: session.userId,
      verb: 'received',
      objectType: 'tutor_agent',
      objectId: teamChatAgent.id,
      objectTitle: 'Team Chat Response',
      objectSubtype: style,
      duration: responseTimeMs,
      extensions: {
        style,
        agentCount: agents.length,
        totalRounds,
        respondingAgents: agents.map(a => a.displayName),
      },
      deviceType: clientInfo?.deviceType,
    }).catch(err => logger.warn({ err }, 'Failed to log collaborative activity'));

    return {
      userMessage: {
        id: userMsg.id,
        conversationId: userMsg.conversationId,
        role: 'user',
        content: userMsg.content,
        createdAt: userMsg.createdAt,
      },
      assistantMessage: {
        id: assistantMsg.id,
        conversationId: assistantMsg.conversationId,
        role: 'assistant',
        content: displayContent,
        aiModel: assistantMsg.aiModel,
        aiProvider: assistantMsg.aiProvider,
        responseTimeMs: assistantMsg.responseTimeMs,
        synthesizedFrom: assistantMsg.synthesizedFrom,
        createdAt: assistantMsg.createdAt,
      },
      collaborativeInfo: {
        style,
        agentContributions,
        synthesis,
        mentionedAgents: mentionedAgents.length > 0 ? mentionedAgents.map(a => a.displayName) : undefined,
        totalRounds: style === 'debate' ? totalRounds : undefined,
      },
    };
  }

  // ==========================================================================
  // AGENT MANAGEMENT
  // ==========================================================================

  /**
   * Get available tutor agents (active chatbots with category 'tutor')
   */
  async getAvailableAgents(): Promise<TutorAgent[]> {
    const chatbots = await prisma.chatbot.findMany({
      where: {
        isActive: true,
        category: 'tutor',
      },
      orderBy: { name: 'asc' },
    });

    return chatbots.map((c) => ({
      id: c.id,
      name: c.name,
      displayName: c.displayName,
      description: c.description,
      avatarUrl: c.avatarUrl,
      welcomeMessage: c.welcomeMessage,
      personality: c.personality,
      temperature: c.temperature,
      systemPrompt: c.systemPrompt,
      isActive: c.isActive,
    }));
  }

  // ==========================================================================
  // LOGGING
  // ==========================================================================

  /**
   * Log interaction event
   */
  private async logInteraction(data: TutorInteractionLogData): Promise<void> {
    try {
      await prisma.tutorInteractionLog.create({
        data: {
          userId: data.userId,
          sessionId: data.sessionId,
          conversationId: data.conversationId,
          messageId: data.messageId,
          chatbotId: data.chatbotId,
          chatbotName: data.chatbotName,
          chatbotDisplayName: data.chatbotDisplayName,
          eventType: data.eventType,
          userMessage: data.userMessage,
          assistantMessage: data.assistantMessage,
          messageCharCount: data.messageCharCount,
          responseCharCount: data.responseCharCount,
          mode: data.mode,
          aiModel: data.aiModel,
          aiProvider: data.aiProvider,
          promptTokens: data.promptTokens,
          completionTokens: data.completionTokens,
          totalTokens: data.totalTokens,
          responseTimeMs: data.responseTimeMs,
          routingReason: data.routingReason,
          routingConfidence: data.routingConfidence,
          routingAlternatives: data.routingAlternatives,
          agentContributions: data.agentContributions,
          errorMessage: data.errorMessage,
          errorCode: data.errorCode,
          errorStack: data.errorStack,
          ipAddress: data.ipAddress,
          userAgent: data.userAgent,
          deviceType: data.deviceType,
        },
      });
    } catch (error) {
      logger.warn({ err: error }, 'Failed to log tutor interaction');
      // Don't throw - logging failure shouldn't break the main flow
    }
  }

  /**
   * Get interaction logs (admin)
   */
  async getInteractionLogs(filters?: {
    userId?: number;
    sessionId?: number;
    eventType?: string;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
  }) {
    const where: any = {};

    if (filters?.userId) where.userId = filters.userId;
    if (filters?.sessionId) where.sessionId = filters.sessionId;
    if (filters?.eventType) where.eventType = filters.eventType;
    if (filters?.startDate || filters?.endDate) {
      where.timestamp = {};
      if (filters.startDate) where.timestamp.gte = filters.startDate;
      if (filters.endDate) where.timestamp.lte = filters.endDate;
    }

    const logs = await prisma.tutorInteractionLog.findMany({
      where,
      orderBy: { timestamp: 'desc' },
      take: filters?.limit || 100,
    });

    return logs;
  }

  /**
   * Get aggregate stats (admin)
   */
  async getStats(startDate?: Date, endDate?: Date) {
    const where: any = {};
    if (startDate || endDate) {
      where.timestamp = {};
      if (startDate) where.timestamp.gte = startDate;
      if (endDate) where.timestamp.lte = endDate;
    }

    const [
      totalSessions,
      totalMessages,
      messagesByMode,
      messagesByAgent,
      avgResponseTime,
    ] = await Promise.all([
      prisma.tutorSession.count(),
      prisma.tutorMessage.count({ where: { role: 'assistant' } }),
      prisma.tutorInteractionLog.groupBy({
        by: ['mode'],
        where: { ...where, eventType: 'message_received' },
        _count: true,
      }),
      prisma.tutorInteractionLog.groupBy({
        by: ['chatbotName'],
        where: { ...where, eventType: 'message_received' },
        _count: true,
      }),
      prisma.tutorInteractionLog.aggregate({
        where: { ...where, eventType: 'message_received' },
        _avg: { responseTimeMs: true },
      }),
    ]);

    return {
      totalSessions,
      totalMessages,
      messagesByMode: messagesByMode.map((m) => ({
        mode: m.mode,
        count: m._count,
      })),
      messagesByAgent: messagesByAgent.map((a) => ({
        agent: a.chatbotName,
        count: a._count,
      })),
      avgResponseTimeMs: avgResponseTime._avg.responseTimeMs,
    };
  }
}

export const tutorService = new TutorService();
