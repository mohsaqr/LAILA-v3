import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { MessageCircle, Image, X, Eye, Edit2, ImagePlus, Library, ChevronDown, Sparkles } from 'lucide-react';
import { LectureSection, UpdateSectionData } from '../../types';
import { Input, TextArea } from '../common/Input';
import { Button } from '../common/Button';
import apiClient from '../../api/client';
import { sanitizeHtml } from '../../utils/sanitize';

interface AIComponent {
  id: number;
  name: string;
  displayName: string;
  description: string | null;
  systemPrompt: string;
  category: string;
  isActive: boolean;
}

interface ChatbotSectionProps {
  section: LectureSection;
  onChange: (data: UpdateSectionData) => void;
  readOnly?: boolean;
}

// Rich text editor component for chatbot intro with markdown and image support
const RichIntroEditor = ({
  value,
  onChange,
  onBlur,
}: {
  value: string;
  onChange: (value: string) => void;
  onBlur: () => void;
}) => {
  const [showPreview, setShowPreview] = useState(false);
  const [imageUrlInput, setImageUrlInput] = useState('');
  const [showImageModal, setShowImageModal] = useState(false);

  const renderMarkdown = (text: string) => {
    let html = text
      // Escape HTML (but preserve img tags we'll add)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      // Images - render before other transforms
      .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" class="max-w-full rounded-lg my-2" />')
      // Headers
      .replace(/^### (.*$)/gm, '<h3 class="text-lg font-semibold mt-3 mb-1">$1</h3>')
      .replace(/^## (.*$)/gm, '<h2 class="text-xl font-semibold mt-4 mb-2">$1</h2>')
      .replace(/^# (.*$)/gm, '<h1 class="text-2xl font-bold mt-4 mb-2">$1</h1>')
      // Bold and italic
      .replace(/\*\*\*(.*?)\*\*\*/g, '<strong><em>$1</em></strong>')
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      // Inline code
      .replace(/`(.*?)`/g, '<code class="bg-gray-100 px-1 py-0.5 rounded text-sm">$1</code>')
      // Links
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" class="text-primary-600 hover:underline" target="_blank" rel="noopener noreferrer">$1</a>')
      // Lists
      .replace(/^\s*[-*]\s+(.*$)/gm, '<li class="ml-4">$1</li>')
      // Line breaks
      .replace(/\n\n/g, '</p><p class="mb-3">')
      .replace(/\n/g, '<br/>');

    // Wrap in paragraph if not starting with special element
    if (!html.startsWith('<h') && !html.startsWith('<img') && !html.startsWith('<li')) {
      html = '<p class="mb-3">' + html + '</p>';
    }

    // Wrap consecutive list items
    html = html.replace(/(<li[^>]*>.*?<\/li>)+/g, '<ul class="list-disc mb-3">$&</ul>');

    return html;
  };

  const insertImage = () => {
    if (!imageUrlInput.trim()) return;
    const imageMarkdown = `\n![Image](${imageUrlInput.trim()})\n`;
    onChange(value + imageMarkdown);
    setImageUrlInput('');
    setShowImageModal(false);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="block text-sm font-medium text-gray-700">
          Introduction Content
        </label>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setShowImageModal(true)}
            icon={<ImagePlus className="w-4 h-4" />}
          >
            Add Image
          </Button>
          <Button
            type="button"
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
          className="prose prose-sm max-w-none p-4 border border-gray-200 rounded-lg min-h-[150px] bg-gray-50"
          dangerouslySetInnerHTML={{ __html: sanitizeHtml(renderMarkdown(value || 'No content yet...')) }}
        />
      ) : (
        <div>
          <textarea
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onBlur={onBlur}
            placeholder="Write your introduction here...

**Bold text** and *italic text*

Add images: ![description](https://example.com/image.png)

- Bullet point 1
- Bullet point 2

[Link text](https://example.com)"
            className="w-full px-4 py-3 border border-gray-300 rounded-lg outline-none transition-all focus:ring-2 focus:ring-primary-500 focus:border-primary-500 font-mono text-sm"
            rows={6}
          />
          <p className="text-xs text-gray-500 mt-1">
            Supports Markdown: **bold**, *italic*, ![image](url), [links](url), lists
          </p>
        </div>
      )}

      {/* Image URL Modal */}
      {showImageModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md mx-4">
            <h3 className="text-lg font-semibold mb-4">Add Image</h3>
            <Input
              label="Image URL"
              value={imageUrlInput}
              onChange={(e) => setImageUrlInput(e.target.value)}
              placeholder="https://example.com/image.png"
              helpText="Enter the URL of an image to embed"
            />
            {imageUrlInput && (
              <div className="mt-3 p-2 border rounded-lg bg-gray-50">
                <p className="text-xs text-gray-500 mb-2">Preview:</p>
                <img
                  src={imageUrlInput}
                  alt="Preview"
                  className="max-w-full max-h-32 rounded"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none';
                  }}
                />
              </div>
            )}
            <div className="flex justify-end gap-3 mt-4">
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  setShowImageModal(false);
                  setImageUrlInput('');
                }}
              >
                Cancel
              </Button>
              <Button type="button" onClick={insertImage} disabled={!imageUrlInput.trim()}>
                Insert Image
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export const ChatbotSection = ({ section, onChange, readOnly = false }: ChatbotSectionProps) => {
  const { t } = useTranslation(['teaching']);
  const [formData, setFormData] = useState({
    chatbotTitle: section.chatbotTitle || '',
    chatbotIntro: section.chatbotIntro || '',
    chatbotImageUrl: section.chatbotImageUrl || '',
    chatbotSystemPrompt: section.chatbotSystemPrompt || '',
    chatbotWelcome: section.chatbotWelcome || '',
  });
  const [showLibrary, setShowLibrary] = useState(false);
  const [selectedLibraryId, setSelectedLibraryId] = useState<number | null>(null);

  // Fetch AI components library
  const { data: aiComponents } = useQuery({
    queryKey: ['ai-components-library'],
    queryFn: async () => {
      const response = await apiClient.get<{ success: boolean; data: AIComponent[] }>('/chatbots');
      return response.data.data.filter(c => c.isActive);
    },
  });

  // Sync with external changes
  useEffect(() => {
    setFormData({
      chatbotTitle: section.chatbotTitle || '',
      chatbotIntro: section.chatbotIntro || '',
      chatbotImageUrl: section.chatbotImageUrl || '',
      chatbotSystemPrompt: section.chatbotSystemPrompt || '',
      chatbotWelcome: section.chatbotWelcome || '',
    });
  }, [section]);

  // Apply library template
  const applyLibraryTemplate = (component: AIComponent) => {
    const newData = {
      chatbotTitle: component.displayName,
      chatbotIntro: component.description || '',
      chatbotSystemPrompt: component.systemPrompt,
      chatbotWelcome: `Hi! I'm ${component.displayName}. How can I help you today?`,
      chatbotImageUrl: formData.chatbotImageUrl, // Keep existing image
    };
    setFormData(prev => ({ ...prev, ...newData }));
    setSelectedLibraryId(component.id);
    setShowLibrary(false);

    // Trigger onChange for all fields
    onChange({
      chatbotTitle: newData.chatbotTitle,
      chatbotIntro: newData.chatbotIntro,
      chatbotSystemPrompt: newData.chatbotSystemPrompt,
      chatbotWelcome: newData.chatbotWelcome,
    });
  };

  const handleChange = (field: keyof typeof formData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleBlur = (field: keyof typeof formData) => {
    onChange({ [field]: formData[field] || undefined });
  };

  const handleRemoveImage = () => {
    setFormData(prev => ({ ...prev, chatbotImageUrl: '' }));
    onChange({ chatbotImageUrl: null });
  };

  // Render markdown for preview
  const renderMarkdownPreview = (text: string) => {
    return text
      .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" class="max-w-full rounded-lg my-2 inline-block" />')
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" class="text-primary-600 hover:underline">$1</a>')
      .replace(/\n/g, '<br/>');
  };

  if (readOnly) {
    return (
      <div className="space-y-4">
        {formData.chatbotImageUrl && (
          <div className="flex justify-center">
            <img
              src={formData.chatbotImageUrl}
              alt="Chatbot avatar"
              className="w-24 h-24 rounded-full object-cover"
            />
          </div>
        )}
        {formData.chatbotTitle && (
          <h3 className="text-lg font-semibold text-center text-gray-900">
            {formData.chatbotTitle}
          </h3>
        )}
        {formData.chatbotIntro && (
          <div
            className="text-gray-600 text-center"
            dangerouslySetInnerHTML={{ __html: sanitizeHtml(renderMarkdownPreview(formData.chatbotIntro)) }}
          />
        )}
        <div className="bg-gray-50 rounded-lg p-4 flex items-center gap-3">
          <MessageCircle className="w-5 h-5 text-amber-500" />
          <span className="text-sm text-gray-600">
            {t('students_see_chat_interface')}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* AI Library Selector */}
      <div className="bg-gradient-to-r from-violet-50 to-purple-50 rounded-lg p-4 border border-violet-200">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Library className="w-5 h-5 text-violet-600" />
            <span className="font-medium text-gray-900">{t('ai_component_library')}</span>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setShowLibrary(!showLibrary)}
            icon={<ChevronDown className={`w-4 h-4 transition-transform ${showLibrary ? 'rotate-180' : ''}`} />}
          >
            {selectedLibraryId ? t('change_template') : t('choose_template')}
          </Button>
        </div>
        <p className="text-sm text-gray-600">
          {t('ai_library_description')}
        </p>

        {/* Library Dropdown */}
        {showLibrary && aiComponents && (
          <div className="mt-3 bg-white rounded-lg border shadow-lg max-h-64 overflow-y-auto">
            {aiComponents.length === 0 ? (
              <div className="p-4 text-center text-gray-500 text-sm">
                {t('no_ai_components')}
              </div>
            ) : (
              <div className="divide-y">
                {aiComponents.map(component => (
                  <button
                    key={component.id}
                    type="button"
                    onClick={() => applyLibraryTemplate(component)}
                    className={`w-full px-4 py-3 text-left hover:bg-violet-50 flex items-start gap-3 ${
                      selectedLibraryId === component.id ? 'bg-violet-100' : ''
                    }`}
                  >
                    <Sparkles className="w-5 h-5 text-violet-500 mt-0.5 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-gray-900">{component.displayName}</div>
                      <div className="text-sm text-gray-500 truncate">{component.description}</div>
                      <span className="inline-block mt-1 text-xs bg-violet-100 text-violet-700 px-2 py-0.5 rounded">
                        {component.category}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Title */}
      <Input
        label={t('chatbot_title')}
        value={formData.chatbotTitle}
        onChange={e => handleChange('chatbotTitle', e.target.value)}
        onBlur={() => handleBlur('chatbotTitle')}
        placeholder={t('chatbot_title_placeholder')}
        helpText={t('chatbot_title_help')}
      />

      {/* Rich Text Intro Editor */}
      <RichIntroEditor
        value={formData.chatbotIntro}
        onChange={(value) => handleChange('chatbotIntro', value)}
        onBlur={() => handleBlur('chatbotIntro')}
      />

      {/* Avatar Image URL */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {t('avatar_image_optional')}
        </label>
        {formData.chatbotImageUrl ? (
          <div className="flex items-center gap-4">
            <img
              src={formData.chatbotImageUrl}
              alt="Chatbot avatar"
              className="w-16 h-16 rounded-full object-cover"
            />
            <div className="flex-1">
              <Input
                value={formData.chatbotImageUrl}
                onChange={e => handleChange('chatbotImageUrl', e.target.value)}
                onBlur={() => handleBlur('chatbotImageUrl')}
                placeholder="https://example.com/avatar.png"
              />
            </div>
            <button
              onClick={handleRemoveImage}
              className="p-2 text-gray-400 hover:text-red-500 transition-colors"
              title={t('remove_image')}
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center">
              <Image className="w-6 h-6 text-gray-400" />
            </div>
            <div className="flex-1">
              <Input
                value={formData.chatbotImageUrl}
                onChange={e => handleChange('chatbotImageUrl', e.target.value)}
                onBlur={() => handleBlur('chatbotImageUrl')}
                placeholder="https://example.com/avatar.png"
              />
            </div>
          </div>
        )}
        <p className="mt-1 text-xs text-gray-500">{t('avatar_url_help')}</p>
      </div>

      {/* Welcome Message */}
      <TextArea
        label={t('welcome_message')}
        value={formData.chatbotWelcome}
        onChange={e => handleChange('chatbotWelcome', e.target.value)}
        onBlur={() => handleBlur('chatbotWelcome')}
        placeholder={t('welcome_message_placeholder')}
        rows={2}
        helpText={t('welcome_message_help')}
      />

      {/* System Prompt */}
      <TextArea
        label={t('system_prompt')}
        value={formData.chatbotSystemPrompt}
        onChange={e => handleChange('chatbotSystemPrompt', e.target.value)}
        onBlur={() => handleBlur('chatbotSystemPrompt')}
        placeholder={t('system_prompt_placeholder')}
        rows={4}
        helpText={t('system_prompt_help')}
      />

      {/* Preview */}
      <div className="border border-dashed border-gray-300 rounded-lg p-4 bg-gray-50">
        <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">{t('student_preview')}</p>
        <div className="bg-white rounded-lg p-4 shadow-sm">
          {formData.chatbotImageUrl && (
            <div className="flex justify-center mb-3">
              <img
                src={formData.chatbotImageUrl}
                alt={t('chatbot_avatar')}
                className="w-16 h-16 rounded-full object-cover"
              />
            </div>
          )}
          <h4 className="text-center font-medium text-gray-900 mb-2">
            {formData.chatbotTitle || t('chatbot_title_placeholder')}
          </h4>
          {formData.chatbotIntro ? (
            <div
              className="text-center text-sm text-gray-600 mb-3"
              dangerouslySetInnerHTML={{ __html: sanitizeHtml(renderMarkdownPreview(formData.chatbotIntro)) }}
            />
          ) : (
            <p className="text-center text-sm text-gray-600 mb-3">
              {t('chat_with_ai_assistant')}
            </p>
          )}
          <div className="border rounded-lg p-3 bg-gray-50">
            <div className="flex items-start gap-2 mb-2">
              <div className="w-6 h-6 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
                <MessageCircle className="w-3 h-3 text-amber-600" />
              </div>
              <div className="bg-white rounded-lg px-3 py-2 text-sm shadow-sm">
                {formData.chatbotWelcome || t('default_welcome_message')}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
