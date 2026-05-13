import apiClient from './client';
import { ApiResponse } from '../types';

/**
 * The Forum container model was dropped (see migration
 * `forum_collapse_layers`). A "forum" is now a single discussion
 * (ForumThread) with title + rich-text content + courseId/moduleId.
 * The original endpoint paths under `/forums/...` are preserved so the
 * URL space and route ids don't churn — they just operate on threads.
 */

export interface ForumThread {
  id: number;
  courseId: number;
  moduleId: number | null;
  authorId: number;
  title: string;
  content: string;
  description?: string | null;
  isPublished: boolean;
  isPinned: boolean;
  isLocked: boolean;
  isAnonymous: boolean;
  allowAnonymous: boolean;
  orderIndex: number;
  viewCount: number;
  createdAt: string;
  updatedAt: string;
  author?: { id: number; fullname: string } | null;
  course?: { id: number; title: string; thumbnail?: string | null };
  module?: { id: number; title: string } | null;
  _count?: { posts: number };
  replyCount?: number;
  /** Total "likes" on the discussion. Returned by getThread. */
  likeCount?: number;
  /** Whether the calling user has liked. Returned by getThread. */
  myLike?: boolean;
}

export interface ForumPost {
  id: number;
  threadId: number;
  authorId: number;
  parentId?: number;
  content: string;
  isAnonymous: boolean;
  isEdited: boolean;
  createdAt: string;
  updatedAt: string;
  author?: { id: number; fullname: string; isInstructor?: boolean } | null;
  // AI Integration
  isAiGenerated?: boolean;
  aiAgentId?: number;
  aiAgentName?: string;
  aiRequestedBy?: number;
  aiAgent?: { id: number; name: string; displayName: string; avatarUrl?: string } | null;
  requester?: { id: number; fullname: string } | null;
}

export interface TutorAgent {
  id: number;
  name: string;
  displayName: string;
  description?: string;
  avatarUrl?: string;
  personality?: string;
  isCourseSpecific?: boolean;
}

/** Row shape returned by `/forums/instructor` (cross-course list for /teach/forums). */
export interface InstructorForumThread {
  id: number;
  title: string;
  description?: string | null;
  content: string;
  courseId: number;
  courseName: string;
  courseThumbnail: string | null;
  moduleId: number | null;
  moduleName: string | null;
  isPublished: boolean;
  isPinned: boolean;
  isLocked: boolean;
  allowAnonymous: boolean;
  replyCount: number;
  authorId: number;
  createdAt: string;
  updatedAt: string;
}

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

/** Legacy alias — old callsites imported `Forum` for what is now a ForumThread. */
export type Forum = ForumThread;

export const forumsApi = {
  // ============= Discussions (list / create / update / delete) =============

  getForums: async (courseId: number): Promise<ForumThread[]> => {
    const response = await apiClient.get<ApiResponse<ForumThread[]>>(`/forums/course/${courseId}`);
    return response.data.data!;
  },

  getModuleForums: async (moduleId: number): Promise<ForumThread[]> => {
    const response = await apiClient.get<ApiResponse<ForumThread[]>>(`/forums/module/${moduleId}`);
    return response.data.data!;
  },

  /** Cross-course list used by /teach/forums. */
  getInstructorForumThreads: async (): Promise<InstructorForumThread[]> => {
    const response = await apiClient.get<ApiResponse<InstructorForumThread[]>>('/forums/instructor');
    return response.data.data!;
  },

  createForum: async (courseId: number, data: CreateForumInput): Promise<ForumThread> => {
    const response = await apiClient.post<ApiResponse<ForumThread>>(`/forums/course/${courseId}`, data);
    return response.data.data!;
  },

  updateForum: async (threadId: number, data: UpdateForumInput): Promise<ForumThread> => {
    const response = await apiClient.put<ApiResponse<ForumThread>>(`/forums/${threadId}`, data);
    return response.data.data!;
  },

  deleteForum: async (threadId: number): Promise<void> => {
    await apiClient.delete(`/forums/${threadId}`);
  },

  // ============= Single discussion + instructor mutations =============

  getThread: async (threadId: number): Promise<ForumThread & { posts: ForumPost[] }> => {
    const response = await apiClient.get<ApiResponse<any>>(`/forums/threads/${threadId}`);
    return response.data.data!;
  },

  updateThread: async (threadId: number, data: { title?: string; content?: string }): Promise<ForumThread> => {
    const response = await apiClient.put<ApiResponse<ForumThread>>(`/forums/threads/${threadId}`, data);
    return response.data.data!;
  },

  deleteThread: async (threadId: number): Promise<void> => {
    await apiClient.delete(`/forums/threads/${threadId}`);
  },

  pinThread: async (threadId: number, isPinned: boolean): Promise<ForumThread> => {
    const response = await apiClient.put<ApiResponse<ForumThread>>(`/forums/threads/${threadId}/pin`, { isPinned });
    return response.data.data!;
  },

  lockThread: async (threadId: number, isLocked: boolean): Promise<ForumThread> => {
    const response = await apiClient.put<ApiResponse<ForumThread>>(`/forums/threads/${threadId}/lock`, { isLocked });
    return response.data.data!;
  },

  /** Toggle the calling user's "like" on this discussion. */
  toggleThreadLike: async (threadId: number): Promise<{ liked: boolean; likeCount: number }> => {
    const response = await apiClient.post<ApiResponse<{ liked: boolean; likeCount: number }>>(
      `/forums/threads/${threadId}/like`,
    );
    return response.data.data!;
  },

  // ============= Replies (posts) =============

  createPost: async (threadId: number, data: CreatePostInput): Promise<ForumPost> => {
    const response = await apiClient.post<ApiResponse<ForumPost>>(`/forums/threads/${threadId}/posts`, data);
    return response.data.data!;
  },

  updatePost: async (postId: number, content: string): Promise<ForumPost> => {
    const response = await apiClient.put<ApiResponse<ForumPost>>(`/forums/posts/${postId}`, { content });
    return response.data.data!;
  },

  deletePost: async (postId: number): Promise<void> => {
    await apiClient.delete(`/forums/posts/${postId}`);
  },

  // ============= AI Agent integration =============

  getForumAgents: async (courseId: number): Promise<TutorAgent[]> => {
    const response = await apiClient.get<ApiResponse<TutorAgent[]>>(`/forums/course/${courseId}/agents`);
    return response.data.data!;
  },

  requestAiPost: async (threadId: number, agentId: number, parentId?: number): Promise<ForumPost> => {
    const response = await apiClient.post<ApiResponse<ForumPost>>(`/forums/threads/${threadId}/ai-post`, {
      agentId,
      ...(parentId && { parentId }),
    });
    return response.data.data!;
  },
};
