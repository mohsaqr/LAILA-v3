import prisma from '../utils/prisma.js';
import { AppError } from '../middleware/error.middleware.js';
import { createLogger } from '../utils/logger.js';
import { chatService } from './chat.service.js';
import { notificationService } from './notification.service.js';
import { courseRoleService } from './courseRole.service.js';

const logger = createLogger('forum');

/**
 * Forum and ForumThread were merged into a single flat ForumThread model
 * (see migration `forum_collapse_layers`). What used to be a Forum is now
 * just a ForumThread with `courseId` + `moduleId` set directly. To minimize
 * client churn, the public method names keep the legacy "Forum" naming:
 *   - `createForum`, `updateForum`, `deleteForum` operate on a thread.
 *   - `getForums(courseId)` returns the threads for a course.
 *   - `createThread`, `getThreads`, `getForum` are removed (the discussion
 *     *is* the thread).
 */

export interface CreateForumInput {
  title: string;
  content: string;
  description?: string;
  isPublished?: boolean;
  allowAnonymous?: boolean;
  orderIndex?: number;
  moduleId?: number;
  isAnonymous?: boolean;
}

export interface UpdateForumInput {
  title?: string;
  content?: string;
  description?: string;
  isPublished?: boolean;
  allowAnonymous?: boolean;
  orderIndex?: number;
  moduleId?: number | null;
}

export interface CreatePostInput {
  content: string;
  parentId?: number;
  isAnonymous?: boolean;
}

const replyCountInclude = {
  _count: { select: { posts: true } },
} as const;

class ForumService {
  // =========================================================================
  // DISCUSSION (formerly Forum/Thread) CRUD
  // =========================================================================

  /**
   * Cross-course list — used by the student "all my forums" view and the
   * student dashboard. Students see only published discussions in their
   * enrolled courses; instructors see their own courses (including team
   * roles); admins see everything.
   */
  async getAllUserForums(userId: number, isInstructor = false, isAdmin = false) {
    let courseIds: number[] = [];

    if (isAdmin) {
      const courses = await prisma.course.findMany({ select: { id: true } });
      courseIds = courses.map(c => c.id);
    } else if (isInstructor) {
      const ownCourses = await prisma.course.findMany({
        where: { instructorId: userId },
        select: { id: true },
      });
      courseIds = ownCourses.map(c => c.id);
      const teamCourseRoles = await prisma.courseRole.findMany({
        where: { userId },
        select: { courseId: true },
      });
      courseIds = [...new Set([...courseIds, ...teamCourseRoles.map(r => r.courseId)])];
    } else {
      const enrollments = await prisma.enrollment.findMany({
        where: { userId, status: 'active' },
        select: { courseId: true },
      });
      courseIds = enrollments.map(e => e.courseId);
    }

    if (courseIds.length === 0) return [];

    const threads = await prisma.forumThread.findMany({
      where: {
        courseId: { in: courseIds },
        ...(isAdmin || isInstructor ? {} : { isPublished: true }),
      },
      include: {
        course: { select: { id: true, title: true } },
        module: { select: { id: true, title: true } },
        ...replyCountInclude,
      },
      orderBy: [{ isPinned: 'desc' }, { createdAt: 'desc' }],
    });

    return threads.map(t => ({
      id: t.id,
      title: t.title,
      description: t.description,
      courseId: t.courseId,
      courseName: t.course.title,
      moduleId: t.moduleId,
      moduleName: t.module?.title ?? null,
      replyCount: t._count.posts,
      lastActivity: t.updatedAt,
    }));
  }

  /**
   * Instructor view of every discussion in courses they own/team — drives
   * the /teach/forums table.
   */
  async getInstructorForumThreads(userId: number, isAdmin = false) {
    let where: any;
    if (isAdmin) {
      where = {};
    } else {
      const teamRoles = await prisma.courseRole.findMany({
        where: { userId },
        select: { courseId: true },
      });
      const teamCourseIds = teamRoles.map(r => r.courseId);
      where = teamCourseIds.length > 0
        ? { course: { OR: [{ instructorId: userId }, { id: { in: teamCourseIds } }] } }
        : { course: { instructorId: userId } };
    }

    const threads = await prisma.forumThread.findMany({
      where,
      include: {
        course: { select: { id: true, title: true, thumbnail: true } },
        module: { select: { id: true, title: true } },
        ...replyCountInclude,
      },
      orderBy: [{ isPinned: 'desc' }, { createdAt: 'desc' }],
    });

    return threads.map(t => ({
      id: t.id,
      title: t.title,
      description: t.description,
      content: t.content,
      courseId: t.courseId,
      courseName: t.course.title,
      courseThumbnail: t.course.thumbnail,
      moduleId: t.moduleId,
      moduleName: t.module?.title ?? null,
      isPublished: t.isPublished,
      isPinned: t.isPinned,
      isLocked: t.isLocked,
      allowAnonymous: t.allowAnonymous,
      replyCount: t._count.posts,
      authorId: t.authorId,
      createdAt: t.createdAt,
      updatedAt: t.updatedAt,
    }));
  }

