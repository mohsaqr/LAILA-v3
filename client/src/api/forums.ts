import apiClient from './client';
import { ApiResponse } from '../types';

export interface Forum {
  id: number;
  courseId: number;
  moduleId?: number | null;
  title: string;
  description?: string;
  isPublished: boolean;
  allowAnonymous: boolean;
  orderIndex: number;
  createdAt: string;
  updatedAt: string;
  _count?: { threads: number };
}

export interface ForumThread {
  id: number;
  forumId: number;
  authorId: number;
  title: string;
  content: string;
  isPinned: boolean;
  isLocked: boolean;
  isAnonymous: boolean;
  viewCount: number;
  createdAt: string;
  updatedAt: string;
  author?: { id: number; fullname: string } | null;
  replyCount?: number;
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

export interface CreateForumInput {
  title: string;
  description?: string;
  isPublished?: boolean;
  allowAnonymous?: boolean;
  orderIndex?: number;
  moduleId?: number;
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

export const forumsApi = {
  // Forum CRUD
  getForums: async (courseId: number): Promise<Forum[]> => {
    const response = await apiClient.get<ApiResponse<Forum[]>>(`/forums/course/${courseId}`);
    return response.data.data!;
  },

  getModuleForums: async (moduleId: number): Promise<Forum[]> => {
    const response = await apiClient.get<ApiResponse<Forum[]>>(`/forums/module/${moduleId}`);
    return response.data.data!;
  },

  getForum: async (forumId: number): Promise<Forum & { threads: ForumThread[] }> => {
    const response = await apiClient.get<ApiResponse<Forum & { threads: ForumThread[] }>>(`/forums/${forumId}`);
    return response.data.data!;
  },

  createForum: async (courseId: number, data: CreateForumInput): Promise<Forum> => {
    const response = await apiClient.post<ApiResponse<Forum>>(`/forums/course/${courseId}`, data);
    return response.data.data!;
  },

  updateForum: async (forumId: number, data: Partial<CreateForumInput>): Promise<Forum> => {
    const response = await apiClient.put<ApiResponse<Forum>>(`/forums/${forumId}`, data);
    return response.data.data!;
  },

  deleteForum: async (forumId: number): Promise<void> => {
    await apiClient.delete(`/forums/${forumId}`);
  },

  // Thread CRUD
  getThreads: async (forumId: number, page = 1, limit = 20): Promise<{
    threads: ForumThread[];
    pagination: { page: number; limit: number; total: number; pages: number };
  }> => {
    const response = await apiClient.get<ApiResponse<any>>(`/forums/${forumId}/threads`, {
      params: { page, limit },
    });
    return response.data.data!;
  },

  getThread: async (threadId: number): Promise<ForumThread & { posts: ForumPost[]; forum: Forum }> => {
    const response = await apiClient.get<ApiResponse<any>>(`/forums/threads/${threadId}`);
    return response.data.data!;
  },

  createThread: async (forumId: number, data: CreateThreadInput): Promise<ForumThread> => {
    const response = await apiClient.post<ApiResponse<ForumThread>>(`/forums/${forumId}/threads`, data);
    return response.data.data!;
  },

  updateThread: async (threadId: number, data: Partial<CreateThreadInput>): Promise<ForumThread> => {
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

  // Post CRUD
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

  // AI Agent Integration
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
