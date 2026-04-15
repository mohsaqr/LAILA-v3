import OpenAI from 'openai';
import { GoogleGenerativeAI } from '@google/generative-ai';
import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import prisma from '../utils/prisma.js';
import { AppError } from '../middleware/error.middleware.js';
import { CreateAgentConfigInput, UpdateAgentConfigInput, GradeAgentSubmissionInput } from '../utils/validation.js';
import { agentAnalyticsService, ClientContext, UserContext, AssignmentContext } from './agentAnalytics.service.js';
import { activityLogService, type ActivityVerb } from './activityLog.service.js';
import { llmService } from './llm.service.js';

// AI Config type
interface AIConfig {
  provider: 'openai' | 'gemini';
  model: string;
  apiKey: string;
  baseUrl?: string; // For LM Studio or other OpenAI-compatible endpoints
}

// Event context for logging
export interface EventContext {
  userId: number;
  userFullname?: string;
  userEmail?: string;
  userRole?: 'student' | 'instructor';
  ipAddress?: string;
  userAgent?: string;
  sessionId?: string;
}

export class AgentAssignmentService {

  /** Log an agent assignment event to the global LearningActivityLog */
  private logAgentActivity(params: {
    userId: number;
    verb: ActivityVerb;
    objectId: number;
    objectTitle: string;
    courseId?: number;
    assignmentId?: number;
    assignmentTitle?: string;
    extensions?: Record<string, unknown>;
    context: EventContext;
  }) {
    activityLogService.logActivity({
      userId: params.userId,
      verb: params.verb,
      objectType: 'assignment',
      objectSubtype: 'ai_agent',
      objectId: params.objectId,
      objectTitle: `AI Agent Assignment: ${params.objectTitle}`,
      courseId: params.courseId,
      extensions: {
        assignmentId: params.assignmentId,
        assignmentTitle: params.assignmentTitle,
        ...params.extensions,
      },
      sessionId: params.context.sessionId,
      deviceType: params.context.userAgent?.includes('Mobile') ? 'mobile' : 'desktop',
    }).catch(err => console.error('[AgentAssignment] Failed to log activity:', err));
  }

  // =============================================================================
  // AI CONFIGURATION
  // =============================================================================

  private async getAIConfig(): Promise<AIConfig | null> {
    const configs = await prisma.apiConfiguration.findMany({
      where: { isActive: true },
    });

    const openaiConfig = configs.find(c => c.serviceName === 'openai');
    if (openaiConfig?.apiKey) {
      return {
        provider: 'openai',
        model: openaiConfig.defaultModel || 'gpt-4o-mini',
        apiKey: openaiConfig.apiKey,
      };
    }

    const geminiConfig = configs.find(c => c.serviceName === 'gemini');
    if (geminiConfig?.apiKey) {
      return {
        provider: 'gemini',
        model: geminiConfig.defaultModel || 'gemini-pro',
        apiKey: geminiConfig.apiKey,
      };
    }

    if (process.env.OPENAI_API_KEY) {
      return {
        provider: 'openai',
        model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
        apiKey: process.env.OPENAI_API_KEY,
        baseUrl: process.env.OPENAI_BASE_URL, // For LM Studio: http://localhost:1234/v1
      };
    }

    if (process.env.GEMINI_API_KEY) {
      return {
        provider: 'gemini',
        model: process.env.GEMINI_MODEL || 'gemini-pro',
        apiKey: process.env.GEMINI_API_KEY,
      };
    }

    return null;
  }

  // =============================================================================
  // STUDENT AGENT CONFIG CRUD
  // =============================================================================

  // Helper to parse JSON fields in config
  private formatConfig(config: any) {
    if (!config) return null;
    return {
      ...config,
      dosRules: config.dosRules ? JSON.parse(config.dosRules) : [],
      dontsRules: config.dontsRules ? JSON.parse(config.dontsRules) : [],
      suggestedQuestions: config.suggestedQuestions ? JSON.parse(config.suggestedQuestions) : [],
      selectedPromptBlocks: config.selectedPromptBlocks ? JSON.parse(config.selectedPromptBlocks) : [],
    };
  }

  // Get student's agent config for an assignment
  async getMyAgentConfig(assignmentId: number, userId: number) {
    const assignment = await this.getAgentAssignment(assignmentId);

    const config = await prisma.studentAgentConfig.findUnique({
      where: {
        assignmentId_userId: { assignmentId, userId },
      },
      include: {
        submission: {
          select: {
            id: true,
            status: true,
            grade: true,
            feedback: true,
            gradedAt: true,
          },
        },
        _count: {
          // Filter out empty test conversations (no messages) so counts on
          // the instructor-facing views reflect actual student activity.
          select: {
            testConversations: {
              where: { messages: { some: {} } },
            },
          },
        },
      },
    });

    return {
      assignment: {
        id: assignment.id,
        title: assignment.title,
        description: assignment.description,
        instructions: assignment.instructions,
        agentRequirements: assignment.agentRequirements,
        dueDate: assignment.dueDate,
        points: assignment.points,
        course: assignment.course,
      },
      config: this.formatConfig(config),
    };
  }

  // Create agent config
  async createAgentConfig(
    assignmentId: number,
    userId: number,
    data: CreateAgentConfigInput,
    context: EventContext
  ) {
    const assignment = await this.getAgentAssignment(assignmentId);

    // Check enrollment
    await this.checkEnrollment(userId, assignment.courseId);

    // Check if config already exists
    const existing = await prisma.studentAgentConfig.findUnique({
      where: {
        assignmentId_userId: { assignmentId, userId },
      },
    });

    if (existing) {
      throw new AppError('Agent config already exists. Use update instead.', 400);
    }

    // Create the config
    const config = await prisma.studentAgentConfig.create({
      data: {
        assignmentId,
        userId,
        agentName: data.agentName,
        agentTitle: data.agentTitle,
        personaDescription: data.personaDescription,
        systemPrompt: data.systemPrompt,
        dosRules: data.dosRules ? JSON.stringify(data.dosRules) : null,
        dontsRules: data.dontsRules ? JSON.stringify(data.dontsRules) : null,
        welcomeMessage: data.welcomeMessage,
        avatarImageUrl: data.avatarImageUrl,
        // Enhanced builder fields
        pedagogicalRole: data.pedagogicalRole,
        personality: data.personality,
        personalityPrompt: data.personalityPrompt,
        responseStyle: data.responseStyle,
        temperature: data.temperature ?? 0.7,
        suggestedQuestions: data.suggestedQuestions ? JSON.stringify(data.suggestedQuestions) : null,
        knowledgeContext: data.knowledgeContext,
        // Prompt building blocks
        selectedPromptBlocks: data.selectedPromptBlocks ? JSON.stringify(data.selectedPromptBlocks) : null,
        version: 1,
        isDraft: true,
      },
    });

    // Log the creation
    const configSnapshot = agentAnalyticsService.createConfigSnapshot(config);
    await agentAnalyticsService.logConfigurationChange({
      agentConfigId: config.id,
      user: {
        userId: context.userId,
        userFullname: context.userFullname,
        userEmail: context.userEmail,
      },
      assignment: {
        assignmentId: assignment.id,
        assignmentTitle: assignment.title,
        courseId: assignment.courseId,
        courseTitle: assignment.course?.title,
      },
      changeType: 'create',
      version: 1,
      newConfigSnapshot: configSnapshot,
      clientContext: {
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
        sessionId: context.sessionId,
      },
    });

    // Note: we intentionally do NOT write a `created`/`assignment` row to
    // LearningActivityLog here. The client-side design logger already
    // captures save actions as `progressed`/`assignment_agent` with the
    // `agent_design.save.draft` subtype, which is the canonical signal.

    return this.formatConfig(config);
  }

