import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Expand } from 'lucide-react';
import { clusterData, tna, prune, centralities, stateFrequencies } from 'dynajs';
import type { TNA } from 'dynajs';
import { TnaNetworkGraph } from './TnaNetworkGraph';
import { TnaDistributionPlot } from './TnaDistributionPlot';
import { ClusterNetworkModal } from './NetworkModal';
import { createColorMap } from './colorFix';
import type { PaletteName } from './colorFix';

interface ClustersTabProps {
  sequences: string[][];
  labels: string[];
  k: number;
  onKChange: (k: number) => void;
  nodeRadius?: number;
  pruneThreshold?: number;
  showSelfLoops?: boolean;
  showEdgeLabels?: boolean;
  palette?: PaletteName;
  dissimilarity?: 'hamming' | 'lv' | 'osa' | 'lcs';
  clusterMethod?: 'pam' | 'single' | 'complete' | 'average' | 'ward';
}

interface ClusterDetail {
  clusterNum: number;
  size: number;
  pct: number;
  avgLen: number;
  sortedFreqs: [string, number][];
  clusterSeqs: string[][];
  clusterModel: TNA | null;
  instrength: { label: string; value: number }[] | null;
}

export const ClustersTab = ({
  sequences,
  labels,
  k,
  onKChange,
  nodeRadius: clusterNodeRadius = 16,
  pruneThreshold: clusterPruneThreshold = 0.05,
  showSelfLoops: clusterShowSelfLoops = false,
  showEdgeLabels: clusterShowEdgeLabels = true,
  palette,
  dissimilarity = 'hamming',
  clusterMethod = 'pam',
}: ClustersTabProps) => {
  const { t } = useTranslation(['admin']);

  const colorMap = useMemo(() => createColorMap(labels, palette), [labels, palette]);

  const result = useMemo(() => {
    if (!sequences?.length) return null;
    try {
      // Filter out very short sequences that would form trivial outlier clusters.
      // Use 10% of the median length as the minimum threshold.
      const sorted = sequences.map(s => s.length).sort((a, b) => a - b);
      const median = sorted[Math.floor(sorted.length / 2)] ?? 0;
      const minLen = Math.max(5, Math.floor(median * 0.1));
      const filtered = sequences.filter(s => s.length >= minLen);
      const seqsForClustering = filtered.length >= k ? filtered : sequences;

      const clusters = clusterData(seqsForClustering, k, { dissimilarity, method: clusterMethod });
      const totalSeqs = clusters.assignments.length;

      const details: ClusterDetail[] = clusters.sizes.map((size, cIdx) => {
        const clusterNum = cIdx + 1;
        const indices = clusters.assignments
          .map((a, i) => (a === clusterNum ? i : -1))
          .filter(i => i >= 0);

        const clusterSeqs = indices.map(i => seqsForClustering[i]);
        const freqs = stateFrequencies(clusterSeqs);
        const sortedFreqs = Object.entries(freqs).sort((a, b) => b[1] - a[1]) as [string, number][];

        const avgLen =
          indices.length > 0
            ? indices.reduce(
                (sum, idx) => sum + seqsForClustering[idx].filter((v: any) => v != null).length,
                0,
              ) / indices.length
            : 0;

        let clusterModel: TNA | null = null;
        let instrength: { label: string; value: number }[] | null = null;
        try {
          if (clusterSeqs.length >= 1) {
            const raw = tna(clusterSeqs, { labels });
            clusterModel = prune(raw, clusterPruneThreshold) as TNA;
            try {
              const cent = centralities(raw);
              const vals = Array.from(cent.measures.InStrength);
              instrength = cent.labels
                .map((l, i) => ({ label: l, value: vals[i] }))
                .sort((a, b) => b.value - a.value);
            } catch { /* ignore */ }
          }
        } catch { /* not enough data */ }

        return { clusterNum, size, pct: (size / totalSeqs) * 100, avgLen, sortedFreqs, clusterSeqs, clusterModel, instrength };
      });

      return { clusters, details };
    } catch {
      return null;
    }
  }, [sequences, labels, k, clusterPruneThreshold, dissimilarity, clusterMethod]);

  const silQuality =
    result && result.clusters.silhouette > 0.5
      ? t('cluster_good')
      : result && result.clusters.silhouette > 0.25
        ? t('cluster_fair')
        : t('cluster_weak');

  if (!result) {
    return (
      <div className="text-center py-16 text-gray-500 dark:text-gray-400">
        {t('analysis_error')}
      </div>
    );
  }

  return (
    <div>
      {/* Header row */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400">
          <span>
            <span className="font-semibold text-gray-800 dark:text-gray-200">{result.details.length}</span>{' '}
            {t('clusters_found')}
          </span>
          <span>
            {t('silhouette_score')}:{' '}
            <span className="font-semibold text-gray-800 dark:text-gray-200">
              {result.clusters.silhouette.toFixed(3)}
            </span>{' '}
            <span className="text-xs">({silQuality})</span>
          </span>
        </div>
        <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
          <span className="font-medium">{t('cluster_count')}:</span>
          <input
            type="number"
            min={2}
            max={10}
            value={k}
            onChange={e => {
              const val = parseInt(e.target.value);
              if (val >= 2 && val <= 10) onKChange(val);
            }}
            className="w-16 px-2 py-1.5 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 text-center"
          />
        </label>
      </div>

      {/* Cluster columns */}
      <div
        className="grid gap-6"
        style={{
          gridTemplateColumns: `repeat(${Math.min(result.details.length, 4)}, minmax(0, 1fr))`,
        }}
      >
        {result.details.map(detail => (
          <ClusterColumn key={detail.clusterNum} detail={detail} labels={labels} colorMap={colorMap}
            nodeRadius={clusterNodeRadius} showSelfLoops={clusterShowSelfLoops} showEdgeLabels={clusterShowEdgeLabels} />
        ))}
      </div>
    </div>
  );
};

const ClusterColumn = ({
  detail,
  labels,
  colorMap,
  nodeRadius,
  showSelfLoops,
  showEdgeLabels,
}: {
  detail: ClusterDetail;
  labels: string[];
  colorMap: Record<string, string>;
  nodeRadius: number;
  showSelfLoops: boolean;
  showEdgeLabels: boolean;
}) => {
  const { t } = useTranslation(['admin']);
  const [modalOpen, setModalOpen] = useState(false);
  const topFreqs = detail.sortedFreqs.slice(0, 6);
  const topMaxFreq = topFreqs[0]?.[1] ?? 1;

  return (
    <div className="flex flex-col gap-4">
      {/* Cluster header with top frequencies */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
        <div className="flex items-center justify-between mb-1">
          <h3 className="text-base font-bold text-gray-900 dark:text-white">
            {t('cluster')} {detail.clusterNum}
          </h3>
          <span className="text-sm text-gray-500 dark:text-gray-400">
            {detail.size} ({detail.pct.toFixed(0)}%)
          </span>
        </div>
        <div className="text-xs text-gray-500 dark:text-gray-400 mb-3">
          {t('avg_sequence_length')}: {detail.avgLen.toFixed(1)}
        </div>
        <div className="space-y-1.5">
          {topFreqs.map(([state, count]) => (
            <div key={state} className="flex items-center gap-2 text-xs">
              <span className="inline-block w-2 h-2 rounded-full flex-shrink-0"
                style={{ backgroundColor: colorMap[state] ?? '#888' }} />
              <span className="text-gray-700 dark:text-gray-300 w-20 truncate">{state}</span>
              <div className="flex-1 h-3.5 bg-gray-100 dark:bg-gray-700 rounded overflow-hidden">
                <div className="h-full rounded"
                  style={{ width: `${(count / topMaxFreq) * 100}%`, backgroundColor: colorMap[state] ?? '#888', opacity: 0.75 }} />
              </div>
              <span className="text-gray-500 dark:text-gray-400 tabular-nums w-10 text-right">{count}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Network graph */}
      {detail.clusterModel && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-2 relative">
          <button onClick={() => setModalOpen(true)}
            className="absolute top-2 right-2 z-10 p-1.5 rounded-lg bg-white/80 dark:bg-gray-700/80 hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
            title={t('network_title')}>
            <Expand className="w-3.5 h-3.5 text-gray-500 dark:text-gray-400" />
          </button>
          <TnaNetworkGraph
            model={detail.clusterModel}
            showSelfLoops={showSelfLoops}
            showEdgeLabels={showEdgeLabels}
            nodeRadius={nodeRadius}
            height={280}
            colorMap={colorMap}
          />
          <ClusterNetworkModal
            open={modalOpen}
            onClose={() => setModalOpen(false)}
            model={detail.clusterModel}
            colorMap={colorMap}
            title={`${t('cluster')} ${detail.clusterNum} — ${t('network_title')}`}
          />
        </div>
      )}

      {/* Distribution sequence plot */}
      {detail.clusterSeqs.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-3">
          <TnaDistributionPlot sequences={detail.clusterSeqs} labels={labels} colorMap={colorMap} />
        </div>
      )}

      {/* InStrength centrality */}
      {detail.instrength && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-3">
          <h4 className="text-xs font-semibold text-gray-600 dark:text-gray-400 mb-2">{t('in_strength')}</h4>
          <div className="space-y-1">
            {detail.instrength.map(({ label, value }) => {
              const maxVal = detail.instrength![0].value || 1;
              return (
                <div key={label} className="flex items-center gap-2 text-xs">
                  <span className="text-gray-700 dark:text-gray-300 w-20 truncate text-right">{label}</span>
                  <div className="flex-1 h-4 bg-gray-100 dark:bg-gray-700 rounded overflow-hidden">
                    <div className="h-full rounded"
                      style={{ width: `${(value / maxVal) * 100}%`, backgroundColor: 'rgba(74, 144, 217, 0.8)' }} />
                  </div>
                  <span className="text-gray-500 dark:text-gray-400 tabular-nums w-12 text-right">{value.toFixed(3)}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
