import apiClient from './client';
import { ApiResponse } from '../types';

export type InvitationStatus = 'pending' | 'used' | 'expired' | 'revoked';
export type InvitationRole = 'student' | 'instructor';

export interface Invitation {
  id: number;
  /** null = an open shareable link, redeemable by any address. */
  email: string | null;
  role: string;
  courseId: number | null;
  token: string;
  /** Last four characters of the code. The code itself is unrecoverable. */
  codeHint: string | null;
  invitedById: number;
  maxUses: number;
  useCount: number;
  expiresAt: string | null;
  acceptedAt: string | null;
  revokedAt: string | null;
  createdAt: string;
  status: InvitationStatus;
  invitedByName: string | null;
  courseTitle: string | null;
  link: string;
}

/**
 * The response to a create call. `code` is the plaintext registration code and
 * exists ONLY here — the server stores a digest, so nothing can show it again.
 * Anything the admin does not copy now is lost.
 */
export interface CreatedInvitation {
  invitation: Omit<Invitation, 'status' | 'invitedByName' | 'courseTitle' | 'link'>;
  code: string;
  link: string;
}

export interface CreateInvitationPayload {
  email?: string;
  role?: InvitationRole;
  courseId?: number;
  maxUses?: number;
  /** null = never expires; omitted = the server's default window. */
  expiresInDays?: number | null;
}

export interface BulkInvitationPayload extends Omit<CreateInvitationPayload, 'email' | 'maxUses'> {
  emails: string[];
}

export interface BulkInvitationResult {
  created: CreatedInvitation[];
  failed: string[];
}

export const invitationsApi = {
  list: async (status?: InvitationStatus) => {
    const query = status ? `?status=${encodeURIComponent(status)}` : '';
    const response = await apiClient.get<ApiResponse<Invitation[]>>(`/invitations${query}`);
    return response.data.data!;
  },

  create: async (payload: CreateInvitationPayload) => {
    const response = await apiClient.post<ApiResponse<CreatedInvitation>>('/invitations', payload);
    return response.data.data!;
  },

  createBulk: async (payload: BulkInvitationPayload) => {
    const response = await apiClient.post<ApiResponse<BulkInvitationResult>>('/invitations/bulk', payload);
    return response.data.data!;
  },

  revoke: async (id: number) => {
    const response = await apiClient.post<ApiResponse<Invitation>>(`/invitations/${id}/revoke`);
    return response.data.data!;
  },
};
