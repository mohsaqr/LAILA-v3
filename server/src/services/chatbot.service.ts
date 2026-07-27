import prisma from '../utils/prisma.js';
import { AppError } from '../middleware/error.middleware.js';
import { CreateChatbotInput, UpdateChatbotInput } from '../utils/validation.js';
import { chatService } from './chat.service.js';

// Authoring "recipe" fields that must never leak to a viewer who can't edit
// the bot. `systemPrompt` is the sensitive one; the others shape it and are
// equally private. Display fields (displayName, description, welcomeMessage,
// suggestedQuestions, avatarUrl, personality) are always safe to return.
const CHATBOT_SECRET_FIELDS = [
  'systemPrompt',
  'personalityPrompt',
  'dosRules',
  'dontsRules',
  'knowledgeContext',
] as const;

function stripChatbotSecrets<T extends Record<string, any>>(chatbot: T): T {
  const clone: Record<string, any> = { ...chatbot };
  for (const f of CHATBOT_SECRET_FIELDS) delete clone[f];
  return clone as T;
}

export class ChatbotService {
  async getChatbots(
    includeInactive = false,
    requesterId?: number,
    requesterIsAdmin = false,
    requesterIsInstructor = false,
  ) {
    const where: any = {};
    if (!includeInactive) {
      where.isActive = true;
    }

    // Instructors (non-admin) only see system chatbots + their own
    if (requesterIsInstructor && !requesterIsAdmin && requesterId) {
      where.OR = [
        { isSystem: true },
        { creatorId: requesterId },
      ];
      // Override isActive filter inside the OR to still respect it
      if (!includeInactive) {
        delete where.isActive;
        where.AND = [
          { isActive: true },
          { OR: [{ isSystem: true }, { creatorId: requesterId }] },
        ];
        delete where.OR;
      }
    }

    const chatbots = await prisma.chatbot.findMany({
      where,
      orderBy: [
        { isSystem: 'desc' },
        { name: 'asc' },
      ],
    });

    // Attach canEdit flag: admins can edit everything; instructors only their own non-system chatbots
    const withEdit = chatbots.map(c => ({
      ...c,
      canEdit: requesterIsAdmin
        ? true
        : requesterIsInstructor
          ? !c.isSystem && c.creatorId === requesterId
          : false,
    }));

    // Students/guests never author bots, so they must never receive the prompt
    // recipe. Admins and instructors keep full rows (the query already limits
    // instructors to system + their own bots, both of which they legitimately
    // embed into lessons).
    if (requesterIsAdmin || requesterIsInstructor) {
      return withEdit;
    }
    return withEdit.map(stripChatbotSecrets);
  }

  async getChatbotByName(name: string, requesterId?: number, requesterIsAdmin = false) {
    const chatbot = await prisma.chatbot.findUnique({
      where: { name },
    });

    if (!chatbot) {
      throw new AppError('Chatbot not found', 404);
    }

    return this.canSeeChatbotSecrets(chatbot, requesterId, requesterIsAdmin)
      ? chatbot
      : stripChatbotSecrets(chatbot);
  }

  async getChatbotById(id: number, requesterId?: number, requesterIsAdmin = false) {
    const chatbot = await prisma.chatbot.findUnique({
      where: { id },
    });

    if (!chatbot) {
      throw new AppError('Chatbot not found', 404);
    }

    return this.canSeeChatbotSecrets(chatbot, requesterId, requesterIsAdmin)
      ? chatbot
      : stripChatbotSecrets(chatbot);
  }

  // Only the bot's creator or an admin may see its prompt recipe. System bots
  // (creatorId null) are admin-only for the by-id / by-name reads.
  private canSeeChatbotSecrets(
    chatbot: { creatorId: number | null },
    requesterId?: number,
    requesterIsAdmin = false,
  ): boolean {
    if (requesterIsAdmin) return true;
    return chatbot.creatorId != null && chatbot.creatorId === requesterId;
  }

  async createChatbot(data: CreateChatbotInput, creatorId?: number) {
    // Check if name already exists
    const existing = await prisma.chatbot.findUnique({
      where: { name: data.name },
    });

    if (existing) {
      throw new AppError('A chatbot with this name already exists', 409);
    }

    const chatbot = await prisma.chatbot.create({
      data: {
        name: data.name,
        displayName: data.displayName,
        description: data.description,
        systemPrompt: data.systemPrompt,
        category: data.category,
        isActive: data.isActive ?? true,
        isSystem: false,
        ...(creatorId ? { creatorId } : {}),
      },
    });

    return { ...chatbot, canEdit: true };
  }

