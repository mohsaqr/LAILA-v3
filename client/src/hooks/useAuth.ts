import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { authApi } from '../api/auth';

export const useAuth = () => {
  const { user, token, isAuthenticated, isLoading, setAuth, setUser, logout, setLoading } = useAuthStore();
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

  return {
    user,
    token,
    isAuthenticated,
    isLoading,
    login,
    register,
    logout: signOut,
    isAdmin: user?.isAdmin || false,
    isInstructor: user?.isInstructor || false,
  };
};
