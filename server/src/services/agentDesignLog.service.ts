/**
 * Agent Design Log Service
 *
 * Server-side service for handling agent design event logging.
 * Provides batch event processing, analytics, and instructor view queries.
 */

import prisma from '../utils/prisma.js';
import { AppError } from '../middleware/error.middleware.js';

// Event types
type AgentDesignEventType =
  | 'design_session_start'
  | 'design_session_end'
  | 'design_session_pause'
  | 'design_session_resume'
  | 'tab_switch'
  | 'tab_time_recorded'
  | 'field_focus'
  | 'field_blur'
  | 'field_change'
  | 'field_paste'
  | 'field_clear'
  | 'role_selected'
  | 'template_viewed'
  | 'template_applied'
  | 'template_modified'
  | 'personality_selected'
  | 'suggestion_viewed'
  | 'suggestion_applied'
  | 'prompt_block_selected'
  | 'prompt_block_removed'
  | 'prompt_blocks_reordered'
  | 'prompt_block_custom_added'
  | 'rule_added'
  | 'rule_removed'
  | 'rule_edited'
  | 'rule_reordered'
  | 'test_conversation_started'
  | 'test_message_sent'
  | 'test_response_received'
  | 'test_conversation_reset'
  | 'post_test_edit'
  | 'reflection_prompt_shown'
  | 'reflection_dismissed'
  | 'reflection_submitted'
  | 'draft_saved'
  | 'submission_attempted'
  | 'submission_completed'
  | 'unsubmit_requested';

type AgentDesignEventCategory =
  | 'session'
  | 'navigation'
  | 'field'
  | 'template'
  | 'rule'
  | 'test'
  | 'reflection'
  | 'save';

interface DesignEventInput {
  userId: number;
  assignmentId: number;
  agentConfigId?: number;
  sessionId: string;
  designSessionId: string;
  eventType: AgentDesignEventType;
  eventCategory: AgentDesignEventCategory;
  timestamp: string | Date;
  version?: number;
  fieldName?: string;
  previousValue?: string;
  newValue?: string;
  changeType?: string;
  characterCount?: number;
  wordCount?: number;
  timeOnTab?: number;
  totalDesignTime?: number;
  activeTab?: string;
  usedTemplate?: boolean;
  templateName?: string;
  usedSuggestion?: boolean;
  suggestionSource?: string;
  roleSelected?: string;
  personalitySelected?: string;
  // Prompt block tracking
  promptBlockId?: string;
  promptBlockCategory?: string;
  selectedBlockIds?: string[];
  // Reflection tracking
  reflectionPromptId?: string;
  reflectionPromptText?: string;
  reflectionResponse?: string;
  reflectionDismissed?: boolean;
  testConversationId?: number;
  testMessageCount?: number;
  ipAddress?: string;
  deviceType?: string;
  browserName?: string;
  userAgent?: string;
  agentConfigSnapshot?: Record<string, unknown>;
}

