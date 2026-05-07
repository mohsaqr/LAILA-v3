import { useTheme } from '../../hooks/useTheme';

interface AvatarProps {
  src?: string | null;
  name: string;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  className?: string;
}

const SIZE: Record<NonNullable<AvatarProps['size']>, { box: string; text: string }> = {
  xs: { box: 'w-6 h-6', text: 'text-[10px]' },
  sm: { box: 'w-8 h-8', text: 'text-xs' },
  md: { box: 'w-10 h-10', text: 'text-sm' },
  lg: { box: 'w-14 h-14', text: 'text-base' },
};

const PALETTE = [
  ['#0EA5E9', '#0369A1'],
  ['#14B8A6', '#0F766E'],
  ['#A855F7', '#7E22CE'],
  ['#F59E0B', '#B45309'],
  ['#EC4899', '#BE185D'],
  ['#22C55E', '#15803D'],
  ['#EF4444', '#B91C1C'],
  ['#6366F1', '#4338CA'],
];

const initials = (name: string) =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map(p => p[0]?.toUpperCase() ?? '')
    .join('') || '?';

const hash = (s: string) => {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
};

export const Avatar = ({ src, name, size = 'md', className = '' }: AvatarProps) => {
  const { isDark } = useTheme();
  const { box, text } = SIZE[size];
  const [from, to] = PALETTE[hash(name) % PALETTE.length];

  if (src) {
    return (
      <img
        src={src}
        alt={name}
        className={`${box} rounded-full object-cover flex-shrink-0 ${className}`}
        style={{ borderColor: isDark ? '#374151' : '#e5e7eb' }}
      />
    );
  }
  return (
    <div
      className={`${box} ${text} rounded-full flex items-center justify-center font-semibold text-white flex-shrink-0 ${className}`}
      style={{ background: `linear-gradient(135deg, ${from}, ${to})` }}
      aria-label={name}
    >
      {initials(name)}
    </div>
  );
};