  async updateChatbot(id: number, data: UpdateChatbotInput, requesterId?: number, requesterIsAdmin = false) {
    const chatbot = await prisma.chatbot.findUnique({
      where: { id },
    });

    if (!chatbot) {
      throw new AppError('Chatbot not found', 404);
    }

    // System chatbots: only admins can edit
    if (chatbot.isSystem && !requesterIsAdmin) {
      throw new AppError('Cannot modify system chatbot', 403);
    }

    // Non-admin instructors can only edit their own chatbots
    if (!requesterIsAdmin && chatbot.creatorId !== requesterId) {
      throw new AppError('You can only edit chatbots you created', 403);
    }

    // Don't allow modifying system chatbots' names
    if (chatbot.isSystem && data.name && data.name !== chatbot.name) {
      throw new AppError('Cannot change system chatbot name', 400);
    }

    // Check name uniqueness if changing
    if (data.name && data.name !== chatbot.name) {
      const existing = await prisma.chatbot.findUnique({
        where: { name: data.name },
      });
      if (existing) {
        throw new AppError('A chatbot with this name already exists', 409);
      }
    }

    const updated = await prisma.chatbot.update({
      where: { id },
      data,
    });

    return { ...updated, canEdit: true };
  }

  async deleteChatbot(id: number, requesterId?: number, requesterIsAdmin = false) {
    const chatbot = await prisma.chatbot.findUnique({
      where: { id },
    });

    if (!chatbot) {
      throw new AppError('Chatbot not found', 404);
    }

    if (chatbot.isSystem) {
      throw new AppError('Cannot delete system chatbot', 400);
    }

    // Non-admin instructors can only delete their own chatbots
    if (!requesterIsAdmin && chatbot.creatorId !== requesterId) {
      throw new AppError('You can only delete chatbots you created', 403);
    }

    await prisma.chatbot.delete({
      where: { id },
    });

    return { message: 'Chatbot deleted successfully' };
  }

  async chatWithBot(botName: string, message: string, sessionId?: string, userId?: number) {
    // Fetch the raw prompt directly — the sanitizing accessors would strip
    // systemPrompt, and the persona is needed server-side to drive the chat.
    const chatbot = await prisma.chatbot.findUnique({
      where: { name: botName },
      select: { systemPrompt: true, isActive: true },
    });

    if (!chatbot) {
      throw new AppError('Chatbot not found', 404);
    }

    if (!chatbot.isActive) {
      throw new AppError('This chatbot is currently inactive', 400);
    }

    const response = await chatService.chat({
      message,
      module: `chatbot-${botName}`,
      sessionId,
      systemPrompt: chatbot.systemPrompt,
    }, userId);

    return response;
  }

  // Seed default chatbots
  async seedDefaultChatbots() {
    const defaultBots = [
      {
        name: 'research-methods',
        displayName: 'Research Methods Helper',
        description: 'Expert in research methodology, study design, and academic research practices',
        systemPrompt: `You are a Research Methods expert assistant. Help users with:
- Research design and methodology
- Quantitative and qualitative research approaches
- Data collection methods
- Sampling techniques
- Research ethics
- Literature review strategies
Provide academic, evidence-based guidance.`,
        category: 'academic',
        isSystem: true,
      },
      {
        name: 'academic-writing',
        displayName: 'Academic Writing Tutor',
        description: 'Helps improve academic writing, citations, and scholarly communication',
        systemPrompt: `You are an Academic Writing tutor. Help users with:
- Academic writing structure and style
- Citation and referencing (APA, MLA, Chicago, etc.)
- Thesis and argument development
- Academic tone and language
- Avoiding plagiarism
- Editing and proofreading strategies
Provide constructive feedback and examples.`,
        category: 'academic',
        isSystem: true,
      },
      {
        name: 'platform-guide',
        displayName: 'LAILA Platform Guide',
        description: 'Guides users through the LAILA LMS platform features and tools',
        systemPrompt: `You are the LAILA Platform Guide. Help users navigate and use:
- Course enrollment and progress tracking
- Assignment submissions
- AI research tools (Bias Research, Prompt Helper, Data Analyzer)
- Account settings and preferences
- Learning features and resources
Be friendly and provide step-by-step guidance.`,
        category: 'support',
        isSystem: true,
      },
    ];

    for (const bot of defaultBots) {
      await prisma.chatbot.upsert({
        where: { name: bot.name },
        create: bot,
        update: {
          displayName: bot.displayName,
          description: bot.description,
          systemPrompt: bot.systemPrompt,
          category: bot.category,
        },
      });
    }

    return { message: 'Default chatbots seeded successfully' };
  }
}

export const chatbotService = new ChatbotService();
