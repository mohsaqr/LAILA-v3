import { useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Eye,
  Pencil,
  Bold,
  Italic,
  Heading2,
  List,
  ListOrdered,
  Link2,
  Code as CodeIcon,
} from 'lucide-react';
import { renderMarkdown } from '../../../utils/renderMarkdown';
import { sanitizeHtml } from '../../../utils/sanitize';

interface MarkdownFieldProps {
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  rows?: number;
  placeholder?: string;
}

/**
 * Markdown prose field with a formatting toolbar and a preview tab. The
 * preview runs the same renderMarkdown + sanitizeHtml pipeline the student
 * view uses, so authors see exactly what ships.
 */
export const MarkdownField = ({
  value,
  onChange,
  onBlur,
  rows = 6,
  placeholder,
}: MarkdownFieldProps) => {
  const { t } = useTranslation(['teaching']);
  const [showPreview, setShowPreview] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  /** Wrap the current selection (or insert at the caret) with markdown markers. */
  const applyFormat = (before: string, after = '', block = false) => {
    const ta = textareaRef.current;
    if (!ta) return;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const selected = value.slice(start, end);
    let insert: string;
    if (block) {
      // Prefix each selected line (headings, lists).
      const target = selected || t('example_text', { defaultValue: 'Text' });
      insert = target
        .split('\n')
        .map(line => before + line)
        .join('\n');
    } else {
      insert = before + (selected || t('example_text', { defaultValue: 'Text' })) + after;
    }
    const next = value.slice(0, start) + insert + value.slice(end);
    onChange(next);
    requestAnimationFrame(() => {
      ta.focus();
      ta.selectionStart = start + before.length;
      ta.selectionEnd = start + insert.length - after.length;
    });
  };

  const tools: Array<{ icon: typeof Bold; title: string; action: () => void }> = [
    { icon: Bold, title: t('md_bold', { defaultValue: 'Bold' }), action: () => applyFormat('**', '**') },
    { icon: Italic, title: t('md_italic', { defaultValue: 'Italic' }), action: () => applyFormat('*', '*') },
    { icon: Heading2, title: t('md_heading', { defaultValue: 'Heading' }), action: () => applyFormat('## ', '', true) },
    { icon: List, title: t('md_bullets', { defaultValue: 'Bullet list' }), action: () => applyFormat('- ', '', true) },
    { icon: ListOrdered, title: t('md_numbered', { defaultValue: 'Numbered list' }), action: () => applyFormat('1. ', '', true) },
    { icon: Link2, title: t('md_link', { defaultValue: 'Link' }), action: () => applyFormat('[', '](https://)') },
    { icon: CodeIcon, title: t('md_code', { defaultValue: 'Inline code' }), action: () => applyFormat('`', '`') },
  ];

  const tabCls = (active: boolean) =>
    `flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
      active
        ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm'
        : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
    }`;

  return (
    <div>
      <div className="flex items-center gap-2 mb-2 flex-wrap">
        <div className="flex items-center gap-1 p-1 bg-gray-100 dark:bg-gray-900 rounded-lg w-fit">
          <button type="button" onClick={() => setShowPreview(false)} className={tabCls(!showPreview)}>
            <Pencil className="w-3.5 h-3.5" />
            {t('write')}
          </button>
          <button type="button" onClick={() => setShowPreview(true)} className={tabCls(showPreview)}>
            <Eye className="w-3.5 h-3.5" />
            {t('preview')}
          </button>
        </div>

        {!showPreview && (
          <div className="flex items-center gap-0.5 p-1 bg-gray-100 dark:bg-gray-900 rounded-lg">
            {tools.map(({ icon: Icon, title, action }) => (
              <button
                key={title}
                type="button"
                // onMouseDown + preventDefault: runs before the textarea blur,
                // so the selection is intact and blur-save flows don't fire.
                onMouseDown={e => {
                  e.preventDefault();
                  action();
                }}
                className="p-1.5 rounded-md text-gray-500 dark:text-gray-400 hover:bg-white dark:hover:bg-gray-700 hover:text-gray-800 dark:hover:text-gray-100 transition-colors"
                title={title}
              >
                <Icon className="w-3.5 h-3.5" />
              </button>
            ))}
          </div>
        )}
      </div>

      {showPreview ? (
        <div
          className="prose prose-sm dark:prose-invert max-w-none text-gray-600 dark:text-gray-300 bg-gray-50 dark:bg-gray-900 rounded-lg p-4 border border-gray-200 dark:border-gray-700 overflow-x-auto"
          style={{ minHeight: `${rows * 1.5}rem` }}
        >
          {value.trim() ? (
            <div dangerouslySetInnerHTML={{ __html: sanitizeHtml(renderMarkdown(value)) }} />
          ) : (
            <p className="text-gray-400 italic m-0">{t('nothing_to_preview')}</p>
          )}
        </div>
      ) : (
        <textarea
          ref={textareaRef}
          value={value}
          onChange={e => onChange(e.target.value)}
          onBlur={onBlur}
          placeholder={placeholder}
          rows={rows}
          className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent resize-y"
        />
      )}
      <p className="text-xs text-gray-400 mt-1">{t('supports_markdown')}</p>
    </div>
  );
};
