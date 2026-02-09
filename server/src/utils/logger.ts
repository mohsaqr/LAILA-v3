import pino from 'pino';

// Determine log level from environment
const logLevel = process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug');

// Create base logger configuration
const baseConfig: pino.LoggerOptions = {
  level: logLevel,
  formatters: {
    level: (label) => ({ level: label }),
    bindings: (bindings) => ({
      pid: bindings.pid,
      host: bindings.hostname,
      node_version: process.version,
    }),
  },
  timestamp: pino.stdTimeFunctions.isoTime,
  base: {
    service: 'laila-lms',
    version: process.env.npm_package_version || '3.0.0',
    environment: process.env.NODE_ENV || 'development',
  },
  // Redact sensitive fields
  redact: {
    paths: [
      'password',
      'passwordHash',
      'token',
      'apiKey',
      'authorization',
      'cookie',
      'req.headers.authorization',
      'req.headers.cookie',
      'req.body.password',
      'req.body.currentPassword',
      'req.body.newPassword',
      'req.body.apiKey',
    ],
    censor: '[REDACTED]',
  },
};

// Use pretty printing in development
const transport = process.env.NODE_ENV === 'production'
  ? undefined
  : {
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'SYS:standard',
        ignore: 'pid,hostname',
      },
    };

// Create the main logger
export const logger = pino(baseConfig, transport ? pino.transport(transport) : undefined);

// Create child loggers for different modules
export const createLogger = (module: string) => logger.child({ module });

// Specialized loggers
export const authLogger = createLogger('auth');
export const llmLogger = createLogger('llm');
export const enrollmentLogger = createLogger('enrollment');
export const assignmentLogger = createLogger('assignment');
export const analyticsLogger = createLogger('analytics');
export const httpLogger = createLogger('http');
export const dbLogger = createLogger('database');

// Request logging helper
export interface RequestLogContext {
  method: string;
  url: string;
  userId?: number;
  ip?: string;
  userAgent?: string;
  requestId?: string;
  duration?: number;
  statusCode?: number;
}

export const logRequest = (ctx: RequestLogContext) => {
  const { duration, statusCode, ...rest } = ctx;

  if (statusCode && statusCode >= 500) {
    httpLogger.error({ ...rest, duration, statusCode }, 'Request failed with server error');
  } else if (statusCode && statusCode >= 400) {
    httpLogger.warn({ ...rest, duration, statusCode }, 'Request failed with client error');
  } else {
    httpLogger.info({ ...rest, duration, statusCode }, 'Request completed');
  }
};

// Error logging helper with stack trace
export const logError = (
  err: Error,
  context?: Record<string, unknown>,
  loggerInstance: pino.Logger = logger
) => {
  loggerInstance.error(
    {
      err: {
        message: err.message,
        name: err.name,
        stack: err.stack,
      },
      ...context,
    },
    err.message
  );
};

// Performance timing helper
export const createTimer = (operation: string, loggerInstance: pino.Logger = logger) => {
  const startTime = process.hrtime.bigint();

  return {
    end: (context?: Record<string, unknown>) => {
      const endTime = process.hrtime.bigint();
      const durationMs = Number(endTime - startTime) / 1_000_000;

      loggerInstance.info(
        { operation, durationMs, ...context },
        `${operation} completed in ${durationMs.toFixed(2)}ms`
      );

      return durationMs;
    },
  };
};

export default logger;
