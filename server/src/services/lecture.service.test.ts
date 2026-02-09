import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { LectureService } from './lecture.service.js';
import { AppError } from '../middleware/error.middleware.js';

// Mock prisma
vi.mock('../utils/prisma.js', () => ({
  default: {
    lecture: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    courseModule: {
      findUnique: vi.fn(),
    },
    enrollment: {
      findUnique: vi.fn(),
    },
    lectureAttachment: {
      create: vi.fn(),
      findUnique: vi.fn(),
      delete: vi.fn(),
    },
  },
}));

// Mock activity log service
vi.mock('./activityLog.service.js', () => ({
  activityLogService: {
    logActivity: vi.fn().mockResolvedValue(undefined),
  },
}));

import prisma from '../utils/prisma.js';

describe('LectureService', () => {
  let lectureService: LectureService;

  const mockCourse = {
    id: 1,
    title: 'Test Course',
    instructorId: 10,
    status: 'published',
  };

  const mockModule = {
    id: 1,
    title: 'Module 1',
    courseId: 1,
    course: mockCourse,
    isPublished: true,
    orderIndex: 0,
  };

  const mockLecture = {
    id: 1,
    title: 'Introduction',
    content: 'Welcome to the course',
    contentType: 'text',
    duration: 30,
    orderIndex: 0,
    isPublished: true,
    isFree: false,
    moduleId: 1,
    module: mockModule,
    attachments: [],
    sections: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockAttachment = {
    id: 1,
    lectureId: 1,
    fileName: 'notes.pdf',
    fileUrl: '/uploads/notes.pdf',
    fileType: 'application/pdf',
    fileSize: 1024,
    lecture: {
      ...mockLecture,
      module: {
        ...mockModule,
        course: mockCourse,
      },
    },
  };

  beforeEach(() => {
    lectureService = new LectureService();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ===========================================================================
  // getLectures
  // ===========================================================================

  describe('getLectures', () => {
    it('should return lectures for a module', async () => {
      vi.mocked(prisma.lecture.findMany).mockResolvedValue([mockLecture] as any);

      const lectures = await lectureService.getLectures(1);

      expect(lectures).toHaveLength(1);
      expect(lectures[0].title).toBe('Introduction');
      expect(prisma.lecture.findMany).toHaveBeenCalledWith({
        where: { moduleId: 1 },
        orderBy: { orderIndex: 'asc' },
        include: {
          attachments: true,
          sections: { orderBy: { order: 'asc' } },
        },
      });
    });

    it('should return empty array when module has no lectures', async () => {
      vi.mocked(prisma.lecture.findMany).mockResolvedValue([]);

      const lectures = await lectureService.getLectures(1);

      expect(lectures).toHaveLength(0);
    });
  });

  // ===========================================================================
  // getLecturesWithAccessCheck
  // ===========================================================================

  describe('getLecturesWithAccessCheck', () => {
    it('should return all lectures for admin', async () => {
      vi.mocked(prisma.courseModule.findUnique).mockResolvedValue(mockModule as any);
      vi.mocked(prisma.lecture.findMany).mockResolvedValue([mockLecture] as any);

      const lectures = await lectureService.getLecturesWithAccessCheck(1, 99, false, true);

      expect(lectures).toHaveLength(1);
      expect(prisma.lecture.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { moduleId: 1 },
        })
      );
    });

    it('should return all lectures for course instructor', async () => {
      vi.mocked(prisma.courseModule.findUnique).mockResolvedValue(mockModule as any);
      vi.mocked(prisma.lecture.findMany).mockResolvedValue([mockLecture] as any);

      const lectures = await lectureService.getLecturesWithAccessCheck(1, 10, true, false);

      expect(lectures).toHaveLength(1);
    });

    it('should return only published lectures for enrolled student', async () => {
      vi.mocked(prisma.courseModule.findUnique).mockResolvedValue(mockModule as any);
      vi.mocked(prisma.enrollment.findUnique).mockResolvedValue({
        id: 1,
        userId: 20,
        courseId: 1,
      } as any);
      vi.mocked(prisma.lecture.findMany).mockResolvedValue([mockLecture] as any);

      const lectures = await lectureService.getLecturesWithAccessCheck(1, 20, false, false);

      expect(lectures).toHaveLength(1);
      expect(prisma.lecture.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { moduleId: 1, isPublished: true },
        })
      );
    });

    it('should throw 404 when module not found', async () => {
      vi.mocked(prisma.courseModule.findUnique).mockResolvedValue(null);

      await expect(
        lectureService.getLecturesWithAccessCheck(999, 20, false, false)
      ).rejects.toThrow(AppError);
      await expect(
        lectureService.getLecturesWithAccessCheck(999, 20, false, false)
      ).rejects.toThrow('Module not found');
    });

    it('should throw 403 when not enrolled', async () => {
      vi.mocked(prisma.courseModule.findUnique).mockResolvedValue(mockModule as any);
      vi.mocked(prisma.enrollment.findUnique).mockResolvedValue(null);

      await expect(
        lectureService.getLecturesWithAccessCheck(1, 20, false, false)
      ).rejects.toThrow(AppError);
      await expect(
        lectureService.getLecturesWithAccessCheck(1, 20, false, false)
      ).rejects.toThrow('enrolled');
    });

    it('should throw 403 when course is unpublished for student', async () => {
      const unpublishedCourse = { ...mockCourse, status: 'draft' };
      const unpublishedModule = { ...mockModule, course: unpublishedCourse };
      vi.mocked(prisma.courseModule.findUnique).mockResolvedValue(unpublishedModule as any);
      vi.mocked(prisma.enrollment.findUnique).mockResolvedValue({
        id: 1,
        userId: 20,
        courseId: 1,
      } as any);

      await expect(
        lectureService.getLecturesWithAccessCheck(1, 20, false, false)
      ).rejects.toThrow(AppError);
      await expect(
        lectureService.getLecturesWithAccessCheck(1, 20, false, false)
      ).rejects.toThrow('not available');
    });
  });

  // ===========================================================================
  // getLectureById
  // ===========================================================================

  describe('getLectureById', () => {
    it('should return lecture by ID', async () => {
      vi.mocked(prisma.lecture.findUnique).mockResolvedValue({
        ...mockLecture,
        module: {
          ...mockModule,
          course: { id: 1, title: 'Test Course', instructorId: 10 },
        },
      } as any);

      const lecture = await lectureService.getLectureById(1);

      expect(lecture.id).toBe(1);
      expect(lecture.title).toBe('Introduction');
    });

    it('should throw 404 when lecture not found', async () => {
      vi.mocked(prisma.lecture.findUnique).mockResolvedValue(null);

      await expect(lectureService.getLectureById(999)).rejects.toThrow(AppError);
      await expect(lectureService.getLectureById(999)).rejects.toThrow('Lecture not found');
    });

    it('should allow access to free lecture without enrollment', async () => {
      const freeLecture = {
        ...mockLecture,
        isFree: true,
        module: {
          ...mockModule,
          course: { id: 1, title: 'Test Course', instructorId: 10 },
        },
      };
      vi.mocked(prisma.lecture.findUnique).mockResolvedValue(freeLecture as any);

      const lecture = await lectureService.getLectureById(1, 20);

      expect(lecture.isFree).toBe(true);
    });

    it('should throw 403 when not enrolled and lecture is not free', async () => {
      vi.mocked(prisma.lecture.findUnique).mockResolvedValue({
        ...mockLecture,
        isFree: false,
        module: {
          ...mockModule,
          course: { id: 1, title: 'Test Course', instructorId: 10 },
        },
      } as any);
      vi.mocked(prisma.enrollment.findUnique).mockResolvedValue(null);

      await expect(lectureService.getLectureById(1, 20)).rejects.toThrow(AppError);
      await expect(lectureService.getLectureById(1, 20)).rejects.toThrow('enrolled');
    });

    it('should allow instructor to access any lecture in their course', async () => {
      vi.mocked(prisma.lecture.findUnique).mockResolvedValue({
        ...mockLecture,
        module: {
          ...mockModule,
          course: { id: 1, title: 'Test Course', instructorId: 10 },
        },
      } as any);

      const lecture = await lectureService.getLectureById(1, 10);

      expect(lecture.id).toBe(1);
    });
  });

  // ===========================================================================
  // createLecture
  // ===========================================================================

  describe('createLecture', () => {
    it('should create lecture as course owner', async () => {
      vi.mocked(prisma.courseModule.findUnique).mockResolvedValue(mockModule as any);
      vi.mocked(prisma.lecture.findFirst).mockResolvedValue({ orderIndex: 2 } as any);
      vi.mocked(prisma.lecture.create).mockResolvedValue(mockLecture as any);

      const lecture = await lectureService.createLecture(1, 10, {
        title: 'New Lecture',
        contentType: 'text',
      });

      expect(lecture.title).toBe('Introduction');
      expect(prisma.lecture.create).toHaveBeenCalled();
    });

    it('should create lecture as admin', async () => {
      vi.mocked(prisma.courseModule.findUnique).mockResolvedValue(mockModule as any);
      vi.mocked(prisma.lecture.findFirst).mockResolvedValue(null);
      vi.mocked(prisma.lecture.create).mockResolvedValue(mockLecture as any);

      const lecture = await lectureService.createLecture(1, 99, {
        title: 'Admin Lecture',
        contentType: 'video',
      }, true);

      expect(lecture).toBeDefined();
    });

    it('should throw 404 when module not found', async () => {
      vi.mocked(prisma.courseModule.findUnique).mockResolvedValue(null);

      await expect(
        lectureService.createLecture(999, 10, { title: 'Test', contentType: 'text' })
      ).rejects.toThrow(AppError);
      await expect(
        lectureService.createLecture(999, 10, { title: 'Test', contentType: 'text' })
      ).rejects.toThrow('Module not found');
    });

    it('should throw 403 when not authorized', async () => {
      vi.mocked(prisma.courseModule.findUnique).mockResolvedValue(mockModule as any);

      await expect(
        lectureService.createLecture(1, 99, { title: 'Test', contentType: 'text' }, false)
      ).rejects.toThrow(AppError);
      await expect(
        lectureService.createLecture(1, 99, { title: 'Test', contentType: 'text' }, false)
      ).rejects.toThrow('Not authorized');
    });

    it('should auto-calculate orderIndex', async () => {
      vi.mocked(prisma.courseModule.findUnique).mockResolvedValue(mockModule as any);
      vi.mocked(prisma.lecture.findFirst).mockResolvedValue({ orderIndex: 5 } as any);
      vi.mocked(prisma.lecture.create).mockResolvedValue(mockLecture as any);

      await lectureService.createLecture(1, 10, {
        title: 'Test',
        contentType: 'text',
      });

      expect(prisma.lecture.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            orderIndex: 6,
          }),
        })
      );
    });

    it('should use provided orderIndex when specified', async () => {
      vi.mocked(prisma.courseModule.findUnique).mockResolvedValue(mockModule as any);
      vi.mocked(prisma.lecture.findFirst).mockResolvedValue({ orderIndex: 5 } as any);
      vi.mocked(prisma.lecture.create).mockResolvedValue(mockLecture as any);

      await lectureService.createLecture(1, 10, {
        title: 'Test',
        contentType: 'text',
        orderIndex: 2,
      });

      expect(prisma.lecture.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            orderIndex: 2,
          }),
        })
      );
    });
  });

  // ===========================================================================
  // updateLecture
  // ===========================================================================

  describe('updateLecture', () => {
    it('should update lecture as course owner', async () => {
      vi.mocked(prisma.lecture.findUnique).mockResolvedValue({
        ...mockLecture,
        module: {
          ...mockModule,
          course: mockCourse,
        },
      } as any);
      vi.mocked(prisma.lecture.update).mockResolvedValue({
        ...mockLecture,
        title: 'Updated Title',
      } as any);

      const lecture = await lectureService.updateLecture(1, 10, { title: 'Updated Title' });

      expect(lecture.title).toBe('Updated Title');
    });

    it('should update lecture as admin', async () => {
      vi.mocked(prisma.lecture.findUnique).mockResolvedValue({
        ...mockLecture,
        module: {
          ...mockModule,
          course: mockCourse,
        },
      } as any);
      vi.mocked(prisma.lecture.update).mockResolvedValue(mockLecture as any);

      await lectureService.updateLecture(1, 99, { content: 'New content' }, true);

      expect(prisma.lecture.update).toHaveBeenCalled();
    });

    it('should throw 404 when lecture not found', async () => {
      vi.mocked(prisma.lecture.findUnique).mockResolvedValue(null);

      await expect(
        lectureService.updateLecture(999, 10, { title: 'Update' })
      ).rejects.toThrow(AppError);
      await expect(
        lectureService.updateLecture(999, 10, { title: 'Update' })
      ).rejects.toThrow('Lecture not found');
    });

    it('should throw 403 when not authorized', async () => {
      vi.mocked(prisma.lecture.findUnique).mockResolvedValue({
        ...mockLecture,
        module: {
          ...mockModule,
          course: mockCourse,
        },
      } as any);

      await expect(
        lectureService.updateLecture(1, 99, { title: 'Unauthorized' }, false)
      ).rejects.toThrow(AppError);
      await expect(
        lectureService.updateLecture(1, 99, { title: 'Unauthorized' }, false)
      ).rejects.toThrow('Not authorized');
    });
  });

  // ===========================================================================
  // deleteLecture
  // ===========================================================================

  describe('deleteLecture', () => {
    it('should delete lecture as course owner', async () => {
      vi.mocked(prisma.lecture.findUnique).mockResolvedValue({
        ...mockLecture,
        module: {
          ...mockModule,
          course: mockCourse,
        },
      } as any);
      vi.mocked(prisma.lecture.delete).mockResolvedValue(mockLecture as any);

      const result = await lectureService.deleteLecture(1, 10);

      expect(result.message).toBe('Lecture deleted successfully');
      expect(prisma.lecture.delete).toHaveBeenCalledWith({ where: { id: 1 } });
    });

    it('should delete lecture as admin', async () => {
      vi.mocked(prisma.lecture.findUnique).mockResolvedValue({
        ...mockLecture,
        module: {
          ...mockModule,
          course: mockCourse,
        },
      } as any);
      vi.mocked(prisma.lecture.delete).mockResolvedValue(mockLecture as any);

      const result = await lectureService.deleteLecture(1, 99, true);

      expect(result.message).toBe('Lecture deleted successfully');
    });

    it('should throw 404 when lecture not found', async () => {
      vi.mocked(prisma.lecture.findUnique).mockResolvedValue(null);

      await expect(lectureService.deleteLecture(999, 10)).rejects.toThrow(AppError);
      await expect(lectureService.deleteLecture(999, 10)).rejects.toThrow('Lecture not found');
    });

    it('should throw 403 when not authorized', async () => {
      vi.mocked(prisma.lecture.findUnique).mockResolvedValue({
        ...mockLecture,
        module: {
          ...mockModule,
          course: mockCourse,
        },
      } as any);

      await expect(lectureService.deleteLecture(1, 99, false)).rejects.toThrow(AppError);
      await expect(lectureService.deleteLecture(1, 99, false)).rejects.toThrow('Not authorized');
    });
  });

  // ===========================================================================
  // reorderLectures
  // ===========================================================================

  describe('reorderLectures', () => {
    it('should reorder lectures successfully', async () => {
      vi.mocked(prisma.courseModule.findUnique).mockResolvedValue(mockModule as any);
      vi.mocked(prisma.lecture.update).mockResolvedValue(mockLecture as any);

      const result = await lectureService.reorderLectures(1, 10, [3, 1, 2]);

      expect(result.message).toBe('Lectures reordered successfully');
      expect(prisma.lecture.update).toHaveBeenCalledTimes(3);
      expect(prisma.lecture.update).toHaveBeenCalledWith({
        where: { id: 3 },
        data: { orderIndex: 0 },
      });
      expect(prisma.lecture.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { orderIndex: 1 },
      });
      expect(prisma.lecture.update).toHaveBeenCalledWith({
        where: { id: 2 },
        data: { orderIndex: 2 },
      });
    });

    it('should throw 404 when module not found', async () => {
      vi.mocked(prisma.courseModule.findUnique).mockResolvedValue(null);

      await expect(
        lectureService.reorderLectures(999, 10, [1, 2, 3])
      ).rejects.toThrow(AppError);
      await expect(
        lectureService.reorderLectures(999, 10, [1, 2, 3])
      ).rejects.toThrow('Module not found');
    });

    it('should throw 403 when not authorized', async () => {
      vi.mocked(prisma.courseModule.findUnique).mockResolvedValue(mockModule as any);

      await expect(
        lectureService.reorderLectures(1, 99, [1, 2, 3], false)
      ).rejects.toThrow(AppError);
      await expect(
        lectureService.reorderLectures(1, 99, [1, 2, 3], false)
      ).rejects.toThrow('Not authorized');
    });
  });

  // ===========================================================================
  // addAttachment
  // ===========================================================================

  describe('addAttachment', () => {
    it('should add attachment to lecture', async () => {
      vi.mocked(prisma.lecture.findUnique).mockResolvedValue({
        ...mockLecture,
        module: {
          ...mockModule,
          course: mockCourse,
        },
      } as any);
      vi.mocked(prisma.lectureAttachment.create).mockResolvedValue(mockAttachment as any);

      const attachment = await lectureService.addAttachment(1, 10, {
        fileName: 'notes.pdf',
        fileUrl: '/uploads/notes.pdf',
        fileType: 'application/pdf',
      });

      expect(attachment.fileName).toBe('notes.pdf');
      expect(prisma.lectureAttachment.create).toHaveBeenCalledWith({
        data: {
          lectureId: 1,
          fileName: 'notes.pdf',
          fileUrl: '/uploads/notes.pdf',
          fileType: 'application/pdf',
        },
      });
    });

    it('should add attachment with file size', async () => {
      vi.mocked(prisma.lecture.findUnique).mockResolvedValue({
        ...mockLecture,
        module: {
          ...mockModule,
          course: mockCourse,
        },
      } as any);
      vi.mocked(prisma.lectureAttachment.create).mockResolvedValue(mockAttachment as any);

      await lectureService.addAttachment(1, 10, {
        fileName: 'notes.pdf',
        fileUrl: '/uploads/notes.pdf',
        fileType: 'application/pdf',
        fileSize: 2048,
      });

      expect(prisma.lectureAttachment.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          fileSize: 2048,
        }),
      });
    });

    it('should throw 404 when lecture not found', async () => {
      vi.mocked(prisma.lecture.findUnique).mockResolvedValue(null);

      await expect(
        lectureService.addAttachment(999, 10, {
          fileName: 'test.pdf',
          fileUrl: '/test.pdf',
          fileType: 'application/pdf',
        })
      ).rejects.toThrow(AppError);
      await expect(
        lectureService.addAttachment(999, 10, {
          fileName: 'test.pdf',
          fileUrl: '/test.pdf',
          fileType: 'application/pdf',
        })
      ).rejects.toThrow('Lecture not found');
    });

    it('should throw 403 when not authorized', async () => {
      vi.mocked(prisma.lecture.findUnique).mockResolvedValue({
        ...mockLecture,
        module: {
          ...mockModule,
          course: mockCourse,
        },
      } as any);

      await expect(
        lectureService.addAttachment(1, 99, {
          fileName: 'test.pdf',
          fileUrl: '/test.pdf',
          fileType: 'application/pdf',
        }, false)
      ).rejects.toThrow(AppError);
      await expect(
        lectureService.addAttachment(1, 99, {
          fileName: 'test.pdf',
          fileUrl: '/test.pdf',
          fileType: 'application/pdf',
        }, false)
      ).rejects.toThrow('Not authorized');
    });
  });

  // ===========================================================================
  // deleteAttachment
  // ===========================================================================

  describe('deleteAttachment', () => {
    it('should delete attachment as course owner', async () => {
      vi.mocked(prisma.lectureAttachment.findUnique).mockResolvedValue(mockAttachment as any);
      vi.mocked(prisma.lectureAttachment.delete).mockResolvedValue(mockAttachment as any);

      const result = await lectureService.deleteAttachment(1, 10);

      expect(result.message).toBe('Attachment deleted successfully');
      expect(prisma.lectureAttachment.delete).toHaveBeenCalledWith({ where: { id: 1 } });
    });

    it('should delete attachment as admin', async () => {
      vi.mocked(prisma.lectureAttachment.findUnique).mockResolvedValue(mockAttachment as any);
      vi.mocked(prisma.lectureAttachment.delete).mockResolvedValue(mockAttachment as any);

      const result = await lectureService.deleteAttachment(1, 99, true);

      expect(result.message).toBe('Attachment deleted successfully');
    });

    it('should throw 404 when attachment not found', async () => {
      vi.mocked(prisma.lectureAttachment.findUnique).mockResolvedValue(null);

      await expect(lectureService.deleteAttachment(999, 10)).rejects.toThrow(AppError);
      await expect(lectureService.deleteAttachment(999, 10)).rejects.toThrow('Attachment not found');
    });

    it('should throw 403 when not authorized', async () => {
      vi.mocked(prisma.lectureAttachment.findUnique).mockResolvedValue(mockAttachment as any);

      await expect(lectureService.deleteAttachment(1, 99, false)).rejects.toThrow(AppError);
      await expect(lectureService.deleteAttachment(1, 99, false)).rejects.toThrow('Not authorized');
    });

    it('should verify ownership through the full chain (attachment -> lecture -> module -> course)', async () => {
      // Different instructor ID in the course
      const differentOwnerAttachment = {
        ...mockAttachment,
        lecture: {
          ...mockLecture,
          module: {
            ...mockModule,
            course: { ...mockCourse, instructorId: 50 },
          },
        },
      };
      vi.mocked(prisma.lectureAttachment.findUnique).mockResolvedValue(differentOwnerAttachment as any);

      await expect(lectureService.deleteAttachment(1, 10, false)).rejects.toThrow(AppError);
      await expect(lectureService.deleteAttachment(1, 10, false)).rejects.toThrow('Not authorized');
    });
  });
});
