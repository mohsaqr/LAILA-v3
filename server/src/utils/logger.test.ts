import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// We need to test the exported functions
describe('Logger Utils', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('createLogger', () => {
    it('should create a child logger with module name', async () => {
      const { createLogger } = await import('./logger.js');
      const testLogger = createLogger('test-module');

      expect(testLogger).toBeDefined();
      expect(typeof testLogger.info).toBe('function');
      expect(typeof testLogger.error).toBe('function');
      expect(typeof testLogger.warn).toBe('function');
      expect(typeof testLogger.debug).toBe('function');
    });
  });

  describe('logRequest', () => {
    it('should log info for successful requests', async () => {
      const { logRequest, httpLogger } = await import('./logger.js');
      const infoSpy = vi.spyOn(httpLogger, 'info');

      logRequest({
        method: 'GET',
        url: '/api/test',
        statusCode: 200,
        duration: 50,
      });

      expect(infoSpy).toHaveBeenCalled();
    });

    it('should log warn for 4xx errors', async () => {
      const { logRequest, httpLogger } = await import('./logger.js');
      const warnSpy = vi.spyOn(httpLogger, 'warn');

      logRequest({
        method: 'POST',
        url: '/api/test',
        statusCode: 400,
        duration: 30,
      });

      expect(warnSpy).toHaveBeenCalled();
    });

    it('should log error for 5xx errors', async () => {
      const { logRequest, httpLogger } = await import('./logger.js');
      const errorSpy = vi.spyOn(httpLogger, 'error');

      logRequest({
        method: 'GET',
        url: '/api/test',
        statusCode: 500,
        duration: 100,
      });

      expect(errorSpy).toHaveBeenCalled();
    });
  });

  describe('logError', () => {
    it('should log error with context', async () => {
      const { logError, logger } = await import('./logger.js');
      const errorSpy = vi.spyOn(logger, 'error');

      const error = new Error('Test error');
      logError(error, { userId: 1, action: 'test' });

      expect(errorSpy).toHaveBeenCalled();
    });

    it('should use custom logger instance', async () => {
      const { logError, createLogger } = await import('./logger.js');
      const customLogger = createLogger('custom');
      const errorSpy = vi.spyOn(customLogger, 'error');

      const error = new Error('Custom error');
      logError(error, { custom: true }, customLogger);

      expect(errorSpy).toHaveBeenCalled();
    });
  });

  describe('createTimer', () => {
    it('should track operation duration', async () => {
      const { createTimer, logger } = await import('./logger.js');
      const infoSpy = vi.spyOn(logger, 'info');

      const timer = createTimer('test-operation');

      // Simulate some work
      await new Promise(resolve => setTimeout(resolve, 10));

      const duration = timer.end({ extra: 'context' });

      expect(duration).toBeGreaterThan(0);
      expect(infoSpy).toHaveBeenCalled();
    });

    it('should use custom logger instance', async () => {
      const { createTimer, createLogger } = await import('./logger.js');
      const customLogger = createLogger('timer-test');
      const infoSpy = vi.spyOn(customLogger, 'info');

      const timer = createTimer('custom-op', customLogger);
      timer.end();

      expect(infoSpy).toHaveBeenCalled();
    });
  });

  describe('specialized loggers', () => {
    it('should export specialized loggers', async () => {
      const {
        authLogger,
        llmLogger,
        enrollmentLogger,
        assignmentLogger,
        analyticsLogger,
        httpLogger,
        dbLogger,
      } = await import('./logger.js');

      expect(authLogger).toBeDefined();
      expect(llmLogger).toBeDefined();
      expect(enrollmentLogger).toBeDefined();
      expect(assignmentLogger).toBeDefined();
      expect(analyticsLogger).toBeDefined();
      expect(httpLogger).toBeDefined();
      expect(dbLogger).toBeDefined();
    });
  });
});
