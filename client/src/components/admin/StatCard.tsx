import { ReactNode } from 'react';
import { useTheme } from '../../hooks/useTheme';

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
  iconBgColor,
  value,
  label,
  size = 'md',
  className = '',
}: StatCardProps) => {
  const { isDark } = useTheme();
  const styles = sizeStyles[size];

  const colors = {
    bg: isDark ? '#1f2937' : '#ffffff',
    border: isDark ? '#374151' : '#e5e7eb',
    textPrimary: isDark ? '#f3f4f6' : '#111827',
    textSecondary: isDark ? '#9ca3af' : '#6b7280',
    iconBg: isDark ? '#374151' : '#f3f4f6',
  };

  return (
    <div
      className={`rounded-xl ${styles.container} ${className}`}
      style={{
        backgroundColor: colors.bg,
        border: `1px solid ${colors.border}`,
      }}
    >
      <div className="flex items-center gap-3">
        <div
          className={`${styles.iconWrapper} rounded-lg flex items-center justify-center`}
          style={{ backgroundColor: iconBgColor || colors.iconBg }}
        >
          {icon}
        </div>
        <div>
          <p className={styles.value} style={{ color: colors.textPrimary }}>{value}</p>
          <p className={styles.label} style={{ color: colors.textSecondary }}>{label}</p>
        </div>
      </div>
    </div>
  );
};
