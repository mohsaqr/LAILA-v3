import apiClient from './client';
import { ApiResponse } from '../types';

interface UploadResponse {
  url: string;
  originalName: string;
  filename: string;
  size: number;
  mimetype: string;
}

export const uploadsApi = {
  uploadThumbnail: async (file: File): Promise<UploadResponse> => {
    const formData = new FormData();
    formData.append('file', file);
    const response = await apiClient.post<ApiResponse<UploadResponse>>(
      '/uploads/thumbnail',
      formData,
      { headers: { 'Content-Type': 'multipart/form-data' } }
    );
    return response.data.data!;
  },

  uploadAssignmentFile: async (file: File): Promise<UploadResponse> => {
    const formData = new FormData();
    formData.append('file', file);
    const response = await apiClient.post<ApiResponse<UploadResponse>>(
      '/uploads/assignment-file',
      formData,
      { headers: { 'Content-Type': 'multipart/form-data' } }
    );
    return response.data.data!;
  },
};
