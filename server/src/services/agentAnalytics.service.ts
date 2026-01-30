import prisma from '../utils/prisma.js';

// Context types for logging
export interface ClientContext {
  ipAddress?: string;
  userAgent?: string;
  sessionId?: string;
  browserName?: string;
  browserVersion?: string;
  osName?: string;
  osVersion?: string;
  deviceType?: string;
  screenWidth?: number;
  screenHeight?: number;
  language?: string;
  timezone?: string;
}

export interface UserContext {
  userId: number;
  userFullname?: string;
  userEmail?: string;
  userRole?: 'student' | 'instructor';
}

export interface AssignmentContext {
  assignmentId: number;
  assignmentTitle?: string;
  courseId?: number;
  courseTitle?: string;
}

export interface AgentConfigSnapshot {
  id: number;
  agentName: string;
  personaDescription?: string | null;
  systemPrompt: string;
  dosRules?: string | null;
  dontsRules?: string | null;
  welcomeMessage?: string | null;
  avatarImageUrl?: string | null;
  version: number;
}

export class AgentAnalyticsService {
  // Helper to create a config snapshot
  createConfigSnapshot(config: any): AgentConfigSnapshot {
    return {
      id: config.id,
      agentName: config.agentName,
      personaDescription: config.personaDescription,
      systemPrompt: config.systemPrompt,
      dosRules: config.dosRules,
      dontsRules: config.dontsRules,
      welcomeMessage: config.welcomeMessage,
      avatarImageUrl: config.avatarImageUrl,
      version: config.version,
    };
  }

  // Log configuration change
  async logConfigurationChange(params: {
    agentConfigId: number;
    user: UserContext;
    assignment: AssignmentContext;
    changeType: 'create' | 'update' | 'submit' | 'unsubmit';
    version: number;
    previousConfigSnapshot?: AgentConfigSnapshot | null;
    newConfigSnapshot: AgentConfigSnapshot;
    changedFields?: string[];
    clientContext?: ClientContext;
  }) {
    try {
      await prisma.agentConfigurationLog.create({
        data: {
          agentConfigId: params.agentConfigId,
          userId: params.user.userId,
          userFullname: params.user.userFullname,
          userEmail: params.user.userEmail,
          assignmentId: params.assignment.assignmentId,
          assignmentTitle: params.assignment.assignmentTitle,
          courseId: params.assignment.courseId,
          courseTitle: params.assignment.courseTitle,
          changeType: params.changeType,
          version: params.version,
          previousConfigSnapshot: params.previousConfigSnapshot
            ? JSON.stringify(params.previousConfigSnapshot)
            : null,
          newConfigSnapshot: JSON.stringify(params.newConfigSnapshot),
          changedFields: params.changedFields ? JSON.stringify(params.changedFields) : null,
          ipAddress: params.clientContext?.ipAddress,
          userAgent: params.clientContext?.userAgent,
          sessionId: params.clientContext?.sessionId,
        },
      });
    } catch (error) {
      console.error('Failed to log configuration change:', error);
    }
  }

  // Log test interaction
  async logTestInteraction(params: {
    user: UserContext;
    agentConfigId: number;
    agentName?: string;
    agentTitle?: string | null;
    agentVersion?: number;
    assignment: AssignmentContext;
    conversationId?: number;
    conversationMessageCount?: number;
    messageIndex?: number;
    eventType: 'test_start' | 'message_sent' | 'message_received' | 'test_end' | 'error';
    eventSequence?: number;
    agentConfigSnapshot?: AgentConfigSnapshot;
    messageContent?: string;
    responseContent?: string;
    responseTime?: number;
    aiModel?: string;
    aiProvider?: string;
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
    errorMessage?: string;
    errorCode?: string;
    errorStack?: string;
    clientContext?: ClientContext;
    metadata?: Record<string, any>;
  }) {
    try {
      const messageCharCount = params.messageContent?.length;
      const messageWordCount = params.messageContent?.split(/\s+/).filter(w => w).length;
      const responseCharCount = params.responseContent?.length;
      const responseWordCount = params.responseContent?.split(/\s+/).filter(w => w).length;

      await prisma.agentTestInteractionLog.create({
        data: {
          userId: params.user.userId,
          userFullname: params.user.userFullname,
          userEmail: params.user.userEmail,
          userRole: params.user.userRole,
          sessionId: params.clientContext?.sessionId,
          agentConfigId: params.agentConfigId,
          agentName: params.agentName,
          agentTitle: params.agentTitle,
          agentVersion: params.agentVersion,
          assignmentId: params.assignment.assignmentId,
          assignmentTitle: params.assignment.assignmentTitle,
          courseId: params.assignment.courseId,
          courseTitle: params.assignment.courseTitle,
          conversationId: params.conversationId,
          conversationMessageCount: params.conversationMessageCount,
          messageIndex: params.messageIndex,
          eventType: params.eventType,
          eventSequence: params.eventSequence,
          agentConfigSnapshot: params.agentConfigSnapshot
            ? JSON.stringify(params.agentConfigSnapshot)
            : null,
          messageContent: params.messageContent,
          messageCharCount,
          messageWordCount,
          responseContent: params.responseContent,
          responseCharCount,
          responseWordCount,
          responseTime: params.responseTime,
          aiModel: params.aiModel,
          aiProvider: params.aiProvider,
          promptTokens: params.promptTokens,
          completionTokens: params.completionTokens,
          totalTokens: params.totalTokens,
          errorMessage: params.errorMessage,
          errorCode: params.errorCode,
          errorStack: params.errorStack,
          ipAddress: params.clientContext?.ipAddress,
          userAgent: params.clientContext?.userAgent,
          browserName: params.clientContext?.browserName,
          browserVersion: params.clientContext?.browserVersion,
          osName: params.clientContext?.osName,
          osVersion: params.clientContext?.osVersion,
          deviceType: params.clientContext?.deviceType,
          screenWidth: params.clientContext?.screenWidth,
          screenHeight: params.clientContext?.screenHeight,
          language: params.clientContext?.language,
          timezone: params.clientContext?.timezone,
          timestampMs: BigInt(Date.now()),
          metadata: params.metadata ? JSON.stringify(params.metadata) : null,
        },
      });
    } catch (error) {
      console.error('Failed to log test interaction:', error);
    }
  }

