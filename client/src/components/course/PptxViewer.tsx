import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Presentation, ExternalLink, Download, AlertTriangle } from 'lucide-react';
import { useTheme } from '../../hooks/useTheme';

interface PptxViewerProps {
  /** Already-resolved file URL (may be relative, e.g. "/uploads/..."). */
  url: string;
  fileName: string;
  /** Optional click handler for the download action (e.g. activity logging). */
  onDownload?: (e: React.MouseEvent) => void;
  /** Optional click handler for the "open in new tab" action (e.g. activity logging). */
  onOpenNewTab?: (e: React.MouseEvent) => void;
}

/**
 * Build an absolute URL from a possibly-relative one using the current origin.
 * The Google Docs viewer fetches the file server-side, so it needs an absolute,
 * publicly reachable URL.
 */
const toAbsolute = (url: string): string => {
  if (/^https?:\/\//i.test(url)) return url;
  return `${window.location.origin}${url.startsWith('/') ? '' : '/'}${url}`;
};

/** Whether a host is private/loopback and therefore unreachable by Google. */
const isPrivateHost = (host: string): boolean =>
  /^(localhost|127\.|0\.0\.0\.0|\[?::1\]?|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/i.test(host) ||
  host.endsWith('.local');

/**
 * Inline PowerPoint (.ppt/.pptx) slide viewer. Renders slides via the hosted
 * Google Docs viewer (no extra dependency) so students can scroll through the
 * deck, LinkedIn-style, without leaving the lecture page. When the file is not
 * on a publicly reachable URL (e.g. local development), the viewer cannot load,
 * so we fall back to a clear notice plus a download action.
 */
export const PptxViewer = ({ url, fileName, onDownload, onOpenNewTab }: PptxViewerProps) => {
  const { t } = useTranslation(['courses', 'common']);
  const { isDark } = useTheme();
  const [errored, setErrored] = useState(false);

  const absoluteUrl = toAbsolute(url);
  let host = '';
  try {
    host = new URL(absoluteUrl).hostname;
  } catch {
    host = '';
  }
  const reachable = /^https?:\/\//i.test(absoluteUrl) && !isPrivateHost(host);
  const viewerSrc = `https://docs.google.com/gview?embedded=true&url=${encodeURIComponent(absoluteUrl)}`;

  const accent = isDark ? '#fb923c' : '#ea580c';
  const border = isDark ? '#374151' : '#e5e7eb';
  const headerBg = isDark ? '#1f2937' : '#ffffff';
  const bodyBg = isDark ? '#111827' : '#f3f4f6';
  const textPrimary = isDark ? '#f3f4f6' : '#111827';
  const textMuted = isDark ? '#9ca3af' : '#6b7280';

  return (
    <div className="rounded-xl border overflow-hidden" style={{ borderColor: border }}>
      {/* Toolbar */}
      <div
        className="flex items-center gap-3 px-3.5 py-2.5 border-b"
        style={{ backgroundColor: headerBg, borderColor: border }}
      >
        <span
          aria-hidden="true"
          className="shrink-0 inline-flex items-center justify-center w-9 h-9 rounded-lg"
          style={{ backgroundColor: `${accent}1f`, color: accent }}
        >
          <Presentation className="w-5 h-5" />
        </span>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold truncate" style={{ color: textPrimary }} title={fileName}>
            {fileName}
          </div>
          <div className="text-xs font-medium" style={{ color: textMuted }}>
            {t('courses:presentation', { defaultValue: 'Presentation' })}
          </div>
        </div>
        {reachable && (
          <a
            href={viewerSrc}
            target="_blank"
            rel="noopener noreferrer"
            onClick={onOpenNewTab}
            aria-label={t('common:open_in_new_tab', { defaultValue: 'Open in new tab' })}
            className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            <ExternalLink className="w-4 h-4" aria-hidden="true" />
            <span className="hidden sm:inline">{t('common:open_in_new_tab', { defaultValue: 'Open in new tab' })}</span>
          </a>
        )}
        <a
          href={url}
          download={fileName || undefined}
          target="_blank"
          rel="noopener noreferrer"
          onClick={onDownload}
          aria-label={`${t('common:download', { defaultValue: 'Download' })} ${fileName}`}
          className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
        >
          <Download className="w-4 h-4" aria-hidden="true" />
          <span className="hidden sm:inline">{t('common:download', { defaultValue: 'Download' })}</span>
        </a>
      </div>

      {/* Body: inline slides, or a fallback notice when not viewable */}
      {reachable && !errored ? (
        <div className="relative w-full" style={{ backgroundColor: bodyBg, height: 'min(70vh, 640px)' }}>
          <iframe
            src={viewerSrc}
            title={fileName}
            className="absolute inset-0 w-full h-full border-0"
            onError={() => setErrored(true)}
            allowFullScreen
          />
        </div>
      ) : (
        <div
          className="flex flex-col items-center justify-center text-center gap-2 px-6 py-10"
          style={{ backgroundColor: bodyBg }}
        >
          <AlertTriangle className="w-7 h-7" style={{ color: textMuted }} aria-hidden="true" />
          <p className="text-sm font-medium" style={{ color: textPrimary }}>
            {t('courses:slides_preview_unavailable', { defaultValue: 'Inline slide preview is unavailable' })}
          </p>
          <p className="text-xs max-w-md" style={{ color: textMuted }}>
            {t('courses:slides_preview_unavailable_hint', {
              defaultValue: 'The presentation can be downloaded and opened in PowerPoint.',
            })}
          </p>
        </div>
      )}
    </div>
  );
};
