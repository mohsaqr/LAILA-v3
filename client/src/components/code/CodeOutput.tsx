import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  AlertCircle, CheckCircle, Terminal, Maximize2, X,
  ZoomIn, ZoomOut, Download, Copy, Check, Scan, FileDown,
} from 'lucide-react';
import { useCopyToClipboard } from '../../hooks/useCopyToClipboard';
import { downloadText, toFileSlug } from '../../utils/downloadFile';

interface OutputItem {
  type: 'stdout' | 'stderr' | 'plot' | 'message';
  content: string;
}

interface CodeOutputProps {
  outputs: OutputItem[];
  isExecuting?: boolean;
  error?: string | null;
  language?: 'r' | 'python';
  /** Included in a Markdown export so the result carries the code that made it. */
  code?: string;
  /** Names the exported file and titles the Markdown. */
  title?: string;
}

/** Runtimes emit bare base64 for plots; browsers need a data URI. */
const plotSrc = (content: string) =>
  content.startsWith('data:') ? content : `data:image/png;base64,${content}`;

/** Zoom stops, in the spirit of RStudio's plot pane. 1 = fit to the viewport. */
const ZOOM_STEPS = [0.5, 0.75, 1, 1.5, 2, 3, 4];

/**
 * Renders a run as Markdown: console text in fenced blocks, plots as embedded
 * data-URI images so the file stands alone with no sidecar assets.
 */
export const outputsToMarkdown = (
  outputs: OutputItem[],
  opts: { code?: string; title?: string; language?: 'r' | 'python'; error?: string | null } = {}
): string => {
  const { code, title, language = 'r', error } = opts;
  const parts: string[] = [];
  if (title) parts.push(`## ${title}`);
  if (code?.trim()) parts.push(`\`\`\`${language}\n${code.trim()}\n\`\`\``);

  let plotNo = 0;
  outputs.forEach(o => {
    if (o.type === 'plot') {
      plotNo += 1;
      parts.push(`![Plot ${plotNo}](${plotSrc(o.content)})`);
    } else if (o.content.trim()) {
      parts.push(`\`\`\`\n${o.content.replace(/\s+$/, '')}\n\`\`\``);
    }
  });

  if (error && !outputs.some(o => o.type === 'stderr')) {
    parts.push(`> **Error:** ${error.trim()}`);
  }
  return parts.join('\n\n') + '\n';
};

