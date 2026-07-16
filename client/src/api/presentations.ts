import apiClient from './client';
import { ApiResponse } from '../types';

export interface SlideManifest {
  status: 'ready' | 'processing' | 'failed';
  slideCount?: number;
  /** `/uploads/slides/...` URLs, one per slide, in order. */
  images?: string[];
  width?: number;
  height?: number;
}

export const presentationsApi = {
  /**
   * Fetch the per-slide image manifest for a lecture section's PowerPoint.
   * Returns `processing` while the server converts it; poll until `ready`.
   */
  getSlides: async (sectionId: number): Promise<SlideManifest> => {
    const response = await apiClient.get<ApiResponse<SlideManifest>>(
      `/presentations/sections/${sectionId}/slides`,
    );
    return response.data.data!;
  },
};
