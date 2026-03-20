/**
 * SNA Interactive Exercise — sidebar + main area layout.
 *
 * Primary data format: weighted edge list.
 * Tabs: Graph Metrics > Centrality > Communities > Adjacency Matrix.
 * Students can also enter their own network via a modal.
 */

import { useState, useMemo, useCallback, useRef } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Breadcrumb } from '../components/common/Breadcrumb';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import {
  Network, X, GitBranch, Target, BarChart3, Waypoints, Plus,
  ChevronDown, ChevronRight, BookOpen, Users,
  Microscope, MessageCircle, Sparkles, ClipboardList, Camera, Loader2, CheckCircle,
} from 'lucide-react';
import { assignmentsApi } from '../api/assignments';
import { LabAssignmentPanel, type ReportItem } from '../components/labs/LabAssignmentPanel';
import toast from 'react-hot-toast';
import { INTERACTIVE_LAB_REQUIREMENTS } from '../types';
import { buildModel } from 'dynajs';
import type { TNA } from 'dynajs';
import { TransitionHeatmap } from '../components/tna/TransitionHeatmap';
import { TnaNetworkGraph } from '../components/tna/TnaNetworkGraph';
import { CentralityBarChart } from '../components/tna/CentralityBarChart';
import { TnaCentralityTable } from '../components/tna/TnaCentralityTable';
import { createColorMap } from '../components/tna/colorFix';
import { computeAllCentralities, detectCommunities, computeLayout } from '../components/sna-exercise/utils';
import type { LayoutType, CommunityMethod } from '../components/sna-exercise/utils';
import {
  SAMPLE_NETWORKS,
  graphMetrics,
  edgesToMatrix,
} from '../components/sna-exercise/sampleNetworks';
import type { SampleNetwork, Edge } from '../components/sna-exercise/sampleNetworks';
import { AIDatasetGenerator } from '../components/ai/AIDatasetGenerator';
import type { SnaGeneratedData } from '../components/ai/AIDatasetGenerator';
import { SnaStepGuide } from '../components/sna-exercise/SnaStepGuide';
import { LabAIAssistant } from '../components/ai/LabAIAssistant';
import { activityLogger } from '../services/activityLogger';

/* ── Types ── */

type AnalysisKey = 'metrics' | 'centrality' | 'communities' | 'adjacency';
type CentralityKey = 'Degree' | 'InDegree' | 'OutDegree' | 'InStrength' | 'OutStrength' | 'Betweenness' | 'Closeness';

const ANALYSIS_ITEMS: { key: AnalysisKey; icon: typeof BarChart3 }[] = [
  { key: 'metrics', icon: BarChart3 },
  { key: 'centrality', icon: Target },
  { key: 'communities', icon: Waypoints },
  { key: 'adjacency', icon: GitBranch },
];

const CENTRALITY_OPTIONS: { key: CentralityKey; i18nKey: string }[] = [
  { key: 'Degree', i18nKey: 'sna.m_degree' },
  { key: 'InDegree', i18nKey: 'sna.m_in_degree' },
  { key: 'OutDegree', i18nKey: 'sna.m_out_degree' },
  { key: 'InStrength', i18nKey: 'sna.m_in_strength' },
  { key: 'OutStrength', i18nKey: 'sna.m_out_strength' },
  { key: 'Betweenness', i18nKey: 'sna.m_betweenness' },
  { key: 'Closeness', i18nKey: 'sna.m_closeness' },
];

const LAYOUT_OPTIONS: { key: LayoutType; i18nKey: string }[] = [
  { key: 'circle', i18nKey: 'sna.layout_circle' },
  { key: 'force', i18nKey: 'sna.layout_force' },
  { key: 'concentric', i18nKey: 'sna.layout_concentric' },
  { key: 'grid', i18nKey: 'sna.layout_grid' },
  { key: 'random', i18nKey: 'sna.layout_random' },
];

const COMMUNITY_METHOD_OPTIONS: { key: CommunityMethod; i18nKey: string }[] = [
  { key: 'label-propagation', i18nKey: 'sna.comm_label_prop' },
  { key: 'modularity-greedy', i18nKey: 'sna.comm_modularity' },
  { key: 'walktrap', i18nKey: 'sna.comm_walktrap' },
  { key: 'girvan-newman', i18nKey: 'sna.comm_girvan_newman' },
  { key: 'spectral', i18nKey: 'sna.comm_spectral' },
];

const DATASET_ICONS: Record<string, typeof Users> = {
  users: Users,
  microscope: Microscope,
  'message-circle': MessageCircle,
};

const COMMUNITY_COLORS = [
  '#5ab4ac', '#e6ab02', '#a985ca', '#e15759', '#5a9bd4',
  '#ed8c3b', '#8bc34a', '#e78ac3', '#a8786a', '#9580c4',
];

/* ── Custom Network Modal ── */

interface RowData { from: string; to: string; weight: string }
const EMPTY_ROW: RowData = { from: '', to: '', weight: '' };
const INITIAL_ROWS = 6;

