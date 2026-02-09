import prisma from '../utils/prisma.js';
import { AppError } from '../middleware/error.middleware.js';
import { chatService } from './chat.service.js';
import { activityLogService } from './activityLog.service.js';

export interface SendMessageData {
  message: string;
}

export interface ConversationMessage {
  id: number;
  role: 'user' | 'assistant';
  content: string;
  createdAt: Date;
}

export class ChatbotConversationService {
  private async verifySection(sectionId: number) {
    const section = await prisma.lectureSection.findUnique({
      where: { id: sectionId },
      include: {
        lecture: {
          include: {
            module: {
              include: { course: true },
            },
          },
        },
      },
    });

    if (!section) {
      throw new AppError('Section not found', 404);
    }

    if (section.type !== 'chatbot') {
      throw new AppError('Section is not a chatbot section', 400);
    }

    return section;
  }

  private async verifyEnrollment(sectionId: number, userId: number) {
    const section = await this.verifySection(sectionId);
    const courseId = section.lecture.module.course.id;

    const enrollment = await prisma.enrollment.findUnique({
      where: {
        userId_courseId: {
          userId,
          courseId,
        },
      },
    });

    if (!enrollment) {
      throw new AppError('You must be enrolled in this course to use this chatbot', 403);
    }

    return section;
  }

