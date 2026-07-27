import { z } from 'zod';

// =============================================================================
// PAGINATION UTILITIES
// =============================================================================

/**
 * Maximum allowed limit for pagination to prevent data exfiltration and DoS.
 */
export const MAX_PAGINATION_LIMIT = 100;

/**
 * Parse and enforce pagination limit from query parameter.
 * Ensures limit is between 1 and MAX_PAGINATION_LIMIT.
 */
export function parsePaginationLimit(limitParam: string | undefined, defaultLimit = 20): number {
  if (!limitParam) return defaultLimit;
  const parsed = parseInt(limitParam, 10);
  if (isNaN(parsed) || parsed < 1) return defaultLimit;
  return Math.min(parsed, MAX_PAGINATION_LIMIT);
}

// Strong password validation
const strongPasswordSchema = z.string()
  .min(8, 'Password must be at least 8 characters')
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
  .regex(/[0-9]/, 'Password must contain at least one number')
  .regex(/[!@#$%^&*(),.?":{}|<>]/, 'Password must contain at least one special character');

// Auth validation schemas
//
// An applicant may redeem an invitation in exactly one of two forms: the long
// token from a shareable link, or the short code they were given to type in.
// Both at once is rejected rather than silently preferring one, because the
// two could name different invitations and picking one would hand the
// applicant a role or a course they did not expect.
//
// `courseCode` is a THIRD, independent thing and is deliberately allowed
// alongside an invitation: an invitation is an admin saying "you may have an
// account", a course code is a teacher saying "you may join my course". Someone
// can legitimately have both, and they govern different outcomes (role vs.
// enrolment), so there is nothing to disambiguate.
export const registerSchema = z.object({
  fullname: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Invalid email address'),
  password: strongPasswordSchema,
  inviteToken: z.string().min(1).max(255).optional(),
  inviteCode: z.string().min(1).max(64).optional(),
  // Size guard only. courseCodeSignup.service owns the real validation and
  // hard-fails anything that does not resolve to a joinable course.
  courseCode: z.string().min(1).max(32).optional(),
}).refine(data => !(data.inviteToken && data.inviteCode), {
  message: 'Provide either an invitation link or an invitation code, not both',
  path: ['inviteCode'],
});

// Password update validation schema
export const updatePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: strongPasswordSchema,
});

// Profile update validation schema (self-service, fullname only)
export const updateProfileSchema = z.object({
  fullname: z.string().min(2, 'Name must be at least 2 characters'),
});

export const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

export const updateUserSchema = z.object({
  fullname: z.string().min(2).optional(),
  email: z.string().email().optional(),
  password: strongPasswordSchema.optional(),
  isActive: z.boolean().optional(),
  isInstructor: z.boolean().optional(),
  isAdmin: z.boolean().optional(),
});

// Course validation schemas
export const createCourseSchema = z.object({
  title: z.string().min(3, 'Title must be at least 3 characters'),
  description: z.string().optional(),
  categoryIds: z.array(z.number()).optional(),
  difficulty: z.enum(['beginner', 'intermediate', 'advanced']).optional().nullable(),
  isPublic: z.boolean().optional(),
  thumbnail: z.string().optional().or(z.literal('')),
  curriculumViewMode: z.enum(['mini-cards', 'icons', 'list', 'accordion']).optional(),
  enabledLabs: z.string().optional().nullable(),
  // Optional. If absent or blank the service generates a random 8-char code.
  activationCode: z
    .string()
    .regex(/^[A-Z0-9]{6,16}$/, 'Activation code must be 6–16 uppercase letters or digits')
    .optional()
    .or(z.literal('')),
  // Course start date+time as an ISO-8601 string ('' / null clears it).
  startTime: z.union([z.string().datetime(), z.literal(''), z.null()]).optional(),
  // Course IDs that must be completed before enrolling in this course.
  prerequisiteIds: z.array(z.number().int().positive()).optional(),
});

export const updateCourseSchema = createCourseSchema.partial();

// Module validation schemas
export const createModuleSchema = z.object({
  title: z.string().min(2, 'Title must be at least 2 characters'),
  description: z.string().optional(),
  label: z.string().optional(), // e.g., "Week 1 - Foundations"
  orderIndex: z.number().int().min(0).optional(),
  isPublished: z.boolean().optional(),
  interactiveLabs: z.string().optional().nullable(),
  availableFrom: z.string().datetime().optional().nullable(),
  availableUntil: z.string().datetime().optional().nullable(),
});

export const updateModuleSchema = createModuleSchema.partial();

