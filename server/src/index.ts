import express from 'express';
import cors from 'cors';
import session from 'express-session';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config();

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

// Import middleware
import { errorHandler } from './middleware/error.middleware.js';
import { authLimiter, uploadLimiter, apiLimiter } from './middleware/rateLimit.middleware.js';

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:5173',
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

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
app.use('/api/chat', chatRoutes);
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
app.use('/api/llm', llmRoutes);
app.use('/api/agent-design-logs', agentDesignLogRoutes);
app.use('/api/prompt-blocks', promptBlockRoutes);
app.use('/api/tutors', tutorRoutes);
app.use('/api/surveys', surveyRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Error handling middleware
app.use(errorHandler);

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});

export default app;
