import apiClient from './client';

export interface ContinueLearningItem {
  courseId: number;
  courseTitle: string;
  courseSlug: string;
  courseThumbnail: string | null;
  moduleId: number | null;
  moduleTitle: string | null;
  lectureId: number | null;
  lectureTitle: string | null;
  progress: number;
  lastViewedAt: string;
}

export interface GradingQueueItem {
  assignmentId: number;
  assignmentTitle: string;
  submissionType: string;
  courseId: number;
  courseTitle: string;
  pendingCount: number;
  oldestSubmittedAt: string | null;
}

export interface TeachingOverview {
  kpis: {
    totalCourses: number;
    totalStudents: number;
    totalAssignments: number;
    pendingGrading: number;
  };
  engagement: { days: string[]; counts: number[] };
  courseCompletion: Array<{
    courseId: number;
    courseTitle: string;
    completionPct: number;
    studentCount: number;
  }>;
  activityByVerb: Record<string, number>;
}

export const meApi = {
  getContinueLearning: async (): Promise<ContinueLearningItem[]> => {
    const response = await apiClient.get<{ success: boolean; data: ContinueLearningItem[] }>('/me/continue-learning');
    return response.data.data;
  },
  getGradingQueue: async (): Promise<GradingQueueItem[]> => {
    const response = await apiClient.get<{ success: boolean; data: GradingQueueItem[] }>('/me/grading-queue');
    return response.data.data;
  },
  getTeachingOverview: async (): Promise<TeachingOverview> => {
    const response = await apiClient.get<{ success: boolean; data: TeachingOverview }>('/me/teaching-overview');
    return response.data.data;
  },
};
