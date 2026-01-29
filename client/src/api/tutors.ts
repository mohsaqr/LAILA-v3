import { apiClient } from './client';
import type {
  TutorMode,
  TutorSession,
  TutorSessionResponse,
  TutorConversation,
  TutorConversationWithMessages,
  TutorMessageResponse,
  TutorAgent,
  TutorStats,
  TutorInteractionLog,
} from '../types/tutor';

// =============================================================================
// AI TUTORS API CLIENT
// =============================================================================

export const tutorsApi = {
  // ===========================================================================
  // SESSION
  // ===========================================================================

  /**
   * Get or create session + conversations for current user
   */
  getSession: async (): Promise<TutorSessionResponse> => {
    const response = await apiClient.get('/tutors/session');
    return response.data.data;
  },

  /**
   * Update session mode
   */
  setMode: async (mode: TutorMode): Promise<TutorSession> => {
    const response = await apiClient.put('/tutors/session/mode', { mode });
    return response.data.data;
  },

  /**
   * Set active agent for manual mode
   */
  setActiveAgent: async (chatbotId: number): Promise<TutorSession> => {
    const response = await apiClient.put('/tutors/session/active-agent', { chatbotId });
    return response.data.data;
  },

  // ===========================================================================
  // CONVERSATIONS
  // ===========================================================================

  /**
   * List all conversations with previews
   */
  getConversations: async (): Promise<TutorConversation[]> => {
    const response = await apiClient.get('/tutors/conversations');
    return response.data.data;
  },

  /**
   * Get specific conversation with message history
   */
  getConversation: async (chatbotId: number): Promise<TutorConversationWithMessages> => {
    const response = await apiClient.get(`/tutors/conversations/${chatbotId}`);
    return response.data.data;
  },

  /**
   * Clear conversation messages
   */
  clearConversation: async (chatbotId: number): Promise<void> => {
    await apiClient.delete(`/tutors/conversations/${chatbotId}`);
  },

  // ===========================================================================
  // MESSAGING
  // ===========================================================================

  /**
   * Send message to agent
   */
  sendMessage: async (
    chatbotId: number,
    message: string
  ): Promise<TutorMessageResponse> => {
    const response = await apiClient.post(`/tutors/conversations/${chatbotId}/message`, {
      message,
    });
    return response.data.data;
  },

  // ===========================================================================
  // AGENTS
  // ===========================================================================

  /**
   * List available tutor agents
   */
  getAgents: async (): Promise<TutorAgent[]> => {
    const response = await apiClient.get('/tutors/agents');
    return response.data.data;
  },

  // ===========================================================================
  // ADMIN/ANALYTICS
  // ===========================================================================

  /**
   * Get interaction logs (admin)
   */
  getLogs: async (filters?: {
    userId?: number;
    sessionId?: number;
    eventType?: string;
    startDate?: string;
    endDate?: string;
    limit?: number;
  }): Promise<TutorInteractionLog[]> => {
    const params = new URLSearchParams();
    if (filters?.userId) params.append('userId', filters.userId.toString());
    if (filters?.sessionId) params.append('sessionId', filters.sessionId.toString());
    if (filters?.eventType) params.append('eventType', filters.eventType);
    if (filters?.startDate) params.append('startDate', filters.startDate);
    if (filters?.endDate) params.append('endDate', filters.endDate);
    if (filters?.limit) params.append('limit', filters.limit.toString());

    const response = await apiClient.get(`/tutors/logs?${params.toString()}`);
    return response.data.data;
  },

  /**
   * Get aggregate stats (admin)
   */
  getStats: async (startDate?: string, endDate?: string): Promise<TutorStats> => {
    const params = new URLSearchParams();
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);

    const response = await apiClient.get(`/tutors/logs/stats?${params.toString()}`);
    return response.data.data;
  },
};

export default tutorsApi;
