import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  BookOpen,
  GraduationCap,
  BrainCircuit,
  Settings,
  Shield,
  Menu,
  X,
  LogOut,
  User,
  ChevronDown,
  Eye,
  EyeOff,
  MessagesSquare,
  Globe,
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useTheme } from '../../hooks/useTheme';
import { ViewAsRole } from '../../store/authStore';
import { ThemeToggle } from '../common/ThemeToggle';
import { useLanguageStore } from '../../store/languageStore';
import { supportedLanguages, SupportedLanguage } from '../../i18n/config';

export const Navbar = () => {
  const { t } = useTranslation(['navigation', 'common']);
  const { user, isAuthenticated, isAdmin, isActualAdmin, isActualInstructor, viewAsRole, setViewAs, isViewingAs, logout } = useAuth();
  const { isDark } = useTheme();
  const { language: currentLanguage, setLanguage } = useLanguageStore();
  const location = useLocation();
  const navigate = useNavigate();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isViewAsMenuOpen, setIsViewAsMenuOpen] = useState(false);
  const [isLanguageMenuOpen, setIsLanguageMenuOpen] = useState(false);

  // Handler for viewAs changes that preserves the current URL
  const handleViewAsChange = (role: ViewAsRole) => {
    const currentPath = location.pathname + location.search;
    setViewAs(role);
    setIsViewAsMenuOpen(false);
    // Force navigation back to current path after state change settles
    // This prevents any unwanted redirects from other components
    setTimeout(() => {
      if (window.location.pathname !== location.pathname) {
        navigate(currentPath, { replace: true });
      }
    }, 0);
  };

  const colors = {
    bg: isDark ? '#1f2937' : '#ffffff',
    border: isDark ? '#374151' : '#f3f4f6',
    textPrimary: isDark ? '#f3f4f6' : '#111827',
    textSecondary: isDark ? '#d1d5db' : '#4b5563',
    textMuted: isDark ? '#9ca3af' : '#6b7280',
    hover: isDark ? '#374151' : '#f9fafb',
    activeText: isDark ? '#5eecec' : '#088F8F',
    activeBg: isDark ? 'rgba(139, 92, 246, 0.2)' : '#f5f3ff',
    dropdownBg: isDark ? '#1f2937' : '#ffffff',
    dropdownBorder: isDark ? '#374151' : '#f3f4f6',
    dropdownHover: isDark ? '#374151' : '#f9fafb',
    viewAsActiveBg: isDark ? 'rgba(245, 158, 11, 0.2)' : '#fef3c7',
    viewAsActiveText: isDark ? '#fbbf24' : '#b45309',
    viewAsActiveBorder: isDark ? '#92400e' : '#fcd34d',
  };

  // View As options depend on actual user role
  const viewAsOptions: { role: ViewAsRole; label: string; description: string }[] = isActualAdmin
    ? [
        { role: null, label: t('navigation:view_as_admin'), description: t('navigation:full_admin_access') },
        { role: 'instructor', label: t('navigation:view_as_instructor'), description: t('navigation:test_instructor_view') },
        { role: 'student', label: t('navigation:view_as_student'), description: t('navigation:test_student_view') },
      ]
    : [
        { role: null, label: t('navigation:view_as_instructor'), description: t('navigation:full_instructor_access') },
        { role: 'student', label: t('navigation:view_as_student'), description: t('navigation:test_student_view') },
      ];

  const navItems = [
    { path: '/dashboard', label: t('dashboard'), icon: BookOpen },
    { path: '/courses', label: t('courses'), icon: GraduationCap },
    { path: '/ai-tools', label: t('ai_tools'), icon: BrainCircuit },
    { path: '/ai-tutors', label: t('chat_tutors'), icon: MessagesSquare },
    ...(isAdmin ? [{ path: '/admin', label: t('admin'), icon: Shield }] : []),
  ];

  const handleLanguageChange = (lang: SupportedLanguage) => {
    setLanguage(lang);
    setIsLanguageMenuOpen(false);
  };

  const isActive = (path: string) => location.pathname.startsWith(path);

  return (
    <nav
      id="main-navigation"
      className="shadow-sm border-b sticky top-0 z-50"
      style={{
        backgroundColor: isDark ? '#1f2937' : '#ffffff',
        borderColor: isDark ? '#374151' : '#f3f4f6',
      }}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          {/* Logo */}
          <div className="flex items-center">
            <Link to="/" className="flex items-center gap-2">
              <div className="w-10 h-10 gradient-bg rounded-lg flex items-center justify-center">
                <BrainCircuit className="w-6 h-6 text-white" />
              </div>
              <span className="text-xl font-bold bg-gradient-to-r from-primary-600 to-secondary-600 bg-clip-text text-transparent">
                LAILA
              </span>
            </Link>
          </div>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-1">
            {navItems.map(item => {
                const Icon = item.icon;
                const active = isActive(item.path);
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors"
                    style={{
                      backgroundColor: active ? colors.activeBg : 'transparent',
                      color: active ? colors.activeText : colors.textSecondary,
                    }}
                  >
                    <Icon className="w-4 h-4" />
                    {item.label}
                  </Link>
                );
              })}
          </div>

          {/* User Menu */}
          <div className="flex items-center gap-2">
            {/* Language Selector */}
            <div className="relative">
              <button
                onClick={() => setIsLanguageMenuOpen(!isLanguageMenuOpen)}
                className="p-2 rounded-lg transition-colors hover:bg-gray-100 dark:hover:bg-gray-700"
                title={t('settings:language')}
              >
                <Globe className="w-5 h-5" style={{ color: colors.textSecondary }} />
              </button>

              {isLanguageMenuOpen && (
                <div
                  className="absolute right-0 mt-2 w-40 rounded-lg shadow-lg py-1 z-50"
                  style={{
                    backgroundColor: colors.dropdownBg,
                    border: `1px solid ${colors.dropdownBorder}`,
                  }}
                >
                  {Object.entries(supportedLanguages).map(([code, { nativeName }]) => (
                    <button
                      key={code}
                      onClick={() => handleLanguageChange(code as SupportedLanguage)}
                      className="flex items-center gap-2 w-full px-4 py-2 text-sm transition-colors"
                      style={{
                        backgroundColor: currentLanguage === code ? colors.activeBg : 'transparent',
                        color: currentLanguage === code ? colors.activeText : colors.textSecondary,
                      }}
                    >
                      {nativeName}
                      {currentLanguage === code && (
                        <span className="ml-auto">✓</span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Theme Toggle */}
            <ThemeToggle />

            {/* View As Button - For admins and instructors */}
            {isAuthenticated && (isActualAdmin || isActualInstructor) && (
              <div className="relative">
                <button
                  onClick={() => setIsViewAsMenuOpen(!isViewAsMenuOpen)}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg transition-colors"
                  style={{
                    backgroundColor: isViewingAs ? colors.viewAsActiveBg : 'transparent',
                    color: isViewingAs ? colors.viewAsActiveText : colors.textSecondary,
                    border: isViewingAs ? `1px solid ${colors.viewAsActiveBorder}` : '1px solid transparent',
                  }}
                >
                  {isViewingAs ? (
                    <Eye className="w-4 h-4" />
                  ) : (
                    <EyeOff className="w-4 h-4" />
                  )}
                  <span className="hidden sm:block text-sm font-medium">
                    {isViewingAs
                      ? t(`navigation:viewing_as_${viewAsRole}`)
                      : t('navigation:view_as')}
                  </span>
                  <ChevronDown className="w-4 h-4" />
                </button>

                {isViewAsMenuOpen && (
                  <div
                    className="absolute right-0 mt-2 w-56 rounded-lg shadow-lg py-1 z-50"
                    style={{
                      backgroundColor: colors.dropdownBg,
                      border: `1px solid ${colors.dropdownBorder}`,
                    }}
                  >
                    <div className="px-4 py-2" style={{ borderBottom: `1px solid ${colors.dropdownBorder}` }}>
                      <p className="text-xs font-medium uppercase" style={{ color: colors.textMuted }}>{t('navigation:test_role_views')}</p>
                    </div>
                    {viewAsOptions.map((option) => {
                      const isSelected = (option.role === null && !viewAsRole) || option.role === viewAsRole;
                      return (
                        <button
                          key={option.role || 'admin'}
                          onClick={() => handleViewAsChange(option.role)}
                          className="flex flex-col items-start w-full px-4 py-2 text-sm"
                          style={{
                            backgroundColor: isSelected ? colors.activeBg : 'transparent',
                            color: isSelected ? colors.activeText : colors.textSecondary,
                          }}
                        >
                          <span className="font-medium">{option.label}</span>
                          <span className="text-xs" style={{ color: colors.textMuted }}>{option.description}</span>
                        </button>
                      );
                    })}
                    {isViewingAs && (
                      <>
                        <hr style={{ borderColor: colors.dropdownBorder }} className="my-1" />
                        <button
                          onClick={() => handleViewAsChange(null)}
                          className="flex items-center gap-2 w-full px-4 py-2 text-sm"
                          style={{ color: isDark ? '#f87171' : '#dc2626' }}
                        >
                          <EyeOff className="w-4 h-4" />
                          {t('navigation:exit_test_mode')}
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>
            )}

            {isAuthenticated ? (
              <div className="relative">
                <button
                  onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg transition-colors"
                  style={{ backgroundColor: 'transparent' }}
                >
                  <div className="w-8 h-8 rounded-full bg-gradient-to-r from-primary-500 to-secondary-500 flex items-center justify-center">
                    <span className="text-white text-sm font-medium">
                      {user?.fullname?.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <span className="hidden sm:block text-sm font-medium" style={{ color: colors.textSecondary }}>
                    {user?.fullname}
                  </span>
                  <ChevronDown className="w-4 h-4" style={{ color: colors.textMuted }} />
                </button>

                {isUserMenuOpen && (
                  <div
                    className="absolute right-0 mt-2 w-48 rounded-lg shadow-lg py-1"
                    style={{
                      backgroundColor: colors.dropdownBg,
                      border: `1px solid ${colors.dropdownBorder}`,
                    }}
                  >
                    <Link
                      to="/settings"
                      className="flex items-center gap-2 px-4 py-2 text-sm"
                      style={{ color: colors.textSecondary }}
                      onClick={() => setIsUserMenuOpen(false)}
                    >
                      <Settings className="w-4 h-4" />
                      {t('preferences')}
                    </Link>
                    <Link
                      to="/profile"
                      className="flex items-center gap-2 px-4 py-2 text-sm"
                      style={{ color: colors.textSecondary }}
                      onClick={() => setIsUserMenuOpen(false)}
                    >
                      <User className="w-4 h-4" />
                      {t('profile')}
                    </Link>
                    <hr style={{ borderColor: colors.dropdownBorder }} className="my-1" />
                    <button
                      onClick={() => {
                        setIsUserMenuOpen(false);
                        logout();
                      }}
                      className="flex items-center gap-2 px-4 py-2 text-sm w-full"
                      style={{ color: isDark ? '#f87171' : '#dc2626' }}
                    >
                      <LogOut className="w-4 h-4" />
                      {t('sign_out')}
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Link
                  to="/login"
                  className="px-4 py-2 text-sm font-medium"
                  style={{ color: colors.textSecondary }}
                >
                  {t('sign_in')}
                </Link>
                <Link to="/register" className="btn btn-primary text-sm">
                  {t('auth:get_started')}
                </Link>
              </div>
            )}

            {/* Mobile menu button */}
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="md:hidden p-2 rounded-lg"
            >
              {isMobileMenuOpen ? (
                <X className="w-6 h-6" style={{ color: colors.textSecondary }} />
              ) : (
                <Menu className="w-6 h-6" style={{ color: colors.textSecondary }} />
              )}
            </button>
          </div>
        </div>

        {/* Mobile Navigation */}
        {isMobileMenuOpen && (
          <div className="md:hidden py-4" style={{ borderTop: `1px solid ${colors.border}` }}>
            {navItems.map(item => {
                const Icon = item.icon;
                const active = isActive(item.path);
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    className="flex items-center gap-3 px-4 py-3 rounded-lg"
                    style={{
                      backgroundColor: active ? colors.activeBg : 'transparent',
                      color: active ? colors.activeText : colors.textSecondary,
                    }}
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    <Icon className="w-5 h-5" />
                    {item.label}
                  </Link>
                );
              })}
          </div>
        )}
      </div>
    </nav>
  );
};
