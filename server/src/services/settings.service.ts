import prisma from '../utils/prisma.js';
import { AppError } from '../middleware/error.middleware.js';

export class SettingsService {
  // System settings
  async getSystemSettings() {
    const settings = await prisma.systemSetting.findMany({
      orderBy: { settingKey: 'asc' },
    });

    // Convert to object, hiding encrypted values
    const settingsObj: Record<string, any> = {};
    settings.forEach(s => {
      settingsObj[s.settingKey] = {
        value: s.isEncrypted ? '********' : s.settingValue,
        type: s.settingType,
        description: s.description,
        isEncrypted: s.isEncrypted,
      };
    });

    return settingsObj;
  }

  async getSystemSetting(key: string) {
    const setting = await prisma.systemSetting.findUnique({
      where: { settingKey: key },
    });

    return setting;
  }

  async updateSystemSetting(key: string, value: string | null, options?: {
    type?: string;
    description?: string;
    isEncrypted?: boolean;
  }) {
    const setting = await prisma.systemSetting.upsert({
      where: { settingKey: key },
      create: {
        settingKey: key,
        settingValue: value,
        settingType: options?.type || 'string',
        description: options?.description,
        isEncrypted: options?.isEncrypted || false,
      },
      update: {
        settingValue: value,
        ...(options?.type && { settingType: options.type }),
        ...(options?.description && { description: options.description }),
        ...(typeof options?.isEncrypted === 'boolean' && { isEncrypted: options.isEncrypted }),
      },
    });

    return setting;
  }

  async deleteSystemSetting(key: string) {
    await prisma.systemSetting.delete({
      where: { settingKey: key },
    });

    return { message: 'Setting deleted successfully' };
  }

  // API configurations
  async getApiConfigurations() {
    const configs = await prisma.apiConfiguration.findMany({
      orderBy: { serviceName: 'asc' },
    });

    // Hide API keys
    return configs.map(c => ({
      ...c,
      apiKey: c.apiKey ? '********' : null,
    }));
  }

  async getApiConfiguration(serviceName: string) {
    const config = await prisma.apiConfiguration.findUnique({
      where: { serviceName },
    });

    if (!config) {
      throw new AppError('API configuration not found', 404);
    }

    return config;
  }

  async updateApiConfiguration(serviceName: string, data: {
    apiKey?: string;
    defaultModel?: string;
    isActive?: boolean;
    rateLimit?: number;
    configurationData?: string;
  }) {
    const config = await prisma.apiConfiguration.upsert({
      where: { serviceName },
      create: {
        serviceName,
        ...data,
      },
      update: data,
    });

    return {
      ...config,
      apiKey: config.apiKey ? '********' : null,
    };
  }

  async testApiConfiguration(serviceName: string) {
    const config = await prisma.apiConfiguration.findUnique({
      where: { serviceName },
    });

    if (!config || !config.apiKey) {
      throw new AppError('API configuration not found or no API key set', 400);
    }

    // Test the API connection
    try {
      if (serviceName === 'openai') {
        const { default: OpenAI } = await import('openai');
        const client = new OpenAI({ apiKey: config.apiKey });
        await client.models.list();
        return { success: true, message: 'OpenAI connection successful' };
      } else if (serviceName === 'gemini') {
        const { GoogleGenerativeAI } = await import('@google/generative-ai');
        const client = new GoogleGenerativeAI(config.apiKey);
        const model = client.getGenerativeModel({ model: 'gemini-pro' });
        await model.generateContent('Hello');
        return { success: true, message: 'Gemini connection successful' };
      } else {
        return { success: false, message: 'Unknown service' };
      }
    } catch (error: any) {
      return { success: false, message: error.message };
    }
  }

  // Seed default settings
  async seedDefaultSettings() {
    const defaultSettings = [
      {
        settingKey: 'site_name',
        settingValue: 'LAILA LMS',
        settingType: 'string',
        description: 'The name of the platform',
      },
      {
        settingKey: 'default_ai_provider',
        settingValue: 'openai',
        settingType: 'string',
        description: 'Default AI provider (openai or gemini)',
      },
      {
        settingKey: 'allow_registration',
        settingValue: 'true',
        settingType: 'boolean',
        description: 'Allow new user registrations',
      },
      {
        settingKey: 'require_email_confirmation',
        settingValue: 'false',
        settingType: 'boolean',
        description: 'Require email confirmation for new accounts',
      },
      {
        settingKey: 'max_file_upload_size',
        settingValue: '10',
        settingType: 'number',
        description: 'Maximum file upload size in MB',
      },
      // MCQ Generation Settings
      {
        settingKey: 'mcq_generation_system_prompt',
        settingValue: `You are an expert educational assessment designer. Generate high-quality multiple choice questions (MCQs).

GUIDELINES:
1. Test comprehension and application, not just recall
2. All distractors should be plausible but clearly wrong
3. Avoid "all/none of the above" options
4. Keep questions clear and unambiguous
5. Ensure only one option is definitively correct
6. Match the difficulty level requested
7. For 'easy' questions: test basic understanding and recall
8. For 'medium' questions: test application and comprehension
9. For 'hard' questions: test analysis, synthesis, and evaluation`,
        settingType: 'text',
        description: 'System prompt for MCQ generation AI',
      },
      {
        settingKey: 'mcq_generation_format_instructions',
        settingValue: `OUTPUT FORMAT (JSON):
{
  "questions": [{
    "questionText": "Question text?",
    "options": ["Option A", "Option B", "Option C", "Option D"],
    "correctAnswer": "Option A",
    "explanation": "Brief explanation of why this is correct",
    "difficulty": "medium"
  }]
}

IMPORTANT RULES:
- correctAnswer must EXACTLY match one of the options strings
- Each question must have the specified number of options
- All options must be unique and plausible
- Return ONLY valid JSON, no markdown formatting`,
        settingType: 'text',
        description: 'Format instructions for MCQ generation AI output',
      },
      {
        settingKey: 'mcq_generation_defaults',
        settingValue: JSON.stringify({
          optionCount: 4,
          maxQuestions: 10,
          defaultDifficulty: 'medium',
          includeExplanations: true,
          temperature: 0.4,
        }),
        settingType: 'json',
        description: 'Default settings for MCQ generation',
      },
    ];

    const defaultApiConfigs = [
      {
        serviceName: 'openai',
        defaultModel: 'gpt-4o-mini',
        isActive: true,
      },
      {
        serviceName: 'gemini',
        defaultModel: 'gemini-pro',
        isActive: false,
      },
    ];

    for (const setting of defaultSettings) {
      await prisma.systemSetting.upsert({
        where: { settingKey: setting.settingKey },
        create: setting,
        update: {},
      });
    }

    for (const config of defaultApiConfigs) {
      await prisma.apiConfiguration.upsert({
        where: { serviceName: config.serviceName },
        create: config,
        update: {},
      });
    }

    return { message: 'Default settings seeded successfully' };
  }
}

export const settingsService = new SettingsService();
