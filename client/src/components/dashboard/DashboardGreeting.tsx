import { ReactNode } from 'react';
import { useTheme } from '../../hooks/useTheme';

interface DashboardGreetingProps {
  name?: string | null;
  line?: ReactNode;
  actions?: ReactNode;
  className?: string;
}

/**
 * Replaces the old gradient hero. Small greeting strip — name on the
 * left, optional dynamic context line below, optional inline actions
 * on the right. No gradient, no decorative graphics.
 */
export const DashboardGreeting = ({ name, line, actions, className = '' }: DashboardGreetingProps) => {
  const { isDark } = useTheme();
  const firstName = name?.trim().split(/\s+/)[0] ?? '';
  return (
    <div className={`flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-4 mb-6 md:mb-8 ${className}`}>
      <div className="min-w-0">
        <h1
          className="text-xl sm:text-2xl font-semibold truncate"
          style={{ color: isDark ? '#f3f4f6' : '#111827' }}
        >
          {firstName ? `Hi ${firstName}` : 'Welcome'}
        </h1>
        {line && (
          <p
            className="mt-0.5 text-sm"
            style={{ color: isDark ? '#9ca3af' : '#6b7280' }}
          >
            {line}
          </p>
        )}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2 flex-shrink-0">{actions}</div>}
    </div>
  );
};
