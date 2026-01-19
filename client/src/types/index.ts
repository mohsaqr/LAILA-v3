// User types
export interface User {
  id: number;
  fullname: string;
  email: string;
  isAdmin: boolean;
  isInstructor: boolean;
  isConfirmed?: boolean;
  createdAt?: string;
  lastLogin?: string;
}

export interface AuthResponse {
  user: User;
  token: string;
}

// Course types
export interface Course {
  id: number;
  title: string;
  slug: string;
  description: string | null;
  thumbnail: string | null;
  instructorId: number;
  category: string | null;
  difficulty: 'beginner' | 'intermediate' | 'advanced' | null;
  status: 'draft' | 'published' | 'archived';
  isPublic: boolean;
  createdAt: string;
  updatedAt: string;
  publishedAt: string | null;
  instructor?: {
    id: number;
    fullname: string;
    email?: string;
  };
  modules?: CourseModule[];
  _count?: {
    enrollments: number;
    modules: number;
  };
}

export interface CourseModule {
  id: number;
  courseId: number;
  title: string;
  description: string | null;
  label: string | null; // e.g., "Week 1 - Foundations"
  orderIndex: number;
  isPublished: boolean;
  lectures?: Lecture[];
  _count?: {
    lectures: number;
  };
}

export interface Lecture {
  id: number;
  moduleId: number;
  title: string;
  content: string | null;
  contentType: 'text' | 'video' | 'mixed';
  videoUrl: string | null;
  duration: number | null;
  orderIndex: number;
  isPublished: boolean;
  isFree: boolean;
  attachments?: LectureAttachment[];
  sections?: LectureSection[];
  module?: {
    course: {
      id: number;
      title: string;
      instructorId: number;
    };
  };
}

export interface LectureAttachment {
  id: number;
  lectureId: number;
  fileName: string;
  fileUrl: string;
  fileType: string;
  fileSize: number | null;
}

export interface LectureSection {
  id: number;
  lectureId: number;
  title: string | null; // Section title (e.g., "Introduction", "Key Concepts")
  type: 'text' | 'file' | 'ai-generated' | 'chatbot' | 'assignment';
  content: string | null;
  fileName: string | null;
  fileUrl: string | null;
  fileType: string | null;
  fileSize: number | null;
  order: number;
  createdAt?: string;
  updatedAt?: string;
  // Chatbot fields
  chatbotTitle?: string | null;
  chatbotIntro?: string | null;
  chatbotImageUrl?: string | null;
  chatbotSystemPrompt?: string | null;
  chatbotWelcome?: string | null;
  // Assignment fields
  assignmentId?: number | null;
  assignment?: Assignment | null;
  showDeadline?: boolean;
  showPoints?: boolean;
}

export interface ChatbotConversationMessage {
  id: number;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
}

export interface ChatbotSendMessageResponse {
  userMessage: {
    role: 'user';
    content: string;
  };
  assistantMessage: ChatbotConversationMessage;
  model: string;
  responseTime: number;
}

export interface AssignmentListItem {
  id: number;
  title: string;
  description: string | null;
  dueDate: string | null;
  points: number;
  isPublished: boolean;
  module?: {
    id: number;
    title: string;
  } | null;
}

// Enrollment types
export interface Enrollment {
  id: number;
  userId: number;
  courseId: number;
  status: 'active' | 'completed' | 'dropped';
  progress: number;
  enrolledAt: string;
  completedAt: string | null;
  lastAccessAt: string | null;
  course?: Course;
  lectureProgress?: LectureProgress[];
}

export interface LectureProgress {
  id: number;
  enrollmentId: number;
  lectureId: number;
  isCompleted: boolean;
  completedAt: string | null;
  timeSpent: number;
  lecture?: {
    id: number;
    title: string;
    moduleId: number;
  };
}

export interface CourseProgress {
  enrollmentId: number;
  courseId: number;
  progress: number;
  status: string;
  enrolledAt: string;
  completedAt: string | null;
  lastAccessAt: string | null;
  moduleProgress: {
    moduleId: number;
    title: string;
    lectures: {
      lectureId: number;
      title: string;
      isCompleted: boolean;
    }[];
    completedCount: number;
    totalCount: number;
  }[];
}

// Assignment types
export interface Assignment {
  id: number;
  courseId: number;
  moduleId: number | null;
  title: string;
  description: string | null;
  instructions: string | null;
  submissionType: 'text' | 'file' | 'mixed';
  maxFileSize: number | null;
  allowedFileTypes: string | null;
  dueDate: string | null;
  points: number;
  isPublished: boolean;
  aiAssisted: boolean;
  aiPrompt: string | null;
  module?: {
    id: number;
    title: string;
  };
  course?: {
    id: number;
    title: string;
    instructorId: number;
  };
  mySubmission?: AssignmentSubmission | null;
  _count?: {
    submissions: number;
  };
}

