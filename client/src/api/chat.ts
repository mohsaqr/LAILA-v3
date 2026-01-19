import apiClient from './client';
import { ChatResponse, Chatbot, ApiResponse } from '../types';

interface ChatRequest {
  message: string;
  module?: string;
  sessionId?: string;
  context?: string;
  model?: string;
  systemPrompt?: string;
}

export const chatApi = {
  sendMessage: async (data: ChatRequest) => {
    const response = await apiClient.post<ApiResponse<ChatResponse>>('/chat', data);
    return response.data.data!;
  },

  getChatHistory: async (sessionId: string, limit = 50) => {
    const response = await apiClient.get<ApiResponse<any[]>>(`/chat/session/${sessionId}?limit=${limit}`);
    return response.data.data!;
  },

  getUserChatHistory: async (module?: string, limit = 100) => {
    const params = new URLSearchParams();
    if (module) params.append('module', module);
    params.append('limit', limit.toString());

    const response = await apiClient.get<ApiResponse<any[]>>(`/chat/history?${params.toString()}`);
    return response.data.data!;
  },

  analyzeData: async (data: string, prompt: string) => {
    const response = await apiClient.post<ApiResponse<ChatResponse>>('/chat/analyze', { data, prompt });
    return response.data.data!;
  },

  getAIConfig: async () => {
    const response = await apiClient.get<ApiResponse<{ provider: string; model: string; available: boolean }>>(
      '/chat/config'
    );
    return response.data.data!;
  },
};

export const chatbotsApi = {
  getChatbots: async (includeInactive = false) => {
    const response = await apiClient.get<ApiResponse<Chatbot[]>>(
      `/chatbots?includeInactive=${includeInactive}`
    );
    return response.data.data!;
  },

  getChatbotByName: async (name: string) => {
    const response = await apiClient.get<ApiResponse<Chatbot>>(`/chatbots/name/${name}`);
    return response.data.data!;
  },

  getChatbotById: async (id: number) => {
    const response = await apiClient.get<ApiResponse<Chatbot>>(`/chatbots/${id}`);
    return response.data.data!;
  },

  createChatbot: async (data: Partial<Chatbot>) => {
    const response = await apiClient.post<ApiResponse<Chatbot>>('/chatbots', data);
    return response.data.data!;
  },

  updateChatbot: async (id: number, data: Partial<Chatbot>) => {
    const response = await apiClient.put<ApiResponse<Chatbot>>(`/chatbots/${id}`, data);
    return response.data.data!;
  },

  deleteChatbot: async (id: number) => {
    const response = await apiClient.delete<ApiResponse<{ message: string }>>(`/chatbots/${id}`);
    return response.data;
  },

  chatWithBot: async (botName: string, message: string, sessionId?: string) => {
    const response = await apiClient.post<ApiResponse<ChatResponse>>(`/chatbots/${botName}/chat`, {
      message,
      sessionId,
    });
    return response.data.data!;
  },
};
