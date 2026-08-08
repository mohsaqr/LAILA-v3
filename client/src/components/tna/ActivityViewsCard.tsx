import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Loading } from '../common/Loading';
import { ActivityDonutChart } from './ActivityDonutChart';
import { createColorMap, type PaletteName } from './colorFix';
import { renderCalendarTreemap } from './carm/calendar-treemap';
import { renderActivityGrid, type AxisFilter } from './activityGridRender';
import {
  buildCalData, buildGrid, formatWindowLabel, getWindowEnd, shiftWindow, snapToWindowStart,
  type ActivityEvent, type CalCategoryMode, type TimeMode,
} from './activityViews';

interface ActivityViewsCardProps {
  events: ActivityEvent[] | undefined;
  isLoading: boolean;
  /** Maps a verb + objectType to a learning state (Dashboard's interpretation chain) */
  resolveState: (verb: string, objectType: string) => string;
  palette: PaletteName;
  /** Open the analytics drill-down for one user (bubble clicks) */
  onSelectUser?: (user: { userId: number; name: string }) => void;
}

type ViewMode = 'heatmap' | 'swarm' | 'calendar';

interface DetailState {
  title: string;
  events: ActivityEvent[];
  /** Set when the detail came from a bubble click on one student. */
  student?: { userId: number; name: string };
}

const toggleClass = (active: boolean) =>
  `px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
    active
      ? 'bg-primary-600 text-white'
      : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
  }`;

/**
 * Student Activity card ported from Carmdash: a Heatmap | Bubbles | Calendar
 * toggle over a time grid with period navigation, plus a click-through detail
 * panel. All bucketing and drawing logic is the copied Carmdash code
 * (activityViews.ts / activityGridRender.ts / carm/calendar-treemap.ts);
 * this component only owns the React controls around it.
 */