export class AgentDesignLogService {
  /**
   * Log a batch of design events
   */
  async logEventBatch(
    events: DesignEventInput[],
    clientContext?: { ipAddress?: string }
  ): Promise<{ logged: number; failed: number }> {
    if (!events || events.length === 0) {
      return { logged: 0, failed: 0 };
    }

    let logged = 0;
    let failed = 0;

    // Process events in batches for database efficiency
    const batchSize = 100;
    for (let i = 0; i < events.length; i += batchSize) {
      const batch = events.slice(i, i + batchSize);

      try {
        await prisma.agentDesignEventLog.createMany({
          data: batch.map((event) => ({
            userId: event.userId,
            assignmentId: event.assignmentId,
            agentConfigId: event.agentConfigId || null,
            sessionId: event.sessionId,
            designSessionId: event.designSessionId,
            eventType: event.eventType,
            eventCategory: event.eventCategory,
            timestamp: new Date(event.timestamp),
            version: event.version || null,
            fieldName: event.fieldName || null,
            previousValue: event.previousValue || null,
            newValue: event.newValue || null,
            changeType: event.changeType || null,
            characterCount: event.characterCount || null,
            wordCount: event.wordCount || null,
            timeOnTab: event.timeOnTab || null,
            totalDesignTime: event.totalDesignTime || null,
            activeTab: event.activeTab || null,
            usedTemplate: event.usedTemplate || false,
            templateName: event.templateName || null,
            usedSuggestion: event.usedSuggestion || false,
            suggestionSource: event.suggestionSource || null,
            roleSelected: event.roleSelected || null,
            personalitySelected: event.personalitySelected || null,
            promptBlockId: event.promptBlockId || null,
            promptBlockCategory: event.promptBlockCategory || null,
            selectedBlockIds: event.selectedBlockIds
              ? JSON.stringify(event.selectedBlockIds)
              : null,
            reflectionPromptId: event.reflectionPromptId || null,
            reflectionPromptText: event.reflectionPromptText || null,
            reflectionResponse: event.reflectionResponse || null,
            reflectionDismissed: event.reflectionDismissed || false,
            testConversationId: event.testConversationId || null,
            testMessageCount: event.testMessageCount || null,
            ipAddress: clientContext?.ipAddress || event.ipAddress || null,
            deviceType: event.deviceType || null,
            browserName: event.browserName || null,
            userAgent: event.userAgent || null,
            agentConfigSnapshot: event.agentConfigSnapshot
              ? JSON.stringify(event.agentConfigSnapshot)
              : null,
          })),
        });
        logged += batch.length;
      } catch (error) {
        console.error('Failed to log design event batch:', error);
        failed += batch.length;
      }
    }

    return { logged, failed };
  }

  /**
   * Get design events for a student's agent config (instructor view)
   */
  async getDesignEventsForConfig(
    agentConfigId: number,
    instructorId: number,
    isAdmin = false
  ): Promise<{
    events: Array<Record<string, unknown>>;
    analytics: Record<string, unknown>;
  }> {
    // Verify instructor access
    const config = await prisma.studentAgentConfig.findUnique({
      where: { id: agentConfigId },
      include: {
        assignment: {
          include: {
            course: {
              select: { instructorId: true },
            },
          },
        },
      },
    });

    if (!config) {
      throw new AppError('Agent config not found', 404);
    }

    if (config.assignment.course.instructorId !== instructorId && !isAdmin) {
      throw new AppError('Not authorized', 403);
    }

    // Get all events
    const events = await prisma.agentDesignEventLog.findMany({
      where: { agentConfigId },
      orderBy: { timestamp: 'asc' },
    });

    // Calculate analytics
    const analytics = this.calculateAnalytics(events);

    return {
      events: events.map((e) => ({
        ...e,
        agentConfigSnapshot: e.agentConfigSnapshot
          ? JSON.parse(e.agentConfigSnapshot as string)
          : null,
      })),
      analytics,
    };
  }

  /**
   * Get design events by assignment (for student who doesn't have config yet)
   */
  async getDesignEventsByAssignment(
    assignmentId: number,
    userId: number
  ): Promise<Array<Record<string, unknown>>> {
    const events = await prisma.agentDesignEventLog.findMany({
      where: {
        assignmentId,
        userId,
      },
      orderBy: { timestamp: 'asc' },
    });

    return events.map((e) => ({
      ...e,
      agentConfigSnapshot: e.agentConfigSnapshot
        ? JSON.parse(e.agentConfigSnapshot as string)
        : null,
    }));
  }

  /**
   * Get design timeline for instructor view
   */
  async getDesignTimeline(
    agentConfigId: number,
    instructorId: number,
    isAdmin = false,
    options: {
      category?: AgentDesignEventCategory;
      limit?: number;
      offset?: number;
    } = {}
  ): Promise<{
    timeline: Array<Record<string, unknown>>;
    total: number;
  }> {
    // Verify access
    const config = await prisma.studentAgentConfig.findUnique({
      where: { id: agentConfigId },
      include: {
        assignment: {
          include: {
            course: {
              select: { instructorId: true },
            },
          },
        },
      },
    });

    if (!config) {
      throw new AppError('Agent config not found', 404);
    }

    if (config.assignment.course.instructorId !== instructorId && !isAdmin) {
      throw new AppError('Not authorized', 403);
    }

    const where: Record<string, unknown> = { agentConfigId };
    if (options.category) {
      where.eventCategory = options.category;
    }

    const [events, total] = await Promise.all([
      prisma.agentDesignEventLog.findMany({
        where,
        orderBy: { timestamp: 'asc' },
        take: options.limit || 500,
        skip: options.offset || 0,
      }),
      prisma.agentDesignEventLog.count({ where }),
    ]);

    return {
      timeline: events.map((e) => ({
        ...e,
        agentConfigSnapshot: e.agentConfigSnapshot
          ? JSON.parse(e.agentConfigSnapshot as string)
          : null,
      })),
      total,
    };
  }