  // Update agent config
  async updateAgentConfig(
    assignmentId: number,
    userId: number,
    data: UpdateAgentConfigInput,
    context: EventContext
  ) {
    const assignment = await this.getAgentAssignment(assignmentId);

    const existing = await prisma.studentAgentConfig.findUnique({
      where: {
        assignmentId_userId: { assignmentId, userId },
      },
    });

    if (!existing) {
      throw new AppError('Agent config not found', 404);
    }

    // Check if already submitted
    if (!existing.isDraft) {
      throw new AppError('Cannot update a submitted agent. Unsubmit first.', 400);
    }

    // Create previous snapshot
    const previousSnapshot = agentAnalyticsService.createConfigSnapshot(existing);

    // Determine changed fields
    const changedFields: string[] = [];
    if (data.agentName !== undefined && data.agentName !== existing.agentName) changedFields.push('agentName');
    if (data.agentTitle !== undefined && data.agentTitle !== existing.agentTitle) changedFields.push('agentTitle');
    if (data.personaDescription !== undefined && data.personaDescription !== existing.personaDescription) changedFields.push('personaDescription');
    if (data.systemPrompt !== undefined && data.systemPrompt !== existing.systemPrompt) changedFields.push('systemPrompt');
    if (data.dosRules !== undefined) changedFields.push('dosRules');
    if (data.dontsRules !== undefined) changedFields.push('dontsRules');
    if (data.welcomeMessage !== undefined && data.welcomeMessage !== existing.welcomeMessage) changedFields.push('welcomeMessage');
    if (data.avatarImageUrl !== undefined && data.avatarImageUrl !== existing.avatarImageUrl) changedFields.push('avatarImageUrl');
    // Enhanced fields change tracking
    if (data.pedagogicalRole !== undefined && data.pedagogicalRole !== existing.pedagogicalRole) changedFields.push('pedagogicalRole');
    if (data.personality !== undefined && data.personality !== existing.personality) changedFields.push('personality');
    if (data.personalityPrompt !== undefined && data.personalityPrompt !== existing.personalityPrompt) changedFields.push('personalityPrompt');
    if (data.responseStyle !== undefined && data.responseStyle !== existing.responseStyle) changedFields.push('responseStyle');
    if (data.temperature !== undefined && data.temperature !== existing.temperature) changedFields.push('temperature');
    if (data.suggestedQuestions !== undefined) changedFields.push('suggestedQuestions');
    if (data.knowledgeContext !== undefined && data.knowledgeContext !== existing.knowledgeContext) changedFields.push('knowledgeContext');
    if (data.selectedPromptBlocks !== undefined) changedFields.push('selectedPromptBlocks');

    const newVersion = existing.version + 1;

    const updated = await prisma.studentAgentConfig.update({
      where: { id: existing.id },
      data: {
        agentName: data.agentName,
        agentTitle: data.agentTitle,
        personaDescription: data.personaDescription,
        systemPrompt: data.systemPrompt,
        dosRules: data.dosRules ? JSON.stringify(data.dosRules) : undefined,
        dontsRules: data.dontsRules ? JSON.stringify(data.dontsRules) : undefined,
        welcomeMessage: data.welcomeMessage,
        avatarImageUrl: data.avatarImageUrl,
        // Enhanced builder fields
        pedagogicalRole: data.pedagogicalRole,
        personality: data.personality,
        personalityPrompt: data.personalityPrompt,
        responseStyle: data.responseStyle,
        temperature: data.temperature,
        suggestedQuestions: data.suggestedQuestions ? JSON.stringify(data.suggestedQuestions) : undefined,
        knowledgeContext: data.knowledgeContext,
        // Prompt building blocks
        selectedPromptBlocks: data.selectedPromptBlocks ? JSON.stringify(data.selectedPromptBlocks) : undefined,
        version: newVersion,
      },
    });

    // Log the update
    const newSnapshot = agentAnalyticsService.createConfigSnapshot(updated);
    await agentAnalyticsService.logConfigurationChange({
      agentConfigId: updated.id,
      user: {
        userId: context.userId,
        userFullname: context.userFullname,
        userEmail: context.userEmail,
      },
      assignment: {
        assignmentId: assignment.id,
        assignmentTitle: assignment.title,
        courseId: assignment.courseId,
        courseTitle: assignment.course?.title,
      },
      changeType: 'update',
      version: newVersion,
      previousConfigSnapshot: previousSnapshot,
      newConfigSnapshot: newSnapshot,
      changedFields,
      clientContext: {
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
        sessionId: context.sessionId,
      },
    });

    // Note: we intentionally do NOT write an `updated`/`assignment` row to
    // LearningActivityLog here. Covered client-side via
    // `agent_design.save.draft` → `progressed`/`assignment_agent`.

    return this.formatConfig(updated);
  }

  // =============================================================================
  // SUBMISSION FLOW
  // =============================================================================

