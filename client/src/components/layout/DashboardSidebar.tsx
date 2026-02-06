import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  LayoutDashboard,
  GraduationCap,
  ClipboardList,
  ClipboardCheck,
  Calendar,
  BrainCircuit,
  ChevronLeft,
  ChevronRight,
  Activity,
  Bot,
  FlaskConical,
  MessageSquare,
  Award,
  FileQuestion,
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { useTheme } from '../../hooks/useTheme';
import { useAuth } from '../../hooks/useAuth';
import { useAuthStore } from '../../store/authStore';

interface NavItem {
  label: string;
  icon: React.ElementType;
  path: string;
  badge?: number;
  disabled?: boolean;
}

export const DashboardSidebar = () => {
  const { t } = useTranslation(['navigation', 'common']);
  const location = useLocation();
  const { isDark } = useTheme();
  const { isInstructor, isAuthenticated } = useAuth();
  // Use actual user role (not viewAsRole) to determine sidebar items
  const user = useAuthStore((state) => state.user);
  const isActualAdmin = user?.isAdmin || false;
  const [isCollapsed, setIsCollapsed] = useState(() => {
    return localStorage.getItem('sidebarCollapsed') === 'true';
  });

  useEffect(() => {
    localStorage.setItem('sidebarCollapsed', String(isCollapsed));
    window.dispatchEvent(new Event('storage'));
  }, [isCollapsed]);

  // Extract courseId from URL for course-context aware navigation
  // Handles: /courses/123, /course/123, /teach/courses/123
  const courseIdMatch = location.pathname.match(/\/(?:teach\/)?courses?\/(\d+)/);
  const currentCourseId = courseIdMatch ? courseIdMatch[1] : null;

  // Theme colors
  const colors = {
    bg: isDark ? '#1f2937' : '#ffffff',
    bgHover: isDark ? '#374151' : '#f3f4f6',
    bgActive: isDark ? '#374151' : '#e0e7ff',
    textPrimary: isDark ? '#f3f4f6' : '#111827',
    textSecondary: isDark ? '#9ca3af' : '#6b7280',
    textActive: isDark ? '#a5b4fc' : '#4f46e5',
    textDisabled: isDark ? '#4b5563' : '#d1d5db',
    border: isDark ? '#374151' : '#e5e7eb',
  };

  // Don't show sidebar if not authenticated
  if (!isAuthenticated) {
    return null;
  }

  const studentNavItems: NavItem[] = [
    { label: t('dashboard'), icon: LayoutDashboard, path: '/dashboard' },
    { label: t('my_courses'), icon: GraduationCap, path: '/courses' },
    { label: t('labs'), icon: FlaskConical, path: '/labs' },
    {
      label: currentCourseId ? t('course_forums') : t('forums'),
      icon: MessageSquare,
      path: currentCourseId ? `/course/${currentCourseId}/forums` : '/forums',
    },
    {
      label: currentCourseId ? t('course_quizzes') : t('quizzes'),
      icon: FileQuestion,
      path: currentCourseId ? `/course/${currentCourseId}/quizzes` : '/quizzes',
    },
    {
      label: currentCourseId ? t('course_certificates') : t('certificates'),
      icon: Award,
      path: currentCourseId ? `/course/${currentCourseId}/certificates` : '/certificates',
    },
    { label: t('gradebook'), icon: ClipboardList, path: '/dashboard/gradebook' },
    { label: t('calendar'), icon: Calendar, path: '/dashboard/calendar' },
    { label: t('ai_tools'), icon: BrainCircuit, path: '/ai-tools' },
  ];

  // Build instructor nav items - only show admin logs to actual admins
  const instructorNavItems: NavItem[] = [
    { label: t('dashboard'), icon: LayoutDashboard, path: '/dashboard' },
    { label: t('my_courses'), icon: GraduationCap, path: '/courses' },
    { label: t('lab_templates'), icon: FlaskConical, path: '/teach/labs' },
    {
      label: currentCourseId ? t('course_quizzes') : t('quizzes'),
      icon: FileQuestion,
      path: currentCourseId ? `/teach/courses/${currentCourseId}/quizzes` : '/teach/quizzes',
    },
    {
      label: t('ai_tutors'),
      icon: Bot,
      path: currentCourseId ? `/teach/courses/${currentCourseId}/tutors` : '#',
      disabled: !currentCourseId,
    },
    { label: t('surveys'), icon: ClipboardCheck, path: '/teach/surveys' },
    {
      label: currentCourseId ? t('course_forums') : t('forums'),
      icon: MessageSquare,
      path: currentCourseId ? `/teach/courses/${currentCourseId}/forums` : '/forums',
    },
    {
      label: currentCourseId ? t('course_certificates') : t('certificates'),
      icon: Award,
      path: currentCourseId ? `/teach/courses/${currentCourseId}/certificates` : '/teach/certificates',
    },
    // Only show admin logs link to actual admins (not just instructors)
    ...(isActualAdmin ? [{ label: t('logs'), icon: Activity, path: '/admin/logs' }] : []),
    { label: t('gradebook'), icon: ClipboardList, path: '/dashboard/gradebook' },
    { label: t('calendar'), icon: Calendar, path: '/dashboard/calendar' },
    { label: t('ai_tools'), icon: BrainCircuit, path: '/ai-tools' },
  ];

  const navItems = isInstructor ? instructorNavItems : studentNavItems;

  const isActive = (path: string) => {
    if (path === '/dashboard') {
      return location.pathname === '/dashboard';
    }
    return location.pathname.startsWith(path);
  };

  return (
    <aside
      className="fixed left-0 top-16 h-[calc(100vh-4rem)] z-40 transition-all duration-300 border-r"
      style={{
        width: isCollapsed ? '64px' : '200px',
        backgroundColor: colors.bg,
        borderColor: colors.border,
      }}
    >
      <nav className="flex flex-col h-full py-4">
        {/* Nav Items */}
        <div className="flex-1 space-y-1 px-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.path);

            // Render disabled items as non-clickable divs
            if (item.disabled) {
              return (
                <div
                  key={item.label}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-not-allowed opacity-50"
                  style={{
                    color: colors.textDisabled,
                  }}
                  title={isCollapsed ? `${item.label} (${t('common:select_course_first')})` : t('common:select_course_first')}
                >
                  <Icon className="w-5 h-5 flex-shrink-0" />
                  {!isCollapsed && (
                    <span className="font-medium text-sm truncate">{item.label}</span>
                  )}
                </div>
              );
            }

            return (
              <Link
                key={item.path}
                to={item.path}
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors group"
                style={{
                  backgroundColor: active ? colors.bgActive : 'transparent',
                  color: active ? colors.textActive : colors.textSecondary,
                }}
                title={isCollapsed ? item.label : undefined}
              >
                <Icon className="w-5 h-5 flex-shrink-0" />
                {!isCollapsed && (
                  <span className="font-medium text-sm truncate">{item.label}</span>
                )}
                {!isCollapsed && item.badge && (
                  <span className="ml-auto bg-primary-500 text-white text-xs px-2 py-0.5 rounded-full">
                    {item.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </div>

        {/* Collapse Button */}
        <div className="px-2 pt-2 border-t" style={{ borderColor: colors.border }}>
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="flex items-center justify-center w-full px-3 py-2 rounded-lg transition-colors"
            style={{ color: colors.textSecondary }}
          >
            {isCollapsed ? (
              <ChevronRight className="w-5 h-5" />
            ) : (
              <>
                <ChevronLeft className="w-5 h-5" />
                <span className="ml-2 text-sm">{t('common:collapse')}</span>
              </>
            )}
          </button>
        </div>
      </nav>
    </aside>
  );
};

export const useSidebarWidth = () => {
  // This hook can be used by pages to get the sidebar width for proper margin
  return { collapsed: 64, expanded: 200 };
};
