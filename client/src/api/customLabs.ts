import apiClient from './client';
import {
  ApiResponse,
  CustomLab,
  LabTemplate,
  LabAssignment,
  LabType,
  CreateCustomLabData,
  UpdateCustomLabData,
  CreateLabTemplateData,
  UpdateLabTemplateData,
  AssignLabData,
} from '../types';

interface LabFilters {
  labType?: string;
  search?: string;
}

export const customLabsApi = {
  // Lab Types
  getLabTypes: async () => {
    const response = await apiClient.get<ApiResponse<LabType[]>>('/labs/types');
    return response.data.data!;
  },

  // Custom Labs
  getLabs: async (filters: LabFilters = {}) => {
    const params = new URLSearchParams();
    if (filters.labType) params.append('labType', filters.labType);
    if (filters.search) params.append('search', filters.search);

    const response = await apiClient.get<ApiResponse<CustomLab[]>>(
      `/labs?${params.toString()}`
    );
    return response.data.data!;
  },

  getMyLabs: async () => {
    const response = await apiClient.get<ApiResponse<CustomLab[]>>('/labs/my-labs');
    return response.data.data!;
  },

  getLabById: async (id: number) => {
    const response = await apiClient.get<ApiResponse<CustomLab>>(`/labs/${id}`);
    return response.data.data!;
  },

  createLab: async (data: CreateCustomLabData) => {
    const response = await apiClient.post<ApiResponse<CustomLab>>('/labs', data);
    return response.data.data!;
  },

  updateLab: async (id: number, data: UpdateCustomLabData) => {
    const response = await apiClient.put<ApiResponse<CustomLab>>(`/labs/${id}`, data);
    return response.data.data!;
  },

  deleteLab: async (id: number) => {
    const response = await apiClient.delete<ApiResponse<{ message: string }>>(`/labs/${id}`);
    return response.data;
  },

  // Templates
  addTemplate: async (labId: number, data: CreateLabTemplateData) => {
    const response = await apiClient.post<ApiResponse<LabTemplate>>(
      `/labs/${labId}/templates`,
      data
    );
    return response.data.data!;
  },

  updateTemplate: async (labId: number, templateId: number, data: UpdateLabTemplateData) => {
    const response = await apiClient.put<ApiResponse<LabTemplate>>(
      `/labs/${labId}/templates/${templateId}`,
      data
    );
    return response.data.data!;
  },

  deleteTemplate: async (labId: number, templateId: number) => {
    const response = await apiClient.delete<ApiResponse<{ message: string }>>(
      `/labs/${labId}/templates/${templateId}`
    );
    return response.data;
  },

  reorderTemplates: async (labId: number, templateIds: number[]) => {
    const response = await apiClient.put<ApiResponse<{ message: string }>>(
      `/labs/${labId}/templates/reorder`,
      { ids: templateIds }
    );
    return response.data;
  },

  // Assignments
  assignToCourse: async (labId: number, data: AssignLabData) => {
    const response = await apiClient.post<ApiResponse<LabAssignment>>(
      `/labs/${labId}/assign`,
      data
    );
    return response.data.data!;
  },

  unassignFromCourse: async (labId: number, courseId: number) => {
    const response = await apiClient.delete<ApiResponse<{ message: string }>>(
      `/labs/${labId}/assign/${courseId}`
    );
    return response.data;
  },

  getLabsForCourse: async (courseId: number) => {
    const response = await apiClient.get<ApiResponse<LabAssignment[]>>(
      `/labs/course/${courseId}`
    );
    return response.data.data!;
  },
};
