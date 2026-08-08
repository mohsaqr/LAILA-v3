import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { ArrowLeft, ExternalLink } from 'lucide-react';
import { activityLogApi } from '../../api/admin';
import { Loading } from '../common/Loading';
import { ActivityDonutChart } from './ActivityDonutChart';
import { ActivityHeatmap } from './ActivityHeatmap';
import { ActivityTimelineChart } from './ActivityTimelineChart';
import { type PaletteName } from './colorFix';
import { resourceLink } from '../../utils/resourceLinks';

export interface ResourceRef {
  objectType: string;
  objectTitle: string;
  objectId: number | null;
  courseId?: number | null;
  lectureId?: number | null;
}

interface ResourceDetailProps {
  resource: ResourceRef;
  filters: { courseId?: number; userId?: number; startDate?: string; endDate?: string };
  resolveState: (verb: string, objectType: string) => string;
  palette: PaletteName;
  isStudent: boolean;
  onBack: () => void;
  /** Chain into a user drill-down from this resource's top users */
  onSelectUser: (user: { userId: number; name: string }) => void;
}

const Card = ({ children }: { children: React.ReactNode }) => (
  <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
    {children}
  </div>
);

const StatCard = ({ label, value }: { label: string; value: string }) => (
  <Card>
    <div className="text-xs text-gray-500 dark:text-gray-400">{label}</div>
    <div className="mt-1 text-xl font-semibold text-gray-800 dark:text-gray-100 truncate">{value}</div>
  </Card>
);

/** Carmdash-style per-resource analytics drill-down */
export const ResourceDetail = ({ resource, filters, resolveState, palette, isStudent, onBack, onSelectUser }: ResourceDetailProps) => {
  const { t } = useTranslation(['admin']);

  const { data, isLoading } = useQuery({
    queryKey: ['resourceDetail', resource.objectType, resource.objectId, resource.objectTitle, filters],
    queryFn: () =>
      activityLogApi.getResourceDetail({
        objectType: resource.objectType,
        objectId: resource.objectId,
        objectTitle: resource.objectTitle,
        ...filters,
      }),
    staleTime: 3_600_000,
  });

  /* Verb counts → learning-state counts for the distribution donut */
  const stateCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const [verb, n] of Object.entries(data?.verbCounts ?? {})) {
      const state = resolveState(verb, resource.objectType);
      counts[state] = (counts[state] ?? 0) + n;
    }
    return counts;
  }, [data, resolveState, resource.objectType]);

  const contentHref = resourceLink(resource);

  return (
    <div className="space-y-4">
      {/* Header: back + title + type + open-content link */}
      <div className="flex items-center gap-3 flex-wrap">
        <button onClick={onBack}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
          <ArrowLeft className="w-4 h-4" />
          {t('resources_title')}
        </button>
        <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100">{resource.objectTitle}</h2>
        <span className="inline-block px-2 py-0.5 rounded-full text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
          {resource.objectType}
        </span>
        {contentHref && (
          <Link to={contentHref}
            className="flex items-center gap-1 text-sm text-primary-600 dark:text-primary-400 hover:underline">
            <ExternalLink className="w-3.5 h-3.5" />
            {t('open_resource')}
          </Link>
        )}
      </div>

      {isLoading || !data ? (
        <div className="py-16"><Loading /></div>
      ) : (
        <>
          {/* Stats bar */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard label={t('total_activities')} value={data.summary.count.toLocaleString()} />
            <StatCard label={t('unique_users')} value={String(data.summary.uniqueUsers)} />
            <StatCard label={t('unique_sessions')} value={String(data.summary.uniqueSessions)} />
            <StatCard label={t('date_range')} value={
              data.summary.firstAccess && data.summary.lastAccess
                ? `${new Date(data.summary.firstAccess).toLocaleDateString()} – ${new Date(data.summary.lastAccess).toLocaleDateString()}`
                : '—'
            } />
          </div>

          {/* Distribution donut + access heatmap */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <ActivityDonutChart data={stateCounts} title={t('activity_distribution')} palette={palette} />
            <Card>
              <h3 className="text-base font-semibold text-gray-800 dark:text-gray-200 mb-3">
                {t('access_heatmap')}
              </h3>
              {data.hourly.data.length > 0 ? (
                <ActivityHeatmap data={data.hourly.data} />
              ) : (
                <div className="text-center py-8 text-gray-500 dark:text-gray-400 text-sm">{t('no_data')}</div>
              )}
            </Card>
          </div>

          {/* Access over time */}
          <Card>
            <h3 className="text-base font-semibold text-gray-800 dark:text-gray-200 mb-3">
              {t('access_over_time')}
            </h3>
            {data.daily.days.length > 1 ? (
              <ActivityTimelineChart
                days={data.daily.days}
                verbs={data.daily.verbs}
                series={data.daily.series}
                palette={palette}
              />
            ) : (
              <div className="text-center py-8 text-gray-500 dark:text-gray-400 text-sm">{t('no_data')}</div>
            )}
          </Card>

          {/* Top users (hidden for students — their view is already self-scoped) */}
          {!isStudent && data.topUsers.length > 0 && (
            <Card>
              <h3 className="text-base font-semibold text-gray-800 dark:text-gray-200 mb-3">
                {t('top_users')}
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 dark:border-gray-700">
                      <th className="text-left py-2 px-3 text-gray-500 dark:text-gray-400 font-medium">#</th>
                      <th className="text-left py-2 px-3 text-gray-500 dark:text-gray-400 font-medium">{t('user')}</th>
                      <th className="text-right py-2 px-3 text-gray-500 dark:text-gray-400 font-medium">{t('total_activities')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.topUsers.map((u, idx) => {
                      const barPct = data.topUsers[0].count > 0 ? (u.count / data.topUsers[0].count) * 100 : 0;
                      return (
                        <tr key={u.userId}
                          className="border-b border-gray-100 dark:border-gray-700/50">
                          <td className="py-2 px-3 text-gray-400 dark:text-gray-500 font-mono text-xs">{idx + 1}</td>
                          <td className="py-2 px-3">
                            <div className="relative">
                              <div className="absolute inset-0 rounded"
                                style={{ width: `${barPct}%`, backgroundColor: 'rgba(90,180,172,0.12)' }} />
                              <button onClick={() => onSelectUser(u)}
                                className="relative text-primary-700 dark:text-primary-400 text-left hover:underline">
                                {u.name}
                              </button>
                            </div>
                          </td>
                          <td className="py-2 px-3 text-right tabular-nums font-semibold text-gray-700 dark:text-gray-300">{u.count.toLocaleString()}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </>
      )}
    </div>
  );
};
