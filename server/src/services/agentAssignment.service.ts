import OpenAI from 'openai';
import { GoogleGenerativeAI } from '@google/generative-ai';
import prisma from '../utils/prisma.js';
import { AppError } from '../middleware/error.middleware.js';
import { CreateAgentConfigInput, UpdateAgentConfigInput, GradeAgentSubmissionInput } from '../utils/validation.js';
import { agentAnalyticsService, ClientContext, UserContext, AssignmentContext } from './agentAnalytics.service.js';

// AI Config type
interface AIConfig {
  provider: 'openai' | 'gemini';
  model: string;
  apiKey: string;
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
          select: { testConversations: true },
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
      config,
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
        personaDescription: data.personaDescription,
        systemPrompt: data.systemPrompt,
        dosRules: data.dosRules ? JSON.stringify(data.dosRules) : null,
        dontsRules: data.dontsRules ? JSON.stringify(data.dontsRules) : null,
        welcomeMessage: data.welcomeMessage,
        avatarImageUrl: data.avatarImageUrl,
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

    return config;
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
    if (data.personaDescription !== undefined && data.personaDescription !== existing.personaDescription) changedFields.push('personaDescription');
    if (data.systemPrompt !== undefined && data.systemPrompt !== existing.systemPrompt) changedFields.push('systemPrompt');
    if (data.dosRules !== undefined) changedFields.push('dosRules');
    if (data.dontsRules !== undefined) changedFields.push('dontsRules');
    if (data.welcomeMessage !== undefined && data.welcomeMessage !== existing.welcomeMessage) changedFields.push('welcomeMessage');
    if (data.avatarImageUrl !== undefined && data.avatarImageUrl !== existing.avatarImageUrl) changedFields.push('avatarImageUrl');

    const newVersion = existing.version + 1;

    const updated = await prisma.studentAgentConfig.update({
      where: { id: existing.id },
      data: {
        agentName: data.agentName,
        personaDescription: data.personaDescription,
        systemPrompt: data.systemPrompt,
        dosRules: data.dosRules ? JSON.stringify(data.dosRules) : undefined,
        dontsRules: data.dontsRules ? JSON.stringify(data.dontsRules) : undefined,
        welcomeMessage: data.welcomeMessage,
        avatarImageUrl: data.avatarImageUrl,
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

    return updated;
  }

  // =============================================================================
  // SUBMISSION FLOW
  // =============================================================================

  // Submit agent for grading
  async submitAgentConfig(assignmentId: number, userId: number, context: EventContext) {
    const assignment = await this.getAgentAssignment(assignmentId);

    // Check due date
    if (assignment.dueDate && new Date() > assignment.dueDate) {
      throw new AppError('Assignment due date has passed', 400);
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
    context: EventContext
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
    const aiConfig = await this.getAIConfig();

    if (!aiConfig) {
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
    let promptTokens: number | undefined;
    let completionTokens: number | undefined;
    let totalTokens: number | undefined;

    try {
      if (aiConfig.provider === 'openai') {
        const result = await this.chatWithOpenAI(chatMessages, aiConfig.model, aiConfig.apiKey);
        aiResponse = result.content;
        promptTokens = result.promptTokens;
        completionTokens = result.completionTokens;
        totalTokens = result.totalTokens;
      } else {
        aiResponse = await this.chatWithGemini(chatMessages, aiConfig.model, aiConfig.apiKey);
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
        aiModel: aiConfig.model,
        aiProvider: aiConfig.provider,
        promptTokens,
        completionTokens,
        totalTokens,
        responseTimeMs,
      },
    });

    // Log interaction
    await agentAnalyticsService.logTestInteraction({
      user: {
        userId: testerInfo.userId,
        userFullname: testerInfo.fullname,
        userEmail: testerInfo.email,
        userRole: testerInfo.role,
      },
      agentConfigId: config.id,
      agentName: config.agentName,
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
      aiModel: aiConfig.model,
      aiProvider: aiConfig.provider,
      promptTokens,
      completionTokens,
      totalTokens,
      clientContext: {
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
        sessionId: context.sessionId,
      },
    });

    return {
      userMessage: { role: 'user', content: message, messageIndex },
      assistantMessage: {
        id: assistantMessage.id,
        role: 'assistant',
        content: aiResponse,
        messageIndex: messageIndex + 1,
        createdAt: assistantMessage.createdAt,
      },
      model: aiConfig.model,
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
        testerId: userId, // Only student's own tests
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
          select: { testConversations: true },
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
              select: { testConversations: true },
            },
          },
        },
      },
    });

    if (!submission || !submission.agentConfig) {
      throw new AppError('Submission not found', 404);
    }

    return {
      ...submission,
      agentConfig: {
        ...submission.agentConfig,
        dosRules: submission.agentConfig.dosRules
          ? JSON.parse(submission.agentConfig.dosRules)
          : [],
        dontsRules: submission.agentConfig.dontsRules
          ? JSON.parse(submission.agentConfig.dontsRules)
          : [],
      },
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

  private buildSystemPrompt(config: {
    systemPrompt: string;
    personaDescription?: string | null;
    dosRules?: string | null;
    dontsRules?: string | null;
    agentName: string;
  }): string {
    let prompt = config.systemPrompt;

    if (config.personaDescription) {
      prompt = `${config.personaDescription}\n\n${prompt}`;
    }

    const dos = config.dosRules ? JSON.parse(config.dosRules) : [];
    const donts = config.dontsRules ? JSON.parse(config.dontsRules) : [];

    if (dos.length > 0) {
      prompt += '\n\n## Things you SHOULD do:\n';
      dos.forEach((rule: string, i: number) => {
        prompt += `${i + 1}. ${rule}\n`;
      });
    }

    if (donts.length > 0) {
      prompt += '\n\n## Things you should NOT do:\n';
      donts.forEach((rule: string, i: number) => {
        prompt += `${i + 1}. ${rule}\n`;
      });
    }

    return prompt;
  }

  private async chatWithOpenAI(
    messages: { role: 'system' | 'user' | 'assistant'; content: string }[],
    model: string,
    apiKey: string
  ): Promise<{ content: string; promptTokens?: number; completionTokens?: number; totalTokens?: number }> {
    const client = new OpenAI({ apiKey });

    const response = await client.chat.completions.create({
      model,
      messages,
      max_tokens: 2000,
      temperature: 0.7,
    });

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
    apiKey: string
  ): Promise<string> {
    const client = new GoogleGenerativeAI(apiKey);
    const genModel = client.getGenerativeModel({ model });

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
