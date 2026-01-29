import { Link } from 'react-router-dom';
import { ChevronRight, Home } from 'lucide-react';

export interface BreadcrumbItem {
  label: string;
  href?: string;
  icon?: React.ReactNode;
}

interface BreadcrumbProps {
  items: BreadcrumbItem[];
  className?: string;
}

export const Breadcrumb = ({ items, className = '' }: BreadcrumbProps) => {
  return (
    <nav className={`flex items-center text-sm ${className}`} aria-label="Breadcrumb">
      <ol className="flex items-center flex-wrap gap-1">
        {/* Home link */}
        <li>
          <Link
            to="/dashboard"
            className="text-gray-400 hover:text-gray-600 transition-colors"
            title="Dashboard"
          >
            <Home className="w-4 h-4" />
          </Link>
        </li>

        {items.map((item, index) => {
          const isLast = index === items.length - 1;

          return (
            <li key={index} className="flex items-center">
              <ChevronRight className="w-4 h-4 text-gray-300 mx-1 flex-shrink-0" />
              {isLast || !item.href ? (
                <span className="flex items-center gap-1.5 text-gray-900 font-medium truncate max-w-[200px]">
                  {item.icon}
                  {item.label}
                </span>
              ) : (
                <Link
                  to={item.href}
                  className="flex items-center gap-1.5 text-gray-500 hover:text-primary-600 transition-colors truncate max-w-[200px]"
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
