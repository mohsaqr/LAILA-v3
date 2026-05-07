import { useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Activity, BookOpen, Database, Server, Settings as SettingsIcon, UserPlus, Users } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useTheme } from '../../hooks/useTheme';
import { activityLogger } from '../../services/activityLogger';
import { Card, CardBody } from '../../components/common/Card';
import { Breadcrumb } from '../../components/common/Breadcrumb';
import {
  Avatar,
  DashboardGreeting,
  DashboardSection,
  Skeleton,
  TrendChip,
  relativeTime,
} from '../../components/dashboard';
import { ActivityTimelineChart } from '../../components/tna/ActivityTimelineChart';
import { ActivityDonutChart } from '../../components/tna/ActivityDonutChart';
import { adminApi } from '../../api/admin';
import { activityLogApi } from '../../api/admin';

/**
 * Admin dashboard. Data-heavy SaaS layout: KPI row with sparkline
 * trends, activity timeline, growth chart, course distribution donut,
 * LLM provider health cards, and recent signups/enrollments lists.
 */
export const AdminDashboard = () => {
  const { t } = useTranslation(['admin', 'common', 'navigation']);
  const { user } = useAuth();
  const { isDark } = useTheme();

  useEffect(() => {
    activityLogger.logDashboardViewed();
  }, []);

  const { data, isLoading } = useQuery({
    queryKey: ['adminStats'],
    queryFn: () => adminApi.getStats(),
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

  const stats = data?.stats;
  const trends = data?.trends;
  const courseDistribution = data?.courseDistribution ?? {};
  const recentUsers = data?.recentUsers ?? [];
  const recentEnrollments = data?.recentEnrollments ?? [];

  const colors = {
    bg: isDark ? '#0b1220' : '#f8fafc',
    text: isDark ? '#f3f4f6' : '#111827',
    muted: isDark ? '#9ca3af' : '#6b7280',
    border: isDark ? '#374151' : '#e5e7eb',
  };

  const activityTotal = useMemo(
    () => trends?.activity.reduce((s, v) => s + v, 0) ?? 0,
    [trends]
  );

  const greetingLine = useMemo(() => {
    if (!stats) return t('common:platform_overview', { defaultValue: 'Platform overview at a glance.' });
    const newSignups = trends?.signups.reduce((s, v) => s + v, 0) ?? 0;
    if (newSignups > 0) {
      return t('common:platform_active_summary', {
        defaultValue: '{{users}} new signups and {{activity}} activity events in the last 7 days.',
        users: newSignups,
        activity: activityTotal,
      });
    }
    return t('common:platform_overview', { defaultValue: 'Platform overview at a glance.' });
  }, [t, stats, trends, activityTotal]);

  return (
    <div className="min-h-screen" style={{ backgroundColor: colors.bg }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 md:py-8">
        <div className="mb-4">
          <Breadcrumb items={[{ label: t('common:dashboard', { defaultValue: 'Dashboard' }) }]} />
        </div>

        <DashboardGreeting name={user?.fullname} line={greetingLine} />

        {/* KPI row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-8 md:mb-10">
          <TrendChip
            label={t('admin:total_users', { defaultValue: 'Total users' })}
            value={stats?.totalUsers ?? '—'}
            trend={trends?.signups}
            delta={trends?.signupsDelta}
            color="#0ea5e9"
            accent
            icon={<Users className="w-4 h-4" />}
          />
          <TrendChip
            label={t('admin:active_users', { defaultValue: 'Active users' })}
            value={stats?.activeUsers ?? '—'}
            trend={trends?.activity}
            delta={trends?.activityDelta}
            color="#14b8a6"
            accent
            icon={<Activity className="w-4 h-4" />}
          />
          <TrendChip
            label={t('admin:published_courses', { defaultValue: 'Published courses' })}
            value={stats?.publishedCourses ?? '—'}
            color="#a855f7"
            accent
            icon={<BookOpen className="w-4 h-4" />}
          />
          <TrendChip
            label={t('admin:total_enrollments', { defaultValue: 'Enrollments' })}
            value={stats?.totalEnrollments ?? '—'}
            trend={trends?.enrollments}
            delta={trends?.enrollmentsDelta}
            color="#f59e0b"
            accent
            icon={<UserPlus className="w-4 h-4" />}
          />
        </div>

        {/* Activity timeline (full-width) */}
        <DashboardSection
          title={t('admin:activity_timeline', { defaultValue: 'Activity timeline' })}
          action={
            <Link to="/admin/dashboard" className="text-sm font-medium" style={{ color: '#0d9488' }}>
              {t('admin:full_analytics', { defaultValue: 'Full analytics →' })}
            </Link>
          }
        >
          <Card>
            <CardBody>
              {!dailyCounts ? (
                <Skeleton className="h-64 w-full" />
              ) : dailyCounts.days.length === 0 ? (
                <p className="py-12 text-center text-sm" style={{ color: colors.muted }}>
                  {t('common:no_activity_yet', { defaultValue: 'No activity yet' })}
                </p>
              ) : (
                <ActivityTimelineChart days={dailyCounts.days} verbs={dailyCounts.verbs} series={dailyCounts.series} />
              )}
            </CardBody>
          </Card>
        </DashboardSection>

        {/* Growth + Course Distribution */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-5 mb-8 md:mb-10">
          {/* Growth */}
          <Card className="lg:col-span-2">
            <CardBody>
              <div className="flex items-center justify-between mb-4">
                <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: colors.muted }}>
                  {t('admin:growth_last_7_days', { defaultValue: 'Growth — last 7 days' })}
                </span>
                <div className="flex items-center gap-3 text-xs">
                  <LegendDot color="#0ea5e9" label={t('admin:signups', { defaultValue: 'Signups' })} />
                  <LegendDot color="#f59e0b" label={t('common:enrollments', { defaultValue: 'Enrollments' })} />
                </div>
              </div>
              {!trends ? (
                <Skeleton className="h-40 w-full" />
              ) : (
                <GrowthDualLine
                  days={trends.days}
                  signups={trends.signups}
                  enrollments={trends.enrollments}
                />
              )}
            </CardBody>
          </Card>

          {/* Course distribution */}
          <Card>
            <CardBody>
              <span className="text-xs font-semibold uppercase tracking-wider mb-4 block" style={{ color: colors.muted }}>
                {t('admin:course_distribution', { defaultValue: 'Course distribution' })}
              </span>
              {isLoading ? (
                <Skeleton className="h-40 w-full" />
              ) : Object.keys(courseDistribution).length === 0 ? (
                <p className="py-8 text-center text-sm" style={{ color: colors.muted }}>
                  {t('common:nothing_here', { defaultValue: 'Nothing here yet.' })}
                </p>
              ) : (
                <ActivityDonutChart data={courseDistribution} title="" />
              )}
            </CardBody>
          </Card>
        </div>

        {/* Quick links */}
        <DashboardSection title={t('common:quick_links', { defaultValue: 'Quick links' })}>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            <AdminLink to="/admin/users" icon={Users} label={t('navigation:user_management', { defaultValue: 'Users' })} />
            <AdminLink to="/admin/enrollments" icon={BookOpen} label={t('navigation:enrollments', { defaultValue: 'Enrollments' })} />
            <AdminLink to="/admin/logs" icon={Activity} label={t('navigation:logs', { defaultValue: 'Logs' })} />
            <AdminLink to="/admin/llm" icon={Server} label={t('admin:llm_providers', { defaultValue: 'LLM' })} />
            <AdminLink to="/admin/dashboard" icon={Database} label={t('admin:analytics', { defaultValue: 'Analytics' })} />
          </div>
        </DashboardSection>

        {/* Recent signups + enrollments */}
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
              ) : recentUsers.length === 0 ? (
                <p className="px-5 py-6 text-sm text-center" style={{ color: colors.muted }}>
                  {t('common:nothing_here', { defaultValue: 'Nothing here yet.' })}
                </p>
              ) : (
                <ul className="divide-y" style={{ borderColor: colors.border }}>
                  {recentUsers.slice(0, 5).map(u => (
                    <li key={u.id} className="flex items-center gap-3 px-5 py-3 hover:bg-gray-50/60 dark:hover:bg-gray-800/40 transition-colors">
                      <Avatar name={u.fullname || u.email} size="sm" />
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
              ) : recentEnrollments.length === 0 ? (
                <p className="px-5 py-6 text-sm text-center" style={{ color: colors.muted }}>
                  {t('common:nothing_here', { defaultValue: 'Nothing here yet.' })}
                </p>
              ) : (
                <ul className="divide-y" style={{ borderColor: colors.border }}>
                  {recentEnrollments.slice(0, 5).map(e => (
                    <li key={e.id} className="flex items-center gap-3 px-5 py-3 hover:bg-gray-50/60 dark:hover:bg-gray-800/40 transition-colors">
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

function AdminLink({ to, icon: Icon, label }: { to: string; icon: typeof SettingsIcon; label: string }) {
  return (
    <Link to={to}>
      <Card hover className="h-full">
        <CardBody className="p-4 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-gradient-to-br from-cyan-500 to-teal-600">
            <Icon className="w-4 h-4 text-white" />
          </div>
          <span className="text-sm font-medium">{label}</span>
        </CardBody>
      </Card>
    </Link>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  const { isDark } = useTheme();
  return (
    <span className="inline-flex items-center gap-1.5" style={{ color: isDark ? '#9ca3af' : '#6b7280' }}>
      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
      {label}
    </span>
  );
}

/**
 * Two-line growth chart — signups + enrollments over the same 7-day
 * window. Pure SVG, no chart lib. Renders as filled areas with bold
 * stroke and labelled ticks.
 */
function GrowthDualLine({ days, signups, enrollments }: { days: string[]; signups: number[]; enrollments: number[] }) {
  const { isDark } = useTheme();
  const w = 600;
  const h = 160;
  const padX = 32;
  const padY = 24;
  const innerW = w - padX * 2;
  const innerH = h - padY * 2;
  const max = Math.max(1, ...signups, ...enrollments);

  const path = (values: number[]) => {
    if (values.length === 0) return '';
    const stepX = values.length > 1 ? innerW / (values.length - 1) : 0;
    return values
      .map((v, i) => {
        const x = padX + i * stepX;
        const y = padY + innerH - (v / max) * innerH;
        return `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(' ');
  };

  const areaPath = (values: number[]) => {
    if (values.length === 0) return '';
    const stepX = values.length > 1 ? innerW / (values.length - 1) : 0;
    const lineCmd = values
      .map((v, i) => {
        const x = padX + i * stepX;
        const y = padY + innerH - (v / max) * innerH;
        return `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(' ');
    return `${lineCmd} L ${(padX + innerW).toFixed(1)},${(padY + innerH).toFixed(1)} L ${padX.toFixed(1)},${(padY + innerH).toFixed(1)} Z`;
  };

  const grid = isDark ? '#1f2937' : '#f3f4f6';
  const tickColor = isDark ? '#6b7280' : '#9ca3af';

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full" preserveAspectRatio="none" style={{ height: 180 }}>
      {/* Grid lines */}
      {[0, 0.25, 0.5, 0.75, 1].map(t => {
        const y = padY + innerH * (1 - t);
        return (
          <line
            key={t}
            x1={padX}
            y1={y}
            x2={padX + innerW}
            y2={y}
            stroke={grid}
            strokeWidth={1}
          />
        );
      })}
      {/* Areas */}
      <path d={areaPath(signups)} fill="#0ea5e9" fillOpacity={0.10} />
      <path d={areaPath(enrollments)} fill="#f59e0b" fillOpacity={0.10} />
      {/* Lines */}
      <path d={path(signups)} fill="none" stroke="#0ea5e9" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
      <path d={path(enrollments)} fill="none" stroke="#f59e0b" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
      {/* X axis labels */}
      {days.map((d, i) => {
        const stepX = days.length > 1 ? innerW / (days.length - 1) : 0;
        const x = padX + i * stepX;
        const day = new Date(d).getUTCDate();
        return (
          <text
            key={d}
            x={x}
            y={h - 6}
            textAnchor="middle"
            fontSize="10"
            fill={tickColor}
          >
            {day}
          </text>
        );
      })}
    </svg>
  );
}
