import apiClient from './client';
import {
  ApiResponse,
  ManagedUser,
  UserDetail,
  ManagedEnrollment,
  UserManagementStats,
  UpdateUserData,
  UpdateUserRolesData,
} from '../types';

export const userManagementApi = {
  // Get all users (paginated, searchable)
  getUsers: async (
    page = 1,
    limit = 20,
    filters?: {
      search?: string;
      role?: 'admin' | 'instructor' | 'student';
      isActive?: boolean;
    }
  ) => {
    const params = new URLSearchParams();
    params.append('page', page.toString());
    params.append('limit', limit.toString());
    if (filters?.search) params.append('search', filters.search);
    if (filters?.role) params.append('role', filters.role);
    if (typeof filters?.isActive === 'boolean') {
      params.append('isActive', filters.isActive.toString());
    }

    const response = await apiClient.get<{ success: boolean; users: ManagedUser[]; pagination: { page: number; limit: number; total: number; totalPages: number } }>(
      `/user-management/users?${params.toString()}`
    );
    return {
      users: response.data.users || [],
      pagination: response.data.pagination,
    };
  },

  // Get user stats
  getUserStats: async () => {
    const response = await apiClient.get<ApiResponse<UserManagementStats>>(
      '/user-management/users/stats'
    );
    return response.data.data!;
  },

  // Get user by ID
  getUserById: async (id: number) => {
    const response = await apiClient.get<ApiResponse<ManagedUser>>(
      `/user-management/users/${id}`
    );
    return response.data.data!;
  },

  // Get user with full details
  getUserDetails: async (id: number) => {
    const response = await apiClient.get<ApiResponse<UserDetail>>(
      `/user-management/users/${id}/details`
    );
    return response.data.data!;
  },

  // Update user
  updateUser: async (id: number, data: UpdateUserData) => {
    const response = await apiClient.put<ApiResponse<ManagedUser>>(
      `/user-management/users/${id}`,
      data
    );
    return response.data.data!;
  },

  // Delete user
  deleteUser: async (id: number) => {
    const response = await apiClient.delete<ApiResponse<{ message: string }>>(
      `/user-management/users/${id}`
    );
    return response.data;
  },

  // Update user roles
  updateUserRoles: async (id: number, roles: UpdateUserRolesData) => {
    const response = await apiClient.put<ApiResponse<ManagedUser>>(
      `/user-management/users/${id}/roles`,
      roles
    );
    return response.data.data!;
  },

  // Get user's enrollments
  getUserEnrollments: async (userId: number, page = 1, limit = 20) => {
    const response = await apiClient.get<{ success: boolean; enrollments: ManagedEnrollment[]; pagination: { page: number; limit: number; total: number; totalPages: number } }>(
      `/user-management/users/${userId}/enrollments?page=${page}&limit=${limit}`
    );
    return {
      enrollments: response.data.enrollments || [],
      pagination: response.data.pagination,
    };
  },

  // Add enrollment for user
  addUserEnrollment: async (userId: number, courseId: number) => {
    const response = await apiClient.post<ApiResponse<ManagedEnrollment>>(
      `/user-management/users/${userId}/enrollments`,
      { courseId }
    );
    return response.data.data!;
  },

  // Remove enrollment for user
  removeUserEnrollment: async (userId: number, enrollmentId: number) => {
    const response = await apiClient.delete<ApiResponse<{ message: string }>>(
      `/user-management/users/${userId}/enrollments/${enrollmentId}`
    );
    return response.data;
  },
};
