import apiClient from './client';
import { ApiResponse, CourseRole } from '../types';

export type CourseRoleType = 'ta' | 'co_instructor' | 'course_admin';
export type Permission = 'grade' | 'edit_content' | 'manage_students' | 'view_analytics';

export const ROLE_LABELS: Record<CourseRoleType, string> = {
  ta: 'Teaching Assistant',
  co_instructor: 'Co-Instructor',
  course_admin: 'Course Admin',
};

export const PERMISSION_LABELS: Record<Permission, string> = {
  grade: 'Grade Submissions',
  edit_content: 'Edit Content',
  manage_students: 'Manage Students',
  view_analytics: 'View Analytics',
};

export const ROLE_DEFAULT_PERMISSIONS: Record<CourseRoleType, Permission[]> = {
  ta: ['grade', 'view_analytics'],
  co_instructor: ['grade', 'edit_content', 'view_analytics'],
  course_admin: ['grade', 'edit_content', 'manage_students', 'view_analytics'],
};

export const courseRolesApi = {
  // Get course roles
  getCourseRoles: async (courseId: number) => {
    const response = await apiClient.get<ApiResponse<CourseRole[]>>(
      `/course-roles/courses/${courseId}/roles`
    );
    return response.data.data!;
  },

  // Assign role
  assignRole: async (
    courseId: number,
    userId: number,
    role: CourseRoleType,
    permissions?: Permission[]
  ) => {
    const response = await apiClient.post<ApiResponse<CourseRole>>(
      `/course-roles/courses/${courseId}/roles`,
      { userId, role, permissions }
    );
    return response.data.data!;
  },

  // Update role
  updateRole: async (
    courseId: number,
    roleId: number,
    data: { role?: CourseRoleType; permissions?: Permission[] }
  ) => {
    const response = await apiClient.put<ApiResponse<CourseRole>>(
      `/course-roles/courses/${courseId}/roles/${roleId}`,
      data
    );
    return response.data.data!;
  },

  // Remove role
  removeRole: async (courseId: number, roleId: number) => {
    const response = await apiClient.delete<ApiResponse<{ message: string }>>(
      `/course-roles/courses/${courseId}/roles/${roleId}`
    );
    return response.data;
  },
};