  async getOrCreateConversation(sectionId: number, userId: number) {
    await this.verifyEnrollment(sectionId, userId);

    let conversation = await prisma.chatbotConversation.findUnique({
      where: {
        sectionId_userId: {
          sectionId,
          userId,
        },
      },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!conversation) {
      conversation = await prisma.chatbotConversation.create({
        data: {
          sectionId,
          userId,
        },
        include: {
          messages: {
            orderBy: { createdAt: 'asc' },
          },
        },
      });
    }

    return conversation;
  }

  async getConversationHistory(sectionId: number, userId: number): Promise<ConversationMessage[]> {
    const conversation = await this.getOrCreateConversation(sectionId, userId);

    return conversation.messages.map(msg => ({
      id: msg.id,
      role: msg.role as 'user' | 'assistant',
      content: msg.content,
      createdAt: msg.createdAt,
    }));
  }

  async sendMessage(sectionId: number, userId: number, data: SendMessageData) {
    const section = await this.verifyEnrollment(sectionId, userId);
    const conversation = await this.getOrCreateConversation(sectionId, userId);

    // Save user message
    await prisma.chatbotConversationMessage.create({
      data: {
        conversationId: conversation.id,
        role: 'user',
        content: data.message,
      },
    });

    // Build conversation history for AI context
    const existingMessages = await prisma.chatbotConversationMessage.findMany({
      where: { conversationId: conversation.id },
      orderBy: { createdAt: 'asc' },
      take: 20, // Limit context window
    });

    // Build the context from previous messages
    const conversationContext = existingMessages
      .map(msg => `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content}`)
      .join('\n');

    // Get AI response using the section's custom system prompt
    const systemPrompt = section.chatbotSystemPrompt ||
      'You are a helpful AI teaching assistant. Help the student understand the course material and answer their questions.';

    const courseTitle = section.lecture.module.course.title;
    const lectureTitle = section.lecture.title;
    const moduleTitle = section.lecture.module.title;

    const fullSystemPrompt = `${systemPrompt}

Course: ${courseTitle}
Module: ${moduleTitle}
Lesson: ${lectureTitle}

Previous conversation:
${conversationContext}`;

    try {
      const response = await chatService.chat({
        message: data.message,
        module: `section-chatbot-${sectionId}`,
        systemPrompt: fullSystemPrompt,
      }, userId);

      // Save assistant response
      const assistantMessage = await prisma.chatbotConversationMessage.create({
        data: {
          conversationId: conversation.id,
          role: 'assistant',
          content: response.reply,
        },
      });

      // Update conversation timestamp
      await prisma.chatbotConversation.update({
        where: { id: conversation.id },
        data: { updatedAt: new Date() },
      });

      // Log chatbot message activity with full message content
      console.log('[ChatbotConversation] Logging message activity to LearningActivityLog:', {
        userId,
        verb: 'messaged',
        objectType: 'chatbot',
        sectionId,
        courseId: section.lecture.module.course.id,
        hasUserMessage: !!data.message,
        hasAssistantMessage: !!response.reply,
      });

      activityLogService.logActivity({
        userId,
        verb: 'messaged',
        objectType: 'chatbot',
        objectId: sectionId,
        objectTitle: section.chatbotTitle || 'Chatbot',
        sectionId,
        lectureId: section.lectureId,
        courseId: section.lecture.module.course.id,
        extensions: {
          conversationId: conversation.id,
          userMessage: data.message,
          assistantMessage: response.reply,
          messageLength: data.message.length,
          responseLength: response.reply.length,
          aiModel: response.model,
          responseTime: response.responseTime,
        },
      }).then(() => {
        console.log('[ChatbotConversation] Activity logged successfully');
      }).catch((err) => console.error('[ChatbotConversation] Failed to log activity:', err)); // Non-blocking

      return {
        userMessage: {
          role: 'user' as const,
          content: data.message,
        },
        assistantMessage: {
          id: assistantMessage.id,
          role: 'assistant' as const,
          content: response.reply,
          createdAt: assistantMessage.createdAt,
        },
        model: response.model,
        responseTime: response.responseTime,
      };
    } catch (error: any) {
      throw new AppError(error.message || 'Failed to get AI response', 500);
    }
  }

  async clearConversation(sectionId: number, userId: number) {
    const section = await this.verifyEnrollment(sectionId, userId);

    const conversation = await prisma.chatbotConversation.findUnique({
      where: {
        sectionId_userId: {
          sectionId,
          userId,
        },
      },
    });

    let messageCount = 0;
    if (conversation) {
      const result = await prisma.chatbotConversationMessage.deleteMany({
        where: { conversationId: conversation.id },
      });
      messageCount = result.count;
    }

    // Log conversation cleared activity
    activityLogService.logActivity({
      userId,
      verb: 'cleared',
      objectType: 'chatbot',
      objectId: sectionId,
      objectTitle: section.chatbotTitle || 'Chatbot',
      sectionId,
      lectureId: section.lectureId,
      courseId: section.lecture.module.course.id,
      extensions: {
        conversationId: conversation?.id,
        messagesCleared: messageCount,
      },
    }).catch((err) => console.error('[ChatbotConversation] Failed to log clear activity:', err)); // Non-blocking

    return { message: 'Conversation cleared successfully' };
  }

  // ============= INSTRUCTOR METHODS =============

  private async verifyCourseOwnership(courseId: number, instructorId: number, isAdmin = false) {
    const course = await prisma.course.findUnique({
      where: { id: courseId },
    });

    if (!course) {
      throw new AppError('Course not found', 404);
    }

    if (course.instructorId !== instructorId && !isAdmin) {
      throw new AppError('Not authorized', 403);
    }

    return course;
  }

  async getChatbotSectionsForCourse(courseId: number, instructorId: number, isAdmin = false) {
    await this.verifyCourseOwnership(courseId, instructorId, isAdmin);

    const sections = await prisma.lectureSection.findMany({
      where: {
        type: 'chatbot',
        lecture: {
          module: {
            courseId,
          },
        },
      },
      include: {
        lecture: {
          include: {
            module: {
              select: {
                id: true,
                title: true,
                orderIndex: true,
              },
            },
          },
        },
        _count: {
          select: {
            chatbotConversations: true,
          },
        },
      },
      orderBy: {
        order: 'asc',
      },
    });

    // Sort by module orderIndex, then by lecture orderIndex
    const sortedSections = sections.sort((a, b) => {
      const moduleOrderA = a.lecture.module.orderIndex;
      const moduleOrderB = b.lecture.module.orderIndex;
      if (moduleOrderA !== moduleOrderB) return moduleOrderA - moduleOrderB;
      return a.lecture.orderIndex - b.lecture.orderIndex;
    });

    return sortedSections.map(section => ({
      id: section.id,
      title: section.chatbotTitle || 'Untitled Chatbot',
      lectureId: section.lecture.id,
      lectureTitle: section.lecture.title,
      moduleTitle: section.lecture.module.title,
      totalConversations: section._count.chatbotConversations,
    }));
  }

  async getConversationsForSection(
    sectionId: number,
    instructorId: number,
    isAdmin = false,
    page = 1,
    limit = 20
  ) {
    const section = await prisma.lectureSection.findUnique({
      where: { id: sectionId },
      include: {
        lecture: {
          include: {
            module: {
              include: { course: true },
            },
          },
        },
      },
    });

    if (!section) {
      throw new AppError('Section not found', 404);
    }

    if (section.type !== 'chatbot') {
      throw new AppError('Section is not a chatbot section', 400);
    }

    const courseId = section.lecture.module.course.id;
    await this.verifyCourseOwnership(courseId, instructorId, isAdmin);

    const skip = (page - 1) * limit;

    const [conversations, total] = await Promise.all([
      prisma.chatbotConversation.findMany({
        where: { sectionId },
        include: {
          user: {
            select: {
              id: true,
              fullname: true,
              email: true,
            },
          },
          _count: {
            select: {
              messages: true,
            },
          },
        },
        orderBy: { updatedAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.chatbotConversation.count({ where: { sectionId } }),
    ]);

    return {
      conversations: conversations.map(conv => ({
        id: conv.id,
        user: conv.user,
        messageCount: conv._count.messages,
        createdAt: conv.createdAt,
        updatedAt: conv.updatedAt,
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getConversationMessagesForInstructor(
    conversationId: number,
    instructorId: number,
    isAdmin = false
  ) {
    const conversation = await prisma.chatbotConversation.findUnique({
      where: { id: conversationId },
      include: {
        section: {
          include: {
            lecture: {
              include: {
                module: {
                  include: { course: true },
                },
              },
            },
          },
        },
        user: {
          select: {
            id: true,
            fullname: true,
            email: true,
          },
        },
      },
    });

    if (!conversation) {
      throw new AppError('Conversation not found', 404);
    }

    const courseId = conversation.section.lecture.module.course.id;
    await this.verifyCourseOwnership(courseId, instructorId, isAdmin);

    const messages = await prisma.chatbotConversationMessage.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'asc' },
    });

    return {
      conversation: {
        id: conversation.id,
        user: conversation.user,
        sectionTitle: conversation.section.chatbotTitle || 'Untitled Chatbot',
        lectureTitle: conversation.section.lecture.title,
        moduleTitle: conversation.section.lecture.module.title,
        createdAt: conversation.createdAt,
        updatedAt: conversation.updatedAt,
      },
      messages: messages.map(msg => ({
        id: msg.id,
        role: msg.role as 'user' | 'assistant',
        content: msg.content,
        createdAt: msg.createdAt,
      })),
    };
  }

  async getChatbotAnalytics(courseId: number, instructorId: number, isAdmin = false) {
    await this.verifyCourseOwnership(courseId, instructorId, isAdmin);

    // Get all chatbot sections for this course
    const sections = await prisma.lectureSection.findMany({
      where: {
        type: 'chatbot',
        lecture: {
          module: {
            courseId,
          },
        },
      },
      select: { id: true },
    });

    const sectionIds = sections.map(s => s.id);

    // Get conversation stats
    const [totalConversations, totalMessages, activeUsers, recentMessages] = await Promise.all([
      prisma.chatbotConversation.count({
        where: { sectionId: { in: sectionIds } },
      }),
      prisma.chatbotConversationMessage.count({
        where: {
          conversation: {
            sectionId: { in: sectionIds },
          },
        },
      }),
      prisma.chatbotConversation.groupBy({
        by: ['userId'],
        where: { sectionId: { in: sectionIds } },
      }),
      prisma.chatbotConversationMessage.findMany({
        where: {
          conversation: {
            sectionId: { in: sectionIds },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: 10,
        include: {
          conversation: {
            include: {
              user: {
                select: {
                  id: true,
                  fullname: true,
                },
              },
              section: {
                select: {
                  chatbotTitle: true,
                },
              },
            },
          },
        },
      }),
    ]);

    return {
      totalConversations,
      totalMessages,
      uniqueStudents: activeUsers.length,
      avgMessagesPerConversation: totalConversations > 0
        ? Math.round(totalMessages / totalConversations * 10) / 10
        : 0,
      recentActivity: recentMessages.map(msg => ({
        id: msg.id,
        role: msg.role,
        content: msg.content.substring(0, 100) + (msg.content.length > 100 ? '...' : ''),
        userName: msg.conversation.user.fullname,
        sectionTitle: msg.conversation.section.chatbotTitle || 'Chatbot',
        createdAt: msg.createdAt,
      })),
    };
  }
}

export const chatbotConversationService = new ChatbotConversationService();
