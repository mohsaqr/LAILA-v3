import { Router, Response } from 'express';
import prisma from '../utils/prisma.js';
import { authenticateToken, requireAdmin } from '../middleware/auth.middleware.js';
import { asyncHandler } from '../middleware/error.middleware.js';
import { AuthRequest } from '../types/index.js';
import { chatbotRegistryService, ChatbotRegistryFilters } from '../services/chatbotRegistry.service.js';

const router = Router();

// All routes require admin
router.use(authenticateToken, requireAdmin);

// Dashboard stats
router.get('/stats', asyncHandler(async (req: AuthRequest, res: Response) => {
  const [
    totalUsers,
    activeUsers,
    totalCourses,
    publishedCourses,
    totalEnrollments,
    totalAssignments,
    totalChatLogs,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { isActive: true } }),
    prisma.course.count(),
    prisma.course.count({ where: { status: 'published' } }),
    prisma.enrollment.count(),
    prisma.assignment.count(),
    prisma.chatLog.count(),
  ]);

  // Recent activity
  const recentUsers = await prisma.user.findMany({
    take: 5,
    orderBy: { createdAt: 'desc' },
    select: { id: true, fullname: true, email: true, createdAt: true },
  });

  const recentEnrollments = await prisma.enrollment.findMany({
    take: 5,
    orderBy: { enrolledAt: 'desc' },
    include: {
      user: { select: { fullname: true } },
      course: { select: { title: true } },
    },
  });

  res.json({
    success: true,
    data: {
      stats: {
        totalUsers,
        activeUsers,
        totalCourses,
        publishedCourses,
        totalEnrollments,
        totalAssignments,
        totalChatLogs,
      },
      recentUsers,
      recentEnrollments,
    },
  });
}));

