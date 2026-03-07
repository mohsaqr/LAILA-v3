/**
 * TNA Interactive Exercise — sidebar + main area layout.
 *
 * Layout:
 *  +------------+------------------------------------+
 *  |  Sidebar   |  Main Area                          |
 *  |  (controls)|  Before build: data table            |
 *  |            |  After build:  network + analysis    |
 *  +------------+------------------------------------+
 */

import { useState, useMemo, useCallback } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Network, X, BarChart3, GitBranch,
  Scissors, Target, Users,
  Database, Share2, BookOpen, ChevronDown, ChevronRight,
  ArrowLeft, Sparkles,
} from 'lucide-react';
import { tna, ftna, ctna, atna, prune, centralities, summary } from 'dynajs';
import type { TNA } from 'dynajs';
import { TnaFrequencyChart } from '../components/tna/TnaFrequencyChart';
import { TnaDistributionPlot } from '../components/tna/TnaDistributionPlot';
import { TransitionHeatmap } from '../components/tna/TransitionHeatmap';
import { TnaNetworkGraph } from '../components/tna/TnaNetworkGraph';
import { CentralityBarChart } from '../components/tna/CentralityBarChart';
import { TnaCentralityTable } from '../components/tna/TnaCentralityTable';
import { ClustersTab } from '../components/tna/ClustersTab';
import { createColorMap } from '../components/tna/colorFix';
import { toCentralityData } from '../components/tna-exercise/utils';
import { StepGuide } from '../components/tna-exercise/StepGuide';
import { SAMPLE_DATASETS, buildSequences } from '../components/tna-exercise/sampleDatasets';
import type { RawRow } from '../components/tna-exercise/sampleDatasets';
import { AIDatasetGenerator } from '../components/ai/AIDatasetGenerator';
import type { TnaGeneratedData } from '../components/ai/AIDatasetGenerator';

/* ── Types ── */

type ModelType = 'relative' | 'frequency' | 'co-occurrence' | 'attention';
type AnalysisKey = 'frequencies' | 'transitions' | 'pruning' | 'centrality' | 'clusters';

const MODEL_BUILDERS: Record<ModelType, typeof tna> = {
  relative: tna, frequency: ftna, 'co-occurrence': ctna, attention: atna,
};

const ANALYSIS_ITEMS: { key: AnalysisKey; icon: typeof BarChart3 }[] = [
  { key: 'frequencies', icon: BarChart3 },
  { key: 'transitions', icon: GitBranch },
  { key: 'pruning', icon: Scissors },
  { key: 'centrality', icon: Target },
  { key: 'clusters', icon: Users },
];

/* ── Analysis key → StepGuide step number ── */
const GUIDE_STEP: Record<string, number> = {
  data: 1, network: 5, frequencies: 3, transitions: 4,
  pruning: 6, centrality: 7, clusters: 9,
};

/* ── Toggle Button Group (inline sidebar control) ── */

