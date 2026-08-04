import apiClient from './client';
import { ApiResponse } from '../types';

export interface SlideManifest {
  status: 'ready' | 'processing' | 'failed';
  slideCount?: number;
  /** `/uploads/slides/...` URLs, one per slide, in order. */
  images?: string[];
  width?: number;
  height?: number;
  /**
   * The same deck as a PDF, when the server kept one.
   *
   * The slides are rendered to images, so hyperlinks in the deck are not
   * clickable. This is the link-bearing version. Optional: decks converted
   * before it was retained have no PDF until they are reconverted.
   */
  pdfUrl?: string;
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
