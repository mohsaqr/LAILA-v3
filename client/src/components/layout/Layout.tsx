import { useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { Navbar } from './Navbar';
import { SkipLinks } from '../common/SkipLinks';
import { useAuth } from '../../hooks/useAuth';
import { useTheme } from '../../hooks/useTheme';
import { Eye } from 'lucide-react';
import analytics from '../../services/analytics';

export const Layout = () => {
  const { isViewingAs, viewAsRole, setViewAs, isActualAdmin } = useAuth();
  const { isDark } = useTheme();

  // Sync viewAsRole with analytics service for test mode logging
  useEffect(() => {
    if (viewAsRole) {
      analytics.setTestMode(`test_${viewAsRole}`);
    } else {
      analytics.setTestMode(null);
    }
  }, [viewAsRole]);

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
      <main id="main-content" className="flex-1">
        <Outlet />
      </main>
    </div>
  );
};