  // Submit agent for grading
  async submitAgentConfig(assignmentId: number, userId: number, context: EventContext) {
    const assignment = await this.getAgentAssignment(assignmentId);

    // Check due date and grace period
    if (assignment.dueDate && new Date() > assignment.dueDate) {
      if (assignment.gracePeriodDeadline && new Date() <= assignment.gracePeriodDeadline) {
        // Within grace period — allow submission (client shows warning)
      } else {
        const msg = assignment.gracePeriodDeadline
          ? 'The grace period deadline has passed'
          : 'Assignment due date has passed';
        throw new AppError(msg, 400);
      }
    }

    const config = await prisma.studentAgentConfig.findUnique({
      where: {
        assignmentId_userId: { assignmentId, userId },
      },
    });

    if (!config) {
      throw new AppError('Agent config not found', 404);
    }

    if (!config.isDraft) {
      throw new AppError('Agent is already submitted', 400);
    }

    // Update config to submitted
    const updated = await prisma.studentAgentConfig.update({
      where: { id: config.id },
      data: {
        isDraft: false,
        submittedAt: new Date(),
      },
    });

    // Create or update submission record
    const submission = await prisma.assignmentSubmission.upsert({
      where: {
        assignmentId_userId: { assignmentId, userId },
      },
      create: {
        assignmentId,
        userId,
        status: 'submitted',
        agentConfigId: config.id,
      },
      update: {
        status: 'submitted',
        submittedAt: new Date(),
        agentConfigId: config.id,
      },
    });

    // Log the submission
    const configSnapshot = agentAnalyticsService.createConfigSnapshot(updated);
    await agentAnalyticsService.logConfigurationChange({
      agentConfigId: config.id,
      user: {
        userId: context.userId,
        userFullname: context.userFullname,
        userEmail: context.userEmail,
      },
      assignment: {
        assignmentId: assignment.id,
        assignmentTitle: assignment.title,
        courseId: assignment.courseId,
        courseTitle: assignment.course?.title,
      },
      changeType: 'submit',
      version: config.version,
      newConfigSnapshot: configSnapshot,
      clientContext: {
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
        sessionId: context.sessionId,
      },
    });

    // Note: we intentionally do NOT write a `submitted`/`assignment` row
    // to LearningActivityLog. The client-side design logger already emits
    // `submitted`/`assignment_agent` with the `agent_design.save.submission_attempted`
    // subtype when the student clicks the Submit button, which is the
    // canonical signal.

    return { config: updated, submission };
  }

  // Unsubmit agent (return to draft)
  async unsubmitAgentConfig(assignmentId: number, userId: number, context: EventContext) {
    const assignment = await this.getAgentAssignment(assignmentId);

    const config = await prisma.studentAgentConfig.findUnique({
      where: {
        assignmentId_userId: { assignmentId, userId },
      },
      include: {
        submission: true,
      },
    });

    if (!config) {
      throw new AppError('Agent config not found', 404);
    }

    if (config.isDraft) {
      throw new AppError('Agent is not submitted', 400);
    }

    // Check if already graded
    if (config.submission?.status === 'graded') {
      throw new AppError('Cannot unsubmit a graded assignment', 400);
    }

    // Update config to draft
    const updated = await prisma.studentAgentConfig.update({
      where: { id: config.id },
      data: {
        isDraft: true,
        submittedAt: null,
      },
    });

    // Update submission status
    if (config.submission) {
      await prisma.assignmentSubmission.update({
        where: { id: config.submission.id },
        data: { status: 'draft' },
      });
    }

    // Log the unsubmit
    const configSnapshot = agentAnalyticsService.createConfigSnapshot(updated);
    await agentAnalyticsService.logConfigurationChange({
      agentConfigId: config.id,
      user: {
        userId: context.userId,
        userFullname: context.userFullname,
        userEmail: context.userEmail,
      },
      assignment: {
        assignmentId: assignment.id,
        assignmentTitle: assignment.title,
        courseId: assignment.courseId,
        courseTitle: assignment.course?.title,
      },
      changeType: 'unsubmit',
      version: config.version,
      newConfigSnapshot: configSnapshot,
      clientContext: {
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
        sessionId: context.sessionId,
      },
    });

    // Note: we intentionally do NOT write an `updated`/`assignment` row
    // here. The client-side design logger already emits
    // `unsubmitted`/`assignment_agent` via `agent_design.save.unsubmit_requested`
    // when the student clicks the Unsubmit button — that's the canonical
    // signal and the only row we want in admin/logs for this action.

    return updated;
  }

  // =============================================================================
  // TESTING
  // =============================================================================

  // Start a test conversation
  async startTestConversation(
    assignmentId: number,
    agentConfigId: number,
    testerInfo: { userId: number; role: 'student' | 'instructor'; fullname?: string; email?: string },
    context: EventContext
  ) {
    const config = await prisma.studentAgentConfig.findUnique({
      where: { id: agentConfigId },
      include: {
        assignment: {
          include: { course: { select: { id: true, title: true } } },
        },
      },
    });

    if (!config) {
      throw new AppError('Agent config not found', 404);
    }

    // Students can only test their own agent
    if (testerInfo.role === 'student' && config.userId !== testerInfo.userId) {
      throw new AppError('Not authorized to test this agent', 403);
    }

    // Create test conversation
    const configSnapshot = agentAnalyticsService.createConfigSnapshot(config);

    const conversation = await prisma.agentTestConversation.create({
      data: {
        agentConfigId: config.id,
        testerId: testerInfo.userId,
        testerRole: testerInfo.role,
        testerFullname: testerInfo.fullname,
        testerEmail: testerInfo.email,
        configVersion: config.version,
        configSnapshot: JSON.stringify(configSnapshot),
      },
    });

    // Log test start
    await agentAnalyticsService.logTestInteraction({
      user: {
        userId: testerInfo.userId,
        userFullname: testerInfo.fullname,
        userEmail: testerInfo.email,
        userRole: testerInfo.role,
      },
      agentConfigId: config.id,
      agentName: config.agentName,
      agentTitle: config.agentTitle,
      agentVersion: config.version,
      assignment: {
        assignmentId: config.assignmentId,
        assignmentTitle: config.assignment.title,
        courseId: config.assignment.courseId,
        courseTitle: config.assignment.course?.title,
      },
      conversationId: conversation.id,
      eventType: 'test_start',
      agentConfigSnapshot: configSnapshot,
      clientContext: {
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
        sessionId: context.sessionId,
      },
    });

    // Note: we intentionally do NOT write a `started`/`assignment` row
    // here. The client-side agentDesignLogger already emits
    // `started`/`agent_conversation` via `agent_design.test.conversation_started`
    // when the student clicks "Start Test Conversation", which is the
    // canonical signal.

    return {
      conversation,
      welcomeMessage: config.welcomeMessage,
      agentName: config.agentName,
      avatarImageUrl: config.avatarImageUrl,
    };
  }

