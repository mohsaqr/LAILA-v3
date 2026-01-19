import { z } from 'zod';

// Auth validation schemas
export const registerSchema = z.object({
  fullname: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

export const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

export const updateUserSchema = z.object({
  fullname: z.string().min(2).optional(),
  email: z.string().email().optional(),
  password: z.string().min(6).optional(),
  isActive: z.boolean().optional(),
  isInstructor: z.boolean().optional(),
  isAdmin: z.boolean().optional(),
});

// Course validation schemas
export const createCourseSchema = z.object({
  title: z.string().min(3, 'Title must be at least 3 characters'),
  description: z.string().optional(),
  category: z.string().optional(),
  difficulty: z.enum(['beginner', 'intermediate', 'advanced']).optional(),
  isPublic: z.boolean().optional(),
});

export const updateCourseSchema = createCourseSchema.partial();

// Module validation schemas
export const createModuleSchema = z.object({
  title: z.string().min(2, 'Title must be at least 2 characters'),
  description: z.string().optional(),
  label: z.string().optional(), // e.g., "Week 1 - Foundations"
  orderIndex: z.number().int().min(0).optional(),
  isPublished: z.boolean().optional(),
});

export const updateModuleSchema = createModuleSchema.partial();

export const reorderModulesSchema = z.object({
  moduleIds: z.array(z.number().int()),
});

// Lecture validation schemas
export const createLectureSchema = z.object({
  title: z.string().min(2, 'Title must be at least 2 characters'),
  content: z.string().optional(),
  contentType: z.enum(['text', 'video', 'mixed']).optional(),
  videoUrl: z.preprocess(
    (val) => (val === '' ? null : val),
    z.string().url().optional().nullable()
  ),
  duration: z.number().int().min(0).optional(),
  orderIndex: z.number().int().min(0).optional(),
  isPublished: z.boolean().optional(),
  isFree: z.boolean().optional(),
});

export const updateLectureSchema = createLectureSchema.partial();

// Section validation schemas
export const createSectionSchema = z.object({
  type: z.enum(['text', 'file', 'ai-generated', 'chatbot', 'assignment']),
  title: z.string().optional(), // Section title (e.g., "Introduction", "Key Concepts")
  content: z.string().optional(),
  fileName: z.string().optional(),
  fileUrl: z.string().url().optional(),
  fileType: z.string().optional(),
  fileSize: z.number().int().min(0).optional(),
  order: z.number().int().min(0).optional(),
  // Chatbot fields
  chatbotTitle: z.string().optional(),
  chatbotIntro: z.string().optional(),
  chatbotImageUrl: z.string().url().optional().nullable(),
  chatbotSystemPrompt: z.string().optional(),
  chatbotWelcome: z.string().optional(),
  // Assignment fields
  assignmentId: z.number().int().optional(),
  showDeadline: z.boolean().optional(),
  showPoints: z.boolean().optional(),
});

export const updateSectionSchema = z.object({
  title: z.string().optional(), // Section title
  content: z.string().optional(),
  fileName: z.string().optional(),
  fileUrl: z.string().url().optional(),
  fileType: z.string().optional(),
  fileSize: z.number().int().min(0).optional(),
  order: z.number().int().min(0).optional(),
  // Chatbot fields
  chatbotTitle: z.string().optional(),
  chatbotIntro: z.string().optional(),
  chatbotImageUrl: z.string().url().optional().nullable(),
  chatbotSystemPrompt: z.string().optional(),
  chatbotWelcome: z.string().optional(),
  // Assignment fields
  assignmentId: z.number().int().optional(),
  showDeadline: z.boolean().optional(),
  showPoints: z.boolean().optional(),
});

// Chatbot conversation validation schemas
export const chatbotMessageSchema = z.object({
  message: z.string().min(1, 'Message is required'),
});

export const reorderSectionsSchema = z.object({
  sectionIds: z.array(z.number().int()),
});

export const generateAIContentSchema = z.object({
  prompt: z.string().min(10, 'Prompt must be at least 10 characters'),
  context: z.string().optional(),
  lectureId: z.number().int().optional(),
});

// Assignment validation schemas
export const createAssignmentSchema = z.object({
  title: z.string().min(3, 'Title must be at least 3 characters'),
  description: z.string().optional(),
  instructions: z.string().optional(),
  submissionType: z.enum(['text', 'file', 'mixed']).optional(),
  maxFileSize: z.number().int().min(1).max(50).optional(),
  allowedFileTypes: z.string().optional(),
  dueDate: z.string().datetime().optional().nullable(),
  points: z.number().int().min(0).max(1000).optional(),
  isPublished: z.boolean().optional(),
  moduleId: z.number().int().optional().nullable(),
  aiAssisted: z.boolean().optional(),
  aiPrompt: z.string().optional(),
});

export const updateAssignmentSchema = createAssignmentSchema.partial();

// Submission validation schemas
export const createSubmissionSchema = z.object({
  content: z.string().optional(),
  fileUrls: z.array(z.string().url()).optional(),
  status: z.enum(['draft', 'submitted']).optional(),
});

export const gradeSubmissionSchema = z.object({
  grade: z.number().min(0).max(100),
  feedback: z.string().optional(),
});

// Chat validation schemas
export const chatMessageSchema = z.object({
  message: z.string().min(1, 'Message is required'),
  module: z.string().default('general'),
  sessionId: z.string().optional(),
  context: z.string().optional(),
  model: z.string().optional(),
  systemPrompt: z.string().optional(),
});

// Chatbot validation schemas
export const createChatbotSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').regex(/^[a-z0-9-]+$/, 'Name must be lowercase with hyphens'),
  displayName: z.string().min(2, 'Display name must be at least 2 characters'),
  description: z.string().optional(),
  systemPrompt: z.string().min(10, 'System prompt must be at least 10 characters'),
  category: z.string().optional(),
  isActive: z.boolean().optional(),
});

