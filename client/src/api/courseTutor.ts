import { apiClient as api } from './client';

// Types
export interface CourseTutor {
  id: number;
  courseId: number;
  chatbotId: number;
  customName: string | null;
  customDescription: string | null;
  customSystemPrompt: string | null;
  customWelcomeMessage: string | null;
  customPersonality: string | null;
  customTemperature: number | null;
  isActive: boolean;
  displayOrder: number;
  createdAt: string;
  updatedAt: string;
  chatbot?: {
    id: number;
    name: string;
    displayName: string;
    description: string | null;
    systemPrompt: string;
    welcomeMessage: string | null;
    avatarUrl: string | null;
    personality: string | null;
    temperature: number | null;
  };
  _count?: {
    conversations: number;
  };
  totalMessages?: number;
}

export interface MergedTutorConfig {
  id: number;
  courseTutorId: number;
  name: string;
  displayName: string;
  description: string | null;
  systemPrompt: string;
  welcomeMessage: string | null;
  avatarUrl: string | null;
  personality: string | null;
  temperature: number | null;
  isCustomized: boolean;
}

export interface AvailableTutor {
  id: number;
  name: string;
  displayName: string;
  description: string | null;
  avatarUrl: string | null;
  personality: string | null;
  alreadyAdded: boolean;
}

export interface Conversation {
  id: number;
  courseTutorId: number;
  userId: number;
  title: string | null;
  createdAt: string;
  updatedAt: string;
  messages?: Message[];
}

export interface Message {
  id: number;
  conversationId: number;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
}

export interface TutorStats {
  totalTutors: number;
  activeTutors: number;
  totalConversations: number;
  totalMessages: number;
  tutorStats: Array<{
    id: number;
    name: string;
    conversations: number;
    messages: number;
  }>;
}

export interface CreateTutorInput {
  chatbotId: number;
  customName?: string;
  customDescription?: string;
  customSystemPrompt?: string;
  customWelcomeMessage?: string;
  customPersonality?: string;
  customTemperature?: number;
}

export interface UpdateTutorInput {
  customName?: string | null;
  customDescription?: string | null;
  customSystemPrompt?: string | null;
  customWelcomeMessage?: string | null;
  customPersonality?: string | null;
  customTemperature?: number | null;
  isActive?: boolean;
}

export interface BuildTutorInput {
  name: string;
  displayName: string;
  description?: string;
  systemPrompt: string;
  welcomeMessage?: string;
  personality?: string;
  temperature?: number;
}

// =============================================================================
// INSTRUCTOR API
// =============================================================================

/**
 * Get all tutors for a course (instructor view with stats)
 */
export const getCourseTutors = async (courseId: number): Promise<CourseTutor[]> => {
  const response = await api.get(`/courses/${courseId}/tutors`);
  return response.data.data;
};

/**
 * Get available global tutors that can be added to the course
 */
export const getAvailableTutors = async (courseId: number): Promise<AvailableTutor[]> => {
  const response = await api.get(`/courses/${courseId}/tutors/available`);
  return response.data.data;
};

/**
 * Add a tutor to the course
 */
export const addTutorToCourse = async (
  courseId: number,
  input: CreateTutorInput
): Promise<CourseTutor> => {
  const response = await api.post(`/courses/${courseId}/tutors`, input);
  return response.data.data;
};

/**
 * Add multiple tutors to the course at once (batch)
 */
export const addTutorsToCourse = async (
  courseId: number,
  chatbotIds: number[]
): Promise<CourseTutor[]> => {
  const response = await api.post(`/courses/${courseId}/tutors/batch`, { chatbotIds });
  return response.data.data;
};

/**
 * Build a new tutor (create chatbot) and add to course
 */
export const buildAndAddTutor = async (
  courseId: number,
  input: BuildTutorInput
): Promise<CourseTutor> => {
  const response = await api.post(`/courses/${courseId}/tutors/build`, input);
  return response.data.data;
};

/**
 * Update tutor customization
 */
export const updateCourseTutor = async (
  courseId: number,
  tutorId: number,
  input: UpdateTutorInput
): Promise<CourseTutor> => {
  const response = await api.put(`/courses/${courseId}/tutors/${tutorId}`, input);
  return response.data.data;
};

/**
 * Remove tutor from course
 */
export const removeCourseTutor = async (
  courseId: number,
  tutorId: number
): Promise<void> => {
  await api.delete(`/courses/${courseId}/tutors/${tutorId}`);
};

/**
 * Reorder tutors
 */
export const reorderCourseTutors = async (
  courseId: number,
  orderedIds: number[]
): Promise<void> => {
  await api.put(`/courses/${courseId}/tutors/reorder`, { orderedIds });
};

/**
 * Get tutor statistics
 */
export const getTutorStats = async (courseId: number): Promise<TutorStats> => {
  const response = await api.get(`/courses/${courseId}/tutors/stats`);
  return response.data.data;
};

// =============================================================================
// STUDENT API
// =============================================================================

/**
 * Get tutors available for a student in a course
 */
export const getStudentTutors = async (courseId: number): Promise<MergedTutorConfig[]> => {
  const response = await api.get(`/courses/${courseId}/tutors`);
  return response.data.data;
};

/**
 * Get student's conversations with a tutor
 */
export const getConversations = async (
  courseId: number,
  tutorId: number
): Promise<Conversation[]> => {
  const response = await api.get(`/courses/${courseId}/tutors/${tutorId}/conversations`);
  return response.data.data;
};

/**
 * Create a new conversation
 */
export const createConversation = async (
  courseId: number,
  tutorId: number
): Promise<Conversation> => {
  const response = await api.post(`/courses/${courseId}/tutors/${tutorId}/conversations`);
  return response.data.data;
};

/**
 * Get conversation with messages
 */
export const getConversation = async (
  courseId: number,
  conversationId: number
): Promise<Conversation & { messages: Message[] }> => {
  const response = await api.get(`/courses/${courseId}/tutors/conversations/${conversationId}`);
  return response.data.data;
};

/**
 * Send a message
 */
export const sendMessage = async (
  courseId: number,
  conversationId: number,
  message: string
): Promise<{ userMessage: Message; assistantMessage: Message }> => {
  const response = await api.post(
    `/courses/${courseId}/tutors/conversations/${conversationId}/messages`,
    { message }
  );
  return response.data.data;
};

/**
 * Delete a conversation
 */
export const deleteConversation = async (
  courseId: number,
  conversationId: number
): Promise<void> => {
  await api.delete(`/courses/${courseId}/tutors/conversations/${conversationId}`);
};

// Export as namespace
export const courseTutorApi = {
  // Instructor
  getCourseTutors,
  getAvailableTutors,
  addTutorToCourse,
  addTutorsToCourse,
  buildAndAddTutor,
  updateCourseTutor,
  removeCourseTutor,
  reorderCourseTutors,
  getTutorStats,
  // Student
  getStudentTutors,
  getConversations,
  createConversation,
  getConversation,
  sendMessage,
  deleteConversation,
};
