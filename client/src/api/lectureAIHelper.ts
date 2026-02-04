import apiClient from './client';
import { ApiResponse, ChatResponse } from '../types';

export type LectureAIHelperMode = 'explain' | 'discuss';

interface LectureAIHelperChatRequest {
  mode: LectureAIHelperMode;
  message: string;
  sessionId?: string;
}

interface LectureAIHelperChatResponse extends ChatResponse {
  sessionId: string;
}

export interface LectureAISession {
  sessionId: string;
  mode: LectureAIHelperMode;
  firstMessage: string;
  lastActivity: string;
  messageCount: number;
}

export interface LectureAIMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  model?: string;
}

// Explain mode types (thread-based Q&A)
export interface ExplainPost {
  id: number;
  parentId: number | null;
  authorType: 'user' | 'ai';
  content: string;
  aiModel?: string | null;
  createdAt: string;
  replies?: ExplainPost[];
}

export interface ExplainThread {
  id: number;
  question: string;
  createdAt: string;
  posts: ExplainPost[];
}

export const lectureAIHelperApi = {
  // ==========================================
  // DISCUSS MODE (Chat-based) - Existing
  // ==========================================

  chat: async (
    lectureId: number,
    data: LectureAIHelperChatRequest
  ): Promise<LectureAIHelperChatResponse> => {
    const response = await apiClient.post<ApiResponse<LectureAIHelperChatResponse>>(
      `/courses/lectures/${lectureId}/ai-helper/chat`,
      data
    );
    return response.data.data!;
  },

  getSessions: async (lectureId: number): Promise<LectureAISession[]> => {
    const response = await apiClient.get<ApiResponse<LectureAISession[]>>(
      `/courses/lectures/${lectureId}/ai-helper/sessions`
    );
    return response.data.data || [];
  },

  getHistory: async (lectureId: number, sessionId: string): Promise<LectureAIMessage[]> => {
    const response = await apiClient.get<ApiResponse<LectureAIMessage[]>>(
      `/courses/lectures/${lectureId}/ai-helper/history/${sessionId}`
    );
    return response.data.data || [];
  },

  // ==========================================
  // EXPLAIN MODE (Thread-based Q&A) - New
  // ==========================================

  createExplainThread: async (
    lectureId: number,
    question: string
  ): Promise<ExplainThread> => {
    const response = await apiClient.post<ApiResponse<ExplainThread>>(
      `/courses/lectures/${lectureId}/ai-helper/explain/threads`,
      { question }
    );
    return response.data.data!;
  },

  getExplainThreads: async (lectureId: number): Promise<ExplainThread[]> => {
    const response = await apiClient.get<ApiResponse<ExplainThread[]>>(
      `/courses/lectures/${lectureId}/ai-helper/explain/threads`
    );
    return response.data.data || [];
  },

  getExplainThread: async (
    lectureId: number,
    threadId: number
  ): Promise<ExplainThread> => {
    const response = await apiClient.get<ApiResponse<ExplainThread>>(
      `/courses/lectures/${lectureId}/ai-helper/explain/threads/${threadId}`
    );
    return response.data.data!;
  },

  addFollowUp: async (
    lectureId: number,
    threadId: number,
    question: string,
    parentPostId?: number
  ): Promise<ExplainThread> => {
    const response = await apiClient.post<ApiResponse<ExplainThread>>(
      `/courses/lectures/${lectureId}/ai-helper/explain/threads/${threadId}/follow-up`,
      { question, parentPostId }
    );
    return response.data.data!;
  },
};
