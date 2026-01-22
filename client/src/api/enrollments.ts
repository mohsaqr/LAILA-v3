import apiClient from './client';
import { Enrollment, CourseProgress, LectureProgress, ApiResponse } from '../types';
import activityLogger from '../services/activityLogger';

export const enrollmentsApi = {
  getMyEnrollments: async () => {
    const response = await apiClient.get<ApiResponse<Enrollment[]>>('/enrollments');
    return response.data.data!;
  },

  getEnrollment: async (courseId: number) => {
    const response = await apiClient.get<ApiResponse<Enrollment> & { enrolled: boolean }>(
      `/enrollments/course/${courseId}`
    );
    return {
      enrollment: response.data.data,
      enrolled: response.data.enrolled,
    };
  },

  enroll: async (courseId: number, courseTitle?: string) => {
    const response = await apiClient.post<ApiResponse<Enrollment>>('/enrollments', { courseId });
    // Log enrollment activity
    activityLogger.logCourseEnrolled(courseId, courseTitle).catch(() => {});
    return response.data.data!;
  },

  unenroll: async (courseId: number) => {
    const response = await apiClient.delete<ApiResponse<{ message: string }>>(
      `/enrollments/course/${courseId}`
    );
    return response.data;
  },

  getProgress: async (courseId: number) => {
    const response = await apiClient.get<ApiResponse<CourseProgress>>(
      `/enrollments/course/${courseId}/progress`
    );
    return response.data.data!;
  },

  markLectureComplete: async (courseId: number, lectureId: number, lectureTitle?: string, moduleId?: number) => {
    const response = await apiClient.post<ApiResponse<LectureProgress>>(
      `/enrollments/course/${courseId}/lectures/${lectureId}/complete`
    );
    // Log lecture completion activity
    activityLogger.logLectureCompleted(lectureId, lectureTitle, courseId, moduleId).catch(() => {});
    return response.data.data!;
  },

  updateLectureTime: async (courseId: number, lectureId: number, timeSpent: number) => {
    const response = await apiClient.post<ApiResponse<LectureProgress>>(
      `/enrollments/course/${courseId}/lectures/${lectureId}/time`,
      { timeSpent }
    );
    return response.data.data!;
  },
};
