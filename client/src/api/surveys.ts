import apiClient from './client';
import {
  Survey,
  SurveyQuestion,
  SurveyResponse,
  CreateSurveyData,
  CreateSurveyQuestionData,
  SubmitSurveyResponseData,
  SurveyResponsesData,
  ApiResponse,
} from '../types';

export const surveysApi = {
  // =============================================================================
  // SURVEY CRUD (Instructor)
  // =============================================================================

  getSurveys: async (courseId?: number) => {
    const params = courseId ? `?courseId=${courseId}` : '';
    const response = await apiClient.get<ApiResponse<Survey[]>>(`/surveys${params}`);
    return response.data.data!;
  },

  getSurveyById: async (id: number) => {
    const response = await apiClient.get<ApiResponse<Survey>>(`/surveys/${id}`);
    return response.data.data!;
  },

  createSurvey: async (data: CreateSurveyData) => {
    const response = await apiClient.post<ApiResponse<Survey>>('/surveys', data);
    return response.data.data!;
  },

  updateSurvey: async (id: number, data: Partial<CreateSurveyData>) => {
    const response = await apiClient.put<ApiResponse<Survey>>(`/surveys/${id}`, data);
    return response.data.data!;
  },

  deleteSurvey: async (id: number) => {
    const response = await apiClient.delete<ApiResponse<{ message: string }>>(`/surveys/${id}`);
    return response.data;
  },

  publishSurvey: async (id: number) => {
    const response = await apiClient.post<ApiResponse<Survey>>(`/surveys/${id}/publish`);
    return response.data.data!;
  },

  // =============================================================================
  // QUESTIONS
  // =============================================================================

  addQuestion: async (surveyId: number, data: CreateSurveyQuestionData) => {
    const response = await apiClient.post<ApiResponse<SurveyQuestion>>(
      `/surveys/${surveyId}/questions`,
      data
    );
    return response.data.data!;
  },

  updateQuestion: async (
    surveyId: number,
    questionId: number,
    data: Partial<CreateSurveyQuestionData>
  ) => {
    const response = await apiClient.put<ApiResponse<SurveyQuestion>>(
      `/surveys/${surveyId}/questions/${questionId}`,
      data
    );
    return response.data.data!;
  },

  deleteQuestion: async (surveyId: number, questionId: number) => {
    const response = await apiClient.delete<ApiResponse<{ message: string }>>(
      `/surveys/${surveyId}/questions/${questionId}`
    );
    return response.data;
  },

  reorderQuestions: async (surveyId: number, questionIds: number[]) => {
    const response = await apiClient.post<ApiResponse<{ message: string }>>(
      `/surveys/${surveyId}/questions/reorder`,
      { questionIds }
    );
    return response.data;
  },

  // =============================================================================
  // RESPONSES (Student)
  // =============================================================================

  submitResponse: async (surveyId: number, data: SubmitSurveyResponseData) => {
    const response = await apiClient.post<ApiResponse<SurveyResponse>>(
      `/surveys/${surveyId}/submit`,
      data
    );
    return response.data.data!;
  },

  checkIfCompleted: async (surveyId: number) => {
    const response = await apiClient.get<ApiResponse<{ completed: boolean }>>(
      `/surveys/${surveyId}/my-response`
    );
    return response.data.data!;
  },

  // =============================================================================
  // ANALYTICS (Instructor)
  // =============================================================================

  getResponses: async (surveyId: number) => {
    const response = await apiClient.get<ApiResponse<SurveyResponsesData>>(
      `/surveys/${surveyId}/responses`
    );
    return response.data.data!;
  },

  exportResponses: async (surveyId: number) => {
    const response = await apiClient.get(`/surveys/${surveyId}/export`, {
      responseType: 'blob',
    });
    return response.data;
  },
};
