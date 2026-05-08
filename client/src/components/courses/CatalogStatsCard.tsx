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
      className="relative overflow-hidden rounded-2xl text-white shadow-md"
      style={{
        background: 'linear-gradient(135deg, #0e7490 0%, #0d9488 35%, #6366f1 100%)',
      }}
    >
      <svg
        className="absolute inset-0 w-full h-full opacity-15 pointer-events-none"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <defs>
          <pattern id="catalog-stats-dots" x="0" y="0" width="22" height="22" patternUnits="userSpaceOnUse">
            <circle cx="2" cy="2" r="1.4" fill="white" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#catalog-stats-dots)" />
      </svg>

      <div
        className="absolute -top-12 -right-16 w-56 h-56 rounded-full opacity-25"
        style={{ background: 'radial-gradient(circle at center, #ffffff 0%, transparent 65%)' }}
        aria-hidden="true"
      />
      <div
        className="absolute -bottom-20 -left-16 w-48 h-48 rounded-full opacity-20"
        style={{ background: 'radial-gradient(circle at center, #fde68a 0%, transparent 65%)' }}
        aria-hidden="true"
      />

      <div className="relative grid grid-cols-1 sm:grid-cols-5 gap-3 p-4 sm:p-5 items-center min-h-[170px]">
        <div className="sm:col-span-2 flex items-center justify-center sm:justify-start sm:-ml-2 lg:-ml-3">
          <img
            src="/illustrations/course-teach.png"
            alt=""
            aria-hidden="true"
            draggable={false}
            className="w-full max-w-[200px] sm:max-w-[240px] lg:max-w-[280px] h-auto select-none pointer-events-none drop-shadow-xl"
          />
        </div>

        <div className="sm:col-span-3 sm:pl-1 flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-2 sm:gap-3">
            {tiles.map(({ icon: Icon, value, label }) => (
              <div
                key={label}
                className="flex items-center gap-2.5 h-[60px] rounded-xl px-3 backdrop-blur-sm"
                style={{ backgroundColor: 'rgba(255,255,255,0.14)' }}
              >
                <div
                  className="flex items-center justify-center w-9 h-9 rounded-lg shrink-0 shadow-sm"
                  style={{ backgroundColor: '#ffffff', color: '#0d9488' }}
                >
                  <Icon className="w-4 h-4" strokeWidth={2.25} />
                </div>
                <div className="min-w-0 leading-tight">
                  {loading ? (
                    <>
                      <Skeleton className="h-5 w-12 mb-1" />
                      <Skeleton className="h-3 w-20" />
                    </>
                  ) : (
                    <>
                      <div className="text-lg sm:text-xl font-bold leading-tight tabular-nums">
                        {formatCount(value)}
                      </div>
                      <div className="text-[10px] sm:text-[11px] font-medium text-white/80 truncate">
                        {label}
                      </div>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>

          {createLabel && (
            <div>
              <Link
                to="/teach/create"
                className="inline-flex items-center gap-2 h-10 px-3.5 rounded-lg text-sm font-semibold shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
                style={{ backgroundColor: '#ffffff', color: '#0e7490' }}
              >
                <Plus className="w-4 h-4" strokeWidth={2.5} />
                {createLabel}
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
