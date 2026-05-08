import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { RichTextEditor } from '../../forum/RichTextEditor';
import type { LectureSection, UpdateSectionData } from '../../../types';

interface TextBlockProps {
  section: LectureSection;
  onChange: (data: UpdateSectionData) => void;
  autoFocus?: boolean;
}

/**
 * Text block — wraps RichTextEditor with a 400 ms debounce so typing
 * doesn't fire a save on every keystroke. Sits flush on the page
 * background; no card chrome or label.
 */
export const TextBlock = ({ section, onChange, autoFocus = false }: TextBlockProps) => {
  const { t } = useTranslation('teaching');
  const [draft, setDraft] = useState(section.content ?? '');
  const lastSavedRef = useRef(section.content ?? '');
  const containerRef = useRef<HTMLDivElement>(null);

  // Sync external content updates (e.g. after server fetch).
  useEffect(() => {
    if ((section.content ?? '') !== lastSavedRef.current) {
      setDraft(section.content ?? '');
      lastSavedRef.current = section.content ?? '';
    }
  }, [section.content]);

  // Debounced save.
  useEffect(() => {
    if (draft === lastSavedRef.current) return;
    const handle = setTimeout(() => {
      lastSavedRef.current = draft;
      onChange({ content: draft });
    }, 400);
    return () => clearTimeout(handle);
  }, [draft, onChange]);

  // Drop the autoFocus hint into the contenteditable on first mount.
  useEffect(() => {
    if (!autoFocus) return;
    const el = containerRef.current?.querySelector<HTMLElement>('[contenteditable="true"]');
    el?.focus();
  }, [autoFocus]);

  return (
    <div ref={containerRef}>
      <RichTextEditor
        value={draft}
        onChange={setDraft}
        placeholder={t('lesson_empty_placeholder', { defaultValue: 'Start writing your lesson…' })}
        bordered={false}
        editorClassName="min-h-[80px] px-0 py-2 prose prose-sm dark:prose-invert max-w-none focus-within:outline-none"
      />
    </div>
  );
};
