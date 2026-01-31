import prisma from '../utils/prisma.js';
import { AppError } from '../middleware/error.middleware.js';
import { chatService } from './chat.service.js';
import { activityLogService } from './activityLog.service.js';

// Types
export interface CourseTutorData {
  id: number;
  courseId: number;
  chatbotId: number;
  customName: string | null;
  customDescription: string | null;
  customSystemPrompt: string | null;
  customWelcomeMessage: string | null;
  customPersonality: string | null;
  customTemperature: number | null;
  isActive: boolean;
  displayOrder: number;
  createdAt: Date;
  updatedAt: Date;
  chatbot?: {
    id: number;
    name: string;
    displayName: string;
    description: string | null;
    systemPrompt: string;
    welcomeMessage: string | null;
    avatarUrl: string | null;
    personality: string | null;
    temperature: number | null;
  };
}

export interface CourseTutorWithStats extends CourseTutorData {
  _count?: {
    conversations: number;
  };
  totalMessages?: number;
}

export interface MergedTutorConfig {
  id: number;
  courseTutorId: number;
  name: string;
  displayName: string;
  description: string | null;
  systemPrompt: string;
  welcomeMessage: string | null;
  avatarUrl: string | null;
  personality: string | null;
  temperature: number | null;
  isCustomized: boolean;
}

export interface ConversationData {
  id: number;
  courseTutorId: number;
  userId: number;
  title: string | null;
  createdAt: Date;
  updatedAt: Date;
  messages?: MessageData[];
}

export interface MessageData {
  id: number;
  conversationId: number;
  role: 'user' | 'assistant';
  content: string;
  createdAt: Date;
}

export interface CreateTutorInput {
  chatbotId: number;
  customName?: string;
  customDescription?: string;
  customSystemPrompt?: string;
  customWelcomeMessage?: string;
  customPersonality?: string;
  customTemperature?: number;
}

export interface BuildTutorInput {
  name: string;
  displayName: string;
  description?: string;
  systemPrompt: string;
  welcomeMessage?: string;
  personality?: string;
  temperature?: number;
}

export interface UpdateTutorInput {
  customName?: string | null;
  customDescription?: string | null;
  customSystemPrompt?: string | null;
  customWelcomeMessage?: string | null;
  customPersonality?: string | null;
  customTemperature?: number | null;
  isActive?: boolean;
}

class CourseTutorService {
  // ==========================================================================
  // INSTRUCTOR: TUTOR MANAGEMENT
  // ==========================================================================

  /**
   * Get all tutors for a course with stats
   */
  async getCourseTutors(courseId: number): Promise<CourseTutorWithStats[]> {
    const tutors = await prisma.courseTutor.findMany({
      where: { courseId },
      include: {
        chatbot: {
          select: {
            id: true,
            name: true,
            displayName: true,
            description: true,
            systemPrompt: true,
            welcomeMessage: true,
            avatarUrl: true,
            personality: true,
            temperature: true,
          },
        },
        _count: {
          select: { conversations: true },
        },
      },
      orderBy: { displayOrder: 'asc' },
    });

    // Get total message counts
    const tutorsWithStats = await Promise.all(
      tutors.map(async (tutor) => {
        const messageCount = await prisma.courseTutorMessage.count({
          where: {
            conversation: {
              courseTutorId: tutor.id,
            },
          },
        });
        return {
          ...tutor,
          totalMessages: messageCount,
        };
      })
    );

    return tutorsWithStats;
  }

