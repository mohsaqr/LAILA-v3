import prisma from '../utils/prisma.js';
import { AppError } from '../middleware/error.middleware.js';
import { CreateChatbotInput, UpdateChatbotInput } from '../utils/validation.js';
import { chatService } from './chat.service.js';

export class ChatbotService {
  async getChatbots(includeInactive = false) {
    const where: any = {};
    if (!includeInactive) {
      where.isActive = true;
    }

    const chatbots = await prisma.chatbot.findMany({
      where,
      orderBy: [
        { isSystem: 'desc' },
        { name: 'asc' },
      ],
    });

    return chatbots;
  }

  async getChatbotByName(name: string) {
    const chatbot = await prisma.chatbot.findUnique({
      where: { name },
    });

    if (!chatbot) {
      throw new AppError('Chatbot not found', 404);
    }

    return chatbot;
  }

  async getChatbotById(id: number) {
    const chatbot = await prisma.chatbot.findUnique({
      where: { id },
    });

    if (!chatbot) {
      throw new AppError('Chatbot not found', 404);
    }

    return chatbot;
  }

  async createChatbot(data: CreateChatbotInput) {
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
      },
    });

    return chatbot;
  }

  async updateChatbot(id: number, data: UpdateChatbotInput) {
    const chatbot = await prisma.chatbot.findUnique({
      where: { id },
    });

    if (!chatbot) {
      throw new AppError('Chatbot not found', 404);
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

    return updated;
  }

  async deleteChatbot(id: number) {
    const chatbot = await prisma.chatbot.findUnique({
      where: { id },
    });

    if (!chatbot) {
      throw new AppError('Chatbot not found', 404);
    }

    if (chatbot.isSystem) {
      throw new AppError('Cannot delete system chatbot', 400);
    }

    await prisma.chatbot.delete({
      where: { id },
    });

    return { message: 'Chatbot deleted successfully' };
  }

  async chatWithBot(botName: string, message: string, sessionId?: string, userId?: number) {
    const chatbot = await this.getChatbotByName(botName);

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
