import { useMemo } from 'react';
import { useTheme } from '../../hooks/useTheme';

interface ActivityDonutProps {
  /** Map of category label → count. Zero / negative entries are dropped. */
  data: Record<string, number>;
  /** Optional renderer for the category label (e.g. localised verb names). */
  formatLabel?: (key: string) => string;
  className?: string;
}

const PALETTE = [
  '#a5b4fc', // indigo-300
  '#fdba74', // orange-300
  '#7dd3fc', // sky-300
  '#fde68a', // amber-200
  '#c4b5fd', // violet-300
  '#f9a8d4', // pink-300
  '#86efac', // green-300
  '#fca5a5', // red-300
];

const DEFAULT_HUMANIZE: Record<string, string> = {
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

const defaultFormat = (k: string) =>
  DEFAULT_HUMANIZE[k] ?? k.charAt(0).toUpperCase() + k.slice(1).replace(/_/g, ' ');

const W = 480;
const H = 360;
const CX = W / 2;
const CY = H / 2 - 6;
const R_OUT = 102;
const R_IN = 58;
const RADIAL_OFFSET = 5; // exploded look — each slice nudged outward along its mid-angle
const ANGLE_GAP = 0.045; // ~2.5° gap between slices
const CORNER_RADIUS = 6; // softness of slice corners — D3-arc-style rounded corners
const LEADER_OUT = 18; // length of the diagonal leader from arc edge
const LABEL_GAP = 14; // horizontal spacing between elbow and the value text
const MIN_LABEL_DY = 16; // vertical breathing room between adjacent labels on the same side

/**
 * Build an annulus segment path with rounded corners (a la d3.arc).
 *
 * Each of the four corners is replaced with a small arc of radius `cr`
 * tangent to both the radial edge and the outer/inner circular arc.
 * Geometry: a corner arc tangent to the outer arc has its centre at
 * distance (R - cr) from the origin and offset cr perpendicular to the
 * radial line. So the angular trim on the outer arc is
 * `atan(cr / sqrt((R-cr)^2 - cr^2))`. Inner corners are symmetric with
 * (R + cr) instead.
 */
function roundedAnnulusPath(
  cx: number,
  cy: number,
  rIn: number,
  rOut: number,
  a1: number,
  a2: number,
  cornerRadius: number
): string {
  const angleSpan = a2 - a1;
  // Cap the corner radius so it can't overlap itself on narrow slices.
  const halfThickness = (rOut - rIn) / 2;
  const arcChordHalf = Math.sin(angleSpan / 2) * ((rOut + rIn) / 2);
  const cr = Math.max(0, Math.min(cornerRadius, halfThickness - 1, arcChordHalf - 1));

  if (cr < 1) {
    const x1 = cx + Math.cos(a1) * rOut;
    const y1 = cy + Math.sin(a1) * rOut;
    const x2 = cx + Math.cos(a2) * rOut;
    const y2 = cy + Math.sin(a2) * rOut;
    const x3 = cx + Math.cos(a2) * rIn;
    const y3 = cy + Math.sin(a2) * rIn;
    const x4 = cx + Math.cos(a1) * rIn;
    const y4 = cy + Math.sin(a1) * rIn;
    const largeArc = angleSpan > Math.PI ? 1 : 0;
    return `M ${x1.toFixed(2)} ${y1.toFixed(2)} A ${rOut} ${rOut} 0 ${largeArc} 1 ${x2.toFixed(2)} ${y2.toFixed(2)} L ${x3.toFixed(2)} ${y3.toFixed(2)} A ${rIn} ${rIn} 0 ${largeArc} 0 ${x4.toFixed(2)} ${y4.toFixed(2)} Z`;
  }

  const outerD = Math.sqrt((rOut - cr) ** 2 - cr ** 2);
  const outerOffset = Math.atan(cr / outerD);
  const innerD = rIn > 0 ? Math.sqrt((rIn + cr) ** 2 - cr ** 2) : 0;
  const innerOffset = rIn > 0 ? Math.atan(cr / innerD) : 0;

  const maxOff = angleSpan / 2 - 0.005;
  const oOff = Math.min(outerOffset, maxOff);
  const iOff = Math.min(innerOffset, maxOff);

  const oa1 = a1 + oOff;
  const oa2 = a2 - oOff;
  const ia1 = a1 + iOff;
  const ia2 = a2 - iOff;

  const oArcStart = { x: cx + Math.cos(oa1) * rOut, y: cy + Math.sin(oa1) * rOut };
  const oArcEnd = { x: cx + Math.cos(oa2) * rOut, y: cy + Math.sin(oa2) * rOut };
  const iArcEnd = { x: cx + Math.cos(ia2) * rIn, y: cy + Math.sin(ia2) * rIn };
  const iArcStart = { x: cx + Math.cos(ia1) * rIn, y: cy + Math.sin(ia1) * rIn };
  const oRadialStart = { x: cx + Math.cos(a1) * outerD, y: cy + Math.sin(a1) * outerD };
  const oRadialEnd = { x: cx + Math.cos(a2) * outerD, y: cy + Math.sin(a2) * outerD };
  const iRadialStart = { x: cx + Math.cos(a1) * innerD, y: cy + Math.sin(a1) * innerD };
  const iRadialEnd = { x: cx + Math.cos(a2) * innerD, y: cy + Math.sin(a2) * innerD };

  const largeOuter = oa2 - oa1 > Math.PI ? 1 : 0;
  const largeInner = ia2 - ia1 > Math.PI ? 1 : 0;
  const f = (n: number) => n.toFixed(2);

  return [
    `M ${f(oRadialStart.x)} ${f(oRadialStart.y)}`,
    `A ${f(cr)} ${f(cr)} 0 0 1 ${f(oArcStart.x)} ${f(oArcStart.y)}`,
    `A ${rOut} ${rOut} 0 ${largeOuter} 1 ${f(oArcEnd.x)} ${f(oArcEnd.y)}`,
    `A ${f(cr)} ${f(cr)} 0 0 1 ${f(oRadialEnd.x)} ${f(oRadialEnd.y)}`,
    `L ${f(iRadialEnd.x)} ${f(iRadialEnd.y)}`,
    `A ${f(cr)} ${f(cr)} 0 0 1 ${f(iArcEnd.x)} ${f(iArcEnd.y)}`,
    `A ${rIn} ${rIn} 0 ${largeInner} 0 ${f(iArcStart.x)} ${f(iArcStart.y)}`,
    `A ${f(cr)} ${f(cr)} 0 0 1 ${f(iRadialStart.x)} ${f(iRadialStart.y)}`,
    'Z',
  ].join(' ');
}

/**
 * Modern donut with separated slices, exploded radial offset, leader-line
 * callouts, and a pill-style legend. Each slice's label sits outside
 * the donut as `value (pct%)`, connected by a coloured leader line +
 * a thin neutral elbow. Stacks adjacent labels vertically when they
 * would otherwise collide.
 */
export const ActivityDonut = ({ data, formatLabel = defaultFormat, className = '' }: ActivityDonutProps) => {
  const { isDark } = useTheme();

  const slices = useMemo(() => {
    // All non-zero verbs, sorted by frequency descending.
    const entries = Object.entries(data)
      .filter(([, v]) => v > 0)
      .sort(([, a], [, b]) => b - a);
    const total = entries.reduce((s, [, v]) => s + v, 0);
    if (total === 0) return [];

    const built: Array<{
      label: string;
      value: number;
      pct: number;
      color: string;
      path: string;
      offset: { x: number; y: number };
      arcEdge: { x: number; y: number };
      elbow: { x: number; y: number };
      labelX: number;
      labelY: number;
      anchor: 'start' | 'end';
      side: 'left' | 'right';
    }> = [];

    let cumulative = -Math.PI / 2; // start at 12 o'clock
    for (let i = 0; i < entries.length; i++) {
      const [label, value] = entries[i];
      const frac = value / total;
      const angleSpan = frac * Math.PI * 2;
      const halfGap = Math.min(ANGLE_GAP / 2, angleSpan / 4);
      const startAngle = cumulative + halfGap;
      const endAngle = cumulative + angleSpan - halfGap;
      const midAngle = (startAngle + endAngle) / 2;
      cumulative += angleSpan;

      const color = PALETTE[i % PALETTE.length];

      const path = roundedAnnulusPath(CX, CY, R_IN, R_OUT, startAngle, endAngle, CORNER_RADIUS);

      const offsetX = Math.cos(midAngle) * RADIAL_OFFSET;
      const offsetY = Math.sin(midAngle) * RADIAL_OFFSET;
      const arcEdge = {
        x: CX + Math.cos(midAngle) * R_OUT + offsetX,
        y: CY + Math.sin(midAngle) * R_OUT + offsetY,
      };
      const elbow = {
        x: CX + Math.cos(midAngle) * (R_OUT + LEADER_OUT) + offsetX,
        y: CY + Math.sin(midAngle) * (R_OUT + LEADER_OUT) + offsetY,
      };
      const isRight = Math.cos(midAngle) >= 0;

      built.push({
        label: formatLabel(label),
        value,
        pct: Math.round(frac * 100),
        color,
        path,
        offset: { x: offsetX, y: offsetY },
        arcEdge,
        elbow,
        labelX: isRight ? elbow.x + LABEL_GAP : elbow.x - LABEL_GAP,
        labelY: elbow.y,
        anchor: isRight ? 'start' : 'end',
        side: isRight ? 'right' : 'left',
      });
    }

    // Vertical de-collision: for each side, sort by Y and ensure each
    // label is at least MIN_LABEL_DY pixels apart from its neighbour.
    for (const side of ['left', 'right'] as const) {
      const indices = built
        .map((s, i) => ({ s, i }))
        .filter(({ s }) => s.side === side)
        .sort((a, b) => a.s.labelY - b.s.labelY);
      for (let k = 1; k < indices.length; k++) {
        const prev = indices[k - 1].s;
        const cur = indices[k].s;
        if (cur.labelY - prev.labelY < MIN_LABEL_DY) {
          cur.labelY = prev.labelY + MIN_LABEL_DY;
        }
      }
    }

    return built;
  }, [data, formatLabel]);

  const textColor = isDark ? '#d1d5db' : '#374151';
  const elbowLineColor = isDark ? '#4b5563' : '#cbd5e1';

  if (slices.length === 0) return null;

  return (
    <div className={`flex flex-col items-stretch gap-4 ${className}`}>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="xMidYMid meet"
        className="w-full"
        style={{ maxHeight: 320 }}
        role="img"
        aria-label="Activity breakdown donut chart"
      >
        {/* Slices */}
        {slices.map((s, i) => (
          <g key={`slice-${i}`} transform={`translate(${s.offset.x.toFixed(1)} ${s.offset.y.toFixed(1)})`}>
            <path d={s.path} fill={s.color} />
          </g>
        ))}
        {/* Leader lines + value labels */}
        {slices.map((s, i) => (
          <g key={`label-${i}`}>
            <line
              x1={s.arcEdge.x}
              y1={s.arcEdge.y}
              x2={s.elbow.x}
              y2={s.elbow.y}
              stroke={s.color}
              strokeWidth={1.6}
              strokeLinecap="round"
            />
            <line
              x1={s.elbow.x}
              y1={s.elbow.y}
              x2={s.labelX}
              y2={s.labelY}
              stroke={elbowLineColor}
              strokeWidth={1}
              strokeLinecap="round"
            />
            <text
              x={s.labelX + (s.anchor === 'start' ? 4 : -4)}
              y={s.labelY + 4}
              textAnchor={s.anchor}
              fontSize="11"
              fontWeight={500}
              fill={textColor}
            >
              {s.value}
            </text>
          </g>
        ))}
      </svg>

      {/* Pill legend */}
      <div className="flex flex-wrap gap-1.5 justify-center">
        {slices.map((s, i) => (
          <span
            key={`pill-${i}`}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-xs"
            style={{
              borderColor: isDark ? '#374151' : '#e5e7eb',
              color: isDark ? '#e5e7eb' : '#374151',
              backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : '#ffffff',
            }}
          >
            <span className="w-2 h-2 rounded-sm" style={{ backgroundColor: s.color }} aria-hidden />
            {s.label}
          </span>
        ))}
      </div>
    </div>
  );
};
