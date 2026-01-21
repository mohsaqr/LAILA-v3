import { FlaskConical, RefreshCw, AlertTriangle } from 'lucide-react';
import { CodeLab, CodeBlock } from '../../types';
import { CodeBlockRunner } from './CodeBlockRunner';
import { Button } from '../common/Button';
import { Card, CardBody } from '../common/Card';

interface OutputItem {
  type: 'stdout' | 'stderr' | 'plot' | 'message';
  content: string;
}

interface CodeLabPlayerProps {
  codeLab: CodeLab;
  isWebRReady: boolean;
  isWebRLoading: boolean;
  webRError: string | null;
  onExecuteCode: (code: string) => Promise<{ success: boolean; outputs: OutputItem[]; error?: string }>;
  onResetSession: () => Promise<void>;
  onAskHelp?: (block: CodeBlock, code: string, error: string) => void;
  onBlockExecuted?: (blockId: number, code: string, output?: string, error?: string) => void;
}

export const CodeLabPlayer = ({
  codeLab,
  isWebRReady,
  isWebRLoading,
  webRError,
  onExecuteCode,
  onResetSession,
  onAskHelp,
  onBlockExecuted,
}: CodeLabPlayerProps) => {
  const blocks = codeLab.blocks
    ? [...codeLab.blocks].sort((a, b) => a.orderIndex - b.orderIndex)
    : [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardBody>
          <div className="flex items-start gap-4">
            <div className="flex items-center justify-center w-12 h-12 rounded-lg bg-emerald-100">
              <FlaskConical className="w-6 h-6 text-emerald-600" />
            </div>
            <div className="flex-1">
              <h1 className="text-2xl font-bold text-gray-900">{codeLab.title}</h1>
              {codeLab.description && (
                <p className="mt-1 text-gray-600">{codeLab.description}</p>
              )}
              <div className="mt-3 flex items-center gap-4 text-sm">
                <span className="text-gray-500">
                  {blocks.length} code block{blocks.length !== 1 ? 's' : ''}
                </span>
                <span className={`flex items-center gap-1.5 ${
                  isWebRReady ? 'text-emerald-600' : isWebRLoading ? 'text-amber-600' : 'text-red-600'
                }`}>
                  <span className={`w-2 h-2 rounded-full ${
                    isWebRReady ? 'bg-emerald-500' : isWebRLoading ? 'bg-amber-500 animate-pulse' : 'bg-red-500'
                  }`} />
                  {isWebRReady ? 'R Ready' : isWebRLoading ? 'Loading R...' : 'R Error'}
                </span>
              </div>
            </div>
            <Button
              variant="secondary"
              size="sm"
              onClick={onResetSession}
              disabled={isWebRLoading}
              icon={<RefreshCw className="w-4 h-4" />}
            >
              Reset Session
            </Button>
          </div>
        </CardBody>
      </Card>

      {/* WebR Loading/Error State */}
      {isWebRLoading && (
        <Card>
          <CardBody>
            <div className="flex items-center gap-3 text-amber-600">
              <div className="animate-spin w-5 h-5 border-2 border-amber-500 border-t-transparent rounded-full" />
              <div>
                <p className="font-medium">Initializing R Environment</p>
                <p className="text-sm text-gray-500">
                  This may take a moment on first load...
                </p>
              </div>
            </div>
          </CardBody>
        </Card>
      )}

      {webRError && (
        <Card>
          <CardBody>
            <div className="flex items-start gap-3 text-red-600">
              <AlertTriangle className="w-5 h-5 mt-0.5" />
              <div>
                <p className="font-medium">Failed to Initialize R</p>
                <p className="text-sm text-gray-600 mt-1">{webRError}</p>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={onResetSession}
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

      {/* Code Blocks */}
      {blocks.length > 0 ? (
        <div className="space-y-4">
          {blocks.map((block, index) => (
            <CodeBlockRunner
              key={block.id}
              block={block}
              index={index}
              isWebRReady={isWebRReady}
              onExecute={onExecuteCode}
              onAskHelp={onAskHelp}
              onBlockExecuted={onBlockExecuted}
            />
          ))}
        </div>
      ) : (
        <Card>
          <CardBody className="text-center py-12">
            <FlaskConical className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900">No Code Blocks</h3>
            <p className="text-gray-500 mt-1">
              This lab doesn't have any code blocks yet.
            </p>
          </CardBody>
        </Card>
      )}

      {/* Tips */}
      {blocks.length > 0 && (
        <Card>
          <CardBody>
            <h3 className="font-medium text-gray-900 mb-2">Tips</h3>
            <ul className="text-sm text-gray-600 space-y-1">
              <li>• Code blocks share the same R session - variables persist between blocks</li>
              <li>• Run blocks in order for the best experience</li>
              <li>• Use "Reset Session" to start fresh if needed</li>
              <li>• Click "Ask AI for Help" if you encounter errors</li>
            </ul>
          </CardBody>
        </Card>
      )}
    </div>
  );
};
