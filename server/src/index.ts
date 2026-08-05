// MUST be the first import. ES module imports are all evaluated before any
// statement in this file runs, so the `dotenv.config()` call further down
// executes AFTER every module below has already been initialised. Anything that
// read process.env at module scope — a log level, a feature gate — therefore saw
// an empty value and silently took its default.
//
// That was not theoretical: notification.routes.ts registers developer-only test
// endpoints behind `NODE_ENV !== 'production'` at module scope, so on any host
// that supplies NODE_ENV through server/.env rather than the process
// environment, those routes were being mounted in production. The systemd unit
// happens to set NODE_ENV itself, which masked it there.
//
// `dotenv/config` applies the file as a side effect of the import, which puts it
// ahead of every import that follows. Keep it first.
import 'dotenv/config';

import express from 'express';
import { createServer } from 'http';
import cors from 'cors';
import compression from 'compression';
import helmet from 'helmet';
import dotenv from 'dotenv';
import path from 'path';
import { initSocket } from './utils/socket.js';

// Retained deliberately. dotenv does not overwrite variables that are already
// set, so this is a no-op after the side-effect import above — but it keeps
// working if someone reorders the imports, and it documents the dependency.
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
import invitationRoutes from './routes/invitation.routes.js';
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
import categoryRoutes from './routes/category.routes.js';
import meRoutes from './routes/me.routes.js';
import presentationRoutes from './routes/presentation.routes.js';
import oidcRoutes, { discoveryRouter as oidcDiscoveryRouter } from './routes/oidc.routes.js';

// Import configuration
import { CSP_DIRECTIVES } from './config/csp.js';
import { APP_VERSION, BUILD_INFO } from './config/buildInfo.js';

// Import middleware
import { errorHandler } from './middleware/error.middleware.js';
import { authLimiter, uploadLimiter, apiLimiter, llmLimiter, presentationLimiter } from './middleware/rateLimit.middleware.js';

const app = express();
app.set('trust proxy', 1);
const PORT = process.env.PORT || 5001;

// Version, commit and build time all come from config/buildInfo.ts. See there
// for why npm_package_version cannot be used, and why the git SHA matters more
// than the version for telling two deployments apart.

// CORS configuration - supports multiple origins or wildcard
const corsOrigin = process.env.CLIENT_URL || 'http://localhost:5174';
// A reflect-any-origin CORS policy combined with credentials:true is unsafe in
// production — any site could drive an authenticated cross-site request the
// moment cookies enter the picture. Refuse to boot rather than run open.
if (process.env.NODE_ENV === 'production' && corsOrigin === '*') {
  throw new Error('CLIENT_URL="*" is not allowed in production; set explicit allowed origin(s)');
}
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
      // Every directive lives in config/csp.ts, which the nginx configs under
      // deploy/ are generated from. Do NOT add one inline here: nginx serves
      // the SPA's index.html from disk without ever reaching Express, so an
      // inline directive would protect the API and silently miss the pages.
      // config/csp.test.ts fails if the committed nginx copies drift.
      ...CSP_DIRECTIVES,
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

// Validate required environment variables. JWT_SECRET was previously enforced
// only incidentally (by initSocket); check it here next to SESSION_SECRET so a
// missing or placeholder signing key fails the boot loudly rather than minting
// forgeable tokens.
if (!process.env.SESSION_SECRET) {
  throw new Error('SESSION_SECRET environment variable is required');
}
if (!process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET environment variable is required');
}
if (process.env.NODE_ENV === 'production') {
  const placeholders = ['your-super-secret-jwt-key-change-in-production', 'your-session-secret-change-in-production', 'changeme', 'secret'];
  for (const [name, value] of [['JWT_SECRET', process.env.JWT_SECRET], ['SESSION_SECRET', process.env.SESSION_SECRET]] as const) {
    if (value!.length < 32 || placeholders.includes(value!)) {
      throw new Error(`${name} is too weak or is a placeholder; set a strong random value in production`);
    }
  }
}

// NOTE: express-session was previously mounted here but nothing ever wrote to
// req.session (auth is stateless Bearer JWT), so it set no cookie and did
// nothing — removed to avoid a misleading "we have sessions/CSRF" posture for
// whoever adds a cookie feature next. SESSION_SECRET is retained above because
// it is the HMAC key for invitation codes (invitation.service), not a cookie
// secret. If a real cookie/session is introduced later, add CSRF protection at
// the same time.

// Static files for uploads with security headers
app.use('/uploads', (req, res, next) => {
  // Add Content-Security-Policy to prevent script execution in uploaded files
  const base = "default-src 'none'; img-src 'self'; media-src 'self'; style-src 'unsafe-inline'";

  // `default-src 'none'` also means `object-src 'none'`, and the browser's
  // built-in PDF viewer renders through a plugin object — so a PDF opened from
  // here shows a blank page rather than the document. Slide decks are kept as
  // PDF precisely so their hyperlinks can be clicked (see
  // presentation.service.ts), which is useless if the viewer cannot start.
  // Widened only for .pdf, and only to object/frame: scripts, XHR and
  // everything else stay denied, and `nosniff` still pins the content type.
  const isPdf = req.path.toLowerCase().endsWith('.pdf');
  res.setHeader(
    'Content-Security-Policy',
    isPdf ? `${base}; object-src 'self'; frame-src 'self'` : base
  );
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
app.use('/api/invitations', invitationRoutes);
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
app.use('/api/categories', categoryRoutes);
app.use('/api/me', meRoutes);
app.use('/api/presentations', presentationLimiter, presentationRoutes);

// OIDC provider (LAILA as identity provider). Discovery is mounted at the
// issuer root because RFC 8414 fixes its path; everything else lives under
// /api/oidc. Both 404 unless OIDC_ISSUER + OIDC_PRIVATE_KEY are configured.
// Mounted before the SPA catch-all so /.well-known is not swallowed by it.
app.use('/', oidcDiscoveryRouter);
app.use('/api/oidc', oidcRoutes);

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
      version: APP_VERSION,
      // Identifies the artifact exactly. The version only moves when someone
      // bumps it; the commit moves every build, so this is what tells a fresh
      // deployment apart from one still serving last week's files.
      build: {
        gitSha: BUILD_INFO.gitSha,
        gitBranch: BUILD_INFO.gitBranch,
        gitDirty: BUILD_INFO.gitDirty,
        builtAt: BUILD_INFO.builtAt,
      },
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

// Production: serve client build as static files
if (process.env.NODE_ENV === 'production') {
  const clientDist = path.join(process.cwd(), '..', 'client', 'dist');
  app.use(express.static(clientDist));
  app.get('*', (_req, res) => {
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

// Error handling middleware
app.use(errorHandler);

// Start server with Socket.IO
const server = createServer(app);
initSocket(server, corsOptions.origin);

server.listen(PORT, () => {
  logger.info({
    port: PORT,
    environment: process.env.NODE_ENV || 'development',
    nodeVersion: process.version,
  }, `Server started on port ${PORT}`);
});

export { server };
export default app;
