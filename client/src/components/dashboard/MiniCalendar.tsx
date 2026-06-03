import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useTheme } from '../../hooks/useTheme';

interface MiniCalendarProps {
  /** Items keyed by ISO date (`YYYY-MM-DD`) → count of due items. */
  itemsByDate: Map<string, number>;
  /** Click a day → caller decides navigation. Receives the ISO date. */
  onDateClick?: (iso: string) => void;
}

/**
 * Compact month-grid card. Lighter cousin of `DashboardCalendar`:
 *   - Header chevrons to step months.
 *   - 7-col day grid with a small marker on days where the student
 *     has assignments due (count = 1 → dot, count ≥ 2 → "+N" pill).
 *   - Today's cell tinted teal; past-due cells with items tinted red.
 *   - Click any day → caller navigates (typically to the full
 *     calendar page).
 */
export const MiniCalendar = ({
  itemsByDate,
  onDateClick,
}: MiniCalendarProps) => {
  const { isDark } = useTheme();
  const [cursor, setCursor] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });

  const today = useMemo(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
  }, []);

  const monthDays = useMemo(() => {
    // Returns an array of cells: { date | null }, padded so the first
    // cell aligns with Sunday and the grid fills 6 weeks (42 cells).
    const year = cursor.getFullYear();
    const month = cursor.getMonth();
    const firstDay = new Date(year, month, 1).getDay(); // 0 = Sun
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const cells: Array<{ date: Date | null }> = [];
    for (let i = 0; i < firstDay; i++) cells.push({ date: null });
    for (let d = 1; d <= daysInMonth; d++) cells.push({ date: new Date(year, month, d) });
    while (cells.length % 7 !== 0) cells.push({ date: null });
    return cells;
  }, [cursor]);

  const monthLabel = cursor.toLocaleDateString(undefined, {
    month: 'long',
    year: 'numeric',
  });

  const weekdayLabels = useMemo(() => {
    // Build short weekday labels (Sun–Sat) using Intl.
    const fmt = new Intl.DateTimeFormat(undefined, { weekday: 'short' });
    const base = new Date(2024, 0, 7); // a Sunday
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(base);
      d.setDate(base.getDate() + i);
      return fmt.format(d).slice(0, 2);
    });
  }, []);

  const cardBg = isDark ? '#1f2937' : '#ffffff';
  const cardBorder = isDark ? '#374151' : '#e5e7eb';
  const titleColor = isDark ? '#f3f4f6' : '#111827';
  const muted = isDark ? '#9ca3af' : '#6b7280';
  const dimText = isDark ? '#6b7280' : '#9ca3af';
  const accent = '#0d9488';

  const isSameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();

  const toIso = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

  const stepMonth = (delta: number) => {
    setCursor(prev => new Date(prev.getFullYear(), prev.getMonth() + delta, 1));
  };

  return (
    <div
      className="rounded-2xl border h-full p-4 sm:p-5 flex flex-col"
      style={{ backgroundColor: cardBg, borderColor: cardBorder }}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <button
          type="button"
          onClick={() => stepMonth(-1)}
          aria-label="Previous month"
          className="inline-flex items-center justify-center w-7 h-7 rounded-md hover:bg-black/5 dark:hover:bg-white/5"
          style={{ color: muted }}
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <span className="text-sm font-semibold" style={{ color: titleColor }}>
          {monthLabel}
        </span>
        <button
          type="button"
          onClick={() => stepMonth(1)}
          aria-label="Next month"
          className="inline-flex items-center justify-center w-7 h-7 rounded-md hover:bg-black/5 dark:hover:bg-white/5"
          style={{ color: muted }}
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Weekday header */}
      <div className="grid grid-cols-7 mb-1">
        {weekdayLabels.map((label, i) => (
          <span
            key={i}
            className="text-[10px] font-semibold uppercase tracking-wider text-center"
            style={{ color: muted }}
          >
            {label}
          </span>
        ))}
      </div>

      {/* Day grid */}
      <div className="grid grid-cols-7 gap-0.5 flex-1">
        {monthDays.map((cell, i) => {
          if (!cell.date) {
            return <div key={i} className="aspect-square" />;
          }
          const iso = toIso(cell.date);
          const count = itemsByDate.get(iso) ?? 0;
          const isToday = isSameDay(cell.date, today);
          const isPast = cell.date < today && !isToday;
          const hasItems = count > 0;
          return (
            <button
              key={i}
              type="button"
              onClick={() => onDateClick?.(iso)}
              className="relative aspect-square rounded-md flex flex-col items-center justify-center text-xs transition-colors hover:bg-black/5 dark:hover:bg-white/5"
              style={{
                backgroundColor: isToday
                  ? (isDark ? 'rgba(13,148,136,0.20)' : '#ccfbf1')
                  : isPast && hasItems
                    ? (isDark ? 'rgba(220,38,38,0.10)' : '#fef2f2')
                    : 'transparent',
                color: isToday
                  ? accent
                  : cell.date.getMonth() !== cursor.getMonth()
                    ? dimText
                    : titleColor,
                fontWeight: isToday ? 600 : 400,
              }}
            >
              <span className="leading-none">{cell.date.getDate()}</span>
              {hasItems && (
                count >= 2 ? (
                  <span
                    className="mt-0.5 text-[9px] font-semibold px-1.5 rounded-full"
                    style={{
                      backgroundColor: isPast ? '#ef4444' : accent,
                      color: '#ffffff',
                    }}
                  >
                    {count}
                  </span>
                ) : (
                  <span
                    className="absolute bottom-1 w-1 h-1 rounded-full"
                    style={{ backgroundColor: isPast ? '#ef4444' : accent }}
                  />
                )
              )}
            </button>
          );
        })}
      </div>

    </div>
  );
};
