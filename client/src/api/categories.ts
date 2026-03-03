import apiClient from './client';
import { ApiResponse } from '../types';
import { Category } from '../types';

export const categoriesApi = {
  getCategories: async (): Promise<Category[]> => {
    const response = await apiClient.get<ApiResponse<Category[]>>('/categories');
    return response.data.data!;
  },

  createCategory: async (title: string): Promise<Category> => {
    const response = await apiClient.post<ApiResponse<Category>>('/categories', { title });
    return response.data.data!;
  },

  updateCategory: async (id: number, title: string): Promise<Category> => {
    const response = await apiClient.put<ApiResponse<Category>>(`/categories/${id}`, { title });
    return response.data.data!;
  },

  deleteCategory: async (id: number): Promise<void> => {
    await apiClient.delete(`/categories/${id}`);
  },
};
