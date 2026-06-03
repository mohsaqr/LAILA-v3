import { useTheme } from '../../hooks/useTheme';
import { Sparkline } from './Sparkline';

interface TrendChipProps {
  label: string;
  value: number | string;
  trend?: number[];
  delta?: number | null;
  color?: string;
  /** Optional accent gradient — adds a 2px top stripe in `color`. */
  accent?: boolean;
  /** Optional icon rendered as a colored chip in the top-right. */
  icon?: React.ReactNode;
  className?: string;
}

const formatDelta = (d: number | null | undefined) => {
  if (d == null || !isFinite(d)) return null;
  const sign = d > 0 ? '+' : d < 0 ? '' : '';
  return `${sign}${Math.round(d)}%`;
};

/**
 * KPI chip with a small sparkline + delta-vs-previous-period. Used by
 * the admin dashboard's KPI row and the instructor "This week" tile.
 * Prefer this over big stat cards — visual density without enterprise
 * stat-grid bulk.
 */
export const TrendChip = ({ label, value, trend = [], delta = null, color = '#088F8F', accent = false, icon, className = '' }: TrendChipProps) => {
  const { isDark } = useTheme();
  const deltaText = formatDelta(delta);
  const deltaColor = delta == null ? undefined : delta > 0 ? '#15803d' : delta < 0 ? '#b91c1c' : isDark ? '#9ca3af' : '#6b7280';

  return (
    <div
      className={`relative flex flex-col gap-2 p-4 rounded-xl border overflow-hidden transition-shadow hover:shadow-md ${className}`}
      style={{
        backgroundColor: isDark ? '#1f2937' : '#ffffff',
        borderColor: isDark ? '#374151' : '#f3f4f6',
      }}
    >
      {accent && (
        <div
          className="absolute top-0 left-0 right-0 h-1"
          style={{ background: `linear-gradient(90deg, ${color}, ${color}88)` }}
        />
      )}
      <div className="flex items-start justify-between gap-2">
        <span className="text-xs uppercase tracking-wider" style={{ color: isDark ? '#9ca3af' : '#6b7280' }}>
          {label}
        </span>
        {icon && (
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center"
            style={{ backgroundColor: `${color}1a`, color }}
          >
            {icon}
          </div>
        )}
      </div>
      <div className="flex items-end justify-between gap-3">
        <span className="text-2xl font-semibold leading-none" style={{ color: isDark ? '#f3f4f6' : '#111827' }}>
          {value}
        </span>
        {trend.length > 0 && <Sparkline values={trend} width={72} height={24} color={color} />}
      </div>
      {deltaText && (
        <span className="text-xs font-medium" style={{ color: deltaColor }}>
          {deltaText} <span style={{ color: isDark ? '#6b7280' : '#9ca3af' }}>vs prev</span>
        </span>
      )}
    </div>
  );
};
