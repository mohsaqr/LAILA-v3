import { useMemo, useState, MouseEvent, useCallback } from 'react';
import { useTheme } from '../../hooks/useTheme';

interface MonthlyEngagementChartProps {
  /** Daily counts for the current month, indexed 0 = day 1. Length = days elapsed so far. */
  thisMonth: number[];
  /** Daily counts for the previous month, indexed 0 = day 1. Length = full month. */
  lastMonth: number[];
  thisMonthLabel: string;
  lastMonthLabel: string;
  /** Year + 1-based month for the current series — used to format tooltip dates. */
  thisMonthYear: number;
  thisMonthMonth: number;
  /** Visible chart height in pixels. */
  height?: number;
  className?: string;
}

const MARGIN = { top: 16, right: 18, bottom: 24, left: 32 };

/**
 * Smooth dual-line chart overlaying current month vs previous month
 * event counts on the same day-of-month axis. Cubic-Bezier curves
 * (Catmull-Rom-style smoothing), grid lines, axis labels, and a
 * snap-to-day hover tooltip showing both values for the hovered date.
 */
export const MonthlyEngagementChart = ({
  thisMonth,
  lastMonth,
  thisMonthLabel,
  lastMonthLabel,
  thisMonthYear,
  thisMonthMonth,
  height = 240,
  className = '',
}: MonthlyEngagementChartProps) => {
  const { isDark } = useTheme();
  const [width, setWidth] = useState(720);
  const [hoverDay, setHoverDay] = useState<number | null>(null);

  const colors = useMemo(
    () => ({
      thisMonth: '#0d9488',
      lastMonth: '#f59e0b',
      grid: isDark ? '#1f2937' : '#eef2f7',
      axis: isDark ? '#6b7280' : '#9ca3af',
      tooltipBg: isDark ? '#0f172a' : '#0b1220',
      tooltipText: '#ffffff',
      tooltipMuted: '#cbd5e1',
    }),
    [isDark]
  );

  // ResizeObserver to keep the chart responsive without depending on a hook.
  const setWrapRef = useCallback((node: HTMLDivElement | null) => {
    if (!node) return;
    const ro = new ResizeObserver(entries => {
      for (const e of entries) setWidth(Math.floor(e.contentRect.width));
    });
    ro.observe(node);
    setWidth(Math.floor(node.getBoundingClientRect().width));
  }, []);

  const totalDays = Math.max(thisMonth.length, lastMonth.length, 1);
  const innerW = Math.max(40, width - MARGIN.left - MARGIN.right);
  const innerH = Math.max(40, height - MARGIN.top - MARGIN.bottom);
  const stepX = totalDays > 1 ? innerW / (totalDays - 1) : 0;

  const allValues = [...thisMonth, ...lastMonth];
  const rawMax = Math.max(1, ...allValues);
  // Round up to a "nice" max so the y-axis ticks land on round numbers.
  const yMax = niceCeil(rawMax);

  const xForDay = (d: number) => MARGIN.left + (d - 1) * stepX;
  const yForVal = (v: number) => MARGIN.top + innerH - (v / yMax) * innerH;

  // Build smooth path through points (Catmull-Rom → cubic Bezier).
  const linePath = (counts: number[]) => {
    if (counts.length === 0) return '';
    const pts = counts.map((v, i) => ({ x: xForDay(i + 1), y: yForVal(v) }));
    if (pts.length === 1) return `M ${pts[0].x} ${pts[0].y}`;
    let d = `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`;
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[i - 1] ?? pts[i];
      const p1 = pts[i];
      const p2 = pts[i + 1];
      const p3 = pts[i + 2] ?? p2;
      const cp1x = p1.x + (p2.x - p0.x) / 6;
      const cp1y = p1.y + (p2.y - p0.y) / 6;
      const cp2x = p2.x - (p3.x - p1.x) / 6;
      const cp2y = p2.y - (p3.y - p1.y) / 6;
      d += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
    }
    return d;
  };

  const areaPath = (counts: number[]) => {
    const line = linePath(counts);
    if (!line || counts.length === 0) return '';
    const lastX = xForDay(counts.length);
    const firstX = xForDay(1);
    const baselineY = MARGIN.top + innerH;
    return `${line} L ${lastX} ${baselineY} L ${firstX} ${baselineY} Z`;
  };

  const tickValues = useMemo(() => {
    const ticks = 4;
    return Array.from({ length: ticks + 1 }, (_, i) => Math.round((yMax * i) / ticks));
  }, [yMax]);

  const xTicks = useMemo(() => {
    const interval = totalDays <= 10 ? 1 : totalDays <= 16 ? 2 : 5;
    const out: number[] = [];
    for (let d = 1; d <= totalDays; d += interval) out.push(d);
    if (out[out.length - 1] !== totalDays) out.push(totalDays);
    return out;
  }, [totalDays]);

  const handleMouseMove = useCallback(
    (ev: MouseEvent<SVGSVGElement>) => {
      const svg = ev.currentTarget;
      const rect = svg.getBoundingClientRect();
      const xPx = ev.clientX - rect.left;
      // SVG is rendered at the wrapper's pixel width — no extra scaling needed.
      const xInner = Math.min(Math.max(xPx - MARGIN.left, 0), innerW);
      const day = Math.round(xInner / Math.max(stepX, 0.0001)) + 1;
      const clamped = Math.min(Math.max(day, 1), totalDays);
      setHoverDay(clamped);
    },
    [innerW, stepX, totalDays]
  );

  const tooltip = useMemo(() => {
    if (hoverDay == null) return null;
    const thisVal = hoverDay <= thisMonth.length ? thisMonth[hoverDay - 1] : null;
    const lastVal = hoverDay <= lastMonth.length ? lastMonth[hoverDay - 1] : null;
    const dateLabel = formatDayLabel(thisMonthYear, thisMonthMonth, hoverDay);
    const x = xForDay(hoverDay);
    return { thisVal, lastVal, dateLabel, x };
  }, [hoverDay, thisMonth, lastMonth, thisMonthYear, thisMonthMonth, stepX]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div ref={setWrapRef} className={`relative w-full ${className}`}>
      <svg
        width={width}
        height={height}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setHoverDay(null)}
        className="overflow-visible"
      >
        {/* Y grid + ticks */}
        {tickValues.map(v => {
          const y = yForVal(v);
          return (
            <g key={`y-${v}`}>
              <line
                x1={MARGIN.left}
                y1={y}
                x2={MARGIN.left + innerW}
                y2={y}
                stroke={colors.grid}
                strokeWidth={1}
              />
              <text
                x={MARGIN.left - 8}
                y={y}
                textAnchor="end"
                dominantBaseline="middle"
                fontSize="10"
                fill={colors.axis}
              >
                {v}
              </text>
            </g>
          );
        })}

        {/* Last-month area + line (drawn first so this-month sits on top) */}
        <path d={areaPath(lastMonth)} fill={colors.lastMonth} fillOpacity={0.08} />
        <path
          d={linePath(lastMonth)}
          fill="none"
          stroke={colors.lastMonth}
          strokeWidth={2.25}
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity={0.85}
        />

        {/* This-month area + line */}
        <path d={areaPath(thisMonth)} fill={colors.thisMonth} fillOpacity={0.14} />
        <path
          d={linePath(thisMonth)}
          fill="none"
          stroke={colors.thisMonth}
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* X axis labels */}
        {xTicks.map(d => (
          <text
            key={`x-${d}`}
            x={xForDay(d)}
            y={height - 6}
            textAnchor="middle"
            fontSize="10"
            fill={colors.axis}
          >
            {String(d).padStart(2, '0')}
          </text>
        ))}

        {/* Hover crosshair + dots */}
        {tooltip && (
          <g pointerEvents="none">
            <line
              x1={tooltip.x}
              x2={tooltip.x}
              y1={MARGIN.top}
              y2={MARGIN.top + innerH}
              stroke={colors.axis}
              strokeOpacity={0.4}
              strokeDasharray="3 3"
            />
            {tooltip.thisVal != null && (
              <circle
                cx={tooltip.x}
                cy={yForVal(tooltip.thisVal)}
                r={4}
                fill={colors.thisMonth}
                stroke="#fff"
                strokeWidth={2}
              />
            )}
            {tooltip.lastVal != null && (
              <circle
                cx={tooltip.x}
                cy={yForVal(tooltip.lastVal)}
                r={4}
                fill={colors.lastMonth}
                stroke="#fff"
                strokeWidth={2}
              />
            )}
          </g>
        )}
      </svg>

      {/* HTML tooltip — easier to style than SVG <foreignObject>. */}
      {tooltip && (
        <div
          className="absolute pointer-events-none rounded-lg px-3 py-2 shadow-lg text-xs"
          style={{
            left: clampTooltipX(tooltip.x, width),
            top: 6,
            backgroundColor: colors.tooltipBg,
            color: colors.tooltipText,
            transform: 'translateX(-50%)',
            minWidth: 160,
          }}
        >
          <div className="font-semibold mb-1">{tooltip.dateLabel}</div>
          <div className="flex items-center justify-between gap-4">
            <span className="flex items-center gap-1.5" style={{ color: colors.tooltipMuted }}>
              <span className="inline-block w-1 h-3 rounded-sm" style={{ backgroundColor: colors.thisMonth }} />
              {thisMonthLabel}
            </span>
            <span className="font-semibold tabular-nums">
              {tooltip.thisVal != null ? tooltip.thisVal : '—'}
            </span>
          </div>
          <div className="flex items-center justify-between gap-4 mt-0.5">
            <span className="flex items-center gap-1.5" style={{ color: colors.tooltipMuted }}>
              <span className="inline-block w-1 h-3 rounded-sm" style={{ backgroundColor: colors.lastMonth }} />
              {lastMonthLabel}
            </span>
            <span className="font-semibold tabular-nums">
              {tooltip.lastVal != null ? tooltip.lastVal : '—'}
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

/**
 * Round up to a "nice" axis max so 47 → 50, 121 → 150, 6 → 8, etc.
 * Keeps tick labels readable.
 */
function niceCeil(v: number): number {
  if (v <= 1) return 1;
  if (v <= 5) return Math.ceil(v);
  const exp = Math.pow(10, Math.floor(Math.log10(v)));
  const m = v / exp;
  if (m <= 1) return 1 * exp;
  if (m <= 2) return 2 * exp;
  if (m <= 2.5) return 2.5 * exp;
  if (m <= 5) return 5 * exp;
  return 10 * exp;
}

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

function formatDayLabel(year: number, month: number, day: number): string {
  if (!year || !month) return String(day);
  return `${day} ${MONTH_NAMES[month - 1]} ${year}`;
}

function clampTooltipX(x: number, total: number): number {
  const margin = 90;
  return Math.min(Math.max(x, margin), total - margin);
}
