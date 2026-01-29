import apiClient from './client';
import {
  ApiResponse,
  StudentAgentConfig,
  AgentConfigFormData,
  AgentTestConversation,
  AgentTestResponse,
  AgentMessageResponse,
  AgentConfigurationLog,
  MyAgentConfigResponse,
  AgentSubmissionWithConfig,
  AssignmentSubmission,
} from '../types';

export const agentAssignmentsApi = {
  // =============================================================================
  // STUDENT ENDPOINTS
  // =============================================================================

  // Get my agent config for an assignment
  getMyAgentConfig: async (assignmentId: number): Promise<MyAgentConfigResponse> => {
    const response = await apiClient.get<ApiResponse<MyAgentConfigResponse>>(
      `/agent-assignments/${assignmentId}/my-config`
    );
    return response.data.data!;
  },

  // Create agent config
  createAgentConfig: async (
    assignmentId: number,
    data: AgentConfigFormData
  ): Promise<StudentAgentConfig> => {
    const response = await apiClient.post<ApiResponse<StudentAgentConfig>>(
      `/agent-assignments/${assignmentId}/config`,
      data
    );
    return response.data.data!;
  },

  // Update agent config
  updateAgentConfig: async (
    assignmentId: number,
    data: Partial<AgentConfigFormData>
  ): Promise<StudentAgentConfig> => {
    const response = await apiClient.put<ApiResponse<StudentAgentConfig>>(
      `/agent-assignments/${assignmentId}/config`,
      data
    );
    return response.data.data!;
  },

  // Submit agent for grading
  submitAgentConfig: async (
    assignmentId: number
  ): Promise<{ config: StudentAgentConfig; submission: AssignmentSubmission }> => {
    const response = await apiClient.post<
      ApiResponse<{ config: StudentAgentConfig; submission: AssignmentSubmission }>
    >(`/agent-assignments/${assignmentId}/submit`);
    return response.data.data!;
  },

  // Unsubmit agent (return to draft)
  unsubmitAgentConfig: async (assignmentId: number): Promise<StudentAgentConfig> => {
    const response = await apiClient.post<ApiResponse<StudentAgentConfig>>(
      `/agent-assignments/${assignmentId}/unsubmit`
    );
    return response.data.data!;
  },

  // Start test conversation
  startTestConversation: async (
    assignmentId: number,
    agentConfigId?: number
  ): Promise<AgentTestResponse> => {
    const response = await apiClient.post<ApiResponse<AgentTestResponse>>(
      `/agent-assignments/${assignmentId}/test/start`,
      { agentConfigId }
    );
    return response.data.data!;
  },

  // Send test message
  sendTestMessage: async (
    assignmentId: number,
    conversationId: number,
    message: string
  ): Promise<AgentMessageResponse> => {
    const response = await apiClient.post<ApiResponse<AgentMessageResponse>>(
      `/agent-assignments/${assignmentId}/test/${conversationId}/message`,
      { message }
    );
    return response.data.data!;
  },

  // Generic send message (for use after conversation started)
  sendMessage: async (
    conversationId: number,
    message: string
  ): Promise<AgentMessageResponse> => {
    const response = await apiClient.post<ApiResponse<AgentMessageResponse>>(
      `/agent-assignments/test/${conversationId}/message`,
      { message }
    );
    return response.data.data!;
  },

  // Get test conversation history
  getTestConversation: async (
    assignmentId: number,
    conversationId: number
  ): Promise<AgentTestConversation> => {
    const response = await apiClient.get<ApiResponse<AgentTestConversation>>(
      `/agent-assignments/${assignmentId}/test/${conversationId}`
    );
    return response.data.data!;
  },

  // Get all my test conversations for an assignment
  getMyTestConversations: async (assignmentId: number): Promise<AgentTestConversation[]> => {
    const response = await apiClient.get<ApiResponse<AgentTestConversation[]>>(
      `/agent-assignments/${assignmentId}/test/history`
    );
    return response.data.data!;
  },

  // =============================================================================
  // INSTRUCTOR ENDPOINTS
  // =============================================================================

  // Get all submissions for an assignment
  getAgentSubmissions: async (assignmentId: number): Promise<StudentAgentConfig[]> => {
    const response = await apiClient.get<ApiResponse<StudentAgentConfig[]>>(
      `/agent-assignments/${assignmentId}/submissions`
    );
    return response.data.data!;
  },

  // Get single submission detail
  getAgentSubmissionDetail: async (
    assignmentId: number,
    submissionId: number
  ): Promise<AgentSubmissionWithConfig> => {
    const response = await apiClient.get<ApiResponse<AgentSubmissionWithConfig>>(
      `/agent-assignments/${assignmentId}/submissions/${submissionId}`
    );
    return response.data.data!;
  },

  // Get config change history for a submission
  getConfigHistory: async (
    assignmentId: number,
    submissionId: number
  ): Promise<AgentConfigurationLog[]> => {
    const response = await apiClient.get<ApiResponse<AgentConfigurationLog[]>>(
      `/agent-assignments/${assignmentId}/submissions/${submissionId}/config-history`
    );
    return response.data.data!;
  },

  // Get all test conversations for a submission
  getSubmissionTestConversations: async (
    assignmentId: number,
    submissionId: number
  ): Promise<AgentTestConversation[]> => {
    const response = await apiClient.get<ApiResponse<AgentTestConversation[]>>(
      `/agent-assignments/${assignmentId}/submissions/${submissionId}/test-conversations`
    );
    return response.data.data!;
  },

  // Instructor test student's agent
  startInstructorTest: async (
    assignmentId: number,
    submissionId: number
  ): Promise<AgentTestResponse> => {
    const response = await apiClient.post<ApiResponse<AgentTestResponse>>(
      `/agent-assignments/${assignmentId}/submissions/${submissionId}/test`
    );
    return response.data.data!;
  },

  // Grade submission
  gradeAgentSubmission: async (
    submissionId: number,
    data: { grade: number; feedback?: string }
  ): Promise<AssignmentSubmission> => {
    const response = await apiClient.post<ApiResponse<AssignmentSubmission>>(
      `/agent-assignments/submissions/${submissionId}/grade`,
      data
    );
    return response.data.data!;
  },

  // =============================================================================
  // DESIGN LOG ENDPOINTS (Instructor)
  // =============================================================================

  // Get design events and analytics for a student's agent config
  getDesignEvents: async (
    agentConfigId: number
  ): Promise<{
    events: Array<Record<string, unknown>>;
    analytics: Record<string, unknown>;
  }> => {
    const response = await apiClient.get<
      ApiResponse<{
        events: Array<Record<string, unknown>>;
        analytics: Record<string, unknown>;
      }>
    >(`/agent-design-logs/config/${agentConfigId}`);
    return response.data.data!;
  },

  // Get design timeline for a student's agent config
  getDesignTimeline: async (
    agentConfigId: number,
    options?: { category?: string; limit?: number; offset?: number }
  ): Promise<{
    timeline: Array<Record<string, unknown>>;
    total: number;
  }> => {
    const params = new URLSearchParams();
    if (options?.category) params.append('category', options.category);
    if (options?.limit) params.append('limit', options.limit.toString());
    if (options?.offset) params.append('offset', options.offset.toString());

    const response = await apiClient.get<
      ApiResponse<{
        timeline: Array<Record<string, unknown>>;
        total: number;
      }>
    >(`/agent-design-logs/config/${agentConfigId}/timeline?${params.toString()}`);
    return response.data.data!;
  },

  // Get config snapshot at a specific time
  getConfigAtTime: async (
    agentConfigId: number,
    timestamp: string
  ): Promise<Record<string, unknown> | null> => {
    const response = await apiClient.get<ApiResponse<Record<string, unknown> | null>>(
      `/agent-design-logs/config/${agentConfigId}/snapshot?timestamp=${encodeURIComponent(timestamp)}`
    );
    return response.data.data!;
  },

  // Get reflection responses for a student's config
  getReflectionResponses: async (
    agentConfigId: number
  ): Promise<Array<{ promptId: string; promptText: string; response: string; timestamp: string }>> => {
    const response = await apiClient.get<
      ApiResponse<Array<{ promptId: string; promptText: string; response: string; timestamp: string }>>
    >(`/agent-design-logs/config/${agentConfigId}/reflections`);
    return response.data.data!;
  },

  // Get assignment-level design analytics
  getAssignmentDesignAnalytics: async (
    assignmentId: number
  ): Promise<{
    totalStudents: number;
    averageDesignTime: number;
    averageIterations: number;
    averageTestConversations: number;
    roleUsageStats: Record<string, number>;
    personalityUsageStats: Record<string, number>;
  }> => {
    const response = await apiClient.get<
      ApiResponse<{
        totalStudents: number;
        averageDesignTime: number;
        averageIterations: number;
        averageTestConversations: number;
        roleUsageStats: Record<string, number>;
        personalityUsageStats: Record<string, number>;
      }>
    >(`/agent-design-logs/assignment/${assignmentId}/analytics`);
    return response.data.data!;
  },
};
