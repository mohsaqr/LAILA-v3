import { describe, it, expect, vi, beforeEach, afterEach, beforeAll } from 'vitest';
import express from 'express';
import request from 'supertest';
import { ZodError } from 'zod';
import { AppError } from '../middleware/error.middleware.js';

// Mock services
vi.mock('../services/course.service.js', () => ({
  courseService: {
    getCourses: vi.fn(),
    getInstructorCourses: vi.fn(),
    getCourseById: vi.fn(),
    getCourseByIdWithOwnerCheck: vi.fn(),
    getCourseBySlugWithOwnerCheck: vi.fn(),
    createCourse: vi.fn(),
    updateCourse: vi.fn(),
    deleteCourse: vi.fn(),
    publishCourse: vi.fn(),
    unpublishCourse: vi.fn(),
    getCourseStudents: vi.fn(),
    updateAISettings: vi.fn(),
  },
}));

vi.mock('../services/module.service.js', () => ({
  moduleService: {
    getModules: vi.fn(),
    createModule: vi.fn(),
    updateModule: vi.fn(),
    deleteModule: vi.fn(),
    reorderModules: vi.fn(),
  },
}));

vi.mock('../services/lecture.service.js', () => ({
  lectureService: {
    getLecturesWithAccessCheck: vi.fn(),
    getLectureById: vi.fn(),
    getLectureByIdWithAccessCheck: vi.fn(),
    createLecture: vi.fn(),
    updateLecture: vi.fn(),
    deleteLecture: vi.fn(),
    reorderLectures: vi.fn(),
    addAttachment: vi.fn(),
    deleteAttachment: vi.fn(),
  },
}));

vi.mock('../services/section.service.js', () => ({
  sectionService: {
    getSections: vi.fn(),
    createSection: vi.fn(),
    updateSection: vi.fn(),
    deleteSection: vi.fn(),
    reorderSections: vi.fn(),
    generateAIContent: vi.fn(),
    getCourseAssignmentsForSection: vi.fn(),
  },
}));

vi.mock('../services/chatbotConversation.service.js', () => ({
  chatbotConversationService: {
    sendMessage: vi.fn(),
    getConversationHistory: vi.fn(),
    clearConversation: vi.fn(),
    getChatbotSectionsForCourse: vi.fn(),
    getChatbotAnalytics: vi.fn(),
    getConversationsForSection: vi.fn(),
    getConversationMessagesForInstructor: vi.fn(),
  },
}));

vi.mock('../services/lectureAIHelper.service.js', () => ({
  lectureAIHelperService: {
    chat: vi.fn(),
    getSessions: vi.fn(),
    getChatHistory: vi.fn(),
    getPdfInfo: vi.fn(),
    createExplainThread: vi.fn(),
    getExplainThreads: vi.fn(),
    getExplainThread: vi.fn(),
    addFollowUp: vi.fn(),
  },
}));

// Track current user for tests
let currentUser = { id: 1, email: 'test@example.com', isAdmin: false, isInstructor: true };

// Mock auth middleware
vi.mock('../middleware/auth.middleware.js', () => ({
  authenticateToken: vi.fn((req, _res, next) => {
    req.user = currentUser;
    next();
  }),
  requireInstructor: vi.fn((req, res, next) => {
    if (!req.user?.isInstructor && !req.user?.isAdmin) {
      return res.status(403).json({ success: false, error: 'Instructor access required' });
    }
    next();
  }),
  optionalAuth: vi.fn((req, _res, next) => {
    req.user = currentUser;
    next();
  }),
}));

// Import routes and services after mocks
import courseRoutes from './course.routes.js';
import { courseService } from '../services/course.service.js';
import { moduleService } from '../services/module.service.js';
import { lectureService } from '../services/lecture.service.js';
import { sectionService } from '../services/section.service.js';
import { chatbotConversationService } from '../services/chatbotConversation.service.js';
import { lectureAIHelperService } from '../services/lectureAIHelper.service.js';

