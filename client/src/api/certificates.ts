import apiClient from './client';
import { ApiResponse } from '../types';

export interface Certificate {
  id: number;
  userId: number;
  courseId: number;
  templateId: number;
  verificationCode: string;
  issueDate: string;
  expiryDate?: string;
  metadata?: Record<string, any>;
  template?: { id: number; name: string };
  user?: { id: number; fullname: string; email: string };
  course?: { id: number; title: string; instructor: { id: number; fullname: string } };
}

export interface CertificateTemplate {
  id: number;
  name: string;
  description?: string;
  templateHtml: string;
  isDefault: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface VerificationResult {
  valid: boolean;
  message?: string;
  certificate?: {
    id: number;
    recipientName?: string;
    courseName?: string;
    issueDate: string;
    verificationCode: string;
  };
}

export const certificatesApi = {
  // User certificates
  getMyCertificates: async (): Promise<Certificate[]> => {
    const response = await apiClient.get<ApiResponse<Certificate[]>>('/certificates/my');
    return response.data.data!;
  },

  getCertificate: async (certificateId: number): Promise<Certificate> => {
    const response = await apiClient.get<ApiResponse<Certificate>>(`/certificates/${certificateId}`);
    return response.data.data!;
  },

  renderCertificate: async (certificateId: number): Promise<string> => {
    const response = await apiClient.get(`/certificates/${certificateId}/render`, {
      responseType: 'text',
    });
    return response.data;
  },

  // Public verification
  verifyCertificate: async (code: string): Promise<VerificationResult> => {
    const response = await apiClient.get<ApiResponse<VerificationResult>>(`/certificates/verify/${code}`);
    return response.data.data!;
  },

  // Instructor - issue certificate
  issueCertificate: async (userId: number, courseId: number, templateId?: number): Promise<Certificate> => {
    const response = await apiClient.post<ApiResponse<Certificate>>('/certificates/issue', {
      userId,
      courseId,
      templateId,
    });
    return response.data.data!;
  },

  // Admin - templates
  getTemplates: async (): Promise<CertificateTemplate[]> => {
    const response = await apiClient.get<ApiResponse<CertificateTemplate[]>>('/certificates/templates/all');
    return response.data.data!;
  },

  getTemplate: async (templateId: number): Promise<CertificateTemplate> => {
    const response = await apiClient.get<ApiResponse<CertificateTemplate>>(`/certificates/templates/${templateId}`);
    return response.data.data!;
  },

  createTemplate: async (data: Partial<CertificateTemplate>): Promise<CertificateTemplate> => {
    const response = await apiClient.post<ApiResponse<CertificateTemplate>>('/certificates/templates', data);
    return response.data.data!;
  },

  updateTemplate: async (templateId: number, data: Partial<CertificateTemplate>): Promise<CertificateTemplate> => {
    const response = await apiClient.put<ApiResponse<CertificateTemplate>>(`/certificates/templates/${templateId}`, data);
    return response.data.data!;
  },

  deleteTemplate: async (templateId: number): Promise<void> => {
    await apiClient.delete(`/certificates/templates/${templateId}`);
  },

  // Admin - revoke
  revokeCertificate: async (certificateId: number): Promise<void> => {
    await apiClient.delete(`/certificates/${certificateId}`);
  },
};
