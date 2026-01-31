import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { User } from '../types';

export type ViewAsRole = 'admin' | 'instructor' | 'student' | null;

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  viewAsRole: ViewAsRole;
  setAuth: (user: User, token: string) => void;
  setUser: (user: User) => void;
  logout: () => void;
  setLoading: (loading: boolean) => void;
  setViewAs: (role: ViewAsRole) => void;
  isViewingAs: () => boolean;
  getEffectiveRole: () => { isAdmin: boolean; isInstructor: boolean };
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: true,
      viewAsRole: null,

      setAuth: (user: User, token: string) => {
        set({
          user,
          token,
          isAuthenticated: true,
          isLoading: false,
          viewAsRole: null,
        });
      },

      setUser: (user: User) => {
        set({ user });
      },

      logout: () => {
        set({
          user: null,
          token: null,
          isAuthenticated: false,
          isLoading: false,
          viewAsRole: null,
        });
      },

      setLoading: (loading: boolean) => {
        set({ isLoading: loading });
      },

      setViewAs: (role: ViewAsRole) => {
        set({ viewAsRole: role });
      },

      isViewingAs: () => {
        return get().viewAsRole !== null;
      },

      getEffectiveRole: () => {
        const { user, viewAsRole } = get();
        if (!user) return { isAdmin: false, isInstructor: false };

        // If not viewing as another role, return actual roles
        if (!viewAsRole) {
          return { isAdmin: user.isAdmin, isInstructor: user.isInstructor };
        }

        // Return effective roles based on viewAs selection
        switch (viewAsRole) {
          case 'admin':
            return { isAdmin: true, isInstructor: true };
          case 'instructor':
            return { isAdmin: false, isInstructor: true };
          case 'student':
            return { isAdmin: false, isInstructor: false };
          default:
            return { isAdmin: user.isAdmin, isInstructor: user.isInstructor };
        }
      },
    }),
    {
      name: 'laila-auth',
      // Note: viewAsRole is intentionally NOT persisted to prevent client-side role spoofing
      // Students could otherwise manually edit localStorage to gain instructor/admin access in UI
      partialize: (state) => ({
        user: state.user,
        token: state.token,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);
