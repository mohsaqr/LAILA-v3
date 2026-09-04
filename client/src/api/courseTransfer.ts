import apiClient from './client';
import { ApiResponse } from '../types';

/** What the server did with a package; shown to the instructor after import. */
export interface CourseImportReport {
  courseId: number;
  slug: string;
  title: string;
  counts: {
    modules: number;
    lectures: number;
    sections: number;
    assignments: number;
    quizzes: number;
    quizQuestions: number;
    surveys: number;
    customLabs: number;
    codeLabs: number;
    forums: number;
    tutors: number;
    rubrics: number;
  };
  chatbots: { matched: string[]; created: string[] };
  files: { copied: number; missing: string[] };
  warnings: string[];
}

const fileNameFromDisposition = (header: string | undefined, fallback: string): string => {
  const match = header?.match(/filename="?([^";]+)"?/);
  return match ? decodeURIComponent(match[1]) : fallback;
};

export const courseTransferApi = {
  /** Download `course-title.laila.zip` for a course the caller can edit. */
  exportCourse: async (courseId: number) => {
    const response = await apiClient.get(`/courses/${courseId}/export`, { responseType: 'blob' });
    const fileName = fileNameFromDisposition(response.headers['content-disposition'], 'course.laila.zip');
    const url = window.URL.createObjectURL(new Blob([response.data], { type: 'application/zip' }));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', fileName);
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => window.URL.revokeObjectURL(url), 10_000);
    return { fileName, missingFiles: Number(response.headers['x-laila-missing-files'] ?? 0) };
  },

  /** Create a new draft course from a package file. */
  importCourse: async (file: File, title?: string) => {
    const form = new FormData();
    form.append('package', file);
    if (title) form.append('title', title);
    const response = await apiClient.post<ApiResponse<CourseImportReport>>('/courses/import', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data.data!;
  },

  /** Copy a course inside this LAILA; the copy is a draft owned by the caller. */
  duplicateCourse: async (courseId: number, title?: string) => {
    const response = await apiClient.post<ApiResponse<CourseImportReport>>(
      `/courses/${courseId}/duplicate`,
      title ? { title } : undefined,
    );
    return response.data.data!;
  },
};
