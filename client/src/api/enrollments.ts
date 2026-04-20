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

  enroll: async (courseId: number, courseTitle?: string, activationCode?: string) => {
    const response = await apiClient.post<ApiResponse<Enrollment>>('/enrollments', { courseId, activationCode });
    // Log enrollment activity
    activityLogger.logCourseEnrolled(courseId, courseTitle).catch(() => {});
    return response.data.data!;
  },

  unenroll: async (courseId: number, courseTitle?: string) => {
    const response = await apiClient.delete<ApiResponse<{ message: string }>>(
      `/enrollments/course/${courseId}`
    );
    // Log unenrollment activity
    activityLogger.log({
      verb: 'unenrolled',
      objectType: 'course',
      objectId: courseId,
      objectTitle: courseTitle,
      courseId,
    }).catch(() => {});
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
    // Log lecture completion activity (single source — no longer mirrored
    // from the button click, which used to produce a duplicate row with a
    // different actionSubtype and no title).
    activityLogger.log({
      verb: 'completed',
      objectType: 'lecture',
      objectId: lectureId,
      objectTitle: lectureTitle,
      courseId,
      moduleId,
      lectureId,
      success: true,
      actionSubtype: 'lecture.marked_complete',
    }).catch(() => {});
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
