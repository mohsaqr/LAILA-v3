import apiClient from './client';
import { AdminStats, ApiResponse, PaginatedResponse } from '../types';

// Helper to get token from Zustand's persisted store
const getAuthToken = (): string | null => {
  try {
    const stored = localStorage.getItem('laila-auth');
    if (stored) {
      const parsed = JSON.parse(stored);
      return parsed?.state?.token || null;
    }
  } catch {
    // Fall back to direct token if parsing fails
  }
  return getAuthToken();
};

export const adminApi = {
  getStats: async () => {
    const response = await apiClient.get<ApiResponse<{
      stats: AdminStats;
      recentUsers: any[];
      recentEnrollments: any[];
    }>>('/admin/stats');
    return response.data.data!;
  },

  getCourses: async (page = 1, limit = 20, status?: string) => {
    const params = new URLSearchParams();
    params.append('page', page.toString());
    params.append('limit', limit.toString());
    if (status) params.append('status', status);

    const response = await apiClient.get<PaginatedResponse<any>>(`/admin/courses?${params.toString()}`);
    return {
      courses: response.data.data || [],
      pagination: response.data.pagination,
    };
  },

  getEnrollments: async (page = 1, limit = 20, courseId?: number) => {
    const params = new URLSearchParams();
    params.append('page', page.toString());
    params.append('limit', limit.toString());
    if (courseId) params.append('courseId', courseId.toString());

    const response = await apiClient.get<PaginatedResponse<any>>(`/admin/enrollments?${params.toString()}`);
    return {
      enrollments: response.data.data || [],
      pagination: response.data.pagination,
    };
  },

  getChatLogs: async (page = 1, limit = 50, module?: string, userId?: number) => {
    const params = new URLSearchParams();
    params.append('page', page.toString());
    params.append('limit', limit.toString());
    if (module) params.append('module', module);
    if (userId) params.append('userId', userId.toString());

    const response = await apiClient.get<PaginatedResponse<any>>(`/admin/chat-logs?${params.toString()}`);
    return {
      logs: response.data.data || [],
      pagination: response.data.pagination,
    };
  },

  getInteractions: async (page = 1, limit = 50, userId?: number) => {
    const params = new URLSearchParams();
    params.append('page', page.toString());
    params.append('limit', limit.toString());
    if (userId) params.append('userId', userId.toString());

    const response = await apiClient.get<PaginatedResponse<any>>(`/admin/interactions?${params.toString()}`);
    return {
      interactions: response.data.data || [],
      pagination: response.data.pagination,
    };
  },

  getAnalysisLogs: async (page = 1, limit = 50) => {
    const params = new URLSearchParams();
    params.append('page', page.toString());
    params.append('limit', limit.toString());

    const response = await apiClient.get<PaginatedResponse<any>>(`/admin/analysis-logs?${params.toString()}`);
    return {
      logs: response.data.data || [],
      pagination: response.data.pagination,
    };
  },

  exportData: async (type: 'users' | 'courses' | 'enrollments' | 'chat-logs') => {
    const response = await apiClient.get<ApiResponse<any[]>>(`/admin/export/${type}`);
    return response.data.data!;
  },
};

// Analytics API
export const analyticsApi = {
  getInteractionSummary: async (filters?: {
    startDate?: string;
    endDate?: string;
    userId?: number;
    page?: string;
    interactionType?: string;
  }) => {
    const params = new URLSearchParams();
    if (filters?.startDate) params.append('startDate', filters.startDate);
    if (filters?.endDate) params.append('endDate', filters.endDate);
    if (filters?.userId) params.append('userId', filters.userId.toString());
    if (filters?.page) params.append('page', filters.page);
    if (filters?.interactionType) params.append('interactionType', filters.interactionType);

    const response = await apiClient.get<ApiResponse<any>>(`/analytics/interactions/summary?${params.toString()}`);
    return response.data.data!;
  },

  getChatbotSummary: async (filters?: {
    startDate?: string;
    endDate?: string;
    userId?: number;
    sectionId?: number;
    courseId?: number;
  }) => {
    const params = new URLSearchParams();
    if (filters?.startDate) params.append('startDate', filters.startDate);
    if (filters?.endDate) params.append('endDate', filters.endDate);
    if (filters?.userId) params.append('userId', filters.userId.toString());
    if (filters?.sectionId) params.append('sectionId', filters.sectionId.toString());
    if (filters?.courseId) params.append('courseId', filters.courseId.toString());

    const response = await apiClient.get<ApiResponse<any>>(`/analytics/chatbot/summary?${params.toString()}`);
    return response.data.data!;
  },

  getChatbotSectionLogs: async (sectionId: number, page = 1, limit = 50) => {
    const response = await apiClient.get<ApiResponse<any>>(
      `/analytics/chatbot/section/${sectionId}?page=${page}&limit=${limit}`
    );
    return response.data.data!;
  },

  exportInteractions: async () => {
    const response = await apiClient.get<any>('/analytics/export/interactions');
    return response.data;
  },

  exportChatbotLogs: async () => {
    const response = await apiClient.get<any>('/analytics/export/chatbot');
    return response.data;
  },
};

