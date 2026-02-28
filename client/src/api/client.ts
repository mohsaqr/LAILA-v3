import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { useAuthStore } from '../store/authStore';

const API_URL = import.meta.env.VITE_API_URL || '/api';

// Extract base server URL (without /api) for static files
const SERVER_URL = API_URL.replace(/\/api\/?$/, '');

/**
 * Resolve a file URL - converts relative /uploads/ paths to absolute URLs
 */
export const resolveFileUrl = (fileUrl: string | null | undefined): string => {
  if (!fileUrl) return '';
  // If it's already an absolute URL, return as-is
  if (fileUrl.startsWith('http://') || fileUrl.startsWith('https://')) {
    return fileUrl;
  }
  // If it's a relative /uploads/ path, prepend the server URL
  if (fileUrl.startsWith('/uploads/')) {
    return `${SERVER_URL}${fileUrl}`;
  }
  // Otherwise return as-is
  return fileUrl;
};

export const apiClient = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token
apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = useAuthStore.getState().token;
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor for error handling
apiClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError<{ error?: string; message?: string }>) => {
    if (error.response?.status === 401) {
      // Token expired or invalid — only redirect from protected pages.
      // Avoid redirecting when the user is already on a public auth page
      // (login/register), which can happen due to stale tokens or
      // unauthenticated analytics flushes.
      useAuthStore.getState().logout();
      const currentPath = window.location.pathname;
      if (currentPath !== '/login' && currentPath !== '/register') {
        window.location.href = '/login';
      }
    }

    const message = error.response?.data?.error ||
                   error.response?.data?.message ||
                   error.message ||
                   'An error occurred';

    return Promise.reject(new Error(message));
  }
);

export default apiClient;
