import { ReactNode } from 'react';
import { Link } from 'react-router-dom';

interface StatItem {
  value: string | number;
  label: string;
}

interface ActionButton {
  label: string;
  href: string;
  variant?: 'primary' | 'secondary';
}

interface AdminFeatureCardProps {
  icon: ReactNode;
  iconGradient?: string;
  borderGradient?: string;
  title: string;
  description: string;
  stats?: StatItem[];
  actions?: ActionButton[];
  className?: string;
}

export const AdminFeatureCard = ({
  icon,
  iconGradient = 'from-blue-500 to-blue-600',
  borderGradient = 'from-blue-500 to-blue-600',
  title,
  description,
  stats = [],
  actions = [],
  className = '',
}: AdminFeatureCardProps) => {
  return (
    <div className={`bg-white rounded-xl border border-gray-200 overflow-hidden ${className}`}>
      {/* Gradient top border */}
      <div className={`h-1 bg-gradient-to-r ${borderGradient}`} />

      <div className="p-6">
        {/* Icon and title */}
        <div className="flex items-start gap-4 mb-4">
          <div
            className={`w-16 h-16 rounded-xl bg-gradient-to-br ${iconGradient} flex items-center justify-center flex-shrink-0`}
          >
            <div className="text-white">{icon}</div>
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-xl font-bold text-gray-900">{title}</h3>
            <p className="text-sm text-gray-500 mt-1">{description}</p>
          </div>
        </div>

        {/* Stats row */}
        {stats.length > 0 && (
          <div className="flex gap-6 mb-5 py-4 border-t border-b border-gray-100">
            {stats.map((stat, index) => (
              <div key={index}>
                <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
                <p className="text-xs text-gray-500">{stat.label}</p>
              </div>
            ))}
          </div>
        )}

        {/* Action buttons */}
        {actions.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {actions.map((action, index) => (
              <Link
                key={index}
                to={action.href}
                className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                  action.variant === 'primary'
                    ? 'bg-gray-900 text-white hover:bg-gray-800'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {action.label}
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
