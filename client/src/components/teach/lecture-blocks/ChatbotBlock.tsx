import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { Bot, Sparkles, Search } from 'lucide-react';
import { useTheme } from '../../../hooks/useTheme';
import apiClient from '../../../api/client';
import type { LectureSection, UpdateSectionData } from '../../../types';

interface AIComponent {
  id: number;
  name: string;
  displayName: string;
  description: string | null;
  systemPrompt: string;
  category: string;
  isActive: boolean;
}

interface ChatbotBlockProps {
  section: LectureSection;
  onChange: (data: UpdateSectionData) => void;
}

/**
 * Chatbot block — minimal card with the chatbot's display name and a
 * one-line intro plus a "Change" button. When no chatbot is selected
 * yet, the body is the picker itself (so empty state is one click
 * away from done).
 */
export const ChatbotBlock = ({ section, onChange }: ChatbotBlockProps) => {
  const { t } = useTranslation('teaching');
  const { isDark } = useTheme();
  const [pickerOpen, setPickerOpen] = useState(!section.chatbotTitle);
  const [search, setSearch] = useState('');

  const { data: components = [], isLoading } = useQuery({
    queryKey: ['ai-components-library'],
    queryFn: async () => {
      const response = await apiClient.get<{ success: boolean; data: AIComponent[] }>('/chatbots');
      return response.data.data.filter(c => c.isActive);
    },
    enabled: pickerOpen,
  });

  const cardBg = isDark ? '#1f2937' : '#ffffff';
  const cardBorder = isDark ? '#374151' : '#e5e7eb';
  const subtle = isDark ? '#cbd5e1' : '#374151';
  const muted = isDark ? '#9ca3af' : '#6b7280';
  const accent = isDark ? '#a78bfa' : '#7c3aed';

  const apply = (c: AIComponent) => {
    onChange({
      chatbotTitle: c.displayName,
      chatbotIntro: c.description ?? undefined,
      chatbotSystemPrompt: c.systemPrompt,
      chatbotWelcome: `Hi! I'm ${c.displayName}. How can I help you today?`,
    });
    setPickerOpen(false);
  };

  const filtered = components.filter(c =>
    c.displayName.toLowerCase().includes(search.toLowerCase()) ||
    (c.description ?? '').toLowerCase().includes(search.toLowerCase()),
  );

  if (pickerOpen) {
    return (
      <div
        className="rounded-xl border px-4 py-4"
        style={{
          backgroundColor: isDark ? 'rgba(167,139,250,0.06)' : '#faf5ff',
          borderColor: isDark ? 'rgba(167,139,250,0.25)' : '#e9d5ff',
        }}
      >
        <div className="flex items-center gap-2 mb-3">
          <Sparkles className="w-4 h-4" style={{ color: accent }} />
          <span className="text-sm font-semibold" style={{ color: subtle }}>
            {t('ai_component_library', { defaultValue: 'Pick a chatbot' })}
          </span>
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
            style={{
              backgroundColor: cardBg,
              borderColor: cardBorder,
              color: subtle,
            }}
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
        {section.chatbotTitle && (
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
    );
  }

  return (
    <div
      className="flex items-center gap-3 rounded-xl border px-4 py-3"
      style={{
        backgroundColor: isDark ? 'rgba(167,139,250,0.06)' : '#faf5ff',
        borderColor: isDark ? 'rgba(167,139,250,0.25)' : '#e9d5ff',
      }}
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
          {section.chatbotTitle}
        </p>
        {section.chatbotIntro && (
          <p className="text-xs truncate" style={{ color: muted }}>
            {section.chatbotIntro}
          </p>
        )}
      </div>
      <button
        type="button"
        onClick={() => setPickerOpen(true)}
        className="text-sm font-medium px-3 py-1.5 rounded-lg transition-colors"
        style={{ color: accent }}
      >
        {t('change_chatbot', { defaultValue: 'Change' })}
      </button>
    </div>
  );
};