  /**
   * Get point-in-time config snapshot
   */
  async getConfigAtTime(
    agentConfigId: number,
    timestamp: Date,
    instructorId: number,
    isAdmin = false
  ): Promise<Record<string, unknown> | null> {
    // Verify access
    const config = await prisma.studentAgentConfig.findUnique({
      where: { id: agentConfigId },
      include: {
        assignment: {
          include: {
            course: {
              select: { instructorId: true },
            },
          },
        },
      },
    });

    if (!config) {
      throw new AppError('Agent config not found', 404);
    }

    if (config.assignment.course.instructorId !== instructorId && !isAdmin) {
      throw new AppError('Not authorized', 403);
    }

    // Find the closest snapshot before or at the timestamp
    const event = await prisma.agentDesignEventLog.findFirst({
      where: {
        agentConfigId,
        timestamp: { lte: timestamp },
        agentConfigSnapshot: { not: null },
      },
      orderBy: { timestamp: 'desc' },
    });

    if (!event || !event.agentConfigSnapshot) {
      return null;
    }

    return JSON.parse(event.agentConfigSnapshot as string);
  }

  /**
   * Get design analytics for assignment (instructor summary)
   */
  async getAssignmentDesignAnalytics(
    assignmentId: number,
    instructorId: number,
    isAdmin = false
  ): Promise<{
    totalStudents: number;
    averageDesignTime: number;
    averageIterations: number;
    averageTestConversations: number;
    roleUsageStats: Record<string, number>;
    personalityUsageStats: Record<string, number>;
  }> {
    // Verify access
    const assignment = await prisma.assignment.findUnique({
      where: { id: assignmentId },
      include: {
        course: {
          select: { instructorId: true },
        },
      },
    });

    if (!assignment) {
      throw new AppError('Assignment not found', 404);
    }

    if (assignment.course.instructorId !== instructorId && !isAdmin) {
      throw new AppError('Not authorized', 403);
    }

    // Get all configs for this assignment
    const configs = await prisma.studentAgentConfig.findMany({
      where: { assignmentId },
      select: {
        id: true,
        totalDesignTime: true,
        iterationCount: true,
        testConversationCount: true,
        pedagogicalRole: true,
        personality: true,
      },
    });

    // Calculate stats
    const totalStudents = configs.length;
    const designTimes = configs
      .filter((c) => c.totalDesignTime !== null)
      .map((c) => c.totalDesignTime!);
    const averageDesignTime =
      designTimes.length > 0
        ? designTimes.reduce((a, b) => a + b, 0) / designTimes.length
        : 0;

    const iterations = configs
      .filter((c) => c.iterationCount !== null)
      .map((c) => c.iterationCount!);
    const averageIterations =
      iterations.length > 0
        ? iterations.reduce((a, b) => a + b, 0) / iterations.length
        : 0;

    const testCounts = configs
      .filter((c) => c.testConversationCount !== null)
      .map((c) => c.testConversationCount!);
    const averageTestConversations =
      testCounts.length > 0
        ? testCounts.reduce((a, b) => a + b, 0) / testCounts.length
        : 0;

    // Role usage
    const roleUsageStats: Record<string, number> = {};
    configs.forEach((c) => {
      if (c.pedagogicalRole) {
        roleUsageStats[c.pedagogicalRole] =
          (roleUsageStats[c.pedagogicalRole] || 0) + 1;
      }
    });

    // Personality usage
    const personalityUsageStats: Record<string, number> = {};
    configs.forEach((c) => {
      if (c.personality) {
        personalityUsageStats[c.personality] =
          (personalityUsageStats[c.personality] || 0) + 1;
      }
    });

    return {
      totalStudents,
      averageDesignTime: Math.round(averageDesignTime),
      averageIterations: Math.round(averageIterations * 10) / 10,
      averageTestConversations: Math.round(averageTestConversations * 10) / 10,
      roleUsageStats,
      personalityUsageStats,
    };
  }

