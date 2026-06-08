import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { NodeViewWrapper, type NodeViewProps } from '@tiptap/react';
import { Bot, Sparkles, Search, Trash2 } from 'lucide-react';
import { useTheme } from '../../../hooks/useTheme';
import apiClient from '../../../api/client';
import { getCourseTutors } from '../../../api/courseTutor';
import { BlockCard } from './BlockCard';

interface AIComponent {
  id: number;
  name: string;
  displayName: string;
  description: string | null;
  systemPrompt: string;
  category: string;
  isActive: boolean;
}

/** A pickable agent, normalized from either a course tutor or a global
 *  chatbot so both render in one searchable, grouped list. */
interface AgentOption {
  key: string;
  displayName: string;
  description: string;
  systemPrompt: string;
  welcome: string;
  group: 'course' | 'global';
}

/**
 * Inline Chatbot node — minimal card with the chatbot's title +
 * intro and a "Change" button. When unset, the body is the picker
 * itself. Sits inside the Tiptap editor flow.
 */
export const ChatbotNodeView = ({ node, updateAttributes, deleteNode, editor, extension }: NodeViewProps) => {
  const { t } = useTranslation('teaching');
  const { isDark } = useTheme();
  const editable = editor?.isEditable ?? true;
  const title = node.attrs.chatbotTitle as string;
  const intro = node.attrs.chatbotIntro as string;
  const courseId = (extension?.options?.courseId as number | null) ?? null;

  const [pickerOpen, setPickerOpen] = useState(!title);
  const [search, setSearch] = useState('');

  // Global chatbots — available to embed in any course.
  const { data: components = [], isLoading } = useQuery({
    queryKey: ['ai-components-library'],
    queryFn: async () => {
      const response = await apiClient.get<{ success: boolean; data: AIComponent[] }>('/chatbots');
      return response.data.data.filter(c => c.isActive);
    },
    enabled: pickerOpen && editable,
  });

  // This course's own AI tutors (CourseTutor). Only fetched when we have a
  // course context; merges the per-course customizations over the base bot.
  const { data: courseTutors = [], isLoading: tutorsLoading } = useQuery({
    queryKey: ['course-tutors', courseId],
    queryFn: () => getCourseTutors(courseId as number),
    enabled: pickerOpen && editable && courseId != null,
  });

  const cardBg = isDark ? '#1f2937' : '#ffffff';
  const cardBorder = isDark ? '#374151' : '#e5e7eb';
  const subtle = isDark ? '#cbd5e1' : '#374151';
  const muted = isDark ? '#9ca3af' : '#6b7280';
  const accent = isDark ? '#a78bfa' : '#7c3aed';

  const apply = (a: AgentOption) => {
    updateAttributes({
      chatbotTitle: a.displayName,
      chatbotIntro: a.description,
      chatbotSystemPrompt: a.systemPrompt,
      chatbotWelcome: a.welcome,
    });
    setPickerOpen(false);
  };

  // Normalize both sources into one shape. Course tutors apply their
  // per-course overrides (customName / customSystemPrompt / …) on top of
  // the underlying chatbot.
  const courseOptions: AgentOption[] = courseTutors
    .filter(ct => ct.isActive)
    .map(ct => {
      const displayName = ct.customName || ct.chatbot?.displayName || 'Tutor';
      return {
        key: `course-${ct.id}`,
        displayName,
        description: ct.customDescription || ct.chatbot?.description || '',
        systemPrompt: ct.customSystemPrompt || ct.chatbot?.systemPrompt || '',
        welcome: ct.customWelcomeMessage || ct.chatbot?.welcomeMessage || `Hi! I'm ${displayName}. How can I help you today?`,
        group: 'course' as const,
      };
    });

  const globalOptions: AgentOption[] = components.map(c => ({
    key: `global-${c.id}`,
    displayName: c.displayName,
    description: c.description ?? '',
    systemPrompt: c.systemPrompt,
    welcome: `Hi! I'm ${c.displayName}. How can I help you today?`,
    group: 'global' as const,
  }));

  const matches = (a: AgentOption) =>
    a.displayName.toLowerCase().includes(search.toLowerCase()) ||
    a.description.toLowerCase().includes(search.toLowerCase());

  const filteredCourse = courseOptions.filter(matches);
  const filteredGlobal = globalOptions.filter(matches);
  const loading = isLoading || tutorsLoading;
  const hasAny = filteredCourse.length > 0 || filteredGlobal.length > 0;

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
                {t('embed_ai_agent_picker', { defaultValue: 'Embed an AI agent' })}
              </span>
            </div>
            <button
              type="button"
              onClick={() => deleteNode()}
              className="inline-flex items-center justify-center w-7 h-7 rounded hover:bg-black/5 dark:hover:bg-white/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400"
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
              aria-label={t('search', { defaultValue: 'Search…' })}
              className="w-full pl-8 pr-3 py-2 text-sm rounded-lg border focus:outline-none focus:ring-2 focus:ring-violet-400"
              style={{ backgroundColor: cardBg, borderColor: cardBorder, color: subtle }}
            />
          </div>
          <div
            className="max-h-64 overflow-y-auto rounded-lg border"
            style={{ borderColor: cardBorder, backgroundColor: cardBg }}
          >
            {loading ? (
              <div className="px-3 py-6 text-center text-sm" style={{ color: muted }}>
                {t('common:loading', { defaultValue: 'Loading…' })}
              </div>
            ) : !hasAny ? (
              <div className="px-3 py-6 text-center text-sm" style={{ color: muted }}>
                {t('common:no_results', { defaultValue: 'No results' })}
              </div>
            ) : (
              <>
                {filteredCourse.length > 0 && (
                  <>
                    <div
                      className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide sticky top-0"
                      style={{ color: muted, backgroundColor: cardBg }}
                    >
                      {t('agents_from_this_course', { defaultValue: 'From this course' })}
                    </div>
                    {filteredCourse.map(a => (
                      <button
                        key={a.key}
                        type="button"
                        onClick={() => apply(a)}
                        className="w-full text-left px-3 py-2.5 hover:bg-black/5 dark:hover:bg-white/5 border-b last:border-b-0 focus:outline-none focus-visible:bg-black/5 dark:focus-visible:bg-white/5 transition-colors"
                        style={{ borderColor: cardBorder }}
                      >
                        <div className="text-sm font-medium truncate" style={{ color: subtle }} title={a.displayName}>
                          {a.displayName}
                        </div>
                        {a.description && (
                          <div className="text-xs mt-0.5 line-clamp-2" style={{ color: muted }}>
                            {a.description}
                          </div>
                        )}
                      </button>
                    ))}
                  </>
                )}
                {filteredGlobal.length > 0 && (
                  <>
                    <div
                      className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide sticky top-0"
                      style={{ color: muted, backgroundColor: cardBg }}
                    >
                      {t('agents_all_chatbots', { defaultValue: 'All chatbots' })}
                    </div>
                    {filteredGlobal.map(a => (
                      <button
                        key={a.key}
                        type="button"
                        onClick={() => apply(a)}
                        className="w-full text-left px-3 py-2.5 hover:bg-black/5 dark:hover:bg-white/5 border-b last:border-b-0 focus:outline-none focus-visible:bg-black/5 dark:focus-visible:bg-white/5 transition-colors"
                        style={{ borderColor: cardBorder }}
                      >
                        <div className="text-sm font-medium truncate" style={{ color: subtle }} title={a.displayName}>
                          {a.displayName}
                        </div>
                        {a.description && (
                          <div className="text-xs mt-0.5 line-clamp-2" style={{ color: muted }}>
                            {a.description}
                          </div>
                        )}
                      </button>
                    ))}
                  </>
                )}
              </>
            )}
          </div>
          {title && (
            <button
              type="button"
              onClick={() => setPickerOpen(false)}
              className="mt-3 text-sm font-medium rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 hover:underline"
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
    <NodeViewWrapper as="div" className="my-3" data-drag-handle>
      <BlockCard
        icon={Bot}
        accent="violet"
        title={title}
        badge={t('agent_badge', { defaultValue: 'Agent' })}
        actions={editable ? (
          <>
            <button
              type="button"
              onClick={() => setPickerOpen(true)}
              className="text-xs font-medium px-2 py-1 rounded hover:bg-black/5 dark:hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-400"
              style={{ color: accent }}
            >
              {t('change_chatbot', { defaultValue: 'Change' })}
            </button>
            <button
              type="button"
              onClick={() => deleteNode()}
              className="inline-flex items-center justify-center w-7 h-7 rounded hover:bg-black/5 dark:hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400"
              style={{ color: '#ef4444' }}
              aria-label={t('common:delete', { defaultValue: 'Delete' })}
              title={t('common:delete', { defaultValue: 'Delete' })}
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </>
        ) : undefined}
      >
        <p className="text-sm" style={{ color: muted }} contentEditable={false}>
          {intro || t('agent_summary_hint', { defaultValue: 'Students chat with this AI agent in this section.' })}
        </p>
      </BlockCard>
    </NodeViewWrapper>
  );
};
