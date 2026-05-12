import { Link } from 'react-router-dom';
import { GraduationCap, Users, Plus } from 'lucide-react';
import { Skeleton } from '../dashboard/Skeleton';

interface CatalogStatsCardProps {
  totalCourses: number;
  totalStudents: number;
  totalCoursesLabel: string;
  totalStudentsLabel: string;
  /** When non-null, render the Create Course button with this label. */
  createLabel?: string | null;
  loading?: boolean;
}

const formatCount = (n: number): string => {
  if (n >= 10_000) return `${Math.round(n / 1000)}k+`;
  if (n >= 1000) return `${(n / 1000).toFixed(1).replace(/\.0$/, '')}k+`;
  return String(n);
};

export const CatalogStatsCard = ({
  totalCourses,
  totalStudents,
  totalCoursesLabel,
  totalStudentsLabel,
  createLabel,
  loading = false,
}: CatalogStatsCardProps) => {
  const tiles: Array<{ icon: typeof GraduationCap; value: number; label: string }> = [
    { icon: GraduationCap, value: totalCourses, label: totalCoursesLabel },
    { icon: Users, value: totalStudents, label: totalStudentsLabel },
  ];

  return (
    <div
      className="relative overflow-hidden rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700"
      style={{
        background:
          'linear-gradient(135deg, #fdfdfb 0%, #f0fdfa 55%, #fff7ed 100%)',
      }}
    >
      {/* Same dot + blob ambient as the dashboard WelcomeCard. */}
      <svg
        className="absolute inset-0 w-full h-full opacity-25 pointer-events-none"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <defs>
          <pattern id="catalog-stats-dots" x="0" y="0" width="22" height="22" patternUnits="userSpaceOnUse">
            <circle cx="2" cy="2" r="1.2" fill="#94a3b8" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#catalog-stats-dots)" />
      </svg>
      <div
        className="absolute -top-10 -right-12 w-44 h-44 rounded-full opacity-40"
        style={{ background: 'radial-gradient(circle at center, #ccfbf1 0%, transparent 65%)' }}
        aria-hidden="true"
      />
      <div
        className="absolute -bottom-12 -left-12 w-36 h-36 rounded-full opacity-40"
        style={{ background: 'radial-gradient(circle at center, #fef3c7 0%, transparent 65%)' }}
        aria-hidden="true"
      />

      <div className="relative flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-3 sm:p-4 min-h-[72px]">
        {/* Left: Courses + Students */}
        <div className="flex flex-wrap items-stretch gap-2">
          {tiles.map(({ icon: Icon, value, label }) => (
            <div
              key={label}
              className="inline-flex items-center gap-2.5 h-[44px] rounded-xl px-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700"
            >
              <div
                className="flex items-center justify-center w-7 h-7 rounded-lg shrink-0"
                style={{ backgroundColor: 'rgba(8,143,143,0.14)', color: '#088F8F' }}
              >
                <Icon className="w-3.5 h-3.5" strokeWidth={2.25} />
              </div>
              <div className="min-w-0 leading-tight">
                {loading ? (
                  <>
                    <Skeleton className="h-5 w-12 mb-1" />
                    <Skeleton className="h-3 w-20" />
                  </>
                ) : (
                  <>
                    <div
                      className="text-lg font-bold leading-tight tabular-nums"
                      style={{ color: '#0f172a' }}
                    >
                      {formatCount(value)}
                    </div>
                    <div
                      className="text-[11px] font-medium truncate"
                      style={{ color: '#64748b' }}
                    >
                      {label}
                    </div>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Right: Create Course */}
        {createLabel && (
          <Link
            to="/teach/create"
            className="inline-flex items-center gap-2 h-10 px-4 rounded-lg text-sm font-semibold shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md self-start sm:self-auto"
            style={{ backgroundColor: '#088F8F', color: '#ffffff' }}
          >
            <Plus className="w-4 h-4" strokeWidth={2.5} />
            {createLabel}
          </Link>
        )}
      </div>
    </div>
  );
};