export const reorderModulesSchema = z.object({
  moduleIds: z.array(z.number().int()),
});

// Lecture validation schemas
export const createLectureSchema = z.object({
  title: z.string().min(2, 'Title must be at least 2 characters'),
  description: z.string().optional(),
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
  availableFrom: z.string().datetime().optional().nullable(),
  availableUntil: z.string().datetime().optional().nullable(),
});

export const updateLectureSchema = createLectureSchema.partial();

// Section validation schemas
export const createSectionSchema = z.object({
  type: z.enum(['text', 'file', 'ai-generated', 'chatbot', 'assignment']),
  title: z.string().optional(), // Section title (e.g., "Introduction", "Key Concepts")
  content: z.string().optional(),
  fileName: z.string().optional(),
  fileUrl: z.string().optional(), // Can be URL or data URL (base64)
  fileType: z.string().optional(),
  fileSize: z.number().int().min(0).optional(),
  order: z.number().int().min(0).optional(),
  // Chatbot fields
  chatbotTitle: z.string().optional(),
  chatbotIntro: z.string().optional(),
  chatbotImageUrl: z.string().optional().nullable(),
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
  fileUrl: z.string().optional(), // Can be URL or data URL (base64)
  fileType: z.string().optional(),
  fileSize: z.number().int().min(0).optional(),
  order: z.number().int().min(0).optional(),
  orderIndex: z.number().int().min(0).optional(), // Alias for order
  // Chatbot fields
  chatbotTitle: z.string().optional(),
  chatbotIntro: z.string().optional(),
  chatbotImageUrl: z.string().optional().nullable(),
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
  submissionType: z.enum(['text', 'file', 'mixed', 'ai_agent']).optional(),
  maxFileSize: z.number().int().min(1).max(50).optional(),
  allowedFileTypes: z.string().optional(),
  dueDate: z.string().datetime().optional().nullable(),
  gracePeriodDeadline: z.string().datetime().optional().nullable(),
  availableFrom: z.string().datetime().optional().nullable(),
  availableUntil: z.string().datetime().optional().nullable(),
  points: z.number().int().min(0).max(1000).optional(),
  weight: z.number().min(0).max(10).optional(),
  isPublished: z.boolean().optional(),
  moduleId: z.number().int().optional().nullable(),
  lectureId: z.number().int().optional().nullable(),
  aiAssisted: z.boolean().optional(),
  aiPrompt: z.string().optional(),
  agentRequirements: z.string().optional(),
});

export const updateAssignmentSchema = createAssignmentSchema.partial();

// Submission validation schemas
export const createSubmissionSchema = z.object({
  content: z.string().optional(),
  fileUrls: z.array(z.string()).optional(),
  status: z.enum(['draft', 'submitted']).optional(),
});

export const gradeSubmissionSchema = z.object({
  grade: z.number().min(0).max(10000),
  feedback: z.string().optional(),
});

// Chat validation schemas
export const chatMessageSchema = z.object({
  message: z.string().min(1, 'Message is required'),
  module: z.string().default('general'),
  sessionId: z.string().optional(),
  context: z.string().optional(),
  model: z.string().optional(),
  // Free-form persona used by the in-app AI tools (dataset generator, prompt
  // helper, bias research, lab assistant). Capped to bound abuse of the shared
  // LLM keys. Ignored whenever a chatbotId is supplied (see below).
  systemPrompt: z.string().max(20000).optional(),
  // Server-resolved persona: when present, the chatbot's stored system prompt
  // is used and any caller-supplied systemPrompt is ignored.
  chatbotId: z.number().int().positive().optional(),
  conversationHistory: z
    .array(z.object({ role: z.enum(['user', 'assistant']), content: z.string() }))
    .max(40)
    .optional(),
});

// Chatbot validation schemas
export const createChatbotSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').regex(/^[a-z0-9-]+$/, 'Name must be lowercase with hyphens'),
  displayName: z.string().min(2, 'Display name must be at least 2 characters'),
  description: z.string().optional(),
  systemPrompt: z.string().min(10, 'System prompt must be at least 10 characters'),
  category: z.string().optional(),
  isActive: z.boolean().optional(),
  avatarUrl: z.string().optional().nullable().or(z.literal('')),
  welcomeMessage: z.string().optional().nullable().or(z.literal('')),
  personality: z.string().optional().nullable().or(z.literal('')),
  personalityPrompt: z.string().optional().nullable().or(z.literal('')),
  temperature: z.number().min(0).max(2).optional().nullable(),
  suggestedQuestions: z.string().optional().nullable().or(z.literal('')),
  dosRules: z.string().optional().nullable().or(z.literal('')),
  dontsRules: z.string().optional().nullable().or(z.literal('')),
  responseStyle: z.string().optional().nullable().or(z.literal('')),
  maxTokens: z.number().int().min(1).optional().nullable(),
  modelPreference: z.string().optional().nullable().or(z.literal('')),
  knowledgeContext: z.string().optional().nullable().or(z.literal('')),
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

