import { useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Briefcase, FileText, Sparkles, Users } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useTheme } from '../../hooks/useTheme';
import { activityLogger } from '../../services/activityLogger';
import { Card, CardBody } from '../../components/common/Card';
import { Breadcrumb } from '../../components/common/Breadcrumb';
import {
  ActivityDonut,
  CourseCompletionList,
  MonthlyEngagementChart,
  Skeleton,
  StatTile,
  WelcomeCard,
} from '../../components/dashboard';
import { meApi } from '../../api/me';

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
              href="#course-completion"
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
              href={
                gradingQueue && gradingQueue.length > 0
                  ? `/teach/courses/${gradingQueue[0].courseId}/assignments/${gradingQueue[0].assignmentId}/submissions`
                  : '#engagement'
              }
            />
          </div>
        </div>

        {/* Engagement chart (full width) */}
        <div id="engagement" className="mb-8 md:mb-10 scroll-mt-24">
          <Card>
            <CardBody className="flex flex-col h-full">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: colors.muted }}>
                  {t('common:students_activity_log', { defaultValue: 'Students Activity Log' })}
                </span>
                {overview && (
                  <div className="flex items-center gap-3 text-xs">
                    <span className="inline-flex items-center gap-1.5" style={{ color: colors.muted }}>
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: '#0d9488' }} />
                      {overview.engagement.thisMonth.label}
                    </span>
                    <span className="inline-flex items-center gap-1.5" style={{ color: colors.muted }}>
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: '#f59e0b' }} />
                      {overview.engagement.lastMonth.label}
                    </span>
                  </div>
                )}
              </div>
              {ovLoading ? (
                <Skeleton className="flex-1 min-h-[240px] w-full" />
              ) : !overview ||
                (overview.engagement.thisMonth.counts.length === 0 &&
                  overview.engagement.lastMonth.counts.length === 0) ? (
                <p className="flex-1 flex items-center justify-center py-12 text-sm" style={{ color: colors.muted }}>
                  {t('common:no_activity_yet', { defaultValue: 'No activity yet' })}
                </p>
              ) : (
                <div className="flex-1 min-h-[260px]">
                  <MonthlyEngagementChart
                    thisMonth={overview.engagement.thisMonth.counts}
                    lastMonth={overview.engagement.lastMonth.counts}
                    thisMonthLabel={overview.engagement.thisMonth.label}
                    lastMonthLabel={overview.engagement.lastMonth.label}
                    thisMonthYear={overview.engagement.thisMonth.year}
                    thisMonthMonth={overview.engagement.thisMonth.month}
                  />
                </div>
              )}
            </CardBody>
          </Card>
        </div>

        {/* Course completion bars + Activity breakdown donut */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-5 mb-8 md:mb-10">
          <Card id="course-completion" className="scroll-mt-24">
            <CardBody className="flex flex-col h-full">
              <span className="text-xs font-semibold uppercase tracking-wider mb-4 block" style={{ color: colors.muted }}>
                {t('common:course_overview', { defaultValue: 'Course Overview' })}
              </span>
              {ovLoading ? (
                <div className="flex-1 min-h-[260px] space-y-2">
                  {[0, 1, 2].map(i => (
                    <Skeleton key={i} className="h-14" rounded="lg" />
                  ))}
                </div>
              ) : !overview || overview.courseCompletion.length === 0 ? (
                <p className="flex-1 flex items-center justify-center py-8 text-sm" style={{ color: colors.muted }}>
                  {t('common:nothing_here', { defaultValue: 'Nothing here yet.' })}
                </p>
              ) : (
                <div className="flex-1 overflow-y-auto min-h-[260px] max-h-[420px] -mr-2 pr-2">
                  <CourseCompletionList items={overview.courseCompletion} />
                </div>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardBody className="flex flex-col h-full">
              <span className="text-xs font-semibold uppercase tracking-wider mb-4 block" style={{ color: colors.muted }}>
                {t('common:activity_breakdown', { defaultValue: 'Activity breakdown' })}
              </span>
              {ovLoading ? (
                <Skeleton className="flex-1 min-h-[260px] w-full" />
              ) : !overview || Object.keys(overview.activityByVerb).length === 0 ? (
                <p className="flex-1 flex items-center justify-center py-8 text-sm" style={{ color: colors.muted }}>
                  {t('common:nothing_here', { defaultValue: 'Nothing here yet.' })}
                </p>
              ) : (
                <div className="flex-1 flex items-center justify-center min-h-[260px]">
                  <ActivityDonut
                    data={overview.activityByVerb}
                    formatLabel={(k) =>
                      t(`common:verb_${k}`, {
                        defaultValue: k.charAt(0).toUpperCase() + k.slice(1).replace(/_/g, ' '),
                      })
                    }
                  />
                </div>
              )}
            </CardBody>
          </Card>
        </div>

      </div>
    </div>
  );
};

