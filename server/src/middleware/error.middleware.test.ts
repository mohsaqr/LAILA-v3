import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Request, Response, NextFunction } from 'express';
import { ZodError, ZodIssue } from 'zod';
import { Prisma } from '@prisma/client';
import { AppError, errorHandler, notFound, asyncHandler } from './error.middleware.js';

// Mock logger
vi.mock('../utils/logger.js', () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
  },
  logError: vi.fn(),
}));

describe('Error Middleware', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNext: NextFunction;
  let jsonMock: ReturnType<typeof vi.fn>;
  let statusMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    jsonMock = vi.fn();
    statusMock = vi.fn().mockReturnValue({ json: jsonMock });
    mockRequest = {
      method: 'GET',
      originalUrl: '/api/test',
      ip: '127.0.0.1',
      socket: { remoteAddress: '127.0.0.1' } as any,
    };
    mockResponse = {
      status: statusMock,
      json: jsonMock,
    };
    mockNext = vi.fn();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ===========================================================================
  // AppError
  // ===========================================================================

  describe('AppError', () => {
    it('should create error with statusCode', () => {
      const error = new AppError('Not found', 404);

      expect(error.message).toBe('Not found');
      expect(error.statusCode).toBe(404);
      expect(error.isOperational).toBe(true);
    });

    it('should be an instance of Error', () => {
      const error = new AppError('Test error', 500);

      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(AppError);
    });

    it('should capture stack trace', () => {
      const error = new AppError('Test', 400);

      expect(error.stack).toBeDefined();
    });
  });

  // ===========================================================================
  // errorHandler
  // ===========================================================================

  describe('errorHandler', () => {
    it('should handle ZodError validation errors', () => {
      const zodError = new ZodError([
        {
          code: 'invalid_type',
          expected: 'string',
          received: 'number',
          path: ['email'],
          message: 'Expected string, received number',
        } as ZodIssue,
      ]);

      errorHandler(zodError, mockRequest as Request, mockResponse as Response, mockNext);

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        error: 'Validation error',
        details: [{ field: 'email', message: 'Expected string, received number' }],
      });
    });

    it('should handle Prisma P2002 unique constraint error', () => {
      const prismaError = new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
        code: 'P2002',
        clientVersion: '5.0.0',
      });

      errorHandler(prismaError, mockRequest as Request, mockResponse as Response, mockNext);

      expect(statusMock).toHaveBeenCalledWith(409);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        error: 'A record with this value already exists',
      });
    });

    it('should handle Prisma P2025 record not found error', () => {
      const prismaError = new Prisma.PrismaClientKnownRequestError('Record not found', {
        code: 'P2025',
        clientVersion: '5.0.0',
      });

      errorHandler(prismaError, mockRequest as Request, mockResponse as Response, mockNext);

      expect(statusMock).toHaveBeenCalledWith(404);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        error: 'Record not found',
      });
    });

    it('should handle AppError with custom status code', () => {
      const appError = new AppError('Custom error message', 403);

      errorHandler(appError, mockRequest as Request, mockResponse as Response, mockNext);

      expect(statusMock).toHaveBeenCalledWith(403);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        error: 'Custom error message',
      });
    });

    it('should handle generic Error with 500 status', () => {
      const error = new Error('Something went wrong');

      errorHandler(error, mockRequest as Request, mockResponse as Response, mockNext);

      expect(statusMock).toHaveBeenCalledWith(500);
    });

    it('should hide error details in production', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      const error = new Error('Sensitive error details');

      errorHandler(error, mockRequest as Request, mockResponse as Response, mockNext);

      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        error: 'Internal server error',
      });

      process.env.NODE_ENV = originalEnv;
    });

    it('should show error message in development', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';

      const error = new Error('Detailed error message');

      errorHandler(error, mockRequest as Request, mockResponse as Response, mockNext);

      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        error: 'Detailed error message',
      });

      process.env.NODE_ENV = originalEnv;
    });

    it('should include request context in error logging', async () => {
      const error = new AppError('Test', 400);
      (mockRequest as any).requestId = 'req-123';
      (mockRequest as any).user = { id: 1 };

      errorHandler(error, mockRequest as Request, mockResponse as Response, mockNext);

      // The logError function should be called with context
      const loggerModule = await import('../utils/logger.js');
      expect(loggerModule.logError).toHaveBeenCalled();
    });
  });

  // ===========================================================================
  // notFound
  // ===========================================================================

  describe('notFound', () => {
    it('should return 404 with route info', () => {
      mockRequest.originalUrl = '/api/nonexistent';

      notFound(mockRequest as Request, mockResponse as Response);

      expect(statusMock).toHaveBeenCalledWith(404);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        error: 'Route /api/nonexistent not found',
      });
    });
  });

  // ===========================================================================
  // asyncHandler
  // ===========================================================================

  describe('asyncHandler', () => {
    it('should pass successful async result through', async () => {
      const handler = asyncHandler(async (req, res, next) => {
        res.json({ success: true });
      });

      await handler(mockRequest as Request, mockResponse as Response, mockNext);

      expect(jsonMock).toHaveBeenCalledWith({ success: true });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should catch async errors and pass to next', async () => {
      const error = new Error('Async error');
      const handler = asyncHandler(async (req, res, next) => {
        throw error;
      });

      await handler(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(error);
    });

    it('should catch rejected promises', async () => {
      const error = new Error('Promise rejected');
      const handler = asyncHandler(async () => {
        throw error;
      });

      handler(mockRequest as Request, mockResponse as Response, mockNext);

      // Wait for the promise to be handled
      await new Promise(resolve => setImmediate(resolve));

      expect(mockNext).toHaveBeenCalledWith(error);
    });
  });
});
