import { PDFParse } from 'pdf-parse';
import { promises as fs } from 'fs';
import path from 'path';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('pdfExtractor');

// Get uploads directory path
const UPLOADS_DIR = path.join(process.cwd(), 'uploads');

// Maximum characters to extract from a single PDF to avoid context overflow
const MAX_PDF_CHARS = 8000;

export interface PDFInfo {
  pageCount: number;
  text?: string;
}

export class PDFExtractorService {
  /**
   * Resolve a file URL to a buffer - handles both:
   * - Relative paths: /uploads/file.pdf → read from filesystem
   * - Absolute URLs: https://... → fetch from network
   */
  private async getFileBuffer(fileUrl: string): Promise<Buffer> {
    // Handle relative upload paths
    if (fileUrl.startsWith('/uploads/')) {
      const filename = fileUrl.replace('/uploads/', '');
      const filePath = path.join(UPLOADS_DIR, filename);
      logger.info({ filePath }, 'Reading PDF from filesystem');
      return fs.readFile(filePath);
    }

    // Handle absolute URLs
    const response = await fetch(fileUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch PDF: ${response.status}`);
    }
    return Buffer.from(await response.arrayBuffer());
  }

  /**
   * Get PDF metadata (page count) without full extraction
   */
  async getPdfInfo(fileUrl: string): Promise<PDFInfo> {
    try {
      const buffer = await this.getFileBuffer(fileUrl);

      const parser = new PDFParse({ data: buffer });
      const info = await parser.getInfo();
      await parser.destroy();

      return {
        pageCount: info.total || 0,
      };
    } catch (error) {
      logger.error({ error, fileUrl }, 'Failed to get PDF info');
      return { pageCount: 0 };
    }
  }

  /**
   * Extract text from specific pages of a PDF
   * @param pageRange - e.g., "1-5", "3,5,7", "all"
   */
  async extractFromUrl(fileUrl: string, pageRange?: string): Promise<string> {
    try {
      const buffer = await this.getFileBuffer(fileUrl);
      return this.extractFromBuffer(buffer, pageRange, fileUrl);
    } catch (error) {
      logger.error({ error, fileUrl }, 'Failed to extract PDF text');
      return '';
    }
  }

  /**
   * Extract text from a PDF buffer with optional page filtering
   */
  async extractFromBuffer(buffer: Buffer, pageRange?: string, fileUrl?: string): Promise<string> {
    try {
      const parser = new PDFParse({ data: buffer });

      // Get total page count first
      const info = await parser.getInfo();
      const totalPages = info.total || 0;

      // Determine which pages to extract
      let pagesToExtract: number[] | undefined;
      if (pageRange && pageRange !== 'all') {
        pagesToExtract = this.parsePageRange(pageRange);
        // Filter to valid page numbers
        pagesToExtract = pagesToExtract.filter(p => p >= 1 && p <= totalPages);
      }

      // Extract text from specified pages (partial: specific pages, or undefined for all)
      const textResult = await parser.getText({
        partial: pagesToExtract,
      });

      await parser.destroy();

      let text = textResult.text || '';

      // Truncate if too long
      if (text.length > MAX_PDF_CHARS) {
        logger.warn(
          { fileUrl, originalLength: text.length, truncatedTo: MAX_PDF_CHARS },
          'PDF text truncated due to length'
        );
        text = text.substring(0, MAX_PDF_CHARS) + '\n\n[Content truncated...]';
      }

      return text;
    } catch (error) {
      logger.error({ error, fileUrl }, 'Failed to extract PDF text from buffer');
      return '';
    }
  }

  /**
   * Parse page range string into array of page numbers
   * "1-5" → [1,2,3,4,5]
   * "1,3,5" → [1,3,5]
   * "1-3,7-9" → [1,2,3,7,8,9]
   */
  private parsePageRange(range: string): number[] {
    const pages: number[] = [];
    const parts = range.split(',');

    for (const part of parts) {
      const trimmed = part.trim();
      if (trimmed.includes('-')) {
        const [start, end] = trimmed.split('-').map(Number);
        if (!isNaN(start) && !isNaN(end) && start <= end) {
          for (let i = start; i <= end; i++) {
            pages.push(i);
          }
        }
      } else {
        const num = Number(trimmed);
        if (!isNaN(num)) {
          pages.push(num);
        }
      }
    }

    return [...new Set(pages)].sort((a, b) => a - b);
  }
}

export const pdfExtractorService = new PDFExtractorService();
