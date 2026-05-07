import { useTheme } from '../../hooks/useTheme';

interface SkeletonProps {
  className?: string;
  rounded?: 'md' | 'lg' | 'full';
}

export const Skeleton = ({ className = '', rounded = 'md' }: SkeletonProps) => {
  const { isDark } = useTheme();
  const radius = rounded === 'full' ? 'rounded-full' : rounded === 'lg' ? 'rounded-lg' : 'rounded-md';
  return (
    <div
      className={`animate-pulse ${radius} ${className}`}
      style={{ backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)' }}
    />
  );
};
