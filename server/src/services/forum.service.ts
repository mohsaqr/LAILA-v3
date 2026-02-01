import prisma from '../utils/prisma.js';
import { AppError } from '../middleware/error.middleware.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('forum');

export interface CreateForumInput {
  title: string;
  description?: string;
  isPublished?: boolean;
  allowAnonymous?: boolean;
  orderIndex?: number;
}

export interface CreateThreadInput {
  title: string;
  content: string;
  isAnonymous?: boolean;
}

export interface CreatePostInput {
  content: string;
  parentId?: number;
  isAnonymous?: boolean;
}

class ForumService {
  // =========================================================================
  // FORUM CRUD
  // =========================================================================

  /**
   * Get all forums across all courses the user has access to
   */
  async getAllUserForums(userId: number, isInstructor = false, isAdmin = false) {
    let courseIds: number[] = [];

    if (isAdmin) {
      // Admins see all published forums
      const courses = await prisma.course.findMany({
        select: { id: true },
      });
      courseIds = courses.map(c => c.id);
    } else if (isInstructor) {
      // Instructors see forums from their courses and enrolled courses
      const [ownCourses, enrollments] = await Promise.all([
        prisma.course.findMany({
          where: { instructorId: userId },
          select: { id: true },
        }),
        prisma.enrollment.findMany({
          where: { userId, status: 'active' },
          select: { courseId: true },
        }),
      ]);
      courseIds = [
        ...ownCourses.map(c => c.id),
        ...enrollments.map(e => e.courseId),
      ];
    } else {
      // Students see forums from enrolled courses
      const enrollments = await prisma.enrollment.findMany({
        where: { userId, status: 'active' },
        select: { courseId: true },
      });
      courseIds = enrollments.map(e => e.courseId);
    }

    if (courseIds.length === 0) {
      return [];
    }

    const forums = await prisma.forum.findMany({
      where: {
        courseId: { in: courseIds },
        isPublished: true,
      },
      include: {
        course: { select: { id: true, title: true } },
        _count: { select: { threads: true } },
        threads: {
          select: { createdAt: true },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return forums.map(forum => ({
      id: forum.id,
      title: forum.title,
      description: forum.description,
      courseId: forum.courseId,
      courseName: forum.course.title,
      threadCount: forum._count.threads,
      lastActivity: forum.threads[0]?.createdAt || null,
    }));
  }

  async getForums(courseId: number, userId: number, isInstructor = false, isAdmin = false) {
    // Check enrollment/access
    if (!isAdmin && !isInstructor) {
      const enrollment = await prisma.enrollment.findUnique({
        where: { userId_courseId: { userId, courseId } },
      });

      if (!enrollment) {
        throw new AppError('Not enrolled in this course', 403);
      }
    }

    const forums = await prisma.forum.findMany({
      where: {
        courseId,
        ...(isAdmin || isInstructor ? {} : { isPublished: true }),
      },
      include: {
        _count: { select: { threads: true } },
      },
      orderBy: [{ orderIndex: 'asc' }, { createdAt: 'desc' }],
    });

    return forums;
  }

  async getForum(forumId: number, userId: number, isInstructor = false, isAdmin = false) {
    const forum = await prisma.forum.findUnique({
      where: { id: forumId },
      include: {
        course: { select: { id: true, title: true, instructorId: true } },
        threads: {
          include: {
            posts: {
              where: { parentId: null },
              select: { id: true },
            },
          },
          orderBy: [{ isPinned: 'desc' }, { createdAt: 'desc' }],
          take: 20,
        },
        _count: { select: { threads: true } },
      },
    });

    if (!forum) throw new AppError('Forum not found', 404);
    if (!forum.isPublished && !isAdmin && forum.course.instructorId !== userId) {
      throw new AppError('Forum not found', 404);
    }

    // Get author info for threads
    const authorIds = [...new Set(forum.threads.map(t => t.authorId))];
    const authors = await prisma.user.findMany({
      where: { id: { in: authorIds } },
      select: { id: true, fullname: true },
    });
    const authorMap = new Map(authors.map(a => [a.id, a]));

    // Transform threads with reply counts and author info
    const threadsWithInfo = forum.threads.map(thread => ({
      ...thread,
      author: thread.isAnonymous ? null : authorMap.get(thread.authorId),
      replyCount: thread.posts.length,
      posts: undefined,
    }));

    return {
      ...forum,
      threads: threadsWithInfo,
    };
  }

  async createForum(courseId: number, instructorId: number, data: CreateForumInput, isAdmin = false) {
    // Verify ownership
    const course = await prisma.course.findUnique({
      where: { id: courseId },
    });

    if (!course) throw new AppError('Course not found', 404);
    if (course.instructorId !== instructorId && !isAdmin) {
      throw new AppError('Not authorized', 403);
    }

    const forum = await prisma.forum.create({
      data: {
        courseId,
        title: data.title,
        description: data.description,
        isPublished: data.isPublished ?? true,
        allowAnonymous: data.allowAnonymous ?? false,
        orderIndex: data.orderIndex ?? 0,
      },
    });

    logger.info({
      action: 'FORUM_CREATED',
      forumId: forum.id,
      forumTitle: data.title,
      courseId,
      courseName: course.title,
      instructorId,
      isPublished: data.isPublished ?? true,
      allowAnonymous: data.allowAnonymous ?? false,
      description: data.description || null,
      timestamp: new Date().toISOString(),
    }, `Forum created: "${data.title}" in course "${course.title}"`);

    return forum;
  }

  async updateForum(forumId: number, instructorId: number, data: Partial<CreateForumInput>, isAdmin = false) {
    const forum = await prisma.forum.findUnique({
      where: { id: forumId },
      include: { course: true },
    });

    if (!forum) throw new AppError('Forum not found', 404);
    if (forum.course.instructorId !== instructorId && !isAdmin) {
      throw new AppError('Not authorized', 403);
    }

    const updatedForum = await prisma.forum.update({
      where: { id: forumId },
      data,
    });

    logger.info({
      action: 'FORUM_UPDATED',
      forumId,
      forumTitle: updatedForum.title,
      courseId: forum.courseId,
      courseName: forum.course.title,
      updatedBy: instructorId,
      changes: data,
      timestamp: new Date().toISOString(),
    }, `Forum updated: "${updatedForum.title}" in course "${forum.course.title}"`);

    return updatedForum;
  }

  async deleteForum(forumId: number, instructorId: number, isAdmin = false) {
    const forum = await prisma.forum.findUnique({
      where: { id: forumId },
      include: {
        course: true,
        _count: { select: { threads: true } },
      },
    });

    if (!forum) throw new AppError('Forum not found', 404);
    if (forum.course.instructorId !== instructorId && !isAdmin) {
      throw new AppError('Not authorized', 403);
    }

    await prisma.forum.delete({ where: { id: forumId } });

    logger.info({
      action: 'FORUM_DELETED',
      forumId,
      forumTitle: forum.title,
      courseId: forum.courseId,
      courseName: forum.course.title,
      deletedBy: instructorId,
      threadsDeleted: forum._count.threads,
      timestamp: new Date().toISOString(),
    }, `Forum deleted: "${forum.title}" in course "${forum.course.title}" (had ${forum._count.threads} threads)`);

    return { message: 'Forum deleted' };
  }

  // =========================================================================
  // THREAD CRUD
  // =========================================================================

  async getThreads(forumId: number, userId: number, page = 1, limit = 20, isInstructor = false, isAdmin = false) {
    const forum = await prisma.forum.findUnique({
      where: { id: forumId },
      include: { course: { select: { id: true, instructorId: true } } },
    });

    if (!forum || !forum.isPublished) throw new AppError('Forum not found', 404);

    // Verify user has access to this forum's course
    const isCourseInstructor = forum.course.instructorId === userId;
    if (!isAdmin && !isCourseInstructor && !isInstructor) {
      const enrollment = await prisma.enrollment.findUnique({
        where: { userId_courseId: { userId, courseId: forum.course.id } },
      });
      if (!enrollment) {
        throw new AppError('Not enrolled in this course', 403);
      }
    }

    const skip = (page - 1) * limit;

    const [threads, total] = await Promise.all([
      prisma.forumThread.findMany({
        where: { forumId },
        include: {
          posts: {
            where: { parentId: null },
            select: { id: true },
          },
        },
        orderBy: [{ isPinned: 'desc' }, { createdAt: 'desc' }],
        skip,
        take: limit,
      }),
      prisma.forumThread.count({ where: { forumId } }),
    ]);

    // Get author info
    const authorIds = [...new Set(threads.map(t => t.authorId))];
    const authors = await prisma.user.findMany({
      where: { id: { in: authorIds } },
      select: { id: true, fullname: true },
    });
    const authorMap = new Map(authors.map(a => [a.id, a]));

    const threadsWithInfo = threads.map(thread => ({
      ...thread,
      author: thread.isAnonymous ? null : authorMap.get(thread.authorId),
      replyCount: thread.posts.length,
      posts: undefined,
    }));

    return {
      threads: threadsWithInfo,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }

  async getThread(threadId: number, userId: number, isInstructor = false, isAdmin = false) {
    const thread = await prisma.forumThread.findUnique({
      where: { id: threadId },
      include: {
        forum: {
          select: { id: true, title: true, allowAnonymous: true, courseId: true },
          include: { course: { select: { instructorId: true } } },
        },
        posts: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!thread) throw new AppError('Thread not found', 404);

    // Verify user has access to this forum's course
    const isCourseInstructor = (thread.forum as any).course?.instructorId === userId;
    if (!isAdmin && !isCourseInstructor && !isInstructor) {
      const enrollment = await prisma.enrollment.findUnique({
        where: { userId_courseId: { userId, courseId: thread.forum.courseId } },
      });
      if (!enrollment) {
        throw new AppError('Not enrolled in this course', 403);
      }
    }

    // Increment view count
    await prisma.forumThread.update({
      where: { id: threadId },
      data: { viewCount: { increment: 1 } },
    });

    // Get author info for thread and posts
    const authorIds = [
      thread.authorId,
      ...thread.posts.map(p => p.authorId),
    ];
    const uniqueAuthorIds = [...new Set(authorIds)];
    const authors = await prisma.user.findMany({
      where: { id: { in: uniqueAuthorIds } },
      select: { id: true, fullname: true, isInstructor: true },
    });
    const authorMap = new Map(authors.map(a => [a.id, a]));

    // Transform posts with author info
    const postsWithAuthors = thread.posts.map(post => ({
      ...post,
      author: post.isAnonymous ? null : authorMap.get(post.authorId),
    }));

    return {
      ...thread,
      author: thread.isAnonymous ? null : authorMap.get(thread.authorId),
      posts: postsWithAuthors,
    };
  }

  async createThread(forumId: number, userId: number, data: CreateThreadInput) {
    const forum = await prisma.forum.findUnique({
      where: { id: forumId },
      include: { course: true },
    });

    if (!forum) throw new AppError('Forum not found', 404);
    if (!forum.isPublished) throw new AppError('Forum is not available', 400);

    // Check enrollment (except for instructors/admins)
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, fullname: true, email: true, isAdmin: true, isInstructor: true },
    });

    if (!user?.isAdmin && forum.course.instructorId !== userId) {
      const enrollment = await prisma.enrollment.findUnique({
        where: { userId_courseId: { userId, courseId: forum.courseId } },
      });
      if (!enrollment) throw new AppError('Not enrolled in this course', 403);
    }

    // Check if anonymous posting is allowed
    if (data.isAnonymous && !forum.allowAnonymous) {
      throw new AppError('Anonymous posting is not allowed in this forum', 400);
    }

    const thread = await prisma.forumThread.create({
      data: {
        forumId,
        authorId: userId,
        title: data.title,
        content: data.content,
        isAnonymous: data.isAnonymous ?? false,
      },
    });

    // Comprehensive logging for thread creation
    logger.info({
      action: 'THREAD_CREATED',
      threadId: thread.id,
      threadTitle: data.title,
      forumId,
      forumTitle: forum.title,
      courseId: forum.courseId,
      courseName: forum.course.title,
      author: {
        userId,
        name: user?.fullname || 'Unknown',
        email: user?.email || 'Unknown',
        isAnonymous: data.isAnonymous ?? false,
      },
      content: data.content.substring(0, 500) + (data.content.length > 500 ? '...' : ''),
      contentLength: data.content.length,
      timestamp: new Date().toISOString(),
    }, `Thread created: "${data.title}" by ${user?.fullname || 'Unknown'} in forum "${forum.title}"`);

    return thread;
  }

  async updateThread(threadId: number, userId: number, data: Partial<CreateThreadInput>, isAdmin = false) {
    const thread = await prisma.forumThread.findUnique({
      where: { id: threadId },
      include: { forum: { include: { course: true } } },
    });

    if (!thread) throw new AppError('Thread not found', 404);
    if (thread.isLocked && !isAdmin && thread.forum.course.instructorId !== userId) {
      throw new AppError('Thread is locked', 400);
    }
    if (thread.authorId !== userId && !isAdmin && thread.forum.course.instructorId !== userId) {
      throw new AppError('Not authorized', 403);
    }

    const updatedThread = await prisma.forumThread.update({
      where: { id: threadId },
      data: {
        title: data.title,
        content: data.content,
      },
    });

    // Get user info for logging
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { fullname: true, email: true },
    });

    logger.info({
      action: 'THREAD_UPDATED',
      threadId,
      oldTitle: thread.title,
      newTitle: updatedThread.title,
      forumId: thread.forumId,
      forumTitle: thread.forum.title,
      courseId: thread.forum.courseId,
      courseName: thread.forum.course.title,
      updatedBy: {
        userId,
        name: user?.fullname || 'Unknown',
        email: user?.email || 'Unknown',
      },
      titleChanged: data.title !== undefined && data.title !== thread.title,
      contentChanged: data.content !== undefined,
      timestamp: new Date().toISOString(),
    }, `Thread updated: "${updatedThread.title}" by ${user?.fullname || 'Unknown'} in forum "${thread.forum.title}"`);

    return updatedThread;
  }

  async deleteThread(threadId: number, userId: number, isAdmin = false) {
    const thread = await prisma.forumThread.findUnique({
      where: { id: threadId },
      include: {
        forum: { include: { course: true } },
        _count: { select: { posts: true } },
      },
    });

    if (!thread) throw new AppError('Thread not found', 404);
    if (thread.authorId !== userId && !isAdmin && thread.forum.course.instructorId !== userId) {
      throw new AppError('Not authorized', 403);
    }

    // Get user info for logging
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
      forumId: thread.forumId,
      forumTitle: thread.forum.title,
      courseId: thread.forum.courseId,
      courseName: thread.forum.course.title,
      deletedBy: {
        userId,
        name: user?.fullname || 'Unknown',
        email: user?.email || 'Unknown',
      },
      threadAuthor: {
        userId: thread.authorId,
        name: thread.isAnonymous ? 'Anonymous' : (threadAuthor?.fullname || 'Unknown'),
      },
      postsDeleted: thread._count.posts,
      timestamp: new Date().toISOString(),
    }, `Thread deleted: "${thread.title}" by ${user?.fullname || 'Unknown'} (had ${thread._count.posts} posts)`);

    return { message: 'Thread deleted' };
  }

