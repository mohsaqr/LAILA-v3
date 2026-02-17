import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Users, Activity, Hash, Settings2 } from 'lucide-react';
import { tna, prune } from 'tnaj';
import type { TNA as TNAModel } from 'tnaj';
import { activityLogApi } from '../../api/admin';
import { useTheme } from '../../hooks/useTheme';
import { StatCard } from '../../components/admin';
import { Loading } from '../../components/common/Loading';
import { TnaDistributionPlot } from '../../components/tna/TnaDistributionPlot';
import { TnaFrequencyChart } from '../../components/tna/TnaFrequencyChart';
import { TnaNetworkGraph } from '../../components/tna/TnaNetworkGraph';

export const Dashboard = () => {
  const { t } = useTranslation(['admin']);
  const { isDark } = useTheme();

  // Filter state
  const [courseId, setCourseId] = useState<number | undefined>(undefined);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [pruneThreshold, setPruneThreshold] = useState(0.05);

  // Network graph settings
  const [showSelfLoops, setShowSelfLoops] = useState(true);
  const [showEdgeLabels, setShowEdgeLabels] = useState(false);
  const [nodeRadius, setNodeRadius] = useState(25);
  const [graphHeight, setGraphHeight] = useState(500);
  const [networkSettingsOpen, setNetworkSettingsOpen] = useState(false);

  // Fetch filter options (courses)
  const { data: filterOptions } = useQuery({
    queryKey: ['activityLogFilterOptions'],
    queryFn: () => activityLogApi.getFilterOptions(),
  });

  // Fetch TNA sequences
  const { data: tnaData, isLoading } = useQuery({
    queryKey: ['tnaSequences', courseId, startDate, endDate],
    queryFn: () =>
      activityLogApi.getTnaSequences({
        courseId,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        minSequenceLength: 2,
      }),
  });

  // Compute TNA models
  const { prunedModel, labels } = useMemo(() => {
    if (!tnaData?.sequences?.length) {
      return { prunedModel: null, labels: [] };
    }

    const seqs = tnaData.sequences;
    const lbls = tnaData.metadata.uniqueVerbs;

    try {
      const tnaM = tna(seqs, { labels: lbls });
      const prunedM = prune(tnaM, pruneThreshold) as TNAModel;
      return { prunedModel: prunedM, labels: lbls };
    } catch {
      return { prunedModel: null, labels: lbls };
    }
  }, [tnaData, pruneThreshold]);

  const colors = {
    bgBlue: isDark ? 'rgba(59, 130, 246, 0.2)' : '#dbeafe',
    bgGreen: isDark ? 'rgba(34, 197, 94, 0.2)' : '#dcfce7',
    bgTeal: isDark ? 'rgba(8, 143, 143, 0.2)' : '#f0fdfd',
    textBlue: isDark ? '#93c5fd' : '#2563eb',
    textGreen: isDark ? '#86efac' : '#16a34a',
    textTeal: isDark ? '#5eecec' : '#088F8F',
  };

  if (isLoading) {
    return <Loading fullScreen text={t('loading_dashboard')} />;
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="px-4 sm:px-6 lg:px-8 py-6">
        {/* Header + Filter Bar */}
        <div className="flex flex-wrap gap-3 mb-4 items-end">
          <div className="mr-auto">
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">
              {t('dashboard')}
            </h1>
          </div>

          {/* Course selector */}
          <div className="flex flex-col gap-1">
            <label className="text-xs text-gray-500 dark:text-gray-400">
              {t('course')}
            </label>
            <select
              value={courseId ?? ''}
              onChange={e => setCourseId(e.target.value ? parseInt(e.target.value) : undefined)}
              className="px-3 py-1.5 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300"
            >
              <option value="">{t('all_courses')}</option>
              {filterOptions?.courses?.map((c: any) => (
                <option key={c.id} value={c.id!}>
                  {c.title}
                </option>
              ))}
            </select>
          </div>

          {/* Date range */}
          <div className="flex flex-col gap-1">
            <label className="text-xs text-gray-500 dark:text-gray-400">
              {t('start_date')}
            </label>
            <input
              type="date"
              value={startDate}
              onChange={e => setStartDate(e.target.value)}
              className="px-3 py-1.5 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-gray-500 dark:text-gray-400">
              {t('end_date')}
            </label>
            <input
              type="date"
              value={endDate}
              onChange={e => setEndDate(e.target.value)}
              className="px-3 py-1.5 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300"
            />
          </div>

          {/* Prune threshold */}
          <div className="flex flex-col gap-1">
            <label className="text-xs text-gray-500 dark:text-gray-400">
              {t('prune_threshold')}: {pruneThreshold.toFixed(2)}
            </label>
            <input
              type="range"
              min={0}
              max={0.5}
              step={0.01}
              value={pruneThreshold}
              onChange={e => setPruneThreshold(parseFloat(e.target.value))}
              className="w-32"
            />
          </div>
        </div>

        {/* Metadata Stats */}
        {tnaData && (
          <div className="grid grid-cols-3 gap-4 mb-4">
            <StatCard
              icon={<Users className="w-5 h-5" style={{ color: colors.textBlue }} />}
              iconBgColor={colors.bgBlue}
              value={tnaData.metadata.totalUsers}
              label={t('users_count')}
            />
            <StatCard
              icon={<Activity className="w-5 h-5" style={{ color: colors.textGreen }} />}
              iconBgColor={colors.bgGreen}
              value={tnaData.metadata.totalEvents}
              label={t('events_count')}
            />
            <StatCard
              icon={<Hash className="w-5 h-5" style={{ color: colors.textTeal }} />}
              iconBgColor={colors.bgTeal}
              value={tnaData.metadata.uniqueVerbs.length}
              label={t('verbs_count')}
            />
          </div>
        )}

        {/* Content */}
        {!tnaData?.sequences?.length ? (
          <div className="text-center py-16 text-gray-500 dark:text-gray-400">
            {t('no_tna_data')}
          </div>
        ) : (
          <div className="space-y-6">
            {/* Network — first, full width */}
            {prunedModel && (
              <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
                <div className="flex items-center justify-between mb-1">
                  <h3 className="text-base font-semibold text-gray-800 dark:text-gray-200">
                    {t('network_title')}
                  </h3>
                  <button
                    onClick={() => setNetworkSettingsOpen(!networkSettingsOpen)}
                    className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                    title={t('network_settings')}
                  >
                    <Settings2 className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                  </button>
                </div>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                  {t('network_desc')}
                </p>
                {networkSettingsOpen && (
                  <div className="mb-4 flex flex-wrap gap-4 items-center text-sm">
                    <label className="flex items-center gap-1.5 text-gray-600 dark:text-gray-300">
                      <input
                        type="checkbox"
                        checked={showSelfLoops}
                        onChange={e => setShowSelfLoops(e.target.checked)}
                        className="rounded"
                      />
                      {t('show_self_loops')}
                    </label>
                    <label className="flex items-center gap-1.5 text-gray-600 dark:text-gray-300">
                      <input
                        type="checkbox"
                        checked={showEdgeLabels}
                        onChange={e => setShowEdgeLabels(e.target.checked)}
                        className="rounded"
                      />
                      {t('show_edge_labels')}
                    </label>
                    <label className="flex items-center gap-1.5 text-gray-600 dark:text-gray-300">
                      {t('node_radius')}: {nodeRadius}
                      <input
                        type="range"
                        min={15}
                        max={50}
                        value={nodeRadius}
                        onChange={e => setNodeRadius(parseInt(e.target.value))}
                        className="w-24"
                      />
                    </label>
                    <label className="flex items-center gap-1.5 text-gray-600 dark:text-gray-300">
                      {t('graph_height')}: {graphHeight}
                      <input
                        type="range"
                        min={300}
                        max={800}
                        step={50}
                        value={graphHeight}
                        onChange={e => setGraphHeight(parseInt(e.target.value))}
                        className="w-24"
                      />
                    </label>
                  </div>
                )}
                <TnaNetworkGraph
                  model={prunedModel}
                  showSelfLoops={showSelfLoops}
                  showEdgeLabels={showEdgeLabels}
                  nodeRadius={nodeRadius}
                  height={graphHeight}
                />
              </div>
            )}

            {/* Distribution + Frequencies side by side */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
                <h3 className="text-base font-semibold mb-1 text-gray-800 dark:text-gray-200">
                  {t('distribution_title')}
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                  {t('distribution_desc')}
                </p>
                <TnaDistributionPlot sequences={tnaData.sequences} labels={labels} />
              </div>

              <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
                <h3 className="text-base font-semibold mb-1 text-gray-800 dark:text-gray-200">
                  {t('frequencies_title')}
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                  {t('frequencies_desc')}
                </p>
                <TnaFrequencyChart sequences={tnaData.sequences} labels={labels} />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