// Analytics Export API (Research-Grade Logging)
export const analyticsExportApi = {
  // Helper to build query string from filters
  _buildQueryString: (filters: { startDate?: string; endDate?: string; courseId?: number; userId?: number }) => {
    const params = new URLSearchParams();
    if (filters.startDate) params.append('startDate', filters.startDate);
    if (filters.endDate) params.append('endDate', filters.endDate);
    if (filters.courseId) params.append('courseId', filters.courseId.toString());
    if (filters.userId) params.append('userId', filters.userId.toString());
    return params.toString();
  },

  // Helper to download file from response
  _downloadFile: async (response: Response, filename: string) => {
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  },

  // CSV Exports
  exportChatbotLogsCSV: async (filters: { startDate?: string; endDate?: string; courseId?: number; userId?: number } = {}) => {
    const queryString = analyticsExportApi._buildQueryString(filters);
    const response = await fetch(`/api/analytics/export/csv/chatbot-logs${queryString ? `?${queryString}` : ''}`, {
      headers: { Authorization: `Bearer ${getAuthToken()}` },
    });
    if (!response.ok) throw new Error('Export failed');
    const filename = `chatbot_logs_${new Date().toISOString().slice(0, 10)}.csv`;
    await analyticsExportApi._downloadFile(response, filename);
  },

  exportUserInteractionsCSV: async (filters: { startDate?: string; endDate?: string; courseId?: number; userId?: number } = {}) => {
    const queryString = analyticsExportApi._buildQueryString(filters);
    const response = await fetch(`/api/analytics/export/csv/user-interactions${queryString ? `?${queryString}` : ''}`, {
      headers: { Authorization: `Bearer ${getAuthToken()}` },
    });
    if (!response.ok) throw new Error('Export failed');
    const filename = `user_interactions_${new Date().toISOString().slice(0, 10)}.csv`;
    await analyticsExportApi._downloadFile(response, filename);
  },

  exportAuthLogsCSV: async (filters: { startDate?: string; endDate?: string; courseId?: number; userId?: number } = {}) => {
    const queryString = analyticsExportApi._buildQueryString(filters);
    const response = await fetch(`/api/analytics/export/csv/auth-logs${queryString ? `?${queryString}` : ''}`, {
      headers: { Authorization: `Bearer ${getAuthToken()}` },
    });
    if (!response.ok) throw new Error('Export failed');
    const filename = `auth_logs_${new Date().toISOString().slice(0, 10)}.csv`;
    await analyticsExportApi._downloadFile(response, filename);
  },

  exportSystemEventsCSV: async (filters: { startDate?: string; endDate?: string; courseId?: number; userId?: number } = {}) => {
    const queryString = analyticsExportApi._buildQueryString(filters);
    const response = await fetch(`/api/analytics/export/csv/system-events${queryString ? `?${queryString}` : ''}`, {
      headers: { Authorization: `Bearer ${getAuthToken()}` },
    });
    if (!response.ok) throw new Error('Export failed');
    const filename = `system_events_${new Date().toISOString().slice(0, 10)}.csv`;
    await analyticsExportApi._downloadFile(response, filename);
  },

  exportAssessmentLogsCSV: async (filters: { startDate?: string; endDate?: string; courseId?: number; userId?: number } = {}) => {
    const queryString = analyticsExportApi._buildQueryString(filters);
    const response = await fetch(`/api/analytics/export/csv/assessment-logs${queryString ? `?${queryString}` : ''}`, {
      headers: { Authorization: `Bearer ${getAuthToken()}` },
    });
    if (!response.ok) throw new Error('Export failed');
    const filename = `assessment_logs_${new Date().toISOString().slice(0, 10)}.csv`;
    await analyticsExportApi._downloadFile(response, filename);
  },

  exportContentEventsCSV: async (filters: { startDate?: string; endDate?: string; courseId?: number; userId?: number } = {}) => {
    const queryString = analyticsExportApi._buildQueryString(filters);
    const response = await fetch(`/api/analytics/export/csv/content-events${queryString ? `?${queryString}` : ''}`, {
      headers: { Authorization: `Bearer ${getAuthToken()}` },
    });
    if (!response.ok) throw new Error('Export failed');
    const filename = `content_events_${new Date().toISOString().slice(0, 10)}.csv`;
    await analyticsExportApi._downloadFile(response, filename);
  },

  // Excel Export
  exportAllExcel: async (filters: { startDate?: string; endDate?: string; courseId?: number; userId?: number } = {}) => {
    const queryString = analyticsExportApi._buildQueryString(filters);
    const response = await fetch(`/api/analytics/export/excel/all${queryString ? `?${queryString}` : ''}`, {
      headers: { Authorization: `Bearer ${getAuthToken()}` },
    });
    if (!response.ok) throw new Error('Export failed');
    const filename = `analytics_export_${new Date().toISOString().slice(0, 10)}.xlsx`;
    await analyticsExportApi._downloadFile(response, filename);
  },

  // ZIP Export
  exportAllZip: async (filters: { startDate?: string; endDate?: string; courseId?: number; userId?: number } = {}) => {
    const queryString = analyticsExportApi._buildQueryString(filters);
    const response = await fetch(`/api/analytics/export/zip/all${queryString ? `?${queryString}` : ''}`, {
      headers: { Authorization: `Bearer ${getAuthToken()}` },
    });
    if (!response.ok) throw new Error('Export failed');
    const filename = `analytics_export_${new Date().toISOString().slice(0, 10)}.zip`;
    await analyticsExportApi._downloadFile(response, filename);
  },

  // JSON Settings Export
  exportCourseSettingsJSON: async (courseId?: number) => {
    const queryString = courseId ? `?courseId=${courseId}` : '';
    const response = await fetch(`/api/analytics/export/json/course-settings${queryString}`, {
      headers: { Authorization: `Bearer ${getAuthToken()}` },
    });
    if (!response.ok) throw new Error('Export failed');
    const filename = `course_settings_${new Date().toISOString().slice(0, 10)}.json`;
    await analyticsExportApi._downloadFile(response, filename);
  },

  // Summary endpoints
  getContentEventsSummary: async (filters?: Record<string, unknown>) => {
    const params = new URLSearchParams();
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined) params.append(key, String(value));
      });
    }
    const response = await apiClient.get(`/analytics/export/summary/content-events?${params.toString()}`);
    return response.data.data;
  },

  getAssessmentEventsSummary: async (filters?: Record<string, unknown>) => {
    const params = new URLSearchParams();
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined) params.append(key, String(value));
      });
    }
    const response = await apiClient.get(`/analytics/export/summary/assessment-events?${params.toString()}`);
    return response.data.data;
  },

  getSystemEventsSummary: async (filters?: Record<string, unknown>) => {
    const params = new URLSearchParams();
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined) params.append(key, String(value));
      });
    }
    const response = await apiClient.get(`/analytics/export/summary/system-events?${params.toString()}`);
    return response.data.data;
  },

  getAuthEventsSummary: async (filters?: Record<string, unknown>) => {
    const params = new URLSearchParams();
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined) params.append(key, String(value));
      });
    }
    const response = await apiClient.get(`/analytics/export/summary/auth-events?${params.toString()}`);
    return response.data.data;
  },
};

