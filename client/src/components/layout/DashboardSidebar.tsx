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
  X,
  Activity,
  Network,
  FlaskConical,
  MessageSquare,
  Award,
  FileQuestion,
  BarChart3,
  BookOpen,
  Users,
  FileText,
  BookMarked,
  Tag,
  Bot,
  Blocks,
  Settings,
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

interface DashboardSidebarProps {
  mobileOpen?: boolean;
  onMobileClose?: () => void;
  isDesktop?: boolean;
}

export const DashboardSidebar = ({ mobileOpen = false, onMobileClose, isDesktop = true }: DashboardSidebarProps) => {
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
    { label: t('courses'), icon: GraduationCap, path: '/courses' },
    { label: t('labs'), icon: FlaskConical, path: '/labs' },
    { label: t('forums'), icon: MessageSquare, path: '/forums' },
    { label: t('quizzes'), icon: FileQuestion, path: '/quizzes' },
    { label: t('certificates'), icon: Award, path: '/certificates' },
    { label: t('gradebook'), icon: ClipboardList, path: '/dashboard/gradebook' },
    { label: t('calendar'), icon: Calendar, path: '/dashboard/calendar' },
    { label: t('reports'), icon: BarChart3, path: '/reports' },
  ];

  // Detect if we're in a course-specific context (teach or student-facing course view)
  const teachCourseMatch = location.pathname.match(/\/teach\/courses\/(\d+)/);
  const studentCourseMatch = null; // Never switch sidebar for student-facing course pages
  const activeCourseId = teachCourseMatch?.[1] || studentCourseMatch?.[1] || null;

  // Course-specific items for the teacher (shown when viewing a course)
  const courseNavItems: NavItem[] = activeCourseId ? [
    { label: t('curriculum'), icon: BookOpen, path: `/teach/courses/${activeCourseId}/curriculum` },
    { label: t('assignments'), icon: FileText, path: `/teach/courses/${activeCourseId}/assignments` },
    { label: t('quizzes'), icon: FileQuestion, path: `/teach/courses/${activeCourseId}/quizzes` },
    { label: t('gradebook'), icon: ClipboardList, path: `/teach/courses/${activeCourseId}/gradebook` },
    { label: t('forums'), icon: MessageSquare, path: `/teach/courses/${activeCourseId}/forums` },
    { label: t('surveys'), icon: ClipboardCheck, path: `/teach/courses/${activeCourseId}/surveys` },
    { label: t('tutors'), icon: BookMarked, path: `/teach/courses/${activeCourseId}/tutors` },
    { label: t('certificates'), icon: Award, path: `/teach/courses/${activeCourseId}/certificates` },
    { label: t('students'), icon: Users, path: `/teach/courses/${activeCourseId}/students` },
    { label: t('logs'), icon: Activity, path: `/teach/courses/${activeCourseId}/logs` },
    { label: t('analytics'), icon: Network, path: `/teach/courses/${activeCourseId}/analytics` },
  ] : [];

  // Build instructor nav items
  const instructorNavItems: NavItem[] = [
    { label: t('dashboard'), icon: LayoutDashboard, path: '/dashboard' },
    { label: t('courses'), icon: GraduationCap, path: '/courses' },
    // Course-specific items appear when viewing a course
    ...courseNavItems,
    // Global items (always shown)
    ...(activeCourseId ? [] : [
      { label: t('ai_tools'), icon: BrainCircuit, path: '/ai-tools' },
      { label: t('labs'), icon: FlaskConical, path: '/labs' },
      { label: t('lab_templates'), icon: FlaskConical, path: '/teach/labs' },
      { label: t('quizzes'), icon: FileQuestion, path: '/teach/quizzes' },
      { label: t('surveys'), icon: ClipboardCheck, path: '/teach/surveys' },
      { label: t('forums'), icon: MessageSquare, path: '/forums' },
      { label: t('certificate_templates'), icon: Award, path: '/teach/certificates' },
      { label: t('gradebook'), icon: ClipboardList, path: '/dashboard/gradebook' },
      { label: t('calendar'), icon: Calendar, path: '/dashboard/calendar' },
    ]),
    // Admin Logs + Analytics live only on the admin page (/admin/logs, /admin/analytics)
    // Course-level Logs + Analytics are in courseNavItems above
  ];

  // Admin section — same visual identity as the rest of the sidebar,
  // only the items change. We pin these to the /admin/* namespace so
  // entering the admin area swaps the menu without swapping the shell.
  const onAdminPage = location.pathname === '/admin' || location.pathname.startsWith('/admin/');
  const adminNavItems: NavItem[] = [
    { label: t('admin:frontpage', { defaultValue: 'Frontpage' }), icon: LayoutDashboard, path: '/admin' },
    { label: t('admin:users', { defaultValue: 'Users' }), icon: Users, path: '/admin/settings?tab=users' },
    { label: t('admin:enrollments', { defaultValue: 'Enrollments' }), icon: GraduationCap, path: '/admin/settings?tab=enrollments' },
    { label: t('admin:categories', { defaultValue: 'Categories' }), icon: Tag, path: '/admin/settings?tab=categories' },
    { label: t('admin:chatbots', { defaultValue: 'Chatbots' }), icon: MessageSquare, path: '/admin/chatbot-registry' },
    { label: t('admin:prompts', { defaultValue: 'Prompts' }), icon: Blocks, path: '/admin/prompt-blocks' },
    { label: t('admin:llm', { defaultValue: 'LLM' }), icon: Bot, path: '/admin/settings?tab=llm' },
    { label: t('admin:mcq_generation', { defaultValue: 'MCQ Generation' }), icon: FileQuestion, path: '/admin/settings?tab=mcq' },
    { label: t('admin:analytics', { defaultValue: 'Analytics' }), icon: Network, path: '/admin/analytics' },
    { label: t('admin:logs', { defaultValue: 'Logs' }), icon: BarChart3, path: '/admin/logs' },
    { label: t('admin:system_label', { defaultValue: 'System' }), icon: Settings, path: '/admin/settings?tab=system' },
  ];

  const navItems = onAdminPage
    ? adminNavItems
    : (isInstructor || isActualAdmin) ? instructorNavItems : studentNavItems;

  const isActive = (path: string) => {
    if (path === '/dashboard') {
      return location.pathname === '/dashboard';
    }
    // Admin query-param routes: match exact pathname + search string.
    if (path.includes('?')) {
      const [basePath, search] = path.split('?');
      // Frontpage special case is handled below via exact match.
      if (location.pathname === basePath && location.search === `?${search}`) {
        return true;
      }
      // /admin/settings with no explicit tab defaults to "users".
      if (
        basePath === '/admin/settings' &&
        search === 'tab=users' &&
        location.pathname === '/admin/settings' &&
        !location.search
      ) {
        return true;
      }
      return false;
    }
    // /admin frontpage must be exact — otherwise it would swallow every
    // /admin/* path and stay permanently active.
    if (path === '/admin') {
      return location.pathname === '/admin' && !location.search;
    }
    return location.pathname.startsWith(path);
  };

  // On mobile the sidebar always shows full labels — the desktop "collapsed"
  // mode (icons only) doesn't make sense in a drawer the user only sees
  // while it's open. Labels, close button, and wider panel are all gated on
  // the `md:` breakpoint.
  return (
    <>
      {/* Mobile backdrop — click to dismiss. Hidden above md. */}
      <div
        className={`fixed inset-0 z-30 bg-black/50 md:hidden transition-opacity duration-200 ${
          mobileOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onMobileClose}
        aria-hidden="true"
      />

      <aside
        className={`fixed left-0 top-20 h-[calc(100vh-5rem)] z-40 border-r transition-transform duration-300 md:translate-x-0 ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
        style={{
          // Mobile: full labels in a 280px drawer; desktop: respect the collapsed state.
          width: isDesktop ? (isCollapsed ? '64px' : '240px') : '280px',
          backgroundColor: colors.bg,
          borderColor: colors.border,
        }}
      >
        <nav className="flex flex-col h-full py-4">
          {/* Mobile close button */}
          <div className="md:hidden px-2 pb-2 flex justify-end">
            <button
              onClick={onMobileClose}
              className="p-2 rounded-lg"
              style={{ color: colors.textSecondary }}
              aria-label={t('common:close', { defaultValue: 'Close' })}
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Nav Items */}
          <div className="flex-1 space-y-1 px-2 overflow-y-auto">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.path);
              // Labels are always shown on mobile (isCollapsed only affects desktop).
              const hideLabel = isDesktop && isCollapsed;

              // Render disabled items as non-clickable divs
              if (item.disabled) {
                return (
                  <div
                    key={item.label}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-not-allowed opacity-50"
                    style={{
                      color: colors.textDisabled,
                    }}
                    title={hideLabel ? `${item.label} (${t('common:select_course_first')})` : t('common:select_course_first')}
                  >
                    <Icon className="w-5 h-5 flex-shrink-0" />
                    {!hideLabel && (
                      <span className="font-medium text-sm truncate">{item.label}</span>
                    )}
                  </div>
                );
              }

              return (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={onMobileClose}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors group"
                  style={{
                    backgroundColor: active ? colors.bgActive : 'transparent',
                    color: active ? colors.textActive : colors.textSecondary,
                  }}
                  title={hideLabel ? item.label : undefined}
                >
                  <Icon className="w-5 h-5 flex-shrink-0" />
                  {!hideLabel && (
                    <span className="font-medium text-sm truncate">{item.label}</span>
                  )}
                  {item.badge && !hideLabel && (
                    <span className="ml-auto bg-primary-500 text-white text-xs px-2 py-0.5 rounded-full">
                      {item.badge}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>

          {/* Collapse Button — desktop only, the mobile drawer just uses the close button. */}
          <div className="hidden md:block px-2 pt-2 border-t" style={{ borderColor: colors.border }}>
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
    </>
  );
};

export const useSidebarWidth = () => {
  // This hook can be used by pages to get the sidebar width for proper margin
  return { collapsed: 64, expanded: 240 };
};
