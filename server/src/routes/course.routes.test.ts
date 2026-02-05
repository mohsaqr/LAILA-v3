import { describe, it, expect, vi, beforeEach, afterEach, beforeAll } from 'vitest';
import express from 'express';
import request from 'supertest';
import { ZodError } from 'zod';
import { courseService } from '../services/course.service.js';
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

// Import routes after mocks
import courseRoutes from './course.routes.js';

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
});