  /**
   * Add a global tutor to a course with optional customization
   */
  async addTutorToCourse(
    courseId: number,
    input: CreateTutorInput,
    userId: number
  ): Promise<CourseTutorData> {
    // Verify course exists and user is instructor
    const course = await prisma.course.findUnique({
      where: { id: courseId },
    });

    if (!course) {
      throw new AppError('Course not found', 404);
    }

    // Verify chatbot exists
    const chatbot = await prisma.chatbot.findUnique({
      where: { id: input.chatbotId },
    });

    if (!chatbot || !chatbot.isActive) {
      throw new AppError('Chatbot not found or inactive', 404);
    }

    // Check if already added
    const existing = await prisma.courseTutor.findUnique({
      where: {
        courseId_chatbotId: {
          courseId,
          chatbotId: input.chatbotId,
        },
      },
    });

    if (existing) {
      throw new AppError('This tutor is already added to the course', 400);
    }

    // Get current max display order
    const maxOrder = await prisma.courseTutor.findFirst({
      where: { courseId },
      orderBy: { displayOrder: 'desc' },
      select: { displayOrder: true },
    });

    const courseTutor = await prisma.courseTutor.create({
      data: {
        courseId,
        chatbotId: input.chatbotId,
        customName: input.customName,
        customDescription: input.customDescription,
        customSystemPrompt: input.customSystemPrompt,
        customWelcomeMessage: input.customWelcomeMessage,
        customPersonality: input.customPersonality,
        customTemperature: input.customTemperature,
        displayOrder: (maxOrder?.displayOrder ?? -1) + 1,
      },
      include: {
        chatbot: {
          select: {
            id: true,
            name: true,
            displayName: true,
            description: true,
            systemPrompt: true,
            welcomeMessage: true,
            avatarUrl: true,
            personality: true,
            temperature: true,
          },
        },
      },
    });

    // Log activity
    activityLogService.logActivity({
      userId,
      verb: 'created',
      objectType: 'course_tutor',
      objectId: courseTutor.id,
      objectTitle: input.customName || chatbot.displayName,
      courseId,
      extensions: {
        courseTitle: course.title,
        chatbotId: input.chatbotId,
        chatbotName: chatbot.displayName,
        isCustomized: !!(input.customName || input.customSystemPrompt),
      },
    }).catch(err => console.error('[CourseTutor] Failed to log activity:', err));

    return courseTutor;
  }

  /**
   * Update course tutor customization
   */
  async updateCourseTutor(
    courseTutorId: number,
    input: UpdateTutorInput,
    userId: number
  ): Promise<CourseTutorData> {
    const existing = await prisma.courseTutor.findUnique({
      where: { id: courseTutorId },
      include: {
        course: { select: { id: true, title: true } },
        chatbot: { select: { displayName: true } },
      },
    });

    if (!existing) {
      throw new AppError('Course tutor not found', 404);
    }

    const updated = await prisma.courseTutor.update({
      where: { id: courseTutorId },
      data: {
        customName: input.customName,
        customDescription: input.customDescription,
        customSystemPrompt: input.customSystemPrompt,
        customWelcomeMessage: input.customWelcomeMessage,
        customPersonality: input.customPersonality,
        customTemperature: input.customTemperature,
        isActive: input.isActive,
      },
      include: {
        chatbot: {
          select: {
            id: true,
            name: true,
            displayName: true,
            description: true,
            systemPrompt: true,
            welcomeMessage: true,
            avatarUrl: true,
            personality: true,
            temperature: true,
          },
        },
      },
    });

    // Log activity
    activityLogService.logActivity({
      userId,
      verb: 'updated',
      objectType: 'course_tutor',
      objectId: courseTutorId,
      objectTitle: input.customName || existing.chatbot.displayName,
      courseId: existing.course.id,
      extensions: { courseTitle: existing.course.title },
    }).catch(err => console.error('[CourseTutor] Failed to log activity:', err));

    return updated;
  }

  /**
   * Remove tutor from course
   */
  async removeCourseTutor(courseTutorId: number, userId: number): Promise<void> {
    const existing = await prisma.courseTutor.findUnique({
      where: { id: courseTutorId },
      include: {
        course: { select: { id: true, title: true } },
        chatbot: { select: { displayName: true } },
      },
    });

    if (!existing) {
      throw new AppError('Course tutor not found', 404);
    }

    await prisma.courseTutor.delete({
      where: { id: courseTutorId },
    });

    // Log activity
    activityLogService.logActivity({
      userId,
      verb: 'deleted',
      objectType: 'course_tutor',
      objectId: courseTutorId,
      objectTitle: existing.customName || existing.chatbot.displayName,
      courseId: existing.course.id,
      extensions: { courseTitle: existing.course.title },
    }).catch(err => console.error('[CourseTutor] Failed to log activity:', err));
  }

