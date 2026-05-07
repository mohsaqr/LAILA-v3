import { useTheme } from '../../hooks/useTheme';

interface ProgressRingProps {
  value: number;
  size?: number;
  thickness?: number;
  color?: string;
  showLabel?: boolean;
  className?: string;
}

export const ProgressRing = ({
  value,
  size = 44,
  thickness = 4,
  color = '#088F8F',
  showLabel = true,
  className = '',
}: ProgressRingProps) => {
  const { isDark } = useTheme();
  const clamped = Math.max(0, Math.min(100, value));
  const radius = (size - thickness) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (clamped / 100) * circumference;

  return (
    <div
      className={`relative inline-flex items-center justify-center ${className}`}
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={isDark ? '#374151' : '#e5e7eb'}
          strokeWidth={thickness}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={thickness}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 0.4s ease' }}
        />
      </svg>
      {showLabel && (
        <span
          className="absolute text-[10px] font-semibold"
          style={{ color: isDark ? '#f3f4f6' : '#111827' }}
        >
          {Math.round(clamped)}%
        </span>
      )}
    </div>
  );
};
