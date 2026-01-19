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