// Registration policy validation schemas (see services/registrationPolicy.service.ts).
// A domain pattern is an exact domain (uef.fi) or a wildcard (*.edu).
const DOMAIN_LABEL = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/i;

const domainPatternSchema = z
  .string()
  .trim()
  .min(3, 'A domain must be at least 3 characters')
  .max(253, 'A domain may not exceed 253 characters')
  .refine(value => {
    const isWildcard = value.startsWith('*.');
    const labels = (isWildcard ? value.slice(2) : value).split('.');
    // A wildcard already names its scope ("*.edu"); a plain pattern must be a
    // full domain ("uef.fi"), never a bare TLD.
    if (labels.length < (isWildcard ? 1 : 2)) return false;
    return labels.every(label => DOMAIN_LABEL.test(label));
  }, 'Use a domain like uef.fi or a wildcard like *.edu');

const domainListSchema = z.array(domainPatternSchema).max(200);

export const updateRegistrationPolicySchema = z.object({
  mode: z.enum(['open', 'approval', 'invite_only', 'closed']).optional(),
  emailVerification: z.boolean().optional(),
  allowedEmailDomains: domainListSchema.optional(),
  blockedEmailDomains: domainListSchema.optional(),
  autoApproveDomains: domainListSchema.optional(),
  // 'admin' is intentionally absent: self-service signup never grants it.
  defaultRole: z.enum(['student', 'instructor']).optional(),
});

export type UpdateRegistrationPolicyInput = z.infer<typeof updateRegistrationPolicySchema>;

// Invitation validation schemas
//
// `role` here matches updateRegistrationPolicySchema's: 'admin' is absent for
// the same reason — an invitation is redeemed by self-service registration,
// and self-service registration never grants admin.
//
// `expiresInDays: null` is meaningfully different from omitting the field:
// null means "never expires", omitted means "use the default window".
const invitationRoleSchema = z.enum(['student', 'instructor']);

export const createInvitationSchema = z.object({
  email: z.string().email('Invalid email address').optional(),
  role: invitationRoleSchema.optional(),
  courseId: z.number().int().positive().optional(),
  maxUses: z.number().int().min(1).max(1000).optional(),
  expiresInDays: z.number().int().min(1).max(365).nullable().optional(),
});

export const bulkInvitationSchema = z.object({
  emails: z.array(z.string().email('Invalid email address')).min(1).max(500),
  role: invitationRoleSchema.optional(),
  courseId: z.number().int().positive().optional(),
  expiresInDays: z.number().int().min(1).max(365).nullable().optional(),
});

export type CreateInvitationInput = z.infer<typeof createInvitationSchema>;
export type BulkInvitationInput = z.infer<typeof bulkInvitationSchema>;

// Announcement validation schemas
export const createAnnouncementSchema = z.object({
  title: z.string().min(3, 'Title must be at least 3 characters'),
  content: z.string().min(10, 'Content must be at least 10 characters'),
});

// Type exports
export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
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

// =============================================================================
// AI AGENT ASSIGNMENT VALIDATION SCHEMAS
// =============================================================================

// Student Agent Config
export const createAgentConfigSchema = z.object({
  agentName: z.string().min(1, 'Agent name is required').max(100),
  agentTitle: z.string().max(100).optional().nullable(),
  personaDescription: z.string().max(500).optional(),
  systemPrompt: z.string().min(10, 'System prompt must be at least 10 characters'),
  dosRules: z.array(z.string()).optional(),
  dontsRules: z.array(z.string()).optional(),
  welcomeMessage: z.string().max(500).optional(),
  avatarImageUrl: z.string().optional().nullable(),
  // Enhanced builder fields
  pedagogicalRole: z.string().max(50).optional().nullable(),
  personality: z.string().max(50).optional().nullable(),
  personalityPrompt: z.string().max(2000).optional().nullable(),
  responseStyle: z.enum(['concise', 'balanced', 'detailed']).optional().nullable(),
  temperature: z.number().min(0).max(1).optional().nullable(),
  suggestedQuestions: z.array(z.string()).optional(),
  knowledgeContext: z.string().max(2000).optional().nullable(),
  // Prompt building blocks
  selectedPromptBlocks: z.array(z.string()).optional(),
});

