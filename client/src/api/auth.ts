import apiClient from './client';
import { AuthResponse, User, ApiResponse } from '../types';

export interface RegisterResponse {
  email: string;
  message: string;
}

export const authApi = {
  register: async (data: { fullname: string; email: string; password: string }) => {
    const response = await apiClient.post<ApiResponse<RegisterResponse>>('/auth/register', data);
    return response.data.data!;
  },

  verifyCode: async (data: { email: string; code: string }) => {
    const response = await apiClient.post<ApiResponse<AuthResponse>>('/auth/verify-code', data);
    return response.data.data!;
  },

  resendCode: async (email: string) => {
    const response = await apiClient.post<ApiResponse<{ message: string }>>('/auth/resend-code', { email });
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

  updateProfile: async (data: { fullname: string }) => {
    const response = await apiClient.put<ApiResponse<{ id: number; fullname: string; email: string; isAdmin: boolean; isInstructor: boolean; avatarUrl?: string | null }>>('/auth/profile', data);
    return response.data.data!;
  },

  uploadAvatar: async (file: File) => {
    const formData = new FormData();
    formData.append('avatar', file);
    const response = await apiClient.post<ApiResponse<{ avatarUrl: string }>>('/auth/avatar', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data.data!;
  },
};