export const ActivityViewsCard = ({ events, isLoading, resolveState, palette, onSelectUser }: ActivityViewsCardProps) => {
  const { t } = useTranslation(['admin']);
  const [mode, setMode] = useState<ViewMode>('swarm');
  const [timeMode, setTimeMode] = useState<TimeMode>('day_hour');
  const [windowStart, setWindowStart] = useState<number | null>(null);
  const [calCatMode, setCalCatMode] = useState<CalCategoryMode>('states');
  const [detail, setDetail] = useState<DetailState | null>(null);
  const svgRef = useRef<HTMLDivElement>(null);

  const getState = useMemo(
    () => (e: ActivityEvent) => resolveState(e.verb, e.objectType),
    [resolveState],
  );

  const { states, colorMap } = useMemo(() => {
    const totals: Record<string, number> = {};
    for (const e of events ?? []) {
      const st = getState(e);
      totals[st] = (totals[st] ?? 0) + 1;
    }
    const states = Object.keys(totals).sort((a, b) => totals[b] - totals[a]);
    return { states, colorMap: createColorMap(states, palette) };
  }, [events, getState, palette]);

  const gridData = useMemo(
    () => buildGrid(events ?? [], timeMode, windowStart, getState),
    [events, timeMode, windowStart, getState],
  );

  const calData = useMemo(
    () => (mode === 'calendar' ? buildCalData(events ?? [], calCatMode, getState) : null),
    [events, mode, calCatMode, getState],
  );

  const dataMaxTs = useMemo(() => {
    let max = 0;
    for (const e of events ?? []) if (e.timestamp > max) max = e.timestamp;
    return max;
  }, [events]);

  /* Detail panel: same filter chain as Carmdash's clickFilter. */
  const clickFilter = (filter: AxisFilter, title: string, studentFill?: string) => {
    const wEnd = windowStart !== null ? getWindowEnd(windowStart, timeMode) : 0;
    const evs = (events ?? []).filter(l => {
      if (l.timestamp <= 0) return false;
      if (windowStart !== null && (l.timestamp < windowStart || l.timestamp >= wEnd)) return false;
      if (studentFill && l.userName !== studentFill) return false;
      const cell = gridData.getCell(new Date(l.timestamp), l.timestamp);
      if (!cell) return false;
      if (filter.col !== undefined && cell[0] !== filter.col) return false;
      if (filter.row !== undefined && cell[1] !== filter.row) return false;
      return true;
    });
    const student = studentFill && evs.length > 0
      ? { userId: evs[0].userId, name: studentFill }
      : undefined;
    setDetail(evs.length > 0 ? { title, events: evs, student } : null);
  };

  /* Render the active view into the container. */
  useEffect(() => {
    const el = svgRef.current;
    if (!el || !events || events.length === 0) return;
    el.innerHTML = '';
    if (mode === 'calendar') {
      if (calData && calData.days.length > 0 && calData.labels.length > 0) {
        renderCalendarTreemap(el, calData, {
          colorMap,
          categoryLabel: t(`admin:activity_cat_${calCatMode}`),
        });
      }
    } else {
      renderActivityGrid(el, gridData, { mode, timeMode, colorMap, onClickFilter: clickFilter });
    }
    // clickFilter identity changes with its inputs; gridData/calData already cover them.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, timeMode, calCatMode, gridData, calData, colorMap, events, t]);

  const detailStats = useMemo(() => {
    if (!detail) return null;
    const users = new Set(detail.events.map(e => e.userName));
    const resources = new Set(detail.events.map(e => e.objectTitle).filter((x): x is string => !!x));
    const stateCounts: Record<string, number> = {};
    for (const e of detail.events) {
      const st = getState(e);
      stateCounts[st] = (stateCounts[st] ?? 0) + 1;
    }
    const resCounts = new Map<string, number>();
    for (const e of detail.events) {
      if (e.objectTitle) resCounts.set(e.objectTitle, (resCounts.get(e.objectTitle) ?? 0) + 1);
    }
    const topResources = Array.from(resCounts.entries()).sort(([, a], [, b]) => b - a).slice(0, 6);
    return { users: users.size, resources: resources.size, stateCounts, topResources };
  }, [detail, getState]);

  if (isLoading) return <div className="py-16"><Loading /></div>;
  if (!events || events.length === 0) return null;

  const navigate = (dir: 1 | -1) => {
    setDetail(null);
    setWindowStart(prev => {
      if (prev === null) {
        const anchor = dataMaxTs > 0 ? Math.min(dataMaxTs, Date.now()) : Date.now();
        return snapToWindowStart(anchor, timeMode);
      }
      return shiftWindow(prev, dir, timeMode);
    });
  };

  const isCalendar = mode === 'calendar';

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
      <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
        <h3 className="font-semibold text-gray-800 dark:text-gray-100">{t('admin:student_activity')}</h3>
        <div className="flex gap-1">
          <button className={toggleClass(mode === 'heatmap')} onClick={() => { setMode('heatmap'); setDetail(null); }}>
            {t('admin:view_heatmap')}
          </button>
          <button className={toggleClass(mode === 'swarm')} onClick={() => { setMode('swarm'); setDetail(null); }}>
            {t('admin:view_bubbles')}
          </button>
          <button className={toggleClass(mode === 'calendar')} onClick={() => { setMode('calendar'); setDetail(null); }}>
            {t('admin:view_calendar')}
          </button>
        </div>
      </div>

      {!isCalendar && (
        <div className="flex items-center flex-wrap gap-2 mb-2">
          <select
            value={timeMode}
            onChange={e => {
              setTimeMode(e.target.value as TimeMode);
              // Window meaning depends on timeMode, so reset to "All" when switching mode.
              setWindowStart(null);
              setDetail(null);
            }}
            className="text-xs rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 px-2 py-1"
          >
            <option value="day_hour">{t('admin:time_day_hour')}</option>
            <option value="week_day">{t('admin:time_week_day')}</option>
            <option value="month_day">{t('admin:time_month_day')}</option>
          </select>
          <div className="flex items-center gap-1 ml-2">
            <button className={toggleClass(false)} onClick={() => navigate(-1)} title={t('admin:previous_period')}>◀</button>
            <span className="text-xs font-semibold min-w-[140px] text-center text-gray-600 dark:text-gray-300">
              {windowStart === null ? t('admin:all_time') : formatWindowLabel(windowStart, timeMode)}
            </span>
            <button className={toggleClass(false)} onClick={() => navigate(1)} title={t('admin:next_period')}>▶</button>
            <button
              className={toggleClass(false)}
              onClick={() => { setWindowStart(snapToWindowStart(Date.now(), timeMode)); setDetail(null); }}
            >
              {t('admin:today')}
            </button>
            <button className={toggleClass(false)} onClick={() => { setWindowStart(null); setDetail(null); }}>
              {t('admin:all')}
            </button>
          </div>
        </div>
      )}

      {isCalendar && (
        <div className="flex items-center gap-1 mb-2">
          {(['states', 'resources', 'types'] as const).map(m => (
            <button key={m} className={toggleClass(calCatMode === m)} onClick={() => setCalCatMode(m)}>
              {t(`admin:activity_cat_${m}`)}
            </button>
          ))}
        </div>
      )}

      {/* Carmdash charts are drawn on a white surface in both themes,
          matching the simplicial small-multiples precedent. */}
      <div ref={svgRef} className="bg-white rounded-lg" />

      {!isCalendar && (
        <div className="flex gap-3 flex-wrap mt-2">
          {states.map(st => (
            <span key={st} className="flex items-center gap-1 text-[10px] text-gray-500 dark:text-gray-400">
              <span className="w-2 h-2 rounded-full inline-block" style={{ background: colorMap[st] ?? '#888' }} />
              {st}
            </span>
          ))}
        </div>
      )}

      {detail && detailStats && (
        <div className="mt-3 rounded-lg border border-gray-200 dark:border-gray-700 p-3">
          <div className="flex items-center justify-between mb-2">
            <strong className="text-sm text-gray-800 dark:text-gray-100">{detail.title}</strong>
            <div className="flex items-center gap-1">
              {detail.student && onSelectUser && (
                <button
                  className="px-2.5 py-1 rounded-md text-xs font-medium text-primary-700 dark:text-primary-400 hover:underline"
                  onClick={() => onSelectUser(detail.student!)}
                >
                  {t('admin:view_user_analytics')}
                </button>
              )}
              <button className={toggleClass(false)} onClick={() => setDetail(null)}>✕</button>
            </div>
          </div>
          <div className="flex gap-6 mb-3">
            <div>
              <div className="text-lg font-semibold text-gray-800 dark:text-gray-100">{detail.events.length}</div>
              <div className="text-xs text-gray-500 dark:text-gray-400">{t('admin:events_label')}</div>
            </div>
            <div>
              <div className="text-lg font-semibold text-gray-800 dark:text-gray-100">{detailStats.users}</div>
              <div className="text-xs text-gray-500 dark:text-gray-400">{t('admin:users')}</div>
            </div>
            <div>
              <div className="text-lg font-semibold text-gray-800 dark:text-gray-100">{detailStats.resources}</div>
              <div className="text-xs text-gray-500 dark:text-gray-400">{t('admin:resources_title')}</div>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <ActivityDonutChart data={detailStats.stateCounts} title={t('admin:activity_distribution')} palette={palette} />
            {detailStats.topResources.length > 0 && (
              <div>
                <div className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">{t('admin:detail_top_resources')}</div>
                <table className="w-full text-sm">
                  <tbody>
                    {detailStats.topResources.map(([res, count]) => (
                      <tr key={res} className="border-t border-gray-100 dark:border-gray-700">
                        <td className="py-1 pr-2 text-gray-700 dark:text-gray-200 truncate max-w-[220px]">{res}</td>
                        <td className="py-1 text-right text-gray-500 dark:text-gray-400">{count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
