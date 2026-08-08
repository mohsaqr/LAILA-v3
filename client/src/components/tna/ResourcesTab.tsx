import { useState, useMemo, useEffect, type CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { Search } from 'lucide-react';
import { activityLogApi } from '../../api/admin';
import { Loading } from '../common/Loading';
import { ActivityDonutChart } from './ActivityDonutChart';
import { createColorMap, type PaletteName } from './colorFix';

export interface ResourceMetricsRow {
  objectType: string;
  objectTitle: string;
  objectId: number | null;
  courseId: number | null;
  lectureId: number | null;
  count: number;
  uniqueUsers: number;
  uniqueSessions: number;
  firstAccess: number;
  lastAccess: number;
  totalDuration: number;
  verbCounts: Record<string, number>;
}

interface ResourcesTabProps {
  data: ResourceMetricsRow[] | undefined;
  isLoading: boolean;
  /** Maps a verb + objectType to a learning state (Dashboard's interpretation chain) */
  resolveState: (verb: string, objectType: string) => string;
  palette: PaletteName;
  isStudent: boolean;
  /** Open the analytics drill-down for one resource */
  onSelect: (resource: ResourceMetricsRow) => void;
  /** Open the analytics drill-down for one user */
  onSelectUser: (user: { userId: number; name: string }) => void;
  /** Filters forwarded to the top-users query (same scope as the metrics) */
  filters: { courseId?: number; startDate?: string; endDate?: string };
}

type SortKey = 'count' | 'uniqueUsers' | 'lastAccess' | 'objectTitle';

// Soft tinted pill: translucent fill + raw-color text + faint inset border.
function chipStyle(color: string): CSSProperties {
  const c = color || '#888';
  return {
    background: `color-mix(in srgb, ${c} 14%, transparent)`,
    color: c,
    boxShadow: `inset 0 0 0 1px color-mix(in srgb, ${c} 32%, transparent)`,
  };
}

const Card = ({ children }: { children: React.ReactNode }) => (
  <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
    {children}
  </div>
);

const StatCard = ({ label, value }: { label: string; value: string }) => (
  <Card>
    <div className="text-xs text-gray-500 dark:text-gray-400">{label}</div>
    <div className="mt-1 text-2xl font-semibold text-gray-800 dark:text-gray-100 truncate">{value}</div>
  </Card>
);

export const ResourcesTab = ({ data, isLoading, resolveState, palette, isStudent, onSelect, onSelectUser, filters }: ResourcesTabProps) => {
  const { t } = useTranslation(['admin']);
  const [sortBy, setSortBy] = useState<SortKey>('count');
  const [sortAsc, setSortAsc] = useState(false);
  const [maxRows, setMaxRows] = useState(25);

  /* Top / searched users (staff only) — debounced server-side search */
  const [userSearch, setUserSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(userSearch.trim()), 300);
    return () => clearTimeout(timer);
  }, [userSearch]);
  const { data: topUsers, isLoading: topUsersLoading } = useQuery({
    queryKey: ['topUsers', filters, debouncedSearch],
    queryFn: () => activityLogApi.getTopUsers({ ...filters, search: debouncedSearch || undefined, limit: 10 }),
    enabled: !isStudent,
    staleTime: 3_600_000,
  });

  /* Per-resource learning-state counts + a global state order for colors */
  const { stateCountsByRow, states, stateColorMap, typeTotals } = useMemo(() => {
    const rows = data ?? [];
    const globalStateTotals: Record<string, number> = {};
    const typeTotals: Record<string, number> = {};
    const stateCountsByRow = rows.map(row => {
      const counts: Record<string, number> = {};
      for (const [verb, n] of Object.entries(row.verbCounts)) {
        const state = resolveState(verb, row.objectType);
        counts[state] = (counts[state] ?? 0) + n;
        globalStateTotals[state] = (globalStateTotals[state] ?? 0) + n;
      }
      typeTotals[row.objectType] = (typeTotals[row.objectType] ?? 0) + row.count;
      return counts;
    });
    const states = Object.keys(globalStateTotals).sort((a, b) => globalStateTotals[b] - globalStateTotals[a]);
    return { stateCountsByRow, states, stateColorMap: createColorMap(states, palette), typeTotals };
  }, [data, resolveState, palette]);

  const order = useMemo(() => {
    const rows = data ?? [];
    const idx = rows.map((_, i) => i);
    idx.sort((a, b) => {
      const ra = rows[a], rb = rows[b];
      const diff = sortBy === 'objectTitle'
        ? ra.objectTitle.localeCompare(rb.objectTitle)
        : ra[sortBy] - rb[sortBy];
      return sortAsc ? diff : -diff;
    });
    return idx;
  }, [data, sortBy, sortAsc]);

  if (isLoading) return <div className="py-16"><Loading /></div>;

  const rows = data ?? [];
  if (rows.length === 0) {
    return <div className="text-center py-16 text-gray-500 dark:text-gray-400">{t('no_tna_data')}</div>;
  }

  const totalEvents = rows.reduce((s, r) => s + r.count, 0);
  const maxCount = Math.max(...rows.map(r => r.count), 1);
  const topType = Object.entries(typeTotals).sort((a, b) => b[1] - a[1])[0]?.[0] ?? '—';
  const lastActivity = Math.max(...rows.map(r => r.lastAccess));

  const handleSort = (key: SortKey) => {
    if (sortBy === key) setSortAsc(!sortAsc);
    else { setSortBy(key); setSortAsc(false); }
  };
  const arrow = (key: SortKey) => (sortBy === key ? (sortAsc ? ' ↑' : ' ↓') : '');
  const displayed = order.slice(0, maxRows);

  return (
    <div className="space-y-4">
      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label={t('resources_count')} value={rows.length.toLocaleString()} />
        <StatCard label={t('total_activities')} value={totalEvents.toLocaleString()} />
        <StatCard label={t('most_active_type')} value={topType} />
        <StatCard label={t('last_activity')} value={new Date(lastActivity).toLocaleDateString()} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Events by type donut (renders its own card + title) */}
        <ActivityDonutChart data={typeTotals} title={t('events_by_type')} palette={palette} />

        {/* State legend */}
        <Card>
          <h3 className="text-base font-semibold text-gray-800 dark:text-gray-200 mb-3">
            {t('state_distribution')}
          </h3>
          <div className="flex flex-wrap gap-1.5">
            {states.map(s => (
              <span key={s} className="inline-block rounded-full px-3 py-1 text-[13px] font-semibold leading-tight"
                style={chipStyle(stateColorMap[s])}>
                {s}
              </span>
            ))}
          </div>
        </Card>

        {/* Most used resource highlight */}
        <Card>
          <h3 className="text-base font-semibold text-gray-800 dark:text-gray-200 mb-3">
            {t('most_used_resource')}
          </h3>
          {(() => {
            const top = rows.reduce((best, r) => (r.count > best.count ? r : best), rows[0]);
            return (
              <div>
                <button onClick={() => onSelect(top)}
                  className="font-medium text-primary-700 dark:text-primary-400 truncate block text-left hover:underline">
                  {top.objectTitle}
                </button>
                <div className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  {top.count.toLocaleString()} {t('events_label')}
                  {!isStudent && <> · {top.uniqueUsers} {t('unique_users')}</>}
                </div>
                <span className="mt-2 inline-block px-2 py-0.5 rounded-full text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
                  {top.objectType}
                </span>
              </div>
            );
          })()}
        </Card>
      </div>

      {/* Top / searched users (staff only) — click a user for their drill-down */}
      {!isStudent && (
        <Card>
          <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
            <h3 className="text-base font-semibold text-gray-800 dark:text-gray-200">
              {t('top_users')}
            </h3>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-gray-500 pointer-events-none" />
              <input
                type="text"
                value={userSearch}
                onChange={e => setUserSearch(e.target.value)}
                placeholder={t('search_users')}
                className="pl-8 pr-3 py-1.5 w-56 rounded-lg text-sm bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-gray-800 dark:text-gray-200 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
          </div>
          {topUsersLoading ? (
            <Loading />
          ) : topUsers && topUsers.data.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-700">
                    <th className="text-left py-2 px-3 text-gray-500 dark:text-gray-400 font-medium">#</th>
                    <th className="text-left py-2 px-3 text-gray-500 dark:text-gray-400 font-medium">{t('user')}</th>
                    <th className="text-right py-2 px-3 text-gray-500 dark:text-gray-400 font-medium">{t('total_activities')}</th>
                    <th className="text-right py-2 px-3 text-gray-500 dark:text-gray-400 font-medium">{t('unique_sessions')}</th>
                    <th className="text-right py-2 px-3 text-gray-500 dark:text-gray-400 font-medium">{t('last_activity')}</th>
                  </tr>
                </thead>
                <tbody>
                  {topUsers.data.map((u, idx) => {
                    const barPct = topUsers.data[0].count > 0 ? (u.count / topUsers.data[0].count) * 100 : 0;
                    return (
                      <tr key={u.userId}
                        className="border-b border-gray-100 dark:border-gray-700/50 hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                        <td className="py-2 px-3 text-gray-400 dark:text-gray-500 font-mono text-xs">{idx + 1}</td>
                        <td className="py-2 px-3">
                          <div className="relative">
                            <div className="absolute inset-0 rounded"
                              style={{ width: `${barPct}%`, backgroundColor: 'rgba(90,180,172,0.12)' }} />
                            <button onClick={() => onSelectUser(u)}
                              className="relative text-primary-700 dark:text-primary-400 font-medium text-left hover:underline">
                              {u.name}
                              {u.email && <span className="ml-2 text-xs text-gray-400 dark:text-gray-500 font-normal">{u.email}</span>}
                            </button>
                          </div>
                        </td>
                        <td className="py-2 px-3 text-right tabular-nums font-semibold text-gray-700 dark:text-gray-300">{u.count.toLocaleString()}</td>
                        <td className="py-2 px-3 text-right tabular-nums text-gray-500 dark:text-gray-400">{u.uniqueSessions}</td>
                        <td className="py-2 px-3 text-right text-gray-500 dark:text-gray-400 whitespace-nowrap text-xs">
                          {new Date(u.lastActive).toLocaleDateString()}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-sm text-gray-400 dark:text-gray-500 py-8 text-center">{t('no_data')}</div>
          )}
        </Card>
      )}

      {/* Resource table */}
      <Card>
        <h3 className="text-base font-semibold text-gray-800 dark:text-gray-200 mb-3">
          {t('resource_usage')}
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-700">
                <th className="text-left py-2 px-3 text-gray-500 dark:text-gray-400 font-medium">#</th>
                <th className="text-left py-2 px-3 text-gray-500 dark:text-gray-400 font-medium cursor-pointer select-none"
                  onClick={() => handleSort('objectTitle')}>{t('object')}{arrow('objectTitle')}</th>
                <th className="text-left py-2 px-3 text-gray-500 dark:text-gray-400 font-medium">{t('object_type')}</th>
                <th className="text-right py-2 px-3 text-gray-500 dark:text-gray-400 font-medium cursor-pointer select-none"
                  onClick={() => handleSort('count')}>{t('total_activities')}{arrow('count')}</th>
                {!isStudent && (
                  <th className="text-right py-2 px-3 text-gray-500 dark:text-gray-400 font-medium cursor-pointer select-none"
                    onClick={() => handleSort('uniqueUsers')}>{t('unique_users')}{arrow('uniqueUsers')}</th>
                )}
                <th className="text-left py-2 px-3 text-gray-500 dark:text-gray-400 font-medium min-w-[140px]">{t('state_distribution')}</th>
                <th className="text-right py-2 px-3 text-gray-500 dark:text-gray-400 font-medium cursor-pointer select-none"
                  onClick={() => handleSort('lastAccess')}>{t('last_access')}{arrow('lastAccess')}</th>
              </tr>
            </thead>
            <tbody>
              {displayed.map((rowIdx, rank) => {
                const r = rows[rowIdx];
                const stateCounts = stateCountsByRow[rowIdx];
                const stateTotal = Object.values(stateCounts).reduce((s, n) => s + n, 0);
                const barPct = (r.count / maxCount) * 100;
                return (
                  <tr key={`${r.objectType}-${r.objectId}-${rowIdx}`}
                    className="border-b border-gray-100 dark:border-gray-700/50 hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                    <td className="py-2 px-3 text-gray-400 dark:text-gray-500 font-mono text-xs">{rank + 1}</td>
                    <td className="py-2 px-3 max-w-[280px]">
                      <div className="relative">
                        <div className="absolute inset-0 rounded"
                          style={{ width: `${barPct}%`, backgroundColor: 'rgba(90,180,172,0.12)' }} />
                        <button onClick={() => onSelect(r)}
                          className="relative text-primary-700 dark:text-primary-400 font-medium truncate block text-left w-full hover:underline">
                          {r.objectTitle}
                        </button>
                      </div>
                    </td>
                    <td className="py-2 px-3">
                      <span className="inline-block px-2 py-0.5 rounded-full text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 whitespace-nowrap">
                        {r.objectType}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-right font-semibold text-gray-700 dark:text-gray-300 tabular-nums">{r.count.toLocaleString()}</td>
                    {!isStudent && (
                      <td className="py-2 px-3 text-right text-gray-500 dark:text-gray-400 tabular-nums">{r.uniqueUsers}</td>
                    )}
                    <td className="py-2 px-3">
                      {stateTotal > 0 && (
                        <div className="flex h-2.5 w-full min-w-[120px] rounded-full overflow-hidden bg-gray-100 dark:bg-gray-700/60"
                          title={states.filter(s => stateCounts[s]).map(s => `${s}: ${stateCounts[s]}`).join(' · ')}>
                          {states.filter(s => stateCounts[s]).map(s => (
                            <div key={s} style={{
                              width: `${(stateCounts[s] / stateTotal) * 100}%`,
                              backgroundColor: stateColorMap[s],
                            }} />
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="py-2 px-3 text-right text-gray-500 dark:text-gray-400 whitespace-nowrap text-xs">
                      {new Date(r.lastAccess).toLocaleDateString()}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {order.length > maxRows && (
          <button onClick={() => setMaxRows(prev => prev + 25)}
            className="mt-2 text-sm text-primary-600 dark:text-primary-400 hover:underline">
            {t('show_more')} ({order.length - maxRows} {t('remaining')})
          </button>
        )}
      </Card>
    </div>
  );
};
