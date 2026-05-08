import { useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { GraduationCap, Users } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useTheme } from '../../hooks/useTheme';
import { activityLogger } from '../../services/activityLogger';
import { Card, CardBody } from '../../components/common/Card';
import { Breadcrumb } from '../../components/common/Breadcrumb';
import {
  ActivityDonut,
  Avatar,
  CourseCompletionList,
  MonthlyEngagementChart,
  Skeleton,
  StatTile,
  StatTilePlaceholder,
  WelcomeCard,
  relativeTime,
} from '../../components/dashboard';
import { ActivityTimelineChart } from '../../components/tna/ActivityTimelineChart';
import { adminApi, activityLogApi } from '../../api/admin';

/**
 * Admin dashboard. Same visual chrome as the instructor dashboard,
 * scoped platform-wide: every user, every course. Two of the four KPI
 * tiles are intentional placeholders. The verb-stacked Activity
 * Timeline (existing TNA chart) and the recent signups / enrollments
 * lists are kept; the older quick-link tiles, growth dual-line chart,
 * and course-distribution donut are gone.
 */
export const AdminDashboard = () => {
  const { t } = useTranslation(['admin', 'common', 'navigation']);
  const { user } = useAuth();
  const { isDark } = useTheme();

  useEffect(() => {
    activityLogger.logDashboardViewed();
  }, []);

  const { data: overview, isLoading } = useQuery({
    queryKey: ['adminDashboardOverview'],
    queryFn: () => adminApi.getDashboardOverview(),
    enabled: !!user,
  });

  const { data: dailyCounts } = useQuery({
    queryKey: ['activity', 'dailyCounts', 'last30'],
    queryFn: () => {
      const end = new Date();
      const start = new Date(end.getTime() - 29 * 86_400_000);
      return activityLogApi.getDailyCounts({
        startDate: start.toISOString().slice(0, 10),
        endDate: end.toISOString().slice(0, 10),
      });
    },
    enabled: !!user,
  });

  const colors = {
    bg: isDark ? '#0b1220' : '#f8fafc',
    text: isDark ? '#f3f4f6' : '#111827',
    muted: isDark ? '#9ca3af' : '#6b7280',
    border: isDark ? '#374151' : '#e5e7eb',
  };

  const welcomeMessage = useMemo(() => {
    return t('common:welcome_message_admin', {
      defaultValue:
        "Let's check the platform's pulse — see who's signing up and what users are doing today.",
    });
  }, [t]);

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
              icon={Users}
              label={t('admin:total_users', { defaultValue: 'Total Users' })}
              value={overview?.kpis.totalUsers ?? '—'}
              color="sky"
              href="#user-activity-log"
            />
            <StatTile
              icon={GraduationCap}
              label={t('admin:total_courses', { defaultValue: 'Total Courses' })}
              value={overview?.kpis.totalCourses ?? '—'}
              color="violet"
              href="#course-overview"
            />
            <StatTilePlaceholder label={t('common:tile_reserved', { defaultValue: 'Reserved' })} />
            <StatTilePlaceholder label={t('common:tile_reserved', { defaultValue: 'Reserved' })} />
          </div>
        </div>

        {/* User Activity Log (full width) */}
        <div id="user-activity-log" className="mb-8 md:mb-10 scroll-mt-24">
          <Card>
            <CardBody className="flex flex-col h-full">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: colors.muted }}>
                  {t('common:user_activity_log', { defaultValue: 'User Activity Log' })}
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
              {isLoading ? (
                <Skeleton className="flex-1 min-h-[260px] w-full" />
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

        {/* Course Overview + Activity Breakdown */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-5 mb-8 md:mb-10">
          <Card id="course-overview" className="scroll-mt-24">
            <CardBody className="flex flex-col h-full">
              <span className="text-xs font-semibold uppercase tracking-wider mb-4 block" style={{ color: colors.muted }}>
                {t('common:course_overview', { defaultValue: 'Course Overview' })}
              </span>
              {isLoading ? (
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
              {isLoading ? (
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

        {/* Activity Timeline (full-width verb-stacked chart) */}
        <div className="mb-8 md:mb-10">
          <Card>
            <CardBody>
              <span className="text-xs font-semibold uppercase tracking-wider mb-4 block" style={{ color: colors.muted }}>
                {t('admin:activity_timeline', { defaultValue: 'Activity timeline' })}
              </span>
              {!dailyCounts ? (
                <Skeleton className="h-64 w-full" />
              ) : dailyCounts.days.length === 0 ? (
                <p className="py-12 text-center text-sm" style={{ color: colors.muted }}>
                  {t('common:no_activity_yet', { defaultValue: 'No activity yet' })}
                </p>
              ) : (
                <ActivityTimelineChart
                  days={dailyCounts.days}
                  verbs={dailyCounts.verbs}
                  series={dailyCounts.series}
                />
              )}
            </CardBody>
          </Card>
        </div>

        {/* Recent signups + Recent enrollments */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-5">
          <Card>
            <CardBody className="p-0">
              <div className="px-5 py-3 flex items-center justify-between border-b" style={{ borderColor: colors.border }}>
                <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: colors.muted }}>
                  {t('common:recent_signups', { defaultValue: 'Recent signups' })}
                </span>
                <Link to="/admin/users" className="text-xs font-medium" style={{ color: '#0d9488' }}>
                  {t('common:view_all', { defaultValue: 'View all' })}
                </Link>
              </div>
              {isLoading ? (
                <div className="p-5 space-y-3">
                  {[0, 1, 2, 3, 4].map(i => (
                    <Skeleton key={i} className="h-10" />
                  ))}
                </div>
              ) : !overview || overview.recentUsers.length === 0 ? (
                <p className="px-5 py-6 text-sm text-center" style={{ color: colors.muted }}>
                  {t('common:nothing_here', { defaultValue: 'Nothing here yet.' })}
                </p>
              ) : (
                <ul className="divide-y" style={{ borderColor: colors.border }}>
                  {overview.recentUsers.slice(0, 5).map(u => (
                    <li
                      key={u.id}
                      className="flex items-center gap-3 px-5 py-3 hover:bg-gray-50/60 dark:hover:bg-gray-800/40 transition-colors"
                    >
                      <Avatar name={u.fullname || u.email || '?'} size="sm" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate" style={{ color: colors.text }}>
                          {u.fullname || u.email}
                        </p>
                        <p className="text-xs truncate" style={{ color: colors.muted }}>
                          {u.email}
                        </p>
                      </div>
                      <span className="text-xs whitespace-nowrap" style={{ color: colors.muted }}>
                        {relativeTime(u.createdAt)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardBody className="p-0">
              <div className="px-5 py-3 flex items-center justify-between border-b" style={{ borderColor: colors.border }}>
                <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: colors.muted }}>
                  {t('common:recent_enrollments', { defaultValue: 'Recent enrollments' })}
                </span>
                <Link to="/admin/enrollments" className="text-xs font-medium" style={{ color: '#0d9488' }}>
                  {t('common:view_all', { defaultValue: 'View all' })}
                </Link>
              </div>
              {isLoading ? (
                <div className="p-5 space-y-3">
                  {[0, 1, 2, 3, 4].map(i => (
                    <Skeleton key={i} className="h-10" />
                  ))}
                </div>
              ) : !overview || overview.recentEnrollments.length === 0 ? (
                <p className="px-5 py-6 text-sm text-center" style={{ color: colors.muted }}>
                  {t('common:nothing_here', { defaultValue: 'Nothing here yet.' })}
                </p>
              ) : (
                <ul className="divide-y" style={{ borderColor: colors.border }}>
                  {overview.recentEnrollments.slice(0, 5).map(e => (
                    <li
                      key={e.id}
                      className="flex items-center gap-3 px-5 py-3 hover:bg-gray-50/60 dark:hover:bg-gray-800/40 transition-colors"
                    >
                      <Avatar name={e.user?.fullname || e.user?.email || '?'} size="sm" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate" style={{ color: colors.text }}>
                          {e.user?.fullname || e.user?.email}
                        </p>
                        <p className="text-xs truncate" style={{ color: colors.muted }}>
                          {e.course?.title}
                        </p>
                      </div>
                      <span className="text-xs whitespace-nowrap" style={{ color: colors.muted }}>
                        {relativeTime(e.enrolledAt)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
};
