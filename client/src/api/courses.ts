import apiClient from './client';
import {
  Course,
  CourseModule,
  Lecture,
  LectureSection,
  CreateSectionData,
  UpdateSectionData,
  GenerateAIContentRequest,
  ApiResponse,
  PaginatedResponse,
  ChatbotConversationMessage,
  ChatbotSendMessageResponse,
  AssignmentListItem,
  ChatbotSectionSummary,
  ChatbotAnalytics,
  ChatbotConversationsResponse,
  ChatbotConversationDetail,
} from '../types';

interface CourseFilters {
  category?: string;
  difficulty?: string;
  search?: string;
  page?: number;
  limit?: number;
}

export const coursesApi = {
  // Catalog
  getCourses: async (filters: CourseFilters = {}) => {
    const params = new URLSearchParams();
    if (filters.category) params.append('category', filters.category);
    if (filters.difficulty) params.append('difficulty', filters.difficulty);
    if (filters.search) params.append('search', filters.search);
    if (filters.page) params.append('page', filters.page.toString());
    if (filters.limit) params.append('limit', filters.limit.toString());

    const response = await apiClient.get<PaginatedResponse<Course> & { courses: Course[] }>(
      `/courses?${params.toString()}`
    );
    return {
      courses: response.data.courses || response.data.data || [],
      pagination: response.data.pagination,
    };
  },

  getCourseById: async (id: number) => {
    const response = await apiClient.get<ApiResponse<Course>>(`/courses/${id}`);
    return response.data.data!;
  },

  getCourseBySlug: async (slug: string) => {
    const response = await apiClient.get<ApiResponse<Course>>(`/courses/slug/${slug}`);
    return response.data.data!;
  },

  // Instructor courses
  getMyCourses: async () => {
    const response = await apiClient.get<ApiResponse<Course[]>>('/courses/my-courses');
    return response.data.data!;
  },

  createCourse: async (data: Partial<Course>) => {
    const response = await apiClient.post<ApiResponse<Course>>('/courses', data);
    return response.data.data!;
  },

  updateCourse: async (id: number, data: Partial<Course>) => {
    const response = await apiClient.put<ApiResponse<Course>>(`/courses/${id}`, data);
    return response.data.data!;
  },

  deleteCourse: async (id: number) => {
    const response = await apiClient.delete<ApiResponse<{ message: string }>>(`/courses/${id}`);
    return response.data;
  },

  publishCourse: async (id: number) => {
    const response = await apiClient.post<ApiResponse<Course>>(`/courses/${id}/publish`);
    return response.data.data!;
  },

  unpublishCourse: async (id: number) => {
    const response = await apiClient.post<ApiResponse<Course>>(`/courses/${id}/unpublish`);
    return response.data.data!;
  },

  getCourseStudents: async (id: number) => {
    const response = await apiClient.get<ApiResponse<any[]>>(`/courses/${id}/students`);
    return response.data.data!;
  },

  // Modules
  getModules: async (courseId: number) => {
    const response = await apiClient.get<ApiResponse<CourseModule[]>>(`/courses/${courseId}/modules`);
    return response.data.data!;
  },

  createModule: async (courseId: number, data: Partial<CourseModule>) => {
    const response = await apiClient.post<ApiResponse<CourseModule>>(`/courses/${courseId}/modules`, data);
    return response.data.data!;
  },

  updateModule: async (moduleId: number, data: Partial<CourseModule>) => {
    const response = await apiClient.put<ApiResponse<CourseModule>>(`/courses/modules/${moduleId}`, data);
    return response.data.data!;
  },

  deleteModule: async (moduleId: number) => {
    const response = await apiClient.delete<ApiResponse<{ message: string }>>(`/courses/modules/${moduleId}`);
    return response.data;
  },

  reorderModules: async (courseId: number, moduleIds: number[]) => {
    const response = await apiClient.put<ApiResponse<{ message: string }>>(
      `/courses/${courseId}/modules/reorder`,
      { moduleIds }
    );
    return response.data;
  },

  // Lectures
  getLectures: async (moduleId: number) => {
    const response = await apiClient.get<ApiResponse<Lecture[]>>(`/courses/modules/${moduleId}/lectures`);
    return response.data.data!;
  },

  getLectureById: async (lectureId: number) => {
    const response = await apiClient.get<ApiResponse<Lecture>>(`/courses/lectures/${lectureId}`);
    return response.data.data!;
  },

  createLecture: async (moduleId: number, data: Partial<Lecture>) => {
    const response = await apiClient.post<ApiResponse<Lecture>>(`/courses/modules/${moduleId}/lectures`, data);
    return response.data.data!;
  },

  updateLecture: async (lectureId: number, data: Partial<Lecture>) => {
    const response = await apiClient.put<ApiResponse<Lecture>>(`/courses/lectures/${lectureId}`, data);
    return response.data.data!;
  },

  deleteLecture: async (lectureId: number) => {
    const response = await apiClient.delete<ApiResponse<{ message: string }>>(`/courses/lectures/${lectureId}`);
    return response.data;
  },

  reorderLectures: async (moduleId: number, lectureIds: number[]) => {
    const response = await apiClient.put<ApiResponse<{ message: string }>>(
      `/courses/modules/${moduleId}/lectures/reorder`,
      { lectureIds }
    );
    return response.data;
  },

  // Sections
  getSections: async (lectureId: number) => {
    const response = await apiClient.get<ApiResponse<LectureSection[]>>(
      `/courses/lectures/${lectureId}/sections`
    );
    return response.data.data!;
  },

  createSection: async (lectureId: number, data: CreateSectionData) => {
    const response = await apiClient.post<ApiResponse<LectureSection>>(
      `/courses/lectures/${lectureId}/sections`,
      data
    );
    return response.data.data!;
  },

  updateSection: async (sectionId: number, data: UpdateSectionData) => {
    const response = await apiClient.put<ApiResponse<LectureSection>>(
      `/courses/sections/${sectionId}`,
      data
    );
    return response.data.data!;
  },

  deleteSection: async (sectionId: number) => {
    const response = await apiClient.delete<ApiResponse<{ message: string }>>(
      `/courses/sections/${sectionId}`
    );
    return response.data;
  },

  reorderSections: async (lectureId: number, sectionIds: number[]) => {
    const response = await apiClient.put<ApiResponse<{ message: string }>>(
      `/courses/lectures/${lectureId}/sections/reorder`,
      { sectionIds }
    );
    return response.data;
  },

  generateAIContent: async (data: GenerateAIContentRequest) => {
    const response = await apiClient.post<ApiResponse<{ content: string }>>(
      '/courses/sections/generate',
      data
    );
    return response.data.data!;
  },

  // Get assignments list for section (instructor)
  getAssignmentsForSection: async (courseId: number) => {
    const response = await apiClient.get<ApiResponse<AssignmentListItem[]>>(
      `/courses/${courseId}/assignments/list`
    );
    return response.data.data!;
  },

  // Chatbot conversation methods (student)
  sendChatbotMessage: async (sectionId: number, message: string) => {
    const response = await apiClient.post<ApiResponse<ChatbotSendMessageResponse>>(
      `/courses/sections/${sectionId}/chat`,
      { message }
    );
    return response.data.data!;
  },

  getChatbotHistory: async (sectionId: number) => {
    const response = await apiClient.get<ApiResponse<ChatbotConversationMessage[]>>(
      `/courses/sections/${sectionId}/chat/history`
    );
    return response.data.data!;
  },

  clearChatbotHistory: async (sectionId: number) => {
    const response = await apiClient.delete<ApiResponse<{ message: string }>>(
      `/courses/sections/${sectionId}/chat`
    );
    return response.data;
  },

  // Chatbot Analytics (Instructor)
  getChatbotSections: async (courseId: number) => {
    const response = await apiClient.get<ApiResponse<ChatbotSectionSummary[]>>(
      `/courses/${courseId}/chatbot-sections`
    );
    return response.data.data!;
  },

  getChatbotAnalytics: async (courseId: number) => {
    const response = await apiClient.get<ApiResponse<ChatbotAnalytics>>(
      `/courses/${courseId}/chatbot-analytics`
    );
    return response.data.data!;
  },

  getChatbotConversations: async (sectionId: number, page = 1, limit = 20) => {
    const response = await apiClient.get<ApiResponse<ChatbotConversationsResponse>>(
      `/courses/sections/${sectionId}/conversations?page=${page}&limit=${limit}`
    );
    return response.data.data!;
  },

  getChatbotConversationMessages: async (conversationId: number) => {
    const response = await apiClient.get<ApiResponse<ChatbotConversationDetail>>(
      `/courses/chatbot-conversations/${conversationId}`
    );
    return response.data.data!;
  },
};
