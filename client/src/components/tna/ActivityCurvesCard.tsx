import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { renderLineChart } from './carm/line-chart';
import { hideTooltip } from './carm/carm-tooltip';
import { buildDailySeries, type ActivityEvent, type CalCategoryMode } from './activityViews';
import { createColorMap, type PaletteName } from './colorFix';

interface ActivityCurvesCardProps {
  events: ActivityEvent[] | undefined;
  resolveState: (verb: string, objectType: string) => string;
  palette: PaletteName;
}

const toggleClass = (active: boolean) =>
  `px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
    active
      ? 'bg-primary-600 text-white'
      : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
  }`;

const cap = (s: string) => (s.length > 0 ? s[0].toUpperCase() + s.slice(1) : s);
const truncate = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

/**
 * Daily stacked-area curves ported from Carmdash's activity tab: monotone
 * stacked areas of daily activity with a State | Resource | Type toggle.
 * Chart configs are the Carmdash originals; the copied renderLineChart
 * (carm/line-chart.ts) does the drawing. Series colors come from the
 * dashboard palette so states match the bubble/heatmap legend above.
 */
export const ActivityCurvesCard = ({ events, resolveState, palette }: ActivityCurvesCardProps) => {
  const { t } = useTranslation(['admin']);
  const [catMode, setCatMode] = useState<CalCategoryMode>('states');
  const chartRef = useRef<HTMLDivElement>(null);

  const getState = useMemo(
    () => (e: ActivityEvent) => resolveState(e.verb, e.objectType),
    [resolveState],
  );

  const daily = useMemo(
    () => buildDailySeries(events ?? [], catMode, getState),
    [events, catMode, getState],
  );

  /* Colors keyed by the DISPLAY label (capitalized/truncated), since that is
     what renderLineChart looks up. */
  const displaySeries = useMemo(() => {
    const rawColorMap = createColorMap(daily.labels, palette);
    const seriesColors: Record<string, string> = {};
    const series = daily.labels.map(label => {
      const display = truncate(cap(label), 18);
      seriesColors[display] = rawColorMap[label];
      return { label, display };
    });
    return { series, seriesColors };
  }, [daily, palette]);

  useEffect(() => {
    const el = chartRef.current;
    if (!el) return;
    if (daily.days.length < 2 || daily.labels.length === 0) { el.replaceChildren(); return; }

    // Fresh child per render so a stale async d3 render lands detached.
    const inner = document.createElement('div');
    el.replaceChildren(inner);

    const dayIndices = daily.days.map((_, i) => i);
    renderLineChart(inner, {
      series: displaySeries.series.map(({ label, display }) => ({
        label: display,
        x: dayIndices,
        y: daily.series[label],
      })),
    }, {
      stackedArea: true, curveMethod: 'monotone', showDots: false,
      title: t(`admin:daily_activity_${catMode}`), xLabel: t('admin:day_label'), yLabel: t('admin:events_label'),
      showLegend: true, legendPosition: 'bottom', height: 340,
      seriesColors: displaySeries.seriesColors,
      xTickFormat: (v: number) => daily.days[Math.round(v)]?.slice(5) ?? '',
    });

    return () => hideTooltip();
  }, [daily, displaySeries, catMode, t]);

  if (!events || events.length === 0) return null;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
      <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
        <h3 className="font-semibold text-gray-800 dark:text-gray-100">{t('admin:activity_over_time')}</h3>
        <div className="flex gap-1">
          {(['states', 'resources', 'types'] as const).map(m => (
            <button key={m} className={toggleClass(catMode === m)} onClick={() => setCatMode(m)}>
              {t(`admin:activity_cat_${m}`)}
            </button>
          ))}
        </div>
      </div>
      {/* Carmdash charts draw on a white surface in both themes. */}
      <div ref={chartRef} className="bg-white rounded-lg" />
    </div>
  );
};
