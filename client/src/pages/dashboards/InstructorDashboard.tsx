import { useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { BookOpen, Briefcase, FileText, Sparkles, Users } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useTheme } from '../../hooks/useTheme';
import { activityLogger } from '../../services/activityLogger';
import { Card, CardBody } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { Breadcrumb } from '../../components/common/Breadcrumb';
import {
  DashboardSection,
  EmptyDashboard,
  MiniBarChart,
  Skeleton,
  StatTile,
  WelcomeCard,
  relativeTime,
} from '../../components/dashboard';
import { ActivityDonutChart } from '../../components/tna/ActivityDonutChart';
import { coursesApi } from '../../api/courses';
import { meApi } from '../../api/me';
import { resolveFileUrl } from '../../api/client';

/**
 * Instructor dashboard. Teaching insights at a glance: KPI row with
 * trend sparklines, 30-day engagement line chart, per-course
 * completion bars, activity-type donut, pending grading, and the
 * course list.
 */
export const InstructorDashboard = () => {
  const { t } = useTranslation(['courses', 'teaching', 'navigation', 'common', 'admin']);
  const { user } = useAuth();
  const { isDark } = useTheme();

  useEffect(() => {
    activityLogger.logDashboardViewed();
  }, []);

  const { data: overview, isLoading: ovLoading } = useQuery({
    queryKey: ['me', 'teachingOverview'],
    queryFn: () => meApi.getTeachingOverview(),
    enabled: !!user,
  });

  const { data: courses, isLoading: coursesLoading } = useQuery({
    queryKey: ['teachingCourses'],
    queryFn: () => coursesApi.getMyCourses(),
    enabled: !!user,
  });

  const { data: gradingQueue } = useQuery({
    queryKey: ['me', 'grading-queue'],
    queryFn: () => meApi.getGradingQueue(),
    enabled: !!user,
  });

  const welcomeMessage = useMemo(() => {
    const pending = (gradingQueue ?? []).reduce((sum, q) => sum + q.pendingCount, 0);
    if (pending > 0) {
      return t('common:welcome_message_pending_grading', {
        defaultValue:
          "You have {{count}} submission{{plural}} waiting to be graded. Let's tackle them and keep your students moving.",
        count: pending,
        plural: pending === 1 ? '' : 's',
      });
    }
    return t('common:welcome_message_default', {
      defaultValue:
        "Let's check what your students are up to today. Take a peek at recent activity and course progress.",
    });
  }, [t, gradingQueue]);

  const colors = {
    bg: isDark ? '#0b1220' : '#f8fafc',
    text: isDark ? '#f3f4f6' : '#111827',
    muted: isDark ? '#9ca3af' : '#6b7280',
    border: isDark ? '#374151' : '#e5e7eb',
  };

  const completionBars = useMemo(() => {
    const items = overview?.courseCompletion ?? [];
    return items.slice(0, 5).map((c, i) => ({
      label: c.courseTitle,
      value: c.completionPct,
      color: ['#0ea5e9', '#14b8a6', '#a855f7', '#f59e0b', '#ec4899'][i % 5],
      hint: `${c.completionPct}% · ${c.studentCount} ${c.studentCount === 1 ? 'student' : 'students'}`,
    }));
  }, [overview]);

  return (
    <div className="min-h-screen" style={{ backgroundColor: colors.bg }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 md:py-8">
        <div className="mb-4">
          <Breadcrumb items={[{ label: t('common:dashboard', { defaultValue: 'Dashboard' }) }]} />
        </div>

        {/* Welcome card + KPI tile grid */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 md:gap-5 mb-8 md:mb-10">
          <div className="lg:col-span-3">
            <WelcomeCard name={user?.fullname} message={welcomeMessage} />
          </div>
          <div className="lg:col-span-2 grid grid-cols-2 gap-3 md:gap-4">
            <StatTile
              icon={Briefcase}
              label={t('your_courses')}
              value={overview?.kpis.totalCourses ?? '—'}
              color="violet"
              href="#my-courses"
            />
            <StatTile
              icon={Users}
              label={t('total_students')}
              value={overview?.kpis.totalStudents ?? '—'}
              color="emerald"
              href="#course-completion"
            />
            <StatTile
              icon={FileText}
              label={t('assignments')}
              value={overview?.kpis.totalAssignments ?? '—'}
              color="amber"
              href="#course-completion"
            />
            <StatTile
              icon={Sparkles}
              label={t('pending_grading')}
              value={overview?.kpis.pendingGrading ?? '—'}
              color="rose"
              href="#pending-grading"
            />
          </div>
        </div>

        {/* Engagement chart + Activity donut */}
        <div id="engagement" className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-5 mb-8 md:mb-10 scroll-mt-24">
          <Card className="lg:col-span-2">
            <CardBody>
              <div className="flex items-center justify-between mb-4">
                <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: colors.muted }}>
                  {t('common:student_engagement_30d', { defaultValue: 'Student engagement — last 30 days' })}
                </span>
                {overview && overview.engagement.counts.length > 0 && (
                  <span className="text-xs" style={{ color: colors.muted }}>
                    {overview.engagement.counts.reduce((s, v) => s + v, 0)}{' '}
                    {t('common:events', { defaultValue: 'events' })}
                  </span>
                )}
              </div>
              {ovLoading ? (
                <Skeleton className="h-44 w-full" />
              ) : !overview || overview.engagement.counts.length === 0 ? (
                <p className="py-12 text-center text-sm" style={{ color: colors.muted }}>
                  {t('common:no_activity_yet', { defaultValue: 'No activity yet' })}
                </p>
              ) : (
                <EngagementLineChart days={overview.engagement.days} counts={overview.engagement.counts} />
              )}
            </CardBody>
          </Card>

          <Card>
            <CardBody>
              <span className="text-xs font-semibold uppercase tracking-wider mb-4 block" style={{ color: colors.muted }}>
                {t('common:activity_breakdown', { defaultValue: 'Activity breakdown' })}
              </span>
              {ovLoading ? (
                <Skeleton className="h-40 w-full" />
              ) : !overview || Object.keys(overview.activityByVerb).length === 0 ? (
                <p className="py-8 text-center text-sm" style={{ color: colors.muted }}>
                  {t('common:nothing_here', { defaultValue: 'Nothing here yet.' })}
                </p>
              ) : (
                <ActivityDonutChart data={overview.activityByVerb} title="" />
              )}
            </CardBody>
          </Card>
        </div>

        {/* Course completion bars + Pending grading */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-5 mb-8 md:mb-10">
          <Card id="course-completion" className="scroll-mt-24">
            <CardBody>
              <span className="text-xs font-semibold uppercase tracking-wider mb-4 block" style={{ color: colors.muted }}>
                {t('common:course_completion', { defaultValue: 'Course completion' })}
              </span>
              {ovLoading ? (
                <div className="space-y-3">
                  {[0, 1, 2].map(i => (
                    <Skeleton key={i} className="h-6" />
                  ))}
                </div>
              ) : completionBars.length === 0 ? (
                <p className="py-8 text-center text-sm" style={{ color: colors.muted }}>
                  {t('common:nothing_here', { defaultValue: 'Nothing here yet.' })}
                </p>
              ) : (
                <MiniBarChart items={completionBars} percent />
              )}
            </CardBody>
          </Card>

          <Card id="pending-grading" className="scroll-mt-24">
            <CardBody className="p-0">
              <div className="px-5 py-3 flex items-center justify-between border-b" style={{ borderColor: colors.border }}>
                <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: colors.muted }}>
                  {t('common:pending_grading', { defaultValue: 'Pending grading' })}
                </span>
                {gradingQueue && gradingQueue.length > 0 && (
                  <Link to="/teach" className="text-xs font-medium" style={{ color: '#0d9488' }}>
                    {t('common:view_all', { defaultValue: 'View all' })}
                  </Link>
                )}
              </div>
              {!gradingQueue ? (
                <div className="p-5 space-y-3">
                  {[0, 1, 2].map(i => (
                    <Skeleton key={i} className="h-10" />
                  ))}
                </div>
              ) : gradingQueue.length === 0 ? (
                <p className="px-5 py-8 text-sm text-center" style={{ color: colors.muted }}>
                  {t('common:all_caught_up_teaching', { defaultValue: 'All caught up — nothing waiting on you right now.' })}
                </p>
              ) : (
                <ul className="divide-y" style={{ borderColor: colors.border }}>
                  {gradingQueue.slice(0, 5).map(q => (
                    <li key={q.assignmentId}>
                      <Link
                        to={`/teach/courses/${q.courseId}/assignments/${q.assignmentId}/submissions`}
                        className="flex items-center gap-3 px-5 py-3 hover:bg-gray-50/60 dark:hover:bg-gray-800/40 transition-colors"
                      >
                        <div
                          className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                          style={{ backgroundColor: 'rgba(245,158,11,0.15)' }}
                        >
                          <FileText className="w-4 h-4 text-amber-600" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium truncate" style={{ color: colors.text }}>
                            {q.assignmentTitle}
                          </p>
                          <p className="text-xs truncate" style={{ color: colors.muted }}>
                            {q.courseTitle}
                            {q.oldestSubmittedAt &&
                              ` · oldest ${relativeTime(q.oldestSubmittedAt)}`}
                          </p>
                        </div>
                        <span
                          className="text-xs font-semibold px-2 py-0.5 rounded-full whitespace-nowrap"
                          style={{ backgroundColor: 'rgba(245,158,11,0.15)', color: '#92400e' }}
                        >
                          {q.pendingCount} {t('common:waiting', { defaultValue: 'waiting' })}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>
        </div>

        {/* My Courses */}
        <DashboardSection
          id="my-courses"
          title={t('your_courses')}
          action={
            <Link to="/teach" className="text-sm font-medium" style={{ color: '#0d9488' }}>
              {t('common:view_all', { defaultValue: 'View all' })}
            </Link>
          }
        >
          {coursesLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {[0, 1, 2].map(i => (
                <Skeleton key={i} className="h-36" rounded="lg" />
              ))}
            </div>
          ) : !courses || courses.length === 0 ? (
            <Card>
              <CardBody>
                <EmptyDashboard
                  icon={Briefcase}
                  title={t('teaching:no_courses_yet', { defaultValue: 'No courses yet' })}
                  description={t('teaching:create_your_first', { defaultValue: 'Create your first course to start teaching.' })}
                  action={
                    <Link to="/teach/create">
                      <Button size="sm" icon={<Sparkles className="w-4 h-4" />}>
                        {t('teaching:create_course')}
                      </Button>
                    </Link>
                  }
                />
              </CardBody>
            </Card>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {courses.slice(0, 6).map(c => {
                const thumb = c.thumbnail ? resolveFileUrl(c.thumbnail) : null;
                return (
                  <Link key={c.id} to={`/teach/courses/${c.id}/curriculum`}>
                    <Card hover className="h-full">
                      <CardBody className="p-4 flex flex-col gap-3 h-full">
                        <div
                          className="w-full h-24 rounded-lg bg-gradient-to-br from-cyan-500 to-teal-600 flex items-center justify-center"
                          style={thumb ? { backgroundImage: `url(${thumb})`, backgroundSize: 'cover', backgroundPosition: 'center' } : undefined}
                        >
                          {!thumb && <BookOpen className="w-8 h-8 text-white/70" />}
                        </div>
                        <div className="flex-1">
                          <p className="font-medium text-sm line-clamp-2" style={{ color: colors.text }}>
                            {c.title}
                          </p>
                          <p className="mt-1 text-xs flex items-center gap-2" style={{ color: colors.muted }}>
                            <Users className="w-3 h-3" />
                            {(c as any)._count?.enrollments ?? 0}
                          </p>
                        </div>
                      </CardBody>
                    </Card>
                  </Link>
                );
              })}
            </div>
          )}
        </DashboardSection>
      </div>
    </div>
  );
};

/**
 * Single-line engagement chart with filled area. Pure SVG. Renders the
 * 30-day series passed in. Y axis is auto-scaled; X tick labels show
 * day-of-month every 5 days to keep the axis legible.
 */
function EngagementLineChart({ days, counts }: { days: string[]; counts: number[] }) {
  const { isDark } = useTheme();
  const w = 700;
  const h = 180;
  const padX = 32;
  const padY = 24;
  const innerW = w - padX * 2;
  const innerH = h - padY * 2;
  const max = Math.max(1, ...counts);
  const stepX = counts.length > 1 ? innerW / (counts.length - 1) : 0;
  const points = counts.map((v, i) => {
    const x = padX + i * stepX;
    const y = padY + innerH - (v / max) * innerH;
    return { x, y, v };
  });
  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  const areaPath = `${linePath} L ${(padX + innerW).toFixed(1)},${(padY + innerH).toFixed(1)} L ${padX.toFixed(1)},${(padY + innerH).toFixed(1)} Z`;
  const grid = isDark ? '#1f2937' : '#f3f4f6';
  const tickColor = isDark ? '#6b7280' : '#9ca3af';

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full" preserveAspectRatio="none" style={{ height: 200 }}>
      {[0, 0.25, 0.5, 0.75, 1].map(t => {
        const y = padY + innerH * (1 - t);
        return <line key={t} x1={padX} y1={y} x2={padX + innerW} y2={y} stroke={grid} strokeWidth={1} />;
      })}
      <path d={areaPath} fill="#0d9488" fillOpacity={0.12} />
      <path d={linePath} fill="none" stroke="#0d9488" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
      {points
        .filter((_, i) => i % 5 === 0 || i === counts.length - 1)
        .map((p, idx) => (
          <text
            key={idx}
            x={p.x}
            y={h - 6}
            textAnchor="middle"
            fontSize="10"
            fill={tickColor}
          >
            {new Date(days[idx * 5] ?? days[counts.length - 1]).getUTCDate()}
          </text>
        ))}
    </svg>
  );
}
