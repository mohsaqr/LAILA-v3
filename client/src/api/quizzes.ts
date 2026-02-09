import apiClient from './client';
import { ApiResponse } from '../types';

// Types
export interface Quiz {
  id: number;
  courseId: number;
  moduleId?: number;
  title: string;
  description?: string;
  instructions?: string;
  timeLimit?: number;
  maxAttempts: number;
  passingScore: number;
  shuffleQuestions: boolean;
  shuffleOptions: boolean;
  showResults: 'after_submit' | 'after_due_date' | 'never';
  isPublished: boolean;
  dueDate?: string;
  availableFrom?: string;
  createdAt: string;
  updatedAt: string;
  module?: { id: number; title: string };
  _count?: { questions: number; attempts: number };
  myAttempts?: QuizAttemptSummary[];
}

export interface QuizQuestion {
  id: number;
  questionType: 'multiple_choice' | 'true_false' | 'short_answer' | 'fill_in_blank';
  questionText: string;
  options?: string[];
  correctAnswer?: string;
  explanation?: string;
  points: number;
  orderIndex: number;
  savedAnswer?: string;
}

export interface QuizAttemptSummary {
  quizId: number;
  attemptNumber: number;
  score?: number;
  status: 'in_progress' | 'submitted' | 'graded';
  submittedAt?: string;
}

export interface QuizAttempt {
  id: number;
  attemptNumber: number;
  startedAt: string;
  submittedAt?: string;
  score?: number;
  pointsEarned?: number;
  pointsTotal?: number;
  timeTaken?: number;
  status: string;
  passed?: boolean;
}

export interface StartAttemptResponse {
  attempt: {
    id: number;
    attemptNumber: number;
    startedAt: string;
    status: string;
  };
  quiz: {
    id: number;
    title: string;
    instructions?: string;
    timeLimit?: number;
  };
  questions: QuizQuestion[];
}

export interface AttemptResult {
  question: QuizQuestion & { correctAnswer: string };
  userAnswer: string | null;
  isCorrect: boolean | null;
  pointsAwarded: number;
}

export interface AttemptResultsResponse {
  attempt: QuizAttempt;
  quiz: { id: number; title: string; passingScore: number };
  results: AttemptResult[];
}

export interface CreateQuizInput {
  title: string;
  description?: string;
  instructions?: string;
  timeLimit?: number;
  maxAttempts?: number;
  passingScore?: number;
  shuffleQuestions?: boolean;
  shuffleOptions?: boolean;
  showResults?: 'after_submit' | 'after_due_date' | 'never';
  dueDate?: string;
  availableFrom?: string;
  moduleId?: number;
}

export interface CreateQuestionInput {
  questionType: 'multiple_choice' | 'true_false' | 'short_answer' | 'fill_in_blank';
  questionText: string;
  options?: string[];
  correctAnswer: string;
  explanation?: string;
  points?: number;
  orderIndex?: number;
}

export const quizzesApi = {
  // Quiz CRUD
  getQuizzes: async (courseId: number): Promise<Quiz[]> => {
    const response = await apiClient.get<ApiResponse<Quiz[]>>(`/quizzes/course/${courseId}`);
    return response.data.data!;
  },

  getQuiz: async (quizId: number): Promise<Quiz & { questions: QuizQuestion[] }> => {
    const response = await apiClient.get<ApiResponse<Quiz & { questions: QuizQuestion[] }>>(`/quizzes/${quizId}`);
    return response.data.data!;
  },

  createQuiz: async (courseId: number, data: CreateQuizInput): Promise<Quiz> => {
    const response = await apiClient.post<ApiResponse<Quiz>>(`/quizzes/course/${courseId}`, data);
    return response.data.data!;
  },

  updateQuiz: async (quizId: number, data: Partial<CreateQuizInput> & { isPublished?: boolean }): Promise<Quiz> => {
    const response = await apiClient.put<ApiResponse<Quiz>>(`/quizzes/${quizId}`, data);
    return response.data.data!;
  },

  deleteQuiz: async (quizId: number): Promise<void> => {
    await apiClient.delete(`/quizzes/${quizId}`);
  },

  // Question management
  addQuestion: async (quizId: number, data: CreateQuestionInput): Promise<QuizQuestion> => {
    const response = await apiClient.post<ApiResponse<QuizQuestion>>(`/quizzes/${quizId}/questions`, data);
    return response.data.data!;
  },

  updateQuestion: async (questionId: number, data: Partial<CreateQuestionInput>): Promise<QuizQuestion> => {
    const response = await apiClient.put<ApiResponse<QuizQuestion>>(`/quizzes/questions/${questionId}`, data);
    return response.data.data!;
  },

  deleteQuestion: async (questionId: number): Promise<void> => {
    await apiClient.delete(`/quizzes/questions/${questionId}`);
  },

  reorderQuestions: async (quizId: number, questionIds: number[]): Promise<void> => {
    await apiClient.put(`/quizzes/${quizId}/questions/reorder`, { questionIds });
  },

  // Quiz attempts (student)
  startAttempt: async (quizId: number): Promise<StartAttemptResponse> => {
    const response = await apiClient.post<ApiResponse<StartAttemptResponse>>(`/quizzes/${quizId}/attempts`);
    return response.data.data!;
  },

  saveAnswer: async (attemptId: number, questionId: number, answer: string): Promise<void> => {
    await apiClient.post(`/quizzes/attempts/${attemptId}/answers`, { questionId, answer });
  },

  submitAttempt: async (attemptId: number): Promise<QuizAttempt> => {
    const response = await apiClient.post<ApiResponse<QuizAttempt>>(`/quizzes/attempts/${attemptId}/submit`);
    return response.data.data!;
  },

  getAttemptResults: async (attemptId: number): Promise<AttemptResultsResponse> => {
    const response = await apiClient.get<ApiResponse<AttemptResultsResponse>>(`/quizzes/attempts/${attemptId}/results`);
    return response.data.data!;
  },

  // Instructor view
  getQuizAttempts: async (quizId: number): Promise<(QuizAttempt & { user: { id: number; fullname: string; email: string } })[]> => {
    const response = await apiClient.get<ApiResponse<any[]>>(`/quizzes/${quizId}/attempts`);
    return response.data.data!;
  },
};