  // Instructor actions
  async pinThread(threadId: number, userId: number, isPinned: boolean, isAdmin = false) {
    const thread = await prisma.forumThread.findUnique({
      where: { id: threadId },
      include: { forum: { include: { course: true } } },
    });

    if (!thread) throw new AppError('Thread not found', 404);
    if (!isAdmin && thread.forum.course.instructorId !== userId) {
      throw new AppError('Not authorized', 403);
    }

    const updatedThread = await prisma.forumThread.update({
      where: { id: threadId },
      data: { isPinned },
    });

    // Get user info for logging
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { fullname: true },
    });

    logger.info({
      action: isPinned ? 'THREAD_PINNED' : 'THREAD_UNPINNED',
      threadId,
      threadTitle: thread.title,
      forumId: thread.forumId,
      forumTitle: thread.forum.title,
      courseId: thread.forum.courseId,
      courseName: thread.forum.course.title,
      actionBy: {
        userId,
        name: user?.fullname || 'Unknown',
      },
      timestamp: new Date().toISOString(),
    }, `Thread ${isPinned ? 'pinned' : 'unpinned'}: "${thread.title}" by ${user?.fullname || 'Unknown'}`);

    return updatedThread;
  }

  async lockThread(threadId: number, userId: number, isLocked: boolean, isAdmin = false) {
    const thread = await prisma.forumThread.findUnique({
      where: { id: threadId },
      include: { forum: { include: { course: true } } },
    });

    if (!thread) throw new AppError('Thread not found', 404);
    if (!isAdmin && thread.forum.course.instructorId !== userId) {
      throw new AppError('Not authorized', 403);
    }

    const updatedThread = await prisma.forumThread.update({
      where: { id: threadId },
      data: { isLocked },
    });

    // Get user info for logging
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { fullname: true },
    });

    logger.info({
      action: isLocked ? 'THREAD_LOCKED' : 'THREAD_UNLOCKED',
      threadId,
      threadTitle: thread.title,
      forumId: thread.forumId,
      forumTitle: thread.forum.title,
      courseId: thread.forum.courseId,
      courseName: thread.forum.course.title,
      actionBy: {
        userId,
        name: user?.fullname || 'Unknown',
      },
      timestamp: new Date().toISOString(),
    }, `Thread ${isLocked ? 'locked' : 'unlocked'}: "${thread.title}" by ${user?.fullname || 'Unknown'}`);

    return updatedThread;
  }

  // =========================================================================
  // POST CRUD
  // =========================================================================

  async createPost(threadId: number, userId: number, data: CreatePostInput) {
    const thread = await prisma.forumThread.findUnique({
      where: { id: threadId },
      include: { forum: { include: { course: true } } },
    });

    if (!thread) throw new AppError('Thread not found', 404);
    if (thread.isLocked) throw new AppError('Thread is locked', 400);

    // Check enrollment
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, fullname: true, email: true, isAdmin: true, isInstructor: true },
    });

    if (!user?.isAdmin && thread.forum.course.instructorId !== userId) {
      const enrollment = await prisma.enrollment.findUnique({
        where: { userId_courseId: { userId, courseId: thread.forum.courseId } },
      });
      if (!enrollment) throw new AppError('Not enrolled in this course', 403);
    }

    // Validate parent post and get parent author info for logging
    let parentPostInfo: { id: number; authorId: number; authorName: string; content: string } | null = null;
    if (data.parentId) {
      const parentPost = await prisma.forumPost.findUnique({
        where: { id: data.parentId },
      });
      if (!parentPost || parentPost.threadId !== threadId) {
        throw new AppError('Invalid parent post', 400);
      }
      // Get parent author info
      const parentAuthor = await prisma.user.findUnique({
        where: { id: parentPost.authorId },
        select: { id: true, fullname: true },
      });
      parentPostInfo = {
        id: parentPost.id,
        authorId: parentPost.authorId,
        authorName: parentPost.isAnonymous ? 'Anonymous' : (parentAuthor?.fullname || 'Unknown'),
        content: parentPost.content.substring(0, 200) + (parentPost.content.length > 200 ? '...' : ''),
      };
    }

    // Get thread author info
    const threadAuthor = await prisma.user.findUnique({
      where: { id: thread.authorId },
      select: { fullname: true },
    });

    // Check anonymous permissions
    if (data.isAnonymous && !thread.forum.allowAnonymous) {
      throw new AppError('Anonymous posting is not allowed in this forum', 400);
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

    // Comprehensive logging for post creation
    const isReplyToPost = !!data.parentId;
    const replyType = isReplyToPost ? 'REPLY_TO_POST' : 'REPLY_TO_THREAD';

    logger.info({
      action: 'POST_CREATED',
      replyType,
      postId: post.id,
      threadId,
      threadTitle: thread.title,
      forumId: thread.forumId,
      forumTitle: thread.forum.title,
      courseId: thread.forum.courseId,
      courseName: thread.forum.course.title,
      author: {
        userId,
        name: user?.fullname || 'Unknown',
        email: user?.email || 'Unknown',
        isAnonymous: data.isAnonymous ?? false,
      },
      threadAuthor: {
        userId: thread.authorId,
        name: thread.isAnonymous ? 'Anonymous' : (threadAuthor?.fullname || 'Unknown'),
      },
      parentPost: parentPostInfo ? {
        postId: parentPostInfo.id,
        authorId: parentPostInfo.authorId,
        authorName: parentPostInfo.authorName,
        contentPreview: parentPostInfo.content,
      } : null,
      repliedTo: isReplyToPost
        ? { type: 'post', postId: data.parentId, authorName: parentPostInfo?.authorName }
        : { type: 'thread', threadId, authorName: thread.isAnonymous ? 'Anonymous' : (threadAuthor?.fullname || 'Unknown') },
      content: data.content.substring(0, 500) + (data.content.length > 500 ? '...' : ''),
      contentLength: data.content.length,
      timestamp: new Date().toISOString(),
    }, `Post created: ${user?.fullname || 'Unknown'} ${isReplyToPost ? `replied to ${parentPostInfo?.authorName}'s post` : `replied to thread "${thread.title}"`} in forum "${thread.forum.title}"`);

    return post;
  }

  async updatePost(postId: number, userId: number, content: string, isAdmin = false) {
    const post = await prisma.forumPost.findUnique({
      where: { id: postId },
      include: {
        thread: {
          include: { forum: { include: { course: true } } },
        },
      },
    });

    if (!post) throw new AppError('Post not found', 404);
    if (post.thread.isLocked && !isAdmin && post.thread.forum.course.instructorId !== userId) {
      throw new AppError('Thread is locked', 400);
    }
    if (post.authorId !== userId && !isAdmin && post.thread.forum.course.instructorId !== userId) {
      throw new AppError('Not authorized', 403);
    }

    const oldContent = post.content;
    const updatedPost = await prisma.forumPost.update({
      where: { id: postId },
      data: { content, isEdited: true },
    });

    // Get user info for logging
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { fullname: true, email: true },
    });

    logger.info({
      action: 'POST_UPDATED',
      postId,
      threadId: post.threadId,
      threadTitle: post.thread.title,
      forumId: post.thread.forumId,
      forumTitle: post.thread.forum.title,
      courseId: post.thread.forum.courseId,
      courseName: post.thread.forum.course.title,
      editedBy: {
        userId,
        name: user?.fullname || 'Unknown',
        email: user?.email || 'Unknown',
      },
      oldContent: oldContent.substring(0, 300) + (oldContent.length > 300 ? '...' : ''),
      newContent: content.substring(0, 300) + (content.length > 300 ? '...' : ''),
      timestamp: new Date().toISOString(),
    }, `Post updated: ${user?.fullname || 'Unknown'} edited post #${postId} in thread "${post.thread.title}"`);

    return updatedPost;
  }

  async deletePost(postId: number, userId: number, isAdmin = false) {
    const post = await prisma.forumPost.findUnique({
      where: { id: postId },
      include: {
        thread: {
          include: { forum: { include: { course: true } } },
        },
        _count: { select: { replies: true } },
      },
    });

    if (!post) throw new AppError('Post not found', 404);
    if (post.authorId !== userId && !isAdmin && post.thread.forum.course.instructorId !== userId) {
      throw new AppError('Not authorized', 403);
    }

    // Get user info for logging (the deleter)
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { fullname: true, email: true },
    });

    // Get post author info
    const postAuthor = await prisma.user.findUnique({
      where: { id: post.authorId },
      select: { fullname: true },
    });

    // Get parent post info if this was a reply
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
          authorName: parentPost.isAnonymous ? 'Anonymous' : (parentAuthor?.fullname || 'Unknown'),
        };
      }
    }

    await prisma.forumPost.delete({ where: { id: postId } });

    const postAuthorName = post.isAnonymous ? 'Anonymous' : (postAuthor?.fullname || 'Unknown');

    logger.info({
      action: 'POST_DELETED',
      postId,
      threadId: post.threadId,
      threadTitle: post.thread.title,
      forumId: post.thread.forumId,
      forumTitle: post.thread.forum.title,
      courseId: post.thread.forum.courseId,
      courseName: post.thread.forum.course.title,
      deletedBy: {
        userId,
        name: user?.fullname || 'Unknown',
        email: user?.email || 'Unknown',
      },
      postAuthor: {
        userId: post.authorId,
        name: postAuthorName,
      },
      parentPost: parentPostInfo,
      wasReplyToPost: !!post.parentId,
      deletedContent: post.content.substring(0, 300) + (post.content.length > 300 ? '...' : ''),
      repliesDeleted: post._count.replies,
      timestamp: new Date().toISOString(),
    }, `Post deleted: ${user?.fullname || 'Unknown'} deleted post #${postId} by ${postAuthorName} in thread "${post.thread.title}"`);

    return { message: 'Post deleted' };
  }
}

export const forumService = new ForumService();
