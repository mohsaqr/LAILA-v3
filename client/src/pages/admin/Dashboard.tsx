import { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Users, Activity, Hash, Settings2, Network, GitBranch, Expand, Search, Pencil, X, TrendingUp, Clock, RefreshCw } from 'lucide-react';
import {
  tna, ftna, ctna, atna,
  centralities, prune, summary,
} from 'dynajs';
import type { TNA } from 'dynajs';
import { activityLogApi } from '../../api/admin';
import { useTheme } from '../../hooks/useTheme';
import { AdminLayout, StatCard } from '../../components/admin';
import { Loading } from '../../components/common/Loading';
import { TnaDistributionPlot } from '../../components/tna/TnaDistributionPlot';
import { TnaIndexPlot } from '../../components/tna/TnaIndexPlot';
import { TnaFrequencyChart } from '../../components/tna/TnaFrequencyChart';
import { TnaNetworkGraph } from '../../components/tna/TnaNetworkGraph';
import { CentralityBarChart } from '../../components/tna/CentralityBarChart';
import { NetworkModal, ModalShell, useEscapeClose } from '../../components/tna/NetworkModal';
import { ClustersTab } from '../../components/tna/ClustersTab';
import { PatternsTab } from '../../components/tna/PatternsTab';
import { ActivityTimelineChart } from '../../components/tna/ActivityTimelineChart';
import { ActivityDonutChart } from '../../components/tna/ActivityDonutChart';
import { ActivityHeatmap } from '../../components/tna/ActivityHeatmap';
import { createColorMap, PALETTE_NAMES } from '../../components/tna/colorFix';
import type { PaletteName } from '../../components/tna/colorFix';

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

type ModelType = 'relative' | 'frequency' | 'co-occurrence' | 'attention';
type PageTab = 'activity' | 'analytics' | 'clusters' | 'patterns' | 'settings';
type SequenceMode = 'verb' | 'objectType' | 'combined' | 'raw';

const MODEL_BUILDERS: Record<ModelType, typeof tna> = {
  relative: tna,
  frequency: ftna,
  'co-occurrence': ctna,
  attention: atna,
};

const NODE_SIZE_OPTIONS = [
  { value: 'fixed', i18nKey: 'fixed_size' },
  { value: 'InStrength', i18nKey: 'in_strength' },
];

/** Default smart interpretations for verb+objectType → readable learning state.
 *
 *  10 states:
 *    learning     – consuming content (viewing lectures, sections, videos, files, downloads)
 *    progressing  – making progress through content (progressed lecture/section/video)
 *    advancing    – navigating/scrolling/seeking within content (media controls, scrolled, seeked)
 *    engaged      – actively starting/interacting with activities (started, interacted section)
 *    regulated    – self-regulation: completing activities (completed lecture/section/module)
 *    assessment   – all quiz & assignment activity (started, submitted, completed, graded)
 *    help         – general chatbot interactions
 *    AI_engaged   – AI tutor interactions (tutor_agent, tutor_session)
 *    expressed    – emotional pulse activities
 *    browsing     – viewing course/module overview pages
 */
// Verb-level fallback: if a specific verb:objectType combo isn't in the map,
// fall back to the verb's default interpretation.
const VERB_FALLBACKS: Record<string, string> = {
  viewed: 'learning',
  downloaded: 'learning',
  progressed: 'progressing',
  navigated: 'advancing',
  scrolled: 'advancing',
  seeked: 'advancing',
  media_control: 'advancing',
  paused: 'advancing',
  resumed: 'advancing',
  started: 'progressing',
  interacted: 'engaged',
  completed: 'regulated',
  submitted: 'assessment',
  graded: 'assessment',
  messaged: 'help',
  received: 'help',
  expressed: 'expressed',
  selected: 'engaged',
  switched: 'advancing',
};

// Object-type overrides: these object types force a specific interpretation
// regardless of verb (checked before verb fallback).
const OBJECT_OVERRIDES: Record<string, string> = {
  quiz: 'assessment',
  assignment: 'assessment',
  tutor_agent: 'AI_engaged',
  tutor_session: 'AI_engaged',
  tutor_conversation: 'AI_engaged',
  emotional_pulse: 'expressed',
};

const DEFAULT_INTERPRETATIONS: Record<string, string> = {
  // learning – consuming content
  'viewed:lecture': 'learning',
  'viewed:section': 'learning',
  'viewed:video': 'learning',
  'viewed:file': 'learning',
  'downloaded:file': 'learning',
  'downloaded:section': 'learning',

  // progressing – making progress through content
  'progressed:lecture': 'progressing',
  'progressed:video': 'progressing',
  'progressed:section': 'progressing',

  // advancing – navigating within content
  'navigated:lecture': 'advancing',
  'navigated:video': 'advancing',
  'navigated:section': 'advancing',
  'scrolled:lecture': 'advancing',
  'scrolled:section': 'advancing',
  'seeked:video': 'advancing',
  'media_control:video': 'advancing',
  'media_control:lecture': 'advancing',
  'paused:video': 'advancing',
  'paused:lecture': 'advancing',
  'resumed:video': 'advancing',
  'resumed:lecture': 'advancing',

  // engaged – actively starting/interacting with activities
  'started:lecture': 'engaged',
  'started:section': 'engaged',
  'started:video': 'engaged',
  'interacted:section': 'engaged',

  // regulated – completing activities (self-regulation)
  'completed:lecture': 'regulated',
  'completed:section': 'regulated',
  'completed:module': 'regulated',
  'completed:video': 'regulated',

  // assessment – all quiz & assignment activity
  'started:quiz': 'assessment',
  'started:assignment': 'assessment',
  'submitted:quiz': 'assessment',
  'submitted:assignment': 'assessment',
  'completed:quiz': 'assessment',
  'completed:assignment': 'assessment',
  'graded:quiz': 'assessment',
  'graded:assignment': 'assessment',

  // help – general chatbot
  'messaged:chatbot': 'help',
  'interacted:chatbot': 'help',

  // AI_engaged – AI tutor
  'messaged:tutor_agent': 'AI_engaged',
  'messaged:tutor_session': 'AI_engaged',
  'messaged:tutor_conversation': 'AI_engaged',
  'received:tutor_agent': 'AI_engaged',
  'switched:tutor_session': 'AI_engaged',
  'started:tutor_session': 'AI_engaged',
  'selected:tutor_agent': 'AI_engaged',

  // expressed – emotional pulse
  'expressed:emotional_pulse': 'expressed',
  'interacted:emotional_pulse': 'expressed',

  // browsing – course/module overview
  'viewed:course': 'browsing',
  'viewed:module': 'browsing',
};

/** Resolve a verb:objectType combo using: explicit map → object override → verb fallback */
function resolveInterpretation(
  key: string,
  map: Record<string, string>,
): string | null {
  if (map[key]) return map[key];
  const [verb, obj] = key.split(':');
  if (obj && OBJECT_OVERRIDES[obj]) return OBJECT_OVERRIDES[obj];
  if (verb && VERB_FALLBACKS[verb]) return VERB_FALLBACKS[verb];
  return null;
}

/* ------------------------------------------------------------------ */
/*  Dashboard (exported page component)                                */
/* ------------------------------------------------------------------ */

interface DashboardProps {
  mode?: 'admin' | 'instructor' | 'student';
  fixedCourseId?: number;
  fixedUserId?: number;
}

