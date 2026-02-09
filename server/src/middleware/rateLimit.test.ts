import { describe, it, expect } from 'vitest';
import { authLimiter, uploadLimiter, apiLimiter } from './rateLimit.middleware';

describe('Rate Limiters', () => {
  describe('authLimiter', () => {
    it('should be defined', () => {
      expect(authLimiter).toBeDefined();
    });

    it('should be a middleware function', () => {
      expect(typeof authLimiter).toBe('function');
    });
  });

  describe('uploadLimiter', () => {
    it('should be defined', () => {
      expect(uploadLimiter).toBeDefined();
    });

    it('should be a middleware function', () => {
      expect(typeof uploadLimiter).toBe('function');
    });
  });

  describe('apiLimiter', () => {
    it('should be defined', () => {
      expect(apiLimiter).toBeDefined();
    });

    it('should be a middleware function', () => {
      expect(typeof apiLimiter).toBe('function');
    });
  });
});
