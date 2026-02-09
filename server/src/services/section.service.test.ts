import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SectionService } from './section.service.js';
import { AppError } from '../middleware/error.middleware.js';

// Mock prisma
vi.mock('../utils/prisma.js', () => ({
  default: {
    lecture: {
      findUnique: vi.fn(),
    },
    lectureSection: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    assignment: {
      findMany: vi.fn(),
    },
  },
}));

// Mock chat service
vi.mock('./chat.service.js', () => ({
  chatService: {
    chat: vi.fn(),
  },
}));

import prisma from '../utils/prisma.js';
import { chatService } from './chat.service.js';

describe('SectionService', () => {
  let sectionService: SectionService;

  const mockCourse = {
    id: 1,
    instructorId: 1,
  };

  const mockModule = {
    id: 1,
    courseId: 1,
    course: mockCourse,
  };

  const mockLecture = {
    id: 1,
    moduleId: 1,
    title: 'Test Lecture',
    module: mockModule,
  };

  const mockSection = {
    id: 1,
    lectureId: 1,
    type: 'text',
    title: 'Test Section',
    content: 'Section content',
    order: 0,
    lecture: mockLecture,
  };

  beforeEach(() => {
    sectionService = new SectionService();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ===========================================================================
  // getSections
  // ===========================================================================

  describe('getSections', () => {
    it('should return sections for a lecture', async () => {
      vi.mocked(prisma.lectureSection.findMany).mockResolvedValue([mockSection] as any);

      const result = await sectionService.getSections(1);

      expect(result).toHaveLength(1);
      expect(prisma.lectureSection.findMany).toHaveBeenCalledWith({
        where: { lectureId: 1 },
        orderBy: { order: 'asc' },
        include: { assignment: true },
      });
    });

    it('should return empty array when no sections', async () => {
      vi.mocked(prisma.lectureSection.findMany).mockResolvedValue([]);

      const result = await sectionService.getSections(1);

      expect(result).toHaveLength(0);
    });
  });

  // ===========================================================================
  // getCourseAssignmentsForSection
  // ===========================================================================

  describe('getCourseAssignmentsForSection', () => {
    it('should return assignments for a course', async () => {
      const mockAssignments = [
        { id: 1, title: 'Assignment 1', courseId: 1 },
        { id: 2, title: 'Assignment 2', courseId: 1 },
      ];
      vi.mocked(prisma.assignment.findMany).mockResolvedValue(mockAssignments as any);

      const result = await sectionService.getCourseAssignmentsForSection(1);

      expect(result).toHaveLength(2);
      expect(prisma.assignment.findMany).toHaveBeenCalledWith({
        where: { courseId: 1 },
        orderBy: { createdAt: 'desc' },
        select: expect.any(Object),
      });
    });
  });

  // ===========================================================================
  // createSection
  // ===========================================================================

  describe('createSection', () => {
    it('should create section as owner', async () => {
      vi.mocked(prisma.lecture.findUnique).mockResolvedValue(mockLecture as any);
      vi.mocked(prisma.lectureSection.findFirst).mockResolvedValue({ order: 1 } as any);
      vi.mocked(prisma.lectureSection.create).mockResolvedValue(mockSection as any);

      const result = await sectionService.createSection(1, 1, {
        type: 'text',
        title: 'New Section',
        content: 'Content',
      });

      expect(result.id).toBe(1);
      expect(prisma.lectureSection.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          lectureId: 1,
          type: 'text',
          title: 'New Section',
          order: 2,
        }),
        include: expect.any(Object),
      });
    });

    it('should create section as admin', async () => {
      vi.mocked(prisma.lecture.findUnique).mockResolvedValue(mockLecture as any);
      vi.mocked(prisma.lectureSection.findFirst).mockResolvedValue(null);
      vi.mocked(prisma.lectureSection.create).mockResolvedValue(mockSection as any);

      const result = await sectionService.createSection(1, 999, { type: 'text' }, true);

      expect(result.id).toBe(1);
    });

    it('should throw 404 if lecture not found', async () => {
      vi.mocked(prisma.lecture.findUnique).mockResolvedValue(null);

      await expect(sectionService.createSection(999, 1, { type: 'text' })).rejects.toThrow(AppError);
      await expect(sectionService.createSection(999, 1, { type: 'text' })).rejects.toThrow('Lecture not found');
    });

    it('should throw 403 if not owner and not admin', async () => {
      vi.mocked(prisma.lecture.findUnique).mockResolvedValue(mockLecture as any);

      await expect(sectionService.createSection(1, 999, { type: 'text' })).rejects.toThrow(AppError);
      await expect(sectionService.createSection(1, 999, { type: 'text' })).rejects.toThrow('Not authorized');
    });

    it('should create chatbot section with chatbot fields', async () => {
      vi.mocked(prisma.lecture.findUnique).mockResolvedValue(mockLecture as any);
      vi.mocked(prisma.lectureSection.findFirst).mockResolvedValue(null);
      vi.mocked(prisma.lectureSection.create).mockResolvedValue({
        ...mockSection,
        type: 'chatbot',
        chatbotTitle: 'AI Tutor',
      } as any);

      const result = await sectionService.createSection(1, 1, {
        type: 'chatbot',
        chatbotTitle: 'AI Tutor',
        chatbotSystemPrompt: 'You are a tutor',
      });

      expect(prisma.lectureSection.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          type: 'chatbot',
          chatbotTitle: 'AI Tutor',
          chatbotSystemPrompt: 'You are a tutor',
        }),
        include: expect.any(Object),
      });
    });

    it('should create assignment section', async () => {
      vi.mocked(prisma.lecture.findUnique).mockResolvedValue(mockLecture as any);
      vi.mocked(prisma.lectureSection.findFirst).mockResolvedValue(null);
      vi.mocked(prisma.lectureSection.create).mockResolvedValue({
        ...mockSection,
        type: 'assignment',
        assignmentId: 5,
      } as any);

      await sectionService.createSection(1, 1, {
        type: 'assignment',
        assignmentId: 5,
        showDeadline: true,
      });

      expect(prisma.lectureSection.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          type: 'assignment',
          assignmentId: 5,
          showDeadline: true,
        }),
        include: { assignment: true },
      });
    });
  });

  // ===========================================================================
  // updateSection
  // ===========================================================================

  describe('updateSection', () => {
    it('should update section as owner', async () => {
      vi.mocked(prisma.lectureSection.findUnique).mockResolvedValue(mockSection as any);
      vi.mocked(prisma.lectureSection.update).mockResolvedValue({
        ...mockSection,
        title: 'Updated Title',
      } as any);

      const result = await sectionService.updateSection(1, 1, { title: 'Updated Title' });

      expect(result.title).toBe('Updated Title');
    });

    it('should update section as admin', async () => {
      vi.mocked(prisma.lectureSection.findUnique).mockResolvedValue(mockSection as any);
      vi.mocked(prisma.lectureSection.update).mockResolvedValue(mockSection as any);

      await sectionService.updateSection(1, 999, { title: 'Admin Update' }, true);

      expect(prisma.lectureSection.update).toHaveBeenCalled();
    });

    it('should throw 404 if section not found', async () => {
      vi.mocked(prisma.lectureSection.findUnique).mockResolvedValue(null);

      await expect(sectionService.updateSection(999, 1, { title: 'Test' })).rejects.toThrow(AppError);
      await expect(sectionService.updateSection(999, 1, { title: 'Test' })).rejects.toThrow('Section not found');
    });

    it('should throw 403 if not owner and not admin', async () => {
      vi.mocked(prisma.lectureSection.findUnique).mockResolvedValue(mockSection as any);

      await expect(sectionService.updateSection(1, 999, { title: 'Test' })).rejects.toThrow(AppError);
      await expect(sectionService.updateSection(1, 999, { title: 'Test' })).rejects.toThrow('Not authorized');
    });
  });

  // ===========================================================================
  // deleteSection
  // ===========================================================================

  describe('deleteSection', () => {
    it('should delete section as owner', async () => {
      vi.mocked(prisma.lectureSection.findUnique).mockResolvedValue(mockSection as any);
      vi.mocked(prisma.lectureSection.delete).mockResolvedValue(mockSection as any);

      const result = await sectionService.deleteSection(1, 1);

      expect(result.message).toBe('Section deleted successfully');
      expect(prisma.lectureSection.delete).toHaveBeenCalledWith({ where: { id: 1 } });
    });

    it('should delete section as admin', async () => {
      vi.mocked(prisma.lectureSection.findUnique).mockResolvedValue(mockSection as any);
      vi.mocked(prisma.lectureSection.delete).mockResolvedValue(mockSection as any);

      const result = await sectionService.deleteSection(1, 999, true);

      expect(result.message).toBe('Section deleted successfully');
    });

    it('should throw 404 if section not found', async () => {
      vi.mocked(prisma.lectureSection.findUnique).mockResolvedValue(null);

      await expect(sectionService.deleteSection(999, 1)).rejects.toThrow(AppError);
      await expect(sectionService.deleteSection(999, 1)).rejects.toThrow('Section not found');
    });

    it('should throw 403 if not owner and not admin', async () => {
      vi.mocked(prisma.lectureSection.findUnique).mockResolvedValue(mockSection as any);

      await expect(sectionService.deleteSection(1, 999)).rejects.toThrow(AppError);
      await expect(sectionService.deleteSection(1, 999)).rejects.toThrow('Not authorized');
    });
  });

  // ===========================================================================
  // reorderSections
  // ===========================================================================

  describe('reorderSections', () => {
    it('should reorder sections as owner', async () => {
      vi.mocked(prisma.lecture.findUnique).mockResolvedValue(mockLecture as any);
      vi.mocked(prisma.lectureSection.findMany).mockResolvedValue([
        { id: 1 },
        { id: 2 },
        { id: 3 },
      ] as any);
      vi.mocked(prisma.lectureSection.update).mockResolvedValue(mockSection as any);

      const result = await sectionService.reorderSections(1, 1, [3, 1, 2]);

      expect(result.message).toBe('Sections reordered successfully');
      expect(prisma.lectureSection.update).toHaveBeenCalledTimes(3);
    });

    it('should throw 400 if section does not belong to lecture', async () => {
      vi.mocked(prisma.lecture.findUnique).mockResolvedValue(mockLecture as any);
      vi.mocked(prisma.lectureSection.findMany).mockResolvedValue([{ id: 1 }, { id: 2 }] as any);

      await expect(sectionService.reorderSections(1, 1, [1, 2, 999])).rejects.toThrow(AppError);
      await expect(sectionService.reorderSections(1, 1, [1, 2, 999])).rejects.toThrow('does not belong');
    });

    it('should throw 404 if lecture not found', async () => {
      vi.mocked(prisma.lecture.findUnique).mockResolvedValue(null);

      await expect(sectionService.reorderSections(999, 1, [1, 2])).rejects.toThrow(AppError);
      await expect(sectionService.reorderSections(999, 1, [1, 2])).rejects.toThrow('Lecture not found');
    });
  });

  // ===========================================================================
  // generateAIContent
  // ===========================================================================

  describe('generateAIContent', () => {
    it('should generate AI content', async () => {
      vi.mocked(chatService.chat).mockResolvedValue({
        reply: '# Generated Content\n\nThis is AI generated content.',
        model: 'gpt-4o-mini',
        responseTime: 1500,
      });

      const result = await sectionService.generateAIContent('Create a lecture about Python basics');

      expect(result).toContain('Generated Content');
      expect(chatService.chat).toHaveBeenCalledWith({
        message: 'Create a lecture about Python basics',
        module: 'content-generator',
        systemPrompt: expect.stringContaining('educational content creator'),
      });
    });

    it('should include context in system prompt', async () => {
      vi.mocked(chatService.chat).mockResolvedValue({
        reply: 'Content with context',
        model: 'gpt-4o-mini',
        responseTime: 1000,
      });

      await sectionService.generateAIContent('Create content', 'This is for a beginner course');

      expect(chatService.chat).toHaveBeenCalledWith({
        message: 'Create content',
        module: 'content-generator',
        systemPrompt: expect.stringContaining('This is for a beginner course'),
      });
    });

    it('should throw error on AI failure', async () => {
      vi.mocked(chatService.chat).mockRejectedValue(new Error('AI service unavailable'));

      await expect(sectionService.generateAIContent('Test prompt')).rejects.toThrow(AppError);
      await expect(sectionService.generateAIContent('Test prompt')).rejects.toThrow('AI service unavailable');
    });
  });
});
