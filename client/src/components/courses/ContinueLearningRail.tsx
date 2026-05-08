import { Link } from 'react-router-dom';
import { GraduationCap } from 'lucide-react';
import { useTheme } from '../../hooks/useTheme';
import { resolveFileUrl } from '../../api/client';
import type { ContinueLearningItem } from '../../api/me';

interface ContinueLearningRailProps {
  items: ContinueLearningItem[];
  /** "X% Complete" template — caller provides via i18n. */
  percentLabel: (percent: number) => string;
}

export const ContinueLearningRail = ({ items, percentLabel }: ContinueLearningRailProps) => {
  const { isDark } = useTheme();

  if (items.length === 0) return null;

  return (
    <div className="-mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8">
      <div className="flex gap-4 overflow-x-auto pb-3 snap-x snap-mandatory scroll-smooth">
        {items.map(item => {
          const pct = Math.round(item.progress);
          return (
            <Link
              key={item.courseId}
              to={`/courses/${item.courseSlug}`}
              className="snap-start shrink-0 w-64 sm:w-72 rounded-2xl border overflow-hidden transition-all hover:-translate-y-0.5 hover:shadow-md"
              style={{
                backgroundColor: isDark ? '#1f2937' : '#ffffff',
                borderColor: isDark ? '#374151' : '#f3f4f6',
              }}
            >
              <div
                className="aspect-[16/9] flex items-center justify-center relative"
                style={{
                  backgroundImage: 'linear-gradient(135deg, #088F8F 0%, #14b8a6 100%)',
                }}
              >
                {item.courseThumbnail ? (
                  <img
                    src={resolveFileUrl(item.courseThumbnail) || item.courseThumbnail}
                    alt={item.courseTitle}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <GraduationCap className="w-10 h-10 text-white/80" />
                )}
              </div>
              <div className="p-4">
                <h3
                  className="text-sm font-semibold mb-3 line-clamp-2 min-h-[2.5rem]"
                  style={{ color: isDark ? '#f3f4f6' : '#111827' }}
                >
                  {item.courseTitle}
                </h3>
                <div className="flex items-center justify-between mb-1.5 text-xs">
                  <span style={{ color: isDark ? '#9ca3af' : '#6b7280' }}>
                    {percentLabel(pct)}
                  </span>
                  <span
                    className="font-semibold tabular-nums"
                    style={{ color: isDark ? '#22d3d3' : '#077575' }}
                  >
                    {pct}%
                  </span>
                </div>
                <div
                  className="w-full h-1.5 rounded-full overflow-hidden"
                  style={{ backgroundColor: isDark ? '#374151' : '#e5e7eb' }}
                >
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${pct}%`,
                      backgroundImage: 'linear-gradient(90deg, #088F8F 0%, #14b8a6 100%)',
                    }}
                  />
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
};
