import { Router } from 'express';
import { forumService } from '../services/forum.service.js';
import { authenticateToken, requireInstructor } from '../middleware/auth.middleware.js';
import { asyncHandler } from '../middleware/error.middleware.js';
import { z } from 'zod';

const router = Router();

// Validation schemas
const createForumSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  isPublished: z.boolean().optional(),
  allowAnonymous: z.boolean().optional(),
  orderIndex: z.number().min(0).optional(),
});

const createThreadSchema = z.object({
  title: z.string().min(1).max(300),
  content: z.string().min(1).max(10000),
  isAnonymous: z.boolean().optional(),
});

const createPostSchema = z.object({
  content: z.string().min(1).max(10000),
  parentId: z.number().positive().optional(),
  isAnonymous: z.boolean().optional(),
});

// =========================================================================
// FORUM ROUTES
// =========================================================================

// Get all forums across all enrolled courses for current user
router.get('/', authenticateToken, asyncHandler(async (req, res) => {
  const user = (req as any).user;
  const forums = await forumService.getAllUserForums(user.id, user.isInstructor, user.isAdmin);
  res.json({ success: true, data: forums });
}));

// Get all forums for a course
router.get('/course/:courseId', authenticateToken, asyncHandler(async (req, res) => {
  const courseId = parseInt(req.params.courseId);
  const user = (req as any).user;

  const forums = await forumService.getForums(
    courseId,
    user.id,
    user.isInstructor,
    user.isAdmin
  );

  res.json({ success: true, data: forums });
}));

// Get single forum with recent threads
router.get('/:forumId', authenticateToken, asyncHandler(async (req, res) => {
  const forumId = parseInt(req.params.forumId);
  const user = (req as any).user;

  const forum = await forumService.getForum(
    forumId,
    user.id,
    user.isInstructor,
    user.isAdmin
  );

  res.json({ success: true, data: forum });
}));

// Create forum (instructor only)
router.post('/course/:courseId', authenticateToken, requireInstructor, asyncHandler(async (req, res) => {
  const courseId = parseInt(req.params.courseId);
  const user = (req as any).user;
  const data = createForumSchema.parse(req.body);

  const forum = await forumService.createForum(courseId, user.id, data, user.isAdmin);
  res.status(201).json({ success: true, data: forum });
}));

// Update forum
router.put('/:forumId', authenticateToken, requireInstructor, asyncHandler(async (req, res) => {
  const forumId = parseInt(req.params.forumId);
  const user = (req as any).user;
  const data = createForumSchema.partial().parse(req.body);

  const forum = await forumService.updateForum(forumId, user.id, data, user.isAdmin);
  res.json({ success: true, data: forum });
}));

// Delete forum
router.delete('/:forumId', authenticateToken, requireInstructor, asyncHandler(async (req, res) => {
  const forumId = parseInt(req.params.forumId);
  const user = (req as any).user;

  const result = await forumService.deleteForum(forumId, user.id, user.isAdmin);
  res.json({ success: true, ...result });
}));

// =========================================================================
// THREAD ROUTES
// =========================================================================

// Get threads for a forum (paginated, with enrollment verification)
router.get('/:forumId/threads', authenticateToken, asyncHandler(async (req, res) => {
  const forumId = parseInt(req.params.forumId);
  const page = parseInt(req.query.page as string) || 1;
  const limit = Math.min(parseInt(req.query.limit as string) || 20, 50);
  const user = (req as any).user;

  const result = await forumService.getThreads(forumId, user.id, page, limit, user.isInstructor, user.isAdmin);
  res.json({ success: true, data: result });
}));

// Get single thread with posts (with enrollment verification)
router.get('/threads/:threadId', authenticateToken, asyncHandler(async (req, res) => {
  const threadId = parseInt(req.params.threadId);
  const user = (req as any).user;

  const thread = await forumService.getThread(threadId, user.id, user.isInstructor, user.isAdmin);
  res.json({ success: true, data: thread });
}));

// Create thread
router.post('/:forumId/threads', authenticateToken, asyncHandler(async (req, res) => {
  const forumId = parseInt(req.params.forumId);
  const user = (req as any).user;
  const data = createThreadSchema.parse(req.body);

  const thread = await forumService.createThread(forumId, user.id, data);
  res.status(201).json({ success: true, data: thread });
}));

// Update thread
router.put('/threads/:threadId', authenticateToken, asyncHandler(async (req, res) => {
  const threadId = parseInt(req.params.threadId);
  const user = (req as any).user;
  const data = createThreadSchema.partial().parse(req.body);

  const thread = await forumService.updateThread(threadId, user.id, data, user.isAdmin);
  res.json({ success: true, data: thread });
}));

// Delete thread
router.delete('/threads/:threadId', authenticateToken, asyncHandler(async (req, res) => {
  const threadId = parseInt(req.params.threadId);
  const user = (req as any).user;

  const result = await forumService.deleteThread(threadId, user.id, user.isAdmin);
  res.json({ success: true, ...result });
}));

// Pin/unpin thread (instructor only)
router.put('/threads/:threadId/pin', authenticateToken, requireInstructor, asyncHandler(async (req, res) => {
  const threadId = parseInt(req.params.threadId);
  const user = (req as any).user;
  const { isPinned } = z.object({ isPinned: z.boolean() }).parse(req.body);

  const thread = await forumService.pinThread(threadId, user.id, isPinned, user.isAdmin);
  res.json({ success: true, data: thread });
}));

// Lock/unlock thread (instructor only)
router.put('/threads/:threadId/lock', authenticateToken, requireInstructor, asyncHandler(async (req, res) => {
  const threadId = parseInt(req.params.threadId);
  const user = (req as any).user;
  const { isLocked } = z.object({ isLocked: z.boolean() }).parse(req.body);

  const thread = await forumService.lockThread(threadId, user.id, isLocked, user.isAdmin);
  res.json({ success: true, data: thread });
}));

// =========================================================================
// POST ROUTES
// =========================================================================

// Create post (reply to thread)
router.post('/threads/:threadId/posts', authenticateToken, asyncHandler(async (req, res) => {
  const threadId = parseInt(req.params.threadId);
  const user = (req as any).user;
  const data = createPostSchema.parse(req.body);

  const post = await forumService.createPost(threadId, user.id, data);
  res.status(201).json({ success: true, data: post });
}));

// Update post
router.put('/posts/:postId', authenticateToken, asyncHandler(async (req, res) => {
  const postId = parseInt(req.params.postId);
  const user = (req as any).user;
  const { content } = z.object({ content: z.string().min(1).max(10000) }).parse(req.body);

  const post = await forumService.updatePost(postId, user.id, content, user.isAdmin);
  res.json({ success: true, data: post });
}));

// Delete post
router.delete('/posts/:postId', authenticateToken, asyncHandler(async (req, res) => {
  const postId = parseInt(req.params.postId);
  const user = (req as any).user;

  const result = await forumService.deletePost(postId, user.id, user.isAdmin);
  res.json({ success: true, ...result });
}));

export default router;
