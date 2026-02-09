import { AlertCircle, CheckCircle, Terminal } from 'lucide-react';

interface OutputItem {
  type: 'stdout' | 'stderr' | 'plot' | 'message';
  content: string;
}

interface CodeOutputProps {
  outputs: OutputItem[];
  isExecuting?: boolean;
  error?: string | null;
}

export const CodeOutput = ({ outputs, isExecuting, error }: CodeOutputProps) => {
  if (isExecuting) {
    return (
      <div className="bg-gray-900 rounded-lg p-4 font-mono text-sm">
        <div className="flex items-center gap-2 text-gray-400">
          <div className="animate-spin w-4 h-4 border-2 border-emerald-500 border-t-transparent rounded-full" />
          <span>Executing R code...</span>
        </div>
      </div>
    );
  }

  if (outputs.length === 0 && !error) {
    return (
      <div className="bg-gray-900 rounded-lg p-4 font-mono text-sm">
        <div className="flex items-center gap-2 text-gray-500">
          <Terminal className="w-4 h-4" />
          <span>Output will appear here after running the code</span>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-900 rounded-lg overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-2 bg-gray-800 border-b border-gray-700">
        <Terminal className="w-4 h-4 text-gray-400" />
        <span className="text-sm font-medium text-gray-300">Output</span>
        {error ? (
          <AlertCircle className="w-4 h-4 text-red-400 ml-auto" />
        ) : (
          <CheckCircle className="w-4 h-4 text-emerald-400 ml-auto" />
        )}
      </div>

      <div className="p-4 space-y-3 max-h-96 overflow-auto">
        {outputs.map((output, index) => {
          if (output.type === 'plot') {
            return (
              <div key={index} className="bg-white rounded p-2">
                <img
                  src={output.content}
                  alt={`Plot ${index + 1}`}
                  className="max-w-full h-auto"
                />
              </div>
            );
          }

          if (output.type === 'stderr') {
            return (
              <pre
                key={index}
                className="font-mono text-sm text-red-400 whitespace-pre-wrap break-words"
              >
                {output.content}
              </pre>
            );
          }

          if (output.type === 'message') {
            return (
              <pre
                key={index}
                className="font-mono text-sm text-amber-400 whitespace-pre-wrap break-words"
              >
                {output.content}
              </pre>
            );
          }

          // stdout
          return (
            <pre
              key={index}
              className="font-mono text-sm text-gray-100 whitespace-pre-wrap break-words"
            >
              {output.content}
            </pre>
          );
        })}

        {error && !outputs.some(o => o.type === 'stderr') && (
          <pre className="font-mono text-sm text-red-400 whitespace-pre-wrap break-words">
            {error}
          </pre>
        )}
      </div>
    </div>
  );
};
