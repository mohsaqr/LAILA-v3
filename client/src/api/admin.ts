import apiClient from './client';
import { AdminStats, ApiResponse, PaginatedResponse } from '../types';
import { getAuthToken } from '../utils/auth';

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

// Interaction Filter Types
export interface InteractionFilters {
  userId?: number;
  courseId?: number;
  eventType?: string;
  pagePath?: string;
  startDate?: string;
  endDate?: string;
  page?: number;
  limit?: number;
  search?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface InteractionFilterOptions {
  users: Array<{ id: number; fullname: string | null; email: string | null }>;
  courses: Array<{ id: number; title: string | null }>;
  eventTypes: Array<{ eventType: string; count: number }>;
  pages: Array<{ path: string; count: number }>;
}

// Analytics API
export const analyticsApi = {
  getInteractionSummary: async (filters?: {
    startDate?: string;
    endDate?: string;
    userId?: number;
    courseId?: number;
    page?: string;
    interactionType?: string;
  }) => {
    const params = new URLSearchParams();
    if (filters?.startDate) params.append('startDate', filters.startDate);
    if (filters?.endDate) params.append('endDate', filters.endDate);
    if (filters?.userId) params.append('userId', filters.userId.toString());
    if (filters?.courseId) params.append('courseId', filters.courseId.toString());
    if (filters?.page) params.append('page', filters.page);
    if (filters?.interactionType) params.append('interactionType', filters.interactionType);

    const response = await apiClient.get<ApiResponse<any>>(`/analytics/interactions/summary?${params.toString()}`);
    return response.data.data!;
  },

  // Query interactions with filters, pagination, search, sorting
  queryInteractions: async (filters: InteractionFilters = {}) => {
    const params = new URLSearchParams();
    if (filters.userId) params.append('userId', filters.userId.toString());
    if (filters.courseId) params.append('courseId', filters.courseId.toString());
    if (filters.eventType) params.append('eventType', filters.eventType);
    if (filters.pagePath) params.append('pagePath', filters.pagePath);
    if (filters.startDate) params.append('startDate', filters.startDate);
    if (filters.endDate) params.append('endDate', filters.endDate);
    if (filters.search) params.append('search', filters.search);
    if (filters.page) params.append('page', filters.page.toString());
    if (filters.limit) params.append('limit', filters.limit.toString());
    if (filters.sortBy) params.append('sortBy', filters.sortBy);
    if (filters.sortOrder) params.append('sortOrder', filters.sortOrder);

    const response = await apiClient.get<any>(`/analytics/interactions/query?${params.toString()}`);
    return response.data;
  },

  // Get filter options for interactions dropdowns
  getInteractionFilterOptions: async (): Promise<InteractionFilterOptions> => {
    const response = await apiClient.get<any>('/analytics/interactions/filter-options');
    return response.data.data;
  },

  // Export interactions as CSV
  exportInteractionsCSV: async (filters: InteractionFilters = {}) => {
    const params = new URLSearchParams();
    if (filters.userId) params.append('userId', filters.userId.toString());
    if (filters.courseId) params.append('courseId', filters.courseId.toString());
    if (filters.eventType) params.append('eventType', filters.eventType);
    if (filters.startDate) params.append('startDate', filters.startDate);
    if (filters.endDate) params.append('endDate', filters.endDate);
    if (filters.search) params.append('search', filters.search);

    const response = await fetch(`/api/analytics/interactions/export/csv?${params.toString()}`, {
      headers: { Authorization: `Bearer ${getAuthToken()}` },
    });
    if (!response.ok) throw new Error('Export failed');
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `interactions-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  },

  // Export interactions as JSON
  exportInteractionsJSON: async (filters: InteractionFilters = {}) => {
    const params = new URLSearchParams();
    if (filters.userId) params.append('userId', filters.userId.toString());
    if (filters.courseId) params.append('courseId', filters.courseId.toString());
    if (filters.eventType) params.append('eventType', filters.eventType);
    if (filters.startDate) params.append('startDate', filters.startDate);
    if (filters.endDate) params.append('endDate', filters.endDate);
    if (filters.search) params.append('search', filters.search);

    // Get all data via query endpoint with high limit
    const response = await apiClient.get<any>(`/analytics/interactions/query?${params.toString()}&limit=10000`);
    const logs = response.data.logs;

    const blob = new Blob([JSON.stringify(logs, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `interactions-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
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

  getForumSummary: async () => {
    const response = await apiClient.get<ApiResponse<any>>('/admin/forum-summary');
    return response.data.data!;
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

// Learning Analytics API (Content & Assessment Events)
export const learningAnalyticsApi = {
  // Log a content event from the frontend
  logContentEvent: async (data: {
    sessionId?: string;
    courseId?: number;
    moduleId?: number;
    lectureId?: number;
    sectionId?: number;
    eventType: 'lecture_view' | 'video_play' | 'video_pause' | 'video_complete' | 'video_seek' | 'document_download' | 'scroll_depth_update' | 'lecture_complete';
    videoPosition?: number;
    videoDuration?: number;
    videoPercentWatched?: number;
    scrollDepthPercent?: number;
    timeOnPageSeconds?: number;
    documentFileName?: string;
    documentFileType?: string;
    timestamp?: number;
    deviceType?: string;
    browserName?: string;
    timezone?: string;
  }) => {
    const response = await apiClient.post<any>('/analytics/content-event', data);
    return response.data.data;
  },

  // Log an assessment event from the frontend
  logAssessmentEvent: async (data: {
    sessionId?: string;
    courseId?: number;
    assignmentId?: number;
    submissionId?: number;
    eventType: 'assignment_view' | 'assignment_submit' | 'grade_received' | 'feedback_view' | 'assignment_start';
    grade?: number;
    maxPoints?: number;
    previousGrade?: number;
    attemptNumber?: number;
    timeSpentSeconds?: number;
    feedbackLength?: number;
    timestamp?: number;
    deviceType?: string;
    browserName?: string;
  }) => {
    const response = await apiClient.post<any>('/analytics/assessment-event', data);
    return response.data.data;
  },

  // Get content events summary (admin)
  getContentEventSummary: async (filters?: {
    startDate?: string;
    endDate?: string;
    userId?: number;
    courseId?: number;
    lectureId?: number;
    eventType?: string;
  }) => {
    const params = new URLSearchParams();
    if (filters?.startDate) params.append('startDate', filters.startDate);
    if (filters?.endDate) params.append('endDate', filters.endDate);
    if (filters?.userId) params.append('userId', filters.userId.toString());
    if (filters?.courseId) params.append('courseId', filters.courseId.toString());
    if (filters?.lectureId) params.append('lectureId', filters.lectureId.toString());
    if (filters?.eventType) params.append('eventType', filters.eventType);

    const response = await apiClient.get<any>(`/analytics/export/summary/content-events?${params.toString()}`);
    return response.data.data;
  },

  // Get assessment events summary (admin)
  getAssessmentEventSummary: async (filters?: {
    startDate?: string;
    endDate?: string;
    userId?: number;
    courseId?: number;
    assignmentId?: number;
    eventType?: string;
  }) => {
    const params = new URLSearchParams();
    if (filters?.startDate) params.append('startDate', filters.startDate);
    if (filters?.endDate) params.append('endDate', filters.endDate);
    if (filters?.userId) params.append('userId', filters.userId.toString());
    if (filters?.courseId) params.append('courseId', filters.courseId.toString());
    if (filters?.assignmentId) params.append('assignmentId', filters.assignmentId.toString());
    if (filters?.eventType) params.append('eventType', filters.eventType);

    const response = await apiClient.get<any>(`/analytics/export/summary/assessment-events?${params.toString()}`);
    return response.data.data;
  },
};

// Activity Log Filter Types
export interface ActivityLogFilters {
  userId?: number;
  courseId?: number;
  verb?: string;
  objectType?: string;
  startDate?: string;
  endDate?: string;
  page?: number;
  limit?: number;
  search?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface ActivityLogFilterOptions {
  users: Array<{ id: number; fullname: string | null; email: string | null }>;
  courses: Array<{ id: number | null; title: string | null }>;
  verbs: Array<{ verb: string; count: number }>;
  objectTypes: Array<{ objectType: string; count: number }>;
}

// Unified Activity Log API
export const activityLogApi = {
  getLogs: async (filters: ActivityLogFilters = {}) => {
    const params = new URLSearchParams();
    if (filters.userId) params.append('userId', filters.userId.toString());
    if (filters.courseId) params.append('courseId', filters.courseId.toString());
    if (filters.verb) params.append('verb', filters.verb);
    if (filters.objectType) params.append('objectType', filters.objectType);
    if (filters.startDate) params.append('startDate', filters.startDate);
    if (filters.endDate) params.append('endDate', filters.endDate);
    if (filters.page) params.append('page', filters.page.toString());
    if (filters.limit) params.append('limit', filters.limit.toString());
    if (filters.search) params.append('search', filters.search);
    if (filters.sortBy) params.append('sortBy', filters.sortBy);
    if (filters.sortOrder) params.append('sortOrder', filters.sortOrder);

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

  getFilterOptions: async (): Promise<ActivityLogFilterOptions> => {
    const response = await apiClient.get<any>('/activity-log/filter-options');
    return response.data.data;
  },

  // Helper to build query string from filters
  _buildQueryString: (filters: ActivityLogFilters) => {
    const params = new URLSearchParams();
    if (filters.userId) params.append('userId', filters.userId.toString());
    if (filters.courseId) params.append('courseId', filters.courseId.toString());
    if (filters.verb) params.append('verb', filters.verb);
    if (filters.objectType) params.append('objectType', filters.objectType);
    if (filters.startDate) params.append('startDate', filters.startDate);
    if (filters.endDate) params.append('endDate', filters.endDate);
    if (filters.search) params.append('search', filters.search);
    return params.toString();
  },

  exportCSV: async (filters: ActivityLogFilters = {}) => {
    const params = new URLSearchParams();
    if (filters.userId) params.append('userId', filters.userId.toString());
    if (filters.courseId) params.append('courseId', filters.courseId.toString());
    if (filters.verb) params.append('verb', filters.verb);
    if (filters.objectType) params.append('objectType', filters.objectType);
    if (filters.startDate) params.append('startDate', filters.startDate);
    if (filters.endDate) params.append('endDate', filters.endDate);
    if (filters.search) params.append('search', filters.search);
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

  exportExcel: async (filters: ActivityLogFilters = {}) => {
    const queryString = activityLogApi._buildQueryString(filters);
    const response = await fetch(`/api/activity-log/export/excel${queryString ? `?${queryString}` : ''}`, {
      headers: { Authorization: `Bearer ${getAuthToken()}` },
    });
    if (!response.ok) throw new Error('Export failed');
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `activity-logs-${new Date().toISOString().slice(0, 10)}.xlsx`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  },

  exportJSON: async (filters: ActivityLogFilters = {}) => {
    const params = new URLSearchParams();
    if (filters.userId) params.append('userId', filters.userId.toString());
    if (filters.courseId) params.append('courseId', filters.courseId.toString());
    if (filters.verb) params.append('verb', filters.verb);
    if (filters.objectType) params.append('objectType', filters.objectType);
    if (filters.startDate) params.append('startDate', filters.startDate);
    if (filters.endDate) params.append('endDate', filters.endDate);
    if (filters.search) params.append('search', filters.search);
    params.append('format', 'json');

    const response = await fetch(`/api/activity-log/export?${params.toString()}`, {
      headers: { Authorization: `Bearer ${getAuthToken()}` },
    });
    if (!response.ok) throw new Error('Export failed');
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `activity-logs-${new Date().toISOString().slice(0, 10)}.json`;
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

// =============================================================================
// LLM PROVIDER API
// =============================================================================

export interface LLMProvider {
  id: number;
  name: string;
  displayName: string;
  description?: string;
  providerType: 'cloud' | 'local' | 'custom';
  isEnabled: boolean;
  isDefault: boolean;
  priority: number;
  baseUrl?: string;
  apiKey?: string;
  apiVersion?: string;
  organizationId?: string;
  projectId?: string;
  defaultModel?: string;
  defaultTemperature: number;
  defaultMaxTokens: number;
  defaultTopP: number;
  defaultTopK?: number;
  defaultFrequencyPenalty: number;
  defaultPresencePenalty: number;
  defaultRepeatPenalty?: number;
  maxContextLength?: number;
  maxOutputTokens?: number;
  requestTimeout: number;
  connectTimeout: number;
  maxRetries: number;
  retryDelay: number;
  retryBackoffMultiplier: number;
  rateLimitRpm?: number;
  rateLimitTpm?: number;
  concurrencyLimit: number;
  supportsStreaming: boolean;
  defaultStreaming: boolean;
  supportsVision: boolean;
  supportsFunctionCalling: boolean;
  supportsJsonMode: boolean;
  supportsSystemMessage: boolean;
  skipTlsVerify: boolean;
  healthCheckEnabled: boolean;
  healthCheckInterval: number;
  lastHealthCheck?: string;
  healthStatus?: 'healthy' | 'unhealthy' | 'unknown';
  lastError?: string;
  consecutiveFailures: number;
  totalRequests: number;
  totalTokensUsed: number;
  totalErrors: number;
  averageLatency?: number;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  models?: LLMModel[];
}

export interface LLMModel {
  id: number;
  providerId: number;
  modelId: string;
  name: string;
  description?: string;
  modelType: 'chat' | 'completion' | 'embedding' | 'vision' | 'multimodal';
  isEnabled: boolean;
  isDefault: boolean;
  contextLength?: number;
  maxOutputTokens?: number;
  defaultTemperature?: number;
  defaultMaxTokens?: number;
  defaultTopP?: number;
  defaultTopK?: number;
  supportsVision: boolean;
  supportsFunctionCalling: boolean;
  supportsJsonMode: boolean;
  supportsStreaming: boolean;
  inputPricePer1M?: number;
  outputPricePer1M?: number;
  totalRequests: number;
  totalInputTokens: number;
  totalOutputTokens: number;
}

export interface LLMProviderDefaults {
  displayName: string;
  providerType: string;
  baseUrl?: string;
  defaultModel?: string;
  defaultTemperature: number;
  defaultMaxTokens: number;
  defaultTopP: number;
  supportsStreaming: boolean;
  supportsVision: boolean;
  supportsFunctionCalling: boolean;
  supportsJsonMode: boolean;
}

// =============================================================================
// UNIFIED MESSAGES API (All Chat Systems)
// =============================================================================

export interface UnifiedMessage {
  id: string;
  timestamp: string;
  systemType: 'chatbot' | 'tutor' | 'agent';
  sessionId: string | null;
  userId: number | null;
  userEmail: string | null;
  userFullname: string | null;
  role: string;
  content: string;
  courseId: number | null;
  courseTitle: string | null;
  moduleId: number | null;
  moduleTitle: string | null;
  lectureId: number | null;
  lectureTitle: string | null;
  sectionId: number | null;
  contextName: string | null;
  aiModel: string | null;
  aiProvider: string | null;
  temperature: number | null;
  maxTokens: number | null;
  promptTokens: number | null;
  completionTokens: number | null;
  totalTokens: number | null;
  responseTimeMs: number | null;
  systemPrompt: string | null;
  conversationId: number | null;
  messageIndex: number | null;
  routingReason: string | null;
  routingConfidence: number | null;
  synthesizedFrom: string | null;
  agentName: string | null;
  agentVersion: number | null;
  // Client context
  deviceType: string | null;
  browserName: string | null;
  ipAddress: string | null;
}

export interface MessageStats {
  total: number;
  chatbot: number;
  tutor: number;
  agent: number;
  uniqueUsers: number;
  avgResponseTimeMs: number | null;
  totalTokens: number;
  byModel: Array<{ model: string; count: number }>;
  byCourse: Array<{ courseId: number; courseTitle: string; count: number }>;
}

export interface MessageFilters {
  startDate?: string;
  endDate?: string;
  systemType?: 'chatbot' | 'tutor' | 'agent';
  courseId?: number;
  userId?: number;
  page?: number;
  limit?: number;
}

export const messagesApi = {
  // Build query string from filters
  _buildQueryString: (filters: MessageFilters) => {
    const params = new URLSearchParams();
    if (filters.startDate) params.append('startDate', filters.startDate);
    if (filters.endDate) params.append('endDate', filters.endDate);
    if (filters.systemType) params.append('systemType', filters.systemType);
    if (filters.courseId) params.append('courseId', filters.courseId.toString());
    if (filters.userId) params.append('userId', filters.userId.toString());
    if (filters.page) params.append('page', filters.page.toString());
    if (filters.limit) params.append('limit', filters.limit.toString());
    return params.toString();
  },

  // Get messages with pagination
  getMessages: async (filters: MessageFilters = {}) => {
    const queryString = messagesApi._buildQueryString(filters);
    const response = await apiClient.get<{
      success: boolean;
      data: UnifiedMessage[];
      pagination: { page: number; limit: number; total: number; totalPages: number };
    }>(`/admin/messages${queryString ? `?${queryString}` : ''}`);
    return {
      messages: response.data.data,
      pagination: response.data.pagination,
    };
  },

  // Get message statistics
  getStats: async (filters: MessageFilters = {}) => {
    const queryString = messagesApi._buildQueryString(filters);
    const response = await apiClient.get<{ success: boolean; data: MessageStats }>(
      `/admin/messages/stats${queryString ? `?${queryString}` : ''}`
    );
    return response.data.data;
  },

  // Export to CSV
  exportCSV: async (filters: MessageFilters = {}) => {
    const queryString = messagesApi._buildQueryString(filters);
    const response = await fetch(`/api/admin/messages/export/csv${queryString ? `?${queryString}` : ''}`, {
      headers: { Authorization: `Bearer ${getAuthToken()}` },
    });
    if (!response.ok) throw new Error('Export failed');
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `unified_messages_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  },

  // Export to Excel
  exportExcel: async (filters: MessageFilters = {}) => {
    const queryString = messagesApi._buildQueryString(filters);
    const response = await fetch(`/api/admin/messages/export/excel${queryString ? `?${queryString}` : ''}`, {
      headers: { Authorization: `Bearer ${getAuthToken()}` },
    });
    if (!response.ok) throw new Error('Export failed');
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `unified_messages_${new Date().toISOString().slice(0, 10)}.xlsx`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  },
};

// =============================================================================
// CHATBOT REGISTRY API
// =============================================================================

export interface ChatbotRegistryFilters {
  type?: 'global' | 'section';
  courseId?: number;
  creatorId?: number;
  isActive?: boolean;
  category?: string;
  search?: string;
  startDate?: string;
  endDate?: string;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface UnifiedChatbot {
  id: string;
  type: 'global' | 'section';
  name: string;
  displayName: string;
  description: string | null;
  category: string | null;
  isActive: boolean;
  systemPrompt: string | null;
  welcomeMessage: string | null;
  dosRules: string[] | null;
  dontsRules: string[] | null;
  personality: string | null;
  personalityPrompt: string | null;
  temperature: number | null;
  maxTokens: number | null;
  responseStyle: string | null;
  modelPreference: string | null;
  suggestedQuestions: string[] | null;
  knowledgeContext: string | null;
  avatarUrl: string | null;
  courseId: number | null;
  courseTitle: string | null;
  moduleId: number | null;
  moduleTitle: string | null;
  lectureId: number | null;
  lectureTitle: string | null;
  sectionId: number | null;
  creatorId: number | null;
  creatorName: string | null;
  creatorEmail: string | null;
  conversationCount: number;
  messageCount: number;
  uniqueUsers: number;
  lastActivity: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ChatbotRegistryStats {
  totalChatbots: number;
  globalChatbots: number;
  sectionChatbots: number;
  totalConversations: number;
  totalMessages: number;
  uniqueUsers: number;
  byCategory: Array<{ category: string; count: number }>;
  byCourse: Array<{ courseId: number; courseTitle: string; count: number }>;
}

export interface ChatbotFilterOptions {
  courses: Array<{ id: number; title: string }>;
  creators: Array<{ id: number; fullname: string | null; email: string }>;
  categories: Array<{ category: string; count: number }>;
}

export const chatbotRegistryApi = {
  // Build query string from filters
  _buildQueryString: (filters: ChatbotRegistryFilters) => {
    const params = new URLSearchParams();
    if (filters.type) params.append('type', filters.type);
    if (filters.courseId) params.append('courseId', filters.courseId.toString());
    if (filters.creatorId) params.append('creatorId', filters.creatorId.toString());
    if (filters.isActive !== undefined) params.append('isActive', filters.isActive.toString());
    if (filters.category) params.append('category', filters.category);
    if (filters.search) params.append('search', filters.search);
    if (filters.startDate) params.append('startDate', filters.startDate);
    if (filters.endDate) params.append('endDate', filters.endDate);
    if (filters.page) params.append('page', filters.page.toString());
    if (filters.limit) params.append('limit', filters.limit.toString());
    if (filters.sortBy) params.append('sortBy', filters.sortBy);
    if (filters.sortOrder) params.append('sortOrder', filters.sortOrder);
    return params.toString();
  },

  // Get chatbots with filters and pagination
  getChatbots: async (filters: ChatbotRegistryFilters = {}) => {
    const queryString = chatbotRegistryApi._buildQueryString(filters);
    const response = await apiClient.get<{
      success: boolean;
      data: UnifiedChatbot[];
      pagination: { page: number; limit: number; total: number; totalPages: number };
    }>(`/admin/chatbot-registry${queryString ? `?${queryString}` : ''}`);
    return {
      chatbots: response.data.data,
      pagination: response.data.pagination,
    };
  },

  // Get filter options for dropdowns
  getFilterOptions: async (): Promise<ChatbotFilterOptions> => {
    const response = await apiClient.get<{ success: boolean; data: ChatbotFilterOptions }>(
      '/admin/chatbot-registry/filter-options'
    );
    return response.data.data;
  },

  // Get summary statistics
  getStats: async (filters?: { startDate?: string; endDate?: string }): Promise<ChatbotRegistryStats> => {
    const params = new URLSearchParams();
    if (filters?.startDate) params.append('startDate', filters.startDate);
    if (filters?.endDate) params.append('endDate', filters.endDate);
    const queryString = params.toString();

    const response = await apiClient.get<{ success: boolean; data: ChatbotRegistryStats }>(
      `/admin/chatbot-registry/stats${queryString ? `?${queryString}` : ''}`
    );
    return response.data.data;
  },

  // Export to CSV
  exportCSV: async (filters: ChatbotRegistryFilters = {}) => {
    const queryString = chatbotRegistryApi._buildQueryString(filters);
    const response = await fetch(`/api/admin/chatbot-registry/export/csv${queryString ? `?${queryString}` : ''}`, {
      headers: { Authorization: `Bearer ${getAuthToken()}` },
    });
    if (!response.ok) throw new Error('Export failed');
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `chatbot-registry-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  },

  // Export to Excel
  exportExcel: async (filters: ChatbotRegistryFilters = {}) => {
    const queryString = chatbotRegistryApi._buildQueryString(filters);
    const response = await fetch(`/api/admin/chatbot-registry/export/excel${queryString ? `?${queryString}` : ''}`, {
      headers: { Authorization: `Bearer ${getAuthToken()}` },
    });
    if (!response.ok) throw new Error('Export failed');
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `chatbot-registry-${new Date().toISOString().slice(0, 10)}.xlsx`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  },

  // Export to JSON
  exportJSON: async (filters: ChatbotRegistryFilters = {}) => {
    const queryString = chatbotRegistryApi._buildQueryString(filters);
    const response = await fetch(`/api/admin/chatbot-registry/export/json${queryString ? `?${queryString}` : ''}`, {
      headers: { Authorization: `Bearer ${getAuthToken()}` },
    });
    if (!response.ok) throw new Error('Export failed');
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `chatbot-registry-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  },
};

export const llmApi = {
  // Get active providers (for chat UI)
  getActiveProviders: async () => {
    const response = await apiClient.get<ApiResponse<LLMProvider[]>>('/llm/active');
    return response.data.data!;
  },

  // Get all providers (admin)
  getProviders: async (includeDisabled = true) => {
    const response = await apiClient.get<ApiResponse<LLMProvider[]>>(
      `/llm/providers?includeDisabled=${includeDisabled}`
    );
    return response.data.data!;
  },

  // Get single provider
  getProvider: async (nameOrId: string | number) => {
    const response = await apiClient.get<ApiResponse<LLMProvider>>(`/llm/providers/${nameOrId}`);
    return response.data.data!;
  },

  // Create provider
  createProvider: async (data: Partial<LLMProvider>) => {
    const response = await apiClient.post<ApiResponse<LLMProvider>>('/llm/providers', data);
    return response.data.data!;
  },

  // Update provider
  updateProvider: async (id: number, data: Partial<LLMProvider>) => {
    const response = await apiClient.put<ApiResponse<LLMProvider>>(`/llm/providers/${id}`, data);
    return response.data.data!;
  },

  // Delete provider
  deleteProvider: async (id: number) => {
    const response = await apiClient.delete<ApiResponse<void>>(`/llm/providers/${id}`);
    return response.data;
  },

  // Test provider connection
  testProvider: async (nameOrId: string | number) => {
    const response = await apiClient.post<ApiResponse<{ success: boolean; message: string; latency?: number }>>(
      `/llm/providers/${nameOrId}/test`
    );
    return response.data.data!;
  },

  // Set provider as default
  setDefaultProvider: async (id: number) => {
    const response = await apiClient.post<ApiResponse<LLMProvider>>(`/llm/providers/${id}/set-default`);
    return response.data.data!;
  },

  // Toggle provider enabled/disabled
  toggleProvider: async (id: number) => {
    const response = await apiClient.post<ApiResponse<LLMProvider>>(`/llm/providers/${id}/toggle`);
    return response.data.data!;
  },

  // Get models
  getModels: async (providerId?: number) => {
    const params = providerId ? `?providerId=${providerId}` : '';
    const response = await apiClient.get<ApiResponse<LLMModel[]>>(`/llm/models${params}`);
    return response.data.data!;
  },

  // Create model
  createModel: async (data: Partial<LLMModel> & { providerId: number; modelId: string; name: string }) => {
    const response = await apiClient.post<ApiResponse<LLMModel>>('/llm/models', data);
    return response.data.data!;
  },

  // Delete model
  deleteModel: async (id: number) => {
    const response = await apiClient.delete<ApiResponse<void>>(`/llm/models/${id}`);
    return response.data;
  },

  // Seed common models for provider
  seedModels: async (providerId: number) => {
    const response = await apiClient.post<ApiResponse<LLMModel[]>>(`/llm/providers/${providerId}/seed-models`);
    return response.data.data!;
  },

  // Get provider defaults
  getDefaults: async () => {
    const response = await apiClient.get<ApiResponse<Record<string, LLMProviderDefaults>>>('/llm/defaults');
    return response.data.data!;
  },

  // Get common models for provider type
  getCommonModels: async (providerName: string) => {
    const response = await apiClient.get<ApiResponse<Array<{ modelId: string; name: string; contextLength?: number }>>>(
      `/llm/defaults/${providerName}/models`
    );
    return response.data.data!;
  },

  // Get Ollama models
  getOllamaModels: async (baseUrl?: string) => {
    const params = baseUrl ? `?baseUrl=${encodeURIComponent(baseUrl)}` : '';
    const response = await apiClient.get<ApiResponse<Array<{ name: string; size: number; modifiedAt: string }>>>(
      `/llm/ollama/models${params}`
    );
    return response.data.data!;
  },

  // Pull Ollama model
  pullOllamaModel: async (modelName: string, baseUrl?: string) => {
    const response = await apiClient.post<ApiResponse<{ message: string }>>('/llm/ollama/pull', {
      modelName,
      baseUrl,
    });
    return response.data;
  },

  // Get LM Studio models
  getLMStudioModels: async (baseUrl?: string) => {
    const params = baseUrl ? `?baseUrl=${encodeURIComponent(baseUrl)}` : '';
    const response = await apiClient.get<ApiResponse<Array<{ id: string; object: string }>>>(
      `/llm/lmstudio/models${params}`
    );
    return response.data.data!;
  },

  // Seed default providers
  seedProviders: async () => {
    const response = await apiClient.post<ApiResponse<LLMProvider[]>>('/llm/seed');
    return response.data.data!;
  },

  // Test chat
  testChat: async (message: string, provider?: string, model?: string) => {
    const response = await apiClient.post<ApiResponse<{
      id: string;
      model: string;
      provider: string;
      choices: Array<{ message: { content: string } }>;
      usage?: { promptTokens: number; completionTokens: number; totalTokens: number };
      responseTime: number;
    }>>('/llm/chat/test', { message, provider, model });
    return response.data.data!;
  },
};
