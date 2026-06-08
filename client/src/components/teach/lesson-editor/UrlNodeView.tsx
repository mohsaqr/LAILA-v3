import { NodeViewWrapper, type NodeViewProps } from '@tiptap/react';
import { Link2, ExternalLink, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../../hooks/useTheme';

/** Only allow safe schemes — never javascript:, data:, etc. */
const safeHref = (raw: string): string => {
  const u = (raw || '').trim();
  if (/^https?:\/\//i.test(u)) return u;
  if (/^www\./i.test(u)) return `https://${u}`;
  return '';
};

/** Short host label for the meta line, e.g. "https://docs.example.com/x" → "docs.example.com". */
const hostOf = (raw: string): string => {
  const href = safeHref(raw);
  if (!href) return '';
  try {
    return new URL(href).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
};

/**
 * Inline URL / link card. Mirrors the FileCard layout (icon tile, title, meta,
 * Open action) but points at an external URL. `newTab` opens in a new tab.
 * Used by both the editor and the read-only LessonViewer; in the editor the
 * delete control is shown.
 */
export const UrlNodeView = ({ node, deleteNode, editor }: NodeViewProps) => {
  const { t } = useTranslation(['courses', 'common']);
  const { isDark } = useTheme();
  const editable = editor?.isEditable ?? true;

  const url = (node.attrs.url as string) || '';
  const title = (node.attrs.title as string) || url;
  const newTab = node.attrs.newTab !== false && node.attrs.newTab !== 'false';
  const href = safeHref(url);
  const host = hostOf(url);
  const accent = isDark ? '#38bdf8' : '#0284c7';

  return (
    <NodeViewWrapper as="div" className="my-3" data-drag-handle>
      <div
        className="group/url flex items-center gap-3.5 rounded-xl border p-3.5 transition-shadow hover:shadow-sm"
        style={{ backgroundColor: isDark ? '#1f2937' : '#ffffff', borderColor: isDark ? '#374151' : '#e5e7eb' }}
        contentEditable={false}
      >
        <span
          aria-hidden="true"
          className="shrink-0 inline-flex items-center justify-center w-12 h-12 rounded-xl"
          style={{ backgroundColor: `${accent}1f`, color: accent }}
        >
          <Link2 className="w-6 h-6" />
        </span>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold truncate" style={{ color: isDark ? '#f3f4f6' : '#111827' }} title={title}>
            {title}
          </div>
          <div className="mt-0.5 text-xs font-medium tracking-wide truncate" style={{ color: isDark ? '#9ca3af' : '#6b7280' }} title={href || url}>
            {host || t('common:link', { defaultValue: 'Link' })}
          </div>
        </div>
        {href && (
          <a
            href={href}
            target={newTab ? '_blank' : undefined}
            rel="noopener noreferrer"
            className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 transition-colors"
            aria-label={`${t('common:open', { defaultValue: 'Open' })}${title ? ` ${title}` : ''}`}
          >
            <ExternalLink className="w-4 h-4" aria-hidden="true" />
            <span className="hidden sm:inline">{t('common:open', { defaultValue: 'Open' })}</span>
          </a>
        )}
        {editable && (
          <button
            type="button"
            onClick={() => deleteNode()}
            className="shrink-0 inline-flex items-center justify-center w-8 h-8 rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400"
            aria-label={t('common:delete', { defaultValue: 'Delete' })}
            title={t('common:delete', { defaultValue: 'Delete' })}
          >
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>
    </NodeViewWrapper>
  );
};
