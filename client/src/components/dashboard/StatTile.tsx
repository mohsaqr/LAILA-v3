import { Link } from 'react-router-dom';
import { LucideIcon } from 'lucide-react';

export type StatTileColor = 'violet' | 'emerald' | 'amber' | 'rose' | 'sky' | 'cyan';

interface StatTileProps {
  icon: LucideIcon;
  label: string;
  value: number | string;
  color: StatTileColor;
  href: string;
  hint?: string;
}

const COLOR_MAP: Record<StatTileColor, { bg: string; iconBg: string; iconFg: string; valueFg: string; labelFg: string }> = {
  violet: {
    bg: 'linear-gradient(135deg, #ede9fe 0%, #ddd6fe 100%)',
    iconBg: 'rgba(139, 92, 246, 0.18)',
    iconFg: '#6d28d9',
    valueFg: '#3b0764',
    labelFg: '#5b21b6',
  },
  emerald: {
    bg: 'linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%)',
    iconBg: 'rgba(16, 185, 129, 0.20)',
    iconFg: '#047857',
    valueFg: '#022c22',
    labelFg: '#065f46',
  },
  amber: {
    bg: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)',
    iconBg: 'rgba(245, 158, 11, 0.22)',
    iconFg: '#b45309',
    valueFg: '#451a03',
    labelFg: '#92400e',
  },
  rose: {
    bg: 'linear-gradient(135deg, #ffe4e6 0%, #fecdd3 100%)',
    iconBg: 'rgba(244, 63, 94, 0.18)',
    iconFg: '#be123c',
    valueFg: '#4c0519',
    labelFg: '#9f1239',
  },
  sky: {
    bg: 'linear-gradient(135deg, #e0f2fe 0%, #bae6fd 100%)',
    iconBg: 'rgba(14, 165, 233, 0.20)',
    iconFg: '#0369a1',
    valueFg: '#0c4a6e',
    labelFg: '#0369a1',
  },
  cyan: {
    bg: 'linear-gradient(135deg, #cffafe 0%, #a5f3fc 100%)',
    iconBg: 'rgba(6, 182, 212, 0.20)',
    iconFg: '#0e7490',
    valueFg: '#083344',
    labelFg: '#155e75',
  },
};

/**
 * Pastel-tinted KPI tile in the style of a modern SaaS overview grid.
 * Always renders as a link (every tile is clickable). Designed to sit
 * inside a 2×2 grid next to the WelcomeCard.
 */
export const StatTile = ({ icon: Icon, label, value, color, href, hint }: StatTileProps) => {
  const c = COLOR_MAP[color];
  return (
    <Link
      to={href}
      className="group relative block overflow-hidden rounded-2xl p-4 sm:p-5 transition-all hover:-translate-y-0.5 hover:shadow-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-cyan-500"
      style={{ background: c.bg }}
    >
      {/* Decorative dots in a corner — subtle texture, like the reference. */}
      <svg
        className="absolute -top-2 -right-2 w-20 h-20 opacity-30 pointer-events-none"
        viewBox="0 0 60 60"
        aria-hidden="true"
      >
        {[0, 1, 2, 3].flatMap(r =>
          [0, 1, 2, 3].map(col => (
            <circle
              key={`s-${r}-${col}`}
              cx={6 + col * 16}
              cy={6 + r * 16}
              r={1.4}
              fill={c.iconFg}
            />
          ))
        )}
      </svg>

      <div
        className="relative w-10 h-10 sm:w-11 sm:h-11 rounded-xl flex items-center justify-center mb-6 transition-transform group-hover:scale-105"
        style={{ backgroundColor: c.iconBg, color: c.iconFg }}
      >
        <Icon className="w-5 h-5" />
      </div>

      <p className="relative text-2xl sm:text-3xl font-bold leading-none mb-1" style={{ color: c.valueFg }}>
        {value}
      </p>
      <p className="relative text-sm font-medium" style={{ color: c.labelFg }}>
        {label}
      </p>
      {hint && (
        <p className="relative text-xs mt-1" style={{ color: c.labelFg, opacity: 0.7 }}>
          {hint}
        </p>
      )}
    </Link>
  );
};
