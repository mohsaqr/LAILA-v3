import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { authApi } from '../api/auth';

export const useAuth = () => {
  const {
    user,
    token,
    isAuthenticated,
    isLoading,
    viewAsRole,
    setAuth,
    setUser,
    logout,
    setLoading,
    setViewAs,
    isViewingAs,
    getEffectiveRole,
  } = useAuthStore();
  const navigate = useNavigate();

  useEffect(() => {
    const verifyAuth = async () => {
      if (token && !user) {
        try {
          const { user: verifiedUser } = await authApi.verifyToken();
          setUser(verifiedUser);
        } catch {
          logout();
        }
      }
      setLoading(false);
    };

    verifyAuth();
  }, [token, user, setUser, logout, setLoading]);

  const login = async (email: string, password: string) => {
    const response = await authApi.login({ email, password });
    setAuth(response.user, response.token);
    return response;
  };

  const register = async (fullname: string, email: string, password: string) => {
    const response = await authApi.register({ fullname, email, password });
    setAuth(response.user, response.token);
    return response;
  };

  const signOut = async () => {
    try {
      await authApi.logout();
    } catch {
      // Ignore logout errors
    }
    logout();
    navigate('/login');
  };

  // Get effective roles (considers viewAs mode)
  const effectiveRole = getEffectiveRole();

  // Check if user is actually an admin (ignores viewAs mode)
  const isActualAdmin = user?.isAdmin || false;

  return {
    user,
    token,
    isAuthenticated,
    isLoading,
    login,
    register,
    logout: signOut,
    // Effective roles (affected by viewAs)
    isAdmin: effectiveRole.isAdmin,
    isInstructor: effectiveRole.isInstructor,
    // ViewAs functionality (only for actual admins)
    isActualAdmin,
    viewAsRole,
    setViewAs,
    isViewingAs: isViewingAs(),
    // Helper to get test prefix for logging
    getTestPrefix: (): string => {
      if (!viewAsRole) return '';
      return `test_${viewAsRole}`;
    },
  };
};
