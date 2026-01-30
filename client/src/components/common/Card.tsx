import { useTheme } from '../../hooks/useTheme';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
  hover?: boolean;
}

export const Card = ({ children, className = '', onClick, hover = false }: CardProps) => {
  const { isDark } = useTheme();

  return (
    <div
      className={`rounded-xl shadow-sm border ${
        hover ? 'transition-all hover:shadow-md hover:-translate-y-1 cursor-pointer' : ''
      } ${className}`}
      style={{
        backgroundColor: isDark ? '#1f2937' : '#ffffff',
        borderColor: isDark ? '#374151' : '#f3f4f6',
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
