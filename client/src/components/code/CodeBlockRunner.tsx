import { useState, useEffect } from 'react';
import Editor from '@monaco-editor/react';
import { Play, RotateCcw, HelpCircle, ChevronDown, ChevronRight } from 'lucide-react';
import { CodeBlock } from '../../types';
import { CodeOutput } from './CodeOutput';
import { Button } from '../common/Button';
import { sanitizeHtml } from '../../utils/sanitize';

interface OutputItem {
  type: 'stdout' | 'stderr' | 'plot' | 'message';
  content: string;
}

interface CodeBlockRunnerProps {
  block: CodeBlock;
  index: number;
  isWebRReady: boolean;
  onExecute: (code: string) => Promise<{ success: boolean; outputs: OutputItem[]; error?: string }>;
  onAskHelp?: (block: CodeBlock, code: string, error: string) => void;
  onBlockExecuted?: (blockId: number, code: string, output?: string, error?: string) => void;
}

export const CodeBlockRunner = ({
  block,
  index,
  isWebRReady,
  onExecute,
  onAskHelp,
  onBlockExecuted,
}: CodeBlockRunnerProps) => {
  const [code, setCode] = useState(block.starterCode || '');
  const [isExpanded, setIsExpanded] = useState(true);
  const [isExecuting, setIsExecuting] = useState(false);
  const [outputs, setOutputs] = useState<OutputItem[]>([]);
  const [lastError, setLastError] = useState<string | null>(null);
  const [hasRun, setHasRun] = useState(false);

  // Reset code when block changes
  useEffect(() => {
    setCode(block.starterCode || '');
    setOutputs([]);
    setLastError(null);
    setHasRun(false);
  }, [block.id, block.starterCode]);

  const handleRun = async () => {
    if (!isWebRReady || isExecuting) return;

    setIsExecuting(true);
    setLastError(null);

    try {
      const result = await onExecute(code);
      setOutputs(result.outputs);
      setLastError(result.error || null);
      setHasRun(true);

      // Report execution result to parent
      if (onBlockExecuted) {
        const outputText = result.outputs
          .filter((o) => o.type === 'stdout' || o.type === 'message')
          .map((o) => o.content)
          .join('\n');
        onBlockExecuted(block.id, code, outputText, result.error);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Execution failed';
      setOutputs([{ type: 'stderr', content: errorMessage }]);
      setLastError(errorMessage);

      // Report error to parent
      if (onBlockExecuted) {
        onBlockExecuted(block.id, code, undefined, errorMessage);
      }
    } finally {
      setIsExecuting(false);
    }
  };

  const handleReset = () => {
    setCode(block.starterCode || '');
    setOutputs([]);
    setLastError(null);
    setHasRun(false);
  };

  const handleAskHelp = () => {
    if (onAskHelp) {
      onAskHelp(block, code, lastError || '');
    }
  };

  return (
    <div className="border border-gray-200 rounded-lg bg-white overflow-hidden shadow-sm">
      {/* Block Header */}
      <div
        className="flex items-center gap-3 p-4 bg-gradient-to-r from-emerald-50 to-teal-50 border-b border-emerald-100 cursor-pointer"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <button className="p-1 rounded hover:bg-emerald-100 transition-colors">
          {isExpanded ? (
            <ChevronDown className="w-5 h-5 text-emerald-600" />
          ) : (
            <ChevronRight className="w-5 h-5 text-emerald-600" />
          )}
        </button>

        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-emerald-100 text-emerald-700 font-bold text-sm">
          {index + 1}
        </div>

        <div className="flex-1">
          <h3 className="font-semibold text-gray-900">{block.title}</h3>
        </div>

        {hasRun && (
          <div className={`px-2 py-1 rounded text-xs font-medium ${
            lastError ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'
          }`}>
            {lastError ? 'Error' : 'Completed'}
          </div>
        )}
      </div>

      {/* Block Content */}
      {isExpanded && (
        <div className="p-4 space-y-4">
          {/* Instructions */}
          {block.instructions && (
            <div className="prose prose-sm max-w-none text-gray-600 bg-gray-50 rounded-lg p-4">
              <div dangerouslySetInnerHTML={{ __html: sanitizeHtml(block.instructions.replace(/\n/g, '<br/>')) }} />
            </div>
          )}

          {/* Code Editor */}
          <div className="border border-gray-200 rounded-lg overflow-hidden">
            <Editor
              height="200px"
              defaultLanguage="r"
              value={code}
              onChange={(value) => setCode(value || '')}
              theme="vs-dark"
              options={{
                minimap: { enabled: false },
                fontSize: 14,
                lineNumbers: 'on',
                scrollBeyondLastLine: false,
                automaticLayout: true,
                tabSize: 2,
                wordWrap: 'on',
                padding: { top: 10, bottom: 10 },
              }}
            />
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2">
            <Button
              onClick={handleRun}
              disabled={!isWebRReady || isExecuting}
              loading={isExecuting}
              icon={<Play className="w-4 h-4" />}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              Run Code
            </Button>

            <Button
              variant="secondary"
              onClick={handleReset}
              disabled={isExecuting}
              icon={<RotateCcw className="w-4 h-4" />}
            >
              Reset
            </Button>

            {onAskHelp && (
              <Button
                variant="ghost"
                onClick={handleAskHelp}
                icon={<HelpCircle className="w-4 h-4" />}
                className="ml-auto text-amber-600 hover:bg-amber-50"
              >
                Ask AI for Help
              </Button>
            )}
          </div>

          {/* Output */}
          {(hasRun || isExecuting) && (
            <CodeOutput
              outputs={outputs}
              isExecuting={isExecuting}
              error={lastError}
            />
          )}
        </div>
      )}
    </div>
  );
};
