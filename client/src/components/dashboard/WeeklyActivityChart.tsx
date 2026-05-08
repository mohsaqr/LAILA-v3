import { MouseEvent, useCallback, useMemo, useState } from 'react';
import { BarChart3, LineChart } from 'lucide-react';
import { useTheme } from '../../hooks/useTheme';
import { createColorMap, type PaletteName } from '../tna/colorFix';
import { smoothPath, niceCeil } from './smoothPath';

interface WeeklyActivityChartProps {
  /** Date strings (YYYY-MM-DD) — typically 7, today plus 6 previous. */
  days: string[];
  /** All verb names that appear in `series`. Drives the legend order. */
  verbs: string[];
  /** Per-verb daily counts; each array length must equal `days.length`. */
  series: Record<string, number[]>;
  /** Colour palette name (passed through to `createColorMap`). */
  palette?: PaletteName;
  /** Lower bound for the chart height — defaults to 240 px. */
  minHeight?: number;
  className?: string;
}

type Mode = 'stacked' | 'lines';

const MARGIN = { top: 16, right: 18, bottom: 36, left: 36 };
const SEGMENT_GAP = 3; // vertical gap between stacked-bar segments
const SEGMENT_RX = 3; // corner radius on each bar segment
const TOOLTIP_MAX_ROWS = 6;

/**
 * Weekly activity chart used by the admin dashboard. Two modes:
 *
 * - `stacked` — per-day vertical bar made of "pill"-style rounded
 *   segments (one per verb), separated by a small gap so each
 *   verb is visually distinct.
 * - `lines` — one smooth Catmull-Rom line per verb with a faint
 *   area fill underneath, matching the look of MonthlyEngagementChart.
 *
 * Both modes share the same Y-axis (nice-rounded max), the same
 * X-axis (day-of-month with weekday-abbreviation underneath), and a
 * hover crosshair + tooltip. The legend doubles as a toggle —
 * clicking a pill hides that verb from the chart.
 */
