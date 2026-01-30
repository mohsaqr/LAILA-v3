import { useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Navbar } from './Navbar';
import { DashboardSidebar } from './DashboardSidebar';
import { SkipLinks } from '../common/SkipLinks';
import { useAuth } from '../../hooks/useAuth';
import { useTheme } from '../../hooks/useTheme';
import { Eye } from 'lucide-react';
import analytics from '../../services/analytics';

export const Layout = () => {
  const { isViewingAs, viewAsRole, setViewAs, isActualAdmin, isAuthenticated } = useAuth();
  const { isDark } = useTheme();
  const location = useLocation();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // Pages where sidebar should be shown (authenticated main dashboard pages)
  const sidebarPages = ['/dashboard', '/courses', '/ai-tools', '/ai-tutors', '/settings', '/profile', '/teach'];
  const showSidebar = isAuthenticated && sidebarPages.some(path =>
    location.pathname === path || location.pathname.startsWith(path + '/')
  ) && !location.pathname.startsWith('/admin');

  // Sync viewAsRole with analytics service for test mode logging
  useEffect(() => {
    if (viewAsRole) {
      analytics.setTestMode(`test_${viewAsRole}`);
    } else {
      analytics.setTestMode(null);
    }
  }, [viewAsRole]);

  // Listen for sidebar collapse state changes
  useEffect(() => {
    const handleStorage = () => {
      const collapsed = localStorage.getItem('sidebarCollapsed') === 'true';
      setSidebarCollapsed(collapsed);
    };
    window.addEventListener('storage', handleStorage);
    handleStorage();
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  const sidebarWidth = showSidebar ? (sidebarCollapsed ? 64 : 200) : 0;

  return (
    <div
      className="min-h-screen"
      style={{ backgroundColor: isDark ? '#111827' : '#f9fafb' }}
    >
      <SkipLinks />
      {/* Test Mode Banner */}
      {isActualAdmin && isViewingAs && (
        <div className="bg-amber-500 text-white px-4 py-2 text-center text-sm font-medium flex items-center justify-center gap-2">
          <Eye className="w-4 h-4" />
          <span>
            Test Mode: Viewing as {viewAsRole === 'instructor' ? 'Instructor' : 'Student'}
            {' '}(Logs marked as test_{viewAsRole})
          </span>
          <button
            onClick={() => setViewAs(null)}
            className="ml-4 px-2 py-0.5 bg-amber-600 hover:bg-amber-700 rounded text-xs"
          >
            Exit Test Mode
          </button>
        </div>
      )}
      <Navbar />
      {showSidebar && <DashboardSidebar />}
      <main
        id="main-content"
        className="flex-1 transition-all duration-300"
        style={{ marginLeft: sidebarWidth }}
      >
        <Outlet />
      </main>
    </div>
  );
};
