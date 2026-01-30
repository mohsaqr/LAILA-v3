import { Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  GraduationCap,
  ClipboardList,
  ClipboardCheck,
  Calendar,
  BrainCircuit,
  Settings,
  ChevronLeft,
  ChevronRight,
  Briefcase,
  Activity,
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { useTheme } from '../../hooks/useTheme';
import { useAuth } from '../../hooks/useAuth';

interface NavItem {
  label: string;
  icon: React.ElementType;
  path: string;
  badge?: number;
}

export const DashboardSidebar = () => {
  const location = useLocation();
  const { isDark } = useTheme();
  const { isInstructor, isAuthenticated } = useAuth();
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
    border: isDark ? '#374151' : '#e5e7eb',
  };

  // Don't show sidebar if not authenticated
  if (!isAuthenticated) {
    return null;
  }

  const studentNavItems: NavItem[] = [
    { label: 'Dashboard', icon: LayoutDashboard, path: '/dashboard' },
    { label: 'My Courses', icon: GraduationCap, path: '/courses' },
    { label: 'Gradebook', icon: ClipboardList, path: '/dashboard/gradebook' },
    { label: 'Calendar', icon: Calendar, path: '/dashboard/calendar' },
    { label: 'AI Tools', icon: BrainCircuit, path: '/ai-tools' },
    { label: 'Settings', icon: Settings, path: '/settings' },
  ];

  const instructorNavItems: NavItem[] = [
    { label: 'Dashboard', icon: LayoutDashboard, path: '/dashboard' },
    { label: 'Teaching', icon: Briefcase, path: '/teach' },
    { label: 'My Courses', icon: GraduationCap, path: '/courses' },
    { label: 'Surveys', icon: ClipboardCheck, path: '/teach/surveys' },
    { label: 'Logs', icon: Activity, path: '/admin/logs' },
    { label: 'Gradebook', icon: ClipboardList, path: '/dashboard/gradebook' },
    { label: 'Calendar', icon: Calendar, path: '/dashboard/calendar' },
    { label: 'AI Tools', icon: BrainCircuit, path: '/ai-tools' },
    { label: 'Settings', icon: Settings, path: '/settings' },
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
                <span className="ml-2 text-sm">Collapse</span>
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