export const updateAgentConfigSchema = createAgentConfigSchema.partial();

// Agent Test Message
export const agentTestMessageSchema = z.object({
  message: z.string().min(1, 'Message is required'),
  model: z.string().optional(),
  provider: z.string().optional(),
});

// Grade Agent Submission
export const gradeAgentSubmissionSchema = z.object({
  grade: z.number().min(0).max(100),
  feedback: z.string().optional(),
});

// Update Assignment schema to support ai_agent type
export const createAssignmentSchemaExtended = z.object({
  title: z.string().min(3, 'Title must be at least 3 characters'),
  description: z.string().optional(),
  instructions: z.string().optional(),
  submissionType: z.enum(['text', 'file', 'mixed', 'ai_agent']).optional(),
  maxFileSize: z.number().int().min(1).max(50).optional(),
  allowedFileTypes: z.string().optional(),
  dueDate: z.string().datetime().optional().nullable(),
  points: z.number().int().min(0).max(1000).optional(),
  weight: z.number().min(0).max(10).optional(),
  isPublished: z.boolean().optional(),
  moduleId: z.number().int().optional().nullable(),
  aiAssisted: z.boolean().optional(),
  aiPrompt: z.string().optional(),
  agentRequirements: z.string().optional(), // JSON string
});

// Type exports for agent assignments
export type CreateAgentConfigInput = z.infer<typeof createAgentConfigSchema>;
export type UpdateAgentConfigInput = z.infer<typeof updateAgentConfigSchema>;
export const generateDatasetSchema = z.object({
  description: z.string().min(10, 'Description must be at least 10 characters').max(500),
  model: z.string().optional(),
  provider: z.string().optional(),
});

export type AgentTestMessageInput = z.infer<typeof agentTestMessageSchema>;
export type GradeAgentSubmissionInput = z.infer<typeof gradeAgentSubmissionSchema>;
export type GenerateDatasetInput = z.infer<typeof generateDatasetSchema>;

// =============================================================================
// USER MANAGEMENT VALIDATION SCHEMAS
// =============================================================================

export const adminUpdateUserSchema = z.object({
  fullname: z.string().min(2).optional(),
  email: z.string().email().optional(),
  password: strongPasswordSchema.optional(),
  isActive: z.boolean().optional(),
  isInstructor: z.boolean().optional(),
  isAdmin: z.boolean().optional(),
  isConfirmed: z.boolean().optional(),
});

export const updateUserRolesSchema = z.object({
  isAdmin: z.boolean().optional(),
  isInstructor: z.boolean().optional(),
});

export const adminCreateUserSchema = z.object({
  fullname: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email(),
  password: strongPasswordSchema,
  role: z.enum(['admin', 'instructor', 'student']),
  isActive: z.boolean().optional(),
});

export const bulkEnrollSchema = z.object({
  userIds: z.array(z.number().int().positive()).min(1).max(1000),
  courseId: z.number().int().positive(),
  action: z.enum(['enroll', 'unenroll']),
});

// One lifecycle action applied across a selection of users. The cap matches
// bulkEnrollSchema; the service reports per-user skips rather than failing.
export const bulkUserActionSchema = z
  .object({
    userIds: z.array(z.number().int().positive()).min(1).max(1000),
    action: z.enum([
      'activate',
      'deactivate',
      'confirm',
      'setRole',
      'delete',
      'approve',
      'reject',
    ]),
    role: z.enum(['student', 'instructor', 'admin']).optional(),
  })
  .refine(v => v.action !== 'setRole' || !!v.role, {
    message: 'A role is required to change roles',
    path: ['role'],
  });

export const createEnrollmentSchema = z.object({
  userId: z.number().int().positive(),
  courseId: z.number().int().positive(),
});

export const addUserToCourseSchema = z.object({
  email: z.string().email(),
});

// =============================================================================
// BATCH ENROLLMENT VALIDATION SCHEMAS
// =============================================================================

export const batchEnrollmentRowSchema = z.object({
  email: z.string().email(),
  fullname: z.string().min(2).optional(),
});

// =============================================================================
// COURSE ROLE VALIDATION SCHEMAS
// =============================================================================

export const courseRoleSchema = z.object({
  userId: z.number().int().positive(),
  role: z.enum(['ta', 'co_instructor', 'course_admin']),
  permissions: z.array(z.enum(['grade', 'edit_content', 'manage_students', 'view_analytics'])).optional(),
});

