import apiClient from './client';
import { ApiResponse } from '../types';

export interface NotificationPreferences {
  id: number;
  userId: number;
  emailEnrollment: boolean;
  emailAssignmentDue: boolean;
  emailGradePosted: boolean;
  emailAnnouncement: boolean;
}

export const notificationsApi = {
  getPreferences: async (): Promise<NotificationPreferences> => {
    const response = await apiClient.get<ApiResponse<NotificationPreferences>>('/notifications/preferences');
    return response.data.data!;
  },

  updatePreferences: async (data: Partial<NotificationPreferences>): Promise<NotificationPreferences> => {
    const response = await apiClient.put<ApiResponse<NotificationPreferences>>('/notifications/preferences', data);
    return response.data.data!;
  },

  sendAnnouncement: async (courseId: number, title: string, content: string): Promise<{ sentCount: number }> => {
    const response = await apiClient.post<ApiResponse<{ sentCount: number }>>('/notifications/announce', {
      courseId,
      title,
      content,
    });
    return response.data.data!;
  },

  testEmail: async (): Promise<{ emailSent: boolean }> => {
    const response = await apiClient.post<ApiResponse<{ emailSent: boolean }>>('/notifications/test');
    return response.data.data!;
  },
};