export interface AssignmentSubmission {
  id: number;
  assignmentId: number;
  userId: number;
  content: string | null;
  fileUrls: string | null;
  status: 'draft' | 'submitted' | 'graded' | 'returned';
  submittedAt: string;
  grade: number | null;
  feedback: string | null;
  gradedAt: string | null;
  gradedById: number | null;
  aiFeedback: string | null;
  user?: {
    id: number;
    fullname: string;
    email: string;
  };
  gradedBy?: {
    id: number;
    fullname: string;
  };
  assignment?: {
    id: number;
    title: string;
    points: number;
  };
}

// Chatbot types
export interface Chatbot {
  id: number;
  name: string;
  displayName: string;
  description: string | null;
  systemPrompt: string;
  category: string | null;
  isActive: boolean;
  isSystem: boolean;
}

export interface ChatMessage {
  id?: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp?: Date;
}

export interface ChatResponse {
  reply: string;
  model: string;
  responseTime: number;
}

// API Response types
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

export interface PaginatedResponse<T> {
  success: boolean;
  data?: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// Dashboard stats
export interface UserStats {
  enrolledCourses: number;
  completedCourses: number;
  totalTimeSpent: number;
  submittedAssignments: number;
}

export interface InstructorStats {
  totalCourses: number;
  totalStudents: number;
  totalAssignments: number;
  pendingGrading: number;
}

export interface AdminStats {
  totalUsers: number;
  activeUsers: number;
  totalCourses: number;
  publishedCourses: number;
  totalEnrollments: number;
  totalAssignments: number;
  totalChatLogs: number;
}

// Form data types for teaching interface
export interface CourseFormData {
  title: string;
  description: string;
  category: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced' | '';
  thumbnail: string;
  isPublic: boolean;
}

export interface ModuleFormData {
  title: string;
  description: string;
  label: string;
}

export interface LectureFormData {
  title: string;
  content: string;
  contentType: 'text' | 'video' | 'mixed';
  videoUrl: string;
  duration: number;
  isFree: boolean;
}

export interface AssignmentFormData {
  title: string;
  description: string;
  instructions: string;
  moduleId: number | null;
  submissionType: 'text' | 'file' | 'mixed';
  dueDate: string;
  points: number;
  isPublished: boolean;
}

export interface GradeFormData {
  grade: number;
  feedback: string;
}

// Section types for lecture editor
export interface CreateSectionData {
  type: 'text' | 'file' | 'ai-generated' | 'chatbot' | 'assignment';
  title?: string;
  content?: string;
  fileName?: string;
  fileUrl?: string;
  fileType?: string;
  fileSize?: number;
  order?: number;
  // Chatbot fields
  chatbotTitle?: string;
  chatbotIntro?: string;
  chatbotImageUrl?: string;
  chatbotSystemPrompt?: string;
  chatbotWelcome?: string;
  // Assignment fields
  assignmentId?: number;
  showDeadline?: boolean;
  showPoints?: boolean;
}

export interface UpdateSectionData {
  title?: string;
  content?: string;
  fileName?: string;
  fileUrl?: string;
  fileType?: string;
  fileSize?: number;
  order?: number;
  // Chatbot fields
  chatbotTitle?: string;
  chatbotIntro?: string;
  chatbotImageUrl?: string | null;
  chatbotSystemPrompt?: string;
  chatbotWelcome?: string;
  // Assignment fields
  assignmentId?: number;
  showDeadline?: boolean;
  showPoints?: boolean;
}

export interface GenerateAIContentRequest {
  prompt: string;
  context?: string;
  lectureId?: number;
}

// Chatbot Analytics Types (Instructor)
export interface ChatbotSectionSummary {
  id: number;
  title: string;
  lectureId: number;
  lectureTitle: string;
  moduleTitle: string;
  totalConversations: number;
}

export interface ChatbotAnalytics {
  totalConversations: number;
  totalMessages: number;
  uniqueStudents: number;
  avgMessagesPerConversation: number;
  recentActivity: {
    id: number;
    role: string;
    content: string;
    userName: string;
    sectionTitle: string;
    createdAt: string;
  }[];
}

export interface ChatbotConversationSummary {
  id: number;
  user: {
    id: number;
    fullname: string;
    email: string;
  };
  messageCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface ChatbotConversationsResponse {
  conversations: ChatbotConversationSummary[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface ChatbotConversationDetail {
  conversation: {
    id: number;
    user: {
      id: number;
      fullname: string;
      email: string;
    };
    sectionTitle: string;
    lectureTitle: string;
    moduleTitle: string;
    createdAt: string;
    updatedAt: string;
  };
  messages: ChatbotConversationMessage[];
}
