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
  Network, X, GitBranch, Target, BarChart3, Waypoints, Plus, Database,
  ChevronDown, ChevronRight, BookOpen, Users,
  Microscope, MessageCircle, Sparkles, Camera, Loader2, CheckCircle, Download,
  Award, Calendar, FileText, AlertCircle, MessageSquare, Send, RefreshCw, Clock,
} from 'lucide-react';
import { assignmentsApi } from '../api/assignments';
import { coursesApi } from '../api/courses';
import { resolveFileUrl } from '../api/client';
import { sanitizeHtml, isHtmlContent } from '../utils/sanitize';
import { LabAssignmentPanel, type ReportItem } from '../components/labs/LabAssignmentPanel';
import { useTheme } from '../hooks/useTheme';
import { MyDatasetPicker } from '../components/common/MyDatasetPicker';
import { Card, CardBody } from '../components/common/Card';
import { SearchableSelect } from '../components/common/SearchableSelect';
import { Button } from '../components/common/Button';
import toast from 'react-hot-toast';
import { INTERACTIVE_LAB_REQUIREMENTS } from '../types';
import { buildModel, layout as dynaLayout } from 'dynajs';
import type { TNA, LayoutAlgorithm } from 'dynajs';
import { TransitionHeatmap } from '../components/tna/TransitionHeatmap';
import { TnaNetworkGraph } from '../components/tna/TnaNetworkGraph';
import { CentralityBarChart } from '../components/tna/CentralityBarChart';
import { TnaCentralityTable } from '../components/tna/TnaCentralityTable';
import { createColorMap } from '../components/tna/colorFix';
import { computeAllCentralities, detectCommunities } from '../components/sna-exercise/utils';
import type { CommunityMethod } from '../components/sna-exercise/utils';
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
import { exportEdgesAsCSV, exportMatrixAsCSV, exportCentralityAsCSV, exportRowsAsCSV } from '../utils/csvExport';

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

