import { Request } from 'express';

// User types
export interface UserPayload {
  id: number;
  email: string;
  fullname: string;
  isAdmin: boolean;
  isInstructor: boolean;
  tokenVersion?: number; // Used for token invalidation on password change
}

export interface AuthRequest extends Request {
  user?: UserPayload;
}

// Response types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

export interface PaginatedResponse<T> extends ApiResponse<T> {
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// Course types
export interface CourseFilters {
  category?: string;
  difficulty?: string;
  status?: string;
  search?: string;
  instructorId?: number;
}

export interface ModuleWithLectures {
  id: number;
  title: string;
  description: string | null;
  orderIndex: number;
  isPublished: boolean;
  lectures: LectureBasic[];
}

export interface LectureBasic {
  id: number;
  title: string;
  contentType: string;
  duration: number | null;
  orderIndex: number;
  isPublished: boolean;
  isFree: boolean;
}

// Enrollment types
export interface EnrollmentWithProgress {
  id: number;
  courseId: number;
  status: string;
  progress: number;
  enrolledAt: Date;
  completedAt: Date | null;
  lastAccessAt: Date | null;
  course: {
    id: number;
    title: string;
    slug: string;
    thumbnail: string | null;
    instructor: {
      id: number;
      fullname: string;
    };
  };
}

// Assignment types
export interface AssignmentWithSubmission {
  id: number;
  title: string;
  description: string | null;
  dueDate: Date | null;
  points: number;
  isPublished: boolean;
  submissionType: string;
  submission?: {
    id: number;
    status: string;
    submittedAt: Date;
    grade: number | null;
  };
}

// Chat types
export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface ChatRequest {
  message: string;
  module: string;
  sessionId?: string;
  context?: string;
  model?: string;
  systemPrompt?: string;
  conversationHistory?: ChatMessage[]; // Previous messages for context
  temperature?: number;
}

export interface ChatResponse {
  reply: string;
  model: string;
  responseTime: number;
}

// AI Provider types
export type AIProvider = 'openai' | 'gemini';

export interface AIConfig {
  provider: AIProvider;
  model: string;
  apiKey: string;
  baseURL?: string; // For OpenAI-compatible servers like LM Studio
  maxTokens?: number;
  temperature?: number;
}

// Settings types
export interface SystemSettingValue {
  key: string;
  value: string | null;
  type: string;
  description: string | null;
}

// File upload types
export interface UploadedFile {
  filename: string;
  originalname: string;
  mimetype: string;
  size: number;
  path: string;
  url: string;
}
