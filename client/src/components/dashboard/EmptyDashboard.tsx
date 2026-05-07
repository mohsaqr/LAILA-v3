import { ReactNode } from 'react';
import { LucideIcon } from 'lucide-react';
import { useTheme } from '../../hooks/useTheme';

interface EmptyDashboardProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}

/**
 * Friendlier empty state for dashboard tiles than the generic
 * `EmptyState` — softer, less chrome, designed to fit inside a Card
 * without dominating it.
 */
export const EmptyDashboard = ({ icon: Icon, title, description, action, className = '' }: EmptyDashboardProps) => {
  const { isDark } = useTheme();
  return (
    <div className={`flex flex-col items-center justify-center text-center py-8 px-4 ${className}`}>
      <div
        className="w-12 h-12 rounded-full flex items-center justify-center mb-3"
        style={{ backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : '#f9fafb' }}
      >
        <Icon className="w-5 h-5" style={{ color: isDark ? '#6b7280' : '#9ca3af' }} />
      </div>
      <p className="text-sm font-medium" style={{ color: isDark ? '#f3f4f6' : '#111827' }}>
        {title}
      </p>
      {description && (
        <p className="mt-1 text-xs max-w-xs" style={{ color: isDark ? '#9ca3af' : '#6b7280' }}>
          {description}
        </p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
};
