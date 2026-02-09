import apiClient from './client';
import {
  CodeLab,
  CodeBlock,
  CreateCodeLabData,
  UpdateCodeLabData,
  CreateCodeBlockData,
  UpdateCodeBlockData,
  ApiResponse,
} from '../types';

export const codeLabsApi = {
  // ==========================================================================
  // CODE LABS
  // ==========================================================================

  /**
   * Get all code labs for a module
   */
  getCodeLabsForModule: async (moduleId: number) => {
    const response = await apiClient.get<ApiResponse<CodeLab[]>>(
      `/code-labs/module/${moduleId}`
    );
    return response.data.data!;
  },

  /**
   * Get a code lab by ID with all blocks
   */
  getCodeLabById: async (codeLabId: number) => {
    const response = await apiClient.get<ApiResponse<CodeLab>>(
      `/code-labs/${codeLabId}`
    );
    return response.data.data!;
  },

  /**
   * Create a new code lab
   */
  createCodeLab: async (data: CreateCodeLabData) => {
    const response = await apiClient.post<ApiResponse<CodeLab>>(
      '/code-labs',
      data
    );
    return response.data.data!;
  },

  /**
   * Update a code lab
   */
  updateCodeLab: async (codeLabId: number, data: UpdateCodeLabData) => {
    const response = await apiClient.put<ApiResponse<CodeLab>>(
      `/code-labs/${codeLabId}`,
      data
    );
    return response.data.data!;
  },

  /**
   * Delete a code lab
   */
  deleteCodeLab: async (codeLabId: number) => {
    const response = await apiClient.delete<ApiResponse<{ message: string }>>(
      `/code-labs/${codeLabId}`
    );
    return response.data;
  },

  /**
   * Reorder code labs within a module
   */
  reorderCodeLabs: async (moduleId: number, codeLabIds: number[]) => {
    const response = await apiClient.put<ApiResponse<{ message: string }>>(
      `/code-labs/module/${moduleId}/reorder`,
      { ids: codeLabIds }
    );
    return response.data;
  },

  // ==========================================================================
  // CODE BLOCKS
  // ==========================================================================

  /**
   * Create a new code block in a code lab
   */
  createCodeBlock: async (codeLabId: number, data: CreateCodeBlockData) => {
    const response = await apiClient.post<ApiResponse<CodeBlock>>(
      `/code-labs/${codeLabId}/blocks`,
      data
    );
    return response.data.data!;
  },

  /**
   * Update a code block
   */
  updateCodeBlock: async (
    codeLabId: number,
    blockId: number,
    data: UpdateCodeBlockData
  ) => {
    const response = await apiClient.put<ApiResponse<CodeBlock>>(
      `/code-labs/${codeLabId}/blocks/${blockId}`,
      data
    );
    return response.data.data!;
  },

  /**
   * Delete a code block
   */
  deleteCodeBlock: async (codeLabId: number, blockId: number) => {
    const response = await apiClient.delete<ApiResponse<{ message: string }>>(
      `/code-labs/${codeLabId}/blocks/${blockId}`
    );
    return response.data;
  },

  /**
   * Reorder code blocks within a code lab
   */
  reorderCodeBlocks: async (codeLabId: number, blockIds: number[]) => {
    const response = await apiClient.put<ApiResponse<{ message: string }>>(
      `/code-labs/${codeLabId}/blocks/reorder`,
      { ids: blockIds }
    );
    return response.data;
  },
};
