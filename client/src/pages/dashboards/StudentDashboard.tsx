import { useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Award, BookOpen, Calendar, Clock, Compass, FileText, GraduationCap, MessageCircle, PlayCircle, Sparkles, TrendingUp } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useTheme } from '../../hooks/useTheme';
import { activityLogger } from '../../services/activityLogger';
import { Card, CardBody } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { Breadcrumb } from '../../components/common/Breadcrumb';
import {
  DashboardGreeting,
  DashboardSection,
  DueDateBadge,
  EmptyDashboard,
  ProgressRing,
  Skeleton,
  TrendChip,
  relativeTime,
} from '../../components/dashboard';
import { meApi } from '../../api/me';
import { enrollmentsApi } from '../../api/enrollments';
import { activityLogApi } from '../../api/admin';
import { resolveFileUrl } from '../../api/client';
import { Enrollment } from '../../types';

const fmtRelative = (iso?: string | null) => (iso ? relativeTime(iso) : '');

/**
 * Student dashboard. Surfaces "what should I do next" before "what
 * have I done": Continue Learning + Up Next deadlines up top, then
 * course progress grid, then recent activity timeline.
 */
export const StudentDashboard = () => {
  const { t } = useTranslation(['courses', 'common', 'navigation']);
  const { user } = useAuth();
  const { isDark } = useTheme();

  useEffect(() => {
    activityLogger.logDashboardViewed();
  }, []);

  const { data: continueLearning, isLoading: clLoading } = useQuery({
    queryKey: ['me', 'continue-learning'],
    queryFn: () => meApi.getContinueLearning(),
    enabled: !!user,
  });

  const { data: enrollments, isLoading: enrLoading } = useQuery({
    queryKey: ['enrollments'],
    queryFn: () => enrollmentsApi.getMyEnrollments(),
    enabled: !!user,
  });

  const { data: activity } = useQuery({
    queryKey: ['me', 'activity', user?.id],
    queryFn: () => activityLogApi.getLogs({ userId: user!.id, limit: 8 }),
    enabled: !!user,
  });

  const { data: weeklyCounts } = useQuery({
    queryKey: ['me', 'weeklyCounts', user?.id],
    queryFn: () => {
      const end = new Date();
      const start = new Date(end.getTime() - 6 * 86_400_000);
      return activityLogApi.getDailyCounts({
        userId: user!.id,
        startDate: start.toISOString().slice(0, 10),
        endDate: end.toISOString().slice(0, 10),
      });
    },
    enabled: !!user,
  });

  const weeklyTotals = useMemo(() => {
    if (!weeklyCounts) return new Array(7).fill(0);
    const totals = new Array(weeklyCounts.days.length).fill(0);
    for (const verb of weeklyCounts.verbs) {
      const series = weeklyCounts.series[verb] ?? [];
      series.forEach((v: number, i: number) => (totals[i] = (totals[i] ?? 0) + v));
    }
    return totals;
  }, [weeklyCounts]);

  // Pull all assignments across active enrollments and find what's due soon.
  // Single batched query per course; React Query caches each independently.
  const activeEnrollments = useMemo(
    () => (enrollments ?? []).filter(e => e.status === 'active' && e.course),
    [enrollments]
  );

  const upcoming = useMemo(() => {
    const items: { courseId: number; courseTitle: string; assignmentId: number; title: string; dueDate: string }[] = [];
    for (const e of activeEnrollments) {
      const assignments = (e.course as any)?.assignments as { id: number; title: string; dueDate?: string | null; isPublished?: boolean }[] | undefined;
      if (!assignments) continue;
      for (const a of assignments) {
        if (!a.dueDate || a.isPublished === false) continue;
        items.push({
          courseId: e.courseId,
          courseTitle: e.course!.title,
          assignmentId: a.id,
          title: a.title,
          dueDate: a.dueDate,
        });
      }
    }
    return items
      .filter(i => new Date(i.dueDate).getTime() >= Date.now() - 86_400_000)
      .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())
      .slice(0, 5);
  }, [activeEnrollments]);

  const greetingLine = useMemo(() => {
    const dueWeek = upcoming.filter(u => new Date(u.dueDate).getTime() - Date.now() <= 7 * 86_400_000).length;
    if (dueWeek > 0) {
      return t('common:you_have_x_deadlines_this_week', {
        defaultValue: 'You have {{count}} deadline{{plural}} this week.',
        count: dueWeek,
        plural: dueWeek === 1 ? '' : 's',
      });
    }
    if (activeEnrollments.length === 0) {
      return t('common:browse_to_get_started', { defaultValue: 'Browse the catalog to start learning.' });
    }
    return t('common:keep_the_streak_going', { defaultValue: 'Keep the streak going.' });
  }, [t, upcoming, activeEnrollments]);

  const colors = {
    bg: isDark ? '#111827' : '#f9fafb',
    text: isDark ? '#f3f4f6' : '#111827',
    muted: isDark ? '#9ca3af' : '#6b7280',
    subtle: isDark ? '#6b7280' : '#9ca3af',
    border: isDark ? '#374151' : '#e5e7eb',
  };

  const lastViewedByCourse = useMemo(() => {
    const m = new Map<number, string>();
    (continueLearning ?? []).forEach(item => m.set(item.courseId, item.lastViewedAt));
    return m;
  }, [continueLearning]);

  const sortedEnrollments = useMemo(() => {
    return [...activeEnrollments].sort((a, b) => {
      const al = lastViewedByCourse.get(a.courseId);
      const bl = lastViewedByCourse.get(b.courseId);
      if (!al && !bl) return 0;
      if (!al) return 1;
      if (!bl) return -1;
      return new Date(bl).getTime() - new Date(al).getTime();
    });
  }, [activeEnrollments, lastViewedByCourse]);

  const primary = continueLearning?.[0];

  const completedCount = useMemo(
    () => (enrollments ?? []).filter(e => e.status === 'completed').length,
    [enrollments]
  );
  const eventsThisWeek = useMemo(
    () => weeklyTotals.reduce((s, v) => s + v, 0),
    [weeklyTotals]
  );

  return (
    <div className="min-h-screen" style={{ backgroundColor: colors.bg }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 md:py-8">
        <div className="mb-4">
          <Breadcrumb items={[{ label: t('common:dashboard', { defaultValue: 'Dashboard' }) }]} />
        </div>

        <DashboardGreeting name={user?.fullname} line={greetingLine} />

        {/* KPI row */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-4 mb-8 md:mb-10">
          <TrendChip
            label={t('common:active_courses', { defaultValue: 'Active courses' })}
            value={activeEnrollments.length}
            color="#0ea5e9"
            accent
            icon={<BookOpen className="w-4 h-4" />}
          />
          <TrendChip
            label={t('common:completed', { defaultValue: 'Completed' })}
            value={completedCount}
            color="#10b981"
            accent
            icon={<Award className="w-4 h-4" />}
          />
          <TrendChip
            label={t('common:this_week', { defaultValue: 'This week' })}
            value={eventsThisWeek}
            trend={weeklyTotals}
            color="#a855f7"
            accent
            icon={<TrendingUp className="w-4 h-4" />}
          />
        </div>

        {/* Action row: Continue Learning (2/3) + Up Next (1/3) */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-5 mb-8 md:mb-10">
          <Card className="lg:col-span-2 overflow-hidden">
            <CardBody className="p-0">
              {clLoading ? (
                <ContinueSkeleton />
              ) : primary ? (
                <ContinueCard item={primary} />
              ) : (
                <EmptyDashboard
                  icon={Compass}
                  title={t('common:nothing_in_progress', { defaultValue: 'Nothing in progress yet' })}
                  description={t('common:browse_to_get_started', { defaultValue: 'Browse the catalog to start learning.' })}
                  action={
                    <Link to="/courses">
                      <Button size="sm" icon={<Sparkles className="w-4 h-4" />}>
                        {t('explore_courses')}
                      </Button>
                    </Link>
                  }
                />
              )}
            </CardBody>
          </Card>

          <Card>
            <CardBody className="p-5">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: colors.muted }}>
                  {t('common:up_next', { defaultValue: 'Up next' })}
                </span>
                {upcoming.length > 0 && (
                  <Link to="/courses" className="text-xs font-medium" style={{ color: '#0d9488' }}>
                    {t('common:view_all', { defaultValue: 'View all' })}
                  </Link>
                )}
              </div>
              {enrLoading ? (
                <UpNextSkeleton />
              ) : upcoming.length === 0 ? (
                <EmptyDashboard
                  icon={Calendar}
                  title={t('common:all_caught_up', { defaultValue: "You're all caught up" })}
                  description={t('common:no_upcoming_deadlines', { defaultValue: 'No upcoming deadlines.' })}
                />
              ) : (
                <ul className="space-y-3">
                  {upcoming.map(u => (
                    <li key={u.assignmentId} className="flex items-start justify-between gap-3">
                      <Link
                        to={`/courses/${u.courseId}/assignments/${u.assignmentId}`}
                        className="min-w-0 flex-1"
                      >
                        <p className="text-sm font-medium truncate" style={{ color: colors.text }}>
                          {u.title}
                        </p>
                        <p className="text-xs truncate" style={{ color: colors.muted }}>
                          {u.courseTitle}
                        </p>
                      </Link>
                      <DueDateBadge date={u.dueDate} />
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>
        </div>

        {/* My Courses */}
        <DashboardSection
          title={t('navigation:my_courses', { defaultValue: 'My courses' })}
          action={
            <Link to="/courses" className="text-sm font-medium" style={{ color: '#0d9488' }}>
              {t('common:view_all', { defaultValue: 'View all' })}
            </Link>
          }
        >
          {enrLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {[0, 1, 2].map(i => (
                <Skeleton key={i} className="h-36" rounded="lg" />
              ))}
            </div>
          ) : sortedEnrollments.length === 0 ? (
            <Card>
              <CardBody>
                <EmptyDashboard
                  icon={GraduationCap}
                  title={t('courses:no_enrollments', { defaultValue: 'No active enrollments' })}
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
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {sortedEnrollments.slice(0, 6).map(e => (
                <CourseTile key={e.id} enrollment={e} lastViewedAt={lastViewedByCourse.get(e.courseId)} />
              ))}
            </div>
          )}
        </DashboardSection>

        {/* Recent Activity */}
        <DashboardSection title={t('common:recent_activity', { defaultValue: 'Recent activity' })}>
          <Card>
            <CardBody className="p-0">
              {!activity ? (
                <div className="p-5 space-y-3">
                  {[0, 1, 2, 3].map(i => (
                    <Skeleton key={i} className="h-10" />
                  ))}
                </div>
              ) : activity.logs.length === 0 ? (
                <EmptyDashboard
                  icon={Clock}
                  title={t('common:no_activity_yet', { defaultValue: 'No activity yet' })}
                  description={t('common:activity_will_appear_here', { defaultValue: 'Your learning activity will appear here.' })}
                />
              ) : (
                <ul className="divide-y" style={{ borderColor: colors.border }}>
                  {activity.logs.slice(0, 8).map((log: any) => (
                    <li key={log.id} className="flex items-center gap-3 px-5 py-3">
                      <div
                        className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                        style={{ backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#f3f4f6' }}
                      >
                        <ActivityIcon verb={log.verb} objectType={log.objectType} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm truncate" style={{ color: colors.text }}>
                          <span className="font-medium">{verbLabel(log.verb)}</span>{' '}
                          <span style={{ color: colors.muted }}>{log.objectTitle ?? log.objectType}</span>
                        </p>
                        {log.courseTitle && (
                          <p className="text-xs truncate" style={{ color: colors.subtle }}>
                            {log.courseTitle}
                          </p>
                        )}
                      </div>
                      <span className="text-xs whitespace-nowrap" style={{ color: colors.subtle }}>
                        {fmtRelative(log.timestamp)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>
        </DashboardSection>
      </div>
    </div>
  );
};

/* ---------- Inline tile components ---------- */

function ContinueCard({ item }: { item: { courseId: number; courseTitle: string; courseSlug: string; courseThumbnail: string | null; moduleTitle: string | null; lectureId: number | null; lectureTitle: string | null; progress: number; lastViewedAt: string } }) {
  const { t } = useTranslation(['common']);
  const { isDark } = useTheme();
  const lectureHref = item.lectureId
    ? `/courses/${item.courseId}/lectures/${item.lectureId}`
    : `/courses/${item.courseId}`;
  const thumb = item.courseThumbnail ? resolveFileUrl(item.courseThumbnail) : null;

  return (
    <div className="flex flex-col sm:flex-row">
      <div
        className="sm:w-48 h-32 sm:h-auto flex-shrink-0 bg-gradient-to-br from-cyan-500 to-teal-600 flex items-center justify-center"
        style={thumb ? { backgroundImage: `url(${thumb})`, backgroundSize: 'cover', backgroundPosition: 'center' } : undefined}
      >
        {!thumb && <PlayCircle className="w-10 h-10 text-white/80" />}
      </div>
      <div className="flex-1 p-5 flex flex-col justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: isDark ? '#9ca3af' : '#6b7280' }}>
            {t('common:continue_learning', { defaultValue: 'Continue learning' })}
          </p>
          <h3 className="mt-1 text-lg font-semibold truncate" style={{ color: isDark ? '#f3f4f6' : '#111827' }}>
            {item.courseTitle}
          </h3>
          <p className="mt-0.5 text-sm truncate" style={{ color: isDark ? '#9ca3af' : '#6b7280' }}>
            {item.moduleTitle ? `${item.moduleTitle} · ` : ''}
            {item.lectureTitle ?? ''}
          </p>
        </div>
        <div className="flex items-center justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: isDark ? '#374151' : '#e5e7eb' }}>
              <div
                className="h-full transition-all"
                style={{ width: `${Math.max(0, Math.min(100, item.progress))}%`, backgroundColor: '#0d9488' }}
              />
            </div>
            <p className="mt-1 text-xs" style={{ color: isDark ? '#9ca3af' : '#6b7280' }}>
              {Math.round(item.progress)}% · {t('common:last_visited_x_ago', { defaultValue: 'last visited {{when}}', when: relativeTime(item.lastViewedAt) })}
            </p>
          </div>
          <Link to={lectureHref}>
            <Button size="sm" icon={<PlayCircle className="w-4 h-4" />}>
              {t('common:resume', { defaultValue: 'Resume' })}
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}

function ContinueSkeleton() {
  return (
    <div className="flex flex-col sm:flex-row">
      <Skeleton className="sm:w-48 h-32 sm:h-44" />
      <div className="flex-1 p-5 space-y-3">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-5 w-3/4" />
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="h-1.5 w-full" />
      </div>
    </div>
  );
}

function UpNextSkeleton() {
  return (
    <ul className="space-y-3">
      {[0, 1, 2].map(i => (
        <li key={i} className="flex items-start justify-between gap-3">
          <div className="flex-1 space-y-1">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
          </div>
          <Skeleton className="h-5 w-16 rounded-full" rounded="full" />
        </li>
      ))}
    </ul>
  );
}

function CourseTile({ enrollment, lastViewedAt }: { enrollment: Enrollment; lastViewedAt?: string }) {
  const { t } = useTranslation(['common']);
  const { isDark } = useTheme();
  const course = enrollment.course!;
  const thumb = course.thumbnail ? resolveFileUrl(course.thumbnail) : null;

  return (
    <Link to={`/courses/${course.id}`}>
      <Card hover className="h-full">
        <CardBody className="p-4 flex flex-col gap-3 h-full">
          <div
            className="w-full h-24 rounded-lg bg-gradient-to-br from-cyan-500 to-teal-600 flex items-center justify-center"
            style={thumb ? { backgroundImage: `url(${thumb})`, backgroundSize: 'cover', backgroundPosition: 'center' } : undefined}
          >
            {!thumb && <BookOpen className="w-8 h-8 text-white/70" />}
          </div>
          <div className="flex items-start justify-between gap-2 flex-1">
            <div className="min-w-0">
              <p className="font-medium text-sm line-clamp-2" style={{ color: isDark ? '#f3f4f6' : '#111827' }}>
                {course.title}
              </p>
              <p className="mt-1 text-xs" style={{ color: isDark ? '#9ca3af' : '#6b7280' }}>
                {lastViewedAt
                  ? t('common:last_visited_x_ago', { defaultValue: 'last visited {{when}}', when: relativeTime(lastViewedAt) })
                  : t('common:not_started_yet', { defaultValue: 'Not started yet' })}
              </p>
            </div>
            <ProgressRing value={enrollment.progress ?? 0} size={40} thickness={3} />
          </div>
        </CardBody>
      </Card>
    </Link>
  );
}

const verbLabel = (verb: string) => {
  switch (verb) {
    case 'viewed':
      return 'Viewed';
    case 'completed':
      return 'Completed';
    case 'submitted':
      return 'Submitted';
    case 'started':
      return 'Started';
    case 'graded':
      return 'Graded';
    case 'enrolled':
      return 'Enrolled in';
    case 'interacted':
      return 'Used';
    default:
      return verb.charAt(0).toUpperCase() + verb.slice(1);
  }
};

function ActivityIcon({ verb, objectType }: { verb: string; objectType: string }) {
  if (objectType === 'assignment' || verb === 'submitted') return <FileText className="w-4 h-4 text-orange-500" />;
  if (verb === 'completed') return <GraduationCap className="w-4 h-4 text-emerald-500" />;
  if (objectType === 'lecture' || verb === 'viewed') return <PlayCircle className="w-4 h-4 text-cyan-500" />;
  if (objectType === 'forum') return <MessageCircle className="w-4 h-4 text-violet-500" />;
  return <BookOpen className="w-4 h-4 text-gray-500" />;
}
