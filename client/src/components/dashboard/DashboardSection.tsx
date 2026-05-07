import { ReactNode } from 'react';
import { useTheme } from '../../hooks/useTheme';

interface DashboardSectionProps {
  title?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}

/**
 * Visual rhythm wrapper for every dashboard section. Renders a small
 * uppercase-tracked heading with an optional right-aligned action
 * (typically a "View all" link), then the children. Sections stack
 * with consistent vertical spacing so dashboards scan top-to-bottom
 * without a manual `mb-*` on every child.
 */
export const DashboardSection = ({ title, action, children, className = '' }: DashboardSectionProps) => {
  const { isDark } = useTheme();
  return (
    <section className={`mb-8 md:mb-10 ${className}`}>
      {(title || action) && (
        <div className="flex items-end justify-between gap-3 mb-3">
          {title && (
            <h2
              className="text-xs font-semibold uppercase tracking-wider"
              style={{ color: isDark ? '#9ca3af' : '#6b7280' }}
            >
              {title}
            </h2>
          )}
          {action && <div className="flex-shrink-0">{action}</div>}
        </div>
      )}
      {children}
    </section>
  );
};
