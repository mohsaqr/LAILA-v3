import prisma from '../utils/prisma.js';

// ============================================================================
// INTERFACES
// ============================================================================

export interface InteractionEventData {
  type: 'click' | 'page_view' | 'form_submit' | 'scroll' | 'focus' | 'blur' | 'hover' | 'custom';
  page: string;
  pageUrl?: string;
  pageTitle?: string;
  referrerUrl?: string;
  action: string;
  category?: string;
  label?: string;
  value?: number;
  elementId?: string;
  elementType?: string;
  elementText?: string;
  elementHref?: string;
  elementClasses?: string;
  elementName?: string;
  elementValue?: string;
  scrollDepth?: number;
  viewportWidth?: number;
  viewportHeight?: number;
  metadata?: Record<string, unknown>;
  timestamp?: number;
  sessionDuration?: number;
  timeOnPage?: number;
  // Course context
  courseId?: number;
  moduleId?: number;
  lectureId?: number;
  // Section context
  sectionId?: number;
  sectionTitle?: string;
  sectionType?: string;
}

export interface BulkInteractionData {
  sessionId: string;
  sessionStartTime?: number;
  events: InteractionEventData[];
  testMode?: string | null; // 'test_instructor', 'test_student' for admin "View As" feature
  userAgent?: string;
  // Client info
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

export interface ChatbotInteractionData {
  sessionId: string;
  sessionStartTime?: number;
  sectionId: number;
  conversationId?: number;
  conversationMessageCount?: number;
  messageIndex?: number;
  eventType: 'conversation_start' | 'message_sent' | 'message_received' | 'conversation_cleared' | 'error';
  eventSequence?: number;
  chatbotParams: {
    title?: string | null;
    intro?: string | null;
    imageUrl?: string | null;
    systemPrompt?: string | null;
    welcomeMessage?: string | null;
  };
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
  metadata?: Record<string, unknown>;
  timestamp?: number;
  testMode?: string | null; // 'test_instructor', 'test_student' for admin "View As" feature
  // Client info
  userAgent?: string;
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

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function countWords(text: string | null | undefined): number {
  if (!text) return 0;
  return text.trim().split(/\s+/).filter(w => w.length > 0).length;
}

function countChars(text: string | null | undefined): number {
  return text?.length || 0;
}

// ============================================================================
// ANALYTICS SERVICE
// ============================================================================

export class AnalyticsService {
  /**
   * Store bulk interaction events with full context
   */
  async storeInteractions(
    data: BulkInteractionData,
    userId?: number,
    ipAddress?: string
  ) {
    // Fetch user snapshot if available
    let userSnapshot: { fullname: string; email: string } | null = null;
    if (userId) {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { fullname: true, email: true },
      });
      userSnapshot = user;
    }

    // Fetch course context for any events with course IDs
    const courseIds = [...new Set(data.events.filter(e => e.courseId).map(e => e.courseId!))];
    const courseContextMap = new Map<number, { title: string }>();
    if (courseIds.length > 0) {
      const courses = await prisma.course.findMany({
        where: { id: { in: courseIds } },
        select: { id: true, title: true },
      });
      courses.forEach(c => courseContextMap.set(c.id, { title: c.title }));
    }

    // Fetch module context for any events with module IDs
    const moduleIds = [...new Set(data.events.filter(e => e.moduleId).map(e => e.moduleId!))];
    const moduleContextMap = new Map<number, { title: string }>();
    if (moduleIds.length > 0) {
      const modules = await prisma.courseModule.findMany({
        where: { id: { in: moduleIds } },
        select: { id: true, title: true },
      });
      modules.forEach(m => moduleContextMap.set(m.id, { title: m.title }));
    }

    // Fetch lecture context for any events with lecture IDs
    const lectureIds = [...new Set(data.events.filter(e => e.lectureId).map(e => e.lectureId!))];
    const lectureContextMap = new Map<number, { title: string; moduleId: number }>();
    if (lectureIds.length > 0) {
      const lectures = await prisma.lecture.findMany({
        where: { id: { in: lectureIds } },
        select: { id: true, title: true, moduleId: true },
      });
      lectures.forEach(l => lectureContextMap.set(l.id, { title: l.title, moduleId: l.moduleId }));
    }

    const sessionStartTime = data.sessionStartTime ? new Date(data.sessionStartTime) : undefined;

