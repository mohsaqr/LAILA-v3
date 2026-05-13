import { Router } from 'express';
import { forumService } from '../services/forum.service.js';
import { authenticateToken, requireInstructor } from '../middleware/auth.middleware.js';
import { asyncHandler } from '../middleware/error.middleware.js';
import { forumAiLimiter } from '../middleware/rateLimit.middleware.js';
import { z } from 'zod';

const router = Router();

/**
 * After the forum_collapse_layers migration, each "forum" is just a
 * ForumThread with `courseId` set directly. Legacy URLs that referenced
 * `forumId` now operate on the same numeric id (renamed conceptually).
 */

const createForumSchema = z.object({
  title: z.string().min(1).max(200),
  content: z.string().min(1).max(50000),
  description: z.string().max(1000).optional(),
  isPublished: z.boolean().optional(),
  allowAnonymous: z.boolean().optional(),
  orderIndex: z.number().min(0).optional(),
  moduleId: z.number().positive().optional(),
  isAnonymous: z.boolean().optional(),
});

const updateForumSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  content: z.string().min(1).max(50000).optional(),
  description: z.string().max(1000).optional(),
  isPublished: z.boolean().optional(),
  allowAnonymous: z.boolean().optional(),
  orderIndex: z.number().min(0).optional(),
  moduleId: z.number().positive().nullable().optional(),
});

const createPostSchema = z.object({
  content: z.string().min(1).max(50000),
  parentId: z.number().positive().optional(),
  isAnonymous: z.boolean().optional(),
});

// =========================================================================
// FORUM / DISCUSSION ROUTES
// =========================================================================

// Cross-course list (student view): published discussions in courses the
// user is enrolled in / teaches / admins on.
router.get('/', authenticateToken, asyncHandler(async (req, res) => {
  const user = (req as any).user;
  const forums = await forumService.getAllUserForums(user.id, user.isInstructor, user.isAdmin);
  res.json({ success: true, data: forums });
}));

// Cross-course list for the /teach/forums DataTable (instructor view).
router.get('/instructor', authenticateToken, requireInstructor, asyncHandler(async (req, res) => {
  const user = (req as any).user;
  const threads = await forumService.getInstructorForumThreads(user.id, user.isAdmin);
  res.json({ success: true, data: threads });
}));

// All discussions for a course.
router.get('/course/:courseId', authenticateToken, asyncHandler(async (req, res) => {
  const courseId = parseInt(req.params.courseId);
  const user = (req as any).user;
  const forums = await forumService.getForums(courseId, user.id, user.isInstructor, user.isAdmin);
  res.json({ success: true, data: forums });
}));

// Discussions scoped to a single module.
router.get('/module/:moduleId', authenticateToken, asyncHandler(async (req, res) => {
  const moduleId = parseInt(req.params.moduleId);
  const user = (req as any).user;
  const forums = await forumService.getModuleForums(moduleId, user.id, user.isInstructor, user.isAdmin);
  res.json({ success: true, data: forums });
}));

// Create a discussion (instructor only).
router.post('/course/:courseId', authenticateToken, requireInstructor, asyncHandler(async (req, res) => {
  const courseId = parseInt(req.params.courseId);
  const user = (req as any).user;
  const data = createForumSchema.parse(req.body);
  const forum = await forumService.createForum(courseId, user.id, data, user.isAdmin);
  res.status(201).json({ success: true, data: forum });
}));

// Update a discussion (title / content / publish / settings).
router.put('/:threadId', authenticateToken, requireInstructor, asyncHandler(async (req, res) => {
  const threadId = parseInt(req.params.threadId);
  const user = (req as any).user;
  const data = updateForumSchema.parse(req.body);
  const forum = await forumService.updateForum(threadId, user.id, data, user.isAdmin);
  res.json({ success: true, data: forum });
}));

// Delete a discussion.
router.delete('/:threadId', authenticateToken, requireInstructor, asyncHandler(async (req, res) => {
  const threadId = parseInt(req.params.threadId);
  const user = (req as any).user;
  const result = await forumService.deleteForum(threadId, user.id, user.isAdmin);
  res.json({ success: true, ...result });
}));

// =========================================================================
// THREAD READ + INSTRUCTOR ACTIONS
// =========================================================================

