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
};
