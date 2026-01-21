import { useState, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { codeLabsApi } from '../api/codeLabs';
import { useWebR } from '../hooks/useWebR';
import { Button } from '../components/common/Button';
import { Loading } from '../components/common/Loading';
import { CodeLabPlayer } from '../components/code/CodeLabPlayer';
import { CodeLabAIHelper } from '../components/code/CodeLabAIHelper';
import { CodeBlock } from '../types';

interface BlockExecutionResult {
  blockId: number;
  code: string;
  output?: string;
  error?: string;
}

interface AIHelperState {
  isOpen: boolean;
  block: CodeBlock | null;
  code: string;
  error: string;
}

export const CodeLabPage = () => {
  const { courseSlug, codeLabId } = useParams<{ courseSlug: string; codeLabId: string }>();
  const labId = parseInt(codeLabId!, 10);
  const navigate = useNavigate();

  // Track execution results for AI context
  const [executionResults, setExecutionResults] = useState<Map<number, BlockExecutionResult>>(new Map());

  // AI Helper modal state
  const [aiHelper, setAIHelper] = useState<AIHelperState>({
    isOpen: false,
    block: null,
    code: '',
    error: '',
  });

  // WebR hook
  const {
    isReady: isWebRReady,
    isLoading: isWebRLoading,
    error: webRError,
    executeCode,
    reset: resetWebR,
  } = useWebR();

  // Fetch code lab data
  const { data: codeLab, isLoading, error } = useQuery({
    queryKey: ['codeLab', labId],
    queryFn: () => codeLabsApi.getCodeLabById(labId),
    enabled: !!labId,
  });

  // Track block execution results
  const handleBlockExecuted = useCallback((blockId: number, code: string, output?: string, error?: string) => {
    setExecutionResults((prev) => {
      const newMap = new Map(prev);
      newMap.set(blockId, { blockId, code, output, error });
      return newMap;
    });
  }, []);

  // Handle AI help request
  const handleAskHelp = useCallback((block: CodeBlock, code: string, errorMessage: string) => {
    setAIHelper({
      isOpen: true,
      block,
      code,
      error: errorMessage,
    });
  }, []);

  // Close AI helper
  const handleCloseAIHelper = useCallback(() => {
    setAIHelper((prev) => ({ ...prev, isOpen: false }));
  }, []);

  // Reset session and clear execution results
  const handleResetSession = useCallback(async () => {
    await resetWebR();
    setExecutionResults(new Map());
  }, [resetWebR]);

  // Build previous blocks context for AI helper
  const getPreviousBlocksContext = useCallback(() => {
    if (!codeLab?.blocks || !aiHelper.block) return [];

    const sortedBlocks = [...codeLab.blocks].sort((a, b) => a.orderIndex - b.orderIndex);
    const currentIndex = sortedBlocks.findIndex((b) => b.id === aiHelper.block!.id);

    return sortedBlocks
      .slice(0, currentIndex)
      .map((block) => {
        const result = executionResults.get(block.id);
        return {
          block,
          code: result?.code || block.starterCode || '',
          output: result?.output,
          error: result?.error,
        };
      })
      .filter((ctx) => ctx.code); // Only include blocks that have been executed
  }, [codeLab?.blocks, aiHelper.block, executionResults]);

  if (isLoading) {
    return <Loading fullScreen text="Loading Code Lab..." />;
  }

  if (error || !codeLab) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8 text-center">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Code Lab Not Found</h1>
        <p className="text-gray-600 mb-4">
          The code lab you're looking for doesn't exist or you don't have access.
        </p>
        <Button onClick={() => navigate(-1)}>Go Back</Button>
      </div>
    );
  }

  const courseId = codeLab.module?.course?.id;
  const courseTitle = codeLab.module?.course?.title;

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Navigation */}
      <div className="mb-6">
        {courseSlug ? (
          <Link to={`/courses/${courseSlug}`}>
            <Button
              variant="ghost"
              size="sm"
              icon={<ArrowLeft className="w-4 h-4" />}
            >
              Back to {courseTitle || 'Course'}
            </Button>
          </Link>
        ) : courseId ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate(`/courses/${courseId}`)}
            icon={<ArrowLeft className="w-4 h-4" />}
          >
            Back to Course
          </Button>
        ) : (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate(-1)}
            icon={<ArrowLeft className="w-4 h-4" />}
          >
            Go Back
          </Button>
        )}
      </div>

      {/* Code Lab Player */}
      <CodeLabPlayer
        codeLab={codeLab}
        isWebRReady={isWebRReady}
        isWebRLoading={isWebRLoading}
        webRError={webRError}
        onExecuteCode={executeCode}
        onResetSession={handleResetSession}
        onAskHelp={handleAskHelp}
        onBlockExecuted={handleBlockExecuted}
      />

      {/* AI Helper Modal */}
      {aiHelper.block && (
        <CodeLabAIHelper
          isOpen={aiHelper.isOpen}
          onClose={handleCloseAIHelper}
          codeLab={codeLab}
          currentBlock={aiHelper.block}
          currentCode={aiHelper.code}
          currentError={aiHelper.error}
          previousBlocks={getPreviousBlocksContext()}
        />
      )}
    </div>
  );
};
