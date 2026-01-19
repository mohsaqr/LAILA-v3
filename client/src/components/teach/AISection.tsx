import { useState } from 'react';
import { Sparkles, Eye, Edit2, RefreshCw } from 'lucide-react';
import { useMutation } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { LectureSection } from '../../types';
import { coursesApi } from '../../api/courses';
import { Button } from '../common/Button';
import { Modal } from '../common/Modal';

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
  const [showPreview, setShowPreview] = useState(false);
  const [showGenerateModal, setShowGenerateModal] = useState(!section.content);
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
      toast.success('Content generated successfully');
    },
    onError: () => {
      toast.error('Failed to generate content. Please try again.');
    },
  });

  const handleGenerate = () => {
    if (!prompt.trim()) {
      toast.error('Please enter a prompt');
      return;
    }
    if (prompt.trim().length < 10) {
      toast.error('Prompt must be at least 10 characters');
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
          <span>AI Generated Content</span>
        </div>
        <div
          className="prose prose-sm max-w-none p-4 bg-purple-50 rounded-lg border border-purple-100"
          dangerouslySetInnerHTML={{ __html: renderMarkdown(content) }}
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
            <span>AI Generated Section</span>
          </div>
          <div className="border-2 border-dashed border-purple-200 rounded-lg p-8 text-center bg-purple-50">
            <Sparkles className="w-10 h-10 text-purple-400 mx-auto mb-3" />
            <p className="text-gray-600 mb-4">
              Generate educational content using AI
            </p>
            <Button
              variant="primary"
              size="sm"
              onClick={() => setShowGenerateModal(true)}
              icon={<Sparkles className="w-4 h-4" />}
            >
              Generate Content
            </Button>
          </div>
        </div>

        <Modal
          isOpen={showGenerateModal}
          onClose={() => setShowGenerateModal(false)}
          title="Generate AI Content"
          size="lg"
        >
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                What would you like to generate?
              </label>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="e.g., Generate an introduction to machine learning that covers:
- What is machine learning?
- Types of machine learning (supervised, unsupervised, reinforcement)
- Real-world applications
- Basic terminology students should know"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg outline-none transition-all focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                rows={6}
              />
              <p className="text-xs text-gray-500 mt-1">
                Be specific about what topics to cover, the tone, and any examples you want included.
              </p>
            </div>

            {courseTitle && (
              <div className="text-sm text-gray-500 bg-gray-50 rounded-lg p-3">
                <span className="font-medium">Context:</span> {courseTitle}
                {lectureTitle && ` / ${lectureTitle}`}
              </div>
            )}

            <div className="flex justify-end gap-3 pt-4">
              <Button
                variant="secondary"
                onClick={() => setShowGenerateModal(false)}
                disabled={generateMutation.isPending}
              >
                Cancel
              </Button>
              <Button
                onClick={handleGenerate}
                loading={generateMutation.isPending}
                icon={<Sparkles className="w-4 h-4" />}
              >
                {generateMutation.isPending ? 'Generating...' : 'Generate'}
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
          <span>AI Generated Section</span>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowGenerateModal(true)}
            icon={<RefreshCw className="w-4 h-4" />}
          >
            Regenerate
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowPreview(!showPreview)}
            icon={showPreview ? <Edit2 className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          >
            {showPreview ? 'Edit' : 'Preview'}
          </Button>
        </div>
      </div>

      {showPreview ? (
        <div
          className="prose prose-sm max-w-none p-4 border border-purple-200 rounded-lg min-h-[200px] bg-purple-50"
          dangerouslySetInnerHTML={{ __html: renderMarkdown(content) }}
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
            You can edit the AI-generated content. It supports Markdown formatting.
          </p>
        </div>
      )}

      <Modal
        isOpen={showGenerateModal}
        onClose={() => setShowGenerateModal(false)}
        title="Regenerate AI Content"
        size="lg"
      >
        <div className="space-y-4">
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-sm text-yellow-800">
            This will replace the current content. Make sure to save any changes you want to keep.
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              What would you like to generate?
            </label>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Describe what content you want to generate..."
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
              Cancel
            </Button>
            <Button
              onClick={handleGenerate}
              loading={generateMutation.isPending}
              icon={<Sparkles className="w-4 h-4" />}
            >
              {generateMutation.isPending ? 'Generating...' : 'Regenerate'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
