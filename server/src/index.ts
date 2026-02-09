import express from 'express';
import cors from 'cors';
import compression from 'compression';
import helmet from 'helmet';
import session from 'express-session';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config();

// Import logger first
import { logger } from './utils/logger.js';
import { requestLoggingMiddleware, slowRequestLoggingMiddleware } from './middleware/logging.middleware.js';

// Import routes
import authRoutes from './routes/auth.routes.js';
import userRoutes from './routes/user.routes.js';
import chatRoutes from './routes/chat.routes.js';
import chatbotRoutes from './routes/chatbot.routes.js';
import courseRoutes from './routes/course.routes.js';
import enrollmentRoutes from './routes/enrollment.routes.js';
import assignmentRoutes from './routes/assignment.routes.js';
import adminRoutes from './routes/admin.routes.js';
import settingsRoutes from './routes/settings.routes.js';
import analyticsRoutes from './routes/analytics.routes.js';
import analyticsExportRoutes from './routes/analyticsExport.routes.js';
import learningAnalyticsRoutes from './routes/learningAnalytics.routes.js';
import agentAssignmentRoutes from './routes/agentAssignment.routes.js';
import userManagementRoutes from './routes/userManagement.routes.js';
import enrollmentManagementRoutes from './routes/enrollmentManagement.routes.js';
import batchEnrollmentRoutes from './routes/batchEnrollment.routes.js';
import courseRolesRoutes from './routes/courseRoles.routes.js';
import activityLogRoutes from './routes/activityLog.routes.js';
import codeLabRoutes from './routes/codeLab.routes.js';
import llmRoutes from './routes/llm.routes.js';
import uploadRoutes from './routes/upload.routes.js';
import agentDesignLogRoutes from './routes/agentDesignLog.routes.js';
import promptBlockRoutes from './routes/promptBlock.routes.js';
import tutorRoutes from './routes/tutor.routes.js';
import surveyRoutes from './routes/survey.routes.js';
import emotionalPulseRoutes from './routes/emotionalPulse.routes.js';
import messageExportRoutes from './routes/messageExport.routes.js';
import courseTutorRoutes from './routes/courseTutor.routes.js';
import customLabRoutes from './routes/customLab.routes.js';
import aiRoutes from './routes/ai.routes.js';
import quizRoutes from './routes/quiz.routes.js';
import notificationRoutes from './routes/notification.routes.js';
import forumRoutes from './routes/forum.routes.js';
import certificateRoutes from './routes/certificate.routes.js';

// Import middleware
import { errorHandler } from './middleware/error.middleware.js';
import { authLimiter, uploadLimiter, apiLimiter, llmLimiter } from './middleware/rateLimit.middleware.js';

const app = express();
const PORT = process.env.PORT || 5001;

// CORS configuration - supports multiple origins or wildcard
const corsOrigin = process.env.CLIENT_URL || 'http://localhost:5174';
const corsOptions = {
  origin: corsOrigin === '*' ? true : corsOrigin.includes(',')
    ? corsOrigin.split(',').map(o => o.trim())
    : corsOrigin,
  credentials: true,
};

// Middleware
app.use(cors(corsOptions));

// Security headers via helmet
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "blob:"],
      fontSrc: ["'self'"],
      connectSrc: ["'self'"],
      frameSrc: ["'none'"],
      objectSrc: ["'none'"],
      upgradeInsecureRequests: process.env.NODE_ENV === 'production' ? [] : null,
    },
  },
  crossOriginEmbedderPolicy: false, // Allow embedding resources
  crossOriginResourcePolicy: { policy: "cross-origin" }, // Allow CORS resources
}));

app.use(compression()); // Enable gzip/deflate compression for all responses
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging middleware
app.use(requestLoggingMiddleware);
app.use(slowRequestLoggingMiddleware(2000)); // Log requests slower than 2s

// Validate required environment variables
if (!process.env.SESSION_SECRET) {
  throw new Error('SESSION_SECRET environment variable is required');
}

// Session configuration
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
  },
}));

// Static files for uploads with security headers
app.use('/uploads', (req, res, next) => {
  // Add Content-Security-Policy to prevent script execution in uploaded files
  res.setHeader('Content-Security-Policy', "default-src 'none'; img-src 'self'; media-src 'self'; style-src 'unsafe-inline'");
  res.setHeader('X-Content-Type-Options', 'nosniff');
  next();
}, express.static(path.join(process.cwd(), 'uploads')));

// Apply general rate limiting to all API routes
app.use('/api', apiLimiter);

// API Routes with specific rate limiting
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/uploads', uploadLimiter, uploadRoutes);

// Standard API routes
app.use('/api/users', userRoutes);
app.use('/api/chat', llmLimiter, chatRoutes); // AI rate limiting
app.use('/api/chatbots', chatbotRoutes);
app.use('/api/courses', courseRoutes);
app.use('/api/enrollments', enrollmentRoutes);
app.use('/api/assignments', assignmentRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/analytics/export', analyticsExportRoutes);
app.use('/api/analytics', learningAnalyticsRoutes);
app.use('/api/agent-assignments', agentAssignmentRoutes);
app.use('/api/user-management', userManagementRoutes);
app.use('/api/enrollment-management', enrollmentManagementRoutes);
app.use('/api/batch-enrollment', batchEnrollmentRoutes);
app.use('/api/course-roles', courseRolesRoutes);
app.use('/api/activity-log', activityLogRoutes);
app.use('/api/code-labs', codeLabRoutes);
app.use('/api/llm', llmLimiter, llmRoutes); // AI rate limiting
app.use('/api/agent-design-logs', agentDesignLogRoutes);
app.use('/api/prompt-blocks', promptBlockRoutes);
app.use('/api/tutors', llmLimiter, tutorRoutes); // AI rate limiting
app.use('/api/surveys', surveyRoutes);
app.use('/api/emotional-pulse', emotionalPulseRoutes);
app.use('/api/admin/messages', messageExportRoutes);
app.use('/api/courses', courseTutorRoutes);
app.use('/api/labs', customLabRoutes);
app.use('/api/ai', llmLimiter, aiRoutes); // AI rate limiting
app.use('/api/quizzes', quizRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/forums', forumRoutes);
app.use('/api/certificates', certificateRoutes);

// Health check with comprehensive status
app.get('/api/health', async (req, res) => {
  const startTime = Date.now();

  try {
    // Check database connectivity
    const { prisma } = await import('./utils/prisma.js');
    await prisma.$queryRaw`SELECT 1`;
    const dbLatency = Date.now() - startTime;

    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: process.env.npm_package_version || '3.0.0',
      environment: process.env.NODE_ENV || 'development',
      checks: {
        database: {
          status: 'healthy',
          latencyMs: dbLatency,
        },
        memory: {
          heapUsed: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
          heapTotal: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
          unit: 'MB',
        },
      },
    });
  } catch (error: any) {
    logger.error({ err: error }, 'Health check failed');
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      error: error.message,
      checks: {
        database: {
          status: 'unhealthy',
          error: error.message,
        },
      },
    });
  }
});

// Error handling middleware
app.use(errorHandler);

// Start server
app.listen(PORT, () => {
  logger.info({
    port: PORT,
    environment: process.env.NODE_ENV || 'development',
    nodeVersion: process.version,
  }, `Server started on port ${PORT}`);
});

export default app;
