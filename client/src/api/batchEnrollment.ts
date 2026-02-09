import apiClient from './client';
import {
  ApiResponse,
  PaginatedResponse,
  BatchEnrollmentJob,
  BatchEnrollmentResult,
} from '../types';

export const batchEnrollmentApi = {
  // Upload CSV and create batch enrollment job
  uploadCSV: async (courseId: number, file: File) => {
    const formData = new FormData();
    formData.append('file', file);

    const response = await apiClient.post<ApiResponse<BatchEnrollmentJob>>(
      `/batch-enrollment/courses/${courseId}/upload`,
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      }
    );
    return response.data.data!;
  },

  // Get batch enrollment jobs
  getJobs: async (
    page = 1,
    limit = 20,
    filters?: {
      courseId?: number;
      status?: string;
    }
  ) => {
    const params = new URLSearchParams();
    params.append('page', page.toString());
    params.append('limit', limit.toString());
    if (filters?.courseId) params.append('courseId', filters.courseId.toString());
    if (filters?.status) params.append('status', filters.status);

    const response = await apiClient.get<PaginatedResponse<BatchEnrollmentJob>>(
      `/batch-enrollment/jobs?${params.toString()}`
    );
    return {
      jobs: response.data.data || [],
      pagination: response.data.pagination,
    };
  },

  // Get job by ID
  getJobById: async (id: number) => {
    const response = await apiClient.get<ApiResponse<BatchEnrollmentJob>>(
      `/batch-enrollment/jobs/${id}`
    );
    return response.data.data!;
  },

  // Get job results
  getJobResults: async (
    jobId: number,
    page = 1,
    limit = 50,
    status?: string
  ) => {
    const params = new URLSearchParams();
    params.append('page', page.toString());
    params.append('limit', limit.toString());
    if (status) params.append('status', status);

    const response = await apiClient.get<PaginatedResponse<BatchEnrollmentResult>>(
      `/batch-enrollment/jobs/${jobId}/results?${params.toString()}`
    );
    return {
      results: response.data.data || [],
      pagination: response.data.pagination,
    };
  },

  // Download CSV template
  downloadTemplate: async () => {
    const response = await apiClient.get('/batch-enrollment/template', {
      responseType: 'blob',
    });

    // Create download link
    const url = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'enrollment_template.csv');
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  },
};