// Unified Activity Log API
export const activityLogApi = {
  getLogs: async (filters: {
    userId?: number;
    courseId?: number;
    verb?: string;
    objectType?: string;
    startDate?: string;
    endDate?: string;
    page?: number;
    limit?: number;
  } = {}) => {
    const params = new URLSearchParams();
    if (filters.userId) params.append('userId', filters.userId.toString());
    if (filters.courseId) params.append('courseId', filters.courseId.toString());
    if (filters.verb) params.append('verb', filters.verb);
    if (filters.objectType) params.append('objectType', filters.objectType);
    if (filters.startDate) params.append('startDate', filters.startDate);
    if (filters.endDate) params.append('endDate', filters.endDate);
    if (filters.page) params.append('page', filters.page.toString());
    if (filters.limit) params.append('limit', filters.limit.toString());

    const response = await apiClient.get<any>(`/activity-log?${params.toString()}`);
    return response.data;
  },

  getStats: async (filters?: { courseId?: number; startDate?: string; endDate?: string }) => {
    const params = new URLSearchParams();
    if (filters?.courseId) params.append('courseId', filters.courseId.toString());
    if (filters?.startDate) params.append('startDate', filters.startDate);
    if (filters?.endDate) params.append('endDate', filters.endDate);

    const response = await apiClient.get<any>(`/activity-log/stats?${params.toString()}`);
    return response.data.data;
  },

  exportCSV: async (filters: {
    userId?: number;
    courseId?: number;
    verb?: string;
    objectType?: string;
    startDate?: string;
    endDate?: string;
  } = {}) => {
    const params = new URLSearchParams();
    if (filters.userId) params.append('userId', filters.userId.toString());
    if (filters.courseId) params.append('courseId', filters.courseId.toString());
    if (filters.verb) params.append('verb', filters.verb);
    if (filters.objectType) params.append('objectType', filters.objectType);
    if (filters.startDate) params.append('startDate', filters.startDate);
    if (filters.endDate) params.append('endDate', filters.endDate);
    params.append('format', 'csv');

    const response = await fetch(`/api/activity-log/export?${params.toString()}`, {
      headers: { Authorization: `Bearer ${getAuthToken()}` },
    });
    if (!response.ok) throw new Error('Export failed');
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `activity-logs-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  },

  logActivity: async (data: {
    verb: string;
    objectType: string;
    objectId?: number;
    objectTitle?: string;
    courseId?: number;
    lectureId?: number;
    sectionId?: number;
    progress?: number;
    duration?: number;
    extensions?: Record<string, unknown>;
    sessionId?: string;
    deviceType?: string;
    browserName?: string;
  }) => {
    const response = await apiClient.post<any>('/activity-log', data);
    return response.data.data;
  },
};

export const settingsApi = {
  getSystemSettings: async () => {
    const response = await apiClient.get<ApiResponse<Record<string, any>>>('/settings');
    return response.data.data!;
  },

  getSystemSetting: async (key: string) => {
    const response = await apiClient.get<ApiResponse<any>>(`/settings/${key}`);
    return response.data.data;
  },

  updateSystemSetting: async (key: string, value: string | null, options?: {
    type?: string;
    description?: string;
    isEncrypted?: boolean;
  }) => {
    const response = await apiClient.put<ApiResponse<any>>(`/settings/${key}`, { value, ...options });
    return response.data.data!;
  },

  deleteSystemSetting: async (key: string) => {
    const response = await apiClient.delete<ApiResponse<{ message: string }>>(`/settings/${key}`);
    return response.data;
  },

  getApiConfigs: async () => {
    const response = await apiClient.get<ApiResponse<any[]>>('/settings/api/configs');
    return response.data.data!;
  },

  getApiConfig: async (serviceName: string) => {
    const response = await apiClient.get<ApiResponse<any>>(`/settings/api/configs/${serviceName}`);
    return response.data.data!;
  },

  updateApiConfig: async (serviceName: string, data: {
    apiKey?: string;
    defaultModel?: string;
    isActive?: boolean;
  }) => {
    const response = await apiClient.put<ApiResponse<any>>(`/settings/api/configs/${serviceName}`, data);
    return response.data.data!;
  },

  testApiConfig: async (serviceName: string) => {
    const response = await apiClient.post<ApiResponse<{ success: boolean; message: string }>>(
      `/settings/api/configs/${serviceName}/test`
    );
    return response.data.data!;
  },

  seedDefaults: async () => {
    const response = await apiClient.post<ApiResponse<{ message: string }>>('/settings/seed');
    return response.data;
  },
};