export const Dashboard = ({ mode = 'admin', fixedCourseId, fixedUserId }: DashboardProps) => {
  const { t } = useTranslation(['admin']);
  const { isDark } = useTheme();

  const isStudent = mode === 'student';
  const isAdmin = mode === 'admin';

  // Available tabs depend on mode
  const availableTabs: PageTab[] = isStudent
    ? ['activity', 'analytics', 'patterns']
    : isAdmin
    ? ['activity', 'analytics', 'clusters', 'patterns', 'settings']
    : ['activity', 'analytics', 'clusters', 'patterns', 'settings'];

  // Top-level tab
  const [activeTab, setActiveTab] = useState<PageTab>('analytics');

  // Shared filters
  const [courseId, setCourseId] = useState<number | undefined>(fixedCourseId);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Student selector (admin/instructor only)
  const [selectedUserId, setSelectedUserId] = useState<number | undefined>(undefined);
  const effectiveUserId = fixedUserId ?? selectedUserId;

  // Analytics-specific filters
  const [pruneThreshold, setPruneThreshold] = useState(0.05);
  const [modelType, setModelType] = useState<ModelType>('relative');

  // Network graph settings
  const [showSelfLoops, setShowSelfLoops] = useState(false);
  const [showEdgeLabels, setShowEdgeLabels] = useState(true);
  const [nodeRadius, setNodeRadius] = useState(25);
  const [networkSettingsOpen, setNetworkSettingsOpen] = useState(false);
  const [nodeSizeMetric, setNodeSizeMetric] = useState('fixed');
  const [palette, setPalette] = useState<PaletteName>('default');
  const [networkModalOpen, setNetworkModalOpen] = useState(false);

  // Sequence view toggle
  const [seqView, setSeqView] = useState<'distribution' | 'index'>('distribution');

  // Enlarged modals
  const [enlargedCard, setEnlargedCard] = useState<string | null>(null);

  // Cluster settings (shared via settings tab)
  const [clusterK, setClusterK] = useState(3);
  const [clusterNodeRadius, setClusterNodeRadius] = useState(16);
  const [clusterPruneThreshold, setClusterPruneThreshold] = useState(0.05);
  const [clusterShowSelfLoops, setClusterShowSelfLoops] = useState(false);
  const [clusterShowEdgeLabels, setClusterShowEdgeLabels] = useState(true);
  const [clusterDissimilarity, setClusterDissimilarity] = useState<'hamming' | 'lv' | 'osa' | 'lcs'>('hamming');
  const [clusterMethod, setClusterMethod] = useState<'pam' | 'single' | 'complete' | 'average' | 'ward'>('pam');

  // Min sequence length for API call
  const [minSequenceLength, setMinSequenceLength] = useState(2);

  // Pattern settings
  const [shortLengths, setShortLengths] = useState<Record<number, boolean>>({ 2: true, 3: true });
  const [longLengths, setLongLengths] = useState<Record<number, boolean>>({ 4: true, 5: true });

  // Sequence mode: what to use as states in TNA
  const [sequenceMode, setSequenceMode] = useState<SequenceMode>('combined');
  const [interpretations, setInterpretations] = useState<Record<string, string>>({ ...DEFAULT_INTERPRETATIONS });

  // Verb editing: renames map original→new name (merging uses same target), excludes is a set of hidden verbs
  const [verbRenames, setVerbRenames] = useState<Record<string, string>>({});
  const [verbExcludes, setVerbExcludes] = useState<Record<string, boolean>>({});

  // Sequence grouping: actor (one sequence per user) or actor-session (one per session)
  const [groupBy, setGroupBy] = useState<'actor' | 'actor-session'>('actor-session');

  // Reset renames/excludes when switching sequence mode (labels change entirely)
  const handleModeChange = (mode: SequenceMode) => {
    setSequenceMode(mode);
    setVerbRenames({});
    setVerbExcludes({});
  };

  /* --- Data fetching --- */

  const queryClient = useQueryClient();
  const STALE_1H = 3_600_000; // 1 hour — data served from cache, no refetch

  const { data: filterOptions } = useQuery({
    queryKey: ['activityLogFilterOptions'],
    queryFn: () => activityLogApi.getFilterOptions(),
    staleTime: STALE_1H,
  });

  const isActivityTab = activeTab === 'activity';
  const isAnalyticsRelatedTab = activeTab === 'analytics' || activeTab === 'clusters' || activeTab === 'patterns' || activeTab === 'settings';

  const { data: tnaData, isLoading, dataUpdatedAt: tnaUpdatedAt, isFetching: tnaFetching } = useQuery({
    queryKey: ['tnaSequences', courseId, effectiveUserId, startDate, endDate, groupBy, minSequenceLength],
    queryFn: () =>
      activityLogApi.getTnaSequences({
        courseId,
        userId: effectiveUserId,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        minSequenceLength,
        groupBy,
      }),
    enabled: isAnalyticsRelatedTab,
    staleTime: STALE_1H,
  });

  const { data: dailyCounts, isLoading: dailyCountsLoading } = useQuery({
    queryKey: ['dailyCounts', courseId, effectiveUserId, startDate, endDate],
    queryFn: () =>
      activityLogApi.getDailyCounts({
        courseId,
        userId: effectiveUserId,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
      }),
    enabled: isActivityTab,
    staleTime: STALE_1H,
  });

  const { data: summaryData, isLoading: summaryLoading, dataUpdatedAt: activityUpdatedAt, isFetching: activityFetching } = useQuery({
    queryKey: ['activitySummary', courseId, effectiveUserId, startDate, endDate],
    queryFn: () =>
      activityLogApi.getSummary({
        courseId,
        userId: effectiveUserId,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
      }),
    enabled: isActivityTab,
    staleTime: STALE_1H,
  });

  const { data: hourlyCounts, isLoading: hourlyLoading } = useQuery({
    queryKey: ['hourlyCounts', courseId, effectiveUserId, startDate, endDate],
    queryFn: () =>
      activityLogApi.getHourlyCounts({
        courseId,
        userId: effectiveUserId,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
      }),
    enabled: isActivityTab,
    staleTime: STALE_1H,
  });

  const { data: activityStats } = useQuery({
    queryKey: ['activityStats', courseId, startDate, endDate],
    queryFn: () =>
      activityLogApi.getStats({
        courseId,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
      }),
    enabled: isActivityTab,
    staleTime: STALE_1H,
  });

  const { data: topResources } = useQuery({
    queryKey: ['topResources', courseId, effectiveUserId, startDate, endDate],
    queryFn: () =>
      activityLogApi.getTopResources({
        courseId,
        userId: effectiveUserId,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        limit: 10,
      }),
    enabled: isActivityTab,
    staleTime: STALE_1H,
  });

  /** Invalidate all queries for the current tab and refetch */
  const refreshCurrentTab = () => {
    if (isActivityTab) {
      queryClient.invalidateQueries({ queryKey: ['activitySummary'] });
      queryClient.invalidateQueries({ queryKey: ['hourlyCounts'] });
      queryClient.invalidateQueries({ queryKey: ['dailyCounts'] });
      queryClient.invalidateQueries({ queryKey: ['activityStats'] });
      queryClient.invalidateQueries({ queryKey: ['topResources'] });
    } else {
      queryClient.invalidateQueries({ queryKey: ['tnaSequences'] });
    }
  };

  const lastUpdated = isActivityTab ? activityUpdatedAt : tnaUpdatedAt;
  const isRefreshing = isActivityTab ? activityFetching : tnaFetching;

  /* --- Transform sequences with verb edits --- */

  const transformedData = useMemo(() => {
    if (!tnaData?.sequences?.length) return null;
    const verbSeqs = tnaData.sequences;
    const objSeqs = tnaData.objectTypeSequences ?? [];

    // Step 1: Build base sequences depending on mode
    let baseSeqs: string[][];
    if (sequenceMode === 'objectType') {
      baseSeqs = objSeqs.length ? objSeqs : verbSeqs;
    } else if (sequenceMode === 'raw') {
      // Raw verb:objectType combinations — no interpretation
      baseSeqs = verbSeqs.map((seq: string[], i: number) => {
        const objSeq = objSeqs[i] ?? [];
        return seq.map((verb: string, j: number) => {
          const obj = objSeq[j] ?? '';
          return obj ? `${verb}:${obj}` : verb;
        });
      });
    } else if (sequenceMode === 'combined') {
      // Combine verb+objectType using interpretations map + fallbacks
      baseSeqs = verbSeqs.map((seq: string[], i: number) => {
        const objSeq = objSeqs[i] ?? [];
        return seq.map((verb: string, j: number) => {
          const obj = objSeq[j] ?? '';
          const key = `${verb}:${obj}`;
          return resolveInterpretation(key, interpretations) ?? `${verb}_${obj}`;
        });
      });
    } else {
      baseSeqs = verbSeqs;
    }

    // Step 2: Apply renames and exclusions
    const seqs = baseSeqs.map((seq: string[]) =>
      seq
        .map((v: string) => {
          if (verbExcludes[v]) return null;
          return verbRenames[v] || v;
        })
        .filter((v: string | null): v is string => v !== null)
    ).filter((seq: string[]) => seq.length >= 2);

    const labelSet = new Set<string>();
    for (const seq of seqs) for (const v of seq) labelSet.add(v);
    const labels = [...labelSet].sort();

    return { sequences: seqs, labels };
  }, [tnaData, sequenceMode, interpretations, verbRenames, verbExcludes]);

  /* --- Raw verb:objectType combinations (for raw mode editor) --- */

  const rawCombinations = useMemo(() => {
    if (!tnaData?.sequences?.length) return [];
    const verbSeqs = tnaData.sequences;
    const objSeqs = tnaData.objectTypeSequences ?? [];
    const set = new Set<string>();
    for (let i = 0; i < verbSeqs.length; i++) {
      const objSeq = objSeqs[i] ?? [];
      for (let j = 0; j < verbSeqs[i].length; j++) {
        const obj = objSeq[j] ?? '';
        set.add(obj ? `${verbSeqs[i][j]}:${obj}` : verbSeqs[i][j]);
      }
    }
    return [...set].sort();
  }, [tnaData]);

  /* --- TNA analysis (useMemo — stays cached across tab switches since Dashboard doesn't unmount) --- */

  const analysis = useMemo(() => {
    if (!transformedData?.sequences?.length) return null;
    const seqs = transformedData.sequences;
    const lbls = transformedData.labels;

    try {
      const builder = MODEL_BUILDERS[modelType];
      const rawModel = builder(seqs, { labels: lbls });
      const prunedM = prune(rawModel, pruneThreshold) as TNA;
      const cm = createColorMap(lbls, palette);

      let cent: { labels: string[]; measures: Record<string, number[]> } | null = null;
      try {
        const raw = centralities(rawModel);
        const measures: Record<string, number[]> = {};
        for (const [k, v] of Object.entries(raw.measures)) {
          measures[k] = Array.from(v);
        }
        cent = { labels: raw.labels, measures };
      } catch { /* ignore */ }

      let sum = null;
      try { sum = summary(rawModel); } catch { /* ignore */ }

      return { prunedModel: prunedM, labels: lbls, colorMap: cm, centralityData: cent, summaryData: sum };
    } catch {
      return null;
    }
  }, [transformedData, pruneThreshold, modelType, palette]);

  /* --- Theme colors for stat cards --- */

  const c = {
    bgBlue: isDark ? 'rgba(59,130,246,0.2)' : '#dbeafe',
    bgGreen: isDark ? 'rgba(34,197,94,0.2)' : '#dcfce7',
    bgTeal: isDark ? 'rgba(8,143,143,0.2)' : '#f0fdfd',
    bgPurple: isDark ? 'rgba(139,92,246,0.2)' : '#ede9fe',
    bgOrange: isDark ? 'rgba(249,115,22,0.2)' : '#ffedd5',
    txBlue: isDark ? '#93c5fd' : '#2563eb',
    txGreen: isDark ? '#86efac' : '#16a34a',
    txTeal: isDark ? '#5eecec' : '#088F8F',
    txPurple: isDark ? '#c4b5fd' : '#7c3aed',
    txOrange: isDark ? '#fdba74' : '#ea580c',
  };

  const density = analysis?.summaryData?.density as number | undefined;
  const edgeCount = analysis?.summaryData?.nEdges as number | undefined;

  /* --- Render --- */

  if (isLoading && isAnalyticsRelatedTab) {
    return <Loading fullScreen text={t('loading_analytics')} />;
  }

  const pageTitle = isStudent ? t('my_analytics') : isAdmin ? t('analytics') : t('course_analytics');
  const Wrapper = isAdmin
    ? ({ children }: { children: React.ReactNode }) => <AdminLayout title={pageTitle} fullWidth>{children}</AdminLayout>
    : ({ children }: { children: React.ReactNode }) => (
        <div className="p-6 max-w-[1600px] mx-auto">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">{pageTitle}</h1>
          {tnaData?.metadata?.courseTitle && (
            <p className="text-sm text-gray-500 dark:text-gray-400 -mt-3 mb-4">{tnaData.metadata.courseTitle}</p>
          )}
          {children}
        </div>
      );

  return (
    <Wrapper>
        {/* ========== Header row: tabs + filters ========== */}
        <div className="flex flex-wrap items-end gap-3 mb-4">

          {/* Tabs */}
          <div className="flex rounded-lg border border-gray-300 dark:border-gray-600 overflow-hidden text-sm mr-auto">
            {availableTabs.map(tab => {
              const label = tab === 'activity' ? t('activity_tab') : tab === 'analytics' ? t('network') : tab === 'clusters' ? t('clusters_title') : tab === 'patterns' ? t('patterns_title') : t('analytics_settings');
              return (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-4 py-1.5 font-medium transition-colors ${
                    activeTab === tab
                      ? 'bg-primary-600 text-white'
                      : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>

          {/* Shared filters — course selector only in admin mode */}
          {isAdmin && (
            <div className="flex flex-col gap-1">
              <label className="text-xs text-gray-500 dark:text-gray-400">{t('course')}</label>
              <select value={courseId ?? ''}
                onChange={e => { setCourseId(e.target.value ? parseInt(e.target.value) : undefined); setSelectedUserId(undefined); }}
                className="px-3 py-1.5 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300">
                <option value="">{t('all_courses')}</option>
                {filterOptions?.courses?.map((co: any) => (
                  <option key={co.id} value={co.id!}>{co.title}</option>
                ))}
              </select>
            </div>
          )}
          {/* Student selector (admin/instructor only) */}
          {!isStudent && activeTab === 'activity' && (
            <div className="flex flex-col gap-1">
              <label className="text-xs text-gray-500 dark:text-gray-400">{t('select_student')}</label>
              <select value={selectedUserId ?? ''}
                onChange={e => setSelectedUserId(e.target.value ? parseInt(e.target.value) : undefined)}
                className="px-3 py-1.5 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300">
                <option value="">{t('all_students')}</option>
                {filterOptions?.users?.map((u: any) => (
                  <option key={u.id} value={u.id}>{u.fullname} ({u.email})</option>
                ))}
              </select>
            </div>
          )}
          <div className="flex flex-col gap-1">
            <label className="text-xs text-gray-500 dark:text-gray-400">{t('start_date')}</label>
            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
              className="px-3 py-1.5 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300" />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-gray-500 dark:text-gray-400">{t('end_date')}</label>
            <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
              className="px-3 py-1.5 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300" />
          </div>

          {/* Analytics-only filters */}
          {activeTab === 'analytics' && (
            <>
              <div className="flex flex-col gap-1">
                <label className="text-xs text-gray-500 dark:text-gray-400">
                  {t('prune_threshold')}: {pruneThreshold.toFixed(2)}
                </label>
                <input type="range" min={0} max={0.5} step={0.01} value={pruneThreshold}
                  onChange={e => setPruneThreshold(parseFloat(e.target.value))} className="w-32" />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs text-gray-500 dark:text-gray-400">{t('model_type')}</label>
                <select value={modelType} onChange={e => setModelType(e.target.value as ModelType)}
                  className="px-3 py-1.5 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300">
                  <option value="relative">{t('model_relative')}</option>
                  <option value="frequency">{t('model_frequency')}</option>
                  <option value="co-occurrence">{t('model_cooccurrence')}</option>
                  <option value="attention">{t('model_attention')}</option>
                </select>
              </div>
            </>
          )}

          {/* Refresh + last-updated indicator */}
          <div className="flex items-center gap-1.5">
            {lastUpdated > 0 && (
              <span className="text-[10px] text-gray-400 dark:text-gray-500 whitespace-nowrap">
                {new Date(lastUpdated).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
            <button onClick={refreshCurrentTab} disabled={isRefreshing}
              className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors disabled:opacity-40"
              title={t('refresh')}>
              <RefreshCw className={`w-4 h-4 text-gray-500 dark:text-gray-400 ${isRefreshing ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {/* Settings icon for quick access (hidden for students) */}
          {!isStudent && activeTab !== 'settings' && (
            <button onClick={() => setActiveTab('settings')}
              className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors ml-1"
              title={t('analytics_settings')}>
              <Settings2 className="w-4 h-4 text-gray-500 dark:text-gray-400" />
            </button>
          )}
        </div>

        {/* ========== Student banner ========== */}
        {isStudent && (
          <div className="mb-4 px-4 py-3 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 text-sm text-blue-700 dark:text-blue-300">
            {t('your_activity')}
          </div>
        )}

        {/* ========== Stat cards ========== */}
        {tnaData && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 mb-4">
            <StatCard icon={<Users className="w-5 h-5" style={{ color: c.txBlue }} />}
              iconBgColor={c.bgBlue} value={tnaData.metadata.totalSequences} label={t('sequences_count')} />
            <StatCard icon={<Activity className="w-5 h-5" style={{ color: c.txGreen }} />}
              iconBgColor={c.bgGreen} value={tnaData.metadata.totalEvents} label={t('events_count')} />
            <StatCard icon={<Hash className="w-5 h-5" style={{ color: c.txTeal }} />}
              iconBgColor={c.bgTeal} value={transformedData?.labels.length ?? tnaData.metadata.uniqueVerbs.length}
              label={sequenceMode === 'objectType' ? t('object_types') : sequenceMode === 'combined' ? t('states_count') : sequenceMode === 'raw' ? t('raw_combinations') : t('verbs_count')} />
            {density != null && (
              <StatCard icon={<Network className="w-5 h-5" style={{ color: c.txPurple }} />}
                iconBgColor={c.bgPurple} value={`${(density * 100).toFixed(1)}%`} label={t('network_density')} />
            )}
            {edgeCount != null && (
              <StatCard icon={<GitBranch className="w-5 h-5" style={{ color: c.txOrange }} />}
                iconBgColor={c.bgOrange} value={edgeCount} label={t('edges_count')} />
            )}
          </div>
        )}

        {/* ========== Activity tab (independent data source) ========== */}
        {activeTab === 'activity' ? (
          <div className="space-y-4">
            {/* Row 1: Summary stat cards */}
            {summaryLoading ? (
              <Loading />
            ) : summaryData ? (
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard
                  icon={<Activity className="w-5 h-5" style={{ color: c.txBlue }} />}
                  iconBgColor={c.bgBlue}
                  value={summaryData.totalActivities.toLocaleString()}
                  label={t('total_activities')}
                  size="sm"
                />
                <StatCard
                  icon={<Users className="w-5 h-5" style={{ color: c.txGreen }} />}
                  iconBgColor={c.bgGreen}
                  value={isStudent ? summaryData.uniqueSessions : summaryData.uniqueUsers}
                  label={isStudent ? t('my_sessions') : t('unique_users')}
                  size="sm"
                />
                <StatCard
                  icon={<Clock className="w-5 h-5" style={{ color: c.txTeal }} />}
                  iconBgColor={c.bgTeal}
                  value={isStudent ? summaryData.totalActivities : summaryData.uniqueSessions}
                  label={isStudent ? t('total_activities') : t('unique_sessions')}
                  size="sm"
                />
                <StatCard
                  icon={<TrendingUp className="w-5 h-5" style={{ color: c.txPurple }} />}
                  iconBgColor={c.bgPurple}
                  value={summaryData.avgPerUser}
                  label={t('avg_per_user')}
                  size="sm"
                />
              </div>
            ) : null}

            {/* Row 2: Donut charts */}
            {activityStats ? (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <ActivityDonutChart
                  data={activityStats.activitiesByVerb ?? {}}
                  title={t('verb_distribution')}
                  palette={palette}
                />
                <ActivityDonutChart
                  data={activityStats.activitiesByObjectType ?? {}}
                  title={t('object_type_distribution')}
                  palette={palette}
                />
              </div>
            ) : null}

            {/* Row 3: Heatmap */}
            <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
              <h3 className="text-base font-semibold text-gray-800 dark:text-gray-200 mb-1">
                {t('activity_heatmap')}
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">{t('activity_heatmap_desc')}</p>
              {hourlyLoading ? (
                <Loading />
              ) : hourlyCounts && hourlyCounts.data.length > 0 ? (
                <ActivityHeatmap data={hourlyCounts.data} />
              ) : (
                <div className="text-center py-8 text-gray-500 dark:text-gray-400 text-sm">
                  {t('no_tna_data')}
                </div>
              )}
            </div>

            {/* Row 4: Top Resources */}
            {topResources && topResources.data.length > 0 && (
              <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
                <h3 className="text-base font-semibold text-gray-800 dark:text-gray-200 mb-3">
                  {t('top_resources')}
                </h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-200 dark:border-gray-700">
                        <th className="text-left py-2 px-3 text-gray-500 dark:text-gray-400 font-medium">#</th>
                        <th className="text-left py-2 px-3 text-gray-500 dark:text-gray-400 font-medium">{t('object')}</th>
                        <th className="text-left py-2 px-3 text-gray-500 dark:text-gray-400 font-medium">{t('object_type')}</th>
                        <th className="text-right py-2 px-3 text-gray-500 dark:text-gray-400 font-medium">{t('total_activities')}</th>
                        {!isStudent && (
                          <th className="text-right py-2 px-3 text-gray-500 dark:text-gray-400 font-medium">{t('unique_users')}</th>
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {topResources.data.map((item, idx) => {
                        const barPct = topResources.data[0].count > 0 ? (item.count / topResources.data[0].count) * 100 : 0;
                        return (
                          <tr key={`${item.objectType}-${item.objectId}-${idx}`}
                            className="border-b border-gray-100 dark:border-gray-700/50 hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                            <td className="py-2 px-3 text-gray-400 dark:text-gray-500 font-mono text-xs">{idx + 1}</td>
                            <td className="py-2 px-3">
                              <div className="relative">
                                <div className="absolute inset-0 rounded"
                                  style={{ width: `${barPct}%`, backgroundColor: isDark ? 'rgba(90,180,172,0.15)' : 'rgba(90,180,172,0.1)' }} />
                                <span className="relative text-gray-800 dark:text-gray-200 font-medium">{item.objectTitle}</span>
                              </div>
                            </td>
                            <td className="py-2 px-3">
                              <span className="inline-block px-2 py-0.5 rounded-full text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
                                {item.objectType}
                              </span>
                            </td>
                            <td className="py-2 px-3 text-right font-semibold text-gray-700 dark:text-gray-300">{item.count.toLocaleString()}</td>
                            {!isStudent && (
                              <td className="py-2 px-3 text-right text-gray-500 dark:text-gray-400">{item.uniqueUsers}</td>
                            )}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Row 5: Timeline (existing) */}
            <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
              <h3 className="text-base font-semibold text-gray-800 dark:text-gray-200 mb-4">
                {t('activity_timeline')}
              </h3>
              {dailyCountsLoading ? (
                <Loading />
              ) : dailyCounts && dailyCounts.days.length > 0 ? (
                <ActivityTimelineChart
                  days={dailyCounts.days}
                  verbs={dailyCounts.verbs}
                  series={dailyCounts.series}
                  palette={palette}
                />
              ) : (
                <div className="text-center py-16 text-gray-500 dark:text-gray-400">
                  {t('no_tna_data')}
                </div>
              )}
            </div>
          </div>
        ) : !transformedData?.sequences?.length ? (
          <div className="text-center py-16 text-gray-500 dark:text-gray-400">
            {t('no_tna_data')}
          </div>
        ) : activeTab === 'analytics' ? (
          /* ========== Analytics tab ========== */
          <>
            {!analysis ? (
              <div className="text-center py-16 text-gray-500 dark:text-gray-400">
                {t('analysis_error')}
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Network Graph */}
                {analysis.prunedModel && (
                  <div className="bg-white dark:bg-gray-800 rounded-xl p-2 border border-gray-200 dark:border-gray-700">
                    <div className="flex items-center justify-between px-3 pt-2">
                      <h3 className="text-base font-semibold text-gray-800 dark:text-gray-200">
                        {t('network_title')}
                      </h3>
                      <div className="flex items-center gap-1">
                        <button onClick={() => setNetworkSettingsOpen(!networkSettingsOpen)}
                          className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                          title={t('network_settings')}>
                          <Settings2 className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                        </button>
                        <button onClick={() => setNetworkModalOpen(true)}
                          className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                          title={t('network_title')}>
                          <Expand className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                        </button>
                      </div>
                    </div>
                    {networkSettingsOpen && (
                      <div className="mx-3 mt-2 mb-1 flex flex-wrap gap-3 items-center text-sm">
                        <label className="flex items-center gap-1.5 text-gray-600 dark:text-gray-300">
                          <input type="checkbox" checked={showSelfLoops}
                            onChange={e => setShowSelfLoops(e.target.checked)} className="rounded" />
                          {t('show_self_loops')}
                        </label>
                        <label className="flex items-center gap-1.5 text-gray-600 dark:text-gray-300">
                          <input type="checkbox" checked={showEdgeLabels}
                            onChange={e => setShowEdgeLabels(e.target.checked)} className="rounded" />
                          {t('show_edge_labels')}
                        </label>
                        <label className="flex items-center gap-1.5 text-gray-600 dark:text-gray-300">
                          {t('node_radius')}: {nodeRadius}
                          <input type="range" min={15} max={50} value={nodeRadius}
                            onChange={e => setNodeRadius(parseInt(e.target.value))} className="w-20" />
                        </label>
                        <label className="flex items-center gap-1.5 text-gray-600 dark:text-gray-300">
                          {t('node_size_by')}:
                          <select value={nodeSizeMetric}
                            onChange={e => setNodeSizeMetric(e.target.value)}
                            className="px-2 py-1 text-sm rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300">
                            {NODE_SIZE_OPTIONS.map(opt => (
                              <option key={opt.value} value={opt.value}>{t(opt.i18nKey)}</option>
                            ))}
                          </select>
                        </label>
                      </div>
                    )}
                    <TnaNetworkGraph
                      model={analysis.prunedModel}
                      showSelfLoops={showSelfLoops}
                      showEdgeLabels={showEdgeLabels}
                      nodeRadius={nodeRadius}
                      height={380}
                      colorMap={analysis.colorMap}
                      centralityData={analysis.centralityData ?? undefined}
                      nodeSizeMetric={nodeSizeMetric}
                      modelType={modelType}
                    />
                  </div>
                )}

                {/* Sequence Plot */}
                <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700 relative">
                  <div className="flex items-center justify-between mb-1">
                    <h3 className="text-base font-semibold text-gray-800 dark:text-gray-200">
                      {seqView === 'distribution' ? t('distribution_title') : t('index_title')}
                    </h3>
                    <div className="flex items-center gap-2">
                      <div className="flex rounded-lg border border-gray-300 dark:border-gray-600 overflow-hidden text-xs">
                        <button onClick={() => setSeqView('distribution')}
                          className={`px-3 py-1 transition-colors ${seqView === 'distribution'
                            ? 'bg-primary-600 text-white'
                            : 'bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600'}`}>
                          {t('distribution')}
                        </button>
                        <button onClick={() => setSeqView('index')}
                          className={`px-3 py-1 transition-colors ${seqView === 'index'
                            ? 'bg-primary-600 text-white'
                            : 'bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600'}`}>
                          {t('index')}
                        </button>
                      </div>
                      <button onClick={() => setEnlargedCard('sequence')}
                        className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                        <Expand className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                      </button>
                    </div>
                  </div>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">
                    {seqView === 'distribution' ? t('distribution_desc') : t('index_desc')}
                  </p>
                  {seqView === 'distribution'
                    ? <TnaDistributionPlot sequences={transformedData.sequences} labels={analysis.labels} colorMap={analysis.colorMap} />
                    : <TnaIndexPlot sequences={transformedData.sequences} labels={analysis.labels} colorMap={analysis.colorMap} />
                  }
                </div>

                {/* Frequency Chart */}
                <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
                  <div className="flex items-center justify-between mb-1">
                    <h3 className="text-base font-semibold text-gray-800 dark:text-gray-200">
                      {t('frequencies_title')}
                    </h3>
                    <button onClick={() => setEnlargedCard('frequency')}
                      className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                      <Expand className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                    </button>
                  </div>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">{t('frequencies_desc')}</p>
                  <TnaFrequencyChart sequences={transformedData.sequences} labels={analysis.labels} colorMap={analysis.colorMap} />
                </div>

                {/* Centrality Bar Chart */}
                {analysis.centralityData && (
                  <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
                    <div className="flex items-center justify-between mb-1">
                      <h3 className="text-base font-semibold text-gray-800 dark:text-gray-200">
                        {t('centrality_title')}
                      </h3>
                      <button onClick={() => setEnlargedCard('centrality')}
                        className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                        <Expand className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                      </button>
                    </div>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">{t('centrality_desc')}</p>
                    <CentralityBarChart centralityData={analysis.centralityData} colorMap={analysis.colorMap} />
                  </div>
                )}
              </div>
            )}

            {/* Network Modal */}
            <NetworkModal
              open={networkModalOpen}
              onClose={() => setNetworkModalOpen(false)}
              sequences={transformedData.sequences}
              labels={transformedData.labels}
              initialModelType={modelType}
              initialPruneThreshold={pruneThreshold}
            />
          </>
        ) : activeTab === 'clusters' ? (
          /* ========== Clusters tab ========== */
          <ClustersTab
            sequences={transformedData.sequences}
            labels={transformedData.labels}
            k={clusterK}
            onKChange={setClusterK}
            nodeRadius={clusterNodeRadius}
            pruneThreshold={clusterPruneThreshold}
            showSelfLoops={clusterShowSelfLoops}
            showEdgeLabels={clusterShowEdgeLabels}
            palette={palette}
            dissimilarity={clusterDissimilarity}
            clusterMethod={clusterMethod}
          />
        ) : activeTab === 'patterns' ? (
          /* ========== Patterns tab ========== */
          <PatternsTab
            sequences={transformedData.sequences}
            colorMap={analysis?.colorMap ?? createColorMap(transformedData.labels, palette)}
            shortEnabled={shortLengths}
            onShortEnabledChange={setShortLengths}
            longEnabled={longLengths}
            onLongEnabledChange={setLongLengths}
          />
        ) : activeTab === 'settings' ? (
          /* ========== Settings tab ========== */
          <AnalyticsSettings
            t={t}
            modelType={modelType} setModelType={setModelType}
            pruneThreshold={pruneThreshold} setPruneThreshold={setPruneThreshold}
            showSelfLoops={showSelfLoops} setShowSelfLoops={setShowSelfLoops}
            showEdgeLabels={showEdgeLabels} setShowEdgeLabels={setShowEdgeLabels}
            nodeRadius={nodeRadius} setNodeRadius={setNodeRadius}
            nodeSizeMetric={nodeSizeMetric} setNodeSizeMetric={setNodeSizeMetric}
            clusterK={clusterK} setClusterK={setClusterK}
            clusterNodeRadius={clusterNodeRadius} setClusterNodeRadius={setClusterNodeRadius}
            clusterPruneThreshold={clusterPruneThreshold} setClusterPruneThreshold={setClusterPruneThreshold}
            clusterShowSelfLoops={clusterShowSelfLoops} setClusterShowSelfLoops={setClusterShowSelfLoops}
            clusterShowEdgeLabels={clusterShowEdgeLabels} setClusterShowEdgeLabels={setClusterShowEdgeLabels}
            clusterDissimilarity={clusterDissimilarity} setClusterDissimilarity={setClusterDissimilarity}
            clusterMethod={clusterMethod} setClusterMethod={setClusterMethod}
            minSequenceLength={minSequenceLength} setMinSequenceLength={setMinSequenceLength}
            shortLengths={shortLengths} setShortLengths={setShortLengths}
            longLengths={longLengths} setLongLengths={setLongLengths}
            rawVerbs={tnaData?.metadata?.uniqueVerbs ?? []}
            rawObjectTypes={tnaData?.metadata?.uniqueObjectTypes ?? []}
            rawCombinations={rawCombinations}
            verbRenames={verbRenames} setVerbRenames={setVerbRenames}
            verbExcludes={verbExcludes} setVerbExcludes={setVerbExcludes}
            sequenceMode={sequenceMode} setSequenceMode={handleModeChange}
            interpretations={interpretations} setInterpretations={setInterpretations}
            groupBy={groupBy} setGroupBy={setGroupBy}
            palette={palette} setPalette={setPalette}
            sequences={transformedData?.sequences ?? []}
          />
        ) : null}

        {/* ========== Enlarged card modal ========== */}
        {enlargedCard && analysis && transformedData && (
          <EnlargedCardModal
            card={enlargedCard}
            onClose={() => setEnlargedCard(null)}
            analysis={analysis}
            sequences={transformedData.sequences}
            seqView={seqView}
            t={t}
          />
        )}
    </Wrapper>
  );
};

/* ------------------------------------------------------------------ */
/*  Enlarged Card Modal                                                */
/* ------------------------------------------------------------------ */

const EnlargedCardModal = ({
  card,
  onClose,
  analysis,
  sequences,
  seqView,
  t,
}: {
  card: string;
  onClose: () => void;
  analysis: { labels: string[]; colorMap: Record<string, string>; centralityData: any; prunedModel: any };
  sequences: string[][];
  seqView: 'distribution' | 'index';
  t: (key: string) => string;
}) => {
  useEscapeClose(true, onClose);

  const title =
    card === 'sequence' ? (seqView === 'distribution' ? t('distribution_title') : t('index_title'))
    : card === 'frequency' ? t('frequencies_title')
    : t('centrality_title');

  return (
    <ModalShell title={title} onClose={onClose}>
      <div className="flex-1 overflow-auto p-6">
        {card === 'sequence' && (
          seqView === 'distribution'
            ? <TnaDistributionPlot sequences={sequences} labels={analysis.labels} colorMap={analysis.colorMap} />
            : <TnaIndexPlot sequences={sequences} labels={analysis.labels} colorMap={analysis.colorMap} />
        )}
        {card === 'frequency' && (
          <TnaFrequencyChart sequences={sequences} labels={analysis.labels} colorMap={analysis.colorMap} />
        )}
        {card === 'centrality' && analysis.centralityData && (
          <CentralityBarChart centralityData={analysis.centralityData} colorMap={analysis.colorMap} />
        )}
      </div>
    </ModalShell>
  );
};

/* ------------------------------------------------------------------ */
/*  Analytics Settings Tab                                             */
/* ------------------------------------------------------------------ */

const SHORT_LENGTHS = [2, 3];
const LONG_LENGTHS = [4, 5, 6, 7];

type Dissimilarity = 'hamming' | 'lv' | 'osa' | 'lcs';
type ClusterMethod = 'pam' | 'single' | 'complete' | 'average' | 'ward';

const AnalyticsSettings = ({
  t,
  modelType, setModelType,
  pruneThreshold, setPruneThreshold,
  showSelfLoops, setShowSelfLoops,
  showEdgeLabels, setShowEdgeLabels,
  nodeRadius, setNodeRadius,
  nodeSizeMetric, setNodeSizeMetric,
  clusterK, setClusterK,
  clusterNodeRadius, setClusterNodeRadius,
  clusterPruneThreshold, setClusterPruneThreshold,
  clusterShowSelfLoops, setClusterShowSelfLoops,
  clusterShowEdgeLabels, setClusterShowEdgeLabels,
  clusterDissimilarity, setClusterDissimilarity,
  clusterMethod, setClusterMethod,
  minSequenceLength, setMinSequenceLength,
  shortLengths, setShortLengths,
  longLengths, setLongLengths,
  rawVerbs, rawObjectTypes, rawCombinations, verbRenames, setVerbRenames, verbExcludes, setVerbExcludes,
  sequenceMode, setSequenceMode, interpretations, setInterpretations,
  groupBy, setGroupBy,
  palette, setPalette,
  sequences,
}: {
  t: (key: string) => string;
  modelType: ModelType; setModelType: (v: ModelType) => void;
  pruneThreshold: number; setPruneThreshold: (v: number) => void;
  showSelfLoops: boolean; setShowSelfLoops: (v: boolean) => void;
  showEdgeLabels: boolean; setShowEdgeLabels: (v: boolean) => void;
  nodeRadius: number; setNodeRadius: (v: number) => void;
  nodeSizeMetric: string; setNodeSizeMetric: (v: string) => void;
  clusterK: number; setClusterK: (v: number) => void;
  clusterNodeRadius: number; setClusterNodeRadius: (v: number) => void;
  clusterPruneThreshold: number; setClusterPruneThreshold: (v: number) => void;
  clusterShowSelfLoops: boolean; setClusterShowSelfLoops: (v: boolean) => void;
  clusterShowEdgeLabels: boolean; setClusterShowEdgeLabels: (v: boolean) => void;
  clusterDissimilarity: Dissimilarity; setClusterDissimilarity: (v: Dissimilarity) => void;
  clusterMethod: ClusterMethod; setClusterMethod: (v: ClusterMethod) => void;
  minSequenceLength: number; setMinSequenceLength: (v: number) => void;
  shortLengths: Record<number, boolean>; setShortLengths: (v: Record<number, boolean>) => void;
  longLengths: Record<number, boolean>; setLongLengths: (v: Record<number, boolean>) => void;
  rawVerbs: string[];
  rawObjectTypes: string[];
  rawCombinations: string[];
  verbRenames: Record<string, string>; setVerbRenames: (v: Record<string, string>) => void;
  verbExcludes: Record<string, boolean>; setVerbExcludes: (v: Record<string, boolean>) => void;
  sequenceMode: SequenceMode; setSequenceMode: (v: SequenceMode) => void;
  interpretations: Record<string, string>; setInterpretations: (v: Record<string, string>) => void;
  groupBy: 'actor' | 'actor-session'; setGroupBy: (v: 'actor' | 'actor-session') => void;
  palette: PaletteName; setPalette: (v: PaletteName) => void;
  sequences: string[][];
}) => {
  const [previewOpen, setPreviewOpen] = useState(false);
  const inputCls = "px-3 py-1.5 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300";
  const labelCls = "text-sm font-medium text-gray-700 dark:text-gray-300";
  const descCls = "text-xs text-gray-500 dark:text-gray-400 mt-0.5";

  return (
    <div className="space-y-6">
    <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-4 gap-4">
      {/* Sequence Mode */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
        <h3 className="text-base font-bold text-gray-900 dark:text-white mb-4">{t('sequence_mode')}</h3>
        <div className="space-y-4">
          <div>
            <label className={labelCls}>{t('state_labels')}</label>
            <p className={descCls}>{t('sequence_mode_desc')}</p>
            <select value={sequenceMode} onChange={e => setSequenceMode(e.target.value as SequenceMode)}
              className={`${inputCls} w-full mt-1`}>
              <option value="verb">{t('mode_verb')}</option>
              <option value="objectType">{t('mode_object_type')}</option>
              <option value="combined">{t('mode_combined')}</option>
              <option value="raw">{t('mode_raw')}</option>
            </select>
          </div>
          <div>
            <label className={labelCls}>{t('sequence_grouping')}</label>
            <p className={descCls}>{t('sequence_grouping_desc')}</p>
            <select value={groupBy} onChange={e => setGroupBy(e.target.value as 'actor' | 'actor-session')}
              className={`${inputCls} w-full mt-1`}>
              <option value="actor-session">{t('group_actor_session')}</option>
              <option value="actor">{t('group_actor')}</option>
            </select>
          </div>
          <div>
            <label className={labelCls}>{t('min_sequence_length')}</label>
            <p className={descCls}>{t('min_sequence_length_desc')}</p>
            <input type="number" min={1} max={20} value={minSequenceLength}
              onChange={e => { const v = parseInt(e.target.value); if (v >= 1 && v <= 20) setMinSequenceLength(v); }}
              className={`${inputCls} w-20 mt-1 text-center`} />
          </div>
          {sequenceMode === 'verb' && rawVerbs.length > 0 && (
            <div className="text-xs text-gray-500 dark:text-gray-400">
              <span className="font-medium">{rawVerbs.length}</span> {t('active_verbs').toLowerCase()}: {rawVerbs.slice(0, 8).join(', ')}{rawVerbs.length > 8 ? '...' : ''}
            </div>
          )}
          {sequenceMode === 'objectType' && rawObjectTypes.length > 0 && (
            <div className="text-xs text-gray-500 dark:text-gray-400">
              <span className="font-medium">{rawObjectTypes.length}</span> {t('object_types').toLowerCase()}: {rawObjectTypes.slice(0, 8).join(', ')}{rawObjectTypes.length > 8 ? '...' : ''}
            </div>
          )}
          {sequenceMode === 'combined' && (
            <div className="text-xs text-gray-500 dark:text-gray-400">
              {t('combined_desc')}
            </div>
          )}
          {sequenceMode === 'raw' && rawCombinations.length > 0 && (
            <div className="text-xs text-gray-500 dark:text-gray-400">
              <span className="font-medium">{rawCombinations.length}</span> {t('raw_combinations').toLowerCase()}: {rawCombinations.slice(0, 5).join(', ')}{rawCombinations.length > 5 ? '...' : ''}
            </div>
          )}
          {/* Preview button */}
          {sequences.length > 0 && (
            <button onClick={() => setPreviewOpen(true)}
              className="w-full mt-2 flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium rounded-lg bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300 border border-primary-200 dark:border-primary-800 hover:bg-primary-100 dark:hover:bg-primary-900/30 transition-colors">
              <Expand className="w-3.5 h-3.5" />
              {t('preview')}
            </button>
          )}
        </div>
      </div>

      {/* Network Settings */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
        <h3 className="text-base font-bold text-gray-900 dark:text-white mb-4">{t('network_settings')}</h3>
        <div className="space-y-4">
          <div>
            <label className={labelCls}>{t('model_type')}</label>
            <select value={modelType} onChange={e => setModelType(e.target.value as ModelType)}
              className={`${inputCls} w-full mt-1`}>
              <option value="relative">{t('model_relative')}</option>
              <option value="frequency">{t('model_frequency')}</option>
              <option value="co-occurrence">{t('model_cooccurrence')}</option>
              <option value="attention">{t('model_attention')}</option>
            </select>
          </div>
          <div>
            <label className={labelCls}>
              {t('prune_threshold')}: <span className="tabular-nums">{pruneThreshold.toFixed(2)}</span>
            </label>
            <input type="range" min={0} max={0.5} step={0.01} value={pruneThreshold}
              onChange={e => setPruneThreshold(parseFloat(e.target.value))} className="w-full mt-1" />
          </div>
          <div>
            <label className={labelCls}>
              {t('node_radius')}: <span className="tabular-nums">{nodeRadius}</span>
            </label>
            <input type="range" min={15} max={50} value={nodeRadius}
              onChange={e => setNodeRadius(parseInt(e.target.value))} className="w-full mt-1" />
          </div>
          <div>
            <label className={labelCls}>{t('node_size_by')}</label>
            <select value={nodeSizeMetric} onChange={e => setNodeSizeMetric(e.target.value)}
              className={`${inputCls} w-full mt-1`}>
              {NODE_SIZE_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{t(opt.i18nKey)}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelCls}>{t('color_palette')}</label>
            <select value={palette} onChange={e => setPalette(e.target.value as PaletteName)}
              className={`${inputCls} w-full mt-1`}>
              {PALETTE_NAMES.map(p => (
                <option key={p} value={p}>{t(`palette_${p}`)}</option>
              ))}
            </select>
            <div className="flex gap-0.5 mt-1.5">
              {Array.from({ length: 8 }, (_, i) => {
                const pal = createColorMap(
                  Array.from({ length: 8 }, (_, j) => String(j)),
                  palette
                );
                return <div key={i} className="w-4 h-4 rounded-sm" style={{ backgroundColor: pal[String(i)] }} />;
              })}
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
            <input type="checkbox" checked={showSelfLoops}
              onChange={e => setShowSelfLoops(e.target.checked)} className="rounded" />
            {t('show_self_loops')}
          </label>
          <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
            <input type="checkbox" checked={showEdgeLabels}
              onChange={e => setShowEdgeLabels(e.target.checked)} className="rounded" />
            {t('show_edge_labels')}
          </label>
        </div>
      </div>

      {/* Cluster Settings */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
        <h3 className="text-base font-bold text-gray-900 dark:text-white mb-4">{t('cluster_settings')}</h3>
        <div className="space-y-4">
          <div>
            <label className={labelCls}>{t('cluster_count')}</label>
            <p className={descCls}>{t('cluster_count_desc')}</p>
            <input type="number" min={2} max={10} value={clusterK}
              onChange={e => { const v = parseInt(e.target.value); if (v >= 2 && v <= 10) setClusterK(v); }}
              className={`${inputCls} w-20 mt-1 text-center`} />
          </div>
          <div>
            <label className={labelCls}>{t('dissimilarity_method')}</label>
            <p className={descCls}>{t('dissimilarity_method_desc')}</p>
            <select value={clusterDissimilarity} onChange={e => setClusterDissimilarity(e.target.value as Dissimilarity)}
              className={`${inputCls} w-full mt-1`}>
              <option value="hamming">{t('dissimilarity_hamming')}</option>
              <option value="lv">{t('dissimilarity_lv')}</option>
              <option value="osa">{t('dissimilarity_osa')}</option>
              <option value="lcs">{t('dissimilarity_lcs')}</option>
            </select>
          </div>
          <div>
            <label className={labelCls}>{t('cluster_method')}</label>
            <p className={descCls}>{t('cluster_method_desc')}</p>
            <select value={clusterMethod} onChange={e => setClusterMethod(e.target.value as ClusterMethod)}
              className={`${inputCls} w-full mt-1`}>
              <option value="pam">{t('method_pam')}</option>
              <option value="ward">{t('method_ward')}</option>
              <option value="complete">{t('method_complete')}</option>
              <option value="average">{t('method_average')}</option>
              <option value="single">{t('method_single')}</option>
            </select>
          </div>
          <div>
            <label className={labelCls}>
              {t('prune_threshold')}: <span className="tabular-nums">{clusterPruneThreshold.toFixed(2)}</span>
            </label>
            <input type="range" min={0} max={0.5} step={0.01} value={clusterPruneThreshold}
              onChange={e => setClusterPruneThreshold(parseFloat(e.target.value))} className="w-full mt-1" />
          </div>
          <div>
            <label className={labelCls}>
              {t('node_radius')}: <span className="tabular-nums">{clusterNodeRadius}</span>
            </label>
            <input type="range" min={8} max={40} value={clusterNodeRadius}
              onChange={e => setClusterNodeRadius(parseInt(e.target.value))} className="w-full mt-1" />
          </div>
          <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
            <input type="checkbox" checked={clusterShowSelfLoops}
              onChange={e => setClusterShowSelfLoops(e.target.checked)} className="rounded" />
            {t('show_self_loops')}
          </label>
          <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
            <input type="checkbox" checked={clusterShowEdgeLabels}
              onChange={e => setClusterShowEdgeLabels(e.target.checked)} className="rounded" />
            {t('show_edge_labels')}
          </label>
        </div>
      </div>

      {/* Pattern Settings */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
        <h3 className="text-base font-bold text-gray-900 dark:text-white mb-4">{t('pattern_settings')}</h3>
        <div className="space-y-4">
          <div>
            <label className={labelCls}>{t('pattern_lengths')} 2–3</label>
            <p className={descCls}>{t('pattern_short_desc')}</p>
            <div className="flex items-center gap-1 mt-2">
              {SHORT_LENGTHS.map(len => (
                <button key={len}
                  onClick={() => setShortLengths({ ...shortLengths, [len]: !shortLengths[len] })}
                  className={`w-8 h-8 rounded text-sm font-medium transition-colors ${
                    shortLengths[len]
                      ? 'bg-primary-600 text-white'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
                  }`}>
                  {len}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className={labelCls}>{t('pattern_lengths')} 4–7</label>
            <p className={descCls}>{t('pattern_long_desc')}</p>
            <div className="flex items-center gap-1 mt-2">
              {LONG_LENGTHS.map(len => (
                <button key={len}
                  onClick={() => setLongLengths({ ...longLengths, [len]: !longLengths[len] })}
                  className={`w-8 h-8 rounded text-sm font-medium transition-colors ${
                    longLengths[len]
                      ? 'bg-primary-600 text-white'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
                  }`}>
                  {len}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

    </div>

      {/* Interpretation Map (combined mode) */}
      {sequenceMode === 'combined' && rawVerbs.length > 0 && rawObjectTypes.length > 0 && (
        <InterpretationEditor
          t={t}
          rawVerbs={rawVerbs}
          rawObjectTypes={rawObjectTypes}
          interpretations={interpretations}
          setInterpretations={setInterpretations}
        />
      )}

      {/* Verb/State Editor — full width below */}
      {(sequenceMode === 'objectType' ? rawObjectTypes.length > 0 : sequenceMode === 'raw' ? rawCombinations.length > 0 : rawVerbs.length > 0) && (
        <VerbEditor
          t={t}
          rawVerbs={sequenceMode === 'objectType' ? rawObjectTypes : sequenceMode === 'raw' ? rawCombinations : rawVerbs}
          verbRenames={verbRenames}
          setVerbRenames={setVerbRenames}
          verbExcludes={verbExcludes}
          setVerbExcludes={setVerbExcludes}
          sequenceMode={sequenceMode}
          sequences={sequences}
        />
      )}

      {/* Preview modal — side-by-side network + frequency */}
      {previewOpen && sequences.length > 0 && (
        <PreviewModal
          sequences={sequences}
          modelType={modelType}
          pruneThreshold={pruneThreshold}
          palette={palette}
          onClose={() => setPreviewOpen(false)}
        />
      )}
    </div>
  );
};

/* ------------------------------------------------------------------ */
/*  Preview Modal (network + frequency side by side)                   */
/* ------------------------------------------------------------------ */

const PreviewModal = ({
  sequences,
  modelType,
  pruneThreshold,
  palette,
  onClose,
}: {
  sequences: string[][];
  modelType: ModelType;
  pruneThreshold: number;
  palette?: PaletteName;
  onClose: () => void;
}) => {
  const { t } = useTranslation(['admin']);

  useEscapeClose(true, onClose);

  const analysis = useMemo(() => {
    if (!sequences.length) return null;
    try {
      const labelSet = new Set<string>();
      for (const seq of sequences) for (const v of seq) labelSet.add(v);
      const labels = [...labelSet].sort();

      const builder = MODEL_BUILDERS[modelType];
      const rawModel = builder(sequences, { labels });
      const prunedM = prune(rawModel, pruneThreshold) as TNA;
      const colorMap = createColorMap(labels, palette);

      let cent: { labels: string[]; measures: Record<string, number[]> } | null = null;
      try {
        const raw = centralities(rawModel);
        const measures: Record<string, number[]> = {};
        for (const [k, v] of Object.entries(raw.measures)) {
          measures[k] = Array.from(v);
        }
        cent = { labels: raw.labels, measures };
      } catch { /* ignore */ }

      return { prunedModel: prunedM, labels, colorMap, centralityData: cent };
    } catch {
      return null;
    }
  }, [sequences, modelType, pruneThreshold, palette]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-[95vw] max-w-7xl max-h-[92vh] bg-white dark:bg-gray-800 rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">{t('preview')}</h2>
          <button onClick={onClose}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
            <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
          </button>
        </div>

        {/* Side-by-side content */}
        <div className="flex-1 overflow-auto p-4">
          {analysis ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 h-full">
              {/* Network graph */}
              <div className="bg-gray-50 dark:bg-gray-900/50 rounded-xl border border-gray-200 dark:border-gray-700 p-3 flex flex-col">
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">{t('network_title')}</h3>
                <div className="flex-1 flex items-center justify-center min-h-[400px]">
                  <TnaNetworkGraph
                    model={analysis.prunedModel}
                    showSelfLoops={false}
                    showEdgeLabels={true}
                    nodeRadius={25}
                    height={420}
                    colorMap={analysis.colorMap}
                    centralityData={analysis.centralityData ?? undefined}
                    modelType={modelType}
                  />
                </div>
              </div>

              {/* Frequency chart */}
              <div className="bg-gray-50 dark:bg-gray-900/50 rounded-xl border border-gray-200 dark:border-gray-700 p-3 flex flex-col">
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">{t('frequency_distribution')}</h3>
                <div className="flex-1 min-h-[400px]">
                  <TnaFrequencyChart
                    sequences={sequences}
                    labels={analysis.labels}
                    colorMap={analysis.colorMap}
                  />
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-64 text-gray-400 dark:text-gray-500 text-sm">
              {t('no_tna_data')}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

/* ------------------------------------------------------------------ */
/*  Verb Editor                                                        */
/* ------------------------------------------------------------------ */

const VerbEditor = ({
  t,
  rawVerbs,
  verbRenames,
  setVerbRenames,
  verbExcludes,
  setVerbExcludes,
  sequenceMode,
  sequences,
}: {
  t: (key: string) => string;
  rawVerbs: string[];
  verbRenames: Record<string, string>;
  setVerbRenames: (v: Record<string, string>) => void;
  verbExcludes: Record<string, boolean>;
  setVerbExcludes: (v: Record<string, boolean>) => void;
  sequenceMode: SequenceMode;
  sequences: string[][];
}) => {
  const [editingVerb, setEditingVerb] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedVerbs, setSelectedVerbs] = useState<Set<string>>(new Set());
  const [mergeDialogOpen, setMergeDialogOpen] = useState(false);
  const [mergeTargetName, setMergeTargetName] = useState('');
  const [showExcluded, setShowExcluded] = useState(false);
  const [sortBy, setSortBy] = useState<'frequency' | 'alpha'>('frequency');

  // Frequency map: count occurrences of each raw verb across all sequences
  const frequencyMap = useMemo(() => {
    const map: Record<string, number> = {};
    for (const seq of sequences) {
      for (const v of seq) {
        map[v] = (map[v] || 0) + 1;
      }
    }
    return map;
  }, [sequences]);

  const totalEvents = useMemo(() => Object.values(frequencyMap).reduce((a, b) => a + b, 0), [frequencyMap]);

  const activeVerbs = rawVerbs.filter(v => !verbExcludes[v]);
  const excludedVerbs = rawVerbs.filter(v => verbExcludes[v]);

  // Group by target name to show merges
  const mergeGroups = new Map<string, string[]>();
  for (const v of activeVerbs) {
    const target = verbRenames[v] || v;
    if (!mergeGroups.has(target)) mergeGroups.set(target, []);
    mergeGroups.get(target)!.push(v);
  }

  // Sort
  const sortedGroups = [...mergeGroups.entries()].sort((a, b) => {
    if (sortBy === 'alpha') return a[0].localeCompare(b[0]);
    const freqA = a[1].reduce((s, v) => s + (frequencyMap[v] || 0), 0);
    const freqB = b[1].reduce((s, v) => s + (frequencyMap[v] || 0), 0);
    return freqB - freqA;
  });

  // Filter by search
  const lq = searchQuery.toLowerCase();
  const filteredGroups = lq
    ? sortedGroups.filter(([target, sources]) =>
        target.toLowerCase().includes(lq) || sources.some(s => s.toLowerCase().includes(lq)))
    : sortedGroups;
  const filteredExcluded = lq
    ? excludedVerbs.filter(v => v.toLowerCase().includes(lq))
    : excludedVerbs;

  // Compute max frequency for bar widths
  const maxFreq = useMemo(() => {
    let mx = 1;
    for (const [, sources] of mergeGroups) {
      const f = sources.reduce((s, v) => s + (frequencyMap[v] || 0), 0);
      if (f > mx) mx = f;
    }
    return mx;
  }, [mergeGroups, frequencyMap]);

  // Mode-aware labels
  const modeKey = (obj: string, raw: string, combined: string, verb: string) =>
    sequenceMode === 'objectType' ? obj : sequenceMode === 'raw' ? raw : sequenceMode === 'combined' ? combined : verb;
  const editorTitle = t(modeKey('object_type_editor', 'raw_editor', 'state_editor', 'verb_editor'));
  const editorDesc = t(modeKey('object_type_editor_desc', 'raw_editor_desc', 'state_editor_desc', 'verb_editor_desc'));
  const activeLabel = t(modeKey('active_object_types', 'active_raw', 'active_states', 'active_verbs'));
  const excludedLabel = t(modeKey('excluded_object_types', 'excluded_raw', 'excluded_states', 'excluded_verbs'));

  const startRename = (verb: string) => {
    setEditingVerb(verb);
    setEditValue(verbRenames[verb] || verb);
  };

  const commitRename = () => {
    if (!editingVerb) return;
    const trimmed = editValue.trim();
    if (trimmed && trimmed !== editingVerb) {
      setVerbRenames({ ...verbRenames, [editingVerb]: trimmed });
    } else {
      const next = { ...verbRenames };
      delete next[editingVerb];
      setVerbRenames(next);
    }
    setEditingVerb(null);
  };

  const toggleExclude = (verb: string) => {
    setVerbExcludes({ ...verbExcludes, [verb]: !verbExcludes[verb] });
    setSelectedVerbs(prev => { const n = new Set(prev); n.delete(verb); return n; });
  };

  const resetAll = () => {
    setVerbRenames({});
    setVerbExcludes({});
    setSelectedVerbs(new Set());
  };

  const toggleSelect = (verb: string) => {
    setSelectedVerbs(prev => {
      const n = new Set(prev);
      if (n.has(verb)) n.delete(verb); else n.add(verb);
      return n;
    });
  };

  const selectAll = () => setSelectedVerbs(new Set(activeVerbs));
  const deselectAll = () => setSelectedVerbs(new Set());

  const bulkExclude = () => {
    const next = { ...verbExcludes };
    for (const v of selectedVerbs) next[v] = true;
    setVerbExcludes(next);
    setSelectedVerbs(new Set());
  };

  const openMergeDialog = () => {
    const selected = [...selectedVerbs];
    let best = selected[0];
    let bestFreq = 0;
    for (const v of selected) {
      const f = frequencyMap[v] || 0;
      if (f > bestFreq) { bestFreq = f; best = v; }
    }
    setMergeTargetName(verbRenames[best] || best);
    setMergeDialogOpen(true);
  };

  const executeMerge = () => {
    const trimmed = mergeTargetName.trim();
    if (!trimmed || selectedVerbs.size < 2) return;
    const next = { ...verbRenames };
    for (const v of selectedVerbs) {
      if (v !== trimmed) next[v] = trimmed;
      else delete next[v];
    }
    setVerbRenames(next);
    setSelectedVerbs(new Set());
    setMergeDialogOpen(false);
  };

  const unmerge = (_target: string, sources: string[]) => {
    const next = { ...verbRenames };
    for (const s of sources) delete next[s];
    setVerbRenames(next);
  };

  const hasEdits = Object.keys(verbRenames).length > 0 || Object.values(verbExcludes).some(Boolean);
  const allSelected = selectedVerbs.size > 0 && selectedVerbs.size === activeVerbs.length;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 mt-6">
      {/* ── Header ── */}
      <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
        <div className="min-w-0">
          <h3 className="text-base font-bold text-gray-900 dark:text-white">{editorTitle}</h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{editorDesc}</p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
            <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
              placeholder={t('search_items')}
              className="pl-8 pr-3 py-1.5 text-xs rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 w-52 outline-none focus:border-primary-400 dark:focus:border-primary-500 transition-colors" />
          </div>
          <select value={sortBy} onChange={e => setSortBy(e.target.value as 'frequency' | 'alpha')}
            className="px-2 py-1.5 text-xs rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 outline-none">
            <option value="frequency">{t('frequency')} ↓</option>
            <option value="alpha">A → Z</option>
          </select>
          {hasEdits && (
            <button onClick={resetAll}
              className="px-3 py-1.5 text-xs font-medium rounded-lg border border-red-300 dark:border-red-700 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
              {t('reset_all')}
            </button>
          )}
        </div>
      </div>

      {/* ── Bulk action bar ── */}
      {selectedVerbs.size > 0 && (
        <div className="flex flex-wrap items-center gap-2 mb-3 px-3 py-2 rounded-lg bg-primary-50 dark:bg-primary-900/20 border border-primary-200 dark:border-primary-800">
          <span className="text-xs font-semibold text-primary-700 dark:text-primary-300">
            {selectedVerbs.size} {t('items_selected')}
          </span>
          <div className="flex items-center gap-1.5 ml-auto">
            {selectedVerbs.size >= 2 && (
              <button onClick={openMergeDialog}
                className="px-3 py-1 text-xs font-medium rounded-md bg-primary-600 text-white hover:bg-primary-700 transition-colors">
                {t('merge_selected')} ({selectedVerbs.size})
              </button>
            )}
            <button onClick={bulkExclude}
              className="px-3 py-1 text-xs font-medium rounded-md bg-red-500 text-white hover:bg-red-600 transition-colors">
              {t('exclude_selected')} ({selectedVerbs.size})
            </button>
            <button onClick={deselectAll}
              className="px-3 py-1 text-xs font-medium rounded-md border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
              {t('clear_selection')}
            </button>
          </div>
        </div>
      )}

      {/* ── Active items table ── */}
      <div className="mb-2">
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide">
            {activeLabel} ({activeVerbs.length})
          </h4>
          <button onClick={allSelected ? deselectAll : selectAll}
            className="text-[10px] font-medium text-primary-600 dark:text-primary-400 hover:underline">
            {allSelected ? t('clear_selection') : t('select_all')}
          </button>
        </div>

        <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
          {/* Table header */}
          <div className="grid grid-cols-[28px_1fr_90px_32px] items-center px-3 py-1.5 bg-gray-50 dark:bg-gray-700/50 text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider border-b border-gray-200 dark:border-gray-700">
            <span />
            <span>{t('name')}</span>
            <span className="text-right">{t('frequency')}</span>
            <span />
          </div>

          {/* Rows */}
          <div className="max-h-80 overflow-y-auto divide-y divide-gray-100 dark:divide-gray-700/50">
            {filteredGroups.length === 0 && (
              <div className="px-3 py-4 text-xs text-center text-gray-400 dark:text-gray-500">
                {lq ? `No matches for "${searchQuery}"` : t('no_data')}
              </div>
            )}
            {filteredGroups.map(([target, sources]) => {
              const groupFreq = sources.reduce((s, v) => s + (frequencyMap[v] || 0), 0);
              const pct = totalEvents > 0 ? ((groupFreq / totalEvents) * 100) : 0;
              const barWidth = maxFreq > 0 ? ((groupFreq / maxFreq) * 100) : 0;
              const isSelected = sources.some(s => selectedVerbs.has(s));
              const isMerged = sources.length > 1;
              const isRenamed = sources.some(s => verbRenames[s]);
              const isEditing = editingVerb !== null && sources.includes(editingVerb);

              return (
                <div key={target}
                  className={`group grid grid-cols-[28px_1fr_90px_32px] items-center px-3 py-1.5 text-xs transition-colors cursor-pointer ${
                    isSelected
                      ? 'bg-primary-50 dark:bg-primary-900/15'
                      : 'hover:bg-gray-50 dark:hover:bg-gray-700/30'
                  }`}
                  onClick={() => sources.forEach(s => { if (!selectedVerbs.has(s)) toggleSelect(s); else toggleSelect(s); })}>
                  {/* Checkbox */}
                  <div onClick={e => e.stopPropagation()}>
                    <input type="checkbox" checked={isSelected}
                      onChange={() => sources.forEach(s => toggleSelect(s))}
                      className="w-3.5 h-3.5 rounded border-gray-300 dark:border-gray-600 text-primary-600 focus:ring-primary-500 cursor-pointer" />
                  </div>

                  {/* Name cell */}
                  <div className="flex items-center gap-1.5 min-w-0" onClick={e => e.stopPropagation()}>
                    {isEditing ? (
                      <input autoFocus value={editValue}
                        onChange={e => setEditValue(e.target.value)}
                        onBlur={commitRename}
                        onKeyDown={e => { if (e.key === 'Enter') commitRename(); if (e.key === 'Escape') setEditingVerb(null); }}
                        className="w-full max-w-[200px] px-2 py-0.5 text-xs rounded border border-primary-400 dark:border-primary-500 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 outline-none" />
                    ) : (
                      <>
                        <span className={`font-medium truncate ${isRenamed ? 'text-primary-700 dark:text-primary-300' : 'text-gray-800 dark:text-gray-200'}`}>
                          {target}
                        </span>
                        {isRenamed && !isMerged && (
                          <span className="text-[10px] text-gray-400 dark:text-gray-500 truncate">
                            ← {sources[0]}
                          </span>
                        )}
                        {isMerged && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-medium text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-900/30 rounded px-1.5 py-0.5 flex-shrink-0"
                            title={`${t('merged_from')}: ${sources.join(', ')}`}>
                            {sources.length} merged
                            <button onClick={() => unmerge(target, sources)}
                              className="hover:text-red-500 transition-colors ml-0.5" title="Unmerge">
                              <X className="w-2.5 h-2.5" />
                            </button>
                          </span>
                        )}
                        <button onClick={() => startRename(sources[0])}
                          className="opacity-0 group-hover:opacity-100 w-5 h-5 flex items-center justify-center text-gray-400 hover:text-primary-600 dark:hover:text-primary-400 transition-all flex-shrink-0"
                          title={t('click_to_rename')}>
                          <Pencil className="w-3 h-3" />
                        </button>
                      </>
                    )}
                  </div>

                  {/* Frequency cell */}
                  <div className="flex items-center gap-2 justify-end" onClick={e => e.stopPropagation()}>
                    <div className="w-14 h-1.5 rounded-full bg-gray-200 dark:bg-gray-600 overflow-hidden flex-shrink-0">
                      <div className="h-full rounded-full bg-primary-400 dark:bg-primary-500 transition-all"
                        style={{ width: `${barWidth}%` }} />
                    </div>
                    <span className="tabular-nums text-gray-600 dark:text-gray-400 w-16 text-right flex-shrink-0">
                      {groupFreq.toLocaleString()} <span className="text-gray-400 dark:text-gray-500">({pct.toFixed(1)}%)</span>
                    </span>
                  </div>

                  {/* Exclude button */}
                  <div className="flex justify-end" onClick={e => e.stopPropagation()}>
                    <button onClick={() => sources.forEach(s => toggleExclude(s))}
                      className="opacity-0 group-hover:opacity-100 w-5 h-5 flex items-center justify-center rounded text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 transition-all"
                      title={t('exclude_verb')}>
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Excluded items ── */}
      {excludedVerbs.length > 0 && (
        <div className="mt-4">
          <button onClick={() => setShowExcluded(!showExcluded)}
            className="flex items-center gap-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide hover:text-gray-700 dark:hover:text-gray-300 transition-colors mb-2">
            <span className={`transition-transform ${showExcluded ? 'rotate-90' : ''}`}>▶</span>
            {excludedLabel} ({excludedVerbs.length})
            {excludedVerbs.length > 1 && (
              <span onClick={e => {
                e.stopPropagation();
                const next = { ...verbExcludes };
                for (const v of excludedVerbs) delete next[v];
                setVerbExcludes(next);
              }}
                className="text-[10px] font-medium text-green-600 dark:text-green-400 hover:underline normal-case ml-2">
                {t('bulk_restore')}
              </span>
            )}
          </button>
          {showExcluded && (
            <div className="flex flex-wrap gap-1.5">
              {filteredExcluded.map(v => (
                <button key={v} onClick={() => toggleExclude(v)}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-md text-xs text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-gray-700/30 line-through hover:bg-green-50 dark:hover:bg-green-900/20 hover:text-green-600 dark:hover:text-green-400 hover:no-underline transition-colors"
                  title={t('restore_verb')}>
                  {v}
                  <span className="text-green-500 text-[10px] font-bold no-underline">+</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Merge dialog ── */}
      {mergeDialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={() => setMergeDialogOpen(false)}>
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 p-6 w-full max-w-md"
            onClick={e => e.stopPropagation()}>
            <h4 className="text-sm font-bold text-gray-900 dark:text-white mb-1">{t('merge_dialog_title')}</h4>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
              Combining {selectedVerbs.size} items into one label
            </p>
            <div className="flex flex-wrap gap-1.5 mb-4 max-h-24 overflow-y-auto">
              {[...selectedVerbs].map(v => (
                <span key={v} className="inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-md bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 border border-primary-200 dark:border-primary-800">
                  {v}
                  {frequencyMap[v] != null && <span className="text-primary-400 dark:text-primary-500 tabular-nums">({frequencyMap[v]})</span>}
                </span>
              ))}
            </div>
            <label className="text-xs font-medium text-gray-700 dark:text-gray-300">{t('merge_into')}</label>
            <input autoFocus value={mergeTargetName}
              onChange={e => setMergeTargetName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') executeMerge(); if (e.key === 'Escape') setMergeDialogOpen(false); }}
              className="w-full mt-1.5 mb-5 px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 outline-none focus:border-primary-400 focus:ring-1 focus:ring-primary-400" />
            <div className="flex justify-end gap-2">
              <button onClick={() => setMergeDialogOpen(false)}
                className="px-4 py-2 text-xs font-medium rounded-lg border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                Cancel
              </button>
              <button onClick={executeMerge} disabled={!mergeTargetName.trim()}
                className="px-4 py-2 text-xs font-medium rounded-lg bg-primary-600 text-white hover:bg-primary-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                {t('merge_confirm')} ({selectedVerbs.size} → 1)
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

/* ------------------------------------------------------------------ */
/*  Interpretation Editor (combined mode verb+objectType → label)       */
/* ------------------------------------------------------------------ */

const InterpretationEditor = ({
  t,
  rawVerbs,
  rawObjectTypes,
  interpretations,
  setInterpretations,
}: {
  t: (key: string) => string;
  rawVerbs: string[];
  rawObjectTypes: string[];
  interpretations: Record<string, string>;
  setInterpretations: (v: Record<string, string>) => void;
}) => {
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');

  // Build all possible verb:objectType combos
  const allKeys = rawVerbs.flatMap(v => rawObjectTypes.map(o => `${v}:${o}`));
  const mapped = allKeys.filter(k => resolveInterpretation(k, interpretations));
  const unmapped = allKeys.filter(k => !resolveInterpretation(k, interpretations));

  const startEdit = (key: string) => {
    setEditingKey(key);
    setEditValue(interpretations[key] ?? resolveInterpretation(key, interpretations) ?? key.replace(':', '_'));
  };

  const commitEdit = () => {
    if (!editingKey) return;
    const trimmed = editValue.trim();
    if (trimmed) {
      setInterpretations({ ...interpretations, [editingKey]: trimmed });
    } else {
      const next = { ...interpretations };
      delete next[editingKey];
      setInterpretations(next);
    }
    setEditingKey(null);
  };

  const removeMapping = (key: string) => {
    const next = { ...interpretations };
    delete next[key];
    setInterpretations(next);
  };

  const resetDefaults = () => setInterpretations({ ...DEFAULT_INTERPRETATIONS });

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-base font-bold text-gray-900 dark:text-white">{t('interpretation_map')}</h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{t('interpretation_map_desc')}</p>
        </div>
        <button onClick={resetDefaults}
          className="px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
          {t('reset_defaults')}
        </button>
      </div>

      {/* Mapped interpretations */}
      <div className="mb-4">
        <h4 className="text-xs font-semibold text-gray-600 dark:text-gray-400 mb-2 uppercase tracking-wide">
          {t('mapped_combinations')} ({mapped.length})
        </h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-1.5">
          {mapped.map(key => {
            const [verb, obj] = key.split(':');
            return (
              <div key={key} className="flex items-center gap-1.5 bg-gray-50 dark:bg-gray-700/50 rounded-lg px-2.5 py-1.5 text-xs">
                <span className="text-gray-500 dark:text-gray-400 truncate">
                  {verb}<span className="text-gray-300 dark:text-gray-600">:</span>{obj}
                </span>
                <span className="text-gray-400 dark:text-gray-500">&rarr;</span>
                {editingKey === key ? (
                  <input autoFocus value={editValue}
                    onChange={e => setEditValue(e.target.value)}
                    onBlur={commitEdit}
                    onKeyDown={e => { if (e.key === 'Enter') commitEdit(); if (e.key === 'Escape') setEditingKey(null); }}
                    className="flex-1 min-w-0 px-1.5 py-0.5 text-xs rounded border border-primary-400 dark:border-primary-500 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 outline-none" />
                ) : (
                  <button onClick={() => startEdit(key)}
                    className={`font-medium truncate ${interpretations[key] ? 'text-gray-800 dark:text-gray-200' : 'text-gray-500 dark:text-gray-400 italic'} hover:text-primary-600 dark:hover:text-primary-400`}>
                    {interpretations[key] ?? resolveInterpretation(key, interpretations)}
                  </button>
                )}
                <button onClick={() => removeMapping(key)}
                  className="ml-auto flex-shrink-0 w-4 h-4 flex items-center justify-center rounded-full text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30">
                  &times;
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Unmapped — click to add */}
      {unmapped.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold text-gray-600 dark:text-gray-400 mb-2 uppercase tracking-wide">
            {t('unmapped_combinations')} ({unmapped.length})
          </h4>
          <div className="flex flex-wrap gap-1.5">
            {unmapped.slice(0, 30).map(key => {
              const [verb, obj] = key.split(':');
              return editingKey === key ? (
                <div key={key} className="flex items-center gap-1 bg-primary-50 dark:bg-primary-900/20 rounded-lg px-2 py-1">
                  <span className="text-xs text-gray-500">{verb}:{obj} &rarr;</span>
                  <input autoFocus value={editValue}
                    onChange={e => setEditValue(e.target.value)}
                    onBlur={commitEdit}
                    onKeyDown={e => { if (e.key === 'Enter') commitEdit(); if (e.key === 'Escape') setEditingKey(null); }}
                    className="w-24 px-1.5 py-0.5 text-xs rounded border border-primary-400 dark:border-primary-500 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 outline-none" />
                </div>
              ) : (
                <button key={key} onClick={() => startEdit(key)}
                  className="px-2 py-1 rounded-lg text-xs text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-gray-700/30 hover:bg-primary-50 dark:hover:bg-primary-900/20 hover:text-primary-600 dark:hover:text-primary-400 transition-colors">
                  {verb}:{obj}
                </button>
              );
            })}
            {unmapped.length > 30 && (
              <span className="text-xs text-gray-400 self-center">+{unmapped.length - 30} {t('remaining')}</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
