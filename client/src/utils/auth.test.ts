import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getAuthToken, isAuthenticated, getAuthHeaders } from './auth';

describe('getAuthToken', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.getItem = vi.fn();
  });

  it('should return token when stored in localStorage', () => {
    const mockState = {
      state: {
        token: 'test-jwt-token',
      },
    };
    (localStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue(JSON.stringify(mockState));

    const result = getAuthToken();
    expect(result).toBe('test-jwt-token');
    expect(localStorage.getItem).toHaveBeenCalledWith('laila-auth');
  });

  it('should return null when no token exists', () => {
    (localStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue(null);

    const result = getAuthToken();
    expect(result).toBeNull();
  });

  it('should return null when localStorage contains invalid JSON', () => {
    (localStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue('invalid-json');

    const result = getAuthToken();
    expect(result).toBeNull();
  });

  it('should return null when state has no token', () => {
    const mockState = {
      state: {},
    };
    (localStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue(JSON.stringify(mockState));

    const result = getAuthToken();
    expect(result).toBeNull();
  });
});

describe('isAuthenticated', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.getItem = vi.fn();
  });

  it('should return true when token exists', () => {
    const mockState = { state: { token: 'test-token' } };
    (localStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue(JSON.stringify(mockState));

    expect(isAuthenticated()).toBe(true);
  });

  it('should return false when no token exists', () => {
    (localStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue(null);

    expect(isAuthenticated()).toBe(false);
  });
});

describe('getAuthHeaders', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.getItem = vi.fn();
  });

  it('should return Authorization header when authenticated', () => {
    const mockState = { state: { token: 'test-token' } };
    (localStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue(JSON.stringify(mockState));

    const headers = getAuthHeaders();
    expect(headers).toEqual({ Authorization: 'Bearer test-token' });
  });

  it('should return empty object when not authenticated', () => {
    (localStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue(null);

    const headers = getAuthHeaders();
    expect(headers).toEqual({});
  });
});
