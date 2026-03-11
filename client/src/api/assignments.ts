import apiClient from './client';
import { Assignment, AssignmentSubmission, AssignmentAttachment, ApiResponse } from '../types';

export const assignmentsApi = {
  // Assignments
  getAssignments: async (courseId: number) => {
    const response = await apiClient.get<ApiResponse<Assignment[]>>(`/assignments/course/${courseId}`);
    return response.data.data!;
  },

  getAssignmentById: async (id: number) => {
    const response = await apiClient.get<ApiResponse<Assignment>>(`/assignments/${id}`);
    return response.data.data!;
  },

  createAssignment: async (courseId: number, data: Partial<Assignment>) => {
    const response = await apiClient.post<ApiResponse<Assignment>>(`/assignments/course/${courseId}`, data);
    return response.data.data!;
  },

  updateAssignment: async (id: number, data: Partial<Assignment>) => {
    const response = await apiClient.put<ApiResponse<Assignment>>(`/assignments/${id}`, data);
    return response.data.data!;
  },

  deleteAssignment: async (id: number) => {
    const response = await apiClient.delete<ApiResponse<{ message: string }>>(`/assignments/${id}`);
    return response.data;
  },

  // Submissions
  getSubmissions: async (assignmentId: number) => {
    const response = await apiClient.get<ApiResponse<AssignmentSubmission[]>>(
      `/assignments/${assignmentId}/submissions`
    );
    return response.data.data!;
  },

  submitAssignment: async (
    assignmentId: number,
    data: { content?: string; fileUrls?: string[]; status?: 'draft' | 'submitted' }
  ) => {
    const response = await apiClient.post<ApiResponse<AssignmentSubmission>>(
      `/assignments/${assignmentId}/submit`,
      data
    );
    return response.data.data!;
  },

  getMySubmission: async (assignmentId: number) => {
    const response = await apiClient.get<ApiResponse<AssignmentSubmission>>(
      `/assignments/${assignmentId}/my-submission`
    );
    return response.data.data;
  },

  getSubmissionById: async (submissionId: number): Promise<AssignmentSubmission> => {
    const response = await apiClient.get<ApiResponse<AssignmentSubmission>>(
      `/assignments/submissions/${submissionId}`
    );
    return response.data.data!;
  },

  gradeSubmission: async (submissionId: number, data: { grade: number; feedback?: string }) => {
    const response = await apiClient.post<ApiResponse<AssignmentSubmission>>(
      `/assignments/submissions/${submissionId}/grade`,
      data
    );
    return response.data.data!;
  },

  getGradebook: async (courseId: number) => {
    const response = await apiClient.get<ApiResponse<any>>(`/assignments/course/${courseId}/gradebook`);
    return response.data.data!;
  },

  getMyGradebook: async () => {
    const response = await apiClient.get<ApiResponse<any>>('/assignments/my-gradebook');
    return response.data.data!;
  },

  // Attachments
  getAttachments: async (assignmentId: number) => {
    const response = await apiClient.get<ApiResponse<AssignmentAttachment[]>>(`/assignments/${assignmentId}/attachments`);
    return response.data.data!;
  },

  addAttachment: async (assignmentId: number, data: { fileName: string; fileUrl: string; fileType: string; fileSize?: number }) => {
    const response = await apiClient.post<ApiResponse<AssignmentAttachment>>(`/assignments/${assignmentId}/attachments`, data);
    return response.data.data!;
  },

  updateAttachment: async (attachmentId: number, data: { fileName: string }) => {
    const response = await apiClient.put<ApiResponse<AssignmentAttachment>>(`/assignments/attachments/${attachmentId}`, data);
    return response.data.data!;
  },

  deleteAttachment: async (attachmentId: number) => {
    const response = await apiClient.delete<ApiResponse<{ message: string }>>(`/assignments/attachments/${attachmentId}`);
    return response.data;
  },
};
