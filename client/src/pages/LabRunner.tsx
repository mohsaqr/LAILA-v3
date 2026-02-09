import { useState, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowLeft,
  FlaskConical,
  RefreshCw,
  HelpCircle,
  Loader2,
  AlertTriangle,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { customLabsApi } from '../api/customLabs';
import { LabCodeEditor, LabOutput, LabTemplates } from '../components/labs';
import { Button } from '../components/common/Button';
import { Card, CardBody } from '../components/common/Card';
import { Loading } from '../components/common/Loading';
import { useLabWebR } from '../hooks/useLabWebR';
import { useTheme } from '../hooks/useTheme';
import { LabTemplate } from '../types';

interface OutputItem {
  type: 'stdout' | 'stderr' | 'plot' | 'message';
  content: string;
}

// Inner component that uses WebR after lab is loaded
const LabRunnerContent = ({ lab }: { lab: any }) => {
  const { t } = useTranslation(['courses', 'common']);
  const { isDark } = useTheme();

  // Lab state
  const [code, setCode] = useState('# Enter your R code here\n');
  const [outputs, setOutputs] = useState<OutputItem[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<number | null>(null);

  // WebR hook - uses lab type to determine which packages to install
  const {
    isReady,
    isLoading: webRLoading,
    isExecuting,
    isInstallingPackages,
    packagesInstalled,
    loadingStatus,
    error: webRError,
    executeCode,
    reset: resetWebR,
  } = useLabWebR(lab.labType);

  const colors = {
    bg: isDark ? '#111827' : '#f3f4f6',
    cardBg: isDark ? '#1f2937' : '#ffffff',
    border: isDark ? '#374151' : '#e5e7eb',
    textPrimary: isDark ? '#f3f4f6' : '#111827',
    textSecondary: isDark ? '#9ca3af' : '#6b7280',
  };

  // Handle template selection
  const handleSelectTemplate = useCallback((template: LabTemplate) => {
    setCode(template.code);
    setSelectedTemplateId(template.id);
    setOutputs([]);
  }, []);

  // Handle code execution
  const handleRunCode = useCallback(async () => {
    if (!isReady || isExecuting) return;

    const result = await executeCode(code);

    if (result.success) {
      setOutputs(result.outputs);
    } else {
      setOutputs([
        ...result.outputs,
        ...(result.error ? [{ type: 'stderr' as const, content: result.error }] : []),
      ]);
    }
  }, [code, isReady, isExecuting, executeCode]);

  // Handle session reset
  const handleResetSession = useCallback(async () => {
    setOutputs([]);
    await resetWebR();
  }, [resetWebR]);

  // Clear outputs
  const handleClearOutputs = useCallback(() => {
    setOutputs([]);
  }, []);

  // Get loading message based on lab type
  const getLoadingMessage = () => {
    if (lab.labType === 'tna') {
      return 'Installing TNA packages may take a moment on first load...';
    }
    return 'Setting up the R environment...';
  };

  return (
    <div className="min-h-screen" style={{ backgroundColor: colors.bg }}>
      <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <Link to="/labs">
              <Button variant="ghost" size="sm" icon={<ArrowLeft className="w-4 h-4" />}>
                {t('back_to_labs')}
              </Button>
            </Link>
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
          </div>

          <div className="flex items-center gap-3">
            {/* Status Indicator */}
            <div className="flex items-center gap-2 text-sm">
              <span
                className={`w-2 h-2 rounded-full ${
                  isReady
                    ? 'bg-emerald-500'
                    : webRLoading
                    ? 'bg-amber-500 animate-pulse'
                    : 'bg-red-500'
                }`}
              />
              <span style={{ color: colors.textSecondary }}>
                {isReady
                  ? t('r_ready')
                  : webRLoading
                  ? loadingStatus
                  : webRError || t('r_error')}
              </span>
            </div>

            <Button
              variant="secondary"
              size="sm"
              onClick={handleResetSession}
              disabled={webRLoading}
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

        {/* WebR Loading State */}
        {webRLoading && (
          <Card className="mb-6">
            <CardBody>
              <div className="flex items-center gap-4">
                <Loader2 className="w-6 h-6 animate-spin text-emerald-500" />
                <div>
                  <p className="font-medium" style={{ color: colors.textPrimary }}>
                    {loadingStatus}
                  </p>
                  <p className="text-sm" style={{ color: colors.textSecondary }}>
                    {isInstallingPackages ? getLoadingMessage() : 'Initializing R...'}
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

        {/* WebR Error State */}
        {webRError && !webRLoading && (
          <Card className="mb-6">
            <CardBody>
              <div className="flex items-start gap-4">
                <AlertTriangle className="w-6 h-6 text-red-500 flex-shrink-0" />
                <div>
                  <p className="font-medium text-red-600">Failed to Initialize R Environment</p>
                  <p className="text-sm mt-1" style={{ color: colors.textSecondary }}>
                    {webRError}
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
        <div className="grid lg:grid-cols-4 gap-6">
          {/* Templates Sidebar */}
          <div className="lg:col-span-1">
            <LabTemplates
              templates={lab.templates || []}
              selectedTemplateId={selectedTemplateId}
              onSelectTemplate={handleSelectTemplate}
            />

            {/* Tips */}
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

          {/* Editor and Output */}
          <div className="lg:col-span-3 space-y-6">
            {/* Code Editor */}
            <LabCodeEditor
              code={code}
              onChange={setCode}
              onRun={handleRunCode}
              isExecuting={isExecuting}
              isReady={isReady}
            />

            {/* Output */}
            <LabOutput outputs={outputs} onClear={handleClearOutputs} labId={lab.id} />
          </div>
        </div>
      </div>
    </div>
  );
};

export const LabRunner = () => {
  const { t } = useTranslation(['courses', 'common']);
  const { id } = useParams<{ id: string }>();
  const { isDark } = useTheme();

  // Fetch lab data first
  const { data: lab, isLoading: labLoading } = useQuery({
    queryKey: ['lab', id],
    queryFn: () => customLabsApi.getLabById(Number(id)),
    enabled: !!id,
  });

  const colors = {
    bg: isDark ? '#111827' : '#f3f4f6',
    cardBg: isDark ? '#1f2937' : '#ffffff',
    border: isDark ? '#374151' : '#e5e7eb',
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

  // Once lab is loaded, render the content with the appropriate WebR hook
  return <LabRunnerContent lab={lab} />;
};