export const updateCourseRoleSchema = z.object({
  role: z.enum(['ta', 'co_instructor', 'course_admin']).optional(),
  permissions: z.array(z.enum(['grade', 'edit_content', 'manage_students', 'view_analytics'])).optional(),
});

// Type exports for user management
export type AdminUpdateUserInput = z.infer<typeof adminUpdateUserSchema>;
export type UpdateUserRolesInput = z.infer<typeof updateUserRolesSchema>;
export type CreateEnrollmentInput = z.infer<typeof createEnrollmentSchema>;
export type AddUserToCourseInput = z.infer<typeof addUserToCourseSchema>;
export type BatchEnrollmentRowInput = z.infer<typeof batchEnrollmentRowSchema>;
export type CourseRoleInput = z.infer<typeof courseRoleSchema>;
export type UpdateCourseRoleInput = z.infer<typeof updateCourseRoleSchema>;

// =============================================================================
// SURVEY VALIDATION SCHEMAS
// =============================================================================

export const createSurveySchema = z.object({
  title: z.string().min(3, 'Title must be at least 3 characters'),
  description: z.string().optional(),
  isPublished: z.boolean().optional(),
  isAnonymous: z.boolean().optional(),
});

export const updateSurveySchema = createSurveySchema.partial();

export const createSurveyQuestionSchema = z.object({
  questionText: z.string().min(3, 'Question must be at least 3 characters'),
  questionType: z.enum(['single_choice', 'multiple_choice', 'free_text']),
  options: z.array(z.string()).optional(), // Array of options for choice questions
  isRequired: z.boolean().optional(),
  orderIndex: z.number().int().min(0).optional(),
});

export const updateSurveyQuestionSchema = createSurveyQuestionSchema.partial();

export const reorderQuestionsSchema = z.object({
  questionIds: z.array(z.number().int()),
});

export const submitSurveyResponseSchema = z.object({
  context: z.enum(['standalone', 'lecture', 'post_assignment', 'module']).optional(),
  contextId: z.number().int().positive().optional().nullable(),
  moduleId: z.number().int().positive().optional().nullable(),
  answers: z.array(z.object({
    questionId: z.number().int().positive(),
    answerValue: z.union([z.string(), z.array(z.string())]), // string for single/free_text, array for multiple_choice
  })),
});

// Type exports for surveys
export type CreateSurveyInput = z.infer<typeof createSurveySchema>;
export type UpdateSurveyInput = z.infer<typeof updateSurveySchema>;
export type CreateSurveyQuestionInput = z.infer<typeof createSurveyQuestionSchema>;
export type UpdateSurveyQuestionInput = z.infer<typeof updateSurveyQuestionSchema>;
export type SubmitSurveyResponseInput = z.infer<typeof submitSurveyResponseSchema>;

// =============================================================================
// SURVEY GENERATION VALIDATION SCHEMAS
// =============================================================================

export const generateSurveySchema = z.object({
  topic: z.string().min(3, 'Topic must be at least 3 characters').max(500),
  questionCount: z.number().int().min(1).max(15),
  surveyType: z.enum(['general_feedback', 'course_evaluation', 'likert_scale', 'learning_strategies', 'custom']),
  isAnonymous: z.boolean().optional(),
  additionalInstructions: z.string().max(1000).optional(),
});

export type GenerateSurveyInput = z.infer<typeof generateSurveySchema>;

// =============================================================================
// LECTURE AI HELPER VALIDATION SCHEMAS
// =============================================================================

export const lectureAIHelperChatSchema = z.object({
  mode: z.enum(['explain', 'discuss']),
  message: z.string().min(1, 'Message is required'),
  sessionId: z.string().optional(),
  model: z.string().optional(),
  provider: z.string().optional(),
});

export type LectureAIHelperChatInput = z.infer<typeof lectureAIHelperChatSchema>;

// PDF page ranges schema for selecting specific pages from PDFs
const pdfPageRangesSchema = z.record(z.string(), z.string()).optional();

// Explain mode thread schemas
export const createExplainThreadSchema = z.object({
  question: z.string().min(1, 'Question is required').max(2000, 'Question too long'),
  pdfPageRanges: pdfPageRangesSchema,
  model: z.string().optional(),
  provider: z.string().optional(),
});

export const addExplainFollowUpSchema = z.object({
  question: z.string().min(1, 'Question is required').max(2000, 'Question too long'),
  parentPostId: z.number().optional(),
  pdfPageRanges: pdfPageRangesSchema,
});

export type CreateExplainThreadInput = z.infer<typeof createExplainThreadSchema>;
export type AddExplainFollowUpInput = z.infer<typeof addExplainFollowUpSchema>;