// Course management
router.get('/courses', asyncHandler(async (req: AuthRequest, res: Response) => {
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 20;
  const status = req.query.status as string;

  const where: any = {};
  if (status) {
    where.status = status;
  }

  const [courses, total] = await Promise.all([
    prisma.course.findMany({
      where,
      include: {
        instructor: { select: { id: true, fullname: true, email: true } },
        _count: { select: { enrollments: true, modules: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.course.count({ where }),
  ]);

  res.json({
    success: true,
    data: courses,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  });
}));

// Enrollment management
router.get('/enrollments', asyncHandler(async (req: AuthRequest, res: Response) => {
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 20;
  const courseId = req.query.courseId ? parseInt(req.query.courseId as string) : undefined;

  const where: any = {};
  if (courseId) {
    where.courseId = courseId;
  }

  const [enrollments, total] = await Promise.all([
    prisma.enrollment.findMany({
      where,
      include: {
        user: { select: { id: true, fullname: true, email: true } },
        course: { select: { id: true, title: true } },
      },
      orderBy: { enrolledAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.enrollment.count({ where }),
  ]);

  res.json({
    success: true,
    data: enrollments,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  });
}));

// Chat logs
router.get('/chat-logs', asyncHandler(async (req: AuthRequest, res: Response) => {
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 50;
  const module = req.query.module as string;
  const userId = req.query.userId ? parseInt(req.query.userId as string) : undefined;

  const where: any = {};
  if (module) where.module = module;
  if (userId) where.userId = userId;

  const [logs, total] = await Promise.all([
    prisma.chatLog.findMany({
      where,
      include: {
        user: { select: { id: true, fullname: true } },
      },
      orderBy: { timestamp: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.chatLog.count({ where }),
  ]);

  res.json({
    success: true,
    data: logs,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  });
}));

// User interactions
router.get('/interactions', asyncHandler(async (req: AuthRequest, res: Response) => {
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 50;
  const userId = req.query.userId ? parseInt(req.query.userId as string) : undefined;

  const where: any = {};
  if (userId) where.userId = userId;

  const [interactions, total] = await Promise.all([
    prisma.userInteraction.findMany({
      where,
      include: {
        user: { select: { id: true, fullname: true } },
      },
      orderBy: { timestamp: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.userInteraction.count({ where }),
  ]);

  res.json({
    success: true,
    data: interactions,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  });
}));

// Data analysis logs
router.get('/analysis-logs', asyncHandler(async (req: AuthRequest, res: Response) => {
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 50;

  const [logs, total] = await Promise.all([
    prisma.dataAnalysisLog.findMany({
      include: {
        user: { select: { id: true, fullname: true } },
      },
      orderBy: { timestamp: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.dataAnalysisLog.count(),
  ]);

  res.json({
    success: true,
    data: logs,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  });
}));

// =============================================================================
// CHATBOT REGISTRY
// =============================================================================

// Get chatbots with filters and pagination
router.get('/chatbot-registry', asyncHandler(async (req: AuthRequest, res: Response) => {
  const filters: ChatbotRegistryFilters = {
    type: req.query.type as 'global' | 'section' | undefined,
    courseId: req.query.courseId ? parseInt(req.query.courseId as string) : undefined,
    creatorId: req.query.creatorId ? parseInt(req.query.creatorId as string) : undefined,
    isActive: req.query.isActive !== undefined ? req.query.isActive === 'true' : undefined,
    category: req.query.category as string | undefined,
    search: req.query.search as string | undefined,
    startDate: req.query.startDate as string | undefined,
    endDate: req.query.endDate as string | undefined,
    page: req.query.page ? parseInt(req.query.page as string) : 1,
    limit: req.query.limit ? parseInt(req.query.limit as string) : 50,
    sortBy: req.query.sortBy as string | undefined,
    sortOrder: req.query.sortOrder as 'asc' | 'desc' | undefined,
  };

  const result = await chatbotRegistryService.getChatbots(filters);

  res.json({
    success: true,
    data: result.chatbots,
    pagination: result.pagination,
  });
}));

// Get filter options for dropdowns
router.get('/chatbot-registry/filter-options', asyncHandler(async (req: AuthRequest, res: Response) => {
  const options = await chatbotRegistryService.getFilterOptions();

  res.json({
    success: true,
    data: options,
  });
}));

// Get summary statistics
router.get('/chatbot-registry/stats', asyncHandler(async (req: AuthRequest, res: Response) => {
  const filters = {
    startDate: req.query.startDate as string | undefined,
    endDate: req.query.endDate as string | undefined,
  };

  const stats = await chatbotRegistryService.getStats(filters);

  res.json({
    success: true,
    data: stats,
  });
}));

// Export chatbots as CSV
router.get('/chatbot-registry/export/csv', asyncHandler(async (req: AuthRequest, res: Response) => {
  const filters: ChatbotRegistryFilters = {
    type: req.query.type as 'global' | 'section' | undefined,
    courseId: req.query.courseId ? parseInt(req.query.courseId as string) : undefined,
    creatorId: req.query.creatorId ? parseInt(req.query.creatorId as string) : undefined,
    category: req.query.category as string | undefined,
    search: req.query.search as string | undefined,
    startDate: req.query.startDate as string | undefined,
    endDate: req.query.endDate as string | undefined,
  };

  const csv = await chatbotRegistryService.generateCSV(filters);

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename=chatbot-registry-${new Date().toISOString().slice(0, 10)}.csv`);
  res.send(csv);
}));

// Export chatbots as Excel
router.get('/chatbot-registry/export/excel', asyncHandler(async (req: AuthRequest, res: Response) => {
  const filters: ChatbotRegistryFilters = {
    type: req.query.type as 'global' | 'section' | undefined,
    courseId: req.query.courseId ? parseInt(req.query.courseId as string) : undefined,
    creatorId: req.query.creatorId ? parseInt(req.query.creatorId as string) : undefined,
    category: req.query.category as string | undefined,
    search: req.query.search as string | undefined,
    startDate: req.query.startDate as string | undefined,
    endDate: req.query.endDate as string | undefined,
  };

  const workbook = await chatbotRegistryService.generateExcelWorkbook(filters);

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename=chatbot-registry-${new Date().toISOString().slice(0, 10)}.xlsx`);

  await workbook.xlsx.write(res);
  res.end();
}));

// Export chatbots as JSON
router.get('/chatbot-registry/export/json', asyncHandler(async (req: AuthRequest, res: Response) => {
  const filters: ChatbotRegistryFilters = {
    type: req.query.type as 'global' | 'section' | undefined,
    courseId: req.query.courseId ? parseInt(req.query.courseId as string) : undefined,
    creatorId: req.query.creatorId ? parseInt(req.query.creatorId as string) : undefined,
    category: req.query.category as string | undefined,
    search: req.query.search as string | undefined,
    startDate: req.query.startDate as string | undefined,
    endDate: req.query.endDate as string | undefined,
  };

  const chatbots = await chatbotRegistryService.exportChatbots(filters);

  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', `attachment; filename=chatbot-registry-${new Date().toISOString().slice(0, 10)}.json`);
  res.json({
    exportedAt: new Date().toISOString(),
    totalCount: chatbots.length,
    chatbots,
  });
}));

// Export data
router.get('/export/:type', asyncHandler(async (req: AuthRequest, res: Response) => {
  const { type } = req.params;

  let data: any;

  switch (type) {
    case 'users':
      data = await prisma.user.findMany({
        select: {
          id: true,
          fullname: true,
          email: true,
          isAdmin: true,
          isInstructor: true,
          isActive: true,
          createdAt: true,
          lastLogin: true,
        },
      });
      break;
    case 'courses':
      data = await prisma.course.findMany({
        include: {
          instructor: { select: { fullname: true } },
          _count: { select: { enrollments: true } },
        },
      });
      break;
    case 'enrollments':
      data = await prisma.enrollment.findMany({
        include: {
          user: { select: { fullname: true, email: true } },
          course: { select: { title: true } },
        },
      });
      break;
    case 'chat-logs':
      data = await prisma.chatLog.findMany({
        include: {
          user: { select: { fullname: true } },
        },
      });
      break;
    default:
      res.status(400).json({ success: false, error: 'Invalid export type' });
      return;
  }

  res.json({ success: true, data });
}));

export default router;
