import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Users, Activity, Hash } from 'lucide-react';
import { tna, prune } from 'tnaj';
import type { TNA as TNAModel } from 'tnaj';
import { activityLogApi } from '../../api/admin';
import { useTheme } from '../../hooks/useTheme';
import { AdminLayout, StatCard } from '../../components/admin';
import { Loading } from '../../components/common/Loading';
import { TnaDistributionPlot } from '../../components/tna/TnaDistributionPlot';
import { TnaFrequencyChart } from '../../components/tna/TnaFrequencyChart';
import { TnaNetworkGraph } from '../../components/tna/TnaNetworkGraph';

type TabId = 'distribution' | 'frequencies' | 'network';

export const Dashboard = () => {
  const { t } = useTranslation(['admin']);
  const { isDark } = useTheme();

  // Filter state
  const [courseId, setCourseId] = useState<number | undefined>(undefined);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [pruneThreshold, setPruneThreshold] = useState(0.05);
  const [activeTab, setActiveTab] = useState<TabId>('distribution');

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

  const tabs: { id: TabId; label: string }[] = [
    { id: 'distribution', label: t('distribution') },
    { id: 'frequencies', label: t('frequencies') },
    { id: 'network', label: t('network') },
  ];

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
    <AdminLayout title={t('dashboard')} description={t('dashboard_desc')}>
      {/* Filter Bar */}
      <div className="flex flex-wrap gap-3 mb-6 items-end">
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
        <div className="grid grid-cols-3 gap-4 mb-6">
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

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b border-gray-200 dark:border-gray-700">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab.id
                ? 'border-primary-600 text-primary-600 dark:text-primary-400'
                : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      {!tnaData?.sequences?.length ? (
        <div className="text-center py-16 text-gray-500 dark:text-gray-400">
          {t('no_tna_data')}
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
          {activeTab === 'distribution' && (
            <div>
              <h3 className="text-base font-semibold mb-1 text-gray-800 dark:text-gray-200">
                {t('distribution_title')}
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                {t('distribution_desc')}
              </p>
              <TnaDistributionPlot sequences={tnaData.sequences} labels={labels} />
            </div>
          )}

          {activeTab === 'frequencies' && (
            <div>
              <h3 className="text-base font-semibold mb-1 text-gray-800 dark:text-gray-200">
                {t('frequencies_title')}
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                {t('frequencies_desc')}
              </p>
              <TnaFrequencyChart sequences={tnaData.sequences} labels={labels} />
            </div>
          )}

          {activeTab === 'network' && prunedModel && (
            <div>
              <h3 className="text-base font-semibold mb-1 text-gray-800 dark:text-gray-200">
                {t('network_title')}
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                {t('network_desc')}
              </p>
              <TnaNetworkGraph model={prunedModel} />
            </div>
          )}
        </div>
      )}
    </AdminLayout>
  );
};