  /**
   * Get reflection responses for a student's config
   */
  async getReflectionResponses(
    agentConfigId: number,
    instructorId: number,
    isAdmin = false
  ): Promise<Array<{ promptId: string; promptText: string; response: string; timestamp: Date }>> {
    // Verify access
    const config = await prisma.studentAgentConfig.findUnique({
      where: { id: agentConfigId },
      include: {
        assignment: {
          include: {
            course: {
              select: { instructorId: true },
            },
          },
        },
      },
    });

    if (!config) {
      throw new AppError('Agent config not found', 404);
    }

    if (config.assignment.course.instructorId !== instructorId && !isAdmin) {
      throw new AppError('Not authorized', 403);
    }

    const events = await prisma.agentDesignEventLog.findMany({
      where: {
        agentConfigId,
        eventType: 'reflection_submitted',
        reflectionResponse: { not: null },
      },
      orderBy: { timestamp: 'asc' },
    });

    return events.map((e) => ({
      promptId: e.reflectionPromptId!,
      promptText: e.reflectionPromptText || '',
      response: e.reflectionResponse!,
      timestamp: e.timestamp,
    }));
  }

  /**
   * Calculate analytics from events
   */
  private calculateAnalytics(
    events: Array<{
      eventType: string;
      eventCategory: string;
      totalDesignTime?: number | null;
      testConversationId?: number | null;
      roleSelected?: string | null;
      personalitySelected?: string | null;
      usedTemplate?: boolean;
      reflectionPromptId?: string | null;
      reflectionResponse?: string | null;
    }>
  ): Record<string, unknown> {
    // Total design time (from last session end event)
    const sessionEndEvents = events.filter(
      (e) => e.eventType === 'design_session_end' && e.totalDesignTime
    );
    const totalDesignTime =
      sessionEndEvents.length > 0
        ? Math.max(...sessionEndEvents.map((e) => e.totalDesignTime || 0))
        : 0;

    // Iteration count (number of draft_saved after test events)
    let hasTestedSinceLastSave = false;
    let iterationCount = 0;
    for (const event of events) {
      if (event.eventType === 'test_conversation_started') {
        hasTestedSinceLastSave = true;
      } else if (event.eventType === 'draft_saved' && hasTestedSinceLastSave) {
        iterationCount++;
        hasTestedSinceLastSave = false;
      }
    }

    // Test conversation count
    const testStartEvents = events.filter(
      (e) => e.eventType === 'test_conversation_started'
    );
    const testConversationCount = new Set(
      testStartEvents.map((e) => e.testConversationId)
    ).size;

    // Template usage
    const roleEvent = events.find((e) => e.eventType === 'role_selected');
    const personalityEvent = events.find(
      (e) => e.eventType === 'personality_selected'
    );
    const templateAppliedCount = events.filter((e) => e.usedTemplate).length;

    // Reflection responses
    const reflectionResponses: Record<string, string> = {};
    events
      .filter(
        (e) => e.eventType === 'reflection_submitted' && e.reflectionResponse
      )
      .forEach((e) => {
        if (e.reflectionPromptId) {
          reflectionResponses[e.reflectionPromptId] = e.reflectionResponse!;
        }
      });

    // Event category breakdown
    const categoryBreakdown: Record<string, number> = {};
    events.forEach((e) => {
      categoryBreakdown[e.eventCategory] =
        (categoryBreakdown[e.eventCategory] || 0) + 1;
    });

    return {
      totalDesignTime,
      iterationCount,
      testConversationCount,
      templateUsage: {
        roleUsed: roleEvent?.roleSelected || null,
        personalityUsed: personalityEvent?.personalitySelected || null,
        templatesApplied: templateAppliedCount,
      },
      reflectionResponses,
      categoryBreakdown,
      totalEvents: events.length,
    };
  }
}

export const agentDesignLogService = new AgentDesignLogService();
