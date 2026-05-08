import { useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ChevronRight, Compass, FileText } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useTheme } from '../../hooks/useTheme';
import { activityLogger } from '../../services/activityLogger';
import { Card, CardBody } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { Breadcrumb } from '../../components/common/Breadcrumb';
import { EmptyDashboard, Skeleton } from '../../components/dashboard';
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

/** Fixed palette for the upcoming-list icon chips. Cycles by index. */
const UPCOMING_TINTS = [
  { bg: '#fee2e2', fg: '#dc2626' }, // rose
  { bg: '#fef3c7', fg: '#d97706' }, // amber
  { bg: '#e0f2fe', fg: '#0284c7' }, // sky
  { bg: '#ede9fe', fg: '#7c3aed' }, // violet
  { bg: '#dcfce7', fg: '#16a34a' }, // emerald
];

/**
 * Student dashboard. Two blocks:
 *   1. WelcomeCard (3 cols, intrinsic height) + a right column (2 cols)
 *      stacking the MiniCalendar and an Upcoming list under it.
 *   2. Courses-in-progress rail (`progress < 100 %`).
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

  const { data: gradebook } = useQuery({
    queryKey: ['myGradebook'],
    queryFn: assignmentsApi.getMyGradebook,
    enabled: !!user,
  });

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

  const itemsByDate = useMemo(() => {
    const m = new Map<string, number>();
    for (const a of allAssignments) {
      const iso = a.dueDate.slice(0, 10);
      m.set(iso, (m.get(iso) ?? 0) + 1);
    }
    return m;
  }, [allAssignments]);

  // Upcoming = next 7 days (with a 1-day backstop for items whose
  // local-time conversion lands just before `now`), sorted earliest
  // first, capped at 6 rows so the sidebar stays compact.
  const upcoming = useMemo(() => {
    const now = Date.now();
    const cutoff = now + 7 * 86_400_000;
    return allAssignments
      .filter(a => {
        const ts = new Date(a.dueDate).getTime();
        return ts >= now - 86_400_000 && ts <= cutoff;
      })
      .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())
      .slice(0, 6);
  }, [allAssignments]);

  // Group upcoming items into "Today" (today's due-date) vs "This
  // week" (next 7 days but not today).
  const groupedUpcoming = useMemo(() => {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const startOfTomorrow = new Date(startOfToday.getTime() + 86_400_000);
    const today: UpcomingItem[] = [];
    const week: UpcomingItem[] = [];
    for (const it of upcoming) {
      const due = new Date(it.dueDate);
      if (due >= startOfToday && due < startOfTomorrow) today.push(it);
      else if (due >= startOfTomorrow) week.push(it);
    }
    return { today, week };
  }, [upcoming]);

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
    subtle: isDark ? '#6b7280' : '#9ca3af',
  };

  return (
    <div className="min-h-screen" style={{ backgroundColor: colors.bg }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 md:py-8">
        <div className="mb-4">
          <Breadcrumb items={[{ label: t('common:dashboard', { defaultValue: 'Dashboard' }) }]} />
        </div>

        {/* Welcome (left, fixed height) + calendar / upcoming stacked
            (right). `items-start` so the welcome card keeps its
            intrinsic ~220px height while the right column extends
            further down with the upcoming list. */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 md:gap-5 mb-8 items-start">
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
          <div className="lg:col-span-2 space-y-4">
            <MiniCalendar
              itemsByDate={itemsByDate}
              onDateClick={() => navigate('/dashboard/calendar')}
              fullCalendarHref="/dashboard/calendar"
            />

            {upcoming.length > 0 && (
              <div
                className="rounded-2xl border"
                style={{ backgroundColor: colors.cardBg, borderColor: colors.cardBorder }}
              >
                <div className="flex items-center justify-between px-4 pt-4 pb-2">
                  <h3 className="text-sm font-semibold" style={{ color: colors.text }}>
                    {t('common:upcoming', { defaultValue: 'Upcoming' })}
                  </h3>
                  <Link
                    to="/dashboard/calendar"
                    className="text-xs font-medium hover:underline"
                    style={{ color: '#0d9488' }}
                  >
                    {t('common:view_all', { defaultValue: 'View all' })}
                  </Link>
                </div>

                <div className="px-2 pb-3 space-y-2">
                  {groupedUpcoming.today.length > 0 && (
                    <UpcomingGroup
                      label={t('common:today', { defaultValue: 'Today' })}
                      items={groupedUpcoming.today}
                      indexOffset={0}
                      muted={colors.subtle}
                      titleColor={colors.text}
                      subtitleColor={colors.muted}
                    />
                  )}
                  {groupedUpcoming.week.length > 0 && (
                    <UpcomingGroup
                      label={t('common:this_week', { defaultValue: 'This week' })}
                      items={groupedUpcoming.week}
                      indexOffset={groupedUpcoming.today.length}
                      muted={colors.subtle}
                      titleColor={colors.text}
                      subtitleColor={colors.muted}
                    />
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

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

/* ---------- Inline upcoming list ---------- */

interface UpcomingGroupProps {
  label: string;
  items: UpcomingItem[];
  /** Offset so the icon-tint cycle continues across groups. */
  indexOffset: number;
  muted: string;
  titleColor: string;
  subtitleColor: string;
}

const UpcomingGroup = ({
  label,
  items,
  indexOffset,
  muted,
  titleColor,
  subtitleColor,
}: UpcomingGroupProps) => (
  <div>
    <p
      className="text-[10px] font-semibold uppercase tracking-wider px-2 mb-1"
      style={{ color: muted }}
    >
      {label}
    </p>
    <ul className="space-y-1">
      {items.map((u, i) => {
        const tint = UPCOMING_TINTS[(indexOffset + i) % UPCOMING_TINTS.length];
        return (
          <li key={u.assignmentId}>
            <Link
              to={`/courses/${u.courseId}/assignments/${u.assignmentId}`}
              className="flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
            >
              <div
                className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{ backgroundColor: tint.bg, color: tint.fg }}
              >
                <FileText className="w-4 h-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p
                  className="text-sm font-medium truncate"
                  style={{ color: titleColor }}
                >
                  {u.title}
                </p>
                <p
                  className="text-xs truncate"
                  style={{ color: subtitleColor }}
                >
                  {u.courseTitle}
                </p>
              </div>
              <ChevronRight className="w-4 h-4 flex-shrink-0" style={{ color: muted }} />
            </Link>
          </li>
        );
      })}
    </ul>
  </div>
);
