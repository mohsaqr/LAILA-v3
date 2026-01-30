import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { BrainCircuit, Mail, Lock, Eye, EyeOff } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../../hooks/useAuth';
import { useTheme } from '../../hooks/useTheme';
import { Button } from '../../components/common/Button';
import { Input } from '../../components/common/Input';

export const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { login } = useAuth();
  const { isDark } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();

  const from = (location.state as { from?: { pathname: string } })?.from?.pathname || '/dashboard';

  // Theme colors
  const colors = {
    bgCard: isDark ? '#1f2937' : '#ffffff',
    textPrimary: isDark ? '#f3f4f6' : '#111827',
    textSecondary: isDark ? '#9ca3af' : '#6b7280',
    textMuted: isDark ? '#6b7280' : '#9ca3af',
    bgQuickLogin: isDark ? '#374151' : '#f9fafb',
    linkColor: isDark ? '#5eecec' : '#088F8F',
    linkHover: isDark ? '#99f6f6' : '#065c5c',
    // Quick login button colors
    bgBlue: isDark ? 'rgba(59, 130, 246, 0.2)' : '#dbeafe',
    textBlue: isDark ? '#93c5fd' : '#1d4ed8',
    bgGreen: isDark ? 'rgba(34, 197, 94, 0.2)' : '#dcfce7',
    textGreen: isDark ? '#86efac' : '#15803d',
    bgTeal: isDark ? 'rgba(8, 143, 143, 0.2)' : '#f0fdfd',
    textTeal: isDark ? '#5eecec' : '#088F8F',
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      await login(email, password);
      toast.success('Welcome back!');
      navigate(from, { replace: true });
    } catch (error: any) {
      toast.error(error.message || 'Failed to sign in');
    } finally {
      setIsLoading(false);
    }
  };

  const quickLogin = async (quickEmail: string, quickPassword: string) => {
    setIsLoading(true);
    try {
      await login(quickEmail, quickPassword);
      toast.success('Welcome back!');
      navigate(from, { replace: true });
    } catch (error: any) {
      toast.error(error.message || 'Failed to sign in');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen gradient-bg flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="rounded-2xl shadow-xl p-8" style={{ backgroundColor: colors.bgCard }}>
          {/* Header */}
          <div className="text-center mb-8">
            <Link to="/" className="inline-flex items-center gap-2 mb-4">
              <div className="w-12 h-12 gradient-bg rounded-xl flex items-center justify-center">
                <BrainCircuit className="w-7 h-7 text-white" />
              </div>
            </Link>
            <h1 className="text-2xl font-bold" style={{ color: colors.textPrimary }}>Welcome back</h1>
            <p className="mt-1" style={{ color: colors.textSecondary }}>Sign in to continue to LAILA</p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5" style={{ color: colors.textMuted }} />
              <Input
                type="email"
                placeholder="Email address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="pl-11"
                required
              />
            </div>

            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5" style={{ color: colors.textMuted }} />
              <Input
                type={showPassword ? 'text' : 'password'}
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="pl-11 pr-11"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 transition-colors"
                style={{ color: colors.textMuted }}
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>

            <Button type="submit" className="w-full" loading={isLoading}>
              Sign In
            </Button>
          </form>

          {/* Footer */}
          <div className="mt-6 text-center">
            <p style={{ color: colors.textSecondary }}>
              Don't have an account?{' '}
              <Link to="/register" className="font-medium hover:underline" style={{ color: colors.linkColor }}>
                Sign up
              </Link>
            </p>
          </div>

          {/* Quick Login Buttons */}
          <div className="mt-6 p-4 rounded-lg" style={{ backgroundColor: colors.bgQuickLogin }}>
            <p className="text-sm font-medium mb-3" style={{ color: colors.textSecondary }}>Quick Login (Dev):</p>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => quickLogin('student@laila.edu', 'student123')}
                disabled={isLoading}
                className="px-3 py-2 text-sm rounded-lg transition-colors disabled:opacity-50"
                style={{ backgroundColor: colors.bgBlue, color: colors.textBlue }}
              >
                Student
              </button>
              <button
                type="button"
                onClick={() => quickLogin('instructor@laila.edu', 'instructor123')}
                disabled={isLoading}
                className="px-3 py-2 text-sm rounded-lg transition-colors disabled:opacity-50"
                style={{ backgroundColor: colors.bgGreen, color: colors.textGreen }}
              >
                Instructor
              </button>
              <button
                type="button"
                onClick={() => quickLogin('admin@laila.edu', 'admin123')}
                disabled={isLoading}
                className="px-3 py-2 text-sm rounded-lg transition-colors disabled:opacity-50"
                style={{ backgroundColor: colors.bgTeal, color: colors.textTeal }}
              >
                Admin
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
