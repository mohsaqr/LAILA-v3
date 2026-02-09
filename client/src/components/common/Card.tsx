import { useTheme } from '../../hooks/useTheme';

export type CardVariant = 'default' | 'blue' | 'purple' | 'amber' | 'emerald' | 'indigo' | 'cyan' | 'teal';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
  hover?: boolean;
  style?: React.CSSProperties;
  variant?: CardVariant;
}

const variantColors: Record<CardVariant, {
  bgLight: string;
  bgDark: string;
  borderLight: string;
  borderDark: string;
}> = {
  default: {
    bgLight: '#ffffff',
    bgDark: '#1f2937',
    borderLight: '#f3f4f6',
    borderDark: '#374151',
  },
  blue: {
    bgLight: '#eff6ff',
    bgDark: 'rgba(59, 130, 246, 0.1)',
    borderLight: '#bfdbfe',
    borderDark: 'rgba(59, 130, 246, 0.3)',
  },
  purple: {
    bgLight: '#faf5ff',
    bgDark: 'rgba(139, 92, 246, 0.1)',
    borderLight: '#ddd6fe',
    borderDark: 'rgba(139, 92, 246, 0.3)',
  },
  amber: {
    bgLight: '#fffbeb',
    bgDark: 'rgba(245, 158, 11, 0.1)',
    borderLight: '#fde68a',
    borderDark: 'rgba(245, 158, 11, 0.3)',
  },
  emerald: {
    bgLight: '#ecfdf5',
    bgDark: 'rgba(16, 185, 129, 0.1)',
    borderLight: '#a7f3d0',
    borderDark: 'rgba(16, 185, 129, 0.3)',
  },
  indigo: {
    bgLight: '#eef2ff',
    bgDark: 'rgba(99, 102, 241, 0.1)',
    borderLight: '#c7d2fe',
    borderDark: 'rgba(99, 102, 241, 0.3)',
  },
  cyan: {
    bgLight: '#ecfeff',
    bgDark: 'rgba(6, 182, 212, 0.1)',
    borderLight: '#a5f3fc',
    borderDark: 'rgba(6, 182, 212, 0.3)',
  },
  teal: {
    bgLight: '#f0fdfa',
    bgDark: 'rgba(20, 184, 166, 0.1)',
    borderLight: '#99f6e4',
    borderDark: 'rgba(20, 184, 166, 0.3)',
  },
};

export const Card = ({ children, className = '', onClick, hover = false, style, variant = 'default' }: CardProps) => {
  const { isDark } = useTheme();
  const colors = variantColors[variant];

  return (
    <div
      className={`rounded-xl shadow-sm border ${
        hover ? 'transition-all hover:shadow-md hover:-translate-y-1 cursor-pointer' : ''
      } ${className}`}
      style={{
        backgroundColor: isDark ? colors.bgDark : colors.bgLight,
        borderColor: isDark ? colors.borderDark : colors.borderLight,
        ...style,
      }}
      onClick={onClick}
    >
      {children}
    </div>
  );
};

export const CardHeader = ({ children, className = '', onClick }: { children: React.ReactNode; className?: string; onClick?: () => void }) => {
  const { isDark } = useTheme();
  return (
    <div
      className={`p-6 border-b ${className}`}
      style={{ borderColor: isDark ? '#374151' : '#f3f4f6' }}
      onClick={onClick}
    >
      {children}
    </div>
  );
};

export const CardBody = ({ children, className = '' }: { children: React.ReactNode; className?: string }) => (
  <div className={`p-6 ${className}`}>{children}</div>
);

export const CardFooter = ({ children, className = '' }: { children: React.ReactNode; className?: string }) => {
  const { isDark } = useTheme();
  return (
    <div
      className={`p-6 border-t ${className}`}
      style={{ borderColor: isDark ? '#374151' : '#f3f4f6' }}
    >
      {children}
    </div>
  );
};