const LAYOUT_OPTIONS: { key: LayoutAlgorithm; i18nKey: string }[] = [
  { key: 'circle', i18nKey: 'sna.layout_circle' },
  { key: 'fr', i18nKey: 'sna.layout_force' },
  { key: 'kamada-kawai', i18nKey: 'sna.layout_kamada_kawai' },
  { key: 'spectral', i18nKey: 'sna.layout_spectral' },
  { key: 'concentric', i18nKey: 'sna.layout_concentric' },
  { key: 'star', i18nKey: 'sna.layout_star' },
  { key: 'hierarchical', i18nKey: 'sna.layout_hierarchical' },
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
  const { t } = useTranslation(['courses', 'common']);
  const navigate = useNavigate();
  const { courseId } = useParams<{ courseId?: string }>();
  const [searchParams] = useSearchParams();
  const { isDark } = useTheme();
  const exerciseRef = useRef<HTMLDivElement>(null);
  const analysisContentRef = useRef<HTMLDivElement>(null);
  const captureRef = useRef<HTMLDivElement>(null);
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
  const snaAssignment = targetAssignmentId
    ? courseAssignments?.find(a => a.id === Number(targetAssignmentId)) ?? null
    : courseAssignments?.find(a => a.agentRequirements === INTERACTIVE_LAB_REQUIREMENTS.SNA) ?? null;

  const { data: mySubmission } = useQuery({
    queryKey: ['mySubmission', snaAssignment?.id],
    queryFn: () => assignmentsApi.getMySubmission(snaAssignment!.id),
    enabled: !!snaAssignment,
    retry: false,
  });

  const dueDate = snaAssignment?.dueDate ? new Date(snaAssignment.dueDate) : null;
  const dueDateLocal = snaAssignment?.dueDate ? new Date(String(snaAssignment.dueDate).replace('Z', '')) : null;
  const gracePeriodDate = snaAssignment?.gracePeriodDeadline ? new Date(snaAssignment.gracePeriodDeadline) : null;
  const gracePeriodLocal = snaAssignment?.gracePeriodDeadline ? new Date(String(snaAssignment.gracePeriodDeadline).replace('Z', '')) : null;
  const isPastDue = dueDateLocal ? dueDateLocal < new Date() : false;
  const isInGracePeriod = isPastDue && gracePeriodLocal ? new Date() < gracePeriodLocal : false;
  const isFullyPastDue = isPastDue && !isInGracePeriod;
  const isSubmitted = mySubmission?.status === 'submitted' || mySubmission?.status === 'graded';
  const isGraded = mySubmission?.status === 'graded';
  const canResubmit = isSubmitted && !isGraded && !isFullyPastDue;

  const submissionFileUrls = useMemo(() => {
    if (!mySubmission?.fileUrls) return [];
    try {
      const parsed = JSON.parse(mySubmission.fileUrls);
      return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === 'string') : [];
    } catch { return []; }
  }, [mySubmission?.fileUrls]);

  const headerColors = useMemo(() => ({
    textPrimary: isDark ? '#f3f4f6' : '#111827',
    textSecondary: isDark ? '#9ca3af' : '#6b7280',
    textMuted: isDark ? '#6b7280' : '#9ca3af',
    textRed: isDark ? '#fca5a5' : '#dc2626',
    textGreen: isDark ? '#86efac' : '#15803d',
    textBlue: isDark ? '#93c5fd' : '#1d4ed8',
    bgGreen: isDark ? 'rgba(34, 197, 94, 0.2)' : '#dcfce7',
    bgBlue: isDark ? 'rgba(59, 130, 246, 0.2)' : '#dbeafe',
    bgBlueBanner: isDark ? 'rgba(59, 130, 246, 0.1)' : '#eff6ff',
    bgRed: isDark ? 'rgba(239, 68, 68, 0.2)' : '#fee2e2',
    bgYellow: isDark ? 'rgba(245, 158, 11, 0.2)' : '#fef3c7',
    textYellow: isDark ? '#fcd34d' : '#d97706',
    bgGray: isDark ? '#374151' : '#f3f4f6',
    textGray: isDark ? '#9ca3af' : '#6b7280',
    bgGreenCard: isDark ? 'rgba(34, 197, 94, 0.1)' : '#f0fdf4',
    borderGreen: isDark ? 'rgba(34, 197, 94, 0.3)' : '#bbf7d0',
  }), [isDark]);

  // ── Core state ──
  const [datasetKey, setDatasetKey] = useState<string | null>(null);
  const [modelBuilt, setModelBuilt] = useState(false);
  const [showCustomModal, setShowCustomModal] = useState(false);
  const [showAIGenerator, setShowAIGenerator] = useState(false);
  const [showDatasetPicker, setShowDatasetPicker] = useState(false);

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
  const [layout, setLayout] = useState<LayoutAlgorithm>('circle');
  const [nodeSizeBy, setNodeSizeBy] = useState<string>('fixed');
  const [directedOverride, setDirectedOverride] = useState<boolean | undefined>(undefined);
  const [showNodeLabels, setShowNodeLabels] = useState(true);
  const [nodeFontSize, setNodeFontSize] = useState(11);

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

  // Build a specific key for the current analysis view (e.g., "centrality-InDegree")
  const getCaptureKey = useCallback(() => {
    if (!activeAnalysis) return '';
    if (activeAnalysis === 'centrality') return `centrality-${centralityMetric}-${centralityView}`;
    return activeAnalysis;
  }, [activeAnalysis, centralityMetric, centralityView]);

  const getCaptureLabel = useCallback(() => {
    if (!activeAnalysis) return '';
    if (activeAnalysis === 'centrality') return `Centrality — ${centralityMetric} (${centralityView})`;
    if (activeAnalysis === 'metrics') return 'Graph Metrics';
    if (activeAnalysis === 'communities') return `Communities (${communityMethod})`;
    if (activeAnalysis === 'adjacency') return 'Adjacency Matrix';
    return activeAnalysis;
  }, [activeAnalysis, centralityMetric, centralityView, communityMethod]);

  const handleAddToReport = useCallback(async () => {
    if (!captureRef.current || !activeAnalysis) return;
    setIsCapturing(true);
    try {
      const el = captureRef.current;

      // Find the SVG inside the network graph and serialize it to an image directly
      const svg = el.querySelector('svg');
      const networkCard = svg?.closest('.rounded-xl') as HTMLElement | null;

      // Capture the network graph SVG natively (not via html2canvas)
      let networkDataUrl: string | null = null;
      let svgNaturalW = 0;
      let svgNaturalH = 0;
      if (svg) {
        // Use viewBox dimensions for responsive SVGs (width="100%" has no baseVal)
        const vb = svg.getAttribute('viewBox');
        if (vb) {
          const parts = vb.split(/[\s,]+/).map(Number);
          svgNaturalW = parts[2] || 500;
          svgNaturalH = parts[3] || 500;
        } else {
          svgNaturalW = svg.width.baseVal.value || parseInt(svg.getAttribute('width') || '500');
          svgNaturalH = svg.height.baseVal.value || parseInt(svg.getAttribute('height') || '500');
        }
        // Clone SVG and set explicit width/height for rasterization
        const clonedSvg = svg.cloneNode(true) as SVGSVGElement;
        clonedSvg.setAttribute('width', String(svgNaturalW));
        clonedSvg.setAttribute('height', String(svgNaturalH));
        const serializer = new XMLSerializer();
        const svgStr = serializer.serializeToString(clonedSvg);
        const svgBlob = new Blob([svgStr], { type: 'image/svg+xml;charset=utf-8' });
        const url = URL.createObjectURL(svgBlob);
        const img = new Image();
        await new Promise<void>((resolve, reject) => {
          img.onload = () => resolve();
          img.onerror = reject;
          img.src = url;
        });
        const c = document.createElement('canvas');
        const scale = 2;
        c.width = svgNaturalW * scale;
        c.height = svgNaturalH * scale;
        const ctx = c.getContext('2d')!;
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, c.width, c.height);
        ctx.drawImage(img, 0, 0, c.width, c.height);
        networkDataUrl = c.toDataURL('image/jpeg', 0.9);
        URL.revokeObjectURL(url);
      }

      // Capture analysis content (everything except the network graph card) via html2canvas
      const { default: html2canvas } = await import('html2canvas');
      // Temporarily hide the network graph card so html2canvas only captures analysis
      if (networkCard) networkCard.style.display = 'none';
      const hasAnalysisContent = el.scrollHeight > 10;
      let analysisDataUrl: string | null = null;
      if (hasAnalysisContent && activeAnalysis) {
        const analysisCanvas = await html2canvas(el, {
          scale: 1.5, useCORS: true, allowTaint: true,
          width: el.scrollWidth, height: el.scrollHeight,
          scrollX: 0, scrollY: 0,
        });
        if (analysisCanvas.height > 5) {
          analysisDataUrl = analysisCanvas.toDataURL('image/jpeg', 0.85);
        }
      }
      if (networkCard) networkCard.style.display = '';

      // Combine both into a single canvas
      const combinedCanvas = document.createElement('canvas');
      const netImg = networkDataUrl ? new Image() : null;
      const anlImg = analysisDataUrl ? new Image() : null;
      if (netImg && networkDataUrl) {
        await new Promise<void>(r => { netImg.onload = () => r(); netImg.src = networkDataUrl!; });
      }
      if (anlImg && analysisDataUrl) {
        await new Promise<void>(r => { anlImg.onload = () => r(); anlImg.src = analysisDataUrl!; });
      }
      const netW = netImg?.width || 0;
      const netH = netImg?.height || 0;
      const anlW = anlImg?.width || 0;
      const anlH = anlImg?.height || 0;
      const totalW = Math.max(netW, anlW);
      const totalH = netH + anlH;
      combinedCanvas.width = totalW || 1;
      combinedCanvas.height = totalH || 1;
      const cctx = combinedCanvas.getContext('2d')!;
      cctx.fillStyle = '#ffffff';
      cctx.fillRect(0, 0, totalW, totalH);
      if (netImg) cctx.drawImage(netImg, (totalW - netW) / 2, 0);
      if (anlImg) cctx.drawImage(anlImg, (totalW - anlW) / 2, netH);

      const dataUrl = combinedCanvas.toDataURL('image/jpeg', 0.85);
      const key = getCaptureKey();
      const label = getCaptureLabel();
      setReportItems(prev => {
        const filtered = prev.filter(item => item.key !== key);
        return [...filtered, { key, label, dataUrl, timestamp: Date.now() }];
      });
      logSession('Added to report: ' + label);
      toast.success('Snapshot added to report');
    } catch {
      toast.error('Failed to capture snapshot');
    } finally {
      setIsCapturing(false);
    }
  }, [activeAnalysis, getCaptureKey, getCaptureLabel]);

  // ── Derived: dataset ──
  const isCustom = datasetKey === '_custom' || datasetKey === '_ai';
  const selectedDs: SampleNetwork | undefined = isCustom ? undefined : SAMPLE_NETWORKS.find(d => d.key === datasetKey);

  const baseEdges = isCustom ? (customEdges ?? []) : (selectedDs?.edges ?? []);
  const baseDirected = isCustom ? customDirected : (selectedDs?.directed ?? true);
  const isDirected = directedOverride ?? baseDirected;

  // Recompute matrix/labels when directed override changes
  const { derivedLabels, derivedMatrix } = useMemo(() => {
    if (baseEdges.length === 0) return { derivedLabels: isCustom ? customLabels : (selectedDs?.labels ?? []), derivedMatrix: isCustom ? customMatrix : (selectedDs?.matrix ?? []) };
    const { labels, matrix } = edgesToMatrix(baseEdges, isDirected);
    return { derivedLabels: labels, derivedMatrix: matrix };
  }, [baseEdges, isDirected, isCustom, customLabels, customMatrix, selectedDs]);

  const matrixData = derivedMatrix;
  const nodeLabels = derivedLabels;
  const currentEdges = baseEdges;

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

  // ── Node positions based on layout (via dynajs) ──
  const nodePositions = useMemo(() => {
    if (!rawModel) return undefined;
    const result = dynaLayout(rawModel, { algorithm: layout });
    const size = 500;
    const pad = nodeRadius + 5;
    return Array.from({ length: result.labels.length }, (_, i) => ({
      x: pad + result.x[i]! * (size - 2 * pad),
      y: pad + result.y[i]! * (size - 2 * pad),
    }));
  }, [layout, rawModel, nodeRadius]);

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
    setDirectedOverride(undefined);
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

  const handleMyDatasetSelect = useCallback((csvText: string) => {
    const lines = csvText.trim().split('\n').filter(l => l.trim());
    if (lines.length < 2) return;
    const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
    const fromIdx = headers.findIndex(h => h === 'from' || h === 'source' || h === 'actor1');
    const toIdx = headers.findIndex(h => h === 'to' || h === 'target' || h === 'actor2');
    const weightIdx = headers.findIndex(h => h === 'weight' || h === 'value' || h === 'strength');

    const edges: Edge[] = [];
    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(',').map(c => c.trim().replace(/^"|"$/g, ''));
      const from = cols[fromIdx >= 0 ? fromIdx : 0] || '';
      const to = cols[toIdx >= 0 ? toIdx : 1] || '';
      const weight = weightIdx >= 0 ? parseFloat(cols[weightIdx]) || 1 : 1;
      if (from && to) edges.push({ from, to, weight });
    }
    if (edges.length === 0) return;

    const { labels, matrix } = edgesToMatrix(edges, true);
    setCustomEdges(edges);
    setCustomDirected(true);
    setCustomLabels(labels);
    setCustomMatrix(matrix);
    setDatasetKey('_custom');
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
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        {/* Breadcrumb */}
        {courseId && (
          <div className="mb-6">
            <Breadcrumb
              items={[
                { label: t('common:courses'), href: '/courses' },
                { label: course?.title || t('common:course'), href: `/courses/${courseId}` },
                ...(snaAssignment ? [{ label: t('assignments'), href: `/courses/${courseId}/assignments` }] : []),
                { label: snaAssignment?.title || t('sna.title') },
              ]}
            />
          </div>
        )}

        {/* Assignment Header Card */}
        {snaAssignment ? (
          <Card className="mb-6">
            <CardBody>
              <div className="flex items-start justify-between mb-4">
                <div>
                  <p className="text-sm mb-1" style={{ color: headerColors.textSecondary }}>{course?.title}</p>
                  <h1 className="text-2xl font-bold" style={{ color: headerColors.textPrimary }}>{snaAssignment.title}</h1>
                </div>
                {/* Status Badge */}
                {isGraded ? (
                  <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium" style={{ backgroundColor: headerColors.bgGreen, color: headerColors.textGreen }}>
                    <Award className="w-4 h-4" />
                    {t('graded_with_score', { grade: mySubmission?.grade, total: snaAssignment.points })}
                  </span>
                ) : isSubmitted ? (
                  <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium" style={{ backgroundColor: headerColors.bgBlue, color: headerColors.textBlue }}>
                    <CheckCircle className="w-4 h-4" />
                    {t('submitted_status')}
                  </span>
                ) : isInGracePeriod ? (
                  <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium" style={{ backgroundColor: headerColors.bgRed, color: headerColors.textRed }}>
                    <AlertCircle className="w-4 h-4" />
                    {t('grace_period_status', { defaultValue: 'Grace Period' })}
                  </span>
                ) : isFullyPastDue ? (
                  <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium" style={{ backgroundColor: headerColors.bgRed, color: headerColors.textRed }}>
                    <AlertCircle className="w-4 h-4" />
                    {t('past_due_status')}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium" style={{ backgroundColor: headerColors.bgGray, color: headerColors.textGray }}>
                    <FileText className="w-4 h-4" />
                    {t('not_started_status')}
                  </span>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-4 text-sm" style={{ color: headerColors.textSecondary }}>
                <span className="flex items-center gap-1">
                  <Award className="w-4 h-4" />
                  {t('points_format', { points: snaAssignment.points })}
                </span>
                {dueDate && (
                  <span className="flex items-center gap-1" style={{ color: isPastDue ? headerColors.textRed : headerColors.textSecondary }}>
                    <Calendar className="w-4 h-4" />
                    {t('due_at', { date: dueDate.toLocaleDateString(undefined, { timeZone: 'UTC' }), time: dueDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' }) })}
                  </span>
                )}
                {gracePeriodDate && (
                  <span className="flex items-center gap-1" style={{ color: isInGracePeriod ? headerColors.textRed : headerColors.textSecondary }}>
                    <Clock className="w-4 h-4" />
                    {t('grace_period_until', {
                      defaultValue: 'Grace period until {{date}} at {{time}}',
                      date: gracePeriodDate.toLocaleDateString(undefined, { timeZone: 'UTC' }),
                      time: gracePeriodDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' }),
                    })}
                  </span>
                )}
                <span className="flex items-center gap-1 capitalize">
                  <FileText className="w-4 h-4" />
                  {t('submission_type_label', { type: snaAssignment.submissionType })}
                </span>
              </div>
            </CardBody>
          </Card>
        ) : (
          /* Header without assignment */
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
            <button onClick={() => navigate(courseId ? `/courses/${courseId}` : -1 as any)} className="p-2 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

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
                <div className="flex flex-col gap-2">
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
                  <button
                    onClick={() => setShowDatasetPicker(true)}
                    className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg border border-dashed border-gray-300 dark:border-gray-600 text-xs font-medium text-gray-500 dark:text-gray-400 hover:border-violet-400 hover:text-violet-600 dark:hover:text-violet-400 transition-colors"
                  >
                    <Database className="w-3.5 h-3.5" />
                    {t('my_datasets')}
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


              {/* Download Data */}
              {datasetKey && currentEdges.length > 0 && (
                <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-3 space-y-2">
                  <label className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">
                    <Download className="w-3 h-3 inline mr-1" />
                    Download Data
                  </label>
                  <button
                    onClick={() => exportEdgesAsCSV(currentEdges, 'sna-edge-list.csv')}
                    className="w-full text-left px-2.5 py-1.5 rounded-lg text-xs text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                  >
                    Edge List ({currentEdges.length} edges)
                  </button>
                  {modelBuilt && (
                    <>
                      <button
                        onClick={() => exportMatrixAsCSV(matrixData, nodeLabels, 'sna-adjacency-matrix.csv')}
                        className="w-full text-left px-2.5 py-1.5 rounded-lg text-xs text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                      >
                        Adjacency Matrix
                      </button>
                      {centralityData && (
                        <button
                          onClick={() => exportCentralityAsCSV(centralityData, 'sna-centrality.csv')}
                          className="w-full text-left px-2.5 py-1.5 rounded-lg text-xs text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                        >
                          Centrality Measures
                        </button>
                      )}
                      {communities && (
                        <button
                          onClick={() => exportRowsAsCSV(
                            nodeLabels.map((label, i) => ({ node: label, community: communities.assignments[i] })),
                            'sna-communities.csv',
                          )}
                          className="w-full text-left px-2.5 py-1.5 rounded-lg text-xs text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                        >
                          Communities
                        </button>
                      )}
                    </>
                  )}
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
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-400">
                      {currentEdges.length} {t('sna.edges_count')}
                    </span>
                    <button
                      onClick={() => exportEdgesAsCSV(currentEdges, 'sna-edge-list.csv')}
                      className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded-md bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                    >
                      <Download className="w-3 h-3" />
                      CSV
                    </button>
                  </div>
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
                {/* Capturable area — network graph + analysis content (no buttons/guides/AI) */}
                <div ref={captureRef} className="space-y-4">

                {/* Network Graph with controls */}
                <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
                  <div className="flex items-center gap-3 mb-4">
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

                  {/* Graph controls toolbar */}
                  <div className="space-y-3 mb-4 pb-4 border-b border-gray-100 dark:border-gray-700">
                    {/* Row 1: Dropdowns + Checkboxes */}
                    <div className="flex flex-wrap items-end gap-3">
                      <SearchableSelect
                        label={t('sna.layout')}
                        value={layout}
                        onChange={val => setLayout(val as LayoutAlgorithm)}
                        options={LAYOUT_OPTIONS.map(o => ({ value: o.key, label: t(o.i18nKey) }))}
                        className="w-[160px]"
                      />
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
                          <input type="checkbox" checked={!isDirected} onChange={e => setDirectedOverride(e.target.checked ? false : true)}
                            className="rounded w-4 h-4 text-violet-600" />
                          {t('sna.undirected')}
                        </label>
                        <label className="flex items-center gap-1.5 text-[13px] text-gray-700 dark:text-gray-200 cursor-pointer">
                          <input type="checkbox" checked={showSelfLoops} onChange={e => setShowSelfLoops(e.target.checked)}
                            className="rounded w-4 h-4 text-violet-600" />
                          {t('exercise.self_loops')}
                        </label>
                        <label className="flex items-center gap-1.5 text-[13px] text-gray-700 dark:text-gray-200 cursor-pointer">
                          <input type="checkbox" checked={showEdgeLabels} onChange={e => setShowEdgeLabels(e.target.checked)}
                            className="rounded w-4 h-4 text-violet-600" />
                          {t('exercise.edge_labels')}
                        </label>
                        <label className="flex items-center gap-1.5 text-[13px] text-gray-700 dark:text-gray-200 cursor-pointer">
                          <input type="checkbox" checked={showNodeLabels} onChange={e => setShowNodeLabels(e.target.checked)}
                            className="rounded w-4 h-4 text-violet-600" />
                          {t('exercise.node_labels')}
                        </label>
                      </div>
                    </div>
                    {/* Row 2: Sliders */}
                    <div className="flex flex-wrap items-center gap-6">
                      <div className="flex items-center gap-2 flex-1 min-w-[200px]">
                        <span className="text-[12px] text-gray-500 whitespace-nowrap">{t('exercise.node_size')}</span>
                        <input type="range" min={15} max={50} value={nodeRadius}
                          onChange={e => setNodeRadius(Number(e.target.value))} className="flex-1 h-2 rounded-full accent-violet-600 cursor-pointer" />
                        <span className="text-[12px] font-semibold text-violet-600 tabular-nums w-6 text-right">{nodeRadius}</span>
                      </div>
                      <div className="flex items-center gap-2 flex-1 min-w-[200px]">
                        <span className="text-[12px] text-gray-500 whitespace-nowrap">{t('exercise.label_size')}</span>
                        <input type="range" min={6} max={18} value={nodeFontSize}
                          onChange={e => setNodeFontSize(Number(e.target.value))} className="flex-1 h-2 rounded-full accent-violet-600 cursor-pointer" />
                        <span className="text-[12px] font-semibold text-violet-600 tabular-nums w-6 text-right">{nodeFontSize}</span>
                      </div>
                      <div className="flex items-center gap-2 flex-1 min-w-[200px]">
                        <span className="text-[12px] text-gray-500 whitespace-nowrap">{t('sna.edge_width')}</span>
                        <input type="range" min={1} max={12} step={0.5} value={edgeWidth}
                          onChange={e => setEdgeWidth(Number(e.target.value))} className="flex-1 h-2 rounded-full accent-violet-600 cursor-pointer" />
                        <span className="text-[12px] font-semibold text-violet-600 tabular-nums w-6 text-right">{edgeWidth}</span>
                      </div>
                    </div>
                  </div>

                  <TnaNetworkGraph
                    model={rawModel}
                    showSelfLoops={showSelfLoops}
                    showEdgeLabels={showEdgeLabels}
                    nodeRadius={nodeRadius}
                    height={500}
                    colorMap={communityColorMap ?? colorMap}
                    centralityData={centralityData ?? undefined}
                    nodeSizeMetric={isCentralityActive ? centralityMetric : nodeSizeBy !== 'fixed' ? nodeSizeBy : undefined}
                    externalPositions={nodePositions}
                    maxEdgeWidth={edgeWidth}
                    directed={isDirected}
                    showNodeLabels={showNodeLabels}
                    nodeFontSize={nodeFontSize}
                  />
                </div>

                {/* Analysis tabs (horizontal) */}
                <div className="flex flex-wrap items-center gap-2">
                  {ANALYSIS_ITEMS.map(({ key, icon: Icon }) => {
                    const isActive = activeAnalysis === key;
                    return (
                      <button
                        key={key}
                        onClick={() => toggleAnalysis(key)}
                        className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                          isActive
                            ? 'bg-violet-600 text-white shadow-sm'
                            : 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50'
                        }`}
                      >
                        <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-gray-400'}`} />
                        {t(`sna.block_${key}`)}
                      </button>
                    );
                  })}
                </div>

                {/* Sub-options for active analysis */}
                {activeAnalysis === 'centrality' && (
                  <div className="flex flex-wrap items-center gap-2">
                    {CENTRALITY_OPTIONS.map(opt => (
                      <button
                        key={opt.key}
                        onClick={() => { setCentralityMetric(opt.key); logSession('Centrality metric: ' + opt.key); }}
                        className={`px-2.5 py-1 rounded-md text-[12px] font-medium transition-colors ${
                          centralityMetric === opt.key
                            ? 'bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300'
                            : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                        }`}
                      >
                        {t(opt.i18nKey)}
                      </button>
                    ))}
                    <span className="w-px h-5 bg-gray-200 dark:bg-gray-700" />
                    <div className="flex rounded-md border border-gray-200 dark:border-gray-600 overflow-hidden">
                      <button
                        onClick={() => { setCentralityView('chart'); logSession('Centrality view: chart'); }}
                        className={`px-3 py-1 text-[12px] font-medium transition-colors ${
                          centralityView === 'chart'
                            ? 'bg-violet-600 text-white'
                            : 'bg-white dark:bg-gray-700 text-gray-500 dark:text-gray-400'
                        }`}
                      >
                        {t('exercise.centrality_chart')}
                      </button>
                      <button
                        onClick={() => { setCentralityView('table'); logSession('Centrality view: table'); }}
                        className={`px-3 py-1 text-[12px] font-medium transition-colors ${
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
                {activeAnalysis === 'communities' && (
                  <div className="flex flex-wrap items-center gap-3">
                    <SearchableSelect
                      label={t('sna.community_algorithm')}
                      value={communityMethod}
                      onChange={val => { setCommunityMethod(val as CommunityMethod); logSession('Community method: ' + val); }}
                      options={COMMUNITY_METHOD_OPTIONS.map(o => ({ value: o.key, label: t(o.i18nKey) }))}
                      className="w-[200px]"
                    />
                    {communities && (
                      <span className="text-[12px] text-gray-500 dark:text-gray-400 self-end pb-1.5">
                        {t('sna.communities_detected', { count: communities.k })}
                      </span>
                    )}
                  </div>
                )}

                {/* Graph Metrics (inside capture area) */}
                {activeAnalysis === 'metrics' && metrics && (
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
                )}

                {/* Centrality (inside capture area) */}
                {activeAnalysis === 'centrality' && centralityData && (
                    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
                      <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-4">
                        {t('sna.block_centrality')} — {centralityMetric}
                      </h3>
                      {centralityView === 'chart' ? (
                        <CentralityBarChart centralityData={centralityData} colorMap={colorMap} selectedMeasure={centralityMetric} />
                      ) : (
                        <TnaCentralityTable centralityData={centralityData} colorMap={colorMap} />
                      )}
                    </div>
                )}

                {/* Communities (inside capture area) */}
                {activeAnalysis === 'communities' && communities && (
                    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
                      <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-4">
                        {t('sna.block_communities')}
                      </h3>
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
                )}

                {/* Adjacency Matrix (inside capture area) */}
                {activeAnalysis === 'adjacency' && (
                    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
                      <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-4">
                        {t('sna.block_adjacency')}
                      </h3>
                      <TransitionHeatmap model={rawModel} colorMap={colorMap} />
                    </div>
                )}

                </div>{/* End captureRef */}

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

                {/* Add-to-report capture button (only when assignment exists and not past due, or resubmitting) */}
                {modelBuilt && activeAnalysis && snaAssignment && (!isSubmitted || canResubmit) && !isGraded && !isFullyPastDue && (() => {
                  const key = getCaptureKey();
                  const isCaptured = reportItems.some(r => r.key === key);
                  return (
                    <button
                      onClick={handleAddToReport}
                      disabled={isCapturing}
                      className={`w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl border-2 text-sm font-semibold transition-all ${
                        isCaptured
                          ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 border-emerald-300 dark:border-emerald-700'
                          : 'bg-white dark:bg-gray-800 text-indigo-600 dark:text-indigo-400 border-dashed border-indigo-300 dark:border-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 hover:border-indigo-400'
                      }`}
                    >
                      {isCapturing ? <Loader2 className="w-4 h-4 animate-spin" />
                        : isCaptured ? <CheckCircle className="w-4 h-4" />
                        : <Camera className="w-4 h-4" />}
                      {isCapturing ? 'Capturing...'
                        : isCaptured ? `Captured (${reportItems.length}) — click to recapture`
                        : `Add this analysis to report${reportItems.length > 0 ? ` (${reportItems.length})` : ''}`}
                    </button>
                  );
                })()}

                {/* CSV export buttons (outside capture area) */}
                {activeAnalysis === 'centrality' && centralityData && (
                  <div className="flex justify-end">
                    <button onClick={() => exportCentralityAsCSV(centralityData, 'sna-centrality.csv')} className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded-md bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"><Download className="w-3 h-3" /> CSV</button>
                  </div>
                )}
                {activeAnalysis === 'communities' && communities && (
                  <div className="flex justify-end">
                    <button onClick={() => exportRowsAsCSV(nodeLabels.map((label, i) => ({ node: label, community: communities.assignments[i] })), 'sna-communities.csv')} className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded-md bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"><Download className="w-3 h-3" /> CSV</button>
                  </div>
                )}
                {activeAnalysis === 'adjacency' && (
                  <div className="flex justify-end">
                    <button onClick={() => exportMatrixAsCSV(matrixData, nodeLabels, 'sna-adjacency-matrix.csv')} className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded-md bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"><Download className="w-3 h-3" /> CSV</button>
                  </div>
                )}

                {/* AI Assistants (outside capture area) */}
                {activeAnalysis === 'metrics' && metrics && (
                  <LabAIAssistant labType="sna" analysisKey="metrics" context="Graph-level metrics — density, reciprocity, average degree, and average weight of the SNA network" data={`Nodes: ${metrics.nNodes}. Edges: ${metrics.nEdges}. Density: ${metrics.density.toFixed(3)}. Avg degree: ${metrics.avgDegree}. Avg weight: ${metrics.avgWeight}.${metrics.reciprocity !== null ? ` Reciprocity: ${metrics.reciprocity}.` : ''}`} />
                )}
                {activeAnalysis === 'centrality' && centralityData && (
                  <LabAIAssistant labType="sna" analysisKey="centrality" context={`Centrality analysis — ${centralityMetric} measure showing node importance in the SNA network`} data={`Measure: ${centralityMetric}. Nodes: ${nodeLabels.join(', ')}.`} />
                )}
                {activeAnalysis === 'communities' && communities && (
                  <LabAIAssistant labType="sna" analysisKey="communities" context={`Community detection — ${communities.k} communities detected using ${communityMethod} algorithm`} data={`Algorithm: ${communityMethod}. Communities: ${communities.k}. Nodes: ${nodeLabels.join(', ')}.`} />
                )}
                {activeAnalysis === 'adjacency' && (
                  <LabAIAssistant labType="sna" analysisKey="adjacency" context={`Adjacency matrix — ${isDirected ? 'directed' : 'undirected'} network with ${nodeLabels.length} nodes`} data={`Nodes (${nodeLabels.length}): ${nodeLabels.join(', ')}. Directed: ${isDirected}.`} />
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

      <MyDatasetPicker
        isOpen={showDatasetPicker}
        onClose={() => setShowDatasetPicker(false)}
        onSelect={(csvText) => handleMyDatasetSelect(csvText)}
      />

      {/* Submit button / Submitted / Graded states */}
      {snaAssignment && (
        <div className="max-w-screen-xl mx-auto px-4 sm:px-6 lg:px-8 pb-6 space-y-4">
          {/* Submission content (shown for both submitted and graded) */}
          {isSubmitted && mySubmission ? (
            <>
              <Card>
                <CardBody>
                  <h2 className="font-semibold mb-4" style={{ color: headerColors.textPrimary }}>{t('your_submission')}</h2>
                  {!isGraded && (
                    <div className="flex items-center justify-between p-4 rounded-lg mb-4" style={{ backgroundColor: headerColors.bgBlueBanner }}>
                      <div className="flex items-center gap-2">
                        <CheckCircle className="w-5 h-5" style={{ color: headerColors.textBlue }} />
                        <p style={{ color: headerColors.textBlue }}>{t('submitted_waiting_grading')}</p>
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
                  {mySubmission.content && (
                    isHtmlContent(mySubmission.content) ? (
                      <div className="prose max-w-none mb-4 text-sm" style={{ color: headerColors.textSecondary }} dangerouslySetInnerHTML={{ __html: sanitizeHtml(mySubmission.content) }} />
                    ) : (
                      <p className="mb-4 text-sm whitespace-pre-wrap" style={{ color: headerColors.textSecondary }}>{mySubmission.content}</p>
                    )
                  )}
                  {submissionFileUrls.length > 0 && (
                    <div className="mb-4 space-y-2">
                      <label className="block text-sm font-medium mb-1" style={{ color: headerColors.textSecondary }}>{t('file_attachments')}</label>
                      {submissionFileUrls.map((url, index) => {
                        const rawName = url.split('/').pop() ?? `file-${index + 1}`;
                        let displayName: string;
                        try { displayName = decodeURIComponent(rawName.replace(/^[\w-]{36}/, '').replace(/^-/, '')) || rawName; } catch { displayName = rawName; }
                        const isPdf = url.toLowerCase().endsWith('.pdf');
                        const resolvedUrl = resolveFileUrl(url);
                        if (isPdf) {
                          return (
                            <div key={index} className="rounded-lg border overflow-hidden" style={{ borderColor: isDark ? '#374151' : '#e5e7eb' }}>
                              <div className="flex items-center justify-between px-3 py-2" style={{ backgroundColor: isDark ? '#374151' : '#f9fafb' }}>
                                <div className="flex items-center gap-2">
                                  <FileText className="w-4 h-4" style={{ color: headerColors.textMuted }} />
                                  <span className="text-sm font-medium truncate" style={{ color: headerColors.textPrimary }}>{displayName}</span>
                                </div>
                                <a href={resolvedUrl} download={displayName} target="_blank" rel="noopener noreferrer" style={{ color: headerColors.textSecondary }}><Download className="w-3.5 h-3.5" /></a>
                              </div>
                              <iframe src={resolvedUrl} className="w-full border-0" style={{ height: '500px' }} title={displayName} />
                            </div>
                          );
                        }
                        return (
                          <div key={index} className="flex items-center gap-2 p-2 rounded" style={{ backgroundColor: isDark ? '#374151' : '#f9fafb' }}>
                            <FileText className="w-4 h-4" style={{ color: headerColors.textMuted }} />
                            <span className="flex-1 text-sm truncate" style={{ color: headerColors.textPrimary }}>{displayName}</span>
                            <a href={resolvedUrl} download={displayName} target="_blank" rel="noopener noreferrer" style={{ color: headerColors.textSecondary }}><Download className="w-4 h-4" /></a>
                          </div>
                        );
                      })}
                    </div>
                  )}
                  <p className="text-sm" style={{ color: headerColors.textMuted }}>
                    {t('submitted_on', { date: new Date(mySubmission.submittedAt).toLocaleString() })}
                  </p>
                </CardBody>
              </Card>

              {/* Grade card (only when graded) */}
              {isGraded && (
                <Card style={{ backgroundColor: headerColors.bgGreenCard, borderColor: headerColors.borderGreen }}>
                  <CardBody>
                    <div className="flex items-center gap-2 mb-3">
                      <Award className="w-5 h-5" style={{ color: headerColors.textGreen }} />
                      <h2 className="font-semibold" style={{ color: headerColors.textGreen }}>{t('your_grade')}</h2>
                    </div>
                    <div className="text-center mb-4">
                      <span className="text-4xl font-bold" style={{ color: headerColors.textGreen }}>{mySubmission.grade}</span>
                      <span className="text-xl" style={{ color: headerColors.textGreen }}>/{snaAssignment.points}</span>
                      {mySubmission.grade != null && snaAssignment.points && (
                        <p className="text-sm mt-1" style={{ color: headerColors.textGreen }}>
                          {t('grade_percent', { percent: Math.round((mySubmission.grade / snaAssignment.points) * 100) })}
                        </p>
                      )}
                    </div>
                    {mySubmission.feedback && (
                      <div className="border-t pt-4" style={{ borderColor: headerColors.borderGreen }}>
                        <h3 className="font-medium flex items-center gap-2 mb-2" style={{ color: headerColors.textGreen }}>
                          <MessageSquare className="w-4 h-4" />
                          {t('instructor_feedback')}
                        </h3>
                        <p className="text-sm" style={{ color: headerColors.textGreen }}>{mySubmission.feedback}</p>
                      </div>
                    )}
                    {mySubmission.gradedAt && (
                      <p className="text-xs mt-4" style={{ color: headerColors.textGreen }}>
                        {t('graded_on', { date: new Date(mySubmission.gradedAt).toLocaleString() })}
                      </p>
                    )}
                  </CardBody>
                </Card>
              )}
            </>
          ) : isInGracePeriod ? (
            <>
              <Card style={{ backgroundColor: headerColors.bgRed, borderColor: 'rgba(239, 68, 68, 0.3)' }}>
                <CardBody className="text-center py-4">
                  <AlertCircle className="w-8 h-8 mx-auto mb-1" style={{ color: headerColors.textRed }} />
                  <p className="text-sm font-medium" style={{ color: headerColors.textRed }}>
                    {t('grace_period_warning', { defaultValue: 'The original deadline has passed. You are submitting during the grace period.' })}
                  </p>
                  {gracePeriodDate && (
                    <p className="text-xs mt-1" style={{ color: headerColors.textRed, opacity: 0.8 }}>
                      {t('grace_period_ends', {
                        defaultValue: 'Grace period ends: {{date}} at {{time}}',
                        date: gracePeriodDate.toLocaleDateString(undefined, { timeZone: 'UTC' }),
                        time: gracePeriodDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' }),
                      })}
                    </p>
                  )}
                </CardBody>
              </Card>
              <div className="flex justify-end">
                <Button
                  variant="primary"
                  onClick={() => setAssignmentPanelOpen(true)}
                  icon={<Send className="w-4 h-4" />}
                >
                  {t('submit_assignment', { defaultValue: 'Submit Assignment' })}
                </Button>
              </div>
            </>
          ) : isFullyPastDue ? (
            <Card style={{ backgroundColor: headerColors.bgRed, borderColor: 'rgba(239, 68, 68, 0.3)' }}>
              <CardBody className="text-center py-6">
                <AlertCircle className="w-10 h-10 mx-auto mb-2" style={{ color: headerColors.textRed }} />
                <h2 className="text-lg font-semibold mb-1" style={{ color: headerColors.textRed }}>
                  {t('deadline_passed', { defaultValue: 'Deadline Has Passed' })}
                </h2>
                <p className="text-sm" style={{ color: headerColors.textRed }}>
                  {t('deadline_passed_description', { defaultValue: 'The due date for this assignment has passed. You can no longer submit your work.' })}
                </p>
              </CardBody>
            </Card>
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

      {snaAssignment && !isGraded && !isFullyPastDue && (
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
          courseName={course?.title}
          onSubmitted={() => {
            setAssignmentPanelOpen(false);
          }}
        />
      )}
    </div>
  );
};
