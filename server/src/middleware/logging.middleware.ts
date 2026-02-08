import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { httpLogger, logRequest, RequestLogContext } from '../utils/logger.js';

// Extend Express Request type to include requestId
declare global {
  namespace Express {
    interface Request {
      requestId: string;
      startTime: bigint;
    }
  }
}

/**
 * Middleware that adds request ID and logs all HTTP requests
 */
export const requestLoggingMiddleware = (req: Request, res: Response, next: NextFunction) => {
  // Generate request ID
  req.requestId = (req.headers['x-request-id'] as string) || uuidv4();
  req.startTime = process.hrtime.bigint();

  // Add request ID to response headers
  res.setHeader('X-Request-ID', req.requestId);

  // Log request start
  httpLogger.debug(
    {
      requestId: req.requestId,
      method: req.method,
      url: req.originalUrl,
      ip: req.ip || req.socket.remoteAddress,
      userAgent: req.headers['user-agent'],
      contentLength: req.headers['content-length'],
    },
    'Incoming request'
  );

  // Capture response finish
  res.on('finish', () => {
    const endTime = process.hrtime.bigint();
    const durationMs = Number(endTime - req.startTime) / 1_000_000;

    const logContext: RequestLogContext = {
      method: req.method,
      url: req.originalUrl,
      ip: req.ip || req.socket.remoteAddress,
      userAgent: req.headers['user-agent'],
      requestId: req.requestId,
      duration: Math.round(durationMs),
      statusCode: res.statusCode,
    };

    // Add user ID if available (from auth middleware)
    if ((req as any).user?.id) {
      logContext.userId = (req as any).user.id;
    }

    logRequest(logContext);
  });

  next();
};

/**
 * Middleware for logging slow requests
 */
export const slowRequestLoggingMiddleware = (thresholdMs: number = 1000) => {
  return (req: Request, res: Response, next: NextFunction) => {
    res.on('finish', () => {
      if (!req.startTime) return;

      const endTime = process.hrtime.bigint();
      const durationMs = Number(endTime - req.startTime) / 1_000_000;

      if (durationMs > thresholdMs) {
        httpLogger.warn(
          {
            requestId: req.requestId,
            method: req.method,
            url: req.originalUrl,
            duration: Math.round(durationMs),
            threshold: thresholdMs,
          },
          `Slow request detected: ${req.method} ${req.originalUrl} took ${durationMs.toFixed(0)}ms`
        );
      }
    });

    next();
  };
};
