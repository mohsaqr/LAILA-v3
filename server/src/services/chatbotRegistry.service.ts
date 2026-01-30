/**
 * Chatbot Registry Service
 * Queries both global chatbots (Chatbot model) and section chatbots (LectureSection with type='chatbot')
 * and provides a unified view with statistics and filtering capabilities.
 */

import prisma from '../utils/prisma.js';
import ExcelJS from 'exceljs';

// =============================================================================
// TYPES
// =============================================================================

export interface ChatbotRegistryFilters {
  type?: 'global' | 'section';
  courseId?: number;
  creatorId?: number;
  isActive?: boolean;
  category?: string;
  search?: string;
  startDate?: string;
  endDate?: string;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface UnifiedChatbot {
  id: string; // 'global-{id}' or 'section-{id}'
  type: 'global' | 'section';

  // Basic info
  name: string;
  displayName: string;
  description: string | null;
  category: string | null;
  isActive: boolean;

  // System prompt and rules
  systemPrompt: string | null;
  welcomeMessage: string | null;
  dosRules: string[] | null;
  dontsRules: string[] | null;

  // Configuration
  personality: string | null;
  personalityPrompt: string | null;
  temperature: number | null;
  maxTokens: number | null;
  responseStyle: string | null;
  modelPreference: string | null;
  suggestedQuestions: string[] | null;
  knowledgeContext: string | null;
  avatarUrl: string | null;

  // Course context (for section chatbots)
  courseId: number | null;
  courseTitle: string | null;
  moduleId: number | null;
  moduleTitle: string | null;
  lectureId: number | null;
  lectureTitle: string | null;
  sectionId: number | null;

  // Creator info (for section chatbots)
  creatorId: number | null;
  creatorName: string | null;
  creatorEmail: string | null;

  // Usage statistics
  conversationCount: number;
  messageCount: number;
  uniqueUsers: number;
  lastActivity: string | null;

  // Timestamps
  createdAt: string;
  updatedAt: string;
}

export interface ChatbotRegistryStats {
  totalChatbots: number;
  globalChatbots: number;
  sectionChatbots: number;
  totalConversations: number;
  totalMessages: number;
  uniqueUsers: number;
  byCategory: Array<{ category: string; count: number }>;
  byCourse: Array<{ courseId: number; courseTitle: string; count: number }>;
}

export interface ChatbotFilterOptions {
  courses: Array<{ id: number; title: string }>;
  creators: Array<{ id: number; fullname: string | null; email: string }>;
  categories: Array<{ category: string; count: number }>;
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

function parseJsonArray(json: string | null): string[] | null {
  if (!json) return null;
  try {
    const parsed = JSON.parse(json);
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

// =============================================================================
// SERVICE CLASS
// =============================================================================

class ChatbotRegistryService {
  /**
   * Get all chatbots (both global and section) with filters, pagination, and sorting
   */
  async getChatbots(filters: ChatbotRegistryFilters = {}): Promise<{
    chatbots: UnifiedChatbot[];
    pagination: { page: number; limit: number; total: number; totalPages: number };
  }> {
    const {
      type,
      courseId,
      creatorId,
      isActive,
      category,
      search,
      startDate,
      endDate,
      page = 1,
      limit = 50,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = filters;

    const allChatbots: UnifiedChatbot[] = [];

    // =========================================================================
    // QUERY GLOBAL CHATBOTS
    // =========================================================================
    if (!type || type === 'global') {
      const globalWhere: any = {};

      if (isActive !== undefined) {
        globalWhere.isActive = isActive;
      }
      if (category) {
        globalWhere.category = category;
      }
      if (startDate) {
        globalWhere.createdAt = { ...globalWhere.createdAt, gte: new Date(startDate) };
      }
      if (endDate) {
        globalWhere.createdAt = { ...globalWhere.createdAt, lte: new Date(endDate) };
      }
      if (search) {
        globalWhere.OR = [
          { name: { contains: search } },
          { displayName: { contains: search } },
          { description: { contains: search } },
          { systemPrompt: { contains: search } },
        ];
      }

      const globalChatbots = await prisma.chatbot.findMany({
        where: globalWhere,
        include: {
          tutorConversations: {
            include: {
              messages: true,
            },
          },
        },
      });

      for (const chatbot of globalChatbots) {
        // Calculate usage stats from TutorConversation
        const conversationCount = chatbot.tutorConversations.length;
        const messageCount = chatbot.tutorConversations.reduce(
          (sum, conv) => sum + conv.messages.length,
          0
        );

        // Get unique users from sessions
        const uniqueUserIds = new Set<number>();
        for (const conv of chatbot.tutorConversations) {
          // Get userId from session
          const session = await prisma.tutorSession.findUnique({
            where: { id: conv.sessionId },
            select: { userId: true },
          });
          if (session) {
            uniqueUserIds.add(session.userId);
          }
        }

        // Get last activity
        const lastMessage = chatbot.tutorConversations
          .flatMap(c => c.messages)
          .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0];

        allChatbots.push({
          id: `global-${chatbot.id}`,
          type: 'global',
          name: chatbot.name,
          displayName: chatbot.displayName,
          description: chatbot.description,
          category: chatbot.category,
          isActive: chatbot.isActive,
          systemPrompt: chatbot.systemPrompt,
          welcomeMessage: chatbot.welcomeMessage,
          dosRules: parseJsonArray(chatbot.dosRules),
          dontsRules: parseJsonArray(chatbot.dontsRules),
          personality: chatbot.personality,
          personalityPrompt: chatbot.personalityPrompt,
          temperature: chatbot.temperature,
          maxTokens: chatbot.maxTokens,
          responseStyle: chatbot.responseStyle,
          modelPreference: chatbot.modelPreference,
          suggestedQuestions: parseJsonArray(chatbot.suggestedQuestions),
          knowledgeContext: chatbot.knowledgeContext,
          avatarUrl: chatbot.avatarUrl,
          courseId: null,
          courseTitle: null,
          moduleId: null,
          moduleTitle: null,
          lectureId: null,
          lectureTitle: null,
          sectionId: null,
          creatorId: null,
          creatorName: null,
          creatorEmail: null,
          conversationCount,
          messageCount,
          uniqueUsers: uniqueUserIds.size,
          lastActivity: lastMessage?.createdAt?.toISOString() || null,
          createdAt: chatbot.createdAt.toISOString(),
          updatedAt: chatbot.updatedAt.toISOString(),
        });
      }
    }

    // =========================================================================
    // QUERY SECTION CHATBOTS
    // =========================================================================
    if (!type || type === 'section') {
      const sectionWhere: any = {
        type: 'chatbot',
      };

      if (startDate) {
        sectionWhere.createdAt = { ...sectionWhere.createdAt, gte: new Date(startDate) };
      }
      if (endDate) {
        sectionWhere.createdAt = { ...sectionWhere.createdAt, lte: new Date(endDate) };
      }
      if (search) {
        sectionWhere.OR = [
          { chatbotTitle: { contains: search } },
          { chatbotIntro: { contains: search } },
          { chatbotSystemPrompt: { contains: search } },
        ];
      }

      const sectionChatbots = await prisma.lectureSection.findMany({
        where: sectionWhere,
        include: {
          lecture: {
            include: {
              module: {
                include: {
                  course: {
                    include: {
                      instructor: {
                        select: { id: true, fullname: true, email: true },
                      },
                    },
                  },
                },
              },
            },
          },
          chatbotConversations: {
            include: {
              messages: true,
            },
          },
        },
      });

      for (const section of sectionChatbots) {
        const course = section.lecture?.module?.course;
        const instructor = course?.instructor;

        // Apply course filter
        if (courseId && course?.id !== courseId) continue;

        // Apply creator filter
        if (creatorId && instructor?.id !== creatorId) continue;

        // Calculate usage stats from ChatbotConversation
        const conversationCount = section.chatbotConversations.length;
        const messageCount = section.chatbotConversations.reduce(
          (sum, conv) => sum + conv.messages.length,
          0
        );
        const uniqueUserIds = new Set(section.chatbotConversations.map(c => c.userId));

        // Get last activity
        const lastMessage = section.chatbotConversations
          .flatMap(c => c.messages)
          .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0];

        allChatbots.push({
          id: `section-${section.id}`,
          type: 'section',
          name: section.chatbotTitle || `Section ${section.id}`,
          displayName: section.chatbotTitle || section.title || `Section Chatbot`,
          description: section.chatbotIntro,
          category: 'course_chatbot',
          isActive: true, // Section chatbots are always active if they exist
          systemPrompt: section.chatbotSystemPrompt,
          welcomeMessage: section.chatbotWelcome,
          dosRules: null, // Section chatbots don't have explicit rules
          dontsRules: null,
          personality: null,
          personalityPrompt: null,
          temperature: null,
          maxTokens: null,
          responseStyle: null,
          modelPreference: null,
          suggestedQuestions: null,
          knowledgeContext: null,
          avatarUrl: section.chatbotImageUrl,
          courseId: course?.id || null,
          courseTitle: course?.title || null,
          moduleId: section.lecture?.module?.id || null,
          moduleTitle: section.lecture?.module?.title || null,
          lectureId: section.lecture?.id || null,
          lectureTitle: section.lecture?.title || null,
          sectionId: section.id,
          creatorId: instructor?.id || null,
          creatorName: instructor?.fullname || null,
          creatorEmail: instructor?.email || null,
          conversationCount,
          messageCount,
          uniqueUsers: uniqueUserIds.size,
          lastActivity: lastMessage?.createdAt?.toISOString() || null,
          createdAt: section.createdAt.toISOString(),
          updatedAt: section.updatedAt.toISOString(),
        });
      }
    }

    // =========================================================================
    // APPLY SORTING
    // =========================================================================
    const sortMultiplier = sortOrder === 'asc' ? 1 : -1;
    allChatbots.sort((a, b) => {
      let aVal: any;
      let bVal: any;

      switch (sortBy) {
        case 'name':
        case 'displayName':
          aVal = a.displayName?.toLowerCase() || '';
          bVal = b.displayName?.toLowerCase() || '';
          break;
        case 'type':
          aVal = a.type;
          bVal = b.type;
          break;
        case 'category':
          aVal = a.category || '';
          bVal = b.category || '';
          break;
        case 'courseTitle':
          aVal = a.courseTitle || '';
          bVal = b.courseTitle || '';
          break;
        case 'creatorName':
          aVal = a.creatorName || '';
          bVal = b.creatorName || '';
          break;
        case 'conversationCount':
          aVal = a.conversationCount;
          bVal = b.conversationCount;
          break;
        case 'messageCount':
          aVal = a.messageCount;
          bVal = b.messageCount;
          break;
        case 'uniqueUsers':
          aVal = a.uniqueUsers;
          bVal = b.uniqueUsers;
          break;
        case 'isActive':
          aVal = a.isActive ? 1 : 0;
          bVal = b.isActive ? 1 : 0;
          break;
        case 'createdAt':
        default:
          aVal = new Date(a.createdAt).getTime();
          bVal = new Date(b.createdAt).getTime();
          break;
      }

      if (typeof aVal === 'string') {
        return aVal.localeCompare(bVal) * sortMultiplier;
      }
      return (aVal - bVal) * sortMultiplier;
    });

    // =========================================================================
    // APPLY PAGINATION
    // =========================================================================
    const total = allChatbots.length;
    const totalPages = Math.ceil(total / limit);
    const startIndex = (page - 1) * limit;
    const paginatedChatbots = allChatbots.slice(startIndex, startIndex + limit);

    return {
      chatbots: paginatedChatbots,
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
    };
  }

  /**
   * Get filter options for dropdowns
   */
  async getFilterOptions(): Promise<ChatbotFilterOptions> {
    // Get courses that have chatbot sections
    const coursesWithChatbots = await prisma.course.findMany({
      where: {
        modules: {
          some: {
            lectures: {
              some: {
                sections: {
                  some: {
                    type: 'chatbot',
                  },
                },
              },
            },
          },
        },
      },
      select: { id: true, title: true },
      orderBy: { title: 'asc' },
    });

    // Get instructors who created chatbot sections
    const instructors = await prisma.user.findMany({
      where: {
        taughtCourses: {
          some: {
            modules: {
              some: {
                lectures: {
                  some: {
                    sections: {
                      some: {
                        type: 'chatbot',
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
      select: { id: true, fullname: true, email: true },
      orderBy: { fullname: 'asc' },
    });

    // Get categories from global chatbots
    const categoryGroups = await prisma.chatbot.groupBy({
      by: ['category'],
      _count: { id: true },
      where: { category: { not: null } },
    });

    const categories = categoryGroups
      .filter(g => g.category)
      .map(g => ({
        category: g.category!,
        count: g._count.id,
      }));

    // Add section chatbot category
    const sectionChatbotCount = await prisma.lectureSection.count({
      where: { type: 'chatbot' },
    });
    if (sectionChatbotCount > 0) {
      categories.push({ category: 'course_chatbot', count: sectionChatbotCount });
    }

    return {
      courses: coursesWithChatbots,
      creators: instructors,
      categories: categories.sort((a, b) => b.count - a.count),
    };
  }

  /**
   * Get summary statistics
   */
  async getStats(filters?: { startDate?: string; endDate?: string }): Promise<ChatbotRegistryStats> {
    const dateFilter: any = {};
    if (filters?.startDate) {
      dateFilter.gte = new Date(filters.startDate);
    }
    if (filters?.endDate) {
      dateFilter.lte = new Date(filters.endDate);
    }

    // Count global chatbots
    const globalCount = await prisma.chatbot.count();

    // Count section chatbots
    const sectionCount = await prisma.lectureSection.count({
      where: { type: 'chatbot' },
    });

    // Count conversations and messages for global chatbots (TutorConversation)
    const tutorConversations = await prisma.tutorConversation.count();
    const tutorMessages = await prisma.tutorMessage.count();

    // Count conversations and messages for section chatbots (ChatbotConversation)
    const chatbotConversations = await prisma.chatbotConversation.count();
    const chatbotMessages = await prisma.chatbotConversationMessage.count();

    // Unique users from both systems
    const tutorUsers = await prisma.tutorSession.findMany({
      select: { userId: true },
      distinct: ['userId'],
    });
    const chatbotUsers = await prisma.chatbotConversation.findMany({
      select: { userId: true },
      distinct: ['userId'],
    });
    const allUserIds = new Set([
      ...tutorUsers.map(u => u.userId),
      ...chatbotUsers.map(u => u.userId),
    ]);

    // Get category breakdown
    const categoryGroups = await prisma.chatbot.groupBy({
      by: ['category'],
      _count: { id: true },
    });
    const byCategory = categoryGroups.map(g => ({
      category: g.category || 'uncategorized',
      count: g._count.id,
    }));
    byCategory.push({ category: 'course_chatbot', count: sectionCount });

    // Get course breakdown for section chatbots
    const sectionsByCourse = await prisma.lectureSection.findMany({
      where: { type: 'chatbot' },
      include: {
        lecture: {
          include: {
            module: {
              include: {
                course: { select: { id: true, title: true } },
              },
            },
          },
        },
      },
    });

    const courseCountMap = new Map<number, { title: string; count: number }>();
    for (const section of sectionsByCourse) {
      const course = section.lecture?.module?.course;
      if (course) {
        const existing = courseCountMap.get(course.id);
        if (existing) {
          existing.count++;
        } else {
          courseCountMap.set(course.id, { title: course.title, count: 1 });
        }
      }
    }
    const byCourse = Array.from(courseCountMap.entries()).map(([courseId, data]) => ({
      courseId,
      courseTitle: data.title,
      count: data.count,
    }));

    return {
      totalChatbots: globalCount + sectionCount,
      globalChatbots: globalCount,
      sectionChatbots: sectionCount,
      totalConversations: tutorConversations + chatbotConversations,
      totalMessages: tutorMessages + chatbotMessages,
      uniqueUsers: allUserIds.size,
      byCategory,
      byCourse: byCourse.sort((a, b) => b.count - a.count),
    };
  }

  /**
   * Export chatbots to a format suitable for download
   */
  async exportChatbots(filters: ChatbotRegistryFilters = {}): Promise<UnifiedChatbot[]> {
    // Get all chatbots without pagination
    const { chatbots } = await this.getChatbots({
      ...filters,
      page: 1,
      limit: 10000, // High limit to get all
    });
    return chatbots;
  }

  /**
   * Generate Excel workbook for export
   */
  async generateExcelWorkbook(filters: ChatbotRegistryFilters = {}): Promise<ExcelJS.Workbook> {
    const chatbots = await this.exportChatbots(filters);

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Chatbot Registry');

    worksheet.columns = [
      { header: 'ID', key: 'id', width: 15 },
      { header: 'Type', key: 'type', width: 10 },
      { header: 'Name', key: 'name', width: 20 },
      { header: 'Display Name', key: 'displayName', width: 25 },
      { header: 'Description', key: 'description', width: 40 },
      { header: 'Category', key: 'category', width: 15 },
      { header: 'Is Active', key: 'isActive', width: 10 },
      { header: 'System Prompt', key: 'systemPrompt', width: 50 },
      { header: 'Welcome Message', key: 'welcomeMessage', width: 30 },
      { header: 'Dos Rules', key: 'dosRules', width: 30 },
      { header: 'Donts Rules', key: 'dontsRules', width: 30 },
      { header: 'Personality', key: 'personality', width: 15 },
      { header: 'Temperature', key: 'temperature', width: 12 },
      { header: 'Max Tokens', key: 'maxTokens', width: 12 },
      { header: 'Response Style', key: 'responseStyle', width: 15 },
      { header: 'Model Preference', key: 'modelPreference', width: 18 },
      { header: 'Course ID', key: 'courseId', width: 10 },
      { header: 'Course Title', key: 'courseTitle', width: 25 },
      { header: 'Module Title', key: 'moduleTitle', width: 20 },
      { header: 'Lecture Title', key: 'lectureTitle', width: 20 },
      { header: 'Creator ID', key: 'creatorId', width: 10 },
      { header: 'Creator Name', key: 'creatorName', width: 20 },
      { header: 'Creator Email', key: 'creatorEmail', width: 25 },
      { header: 'Conversations', key: 'conversationCount', width: 14 },
      { header: 'Messages', key: 'messageCount', width: 12 },
      { header: 'Unique Users', key: 'uniqueUsers', width: 12 },
      { header: 'Last Activity', key: 'lastActivity', width: 20 },
      { header: 'Created At', key: 'createdAt', width: 20 },
      { header: 'Updated At', key: 'updatedAt', width: 20 },
    ];

    // Style header row
    worksheet.getRow(1).font = { bold: true };
    worksheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE0E0E0' },
    };

    // Add data rows
    chatbots.forEach(c => {
      worksheet.addRow({
        ...c,
        dosRules: c.dosRules ? JSON.stringify(c.dosRules) : '',
        dontsRules: c.dontsRules ? JSON.stringify(c.dontsRules) : '',
        suggestedQuestions: c.suggestedQuestions ? JSON.stringify(c.suggestedQuestions) : '',
      });
    });

    return workbook;
  }

  /**
   * Generate CSV string for export
   */
  async generateCSV(filters: ChatbotRegistryFilters = {}): Promise<string> {
    const chatbots = await this.exportChatbots(filters);

    const headers = [
      'ID',
      'Type',
      'Name',
      'Display Name',
      'Description',
      'Category',
      'Is Active',
      'System Prompt',
      'Welcome Message',
      'Dos Rules',
      'Donts Rules',
      'Personality',
      'Temperature',
      'Max Tokens',
      'Response Style',
      'Model Preference',
      'Course ID',
      'Course Title',
      'Module Title',
      'Lecture Title',
      'Creator ID',
      'Creator Name',
      'Creator Email',
      'Conversation Count',
      'Message Count',
      'Unique Users',
      'Last Activity',
      'Created At',
      'Updated At',
    ];

    const escapeCSV = (val: unknown): string => {
      if (val === null || val === undefined) return '';
      const str = Array.isArray(val) ? JSON.stringify(val) : String(val);
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const rows = chatbots.map(c => [
      c.id,
      c.type,
      c.name,
      c.displayName,
      c.description,
      c.category,
      c.isActive,
      c.systemPrompt,
      c.welcomeMessage,
      c.dosRules,
      c.dontsRules,
      c.personality,
      c.temperature,
      c.maxTokens,
      c.responseStyle,
      c.modelPreference,
      c.courseId,
      c.courseTitle,
      c.moduleTitle,
      c.lectureTitle,
      c.creatorId,
      c.creatorName,
      c.creatorEmail,
      c.conversationCount,
      c.messageCount,
      c.uniqueUsers,
      c.lastActivity,
      c.createdAt,
      c.updatedAt,
    ].map(escapeCSV).join(','));

    return [headers.join(','), ...rows].join('\n');
  }
}

export const chatbotRegistryService = new ChatbotRegistryService();