export const CodeOutput = ({
  outputs, isExecuting, error, language = 'r', code, title,
}: CodeOutputProps) => {
  const { t } = useTranslation(['courses', 'common']);
  const langLabel = language === 'python' ? 'Python' : 'R';
  const [fullscreen, setFullscreen] = useState(false);
  // Drives the fade-in: flipped true one frame after the overlay mounts.
  const [overlayShown, setOverlayShown] = useState(false);
  // `null` means fit-to-viewport; a number is an explicit magnification.
  const [zoom, setZoom] = useState<number | null>(null);
  // One instance for both copy buttons: copying in the header has always ticked
  // the overlay button too, and that shared feedback is preserved deliberately.
  const { copied, copy } = useCopyToClipboard();

  const hasPlots = outputs.some(o => o.type === 'plot');
  const textOutput = outputs
    .filter(o => o.type !== 'plot')
    .map(o => o.content)
    .concat(error && !outputs.some(o => o.type === 'stderr') ? [error] : [])
    .join('\n');

  const zoomBy = useCallback((dir: 1 | -1) => {
    setZoom(current => {
      // Stepping away from "fit" starts at 100%, which is where a reader expects
      // the first click to land regardless of how the image was being scaled.
      const index = current === null ? ZOOM_STEPS.indexOf(1) : ZOOM_STEPS.indexOf(current);
      const next = index === -1 ? ZOOM_STEPS.indexOf(1) : index + dir;
      return ZOOM_STEPS[Math.max(0, Math.min(ZOOM_STEPS.length - 1, next))];
    });
  }, []);

  const exportMarkdown = useCallback(() => {
    const slug = toFileSlug(title || 'output', 'output');
    downloadText(`${slug}.md`, outputsToMarkdown(outputs, { code, title, language, error }));
  }, [outputs, code, title, language, error]);

  const copyOutput = useCallback(() => void copy(textOutput), [copy, textOutput]);

  // While the overlay is open: fade in, keyboard shortcuts, lock background scroll.
  useEffect(() => {
    if (!fullscreen) {
      setOverlayShown(false);
      return;
    }
    setZoom(null);
    const raf = requestAnimationFrame(() => setOverlayShown(true));
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setFullscreen(false);
      if (!hasPlots) return;
      if (e.key === '+' || e.key === '=') zoomBy(1);
      if (e.key === '-' || e.key === '_') zoomBy(-1);
      if (e.key === '0') setZoom(null);
    };
    window.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [fullscreen, hasPlots, zoomBy]);

  if (isExecuting) {
    return (
      <div className="bg-gray-900 rounded-lg p-4 font-mono text-sm">
        <div className="flex items-center gap-2 text-gray-400" role="status" aria-live="polite">
          <div className="animate-spin w-4 h-4 border-2 border-emerald-500 border-t-transparent rounded-full" />
          <span>{t('courses:executing_code', { lang: langLabel, defaultValue: 'Executing {{lang}} code...' })}</span>
        </div>
      </div>
    );
  }

  if (outputs.length === 0 && !error) {
    return (
      <div className="bg-gray-900 rounded-lg p-4 font-mono text-sm">
        <div className="flex items-center gap-2 text-gray-500">
          <Terminal className="w-4 h-4" />
          <span>{t('courses:output_placeholder', { defaultValue: 'Output will appear here after running the code' })}</span>
        </div>
      </div>
    );
  }

  // Shared body — rendered both inline and in the full-screen overlay. `large`
  // switches plots to the inspectable presentation: zoomable, downloadable.
  const renderItems = (large: boolean) =>
    outputs.map((output, index) => {
      if (output.type === 'plot') {
        const src = plotSrc(output.content);
        return (
          <div key={index} className="relative group/plot bg-white rounded p-2 w-fit mx-auto max-w-full">
            <img
              src={src}
              alt={`Plot ${index + 1}`}
              onClick={large ? undefined : () => setFullscreen(true)}
              className={
                large
                  ? zoom === null
                    ? 'max-w-full max-h-[80vh] h-auto mx-auto object-contain'
                    : 'h-auto mx-auto'
                  : 'max-w-full h-auto cursor-zoom-in'
              }
              // An explicit width makes the container scroll, so the overlay's
              // own overflow handles panning. A CSS transform would not.
              style={large && zoom !== null ? { width: `${zoom * 100}%`, maxWidth: 'none' } : undefined}
            />
            {large && (
              <a
                href={src}
                download={`plot-${index + 1}.png`}
                onClick={e => e.stopPropagation()}
                title={t('courses:download_plot', { defaultValue: 'Download this plot' })}
                aria-label={t('courses:download_plot_n', { n: index + 1, defaultValue: 'Download plot {{n}}' })}
                className="absolute top-3 right-3 p-1.5 rounded-md bg-gray-900/70 text-gray-200 opacity-0 group-hover/plot:opacity-100 focus:opacity-100 hover:bg-gray-900 transition-opacity"
              >
                <Download className="w-4 h-4" />
              </a>
            )}
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

  const toolbarBtn =
    'p-1.5 rounded-md text-gray-300 hover:text-white hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors';

  return (
    <>
      <div className="bg-gray-900 rounded-lg overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-2 bg-gray-800 border-b border-gray-700">
          <Terminal className="w-4 h-4 text-gray-400" />
          <span className="text-sm font-medium text-gray-300">{t('courses:output', { defaultValue: 'Output' })}</span>
          {error ? (
            <>
              <AlertCircle className="w-4 h-4 text-red-400 ml-auto" />
              <span className="sr-only">{t('courses:run_failed', { defaultValue: 'Run failed' })}</span>
            </>
          ) : (
            <>
              <CheckCircle className="w-4 h-4 text-emerald-400 ml-auto" />
              <span className="sr-only">{t('courses:run_succeeded', { defaultValue: 'Run succeeded' })}</span>
            </>
          )}
          {textOutput.trim() && (
            <button
              type="button"
              onClick={copyOutput}
              title={t('courses:copy_output', { defaultValue: 'Copy output text' })}
              aria-label={t('courses:copy_output', { defaultValue: 'Copy output text' })}
              className="ml-2 flex items-center gap-1.5 px-2 py-1 rounded text-gray-300 hover:text-white hover:bg-gray-700 text-xs font-medium transition-colors"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? t('courses:copied', { defaultValue: 'Copied' }) : t('common:copy', { defaultValue: 'Copy' })}
            </button>
          )}
          <button
            type="button"
            onClick={exportMarkdown}
            title={t('courses:export_markdown', { defaultValue: 'Export as Markdown (plots embedded)' })}
            aria-label={t('courses:export_markdown_aria', { defaultValue: 'Export output as Markdown' })}
            className="flex items-center gap-1.5 px-2 py-1 rounded text-gray-300 hover:text-white hover:bg-gray-700 text-xs font-medium transition-colors"
          >
            <FileDown className="w-3.5 h-3.5" />
            .md
          </button>
          <button
            type="button"
            onClick={() => setFullscreen(true)}
            title={t('courses:inspect_output', { defaultValue: 'Inspect output (zoom, download)' })}
            aria-label={t('courses:inspect_output_aria', { defaultValue: 'Inspect output full screen' })}
            className="flex items-center gap-1.5 px-2 py-1 rounded text-gray-300 hover:text-white hover:bg-gray-700 text-xs font-medium transition-colors"
          >
            <Maximize2 className="w-3.5 h-3.5" />
            {t('courses:inspect', { defaultValue: 'Inspect' })}
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
          aria-label={t('courses:output_fullscreen', { defaultValue: 'Output full screen' })}
          onClick={() => setFullscreen(false)}
        >
          <div
            className="flex items-center gap-2 px-5 py-3 border-b border-gray-700 shrink-0"
            onClick={e => e.stopPropagation()}
          >
            <Terminal className="w-4 h-4 text-gray-400" />
            <span className="text-sm font-medium text-gray-200">{t('courses:output', { defaultValue: 'Output' })}</span>

            {hasPlots && (
              <div className="ml-4 flex items-center gap-1 rounded-lg border border-gray-700 px-1 py-0.5">
                <button type="button" onClick={() => zoomBy(-1)} className={toolbarBtn}
                        disabled={zoom === ZOOM_STEPS[0]} title={t('courses:zoom_out', { defaultValue: 'Zoom out ( − )' })} aria-label={t('courses:zoom_out_aria', { defaultValue: 'Zoom out' })}>
                  <ZoomOut className="w-4 h-4" />
                </button>
                <span className="min-w-[3.5rem] text-center text-xs font-mono text-gray-300 tabular-nums">
                  {zoom === null ? 'Fit' : `${Math.round(zoom * 100)}%`}
                </span>
                <button type="button" onClick={() => zoomBy(1)} className={toolbarBtn}
                        disabled={zoom === ZOOM_STEPS[ZOOM_STEPS.length - 1]} title={t('courses:zoom_in', { defaultValue: 'Zoom in ( + )' })} aria-label={t('courses:zoom_in_aria', { defaultValue: 'Zoom in' })}>
                  <ZoomIn className="w-4 h-4" />
                </button>
                <button type="button" onClick={() => setZoom(null)} className={toolbarBtn}
                        title={t('courses:zoom_fit', { defaultValue: 'Fit to screen ( 0 )' })} aria-label={t('courses:zoom_fit_aria', { defaultValue: 'Fit to screen' })}>
                  <Scan className="w-4 h-4" />
                </button>
              </div>
            )}

            {textOutput.trim() && (
              <button
                type="button"
                onClick={copyOutput}
                className="ml-2 flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-gray-700 text-gray-300 hover:bg-gray-800 text-xs font-medium transition-colors"
                aria-label={t('courses:copy_output_text_aria', { defaultValue: 'Copy text output to clipboard' })}
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                {copied ? t('courses:copied', { defaultValue: 'Copied' }) : t('courses:copy_output_text', { defaultValue: 'Copy text' })}
              </button>
            )}

            <button
              type="button"
              onClick={() => setFullscreen(false)}
              aria-label={t('courses:close_fullscreen', { defaultValue: 'Close full screen' })}
              className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-700 text-gray-300 hover:bg-gray-800 text-xs font-medium transition-colors"
            >
              <X className="w-3.5 h-3.5" />
              {t('common:close', { defaultValue: 'Close' })}
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
