import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import express from 'express';
import request from 'supertest';

// Mock services and middleware
vi.mock('../services/enrollment.service.js', () => ({
  enrollmentService: {
    getMyEnrollments: vi.fn(),
    getEnrollment: vi.fn(),
    enroll: vi.fn(),
    unenroll: vi.fn(),
    getProgress: vi.fn(),
    markLectureComplete: vi.fn(),
    updateLectureTime: vi.fn(),
  },
}));

vi.mock('../middleware/auth.middleware.js', () => ({
  authenticateToken: (req: any, res: any, next: any) => {
    req.user = { id: 1, email: 'test@test.com', fullname: 'Test User', isAdmin: false, isInstructor: false };
    next();
  },
}));

import { enrollmentService } from '../services/enrollment.service.js';
import enrollmentRoutes from './enrollment.routes.js';

describe('Enrollment Routes', () => {
  let app: express.Application;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api/enrollments', enrollmentRoutes);

    // Error handler
    app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
      const statusCode = err.statusCode || 500;
      res.status(statusCode).json({
        success: false,
        error: err.message || 'Internal server error',
      });
    });

    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ===========================================================================
  // GET /api/enrollments
  // ===========================================================================

  describe('GET /api/enrollments', () => {
    it('should return user enrollments', async () => {
      const mockEnrollments = [
        { id: 1, courseId: 1, status: 'active', course: { title: 'Course 1' } },
        { id: 2, courseId: 2, status: 'completed', course: { title: 'Course 2' } },
      ];
      vi.mocked(enrollmentService.getMyEnrollments).mockResolvedValue(mockEnrollments as any);

      const response = await request(app)
        .get('/api/enrollments')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(2);
      expect(enrollmentService.getMyEnrollments).toHaveBeenCalledWith(1);
    });
  });

  // ===========================================================================
  // GET /api/enrollments/course/:courseId
  // ===========================================================================

  describe('GET /api/enrollments/course/:courseId', () => {
    it('should return enrollment for specific course', async () => {
      const mockEnrollment = {
        id: 1,
        courseId: 5,
        userId: 1,
        status: 'active',
        progress: 50,
      };
      vi.mocked(enrollmentService.getEnrollment).mockResolvedValue(mockEnrollment as any);

      const response = await request(app)
        .get('/api/enrollments/course/5')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.enrolled).toBe(true);
      expect(response.body.data.courseId).toBe(5);
      expect(enrollmentService.getEnrollment).toHaveBeenCalledWith(1, 5);
    });

    it('should return enrolled false when not enrolled', async () => {
      vi.mocked(enrollmentService.getEnrollment).mockResolvedValue(null);

      const response = await request(app)
        .get('/api/enrollments/course/5')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.enrolled).toBe(false);
      expect(response.body.data).toBeNull();
    });
  });

  // ===========================================================================
  // POST /api/enrollments
  // ===========================================================================

  describe('POST /api/enrollments', () => {
    it('should enroll in course', async () => {
      const mockEnrollment = {
        id: 1,
        courseId: 5,
        userId: 1,
        status: 'active',
        enrolledAt: new Date(),
      };
      vi.mocked(enrollmentService.enroll).mockResolvedValue(mockEnrollment as any);

      const response = await request(app)
        .post('/api/enrollments')
        .send({ courseId: 5 })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.courseId).toBe(5);
      expect(enrollmentService.enroll).toHaveBeenCalledWith(1, 5);
    });

    it('should return 400 when courseId is missing', async () => {
      const response = await request(app)
        .post('/api/enrollments')
        .send({})
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Course ID is required');
    });
  });

  // ===========================================================================
  // DELETE /api/enrollments/course/:courseId
  // ===========================================================================

  describe('DELETE /api/enrollments/course/:courseId', () => {
    it('should unenroll from course', async () => {
      vi.mocked(enrollmentService.unenroll).mockResolvedValue({
        message: 'Unenrolled successfully',
      });

      const response = await request(app)
        .delete('/api/enrollments/course/5')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Unenrolled successfully');
      expect(enrollmentService.unenroll).toHaveBeenCalledWith(1, 5);
    });
  });

  // ===========================================================================
  // GET /api/enrollments/course/:courseId/progress
  // ===========================================================================

  describe('GET /api/enrollments/course/:courseId/progress', () => {
    it('should return course progress', async () => {
      const mockProgress = {
        completedLectures: 5,
        totalLectures: 10,
        percentage: 50,
        timeSpent: 3600,
      };
      vi.mocked(enrollmentService.getProgress).mockResolvedValue(mockProgress as any);

      const response = await request(app)
        .get('/api/enrollments/course/5/progress')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.percentage).toBe(50);
      expect(enrollmentService.getProgress).toHaveBeenCalledWith(1, 5);
    });
  });

  // ===========================================================================
  // POST /api/enrollments/course/:courseId/lectures/:lectureId/complete
  // ===========================================================================

  describe('POST /api/enrollments/course/:courseId/lectures/:lectureId/complete', () => {
    it('should mark lecture as complete', async () => {
      const mockProgress = {
        lectureId: 10,
        completed: true,
        completedAt: new Date(),
      };
      vi.mocked(enrollmentService.markLectureComplete).mockResolvedValue(mockProgress as any);

      const response = await request(app)
        .post('/api/enrollments/course/5/lectures/10/complete')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.completed).toBe(true);
      expect(enrollmentService.markLectureComplete).toHaveBeenCalledWith(1, 5, 10);
    });
  });

  // ===========================================================================
  // POST /api/enrollments/course/:courseId/lectures/:lectureId/time
  // ===========================================================================

  describe('POST /api/enrollments/course/:courseId/lectures/:lectureId/time', () => {
    it('should update lecture time spent', async () => {
      const mockProgress = {
        lectureId: 10,
        timeSpent: 600,
      };
      vi.mocked(enrollmentService.updateLectureTime).mockResolvedValue(mockProgress as any);

      const response = await request(app)
        .post('/api/enrollments/course/5/lectures/10/time')
        .send({ timeSpent: 300 })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(enrollmentService.updateLectureTime).toHaveBeenCalledWith(1, 5, 10, 300);
    });

    it('should return 400 for invalid timeSpent', async () => {
      const response = await request(app)
        .post('/api/enrollments/course/5/lectures/10/time')
        .send({ timeSpent: 'invalid' })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Valid time spent is required');
    });

    it('should return 400 for negative timeSpent', async () => {
      const response = await request(app)
        .post('/api/enrollments/course/5/lectures/10/time')
        .send({ timeSpent: -100 })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Valid time spent is required');
    });
  });
});
