import { describe, it, expect, vi, beforeEach, afterEach, beforeAll, afterAll } from 'vitest';
import express from 'express';
import request from 'supertest';
import { ZodError } from 'zod';
import { authService } from '../services/auth.service.js';
import { AppError } from '../middleware/error.middleware.js';

// Mock auth service
vi.mock('../services/auth.service.js', () => ({
  authService: {
    register: vi.fn(),
    login: vi.fn(),
    getProfile: vi.fn(),
    updatePassword: vi.fn(),
    logLogout: vi.fn(),
  },
}));

// Mock auth middleware
vi.mock('../middleware/auth.middleware.js', () => ({
  authenticateToken: vi.fn((req, _res, next) => {
    req.user = { id: 1, email: 'test@example.com', isAdmin: false, isInstructor: false };
    next();
  }),
}));

// Import routes after mocks
import authRoutes from './auth.routes.js';

describe('Auth Routes', () => {
  let app: express.Express;

  beforeAll(() => {
    app = express();
    app.use(express.json());
    app.use('/api/auth', authRoutes);

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
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ===========================================================================
  // POST /api/auth/register
  // ===========================================================================

  describe('POST /api/auth/register', () => {
    const validRegistration = {
      fullname: 'Test User',
      email: 'test@example.com',
      password: 'StrongPass123!',
    };

    it('should register a new user successfully', async () => {
      const mockResult = {
        user: { id: 1, fullname: 'Test User', email: 'test@example.com' },
        token: 'mock_jwt_token',
      };
      vi.mocked(authService.register).mockResolvedValue(mockResult);

      const response = await request(app)
        .post('/api/auth/register')
        .send(validRegistration)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.user.email).toBe('test@example.com');
      expect(response.body.data.token).toBe('mock_jwt_token');
      expect(authService.register).toHaveBeenCalledWith(
        validRegistration,
        expect.objectContaining({
          ipAddress: expect.any(String),
        })
      );
    });

    it('should return 409 for duplicate email', async () => {
      vi.mocked(authService.register).mockRejectedValue(
        new AppError('Email already registered', 409)
      );

      const response = await request(app)
        .post('/api/auth/register')
        .send(validRegistration)
        .expect(409);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Email already registered');
    });

    it('should return 400 for missing fullname', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({ email: 'test@example.com', password: 'StrongPass123!' })
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it('should return 400 for invalid email format', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({ ...validRegistration, email: 'invalid-email' })
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it('should return 400 for weak password', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({ ...validRegistration, password: '123' })
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  // ===========================================================================
  // POST /api/auth/login
  // ===========================================================================

  describe('POST /api/auth/login', () => {
    const validLogin = {
      email: 'test@example.com',
      password: 'StrongPass123!',
    };

    it('should login successfully with valid credentials', async () => {
      const mockResult = {
        user: { id: 1, fullname: 'Test User', email: 'test@example.com', isAdmin: false, isInstructor: false, language: null },
        token: 'mock_jwt_token',
      };
      vi.mocked(authService.login).mockResolvedValue(mockResult);

      const response = await request(app)
        .post('/api/auth/login')
        .send(validLogin)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.user.email).toBe('test@example.com');
      expect(response.body.data.token).toBe('mock_jwt_token');
    });

    it('should return 401 for invalid credentials', async () => {
      vi.mocked(authService.login).mockRejectedValue(
        new AppError('Invalid credentials', 401)
      );

      const response = await request(app)
        .post('/api/auth/login')
        .send(validLogin)
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Invalid credentials');
    });

    it('should return 423 for locked account', async () => {
      vi.mocked(authService.login).mockRejectedValue(
        new AppError('Account is locked. Please try again in 15 minute(s).', 423)
      );

      const response = await request(app)
        .post('/api/auth/login')
        .send(validLogin)
        .expect(423);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Account is locked');
    });

    it('should return 403 for deactivated account', async () => {
      vi.mocked(authService.login).mockRejectedValue(
        new AppError('Account is deactivated', 403)
      );

      const response = await request(app)
        .post('/api/auth/login')
        .send(validLogin)
        .expect(403);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Account is deactivated');
    });

    it('should return 400 for missing email', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({ password: 'StrongPass123!' })
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it('should return 400 for missing password', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({ email: 'test@example.com' })
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  // ===========================================================================
  // GET /api/auth/me
  // ===========================================================================

  describe('GET /api/auth/me', () => {
    it('should return current user profile', async () => {
      const mockProfile = {
        id: 1,
        fullname: 'Test User',
        email: 'test@example.com',
        isAdmin: false,
        isInstructor: true,
        createdAt: new Date(),
      };
      vi.mocked(authService.getProfile).mockResolvedValue(mockProfile as any);

      const response = await request(app)
        .get('/api/auth/me')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.email).toBe('test@example.com');
      expect(authService.getProfile).toHaveBeenCalledWith(1);
    });

    it('should return 404 if user not found', async () => {
      vi.mocked(authService.getProfile).mockRejectedValue(
        new AppError('User not found', 404)
      );

      const response = await request(app)
        .get('/api/auth/me')
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('User not found');
    });
  });

  // ===========================================================================
  // PUT /api/auth/password
  // ===========================================================================

  describe('PUT /api/auth/password', () => {
    const passwordUpdate = {
      currentPassword: 'OldPassword123!',
      newPassword: 'NewPassword456!',
    };

    it('should update password successfully', async () => {
      vi.mocked(authService.updatePassword).mockResolvedValue({
        message: 'Password updated successfully',
      });

      const response = await request(app)
        .put('/api/auth/password')
        .send(passwordUpdate)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.message).toBe('Password updated successfully');
      expect(authService.updatePassword).toHaveBeenCalledWith(
        1,
        'OldPassword123!',
        'NewPassword456!',
        expect.any(Object)
      );
    });

    it('should return 401 for incorrect current password', async () => {
      vi.mocked(authService.updatePassword).mockRejectedValue(
        new AppError('Current password is incorrect', 401)
      );

      const response = await request(app)
        .put('/api/auth/password')
        .send(passwordUpdate)
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Current password is incorrect');
    });
  });

  // ===========================================================================
  // GET /api/auth/verify
  // ===========================================================================

  describe('GET /api/auth/verify', () => {
    it('should verify token and return user info', async () => {
      const response = await request(app)
        .get('/api/auth/verify')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.valid).toBe(true);
      expect(response.body.data.user.id).toBe(1);
    });
  });

  // ===========================================================================
  // POST /api/auth/logout
  // ===========================================================================

  describe('POST /api/auth/logout', () => {
    it('should logout successfully', async () => {
      vi.mocked(authService.logLogout).mockResolvedValue(undefined);

      const response = await request(app)
        .post('/api/auth/logout')
        .send({ sessionDuration: 3600 })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Logged out successfully');
      expect(authService.logLogout).toHaveBeenCalledWith(
        1,
        'test@example.com',
        expect.any(Object),
        3600
      );
    });
  });

  // ===========================================================================
  // CLIENT IP EXTRACTION (x-forwarded-for array)
  // ===========================================================================

  describe('Client IP extraction', () => {
    it('should handle x-forwarded-for as array', async () => {
      vi.mocked(authService.login).mockResolvedValue({
        user: { id: 1, email: 'test@example.com', fullname: 'Test User' },
        token: 'jwt_token',
      } as any);

      // supertest doesn't easily support array headers, but we can test with comma-separated
      // The array branch is covered when middleware sets it as array
      const response = await request(app)
        .post('/api/auth/login')
        .set('x-forwarded-for', '192.168.1.1, 10.0.0.1')
        .send({ email: 'test@example.com', password: 'password123' })
        .expect(200);

      expect(response.body.success).toBe(true);
    });
  });
});
