import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Users, Activity, Hash, Settings2, Network, GitBranch } from 'lucide-react';
import { tna, ftna, atna, prune, createColorMap, centralities, communities, summary } from 'tnaj';
import type { TNA as TNAModel, CentralityMeasure, CommunityMethod } from 'tnaj';
import { activityLogApi } from '../../api/admin';
import { useTheme } from '../../hooks/useTheme';
import { StatCard } from '../../components/admin';
import { Loading } from '../../components/common/Loading';
import { TnaDistributionPlot } from '../../components/tna/TnaDistributionPlot';
import { TnaFrequencyChart } from '../../components/tna/TnaFrequencyChart';
import { TnaNetworkGraph } from '../../components/tna/TnaNetworkGraph';
import { TnaCentralityTable } from '../../components/tna/TnaCentralityTable';
import { fixColorMap } from '../../components/tna/colorFix';

type ModelType = 'relative' | 'frequency' | 'attention';

const MODEL_BUILDERS: Record<ModelType, typeof tna> = {
  relative: tna,
  frequency: ftna,
  attention: atna,
};

const NODE_SIZE_OPTIONS: { value: CentralityMeasure | 'fixed'; i18nKey: string }[] = [
  { value: 'fixed', i18nKey: 'fixed_size' },
  { value: 'OutStrength', i18nKey: 'out_strength' },
  { value: 'InStrength', i18nKey: 'in_strength' },
  { value: 'Betweenness', i18nKey: 'betweenness' },
  { value: 'Closeness', i18nKey: 'closeness' },
];

const COMMUNITY_METHODS: { value: CommunityMethod; label: string }[] = [
  { value: 'louvain', label: 'Louvain' },
  { value: 'fast_greedy', label: 'Fast Greedy' },
  { value: 'walktrap', label: 'Walktrap' },
];

