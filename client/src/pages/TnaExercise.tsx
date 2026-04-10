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

import { useState, useMemo, useCallback, useRef } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { Breadcrumb } from '../components/common/Breadcrumb';
import {
  Network, X, BarChart3, GitBranch,
  Scissors, Target, Users,
  Database, Share2, BookOpen, ChevronDown, ChevronRight,
  Camera, Loader2, CheckCircle, Download, RefreshCw,
  Award, Calendar, Clock, Send, FileText, AlertCircle, Upload,
} from 'lucide-react';
import { assignmentsApi } from '../api/assignments';
import { coursesApi } from '../api/courses';
import { resolveFileUrl } from '../api/client';
import { LabAssignmentPanel, type ReportItem } from '../components/labs/LabAssignmentPanel';
import toast from 'react-hot-toast';
import { MyDatasetPicker } from '../components/common/MyDatasetPicker';
import { SearchableSelect } from '../components/common/SearchableSelect';
import { Card, CardBody } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { INTERACTIVE_LAB_REQUIREMENTS } from '../types';
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
import { LabAIAssistant } from '../components/ai/LabAIAssistant';
import { activityLogger } from '../services/activityLogger';
import { exportRowsAsCSV, exportMatrixAsCSV, exportCentralityAsCSV } from '../utils/csvExport';

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
  const [searchParams] = useSearchParams();
  const csvUploadRef = useRef<HTMLInputElement>(null);
  const exerciseRef = useRef<HTMLDivElement>(null);
  const analysisContentRef = useRef<HTMLDivElement>(null);
  const [assignmentPanelOpen, setAssignmentPanelOpen] = useState(false);

  const { data: course } = useQuery({
    queryKey: ['course', courseId],
    queryFn: () => coursesApi.getCourseById(Number(courseId)),
    enabled: !!courseId,
  });
  const { data: courseAssignments } = useQuery({
    queryKey: ['courseAssignments', courseId],
    queryFn: () => assignmentsApi.getAssignments(Number(courseId)),
    enabled: !!courseId,
  });
  const targetAssignmentId = searchParams.get('assignmentId');
  const tnaAssignment = targetAssignmentId
    ? courseAssignments?.find(a => a.id === Number(targetAssignmentId)) ?? null
    : courseAssignments?.find(a => a.agentRequirements === INTERACTIVE_LAB_REQUIREMENTS.TNA) ?? null;

  const { data: mySubmission } = useQuery({
    queryKey: ['mySubmission', tnaAssignment?.id],
    queryFn: () => assignmentsApi.getMySubmission(tnaAssignment!.id),
    enabled: !!tnaAssignment,
    retry: false,
  });

  const dueDateLocal = tnaAssignment?.dueDate ? new Date(String(tnaAssignment.dueDate).replace('Z', '')) : null;
  const gracePeriodLocal = tnaAssignment?.gracePeriodDeadline ? new Date(String(tnaAssignment.gracePeriodDeadline).replace('Z', '')) : null;
  const isPastDue = dueDateLocal ? dueDateLocal < new Date() : false;
  const isInGracePeriod = isPastDue && gracePeriodLocal ? new Date() < gracePeriodLocal : false;
  const isFullyPastDue = isPastDue && !isInGracePeriod;
  const isSubmitted = mySubmission?.status === 'submitted' || mySubmission?.status === 'graded';
  const isGraded = mySubmission?.status === 'graded';
  const canResubmit = isSubmitted && !isGraded && !isFullyPastDue;

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
  const [nodeSizeBy, setNodeSizeBy] = useState<string>('fixed');
  const [showNodeLabels, setShowNodeLabels] = useState(true);
  const [nodeFontSize, setNodeFontSize] = useState(11);
  const [edgeWidth, setEdgeWidth] = useState(2);

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
  const [showDatasetPicker, setShowDatasetPicker] = useState(false);
  const [visitedAnalyses, setVisitedAnalyses] = useState<string[]>([]);
  const [sessionEvents, setSessionEvents] = useState<Array<{ ts: number; event: string }>>([]);
  const [reportItems, setReportItems] = useState<ReportItem[]>([]);
  const [isCapturing, setIsCapturing] = useState(false);

  // ── AI-generated data ──
  const [aiRows, setAiRows] = useState<RawRow[] | null>(null);
  const [aiColumns, setAiColumns] = useState<string[] | null>(null);

  const logSession = (event: string) =>
    setSessionEvents(prev => [...prev, { ts: Date.now(), event }]);

  const handleAddToReport = useCallback(async () => {
    if (!analysisContentRef.current || !activeAnalysis) return;
    setIsCapturing(true);
    try {
      const el = analysisContentRef.current;
      const { default: html2canvas } = await import('html2canvas');

      // Hide elements that shouldn't be captured
      const hideEls = el.querySelectorAll('[data-no-capture]');
      hideEls.forEach(e => (e as HTMLElement).style.display = 'none');

      // 1. Capture network card (hide toolbar)
      const networkCard = el.querySelector('[data-network-card]') as HTMLElement | null;
      const toolbar = networkCard?.querySelector('[data-graph-toolbar]') as HTMLElement | null;
      let networkDataUrl: string | null = null;
      if (networkCard) {
        if (toolbar) toolbar.style.display = 'none';
        const netCanvas = await html2canvas(networkCard, {
          scale: 2, useCORS: true, allowTaint: true,
          width: networkCard.scrollWidth, height: networkCard.scrollHeight,
          scrollX: 0, scrollY: 0,
        });
        if (toolbar) toolbar.style.display = '';
        if (netCanvas.height > 5) networkDataUrl = netCanvas.toDataURL('image/jpeg', 0.9);
      }

      // 2. Capture analysis content card directly
      const analysisCard = el.querySelector('[data-analysis-content]') as HTMLElement | null;
      let analysisDataUrl: string | null = null;
      if (analysisCard && analysisCard.scrollHeight > 5) {
        const analysisCanvas = await html2canvas(analysisCard, {
          scale: 2, useCORS: true, allowTaint: true,
          width: analysisCard.scrollWidth, height: analysisCard.scrollHeight,
          scrollX: 0, scrollY: 0,
        });
        if (analysisCanvas.height > 5) analysisDataUrl = analysisCanvas.toDataURL('image/jpeg', 0.9);
      }
      hideEls.forEach(e => (e as HTMLElement).style.display = '');

      // 3. Combine: network on top, analysis below
      const netImg = networkDataUrl ? new Image() : null;
      const anlImg = analysisDataUrl ? new Image() : null;
      if (netImg && networkDataUrl) await new Promise<void>(r => { netImg.onload = () => r(); netImg.src = networkDataUrl!; });
      if (anlImg && analysisDataUrl) await new Promise<void>(r => { anlImg.onload = () => r(); anlImg.src = analysisDataUrl!; });
      const netW = netImg?.width || 0, netH = netImg?.height || 0;
      const anlW = anlImg?.width || 0, anlH = anlImg?.height || 0;
      const totalW = Math.max(netW, anlW, 1);
      const totalH = netH + anlH || 1;
      const combinedCanvas = document.createElement('canvas');
      combinedCanvas.width = totalW;
      combinedCanvas.height = totalH;
      const cctx = combinedCanvas.getContext('2d')!;
      cctx.fillStyle = '#ffffff';
      cctx.fillRect(0, 0, totalW, totalH);
      if (netImg) cctx.drawImage(netImg, (totalW - netW) / 2, 0);
      if (anlImg) cctx.drawImage(anlImg, (totalW - anlW) / 2, netH);

      const dataUrl = combinedCanvas.toDataURL('image/jpeg', 0.85);
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
    const dsName = key === '_ai' ? 'AI Generated' : (SAMPLE_DATASETS.find(d => d.key === key)?.key ?? key);
    logSession('Dataset selected: ' + dsName);
    activityLogger.logLabDatasetSelected('TNA', dsName, Number(courseId), { datasetKey: key });
    setDatasetKey(key);
    setActorCol('');
    setActionCol('');
    setTimeCol('');
    setModelBuilt(false);
    setActiveAnalysis(null);
  }, [courseId]);

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

  const handleMyDatasetSelect = useCallback((csvText: string) => {
    const lines = csvText.trim().split('\n').filter(l => l.trim());
    if (lines.length < 2) return;
    const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
    const rows: import('../components/tna-exercise/sampleDatasets').RawRow[] = [];
    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(',').map(c => c.trim().replace(/^"|"$/g, ''));
      const row: Record<string, string> = {};
      headers.forEach((h, idx) => { row[h] = cols[idx] || ''; });
      rows.push(row);
    }
    if (rows.length === 0) return;
    setAiColumns(headers);
    setAiRows(rows);
    setDatasetKey('_ai');
    setActorCol('');
    setActionCol('');
    setTimeCol('');
    setModelBuilt(false);
    setActiveAnalysis(null);
  }, []);

  const handleCsvUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      if (text) handleMyDatasetSelect(text);
    };
    reader.readAsText(file);
    e.target.value = '';
  }, [handleMyDatasetSelect]);

  const handleBuildModel = useCallback(() => {
    setModelBuilt(true);
    setActiveAnalysis(null);
    logSession('Model built: ' + modelType + ', ' + sequences.length + ' sequences, ' + labels.length + ' states');
    activityLogger.logLabModelBuilt('TNA', Number(courseId), { modelType, sequenceCount: sequences.length, stateCount: labels.length });
  }, [modelType, sequences, labels, courseId]);

  const toggleAnalysis = useCallback((key: AnalysisKey) => {
    // Side effects must live outside the updater (updaters are pure in React 18)
    if (activeAnalysis !== key) {
      logSession('Analysis opened: ' + key);
      setVisitedAnalyses(prev => [...new Set([...prev, key])]);
      activityLogger.logLabAnalysisViewed('TNA', key, Number(courseId), { datasetKey, modelType });
    }
    setActiveAnalysis(prev => prev === key ? null : key);
    setShowGuide(false);
  }, [activeAnalysis, courseId, datasetKey, modelType]);

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
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        {/* Breadcrumb */}
        {courseId && (
          <div className="mb-6">
            <Breadcrumb
              items={[
                { label: t('common:courses'), href: '/courses' },
                { label: course?.title || t('common:course'), href: `/courses/${courseId}` },
                ...(tnaAssignment ? [{ label: t('assignments'), href: `/courses/${courseId}/assignments` }] : []),
                { label: tnaAssignment?.title || t('exercise.title') },
              ]}
            />
          </div>
        )}

        {/* Assignment Header Card */}
        {tnaAssignment ? (
          <Card className="mb-6">
            <CardBody>
              <div className="flex items-start justify-between mb-4">
                <div>
                  <p className="text-sm mb-1 text-gray-500 dark:text-gray-400">{course?.title}</p>
                  <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{tnaAssignment.title}</h1>
                </div>
                {isGraded ? (
                  <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400">
                    <Award className="w-4 h-4" />
                    {t('graded_with_score', { grade: mySubmission?.grade, total: tnaAssignment.points, defaultValue: `${mySubmission?.grade}/${tnaAssignment.points}` })}
                  </span>
                ) : isSubmitted ? (
                  <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400">
                    <CheckCircle className="w-4 h-4" />
                    {t('submitted_status', { defaultValue: 'Submitted' })}
                  </span>
                ) : isInGracePeriod ? (
                  <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400">
                    <AlertCircle className="w-4 h-4" />
                    {t('grace_period_status', { defaultValue: 'Grace Period' })}
                  </span>
                ) : isFullyPastDue ? (
                  <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400">
                    <AlertCircle className="w-4 h-4" />
                    {t('past_due_status', { defaultValue: 'Past Due' })}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
                    <FileText className="w-4 h-4" />
                    {t('not_started_status', { defaultValue: 'Not Started' })}
                  </span>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
                <span className="flex items-center gap-1">
                  <Award className="w-4 h-4" />
                  {tnaAssignment.points} {t('common:points', { defaultValue: 'points' })}
                </span>
                {dueDateLocal && (
                  <span className={`flex items-center gap-1 ${isPastDue ? 'text-red-600' : ''}`}>
                    <Calendar className="w-4 h-4" />
                    {t('due_at', {
                      defaultValue: 'Due {{date}} at {{time}}',
                      date: dueDateLocal.toLocaleDateString(undefined, { timeZone: 'UTC' }),
                      time: dueDateLocal.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' }),
                    })}
                  </span>
                )}
                {gracePeriodLocal && (
                  <span className={`flex items-center gap-1 ${isInGracePeriod ? 'text-red-600' : ''}`}>
                    <Clock className="w-4 h-4" />
                    {t('grace_period_until', {
                      defaultValue: 'Grace period until {{date}} at {{time}}',
                      date: gracePeriodLocal.toLocaleDateString(undefined, { timeZone: 'UTC' }),
                      time: gracePeriodLocal.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' }),
                    })}
                  </span>
                )}
                <span className="flex items-center gap-1 capitalize">
                  <FileText className="w-4 h-4" />
                  {t('submission_type_label', { type: tnaAssignment.submissionType, defaultValue: tnaAssignment.submissionType })}
                </span>
              </div>
            </CardBody>
          </Card>
        ) : (
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
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
        )}

        {/* ── Layout: sidebar + main ── */}
        <div className="flex flex-col lg:flex-row gap-6" ref={exerciseRef}>

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
                  <div className="flex flex-col gap-1.5 mt-1.5">
                    {/* <button
                      onClick={() => setShowAIGenerator(true)}
                      className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg border border-dashed border-gray-300 dark:border-gray-600 text-xs font-medium text-gray-500 dark:text-gray-400 hover:border-violet-400 hover:text-violet-600 dark:hover:text-violet-400 transition-colors"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      {t('ai_gen.or_generate')}
                    </button> */}
                    <button
                      onClick={() => setShowDatasetPicker(true)}
                      className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg border border-dashed border-gray-300 dark:border-gray-600 text-xs font-medium text-gray-500 dark:text-gray-400 hover:border-violet-400 hover:text-violet-600 dark:hover:text-violet-400 transition-colors"
                    >
                      <Database className="w-3.5 h-3.5" />
                      {t('my_datasets')}
                    </button>
                    <button
                      onClick={() => csvUploadRef.current?.click()}
                      className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg border border-dashed border-gray-300 dark:border-gray-600 text-xs font-medium text-gray-500 dark:text-gray-400 hover:border-violet-400 hover:text-violet-600 dark:hover:text-violet-400 transition-colors"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      {t('upload_csv', { defaultValue: 'Upload CSV' })}
                    </button>
                    <input ref={csvUploadRef} type="file" accept=".csv" className="hidden" onChange={handleCsvUpload} />
                  </div>
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

              {/* Download Data */}
              {datasetKey && rawRows.length > 0 && (
                <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-3 space-y-2">
                  <label className={labelCls}>
                    <Download className="w-3 h-3 inline mr-1" />
                    {t('exercise.download_data')}
                  </label>
                  <button
                    onClick={() => exportRowsAsCSV(rawRows as Record<string, unknown>[], 'tna-event-log.csv')}
                    className="w-full text-left px-2.5 py-1.5 rounded-lg text-xs text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                  >
                    Event Log ({rawRows.length} rows)
                  </button>
                  {modelBuilt && rawModel && (
                    <>
                      <button
                        onClick={() => {
                          const { labels: l, weights: w } = rawModel;
                          const n = l.length;
                          const matrix = Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => w.get(i, j)));
                          exportMatrixAsCSV(matrix, l, 'tna-transitions.csv');
                        }}
                        className="w-full text-left px-2.5 py-1.5 rounded-lg text-xs text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                      >
                        Transition Matrix
                      </button>
                      {centralityData && (
                        <button
                          onClick={() => exportCentralityAsCSV(centralityData, 'tna-centrality.csv')}
                          className="w-full text-left px-2.5 py-1.5 rounded-lg text-xs text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                        >
                          Centrality Measures
                        </button>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* ══════════ MAIN AREA ══════════ */}
          <div className="flex-1 min-w-0 space-y-4" ref={analysisContentRef}>

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
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-400">{rawRows.length} {t('exercise.rows')}</span>
                    <button
                      onClick={() => exportRowsAsCSV(rawRows as Record<string, unknown>[], 'tna-event-log.csv')}
                      className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded-md bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                      title={t('exercise.download_csv')}
                    >
                      <Download className="w-3 h-3" />
                      CSV
                    </button>
                  </div>
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
                {/* ── Network Graph with controls ── */}
                <div data-network-card className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
                  <div className="flex items-center gap-3 mb-4">
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

                  {/* Graph controls toolbar */}
                  <div data-graph-toolbar className="space-y-3 mb-4 pb-4 border-b border-gray-100 dark:border-gray-700">
                    {/* Row 1: Dropdowns + Checkboxes */}
                    <div className="flex flex-wrap items-end gap-3">
                      <SearchableSelect
                        label={t('exercise.node_size_by')}
                        value={nodeSizeBy}
                        onChange={setNodeSizeBy}
                        options={[
                          { value: 'fixed', label: t('exercise.fixed_size') },
                          { value: 'InStrength', label: t('exercise.in_strength') },
                          { value: 'OutStrength', label: t('exercise.out_strength') },
                          { value: 'InDegree', label: t('exercise.in_degree') },
                          { value: 'OutDegree', label: t('exercise.out_degree') },
                          { value: 'Betweenness', label: t('exercise.betweenness') },
                        ]}
                        className="w-[160px]"
                      />
                      <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 ml-2">
                        <label className="flex items-center gap-1.5 text-[13px] text-gray-700 dark:text-gray-200 cursor-pointer">
                          <input type="checkbox" checked={showSelfLoops} onChange={e => setShowSelfLoops(e.target.checked)}
                            className="rounded w-4 h-4 text-blue-600" />
                          {t('exercise.self_loops')}
                        </label>
                        <label className="flex items-center gap-1.5 text-[13px] text-gray-700 dark:text-gray-200 cursor-pointer">
                          <input type="checkbox" checked={showEdgeLabels} onChange={e => setShowEdgeLabels(e.target.checked)}
                            className="rounded w-4 h-4 text-blue-600" />
                          {t('exercise.edge_labels')}
                        </label>
                        <label className="flex items-center gap-1.5 text-[13px] text-gray-700 dark:text-gray-200 cursor-pointer">
                          <input type="checkbox" checked={showNodeLabels} onChange={e => setShowNodeLabels(e.target.checked)}
                            className="rounded w-4 h-4 text-blue-600" />
                          {t('exercise.node_labels')}
                        </label>
                      </div>
                    </div>
                    {/* Row 2: Sliders */}
                    <div className="flex flex-wrap items-center gap-6">
                      <div className="flex items-center gap-2 flex-1 min-w-[200px]">
                        <span className="text-[12px] text-gray-500 whitespace-nowrap">{t('exercise.node_size')}</span>
                        <input type="range" min={15} max={50} value={nodeRadius}
                          onChange={e => setNodeRadius(Number(e.target.value))} className="flex-1 h-2 rounded-full accent-blue-600 cursor-pointer" />
                        <span className="text-[12px] font-semibold text-blue-600 tabular-nums w-6 text-right">{nodeRadius}</span>
                      </div>
                      <div className="flex items-center gap-2 flex-1 min-w-[200px]">
                        <span className="text-[12px] text-gray-500 whitespace-nowrap">{t('exercise.label_size')}</span>
                        <input type="range" min={6} max={18} value={nodeFontSize}
                          onChange={e => setNodeFontSize(Number(e.target.value))} className="flex-1 h-2 rounded-full accent-blue-600 cursor-pointer" />
                        <span className="text-[12px] font-semibold text-blue-600 tabular-nums w-6 text-right">{nodeFontSize}</span>
                      </div>
                      <div className="flex items-center gap-2 flex-1 min-w-[200px]">
                        <span className="text-[12px] text-gray-500 whitespace-nowrap">{t('sna.edge_width')}</span>
                        <input type="range" min={1} max={12} step={0.5} value={edgeWidth}
                          onChange={e => setEdgeWidth(Number(e.target.value))} className="flex-1 h-2 rounded-full accent-blue-600 cursor-pointer" />
                        <span className="text-[12px] font-semibold text-blue-600 tabular-nums w-6 text-right">{edgeWidth}</span>
                      </div>
                    </div>
                  </div>

                  <TnaNetworkGraph
                    model={displayModel!}
                    showSelfLoops={showSelfLoops}
                    showEdgeLabels={showEdgeLabels}
                    nodeRadius={nodeRadius}
                    height={500}
                    colorMap={colorMap}
                    centralityData={centralityData ?? undefined}
                    nodeSizeMetric={isCentralityActive ? centralityMetric : nodeSizeBy !== 'fixed' ? nodeSizeBy : undefined}
                    modelType={modelType}
                    showNodeLabels={showNodeLabels}
                    nodeFontSize={nodeFontSize}
                    maxEdgeWidth={edgeWidth}
                  />
                </div>

                {/* Analysis tabs (horizontal) */}
                <div data-no-capture className="flex flex-wrap items-center gap-2">
                  {ANALYSIS_ITEMS.map(({ key, icon: Icon }) => {
                    const isActive = activeAnalysis === key;
                    return (
                      <button
                        key={key}
                        onClick={() => toggleAnalysis(key)}
                        className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                          isActive
                            ? 'bg-blue-600 text-white shadow-sm'
                            : 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50'
                        }`}
                      >
                        <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-gray-400'}`} />
                        {t(`exercise.block_${key}`)}
                      </button>
                    );
                  })}
                </div>

                {/* Sub-options for active analysis */}
                {activeAnalysis === 'frequencies' && (
                  <div data-no-capture className="flex flex-wrap items-center gap-3">
                    <ToggleGroup value={freqView} onChange={v => setFreqView(v as typeof freqView)} options={[
                      { key: 'bar', label: 'Bar' }, { key: 'distribution', label: 'Dist' }, { key: 'both', label: 'Both' },
                    ]} />
                    <ToggleGroup value={freqSort} onChange={v => setFreqSort(v as typeof freqSort)} options={[
                      { key: 'alpha', label: 'A-Z' }, { key: 'count', label: '#' },
                    ]} />
                  </div>
                )}
                {activeAnalysis === 'transitions' && (
                  <div data-no-capture className="flex flex-wrap items-center gap-3">
                    <ToggleGroup value={transitionView} onChange={v => { setTransitionView(v as typeof transitionView); logSession('Transition view: ' + v); }} options={[
                      { key: 'counts', label: t('exercise.raw_counts') }, { key: 'probs', label: t('exercise.probabilities') }, { key: 'both', label: 'Both' },
                    ]} />
                  </div>
                )}
                {activeAnalysis === 'pruning' && (
                  <div data-no-capture className="flex flex-wrap items-center gap-4">
                    <div className="flex items-center gap-2 min-w-[250px]">
                      <span className="text-[12px] text-gray-500 whitespace-nowrap">{t('exercise.prune_threshold')}</span>
                      <input type="range" min={0} max={0.5} step={0.01} value={pruneThreshold}
                        onChange={e => { setPruneThreshold(Number(e.target.value)); logSession('Prune threshold: ' + e.target.value); }}
                        className="flex-1 h-2 rounded-full accent-blue-600 cursor-pointer" />
                      <span className="text-[12px] font-semibold text-blue-600 tabular-nums">{pruneThreshold.toFixed(2)}</span>
                    </div>
                    <span className="text-[12px] text-gray-500">{edgeCount.pruned}/{edgeCount.original} edges</span>
                  </div>
                )}
                {activeAnalysis === 'centrality' && (
                  <div data-no-capture className="flex flex-wrap items-center gap-3">
                    <ToggleGroup value={centralityMetric} onChange={v => { setCentralityMetric(v as typeof centralityMetric); logSession('Centrality metric: ' + v); }} options={[
                      { key: 'InStrength', label: 'In-Strength' }, { key: 'OutStrength', label: 'Out-Strength' }, { key: 'Betweenness', label: 'Betweenness' },
                    ]} />
                    <label className="flex items-center gap-1.5 text-[13px] text-gray-700 dark:text-gray-200 cursor-pointer">
                      <input type="checkbox" checked={showCentralityTable}
                        onChange={e => setShowCentralityTable(e.target.checked)}
                        className="rounded w-4 h-4 text-blue-600" />
                      {t('exercise.centrality_table')}
                    </label>
                  </div>
                )}
                {activeAnalysis === 'clusters' && (
                  <div data-no-capture className="flex items-center gap-3">
                    <span className="text-[12px] text-gray-500">{t('exercise.num_clusters')}</span>
                    <input type="range" min={2} max={10} value={clusterK}
                      onChange={e => { setClusterK(Number(e.target.value)); logSession('Cluster k: ' + e.target.value); }}
                      className="w-32 h-2 rounded-full accent-blue-600 cursor-pointer" />
                    <span className="text-[12px] font-semibold text-blue-600 tabular-nums">{clusterK}</span>
                  </div>
                )}

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

                {/* ── Analysis Result ── */}
                {activeAnalysis === 'frequencies' && (
                  <>
                    <div data-analysis-content className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
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
                    <LabAIAssistant
                      labType="tna"
                      analysisKey="frequencies"
                      context="Frequency analysis of TNA model — state occurrence counts and distribution over time"
                      data={`States: ${sortedFreqLabels.join(', ')}. Total sequences: ${sequences.length}.`}
                    />
                  </>
                )}

                {activeAnalysis === 'transitions' && (
                  <>
                    <div data-analysis-content className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                          {t('exercise.block_transitions')}
                        </h3>
                        {rawModel && (
                          <button
                            onClick={() => {
                              const { labels: l, weights: w } = rawModel;
                              const n = l.length;
                              const matrix = Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => w.get(i, j)));
                              exportMatrixAsCSV(matrix, l, 'tna-transitions.csv');
                            }}
                            className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded-md bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                          >
                            <Download className="w-3 h-3" />
                            CSV
                          </button>
                        )}
                      </div>
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
                    <LabAIAssistant
                      labType="tna"
                      analysisKey="transitions"
                      context="Transition matrix analysis — showing how learners move between states"
                      data={`States: ${labels.join(', ')}. Model type: ${modelType}. Sequences: ${sequences.length}.`}
                    />
                  </>
                )}

                {activeAnalysis === 'pruning' && (
                  <>
                    <div data-analysis-content className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
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
                    <LabAIAssistant
                      labType="tna"
                      analysisKey="pruning"
                      context="Network pruning — removing weak edges to reveal the backbone structure"
                      data={`Threshold: ${pruneThreshold.toFixed(2)}. Original edges: ${edgeCount.original}. Retained edges: ${edgeCount.pruned}. Removed: ${edgeCount.original - edgeCount.pruned}.`}
                    />
                  </>
                )}

                {activeAnalysis === 'centrality' && centralityData && (
                  <>
                    <div data-analysis-content className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                          {t('exercise.block_centrality')}
                        </h3>
                        <button
                          onClick={() => exportCentralityAsCSV(centralityData, 'tna-centrality.csv')}
                          className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded-md bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                        >
                          <Download className="w-3 h-3" />
                          CSV
                        </button>
                      </div>
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
                    <LabAIAssistant
                      labType="tna"
                      analysisKey="centrality"
                      context={`Centrality analysis — ${centralityMetric} measure showing node importance in the TNA network`}
                      data={`Metric shown: ${centralityMetric}. Nodes: ${centralityData.labels.join(', ')}.`}
                    />
                  </>
                )}

                {activeAnalysis === 'clusters' && (
                  <>
                    <div data-analysis-content className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
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
                    <LabAIAssistant
                      labType="tna"
                      analysisKey="clusters"
                      context={`Sequence clustering — grouping ${sequences.length} learner sequences into ${clusterK} clusters by behavioral pattern`}
                      data={`Number of clusters (k): ${clusterK}. States: ${labels.join(', ')}.`}
                    />
                  </>
                )}

                {/* Add-to-report capture button (after analysis results) */}
                {modelBuilt && activeAnalysis && tnaAssignment && (!isSubmitted || canResubmit) && !isGraded && !isFullyPastDue && (
                  <button
                    data-no-capture
                    onClick={handleAddToReport}
                    disabled={isCapturing}
                    className={`w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl border-2 text-sm font-semibold transition-all ${
                      reportItems.some(r => r.key === activeAnalysis)
                        ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 border-emerald-300 dark:border-emerald-700'
                        : 'bg-white dark:bg-gray-800 text-indigo-600 dark:text-indigo-400 border-dashed border-indigo-300 dark:border-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 hover:border-indigo-400'
                    }`}
                  >
                    {isCapturing ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : reportItems.some(r => r.key === activeAnalysis) ? (
                      <CheckCircle className="w-4 h-4" />
                    ) : (
                      <Camera className="w-4 h-4" />
                    )}
                    {isCapturing
                      ? 'Capturing...'
                      : reportItems.some(r => r.key === activeAnalysis)
                        ? `Captured — click to recapture`
                        : 'Add this analysis to report'}
                  </button>
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

      <MyDatasetPicker
        isOpen={showDatasetPicker}
        onClose={() => setShowDatasetPicker(false)}
        onSelect={(csvText) => handleMyDatasetSelect(csvText)}
      />

      {/* Submit / Submitted / Graded states */}
      {tnaAssignment && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-6 space-y-4">
          {isSubmitted && mySubmission ? (
            <>
              <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
                <h2 className="font-semibold text-gray-900 dark:text-gray-100 mb-4">{t('your_submission', { defaultValue: 'Your Submission' })}</h2>
                {!isGraded && (
                  <div className="flex items-center justify-between p-4 rounded-lg mb-4 bg-blue-50 dark:bg-blue-900/20">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                      <p className="text-blue-700 dark:text-blue-300">{t('submitted_waiting_grading', { defaultValue: 'Your assignment has been submitted. Waiting for grading.' })}</p>
                    </div>
                    {canResubmit && (
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => setAssignmentPanelOpen(true)}
                        icon={<RefreshCw className="w-3.5 h-3.5" />}
                      >
                        {t('resubmit', { defaultValue: 'Resubmit' })}
                      </Button>
                    )}
                  </div>
                )}
                {isGraded && mySubmission.grade != null && (
                  <div className="flex items-center justify-between p-4 rounded-lg mb-4 bg-green-50 dark:bg-green-900/20">
                    <div className="flex items-center gap-2">
                      <Award className="w-5 h-5 text-green-600 dark:text-green-400" />
                      <p className="text-green-700 dark:text-green-300">{t('graded_with_score', { grade: mySubmission.grade, total: tnaAssignment.points, defaultValue: `Grade: ${mySubmission.grade}/${tnaAssignment.points}` })}</p>
                    </div>
                  </div>
                )}
                {mySubmission.content && (
                  <p className="mb-4 text-sm text-gray-600 dark:text-gray-400 whitespace-pre-wrap">{mySubmission.content}</p>
                )}
                {(() => {
                  let fileUrls: string[] = [];
                  try { const p = mySubmission.fileUrls ? JSON.parse(mySubmission.fileUrls) : []; fileUrls = Array.isArray(p) ? p.filter((v: unknown): v is string => typeof v === 'string') : []; } catch {}
                  return fileUrls.length > 0 ? (
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">{t('file_attachments', { defaultValue: 'File Attachments' })}</label>
                    {fileUrls.map((url: string, idx: number) => {
                      const name = url.split('/').pop() ?? `file-${idx + 1}`;
                      const resolvedUrl = resolveFileUrl(url);
                      const isPdf = url.toLowerCase().endsWith('.pdf');
                      return (
                        <div key={idx} className="rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
                          <div className="flex items-center justify-between px-3 py-2 bg-gray-50 dark:bg-gray-700">
                            <div className="flex items-center gap-2">
                              <FileText className="w-4 h-4 text-gray-400" />
                              <span className="text-sm font-medium text-gray-700 dark:text-gray-300 truncate">{name}</span>
                            </div>
                            <a href={resolvedUrl} download={name} target="_blank" rel="noopener noreferrer" className="text-gray-500 hover:text-gray-700"><Download className="w-3.5 h-3.5" /></a>
                          </div>
                          {isPdf && <iframe src={resolvedUrl} className="w-full border-0" style={{ height: '500px' }} title={name} />}
                        </div>
                      );
                    })}
                  </div>
                  ) : null;
                })()}
              </div>
            </>
          ) : isFullyPastDue ? (
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-red-200 dark:border-red-800 p-6 text-center">
              <AlertCircle className="w-8 h-8 text-red-500 mx-auto mb-2" />
              <p className="text-sm text-red-600 dark:text-red-400">{t('deadline_passed_description', { defaultValue: 'The due date for this assignment has passed. You can no longer submit your work.' })}</p>
            </div>
          ) : (
            <div className="flex justify-end">
              <Button
                variant="primary"
                onClick={() => setAssignmentPanelOpen(true)}
                icon={<Send className="w-4 h-4" />}
              >
                {t('submit_assignment', { defaultValue: 'Submit Assignment' })}
              </Button>
            </div>
          )}
        </div>
      )}

      {tnaAssignment && !isGraded && !isFullyPastDue && (
        <LabAssignmentPanel
          isOpen={assignmentPanelOpen}
          onClose={() => setAssignmentPanelOpen(false)}
          assignment={{
            id: tnaAssignment.id,
            description: tnaAssignment.description ?? null,
            points: tnaAssignment.points ?? null,
            dueDate: tnaAssignment.dueDate ? String(tnaAssignment.dueDate) : null,
          }}
          labContentRef={analysisContentRef}
          labId={0}
          courseId={Number(courseId)}
          hasActiveAnalysis={modelBuilt && activeAnalysis !== null}
          activeAnalysisKey={activeAnalysis ?? undefined}
          visitedAnalyses={visitedAnalyses}
          sessionEvents={sessionEvents}
          sessionConfig={{
            labType: 'tna',
            datasetName: selectedDs ? t(selectedDs.i18nTitle) : (datasetKey === '_ai' ? 'AI Generated' : ''),
            actorCol, actionCol, timeCol,
            modelType,
            sequenceCount: sequences.length,
            stateCount: labels.length,
            states: labels,
            edgeCountOriginal: edgeCount.original,
            edgeCountPruned: edgeCount.pruned,
            pruneThreshold,
          }}
          courseNumericId={Number(courseId)}
          assignmentId={tnaAssignment?.id}
          reportItems={reportItems}
          onRemoveReportItem={(key) => setReportItems(prev => prev.filter(i => i.key !== key))}
          onSubmitted={() => {
            setAssignmentPanelOpen(false);
            window.location.reload();
          }}
        />
      )}
    </div>
  );
};
