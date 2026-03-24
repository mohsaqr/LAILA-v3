import { useState, useCallback, useEffect, useRef } from 'react';
import { useParams, Link, useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Breadcrumb } from '../components/common/Breadcrumb';
import {
  FlaskConical,
  RefreshCw,
  HelpCircle,
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
import { LabCodeEditor, LabOutput, LabTemplates, LabAssignmentPanel } from '../components/labs';
import { ReportItem } from '../components/labs/LabAssignmentPanel';
import { Button } from '../components/common/Button';
import { Card, CardBody } from '../components/common/Card';
import { Loading } from '../components/common/Loading';
import { useLabWebR } from '../hooks/useLabWebR';
import { useLabPyodide } from '../hooks/useLabPyodide';
import { useTheme } from '../hooks/useTheme';
import { LabTemplate } from '../types';
import { activityLogger } from '../services/activityLogger';

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
  loadingStatus: string;
  error: string | null;
  executeCode: (code: string) => Promise<{ success: boolean; outputs: OutputItem[]; error?: string }>;
  reset: () => Promise<void>;
}

export const isPythonLab = (labType: string) => labType.startsWith('python');

// Shared lab runner UI — receives hook result as props
export const LabRunnerUI = ({ lab, hook, courseId, hideSubmit }: { lab: any; hook: LabHookResult; courseId: number | null; hideSubmit?: boolean }) => {
  const { t } = useTranslation(['courses', 'common']);
  const { isDark } = useTheme();
  const queryClient = useQueryClient();
  const labContentRef = useRef<HTMLDivElement>(null);
  const outputAreaRef = useRef<HTMLDivElement>(null);
  const [assignmentPanelOpen, setAssignmentPanelOpen] = useState(false);
  const [reportItems, setReportItems] = useState<ReportItem[]>([]);
  const [isCapturing, setIsCapturing] = useState(false);
  const [sessionEvents, setSessionEvents] = useState<Array<{ ts: number; event: string }>>([]);
  const [visitedTemplates, setVisitedTemplates] = useState<string[]>([]);

  const logSession = useCallback((event: string) =>
    setSessionEvents(prev => [...prev, { ts: Date.now(), event }]), []);

  const { data: assignmentConfig } = useQuery({
    queryKey: ['labAssignmentConfig', lab.id, courseId],
    queryFn: () => customLabsApi.getLabAssignmentConfig(lab.id, courseId!),
    enabled: courseId != null,
  });

  const defaultCode = isPythonLab(lab.labType)
    ? '# Enter your Python code here\n'
    : '# Enter your R code here\n';

  const [code, setCode] = useState(defaultCode);
  const [outputs, setOutputs] = useState<OutputItem[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<number | null>(null);
  const selectedTemplate = (lab.templates ?? []).find((t: LabTemplate) => t.id === selectedTemplateId) ?? null;

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

  // Log lab viewed/started when lab loads
  const hasLoggedStartRef = useRef(false);
  useEffect(() => {
    if (hasLoggedStartRef.current) return;
    hasLoggedStartRef.current = true;
    activityLogger.log({
      verb: 'started',
      objectType: 'lab',
      objectId: lab.id,
      objectTitle: lab.name,
      courseId: courseId ?? undefined,
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lab.id]);

  // Reset state when lab changes (e.g. navigating between labs)
  useEffect(() => {
    setCode(defaultCode);
    setOutputs([]);
    setSelectedTemplateId(null);
    setReportItems([]);
    setSessionEvents([]);
    setVisitedTemplates([]);
    setAssignmentPanelOpen(false);
    hasLoggedStartRef.current = false;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lab.id]);

  // Auto-select first template on load
  useEffect(() => {
    const templates = lab.templates;
    if (templates && templates.length > 0 && selectedTemplateId === null) {
      const first = [...templates].sort((a, b) => a.orderIndex - b.orderIndex)[0];
      setCode(first.code);
      setSelectedTemplateId(first.id);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lab.templates]);

  const handleSelectTemplate = useCallback((template: LabTemplate) => {
    setCode(template.code);
    setSelectedTemplateId(template.id);
    setOutputs([]);
    logSession('Template selected: ' + template.title);
    activityLogger.log({
      verb: 'selected',
      objectType: 'lab',
      objectId: lab.id,
      objectTitle: `${lab.name}: ${template.title}`,
      courseId: courseId ?? undefined,
      extensions: { templateId: template.id, templateTitle: template.title },
    });
  }, [logSession, lab.id, lab.name, courseId]);

  const handleRunCode = useCallback(async () => {
    if (!isReady || isExecuting) return;
    const templateTitle = selectedTemplate?.title || 'Code';
    logSession('Code executed: ' + templateTitle);
    setVisitedTemplates(prev => [...new Set([...prev, templateTitle])]);
    const result = await executeCode(code);
    if (result.success) {
      setOutputs(result.outputs);
    } else {
      setOutputs([
        ...result.outputs,
        ...(result.error ? [{ type: 'stderr' as const, content: result.error }] : []),
      ]);
    }
    // Log code execution
    activityLogger.log({
      verb: 'interacted',
      objectType: 'lab',
      objectId: lab.id,
      objectTitle: `${lab.name}: code executed`,
      courseId: courseId ?? undefined,
      success: result.success,
      extensions: { templateTitle, codeLength: code.length, outputCount: result.outputs.length },
    });
  }, [code, isReady, isExecuting, executeCode, selectedTemplate, logSession, lab.id, lab.name, courseId]);

  const handleResetSession = useCallback(async () => {
    setOutputs([]);
    await resetRuntime();
  }, [resetRuntime]);

  const handleClearOutputs = useCallback(() => {
    setOutputs([]);
  }, []);

  const handleAddToReport = useCallback(async () => {
    const el = outputAreaRef.current;
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
      const label = selectedTemplate?.title || 'Code Output';
      // Use code content as key so same code recaptures (overwrites), different code adds new entry
      const key = `${label}-${(code || '').trim()}`;
      setReportItems(prev => {
        const filtered = prev.filter(r => r.key !== key);
        return [...filtered, { key, label, dataUrl, timestamp: now, code }];
      });
      logSession('Snapshot added: ' + label);
      toast.success('Added to report!');
    } catch (err) {
      console.error(err);
      toast.error('Failed to capture snapshot');
    } finally {
      setIsCapturing(false);
    }
  }, [selectedTemplate, isCapturing, logSession, code]);

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
      <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Breadcrumb */}
        <div className="mb-4">
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

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-r from-emerald-500 to-teal-600 flex items-center justify-center">
              <FlaskConical className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold" style={{ color: colors.textPrimary }}>
                {lab.name}
              </h1>
              {lab.description && (
                <p className="text-sm" style={{ color: colors.textSecondary }}>
                  {lab.description}
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 text-sm">
              <span
                className={`w-2 h-2 rounded-full ${
                  isReady
                    ? 'bg-emerald-500'
                    : runtimeLoading
                    ? 'bg-amber-500 animate-pulse'
                    : 'bg-red-500'
                }`}
              />
              <span style={{ color: colors.textSecondary }}>
                {isReady
                  ? `${langLabel} ready`
                  : runtimeLoading
                  ? loadingStatus
                  : runtimeError || `${langLabel} error`}
              </span>
            </div>

            <Button
              variant="secondary"
              size="sm"
              onClick={handleResetSession}
              disabled={runtimeLoading}
              icon={<RefreshCw className="w-4 h-4" />}
            >
              {t('reset_session')}
            </Button>

            <Button
              variant="ghost"
              size="sm"
              icon={<HelpCircle className="w-4 h-4" />}
            >
              {t('common:help')}
            </Button>

          </div>
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

        {/* Main Content */}
        <div className="grid lg:grid-cols-4 gap-6" ref={labContentRef}>
          <div className="lg:col-span-1">
            <LabTemplates
              templates={lab.templates || []}
              selectedTemplateId={selectedTemplateId}
              onSelectTemplate={handleSelectTemplate}
            />

            <Card className="mt-6">
              <CardBody className="p-4">
                <h3 className="font-medium mb-3" style={{ color: colors.textPrimary }}>
                  {t('lab_tips')}
                </h3>
                <ul className="text-sm space-y-2" style={{ color: colors.textSecondary }}>
                  <li>- Press <kbd className="px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-xs font-mono">Ctrl+Enter</kbd> to run code</li>
                  <li>- Click a template to load it into the editor</li>
                  <li>- Plots will appear in the output section</li>
                  <li>- Variables persist between runs</li>
                  <li>- Use Reset Session to clear all state</li>
                </ul>
              </CardBody>
            </Card>
          </div>

          <div className="lg:col-span-3 space-y-6">
            {selectedTemplate?.description && (
              <div
                className="rounded-lg border p-5"
                style={{ backgroundColor: colors.cardBg, borderColor: colors.border }}
              >
                <h2 className="text-base font-semibold mb-3" style={{ color: colors.textPrimary }}>
                  {selectedTemplate.title}
                </h2>
                <div
                  className="text-sm leading-relaxed whitespace-pre-line"
                  style={{ color: colors.textSecondary }}
                >
                  {selectedTemplate.description}
                </div>
              </div>
            )}

            <LabCodeEditor
              code={code}
              onChange={setCode}
              onRun={handleRunCode}
              isExecuting={isExecuting}
              isReady={isReady}
            />

            <LabOutput
              outputs={outputs}
              onClear={handleClearOutputs}
              labId={lab.id}
              code={code}
              templateTitle={selectedTemplate?.title}
              language={isPythonLab(lab.labType) ? 'python' : 'r'}
              outputRef={outputAreaRef}
            />

            {/* Add to Report button */}
            {outputs.length > 0 && (() => {
              const currentKey = `${selectedTemplate?.title || 'Code Output'}-${(code || '').trim()}`;
              const isCaptured = reportItems.some(r => r.key === currentKey);
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
                    : `Add this output to report${reportItems.length > 0 ? ` (${reportItems.length})` : ''}`}
                </button>
              );
            })()}
          </div>
        </div>
      </div>

      {assignmentConfig?.assignment && !hideSubmit && (
        <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 pb-6 flex justify-end">
          <Button
            variant="primary"
            onClick={() => setAssignmentPanelOpen(true)}
            icon={<Send className="w-4 h-4" />}
          >
            {t('submit_assignment', { defaultValue: 'Submit Assignment' })}
          </Button>
        </div>
      )}

      {assignmentConfig?.assignment && !hideSubmit && (
        <LabAssignmentPanel
          isOpen={assignmentPanelOpen}
          onClose={() => setAssignmentPanelOpen(false)}
          assignment={assignmentConfig.assignment}
          labContentRef={labContentRef}
          labId={lab.id}
          courseId={courseId ?? 0}
          hasActiveAnalysis={outputs.length > 0}
          activeAnalysisKey={selectedTemplate?.title || 'Code Output'}
          visitedAnalyses={visitedTemplates}
          sessionConfig={{
            labType: isPythonLab(lab.labType) ? 'python' : 'r',
            datasetName: selectedTemplate?.title || lab.name,
          }}
          sessionEvents={sessionEvents}
          reportItems={reportItems}
          courseNumericId={courseId ?? 0}
          assignmentId={assignmentConfig.assignment.id}
          courseName={assignmentConfig.course?.title}
          code={code}
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
  const hook = useLabWebR(lab.labType);
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