  async getForums(courseId: number, userId: number, isInstructor = false, isAdmin = false) {
    // Access check
    if (!isAdmin && !isInstructor) {
      const isTeam = await courseRoleService.isTeamMember(userId, courseId);
      if (!isTeam) {
        const enrollment = await prisma.enrollment.findUnique({
          where: { userId_courseId: { userId, courseId } },
        });
        if (!enrollment) throw new AppError('Not enrolled in this course', 403);
      }
    }

    const threads = await prisma.forumThread.findMany({
      where: {
        courseId,
        ...(isAdmin || isInstructor ? {} : { isPublished: true }),
      },
      include: replyCountInclude,
      orderBy: [{ isPinned: 'desc' }, { orderIndex: 'asc' }, { createdAt: 'desc' }],
    });

    return threads;
  }

  async getModuleForums(moduleId: number, userId: number, isInstructor = false, isAdmin = false) {
    const moduleRow = await prisma.courseModule.findUnique({
      where: { id: moduleId },
      include: { course: { select: { id: true, instructorId: true } } },
    });

    if (!moduleRow) throw new AppError('Module not found', 404);

    const isCourseInstructor = moduleRow.course.instructorId === userId;
    const isTeamMember = !isAdmin && !isCourseInstructor && !isInstructor
      ? await courseRoleService.isTeamMember(userId, moduleRow.course.id)
      : false;
    if (!isAdmin && !isCourseInstructor && !isInstructor && !isTeamMember) {
      const enrollment = await prisma.enrollment.findUnique({
        where: { userId_courseId: { userId, courseId: moduleRow.course.id } },
      });
      if (!enrollment) throw new AppError('Not enrolled in this course', 403);
    }

    const threads = await prisma.forumThread.findMany({
      where: {
        moduleId,
        ...(isAdmin || isCourseInstructor || isInstructor || isTeamMember ? {} : { isPublished: true }),
      },
      include: replyCountInclude,
      orderBy: [{ isPinned: 'desc' }, { orderIndex: 'asc' }],
    });

    return threads;
  }

  async createForum(courseId: number, instructorId: number, data: CreateForumInput, isAdmin = false) {
    const course = await prisma.course.findUnique({ where: { id: courseId } });
    if (!course) throw new AppError('Course not found', 404);
    if (course.instructorId !== instructorId && !isAdmin) {
      const isTeam = await courseRoleService.isTeamMember(instructorId, courseId);
      if (!isTeam) throw new AppError('Not authorized', 403);
    }

    if (data.moduleId) {
      const moduleRow = await prisma.courseModule.findUnique({
        where: { id: data.moduleId },
      });
      if (!moduleRow || moduleRow.courseId !== courseId) {
        throw new AppError('Module does not belong to this course', 400);
      }
    }

    const thread = await prisma.forumThread.create({
      data: {
        courseId,
        moduleId: data.moduleId ?? null,
        authorId: instructorId,
        title: data.title,
        content: data.content,
        description: data.description,
        isPublished: data.isPublished ?? true,
        allowAnonymous: data.allowAnonymous ?? false,
        orderIndex: data.orderIndex ?? 0,
        isAnonymous: data.isAnonymous ?? false,
      },
    });

    logger.info({
      action: 'FORUM_CREATED',
      threadId: thread.id,
      title: data.title,
      courseId,
      courseName: course.title,
      moduleId: data.moduleId ?? null,
      instructorId,
      isPublished: data.isPublished ?? true,
      allowAnonymous: data.allowAnonymous ?? false,
      timestamp: new Date().toISOString(),
    }, `Forum created: "${data.title}" in course "${course.title}"${data.moduleId ? ` (module ${data.moduleId})` : ''}`);

    return thread;
  }

  async updateForum(threadId: number, instructorId: number, data: UpdateForumInput, isAdmin = false) {
    const thread = await prisma.forumThread.findUnique({
      where: { id: threadId },
      include: { course: true },
    });
    if (!thread) throw new AppError('Forum not found', 404);
    if (thread.course.instructorId !== instructorId && !isAdmin) {
      const isTeam = await courseRoleService.isTeamMember(instructorId, thread.courseId);
      if (!isTeam) throw new AppError('Not authorized', 403);
    }

    const updated = await prisma.forumThread.update({
      where: { id: threadId },
      data,
    });

    logger.info({
      action: 'FORUM_UPDATED',
      threadId,
      title: updated.title,
      courseId: thread.courseId,
      courseName: thread.course.title,
      updatedBy: instructorId,
      changes: data,
      timestamp: new Date().toISOString(),
    }, `Forum updated: "${updated.title}" in course "${thread.course.title}"`);

    return updated;
  }

