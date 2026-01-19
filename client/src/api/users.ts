import apiClient from './client';
import { User, UserStats, InstructorStats, ApiResponse, PaginatedResponse } from '../types';

export const usersApi = {
  getUsers: async (page = 1, limit = 20, search?: string) => {
    const params = new URLSearchParams();
    params.append('page', page.toString());
    params.append('limit', limit.toString());
    if (search) params.append('search', search);

    const response = await apiClient.get<PaginatedResponse<User> & { users: User[] }>(
      `/users?${params.toString()}`
    );
    return {
      users: response.data.users || response.data.data || [],
      pagination: response.data.pagination,
    };
  },

  getUserById: async (id: number) => {
    const response = await apiClient.get<ApiResponse<User>>(`/users/${id}`);
    return response.data.data!;
  },

  updateUser: async (id: number, data: Partial<User & { password?: string }>) => {
    const response = await apiClient.put<ApiResponse<User>>(`/users/${id}`, data);
    return response.data.data!;
  },

  deleteUser: async (id: number) => {
    const response = await apiClient.delete<ApiResponse<{ message: string }>>(`/users/${id}`);
    return response.data;
  },

  getUserSettings: async (id: number) => {
    const response = await apiClient.get<ApiResponse<Record<string, string | null>>>(`/users/${id}/settings`);
    return response.data.data!;
  },

  updateUserSetting: async (id: number, key: string, value: string | null) => {
    const response = await apiClient.put<ApiResponse<any>>(`/users/${id}/settings/${key}`, { value });
    return response.data.data!;
  },

  getUserStats: async (id: number) => {
    const response = await apiClient.get<ApiResponse<UserStats>>(`/users/${id}/stats`);
    return response.data.data!;
  },

  getInstructorStats: async (id: number) => {
    const response = await apiClient.get<ApiResponse<InstructorStats>>(`/users/${id}/instructor-stats`);
    return response.data.data!;
  },
};
