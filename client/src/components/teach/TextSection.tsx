import { LectureSection } from '../../types';
import { sanitizeHtml } from '../../utils/sanitize';
import { RichTextEditor } from '../forum/RichTextEditor';

interface TextSectionProps {
  section: LectureSection;
  onChange: (content: string) => void;
  readOnly?: boolean;
}

export const TextSection = ({ section, onChange, readOnly = false }: TextSectionProps) => {
  const content = section.content || '';

  if (readOnly) {
    return (
      <div
        className="prose prose-sm dark:prose-invert max-w-none p-4 bg-gray-50 dark:bg-gray-800 rounded-lg"
        dangerouslySetInnerHTML={{ __html: sanitizeHtml(content) }}
      />
    );
  }

  return (
    <RichTextEditor
      value={content}
      onChange={onChange}
      editorClassName="forum-reply-editor px-3 py-2 min-h-[300px] max-h-[600px] overflow-y-auto prose prose-sm dark:prose-invert max-w-none focus-within:outline-none"
    />
  );
};