  // Send message in test conversation
  async sendTestMessage(
    conversationId: number,
    message: string,
    testerInfo: { userId: number; role: 'student' | 'instructor'; fullname?: string; email?: string },
    context: EventContext,
    llmOverrides?: { model?: string; provider?: string }
  ) {
    const startTime = Date.now();

    const conversation = await prisma.agentTestConversation.findUnique({
      where: { id: conversationId },
      include: {
        agentConfig: {
          include: {
            assignment: {
              include: { course: { select: { id: true, title: true } } },
            },
          },
        },
        messages: {
          orderBy: { messageIndex: 'asc' },
        },
      },
    });

    if (!conversation) {
      throw new AppError('Conversation not found', 404);
    }

    // Verify tester
    if (conversation.testerId !== testerInfo.userId) {
      throw new AppError('Not authorized', 403);
    }

    const config = conversation.agentConfig;
    const aiConfig = llmOverrides?.provider ? null : await this.getAIConfig();

    if (!aiConfig && !llmOverrides?.provider) {
      throw new AppError('No AI provider configured', 500);
    }

    // Get current message count for index
    const messageIndex = conversation.messages.length;

    // Save user message
    await prisma.agentTestMessage.create({
      data: {
        conversationId,
        role: 'user',
        content: message,
        messageIndex,
      },
    });

    // Build system prompt from agent config
    const systemPrompt = this.buildSystemPrompt(config);

    // Build conversation history for AI
    const chatMessages = [
      { role: 'system' as const, content: systemPrompt },
      ...conversation.messages.map(m => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })),
      { role: 'user' as const, content: message },
    ];

    let aiResponse: string;
    let resolvedModel: string = 'unknown';
    let resolvedProvider: string = 'unknown';
    let promptTokens: number | undefined;
    let completionTokens: number | undefined;
    let totalTokens: number | undefined;

    // Get temperature from config - only pass if explicitly set (Minimal Parameter Principle)
    // config.temperature is nullable, so undefined/null means "use provider default"
    const temperature = config.temperature ?? undefined;

    try {
      if (llmOverrides?.provider) {
        // Use unified LLM service with per-request override
        const llmResponse = await llmService.chat({
          messages: chatMessages,
          model: llmOverrides.model,
          provider: llmOverrides.provider as any,
          temperature,
          maxTokens: 2000,
        });
        const content = llmResponse.choices[0]?.message?.content;
        aiResponse = typeof content === 'string' ? content : 'No response generated';
        resolvedModel = llmResponse.model;
        resolvedProvider = llmResponse.provider;
        promptTokens = llmResponse.usage?.promptTokens;
        completionTokens = llmResponse.usage?.completionTokens;
        totalTokens = llmResponse.usage?.totalTokens;
      } else if (aiConfig!.provider === 'openai') {
        const result = await this.chatWithOpenAI(chatMessages, aiConfig!.model, aiConfig!.apiKey, temperature, aiConfig!.baseUrl);
        aiResponse = result.content;
        resolvedModel = aiConfig!.model;
        resolvedProvider = aiConfig!.provider;
        promptTokens = result.promptTokens;
        completionTokens = result.completionTokens;
        totalTokens = result.totalTokens;
      } else {
        aiResponse = await this.chatWithGemini(chatMessages, aiConfig!.model, aiConfig!.apiKey, temperature);
        resolvedModel = aiConfig!.model;
        resolvedProvider = aiConfig!.provider;
      }
    } catch (error: any) {
      // Log error
      await agentAnalyticsService.logTestInteraction({
        user: {
          userId: testerInfo.userId,
          userFullname: testerInfo.fullname,
          userEmail: testerInfo.email,
          userRole: testerInfo.role,
        },
        agentConfigId: config.id,
        agentName: config.agentName,
        agentTitle: config.agentTitle,
        agentVersion: config.version,
        assignment: {
          assignmentId: config.assignmentId,
          assignmentTitle: config.assignment.title,
          courseId: config.assignment.courseId,
          courseTitle: config.assignment.course?.title,
        },
        conversationId,
        messageIndex,
        eventType: 'error',
        messageContent: message,
        errorMessage: error.message,
        errorCode: error.code,
        clientContext: {
          ipAddress: context.ipAddress,
          userAgent: context.userAgent,
          sessionId: context.sessionId,
        },
      });

      throw new AppError(error.message || 'Failed to get AI response', 500);
    }

    const responseTimeMs = Date.now() - startTime;

    // Save assistant message
    const assistantMessage = await prisma.agentTestMessage.create({
      data: {
        conversationId,
        role: 'assistant',
        content: aiResponse,
        messageIndex: messageIndex + 1,
        aiModel: resolvedModel,
        aiProvider: resolvedProvider,
        promptTokens,
        completionTokens,
        totalTokens,
        responseTimeMs,
      },
    });

    // Detect and save CSV datasets from the response. We pass the user's
    // message so the dataset record keeps the prompt that produced the CSV.
    this.detectAndSaveDataset(aiResponse, config, testerInfo.userId, resolvedModel, resolvedProvider, message)
      .catch(err => console.error('[AgentAssignment] Failed to save detected dataset:', err));

    // Log interaction to agent analytics
    await agentAnalyticsService.logTestInteraction({
      user: {
        userId: testerInfo.userId,
        userFullname: testerInfo.fullname,
        userEmail: testerInfo.email,
        userRole: testerInfo.role,
      },
      agentConfigId: config.id,
      agentName: config.agentName,
      agentTitle: config.agentTitle,
      agentVersion: config.version,
      assignment: {
        assignmentId: config.assignmentId,
        assignmentTitle: config.assignment.title,
        courseId: config.assignment.courseId,
        courseTitle: config.assignment.course?.title,
      },
      conversationId,
      conversationMessageCount: messageIndex + 2,
      messageIndex: messageIndex + 1,
      eventType: 'message_received',
      messageContent: message,
      responseContent: aiResponse,
      responseTime: responseTimeMs / 1000,
      aiModel: resolvedModel,
      aiProvider: resolvedProvider,
      promptTokens,
      completionTokens,
      totalTokens,
      clientContext: {
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
        sessionId: context.sessionId,
      },
    });

    // Log to unified activity log for comprehensive tracking. Tagging with
    // `actionSubtype: agent_design.test.response_received` makes this row
    // filterable in admin/logs/activity alongside every other agent design
    // event the client-side bridge emits, even though admins have no access
    // to the instructor-only Design Process view.
    activityLogService.logActivity({
      userId: testerInfo.userId,
      verb: 'interacted',
      objectType: 'agent_conversation',
      objectId: config.id,
      objectTitle: config.agentName || 'Student Agent',
      objectSubtype: 'agent_assignment',
      courseId: config.assignment.courseId,
      duration: responseTimeMs,
      actionSubtype: 'agent_design.test.response_received',
      extensions: {
        conversationId,
        assignmentId: config.assignmentId,
        assignmentTitle: config.assignment.title,
        userMessage: message,
        assistantMessage: aiResponse,
        messageLength: message.length,
        responseLength: aiResponse.length,
        aiModel: resolvedModel,
        aiProvider: resolvedProvider,
        responseTimeMs,
        promptTokens,
        completionTokens,
        totalTokens,
      },
      sessionId: context.sessionId,
      deviceType: context.userAgent?.includes('Mobile') ? 'mobile' : 'desktop',
    }).catch(err => console.error('[AgentAssignment] Failed to log activity:', err));

    return {
      userMessage: { role: 'user', content: message, messageIndex },
      assistantMessage: {
        id: assistantMessage.id,
        role: 'assistant',
        content: aiResponse,
        messageIndex: messageIndex + 1,
        createdAt: assistantMessage.createdAt,
      },
      model: resolvedModel,
      responseTime: responseTimeMs / 1000,
    };
  }

  // Get test conversation history
  async getTestHistory(conversationId: number, userId: number) {
    const conversation = await prisma.agentTestConversation.findUnique({
      where: { id: conversationId },
      include: {
        messages: {
          orderBy: { messageIndex: 'asc' },
        },
        agentConfig: {
          select: {
            userId: true,
            agentName: true,
            welcomeMessage: true,
            avatarImageUrl: true,
          },
        },
      },
    });

    if (!conversation) {
      throw new AppError('Conversation not found', 404);
    }

    // Students can only see their own test conversations
    // (instructors handled by separate endpoint)
    if (conversation.testerId !== userId && conversation.agentConfig.userId !== userId) {
      throw new AppError('Not authorized', 403);
    }

    return conversation;
  }

  // Get all test conversations for a student's agent
  async getMyTestConversations(assignmentId: number, userId: number) {
    const config = await prisma.studentAgentConfig.findUnique({
      where: {
        assignmentId_userId: { assignmentId, userId },
      },
    });

    if (!config) {
      return [];
    }

    return prisma.agentTestConversation.findMany({
      where: {
        agentConfigId: config.id,
        testerId: userId,
        messages: { some: {} }, // Only conversations with at least 1 message
      },
      include: {
        messages: {
          orderBy: { messageIndex: 'asc' },
        },
        _count: {
          select: { messages: true },
        },
      },
      orderBy: { startedAt: 'desc' },
    });
  }

  // =============================================================================
  // INSTRUCTOR METHODS
  // =============================================================================

  // Get all submissions for an assignment (instructor)
  async getAgentSubmissions(assignmentId: number, instructorId: number, isAdmin = false) {
    const assignment = await this.getAgentAssignment(assignmentId);

    if (assignment.course.instructorId !== instructorId && !isAdmin) {
      throw new AppError('Not authorized', 403);
    }

    const configs = await prisma.studentAgentConfig.findMany({
      where: { assignmentId },
      include: {
        submission: {
          select: {
            id: true,
            status: true,
            grade: true,
            feedback: true,
            submittedAt: true,
            gradedAt: true,
          },
        },
        _count: {
          // Only count test conversations that actually have messages.
          // Students who click "Start Test Conversation" and never type leave
          // behind empty AgentTestConversation rows that would otherwise
          // inflate the conversation count on the instructor submissions list.
          select: {
            testConversations: {
              where: { messages: { some: {} } },
            },
          },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });

    // Get user info
    const userIds = configs.map(c => c.userId);
    const users = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, fullname: true, email: true },
    });
    const userMap = new Map(users.map(u => [u.id, u]));

    return configs.map(config => ({
      ...config,
      user: userMap.get(config.userId),
      dosRules: config.dosRules ? JSON.parse(config.dosRules) : [],
      dontsRules: config.dontsRules ? JSON.parse(config.dontsRules) : [],
    }));
  }

  // Get single submission details (instructor)
  async getAgentSubmissionDetail(
    assignmentId: number,
    submissionId: number,
    instructorId: number,
    isAdmin = false
  ) {
    const assignment = await this.getAgentAssignment(assignmentId);

    if (assignment.course.instructorId !== instructorId && !isAdmin) {
      throw new AppError('Not authorized', 403);
    }

    const submission = await prisma.assignmentSubmission.findUnique({
      where: { id: submissionId },
      include: {
        user: {
          select: { id: true, fullname: true, email: true },
        },
        agentConfig: {
          include: {
            _count: {
              // Match the submissions-list behaviour: only count conversations
              // that have at least one message.
              select: {
                testConversations: {
                  where: { messages: { some: {} } },
                },
              },
            },
          },
        },
      },
    });

    if (!submission || !submission.agentConfig) {
      throw new AppError('Submission not found', 404);
    }

    // Use the shared formatConfig helper so every JSON-string field
    // (dosRules, dontsRules, suggestedQuestions, selectedPromptBlocks)
    // is parsed back into its real array/object shape. Before this
    // fix, suggestedQuestions and selectedPromptBlocks leaked through
    // as raw JSON strings and crashed any caller that did
    // `.slice(...).map(...)` on them.
    return {
      ...submission,
      agentConfig: this.formatConfig(submission.agentConfig),
    };
  }

  // Get config history (instructor)
  async getConfigHistory(agentConfigId: number, instructorId: number, isAdmin = false) {
    const config = await prisma.studentAgentConfig.findUnique({
      where: { id: agentConfigId },
      include: {
        assignment: {
          include: { course: { select: { instructorId: true } } },
        },
      },
    });

    if (!config) {
      throw new AppError('Agent config not found', 404);
    }

    if (config.assignment.course.instructorId !== instructorId && !isAdmin) {
      throw new AppError('Not authorized', 403);
    }

    return agentAnalyticsService.getConfigurationHistory(agentConfigId);
  }

  // Get all test conversations for a submission (instructor)
  async getSubmissionTestConversations(
    agentConfigId: number,
    instructorId: number,
    isAdmin = false
  ) {
    const config = await prisma.studentAgentConfig.findUnique({
      where: { id: agentConfigId },
      include: {
        assignment: {
          include: { course: { select: { instructorId: true } } },
        },
      },
    });

    if (!config) {
      throw new AppError('Agent config not found', 404);
    }

    if (config.assignment.course.instructorId !== instructorId && !isAdmin) {
      throw new AppError('Not authorized', 403);
    }

    return agentAnalyticsService.getTestConversations(agentConfigId);
  }

  // Grade agent submission (instructor)
  async gradeAgentSubmission(
    submissionId: number,
    instructorId: number,
    data: GradeAgentSubmissionInput,
    isAdmin = false,
    context: EventContext
  ) {
    const submission = await prisma.assignmentSubmission.findUnique({
      where: { id: submissionId },
      include: {
        assignment: {
          include: { course: { select: { id: true, title: true, instructorId: true } } },
        },
        user: {
          select: { id: true, fullname: true, email: true },
        },
        agentConfig: true,
      },
    });

    if (!submission || !submission.agentConfig) {
      throw new AppError('Submission not found', 404);
    }

    if (submission.assignment.course.instructorId !== instructorId && !isAdmin) {
      throw new AppError('Not authorized', 403);
    }

    const previousGrade = submission.grade;
    const previousFeedback = submission.feedback;

    // Update submission
    const updated = await prisma.assignmentSubmission.update({
      where: { id: submissionId },
      data: {
        grade: data.grade,
        feedback: data.feedback,
        gradedAt: new Date(),
        gradedById: instructorId,
        status: 'graded',
      },
      include: {
        user: {
          select: { id: true, fullname: true, email: true },
        },
      },
    });

    // Log grade event
    const configSnapshot = agentAnalyticsService.createConfigSnapshot(submission.agentConfig);
    await agentAnalyticsService.logGradeEvent({
      agentConfigId: submission.agentConfig.id,
      grader: {
        userId: instructorId,
        userFullname: context.userFullname,
        userEmail: context.userEmail,
      },
      student: {
        userId: submission.user!.id,
        userFullname: submission.user!.fullname,
        userEmail: submission.user!.email,
      },
      assignment: {
        assignmentId: submission.assignmentId,
        assignmentTitle: submission.assignment.title,
        courseId: submission.assignment.course.id,
        courseTitle: submission.assignment.course.title,
      },
      configVersion: submission.agentConfig.version,
      configSnapshot,
      previousGrade,
      newGrade: data.grade,
      previousFeedback,
      newFeedback: data.feedback,
      maxPoints: submission.assignment.points,
      clientContext: {
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
        sessionId: context.sessionId,
      },
    });

    return updated;
  }

  // =============================================================================
  // HELPER METHODS
  // =============================================================================

  private async getAgentAssignment(assignmentId: number) {
    const assignment = await prisma.assignment.findUnique({
      where: { id: assignmentId },
      include: {
        course: {
          select: { id: true, title: true, instructorId: true },
        },
      },
    });

    if (!assignment) {
      throw new AppError('Assignment not found', 404);
    }

    if (assignment.submissionType !== 'ai_agent') {
      throw new AppError('This is not an AI agent assignment', 400);
    }

    return assignment;
  }

  private async checkEnrollment(userId: number, courseId: number) {
    const enrollment = await prisma.enrollment.findUnique({
      where: {
        userId_courseId: { userId, courseId },
      },
    });

    if (!enrollment) {
      throw new AppError('You must be enrolled to submit', 403);
    }
  }

  // =============================================================================
  // DATASET GENERATION
  // =============================================================================

  async generateDataset(
    assignmentId: number,
    userId: number,
    description: string,
    context: EventContext,
    llmOverrides?: { model?: string; provider?: string }
  ) {
    const config = await prisma.studentAgentConfig.findUnique({
      where: { assignmentId_userId: { assignmentId, userId } },
      include: { assignment: { include: { course: { select: { id: true, title: true } } } } },
    });
    if (!config) {
      throw new AppError('Agent config not found', 404);
    }

    const agentPrompt = this.buildSystemPrompt(config);

    // Resolve provider: prefer openai, fall back to default
    const datasetProvider = llmOverrides?.provider || await this.resolveDatasetProvider();

    // Step 1: Intent classification (fast, small call)
    const classifyResponse = await llmService.chat({
      messages: [
        {
          role: 'system',
          content: `You are an intent classifier. Determine if the user's message is a valid dataset generation request.

A VALID request describes what kind of tabular data to generate — it mentions data, columns, rows, records, samples, survey responses, students, measurements, or similar concepts that can be represented as a CSV table.

INVALID requests include: greetings, casual conversation, questions not about data, jokes, code requests, general chat, or anything that does not ask for generating structured tabular data.

Respond with ONLY one word: "valid" or "invalid". Nothing else.`,
        },
        { role: 'user', content: description },
      ],
      maxTokens: 10,
      temperature: 0,
      ...(datasetProvider ? { provider: datasetProvider as any } : {}),
      ...(llmOverrides?.model ? { model: llmOverrides.model } : {}),
    });

    const classifyResult = (typeof classifyResponse.choices[0]?.message?.content === 'string'
      ? classifyResponse.choices[0].message.content : '').trim().toLowerCase();

    if (classifyResult !== 'valid') {
      throw new AppError(
        'Your request doesn\'t appear to be about generating a dataset. Please describe the dataset you\'d like to create — for example: "Generate 50 student survey responses with columns for age, gender, and motivation score".',
        400
      );
    }

    // Step 2: Generate the dataset
    const systemPrompt = `${agentPrompt}

---

## Dataset Generation Task

You are now being asked to generate a synthetic dataset. Use your persona, knowledge, and expertise to create realistic, diverse data.

You MUST respond with ONLY a JSON object — no markdown, no code fences, no explanation outside the JSON. The JSON object must have exactly two keys:

{
  "explanation": "A 2-3 sentence description of the dataset, including what each column represents.",
  "rows": [
    {"column1": "value1", "column2": "value2"},
    {"column1": "value3", "column2": "value4"}
  ]
}

CRITICAL RULES:
- Output ONLY a JSON object. No markdown, no code fences, no text before or after.
- "rows" must be a JSON array of objects. Every object must have the same keys.
- ROW COUNT: The user will request a specific number of rows. You MUST generate at least 90% of the requested amount and no more than 110%. For example, if the user asks for 100 rows, generate between 90 and 110 rows. If the user asks for 50, generate between 45 and 55. Do NOT stop early at 5 or 10 rows. Do NOT summarize or truncate.
- If the user does not specify a number, generate exactly 20 rows.
- Make data realistic and varied — no repetitive patterns. Each row should have unique, plausible values.
- Stay in character: the data should reflect your domain expertise.`;

    // Estimate tokens needed: ~50-80 tokens per row depending on columns
    const rowCountMatch = description.match(/\b(\d+)\s*(?:rows?|items?|entries|samples?|responses?|records?|students?|people|users?|participants?)\b/i);
    const estimatedRows = rowCountMatch ? parseInt(rowCountMatch[1]) : 20;
    const maxTokens = Math.max(4000, Math.min(estimatedRows * 100, 16000));

    const llmResponse = await llmService.chat({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: description },
      ],
      temperature: config.temperature ?? 0.7,
      maxTokens,
      ...(datasetProvider ? { provider: datasetProvider as any } : {}),
      ...(llmOverrides?.model ? { model: llmOverrides.model } : {}),
    });

    const rawContent = llmResponse.choices[0]?.message?.content;
    const contentStr = typeof rawContent === 'string' ? rawContent : '';

    const { explanation, rows } = this.parseDatasetJsonResponse(contentStr);
    if (rows.length === 0) {
      throw new AppError('The AI could not generate a valid dataset from your description. Please be more specific about the data you need — include column names, data types, and the number of rows.', 400);
    }
    const csv = this.jsonRowsToCsv(rows);

    // Save CSV file
    const uploadsDir = path.join(process.cwd(), 'uploads', 'datasets');
    fs.mkdirSync(uploadsDir, { recursive: true });
    const fileName = `${randomUUID()}.csv`;
    const filePath = path.join(uploadsDir, fileName);
    fs.writeFileSync(filePath, csv, 'utf-8');
    const fileSize = Buffer.byteLength(csv, 'utf-8');
    const rowCount = csv.trim().split('\n').length - 1; // minus header

    const dataset = await prisma.userDataset.create({
      data: {
        userId,
        agentConfigId: config.id,
        name: `dataset-${fileName}`,
        description,
        fileName,
        fileUrl: `/uploads/datasets/${fileName}`,
        fileSize,
        fileType: 'text/csv',
        rowCount: rowCount > 0 ? rowCount : null,
        aiModel: llmResponse.model,
        aiProvider: llmResponse.provider,
        agentPrompt: agentPrompt.slice(0, 5000),
        generationConfig: JSON.stringify({
          temperature: config.temperature ?? 0.7,
          maxTokens: 4000,
          agentConfigId: config.id,
          agentConfigVersion: config.version,
        }),
        status: 'completed',
      },
    });

    // CSV preview: first 5 rows
    const lines = csv.trim().split('\n');
    const csvPreview = lines.slice(0, 6).join('\n');

    this.logAgentActivity({
      userId,
      verb: 'created',
      objectId: dataset.id,
      objectTitle: dataset.name,
      courseId: config.assignment.courseId,
      assignmentId: config.assignmentId,
      assignmentTitle: config.assignment.title,
      extensions: {
        action: 'dataset_generated',
        rowCount: dataset.rowCount,
        aiModel: dataset.aiModel,
        aiProvider: dataset.aiProvider,
      },
      context,
    });

    return { dataset, explanation, csvPreview };
  }

  async renameDataset(datasetId: number, userId: number, name: string) {
    const dataset = await prisma.userDataset.findUnique({ where: { id: datasetId } });
    if (!dataset) throw new AppError('Dataset not found', 404);
    if (dataset.userId !== userId) throw new AppError('Unauthorized', 403);

    return prisma.userDataset.update({
      where: { id: datasetId },
      data: { name },
    });
  }

  async deleteDataset(datasetId: number, userId: number) {
    const dataset = await prisma.userDataset.findUnique({ where: { id: datasetId } });
    if (!dataset) throw new AppError('Dataset not found', 404);
    if (dataset.userId !== userId) throw new AppError('Unauthorized', 403);

    // Delete the file
    const filePath = path.join(process.cwd(), 'uploads', 'datasets', dataset.fileName);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

    return prisma.userDataset.delete({ where: { id: datasetId } });
  }

  async getDatasetsByAgentConfigId(agentConfigId: number, instructorId: number, isAdmin = false) {
    const config = await prisma.studentAgentConfig.findUnique({
      where: { id: agentConfigId },
      include: { assignment: { include: { course: { select: { instructorId: true } } } } },
    });
    if (!config) throw new AppError('Agent config not found', 404);
    if (config.assignment.course.instructorId !== instructorId && !isAdmin) {
      throw new AppError('Not authorized', 403);
    }
    return prisma.userDataset.findMany({
      where: { agentConfigId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getAllMyDatasets(userId: number) {
    return prisma.userDataset.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getMyDatasets(assignmentId: number, userId: number) {
    const config = await prisma.studentAgentConfig.findUnique({
      where: { assignmentId_userId: { assignmentId, userId } },
      select: { id: true },
    });
    if (!config) return [];

    return prisma.userDataset.findMany({
      where: { agentConfigId: config.id },
      orderBy: { createdAt: 'desc' },
    });
  }

  private async detectAndSaveDataset(
    response: string,
    config: { id: number; assignmentId: number; agentName: string },
    userId: number,
    aiModel?: string,
    aiProvider?: string,
    userPrompt?: string,
  ) {
    // Look for CSV data in markdown code blocks: ```csv ... ``` or ``` ... ``` with comma-separated lines
    const codeBlockRegex = /```(?:csv|plaintext|text)?\s*\n([\s\S]*?)```/g;
    let match;
    while ((match = codeBlockRegex.exec(response)) !== null) {
      const block = match[1].trim();
      const lines = block.split('\n').filter(l => l.trim());
      if (lines.length < 2) continue;

      // Check if it looks like CSV (consistent comma counts)
      const headerCommas = (lines[0].match(/,/g) || []).length;
      if (headerCommas === 0) continue;

      const isCSV = lines.slice(1).every(line => {
        const commas = (line.match(/,/g) || []).length;
        return commas === headerCommas;
      });
      if (!isCSV) continue;

      // Save as a CSV file
      const uploadsDir = path.join(process.cwd(), 'uploads', 'datasets');
      fs.mkdirSync(uploadsDir, { recursive: true });
      const fileName = `${randomUUID()}.csv`;
      const filePath = path.join(uploadsDir, fileName);
      fs.writeFileSync(filePath, block, 'utf-8');
      const fileSize = Buffer.byteLength(block, 'utf-8');
      const rowCount = lines.length - 1;

      await prisma.userDataset.create({
        data: {
          userId,
          agentConfigId: config.id,
          name: `chat-dataset-${fileName}`,
          description: `Auto-detected from chat with ${config.agentName}`,
          fileName,
          fileUrl: `/uploads/datasets/${fileName}`,
          fileSize,
          fileType: 'text/csv',
          rowCount: rowCount > 0 ? rowCount : null,
          aiModel: aiModel || null,
          aiProvider: aiProvider || null,
          agentPrompt: null,
          userPrompt: userPrompt || null,
          generationConfig: JSON.stringify({ source: 'chat', agentConfigId: config.id }),
          status: 'completed',
        },
      });
      break; // Save only the first CSV block per message
    }
  }

  private async resolveDatasetProvider(): Promise<string | undefined> {
    try {
      const openai = await llmService.getProvider('openai');
      if (openai?.isEnabled) return 'openai';
    } catch {}
    return undefined; // falls back to default provider
  }

  private parseDatasetJsonResponse(raw: string): { explanation: string; rows: Record<string, unknown>[] } {
    const fallback = { explanation: 'Dataset generated by your AI agent.', rows: [] as Record<string, unknown>[] };

    const tryParse = (text: string) => {
      try {
        const parsed = JSON.parse(text);
        if (Array.isArray(parsed.rows) && parsed.rows.length > 0) {
          return { explanation: parsed.explanation || fallback.explanation, rows: parsed.rows };
        }
      } catch {}
      return null;
    };

    // Try direct JSON parse
    const direct = tryParse(raw);
    if (direct) return direct;

    // Try extracting JSON from markdown code block
    const jsonMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      const fromBlock = tryParse(jsonMatch[1].trim());
      if (fromBlock) return fromBlock;
    }

    // Try extracting JSON object from surrounding text
    const braceMatch = raw.match(/\{[\s\S]*"rows"\s*:\s*\[[\s\S]*\][\s\S]*\}/);
    if (braceMatch) {
      const fromBrace = tryParse(braceMatch[0]);
      if (fromBrace) return fromBrace;
    }

    return fallback;
  }

  private jsonRowsToCsv(rows: Record<string, unknown>[]): string {
    if (rows.length === 0) return '';

    const headers = Object.keys(rows[0]);
    const escapeField = (val: unknown): string => {
      const str = val === null || val === undefined ? '' : String(val);
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const lines = [headers.join(',')];
    for (const row of rows) {
      lines.push(headers.map((h) => escapeField(row[h])).join(','));
    }
    return lines.join('\n');
  }

  private buildSystemPrompt(config: {
    systemPrompt: string;
    personaDescription?: string | null;
    dosRules?: string | null;
    dontsRules?: string | null;
    agentName: string;
    personalityPrompt?: string | null;
    responseStyle?: string | null;
    knowledgeContext?: string | null;
  }): string {
    let prompt = '';

    // Add persona description at the start
    if (config.personaDescription) {
      prompt += `You are ${config.agentName}. ${config.personaDescription}\n\n`;
    } else {
      prompt += `You are ${config.agentName}.\n\n`;
    }

    // Add personality instructions
    if (config.personalityPrompt) {
      prompt += `## Personality & Communication Style\n${config.personalityPrompt}\n\n`;
    }

    // Add response style guidance
    if (config.responseStyle) {
      const styleGuides: Record<string, string> = {
        concise: 'Keep your responses brief and to the point. Focus on the essential information.',
        balanced: 'Provide well-rounded responses with appropriate detail. Balance thoroughness with brevity.',
        detailed: 'Provide comprehensive, in-depth responses. Include examples, explanations, and relevant context.',
      };
      if (styleGuides[config.responseStyle]) {
        prompt += `## Response Style\n${styleGuides[config.responseStyle]}\n\n`;
      }
    }

    // Add the main system prompt
    prompt += `## Core Instructions\n${config.systemPrompt}\n`;

    // Add knowledge context
    if (config.knowledgeContext) {
      prompt += `\n## Domain Knowledge & Expertise\n${config.knowledgeContext}\n`;
    }

    // Add behavioral rules
    const dos = config.dosRules ? JSON.parse(config.dosRules) : [];
    const donts = config.dontsRules ? JSON.parse(config.dontsRules) : [];

    if (dos.length > 0) {
      prompt += '\n## Things you SHOULD do:\n';
      dos.forEach((rule: string, i: number) => {
        prompt += `${i + 1}. ${rule}\n`;
      });
    }

    if (donts.length > 0) {
      prompt += '\n## Things you should NOT do:\n';
      donts.forEach((rule: string, i: number) => {
        prompt += `${i + 1}. ${rule}\n`;
      });
    }

    // Data generation capability
    prompt += '\n## Data Generation Capability\n';
    prompt += 'You CAN generate datasets and CSV files. When the user asks for data, a dataset, or a CSV file, generate the data directly inside a markdown code block with the csv language tag. For example:\n';
    prompt += '```csv\ncolumn1,column2,column3\nvalue1,value2,value3\n```\n';
    prompt += 'The system will automatically detect CSV code blocks and offer the user a download button. Never say you cannot generate files — just produce the data in a csv code block.\n';

    return prompt;
  }

  private async chatWithOpenAI(
    messages: { role: 'system' | 'user' | 'assistant'; content: string }[],
    model: string,
    apiKey: string,
    temperature?: number,
    baseUrl?: string
  ): Promise<{ content: string; promptTokens?: number; completionTokens?: number; totalTokens?: number }> {
    const client = new OpenAI({
      apiKey,
      baseURL: baseUrl, // For LM Studio or other OpenAI-compatible endpoints
    });

    // OpenAI's o1/o3 models use max_completion_tokens instead of max_tokens
    // and don't support temperature parameter
    const isO1Model = model.startsWith('o1-') || model.startsWith('o3-');

    // Build request params - only include explicitly provided parameters (Minimal Parameter Principle)
    const requestParams: any = {
      model,
      messages,
    };

    if (isO1Model) {
      // o1 models only support max_completion_tokens, no temperature/top_p etc.
      requestParams.max_completion_tokens = 2000;
      // DO NOT send temperature - will cause an error
    } else {
      requestParams.max_tokens = 2000;
      // Only add temperature if explicitly provided
      if (temperature !== undefined) {
        requestParams.temperature = temperature;
      }
    }

    const response = await client.chat.completions.create(requestParams);

    return {
      content: response.choices[0]?.message?.content || 'No response generated',
      promptTokens: response.usage?.prompt_tokens,
      completionTokens: response.usage?.completion_tokens,
      totalTokens: response.usage?.total_tokens,
    };
  }

  private async chatWithGemini(
    messages: { role: 'system' | 'user' | 'assistant'; content: string }[],
    model: string,
    apiKey: string,
    temperature?: number
  ): Promise<string> {
    const client = new GoogleGenerativeAI(apiKey);

    // Build generation config - only include explicitly provided parameters (Minimal Parameter Principle)
    const generationConfig: any = {};
    if (temperature !== undefined) {
      generationConfig.temperature = temperature;
    }

    const genModel = client.getGenerativeModel({
      model,
      generationConfig: Object.keys(generationConfig).length > 0 ? generationConfig : undefined,
    });

    const systemMessage = messages.find(m => m.role === 'system');
    const conversation = messages.filter(m => m.role !== 'system');

    let prompt = systemMessage ? `${systemMessage.content}\n\n` : '';
    conversation.forEach(m => {
      prompt += `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}\n\n`;
    });

    const result = await genModel.generateContent(prompt);
    const response = await result.response;

    return response.text() || 'No response generated';
  }
}

export const agentAssignmentService = new AgentAssignmentService();
