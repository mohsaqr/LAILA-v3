import apiClient from './client';
import { ApiResponse } from '../types';

export interface LtiTool {
  id: string;
  name: string;
  description: string | null;
  clientId: string;
  deploymentId: string;
  loginUrl: string;
  targetLinkUri: string;
  redirectUris: string[];
  jwksUrl: string | null;
  deepLinkingUrl: string | null;
  supportsDeepLinking: boolean;
  /** Whether name and email travel in a launch. Off by default. */
  sendPii: boolean;
  isActive: boolean;
  createdAt: string;
}

/** What a tool's own configuration screen asks for. */
export interface PlatformConfig {
  issuer: string;
  authorizationEndpoint: string;
  jwksUri: string;
  /** Null until AGS exists — naming an endpoint we do not serve misleads tools. */
  tokenEndpoint: string | null;
  deepLinkingReturnUrl: string;
}

export interface RegisterToolInput {
  name: string;
  description?: string;
  loginUrl: string;
  targetLinkUri: string;
  redirectUris: string[];
  jwksUrl?: string;
  publicKeyPem?: string;
  deepLinkingUrl?: string;
  sendPii?: boolean;
}

export const ltiApi = {
  async listTools(): Promise<LtiTool[]> {
    const res = await apiClient.get<ApiResponse<LtiTool[]>>('/lti/tools');
    return res.data.data ?? [];
  },

  async platformConfig(): Promise<PlatformConfig> {
    const res = await apiClient.get<ApiResponse<PlatformConfig>>('/lti/platform-config');
    return res.data.data as PlatformConfig;
  },

  async register(input: RegisterToolInput): Promise<LtiTool> {
    const res = await apiClient.post<ApiResponse<LtiTool>>('/lti/tools', input);
    return res.data.data as LtiTool;
  },

  async update(id: string, patch: { isActive?: boolean; sendPii?: boolean; name?: string }): Promise<LtiTool> {
    const res = await apiClient.patch<ApiResponse<LtiTool>>(`/lti/tools/${id}`, patch);
    return res.data.data as LtiTool;
  },

  async remove(id: string): Promise<void> {
    await apiClient.delete(`/lti/tools/${id}`);
  },
};

/**
 * The URL that begins a launch.
 *
 * A launch is a **form POST**, not a fetch: the server replies with an
 * auto-submitting form aimed at the tool, and the browser has to follow it. So
 * the caller renders this as an iframe `src` or posts a real form to it — it
 * cannot be driven through axios.
 */
export const launchEndpoint = (): string =>
  `${apiClient.defaults.baseURL ?? '/api'}/lti/launch`;

export default ltiApi;
