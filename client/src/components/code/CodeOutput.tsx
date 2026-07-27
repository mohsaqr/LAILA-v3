import { useState, useEffect } from 'react';
import { AlertCircle, CheckCircle, Terminal, Maximize2, X } from 'lucide-react';

interface OutputItem {
  type: 'stdout' | 'stderr' | 'plot' | 'message';
  content: string;
}

interface CodeOutputProps {
  outputs: OutputItem[];
  isExecuting?: boolean;
  error?: string | null;
  language?: 'r' | 'python';
}

/** Runtimes emit bare base64 for plots; browsers need a data URI. */
const plotSrc = (content: string) =>
  content.startsWith('data:') ? content : `data:image/png;base64,${content}`;

export const CodeOutput = ({ outputs, isExecuting, error, language = 'r' }: CodeOutputProps) => {
  const langLabel = language === 'python' ? 'Python' : 'R';
  const [fullscreen, setFullscreen] = useState(false);
  // Drives the fade-in: flipped true one frame after the overlay mounts.
  const [overlayShown, setOverlayShown] = useState(false);

  // While the overlay is open: fade in, close on Esc, lock background scroll.
  useEffect(() => {
    if (!fullscreen) {
      setOverlayShown(false);
      return;
    }
    const raf = requestAnimationFrame(() => setOverlayShown(true));
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setFullscreen(false);
    };
    window.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [fullscreen]);

  if (isExecuting) {
    return (
      <div className="bg-gray-900 rounded-lg p-4 font-mono text-sm">
        <div className="flex items-center gap-2 text-gray-400">
          <div className="animate-spin w-4 h-4 border-2 border-emerald-500 border-t-transparent rounded-full" />
          <span>{`Executing ${langLabel} code...`}</span>
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

  // Shared body — rendered both inline and in the full-screen overlay. `large`
  // lets plots use the whole viewport height when expanded.
  const renderItems = (large: boolean) =>
    outputs.map((output, index) => {
      if (output.type === 'plot') {
        return (
          <div key={index} className="bg-white rounded p-2">
            <img
              src={plotSrc(output.content)}
              alt={`Plot ${index + 1}`}
              onClick={large ? undefined : () => setFullscreen(true)}
              className={
                large
                  ? 'max-w-full max-h-[85vh] h-auto mx-auto object-contain'
                  : 'max-w-full h-auto cursor-zoom-in'
              }
            />
          </div>
        );
      }

      if (output.type === 'stderr') {
        return (
          <pre key={index} className="font-mono text-sm text-red-400 whitespace-pre-wrap break-words">
            {output.content}
          </pre>
        );
      }

      if (output.type === 'message') {
        return (
          <pre key={index} className="font-mono text-sm text-amber-400 whitespace-pre-wrap break-words">
            {output.content}
          </pre>
        );
      }

      // stdout
      return (
        <pre key={index} className="font-mono text-sm text-gray-100 whitespace-pre-wrap break-words">
          {output.content}
        </pre>
      );
    });

  const errorTail = error && !outputs.some(o => o.type === 'stderr') && (
    <pre className="font-mono text-sm text-red-400 whitespace-pre-wrap break-words">{error}</pre>
  );

  return (
    <>
      <div className="bg-gray-900 rounded-lg overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-2 bg-gray-800 border-b border-gray-700">
          <Terminal className="w-4 h-4 text-gray-400" />
          <span className="text-sm font-medium text-gray-300">Output</span>
          {error ? (
            <AlertCircle className="w-4 h-4 text-red-400 ml-auto" />
          ) : (
            <CheckCircle className="w-4 h-4 text-emerald-400 ml-auto" />
          )}
          <button
            type="button"
            onClick={() => setFullscreen(true)}
            title="View full screen"
            aria-label="View output full screen"
            className={`${error ? '' : 'ml-2'} p-1 rounded text-gray-400 hover:text-gray-100 hover:bg-gray-700 transition-colors`}
          >
            <Maximize2 className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 space-y-3 max-h-96 overflow-auto">
          {renderItems(false)}
          {errorTail}
        </div>
      </div>

      {fullscreen && (
        <div
          className={`fixed inset-0 z-[100] bg-gray-900/95 flex flex-col transition-opacity duration-150 motion-reduce:transition-none ${
            overlayShown ? 'opacity-100' : 'opacity-0'
          } motion-reduce:opacity-100`}
          role="dialog"
          aria-modal="true"
          aria-label="Output full screen"
          onClick={() => setFullscreen(false)}
        >
          <div className="flex items-center gap-2 px-5 py-3 border-b border-gray-700 shrink-0">
            <Terminal className="w-4 h-4 text-gray-400" />
            <span className="text-sm font-medium text-gray-200">Output</span>
            <button
              type="button"
              onClick={() => setFullscreen(false)}
              aria-label="Close full screen"
              className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-700 text-gray-300 hover:bg-gray-800 text-xs font-medium transition-colors"
            >
              <X className="w-3.5 h-3.5" />
              Close
            </button>
          </div>
          {/* Stop propagation so clicking the content doesn't dismiss it. */}
          <div className="flex-1 overflow-auto p-6 space-y-4" onClick={e => e.stopPropagation()}>
            {renderItems(true)}
            {errorTail}
          </div>
        </div>
      )}
    </>
  );
};