  /**
   * Reorder course tutors
   */
  async reorderCourseTutors(
    courseId: number,
    orderedIds: number[]
  ): Promise<void> {
    // Validate all IDs belong to this course
    const tutors = await prisma.courseTutor.findMany({
      where: { courseId },
      select: { id: true },
    });

    const tutorIds = new Set(tutors.map((t) => t.id));
    for (const id of orderedIds) {
      if (!tutorIds.has(id)) {
        throw new AppError('Invalid tutor ID in order list', 400);
      }
    }

    // Update order
    await Promise.all(
      orderedIds.map((id, index) =>
        prisma.courseTutor.update({
          where: { id },
          data: { displayOrder: index },
        })
      )
    );
  }

  /**
   * Batch add multiple tutors to a course
   */
  async addTutorsToCourse(
    courseId: number,
    chatbotIds: number[],
    userId: number
  ): Promise<CourseTutorData[]> {
    // Verify course exists
    const course = await prisma.course.findUnique({
      where: { id: courseId },
    });

    if (!course) {
      throw new AppError('Course not found', 404);
    }

    // Get current max display order
    const maxOrder = await prisma.courseTutor.findFirst({
      where: { courseId },
      orderBy: { displayOrder: 'desc' },
      select: { displayOrder: true },
    });

    let currentOrder = (maxOrder?.displayOrder ?? -1) + 1;
    const addedTutors: CourseTutorData[] = [];

    for (const chatbotId of chatbotIds) {
      // Verify chatbot exists
      const chatbot = await prisma.chatbot.findUnique({
        where: { id: chatbotId },
      });

      if (!chatbot || !chatbot.isActive) {
        continue; // Skip inactive or non-existent chatbots
      }

      // Check if already added
      const existing = await prisma.courseTutor.findUnique({
        where: {
          courseId_chatbotId: {
            courseId,
            chatbotId,
          },
        },
      });

      if (existing) {
        continue; // Skip already added
      }

      const courseTutor = await prisma.courseTutor.create({
        data: {
          courseId,
          chatbotId,
          displayOrder: currentOrder++,
        },
        include: {
          chatbot: {
            select: {
              id: true,
              name: true,
              displayName: true,
              description: true,
              systemPrompt: true,
              welcomeMessage: true,
              avatarUrl: true,
              personality: true,
              temperature: true,
            },
          },
        },
      });

      addedTutors.push(courseTutor);

      // Log activity
      activityLogService.logActivity({
        userId,
        verb: 'created',
        objectType: 'course_tutor',
        objectId: courseTutor.id,
        objectTitle: chatbot.displayName,
        courseId,
        extensions: {
          courseTitle: course.title,
          chatbotId,
          chatbotName: chatbot.displayName,
          batchAdd: true,
        },
      }).catch(err => console.error('[CourseTutor] Failed to log activity:', err));
    }

    return addedTutors;
  }

  /**
   * Build a new tutor (create chatbot) and add to course
   */
  async buildAndAddTutor(
    courseId: number,
    input: BuildTutorInput,
    userId: number
  ): Promise<CourseTutorData> {
    // Verify course exists
    const course = await prisma.course.findUnique({
      where: { id: courseId },
    });

    if (!course) {
      throw new AppError('Course not found', 404);
    }

    // Check if chatbot name already exists
    const existingChatbot = await prisma.chatbot.findUnique({
      where: { name: input.name },
    });

    if (existingChatbot) {
      throw new AppError('A chatbot with this name already exists', 409);
    }

    // Create the chatbot
    const chatbot = await prisma.chatbot.create({
      data: {
        name: input.name,
        displayName: input.displayName,
        description: input.description || null,
        systemPrompt: input.systemPrompt,
        welcomeMessage: input.welcomeMessage || null,
        personality: input.personality || 'friendly',
        temperature: input.temperature ?? 0.7,
        category: 'tutor',
        isActive: true,
        isSystem: false,
      },
    });

    // Get current max display order
    const maxOrder = await prisma.courseTutor.findFirst({
      where: { courseId },
      orderBy: { displayOrder: 'desc' },
      select: { displayOrder: true },
    });

    // Add to course
    const courseTutor = await prisma.courseTutor.create({
      data: {
        courseId,
        chatbotId: chatbot.id,
        displayOrder: (maxOrder?.displayOrder ?? -1) + 1,
      },
      include: {
        chatbot: {
          select: {
            id: true,
            name: true,
            displayName: true,
            description: true,
            systemPrompt: true,
            welcomeMessage: true,
            avatarUrl: true,
            personality: true,
            temperature: true,
          },
        },
      },
    });

    // Log activity
    activityLogService.logActivity({
      userId,
      verb: 'created',
      objectType: 'course_tutor',
      objectId: courseTutor.id,
      objectTitle: input.displayName,
      courseId,
      extensions: {
        courseTitle: course.title,
        chatbotId: chatbot.id,
        chatbotName: chatbot.displayName,
        builtNew: true,
      },
    }).catch(err => console.error('[CourseTutor] Failed to log activity:', err));

    return courseTutor;
  }

