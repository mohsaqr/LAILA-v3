/**
 * Export utilities for the Logs Dashboard.
 * Functions for downloading data as JSON files.
 */

import { analyticsApi } from '../../../api/admin';

/**
 * Download data as a JSON file.
 */
export const downloadJson = (data: unknown, filename: string): void => {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

/**
 * Export activity logs as JSON.
 */
export const exportActivityLogs = async (
  contentEvents: unknown[],
  assessmentEvents: unknown[]
): Promise<void> => {
  const data = {
    contentEvents,
    assessmentEvents,
    exportedAt: new Date().toISOString(),
  };
  downloadJson(data, `activity-logs-${Date.now()}.json`);
};

/**
 * Export chatbot logs as JSON.
 */
export const exportChatbotLogs = async (): Promise<void> => {
  const data = await analyticsApi.exportChatbotLogs();
  downloadJson(data, `chatbot-logs-${Date.now()}.json`);
};

/**
 * Export user interactions as JSON.
 */
export const exportInteractions = async (): Promise<void> => {
  const data = await analyticsApi.exportInteractions();
  downloadJson(data, `interactions-${Date.now()}.json`);
};

/**
 * Format date for display in tables.
 */
export const formatDate = (dateStr: string): string => {
  return new Date(dateStr).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

/**
 * Format date with full details.
 */
export const formatFullDate = (dateStr: string): string => {
  return new Date(dateStr).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
};
