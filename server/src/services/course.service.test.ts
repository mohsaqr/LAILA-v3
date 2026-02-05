import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { CourseService } from './course.service.js';
import { AppError } from '../middleware/error.middleware.js';

// Mock prisma
vi.mock('../utils/prisma.js', () => ({
  default: {
    course: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
    },
    enrollment: {
      findMany: vi.fn(),
    },
  },
}));

// Mock learning analytics (fire and forget)
vi.mock('./learningAnalytics.service.js', () => ({
  learningAnalyticsService: {
    logSystemEvent: vi.fn().mockResolvedValue(undefined),
  },
}));

import prisma from '../utils/prisma.js';

describe('CourseService', () => {
  let courseService: CourseService;

  const mockInstructor = {
    id: 10,
    fullname: 'John Instructor',
    email: 'instructor@test.com',
  };

  const mockCourse = {
    id: 1,
    title: 'Introduction to Programming',
    description: 'Learn the basics of programming',
    slug: 'introduction-to-programming-abc123',
    category: 'programming',
    difficulty: 'beginner',
    status: 'published',
    isPublic: true,
    instructorId: 10,
    instructor: mockInstructor,
    createdAt: new Date(),
    updatedAt: new Date(),
    publishedAt: new Date(),
    modules: [],
    _count: { enrollments: 50, modules: 5 },
  };

  const mockModule = {
    id: 1,
    title: 'Module 1',
    orderIndex: 0,
    isPublished: true,
    lectures: [
      { id: 1, title: 'Lecture 1', isPublished: true },
    ],
  };

  beforeEach(() => {
    courseService = new CourseService();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ===========================================================================
  // getCourses
  // ===========================================================================

  describe('getCourses', () => {
    it('should return paginated list of published courses', async () => {
      vi.mocked(prisma.course.findMany).mockResolvedValue([mockCourse] as any);
      vi.mocked(prisma.course.count).mockResolvedValue(1);

      const result = await courseService.getCourses({}, 1, 10);

      expect(result.courses).toHaveLength(1);
      expect(result.pagination.total).toBe(1);
      expect(result.pagination.page).toBe(1);
      expect(prisma.course.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { status: 'published', isPublic: true },
        })
      );
    });

    it('should filter by category', async () => {
      vi.mocked(prisma.course.findMany).mockResolvedValue([mockCourse] as any);
      vi.mocked(prisma.course.count).mockResolvedValue(1);

      await courseService.getCourses({ category: 'programming' }, 1, 10);

      expect(prisma.course.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ category: 'programming' }),
        })
      );
    });

    it('should filter by difficulty', async () => {
      vi.mocked(prisma.course.findMany).mockResolvedValue([mockCourse] as any);
      vi.mocked(prisma.course.count).mockResolvedValue(1);

      await courseService.getCourses({ difficulty: 'beginner' }, 1, 10);

      expect(prisma.course.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ difficulty: 'beginner' }),
        })
      );
    });

    it('should filter by search term', async () => {
      vi.mocked(prisma.course.findMany).mockResolvedValue([mockCourse] as any);
      vi.mocked(prisma.course.count).mockResolvedValue(1);

      await courseService.getCourses({ search: 'programming' }, 1, 10);

      expect(prisma.course.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: [
              { title: { contains: 'programming' } },
              { description: { contains: 'programming' } },
            ],
          }),
        })
      );
    });

    it('should return empty list when no courses match', async () => {
      vi.mocked(prisma.course.findMany).mockResolvedValue([]);
      vi.mocked(prisma.course.count).mockResolvedValue(0);

      const result = await courseService.getCourses({}, 1, 10);

      expect(result.courses).toHaveLength(0);
      expect(result.pagination.total).toBe(0);
    });

    it('should calculate pagination correctly', async () => {
      vi.mocked(prisma.course.findMany).mockResolvedValue([mockCourse] as any);
      vi.mocked(prisma.course.count).mockResolvedValue(25);

      const result = await courseService.getCourses({}, 2, 10);

      expect(result.pagination.totalPages).toBe(3);
      expect(prisma.course.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 10,
          take: 10,
        })
      );
    });
  });

  // ===========================================================================
  // getCourseById
  // ===========================================================================

  describe('getCourseById', () => {
    it('should return published course', async () => {
      vi.mocked(prisma.course.findFirst).mockResolvedValue({
        ...mockCourse,
        modules: [mockModule],
      } as any);

      const course = await courseService.getCourseById(1);

      expect(course.id).toBe(1);
      expect(course.title).toBe('Introduction to Programming');
      expect(prisma.course.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 1, status: 'published' },
        })
      );
    });

    it('should throw 404 when course not found', async () => {
      vi.mocked(prisma.course.findFirst).mockResolvedValue(null);

      await expect(courseService.getCourseById(999)).rejects.toThrow(AppError);
      await expect(courseService.getCourseById(999)).rejects.toThrow('Course not found');
    });

    it('should include unpublished content when includeUnpublished is true', async () => {
      vi.mocked(prisma.course.findFirst).mockResolvedValue(mockCourse as any);

      await courseService.getCourseById(1, true);

      expect(prisma.course.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 1 },
        })
      );
    });
  });

  // ===========================================================================
  // getCourseByIdWithOwnerCheck
  // ===========================================================================

  describe('getCourseByIdWithOwnerCheck', () => {
    it('should allow admin to see unpublished course', async () => {
      const draftCourse = { ...mockCourse, status: 'draft' };
      vi.mocked(prisma.course.findUnique).mockResolvedValue(draftCourse as any);
      vi.mocked(prisma.course.findFirst).mockResolvedValue(draftCourse as any);

      const course = await courseService.getCourseByIdWithOwnerCheck(1, 99, true, false);

      expect(course).toBeDefined();
    });

    it('should allow instructor to see own unpublished course', async () => {
      const draftCourse = { ...mockCourse, status: 'draft' };
      vi.mocked(prisma.course.findUnique).mockResolvedValue(draftCourse as any);
      vi.mocked(prisma.course.findFirst).mockResolvedValue(draftCourse as any);

      const course = await courseService.getCourseByIdWithOwnerCheck(1, 10, false, true);

      expect(course).toBeDefined();
    });

    it('should throw 404 for student accessing unpublished course', async () => {
      const draftCourse = { ...mockCourse, status: 'draft' };
      vi.mocked(prisma.course.findUnique).mockResolvedValue(draftCourse as any);

      await expect(
        courseService.getCourseByIdWithOwnerCheck(1, 20, false, false)
      ).rejects.toThrow(AppError);
      await expect(
        courseService.getCourseByIdWithOwnerCheck(1, 20, false, false)
      ).rejects.toThrow('Course not found');
    });

    it('should throw 404 when course does not exist', async () => {
      vi.mocked(prisma.course.findUnique).mockResolvedValue(null);

      await expect(
        courseService.getCourseByIdWithOwnerCheck(999, 10, false, true)
      ).rejects.toThrow(AppError);
      await expect(
        courseService.getCourseByIdWithOwnerCheck(999, 10, false, true)
      ).rejects.toThrow('Course not found');
    });
  });

  // ===========================================================================
  // getCourseBySlug
  // ===========================================================================

  describe('getCourseBySlug', () => {
    it('should return course by slug', async () => {
      vi.mocked(prisma.course.findUnique).mockResolvedValue(mockCourse as any);

      const course = await courseService.getCourseBySlug('introduction-to-programming-abc123');

      expect(course.slug).toBe('introduction-to-programming-abc123');
    });

    it('should throw 404 when slug not found', async () => {
      vi.mocked(prisma.course.findUnique).mockResolvedValue(null);

      await expect(courseService.getCourseBySlug('nonexistent')).rejects.toThrow(AppError);
      await expect(courseService.getCourseBySlug('nonexistent')).rejects.toThrow('Course not found');
    });
  });

  // ===========================================================================
  // createCourse
  // ===========================================================================

  describe('createCourse', () => {
    it('should create course successfully', async () => {
      vi.mocked(prisma.course.create).mockResolvedValue(mockCourse as any);

      const course = await courseService.createCourse(10, {
        title: 'New Course',
        description: 'Description',
      });

      expect(course.title).toBe('Introduction to Programming');
      expect(prisma.course.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            title: 'New Course',
            description: 'Description',
            instructorId: 10,
            slug: expect.any(String),
          }),
        })
      );
    });

    it('should generate unique slug from title', async () => {
      vi.mocked(prisma.course.create).mockResolvedValue(mockCourse as any);

      await courseService.createCourse(10, {
        title: 'My Amazing Course!',
        description: 'Description',
      });

      expect(prisma.course.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            slug: expect.stringMatching(/^my-amazing-course-[a-z0-9]+$/),
          }),
        })
      );
    });
  });

  // ===========================================================================
  // updateCourse
  // ===========================================================================

  describe('updateCourse', () => {
    it('should update course as owner', async () => {
      vi.mocked(prisma.course.findUnique).mockResolvedValue(mockCourse as any);
      vi.mocked(prisma.course.update).mockResolvedValue({
        ...mockCourse,
        title: 'Updated Title',
      } as any);

      const course = await courseService.updateCourse(1, 10, { title: 'Updated Title' });

      expect(course.title).toBe('Updated Title');
    });

    it('should update course as admin', async () => {
      vi.mocked(prisma.course.findUnique).mockResolvedValue(mockCourse as any);
      vi.mocked(prisma.course.update).mockResolvedValue({
        ...mockCourse,
        title: 'Admin Update',
      } as any);

      const course = await courseService.updateCourse(1, 99, { title: 'Admin Update' }, true);

      expect(course.title).toBe('Admin Update');
    });

    it('should throw 404 when course not found', async () => {
      vi.mocked(prisma.course.findUnique).mockResolvedValue(null);

      await expect(
        courseService.updateCourse(999, 10, { title: 'Update' })
      ).rejects.toThrow(AppError);
      await expect(
        courseService.updateCourse(999, 10, { title: 'Update' })
      ).rejects.toThrow('Course not found');
    });

    it('should throw 403 when not authorized', async () => {
      vi.mocked(prisma.course.findUnique).mockResolvedValue(mockCourse as any);

      await expect(
        courseService.updateCourse(1, 99, { title: 'Unauthorized Update' }, false)
      ).rejects.toThrow(AppError);
      await expect(
        courseService.updateCourse(1, 99, { title: 'Unauthorized Update' }, false)
      ).rejects.toThrow('Not authorized');
    });
  });

  // ===========================================================================
  // deleteCourse
  // ===========================================================================

  describe('deleteCourse', () => {
    it('should delete course as owner', async () => {
      vi.mocked(prisma.course.findUnique).mockResolvedValue(mockCourse as any);
      vi.mocked(prisma.course.delete).mockResolvedValue(mockCourse as any);

      const result = await courseService.deleteCourse(1, 10);

      expect(result.message).toBe('Course deleted successfully');
      expect(prisma.course.delete).toHaveBeenCalledWith({ where: { id: 1 } });
    });

    it('should delete course as admin', async () => {
      vi.mocked(prisma.course.findUnique).mockResolvedValue(mockCourse as any);
      vi.mocked(prisma.course.delete).mockResolvedValue(mockCourse as any);

      const result = await courseService.deleteCourse(1, 99, true);

      expect(result.message).toBe('Course deleted successfully');
    });

    it('should throw 404 when course not found', async () => {
      vi.mocked(prisma.course.findUnique).mockResolvedValue(null);

      await expect(courseService.deleteCourse(999, 10)).rejects.toThrow(AppError);
      await expect(courseService.deleteCourse(999, 10)).rejects.toThrow('Course not found');
    });

    it('should throw 403 when not authorized', async () => {
      vi.mocked(prisma.course.findUnique).mockResolvedValue(mockCourse as any);

      await expect(courseService.deleteCourse(1, 99, false)).rejects.toThrow(AppError);
      await expect(courseService.deleteCourse(1, 99, false)).rejects.toThrow('Not authorized');
    });
  });

  // ===========================================================================
  // publishCourse
  // ===========================================================================

  describe('publishCourse', () => {
    it('should publish course with content', async () => {
      const courseWithContent = {
        ...mockCourse,
        status: 'draft',
        modules: [mockModule],
      };
      vi.mocked(prisma.course.findUnique).mockResolvedValue(courseWithContent as any);
      vi.mocked(prisma.course.update).mockResolvedValue({
        ...mockCourse,
        status: 'published',
      } as any);

      const course = await courseService.publishCourse(1, 10);

      expect(prisma.course.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: {
          status: 'published',
          publishedAt: expect.any(Date),
        },
      });
    });

    it('should throw 404 when course not found', async () => {
      vi.mocked(prisma.course.findUnique).mockResolvedValue(null);

      await expect(courseService.publishCourse(999, 10)).rejects.toThrow(AppError);
      await expect(courseService.publishCourse(999, 10)).rejects.toThrow('Course not found');
    });

    it('should throw 403 when not authorized', async () => {
      vi.mocked(prisma.course.findUnique).mockResolvedValue(mockCourse as any);

      await expect(courseService.publishCourse(1, 99, false)).rejects.toThrow(AppError);
      await expect(courseService.publishCourse(1, 99, false)).rejects.toThrow('Not authorized');
    });

    it('should throw 400 when course has no content', async () => {
      const emptyCourse = {
        ...mockCourse,
        status: 'draft',
        modules: [],
      };
      vi.mocked(prisma.course.findUnique).mockResolvedValue(emptyCourse as any);

      await expect(courseService.publishCourse(1, 10)).rejects.toThrow(AppError);
      await expect(courseService.publishCourse(1, 10)).rejects.toThrow('at least one lecture');
    });

    it('should throw 400 when modules have no lectures', async () => {
      const courseWithEmptyModule = {
        ...mockCourse,
        status: 'draft',
        modules: [{ id: 1, lectures: [] }],
      };
      vi.mocked(prisma.course.findUnique).mockResolvedValue(courseWithEmptyModule as any);

      await expect(courseService.publishCourse(1, 10)).rejects.toThrow(AppError);
    });
  });

  // ===========================================================================
  // unpublishCourse
  // ===========================================================================

  describe('unpublishCourse', () => {
    it('should unpublish course as owner', async () => {
      vi.mocked(prisma.course.findUnique).mockResolvedValue(mockCourse as any);
      vi.mocked(prisma.course.update).mockResolvedValue({
        ...mockCourse,
        status: 'draft',
      } as any);

      const course = await courseService.unpublishCourse(1, 10);

      expect(prisma.course.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { status: 'draft' },
      });
    });

    it('should throw 404 when course not found', async () => {
      vi.mocked(prisma.course.findUnique).mockResolvedValue(null);

      await expect(courseService.unpublishCourse(999, 10)).rejects.toThrow(AppError);
    });

    it('should throw 403 when not authorized', async () => {
      vi.mocked(prisma.course.findUnique).mockResolvedValue(mockCourse as any);

      await expect(courseService.unpublishCourse(1, 99, false)).rejects.toThrow(AppError);
      await expect(courseService.unpublishCourse(1, 99, false)).rejects.toThrow('Not authorized');
    });
  });

  // ===========================================================================
  // getInstructorCourses
  // ===========================================================================

  describe('getInstructorCourses', () => {
    it('should return instructor courses', async () => {
      vi.mocked(prisma.course.findMany).mockResolvedValue([mockCourse] as any);

      const courses = await courseService.getInstructorCourses(10);

      expect(courses).toHaveLength(1);
      expect(prisma.course.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { instructorId: 10 },
        })
      );
    });

    it('should return all courses for admin', async () => {
      vi.mocked(prisma.course.findMany).mockResolvedValue([mockCourse] as any);

      await courseService.getInstructorCourses(99, true);

      expect(prisma.course.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {},
        })
      );
    });
  });

  // ===========================================================================
  // getCourseStudents
  // ===========================================================================

  describe('getCourseStudents', () => {
    const mockEnrollments = [
      {
        id: 1,
        userId: 20,
        courseId: 1,
        enrolledAt: new Date(),
        user: { id: 20, fullname: 'Student One', email: 'student1@test.com' },
      },
    ];

    it('should return enrolled students as instructor', async () => {
      vi.mocked(prisma.course.findUnique).mockResolvedValue(mockCourse as any);
      vi.mocked(prisma.enrollment.findMany).mockResolvedValue(mockEnrollments as any);

      const students = await courseService.getCourseStudents(1, 10);

      expect(students).toHaveLength(1);
      expect(students[0].user.fullname).toBe('Student One');
    });

    it('should return enrolled students as admin', async () => {
      vi.mocked(prisma.course.findUnique).mockResolvedValue(mockCourse as any);
      vi.mocked(prisma.enrollment.findMany).mockResolvedValue(mockEnrollments as any);

      const students = await courseService.getCourseStudents(1, 99, true);

      expect(students).toHaveLength(1);
    });

    it('should throw 404 when course not found', async () => {
      vi.mocked(prisma.course.findUnique).mockResolvedValue(null);

      await expect(courseService.getCourseStudents(999, 10)).rejects.toThrow(AppError);
      await expect(courseService.getCourseStudents(999, 10)).rejects.toThrow('Course not found');
    });

    it('should throw 403 when not authorized', async () => {
      vi.mocked(prisma.course.findUnique).mockResolvedValue(mockCourse as any);

      await expect(courseService.getCourseStudents(1, 99, false)).rejects.toThrow(AppError);
      await expect(courseService.getCourseStudents(1, 99, false)).rejects.toThrow('Not authorized');
    });
  });

  // ===========================================================================
  // updateAISettings
  // ===========================================================================

  describe('updateAISettings', () => {
    it('should update AI settings as owner', async () => {
      vi.mocked(prisma.course.findUnique).mockResolvedValue(mockCourse as any);
      vi.mocked(prisma.course.update).mockResolvedValue({
        ...mockCourse,
        collaborativeModuleEnabled: true,
      } as any);

      const course = await courseService.updateAISettings(1, 10, {
        collaborativeModuleEnabled: true,
        tutorRoutingMode: 'smart',
      });

      expect(prisma.course.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: expect.objectContaining({
          collaborativeModuleEnabled: true,
          tutorRoutingMode: 'smart',
        }),
      });
    });

    it('should update AI settings as admin', async () => {
      vi.mocked(prisma.course.findUnique).mockResolvedValue(mockCourse as any);
      vi.mocked(prisma.course.update).mockResolvedValue(mockCourse as any);

      await courseService.updateAISettings(1, 99, {
        emotionalPulseEnabled: true,
      }, true);

      expect(prisma.course.update).toHaveBeenCalled();
    });

    it('should throw 404 when course not found', async () => {
      vi.mocked(prisma.course.findUnique).mockResolvedValue(null);

      await expect(
        courseService.updateAISettings(999, 10, { collaborativeModuleEnabled: true })
      ).rejects.toThrow(AppError);
      await expect(
        courseService.updateAISettings(999, 10, { collaborativeModuleEnabled: true })
      ).rejects.toThrow('Course not found');
    });

    it('should throw 403 when not authorized', async () => {
      vi.mocked(prisma.course.findUnique).mockResolvedValue(mockCourse as any);

      await expect(
        courseService.updateAISettings(1, 99, { collaborativeModuleEnabled: true }, false)
      ).rejects.toThrow(AppError);
      await expect(
        courseService.updateAISettings(1, 99, { collaborativeModuleEnabled: true }, false)
      ).rejects.toThrow('Not authorized');
    });

    it('should only update provided fields', async () => {
      vi.mocked(prisma.course.findUnique).mockResolvedValue(mockCourse as any);
      vi.mocked(prisma.course.update).mockResolvedValue(mockCourse as any);

      await courseService.updateAISettings(1, 10, {
        tutorRoutingMode: 'collaborative',
      });

      expect(prisma.course.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: {
          tutorRoutingMode: 'collaborative',
        },
      });
    });

    it('should allow setting default tutor', async () => {
      vi.mocked(prisma.course.findUnique).mockResolvedValue(mockCourse as any);
      vi.mocked(prisma.course.update).mockResolvedValue(mockCourse as any);

      await courseService.updateAISettings(1, 10, {
        defaultTutorId: 5,
        tutorRoutingMode: 'single',
      });

      expect(prisma.course.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: expect.objectContaining({
          defaultTutorId: 5,
          tutorRoutingMode: 'single',
        }),
      });
    });

    it('should allow clearing default tutor', async () => {
      vi.mocked(prisma.course.findUnique).mockResolvedValue(mockCourse as any);
      vi.mocked(prisma.course.update).mockResolvedValue(mockCourse as any);

      await courseService.updateAISettings(1, 10, {
        defaultTutorId: null,
      });

      expect(prisma.course.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: {
          defaultTutorId: null,
        },
      });
    });
  });

  // ===========================================================================
  // getCourseBySlugWithOwnerCheck
  // ===========================================================================

  describe('getCourseBySlugWithOwnerCheck', () => {
    it('should allow admin to see unpublished course by slug', async () => {
      const draftCourse = { ...mockCourse, status: 'draft' };
      vi.mocked(prisma.course.findUnique).mockResolvedValue(draftCourse as any);

      const course = await courseService.getCourseBySlugWithOwnerCheck(
        'introduction-to-programming-abc123',
        99,
        true,
        false
      );

      expect(course).toBeDefined();
    });

    it('should allow instructor to see own unpublished course by slug', async () => {
      const draftCourse = { ...mockCourse, status: 'draft' };
      vi.mocked(prisma.course.findUnique).mockResolvedValue(draftCourse as any);

      const course = await courseService.getCourseBySlugWithOwnerCheck(
        'introduction-to-programming-abc123',
        10,
        false,
        true
      );

      expect(course).toBeDefined();
    });

    it('should throw 404 for student accessing unpublished course by slug', async () => {
      const draftCourse = { ...mockCourse, status: 'draft' };
      vi.mocked(prisma.course.findUnique).mockResolvedValue(draftCourse as any);

      await expect(
        courseService.getCourseBySlugWithOwnerCheck('test-slug', 20, false, false)
      ).rejects.toThrow(AppError);
      await expect(
        courseService.getCourseBySlugWithOwnerCheck('test-slug', 20, false, false)
      ).rejects.toThrow('Course not found');
    });
  });
});