  async deleteForum(threadId: number, instructorId: number, isAdmin = false) {
    const thread = await prisma.forumThread.findUnique({
      where: { id: threadId },
      include: { course: true, _count: { select: { posts: true } } },
    });
    if (!thread) throw new AppError('Forum not found', 404);
    if (thread.course.instructorId !== instructorId && !isAdmin) {
      const isTeam = await courseRoleService.isTeamMember(instructorId, thread.courseId);
      if (!isTeam) throw new AppError('Not authorized', 403);
    }

    await prisma.forumThread.delete({ where: { id: threadId } });

    logger.info({
      action: 'FORUM_DELETED',
      threadId,
      title: thread.title,
      courseId: thread.courseId,
      courseName: thread.course.title,
      deletedBy: instructorId,
      postsDeleted: thread._count.posts,
      timestamp: new Date().toISOString(),
    }, `Forum deleted: "${thread.title}" in course "${thread.course.title}" (had ${thread._count.posts} replies)`);

    return { message: 'Forum deleted' };
  }

  // =========================================================================
  // THREAD READ + INSTRUCTOR ACTIONS
  // =========================================================================

  async getThread(threadId: number, userId: number, isInstructor = false, isAdmin = false) {
    const thread = await prisma.forumThread.findUnique({
      where: { id: threadId },
      include: {
        course: { select: { id: true, title: true, instructorId: true } },
        module: { select: { id: true, title: true } },
        posts: {
          orderBy: { createdAt: 'asc' },
          include: {
            aiAgent: { select: { id: true, name: true, displayName: true, avatarUrl: true } },
            requester: { select: { id: true, fullname: true } },
          },
        },
        _count: { select: { likes: true } },
      },
    });

    if (!thread) throw new AppError('Thread not found', 404);

    const isCourseInstructor = thread.course.instructorId === userId;
    if (!isAdmin && !isCourseInstructor && !isInstructor) {
      const isTeam = await courseRoleService.isTeamMember(userId, thread.courseId);
      if (!isTeam) {
        const enrollment = await prisma.enrollment.findUnique({
          where: { userId_courseId: { userId, courseId: thread.courseId } },
        });
        if (!enrollment) throw new AppError('Not enrolled in this course', 403);
      }
    }
    if (!thread.isPublished && !isAdmin && !isCourseInstructor) {
      const isTeam = await courseRoleService.isTeamMember(userId, thread.courseId);
      if (!isTeam) throw new AppError('Thread not found', 404);
    }

    await prisma.forumThread.update({
      where: { id: threadId },
      data: { viewCount: { increment: 1 } },
    });

    const authorIds = [thread.authorId, ...thread.posts.map(p => p.authorId)];
    const uniqueAuthorIds = [...new Set(authorIds)];
    const authors = await prisma.user.findMany({
      where: { id: { in: uniqueAuthorIds } },
      select: { id: true, fullname: true, isInstructor: true },
    });
    const authorMap = new Map(authors.map(a => [a.id, a]));

    const postsWithAuthors = thread.posts.map(post => ({
      ...post,
      author: post.isAnonymous ? null : authorMap.get(post.authorId),
    }));

    const myLikeRow = await prisma.forumThreadLike.findUnique({
      where: { threadId_userId: { threadId, userId } },
      select: { id: true },
    });

    return {
      ...thread,
      author: thread.isAnonymous ? null : authorMap.get(thread.authorId),
      posts: postsWithAuthors,
      likeCount: thread._count.likes,
      myLike: !!myLikeRow,
    };
  }

