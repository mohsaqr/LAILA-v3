import { useContext } from 'react';
import { NodeViewWrapper, type NodeViewProps } from '@tiptap/react';
import { Link2, ExternalLink, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../../hooks/useTheme';
import { LessonMediaContext } from './LessonMediaContext';

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

/** Compare titles by their words alone, ignoring case, punctuation and spacing. */
const normalizeTitle = (s: string): string =>
  s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();

/**
 * Whether the card's title would only repeat the heading already above it.
 *
 * A URL resource is a lecture whose entire body is one link card, so a lecture
 * called "Link: Join the Discord" holding a card called "Join the Discord"
 * showed the student the same words twice and nothing else. Containment rather
 * than equality, because authors prefix the page title with a kind label
 * ("Link:", "Resource –") that the card does not repeat.
 *
 * Requires both sides to be substantial: a one- or two-character title carries
 * no signal and would collide with almost anything.
 */
export const isRedundantTitle = (title: string, pageTitle?: string): boolean => {
  const card = normalizeTitle(title || '');
  const page = normalizeTitle(pageTitle || '');
  if (card.length < 3 || page.length < 3) return false;
  return card.includes(page) || page.includes(card);
};

/**
 * Inline URL / link card. Mirrors the FileCard layout (icon tile, title, meta,
 * Open action) but points at an external URL. `newTab` opens in a new tab.
 * Used by both the editor and the read-only LessonViewer; in the editor the
 * delete control is shown.
 *
 * Read-only, the whole card is the link. In the editor it cannot be, because
 * an <a> may not contain the delete <button> — and nesting the "Open" anchor
 * inside an outer anchor is invalid HTML either way, so read-only mode demotes
 * "Open" to decoration and lets the card carry the click.
 */
export const UrlNodeView = ({ node, deleteNode, editor }: NodeViewProps) => {
  const { t } = useTranslation(['courses', 'common']);
  const { isDark } = useTheme();
  const { pageTitle } = useContext(LessonMediaContext);
  const editable = editor?.isEditable ?? true;

  const url = (node.attrs.url as string) || '';
  const title = (node.attrs.title as string) || url;
  const newTab = node.attrs.newTab !== false && node.attrs.newTab !== 'false';
  const href = safeHref(url);
  const host = hostOf(url);
  const accent = isDark ? '#38bdf8' : '#0284c7';
  const openLabel = t('common:open', { defaultValue: 'Open' });
  const hostLabel = host || t('common:link', { defaultValue: 'Link' });

  // An author always keeps the block's own title: in the editor the block is
  // one of many and its title is the only label it has, with no page heading
  // beside it to be redundant with. Today no editor supplies a pageTitle at
  // all, but stating the rule here means adding one later cannot silently
  // start blanking titles in the authoring UI.
  const showTitle = Boolean(title) && (editable || !isRedundantTitle(title, pageTitle));
  // With the title gone the host is the card's only line, so it takes over as
  // the primary one rather than leaving a bold blank where the title was.
  const primaryText = showTitle ? title : hostLabel;

  const cardClass =
    'group/url flex items-center gap-3.5 rounded-xl border p-3.5 transition-shadow hover:shadow-sm';
  const cardStyle = {
    backgroundColor: isDark ? '#1f2937' : '#ffffff',
    borderColor: isDark ? '#374151' : '#e5e7eb',
  };

  const body = (
    <>
      <span
        aria-hidden="true"
        className="shrink-0 inline-flex items-center justify-center w-12 h-12 rounded-xl"
        style={{ backgroundColor: `${accent}1f`, color: accent }}
      >
        <Link2 className="w-6 h-6" />
      </span>
      <div className="flex-1 min-w-0">
        <div
          className="text-sm font-semibold truncate"
          style={{ color: isDark ? '#f3f4f6' : '#111827' }}
          title={showTitle ? title : href || url}
        >
          {primaryText}
        </div>
        {showTitle && (
          <div
            className="mt-0.5 text-xs font-medium tracking-wide truncate"
            style={{ color: isDark ? '#9ca3af' : '#6b7280' }}
            title={href || url}
          >
            {hostLabel}
          </div>
        )}
      </div>
    </>
  );

  const openClass =
    'shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-200 transition-colors';

  // Read-only: the card is the link.
  if (!editable && href) {
    return (
      <NodeViewWrapper as="div" className="my-3" data-drag-handle>
        <a
          href={href}
          target={newTab ? '_blank' : undefined}
          rel="noopener noreferrer"
          className={`${cardClass} no-underline hover:no-underline focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500`}
          style={cardStyle}
          // The visible text is truncated and the "Open" chip is decorative, so
          // name the link from the untruncated title plus its destination.
          aria-label={`${openLabel}: ${title || hostLabel}`}
          contentEditable={false}
        >
          {body}
          <span
            aria-hidden="true"
            className={`${openClass} group-hover/url:bg-gray-100 dark:group-hover/url:bg-gray-700`}
          >
            <ExternalLink className="w-4 h-4" />
            <span className="hidden sm:inline">{openLabel}</span>
          </span>
        </a>
      </NodeViewWrapper>
    );
  }

  return (
    <NodeViewWrapper as="div" className="my-3" data-drag-handle>
      <div className={cardClass} style={cardStyle} contentEditable={false}>
        {body}
        {href && (
          <a
            href={href}
            target={newTab ? '_blank' : undefined}
            rel="noopener noreferrer"
            className={`${openClass} no-underline hover:bg-gray-100 dark:hover:bg-gray-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500`}
            aria-label={`${openLabel}${title ? ` ${title}` : ''}`}
          >
            <ExternalLink className="w-4 h-4" aria-hidden="true" />
            <span className="hidden sm:inline">{openLabel}</span>
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
