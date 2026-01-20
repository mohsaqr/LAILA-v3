import apiClient from './client';
import {
  ApiResponse,
  PaginatedResponse,
  ManagedEnrollment,
  EnrollmentStats,
} from '../types';

export const enrollmentManagementApi = {
  // Get all enrollments (admin only)
  getEnrollments: async (
    page = 1,
    limit = 20,
    filters?: {
      courseId?: number;
      userId?: number;
      status?: string;
      search?: string;
    }
  ) => {
    const params = new URLSearchParams();
    params.append('page', page.toString());
    params.append('limit', limit.toString());
    if (filters?.courseId) params.append('courseId', filters.courseId.toString());
    if (filters?.userId) params.append('userId', filters.userId.toString());
    if (filters?.status) params.append('status', filters.status);
    if (filters?.search) params.append('search', filters.search);

    const response = await apiClient.get<PaginatedResponse<ManagedEnrollment>>(
      `/enrollment-management/enrollments?${params.toString()}`
    );
    return {
      enrollments: response.data.data || [],
      pagination: response.data.pagination,
    };
  },

  // Create enrollment
  createEnrollment: async (userId: number, courseId: number) => {
    const response = await apiClient.post<ApiResponse<ManagedEnrollment>>(
      '/enrollment-management/enrollments',
      { userId, courseId }
    );
    return response.data.data!;
  },

  // Delete enrollment
  deleteEnrollment: async (enrollmentId: number) => {
    const response = await apiClient.delete<ApiResponse<{ message: string }>>(
      `/enrollment-management/enrollments/${enrollmentId}`
    );
    return response.data;
  },

  // Get enrollment stats
  getEnrollmentStats: async () => {
    const response = await apiClient.get<ApiResponse<EnrollmentStats>>(
      '/enrollment-management/enrollments/stats'
    );
    return response.data.data!;
  },

  // Get course enrollments (instructor or admin)
  getCourseEnrollments: async (
    courseId: number,
    page = 1,
    limit = 20,
    search?: string
  ) => {
    const params = new URLSearchParams();
    params.append('page', page.toString());
    params.append('limit', limit.toString());
    if (search) params.append('search', search);

    const response = await apiClient.get<
      ApiResponse<{
        course: { id: number; title: string; slug: string };
        enrollments: ManagedEnrollment[];
        pagination: { page: number; limit: number; total: number; totalPages: number };
      }>
    >(`/enrollment-management/courses/${courseId}/enrollments?${params.toString()}`);

    // Handle the nested response structure
    const data = response.data.data;
    return {
      course: data?.course,
      enrollments: data?.enrollments || [],
      pagination: data?.pagination || { page: 1, limit: 20, total: 0, totalPages: 0 },
    };
  },

  // Add user to course by email
  addUserToCourse: async (courseId: number, email: string) => {
    const response = await apiClient.post<ApiResponse<ManagedEnrollment>>(
      `/enrollment-management/courses/${courseId}/enrollments`,
      { email }
    );
    return response.data.data!;
  },

  // Remove user from course
  removeUserFromCourse: async (courseId: number, userId: number) => {
    const response = await apiClient.delete<ApiResponse<{ message: string }>>(
      `/enrollment-management/courses/${courseId}/users/${userId}`
    );
    return response.data;
  },
};
