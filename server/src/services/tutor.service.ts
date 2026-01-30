import prisma from '../utils/prisma.js';
import { AppError } from '../middleware/error.middleware.js';
import { chatService } from './chat.service.js';
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
    clientInfo?: { ipAddress?: string; userAgent?: string; deviceType?: string }
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
        return this.handleCollaborativeMode(session, message, clientInfo);
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

    // Build conversation history for multi-turn context (last 10 messages)
    const conversationHistory = conversation.messages.slice(-10).map((m) => ({
      role: m.role as 'user' | 'assistant' | 'system',
      content: m.content,
    }));

    // Build the system prompt with chatbot configuration
    let systemPrompt = chatbot.systemPrompt;

    // Add agent identity reminder
    systemPrompt += `\n\nIMPORTANT: You are ${chatbot.displayName}. Stay in character throughout the conversation. Remember what the user has told you and refer back to previous messages when relevant.`;

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
   * Analyze message and route to best agent using AI
   */
  private async analyzeAndRoute(
    message: string,
    agents: TutorAgent[]
  ): Promise<RoutingInfo> {
    // Try AI-based routing first, fall back to keyword-based if it fails
    try {
      return await this.analyzeWithAI(message, agents);
    } catch (error) {
      console.error('AI routing failed, falling back to keyword-based:', error);
      return this.analyzeWithKeywords(message, agents);
    }
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
      console.error('Failed to parse AI routing response:', response.reply);
      throw new Error('Invalid AI response format');
    }

    // Find the selected agent
    const selectedAgent = agents.find(a => a.name === parsed.selectedAgent);
    if (!selectedAgent) {
      // Fallback to first agent if AI selected an invalid one
      console.warn(`AI selected unknown agent: ${parsed.selectedAgent}`);
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
   * Keyword-based routing (fallback)
   */
  private analyzeWithKeywords(
    message: string,
    agents: TutorAgent[]
  ): RoutingInfo {
    const messageLower = message.toLowerCase();

    let selectedAgent = agents[0];
    let reason = 'Default selection';
    let confidence = 0.5;

    // Emotional support needed - Beatrice
    if (
      messageLower.includes('frustrated') ||
      messageLower.includes('stressed') ||
      messageLower.includes('overwhelmed') ||
      messageLower.includes('dumb') ||
      messageLower.includes('stupid') ||
      messageLower.includes('give up') ||
      messageLower.includes('cant do this')
    ) {
      const beatriceAgent = agents.find((a) => a.name === 'beatrice-peer');
      if (beatriceAgent) {
        selectedAgent = beatriceAgent;
        reason = 'Emotional support needed - Beatrice provides encouragement';
        confidence = 0.9;
      }
    }
    // Wants to discuss/debate - Laila
    else if (
      messageLower.includes('disagree') ||
      messageLower.includes('think about') ||
      messageLower.includes('opinion') ||
      messageLower.includes('what do you think') ||
      messageLower.includes('argue') ||
      messageLower.includes('debate')
    ) {
      const lailaAgent = agents.find((a) => a.name === 'laila-peer');
      if (lailaAgent) {
        selectedAgent = lailaAgent;
        reason = 'Discussion/debate detected - Laila loves intellectual discourse';
        confidence = 0.85;
      }
    }
    // Socratic tutor - conceptual questions, "why", "what if"
    else if (
      messageLower.includes('why') ||
      messageLower.includes('what if') ||
      messageLower.includes('explain') ||
      messageLower.includes('understand') ||
      messageLower.includes('concept')
    ) {
      const socraticAgent = agents.find((a) => a.name === 'socratic-tutor');
      if (socraticAgent) {
        selectedAgent = socraticAgent;
        reason = 'Conceptual exploration - Socratic method guides discovery';
        confidence = 0.8;
      }
    }
    // Helper tutor - "how do I", "show me", "steps"
    else if (
      messageLower.includes('how do') ||
      messageLower.includes('how to') ||
      messageLower.includes('show me') ||
      messageLower.includes('steps') ||
      messageLower.includes('guide') ||
      messageLower.includes('tutorial')
    ) {
      const helperAgent = agents.find((a) => a.name === 'helper-tutor');
      if (helperAgent) {
        selectedAgent = helperAgent;
        reason = 'Direct guidance needed - Helpful Guide provides clear steps';
        confidence = 0.85;
      }
    }
    // Project tutor - "project", "build", "code", "debug"
    else if (
      messageLower.includes('project') ||
      messageLower.includes('build') ||
      messageLower.includes('code') ||
      messageLower.includes('implement') ||
      messageLower.includes('debug') ||
      messageLower.includes('error') ||
      messageLower.includes('fix')
    ) {
      const projectAgent = agents.find((a) => a.name === 'project-tutor');
      if (projectAgent) {
        selectedAgent = projectAgent;
        reason = 'Practical work detected - Project Coach helps with hands-on tasks';
        confidence = 0.82;
      }
    }
    // Casual peer support - Carmen or Study Buddy
    else if (
      messageLower.includes('hey') ||
      messageLower.includes('hi ') ||
      messageLower.includes('stuck') ||
      messageLower.includes('confused') ||
      messageLower.includes('lost')
    ) {
      const carmenAgent = agents.find((a) => a.name === 'carmen-peer');
      if (carmenAgent) {
        selectedAgent = carmenAgent;
        reason = 'Casual tone - Carmen offers peer-to-peer support';
        confidence = 0.75;
      }
    }

    // Calculate alternatives
    const alternatives = agents
      .filter((a) => a.id !== selectedAgent.id)
      .map((a) => ({
        agentId: a.id,
        agentName: a.name,
        score: Math.random() * 0.5 + 0.3,
      }))
      .sort((a, b) => b.score - a.score);

    return {
      selectedAgent: {
        id: selectedAgent.id,
        name: selectedAgent.name,
        displayName: selectedAgent.displayName,
      },
      reason,
      confidence,
      alternatives,
    };
  }

  /**
   * Handle collaborative mode - all agents discuss, synthesize response
   */
  private async handleCollaborativeMode(
    session: { id: number; userId: number; mode: string },
    message: string,
    clientInfo?: { ipAddress?: string; userAgent?: string; deviceType?: string }
  ): Promise<TutorMessageResponse> {
    const startTime = Date.now();

    // Get all available tutor agents
    const agents = await this.getAvailableAgents();

    if (agents.length === 0) {
      throw new AppError('No agents available', 500);
    }

    // Use the first agent's conversation to store the collaborative messages
    const primaryAgent = agents[0];
    const conversationData = await this.getOrCreateConversation(
      session.userId,
      primaryAgent.id
    );

    // Build conversation history for context
    const conversationHistory = conversationData.messages.slice(-10).map((m) => ({
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

    // Get responses from all agents in parallel (each agent is aware of conversation history)
    const agentResponses = await Promise.all(
      agents.map(async (agent) => {
        const agentStartTime = Date.now();
        try {
          // Build agent-specific system prompt
          let agentSystemPrompt = agent.systemPrompt;
          agentSystemPrompt += `\n\nIMPORTANT: You are ${agent.displayName} participating in a collaborative tutoring session. Provide a focused response from your unique perspective. Be aware of what has been discussed previously.`;

          const response = await chatService.chat(
            {
              message: `${message}\n\n[Note: Provide a brief, focused response from your perspective as ${agent.displayName}.]`,
              module: `tutor-collaborative-${agent.name}`,
              systemPrompt: agentSystemPrompt,
              conversationHistory, // Include conversation history for awareness
              temperature: agent.temperature ?? 0.7,
            },
            session.userId
          );

          return {
            agentId: agent.id,
            agentName: agent.name,
            agentDisplayName: agent.displayName,
            contribution: response.reply,
            responseTimeMs: Date.now() - agentStartTime,
          };
        } catch (error) {
          return {
            agentId: agent.id,
            agentName: agent.name,
            agentDisplayName: agent.displayName,
            contribution: `[${agent.displayName} was unable to respond]`,
            responseTimeMs: Date.now() - agentStartTime,
          };
        }
      })
    );

    // Synthesize responses
    const synthesisPrompt = `You are synthesizing responses from multiple tutors about: "${message}"

Here are the individual responses:

${agentResponses.map((r) => `**${r.agentDisplayName}**: ${r.contribution}`).join('\n\n')}

Create a unified, coherent response that:
1. Combines the best insights from each tutor
2. Resolves any contradictions thoughtfully
3. Maintains a helpful, educational tone
4. Is well-structured and easy to follow

Synthesized response:`;

    let synthesizedResponse: string;
    try {
      const response = await chatService.chat(
        {
          message: synthesisPrompt,
          module: 'tutor-collaborative-synthesis',
          systemPrompt:
            'You are an expert at synthesizing multiple perspectives into a coherent, helpful response.',
        },
        session.userId
      );
      synthesizedResponse = response.reply;
    } catch (error) {
      // Fallback: just combine responses
      synthesizedResponse = agentResponses
        .map((r) => `**${r.agentDisplayName}**:\n${r.contribution}`)
        .join('\n\n---\n\n');
    }

    const responseTimeMs = Date.now() - startTime;

    // Save assistant message with collaborative metadata
    const assistantMsg = await prisma.tutorMessage.create({
      data: {
        conversationId: conversationData.id,
        role: 'assistant',
        content: synthesizedResponse,
        aiModel: 'gpt-4o-mini',
        aiProvider: 'openai',
        responseTimeMs,
        synthesizedFrom: JSON.stringify(agentResponses),
      },
    });

    // Update conversation metadata
    await prisma.tutorConversation.update({
      where: { id: conversationData.id },
      data: {
        lastMessageAt: new Date(),
        messageCount: { increment: 2 },
      },
    });

    // Log collaborative interaction
    await this.logInteraction({
      userId: session.userId,
      sessionId: session.id,
      conversationId: conversationData.id,
      messageId: assistantMsg.id,
      eventType: 'message_received',
      mode: 'collaborative',
      assistantMessage: synthesizedResponse,
      responseCharCount: synthesizedResponse.length,
      responseTimeMs,
      agentContributions: JSON.stringify(agentResponses),
      ...clientInfo,
    });

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
        synthesizedFrom: assistantMsg.synthesizedFrom,
        createdAt: assistantMsg.createdAt,
      },
      collaborativeInfo: {
        agentContributions: agentResponses,
        synthesizedBy: 'AI Synthesis Engine',
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
      console.error('Failed to log tutor interaction:', error);
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
