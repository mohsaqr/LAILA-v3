import { useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Calendar, Compass } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useTheme } from '../../hooks/useTheme';
import { activityLogger } from '../../services/activityLogger';
import { Card, CardBody } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { Breadcrumb } from '../../components/common/Breadcrumb';
import { DueDateBadge, EmptyDashboard, Skeleton } from '../../components/dashboard';
import { WelcomeCard } from '../../components/dashboard/WelcomeCard';
import { MiniCalendar } from '../../components/dashboard/MiniCalendar';
import { ContinueLearningRail } from '../../components/courses/ContinueLearningRail';
import { meApi } from '../../api/me';
import { assignmentsApi } from '../../api/assignments';

interface UpcomingItem {
  assignmentId: number;
  title: string;
  courseId: number;
  courseTitle: string;
  dueDate: string;
}

/**
 * Student dashboard. Three blocks stacked top-to-bottom:
 *   1. Welcome card + month-grid mini calendar (5-col split).
 *   2. Upcoming tasks and assignments — next 7 days, due-asc.
 *   3. Courses-in-progress rail (`progress < 100 %`).
 */
export const StudentDashboard = () => {
  const { t } = useTranslation(['courses', 'common', 'navigation']);
  const { user } = useAuth();
  const { isDark } = useTheme();
  const navigate = useNavigate();

  useEffect(() => {
    activityLogger.logDashboardViewed();
  }, []);

  const { data: continueLearning, isLoading: clLoading } = useQuery({
    queryKey: ['me', 'continue-learning'],
    queryFn: () => meApi.getContinueLearning(),
    enabled: !!user,
  });

  // Same query the standalone calendar page runs — courses + their
  // assignments with due dates.
  const { data: gradebook, isLoading: gbLoading } = useQuery({
    queryKey: ['myGradebook'],
    queryFn: assignmentsApi.getMyGradebook,
    enabled: !!user,
  });

  // Flatten gradebook → assignments with a due date, course context
  // attached so we can render `course · assignment` rows.
  const allAssignments = useMemo<UpcomingItem[]>(() => {
    return (gradebook ?? []).flatMap((c: any) =>
      (c.assignments ?? [])
        .filter((a: any) => !!a.dueDate)
        .map((a: any) => ({
          assignmentId: a.id,
          title: a.title,
          courseId: a.courseId ?? c.courseId,
          courseTitle: c.courseTitle,
          dueDate: a.dueDate as string,
        })),
    );
  }, [gradebook]);

  // Mini-calendar markers: ISO date → due-item count.
  const itemsByDate = useMemo(() => {
    const m = new Map<string, number>();
    for (const a of allAssignments) {
      const iso = a.dueDate.slice(0, 10);
      m.set(iso, (m.get(iso) ?? 0) + 1);
    }
    return m;
  }, [allAssignments]);

  // Upcoming = next 7 days (and a 1-day backstop for today's items),
  // due-date ascending, capped at 6 rows.
  const upcoming = useMemo(() => {
    const now = Date.now();
    const cutoff = now + 7 * 86_400_000;
    return allAssignments
      .filter(a => {
        const t = new Date(a.dueDate).getTime();
        return t >= now - 86_400_000 && t <= cutoff;
      })
      .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())
      .slice(0, 6);
  }, [allAssignments]);

  // Rail = enrollments still in progress. Completed courses (100 %)
  // surface on cards / catalog but not in the "in progress" rail.
  const railItems = useMemo(
    () => (continueLearning ?? []).filter(c => c.progress < 100),
    [continueLearning],
  );

  const colors = {
    bg: isDark ? '#111827' : '#f9fafb',
    cardBg: isDark ? '#1f2937' : '#ffffff',
    cardBorder: isDark ? '#374151' : '#e5e7eb',
    text: isDark ? '#f3f4f6' : '#111827',
    muted: isDark ? '#9ca3af' : '#6b7280',
  };

  return (
    <div className="min-h-screen" style={{ backgroundColor: colors.bg }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 md:py-8">
        <div className="mb-4">
          <Breadcrumb items={[{ label: t('common:dashboard', { defaultValue: 'Dashboard' }) }]} />
        </div>

        {/* Welcome + calendar */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 md:gap-5 mb-8">
          <div className="lg:col-span-3">
            <WelcomeCard
              name={user?.fullname}
              illustration="/illustrations/welcome-student.png"
              message={t('common:welcome_message_student', {
                defaultValue:
                  "Pick up where you left off and stay on top of what's due this week.",
              })}
            />
          </div>
          <div className="lg:col-span-2">
            <MiniCalendar
              itemsByDate={itemsByDate}
              onDateClick={() => navigate('/dashboard/calendar')}
              fullCalendarHref="/dashboard/calendar"
            />
          </div>
        </div>

        {/* Upcoming */}
        <section className="mb-8">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-semibold" style={{ color: colors.text }}>
              {t('common:upcoming', { defaultValue: 'Upcoming' })}
            </h2>
            <Link
              to="/dashboard/calendar"
              className="text-xs font-medium hover:underline"
              style={{ color: '#0d9488' }}
            >
              {t('common:view_full_calendar', { defaultValue: 'View full calendar' })}
            </Link>
          </div>
          <Card>
            <CardBody className="p-0">
              {gbLoading ? (
                <div className="p-5 space-y-3">
                  {[0, 1, 2].map(i => (
                    <Skeleton key={i} className="h-10" />
                  ))}
                </div>
              ) : upcoming.length === 0 ? (
                <EmptyDashboard
                  icon={Calendar}
                  title={t('common:all_caught_up', { defaultValue: "You're all caught up" })}
                  description={t('common:no_upcoming_deadlines', { defaultValue: 'No upcoming deadlines.' })}
                />
              ) : (
                <ul className="divide-y" style={{ borderColor: colors.cardBorder }}>
                  {upcoming.map(u => (
                    <li key={u.assignmentId}>
                      <Link
                        to={`/courses/${u.courseId}/assignments/${u.assignmentId}`}
                        className="flex items-center justify-between gap-3 px-5 py-3 hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium truncate" style={{ color: colors.text }}>
                            {u.title}
                          </p>
                          <p className="text-xs truncate" style={{ color: colors.muted }}>
                            {u.courseTitle}
                          </p>
                        </div>
                        <DueDateBadge date={u.dueDate} />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>
        </section>

        {/* Courses in progress */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-semibold" style={{ color: colors.text }}>
              {t('common:courses_in_progress', { defaultValue: 'Courses in progress' })}
            </h2>
            <Link
              to="/courses"
              className="text-xs font-medium hover:underline"
              style={{ color: '#0d9488' }}
            >
              {t('common:view_all', { defaultValue: 'View all' })}
            </Link>
          </div>
          {clLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {[0, 1, 2, 3].map(i => (
                <Skeleton key={i} className="h-44" rounded="lg" />
              ))}
            </div>
          ) : railItems.length === 0 ? (
            <Card>
              <CardBody>
                <EmptyDashboard
                  icon={Compass}
                  title={t('common:nothing_in_progress', { defaultValue: 'Nothing in progress yet' })}
                  description={t('common:browse_to_get_started', { defaultValue: 'Browse the catalog to start learning.' })}
                  action={
                    <Link to="/courses">
                      <Button size="sm">{t('explore_courses')}</Button>
                    </Link>
                  }
                />
              </CardBody>
            </Card>
          ) : (
            <ContinueLearningRail
              items={railItems}
              percentLabel={pct =>
                t('courses:percent_complete', {
                  defaultValue: '{{percent}}% Complete',
                  percent: pct,
                })
              }
            />
          )}
        </section>
      </div>
    </div>
  );
};
