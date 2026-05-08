import { Link } from 'react-router-dom';
import { GraduationCap, Users, Plus } from 'lucide-react';
import { Skeleton } from '../dashboard/Skeleton';

interface CatalogStatsCardProps {
  totalCourses: number;
  totalStudents: number;
  totalCoursesLabel: string;
  totalStudentsLabel: string;
  /** Header title above the stats. */
  title: string;
  /** Subtitle / description under the title. */
  subtitle: string;
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
  title,
  subtitle,
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

      <div className="relative grid grid-cols-1 sm:grid-cols-5 gap-4 sm:gap-4 p-5 sm:p-6 items-center min-h-[220px]">
        <div className="sm:col-span-2 flex items-center justify-center sm:justify-start sm:-ml-2 lg:-ml-4">
          <img
            src="/illustrations/course-teach.png"
            alt=""
            aria-hidden="true"
            draggable={false}
            className="w-full max-w-[260px] sm:max-w-[300px] lg:max-w-[360px] h-auto select-none pointer-events-none drop-shadow-xl"
          />
        </div>

        <div className="sm:col-span-3 sm:pl-2 flex flex-col gap-4">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold leading-tight mb-1.5">{title}</h2>
            <p className="text-white/80 text-sm leading-relaxed max-w-md">{subtitle}</p>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:gap-4">
            {tiles.map(({ icon: Icon, value, label }) => (
              <div
                key={label}
                className="flex items-center gap-3 rounded-xl px-3.5 py-3 backdrop-blur-sm"
                style={{ backgroundColor: 'rgba(255,255,255,0.14)' }}
              >
                <div
                  className="flex items-center justify-center w-11 h-11 rounded-xl shrink-0 shadow-sm"
                  style={{ backgroundColor: '#ffffff', color: '#0d9488' }}
                >
                  <Icon className="w-5 h-5" strokeWidth={2.25} />
                </div>
                <div className="min-w-0">
                  {loading ? (
                    <>
                      <Skeleton className="h-6 w-16 mb-1" />
                      <Skeleton className="h-3 w-24" />
                    </>
                  ) : (
                    <>
                      <div className="text-xl sm:text-2xl font-bold leading-tight tabular-nums">
                        {formatCount(value)}
                      </div>
                      <div className="text-[11px] sm:text-xs font-medium text-white/80 truncate">
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
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
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
