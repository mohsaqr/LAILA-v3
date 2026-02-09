/**
 * Prompt Blocks API
 *
 * Client-side API for fetching and managing customizable prompt building blocks.
 */

import apiClient from './client';
import { ApiResponse } from '../types';

// Types for API responses
export interface PromptBlockFromApi {
  id: number;
  category: string;
  label: string;
  promptText: string;
  description: string | null;
  popular: boolean;
  isActive: boolean;
  orderIndex: number;
  createdById: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface PromptBlockCategoryFromApi {
  id: number;
  slug: string;
  name: string;
  description: string | null;
  icon: string | null;
  orderIndex: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PromptBlocksWithCategories {
  categories: PromptBlockCategoryFromApi[];
  blocks: PromptBlockFromApi[];
}

// Input types for mutations
export interface CreateBlockInput {
  category: string;
  label: string;
  promptText: string;
  description?: string;
  popular?: boolean;
  orderIndex?: number;
}

export interface UpdateBlockInput {
  category?: string;
  label?: string;
  promptText?: string;
  description?: string;
  popular?: boolean;
  isActive?: boolean;
  orderIndex?: number;
}

export interface CreateCategoryInput {
  slug: string;
  name: string;
  description?: string;
  icon?: string;
  orderIndex?: number;
}

export interface UpdateCategoryInput {
  name?: string;
  description?: string;
  icon?: string;
  orderIndex?: number;
  isActive?: boolean;
}

export const promptBlocksApi = {
  // =============================================================================
  // PUBLIC ENDPOINTS (for students)
  // =============================================================================

  /**
   * Get all active blocks and categories
   */
  getBlocksWithCategories: async (): Promise<PromptBlocksWithCategories> => {
    const response = await apiClient.get<ApiResponse<PromptBlocksWithCategories>>(
      '/prompt-blocks'
    );
    return response.data.data!;
  },

  /**
   * Get all active categories
   */
  getCategories: async (): Promise<PromptBlockCategoryFromApi[]> => {
    const response = await apiClient.get<ApiResponse<PromptBlockCategoryFromApi[]>>(
      '/prompt-blocks/categories'
    );
    return response.data.data!;
  },

  /**
   * Get all active blocks, optionally filtered by category
   */
  getBlocks: async (category?: string): Promise<PromptBlockFromApi[]> => {
    const params = category ? { category } : {};
    const response = await apiClient.get<ApiResponse<PromptBlockFromApi[]>>(
      '/prompt-blocks/blocks',
      { params }
    );
    return response.data.data!;
  },

  // =============================================================================
  // ADMIN ENDPOINTS
  // =============================================================================

  /**
   * Get all blocks including inactive (admin only)
   */
  getAdminBlocksWithCategories: async (): Promise<PromptBlocksWithCategories> => {
    const response = await apiClient.get<ApiResponse<PromptBlocksWithCategories>>(
      '/prompt-blocks/admin'
    );
    return response.data.data!;
  },

  /**
   * Create a new block (admin only)
   */
  createBlock: async (data: CreateBlockInput): Promise<PromptBlockFromApi> => {
    const response = await apiClient.post<ApiResponse<PromptBlockFromApi>>(
      '/prompt-blocks/blocks',
      data
    );
    return response.data.data!;
  },

  /**
   * Update a block (admin only)
   */
  updateBlock: async (id: number, data: UpdateBlockInput): Promise<PromptBlockFromApi> => {
    const response = await apiClient.put<ApiResponse<PromptBlockFromApi>>(
      `/prompt-blocks/blocks/${id}`,
      data
    );
    return response.data.data!;
  },

  /**
   * Delete a block (admin only)
   */
  deleteBlock: async (id: number, hard = false): Promise<void> => {
    await apiClient.delete(`/prompt-blocks/blocks/${id}`, {
      params: hard ? { hard: 'true' } : {},
    });
  },

  /**
   * Reorder blocks (admin only)
   */
  reorderBlocks: async (ids: number[]): Promise<void> => {
    await apiClient.post('/prompt-blocks/blocks/reorder', { ids });
  },

  /**
   * Create a new category (admin only)
   */
  createCategory: async (data: CreateCategoryInput): Promise<PromptBlockCategoryFromApi> => {
    const response = await apiClient.post<ApiResponse<PromptBlockCategoryFromApi>>(
      '/prompt-blocks/categories',
      data
    );
    return response.data.data!;
  },

  /**
   * Update a category (admin only)
   */
  updateCategory: async (id: number, data: UpdateCategoryInput): Promise<PromptBlockCategoryFromApi> => {
    const response = await apiClient.put<ApiResponse<PromptBlockCategoryFromApi>>(
      `/prompt-blocks/categories/${id}`,
      data
    );
    return response.data.data!;
  },

  /**
   * Delete a category (admin only)
   */
  deleteCategory: async (id: number): Promise<void> => {
    await apiClient.delete(`/prompt-blocks/categories/${id}`);
  },

  /**
   * Reorder categories (admin only)
   */
  reorderCategories: async (ids: number[]): Promise<void> => {
    await apiClient.post('/prompt-blocks/categories/reorder', { ids });
  },

  /**
   * Seed default blocks and categories (admin only)
   */
  seedDefaults: async (): Promise<{ categoriesSeeded: boolean; blocksSeeded: boolean }> => {
    const response = await apiClient.post<ApiResponse<{ categoriesSeeded: boolean; blocksSeeded: boolean }>>(
      '/prompt-blocks/seed'
    );
    return response.data.data!;
  },
};
