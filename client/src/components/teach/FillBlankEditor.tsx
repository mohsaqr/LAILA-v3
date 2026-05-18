import { useEffect, useState } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import { useTranslation } from 'react-i18next';
import { SquareDashedBottom } from 'lucide-react';
import { useTheme } from '../../hooks/useTheme';
import { FitbBlank } from '../../utils/fillBlank';

interface FillBlankEditorProps {
  /** Editor HTML with answer-carrying blank chips (round-trip while editing). */
  html: string;
  onChange: (html: string) => void;
}

export const FillBlankEditor = ({ html, onChange }: FillBlankEditorProps) => {
  const { t } = useTranslation(['teaching', 'common']);
  const { isDark } = useTheme();
  // Re-render when the selection changes so "Make blank" enables/disables.
  const [, force] = useState(0);

  const colors = {
    border: isDark ? '#4b5563' : '#e5e7eb',
    toolbarBg: isDark ? '#2d3748' : '#f9fafb',
  };

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: false }),
      FitbBlank,
      Placeholder.configure({
        placeholder: t('fitb_placeholder', {
          defaultValue: 'Type the sentence, select a word and press “Make blank”…',
        }),
      }),
    ],
    editorProps: { attributes: { class: 'focus:outline-none fitb-editor' } },
    content: html || '',
    onUpdate: ({ editor: ed }) => onChange(ed.isEmpty ? '' : ed.getHTML()),
    onSelectionUpdate: () => force((n) => n + 1),
  });

  // Keep the editor in sync when the parent swaps the question (edit/load).
  useEffect(() => {
    if (editor && !editor.isFocused) {
      if (!html && !editor.isEmpty) editor.commands.clearContent();
      else if (html && html !== editor.getHTML()) editor.commands.setContent(html);
    }
  }, [html, editor]);

  const makeBlank = () => {
    if (!editor) return;
    const { from, to } = editor.state.selection;
    const text = editor.state.doc.textBetween(from, to, ' ').trim();
    if (!text) return;
    editor
      .chain()
      .focus()
      .deleteSelection()
      .insertContent({ type: 'fitbBlank', attrs: { answer: text } })
      .insertContent(' ')
      .run();
  };

  const hasSelection = !!editor && editor.state.selection.from !== editor.state.selection.to;

  return (
    <div
      className="rounded-lg border overflow-hidden"
      style={{ borderColor: colors.border }}
    >
      <div
        className="flex items-center gap-2 px-2 py-1.5 border-b"
        style={{ backgroundColor: colors.toolbarBg, borderColor: colors.border }}
      >
        <button
          type="button"
          // Keep the editor selection — a plain click would blur it first.
          onMouseDown={(e) => e.preventDefault()}
          onClick={makeBlank}
          disabled={!hasSelection}
          className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-md text-primary-700 dark:text-primary-300 hover:bg-primary-50 dark:hover:bg-primary-500/10 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <SquareDashedBottom size={14} />
          {t('fitb_make_blank', { defaultValue: 'Make blank' })}
        </button>
        <span className="text-xs text-gray-400 dark:text-gray-500">
          {t('fitb_hint', {
            defaultValue: 'Select a word, then “Make blank”. Students type the answer.',
          })}
        </span>
      </div>
      <EditorContent
        editor={editor}
        className="px-3 py-2 min-h-[100px] max-h-[260px] overflow-y-auto prose prose-sm dark:prose-invert max-w-none text-sm"
      />
    </div>
  );
};