// Single discussion with its replies.
router.get('/threads/:threadId', authenticateToken, asyncHandler(async (req, res) => {
  const threadId = parseInt(req.params.threadId);
  const user = (req as any).user;
  const thread = await forumService.getThread(threadId, user.id, user.isInstructor, user.isAdmin);
  res.json({ success: true, data: thread });
}));

router.put('/threads/:threadId', authenticateToken, asyncHandler(async (req, res) => {
  const threadId = parseInt(req.params.threadId);
  const user = (req as any).user;
  const data = z.object({
    title: z.string().min(1).max(300).optional(),
    content: z.string().min(1).max(50000).optional(),
  }).parse(req.body);
  const thread = await forumService.updateThread(threadId, user.id, data, user.isAdmin);
  res.json({ success: true, data: thread });
}));

router.delete('/threads/:threadId', authenticateToken, asyncHandler(async (req, res) => {
  const threadId = parseInt(req.params.threadId);
  const user = (req as any).user;
  const result = await forumService.deleteThread(threadId, user.id, user.isAdmin);
  res.json({ success: true, ...result });
}));

router.put('/threads/:threadId/pin', authenticateToken, requireInstructor, asyncHandler(async (req, res) => {
  const threadId = parseInt(req.params.threadId);
  const user = (req as any).user;
  const { isPinned } = z.object({ isPinned: z.boolean() }).parse(req.body);
  const thread = await forumService.pinThread(threadId, user.id, isPinned, user.isAdmin);
  res.json({ success: true, data: thread });
}));

router.put('/threads/:threadId/lock', authenticateToken, requireInstructor, asyncHandler(async (req, res) => {
  const threadId = parseInt(req.params.threadId);
  const user = (req as any).user;
  const { isLocked } = z.object({ isLocked: z.boolean() }).parse(req.body);
  const thread = await forumService.lockThread(threadId, user.id, isLocked, user.isAdmin);
  res.json({ success: true, data: thread });
}));

// Toggle a "like" by the current user on this discussion. Idempotent via
// the (threadId, userId) unique constraint — POSTing twice toggles off.
router.post('/threads/:threadId/like', authenticateToken, asyncHandler(async (req, res) => {
  const threadId = parseInt(req.params.threadId);
  const user = (req as any).user;
  const result = await forumService.toggleThreadLike(threadId, user.id);
  res.json({ success: true, data: result });
}));

// =========================================================================
// POST (reply) ROUTES
// =========================================================================

router.post('/threads/:threadId/posts', authenticateToken, asyncHandler(async (req, res) => {
  const threadId = parseInt(req.params.threadId);
  const user = (req as any).user;
  const data = createPostSchema.parse(req.body);
  const post = await forumService.createPost(threadId, user.id, data);
  res.status(201).json({ success: true, data: post });
}));

router.put('/posts/:postId', authenticateToken, asyncHandler(async (req, res) => {
  const postId = parseInt(req.params.postId);
  const user = (req as any).user;
  const { content } = z.object({ content: z.string().min(1).max(50000) }).parse(req.body);
  const post = await forumService.updatePost(postId, user.id, content, user.isAdmin);
  res.json({ success: true, data: post });
}));

router.delete('/posts/:postId', authenticateToken, asyncHandler(async (req, res) => {
  const postId = parseInt(req.params.postId);
  const user = (req as any).user;
  const result = await forumService.deletePost(postId, user.id, user.isAdmin);
  res.json({ success: true, ...result });
}));

// =========================================================================
// AI AGENT ROUTES
// =========================================================================

router.get('/course/:courseId/agents', authenticateToken, asyncHandler(async (req, res) => {
  const courseId = parseInt(req.params.courseId);
  const agents = await forumService.getAvailableAgents(courseId);
  res.json({ success: true, data: agents });
}));

const createAiPostSchema = z.object({
  agentId: z.number().positive(),
  parentId: z.number().positive().optional(),
});

router.post('/threads/:threadId/ai-post', authenticateToken, forumAiLimiter, asyncHandler(async (req, res) => {
  const threadId = parseInt(req.params.threadId);
  const user = (req as any).user;
  const { agentId, parentId } = createAiPostSchema.parse(req.body);
  const post = await forumService.createAiPost(threadId, user.id, agentId, parentId);
  res.status(201).json({ success: true, data: post });
}));

export default router;
