import apiClient from './client';
import { AuthResponse, User, ApiResponse } from '../types';

export const authApi = {
  register: async (data: { fullname: string; email: string; password: string }) => {
    const response = await apiClient.post<ApiResponse<AuthResponse>>('/auth/register', data);
    return response.data.data!;
  },

  login: async (data: { email: string; password: string }) => {
    const response = await apiClient.post<ApiResponse<AuthResponse>>('/auth/login', data);
    return response.data.data!;
  },

  getProfile: async () => {
    const response = await apiClient.get<ApiResponse<User>>('/auth/me');
    return response.data.data!;
  },

  updatePassword: async (data: { currentPassword: string; newPassword: string }) => {
    const response = await apiClient.put<ApiResponse<{ message: string }>>('/auth/password', data);
    return response.data;
  },

  verifyToken: async () => {
    const response = await apiClient.get<ApiResponse<{ valid: boolean; user: User }>>('/auth/verify');
    return response.data.data!;
  },

  logout: async () => {
    const response = await apiClient.post<ApiResponse<{ message: string }>>('/auth/logout');
    return response.data;
  },
};
