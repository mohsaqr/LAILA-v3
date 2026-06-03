import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../hooks/useTheme';
import type { Assignment } from '../../types';

interface CourseUpcomingAssignmentsProps {
  courseId: number;
  assignments: Assignment[];
  /** How many rows to show before truncating. Defaults to 5. */
  limit?: number;
}

const MS_PER_DAY = 86_400_000;

/**
 * Sidebar list of upcoming assignments for a single course. Each row
 * uses the requested layout: assignment title and big "DD Mon" due date
 * on the left, and a two-tone "Days left" pill (dark slate top, amber
 * bottom with the number) on the right. Grace-period deadline appears
 * as a sub-line when present.
 */
export const CourseUpcomingAssignments = ({
  courseId,
  assignments,
  limit = 5,
}: CourseUpcomingAssignmentsProps) => {
  const { t } = useTranslation(['courses', 'common']);
  const { isDark } = useTheme();

  const rows = useMemo(() => {
    const now = Date.now();
    return assignments
      .filter(a => a.isPublished && a.dueDate)
      .map(a => {
        const due = new Date(a.dueDate!);
        const daysLeft = Math.ceil((due.getTime() - now) / MS_PER_DAY);
        return { a, due, daysLeft };
      })
      .filter(r => r.daysLeft >= 0)
      .sort((x, y) => x.due.getTime() - y.due.getTime())
      .slice(0, limit);
  }, [assignments, limit]);

  if (rows.length === 0) return null;

  const cardBg = isDark ? '#1f2937' : '#ffffff';
  const cardBorder = isDark ? '#374151' : '#e5e7eb';
  const titleColor = isDark ? '#f3f4f6' : '#111827';
  const labelColor = isDark ? '#9ca3af' : '#6b7280';
  const subtleColor = isDark ? '#cbd5e1' : '#475569';

  return (
    <div className="space-y-3">
      <h3
        className="text-xs font-semibold uppercase tracking-wider"
        style={{ color: labelColor }}
      >
        {t('courses:upcoming_assignments', { defaultValue: 'Upcoming assignments' })}
      </h3>

      <div className="space-y-2">
        {rows.map(({ a, due, daysLeft }) => {
          const day = due.getDate();
          const month = due.toLocaleDateString(undefined, { month: 'short' });
          const exactDeadline = due.toLocaleString(undefined, {
            dateStyle: 'medium',
            timeStyle: 'short',
          });
          const grace = a.gracePeriodDeadline ? new Date(a.gracePeriodDeadline) : null;
          const graceLabel = grace
            ? grace.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
            : null;
          const urgent = daysLeft <= 2;

          return (
            <Link
              key={a.id}
              to={
                a.submissionType === 'ai_agent'
                  ? `/courses/${courseId}/agent-assignments/${a.id}`
                  : `/courses/${courseId}/assignments/${a.id}`
              }
              className="block rounded-xl border p-2.5 transition-shadow hover:shadow-md"
              style={{ backgroundColor: cardBg, borderColor: cardBorder }}
            >
              <div className="flex items-start gap-2.5">
                {/* Left: title + date + grace */}
                <div className="flex-1 min-w-0 flex flex-col justify-between">
                  <div
                    className="text-[11px] font-medium truncate"
                    style={{ color: labelColor }}
                    title={a.title}
                  >
                    {a.title}
                  </div>
                  <div className="mt-1 flex items-baseline gap-1">
                    <span
                      className="text-xl font-bold leading-none tabular-nums"
                      style={{ color: titleColor }}
                    >
                      {day}
                    </span>
                    <span
                      className="text-xs font-medium"
                      style={{ color: subtleColor }}
                    >
                      {month}
                    </span>
                  </div>
                  <div
                    className="mt-1 text-[10px] leading-snug"
                    style={{ color: labelColor }}
                  >
                    {exactDeadline}
                    {graceLabel && (
                      <>
                        <br />
                        <span>
                          {t('courses:grace_short', { defaultValue: 'Grace' })}: {graceLabel}
                        </span>
                      </>
                    )}
                  </div>
                </div>

                {/* Right: two-tone Days-left pill — fixed footprint so
                    it stays the same size regardless of the left-side
                    content height. */}
                <div
                  className="flex-shrink-0 w-14 h-14 rounded-lg overflow-hidden flex flex-col"
                  style={{ backgroundColor: '#0f172a' }}
                  aria-label={t('courses:days_left', {
                    defaultValue: '{{count}} days left',
                    count: daysLeft,
                  })}
                >
                  <div className="h-5 flex items-center justify-center">
                    <span className="text-[9px] font-medium text-white/95 leading-none">
                      {t('courses:days_left_label', { defaultValue: 'Days left' })}
                    </span>
                  </div>
                  <div
                    className="h-9 flex items-center justify-center rounded-lg"
                    style={{
                      backgroundColor: urgent ? '#fca5a5' : '#fbbf24',
                      color: '#0f172a',
                    }}
                  >
                    <span className="text-base font-bold tabular-nums leading-none">
                      {String(daysLeft).padStart(2, '0')}
                    </span>
                  </div>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
};
