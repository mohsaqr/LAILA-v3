import { useTheme } from '../../hooks/useTheme';

interface MiniBarChartItem {
  label: string;
  value: number;
  /** 0-100 scale or absolute (max is computed from items) */
  max?: number;
  color?: string;
  hint?: string;
}

interface MiniBarChartProps {
  items: MiniBarChartItem[];
  /** When true, scale bars to 100; otherwise scale to the max value in items. */
  percent?: boolean;
  className?: string;
}

/**
 * Horizontal bar chart for ranked comparisons (e.g. course completion
 * rate per course, top resources). Pure CSS — no SVG, no library.
 */
export const MiniBarChart = ({ items, percent = false, className = '' }: MiniBarChartProps) => {
  const { isDark } = useTheme();
  const max = percent ? 100 : Math.max(1, ...items.map(i => i.max ?? i.value));

  return (
    <ul className={`space-y-3 ${className}`}>
      {items.map((it, i) => {
        const w = Math.max(0, Math.min(100, (it.value / max) * 100));
        const color = it.color ?? '#0d9488';
        return (
          <li key={i}>
            <div className="flex items-baseline justify-between gap-3 mb-1">
              <span
                className="text-sm font-medium truncate"
                style={{ color: isDark ? '#f3f4f6' : '#111827' }}
              >
                {it.label}
              </span>
              <span
                className="text-xs whitespace-nowrap"
                style={{ color: isDark ? '#9ca3af' : '#6b7280' }}
              >
                {it.hint ?? (percent ? `${Math.round(it.value)}%` : it.value)}
              </span>
            </div>
            <div
              className="h-2 rounded-full overflow-hidden"
              style={{ backgroundColor: isDark ? '#374151' : '#e5e7eb' }}
            >
              <div
                className="h-full rounded-full transition-all"
                style={{ width: `${w}%`, background: `linear-gradient(90deg, ${color}, ${color}cc)` }}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
};