  /**
   * Get available global tutors (for adding to course)
   */
  async getAvailableTutors(courseId: number): Promise<any[]> {
    // Get tutors already in the course
    const existingTutors = await prisma.courseTutor.findMany({
      where: { courseId },
      select: { chatbotId: true },
    });
    const existingIds = new Set(existingTutors.map((t) => t.chatbotId));

    // Get all active tutors
    const allTutors = await prisma.chatbot.findMany({
      where: {
        isActive: true,
        category: 'tutor',
      },
      select: {
        id: true,
        name: true,
        displayName: true,
        description: true,
        avatarUrl: true,
        personality: true,
      },
      orderBy: { displayName: 'asc' },
    });

    // Mark which ones are already added
    return allTutors.map((t) => ({
      ...t,
      alreadyAdded: existingIds.has(t.id),
    }));
  }

  /**
   * Get tutor statistics for a course
   */
  async getTutorStats(courseId: number): Promise<{
    totalTutors: number;
    activeTutors: number;
    totalConversations: number;
    totalMessages: number;
    tutorStats: Array<{
      id: number;
      name: string;
      conversations: number;
      messages: number;
    }>;
  }> {
    const tutors = await prisma.courseTutor.findMany({
      where: { courseId },
      include: {
        chatbot: { select: { displayName: true } },
        _count: { select: { conversations: true } },
      },
    });

    const tutorStats = await Promise.all(
      tutors.map(async (tutor) => {
        const messageCount = await prisma.courseTutorMessage.count({
          where: {
            conversation: { courseTutorId: tutor.id },
          },
        });
        return {
          id: tutor.id,
          name: tutor.customName || tutor.chatbot.displayName,
          conversations: tutor._count.conversations,
          messages: messageCount,
        };
      })
    );

    return {
      totalTutors: tutors.length,
      activeTutors: tutors.filter((t) => t.isActive).length,
      totalConversations: tutorStats.reduce((sum, t) => sum + t.conversations, 0),
      totalMessages: tutorStats.reduce((sum, t) => sum + t.messages, 0),
      tutorStats,
    };
  }

  // ==========================================================================
  // STUDENT: TUTOR ACCESS & CHAT
  // ==========================================================================

  /**
   * Get tutors available for a student in a course
   */
  async getStudentTutors(courseId: number, userId: number): Promise<MergedTutorConfig[]> {
    // Verify enrollment
    const enrollment = await prisma.enrollment.findUnique({
      where: {
        userId_courseId: { userId, courseId },
      },
    });

    if (!enrollment) {
      throw new AppError('Not enrolled in this course', 403);
    }

    const tutors = await prisma.courseTutor.findMany({
      where: {
        courseId,
        isActive: true,
      },
      include: {
        chatbot: {
          select: {
            id: true,
            name: true,
            displayName: true,
            description: true,
            systemPrompt: true,
            welcomeMessage: true,
            avatarUrl: true,
            personality: true,
            temperature: true,
          },
        },
      },
      orderBy: { displayOrder: 'asc' },
    });

    return tutors.map((t) => this.getMergedConfig(t));
  }

