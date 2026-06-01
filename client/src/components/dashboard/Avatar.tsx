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

// LAILA base teal-green for every initials avatar — no random per-user
// colour. Initials are the first letter of the first + last name.
const LAILA_GRADIENT = 'linear-gradient(135deg, #088F8F 0%, #14b8a6 100%)';

const initials = (name: string) =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map(p => p[0]?.toUpperCase() ?? '')
    .join('') || '?';

export const Avatar = ({ src, name, size = 'md', className = '' }: AvatarProps) => {
  const { isDark } = useTheme();
  const { box, text } = SIZE[size];

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
      style={{ background: LAILA_GRADIENT }}
      aria-label={name}
    >
      {initials(name)}
    </div>
  );
};
