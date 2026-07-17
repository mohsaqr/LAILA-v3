import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { useParams, Link, useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { Breadcrumb } from '../components/common/Breadcrumb';
import {
  RefreshCw,
  Loader2,
  AlertTriangle,
  ArrowLeft,
  Send,
  Camera,
  CheckCircle,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import { customLabsApi } from '../api/customLabs';
import { assignmentsApi } from '../api/assignments';
import { LabAssignmentPanel } from '../components/labs';
import { ReportItem } from '../components/labs/LabAssignmentPanel';
import { Button } from '../components/common/Button';
import { Card, CardBody } from '../components/common/Card';
import { Loading } from '../components/common/Loading';
import { useLabWebR } from '../hooks/useLabWebR';
import { useLabPyodide } from '../hooks/useLabPyodide';
import { useTheme } from '../hooks/useTheme';
import { LabTemplate } from '../types';
import { isPythonLab } from '../utils/labType';
import { useAuthStore } from '../store/authStore';
import { LabNotebook } from '../components/labs/notebook/LabNotebook';
import { LabSettingsHeader } from '../components/labs/notebook/LabSettingsHeader';
import { LabAIPanel, AICellContext } from '../components/labs/notebook/LabAIPanel';
import { templateToCell, cellPatchToTemplate, LabCellPatch, LabCell } from '../components/labs/authoring/cell';
import { detectRPackages } from '../utils/detectRPackages';
import type { OutputItem as NotebookOutputItem } from '../components/labs/LabOutput';
import { activityLogger } from '../services/activityLogger';
import { useTracker } from '../services/tracker';

// Module-level set to prevent duplicate logs (survives React strict mode remount)
const _loggedLabIds = new Set<number>();

interface OutputItem {
  type: 'stdout' | 'stderr' | 'plot' | 'message';
  content: string;
}

interface LabHookResult {
  isReady: boolean;
  isLoading: boolean;
  isExecuting: boolean;
  isInstallingPackages: boolean;
  packagesInstalled: boolean;
  /** Requested packages with no webR binary (R labs only). */
  failedPackages?: string[];
  loadingStatus: string;
  error: string | null;
  executeCode: (code: string) => Promise<{ success: boolean; outputs: OutputItem[]; error?: string }>;
  reset: () => Promise<void>;
}

// Re-exported for existing consumers; the predicate itself now lives in utils
// so authoring pages can use it without pulling in the webR/Pyodide runtime.
export { isPythonLab };

// Shared lab runner UI — receives hook result as props
export const LabRunnerUI = ({ lab, hook, courseId, hideSubmit, openPanel, onPanelClose }: { lab: any; hook: LabHookResult; courseId: number | null; hideSubmit?: boolean; openPanel?: boolean; onPanelClose?: () => void }) => {
  const { t } = useTranslation(['courses', 'common']);
  const { isDark } = useTheme();
  const track = useTracker('lab');
  const queryClient = useQueryClient();
  const labContentRef = useRef<HTMLDivElement>(null);
  const outputAreaRef = useRef<HTMLDivElement>(null);
  const [assignmentPanelOpen, setAssignmentPanelOpen] = useState(false);
  const [reportItems, setReportItems] = useState<ReportItem[]>([]);
  const [isCapturing, setIsCapturing] = useState(false);
  const [sessionEvents, setSessionEvents] = useState<Array<{ ts: number; event: string }>>([]);
  const [visitedTemplates, setVisitedTemplates] = useState<string[]>([]);

  // Open panel when parent triggers resubmit
  useEffect(() => {
    if (openPanel) setAssignmentPanelOpen(true);
  }, [openPanel]);

  const logSession = useCallback((event: string) =>
    setSessionEvents(prev => [...prev, { ts: Date.now(), event }]), []);

  const { data: assignmentConfig } = useQuery({
    queryKey: ['labAssignmentConfig', lab.id, courseId],
    queryFn: () => customLabsApi.getLabAssignmentConfig(lab.id, courseId!),
    enabled: courseId != null,
  });

  const assignmentId = assignmentConfig?.assignment?.id;
  const { data: existingSubmission } = useQuery({
    queryKey: ['mySubmission', assignmentId],
    queryFn: () => assignmentsApi.getMySubmission(assignmentId!),
    enabled: !!assignmentId,
    retry: false,
  });
  const hasSubmitted = existingSubmission?.status === 'submitted';

  /** Last cell the user ran — drives report capture and submission context. */
  const [lastRun, setLastRun] = useState<{ cellId: number; title: string; code: string } | null>(null);
  const [hasAnyOutput, setHasAnyOutput] = useState(false);

  // ─── In-place authoring (owner / admin only) ────────────────────────────
  // Subscribing to user AND viewAsRole keeps this reactive: switching to
  // "view as student" must strip author powers, including on your own lab.
  const currentUser = useAuthStore(s => s.user);
  useAuthStore(s => s.viewAsRole);
  const { isAdmin, isInstructor } = useAuthStore(s => s.getEffectiveRole)();
  const canEditLab =
    !!currentUser && (isAdmin || (isInstructor && lab.createdBy === currentUser.id));

  const sortedTemplates: LabTemplate[] = [...(lab.templates ?? [])].sort(
    (a: LabTemplate, b: LabTemplate) => a.orderIndex - b.orderIndex
  );
  const notebookCells: LabCell[] = sortedTemplates.map(templateToCell);

  // AI assistant (attached per lab by the instructor)
  const [aiOpen, setAiOpen] = useState(false);
  const [aiContext, setAiContext] = useState<AICellContext | null>(null);

  // The lab query is keyed by the raw string route param (['lab', '20']), so a
  // number key here would never match and the list would silently not refresh.
  // Matching on the prefix covers both callers regardless of id type.
  const invalidateLab = () => {
    queryClient.invalidateQueries({ queryKey: ['lab'] });
    queryClient.invalidateQueries({ queryKey: ['myLabs'] });
  };

  const addTemplateMutation = useMutation({
    // The server inserts at the position atomically — no client-side reorder,
    // no race against a stale template snapshot.
    mutationFn: ({ position, cellType }: { position: number; cellType: 'code' | 'markdown' }) =>
      customLabsApi.addTemplate(lab.id, {
        title: cellType === 'markdown' ? 'Text' : 'New cell',
        description: cellType === 'markdown' ? 'Write your content here…' : '',
        code: cellType === 'markdown'
          ? ''
          : isPythonLab(lab.labType) ? '# Enter Python code here\n' : '# Enter R code here\n',
        position,
        cellType,
      }),
    onSuccess: () => {
      invalidateLab();
      toast.success('Cell added');
    },
    onError: (e: Error) => toast.error(e.message || 'Failed to add cell'),
  });

  const importMutation = useMutation({
    mutationFn: (content: string) => customLabsApi.importRmd(lab.id, content),
    onSuccess: () => {
      invalidateLab();
      toast.success(t('teaching:rmd_cells_imported', { defaultValue: 'Imported cells from the file' }));
    },
    onError: (e: Error) =>
      toast.error(e.message || t('teaching:rmd_import_failed', { defaultValue: 'Failed to import R Markdown' })),
  });

  const updateTemplateMutation = useMutation({
    mutationFn: ({ templateId, patch }: { templateId: number; patch: LabCellPatch }) =>
      customLabsApi.updateTemplate(lab.id, templateId, cellPatchToTemplate(patch)),
    onSuccess: () => {
      invalidateLab();
      toast.success('Cell saved');
    },
    onError: (e: Error) => toast.error(e.message || 'Failed to save cell'),
  });

  const duplicateTemplateMutation = useMutation({
    mutationFn: (templateId: number) => {
      const source = sortedTemplates.find((t: LabTemplate) => t.id === templateId);
      if (!source) throw new Error('Cell not found');
      const at = sortedTemplates.findIndex((t: LabTemplate) => t.id === templateId);
      return customLabsApi.addTemplate(lab.id, {
        title: `${source.title} (copy)`,
        description: source.description ?? '',
        code: source.code,
        locked: source.locked ?? false,
        cellType: source.cellType ?? 'code',
        position: at + 1,
      });
    },
    onSuccess: () => {
      invalidateLab();
      toast.success('Cell duplicated');
    },
    onError: (e: Error) => toast.error(e.message || 'Failed to duplicate cell'),
  });

  const deleteTemplateMutation = useMutation({
    mutationFn: (templateId: number) => customLabsApi.deleteTemplate(lab.id, templateId),
    onSuccess: () => {
      invalidateLab();
      toast.success('Cell deleted');
    },
    onError: (e: Error) => toast.error(e.message || 'Failed to delete cell'),
  });

  const reorderTemplatesMutation = useMutation({
    mutationFn: (ids: number[]) => customLabsApi.reorderTemplates(lab.id, ids),
    onSuccess: invalidateLab,
    onError: (e: Error) => toast.error(e.message || 'Failed to reorder'),
  });

  const {
    isReady,
    isLoading: runtimeLoading,
    isExecuting,
    isInstallingPackages,
    packagesInstalled,
    loadingStatus,
    error: runtimeError,
    executeCode,
    reset: resetRuntime,
  } = hook;

  const colors = {
    bg: isDark ? '#111827' : '#f3f4f6',
    cardBg: isDark ? '#1f2937' : '#ffffff',
    border: isDark ? '#374151' : '#e5e7eb',
    textPrimary: isDark ? '#f3f4f6' : '#111827',
    textSecondary: isDark ? '#9ca3af' : '#6b7280',
  };

  // Log lab viewed when lab loads (module-level set survives strict mode remount)
  useEffect(() => {
    if (_loggedLabIds.has(lab.id)) return;
    _loggedLabIds.add(lab.id);
    activityLogger.log({
      verb: 'viewed',
      objectType: 'lab',
      objectId: lab.id,
      objectTitle: lab.name,
      courseId: courseId ?? undefined,
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lab.id]);

  // Reset state when lab changes (e.g. navigating between labs)
  useEffect(() => {
    setLastRun(null);
    setHasAnyOutput(false);
    setAiOpen(false);
    setAiContext(null);
    setReportItems([]);
    setSessionEvents([]);
    setVisitedTemplates([]);
    setAssignmentPanelOpen(false);
    // _loggedLabIds is not reset — re-viewing same lab in same session won't re-log
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lab.id]);

  const handleResetSession = useCallback(async () => {
    track('session_reset', { verb: 'interacted', objectType: 'lab', courseId: courseId ?? undefined });
    setLastRun(null);
    setHasAnyOutput(false);
    await resetRuntime();
  }, [resetRuntime, track, courseId]);

  // Bookkeeping after each notebook cell run: activity log + submission context.
  const handleCellRun = useCallback(
    (cell: LabCell, cellCode: string, result: { success: boolean; outputs: NotebookOutputItem[] }) => {
      logSession('Code executed: ' + cell.title);
      setVisitedTemplates(prev => [...new Set([...prev, cell.title])]);
      setLastRun({ cellId: cell.id, title: cell.title, code: cellCode });
      if (result.outputs.length > 0) setHasAnyOutput(true);
      track('code_executed', { verb: 'interacted', objectType: 'lab', objectId: lab.id, objectTitle: `${lab.name}: code executed`, courseId: courseId ?? undefined, success: result.success, payload: { templateTitle: cell.title, codeLength: cellCode.length, outputCount: result.outputs.length } });
    },
    [logSession, lab.id, lab.name, courseId, track]
  );

  const handleAskAI = useCallback(
    (cell: LabCell, cellCode: string, error: string | null, output?: string) => {
      setAiContext({ cell, code: cellCode, error, output });
      setAiOpen(true);
    },
    []
  );

  // Referential stability matters: NotebookCell is memoized, and a fresh
  // runtime object every render would defeat it via runOne's deps.
  const notebookRuntime = useMemo(
    // Not "ready" to run until package installation finishes, so the first
    // library() cell can't race the installer.
    () => ({
      isReady: isReady && !isInstallingPackages,
      isExecuting: isExecuting || isInstallingPackages,
      executeCode,
      reset: handleResetSession,
    }),
    [isReady, isInstallingPackages, isExecuting, executeCode, handleResetSession]
  );

  const handleAddToReport = useCallback(async () => {
    // Capture just the output of the last-run cell — a full-notebook screenshot
    // is oversized and mislabelled.
    const el = lastRun
      ? outputAreaRef.current?.querySelector<HTMLElement>(`[data-cell-output="${lastRun.cellId}"]`) ??
        outputAreaRef.current
      : outputAreaRef.current;
    if (!el || isCapturing) return;
    setIsCapturing(true);
    try {
      const { default: html2canvas } = await import('html2canvas');
      const canvas = await html2canvas(el, {
        scale: 1.2, useCORS: true, allowTaint: true,
        width: el.scrollWidth, height: el.scrollHeight,
        scrollX: 0, scrollY: 0,
      });
      const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
      const now = Date.now();
      const label = lastRun?.title || 'Code Output';
      const capturedCode = lastRun?.code ?? '';
      // Use code content as key so same code recaptures (overwrites), different code adds new entry
      const key = `${label}-${capturedCode.trim()}`;
      setReportItems(prev => {
        const filtered = prev.filter(r => r.key !== key);
        return [...filtered, { key, label, dataUrl, timestamp: now, code: capturedCode }];
      });
      logSession('Snapshot added: ' + label);
      track('report_captured', { verb: 'interacted', objectType: 'lab', courseId: courseId ?? undefined });
      toast.success('Added to report!');
    } catch (err) {
      console.error(err);
      toast.error('Failed to capture snapshot');
    } finally {
      setIsCapturing(false);
    }
  }, [lastRun, isCapturing, logSession, track, courseId]);

  const getLoadingMessage = () => {
    if (isPythonLab(lab.labType)) {
      if (isInstallingPackages) return 'Installing Python packages (numpy, pandas, matplotlib)...';
      return 'Setting up the Python environment...';
    }
    if (lab.labType === 'tna') return 'Installing TNA packages may take a moment on first load...';
    if (lab.labType === 'sna') return 'Installing igraph for Social Network Analysis...';
    return 'Setting up the R environment...';
  };

  const langLabel = isPythonLab(lab.labType) ? 'Python' : 'R';

  return (
    <div className="min-h-screen" style={{ backgroundColor: colors.bg }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 md:py-8">
        {/* Breadcrumb */}
        <div className="mb-6">
          <Breadcrumb
            items={
              courseId
                ? [
                    { label: t('common:courses'), href: '/courses' },
                    { label: lab.name },
                  ]
                : [
                    { label: t('labs'), href: '/labs' },
                    { label: lab.name },
                  ]
            }
          />
        </div>

        {/* Loading State */}
        {runtimeLoading && (
          <Card className="mb-6">
            <CardBody>
              <div className="flex items-center gap-4">
                <Loader2 className="w-6 h-6 animate-spin text-emerald-500" />
                <div>
                  <p className="font-medium" style={{ color: colors.textPrimary }}>
                    {loadingStatus}
                  </p>
                  <p className="text-sm" style={{ color: colors.textSecondary }}>
                    {isInstallingPackages ? getLoadingMessage() : `Initializing ${langLabel}...`}
                  </p>
                </div>
              </div>

              <div className="mt-4 h-2 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-emerald-500 to-teal-500 transition-all duration-500"
                  style={{
                    width: packagesInstalled ? '100%' : isInstallingPackages ? '60%' : '20%',
                  }}
                />
              </div>
            </CardBody>
          </Card>
        )}

        {/* Error State */}
        {runtimeError && !runtimeLoading && (
          <Card className="mb-6">
            <CardBody>
              <div className="flex items-start gap-4">
                <AlertTriangle className="w-6 h-6 text-red-500 flex-shrink-0" />
                <div>
                  <p className="font-medium text-red-600">Failed to Initialize {langLabel} Environment</p>
                  <p className="text-sm mt-1" style={{ color: colors.textSecondary }}>
                    {runtimeError}
                  </p>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={handleResetSession}
                    className="mt-3"
                    icon={<RefreshCw className="w-4 h-4" />}
                  >
                    Try Again
                  </Button>
                </div>
              </div>
            </CardBody>
          </Card>
        )}

        {/* Lab identity + settings, on the page itself */}
        <LabSettingsHeader lab={lab} canEdit={canEditLab} />

        {/* Packages the notebook asked for that webR has no binary for. */}
        {hook.failedPackages && hook.failedPackages.length > 0 && (
          <div className="mb-4 rounded-lg border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 px-4 py-3 text-sm text-amber-800 dark:text-amber-200">
            {t('courses:packages_unavailable', {
              defaultValue:
                "These packages aren't available in the browser R and couldn't be installed: {{list}}. Cells that use them may error.",
              list: hook.failedPackages.join(', '),
            })}
          </div>
        )}

        {/* Notebook — the single unified lab surface */}
        <div ref={labContentRef}>
          <div ref={outputAreaRef}>
            <LabNotebook
              key={lab.id}
              cells={notebookCells}
              language={isPythonLab(lab.labType) ? 'python' : 'r'}
              canEdit={canEditLab}
              runtime={notebookRuntime}
              runtimeStatus={loadingStatus}
              onSaveCell={(cellId, patch) =>
                updateTemplateMutation.mutate({ templateId: cellId, patch })
              }
              onAddCell={(position, cellType) => addTemplateMutation.mutate({ position, cellType })}
              onImport={isPythonLab(lab.labType) ? undefined : content => importMutation.mutate(content)}
              isImporting={importMutation.isPending}
              onDuplicateCell={cell => duplicateTemplateMutation.mutate(cell.id)}
              onDeleteCell={cell => deleteTemplateMutation.mutate(cell.id)}
              onReorder={ids => reorderTemplatesMutation.mutate(ids)}
              onCellRun={handleCellRun}
              onAskAI={lab.aiChatbotId ? handleAskAI : undefined}
              isMutating={
                addTemplateMutation.isPending ||
                duplicateTemplateMutation.isPending ||
                deleteTemplateMutation.isPending ||
                reorderTemplatesMutation.isPending
              }
            />
          </div>

          {/* Add to Report (only when lab is linked to an assignment) */}
          {hasAnyOutput && assignmentConfig?.assignment && (() => {
            const currentKey = `${lastRun?.title || 'Code Output'}-${(lastRun?.code ?? '').trim()}`;
            const isCaptured = reportItems.some(r => r.key === currentKey);
            return (
              <button
                onClick={handleAddToReport}
                disabled={isCapturing || !lastRun}
                className={`mt-4 w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl border-2 text-sm font-semibold transition-all ${
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
                  : `Add this output to report${reportItems.length > 0 ? ` (${reportItems.length})` : ''}`}
              </button>
            );
          })()}
        </div>
      </div>

      {lab.aiChatbotId != null && (
        <LabAIPanel
          chatbotId={lab.aiChatbotId}
          labName={lab.name}
          language={isPythonLab(lab.labType) ? 'python' : 'r'}
          cellContext={aiContext}
          isOpen={aiOpen}
          onClose={() => setAiOpen(false)}
        />
      )}

      {assignmentConfig?.assignment && !hideSubmit && !hasSubmitted && (
        <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 pb-6 flex justify-end">
          <Button
            variant="primary"
            onClick={() => { track('assignment_panel_opened', { verb: 'interacted', objectType: 'lab', courseId: courseId ?? undefined }); setAssignmentPanelOpen(true); }}
            icon={<Send className="w-4 h-4" />}
          >
            {t('submit_assignment', { defaultValue: 'Submit Assignment' })}
          </Button>
        </div>
      )}

      {assignmentConfig?.assignment && !hideSubmit && (
        <LabAssignmentPanel
          isOpen={assignmentPanelOpen}
          onClose={() => { setAssignmentPanelOpen(false); onPanelClose?.(); }}
          assignment={assignmentConfig.assignment}
          labContentRef={labContentRef}
          labId={lab.id}
          courseId={courseId ?? 0}
          hasActiveAnalysis={hasAnyOutput}
          activeAnalysisKey={lastRun?.title || 'Code Output'}
          visitedAnalyses={visitedTemplates}
          sessionConfig={{
            labType: isPythonLab(lab.labType) ? 'python' : 'r',
            datasetName: lastRun?.title || lab.name,
          }}
          sessionEvents={sessionEvents}
          reportItems={reportItems}
          onRemoveReportItem={(key) => setReportItems(prev => prev.filter(i => i.key !== key))}
          courseNumericId={courseId ?? 0}
          assignmentId={assignmentConfig.assignment.id}
          courseName={assignmentConfig.course?.title}
          code={lastRun?.code ?? ''}
          onSubmitted={() => {
            setAssignmentPanelOpen(false);
            queryClient.invalidateQueries({ queryKey: ['mySubmission', assignmentConfig!.assignment!.id] });
            queryClient.invalidateQueries({ queryKey: ['labAssignmentConfig', lab.id, courseId] });
          }}
        />
      )}

    </div>
  );
};

// Wrapper that uses WebR hook
const RLabRunnerContent = ({ lab }: { lab: any }) => {
  const [searchParams] = useSearchParams();
  const courseId = searchParams.get('courseId');
  // Install exactly the packages this notebook loads, on top of the lab-type
  // base set — so imported notebooks get their dependencies automatically.
  const detectedPackages = useMemo(
    () => detectRPackages((lab.templates ?? []).map((t: any) => t.code ?? '')),
    [lab.templates]
  );
  const hook = useLabWebR(lab.labType, detectedPackages);
  return <LabRunnerUI lab={lab} hook={hook} courseId={courseId ? Number(courseId) : null} />;
};

// Wrapper that uses Pyodide hook
const PythonLabRunnerContent = ({ lab }: { lab: any }) => {
  const [searchParams] = useSearchParams();
  const courseId = searchParams.get('courseId');
  const hook = useLabPyodide(lab.labType);
  return <LabRunnerUI lab={lab} hook={hook} courseId={courseId ? Number(courseId) : null} />;
};

export const LabRunner = () => {
  const { t } = useTranslation(['courses', 'common']);
  const { id } = useParams<{ id: string }>();
  const { isDark } = useTheme();

  const { data: lab, isLoading: labLoading } = useQuery({
    queryKey: ['lab', id],
    queryFn: () => customLabsApi.getLabById(Number(id)),
    enabled: !!id,
  });

  const colors = {
    bg: isDark ? '#111827' : '#f3f4f6',
    textPrimary: isDark ? '#f3f4f6' : '#111827',
    textSecondary: isDark ? '#9ca3af' : '#6b7280',
  };

  if (labLoading) {
    return <Loading text={t('loading_labs')} />;
  }

  if (!lab) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: colors.bg }}>
        <Card>
          <CardBody className="text-center py-12 px-8">
            <AlertTriangle className="w-16 h-16 mx-auto mb-4 text-amber-500" />
            <h2 className="text-xl font-semibold mb-2" style={{ color: colors.textPrimary }}>
              {t('lab_not_found')}
            </h2>
            <p className="mb-6" style={{ color: colors.textSecondary }}>
              {t('lab_not_found_description')}
            </p>
            <Link to="/labs">
              <Button icon={<ArrowLeft className="w-4 h-4" />}>{t('back_to_labs')}</Button>
            </Link>
          </CardBody>
        </Card>
      </div>
    );
  }

  // Dispatch to the right runtime
  if (isPythonLab(lab.labType)) {
    return <PythonLabRunnerContent lab={lab} />;
  }
  return <RLabRunnerContent lab={lab} />;
};