const ToggleGroup = ({ options, value, onChange }: {
  options: { key: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
}) => (
  <div className="flex rounded-lg border border-gray-200 dark:border-gray-600 overflow-hidden">
    {options.map(o => (
      <button key={o.key} onClick={() => onChange(o.key)}
        className={`px-2 py-1 text-[11px] font-medium transition-colors ${
          value === o.key
            ? 'bg-blue-600 text-white'
            : 'bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600'
        }`}>
        {o.label}
      </button>
    ))}
  </div>
);

/* ── Main Component ── */

export const TnaExercise = () => {
  const { t } = useTranslation(['courses']);
  const navigate = useNavigate();
  const { courseId } = useParams<{ courseId?: string }>();

  // ── Core state ──
  const [datasetKey, setDatasetKey] = useState<string | null>(null);
  const [actorCol, setActorCol] = useState('');
  const [actionCol, setActionCol] = useState('');
  const [timeCol, setTimeCol] = useState('');
  const [modelType, setModelType] = useState<ModelType>('relative');
  const [modelBuilt, setModelBuilt] = useState(false);

  // ── Network controls ──
  const [showSelfLoops, setShowSelfLoops] = useState(true);
  const [showEdgeLabels, setShowEdgeLabels] = useState(true);
  const [nodeRadius, setNodeRadius] = useState(25);

  // ── Active analysis (radio — one at a time) ──
  const [activeAnalysis, setActiveAnalysis] = useState<AnalysisKey | null>(null);

  // ── Per-analysis options ──
  const [freqView, setFreqView] = useState<'bar' | 'distribution' | 'both'>('both');
  const [freqSort, setFreqSort] = useState<'alpha' | 'count'>('alpha');
  const [transitionView, setTransitionView] = useState<'counts' | 'probs' | 'both'>('both');
  const [pruneThreshold, setPruneThreshold] = useState(0.1);
  const [centralityMetric, setCentralityMetric] = useState<'InStrength' | 'OutStrength' | 'Betweenness'>('InStrength');
  const [showCentralityTable, setShowCentralityTable] = useState(true);
  const [clusterK, setClusterK] = useState(3);
  const [showGuide, setShowGuide] = useState(false);
  const [showAIGenerator, setShowAIGenerator] = useState(false);

  // ── AI-generated data ──
  const [aiRows, setAiRows] = useState<RawRow[] | null>(null);
  const [aiColumns, setAiColumns] = useState<string[] | null>(null);

  // ── Derived: dataset ──
  const selectedDs = SAMPLE_DATASETS.find(d => d.key === datasetKey);
  const rawRows = datasetKey === '_ai' ? (aiRows ?? []) : (selectedDs?.rows ?? []);
  const columns = datasetKey === '_ai' ? (aiColumns ?? []) : (selectedDs?.columns ?? []);

  // ── Derived: sequences & labels ──
  const { sequences, labels } = useMemo(() => {
    if (!actorCol || !actionCol || !timeCol || rawRows.length === 0)
      return { sequences: [] as string[][], labels: [] as string[] };
    return buildSequences(rawRows, actorCol, actionCol, timeCol);
  }, [rawRows, actorCol, actionCol, timeCol]);

  const hasData = sequences.length >= 2 && labels.length >= 2;
  const colorMap = useMemo(() => labels.length > 0 ? createColorMap(labels, 'default') : {}, [labels]);

  // ── Derived: models ──
  const rawModel = useMemo((): TNA | null => {
    if (!hasData || !modelBuilt) return null;
    try { return MODEL_BUILDERS[modelType](sequences, { labels }) as TNA; } catch { return null; }
  }, [sequences, labels, modelType, hasData, modelBuilt]);

  const ftnaModel = useMemo((): TNA | null => {
    if (!hasData || !modelBuilt) return null;
    try { return ftna(sequences, { labels }) as TNA; } catch { return null; }
  }, [sequences, labels, hasData, modelBuilt]);

  const prunedModel = useMemo((): TNA | null => {
    if (!rawModel) return null;
    try { return prune(rawModel, pruneThreshold) as TNA; } catch { return null; }
  }, [rawModel, pruneThreshold]);

  const centralityData = useMemo(() => {
    if (!rawModel) return null;
    try { return toCentralityData(centralities(rawModel)); } catch { return null; }
  }, [rawModel]);

  const edgeCount = useMemo(() => {
    if (!rawModel) return { original: 0, pruned: 0 };
    const countEdges = (m: TNA) => {
      try { return (summary(m) as any).nEdges ?? 0; } catch {
        let c = 0; const n = m.labels.length;
        for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) if (m.weights.get(i, j) > 0) c++;
        return c;
      }
    };
    return { original: countEdges(rawModel), pruned: prunedModel ? countEdges(prunedModel) : 0 };
  }, [rawModel, prunedModel]);

  // Network: use pruned model when pruning is active
  const displayModel = activeAnalysis === 'pruning' && prunedModel ? prunedModel : rawModel;
  const isCentralityActive = activeAnalysis === 'centrality' && centralityData != null;

  // Sorted labels for frequency chart
  const sortedFreqLabels = useMemo(() => {
    if (freqSort === 'alpha' || !sequences.length) return labels;
    const counts = new Map<string, number>();
    for (const seq of sequences) for (const s of seq) counts.set(s, (counts.get(s) ?? 0) + 1);
    return [...labels].sort((a, b) => (counts.get(b) ?? 0) - (counts.get(a) ?? 0));
  }, [labels, sequences, freqSort]);

  // ── Handlers ──
  const handleSelectDataset = useCallback((key: string) => {
    if (!key) { setDatasetKey(null); return; }
    setDatasetKey(key);
    setActorCol('');
    setActionCol('');
    setTimeCol('');
    setModelBuilt(false);
    setActiveAnalysis(null);
  }, []);

  const handleAiTnaData = useCallback((data: TnaGeneratedData) => {
    setAiColumns(data.columns);
    setAiRows(data.rows);
    setDatasetKey('_ai');
    setActorCol('');
    setActionCol('');
    setTimeCol('');
    setModelBuilt(false);
    setActiveAnalysis(null);
  }, []);

  const handleBuildModel = useCallback(() => {
    setModelBuilt(true);
    setActiveAnalysis(null);
  }, []);

  const toggleAnalysis = useCallback((key: AnalysisKey) => {
    setActiveAnalysis(prev => prev === key ? null : key);
    setShowGuide(false);
  }, []);

  const getColRole = (col: string): string | null => {
    if (col === actorCol) return 'actor';
    if (col === actionCol) return 'action';
    if (col === timeCol) return 'time';
    return null;
  };

  // ── Style constants ──
  const selectCls = "w-full px-2.5 py-1.5 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500";
  const labelCls = "block text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1";

  /* ── Render ── */
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-screen-xl mx-auto px-4 sm:px-6 lg:px-8 py-6">

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            {courseId && (
              <Link to={`/courses/${courseId}`} className="p-2 -ml-2 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
                <ArrowLeft className="w-4 h-4" />
              </Link>
            )}
            <div className="w-9 h-9 rounded-lg bg-gradient-to-r from-blue-500 to-indigo-600 flex items-center justify-center">
              <Network className="w-4.5 h-4.5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-gray-900 dark:text-gray-100">{t('exercise.title')}</h1>
              <p className="text-xs text-gray-500 dark:text-gray-400 hidden sm:block">{t('exercise.subtitle')}</p>
            </div>
          </div>
          <button onClick={() => navigate(courseId ? `/courses/${courseId}` : -1 as any)} className="p-2 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* ── Layout: sidebar + main ── */}
        <div className="flex flex-col lg:flex-row gap-6">

          {/* ══════════ SIDEBAR ══════════ */}
          <div className="lg:w-64 lg:flex-shrink-0">
            <div className="sticky top-6 space-y-3 max-h-[calc(100vh-4rem)] overflow-y-auto">

              {/* Setup panel */}
              <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-3 space-y-3">

                {/* Dataset Picker */}
                <div>
                  <label className={labelCls}>{t('exercise.pipe_dataset')}</label>
                  <select value={datasetKey ?? ''} onChange={e => handleSelectDataset(e.target.value)} className={selectCls}>
                    <option value="">{t('exercise.select_column')}</option>
                    {SAMPLE_DATASETS.map(ds => (
                      <option key={ds.key} value={ds.key}>{t(ds.i18nTitle)}</option>
                    ))}
                    {datasetKey === '_ai' && <option value="_ai">AI Generated</option>}
                  </select>
                  {(selectedDs || datasetKey === '_ai') && (
                    <p className="text-[10px] text-gray-400 mt-1">
                      {rawRows.length} {t('exercise.rows')}, {columns.length} col
                    </p>
                  )}
                  <button
                    onClick={() => setShowAIGenerator(true)}
                    className="w-full mt-1.5 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg border border-dashed border-gray-300 dark:border-gray-600 text-xs font-medium text-gray-500 dark:text-gray-400 hover:border-violet-400 hover:text-violet-600 dark:hover:text-violet-400 transition-colors"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    {t('ai_gen.or_generate')}
                  </button>
                </div>

                {/* Column Mapping (NOT pre-filled) */}
                {datasetKey && (
                  <div className="space-y-2">
                    <label className={labelCls}>{t('exercise.assign_columns')}</label>
                    {(['actor', 'action', 'time'] as const).map(role => {
                      const val = role === 'actor' ? actorCol : role === 'action' ? actionCol : timeCol;
                      const setter = role === 'actor' ? setActorCol : role === 'action' ? setActionCol : setTimeCol;
                      const dot = role === 'actor' ? 'bg-purple-500' : role === 'action' ? 'bg-blue-500' : 'bg-amber-500';
                      return (
                        <div key={role}>
                          <div className="flex items-center gap-1.5 mb-0.5">
                            <span className={`w-1.5 h-1.5 rounded-full ${dot}`} />
                            <span className="text-[11px] font-medium text-gray-600 dark:text-gray-300">
                              {t(`exercise.role_${role}`)}
                            </span>
                          </div>
                          <select
                            value={val}
                            onChange={e => { setter(e.target.value); setModelBuilt(false); setActiveAnalysis(null); }}
                            className={selectCls}
                          >
                            <option value="">{t('exercise.select_column')}</option>
                            {columns.map(col => <option key={col} value={col}>{col}</option>)}
                          </select>
                        </div>
                      );
                    })}
                    {hasData && (
                      <div className="flex items-center gap-2 text-[10px] text-gray-500 dark:text-gray-400 pt-1">
                        <span className="flex items-center gap-1"><Database className="w-3 h-3" />{sequences.length} seq</span>
                        <span className="flex items-center gap-1"><Share2 className="w-3 h-3" />{labels.length} states</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Model Type */}
                {datasetKey && (
                  <div>
                    <label className={labelCls}>{t('exercise.pipe_model_type')}</label>
                    <select
                      value={modelType}
                      onChange={e => { setModelType(e.target.value as ModelType); setModelBuilt(false); setActiveAnalysis(null); }}
                      className={selectCls}
                    >
                      {(['relative', 'frequency', 'co-occurrence', 'attention'] as ModelType[]).map(m => (
                        <option key={m} value={m}>
                          {t(`exercise.model_${m === 'co-occurrence' ? 'cooccurrence' : m}`)}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Build Button */}
                {datasetKey && (
                  <button
                    onClick={handleBuildModel}
                    disabled={!hasData}
                    className="w-full px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    {t('exercise.pipe_build_btn')}
                  </button>
                )}
              </div>

              {/* Network controls + Analysis nav (after build) */}
              {modelBuilt && rawModel && (
                <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-3 space-y-3">

                  {/* Network controls */}
                  <div className="space-y-1.5">
                    <label className={labelCls}>{t('exercise.pipe_network')}</label>
                    <label className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-300 cursor-pointer">
                      <input type="checkbox" checked={showSelfLoops} onChange={e => setShowSelfLoops(e.target.checked)}
                        className="rounded w-3.5 h-3.5 text-blue-600" />
                      {t('exercise.self_loops')}
                    </label>
                    <label className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-300 cursor-pointer">
                      <input type="checkbox" checked={showEdgeLabels} onChange={e => setShowEdgeLabels(e.target.checked)}
                        className="rounded w-3.5 h-3.5 text-blue-600" />
                      {t('exercise.edge_labels')}
                    </label>
                    <label className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-300">
                      {t('exercise.node_size')}
                      <input type="range" min={15} max={50} value={nodeRadius}
                        onChange={e => setNodeRadius(Number(e.target.value))} className="w-16 h-1.5 accent-blue-600" />
                    </label>
                  </div>

                  <hr className="border-gray-100 dark:border-gray-700" />

                  {/* Analysis navigation (radio-style) */}
                  <div className="space-y-0.5">
                    <label className={labelCls}>{t('exercise.analysis_blocks')}</label>
                    {ANALYSIS_ITEMS.map(({ key, icon: Icon }) => {
                      const isActive = activeAnalysis === key;
                      return (
                        <div key={key}>
                          <button
                            onClick={() => toggleAnalysis(key)}
                            className={`flex items-center gap-2 w-full px-2.5 py-2 rounded-lg text-left text-xs font-medium transition-all ${
                              isActive
                                ? 'bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300 border-l-2 border-blue-500 ml-0'
                                : 'text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50'
                            }`}
                          >
                            <Icon className={`w-3.5 h-3.5 flex-shrink-0 ${isActive ? 'text-blue-500' : 'text-gray-400'}`} />
                            <span>{t(`exercise.block_${key}`)}</span>
                          </button>

                          {/* Inline options (expand below active item) */}
                          {isActive && (
                            <div className="ml-6 mt-1 mb-2 space-y-2">
                              {key === 'frequencies' && (
                                <>
                                  <div>
                                    <span className="text-[10px] text-gray-400 block mb-1">{t('exercise.show')}</span>
                                    <ToggleGroup value={freqView} onChange={v => setFreqView(v as typeof freqView)} options={[
                                      { key: 'bar', label: 'Bar' },
                                      { key: 'distribution', label: 'Dist' },
                                      { key: 'both', label: 'Both' },
                                    ]} />
                                  </div>
                                  <div>
                                    <span className="text-[10px] text-gray-400 block mb-1">{t('sort_by')}</span>
                                    <ToggleGroup value={freqSort} onChange={v => setFreqSort(v as typeof freqSort)} options={[
                                      { key: 'alpha', label: 'A-Z' },
                                      { key: 'count', label: '#' },
                                    ]} />
                                  </div>
                                </>
                              )}

                              {key === 'transitions' && (
                                <div>
                                  <span className="text-[10px] text-gray-400 block mb-1">{t('exercise.show')}</span>
                                  <ToggleGroup value={transitionView} onChange={v => setTransitionView(v as typeof transitionView)} options={[
                                    { key: 'counts', label: t('exercise.raw_counts') },
                                    { key: 'probs', label: t('exercise.probabilities') },
                                    { key: 'both', label: 'Both' },
                                  ]} />
                                </div>
                              )}

                              {key === 'pruning' && (
                                <div>
                                  <div className="flex items-center justify-between mb-1">
                                    <span className="text-[10px] text-gray-400">{t('exercise.prune_threshold')}</span>
                                    <span className="text-[11px] font-mono font-bold text-blue-600 dark:text-blue-400">
                                      {pruneThreshold.toFixed(2)}
                                    </span>
                                  </div>
                                  <input type="range" min={0} max={0.5} step={0.01}
                                    value={pruneThreshold} onChange={e => setPruneThreshold(Number(e.target.value))}
                                    className="w-full h-1.5 accent-blue-600" />
                                  <div className="flex justify-between text-[10px] text-gray-400 mt-1">
                                    <span>{edgeCount.pruned}/{edgeCount.original} edges</span>
                                    <span>-{edgeCount.original - edgeCount.pruned}</span>
                                  </div>
                                </div>
                              )}

                              {key === 'centrality' && (
                                <>
                                  <div>
                                    <span className="text-[10px] text-gray-400 block mb-1">{t('exercise.size_by')}</span>
                                    <ToggleGroup value={centralityMetric} onChange={v => setCentralityMetric(v as typeof centralityMetric)} options={[
                                      { key: 'InStrength', label: 'In' },
                                      { key: 'OutStrength', label: 'Out' },
                                      { key: 'Betweenness', label: 'Btw' },
                                    ]} />
                                  </div>
                                  <label className="flex items-center gap-2 text-[11px] text-gray-600 dark:text-gray-300 cursor-pointer">
                                    <input type="checkbox" checked={showCentralityTable}
                                      onChange={e => setShowCentralityTable(e.target.checked)}
                                      className="rounded w-3 h-3 text-blue-600" />
                                    {t('exercise.centrality_table')}
                                  </label>
                                </>
                              )}

                              {key === 'clusters' && (
                                <div>
                                  <div className="flex items-center justify-between mb-1">
                                    <span className="text-[10px] text-gray-400">{t('exercise.num_clusters')}</span>
                                    <span className="text-[11px] font-bold text-blue-600 dark:text-blue-400">{clusterK}</span>
                                  </div>
                                  <input type="range" min={2} max={10}
                                    value={clusterK} onChange={e => setClusterK(Number(e.target.value))}
                                    className="w-full h-1.5 accent-blue-600" />
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ══════════ MAIN AREA ══════════ */}
          <div className="flex-1 min-w-0 space-y-4">

            {/* No dataset selected — intro guide */}
            {!datasetKey && (
              <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
                <StepGuide step={0} />
              </div>
            )}

            {/* Data table (before build) */}
            {datasetKey && !modelBuilt && (
              <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
                <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
                  <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                    {t('exercise.pipe_viewdata')}
                  </h2>
                  <span className="text-xs text-gray-400">{rawRows.length} {t('exercise.rows')}</span>
                </div>

                {/* State chips */}
                {labels.length > 0 && (
                  <div className="px-4 pt-3 flex flex-wrap gap-1.5">
                    {labels.map(label => (
                      <span key={label}
                        className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-medium text-white"
                        style={{ backgroundColor: colorMap[label] || '#888' }}>
                        {label}
                      </span>
                    ))}
                  </div>
                )}

                <div className="overflow-x-auto max-h-[32rem] overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-gray-50 dark:bg-gray-800 z-10">
                      <tr>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-400 w-10">#</th>
                        {columns.map(col => {
                          const role = getColRole(col);
                          return (
                            <th key={col} className={`px-3 py-2 text-left text-xs font-semibold ${
                              role === 'actor' ? 'text-purple-600 dark:text-purple-400' :
                              role === 'action' ? 'text-blue-600 dark:text-blue-400' :
                              role === 'time' ? 'text-amber-600 dark:text-amber-400' :
                              'text-gray-500 dark:text-gray-400'
                            }`}>
                              {col}
                              {role && <span className="ml-1 text-[10px] opacity-60">({t(`exercise.role_${role}`)})</span>}
                            </th>
                          );
                        })}
                      </tr>
                    </thead>
                    <tbody>
                      {rawRows.slice(0, 100).map((row, ri) => (
                        <tr key={ri} className="border-t border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50">
                          <td className="px-3 py-1.5 text-xs text-gray-400">{ri + 1}</td>
                          {columns.map(col => {
                            const role = getColRole(col);
                            const val = row[col] || '';
                            return (
                              <td key={col} className="px-3 py-1.5 text-gray-700 dark:text-gray-300">
                                {role === 'action' && colorMap[val] ? (
                                  <span className="inline-flex items-center gap-1.5">
                                    <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: colorMap[val] }} />
                                    {val}
                                  </span>
                                ) : val}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {rawRows.length > 100 && (
                    <div className="px-3 py-2 text-xs text-gray-400 bg-gray-50 dark:bg-gray-800 text-center">
                      {t('exercise.show_less')} — {rawRows.length} {t('exercise.rows')}
                    </div>
                  )}
                </div>
                <div className="p-4 border-t border-gray-200 dark:border-gray-700">
                  <StepGuide step={1} />
                </div>
              </div>
            )}

            {/* After build: Network + Analysis */}
            {modelBuilt && rawModel && (
              <>
                {/* ── Network Graph (always visible) ── */}
                <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
                  <div className="flex items-center gap-3 mb-3">
                    <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                      {t('exercise.pipe_network')}
                    </h2>
                    {activeAnalysis === 'pruning' && (
                      <span className="text-xs font-medium text-blue-600 dark:text-blue-400">
                        — {t('exercise.prune_threshold')} {pruneThreshold.toFixed(2)}
                      </span>
                    )}
                    {isCentralityActive && (
                      <span className="text-xs font-medium text-blue-600 dark:text-blue-400">
                        — {centralityMetric}
                      </span>
                    )}
                  </div>
                  <TnaNetworkGraph
                    model={displayModel!}
                    showSelfLoops={showSelfLoops}
                    showEdgeLabels={showEdgeLabels}
                    nodeRadius={nodeRadius}
                    height={500}
                    colorMap={colorMap}
                    centralityData={isCentralityActive ? centralityData! : undefined}
                    nodeSizeMetric={isCentralityActive ? centralityMetric : undefined}
                    modelType={modelType}
                  />
                </div>

                {/* ── Guide Banner (prominent collapsible, below network) ── */}
                {activeAnalysis && (
                  <button
                    onClick={() => setShowGuide(g => !g)}
                    className={`w-full flex items-center gap-3 px-5 py-3 rounded-xl border text-left transition-colors ${
                      showGuide
                        ? 'bg-indigo-50 dark:bg-indigo-950/30 border-indigo-200 dark:border-indigo-800 text-indigo-800 dark:text-indigo-200'
                        : 'bg-indigo-50/50 dark:bg-indigo-950/20 border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-950/30'
                    }`}
                  >
                    <BookOpen className="w-5 h-5 text-indigo-500 flex-shrink-0" />
                    <div className="flex-1">
                      <span className="text-sm font-semibold">
                        {t(`exercise.block_${activeAnalysis}`)} — Learn More
                      </span>
                      <p className="text-xs text-indigo-500 dark:text-indigo-400">
                        {showGuide ? 'Click to hide explanation' : 'Click to read the educational guide for this analysis'}
                      </p>
                    </div>
                    {showGuide
                      ? <ChevronDown className="w-4 h-4 text-indigo-400" />
                      : <ChevronRight className="w-4 h-4 text-indigo-400" />
                    }
                  </button>
                )}
                {activeAnalysis && showGuide && (
                  <div className="bg-white dark:bg-gray-800 rounded-xl border border-indigo-200 dark:border-indigo-800 p-6">
                    <StepGuide step={GUIDE_STEP[activeAnalysis]} />
                  </div>
                )}

                {/* ── Analysis Result (swaps based on sidebar selection) ── */}
                {activeAnalysis === 'frequencies' && (
                  <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-4">
                      {t('exercise.block_frequencies')}
                    </h3>
                    {(freqView === 'bar' || freqView === 'both') && (
                      <div className={freqView === 'both' ? 'mb-6' : ''}>
                        <h4 className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">
                          {t('exercise.state_frequencies')}
                        </h4>
                        <TnaFrequencyChart sequences={sequences} labels={sortedFreqLabels} colorMap={colorMap} />
                      </div>
                    )}
                    {(freqView === 'distribution' || freqView === 'both') && (
                      <div>
                        <h4 className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">
                          {t('exercise.distribution_over_time')}
                        </h4>
                        <TnaDistributionPlot sequences={sequences} labels={sortedFreqLabels} colorMap={colorMap} />
                      </div>
                    )}
                  </div>
                )}

                {activeAnalysis === 'transitions' && (
                  <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-4">
                      {t('exercise.block_transitions')}
                    </h3>
                    <div className={transitionView === 'both' ? 'grid lg:grid-cols-2 gap-6' : ''}>
                      {(transitionView === 'counts' || transitionView === 'both') && (
                        <div>
                          <h4 className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                            {t('exercise.raw_counts')}
                          </h4>
                          <p className="text-[11px] text-gray-400 mb-2">{t('exercise.counts_explain')}</p>
                          {ftnaModel && <TransitionHeatmap model={ftnaModel} colorMap={colorMap} />}
                        </div>
                      )}
                      {(transitionView === 'probs' || transitionView === 'both') && (
                        <div>
                          <h4 className="text-xs font-medium text-blue-600 dark:text-blue-400 mb-1">
                            {t('exercise.probabilities')}
                          </h4>
                          <p className="text-[11px] text-gray-400 mb-2">{t('exercise.probs_explain')}</p>
                          <TransitionHeatmap model={rawModel} colorMap={colorMap} />
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {activeAnalysis === 'pruning' && (
                  <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">
                      {t('exercise.block_pruning')}
                    </h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
                      {t('exercise.pruning_live_note')}
                    </p>
                    <div className="flex flex-wrap items-center gap-6 text-sm text-gray-500 dark:text-gray-400">
                      <span>{t('exercise.original_edges')}: <strong className="text-gray-700 dark:text-gray-200">{edgeCount.original}</strong></span>
                      <span>{t('exercise.pruned_edges')}: <strong className="text-gray-700 dark:text-gray-200">{edgeCount.pruned}</strong></span>
                      <span>{t('exercise.removed')}: <strong className="text-red-600 dark:text-red-400">{edgeCount.original - edgeCount.pruned}</strong></span>
                    </div>
                  </div>
                )}

                {activeAnalysis === 'centrality' && centralityData && (
                  <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-4">
                      {t('exercise.block_centrality')}
                    </h3>
                    <div className={showCentralityTable ? 'grid lg:grid-cols-2 gap-6' : ''}>
                      <div>
                        <h4 className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">
                          {t('exercise.centrality_chart')}
                        </h4>
                        <CentralityBarChart centralityData={centralityData} colorMap={colorMap} />
                      </div>
                      {showCentralityTable && (
                        <div>
                          <h4 className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">
                            {t('exercise.centrality_table')}
                          </h4>
                          <TnaCentralityTable centralityData={centralityData} colorMap={colorMap} />
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {activeAnalysis === 'clusters' && (
                  <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-4">
                      {t('exercise.block_clusters')}
                    </h3>
                    <ClustersTab
                      sequences={sequences}
                      labels={labels}
                      k={clusterK}
                      onKChange={setClusterK}
                      palette="default"
                      showSelfLoops={showSelfLoops}
                      showEdgeLabels={showEdgeLabels}
                    />
                  </div>
                )}

                {/* No analysis selected — show network guide */}
                {!activeAnalysis && (
                  <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
                    <StepGuide step={GUIDE_STEP.network} />
                  </div>
                )}
              </>
            )}

            {/* Model build failed */}
            {modelBuilt && !rawModel && (
              <div className="bg-white dark:bg-gray-800 rounded-xl border border-red-200 dark:border-red-800 p-8 text-center">
                <p className="text-sm text-red-600 dark:text-red-400">{t('exercise.no_model')}</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* AI Dataset Generator Modal */}
      {showAIGenerator && (
        <AIDatasetGenerator
          type="tna"
          onClose={() => setShowAIGenerator(false)}
          onTnaData={handleAiTnaData}
        />
      )}
    </div>
  );
};