export const updateChatbotSchema = createChatbotSchema.partial();

// Settings validation schemas
export const updateSettingSchema = z.object({
  value: z.string().nullable(),
});

export const updateApiConfigSchema = z.object({
  apiKey: z.string().optional(),
  defaultModel: z.string().optional(),
  isActive: z.boolean().optional(),
  rateLimit: z.number().int().min(0).optional(),
  configurationData: z.string().optional(),
});

// Announcement validation schemas
export const createAnnouncementSchema = z.object({
  title: z.string().min(3, 'Title must be at least 3 characters'),
  content: z.string().min(10, 'Content must be at least 10 characters'),
});

// Type exports
export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
export type CreateCourseInput = z.infer<typeof createCourseSchema>;
export type UpdateCourseInput = z.infer<typeof updateCourseSchema>;
export type CreateModuleInput = z.infer<typeof createModuleSchema>;
export type UpdateModuleInput = z.infer<typeof updateModuleSchema>;
export type CreateLectureInput = z.infer<typeof createLectureSchema>;
export type UpdateLectureInput = z.infer<typeof updateLectureSchema>;
export type CreateAssignmentInput = z.infer<typeof createAssignmentSchema>;
export type UpdateAssignmentInput = z.infer<typeof updateAssignmentSchema>;
export type CreateSubmissionInput = z.infer<typeof createSubmissionSchema>;
export type GradeSubmissionInput = z.infer<typeof gradeSubmissionSchema>;
export type ChatMessageInput = z.infer<typeof chatMessageSchema>;
export type CreateChatbotInput = z.infer<typeof createChatbotSchema>;
export type UpdateChatbotInput = z.infer<typeof updateChatbotSchema>;
export type CreateSectionInput = z.infer<typeof createSectionSchema>;
export type UpdateSectionInput = z.infer<typeof updateSectionSchema>;
export type GenerateAIContentInput = z.infer<typeof generateAIContentSchema>;
export type ChatbotMessageInput = z.infer<typeof chatbotMessageSchema>;
