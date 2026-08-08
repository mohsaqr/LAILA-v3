import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, UserRound } from 'lucide-react';
import { activityLogApi } from '../../api/admin';
import { Loading } from '../common/Loading';
import { ActivityDonutChart } from './ActivityDonutChart';
import { ActivityHeatmap } from './ActivityHeatmap';
import { ActivityTimelineChart } from './ActivityTimelineChart';
import { type PaletteName } from './colorFix';
import { type ResourceRef } from './ResourceDetail';

export interface UserRef {
  userId: number;
  name: string;
}

interface UserDetailProps {
  user: UserRef;
  filters: { courseId?: number; startDate?: string; endDate?: string };
  resolveState: (verb: string, objectType: string) => string;
  palette: PaletteName;
  onBack: () => void;
  /** Chain into a resource drill-down from this user's top resources */
  onSelectResource: (resource: ResourceRef) => void;
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

/** Carmdash-style per-user analytics drill-down */
export const UserDetail = ({ user, filters, resolveState, palette, onBack, onSelectResource }: UserDetailProps) => {
  const { t } = useTranslation(['admin', 'common']);

  const { data, isLoading } = useQuery({
    queryKey: ['userDetail', user.userId, filters],
    queryFn: () => activityLogApi.getUserDetail({ userId: user.userId, ...filters }),
    staleTime: 3_600_000,
  });

  /* verb×objectType counts → learning-state counts for the donut */
  const stateCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const row of data?.verbObjectCounts ?? []) {
      const state = resolveState(row.verb, row.objectType);
      counts[state] = (counts[state] ?? 0) + row.count;
    }
    return counts;
  }, [data, resolveState]);

  return (
    <div className="space-y-4">
      {/* Header: back + user name */}
      <div className="flex items-center gap-3 flex-wrap">
        <button onClick={onBack}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
          <ArrowLeft className="w-4 h-4" />
          {t('common:back')}
        </button>
        <UserRound className="w-5 h-5 text-gray-400 dark:text-gray-500" />
        <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100">{user.name}</h2>
      </div>

      {isLoading || !data ? (
        <div className="py-16"><Loading /></div>
      ) : (
        <>
          {/* Stats bar */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard label={t('total_activities')} value={data.summary.count.toLocaleString()} />
            <StatCard label={t('unique_sessions')} value={String(data.summary.uniqueSessions)} />
            <StatCard label={t('courses')} value={String(data.summary.courses)} />
            <StatCard label={t('date_range')} value={
              data.summary.firstAccess && data.summary.lastAccess
                ? `${new Date(data.summary.firstAccess).toLocaleDateString()} – ${new Date(data.summary.lastAccess).toLocaleDateString()}`
                : '—'
            } />
          </div>

          {/* Distribution donut + activity heatmap */}
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

          {/* Activity over time */}
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

          {/* The user's top resources — chains into the resource drill-down */}
          {data.topResources.length > 0 && (
            <Card>
              <h3 className="text-base font-semibold text-gray-800 dark:text-gray-200 mb-3">
                {t('top_resources')}
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 dark:border-gray-700">
                      <th className="text-left py-2 px-3 text-gray-500 dark:text-gray-400 font-medium">#</th>
                      <th className="text-left py-2 px-3 text-gray-500 dark:text-gray-400 font-medium">{t('object')}</th>
                      <th className="text-left py-2 px-3 text-gray-500 dark:text-gray-400 font-medium">{t('object_type')}</th>
                      <th className="text-right py-2 px-3 text-gray-500 dark:text-gray-400 font-medium">{t('total_activities')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.topResources.map((r, idx) => {
                      const barPct = data.topResources[0].count > 0 ? (r.count / data.topResources[0].count) * 100 : 0;
                      return (
                        <tr key={`${r.objectType}-${r.objectId}-${idx}`}
                          className="border-b border-gray-100 dark:border-gray-700/50">
                          <td className="py-2 px-3 text-gray-400 dark:text-gray-500 font-mono text-xs">{idx + 1}</td>
                          <td className="py-2 px-3">
                            <div className="relative">
                              <div className="absolute inset-0 rounded"
                                style={{ width: `${barPct}%`, backgroundColor: 'rgba(90,180,172,0.12)' }} />
                              <button onClick={() => onSelectResource(r)}
                                className="relative text-primary-700 dark:text-primary-400 font-medium text-left hover:underline">
                                {r.objectTitle}
                              </button>
                            </div>
                          </td>
                          <td className="py-2 px-3">
                            <span className="inline-block px-2 py-0.5 rounded-full text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 whitespace-nowrap">
                              {r.objectType}
                            </span>
                          </td>
                          <td className="py-2 px-3 text-right tabular-nums font-semibold text-gray-700 dark:text-gray-300">{r.count.toLocaleString()}</td>
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