const CustomNetworkModal = ({ onClose, onSubmit }: {
  onClose: () => void;
  onSubmit: (edges: Edge[], directed: boolean) => void;
}) => {
  const { t } = useTranslation(['courses']);
  const [rows, setRows] = useState<RowData[]>(() => Array.from({ length: INITIAL_ROWS }, () => ({ ...EMPTY_ROW })));
  const [directed, setDirected] = useState(true);
  const [error, setError] = useState('');

  const updateRow = (idx: number, field: keyof RowData, value: string) => {
    setRows(prev => {
      const next = prev.map((r, i) => i === idx ? { ...r, [field]: value } : r);
      // Auto-add a row when the last row gets content
      if (idx === next.length - 1 && (value.trim() !== '')) {
        next.push({ ...EMPTY_ROW });
      }
      return next;
    });
  };

  const removeRow = (idx: number) => {
    setRows(prev => prev.length <= 1 ? [{ ...EMPTY_ROW }] : prev.filter((_, i) => i !== idx));
  };

  const handleSubmit = () => {
    setError('');
    const filled = rows.filter(r => r.from.trim() && r.to.trim());
    if (filled.length === 0) {
      setError(t('sna.custom_error_empty'));
      return;
    }
    const edges: Edge[] = filled.map(r => ({
      from: r.from.trim(),
      to: r.to.trim(),
      weight: r.weight.trim() ? parseFloat(r.weight.trim()) || 1 : 1,
    }));
    onSubmit(edges, directed);
  };

  const inputCls = "w-full px-2 py-1.5 bg-transparent text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:bg-violet-50/50 dark:focus:bg-violet-950/20 placeholder:text-gray-300 dark:placeholder:text-gray-600";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-2xl w-full max-w-lg mx-4 p-5"
        onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-bold text-gray-900 dark:text-gray-100">{t('sna.custom_title')}</h2>
          <button onClick={onClose} className="p-1 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Spreadsheet */}
        <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
          {/* Header */}
          <div className="grid grid-cols-[1fr_1fr_80px_28px] bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-700">
            <div className="px-2 py-1.5 text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">{t('sna.col_from')}</div>
            <div className="px-2 py-1.5 text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide border-l border-gray-200 dark:border-gray-700">{t('sna.col_to')}</div>
            <div className="px-2 py-1.5 text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide border-l border-gray-200 dark:border-gray-700">{t('sna.col_weight')}</div>
            <div />
          </div>
          {/* Rows */}
          <div className="max-h-64 overflow-y-auto">
            {rows.map((row, i) => (
              <div key={i} className="grid grid-cols-[1fr_1fr_80px_28px] border-b border-gray-100 dark:border-gray-800 last:border-b-0 hover:bg-gray-50/50 dark:hover:bg-gray-800/30">
                <input
                  value={row.from}
                  onChange={e => updateRow(i, 'from', e.target.value)}
                  placeholder="Alice"
                  className={inputCls}
                />
                <input
                  value={row.to}
                  onChange={e => updateRow(i, 'to', e.target.value)}
                  placeholder="Bob"
                  className={`${inputCls} border-l border-gray-100 dark:border-gray-800`}
                />
                <input
                  value={row.weight}
                  onChange={e => updateRow(i, 'weight', e.target.value)}
                  placeholder="1"
                  className={`${inputCls} border-l border-gray-100 dark:border-gray-800`}
                />
                <button
                  onClick={() => removeRow(i)}
                  className="flex items-center justify-center text-gray-300 hover:text-red-400 transition-colors"
                  tabIndex={-1}
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between mt-3">
          <label className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-300 cursor-pointer">
            <input type="checkbox" checked={directed} onChange={e => setDirected(e.target.checked)}
              className="rounded w-3.5 h-3.5 text-violet-600" />
            {t('sna.directed')}
          </label>
          <span className="text-[10px] text-gray-400">
            {rows.filter(r => r.from.trim() && r.to.trim()).length} {t('sna.edges_count')}
          </span>
        </div>

        {error && <p className="text-xs text-red-500 mt-2">{error}</p>}

        <div className="flex justify-end gap-2 mt-4">
          <button onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
            {t('sna.cancel')}
          </button>
          <button onClick={handleSubmit}
            className="px-4 py-2 rounded-lg bg-violet-600 text-white text-sm font-semibold hover:bg-violet-700 transition-colors">
            {t('sna.custom_submit')}
          </button>
        </div>
      </div>
    </div>
  );
};

/* ── Main Component ── */

export const SnaExercise = () => {
  const { t } = useTranslation(['courses']);
  const navigate = useNavigate();
  const { courseId } = useParams<{ courseId?: string }>();
  const [searchParams] = useSearchParams();
  const exerciseRef = useRef<HTMLDivElement>(null);
  const analysisContentRef = useRef<HTMLDivElement>(null);
  const [assignmentPanelOpen, setAssignmentPanelOpen] = useState(false);

  const { data: courseAssignments } = useQuery({
    queryKey: ['courseAssignments', courseId],
    queryFn: () => assignmentsApi.getAssignments(Number(courseId)),
    enabled: !!courseId,
  });
  const targetAssignmentId = searchParams.get('assignmentId');
  const snaAssignment = targetAssignmentId
    ? courseAssignments?.find(a => a.id === Number(targetAssignmentId)) ?? null
    : courseAssignments?.find(a => a.agentRequirements === INTERACTIVE_LAB_REQUIREMENTS.SNA) ?? null;

  // ── Core state ──
  const [datasetKey, setDatasetKey] = useState<string | null>(null);
  const [modelBuilt, setModelBuilt] = useState(false);
  const [showCustomModal, setShowCustomModal] = useState(false);
  const [showAIGenerator, setShowAIGenerator] = useState(false);

  // ── Custom network ──
  const [customEdges, setCustomEdges] = useState<Edge[] | null>(null);
  const [customDirected, setCustomDirected] = useState(true);
  const [customLabels, setCustomLabels] = useState<string[]>([]);
  const [customMatrix, setCustomMatrix] = useState<number[][]>([]);

  // ── Network controls ──
  const [showSelfLoops, setShowSelfLoops] = useState(false);
  const [showEdgeLabels, setShowEdgeLabels] = useState(false);
  const [nodeRadius, setNodeRadius] = useState(25);
  const [edgeWidth, setEdgeWidth] = useState(2);
  const [layout, setLayout] = useState<LayoutType>('circle');

  // ── Active analysis ──
  const [activeAnalysis, setActiveAnalysis] = useState<AnalysisKey | null>(null);

  // ── Per-analysis options ──
  const [centralityMetric, setCentralityMetric] = useState<CentralityKey>('InStrength');
  const [centralityView, setCentralityView] = useState<'chart' | 'table'>('chart');
  const [communityMethod, setCommunityMethod] = useState<CommunityMethod>('label-propagation');
  const [showGuide, setShowGuide] = useState(false);
  const [visitedAnalyses, setVisitedAnalyses] = useState<string[]>([]);
  const [sessionEvents, setSessionEvents] = useState<Array<{ ts: number; event: string }>>([]);
  const [reportItems, setReportItems] = useState<ReportItem[]>([]);
  const [isCapturing, setIsCapturing] = useState(false);

  const logSession = (event: string) =>
    setSessionEvents(prev => [...prev, { ts: Date.now(), event }]);

  const handleAddToReport = useCallback(async () => {
    if (!analysisContentRef.current || !activeAnalysis) return;
    setIsCapturing(true);
    try {
      const { default: html2canvas } = await import('html2canvas');
      const el = analysisContentRef.current;
      const canvas = await html2canvas(el, {
        scale: 1.2, useCORS: true, allowTaint: true,
        width: el.scrollWidth, height: el.scrollHeight,
        scrollX: 0, scrollY: 0,
      });
      const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
      setReportItems(prev => {
        const filtered = prev.filter(item => item.key !== activeAnalysis);
        return [...filtered, { key: activeAnalysis, label: activeAnalysis, dataUrl, timestamp: Date.now() }];
      });
      logSession('Added to report: ' + activeAnalysis);
      toast.success('Snapshot added to report');
    } catch {
      toast.error('Failed to capture snapshot');
    } finally {
      setIsCapturing(false);
    }
  }, [activeAnalysis]);

  // ── Derived: dataset ──
  const isCustom = datasetKey === '_custom' || datasetKey === '_ai';
  const selectedDs: SampleNetwork | undefined = isCustom ? undefined : SAMPLE_NETWORKS.find(d => d.key === datasetKey);

  const matrixData = isCustom ? customMatrix : (selectedDs?.matrix ?? []);
  const nodeLabels = isCustom ? customLabels : (selectedDs?.labels ?? []);
  const currentEdges = isCustom ? (customEdges ?? []) : (selectedDs?.edges ?? []);
  const isDirected = isCustom ? customDirected : (selectedDs?.directed ?? true);

  // ── Derived: color map ──
  const colorMap = useMemo(
    () => nodeLabels.length > 0 ? createColorMap(nodeLabels, 'default') : {},
    [nodeLabels],
  );

  // ── Derived: model ──
  const rawModel = useMemo((): TNA | null => {
    if (!modelBuilt || matrixData.length === 0) return null;
    try {
      return buildModel(matrixData, {
        type: 'matrix',
        labels: nodeLabels,
        scaling: null,
      });
    } catch { return null; }
  }, [matrixData, nodeLabels, modelBuilt]);

  // ── Centrality from raw matrix (all 7 measures) ──
  const centralityData = useMemo(() => {
    if (!modelBuilt || matrixData.length === 0) return null;
    return computeAllCentralities(matrixData, nodeLabels);
  }, [matrixData, nodeLabels, modelBuilt]);

  // ── Communities ──
  const communities = useMemo(() => {
    if (!modelBuilt || matrixData.length === 0) return null;
    return detectCommunities(matrixData, communityMethod);
  }, [matrixData, modelBuilt, communityMethod]);

  // ── Node positions based on layout ──
  const nodePositions = useMemo(() => {
    if (!modelBuilt || matrixData.length === 0) return undefined;
    const n = nodeLabels.length;
    const size = 500;
    const cx = size / 2;
    const cy = size / 2;
    const r = cx - nodeRadius - 5;
    return computeLayout(layout, n, matrixData, cx, cy, r);
  }, [layout, nodeLabels, matrixData, nodeRadius, modelBuilt]);

  // ── Graph metrics ──
  const metrics = useMemo(() => {
    if (matrixData.length === 0) return null;
    return graphMetrics(matrixData, isDirected);
  }, [matrixData, isDirected]);

  const isCentralityActive = activeAnalysis === 'centrality' && centralityData != null;
  const isCommunitiesActive = activeAnalysis === 'communities' && communities != null;

  // ── Community-colored node map ──
  const communityColorMap = useMemo(() => {
    if (!isCommunitiesActive || !communities) return null;
    const map: Record<string, string> = {};
    nodeLabels.forEach((label, i) => {
      map[label] = COMMUNITY_COLORS[communities.assignments[i] % COMMUNITY_COLORS.length];
    });
    return map;
  }, [isCommunitiesActive, communities, nodeLabels]);

  // ── Handlers ──
  const handleSelectDataset = useCallback((key: string) => {
    if (!key) { setDatasetKey(null); return; }
    const netName = key === '_custom' ? 'Custom Network' : (SAMPLE_NETWORKS.find(d => d.key === key)?.key ?? key);
    logSession('Network selected: ' + netName);
    activityLogger.logLabDatasetSelected('SNA', netName, Number(courseId), { datasetKey: key });
    setDatasetKey(key);
    setCustomEdges(null);
    setModelBuilt(false);
    setActiveAnalysis(null);
  }, [courseId]);

  const handleAiSnaData = useCallback((data: SnaGeneratedData) => {
    const { labels, matrix } = edgesToMatrix(data.edges, data.directed);
    setCustomEdges(data.edges);
    setCustomDirected(data.directed);
    setCustomLabels(labels);
    setCustomMatrix(matrix);
    setDatasetKey('_ai');
    setModelBuilt(false);
    setActiveAnalysis(null);
  }, []);

  const handleCustomSubmit = useCallback((edges: Edge[], directed: boolean) => {
    const { labels, matrix } = edgesToMatrix(edges, directed);
    setCustomEdges(edges);
    setCustomDirected(directed);
    setCustomLabels(labels);
    setCustomMatrix(matrix);
    setDatasetKey('_custom');
    setModelBuilt(false);
    setActiveAnalysis(null);
    setShowCustomModal(false);
  }, []);

  const handleBuildModel = useCallback(() => {
    setModelBuilt(true);
    setActiveAnalysis(null);
    logSession('Network built: ' + nodeLabels.length + ' nodes, ' + currentEdges.length + ' edges');
    activityLogger.logLabModelBuilt('SNA', Number(courseId), { nodeCount: nodeLabels.length, edgeCount: currentEdges.length });
  }, [nodeLabels, currentEdges, courseId]);

  const toggleAnalysis = useCallback((key: AnalysisKey) => {
    // Side effects must live outside the updater (updaters are pure in React 18)
    if (activeAnalysis !== key) {
      logSession('Analysis opened: ' + key);
      setVisitedAnalyses(prev => [...new Set([...prev, key])]);
      activityLogger.logLabAnalysisViewed('SNA', key, Number(courseId), { datasetKey, communityMethod });
    }
    setActiveAnalysis(prev => prev === key ? null : key);
    setShowGuide(false);
  }, [activeAnalysis, courseId, datasetKey, communityMethod]);

  // ── Style constants ──
  const selectCls = "w-full px-2.5 py-1.5 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500";
  const labelCls = "block text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1";

  /* ── Guide content ── */
  const guideContent: Record<string, { title: string; text: string }> = {
    adjacency: {
      title: t('sna.guide_adjacency_title'),
      text: t('sna.guide_adjacency_text'),
    },
    centrality: {
      title: t('sna.guide_centrality_title'),
      text: t('sna.guide_centrality_text'),
    },
    communities: {
      title: t('sna.guide_communities_title'),
      text: t('sna.guide_communities_text'),
    },
    metrics: {
      title: t('sna.guide_metrics_title'),
      text: t('sna.guide_metrics_text'),
    },
  };

  /* ── Render ── */
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-screen-xl mx-auto px-4 sm:px-6 lg:px-8 py-6">

        {/* Breadcrumb */}
        {courseId && (
          <div className="mb-4">
            <Breadcrumb
              items={[
                { label: t('common:courses'), href: '/courses' },
                { label: t('sna.title') },
              ]}
            />
          </div>
        )}

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-r from-violet-500 to-purple-600 flex items-center justify-center">
              <Network className="w-4.5 h-4.5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-gray-900 dark:text-gray-100">{t('sna.title')}</h1>
              <p className="text-xs text-gray-500 dark:text-gray-400 hidden sm:block">{t('sna.subtitle')}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {snaAssignment && (
              <button
                onClick={() => setAssignmentPanelOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium transition-colors"
              >
                <ClipboardList className="w-3.5 h-3.5" />
                {t('submit_assignment', { defaultValue: 'Submit Assignment' })}
              </button>
            )}
            <button onClick={() => navigate(courseId ? `/courses/${courseId}` : -1 as any)} className="p-2 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* ── Layout: sidebar + main ── */}
        <div className="flex flex-col lg:flex-row gap-6" ref={exerciseRef}>

          {/* SIDEBAR */}
          <div className="lg:w-64 lg:flex-shrink-0">
            <div className="sticky top-6 space-y-3 max-h-[calc(100vh-4rem)] overflow-y-auto">

              {/* Setup panel */}
              <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-3 space-y-3">

                {/* Dataset Picker */}
                <div>
                  <label className={labelCls}>{t('sna.select_network')}</label>
                  <select value={isCustom ? '_custom' : (datasetKey ?? '')} onChange={e => handleSelectDataset(e.target.value)} className={selectCls}>
                    <option value="">{t('exercise.select_column')}</option>
                    {SAMPLE_NETWORKS.map(ds => (
                      <option key={ds.key} value={ds.key}>{t(ds.i18nTitle)}</option>
                    ))}
                    {isCustom && <option value="_custom">{t('sna.custom_network')}</option>}
                  </select>
                  {(selectedDs || isCustom) && (
                    <p className="text-[10px] text-gray-400 mt-1">
                      {nodeLabels.length} {t('sna.nodes')}, {currentEdges.length} {t('sna.edges_count')}, {isDirected ? t('sna.directed') : t('sna.undirected')}
                    </p>
                  )}
                </div>

                {/* Custom network & AI buttons */}
                <div className="flex gap-2">
                  <button
                    onClick={() => setShowCustomModal(true)}
                    className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg border border-dashed border-gray-300 dark:border-gray-600 text-xs font-medium text-gray-500 dark:text-gray-400 hover:border-violet-400 hover:text-violet-600 dark:hover:text-violet-400 transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    {t('sna.custom_enter')}
                  </button>
                  <button
                    onClick={() => setShowAIGenerator(true)}
                    className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg border border-dashed border-gray-300 dark:border-gray-600 text-xs font-medium text-gray-500 dark:text-gray-400 hover:border-violet-400 hover:text-violet-600 dark:hover:text-violet-400 transition-colors"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    {t('ai_gen.or_generate')}
                  </button>
                </div>

                {/* Build Button */}
                {datasetKey && (
                  <button
                    onClick={handleBuildModel}
                    disabled={matrixData.length === 0}
                    className="w-full px-4 py-2 rounded-lg bg-violet-600 text-white text-sm font-semibold hover:bg-violet-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    {t('sna.build_network')}
                  </button>
                )}
              </div>

              {/* Network controls + Analysis nav (after build) */}
              {modelBuilt && rawModel && (
                <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-3 space-y-3">

                  {/* Network controls */}
                  <div className="space-y-1.5">
                    <label className={labelCls}>{t('exercise.pipe_network')}</label>

                    {/* Layout selector */}
                    <div>
                      <span className="text-[10px] text-gray-400 block mb-1">{t('sna.layout')}</span>
                      <select value={layout} onChange={e => setLayout(e.target.value as LayoutType)} className={selectCls}>
                        {LAYOUT_OPTIONS.map(o => (
                          <option key={o.key} value={o.key}>{t(o.i18nKey)}</option>
                        ))}
                      </select>
                    </div>

                    <label className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-300 cursor-pointer">
                      <input type="checkbox" checked={showSelfLoops} onChange={e => setShowSelfLoops(e.target.checked)}
                        className="rounded w-3.5 h-3.5 text-violet-600" />
                      {t('exercise.self_loops')}
                    </label>
                    <label className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-300 cursor-pointer">
                      <input type="checkbox" checked={showEdgeLabels} onChange={e => setShowEdgeLabels(e.target.checked)}
                        className="rounded w-3.5 h-3.5 text-violet-600" />
                      {t('exercise.edge_labels')}
                    </label>
                    <label className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-300">
                      {t('exercise.node_size')}
                      <input type="range" min={15} max={50} value={nodeRadius}
                        onChange={e => setNodeRadius(Number(e.target.value))} className="w-16 h-1.5 accent-violet-600" />
                    </label>
                    <label className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-300">
                      {t('sna.edge_width')}
                      <input type="range" min={1} max={12} step={0.5} value={edgeWidth}
                        onChange={e => setEdgeWidth(Number(e.target.value))} className="w-16 h-1.5 accent-violet-600" />
                      <span className="text-[10px] text-gray-400 tabular-nums w-5">{edgeWidth}</span>
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
                                ? 'bg-violet-50 dark:bg-violet-950/30 text-violet-700 dark:text-violet-300 border-l-2 border-violet-500 ml-0'
                                : 'text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50'
                            }`}
                          >
                            <Icon className={`w-3.5 h-3.5 flex-shrink-0 ${isActive ? 'text-violet-500' : 'text-gray-400'}`} />
                            <span>{t(`sna.block_${key}`)}</span>
                          </button>

                          {/* Inline options */}
                          {isActive && key === 'communities' && (
                            <div className="ml-6 mt-1 mb-2 space-y-2">
                              <div>
                                <span className="text-[10px] text-gray-400 block mb-1">{t('sna.community_algorithm')}</span>
                                <select
                                  value={communityMethod}
                                  onChange={e => { setCommunityMethod(e.target.value as CommunityMethod); logSession('Community method: ' + e.target.value); }}
                                  className="w-full px-2 py-1 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-[11px] text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-violet-500"
                                >
                                  {COMMUNITY_METHOD_OPTIONS.map(opt => (
                                    <option key={opt.key} value={opt.key}>{t(opt.i18nKey)}</option>
                                  ))}
                                </select>
                              </div>
                              {communities && (
                                <div className="text-[10px] text-gray-500 dark:text-gray-400">
                                  {t('sna.communities_detected', { count: communities.k })}
                                </div>
                              )}
                            </div>
                          )}
                          {isActive && key === 'centrality' && (
                            <div className="ml-6 mt-1 mb-2 space-y-2">
                              <div>
                                <span className="text-[10px] text-gray-400 block mb-1">{t('sna.centrality_measure')}</span>
                                <div className="flex flex-wrap gap-1">
                                  {CENTRALITY_OPTIONS.map(opt => (
                                    <button
                                      key={opt.key}
                                      onClick={() => { setCentralityMetric(opt.key); logSession('Centrality metric: ' + opt.key); }}
                                      className={`px-2 py-0.5 rounded text-[10px] font-medium transition-colors ${
                                        centralityMetric === opt.key
                                          ? 'bg-violet-600 text-white'
                                          : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                                      }`}
                                    >
                                      {t(opt.i18nKey)}
                                    </button>
                                  ))}
                                </div>
                              </div>
                              <div className="flex rounded border border-gray-200 dark:border-gray-600 overflow-hidden">
                                <button
                                  onClick={() => { setCentralityView('chart'); logSession('Centrality view: chart'); }}
                                  className={`flex-1 px-2 py-0.5 text-[10px] font-medium transition-colors ${
                                    centralityView === 'chart'
                                      ? 'bg-violet-600 text-white'
                                      : 'bg-white dark:bg-gray-700 text-gray-500 dark:text-gray-400'
                                  }`}
                                >
                                  {t('exercise.centrality_chart')}
                                </button>
                                <button
                                  onClick={() => { setCentralityView('table'); logSession('Centrality view: table'); }}
                                  className={`flex-1 px-2 py-0.5 text-[10px] font-medium transition-colors ${
                                    centralityView === 'table'
                                      ? 'bg-violet-600 text-white'
                                      : 'bg-white dark:bg-gray-700 text-gray-500 dark:text-gray-400'
                                  }`}
                                >
                                  {t('exercise.centrality_table')}
                                </button>
                              </div>
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

          {/* MAIN AREA */}
          <div className="flex-1 min-w-0 space-y-4" ref={analysisContentRef}>

            {/* No dataset selected — intro */}
            {!datasetKey && (
              <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-8">
                <div className="max-w-2xl mx-auto text-center">
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-r from-violet-500 to-purple-600 flex items-center justify-center mx-auto mb-4">
                    <Network className="w-8 h-8 text-white" />
                  </div>
                  <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2">
                    {t('sna.intro_title')}
                  </h2>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
                    {t('sna.intro_text')}
                  </p>
                  <div className="grid sm:grid-cols-3 gap-4 mb-4">
                    {SAMPLE_NETWORKS.map(ds => {
                      const DsIcon = DATASET_ICONS[ds.icon] || Users;
                      return (
                        <button
                          key={ds.key}
                          onClick={() => handleSelectDataset(ds.key)}
                          className="p-4 rounded-xl border border-gray-200 dark:border-gray-700 hover:border-violet-300 dark:hover:border-violet-700 hover:bg-violet-50 dark:hover:bg-violet-950/20 transition-all text-left"
                        >
                          <div className={`w-10 h-10 rounded-lg bg-gradient-to-r ${ds.gradient} flex items-center justify-center mb-3`}>
                            <DsIcon className="w-5 h-5 text-white" />
                          </div>
                          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-1">
                            {t(ds.i18nTitle)}
                          </h3>
                          <p className="text-[11px] text-gray-500 dark:text-gray-400">
                            {t(ds.i18nDesc)}
                          </p>
                        </button>
                      );
                    })}
                  </div>
                  <div className="flex items-center justify-center gap-3">
                    <button
                      onClick={() => setShowCustomModal(true)}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-dashed border-gray-300 dark:border-gray-600 text-sm font-medium text-gray-500 dark:text-gray-400 hover:border-violet-400 hover:text-violet-600 dark:hover:text-violet-400 transition-colors"
                    >
                      <Plus className="w-4 h-4" />
                      {t('sna.custom_enter')}
                    </button>
                    <button
                      onClick={() => setShowAIGenerator(true)}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-dashed border-gray-300 dark:border-gray-600 text-sm font-medium text-gray-500 dark:text-gray-400 hover:border-violet-400 hover:text-violet-600 dark:hover:text-violet-400 transition-colors"
                    >
                      <Sparkles className="w-4 h-4" />
                      {t('ai_gen.or_generate')}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Edge list preview (before build) */}
            {datasetKey && !modelBuilt && currentEdges.length > 0 && (
              <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
                <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
                  <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                    {t('sna.edge_list')}
                  </h2>
                  <span className="text-xs text-gray-400">
                    {currentEdges.length} {t('sna.edges_count')}
                  </span>
                </div>
                <div className="overflow-x-auto max-h-[32rem] overflow-y-auto">
                  <table className="w-full text-xs">
                    <thead className="sticky top-0 bg-gray-50 dark:bg-gray-800 z-10">
                      <tr>
                        <th className="px-4 py-2 text-left text-gray-500 dark:text-gray-400 font-medium">#</th>
                        <th className="px-4 py-2 text-left text-gray-500 dark:text-gray-400 font-medium">{t('sna.col_from')}</th>
                        <th className="px-4 py-2 text-left text-gray-500 dark:text-gray-400 font-medium">{t('sna.col_to')}</th>
                        <th className="px-4 py-2 text-right text-gray-500 dark:text-gray-400 font-medium">{t('sna.col_weight')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {currentEdges.map((edge, i) => (
                        <tr key={i} className="border-t border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50">
                          <td className="px-4 py-1.5 text-gray-400 tabular-nums">{i + 1}</td>
                          <td className="px-4 py-1.5 text-gray-800 dark:text-gray-200">{edge.from}</td>
                          <td className="px-4 py-1.5 text-gray-800 dark:text-gray-200">{edge.to}</td>
                          <td className="px-4 py-1.5 text-right text-gray-600 dark:text-gray-300 tabular-nums font-medium">{edge.weight}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-700">
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {t('sna.edge_list_hint')}
                  </p>
                </div>
              </div>
            )}

            {/* After build: Network + Analysis */}
            {modelBuilt && rawModel && (
              <>
                {/* Network Graph (always visible) */}
                <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
                  <div className="flex items-center gap-3 mb-3">
                    <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                      {t('sna.network_graph')}
                    </h2>
                    {isCentralityActive && (
                      <span className="text-xs font-medium text-violet-600 dark:text-violet-400">
                        — {t(CENTRALITY_OPTIONS.find(o => o.key === centralityMetric)?.i18nKey ?? centralityMetric)}
                      </span>
                    )}
                    {isCommunitiesActive && (
                      <span className="text-xs font-medium text-violet-600 dark:text-violet-400">
                        — {t('sna.block_communities')} ({communities!.k})
                      </span>
                    )}
                  </div>
                  <TnaNetworkGraph
                    model={rawModel}
                    showSelfLoops={showSelfLoops}
                    showEdgeLabels={showEdgeLabels}
                    nodeRadius={nodeRadius}
                    height={500}
                    colorMap={communityColorMap ?? colorMap}
                    centralityData={isCentralityActive ? centralityData! : undefined}
                    nodeSizeMetric={isCentralityActive ? centralityMetric : undefined}
                    externalPositions={nodePositions}
                    maxEdgeWidth={edgeWidth}
                  />
                </div>

                {/* Guide Banner */}
                {activeAnalysis && guideContent[activeAnalysis] && (
                  <button
                    onClick={() => setShowGuide(g => !g)}
                    className={`w-full flex items-center gap-3 px-5 py-3 rounded-xl border text-left transition-colors ${
                      showGuide
                        ? 'bg-violet-50 dark:bg-violet-950/30 border-violet-200 dark:border-violet-800 text-violet-800 dark:text-violet-200'
                        : 'bg-violet-50/50 dark:bg-violet-950/20 border-violet-200 dark:border-violet-800 text-violet-700 dark:text-violet-300 hover:bg-violet-50 dark:hover:bg-violet-950/30'
                    }`}
                  >
                    <BookOpen className="w-5 h-5 text-violet-500 flex-shrink-0" />
                    <div className="flex-1">
                      <span className="text-sm font-semibold">
                        {guideContent[activeAnalysis].title}
                      </span>
                      <p className="text-xs text-violet-500 dark:text-violet-400">
                        {showGuide ? t('sna.click_hide') : t('sna.click_read')}
                      </p>
                    </div>
                    {showGuide
                      ? <ChevronDown className="w-4 h-4 text-violet-400" />
                      : <ChevronRight className="w-4 h-4 text-violet-400" />
                    }
                  </button>
                )}
                {activeAnalysis && showGuide && (
                  <SnaStepGuide step={activeAnalysis} />
                )}

                {/* Add-to-report capture button */}
                {modelBuilt && activeAnalysis && (
                  <button
                    onClick={handleAddToReport}
                    disabled={isCapturing}
                    className={`w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl border-2 text-sm font-semibold transition-all ${
                      reportItems.some(r => r.key === activeAnalysis)
                        ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 border-emerald-300 dark:border-emerald-700'
                        : 'bg-white dark:bg-gray-800 text-indigo-600 dark:text-indigo-400 border-dashed border-indigo-300 dark:border-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 hover:border-indigo-400'
                    }`}
                  >
                    {isCapturing ? <Loader2 className="w-4 h-4 animate-spin" />
                      : reportItems.some(r => r.key === activeAnalysis) ? <CheckCircle className="w-4 h-4" />
                      : <Camera className="w-4 h-4" />}
                    {isCapturing ? 'Capturing...'
                      : reportItems.some(r => r.key === activeAnalysis) ? 'Captured — click to recapture'
                      : 'Add this analysis to report'}
                  </button>
                )}

                {/* Graph Metrics */}
                {activeAnalysis === 'metrics' && metrics && (
                  <>
                    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
                      <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-4">
                        {t('sna.block_metrics')}
                      </h3>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                        {[
                          { label: t('sna.metric_nodes'), value: metrics.nNodes },
                          { label: t('sna.metric_edges'), value: metrics.nEdges },
                          { label: t('sna.metric_density'), value: metrics.density.toFixed(3) },
                          { label: t('sna.metric_avg_degree'), value: metrics.avgDegree },
                          { label: t('sna.metric_avg_weight'), value: metrics.avgWeight },
                          ...(metrics.reciprocity !== null
                            ? [{ label: t('sna.metric_reciprocity'), value: metrics.reciprocity }]
                            : []),
                        ].map(({ label, value }) => (
                          <div key={label} className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-3">
                            <div className="text-[10px] uppercase tracking-wide text-gray-400 mb-1">{label}</div>
                            <div className="text-lg font-bold text-gray-900 dark:text-gray-100">{value}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                    <LabAIAssistant
                      labType="sna"
                      analysisKey="metrics"
                      context="Graph-level metrics — density, reciprocity, average degree, and average weight of the SNA network"
                      data={`Nodes: ${metrics.nNodes}. Edges: ${metrics.nEdges}. Density: ${metrics.density.toFixed(3)}. Avg degree: ${metrics.avgDegree}. Avg weight: ${metrics.avgWeight}.${metrics.reciprocity !== null ? ` Reciprocity: ${metrics.reciprocity}.` : ''}`}
                    />
                  </>
                )}

                {/* Centrality */}
                {activeAnalysis === 'centrality' && centralityData && (
                  <>
                    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
                      <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-4">
                        {t('sna.block_centrality')}
                      </h3>
                      {centralityView === 'chart' ? (
                        <CentralityBarChart centralityData={centralityData} colorMap={colorMap} selectedMeasure={centralityMetric} />
                      ) : (
                        <TnaCentralityTable centralityData={centralityData} colorMap={colorMap} />
                      )}
                    </div>
                    <LabAIAssistant
                      labType="sna"
                      analysisKey="centrality"
                      context={`Centrality analysis — ${centralityMetric} measure showing node importance in the SNA network`}
                      data={`Measure: ${centralityMetric}. Nodes: ${nodeLabels.join(', ')}.`}
                    />
                  </>
                )}

                {/* Communities */}
                {activeAnalysis === 'communities' && communities && (
                  <>
                    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
                      <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-4">
                        {t('sna.block_communities')}
                      </h3>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
                        {t('sna.communities_info')}
                      </p>
                      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        {Array.from({ length: communities.k }, (_, ci) => {
                          const members = nodeLabels.filter((_, ni) => communities.assignments[ni] === ci);
                          return (
                            <div key={ci} className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-3">
                              <div className="flex items-center gap-2 mb-2">
                                <span className="w-3 h-3 rounded-full" style={{ backgroundColor: COMMUNITY_COLORS[ci % COMMUNITY_COLORS.length] }} />
                                <span className="text-xs font-semibold text-gray-700 dark:text-gray-200">
                                  {t('sna.community_label', { n: ci + 1 })}
                                </span>
                                <span className="text-[10px] text-gray-400 ml-auto">
                                  {members.length} {t('sna.nodes')}
                                </span>
                              </div>
                              <div className="flex flex-wrap gap-1">
                                {members.map(m => (
                                  <span key={m} className="px-1.5 py-0.5 rounded text-[10px] bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-600">
                                    {m}
                                  </span>
                                ))}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                    <LabAIAssistant
                      labType="sna"
                      analysisKey="communities"
                      context={`Community detection — ${communities.k} communities detected using ${communityMethod} algorithm`}
                      data={`Algorithm: ${communityMethod}. Communities: ${communities.k}. Nodes: ${nodeLabels.join(', ')}.`}
                    />
                  </>
                )}

                {/* Adjacency Matrix (heatmap) */}
                {activeAnalysis === 'adjacency' && (
                  <>
                    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
                      <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-4">
                        {t('sna.block_adjacency')}
                      </h3>
                      <TransitionHeatmap model={rawModel} colorMap={colorMap} />
                    </div>
                    <LabAIAssistant
                      labType="sna"
                      analysisKey="adjacency"
                      context={`Adjacency matrix — ${isDirected ? 'directed' : 'undirected'} network with ${nodeLabels.length} nodes`}
                      data={`Nodes (${nodeLabels.length}): ${nodeLabels.join(', ')}. Directed: ${isDirected}.`}
                    />
                  </>
                )}

                {/* No analysis selected — prompt */}
                {!activeAnalysis && (
                  <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-8 text-center">
                    <Network className="w-10 h-10 text-violet-400 mx-auto mb-3" />
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-1">
                      {t('sna.select_analysis')}
                    </h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {t('sna.select_analysis_hint')}
                    </p>
                  </div>
                )}
              </>
            )}

            {/* Model build failed */}
            {modelBuilt && !rawModel && (
              <div className="bg-white dark:bg-gray-800 rounded-xl border border-red-200 dark:border-red-800 p-8 text-center">
                <p className="text-sm text-red-600 dark:text-red-400">{t('sna.build_error')}</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Custom Network Modal */}
      {showCustomModal && (
        <CustomNetworkModal
          onClose={() => setShowCustomModal(false)}
          onSubmit={handleCustomSubmit}
        />
      )}

      {/* AI Dataset Generator Modal */}
      {showAIGenerator && (
        <AIDatasetGenerator
          type="sna"
          onClose={() => setShowAIGenerator(false)}
          onSnaData={handleAiSnaData}
        />
      )}

      {snaAssignment && (
        <LabAssignmentPanel
          isOpen={assignmentPanelOpen}
          onClose={() => setAssignmentPanelOpen(false)}
          assignment={{
            id: snaAssignment.id,
            description: snaAssignment.description ?? null,
            points: snaAssignment.points ?? null,
            dueDate: snaAssignment.dueDate ? String(snaAssignment.dueDate) : null,
          }}
          labContentRef={analysisContentRef}
          labId={0}
          courseId={Number(courseId)}
          hasActiveAnalysis={modelBuilt && activeAnalysis !== null}
          activeAnalysisKey={activeAnalysis ?? undefined}
          visitedAnalyses={visitedAnalyses}
          sessionEvents={sessionEvents}
          sessionConfig={{
            labType: 'sna',
            datasetName: selectedDs ? t(selectedDs.i18nTitle) : (datasetKey === '_ai' ? 'AI Generated' : (datasetKey === '_custom' ? 'Custom Network' : '')),
            nodeCount: metrics?.nNodes,
            edgeCount: metrics?.nEdges,
            density: metrics?.density,
            isDirected,
            communityMethod,
            communityCount: communities?.k,
            avgDegree: metrics?.avgDegree,
            avgWeight: metrics?.avgWeight,
          }}
          courseNumericId={Number(courseId)}
          assignmentId={snaAssignment?.id}
          reportItems={reportItems}
        />
      )}
    </div>
  );
};