describe('Course Routes', () => {
  let app: express.Express;

  beforeAll(() => {
    app = express();
    app.use(express.json());
    app.use('/api/courses', courseRoutes);

    // Error handler
    app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
      // Handle Zod validation errors
      if (err instanceof ZodError) {
        return res.status(400).json({
          success: false,
          error: err.errors.map(e => e.message).join(', '),
        });
      }
      const statusCode = err.statusCode || 500;
      res.status(statusCode).json({
        success: false,
        error: err.message || 'Internal server error',
      });
    });
  });

  beforeEach(() => {
    vi.clearAllMocks();
    currentUser = { id: 1, email: 'test@example.com', isAdmin: false, isInstructor: true };
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ===========================================================================
  // GET /api/courses (Course Catalog)
  // ===========================================================================

  describe('GET /api/courses', () => {
    it('should return paginated courses', async () => {
      const mockResult = {
        data: [
          { id: 1, title: 'Course 1', slug: 'course-1' },
          { id: 2, title: 'Course 2', slug: 'course-2' },
        ],
        pagination: { page: 1, limit: 10, total: 2, totalPages: 1 },
      };
      vi.mocked(courseService.getCourses).mockResolvedValue(mockResult);

      const response = await request(app)
        .get('/api/courses')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(2);
      expect(courseService.getCourses).toHaveBeenCalledWith(
        expect.objectContaining({}),
        1,
        10
      );
    });

    it('should support pagination parameters', async () => {
      vi.mocked(courseService.getCourses).mockResolvedValue({
        data: [],
        pagination: { page: 2, limit: 5, total: 0, totalPages: 0 },
      });

      await request(app)
        .get('/api/courses?page=2&limit=5')
        .expect(200);

      expect(courseService.getCourses).toHaveBeenCalledWith(
        expect.any(Object),
        2,
        5
      );
    });

    it('should support filter parameters', async () => {
      vi.mocked(courseService.getCourses).mockResolvedValue({
        data: [],
        pagination: { page: 1, limit: 10, total: 0, totalPages: 0 },
      });

      await request(app)
        .get('/api/courses?category=programming&difficulty=beginner&search=python')
        .expect(200);

      expect(courseService.getCourses).toHaveBeenCalledWith(
        {
          category: 'programming',
          difficulty: 'beginner',
          search: 'python',
        },
        1,
        10
      );
    });
  });

  // ===========================================================================
  // GET /api/courses/my-courses (Instructor's courses)
  // ===========================================================================

  describe('GET /api/courses/my-courses', () => {
    it('should return instructor courses', async () => {
      const mockCourses = [
        { id: 1, title: 'My Course 1', instructorId: 1 },
        { id: 2, title: 'My Course 2', instructorId: 1 },
      ];
      vi.mocked(courseService.getInstructorCourses).mockResolvedValue(mockCourses as any);

      const response = await request(app)
        .get('/api/courses/my-courses')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(2);
      expect(courseService.getInstructorCourses).toHaveBeenCalledWith(1, false);
    });

    it('should return all courses for admin', async () => {
      currentUser = { id: 1, email: 'admin@example.com', isAdmin: true, isInstructor: true };
      vi.mocked(courseService.getInstructorCourses).mockResolvedValue([]);

      await request(app)
        .get('/api/courses/my-courses')
        .expect(200);

      expect(courseService.getInstructorCourses).toHaveBeenCalledWith(1, true);
    });
  });

  // ===========================================================================
  // GET /api/courses/:id
  // ===========================================================================

  describe('GET /api/courses/:id', () => {
    it('should return course by ID', async () => {
      const mockCourse = {
        id: 1,
        title: 'Test Course',
        description: 'A test course',
        instructorId: 1,
      };
      vi.mocked(courseService.getCourseByIdWithOwnerCheck).mockResolvedValue(mockCourse as any);

      const response = await request(app)
        .get('/api/courses/1')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.title).toBe('Test Course');
      expect(courseService.getCourseByIdWithOwnerCheck).toHaveBeenCalledWith(1, 1, false, true);
    });

    it('should return 404 for non-existent course', async () => {
      vi.mocked(courseService.getCourseByIdWithOwnerCheck).mockRejectedValue(
        new AppError('Course not found', 404)
      );

      const response = await request(app)
        .get('/api/courses/999')
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Course not found');
    });
  });

  // ===========================================================================
  // GET /api/courses/slug/:slug
  // ===========================================================================

  describe('GET /api/courses/slug/:slug', () => {
    it('should return course by slug', async () => {
      const mockCourse = {
        id: 1,
        title: 'Test Course',
        slug: 'test-course',
      };
      vi.mocked(courseService.getCourseBySlugWithOwnerCheck).mockResolvedValue(mockCourse as any);

      const response = await request(app)
        .get('/api/courses/slug/test-course')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.slug).toBe('test-course');
    });

    it('should return 404 for non-existent slug', async () => {
      vi.mocked(courseService.getCourseBySlugWithOwnerCheck).mockRejectedValue(
        new AppError('Course not found', 404)
      );

      const response = await request(app)
        .get('/api/courses/slug/nonexistent')
        .expect(404);

      expect(response.body.success).toBe(false);
    });
  });

  // ===========================================================================
  // POST /api/courses (Create Course)
  // ===========================================================================

  describe('POST /api/courses', () => {
    const validCourse = {
      title: 'New Course',
      description: 'A new course description',
      category: 'programming',
      difficulty: 'beginner',
    };

    it('should create course as instructor', async () => {
      const mockCourse = { id: 1, ...validCourse, instructorId: 1 };
      vi.mocked(courseService.createCourse).mockResolvedValue(mockCourse as any);

      const response = await request(app)
        .post('/api/courses')
        .send(validCourse)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.title).toBe('New Course');
      expect(courseService.createCourse).toHaveBeenCalledWith(1, validCourse);
    });

    it('should return 400 for missing title', async () => {
      const response = await request(app)
        .post('/api/courses')
        .send({ description: 'No title' })
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it('should reject non-instructor', async () => {
      currentUser = { id: 1, email: 'student@example.com', isAdmin: false, isInstructor: false };

      const response = await request(app)
        .post('/api/courses')
        .send(validCourse)
        .expect(403);

      expect(response.body.success).toBe(false);
    });
  });

  // ===========================================================================
  // PUT /api/courses/:id (Update Course)
  // ===========================================================================

  describe('PUT /api/courses/:id', () => {
    const updateData = {
      title: 'Updated Course Title',
      description: 'Updated description',
    };

    it('should update course as owner', async () => {
      const mockCourse = { id: 1, ...updateData, instructorId: 1 };
      vi.mocked(courseService.updateCourse).mockResolvedValue(mockCourse as any);

      const response = await request(app)
        .put('/api/courses/1')
        .send(updateData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.title).toBe('Updated Course Title');
      expect(courseService.updateCourse).toHaveBeenCalledWith(1, 1, updateData, false);
    });

    it('should return 403 for unauthorized update', async () => {
      vi.mocked(courseService.updateCourse).mockRejectedValue(
        new AppError('Not authorized to update this course', 403)
      );

      const response = await request(app)
        .put('/api/courses/1')
        .send(updateData)
        .expect(403);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Not authorized');
    });

    it('should update course as admin', async () => {
      currentUser = { id: 2, email: 'admin@example.com', isAdmin: true, isInstructor: true };
      vi.mocked(courseService.updateCourse).mockResolvedValue({ id: 1, ...updateData } as any);

      await request(app)
        .put('/api/courses/1')
        .send(updateData)
        .expect(200);

      expect(courseService.updateCourse).toHaveBeenCalledWith(1, 2, updateData, true);
    });
  });

  // ===========================================================================
  // DELETE /api/courses/:id
  // ===========================================================================

  describe('DELETE /api/courses/:id', () => {
    it('should delete course as owner', async () => {
      vi.mocked(courseService.deleteCourse).mockResolvedValue({ message: 'Course deleted' });

      const response = await request(app)
        .delete('/api/courses/1')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(courseService.deleteCourse).toHaveBeenCalledWith(1, 1, false);
    });

    it('should return 403 for unauthorized delete', async () => {
      vi.mocked(courseService.deleteCourse).mockRejectedValue(
        new AppError('Not authorized to delete this course', 403)
      );

      const response = await request(app)
        .delete('/api/courses/1')
        .expect(403);

      expect(response.body.success).toBe(false);
    });

    it('should return 404 for non-existent course', async () => {
      vi.mocked(courseService.deleteCourse).mockRejectedValue(
        new AppError('Course not found', 404)
      );

      const response = await request(app)
        .delete('/api/courses/999')
        .expect(404);

      expect(response.body.success).toBe(false);
    });
  });

  // ===========================================================================
  // POST /api/courses/:id/publish
  // ===========================================================================

  describe('POST /api/courses/:id/publish', () => {
    it('should publish course successfully', async () => {
      const mockCourse = { id: 1, title: 'Test', isPublished: true };
      vi.mocked(courseService.publishCourse).mockResolvedValue(mockCourse as any);

      const response = await request(app)
        .post('/api/courses/1/publish')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.isPublished).toBe(true);
    });

    it('should return 400 for course without content', async () => {
      vi.mocked(courseService.publishCourse).mockRejectedValue(
        new AppError('Course must have at least one lecture to publish', 400)
      );

      const response = await request(app)
        .post('/api/courses/1/publish')
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('at least one lecture');
    });

    it('should return 403 for unauthorized publish', async () => {
      vi.mocked(courseService.publishCourse).mockRejectedValue(
        new AppError('Not authorized', 403)
      );

      const response = await request(app)
        .post('/api/courses/1/publish')
        .expect(403);

      expect(response.body.success).toBe(false);
    });
  });

  // ===========================================================================
  // POST /api/courses/:id/unpublish
  // ===========================================================================

  describe('POST /api/courses/:id/unpublish', () => {
    it('should unpublish course successfully', async () => {
      const mockCourse = { id: 1, title: 'Test', isPublished: false };
      vi.mocked(courseService.unpublishCourse).mockResolvedValue(mockCourse as any);

      const response = await request(app)
        .post('/api/courses/1/unpublish')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.isPublished).toBe(false);
    });
  });

  // ===========================================================================
  // GET /api/courses/:id/students
  // ===========================================================================

  describe('GET /api/courses/:id/students', () => {
    it('should return enrolled students', async () => {
      const mockStudents = [
        { id: 1, fullname: 'Student 1', email: 'student1@example.com' },
        { id: 2, fullname: 'Student 2', email: 'student2@example.com' },
      ];
      vi.mocked(courseService.getCourseStudents).mockResolvedValue(mockStudents as any);

      const response = await request(app)
        .get('/api/courses/1/students')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(2);
    });

    it('should return 403 for unauthorized access', async () => {
      vi.mocked(courseService.getCourseStudents).mockRejectedValue(
        new AppError('Not authorized', 403)
      );

      const response = await request(app)
        .get('/api/courses/1/students')
        .expect(403);

      expect(response.body.success).toBe(false);
    });
  });

  // ===========================================================================
  // PUT /api/courses/:id/ai-settings
  // ===========================================================================

  describe('PUT /api/courses/:id/ai-settings', () => {
    const aiSettings = {
      tutorMode: 'collaborative',
      maxAgents: 3,
    };

    it('should update AI settings successfully', async () => {
      const mockCourse = { id: 1, title: 'Test', ...aiSettings };
      vi.mocked(courseService.updateAISettings).mockResolvedValue(mockCourse as any);

      const response = await request(app)
        .put('/api/courses/1/ai-settings')
        .send(aiSettings)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(courseService.updateAISettings).toHaveBeenCalledWith(1, 1, aiSettings, false);
    });

    it('should return 403 for unauthorized update', async () => {
      vi.mocked(courseService.updateAISettings).mockRejectedValue(
        new AppError('Not authorized', 403)
      );

      const response = await request(app)
        .put('/api/courses/1/ai-settings')
        .send(aiSettings)
        .expect(403);

      expect(response.body.success).toBe(false);
    });
  });

  // ==========================================================================
  // MODULE ENDPOINTS
  // ==========================================================================

  describe('GET /api/courses/:courseId/modules', () => {
    it('should return modules for course', async () => {
      const mockModules = [
        { id: 1, title: 'Module 1', orderIndex: 0 },
        { id: 2, title: 'Module 2', orderIndex: 1 },
      ];

      vi.mocked(moduleService.getModules).mockResolvedValue(mockModules as any);

      const response = await request(app)
        .get('/api/courses/1/modules')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(2);
    });
  });

  describe('POST /api/courses/:courseId/modules', () => {
    it('should create module as instructor', async () => {
      const mockModule = { id: 1, title: 'New Module', courseId: 1 };
      vi.mocked(moduleService.createModule).mockResolvedValue(mockModule as any);

      const response = await request(app)
        .post('/api/courses/1/modules')
        .send({ title: 'New Module' })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.title).toBe('New Module');
    });
  });

  describe('PUT /api/courses/modules/:moduleId', () => {
    it('should update module', async () => {
      const mockModule = { id: 1, title: 'Updated Module' };
      vi.mocked(moduleService.updateModule).mockResolvedValue(mockModule as any);

      const response = await request(app)
        .put('/api/courses/modules/1')
        .send({ title: 'Updated Module' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.title).toBe('Updated Module');
    });
  });

  describe('DELETE /api/courses/modules/:moduleId', () => {
    it('should delete module', async () => {
      vi.mocked(moduleService.deleteModule).mockResolvedValue(undefined);

      const response = await request(app)
        .delete('/api/courses/modules/1')
        .expect(200);

      expect(response.body.success).toBe(true);
    });
  });

  describe('PUT /api/courses/:courseId/modules/reorder', () => {
    it('should reorder modules', async () => {
      vi.mocked(moduleService.reorderModules).mockResolvedValue(undefined);

      const response = await request(app)
        .put('/api/courses/1/modules/reorder')
        .send({ moduleIds: [2, 1, 3] })
        .expect(200);

      expect(response.body.success).toBe(true);
    });
  });

  // ==========================================================================
  // LECTURE ENDPOINTS
  // ==========================================================================

  describe('GET /api/courses/modules/:moduleId/lectures', () => {
    it('should return lectures for module', async () => {
      const mockLectures = [
        { id: 1, title: 'Lecture 1', orderIndex: 0 },
        { id: 2, title: 'Lecture 2', orderIndex: 1 },
      ];

      vi.mocked(lectureService.getLecturesWithAccessCheck).mockResolvedValue(mockLectures as any);

      const response = await request(app)
        .get('/api/courses/modules/1/lectures')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(2);
    });
  });

  describe('GET /api/courses/lectures/:lectureId', () => {
    it('should return lecture by ID', async () => {
      const mockLecture = { id: 1, title: 'Lecture 1', moduleId: 1 };
      vi.mocked(lectureService.getLectureById).mockResolvedValue(mockLecture as any);

      const response = await request(app)
        .get('/api/courses/lectures/1')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.title).toBe('Lecture 1');
    });
  });

  describe('POST /api/courses/modules/:moduleId/lectures', () => {
    it('should create lecture as instructor', async () => {
      const mockLecture = { id: 1, title: 'New Lecture', moduleId: 1 };
      vi.mocked(lectureService.createLecture).mockResolvedValue(mockLecture as any);

      const response = await request(app)
        .post('/api/courses/modules/1/lectures')
        .send({ title: 'New Lecture' })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.title).toBe('New Lecture');
    });
  });

  describe('PUT /api/courses/lectures/:lectureId', () => {
    it('should update lecture', async () => {
      const mockLecture = { id: 1, title: 'Updated Lecture' };
      vi.mocked(lectureService.updateLecture).mockResolvedValue(mockLecture as any);

      const response = await request(app)
        .put('/api/courses/lectures/1')
        .send({ title: 'Updated Lecture' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.title).toBe('Updated Lecture');
    });
  });

  describe('DELETE /api/courses/lectures/:lectureId', () => {
    it('should delete lecture', async () => {
      vi.mocked(lectureService.deleteLecture).mockResolvedValue(undefined);

      const response = await request(app)
        .delete('/api/courses/lectures/1')
        .expect(200);

      expect(response.body.success).toBe(true);
    });
  });

  describe('PUT /api/courses/modules/:moduleId/lectures/reorder', () => {
    it('should reorder lectures', async () => {
      vi.mocked(lectureService.reorderLectures).mockResolvedValue(undefined);

      const response = await request(app)
        .put('/api/courses/modules/1/lectures/reorder')
        .send({ lectureIds: [2, 1, 3] })
        .expect(200);

      expect(response.body.success).toBe(true);
    });
  });

  // ==========================================================================
  // SECTION ENDPOINTS
  // ==========================================================================

  describe('GET /api/courses/lectures/:lectureId/sections', () => {
    it('should return sections for lecture', async () => {
      const mockSections = [
        { id: 1, title: 'Section 1', order: 0 },
        { id: 2, title: 'Section 2', order: 1 },
      ];

      vi.mocked(sectionService.getSections).mockResolvedValue(mockSections as any);

      const response = await request(app)
        .get('/api/courses/lectures/1/sections')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(2);
    });
  });

  describe('POST /api/courses/lectures/:lectureId/sections', () => {
    it('should create section as instructor', async () => {
      const mockSection = { id: 1, title: 'New Section', lectureId: 1 };
      vi.mocked(sectionService.createSection).mockResolvedValue(mockSection as any);

      const response = await request(app)
        .post('/api/courses/lectures/1/sections')
        .send({ title: 'New Section', type: 'text', content: 'Content' })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.title).toBe('New Section');
    });
  });

  describe('PUT /api/courses/sections/:sectionId', () => {
    it('should update section', async () => {
      const mockSection = { id: 1, title: 'Updated Section' };
      vi.mocked(sectionService.updateSection).mockResolvedValue(mockSection as any);

      const response = await request(app)
        .put('/api/courses/sections/1')
        .send({ title: 'Updated Section' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.title).toBe('Updated Section');
    });
  });

  describe('DELETE /api/courses/sections/:sectionId', () => {
    it('should delete section', async () => {
      vi.mocked(sectionService.deleteSection).mockResolvedValue(undefined);

      const response = await request(app)
        .delete('/api/courses/sections/1')
        .expect(200);

      expect(response.body.success).toBe(true);
    });
  });

  describe('PUT /api/courses/lectures/:lectureId/sections/reorder', () => {
    it('should reorder sections', async () => {
      vi.mocked(sectionService.reorderSections).mockResolvedValue(undefined);

      const response = await request(app)
        .put('/api/courses/lectures/1/sections/reorder')
        .send({ sectionIds: [2, 1, 3] })
        .expect(200);

      expect(response.body.success).toBe(true);
    });
  });

  // ==========================================================================
  // ATTACHMENT ENDPOINTS
  // ==========================================================================

  describe('POST /api/courses/lectures/:lectureId/attachments', () => {
    it('should add attachment to lecture', async () => {
      const mockAttachment = { id: 1, lectureId: 1, filename: 'file.pdf', url: '/uploads/file.pdf' };
      vi.mocked(lectureService.addAttachment).mockResolvedValue(mockAttachment as any);

      const response = await request(app)
        .post('/api/courses/lectures/1/attachments')
        .send({ filename: 'file.pdf', url: '/uploads/file.pdf' })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.filename).toBe('file.pdf');
    });

    it('should return 403 for non-instructor', async () => {
      currentUser = { id: 1, email: 'student@example.com', isAdmin: false, isInstructor: false };

      const response = await request(app)
        .post('/api/courses/lectures/1/attachments')
        .send({ filename: 'file.pdf', url: '/uploads/file.pdf' })
        .expect(403);

      expect(response.body.success).toBe(false);
    });
  });

  describe('DELETE /api/courses/attachments/:attachmentId', () => {
    it('should delete attachment', async () => {
      vi.mocked(lectureService.deleteAttachment).mockResolvedValue({ deleted: true } as any);

      const response = await request(app)
        .delete('/api/courses/attachments/1')
        .expect(200);

      expect(response.body.success).toBe(true);
    });
  });

  // ==========================================================================
  // AI CONTENT GENERATION
  // ==========================================================================

  describe('POST /api/courses/sections/generate', () => {
    it('should generate AI content', async () => {
      vi.mocked(sectionService.generateAIContent).mockResolvedValue('Generated content here');

      const response = await request(app)
        .post('/api/courses/sections/generate')
        .send({ prompt: 'Write about JavaScript', context: 'Programming course' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.content).toBe('Generated content here');
    });

    it('should return 403 for non-instructor', async () => {
      currentUser = { id: 1, email: 'student@example.com', isAdmin: false, isInstructor: false };

      const response = await request(app)
        .post('/api/courses/sections/generate')
        .send({ prompt: 'Write about JavaScript', context: 'Programming course' })
        .expect(403);

      expect(response.body.success).toBe(false);
    });
  });

  // ==========================================================================
  // ASSIGNMENTS LIST FOR SECTION
  // ==========================================================================

  describe('GET /api/courses/:courseId/assignments/list', () => {
    it('should return assignments list for section', async () => {
      const mockAssignments = [
        { id: 1, title: 'Assignment 1' },
        { id: 2, title: 'Assignment 2' },
      ];
      vi.mocked(sectionService.getCourseAssignmentsForSection).mockResolvedValue(mockAssignments as any);

      const response = await request(app)
        .get('/api/courses/1/assignments/list')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(2);
    });
  });

  // ==========================================================================
  // CHATBOT CONVERSATION ENDPOINTS (Student)
  // ==========================================================================

  describe('POST /api/courses/sections/:sectionId/chat', () => {
    it('should send message to chatbot section', async () => {
      const mockResult = { response: 'Hello, I can help you!', conversationId: 1 };
      vi.mocked(chatbotConversationService.sendMessage).mockResolvedValue(mockResult as any);

      const response = await request(app)
        .post('/api/courses/sections/1/chat')
        .send({ message: 'Hello' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.response).toBe('Hello, I can help you!');
    });

    it('should return 400 for missing message', async () => {
      const response = await request(app)
        .post('/api/courses/sections/1/chat')
        .send({})
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/courses/sections/:sectionId/chat/history', () => {
    it('should return conversation history', async () => {
      const mockHistory = [
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: 'Hi!' },
      ];
      vi.mocked(chatbotConversationService.getConversationHistory).mockResolvedValue(mockHistory as any);

      const response = await request(app)
        .get('/api/courses/sections/1/chat/history')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(2);
    });
  });

  describe('DELETE /api/courses/sections/:sectionId/chat', () => {
    it('should clear conversation history', async () => {
      vi.mocked(chatbotConversationService.clearConversation).mockResolvedValue({ cleared: true } as any);

      const response = await request(app)
        .delete('/api/courses/sections/1/chat')
        .expect(200);

      expect(response.body.success).toBe(true);
    });
  });

  // ==========================================================================
  // CHATBOT ANALYTICS (Instructor)
  // ==========================================================================

  describe('GET /api/courses/:courseId/chatbot-sections', () => {
    it('should return chatbot sections for course', async () => {
      const mockSections = [
        { id: 1, title: 'Chatbot 1', conversationCount: 5 },
        { id: 2, title: 'Chatbot 2', conversationCount: 3 },
      ];
      vi.mocked(chatbotConversationService.getChatbotSectionsForCourse).mockResolvedValue(mockSections as any);

      const response = await request(app)
        .get('/api/courses/1/chatbot-sections')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(2);
    });
  });

  describe('GET /api/courses/:courseId/chatbot-analytics', () => {
    it('should return chatbot analytics for course', async () => {
      const mockAnalytics = {
        totalConversations: 100,
        totalMessages: 500,
        averageMessagesPerConversation: 5,
      };
      vi.mocked(chatbotConversationService.getChatbotAnalytics).mockResolvedValue(mockAnalytics as any);

      const response = await request(app)
        .get('/api/courses/1/chatbot-analytics')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.totalConversations).toBe(100);
    });
  });

  describe('GET /api/courses/sections/:sectionId/conversations', () => {
    it('should return conversations for section with pagination', async () => {
      const mockResult = {
        conversations: [
          { id: 1, userId: 1 },
          { id: 2, userId: 2 },
        ],
        total: 10,
        page: 1,
        limit: 20,
      };
      vi.mocked(chatbotConversationService.getConversationsForSection).mockResolvedValue(mockResult as any);

      const response = await request(app)
        .get('/api/courses/sections/1/conversations?page=1&limit=20')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.conversations).toHaveLength(2);
    });
  });

  describe('GET /api/courses/chatbot-conversations/:conversationId', () => {
    it('should return conversation messages for instructor', async () => {
      const mockResult = {
        conversation: { id: 1 },
        messages: [
          { role: 'user', content: 'Hello' },
          { role: 'assistant', content: 'Hi!' },
        ],
      };
      vi.mocked(chatbotConversationService.getConversationMessagesForInstructor).mockResolvedValue(mockResult as any);

      const response = await request(app)
        .get('/api/courses/chatbot-conversations/1')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.messages).toHaveLength(2);
    });
  });

  // ==========================================================================
  // LECTURE AI HELPER (Discuss mode)
  // ==========================================================================

  describe('POST /api/courses/lectures/:lectureId/ai-helper/chat', () => {
    it('should chat with AI helper', async () => {
      const mockResult = { response: 'Here is the explanation...', sessionId: 'sess-123' };
      vi.mocked(lectureAIHelperService.chat).mockResolvedValue(mockResult as any);

      const response = await request(app)
        .post('/api/courses/lectures/1/ai-helper/chat')
        .send({ mode: 'discuss', message: 'Explain this topic' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.response).toBe('Here is the explanation...');
    });

    it('should return 400 for invalid mode', async () => {
      const response = await request(app)
        .post('/api/courses/lectures/1/ai-helper/chat')
        .send({ mode: 'invalid', message: 'Hello' })
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/courses/lectures/:lectureId/ai-helper/sessions', () => {
    it('should return AI helper sessions', async () => {
      const mockSessions = [
        { id: 'sess-1', createdAt: new Date() },
        { id: 'sess-2', createdAt: new Date() },
      ];
      vi.mocked(lectureAIHelperService.getSessions).mockResolvedValue(mockSessions as any);

      const response = await request(app)
        .get('/api/courses/lectures/1/ai-helper/sessions')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(2);
    });
  });

  describe('GET /api/courses/lectures/:lectureId/ai-helper/history/:sessionId', () => {
    it('should return chat history for session', async () => {
      const mockHistory = [
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: 'Hi!' },
      ];
      vi.mocked(lectureAIHelperService.getChatHistory).mockResolvedValue(mockHistory as any);

      const response = await request(app)
        .get('/api/courses/lectures/1/ai-helper/history/sess-123')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(2);
    });
  });

  // ==========================================================================
  // LECTURE AI HELPER (Explain mode - Thread-based)
  // ==========================================================================

  describe('GET /api/courses/lectures/:lectureId/ai-helper/pdf-info', () => {
    it('should return PDF info for lecture', async () => {
      const mockPdfInfo = [
        { attachmentId: 1, filename: 'lecture.pdf', pageCount: 10 },
      ];
      vi.mocked(lectureAIHelperService.getPdfInfo).mockResolvedValue(mockPdfInfo as any);

      const response = await request(app)
        .get('/api/courses/lectures/1/ai-helper/pdf-info')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.pdfs).toHaveLength(1);
    });
  });

  describe('POST /api/courses/lectures/:lectureId/ai-helper/explain/threads', () => {
    it('should create explain thread', async () => {
      const mockThread = {
        id: 1,
        question: 'What is recursion?',
        answer: 'Recursion is...',
        createdAt: new Date(),
      };
      vi.mocked(lectureAIHelperService.createExplainThread).mockResolvedValue(mockThread as any);

      const response = await request(app)
        .post('/api/courses/lectures/1/ai-helper/explain/threads')
        .send({ question: 'What is recursion?' })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.question).toBe('What is recursion?');
    });

    it('should return 400 for missing question', async () => {
      const response = await request(app)
        .post('/api/courses/lectures/1/ai-helper/explain/threads')
        .send({})
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/courses/lectures/:lectureId/ai-helper/explain/threads', () => {
    it('should return explain threads for lecture', async () => {
      const mockThreads = [
        { id: 1, question: 'Q1', createdAt: new Date() },
        { id: 2, question: 'Q2', createdAt: new Date() },
      ];
      vi.mocked(lectureAIHelperService.getExplainThreads).mockResolvedValue(mockThreads as any);

      const response = await request(app)
        .get('/api/courses/lectures/1/ai-helper/explain/threads')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(2);
    });
  });

  describe('GET /api/courses/lectures/:lectureId/ai-helper/explain/threads/:threadId', () => {
    it('should return specific explain thread', async () => {
      const mockThread = {
        id: 1,
        question: 'What is recursion?',
        answer: 'Recursion is...',
        followUps: [],
      };
      vi.mocked(lectureAIHelperService.getExplainThread).mockResolvedValue(mockThread as any);

      const response = await request(app)
        .get('/api/courses/lectures/1/ai-helper/explain/threads/1')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe(1);
    });

    it('should return 404 for non-existent thread', async () => {
      vi.mocked(lectureAIHelperService.getExplainThread).mockRejectedValue(
        new AppError('Thread not found', 404)
      );

      const response = await request(app)
        .get('/api/courses/lectures/1/ai-helper/explain/threads/999')
        .expect(404);

      expect(response.body.success).toBe(false);
    });
  });

  // ===========================================================================
  // EXPLAIN THREAD FOLLOW-UP
  // ===========================================================================

  describe('POST /lectures/:lectureId/ai-helper/explain/threads/:threadId/follow-up', () => {
    it('should add follow-up to explain thread', async () => {
      const mockThread = {
        id: 1,
        lectureId: 1,
        userId: 1,
        topic: 'Machine Learning',
        initialQuestion: 'Explain ML',
        aiResponse: 'ML is...',
        followUps: [
          { id: 1, question: 'What about deep learning?', response: 'Deep learning is...' },
        ],
      };
      vi.mocked(lectureAIHelperService.addFollowUp).mockResolvedValue(mockThread as any);

      const response = await request(app)
        .post('/api/courses/lectures/1/ai-helper/explain/threads/1/follow-up')
        .send({ question: 'What about deep learning?' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.followUps).toHaveLength(1);
      expect(lectureAIHelperService.addFollowUp).toHaveBeenCalledWith(
        1, 1, 1, 'What about deep learning?', undefined, false, undefined
      );
    });

    it('should add follow-up with parentPostId', async () => {
      const mockThread = { id: 1, followUps: [] };
      vi.mocked(lectureAIHelperService.addFollowUp).mockResolvedValue(mockThread as any);

      await request(app)
        .post('/api/courses/lectures/1/ai-helper/explain/threads/1/follow-up')
        .send({ question: 'Follow-up question', parentPostId: 5 })
        .expect(200);

      expect(lectureAIHelperService.addFollowUp).toHaveBeenCalledWith(
        1, 1, 1, 'Follow-up question', 5, false, undefined
      );
    });

    it('should add follow-up with pdfPageRanges', async () => {
      const mockThread = { id: 1, followUps: [] };
      vi.mocked(lectureAIHelperService.addFollowUp).mockResolvedValue(mockThread as any);
      const pdfPageRanges = { 'doc1.pdf': '5-7' };

      await request(app)
        .post('/api/courses/lectures/1/ai-helper/explain/threads/1/follow-up')
        .send({ question: 'Explain page 5', pdfPageRanges })
        .expect(200);

      expect(lectureAIHelperService.addFollowUp).toHaveBeenCalledWith(
        1, 1, 1, 'Explain page 5', undefined, false, pdfPageRanges
      );
    });

    it('should return 400 for missing question', async () => {
      const response = await request(app)
        .post('/api/courses/lectures/1/ai-helper/explain/threads/1/follow-up')
        .send({})
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });
});