    const events = data.events.map((event, index) => {
      // Get lecture context and derive module if not set
      const lectureContext = event.lectureId ? lectureContextMap.get(event.lectureId) : undefined;
      const moduleId = event.moduleId || lectureContext?.moduleId;
      const moduleContext = moduleId ? moduleContextMap.get(moduleId) : undefined;

      return {
        // User context
        userId,
        userFullname: userSnapshot?.fullname,
        userEmail: userSnapshot?.email,
        sessionId: data.sessionId,

        // Location context
        pageUrl: event.pageUrl,
        pagePath: event.page,
        pageTitle: event.pageTitle,
        referrerUrl: event.referrerUrl,

        // Course context - with human-readable names
        courseId: event.courseId,
        courseTitle: event.courseId ? courseContextMap.get(event.courseId)?.title : undefined,
        moduleId,
        moduleTitle: moduleContext?.title,
        lectureId: event.lectureId,
        lectureTitle: lectureContext?.title,

        // Section context
        sectionId: event.sectionId,
        sectionTitle: event.sectionTitle,
        sectionType: event.sectionType,

        // Event details
        eventType: event.type,
        eventCategory: event.category,
        eventAction: event.action,
        eventLabel: event.label,
        eventValue: event.value,
        eventSequence: index,

        // Element details
        elementId: event.elementId,
        elementType: event.elementType,
        elementText: event.elementText?.substring(0, 500),
        elementHref: event.elementHref,
        elementClasses: event.elementClasses?.substring(0, 500),
        elementName: event.elementName,
        elementValue: event.elementValue?.substring(0, 500),

        // Scroll/viewport
        scrollDepth: event.scrollDepth,
        viewportWidth: event.viewportWidth,
        viewportHeight: event.viewportHeight,

        // Client context
        ipAddress,
        userAgent: data.userAgent,
        browserName: data.browserName,
        browserVersion: data.browserVersion,
        osName: data.osName,
        osVersion: data.osVersion,
        deviceType: data.deviceType,
        screenWidth: data.screenWidth,
        screenHeight: data.screenHeight,
        language: data.language,
        timezone: data.timezone,

        // Timing
        timestamp: event.timestamp ? new Date(event.timestamp) : new Date(),
        timestampMs: event.timestamp ? BigInt(event.timestamp) : BigInt(Date.now()),
        sessionStartTime,
        sessionDuration: event.sessionDuration,
        timeOnPage: event.timeOnPage,

        // Additional data
        metadata: event.metadata ? JSON.stringify(event.metadata) : null,

        // Test mode for admin "View As" feature
        testMode: data.testMode || null,
      };
    });

    // Batch insert
    await prisma.userInteractionLog.createMany({
      data: events,
    });

    return { stored: events.length };
  }

