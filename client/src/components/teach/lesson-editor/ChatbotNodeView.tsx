import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { NodeViewWrapper, type NodeViewProps } from '@tiptap/react';
import { Bot, Sparkles, Search, Trash2 } from 'lucide-react';
import { useTheme } from '../../../hooks/useTheme';
import apiClient from '../../../api/client';

interface AIComponent {
  id: number;
  name: string;
  displayName: string;
  description: string | null;
  systemPrompt: string;
  category: string;
  isActive: boolean;
}

/**
 * Inline Chatbot node — minimal card with the chatbot's title +
 * intro and a "Change" button. When unset, the body is the picker
 * itself. Sits inside the Tiptap editor flow.
 */
export const ChatbotNodeView = ({ node, updateAttributes, deleteNode, editor }: NodeViewProps) => {
  const { t } = useTranslation('teaching');
  const { isDark } = useTheme();
  const editable = editor?.isEditable ?? true;
  const title = node.attrs.chatbotTitle as string;
  const intro = node.attrs.chatbotIntro as string;

  const [pickerOpen, setPickerOpen] = useState(!title);
  const [search, setSearch] = useState('');

  const { data: components = [], isLoading } = useQuery({
    queryKey: ['ai-components-library'],
    queryFn: async () => {
      const response = await apiClient.get<{ success: boolean; data: AIComponent[] }>('/chatbots');
      return response.data.data.filter(c => c.isActive);
    },
    enabled: pickerOpen && editable,
  });

  const cardBg = isDark ? '#1f2937' : '#ffffff';
  const cardBorder = isDark ? '#374151' : '#e5e7eb';
  const subtle = isDark ? '#cbd5e1' : '#374151';
  const muted = isDark ? '#9ca3af' : '#6b7280';
  const accent = isDark ? '#a78bfa' : '#7c3aed';

  const apply = (c: AIComponent) => {
    updateAttributes({
      chatbotTitle: c.displayName,
      chatbotIntro: c.description ?? '',
      chatbotSystemPrompt: c.systemPrompt,
      chatbotWelcome: `Hi! I'm ${c.displayName}. How can I help you today?`,
    });
    setPickerOpen(false);
  };

  const filtered = components.filter(c =>
    c.displayName.toLowerCase().includes(search.toLowerCase()) ||
    (c.description ?? '').toLowerCase().includes(search.toLowerCase()),
  );

  if (pickerOpen && editable) {
    return (
      <NodeViewWrapper as="div" className="my-2" data-drag-handle>
        <div
          className="rounded-xl border px-4 py-4"
          style={{
            backgroundColor: isDark ? 'rgba(167,139,250,0.06)' : '#faf5ff',
            borderColor: isDark ? 'rgba(167,139,250,0.25)' : '#e9d5ff',
          }}
          contentEditable={false}
        >
          <div className="flex items-center justify-between gap-2 mb-3">
            <div className="inline-flex items-center gap-2">
              <Sparkles className="w-4 h-4" style={{ color: accent }} />
              <span className="text-sm font-semibold" style={{ color: subtle }}>
                {t('ai_component_library', { defaultValue: 'Pick a chatbot' })}
              </span>
            </div>
            <button
              type="button"
              onClick={() => deleteNode()}
              className="inline-flex items-center justify-center w-7 h-7 rounded hover:bg-black/5 dark:hover:bg-white/5"
              style={{ color: '#ef4444' }}
              aria-label={t('common:delete', { defaultValue: 'Delete' })}
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="relative mb-2">
            <Search
              className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5"
              style={{ color: muted }}
            />
            <input
              autoFocus
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder={t('search', { defaultValue: 'Search…' })}
              className="w-full pl-8 pr-3 py-2 text-sm rounded-lg border focus:outline-none focus:ring-2 focus:ring-violet-300"
              style={{ backgroundColor: cardBg, borderColor: cardBorder, color: subtle }}
            />
          </div>
          <div
            className="max-h-64 overflow-y-auto rounded-lg border"
            style={{ borderColor: cardBorder, backgroundColor: cardBg }}
          >
            {isLoading ? (
              <div className="px-3 py-6 text-center text-sm" style={{ color: muted }}>
                {t('common:loading', { defaultValue: 'Loading…' })}
              </div>
            ) : filtered.length === 0 ? (
              <div className="px-3 py-6 text-center text-sm" style={{ color: muted }}>
                {t('common:no_results', { defaultValue: 'No results' })}
              </div>
            ) : (
              filtered.map(c => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => apply(c)}
                  className="w-full text-left px-3 py-2.5 hover:bg-black/5 dark:hover:bg-white/5 border-b last:border-b-0"
                  style={{ borderColor: cardBorder }}
                >
                  <div className="text-sm font-medium" style={{ color: subtle }}>
                    {c.displayName}
                  </div>
                  {c.description && (
                    <div className="text-xs mt-0.5 line-clamp-2" style={{ color: muted }}>
                      {c.description}
                    </div>
                  )}
                </button>
              ))
            )}
          </div>
          {title && (
            <button
              type="button"
              onClick={() => setPickerOpen(false)}
              className="mt-3 text-sm font-medium"
              style={{ color: muted }}
            >
              {t('common:cancel', { defaultValue: 'Cancel' })}
            </button>
          )}
        </div>
      </NodeViewWrapper>
    );
  }

  return (
    <NodeViewWrapper as="div" className="my-2" data-drag-handle>
      <div
        className="flex items-center gap-3 rounded-xl border px-4 py-3"
        style={{
          backgroundColor: isDark ? 'rgba(167,139,250,0.06)' : '#faf5ff',
          borderColor: isDark ? 'rgba(167,139,250,0.25)' : '#e9d5ff',
        }}
        contentEditable={false}
      >
        <div
          className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
          style={{
            backgroundColor: isDark ? 'rgba(167,139,250,0.18)' : '#ede9fe',
            color: accent,
          }}
        >
          <Bot className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-medium truncate" style={{ color: subtle }}>
            {title}
          </p>
          {intro && (
            <p className="text-xs truncate" style={{ color: muted }}>
              {intro}
            </p>
          )}
        </div>
        {editable && (
          <>
            <button
              type="button"
              onClick={() => setPickerOpen(true)}
              className="text-sm font-medium px-3 py-1.5 rounded-lg transition-colors"
              style={{ color: accent }}
            >
              {t('change_chatbot', { defaultValue: 'Change' })}
            </button>
            <button
              type="button"
              onClick={() => deleteNode()}
              className="inline-flex items-center justify-center w-7 h-7 rounded hover:bg-black/5 dark:hover:bg-white/5"
              style={{ color: '#ef4444' }}
              aria-label={t('common:delete', { defaultValue: 'Delete' })}
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </>
        )}
      </div>
    </NodeViewWrapper>
  );
};
