import { Link } from 'react-router-dom';
import { GraduationCap, Users, Settings } from 'lucide-react';
import { useTheme } from '../../hooks/useTheme';
import { resolveFileUrl } from '../../api/client';
import { Avatar } from '../dashboard/Avatar';
import type { Course } from '../../types';

interface CourseCardV2Props {
  course: Course;
  /** When non-null, render a progress bar at the bottom (caller is enrolled). */
  progress: number | null;
  /** When true, overlay a "Manage" link (top-right of thumbnail). */
  canManage: boolean;
  /** Translated UI strings — caller passes from `useTranslation`. */
  studentsLabel: (count: number) => string;
  progressLabel: string;
  manageLabel: string;
}

export const CourseCardV2 = ({
  course,
  progress,
  canManage,
  studentsLabel,
  progressLabel,
  manageLabel,
}: CourseCardV2Props) => {
  const { isDark } = useTheme();

  const enrolled = progress !== null;
  const pct = enrolled ? Math.max(0, Math.min(100, Math.round(progress!))) : 0;
  const description = (course.description ?? '').replace(/<[^>]*>/g, '').trim();
  const studentCount = course._count?.enrollments ?? 0;
  const instructorName = course.instructor?.fullname ?? '';
  const instructorAvatar = course.instructor?.avatarUrl
    ? resolveFileUrl(course.instructor.avatarUrl)
    : null;
  const thumbnail = course.thumbnail
    ? resolveFileUrl(course.thumbnail) || course.thumbnail
    : null;

  return (
    <div
      className="group relative h-full rounded-2xl border overflow-hidden transition-all hover:-translate-y-0.5 hover:shadow-md"
      style={{
        backgroundColor: isDark ? '#1f2937' : '#ffffff',
        borderColor: isDark ? '#374151' : '#f3f4f6',
      }}
    >
      <Link to={`/courses/${course.id}`} className="block">
        <div
          className="aspect-[16/9] flex items-center justify-center relative"
          style={{
            backgroundImage: 'linear-gradient(135deg, #088F8F 0%, #14b8a6 100%)',
          }}
        >
          {thumbnail ? (
            <img
              src={thumbnail}
              alt={course.title}
              className="w-full h-full object-cover"
            />
          ) : (
            <GraduationCap className="w-12 h-12 text-white/80" />
          )}
        </div>
      </Link>

      {canManage && (
        <Link
          to={`/teach/courses/${course.id}/curriculum`}
          className="absolute top-3 right-3 inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs font-medium shadow-sm transition-colors backdrop-blur"
          style={{
            backgroundColor: isDark ? 'rgba(31,41,55,0.9)' : 'rgba(255,255,255,0.92)',
            color: isDark ? '#f3f4f6' : '#054a4a',
          }}
        >
          <Settings className="w-3.5 h-3.5" />
          {manageLabel}
        </Link>
      )}

      <Link to={`/courses/${course.id}`} className="block p-5">
        {course.categories && course.categories.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-3">
            {course.categories.slice(0, 3).map(cc => (
              <span
                key={cc.category.id}
                className="text-[11px] font-medium px-2.5 py-1 rounded-full"
                style={{
                  backgroundColor: isDark ? 'rgba(8,143,143,0.18)' : '#ccfbfb',
                  color: isDark ? '#22d3d3' : '#065c5c',
                }}
              >
                {cc.category.title}
              </span>
            ))}
          </div>
        )}

        <h3
          className="font-semibold text-base sm:text-lg mb-2 line-clamp-2 leading-snug"
          style={{ color: isDark ? '#f3f4f6' : '#111827' }}
        >
          {course.title}
        </h3>

        {description && (
          <p
            className="text-sm mb-4 line-clamp-3 leading-relaxed"
            style={{ color: isDark ? '#9ca3af' : '#6b7280' }}
          >
            {description}
          </p>
        )}

        <div
          className="border-t pt-3 mt-auto flex items-center justify-between gap-3"
          style={{ borderColor: isDark ? '#374151' : '#f3f4f6' }}
        >
          <div className="flex items-center gap-2 min-w-0">
            <Avatar src={instructorAvatar} name={instructorName || '?'} size="sm" />
            <span
              className="text-sm font-medium truncate"
              style={{ color: isDark ? '#e5e7eb' : '#374151' }}
            >
              {instructorName}
            </span>
          </div>

          {!enrolled && (
            <div
              className="flex items-center gap-1.5 text-sm shrink-0"
              style={{ color: isDark ? '#9ca3af' : '#6b7280' }}
            >
              <Users className="w-4 h-4" />
              <span className="tabular-nums">{studentsLabel(studentCount)}</span>
            </div>
          )}
        </div>

        {enrolled && (
          <div className="mt-3">
            <div className="flex items-center justify-between mb-1.5 text-xs">
              <span style={{ color: isDark ? '#9ca3af' : '#6b7280' }}>{progressLabel}</span>
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
        )}
      </Link>
    </div>
  );
};
