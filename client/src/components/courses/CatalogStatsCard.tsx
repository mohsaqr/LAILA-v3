import { GraduationCap, Users } from 'lucide-react';
import { useTheme } from '../../hooks/useTheme';
import { Skeleton } from '../dashboard/Skeleton';

interface CatalogStatsCardProps {
  totalCourses: number;
  totalStudents: number;
  totalCoursesLabel: string;
  totalStudentsLabel: string;
  loading?: boolean;
}

const formatCount = (n: number): string => {
  if (n >= 1000) return `${(n / 1000).toFixed(n >= 10_000 ? 0 : 1).replace(/\.0$/, '')}k+`;
  return String(n);
};

export const CatalogStatsCard = ({
  totalCourses,
  totalStudents,
  totalCoursesLabel,
  totalStudentsLabel,
  loading = false,
}: CatalogStatsCardProps) => {
  const { isDark } = useTheme();

  const tiles: Array<{ icon: typeof GraduationCap; value: number; label: string }> = [
    { icon: GraduationCap, value: totalCourses, label: totalCoursesLabel },
    { icon: Users, value: totalStudents, label: totalStudentsLabel },
  ];

  return (
    <div
      className="rounded-2xl border p-5 sm:p-6 grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6"
      style={{
        backgroundImage: isDark
          ? 'linear-gradient(135deg, rgba(8,143,143,0.18) 0%, rgba(20,184,166,0.10) 100%)'
          : 'linear-gradient(135deg, #f0fdfd 0%, #ccfbfb 100%)',
        borderColor: isDark ? 'rgba(8,143,143,0.3)' : '#99f6f6',
      }}
    >
      {tiles.map(({ icon: Icon, value, label }) => (
        <div key={label} className="flex items-center gap-4">
          <div
            className="flex items-center justify-center w-14 h-14 rounded-2xl shrink-0 shadow-sm"
            style={{
              backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : '#ffffff',
              color: isDark ? '#22d3d3' : '#065c5c',
            }}
          >
            <Icon className="w-7 h-7" />
          </div>
          <div className="min-w-0">
            {loading ? (
              <>
                <Skeleton className="h-7 w-20 mb-1.5" />
                <Skeleton className="h-3.5 w-28" />
              </>
            ) : (
              <>
                <div
                  className="text-2xl sm:text-3xl font-bold leading-tight tabular-nums"
                  style={{ color: isDark ? '#f3f4f6' : '#054a4a' }}
                >
                  {formatCount(value)}
                </div>
                <div
                  className="text-xs sm:text-sm font-medium"
                  style={{ color: isDark ? '#9ca3af' : '#077575' }}
                >
                  {label}
                </div>
              </>
            )}
          </div>
        </div>
      ))}
    </div>
  );
};
