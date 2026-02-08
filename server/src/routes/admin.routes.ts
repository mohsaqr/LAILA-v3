import { Router, Response } from 'express';
import ExcelJS from 'exceljs';
import prisma from '../utils/prisma.js';
import { authenticateToken, requireAdmin } from '../middleware/auth.middleware.js';
import { asyncHandler } from '../middleware/error.middleware.js';
import { AuthRequest } from '../types/index.js';
import { chatbotRegistryService, ChatbotRegistryFilters } from '../services/chatbotRegistry.service.js';
import { parsePaginationLimit } from '../utils/validation.js';

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
  const limit = parsePaginationLimit(req.query.limit as string, 20);
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
  const limit = parsePaginationLimit(req.query.limit as string, 20);
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
  const limit = parsePaginationLimit(req.query.limit as string, 50);
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
  const limit = parsePaginationLimit(req.query.limit as string, 50);
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
  const limit = parsePaginationLimit(req.query.limit as string, 50);

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
    limit: parsePaginationLimit(req.query.limit as string, 50),
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

// =============================================================================
// FORUM LOGS & ANALYTICS
// =============================================================================

// Get forum summary/analytics
router.get('/forum-summary', asyncHandler(async (req: AuthRequest, res: Response) => {
  const [
    totalThreads,
    totalPosts,
    totalForums,
    anonymousPosts,
  ] = await Promise.all([
    prisma.forumThread.count(),
    prisma.forumPost.count(),
    prisma.forum.count(),
    prisma.forumPost.count({ where: { isAnonymous: true } }),
  ]);

  // Posts by course
  const byCourse = await prisma.forum.findMany({
    select: {
      id: true,
      title: true,
      courseId: true,
      course: { select: { title: true } },
      _count: { select: { threads: true } },
    },
    orderBy: { threads: { _count: 'desc' } },
    take: 10,
  });

  // Top users by post count
  const byUser = await prisma.forumPost.groupBy({
    by: ['authorId'],
    _count: { id: true },
    orderBy: { _count: { id: 'desc' } },
    take: 10,
  });

  // Get user details for top posters
  const userIds = byUser.map(u => u.authorId);
  const users = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, fullname: true, email: true },
  });
  const userMap = new Map(users.map(u => [u.id, u]));
  const byUserWithDetails = byUser.map(u => ({
    userId: u.authorId,
    userName: userMap.get(u.authorId)?.fullname || 'Unknown',
    userEmail: userMap.get(u.authorId)?.email,
    count: u._count.id,
  }));

  // Recent threads
  const recentThreads = await prisma.forumThread.findMany({
    take: 20,
    orderBy: { createdAt: 'desc' },
    include: {
      forum: {
        select: {
          id: true,
          title: true,
          courseId: true,
          course: { select: { title: true } },
        },
      },
      _count: { select: { posts: true } },
    },
  });

  // Get thread authors
  const threadAuthorIds = recentThreads.map(t => t.authorId);
  const threadAuthors = await prisma.user.findMany({
    where: { id: { in: threadAuthorIds } },
    select: { id: true, fullname: true },
  });
  const threadAuthorMap = new Map(threadAuthors.map(u => [u.id, u]));

  // Recent posts
  const recentPosts = await prisma.forumPost.findMany({
    take: 30,
    orderBy: { createdAt: 'desc' },
    include: {
      thread: {
        select: {
          id: true,
          title: true,
          forum: {
            select: {
              id: true,
              title: true,
              courseId: true,
              course: { select: { title: true } },
            },
          },
        },
      },
      parent: {
        select: {
          id: true,
          authorId: true,
        },
      },
    },
  });

  // Get post authors
  const postAuthorIds = recentPosts.map(p => p.authorId);
  const postAuthors = await prisma.user.findMany({
    where: { id: { in: postAuthorIds } },
    select: { id: true, fullname: true },
  });
  const postAuthorMap = new Map(postAuthors.map(u => [u.id, u]));

  // Format recent threads
  const formattedThreads = recentThreads.map(t => ({
    id: t.id,
    title: t.title,
    createdAt: t.createdAt,
    authorId: t.authorId,
    authorName: threadAuthorMap.get(t.authorId)?.fullname || 'Unknown',
    forumId: t.forum.id,
    forumTitle: t.forum.title,
    courseId: t.forum.courseId,
    courseTitle: t.forum.course.title,
    postCount: t._count.posts,
  }));

  // Format recent posts
  const formattedPosts = recentPosts.map(p => ({
    id: p.id,
    content: p.content.substring(0, 200) + (p.content.length > 200 ? '...' : ''),
    fullContent: p.content,
    createdAt: p.createdAt,
    authorId: p.authorId,
    authorName: p.isAnonymous ? 'Anonymous' : (postAuthorMap.get(p.authorId)?.fullname || 'Unknown'),
    isAnonymous: p.isAnonymous,
    threadId: p.thread.id,
    threadTitle: p.thread.title,
    forumId: p.thread.forum.id,
    forumTitle: p.thread.forum.title,
    courseId: p.thread.forum.courseId,
    courseTitle: p.thread.forum.course.title,
    parentId: p.parentId,
    isReply: !!p.parentId,
  }));

  // Format by course
  const formattedByCourse = byCourse.map(f => ({
    forumId: f.id,
    forumTitle: f.title,
    courseId: f.courseId,
    courseTitle: f.course.title,
    threadCount: f._count.threads,
  }));

  res.json({
    success: true,
    data: {
      totalThreads,
      totalPosts,
      totalForums,
      anonymousPosts,
      namedPosts: totalPosts - anonymousPosts,
      byCourse: formattedByCourse,
      byUser: byUserWithDetails,
      recentThreads: formattedThreads,
      recentPosts: formattedPosts,
    },
  });
}));

