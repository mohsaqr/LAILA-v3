import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Mail, Lock, Eye, EyeOff } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../../hooks/useAuth';
import { Button } from '../../components/common/Button';
import { Input } from '../../components/common/Input';
import { AuthLayout } from '../../components/auth/AuthLayout';
import { safeReturnPath } from '../../utils/safeReturnPath';

export const Login = () => {
  const { t } = useTranslation(['auth', 'common']);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  /**
   * Where to land after a successful login.
   *
   * ProtectedRoute has always passed `state.from`, but this page ignored it and
   * always went to /dashboard — so any deep link died at sign-in. The OIDC
   * authorize hop cannot survive that (its query parameters ARE the request),
   * so the return path is now honoured.
   *
   * Only the in-app path is reconstructed, never a caller-supplied string: an
   * absolute URL here would be an open redirect straight out of the login form.
   * `safeReturnPath` owns that rule — see utils/safeReturnPath.ts for the two
   * off-site spellings it rejects and why the check lives in a tested unit
   * rather than inline here.
   */
  const returnTo = (() => {
    const from = (location.state as { from?: { pathname?: string; search?: string } } | null)?.from;
    return safeReturnPath(from?.pathname, from?.search);
  })();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      await login(email, password);
      toast.success(t('welcome_back'));
      navigate(returnTo, { replace: true });
    } catch (error: any) {
      toast.error(error.message || t('login_failed'));
    } finally {
      setIsLoading(false);
    }
  };

  const quickLogin = async (quickEmail: string, quickPassword: string) => {
    setIsLoading(true);
    try {
      await login(quickEmail, quickPassword);
      toast.success(t('welcome_back'));
      navigate(returnTo, { replace: true });
    } catch (error: any) {
      toast.error(error.message || t('login_failed'));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthLayout>
      <div className="rounded-2xl border border-gray-200 bg-white p-8 shadow-xl dark:border-gray-800 dark:bg-gray-900">
        <div className="mb-6">
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-gray-100">
            {t('login_title')}
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{t('login_subtitle')}</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="relative">
            <Mail className="pointer-events-none absolute start-3 top-1/2 z-10 h-5 w-5 -translate-y-1/2 text-gray-400 dark:text-gray-500" />
            <Input
              type="email"
              placeholder={t('email_placeholder')}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              className="ps-11"
              required
            />
          </div>

          <div className="relative">
            <Lock className="pointer-events-none absolute start-3 top-1/2 z-10 h-5 w-5 -translate-y-1/2 text-gray-400 dark:text-gray-500" />
            <Input
              type={showPassword ? 'text' : 'password'}
              placeholder={t('password_placeholder')}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              className="ps-11 pe-11"
              required
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              aria-label={showPassword ? t('hide_password') : t('show_password')}
              tabIndex={-1}
              className="absolute end-3 top-1/2 z-10 -translate-y-1/2 text-gray-400 transition-colors hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
            >
              {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
            </button>
          </div>

          <div className="flex justify-start">
            <Link
              to="/forgot-password"
              className="text-sm text-primary-600 hover:underline dark:text-primary-300"
            >
              {t('forgot_password', { defaultValue: 'Forgot password?' })}
            </Link>
          </div>

          <Button type="submit" className="w-full" loading={isLoading}>
            {t('sign_in')}
          </Button>
        </form>

        {/* Footer */}
        <div className="mt-6 text-center">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {t('no_account')}{' '}
            <Link
              to="/register"
              className="font-medium text-primary-600 hover:underline dark:text-primary-300"
            >
              {t('register_link')}
            </Link>
          </p>
        </div>

        {/* Quick Login Buttons - Development Only */}
        {import.meta.env.DEV && (
          <div className="mt-6 rounded-lg bg-gray-50 p-4 dark:bg-gray-800/60">
            <p className="mb-3 text-sm font-medium text-gray-500 dark:text-gray-400">
              {t('quick_login_dev')}
            </p>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => quickLogin('student@laila.edu', 'student123')}
                disabled={isLoading}
                className="rounded-lg bg-blue-100 px-3 py-2 text-sm text-blue-700 transition-colors disabled:opacity-50 dark:bg-blue-500/20 dark:text-blue-300"
              >
                {t('role_student')}
              </button>
              <button
                type="button"
                onClick={() => quickLogin('instructor@laila.edu', 'instructor123')}
                disabled={isLoading}
                className="rounded-lg bg-green-100 px-3 py-2 text-sm text-green-700 transition-colors disabled:opacity-50 dark:bg-green-500/20 dark:text-green-300"
              >
                {t('role_instructor')}
              </button>
              <button
                type="button"
                onClick={() => quickLogin('admin@laila.edu', 'admin123')}
                disabled={isLoading}
                className="rounded-lg bg-primary-50 px-3 py-2 text-sm text-primary-700 transition-colors disabled:opacity-50 dark:bg-primary-500/20 dark:text-primary-300"
              >
                {t('role_admin')}
              </button>
            </div>
          </div>
        )}
      </div>
    </AuthLayout>
  );
};
