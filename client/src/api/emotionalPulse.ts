import apiClient from './client';
import {
  EmotionalPulse,
  LogEmotionalPulseInput,
  EmotionalPulseHistory,
  EmotionalPulseStats,
  EmotionalPulseTimeline,
  ApiResponse,
} from '../types';

export const emotionalPulseApi = {
  // =============================================================================
  // LOG PULSE (Student)
  // =============================================================================

  logPulse: async (data: LogEmotionalPulseInput) => {
    const response = await apiClient.post<ApiResponse<EmotionalPulse>>(
      '/emotional-pulse',
      data
    );
    return response.data.data!;
  },

  // =============================================================================
  // USER HISTORY
  // =============================================================================

  getMyHistory: async (options?: {
    context?: string;
    contextId?: number;
    agentId?: number;
    limit?: number;
    offset?: number;
  }) => {
    const params = new URLSearchParams();
    if (options?.context) params.append('context', options.context);
    if (options?.contextId) params.append('contextId', options.contextId.toString());
    if (options?.agentId) params.append('agentId', options.agentId.toString());
    if (options?.limit) params.append('limit', options.limit.toString());
    if (options?.offset) params.append('offset', options.offset.toString());

    const queryString = params.toString();
    const url = `/emotional-pulse/my-history${queryString ? `?${queryString}` : ''}`;

    const response = await apiClient.get<ApiResponse<EmotionalPulseHistory>>(url);
    return response.data.data!;
  },

  // =============================================================================
  // STATS (Instructor/Admin)
  // =============================================================================

  getStats: async (options?: {
    context?: string;
    contextId?: number;
    agentId?: number;
    startDate?: string;
    endDate?: string;
  }) => {
    const params = new URLSearchParams();
    if (options?.context) params.append('context', options.context);
    if (options?.contextId) params.append('contextId', options.contextId.toString());
    if (options?.agentId) params.append('agentId', options.agentId.toString());
    if (options?.startDate) params.append('startDate', options.startDate);
    if (options?.endDate) params.append('endDate', options.endDate);

    const queryString = params.toString();
    const url = `/emotional-pulse/stats${queryString ? `?${queryString}` : ''}`;

    const response = await apiClient.get<ApiResponse<EmotionalPulseStats>>(url);
    return response.data.data!;
  },

  getTimeline: async (options?: {
    context?: string;
    contextId?: number;
    agentId?: number;
    days?: number;
  }) => {
    const params = new URLSearchParams();
    if (options?.context) params.append('context', options.context);
    if (options?.contextId) params.append('contextId', options.contextId.toString());
    if (options?.agentId) params.append('agentId', options.agentId.toString());
    if (options?.days) params.append('days', options.days.toString());

    const queryString = params.toString();
    const url = `/emotional-pulse/timeline${queryString ? `?${queryString}` : ''}`;

    const response = await apiClient.get<ApiResponse<EmotionalPulseTimeline[]>>(url);
    return response.data.data!;
  },
};