// Export forum posts as CSV
router.get('/forum-export/csv', asyncHandler(async (req: AuthRequest, res: Response) => {
  // Get all posts with full details
  const posts = await prisma.forumPost.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      thread: {
        include: {
          forum: {
            include: {
              course: { select: { id: true, title: true } },
            },
          },
        },
      },
      parent: {
        select: {
          id: true,
          authorId: true,
          content: true,
        },
      },
    },
  });

  // Get all user details
  const userIds = [...new Set(posts.flatMap(p => [p.authorId, p.parent?.authorId].filter(Boolean) as number[]))];
  const users = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, fullname: true, email: true },
  });
  const userMap = new Map(users.map(u => [u.id, u]));

  // Get thread authors
  const threadIds = [...new Set(posts.map(p => p.threadId))];
  const threads = await prisma.forumThread.findMany({
    where: { id: { in: threadIds } },
    select: { id: true, authorId: true, title: true },
  });
  const threadMap = new Map(threads.map(t => [t.id, t]));

  // Build CSV
  const headers = [
    'Post ID',
    'Timestamp',
    'Author ID',
    'Author Name',
    'Author Email',
    'Is Anonymous',
    'Thread ID',
    'Thread Title',
    'Thread Author ID',
    'Thread Author Name',
    'Forum ID',
    'Forum Title',
    'Course ID',
    'Course Title',
    'Parent Post ID',
    'Parent Author ID',
    'Parent Author Name',
    'Reply Type',
    'Content',
    'Content Length',
  ];

  const rows = posts.map(p => {
    const author = userMap.get(p.authorId);
    const parentAuthor = p.parent?.authorId ? userMap.get(p.parent.authorId) : null;
    const thread = threadMap.get(p.threadId);
    const threadAuthor = thread?.authorId ? userMap.get(thread.authorId) : null;

    return [
      p.id,
      p.createdAt.toISOString(),
      p.authorId,
      p.isAnonymous ? 'Anonymous' : (author?.fullname || 'Unknown'),
      p.isAnonymous ? '' : (author?.email || ''),
      p.isAnonymous ? 'Yes' : 'No',
      p.threadId,
      thread?.title || '',
      thread?.authorId || '',
      threadAuthor?.fullname || '',
      p.thread.forum.id,
      p.thread.forum.title,
      p.thread.forum.course.id,
      p.thread.forum.course.title,
      p.parentId || '',
      p.parent?.authorId || '',
      parentAuthor?.fullname || '',
      p.parentId ? 'Reply to Post' : 'Reply to Thread',
      p.content.replace(/"/g, '""').replace(/\n/g, ' '),
      p.content.length,
    ];
  });

  // Generate CSV content
  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.map(cell => `"${cell}"`).join(',')),
  ].join('\n');

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename=forum-posts-${new Date().toISOString().slice(0, 10)}.csv`);
  res.send(csvContent);
}));

// Export forum posts as Excel
router.get('/forum-export/excel', asyncHandler(async (req: AuthRequest, res: Response) => {
  // Get all posts with full details
  const posts = await prisma.forumPost.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      thread: {
        include: {
          forum: {
            include: {
              course: { select: { id: true, title: true } },
            },
          },
        },
      },
      parent: {
        select: {
          id: true,
          authorId: true,
          content: true,
        },
      },
    },
  });

  // Get all threads
  const threads = await prisma.forumThread.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      forum: {
        include: {
          course: { select: { id: true, title: true } },
        },
      },
      _count: { select: { posts: true } },
    },
  });

  // Get all user details
  const allUserIds = [
    ...new Set([
      ...posts.flatMap(p => [p.authorId, p.parent?.authorId].filter(Boolean) as number[]),
      ...threads.map(t => t.authorId),
    ]),
  ];
  const users = await prisma.user.findMany({
    where: { id: { in: allUserIds } },
    select: { id: true, fullname: true, email: true },
  });
  const userMap = new Map(users.map(u => [u.id, u]));

  // Get thread map
  const threadMap = new Map(threads.map(t => [t.id, t]));

  // Create workbook
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'LAILA LMS';
  workbook.created = new Date();

  // ===== POSTS SHEET =====
  const postsSheet = workbook.addWorksheet('Posts', {
    views: [{ state: 'frozen', ySplit: 1 }],
  });

  postsSheet.columns = [
    { header: 'Post ID', key: 'postId', width: 10 },
    { header: 'Timestamp', key: 'timestamp', width: 20 },
    { header: 'Author ID', key: 'authorId', width: 10 },
    { header: 'Author Name', key: 'authorName', width: 20 },
    { header: 'Author Email', key: 'authorEmail', width: 25 },
    { header: 'Is Anonymous', key: 'isAnonymous', width: 12 },
    { header: 'Thread ID', key: 'threadId', width: 10 },
    { header: 'Thread Title', key: 'threadTitle', width: 30 },
    { header: 'Thread Author', key: 'threadAuthor', width: 20 },
    { header: 'Forum ID', key: 'forumId', width: 10 },
    { header: 'Forum Title', key: 'forumTitle', width: 25 },
    { header: 'Course ID', key: 'courseId', width: 10 },
    { header: 'Course Title', key: 'courseTitle', width: 30 },
    { header: 'Parent Post ID', key: 'parentPostId', width: 12 },
    { header: 'Replying To (User)', key: 'replyingToUser', width: 20 },
    { header: 'Reply Type', key: 'replyType', width: 15 },
    { header: 'Content', key: 'content', width: 60 },
    { header: 'Content Length', key: 'contentLength', width: 12 },
  ];

  // Style header row
  postsSheet.getRow(1).font = { bold: true };
  postsSheet.getRow(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF4F46E5' },
  };
  postsSheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };

  // Add post data
  posts.forEach(p => {
    const author = userMap.get(p.authorId);
    const parentAuthor = p.parent?.authorId ? userMap.get(p.parent.authorId) : null;
    const thread = threadMap.get(p.threadId);
    const threadAuthor = thread?.authorId ? userMap.get(thread.authorId) : null;

    postsSheet.addRow({
      postId: p.id,
      timestamp: p.createdAt,
      authorId: p.authorId,
      authorName: p.isAnonymous ? 'Anonymous' : (author?.fullname || 'Unknown'),
      authorEmail: p.isAnonymous ? '' : (author?.email || ''),
      isAnonymous: p.isAnonymous ? 'Yes' : 'No',
      threadId: p.threadId,
      threadTitle: thread?.title || '',
      threadAuthor: threadAuthor?.fullname || '',
      forumId: p.thread.forum.id,
      forumTitle: p.thread.forum.title,
      courseId: p.thread.forum.course.id,
      courseTitle: p.thread.forum.course.title,
      parentPostId: p.parentId || '',
      replyingToUser: parentAuthor?.fullname || (p.parentId ? 'Unknown' : threadAuthor?.fullname || ''),
      replyType: p.parentId ? 'Reply to Post' : 'Reply to Thread',
      content: p.content,
      contentLength: p.content.length,
    });
  });

  // ===== THREADS SHEET =====
  const threadsSheet = workbook.addWorksheet('Threads', {
    views: [{ state: 'frozen', ySplit: 1 }],
  });

  threadsSheet.columns = [
    { header: 'Thread ID', key: 'threadId', width: 10 },
    { header: 'Created At', key: 'createdAt', width: 20 },
    { header: 'Title', key: 'title', width: 40 },
    { header: 'Author ID', key: 'authorId', width: 10 },
    { header: 'Author Name', key: 'authorName', width: 20 },
    { header: 'Author Email', key: 'authorEmail', width: 25 },
    { header: 'Forum ID', key: 'forumId', width: 10 },
    { header: 'Forum Title', key: 'forumTitle', width: 25 },
    { header: 'Course ID', key: 'courseId', width: 10 },
    { header: 'Course Title', key: 'courseTitle', width: 30 },
    { header: 'Post Count', key: 'postCount', width: 12 },
    { header: 'Is Pinned', key: 'isPinned', width: 10 },
    { header: 'Is Locked', key: 'isLocked', width: 10 },
  ];

  threadsSheet.getRow(1).font = { bold: true };
  threadsSheet.getRow(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF059669' },
  };
  threadsSheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };

  threads.forEach(t => {
    const author = userMap.get(t.authorId);
    threadsSheet.addRow({
      threadId: t.id,
      createdAt: t.createdAt,
      title: t.title,
      authorId: t.authorId,
      authorName: author?.fullname || 'Unknown',
      authorEmail: author?.email || '',
      forumId: t.forum.id,
      forumTitle: t.forum.title,
      courseId: t.forum.course.id,
      courseTitle: t.forum.course.title,
      postCount: t._count.posts,
      isPinned: t.isPinned ? 'Yes' : 'No',
      isLocked: t.isLocked ? 'Yes' : 'No',
    });
  });

  // ===== SUMMARY SHEET =====
  const summarySheet = workbook.addWorksheet('Summary');

  summarySheet.columns = [
    { header: 'Metric', key: 'metric', width: 25 },
    { header: 'Value', key: 'value', width: 15 },
  ];

  summarySheet.getRow(1).font = { bold: true };
  summarySheet.getRow(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF6366F1' },
  };
  summarySheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };

  const anonymousCount = posts.filter(p => p.isAnonymous).length;
  summarySheet.addRows([
    { metric: 'Total Posts', value: posts.length },
    { metric: 'Total Threads', value: threads.length },
    { metric: 'Anonymous Posts', value: anonymousCount },
    { metric: 'Named Posts', value: posts.length - anonymousCount },
    { metric: 'Unique Authors', value: new Set(posts.map(p => p.authorId)).size },
    { metric: 'Export Date', value: new Date().toISOString() },
  ]);

  // ===== USER ACTIVITY SHEET =====
  const userActivitySheet = workbook.addWorksheet('User Activity');

  userActivitySheet.columns = [
    { header: 'User ID', key: 'userId', width: 10 },
    { header: 'Name', key: 'name', width: 25 },
    { header: 'Email', key: 'email', width: 30 },
    { header: 'Total Posts', key: 'totalPosts', width: 12 },
    { header: 'Threads Started', key: 'threadsStarted', width: 15 },
    { header: 'Replies', key: 'replies', width: 10 },
    { header: 'Anonymous Posts', key: 'anonymousPosts', width: 15 },
  ];

  userActivitySheet.getRow(1).font = { bold: true };
  userActivitySheet.getRow(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFF59E0B' },
  };
  userActivitySheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };

  // Calculate user activity
  const userActivity = new Map<number, { posts: number; threads: number; replies: number; anonymous: number }>();
  posts.forEach(p => {
    const current = userActivity.get(p.authorId) || { posts: 0, threads: 0, replies: 0, anonymous: 0 };
    current.posts++;
    if (p.parentId) current.replies++;
    if (p.isAnonymous) current.anonymous++;
    userActivity.set(p.authorId, current);
  });
  threads.forEach(t => {
    const current = userActivity.get(t.authorId) || { posts: 0, threads: 0, replies: 0, anonymous: 0 };
    current.threads++;
    userActivity.set(t.authorId, current);
  });

  // Sort by total posts descending
  const sortedUsers = Array.from(userActivity.entries())
    .sort((a, b) => b[1].posts - a[1].posts);

  sortedUsers.forEach(([userId, activity]) => {
    const user = userMap.get(userId);
    userActivitySheet.addRow({
      userId,
      name: user?.fullname || 'Unknown',
      email: user?.email || '',
      totalPosts: activity.posts,
      threadsStarted: activity.threads,
      replies: activity.replies,
      anonymousPosts: activity.anonymous,
    });
  });

  // Generate buffer and send
  const buffer = await workbook.xlsx.writeBuffer();

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename=forum-export-${new Date().toISOString().slice(0, 10)}.xlsx`);
  res.send(buffer);
}));

export default router;