  /**
   * Toggle a "like" from `userId` on `threadId`. The (threadId, userId)
   * unique constraint keeps us idempotent: insert when missing, delete
   * when present. Returns the resulting state + the updated total count.
   */
  async toggleThreadLike(threadId: number, userId: number) {
    const thread = await prisma.forumThread.findUnique({
      where: { id: threadId },
      include: { course: { select: { id: true, instructorId: true } } },
    });
    if (!thread) throw new AppError('Thread not found', 404);

    // Same access gate as getThread: enrollment / team / instructor / admin.
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { isAdmin: true, isInstructor: true },
    });
    const isCourseInstructor = thread.course.instructorId === userId;
    if (!user?.isAdmin && !isCourseInstructor) {
      const isTeam = await courseRoleService.isTeamMember(userId, thread.courseId);
      if (!isTeam) {
        const enrollment = await prisma.enrollment.findUnique({
          where: { userId_courseId: { userId, courseId: thread.courseId } },
        });
        if (!enrollment) throw new AppError('Not enrolled in this course', 403);
      }
    }

    const existing = await prisma.forumThreadLike.findUnique({
      where: { threadId_userId: { threadId, userId } },
      select: { id: true },
    });

    let liked: boolean;
    if (existing) {
      await prisma.forumThreadLike.delete({ where: { id: existing.id } });
      liked = false;
    } else {
      await prisma.forumThreadLike.create({ data: { threadId, userId } });
      liked = true;
    }

    const likeCount = await prisma.forumThreadLike.count({ where: { threadId } });
    return { liked, likeCount };
  }

  async updateThread(threadId: number, userId: number, data: { title?: string; content?: string }, isAdmin = false) {
    const thread = await prisma.forumThread.findUnique({
      where: { id: threadId },
      include: { course: true },
    });

    if (!thread) throw new AppError('Thread not found', 404);
    const isTeamForThread = !isAdmin && thread.course.instructorId !== userId
      ? await courseRoleService.isTeamMember(userId, thread.courseId)
      : false;
    if (thread.isLocked && !isAdmin && thread.course.instructorId !== userId && !isTeamForThread) {
      throw new AppError('Thread is locked', 400);
    }
    if (thread.authorId !== userId && !isAdmin && thread.course.instructorId !== userId && !isTeamForThread) {
      throw new AppError('Not authorized', 403);
    }

    const updated = await prisma.forumThread.update({
      where: { id: threadId },
      data,
    });

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { fullname: true, email: true },
    });

    logger.info({
      action: 'THREAD_UPDATED',
      threadId,
      oldTitle: thread.title,
      newTitle: updated.title,
      courseId: thread.courseId,
      courseName: thread.course.title,
      updatedBy: { userId, name: user?.fullname ?? 'Unknown', email: user?.email ?? 'Unknown' },
      titleChanged: data.title !== undefined && data.title !== thread.title,
      contentChanged: data.content !== undefined,
      timestamp: new Date().toISOString(),
    }, `Thread updated: "${updated.title}" by ${user?.fullname ?? 'Unknown'} in course "${thread.course.title}"`);

    return updated;
  }

  async deleteThread(threadId: number, userId: number, isAdmin = false) {
    const thread = await prisma.forumThread.findUnique({
      where: { id: threadId },
      include: { course: true, _count: { select: { posts: true } } },
    });

    if (!thread) throw new AppError('Thread not found', 404);
    if (thread.authorId !== userId && !isAdmin && thread.course.instructorId !== userId) {
      const isTeam = await courseRoleService.isTeamMember(userId, thread.courseId);
      if (!isTeam) throw new AppError('Not authorized', 403);
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { fullname: true, email: true },
    });
    const threadAuthor = await prisma.user.findUnique({
      where: { id: thread.authorId },
      select: { fullname: true },
    });

    await prisma.forumThread.delete({ where: { id: threadId } });

    logger.info({
      action: 'THREAD_DELETED',
      threadId,
      threadTitle: thread.title,
      courseId: thread.courseId,
      courseName: thread.course.title,
      deletedBy: { userId, name: user?.fullname ?? 'Unknown', email: user?.email ?? 'Unknown' },
      threadAuthor: {
        userId: thread.authorId,
        name: thread.isAnonymous ? 'Anonymous' : (threadAuthor?.fullname ?? 'Unknown'),
      },
      postsDeleted: thread._count.posts,
      timestamp: new Date().toISOString(),
    }, `Thread deleted: "${thread.title}" by ${user?.fullname ?? 'Unknown'} (had ${thread._count.posts} posts)`);

    return { message: 'Thread deleted' };
  }

  async pinThread(threadId: number, userId: number, isPinned: boolean, isAdmin = false) {
    const thread = await prisma.forumThread.findUnique({
      where: { id: threadId },
      include: { course: true },
    });
    if (!thread) throw new AppError('Thread not found', 404);
    if (!isAdmin && thread.course.instructorId !== userId) {
      const isTeam = await courseRoleService.isTeamMember(userId, thread.courseId);
      if (!isTeam) throw new AppError('Not authorized', 403);
    }

    const updated = await prisma.forumThread.update({
      where: { id: threadId },
      data: { isPinned },
    });

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { fullname: true },
    });

    logger.info({
      action: isPinned ? 'THREAD_PINNED' : 'THREAD_UNPINNED',
      threadId,
      threadTitle: thread.title,
      courseId: thread.courseId,
      courseName: thread.course.title,
      actionBy: { userId, name: user?.fullname ?? 'Unknown' },
      timestamp: new Date().toISOString(),
    }, `Thread ${isPinned ? 'pinned' : 'unpinned'}: "${thread.title}" by ${user?.fullname ?? 'Unknown'}`);

    return updated;
  }

  async lockThread(threadId: number, userId: number, isLocked: boolean, isAdmin = false) {
    const thread = await prisma.forumThread.findUnique({
      where: { id: threadId },
      include: { course: true },
    });
    if (!thread) throw new AppError('Thread not found', 404);
    if (!isAdmin && thread.course.instructorId !== userId) {
      const isTeam = await courseRoleService.isTeamMember(userId, thread.courseId);
      if (!isTeam) throw new AppError('Not authorized', 403);
    }

    const updated = await prisma.forumThread.update({
      where: { id: threadId },
      data: { isLocked },
    });

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { fullname: true },
    });

    logger.info({
      action: isLocked ? 'THREAD_LOCKED' : 'THREAD_UNLOCKED',
      threadId,
      threadTitle: thread.title,
      courseId: thread.courseId,
      courseName: thread.course.title,
      actionBy: { userId, name: user?.fullname ?? 'Unknown' },
      timestamp: new Date().toISOString(),
    }, `Thread ${isLocked ? 'locked' : 'unlocked'}: "${thread.title}" by ${user?.fullname ?? 'Unknown'}`);

    return updated;
  }

  // =========================================================================
  // POST (reply) CRUD
  // =========================================================================

  async createPost(threadId: number, userId: number, data: CreatePostInput) {
    const thread = await prisma.forumThread.findUnique({
      where: { id: threadId },
      include: { course: true },
    });

    if (!thread) throw new AppError('Thread not found', 404);

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, fullname: true, email: true, isAdmin: true, isInstructor: true },
    });

    const isCourseOwner = thread.course.instructorId === userId;
    const isTeamForPost = !user?.isAdmin && !isCourseOwner
      ? await courseRoleService.isTeamMember(userId, thread.courseId)
      : false;

    if (thread.isLocked && !user?.isAdmin && !isCourseOwner && !isTeamForPost) {
      throw new AppError('Thread is locked', 400);
    }

    if (!user?.isAdmin && !isCourseOwner && !isTeamForPost) {
      const enrollment = await prisma.enrollment.findUnique({
        where: { userId_courseId: { userId, courseId: thread.courseId } },
      });
      if (!enrollment) throw new AppError('Not enrolled in this course', 403);
    }

    let parentPostInfo: { id: number; authorId: number; authorName: string; content: string } | null = null;
    if (data.parentId) {
      const parentPost = await prisma.forumPost.findUnique({
        where: { id: data.parentId },
      });
      if (!parentPost || parentPost.threadId !== threadId) {
        throw new AppError('Invalid parent post', 400);
      }
      const parentAuthor = await prisma.user.findUnique({
        where: { id: parentPost.authorId },
        select: { id: true, fullname: true },
      });
      parentPostInfo = {
        id: parentPost.id,
        authorId: parentPost.authorId,
        authorName: parentPost.isAnonymous ? 'Anonymous' : (parentAuthor?.fullname ?? 'Unknown'),
        content: parentPost.content.substring(0, 200) + (parentPost.content.length > 200 ? '...' : ''),
      };
    }

    const threadAuthor = await prisma.user.findUnique({
      where: { id: thread.authorId },
      select: { fullname: true },
    });

    if (data.isAnonymous && !thread.allowAnonymous) {
      throw new AppError('Anonymous posting is not allowed in this discussion', 400);
    }

    const post = await prisma.forumPost.create({
      data: {
        threadId,
        authorId: userId,
        content: data.content,
        parentId: data.parentId,
        isAnonymous: data.isAnonymous ?? false,
      },
    });

    const isReplyToPost = !!data.parentId;
    logger.info({
      action: 'POST_CREATED',
      replyType: isReplyToPost ? 'REPLY_TO_POST' : 'REPLY_TO_THREAD',
      postId: post.id,
      threadId,
      threadTitle: thread.title,
      courseId: thread.courseId,
      courseName: thread.course.title,
      author: {
        userId,
        name: user?.fullname ?? 'Unknown',
        email: user?.email ?? 'Unknown',
        isAnonymous: data.isAnonymous ?? false,
      },
      threadAuthor: {
        userId: thread.authorId,
        name: thread.isAnonymous ? 'Anonymous' : (threadAuthor?.fullname ?? 'Unknown'),
      },
      parentPost: parentPostInfo,
      content: data.content.substring(0, 500) + (data.content.length > 500 ? '...' : ''),
      contentLength: data.content.length,
      timestamp: new Date().toISOString(),
    }, `Post created: ${user?.fullname ?? 'Unknown'} ${isReplyToPost ? `replied to ${parentPostInfo?.authorName}'s post` : `replied to thread "${thread.title}"`}`);

    if (thread.authorId !== userId && !thread.isAnonymous) {
      notificationService.notifyForumReply({
        userId: thread.authorId,
        courseId: thread.courseId,
        forumId: thread.id, // legacy field name kept on the notification payload
        threadId: thread.id,
        threadTitle: thread.title,
        replierName: data.isAnonymous ? 'Someone' : (user?.fullname ?? 'A user'),
      }).catch(err => {
        logger.warn({ err, threadId, userId }, 'Failed to send forum reply notification');
      });
    }

    if (parentPostInfo && parentPostInfo.authorId !== userId && parentPostInfo.authorId !== thread.authorId) {
      notificationService.notifyForumReply({
        userId: parentPostInfo.authorId,
        courseId: thread.courseId,
        forumId: thread.id,
        threadId: thread.id,
        threadTitle: thread.title,
        replierName: data.isAnonymous ? 'Someone' : (user?.fullname ?? 'A user'),
      }).catch(err => {
        logger.warn({ err, threadId, postId: parentPostInfo!.id, userId }, 'Failed to send forum reply notification to post author');
      });
    }

    return post;
  }

  async updatePost(postId: number, userId: number, content: string, isAdmin = false) {
    const post = await prisma.forumPost.findUnique({
      where: { id: postId },
      include: { thread: { include: { course: true } } },
    });

    if (!post) throw new AppError('Post not found', 404);
    const isTeamForPostUpdate = !isAdmin && post.thread.course.instructorId !== userId
      ? await courseRoleService.isTeamMember(userId, post.thread.courseId)
      : false;
    if (post.thread.isLocked && !isAdmin && post.thread.course.instructorId !== userId && !isTeamForPostUpdate) {
      throw new AppError('Thread is locked', 400);
    }
    if (post.authorId !== userId && !isAdmin && post.thread.course.instructorId !== userId && !isTeamForPostUpdate) {
      throw new AppError('Not authorized', 403);
    }

    const oldContent = post.content;
    const updatedPost = await prisma.forumPost.update({
      where: { id: postId },
      data: { content, isEdited: true },
    });

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { fullname: true, email: true },
    });

    logger.info({
      action: 'POST_UPDATED',
      postId,
      threadId: post.threadId,
      threadTitle: post.thread.title,
      courseId: post.thread.courseId,
      courseName: post.thread.course.title,
      editedBy: { userId, name: user?.fullname ?? 'Unknown', email: user?.email ?? 'Unknown' },
      oldContent: oldContent.substring(0, 300) + (oldContent.length > 300 ? '...' : ''),
      newContent: content.substring(0, 300) + (content.length > 300 ? '...' : ''),
      timestamp: new Date().toISOString(),
    }, `Post updated: ${user?.fullname ?? 'Unknown'} edited post #${postId} in thread "${post.thread.title}"`);

    return updatedPost;
  }

  async deletePost(postId: number, userId: number, isAdmin = false) {
    const post = await prisma.forumPost.findUnique({
      where: { id: postId },
      include: {
        thread: { include: { course: true } },
        _count: { select: { replies: true } },
      },
    });

    if (!post) throw new AppError('Post not found', 404);
    if (post.authorId !== userId && !isAdmin && post.thread.course.instructorId !== userId) {
      const isTeam = await courseRoleService.isTeamMember(userId, post.thread.courseId);
      if (!isTeam) throw new AppError('Not authorized', 403);
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { fullname: true, email: true },
    });
    const postAuthor = await prisma.user.findUnique({
      where: { id: post.authorId },
      select: { fullname: true },
    });

    let parentPostInfo = null;
    if (post.parentId) {
      const parentPost = await prisma.forumPost.findUnique({
        where: { id: post.parentId },
      });
      if (parentPost) {
        const parentAuthor = await prisma.user.findUnique({
          where: { id: parentPost.authorId },
          select: { fullname: true },
        });
        parentPostInfo = {
          postId: parentPost.id,
          authorName: parentPost.isAnonymous ? 'Anonymous' : (parentAuthor?.fullname ?? 'Unknown'),
        };
      }
    }

    await prisma.forumPost.delete({ where: { id: postId } });

    const postAuthorName = post.isAnonymous ? 'Anonymous' : (postAuthor?.fullname ?? 'Unknown');
    logger.info({
      action: 'POST_DELETED',
      postId,
      threadId: post.threadId,
      threadTitle: post.thread.title,
      courseId: post.thread.courseId,
      courseName: post.thread.course.title,
      deletedBy: { userId, name: user?.fullname ?? 'Unknown', email: user?.email ?? 'Unknown' },
      postAuthor: { userId: post.authorId, name: postAuthorName },
      parentPost: parentPostInfo,
      wasReplyToPost: !!post.parentId,
      deletedContent: post.content.substring(0, 300) + (post.content.length > 300 ? '...' : ''),
      repliesDeleted: post._count.replies,
      timestamp: new Date().toISOString(),
    }, `Post deleted: ${user?.fullname ?? 'Unknown'} deleted post #${postId} by ${postAuthorName} in thread "${post.thread.title}"`);

    return { message: 'Post deleted' };
  }

  // =========================================================================
  // AI AGENT INTEGRATION
  // =========================================================================

  async getAvailableAgents(courseId: number) {
    const chatbots = await prisma.chatbot.findMany({
      where: { isActive: true, category: 'tutor' },
      select: {
        id: true, name: true, displayName: true,
        description: true, avatarUrl: true, personality: true,
      },
      orderBy: { displayName: 'asc' },
    });

    const courseTutors = await prisma.courseTutor.findMany({
      where: { courseId, isActive: true },
      include: {
        chatbot: {
          select: {
            id: true, name: true, displayName: true,
            description: true, avatarUrl: true, personality: true,
          },
        },
      },
      orderBy: { displayOrder: 'asc' },
    });

    const agentMap = new Map();
    for (const ct of courseTutors) {
      agentMap.set(ct.chatbot.id, {
        id: ct.chatbot.id,
        name: ct.chatbot.name,
        displayName: ct.customName || ct.chatbot.displayName,
        description: ct.customDescription || ct.chatbot.description,
        avatarUrl: ct.chatbot.avatarUrl,
        personality: ct.customPersonality || ct.chatbot.personality,
        isCourseSpecific: true,
      });
    }
    for (const bot of chatbots) {
      if (!agentMap.has(bot.id)) {
        agentMap.set(bot.id, { ...bot, isCourseSpecific: false });
      }
    }
    return Array.from(agentMap.values());
  }

  private buildForumContext(
    thread: {
      title: string;
      content: string;
      author?: { fullname: string } | null;
      isAnonymous: boolean;
      posts: Array<{
        id: number;
        content: string;
        author?: { fullname: string } | null;
        isAnonymous: boolean;
        isAiGenerated: boolean;
        aiAgentName?: string | null;
        createdAt: Date;
      }>;
    },
    parentPost?: {
      id: number;
      content: string;
      author?: { fullname: string } | null;
      isAnonymous: boolean;
    } | null,
    courseContext?: { title: string } | null,
  ): string {
    const lines: string[] = [];
    if (courseContext?.title) {
      lines.push(`Course: ${courseContext.title}`);
      lines.push('');
    }
    const threadAuthor = thread.isAnonymous ? 'Anonymous Student' : (thread.author?.fullname ?? 'Unknown');
    lines.push(`Discussion: "${thread.title}"`);
    lines.push(`Started by: ${threadAuthor}`);
    lines.push(`Original question/topic:`);
    lines.push(thread.content);
    lines.push('');

    if (thread.posts.length > 0) {
      lines.push('--- Discussion so far ---');
      for (const post of thread.posts) {
        let authorName: string;
        if (post.isAiGenerated && post.aiAgentName) {
          authorName = `${post.aiAgentName} (AI Tutor)`;
        } else if (post.isAnonymous) {
          authorName = 'Anonymous Student';
        } else {
          authorName = post.author?.fullname ?? 'Unknown';
        }
        lines.push(`\n[${authorName}]:`);
        lines.push(post.content);
      }
      lines.push('');
    }

    if (parentPost) {
      const parentAuthor = parentPost.isAnonymous ? 'Anonymous Student' : (parentPost.author?.fullname ?? 'Unknown');
      lines.push('--- You are specifically replying to this post ---');
      lines.push(`[${parentAuthor}]:`);
      lines.push(parentPost.content);
      lines.push('');
    }

    return lines.join('\n');
  }

  async createAiPost(threadId: number, requestingUserId: number, agentId: number, parentId?: number) {
    const thread = await prisma.forumThread.findUnique({
      where: { id: threadId },
      include: {
        course: { select: { id: true, title: true, instructorId: true } },
        posts: { orderBy: { createdAt: 'asc' } },
      },
    });

    if (!thread) throw new AppError('Thread not found', 404);
    if (thread.isLocked) throw new AppError('Thread is locked', 400);

    const user = await prisma.user.findUnique({
      where: { id: requestingUserId },
      select: { id: true, fullname: true, email: true, isAdmin: true, isInstructor: true },
    });

    if (!user?.isAdmin && thread.course.instructorId !== requestingUserId) {
      const isTeam = await courseRoleService.isTeamMember(requestingUserId, thread.courseId);
      if (!isTeam) {
        const enrollment = await prisma.enrollment.findUnique({
          where: { userId_courseId: { userId: requestingUserId, courseId: thread.courseId } },
        });
        if (!enrollment) throw new AppError('Not enrolled in this course', 403);
      }
    }

    const agent = await prisma.chatbot.findUnique({ where: { id: agentId } });
    if (!agent || !agent.isActive) throw new AppError('AI agent not available', 404);

    const threadAuthor = await prisma.user.findUnique({
      where: { id: thread.authorId },
      select: { fullname: true },
    });

    let parentPost: {
      id: number;
      content: string;
      author?: { fullname: string } | null;
      isAnonymous: boolean;
    } | null = null;
    if (parentId) {
      const fetchedParent = await prisma.forumPost.findUnique({ where: { id: parentId } });
      if (!fetchedParent || fetchedParent.threadId !== threadId) {
        throw new AppError('Invalid parent post', 400);
      }
      const parentAuthor = await prisma.user.findUnique({
        where: { id: fetchedParent.authorId },
        select: { fullname: true },
      });
      parentPost = {
        id: fetchedParent.id,
        content: fetchedParent.content,
        author: parentAuthor,
        isAnonymous: fetchedParent.isAnonymous,
      };
    }

    const postAuthorIds = [...new Set(thread.posts.map(p => p.authorId))];
    const postAuthors = await prisma.user.findMany({
      where: { id: { in: postAuthorIds } },
      select: { id: true, fullname: true },
    });
    const postAuthorMap = new Map(postAuthors.map(a => [a.id, a]));

    const forumContext = this.buildForumContext(
      {
        title: thread.title,
        content: thread.content,
        author: thread.isAnonymous ? null : threadAuthor,
        isAnonymous: thread.isAnonymous,
        posts: thread.posts.map(p => ({
          id: p.id,
          content: p.content,
          author: postAuthorMap.get(p.authorId) || null,
          isAnonymous: p.isAnonymous,
          isAiGenerated: p.isAiGenerated,
          aiAgentName: p.aiAgentName,
          createdAt: p.createdAt,
        })),
      },
      parentPost,
      thread.course,
    );

    const systemPrompt = `${agent.systemPrompt}

You are participating in a student forum discussion. Your role is to help students learn by providing thoughtful, educational responses.

Guidelines:
- Be supportive and encouraging
- Ask follow-up questions to deepen understanding
- Connect concepts to course material when relevant
- Keep responses focused and not too long (2-4 paragraphs typically)
- If you're unsure about specific course content, acknowledge this
- Remember you're visible to all students in the course

${agent.knowledgeContext ? `Additional context: ${agent.knowledgeContext}` : ''}`;

    const userMessage = parentPost
      ? `Please respond to this specific post in the discussion. Consider the full thread context above.`
      : `Please contribute to this discussion thread. Consider what has been said so far and add something helpful.`;

    const aiResponse = await chatService.chat({
      message: userMessage,
      module: 'forum-ai-agent',
      systemPrompt,
      context: forumContext,
      temperature: agent.temperature ?? 0.7,
    }, requestingUserId);

    const post = await prisma.forumPost.create({
      data: {
        threadId,
        authorId: requestingUserId,
        content: aiResponse.reply,
        parentId,
        isAnonymous: false,
        isAiGenerated: true,
        aiAgentId: agent.id,
        aiAgentName: agent.displayName,
        aiRequestedBy: requestingUserId,
      },
      include: {
        aiAgent: { select: { id: true, name: true, displayName: true, avatarUrl: true } },
        requester: { select: { id: true, fullname: true } },
      },
    });

    const postAuthor = await prisma.user.findUnique({
      where: { id: post.authorId },
      select: { id: true, fullname: true },
    });

    logger.info({
      action: 'AI_POST_CREATED',
      postId: post.id,
      threadId,
      threadTitle: thread.title,
      courseId: thread.courseId,
      courseName: thread.course.title,
      aiAgent: { id: agent.id, name: agent.name, displayName: agent.displayName },
      requestedBy: {
        userId: requestingUserId,
        name: user?.fullname ?? 'Unknown',
        email: user?.email ?? 'Unknown',
      },
      parentPostId: parentId ?? null,
      responseTime: aiResponse.responseTime,
      model: aiResponse.model,
      timestamp: new Date().toISOString(),
    }, `AI post created: ${agent.displayName} replied in thread "${thread.title}" (requested by ${user?.fullname})`);

    return { ...post, author: postAuthor };
  }
}

export const forumService = new ForumService();
