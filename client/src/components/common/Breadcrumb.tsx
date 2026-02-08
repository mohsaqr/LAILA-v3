import { Link } from 'react-router-dom';
import { ChevronRight, Home } from 'lucide-react';
import { useTheme } from '../../hooks/useTheme';

export interface BreadcrumbItem {
  label: string;
  href?: string;
  icon?: React.ReactNode;
}

interface BreadcrumbProps {
  items: BreadcrumbItem[];
  className?: string;
  homeHref?: string;
  showHome?: boolean;
}

export const Breadcrumb = ({ items, className = '', homeHref = '/dashboard', showHome = true }: BreadcrumbProps) => {
  const { isDark } = useTheme();

  const colors = {
    homeLink: isDark ? '#6b7280' : '#9ca3af',
    homeLinkHover: isDark ? '#d1d5db' : '#6b7280',
    separator: isDark ? '#4b5563' : '#d1d5db',
    activeText: isDark ? '#f3f4f6' : '#111827',
    linkText: isDark ? '#9ca3af' : '#6b7280',
    linkHover: isDark ? '#5eecec' : '#088F8F',
  };

  return (
    <nav className={`flex items-center text-sm ${className}`} aria-label="Breadcrumb">
      <ol className="flex items-center flex-wrap gap-1">
        {/* Home link */}
        {showHome && (
          <li>
            <Link
              to={homeHref}
              className="transition-colors"
              style={{ color: colors.homeLink }}
              title="Dashboard"
            >
              <Home className="w-4 h-4" />
            </Link>
          </li>
        )}

        {items.map((item, index) => {
          const isLast = index === items.length - 1;

          return (
            <li key={index} className="flex items-center">
              <ChevronRight className="w-4 h-4 mx-1 flex-shrink-0" style={{ color: colors.separator }} />
              {isLast || !item.href ? (
                <span
                  className="flex items-center gap-1.5 font-medium truncate max-w-[200px]"
                  style={{ color: colors.activeText }}
                >
                  {item.icon}
                  {item.label}
                </span>
              ) : (
                <Link
                  to={item.href}
                  className="flex items-center gap-1.5 transition-colors truncate max-w-[200px] hover:underline"
                  style={{ color: colors.linkText }}
                >
                  {item.icon}
                  {item.label}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
};
