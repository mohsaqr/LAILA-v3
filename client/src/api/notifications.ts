import apiClient from './client';
import { ApiResponse } from '../types';

export interface NotificationPreferences {
  id: number;
  userId: number;
  // Email preferences
  emailEnrollment: boolean;
  emailAssignmentDue: boolean;
  emailGradePosted: boolean;
  emailAnnouncement: boolean;
  emailForumReply: boolean;
  emailCertificate: boolean;
  emailDigestFrequency: 'none' | 'daily' | 'weekly';
  // In-app preferences
  inAppEnabled: boolean;
  inAppGradePosted: boolean;
  inAppDeadline: boolean;
  inAppAnnouncement: boolean;
  inAppForumReply: boolean;
  inAppCertificate: boolean;
}

export type NotificationType =
  | 'grade_posted'
  | 'deadline_approaching'
  | 'announcement'
  | 'forum_reply'
  | 'enrollment'
  | 'certificate';

export interface Notification {
  id: number;
  userId: number;
  type: NotificationType;
  title: string;
  message: string;
  link: string | null;
  data: Record<string, any> | null;
  isRead: boolean;
  readAt: string | null;
  createdAt: string;
}

export interface NotificationsResponse {
  data: Notification[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
  unreadCount: number;
}

export interface GetNotificationsParams {
  limit?: number;
  offset?: number;
  unreadOnly?: boolean;
}

export const notificationsApi = {
  // =========================================================================
  // NOTIFICATIONS
  // =========================================================================

  getNotifications: async (params: GetNotificationsParams = {}): Promise<NotificationsResponse> => {
    const response = await apiClient.get<ApiResponse<Notification[]> & { pagination: any; unreadCount: number }>('/notifications', { params });
    return {
      data: response.data.data!,
      pagination: response.data.pagination,
      unreadCount: response.data.unreadCount,
    };
  },

  getUnreadCount: async (): Promise<number> => {
    const response = await apiClient.get<ApiResponse<never> & { count: number }>('/notifications/unread-count');
    return response.data.count;
  },

  markAsRead: async (notificationId: number): Promise<void> => {
    await apiClient.post(`/notifications/${notificationId}/read`);
  },

  markAllAsRead: async (): Promise<number> => {
    const response = await apiClient.post<ApiResponse<never> & { count: number }>('/notifications/read-all');
    return response.data.count;
  },

  // =========================================================================
  // PREFERENCES
  // =========================================================================

  getPreferences: async (): Promise<NotificationPreferences> => {
    const response = await apiClient.get<ApiResponse<NotificationPreferences>>('/notifications/preferences');
    return response.data.data!;
  },

  updatePreferences: async (data: Partial<NotificationPreferences>): Promise<NotificationPreferences> => {
    const response = await apiClient.put<ApiResponse<NotificationPreferences>>('/notifications/preferences', data);
    return response.data.data!;
  },

  // =========================================================================
  // INSTRUCTOR ACTIONS
  // =========================================================================

  sendAnnouncement: async (courseId: number, title: string, content: string): Promise<{ sentCount: number }> => {
    const response = await apiClient.post<ApiResponse<{ sentCount: number }>>('/notifications/announce', {
      courseId,
      title,
      content,
    });
    return response.data.data!;
  },

  // =========================================================================
  // TEST (development only)
  // =========================================================================

  testEmail: async (): Promise<{ emailSent: boolean }> => {
    const response = await apiClient.post<ApiResponse<{ emailSent: boolean }>>('/notifications/test');
    return response.data.data!;
  },

  testNotification: async (): Promise<{ notificationId?: number }> => {
    const response = await apiClient.post<ApiResponse<{ notificationId?: number }>>('/notifications/test-notification');
    return response.data.data!;
  },
};