export const Dashboard = () => {
  const { t } = useTranslation(['admin']);
  const { isDark } = useTheme();

  // Filter state
  const [courseId, setCourseId] = useState<number | undefined>(undefined);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [pruneThreshold, setPruneThreshold] = useState(0.05);
  const [modelType, setModelType] = useState<ModelType>('relative');

  // Network graph settings
  const [showSelfLoops, setShowSelfLoops] = useState(false);
  const [showEdgeLabels, setShowEdgeLabels] = useState(true);
  const [nodeRadius, setNodeRadius] = useState(25);
  const [graphHeight, setGraphHeight] = useState(500);
  const [networkSettingsOpen, setNetworkSettingsOpen] = useState(false);
  const [showCommunities, setShowCommunities] = useState(false);
  const [communityMethod, setCommunityMethod] = useState<CommunityMethod>('louvain');
  const [nodeSizeMetric, setNodeSizeMetric] = useState<CentralityMeasure | 'fixed'>('fixed');

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

  // Compute TNA model + analytics
  const { prunedModel, labels, colorMap, centralityData, communityData, summaryData } = useMemo(() => {
    if (!tnaData?.sequences?.length) {
      return { prunedModel: null, labels: [], colorMap: {}, centralityData: null, communityData: null, summaryData: null };
    }

    const seqs = tnaData.sequences;
    const lbls = tnaData.metadata.uniqueVerbs;

    try {
      const builder = MODEL_BUILDERS[modelType];
      const rawModel = builder(seqs, { labels: lbls });
      const prunedM = prune(rawModel, pruneThreshold) as TNAModel;

      // Shared color map
      const rawColorMap = createColorMap(lbls);
      const fixedColorMap = fixColorMap(rawColorMap);

      // Centralities (on unpruned model for better results)
      let cent = null;
      try {
        cent = centralities(rawModel);
      } catch { /* ignore */ }

      // Communities (on unpruned model)
      let comm = null;
      try {
        comm = communities(rawModel) as import('tnaj').CommunityResult;
      } catch { /* ignore */ }

      // Summary
      let sum = null;
      try {
        sum = summary(rawModel);
      } catch { /* ignore */ }

      return {
        prunedModel: prunedM,
        labels: lbls,
        colorMap: fixedColorMap,
        centralityData: cent,
        communityData: comm,
        summaryData: sum,
      };
    } catch {
      return { prunedModel: null, labels: lbls, colorMap: {}, centralityData: null, communityData: null, summaryData: null };
    }
  }, [tnaData, pruneThreshold, modelType]);

  const colors = {
    bgBlue: isDark ? 'rgba(59, 130, 246, 0.2)' : '#dbeafe',
    bgGreen: isDark ? 'rgba(34, 197, 94, 0.2)' : '#dcfce7',
    bgTeal: isDark ? 'rgba(8, 143, 143, 0.2)' : '#f0fdfd',
    bgPurple: isDark ? 'rgba(139, 92, 246, 0.2)' : '#ede9fe',
    bgOrange: isDark ? 'rgba(249, 115, 22, 0.2)' : '#ffedd5',
    textBlue: isDark ? '#93c5fd' : '#2563eb',
    textGreen: isDark ? '#86efac' : '#16a34a',
    textTeal: isDark ? '#5eecec' : '#088F8F',
    textPurple: isDark ? '#c4b5fd' : '#7c3aed',
    textOrange: isDark ? '#fdba74' : '#ea580c',
  };

  // Extract summary stats
  const density = summaryData?.density as number | undefined;
  const edgeCount = summaryData?.nEdges as number | undefined;

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

          {/* Model type */}
          <div className="flex flex-col gap-1">
            <label className="text-xs text-gray-500 dark:text-gray-400">
              {t('model_type')}
            </label>
            <select
              value={modelType}
              onChange={e => setModelType(e.target.value as ModelType)}
              className="px-3 py-1.5 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300"
            >
              <option value="relative">{t('model_relative')}</option>
              <option value="frequency">{t('model_frequency')}</option>
              <option value="attention">{t('model_attention')}</option>
            </select>
          </div>
        </div>

        {/* Metadata Stats */}
        {tnaData && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 mb-4">
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
            {density != null && (
              <StatCard
                icon={<Network className="w-5 h-5" style={{ color: colors.textPurple }} />}
                iconBgColor={colors.bgPurple}
                value={`${(density * 100).toFixed(1)}%`}
                label={t('network_density')}
              />
            )}
            {edgeCount != null && (
              <StatCard
                icon={<GitBranch className="w-5 h-5" style={{ color: colors.textOrange }} />}
                iconBgColor={colors.bgOrange}
                value={edgeCount}
                label={t('edges_count')}
              />
            )}
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

                    {/* Communities */}
                    <label className="flex items-center gap-1.5 text-gray-600 dark:text-gray-300">
                      <input
                        type="checkbox"
                        checked={showCommunities}
                        onChange={e => setShowCommunities(e.target.checked)}
                        className="rounded"
                      />
                      {t('show_communities')}
                    </label>
                    {showCommunities && (
                      <select
                        value={communityMethod}
                        onChange={e => setCommunityMethod(e.target.value as CommunityMethod)}
                        className="px-2 py-1 text-sm rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300"
                      >
                        {COMMUNITY_METHODS.map(m => (
                          <option key={m.value} value={m.value}>{m.label}</option>
                        ))}
                      </select>
                    )}

                    {/* Node size metric */}
                    <label className="flex items-center gap-1.5 text-gray-600 dark:text-gray-300">
                      {t('node_size_by')}:
                      <select
                        value={nodeSizeMetric}
                        onChange={e => setNodeSizeMetric(e.target.value as CentralityMeasure | 'fixed')}
                        className="px-2 py-1 text-sm rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300"
                      >
                        {NODE_SIZE_OPTIONS.map(opt => (
                          <option key={opt.value} value={opt.value}>{t(opt.i18nKey)}</option>
                        ))}
                      </select>
                    </label>
                  </div>
                )}
                <TnaNetworkGraph
                  model={prunedModel}
                  showSelfLoops={showSelfLoops}
                  showEdgeLabels={showEdgeLabels}
                  nodeRadius={nodeRadius}
                  height={graphHeight}
                  colorMap={colorMap}
                  centralityData={centralityData ?? undefined}
                  nodeSizeMetric={nodeSizeMetric}
                  communityData={showCommunities ? (communityData ?? undefined) : undefined}
                  communityMethod={showCommunities ? communityMethod : undefined}
                />
              </div>
            )}

            {/* Centrality Table */}
            {centralityData && (
              <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
                <h3 className="text-base font-semibold mb-1 text-gray-800 dark:text-gray-200">
                  {t('centrality_title')}
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                  {t('centrality_desc')}
                </p>
                <TnaCentralityTable
                  centralityData={centralityData}
                  colorMap={colorMap}
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
                <TnaDistributionPlot sequences={tnaData.sequences} labels={labels} colorMap={colorMap} />
              </div>

              <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
                <h3 className="text-base font-semibold mb-1 text-gray-800 dark:text-gray-200">
                  {t('frequencies_title')}
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                  {t('frequencies_desc')}
                </p>
                <TnaFrequencyChart sequences={tnaData.sequences} labels={labels} colorMap={colorMap} />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
