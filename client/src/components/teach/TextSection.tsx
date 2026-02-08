import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FileText, Eye, Edit2 } from 'lucide-react';
import { LectureSection } from '../../types';
import { Button } from '../common/Button';
import { sanitizeHtml } from '../../utils/sanitize';

interface TextSectionProps {
  section: LectureSection;
  onChange: (content: string) => void;
  readOnly?: boolean;
}

export const TextSection = ({ section, onChange, readOnly = false }: TextSectionProps) => {
  const { t } = useTranslation(['teaching']);
  const [showPreview, setShowPreview] = useState(false);
  const content = section.content || '';

  const renderMarkdown = (text: string) => {
    // Simple markdown rendering
    let html = text
      // Escape HTML
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      // Headers
      .replace(/^### (.*$)/gm, '<h3 class="text-lg font-semibold mt-4 mb-2">$1</h3>')
      .replace(/^## (.*$)/gm, '<h2 class="text-xl font-semibold mt-6 mb-3">$1</h2>')
      .replace(/^# (.*$)/gm, '<h1 class="text-2xl font-bold mt-6 mb-3">$1</h1>')
      // Bold and italic
      .replace(/\*\*\*(.*?)\*\*\*/g, '<strong><em>$1</em></strong>')
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      // Code blocks
      .replace(/```(\w*)\n([\s\S]*?)```/g, '<pre class="bg-gray-100 p-4 rounded-lg overflow-x-auto my-4"><code>$2</code></pre>')
      // Inline code
      .replace(/`(.*?)`/g, '<code class="bg-gray-100 px-1 py-0.5 rounded text-sm">$1</code>')
      // Links
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" class="text-primary-600 hover:underline" target="_blank" rel="noopener noreferrer">$1</a>')
      // Lists
      .replace(/^\s*[-*]\s+(.*$)/gm, '<li class="ml-4">$1</li>')
      // Line breaks
      .replace(/\n\n/g, '</p><p class="mb-4">')
      .replace(/\n/g, '<br/>');

    // Wrap in paragraph if not starting with special element
    if (!html.startsWith('<h') && !html.startsWith('<pre') && !html.startsWith('<li')) {
      html = '<p class="mb-4">' + html + '</p>';
    }

    // Wrap consecutive list items
    html = html.replace(/(<li[^>]*>.*?<\/li>)+/g, '<ul class="list-disc mb-4">$&</ul>');

    return html;
  };

  if (readOnly) {
    return (
      <div
        className="prose prose-sm max-w-none p-4 bg-gray-50 rounded-lg"
        dangerouslySetInnerHTML={{ __html: sanitizeHtml(renderMarkdown(content)) }}
      />
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <FileText className="w-4 h-4" />
          <span>{t('text_section')}</span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowPreview(!showPreview)}
          icon={showPreview ? <Edit2 className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
        >
          {showPreview ? t('edit') : t('preview')}
        </Button>
      </div>

      {showPreview ? (
        <div
          className="prose prose-sm max-w-none p-4 border border-gray-200 rounded-lg min-h-[200px] bg-gray-50"
          dangerouslySetInnerHTML={{ __html: sanitizeHtml(renderMarkdown(content)) }}
        />
      ) : (
        <div>
          <textarea
            value={content}
            onChange={(e) => onChange(e.target.value)}
            placeholder={t('text_section_placeholder')}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg outline-none transition-all focus:ring-2 focus:ring-primary-500 focus:border-primary-500 font-mono text-sm"
            rows={12}
          />
          <p className="text-xs text-gray-500 mt-1">
            {t('markdown_help')}
          </p>
        </div>
      )}
    </div>
  );
};
