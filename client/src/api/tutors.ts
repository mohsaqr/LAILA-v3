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
  CollaborativeSettings,
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
  getSession: async (courseId?: number): Promise<TutorSessionResponse> => {
    const params = courseId ? `?courseId=${courseId}` : '';
    const response = await apiClient.get(`/tutors/session${params}`);
    return response.data.data;
  },

  /**
   * Update session mode
   */
  setMode: async (mode: TutorMode, courseId?: number): Promise<TutorSession> => {
    const response = await apiClient.put('/tutors/session/mode', { mode, courseId });
    return response.data.data;
  },

  /**
   * Set active agent for manual mode
   */
  setActiveAgent: async (chatbotId: number, courseId?: number): Promise<TutorSession> => {
    const response = await apiClient.put('/tutors/session/active-agent', { chatbotId, courseId });
    return response.data.data;
  },

  // ===========================================================================
  // CONVERSATIONS
  // ===========================================================================

  /**
   * List all conversations with previews
   */
  getConversations: async (courseId?: number): Promise<TutorConversation[]> => {
    const params = courseId ? `?courseId=${courseId}` : '';
    const response = await apiClient.get(`/tutors/conversations${params}`);
    return response.data.data;
  },

  /**
   * Get specific conversation with message history
   */
  getConversation: async (chatbotId: number, courseId?: number): Promise<TutorConversationWithMessages> => {
    const params = courseId ? `?courseId=${courseId}` : '';
    const response = await apiClient.get(`/tutors/conversations/${chatbotId}${params}`);
    return response.data.data;
  },

  /**
   * Clear conversation messages
   */
  clearConversation: async (chatbotId: number, courseId?: number): Promise<void> => {
    const params = courseId ? `?courseId=${courseId}` : '';
    await apiClient.delete(`/tutors/conversations/${chatbotId}${params}`);
  },

  // ===========================================================================
  // MESSAGING
  // ===========================================================================

  /**
   * Send message to agent
   */
  sendMessage: async (
    chatbotId: number,
    message: string,
    collaborativeSettings?: CollaborativeSettings,
    courseId?: number,
    emotionalPulse?: string
  ): Promise<TutorMessageResponse> => {
    const response = await apiClient.post(`/tutors/conversations/${chatbotId}/message`, {
      message,
      collaborativeSettings,
      courseId,
      emotionalPulse,
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