  // Log grade event
  async logGradeEvent(params: {
    agentConfigId: number;
    grader: UserContext;
    student: UserContext;
    assignment: AssignmentContext;
    configVersion: number;
    configSnapshot: AgentConfigSnapshot;
    previousGrade?: number | null;
    newGrade: number;
    previousFeedback?: string | null;
    newFeedback?: string | null;
    maxPoints?: number;
    clientContext?: ClientContext;
  }) {
    try {
      await prisma.agentGradeLog.create({
        data: {
          agentConfigId: params.agentConfigId,
          graderId: params.grader.userId,
          graderFullname: params.grader.userFullname,
          graderEmail: params.grader.userEmail,
          studentId: params.student.userId,
          studentFullname: params.student.userFullname,
          studentEmail: params.student.userEmail,
          assignmentId: params.assignment.assignmentId,
          assignmentTitle: params.assignment.assignmentTitle,
          courseId: params.assignment.courseId,
          courseTitle: params.assignment.courseTitle,
          maxPoints: params.maxPoints,
          previousGrade: params.previousGrade,
          newGrade: params.newGrade,
          previousFeedback: params.previousFeedback,
          newFeedback: params.newFeedback,
          configVersion: params.configVersion,
          configSnapshot: JSON.stringify(params.configSnapshot),
          ipAddress: params.clientContext?.ipAddress,
          userAgent: params.clientContext?.userAgent,
          sessionId: params.clientContext?.sessionId,
        },
      });
    } catch (error) {
      console.error('Failed to log grade event:', error);
    }
  }

  // Get configuration history for an agent config
  async getConfigurationHistory(agentConfigId: number) {
    return prisma.agentConfigurationLog.findMany({
      where: { agentConfigId },
      orderBy: { timestamp: 'desc' },
    });
  }

  // Get test conversations for an agent config
  async getTestConversations(agentConfigId: number) {
    return prisma.agentTestConversation.findMany({
      where: { agentConfigId },
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

  // Get grade history for an agent config
  async getGradeHistory(agentConfigId: number) {
    return prisma.agentGradeLog.findMany({
      where: { agentConfigId },
      orderBy: { timestamp: 'desc' },
    });
  }

  // Get all interaction logs for an assignment (instructor view)
  async getAssignmentInteractionLogs(assignmentId: number, limit = 1000) {
    return prisma.agentTestInteractionLog.findMany({
      where: { assignmentId },
      orderBy: { timestamp: 'desc' },
      take: limit,
    });
  }

  // Export logs for research
  async exportAgentLogs(params: {
    assignmentId?: number;
    courseId?: number;
    startDate?: Date;
    endDate?: Date;
  }) {
    const where: any = {};

    if (params.assignmentId) where.assignmentId = params.assignmentId;
    if (params.courseId) where.courseId = params.courseId;
    if (params.startDate || params.endDate) {
      where.timestamp = {};
      if (params.startDate) where.timestamp.gte = params.startDate;
      if (params.endDate) where.timestamp.lte = params.endDate;
    }

    const [configLogs, interactionLogs, gradeLogs] = await Promise.all([
      prisma.agentConfigurationLog.findMany({ where, orderBy: { timestamp: 'asc' } }),
      prisma.agentTestInteractionLog.findMany({ where, orderBy: { timestamp: 'asc' } }),
      prisma.agentGradeLog.findMany({ where, orderBy: { timestamp: 'asc' } }),
    ]);

    return {
      configurationLogs: configLogs,
      interactionLogs: interactionLogs,
      gradeLogs: gradeLogs,
    };
  }
}

export const agentAnalyticsService = new AgentAnalyticsService();
