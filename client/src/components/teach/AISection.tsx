import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Sparkles, Eye, Edit2, RefreshCw } from 'lucide-react';
import { useMutation } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { LectureSection } from '../../types';
import { coursesApi } from '../../api/courses';
import { Button } from '../common/Button';
import { Modal } from '../common/Modal';
import { sanitizeHtml } from '../../utils/sanitize';

interface AISectionProps {
  section: LectureSection;
  onChange: (content: string) => void;
  lectureTitle?: string;
  courseTitle?: string;
  readOnly?: boolean;
}

export const AISection = ({
  section,
  onChange,
  lectureTitle,
  courseTitle,
  readOnly = false,
}: AISectionProps) => {
  const { t } = useTranslation(['teaching']);
  const [showPreview, setShowPreview] = useState(false);
  const [showGenerateModal, setShowGenerateModal] = useState(false); // Don't auto-open modal
  const [prompt, setPrompt] = useState('');
  const content = section.content || '';

  const generateMutation = useMutation({
    mutationFn: (promptText: string) =>
      coursesApi.generateAIContent({
        prompt: promptText,
        context: courseTitle && lectureTitle
          ? `Course: ${courseTitle}\nLecture: ${lectureTitle}`
          : undefined,
      }),
    onSuccess: (data) => {
      onChange(data.content);
      setShowGenerateModal(false);
      setPrompt('');
      toast.success(t('content_generated_success'));
    },
    onError: () => {
      toast.error(t('content_generation_failed'));
    },
  });

  const handleGenerate = () => {
    if (!prompt.trim()) {
      toast.error(t('please_enter_prompt'));
      return;
    }
    if (prompt.trim().length < 10) {
      toast.error(t('prompt_min_length'));
      return;
    }
    generateMutation.mutate(prompt);
  };

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
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-sm text-purple-600">
          <Sparkles className="w-4 h-4" />
          <span>{t('ai_generated_content')}</span>
        </div>
        <div
          className="prose prose-sm max-w-none p-4 bg-purple-50 rounded-lg border border-purple-100"
          dangerouslySetInnerHTML={{ __html: sanitizeHtml(renderMarkdown(content)) }}
        />
      </div>
    );
  }

  // Show generate prompt if no content yet
  if (!content) {
    return (
      <>
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm text-purple-600">
            <Sparkles className="w-4 h-4" />
            <span>{t('ai_generated_section')}</span>
          </div>
          <div className="border-2 border-dashed border-purple-200 rounded-lg p-8 text-center bg-purple-50">
            <Sparkles className="w-10 h-10 text-purple-400 mx-auto mb-3" />
            <p className="text-gray-600 mb-4">
              {t('generate_content_description')}
            </p>
            <Button
              variant="primary"
              size="sm"
              onClick={() => setShowGenerateModal(true)}
              icon={<Sparkles className="w-4 h-4" />}
            >
              {t('generate_content')}
            </Button>
          </div>
        </div>

        <Modal
          isOpen={showGenerateModal}
          onClose={() => setShowGenerateModal(false)}
          title={t('generate_ai_content')}
          size="lg"
        >
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                {t('what_to_generate')}
              </label>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder={t('generate_prompt_placeholder')}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg outline-none transition-all focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                rows={6}
              />
              <p className="text-xs text-gray-500 mt-1">
                {t('generate_prompt_help')}
              </p>
            </div>

            {courseTitle && (
              <div className="text-sm text-gray-500 bg-gray-50 rounded-lg p-3">
                <span className="font-medium">{t('context')}:</span> {courseTitle}
                {lectureTitle && ` / ${lectureTitle}`}
              </div>
            )}

            <div className="flex justify-end gap-3 pt-4">
              <Button
                variant="secondary"
                onClick={() => setShowGenerateModal(false)}
                disabled={generateMutation.isPending}
              >
                {t('cancel')}
              </Button>
              <Button
                onClick={handleGenerate}
                loading={generateMutation.isPending}
                icon={<Sparkles className="w-4 h-4" />}
              >
                {generateMutation.isPending ? t('generating') : t('generate')}
              </Button>
            </div>
          </div>
        </Modal>
      </>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm text-purple-600">
          <Sparkles className="w-4 h-4" />
          <span>{t('ai_generated_section')}</span>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowGenerateModal(true)}
            icon={<RefreshCw className="w-4 h-4" />}
          >
            {t('regenerate')}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowPreview(!showPreview)}
            icon={showPreview ? <Edit2 className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          >
            {showPreview ? t('edit') : t('preview')}
          </Button>
        </div>
      </div>

      {showPreview ? (
        <div
          className="prose prose-sm max-w-none p-4 border border-purple-200 rounded-lg min-h-[200px] bg-purple-50"
          dangerouslySetInnerHTML={{ __html: sanitizeHtml(renderMarkdown(content)) }}
        />
      ) : (
        <div>
          <textarea
            value={content}
            onChange={(e) => onChange(e.target.value)}
            className="w-full px-4 py-3 border border-purple-200 rounded-lg outline-none transition-all focus:ring-2 focus:ring-purple-500 focus:border-purple-500 font-mono text-sm bg-purple-50"
            rows={12}
          />
          <p className="text-xs text-gray-500 mt-1">
            {t('ai_content_edit_help')}
          </p>
        </div>
      )}

      <Modal
        isOpen={showGenerateModal}
        onClose={() => setShowGenerateModal(false)}
        title={t('regenerate_ai_content')}
        size="lg"
      >
        <div className="space-y-4">
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-sm text-yellow-800">
            {t('regenerate_warning')}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              {t('what_to_generate')}
            </label>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder={t('describe_content_placeholder')}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg outline-none transition-all focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              rows={6}
            />
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button
              variant="secondary"
              onClick={() => setShowGenerateModal(false)}
              disabled={generateMutation.isPending}
            >
              {t('cancel')}
            </Button>
            <Button
              onClick={handleGenerate}
              loading={generateMutation.isPending}
              icon={<Sparkles className="w-4 h-4" />}
            >
              {generateMutation.isPending ? t('generating') : t('regenerate')}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
