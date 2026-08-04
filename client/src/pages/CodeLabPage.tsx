import { useState, useCallback, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { codeLabsApi } from '../api/codeLabs';
import { useWebR } from '../hooks/useWebR';
import { Button } from '../components/common/Button';
import { Loading } from '../components/common/Loading';
import { LabNotebook } from '../components/labs/notebook/LabNotebook';
import { LabAIPanel, AICellContext } from '../components/labs/notebook/LabAIPanel';
import { blockToCell, LabCell } from '../components/labs/authoring/cell';
import { detectRPackages } from '../utils/detectRPackages';
import activityLogger from '../services/activityLogger';

export const CodeLabPage = () => {
  const { t } = useTranslation(['courses', 'common']);
  const { courseId, codeLabId } = useParams<{ courseId: string; codeLabId: string }>();
  const labId = parseInt(codeLabId!, 10);
  const navigate = useNavigate();

  const [aiOpen, setAiOpen] = useState(false);
  const [aiContext, setAiContext] = useState<AICellContext | null>(null);

  const { data: codeLab, isLoading, error } = useQuery({
    queryKey: ['codeLab', labId],
    queryFn: () => codeLabsApi.getCodeLabById(labId),
    enabled: !!labId,
  });

  // Install exactly the packages this notebook loads (its library() calls).
  const detectedPackages = useMemo(
    () => detectRPackages((codeLab?.blocks ?? []).map(b => b.starterCode ?? '')),
    [codeLab?.blocks]
  );

  const {
    isReady: isWebRReady,
    isLoading: isWebRLoading,
    isExecuting,
    isInstallingPackages,
    error: webRError,
    failedPackages,
    executeCode,
    reset: resetWebR,
  } = useWebR(detectedPackages);

  // Log page view
  const parsedCourseId = courseId ? parseInt(courseId, 10) : undefined;
  useEffect(() => {
    if (codeLab) {
      activityLogger.logCodeLabViewed(labId, codeLab.title, parsedCourseId);
    }
  }, [labId, codeLab?.title, parsedCourseId]);

  const handleAskAI = useCallback(
    (cell: LabCell, code: string, err: string | null, output?: string) => {
      setAiContext({ cell, code, error: err, output });
      setAiOpen(true);
    },
    []
  );

  // The rewrite dropped per-run activity logging for code labs; restore it so
  // course analytics and TNA sequences see code_lab executions again.
  const handleCellRun = useCallback(
    (cell: LabCell, code: string, result: { success: boolean; outputs: unknown[] }) => {
      activityLogger.log({
        verb: 'interacted',
        objectType: 'code_lab',
        objectId: labId,
        objectTitle: `${codeLab?.title ?? 'Code lab'}: ${cell.title}`,
        courseId: parsedCourseId,
        success: result.success,
        actionSubtype: 'code_lab.code_executed',
        extensions: {
          codeLength: code.length,
          outputCount: result.outputs.length,
        },
      });
    },
    [labId, codeLab?.title, parsedCourseId]
  );

  const notebookRuntime = useMemo(
    () => ({
      isReady: isWebRReady && !isInstallingPackages,
      isExecuting: isExecuting || isWebRLoading || isInstallingPackages,
      executeCode,
      reset: resetWebR,
    }),
    [isWebRReady, isExecuting, isWebRLoading, isInstallingPackages, executeCode, resetWebR]
  );

  if (isLoading) {
    return <Loading fullScreen text={t('loading_code_lab')} />;
  }

  if (error || !codeLab) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 md:py-8 text-center">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">{t('code_lab_not_found')}</h1>
        <p className="text-gray-600 dark:text-gray-400 mb-4">
          {t('lab_not_found_description')}
        </p>
        <Button onClick={() => navigate(-1)}>{t('go_back')}</Button>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 md:py-8">
      {/* Navigation */}
      <div className="mb-6">
        {courseId ? (
          <Link to={`/courses/${courseId}`}>
            <Button
              variant="ghost"
              size="sm"
              icon={<ArrowLeft className="w-4 h-4" />}
            >
              {t('back_to_course_button')}
            </Button>
          </Link>
        ) : (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate(-1)}
            icon={<ArrowLeft className="w-4 h-4" />}
          >
            {t('go_back')}
          </Button>
        )}
      </div>

      {/* Lab header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{codeLab.title}</h1>
        {codeLab.description && (
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{codeLab.description}</p>
        )}
      </div>

      {webRError && (
        <div className="mb-6 rounded-xl border border-red-200 bg-red-50 dark:bg-red-900/20 dark:border-red-800 p-4 text-sm text-red-700 dark:text-red-300">
          {webRError}
        </div>
      )}

      {failedPackages.length > 0 && (
        <div className="mb-6 rounded-xl border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 p-4 text-sm text-amber-800 dark:text-amber-200">
          {t('courses:packages_unavailable', {
            defaultValue:
              "These packages aren't available in the browser R and couldn't be installed: {{list}}. Cells that use them may error.",
            list: failedPackages.join(', '),
          })}
        </div>
      )}

      {/* The unified lab notebook (student view: run + local edits, locks enforced) */}
      <LabNotebook
        key={labId}
        cells={(codeLab.blocks ?? []).map(blockToCell)}
        language="r"
        canEdit={false}
        runtime={notebookRuntime}
        onCellRun={handleCellRun}
        onAskAI={codeLab.aiChatbotId != null ? handleAskAI : undefined}
      />

      {codeLab.aiChatbotId != null && (
        <LabAIPanel
          chatbotId={codeLab.aiChatbotId}
          labName={codeLab.title}
          language="r"
          cellContext={aiContext}
          isOpen={aiOpen}
          onClose={() => setAiOpen(false)}
        />
      )}
    </div>
  );
};
