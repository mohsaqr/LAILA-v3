import { ReactNode } from 'react';

type StatCardSize = 'sm' | 'md' | 'lg';

interface StatCardProps {
  icon: ReactNode;
  iconBgColor?: string;
  value: string | number;
  label: string;
  size?: StatCardSize;
  className?: string;
}

const sizeStyles = {
  sm: {
    container: 'p-3',
    iconWrapper: 'w-10 h-10',
    value: 'text-xl font-bold',
    label: 'text-xs',
  },
  md: {
    container: 'p-4',
    iconWrapper: 'w-12 h-12',
    value: 'text-2xl font-bold',
    label: 'text-sm',
  },
  lg: {
    container: 'p-5',
    iconWrapper: 'w-14 h-14',
    value: 'text-3xl font-bold',
    label: 'text-sm',
  },
};

export const StatCard = ({
  icon,
  iconBgColor = 'bg-gray-100',
  value,
  label,
  size = 'md',
  className = '',
}: StatCardProps) => {
  const styles = sizeStyles[size];

  return (
    <div className={`bg-white rounded-xl border border-gray-200 ${styles.container} ${className}`}>
      <div className="flex items-center gap-3">
        <div
          className={`${styles.iconWrapper} rounded-lg flex items-center justify-center ${iconBgColor}`}
        >
          {icon}
        </div>
        <div>
          <p className={`${styles.value} text-gray-900`}>{value}</p>
          <p className={`${styles.label} text-gray-500`}>{label}</p>
        </div>
      </div>
    </div>
  );
};