  /**
   * Store chatbot interaction with FULL context (course hierarchy, user snapshot, etc.)
   */
  async storeChatbotInteraction(
    data: ChatbotInteractionData,
    userId?: number,
    ipAddress?: string
  ) {
    // Fetch full section context with course hierarchy
    const section = await prisma.lectureSection.findUnique({
      where: { id: data.sectionId },
      include: {
        lecture: {
          include: {
            module: {
              include: {
                course: true,
              },
            },
          },
        },
      },
    });

    // Fetch user snapshot
    let userSnapshot: { fullname: string; email: string } | null = null;
    if (userId) {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { fullname: true, email: true },
      });
      userSnapshot = user;
    }

    const timestamp = data.timestamp ? new Date(data.timestamp) : new Date();
    const sessionStartTime = data.sessionStartTime ? new Date(data.sessionStartTime) : undefined;

    const log = await prisma.chatbotInteractionLog.create({
      data: {
        // ===== USER CONTEXT =====
        userId,
        userFullname: userSnapshot?.fullname,
        userEmail: userSnapshot?.email,
        sessionId: data.sessionId,

        // ===== COURSE HIERARCHY CONTEXT =====
        courseId: section?.lecture?.module?.course?.id,
        courseTitle: section?.lecture?.module?.course?.title,
        courseSlug: section?.lecture?.module?.course?.slug,
        moduleId: section?.lecture?.module?.id,
        moduleTitle: section?.lecture?.module?.title,
        moduleOrderIndex: section?.lecture?.module?.orderIndex,
        lectureId: section?.lecture?.id,
        lectureTitle: section?.lecture?.title,
        lectureOrderIndex: section?.lecture?.orderIndex,
        sectionId: data.sectionId,
        sectionOrderIndex: section?.order,

        // ===== CONVERSATION CONTEXT =====
        conversationId: data.conversationId,
        conversationMessageCount: data.conversationMessageCount,
        messageIndex: data.messageIndex,

        // ===== EVENT DETAILS =====
        eventType: data.eventType,
        eventSequence: data.eventSequence,

        // ===== CHATBOT CONFIGURATION SNAPSHOT =====
        chatbotTitle: data.chatbotParams.title || section?.chatbotTitle,
        chatbotIntro: data.chatbotParams.intro || section?.chatbotIntro,
        chatbotImageUrl: data.chatbotParams.imageUrl || section?.chatbotImageUrl,
        chatbotSystemPrompt: data.chatbotParams.systemPrompt || section?.chatbotSystemPrompt,
        chatbotWelcomeMessage: data.chatbotParams.welcomeMessage || section?.chatbotWelcome,

        // ===== MESSAGE DETAILS =====
        messageContent: data.messageContent,
        messageCharCount: countChars(data.messageContent),
        messageWordCount: countWords(data.messageContent),
        responseContent: data.responseContent,
        responseCharCount: countChars(data.responseContent),
        responseWordCount: countWords(data.responseContent),

        // ===== AI RESPONSE METRICS =====
        responseTime: data.responseTime,
        aiModel: data.aiModel,
        aiProvider: data.aiProvider,
        promptTokens: data.promptTokens,
        completionTokens: data.completionTokens,
        totalTokens: data.totalTokens,

        // ===== ERROR DETAILS =====
        errorMessage: data.errorMessage,
        errorCode: data.errorCode,
        errorStack: data.errorStack,

        // ===== CLIENT CONTEXT =====
        ipAddress,
        userAgent: data.userAgent,
        browserName: data.browserName,
        browserVersion: data.browserVersion,
        osName: data.osName,
        osVersion: data.osVersion,
        deviceType: data.deviceType,
        screenWidth: data.screenWidth,
        screenHeight: data.screenHeight,
        language: data.language,
        timezone: data.timezone,

        // ===== TIMING =====
        timestamp,
        timestampMs: BigInt(data.timestamp || Date.now()),
        sessionStartTime,
        sessionDuration: data.sessionStartTime
          ? Math.floor((timestamp.getTime() - data.sessionStartTime) / 1000)
          : undefined,

        // ===== ADDITIONAL DATA =====
        metadata: data.metadata ? JSON.stringify(data.metadata) : null,

        // ===== TEST MODE (Admin "View As" feature) =====
        testMode: data.testMode || null,
      },
    });

    return log;
  }

  /**
   * Get comprehensive interaction analytics summary
   */
  async getInteractionSummary(
    filters: {
      startDate?: Date;
      endDate?: Date;
      userId?: number;
      page?: string;
      interactionType?: string;
      courseId?: number;
    } = {}
  ) {
    const where: Record<string, unknown> = {};

    if (filters.startDate || filters.endDate) {
      where.timestamp = {};
      if (filters.startDate) (where.timestamp as Record<string, unknown>).gte = filters.startDate;
      if (filters.endDate) (where.timestamp as Record<string, unknown>).lte = filters.endDate;
    }
    if (filters.userId) where.userId = filters.userId;
    if (filters.page) where.pagePath = { contains: filters.page };
    if (filters.interactionType) where.eventType = filters.interactionType;
    if (filters.courseId) where.courseId = filters.courseId;

    // Check if new table has data, otherwise fall back to old table
    const newTableCount = await prisma.userInteractionLog.count();

    if (newTableCount > 0) {
      // Use new comprehensive table
      const [
        totalInteractions,
        uniqueSessions,
        byType,
        byPage,
        byCourse,
        byDevice,
        byBrowser,
        recentInteractions,
      ] = await Promise.all([
        prisma.userInteractionLog.count({ where }),
        prisma.userInteractionLog.groupBy({
          by: ['sessionId'],
          where,
        }),
        prisma.userInteractionLog.groupBy({
          by: ['eventType'],
          where,
          _count: true,
          orderBy: { _count: { eventType: 'desc' } },
        }),
        prisma.userInteractionLog.groupBy({
          by: ['pagePath'],
          where,
          _count: true,
          orderBy: { _count: { pagePath: 'desc' } },
          take: 20,
        }),
        prisma.userInteractionLog.groupBy({
          by: ['courseId', 'courseTitle'],
          where: { ...where, courseId: { not: null } },
          _count: true,
          orderBy: { _count: { courseId: 'desc' } },
          take: 10,
        }),
        prisma.userInteractionLog.groupBy({
          by: ['deviceType'],
          where: { ...where, deviceType: { not: null } },
          _count: true,
        }),
        prisma.userInteractionLog.groupBy({
          by: ['browserName'],
          where: { ...where, browserName: { not: null } },
          _count: true,
        }),
        prisma.userInteractionLog.findMany({
          where,
          orderBy: { timestamp: 'desc' },
          take: 100,
          include: {
            user: {
              select: { id: true, fullname: true, email: true },
            },
          },
        }),
      ]);

      return {
        totalInteractions,
        uniqueSessions: uniqueSessions.length,
        byType: byType.map(t => ({ type: t.eventType, count: t._count })),
        byPage: byPage.map(p => ({ page: p.pagePath, count: p._count })),
        byCourse: byCourse.map(c => ({ courseId: c.courseId, courseTitle: c.courseTitle, count: c._count })),
        byDevice: byDevice.map(d => ({ device: d.deviceType, count: d._count })),
        byBrowser: byBrowser.map(b => ({ browser: b.browserName, count: b._count })),
        recentInteractions: recentInteractions.map(i => ({
          id: i.id,
          timestamp: i.timestamp,
          timestampMs: i.timestampMs?.toString(),
          sessionId: i.sessionId,
          sessionDuration: i.sessionDuration,

          // User
          user: i.user,
          userFullname: i.userFullname,
          userEmail: i.userEmail,

          // Event
          eventType: i.eventType,
          eventCategory: i.eventCategory,
          eventAction: i.eventAction,
          eventLabel: i.eventLabel,
          eventSequence: i.eventSequence,

          // Page
          pagePath: i.pagePath,
          pageUrl: i.pageUrl,
          pageTitle: i.pageTitle,
          referrerUrl: i.referrerUrl,

          // Course context
          courseId: i.courseId,
          courseTitle: i.courseTitle,
          moduleId: i.moduleId,
          moduleTitle: i.moduleTitle,
          lectureId: i.lectureId,
          lectureTitle: i.lectureTitle,

          // Section context
          sectionId: (i as any).sectionId,
          sectionTitle: (i as any).sectionTitle,
          sectionType: (i as any).sectionType,

          // Element
          elementId: i.elementId,
          elementType: i.elementType,
          elementText: i.elementText,
          elementHref: i.elementHref,
          elementClasses: i.elementClasses,

          // Client
          deviceType: i.deviceType,
          browserName: i.browserName,
          browserVersion: i.browserVersion,
          osName: i.osName,
          screenWidth: i.screenWidth,
          screenHeight: i.screenHeight,
          language: i.language,
          timezone: i.timezone,

          // Viewport
          scrollDepth: i.scrollDepth,
          viewportWidth: i.viewportWidth,
          viewportHeight: i.viewportHeight,
          timeOnPage: i.timeOnPage,

          metadata: i.metadata ? JSON.parse(i.metadata) : null,
        })),
      };
    }

    // Fall back to old table (UserInteraction) - build a separate where clause for old schema
    const oldWhere: Record<string, unknown> = {};
    if (filters.startDate || filters.endDate) {
      oldWhere.timestamp = {};
      if (filters.startDate) (oldWhere.timestamp as Record<string, unknown>).gte = filters.startDate;
      if (filters.endDate) (oldWhere.timestamp as Record<string, unknown>).lte = filters.endDate;
    }
    if (filters.userId) oldWhere.userId = filters.userId;
    if (filters.page) oldWhere.page = { contains: filters.page };
    if (filters.interactionType) oldWhere.interactionType = filters.interactionType;

    const [
      totalInteractions,
      uniqueSessions,
      byType,
      byPage,
      recentInteractions,
    ] = await Promise.all([
      prisma.userInteraction.count({ where: oldWhere }),
      prisma.userInteraction.groupBy({
        by: ['sessionId'],
        where: oldWhere,
      }),
      prisma.userInteraction.groupBy({
        by: ['interactionType'],
        where: oldWhere,
        _count: true,
        orderBy: { _count: { interactionType: 'desc' } },
      }),
      prisma.userInteraction.groupBy({
        by: ['page'],
        where: oldWhere,
        _count: true,
        orderBy: { _count: { page: 'desc' } },
        take: 20,
      }),
      prisma.userInteraction.findMany({
        where: oldWhere,
        orderBy: { timestamp: 'desc' },
        take: 100,
        include: {
          user: { select: { id: true, fullname: true, email: true } },
        },
      }),
    ]);

    return {
      totalInteractions,
      uniqueSessions: uniqueSessions.length,
      byType: byType.map(t => ({ type: t.interactionType, count: t._count })),
      byPage: byPage.map(p => ({ page: p.page, count: p._count })),
      byCourse: [],
      byDevice: [],
      byBrowser: [],
      recentInteractions: recentInteractions.map(i => ({
        id: i.id,
        user: i.user,
        sessionId: i.sessionId,
        eventType: i.interactionType,
        pagePath: i.page,
        eventAction: i.action,
        elementId: i.elementId,
        elementType: i.elementType,
        timestamp: i.timestamp,
        additionalData: i.additionalData ? JSON.parse(i.additionalData) : null,
      })),
    };
  }

  /**
   * Get comprehensive chatbot interaction analytics
   */
  async getChatbotInteractionSummary(
    filters: {
      startDate?: Date;
      endDate?: Date;
      userId?: number;
      sectionId?: number;
      courseId?: number;
    } = {}
  ) {
    const where: Record<string, unknown> = {};

    if (filters.startDate || filters.endDate) {
      where.timestamp = {};
      if (filters.startDate) (where.timestamp as Record<string, unknown>).gte = filters.startDate;
      if (filters.endDate) (where.timestamp as Record<string, unknown>).lte = filters.endDate;
    }
    if (filters.userId) where.userId = filters.userId;
    if (filters.sectionId) where.sectionId = filters.sectionId;
    if (filters.courseId) where.courseId = filters.courseId;

    const [
      totalLogs,
      byEventType,
      byCourse,
      byModule,
      byLecture,
      byChatbot,
      byUser,
      byAiModel,
      avgResponseTime,
      avgMessageLength,
      avgResponseLength,
      recentLogs,
    ] = await Promise.all([
      prisma.chatbotInteractionLog.count({ where }),
      prisma.chatbotInteractionLog.groupBy({
        by: ['eventType'],
        where,
        _count: true,
      }),
      prisma.chatbotInteractionLog.groupBy({
        by: ['courseId', 'courseTitle'],
        where: { ...where, courseId: { not: null } },
        _count: true,
        orderBy: { _count: { courseId: 'desc' } },
      }),
      prisma.chatbotInteractionLog.groupBy({
        by: ['moduleId', 'moduleTitle'],
        where: { ...where, moduleId: { not: null } },
        _count: true,
        orderBy: { _count: { moduleId: 'desc' } },
      }),
      prisma.chatbotInteractionLog.groupBy({
        by: ['lectureId', 'lectureTitle'],
        where: { ...where, lectureId: { not: null } },
        _count: true,
        orderBy: { _count: { lectureId: 'desc' } },
      }),
      prisma.chatbotInteractionLog.groupBy({
        by: ['sectionId', 'chatbotTitle'],
        where,
        _count: true,
        orderBy: { _count: { sectionId: 'desc' } },
      }),
      prisma.chatbotInteractionLog.groupBy({
        by: ['userId', 'userFullname'],
        where: { ...where, userId: { not: null } },
        _count: true,
        orderBy: { _count: { userId: 'desc' } },
        take: 20,
      }),
      prisma.chatbotInteractionLog.groupBy({
        by: ['aiModel'],
        where: { ...where, aiModel: { not: null } },
        _count: true,
      }),
      prisma.chatbotInteractionLog.aggregate({
        where: { ...where, eventType: 'message_received', responseTime: { not: null } },
        _avg: { responseTime: true },
        _min: { responseTime: true },
        _max: { responseTime: true },
      }),
      prisma.chatbotInteractionLog.aggregate({
        where: { ...where, eventType: 'message_sent', messageCharCount: { not: null } },
        _avg: { messageCharCount: true, messageWordCount: true },
      }),
      prisma.chatbotInteractionLog.aggregate({
        where: { ...where, eventType: 'message_received', responseCharCount: { not: null } },
        _avg: { responseCharCount: true, responseWordCount: true },
      }),
      prisma.chatbotInteractionLog.findMany({
        where,
        orderBy: { timestamp: 'desc' },
        take: 100,
        include: {
          user: { select: { id: true, fullname: true, email: true } },
          section: {
            select: {
              id: true,
              chatbotTitle: true,
              lecture: {
                select: {
                  title: true,
                  module: {
                    select: {
                      title: true,
                      course: { select: { id: true, title: true } },
                    },
                  },
                },
              },
            },
          },
        },
      }),
    ]);

    return {
      totalLogs,

      // Breakdowns
      byEventType: byEventType.map(e => ({ eventType: e.eventType, count: e._count })),
      byCourse: byCourse.map(c => ({ courseId: c.courseId, courseTitle: c.courseTitle, count: c._count })),
      byModule: byModule.map(m => ({ moduleId: m.moduleId, moduleTitle: m.moduleTitle, count: m._count })),
      byLecture: byLecture.map(l => ({ lectureId: l.lectureId, lectureTitle: l.lectureTitle, count: l._count })),
      byChatbot: byChatbot.map(s => ({ sectionId: s.sectionId, chatbotTitle: s.chatbotTitle, count: s._count })),
      byUser: byUser.map(u => ({ userId: u.userId, userName: u.userFullname, count: u._count })),
      byAiModel: byAiModel.map(m => ({ model: m.aiModel, count: m._count })),

      // Metrics
      responseTimeStats: {
        avg: avgResponseTime._avg.responseTime || 0,
        min: avgResponseTime._min.responseTime || 0,
        max: avgResponseTime._max.responseTime || 0,
      },
      messageLengthStats: {
        avgChars: avgMessageLength._avg.messageCharCount || 0,
        avgWords: avgMessageLength._avg.messageWordCount || 0,
      },
      responseLengthStats: {
        avgChars: avgResponseLength._avg.responseCharCount || 0,
        avgWords: avgResponseLength._avg.responseWordCount || 0,
      },

      // Recent logs with ALL details
      recentLogs: recentLogs.map(l => ({
        id: l.id,
        timestamp: l.timestamp,
        timestampMs: l.timestampMs?.toString(),
        sessionId: l.sessionId,
        sessionDuration: l.sessionDuration,

        // User context
        user: l.user,
        userFullname: l.userFullname,
        userEmail: l.userEmail,

        // Course hierarchy
        courseId: l.courseId,
        courseTitle: l.courseTitle,
        courseSlug: l.courseSlug,
        moduleId: l.moduleId,
        moduleTitle: l.moduleTitle,
        moduleOrderIndex: l.moduleOrderIndex,
        lectureId: l.lectureId,
        lectureTitle: l.lectureTitle,
        lectureOrderIndex: l.lectureOrderIndex,
        sectionId: l.sectionId,
        sectionOrderIndex: l.sectionOrderIndex,

        // Conversation context
        conversationId: l.conversationId,
        conversationMessageCount: l.conversationMessageCount,
        messageIndex: l.messageIndex,

        // Event
        eventType: l.eventType,
        eventSequence: l.eventSequence,

        // Chatbot config snapshot
        chatbotTitle: l.chatbotTitle,
        chatbotIntro: l.chatbotIntro,
        chatbotImageUrl: l.chatbotImageUrl,
        chatbotSystemPrompt: l.chatbotSystemPrompt,
        chatbotWelcomeMessage: l.chatbotWelcomeMessage,

        // Message details
        messageContent: l.messageContent,
        messageCharCount: l.messageCharCount,
        messageWordCount: l.messageWordCount,
        responseContent: l.responseContent,
        responseCharCount: l.responseCharCount,
        responseWordCount: l.responseWordCount,

        // AI metrics
        responseTime: l.responseTime,
        aiModel: l.aiModel,
        aiProvider: l.aiProvider,
        promptTokens: l.promptTokens,
        completionTokens: l.completionTokens,
        totalTokens: l.totalTokens,

        // Error
        errorMessage: l.errorMessage,
        errorCode: l.errorCode,

        // Client context
        deviceType: l.deviceType,
        browserName: l.browserName,
        browserVersion: l.browserVersion,
        osName: l.osName,
        osVersion: l.osVersion,
        screenWidth: l.screenWidth,
        screenHeight: l.screenHeight,
        language: l.language,
        timezone: l.timezone,
        ipAddress: l.ipAddress,

        // Section relation (for legacy compatibility)
        section: l.section,

        metadata: l.metadata ? JSON.parse(l.metadata) : null,
      })),
    };
  }

  /**
   * Get detailed chatbot logs for a specific section
   */
  async getChatbotLogsForSection(
    sectionId: number,
    page = 1,
    limit = 50
  ) {
    const skip = (page - 1) * limit;

    const [logs, total] = await Promise.all([
      prisma.chatbotInteractionLog.findMany({
        where: { sectionId },
        orderBy: { timestamp: 'desc' },
        skip,
        take: limit,
        include: {
          user: { select: { id: true, fullname: true, email: true } },
        },
      }),
      prisma.chatbotInteractionLog.count({ where: { sectionId } }),
    ]);

    return {
      logs: logs.map(l => ({
        id: l.id,
        timestamp: l.timestamp,
        timestampMs: l.timestampMs?.toString(),
        sessionId: l.sessionId,
        sessionDuration: l.sessionDuration,

        // User
        user: l.user,
        userFullname: l.userFullname,
        userEmail: l.userEmail,

        // Course hierarchy
        courseId: l.courseId,
        courseTitle: l.courseTitle,
        moduleId: l.moduleId,
        moduleTitle: l.moduleTitle,
        lectureId: l.lectureId,
        lectureTitle: l.lectureTitle,
        sectionId: l.sectionId,

        // Conversation
        conversationId: l.conversationId,
        conversationMessageCount: l.conversationMessageCount,
        messageIndex: l.messageIndex,

        // Event
        eventType: l.eventType,
        eventSequence: l.eventSequence,

        // Chatbot config
        chatbotTitle: l.chatbotTitle,
        chatbotIntro: l.chatbotIntro,
        chatbotImageUrl: l.chatbotImageUrl,
        chatbotSystemPrompt: l.chatbotSystemPrompt,
        chatbotWelcomeMessage: l.chatbotWelcomeMessage,

        // Message
        messageContent: l.messageContent,
        messageCharCount: l.messageCharCount,
        messageWordCount: l.messageWordCount,
        responseContent: l.responseContent,
        responseCharCount: l.responseCharCount,
        responseWordCount: l.responseWordCount,

        // AI
        responseTime: l.responseTime,
        aiModel: l.aiModel,
        aiProvider: l.aiProvider,
        promptTokens: l.promptTokens,
        completionTokens: l.completionTokens,
        totalTokens: l.totalTokens,

        // Error
        errorMessage: l.errorMessage,
        errorCode: l.errorCode,

        // Client
        deviceType: l.deviceType,
        browserName: l.browserName,
        osName: l.osName,
        language: l.language,
        timezone: l.timezone,

        metadata: l.metadata ? JSON.parse(l.metadata) : null,
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Query user interactions with filters, pagination, search, and sorting
   */
  async queryInteractions(filters: {
    userId?: number;
    courseId?: number;
    eventType?: string;
    pagePath?: string;
    startDate?: Date;
    endDate?: Date;
    search?: string;
    page?: number;
    limit?: number;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  }) {
    const {
      userId,
      courseId,
      eventType,
      pagePath,
      startDate,
      endDate,
      search,
      page = 1,
      limit = 50,
      sortBy = 'timestamp',
      sortOrder = 'desc',
    } = filters;

    const where: Record<string, unknown> = {};

    if (userId) where.userId = userId;
    if (courseId) where.courseId = courseId;
    if (eventType) where.eventType = eventType;
    if (pagePath) where.pagePath = { contains: pagePath };
    if (startDate || endDate) {
      where.timestamp = {};
      if (startDate) (where.timestamp as Record<string, unknown>).gte = startDate;
      if (endDate) (where.timestamp as Record<string, unknown>).lte = endDate;
    }

    // Search across multiple fields
    if (search) {
      where.OR = [
        { userEmail: { contains: search } },
        { userFullname: { contains: search } },
        { pagePath: { contains: search } },
        { pageTitle: { contains: search } },
        { courseTitle: { contains: search } },
        { eventAction: { contains: search } },
        { elementText: { contains: search } },
      ];
    }

    // Valid sort fields
    const validSortFields = [
      'timestamp', 'userFullname', 'eventType', 'pagePath', 'courseTitle',
      'deviceType', 'browserName', 'scrollDepth', 'timeOnPage',
    ];
    const orderByField = validSortFields.includes(sortBy) ? sortBy : 'timestamp';
    const orderBy = { [orderByField]: sortOrder };

    const [logs, total] = await Promise.all([
      prisma.userInteractionLog.findMany({
        where,
        orderBy,
        skip: (page - 1) * limit,
        take: limit,
        include: {
          user: { select: { id: true, fullname: true, email: true } },
        },
      }),
      prisma.userInteractionLog.count({ where }),
    ]);

    return {
      logs: logs.map(i => ({
        id: i.id,
        timestamp: i.timestamp,
        timestampMs: i.timestampMs?.toString(),
        sessionId: i.sessionId,
        sessionDuration: i.sessionDuration,
        timeOnPage: i.timeOnPage,

        // User
        userId: i.userId,
        userFullname: i.userFullname,
        userEmail: i.userEmail,

        // Event
        eventType: i.eventType,
        eventCategory: i.eventCategory,
        eventAction: i.eventAction,
        eventLabel: i.eventLabel,
        eventValue: i.eventValue,
        eventSequence: i.eventSequence,

        // Page
        pagePath: i.pagePath,
        pageUrl: i.pageUrl,
        pageTitle: i.pageTitle,
        referrerUrl: i.referrerUrl,

        // Course context
        courseId: i.courseId,
        courseTitle: i.courseTitle,
        moduleId: i.moduleId,
        moduleTitle: i.moduleTitle,
        lectureId: i.lectureId,
        lectureTitle: i.lectureTitle,

        // Element
        elementId: i.elementId,
        elementType: i.elementType,
        elementText: i.elementText,
        elementHref: i.elementHref,
        elementClasses: i.elementClasses,
        elementName: i.elementName,
        elementValue: i.elementValue,

        // Scroll/viewport
        scrollDepth: i.scrollDepth,
        viewportWidth: i.viewportWidth,
        viewportHeight: i.viewportHeight,

        // Client
        deviceType: i.deviceType,
        browserName: i.browserName,
        browserVersion: i.browserVersion,
        osName: i.osName,
        osVersion: i.osVersion,
        screenWidth: i.screenWidth,
        screenHeight: i.screenHeight,
        language: i.language,
        timezone: i.timezone,
        ipAddress: i.ipAddress,
        userAgent: i.userAgent,

        metadata: i.metadata ? JSON.parse(i.metadata) : null,
        testMode: i.testMode,
      })),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  /**
   * Get filter options for interactions dropdowns
   */
  async getInteractionFilterOptions() {
    const [users, courses, eventTypes, pages] = await Promise.all([
      prisma.userInteractionLog.findMany({
        select: { userId: true, userFullname: true, userEmail: true },
        distinct: ['userId'],
        where: { userId: { not: null } },
        orderBy: { userFullname: 'asc' },
      }),
      prisma.userInteractionLog.findMany({
        select: { courseId: true, courseTitle: true },
        distinct: ['courseId'],
        where: { courseId: { not: null } },
        orderBy: { courseTitle: 'asc' },
      }),
      prisma.userInteractionLog.groupBy({
        by: ['eventType'],
        _count: { id: true },
        orderBy: { eventType: 'asc' },
      }),
      prisma.userInteractionLog.groupBy({
        by: ['pagePath'],
        _count: { id: true },
        orderBy: { _count: { pagePath: 'desc' } },
        take: 50,
      }),
    ]);

    return {
      users: users.filter(u => u.userId).map(u => ({
        id: u.userId!,
        fullname: u.userFullname,
        email: u.userEmail,
      })),
      courses: courses.filter(c => c.courseId).map(c => ({
        id: c.courseId!,
        title: c.courseTitle,
      })),
      eventTypes: eventTypes.map(e => ({ eventType: e.eventType, count: e._count.id })),
      pages: pages.filter(p => p.pagePath).map(p => ({ path: p.pagePath!, count: p._count.id })),
    };
  }

  /**
   * Export interactions to CSV
   */
  async exportInteractionsToCsv(filters: {
    userId?: number;
    courseId?: number;
    eventType?: string;
    startDate?: Date;
    endDate?: Date;
    search?: string;
  }): Promise<string> {
    const where: Record<string, unknown> = {};
    if (filters.userId) where.userId = filters.userId;
    if (filters.courseId) where.courseId = filters.courseId;
    if (filters.eventType) where.eventType = filters.eventType;
    if (filters.startDate || filters.endDate) {
      where.timestamp = {};
      if (filters.startDate) (where.timestamp as Record<string, unknown>).gte = filters.startDate;
      if (filters.endDate) (where.timestamp as Record<string, unknown>).lte = filters.endDate;
    }
    if (filters.search) {
      where.OR = [
        { userEmail: { contains: filters.search } },
        { userFullname: { contains: filters.search } },
        { pagePath: { contains: filters.search } },
        { courseTitle: { contains: filters.search } },
      ];
    }

    const logs = await prisma.userInteractionLog.findMany({
      where,
      orderBy: { timestamp: 'desc' },
      take: 10000,
    });

    if (logs.length === 0) return 'No data to export';

    const headers = [
      'id', 'timestamp', 'userId', 'userEmail', 'userFullname', 'sessionId',
      'eventType', 'eventCategory', 'eventAction', 'eventLabel', 'eventValue',
      'pagePath', 'pageUrl', 'pageTitle', 'referrerUrl',
      'courseId', 'courseTitle', 'moduleId', 'moduleTitle', 'lectureId', 'lectureTitle',
      'elementId', 'elementType', 'elementText', 'elementHref',
      'scrollDepth', 'viewportWidth', 'viewportHeight', 'timeOnPage',
      'deviceType', 'browserName', 'browserVersion', 'osName', 'osVersion',
      'screenWidth', 'screenHeight', 'language', 'timezone',
    ];

    const escapeCSV = (value: unknown): string => {
      if (value === null || value === undefined) return '';
      const str = String(value);
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const rows = logs.map(log =>
      headers.map(h => escapeCSV((log as Record<string, unknown>)[h])).join(',')
    );

    return [headers.join(','), ...rows].join('\n');
  }
}

export const analyticsService = new AnalyticsService();
