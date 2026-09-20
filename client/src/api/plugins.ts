import apiClient from './client';
import { ApiResponse } from '../types';

/** An installed plugin, as the admin list shows it. */
export interface InstalledPlugin {
  id: string;
  name: string;
  version: string;
  description: string | null;
  authorName: string | null;
  homepage: string | null;
  enabled: boolean;
  /** active | disabled | error | incompatible */
  status: string;
  capabilities: string[];
  extensions: { point: string; id: string; label: string }[];
  lastError: string | null;
  errorCount: number;
  /** Whether it is loaded in the running process, not just enabled in the DB. */
  loaded: boolean;
  installedAt: string;
}

export interface InstallResult {
  id: string;
  name: string;
  version: string;
  capabilities: string[];
  extensions: { point: string; id: string; label: string }[];
  upgraded: boolean;
  previousVersion: string | null;
  migrationsApplied: string[];
  restartRequired: boolean;
  warnings: string[];
}

/** A failed install reports every manifest problem, not just the first. */
export interface InstallFailure {
  error: string;
  issues: string[];
}

export const pluginsApi = {
  async list(): Promise<InstalledPlugin[]> {
    const res = await apiClient.get<ApiResponse<InstalledPlugin[]>>('/plugins');
    return res.data.data ?? [];
  },

  /**
   * Upload a bundle.
   *
   * @param onProgress fraction 0–1; a plugin bundle can be tens of megabytes
   *   and a silent upload looks like a hang.
   */
  async install(
    file: File,
    opts: { enable?: boolean; allowDowngrade?: boolean; onProgress?: (fraction: number) => void } = {},
  ): Promise<InstallResult> {
    const form = new FormData();
    form.append('bundle', file);
    if (opts.enable) form.append('enable', 'true');
    if (opts.allowDowngrade) form.append('allowDowngrade', 'true');
    const res = await apiClient.post<ApiResponse<InstallResult>>('/plugins', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress: (e) => {
        if (opts.onProgress && e.total) opts.onProgress(e.loaded / e.total);
      },
    });
    return res.data.data as InstallResult;
  },

  async enable(id: string): Promise<void> {
    await apiClient.post(`/plugins/${encodeURIComponent(id)}/enable`);
  },

  async disable(id: string): Promise<void> {
    await apiClient.post(`/plugins/${encodeURIComponent(id)}/disable`);
  },

  /** @param dropData also drop the plugin's own SQL tables. Irreversible. */
  async uninstall(id: string, dropData = false): Promise<{ droppedTables: string[] }> {
    const res = await apiClient.delete<ApiResponse<{ droppedTables: string[] }>>(
      `/plugins/${encodeURIComponent(id)}`,
      { params: dropData ? { dropData: 'true' } : undefined },
    );
    return res.data.data ?? { droppedTables: [] };
  },

  async updateSettings(id: string, settings: Record<string, unknown>): Promise<void> {
    await apiClient.put(`/plugins/${encodeURIComponent(id)}/settings`, { settings });
  },
};

export default pluginsApi;