export const WeeklyActivityChart = ({
  days,
  verbs,
  series,
  palette = 'default',
  minHeight = 240,
  className = '',
}: WeeklyActivityChartProps) => {
  const { isDark } = useTheme();
  const [size, setSize] = useState({ width: 720, height: minHeight });
  const [mode, setMode] = useState<Mode>('stacked');
  const [hidden, setHidden] = useState<Set<string>>(() => new Set());
  const [hoverDay, setHoverDay] = useState<number | null>(null);

  const setWrapRef = useCallback(
    (node: HTMLDivElement | null) => {
      if (!node) return;
      const apply = (cw: number, ch: number) => {
        setSize({
          width: Math.max(40, Math.floor(cw)),
          height: Math.max(minHeight, Math.floor(ch)),
        });
      };
      const ro = new ResizeObserver(entries => {
        for (const e of entries) apply(e.contentRect.width, e.contentRect.height);
      });
      ro.observe(node);
      const r = node.getBoundingClientRect();
      apply(r.width, r.height);
    },
    [minHeight]
  );

  const colorMap = useMemo(() => createColorMap(verbs, palette), [verbs, palette]);

  const visibleVerbs = useMemo(() => verbs.filter(v => !hidden.has(v)), [verbs, hidden]);

  const { width, height } = size;
  const innerW = Math.max(40, width - MARGIN.left - MARGIN.right);
  const innerH = Math.max(40, height - MARGIN.top - MARGIN.bottom);
  const baseY = MARGIN.top + innerH;
  const stepX = days.length > 0 ? innerW / Math.max(days.length, 1) : 0;
  const xForDay = (i: number) => MARGIN.left + (i + 0.5) * stepX; // center of column
  const barW = Math.max(8, Math.min(36, stepX * 0.55));

  // Compute Y max: largest stacked total across days (stacked mode) OR
  // largest single value across visible verbs (line mode). Re-running
  // both keeps the Y axis stable when toggling modes.
  const yMax = useMemo(() => {
    let max = 0;
    for (let i = 0; i < days.length; i++) {
      let stack = 0;
      let single = 0;
      for (const v of visibleVerbs) {
        const val = series[v]?.[i] ?? 0;
        stack += val;
        if (val > single) single = val;
      }
      const dayMax = mode === 'stacked' ? stack : single;
      if (dayMax > max) max = dayMax;
    }
    return niceCeil(Math.max(1, max));
  }, [days, visibleVerbs, series, mode]);

  const yForVal = (v: number) => MARGIN.top + innerH - (v / yMax) * innerH;

  const colors = useMemo(
    () => ({
      grid: isDark ? '#1f2937' : '#eef2f7',
      axis: isDark ? '#6b7280' : '#9ca3af',
      tick: isDark ? '#9ca3af' : '#6b7280',
      tooltipBg: isDark ? '#0f172a' : '#0b1220',
      tooltipText: '#ffffff',
      tooltipMuted: '#cbd5e1',
      pillBg: isDark ? 'rgba(255,255,255,0.03)' : '#ffffff',
      pillBorder: isDark ? '#374151' : '#e5e7eb',
      pillFg: isDark ? '#e5e7eb' : '#374151',
    }),
    [isDark]
  );

  const tickValues = useMemo(() => {
    const ticks = 4;
    return Array.from({ length: ticks + 1 }, (_, i) => Math.round((yMax * i) / ticks));
  }, [yMax]);

  const handleMouseMove = useCallback(
    (ev: MouseEvent<SVGSVGElement>) => {
      const svg = ev.currentTarget;
      const rect = svg.getBoundingClientRect();
      const xPx = ev.clientX - rect.left;
      const xInner = Math.min(Math.max(xPx - MARGIN.left, 0), innerW);
      const idx = Math.min(Math.max(Math.floor(xInner / Math.max(stepX, 0.0001)), 0), days.length - 1);
      setHoverDay(idx);
    },
    [innerW, stepX, days.length]
  );

  const tooltipRows = useMemo(() => {
    if (hoverDay == null) return null;
    const rows = visibleVerbs
      .map(v => ({ verb: v, value: series[v]?.[hoverDay] ?? 0, color: colorMap[v] }))
      .filter(r => r.value > 0)
      .sort((a, b) => b.value - a.value);
    return rows;
  }, [hoverDay, visibleVerbs, series, colorMap]);

  const tooltipDateLabel = useMemo(() => {
    if (hoverDay == null || !days[hoverDay]) return '';
    const d = new Date(days[hoverDay] + 'T00:00:00Z');
    return d.toLocaleDateString('en-US', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      timeZone: 'UTC',
    });
  }, [hoverDay, days]);

  const xLabel = useCallback((iso: string | undefined) => {
    if (!iso) return '';
    const d = new Date(iso + 'T00:00:00Z');
    return {
      day: String(d.getUTCDate()).padStart(2, '0'),
      weekday: d.toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' }),
    };
  }, []);

  return (
    <div ref={setWrapRef} className={`relative w-full h-full ${className}`}>
      {/* Mode toggle */}
      <div className="absolute top-0 right-0 flex items-center gap-1 z-10">
        <ModeButton active={mode === 'stacked'} onClick={() => setMode('stacked')} ariaLabel="Stacked bars">
          <BarChart3 className="w-4 h-4" />
        </ModeButton>
        <ModeButton active={mode === 'lines'} onClick={() => setMode('lines')} ariaLabel="Lines">
          <LineChart className="w-4 h-4" />
        </ModeButton>
      </div>

      <svg
        width={width}
        height={height}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setHoverDay(null)}
        className="overflow-visible"
      >
        {/* Y grid + tick labels */}
        {tickValues.map(v => {
          const y = yForVal(v);
          return (
            <g key={`y-${v}`}>
              <line x1={MARGIN.left} y1={y} x2={MARGIN.left + innerW} y2={y} stroke={colors.grid} strokeWidth={1} />
              <text
                x={MARGIN.left - 8}
                y={y}
                textAnchor="end"
                dominantBaseline="middle"
                fontSize="10"
                fill={colors.tick}
              >
                {v}
              </text>
            </g>
          );
        })}

        {/* Bars (stacked mode) */}
        {mode === 'stacked' &&
          days.map((_, i) => {
            // Walk verbs bottom-up so the larger / first verbs sit at the
            // base. Sorting by visibleVerbs order keeps colour grouping
            // consistent across days.
            let cumulative = 0;
            return (
              <g key={`day-${i}`}>
                {visibleVerbs.map(v => {
                  const value = series[v]?.[i] ?? 0;
                  if (value <= 0) return null;
                  const segH = (value / yMax) * innerH;
                  const drawH = Math.max(2, segH - SEGMENT_GAP);
                  const top = baseY - cumulative - segH + (segH - drawH) / 2;
                  cumulative += segH;
                  return (
                    <rect
                      key={`seg-${v}-${i}`}
                      x={xForDay(i) - barW / 2}
                      y={top}
                      width={barW}
                      height={drawH}
                      rx={SEGMENT_RX}
                      ry={SEGMENT_RX}
                      fill={colorMap[v]}
                    />
                  );
                })}
              </g>
            );
          })}

        {/* Lines (line mode) */}
        {mode === 'lines' &&
          visibleVerbs.map(v => {
            const counts = series[v] ?? [];
            const pts = counts.map((val, i) => ({ x: xForDay(i), y: yForVal(val) }));
            const line = smoothPath(pts);
            if (!line) return null;
            const lastX = pts[pts.length - 1]?.x ?? MARGIN.left;
            const firstX = pts[0]?.x ?? MARGIN.left;
            const area = `${line} L ${lastX.toFixed(1)} ${baseY.toFixed(1)} L ${firstX.toFixed(1)} ${baseY.toFixed(1)} Z`;
            return (
              <g key={`ln-${v}`}>
                <path d={area} fill={colorMap[v]} fillOpacity={0.1} />
                <path
                  d={line}
                  fill="none"
                  stroke={colorMap[v]}
                  strokeWidth={2.25}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </g>
            );
          })}

        {/* X axis labels */}
        {days.map((iso, i) => {
          const lbl = xLabel(iso);
          if (typeof lbl === 'string') return null;
          return (
            <g key={`x-${i}`}>
              <text
                x={xForDay(i)}
                y={height - 18}
                textAnchor="middle"
                fontSize="10"
                fontWeight={600}
                fill={colors.tick}
              >
                {lbl.day}
              </text>
              <text
                x={xForDay(i)}
                y={height - 4}
                textAnchor="middle"
                fontSize="10"
                fill={colors.axis}
              >
                {lbl.weekday}
              </text>
            </g>
          );
        })}

        {/* Hover crosshair */}
        {hoverDay != null && (
          <line
            x1={xForDay(hoverDay)}
            x2={xForDay(hoverDay)}
            y1={MARGIN.top}
            y2={baseY}
            stroke={colors.axis}
            strokeOpacity={0.4}
            strokeDasharray="3 3"
            pointerEvents="none"
          />
        )}
      </svg>

      {/* Tooltip */}
      {hoverDay != null && tooltipRows && tooltipRows.length > 0 && (
        <div
          className="absolute pointer-events-none rounded-lg px-3 py-2 shadow-lg text-xs"
          style={{
            left: clampTooltipX(xForDay(hoverDay), width),
            top: 6,
            backgroundColor: colors.tooltipBg,
            color: colors.tooltipText,
            transform: 'translateX(-50%)',
            minWidth: 180,
          }}
        >
          <div className="font-semibold mb-1">{tooltipDateLabel}</div>
          {tooltipRows.slice(0, TOOLTIP_MAX_ROWS).map(r => (
            <div key={r.verb} className="flex items-center justify-between gap-4">
              <span className="flex items-center gap-1.5" style={{ color: colors.tooltipMuted }}>
                <span className="inline-block w-1 h-3 rounded-sm" style={{ backgroundColor: r.color }} />
                {humanizeVerb(r.verb)}
              </span>
              <span className="font-semibold tabular-nums">{r.value}</span>
            </div>
          ))}
          {tooltipRows.length > TOOLTIP_MAX_ROWS && (
            <div className="mt-0.5 text-[10px]" style={{ color: colors.tooltipMuted }}>
              +{tooltipRows.length - TOOLTIP_MAX_ROWS} more
            </div>
          )}
        </div>
      )}

      {/* Pill legend */}
      <div className="flex flex-wrap gap-1.5 mt-3">
        {verbs.map(v => {
          const isHidden = hidden.has(v);
          return (
            <button
              key={`pill-${v}`}
              type="button"
              onClick={() => {
                setHidden(prev => {
                  const next = new Set(prev);
                  if (next.has(v)) next.delete(v);
                  else next.add(v);
                  return next;
                });
              }}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-xs transition-colors"
              style={{
                borderColor: colors.pillBorder,
                color: colors.pillFg,
                backgroundColor: colors.pillBg,
                opacity: isHidden ? 0.4 : 1,
              }}
              aria-pressed={!isHidden}
            >
              <span
                className="w-2 h-2 rounded-sm"
                style={{ backgroundColor: colorMap[v], opacity: isHidden ? 0.4 : 1 }}
                aria-hidden
              />
              {humanizeVerb(v)}
            </button>
          );
        })}
      </div>
    </div>
  );
};

function ModeButton({
  active,
  onClick,
  ariaLabel,
  children,
}: {
  active: boolean;
  onClick: () => void;
  ariaLabel: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      aria-pressed={active}
      className={`inline-flex items-center justify-center w-7 h-7 rounded-md transition-colors ${
        active ? 'bg-cyan-100 text-cyan-700' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800'
      }`}
    >
      {children}
    </button>
  );
}

function clampTooltipX(x: number, total: number): number {
  const margin = 100;
  return Math.min(Math.max(x, margin), total - margin);
}

const VERB_LABELS: Record<string, string> = {
  viewed: 'Viewed',
  submitted: 'Submitted',
  completed: 'Completed',
  started: 'Started',
  graded: 'Graded',
  enrolled: 'Enrolled',
  interacted: 'Interacted',
  expressed: 'Expressed',
  selected: 'Selected',
  downloaded: 'Downloaded',
};

function humanizeVerb(v: string): string {
  return VERB_LABELS[v] ?? v.charAt(0).toUpperCase() + v.slice(1).replace(/_/g, ' ');
}
