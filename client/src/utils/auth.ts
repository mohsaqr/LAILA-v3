/**
 * Centralized authentication utilities.
 * These functions interact with the Zustand auth store.
 */

/**
 * Get the auth token from Zustand's persisted store.
 * @returns The JWT token or null if not authenticated
 */
export const getAuthToken = (): string | null => {
  try {
    const stored = localStorage.getItem('laila-auth');
    if (stored) {
      const parsed = JSON.parse(stored);
      return parsed?.state?.token || null;
    }
  } catch {
    // Fall back if parsing fails
  }
  return null;
};

/**
 * Check if user is currently authenticated.
 * @returns True if a valid token exists
 */
export const isAuthenticated = (): boolean => {
  return getAuthToken() !== null;
};

/**
 * Get authorization headers for API requests.
 * @returns Headers object with Authorization header if authenticated
 */
export const getAuthHeaders = (): HeadersInit => {
  const token = getAuthToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
};