  /**
   * Merge global and custom configuration
   */
  getMergedConfig(courseTutor: CourseTutorData): MergedTutorConfig {
    const chatbot = courseTutor.chatbot!;
    const hasCustomization = !!(
      courseTutor.customName ||
      courseTutor.customDescription ||
      courseTutor.customSystemPrompt ||
      courseTutor.customWelcomeMessage ||
      courseTutor.customPersonality ||
      courseTutor.customTemperature
    );

    return {
      id: chatbot.id,
      courseTutorId: courseTutor.id,
      name: chatbot.name,
      displayName: courseTutor.customName || chatbot.displayName,
      description: courseTutor.customDescription || chatbot.description,
      systemPrompt: courseTutor.customSystemPrompt || chatbot.systemPrompt,
      welcomeMessage: courseTutor.customWelcomeMessage || chatbot.welcomeMessage,
      avatarUrl: chatbot.avatarUrl,
      personality: courseTutor.customPersonality || chatbot.personality,
      temperature: courseTutor.customTemperature ?? chatbot.temperature,
      isCustomized: hasCustomization,
    };
  }

  /**
   * Get student's conversations with a course tutor
   */
  async getConversations(
    courseTutorId: number,
    userId: number
  ): Promise<ConversationData[]> {
    const conversations = await prisma.courseTutorConversation.findMany({
      where: {
        courseTutorId,
        userId,
      },
      include: {
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
      orderBy: { updatedAt: 'desc' },
    });

    return conversations.map((c) => ({
      id: c.id,
      courseTutorId: c.courseTutorId,
      userId: c.userId,
      title: c.title,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
      messages: c.messages.map((m) => ({
        id: m.id,
        conversationId: m.conversationId,
        role: m.role as 'user' | 'assistant',
        content: m.content,
        createdAt: m.createdAt,
      })),
    }));
  }

  /**
   * Create a new conversation
   */
  async createConversation(
    courseTutorId: number,
    userId: number
  ): Promise<ConversationData> {
    // Verify tutor exists and is active
    const tutor = await prisma.courseTutor.findUnique({
      where: { id: courseTutorId },
      include: {
        course: { select: { id: true, title: true } },
        chatbot: { select: { displayName: true } },
      },
    });

    if (!tutor || !tutor.isActive) {
      throw new AppError('Tutor not found or inactive', 404);
    }

    // Verify enrollment
    const enrollment = await prisma.enrollment.findUnique({
      where: {
        userId_courseId: { userId, courseId: tutor.courseId },
      },
    });

    if (!enrollment) {
      throw new AppError('Not enrolled in this course', 403);
    }

    const conversation = await prisma.courseTutorConversation.create({
      data: {
        courseTutorId,
        userId,
      },
    });

    // Log activity
    activityLogService.logActivity({
      userId,
      verb: 'started',
      objectType: 'course_tutor_conversation',
      objectId: conversation.id,
      objectTitle: tutor.customName || tutor.chatbot.displayName,
      courseId: tutor.course.id,
      extensions: { courseTitle: tutor.course.title },
    }).catch(err => console.error('[CourseTutor] Failed to log activity:', err));

    return {
      id: conversation.id,
      courseTutorId: conversation.courseTutorId,
      userId: conversation.userId,
      title: conversation.title,
      createdAt: conversation.createdAt,
      updatedAt: conversation.updatedAt,
    };
  }

  /**
   * Get conversation with messages
   */
  async getConversation(
    conversationId: number,
    userId: number
  ): Promise<ConversationData & { messages: MessageData[] }> {
    const conversation = await prisma.courseTutorConversation.findUnique({
      where: { id: conversationId },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!conversation) {
      throw new AppError('Conversation not found', 404);
    }

    if (conversation.userId !== userId) {
      throw new AppError('Access denied', 403);
    }

    return {
      id: conversation.id,
      courseTutorId: conversation.courseTutorId,
      userId: conversation.userId,
      title: conversation.title,
      createdAt: conversation.createdAt,
      updatedAt: conversation.updatedAt,
      messages: conversation.messages.map((m) => ({
        id: m.id,
        conversationId: m.conversationId,
        role: m.role as 'user' | 'assistant',
        content: m.content,
        createdAt: m.createdAt,
      })),
    };
  }

  /**
   * Send a message and get AI response
   */
  async sendMessage(
    conversationId: number,
    userId: number,
    content: string,
    clientInfo?: { ipAddress?: string; userAgent?: string; deviceType?: string }
  ): Promise<{
    userMessage: MessageData;
    assistantMessage: MessageData;
  }> {
    // Get conversation with tutor config
    const conversation = await prisma.courseTutorConversation.findUnique({
      where: { id: conversationId },
      include: {
        courseTutor: {
          include: {
            chatbot: true,
            course: { select: { id: true, title: true } },
          },
        },
        messages: {
          orderBy: { createdAt: 'asc' },
          take: 20, // Last 20 messages for context
        },
      },
    });

    if (!conversation) {
      throw new AppError('Conversation not found', 404);
    }

    if (conversation.userId !== userId) {
      throw new AppError('Access denied', 403);
    }

    const tutor = conversation.courseTutor;
    const chatbot = tutor.chatbot;
    const mergedConfig = this.getMergedConfig(tutor as CourseTutorData);

    // Save user message
    const userMessage = await prisma.courseTutorMessage.create({
      data: {
        conversationId,
        role: 'user',
        content,
      },
    });

    // Build conversation history
    const conversationHistory = conversation.messages.map((m) => ({
      role: m.role as 'user' | 'assistant' | 'system',
      content: m.content,
    }));

    // Build system prompt with course context
    let systemPrompt = mergedConfig.systemPrompt;
    systemPrompt += `\n\nIMPORTANT: You are ${mergedConfig.displayName}, a tutor for the course "${tutor.course.title}". Stay in character and provide helpful, course-relevant responses.`;

    // Get AI response
    let aiResponse: string;
    try {
      const response = await chatService.chat(
        {
          message: content,
          module: `course-tutor-${chatbot.name}`,
          systemPrompt,
          conversationHistory,
          temperature: mergedConfig.temperature ?? 0.7,
        },
        userId
      );
      aiResponse = response.reply;
    } catch (error: any) {
      console.error('[CourseTutor] AI response error:', error);
      throw new AppError('Failed to get AI response', 500);
    }

    // Save assistant message
    const assistantMessage = await prisma.courseTutorMessage.create({
      data: {
        conversationId,
        role: 'assistant',
        content: aiResponse,
      },
    });

    // Update conversation timestamp
    await prisma.courseTutorConversation.update({
      where: { id: conversationId },
      data: { updatedAt: new Date() },
    });

    // Log activity
    activityLogService.logActivity({
      userId,
      verb: 'messaged',
      objectType: 'course_tutor',
      objectId: tutor.id,
      objectTitle: mergedConfig.displayName,
      courseId: tutor.course.id,
      extensions: {
        courseTitle: tutor.course.title,
        conversationId,
        messageLength: content.length,
        responseLength: aiResponse.length,
      },
      deviceType: clientInfo?.deviceType,
    }).catch(err => console.error('[CourseTutor] Failed to log activity:', err));

    return {
      userMessage: {
        id: userMessage.id,
        conversationId: userMessage.conversationId,
        role: 'user',
        content: userMessage.content,
        createdAt: userMessage.createdAt,
      },
      assistantMessage: {
        id: assistantMessage.id,
        conversationId: assistantMessage.conversationId,
        role: 'assistant',
        content: assistantMessage.content,
        createdAt: assistantMessage.createdAt,
      },
    };
  }

  /**
   * Delete a conversation
   */
  async deleteConversation(conversationId: number, userId: number): Promise<void> {
    const conversation = await prisma.courseTutorConversation.findUnique({
      where: { id: conversationId },
    });

    if (!conversation) {
      throw new AppError('Conversation not found', 404);
    }

    if (conversation.userId !== userId) {
      throw new AppError('Access denied', 403);
    }

    await prisma.courseTutorConversation.delete({
      where: { id: conversationId },
    });
  }

  // ==========================================================================
  // ACCESS CONTROL HELPERS
  // ==========================================================================

  /**
   * Check if user is course instructor
   */
  async isCourseInstructor(courseId: number, userId: number): Promise<boolean> {
    const course = await prisma.course.findUnique({
      where: { id: courseId },
      select: { instructorId: true },
    });
    return course?.instructorId === userId;
  }

  /**
   * Check if user is enrolled in course
   */
  async isEnrolled(courseId: number, userId: number): Promise<boolean> {
    const enrollment = await prisma.enrollment.findUnique({
      where: {
        userId_courseId: { userId, courseId },
      },
    });
    return !!enrollment;
  }
}

export const courseTutorService = new CourseTutorService();
