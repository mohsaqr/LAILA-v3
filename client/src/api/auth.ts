import apiClient from './client';
import { AuthResponse, User, ApiResponse } from '../types';

export interface RegisterResponse {
  email: string;
  message: string;
  // False when the registration policy waives the emailed code — the account is
  // already active and the learner can sign in straight away.
  verificationRequired: boolean;
  // Set when a course code was redeemed: the title of the course the account
  // was enrolled into, so the learner can confirm they joined the right one.
  // Null otherwise. Deliberately the only course detail the server ever hands
  // back to an unauthenticated caller — see courseCodeSignup.service.ts.
  courseTitle?: string | null;
}

export interface ForgotPasswordResponse {
  email: string;
  message: string;
}

export interface RegisterPayload {
  fullname: string;
  email: string;
  password: string;
  /** From an invitation link's ?invite= parameter. */
  inviteToken?: string;
  /** Typed in by hand. Mutually exclusive with inviteToken. */
  inviteCode?: string;
  /**
   * A teacher's course activation code, typed in or carried by a ?code= join
   * link. Independent of the two invitation fields and allowed alongside them:
   * an invitation governs the role, a course code governs enrolment.
   */
  courseCode?: string;
}

export const authApi = {
  // The server rejects a token and a code supplied together rather than
  // guessing which one the applicant meant — they could name different
  // invitations with different roles.
  register: async (data: RegisterPayload) => {
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

  forgotPassword: async (email: string) => {
    const response = await apiClient.post<ApiResponse<ForgotPasswordResponse>>('/auth/forgot-password', { email });
    return response.data.data!;
  },

  verifyResetCode: async (email: string, code: string) => {
    const response = await apiClient.post<ApiResponse<{ valid: boolean }>>('/auth/verify-reset-code', { email, code });
    return response.data.data!;
  },

  resetPassword: async (data: { email: string; code: string; newPassword: string }) => {
    const response = await apiClient.post<ApiResponse<AuthResponse>>('/auth/reset-password', data);
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
