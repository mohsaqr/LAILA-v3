/**
 * Chatbot Registry tab — stat strip + DataTable + details modal.
 * Style matches /teach/quizzes (shared DataTable / RowMenu).
 */

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import {
  Bot,
  BookOpen,
  Eye,
  Globe,
  MessageSquare,
  Puzzle,
} from 'lucide-react';
import {
  chatbotRegistryApi,
  UnifiedChatbot,
} from '../../../api/admin';
import { StatCard } from '../../../components/admin/StatCard';
import {
  DataTable,
  type ColumnDef,
} from '../../../components/common/DataTable';
import { RowMenu } from '../../../components/common/RowMenu';
import { Modal } from '../../../components/common/Modal';
import { useTheme } from '../../../hooks/useTheme';
import { formatDate } from './exportUtils';
import { chatbotTypeColors } from './constants';

interface ChatbotRegistryTabProps {
  exportStatus: 'idle' | 'loading' | 'success' | 'error';
  setExportStatus: (status: 'idle' | 'loading' | 'success' | 'error') => void;
}

export const ChatbotRegistryTab = ({
  exportStatus,
  setExportStatus,
}: ChatbotRegistryTabProps) => {
  const { t } = useTranslation(['admin', 'common']);
  const { isDark } = useTheme();
  const [detailsTarget, setDetailsTarget] = useState<UnifiedChatbot | null>(null);

  // Stat-card color palette — same swatches the admin dashboard uses
  // for "number of courses" tiles, so the page reads as part of the
  // dashboard family.
  const c = {
    bgBlue: isDark ? 'rgba(59,130,246,0.2)' : '#dbeafe',
    bgGreen: isDark ? 'rgba(34,197,94,0.2)' : '#dcfce7',
    bgTeal: isDark ? 'rgba(8,143,143,0.2)' : '#f0fdfd',
    bgPurple: isDark ? 'rgba(139,92,246,0.2)' : '#ede9fe',
    bgOrange: isDark ? 'rgba(249,115,22,0.2)' : '#ffedd5',
    txBlue: isDark ? '#93c5fd' : '#2563eb',
    txGreen: isDark ? '#86efac' : '#16a34a',
    txTeal: isDark ? '#5eecec' : '#088F8F',
    txPurple: isDark ? '#c4b5fd' : '#7c3aed',
    txOrange: isDark ? '#fdba74' : '#ea580c',
  };

  // Single big fetch — DataTable handles client-side filter / sort / page.
  const { data: chatbotsData, isLoading } = useQuery({
    queryKey: ['chatbotRegistry', 'all'],
    queryFn: () =>
      chatbotRegistryApi.getChatbots({
        page: 1,
        limit: 1000,
        sortBy: 'createdAt',
        sortOrder: 'desc',
      }),
  });

  const { data: filterOptions } = useQuery({
    queryKey: ['chatbotRegistryFilterOptions'],
    queryFn: () => chatbotRegistryApi.getFilterOptions(),
    staleTime: 5 * 60 * 1000,
  });

  const { data: stats } = useQuery({
    queryKey: ['chatbotRegistryStats'],
    queryFn: () => chatbotRegistryApi.getStats({}),
  });

  const chatbots: UnifiedChatbot[] = chatbotsData?.chatbots ?? [];

  const handleExport = async () => {
    setExportStatus('loading');
    try {
      await chatbotRegistryApi.exportJSON({});
      setExportStatus('success');
      toast.success(t('export_downloaded', { defaultValue: 'Export downloaded' }));
      setTimeout(() => setExportStatus('idle'), 2000);
    } catch {
      setExportStatus('error');
      toast.error(t('export_failed', { defaultValue: 'Export failed' }));
      setTimeout(() => setExportStatus('idle'), 2000);
    }
  };

  const typeIcon = (type: UnifiedChatbot['type']) =>
    type === 'global' ? (
      <Globe className="w-3 h-3 mr-1" />
    ) : type === 'agent' ? (
      <Puzzle className="w-3 h-3 mr-1" />
    ) : (
      <BookOpen className="w-3 h-3 mr-1" />
    );

  const typeLabel = (type: UnifiedChatbot['type']) =>
    type === 'global' ? t('global') : type === 'agent' ? t('agent') : t('section');

  const columns: ColumnDef<UnifiedChatbot>[] = [
    {
      id: 'type',
      header: t('type'),
      sortAccessor: b => b.type,
      width: '6.5rem',
      filter: {
        kind: 'select',
        options: [
          { value: 'global', label: t('global_ai_tutors') },
          { value: 'section', label: t('section_chatbots') },
          { value: 'agent', label: t('agent_chatbots') },
        ],
        predicate: (b, v) => b.type === v,
      },
      cell: b => (
        <span
          className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
            chatbotTypeColors[b.type] ||
            'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200'
          }`}
        >
          {typeIcon(b.type)}
          {typeLabel(b.type)}
        </span>
      ),
    },
    {
      id: 'name',
      header: t('name'),
      sortAccessor: b => b.displayName.toLowerCase(),
      width: '24%',
      cell: b => (
        <div className="flex items-center gap-2 min-w-0">
          {b.avatarUrl ? (
            <img
              src={b.avatarUrl}
              alt=""
              aria-hidden
              className="w-7 h-7 rounded-full object-cover flex-shrink-0"
            />
          ) : (
            <div
              className="w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center"
              style={{ backgroundColor: c.bgTeal, color: c.txTeal }}
            >
              <Bot className="w-3.5 h-3.5" />
            </div>
          )}
          <div className="min-w-0">
            <p
              className="text-sm truncate text-gray-700 dark:text-gray-200"
              title={b.displayName}
            >
              {b.displayName}
            </p>
            {b.description && (
              <p
                className="text-xs truncate text-gray-500 dark:text-gray-400"
                title={b.description}
              >
                {b.description}
              </p>
            )}
          </div>
        </div>
      ),
    },
    {
      id: 'course',
      header: t('course'),
      sortAccessor: b => (b.courseTitle || '').toLowerCase(),
      width: '16%',
      hideOnMobile: true,
      filter: {
        kind: 'select',
        options:
          filterOptions?.courses.map(o => ({
            value: String(o.id),
            label: o.title,
          })) ?? [],
        predicate: (b, v) => String(b.courseId ?? '') === v,
      },
      cell: b =>
        b.courseTitle ? (
          <span
            className="block truncate text-sm text-gray-600 dark:text-gray-300"
            title={b.courseTitle}
          >
            {b.courseTitle}
          </span>
        ) : (
          <span className="text-xs text-gray-400 dark:text-gray-500 italic">
            {t('uncategorized')}
          </span>
        ),
    },
    {
      id: 'creator',
      header: t('creator'),
      sortAccessor: b => (b.creatorName || '').toLowerCase(),
      width: '14%',
      hideOnMobile: true,
      filter: {
        kind: 'select',
        options:
          filterOptions?.creators.map(u => ({
            value: String(u.id),
            label: u.fullname || u.email,
          })) ?? [],
        predicate: (b, v) => String(b.creatorId ?? '') === v,
      },
      cell: b =>
        b.creatorName || b.creatorEmail ? (
          <span
            className="block truncate text-sm text-gray-600 dark:text-gray-300"
            title={b.creatorName || b.creatorEmail || ''}
          >
            {b.creatorName || b.creatorEmail}
          </span>
        ) : (
          <span className="text-xs text-gray-400 dark:text-gray-500 italic">
            {t('system')}
          </span>
        ),
    },
    {
      id: 'category',
      header: t('category'),
      sortAccessor: b => (b.category || '').toLowerCase(),
      width: '10rem',
      hideOnMobile: true,
      filter: {
        kind: 'select',
        options:
          filterOptions?.categories.map(o => ({
            value: o.category,
            label: `${o.category} (${o.count})`,
          })) ?? [],
        predicate: (b, v) => (b.category || '') === v,
      },
      cell: b => (
        <span className="text-xs text-gray-600 dark:text-gray-300">
          {b.category || '—'}
        </span>
      ),
    },
    {
      id: 'status',
      header: t('status'),
      sortAccessor: b => (b.isActive ? 'active' : 'inactive'),
      width: '6.5rem',
      filter: {
        kind: 'select',
        options: [
          { value: 'true', label: t('active') },
          { value: 'false', label: t('inactive') },
        ],
        predicate: (b, v) => String(b.isActive) === v,
      },
      cell: b =>
        b.isActive ? (
          <span className="inline-flex px-2 py-0.5 text-xs font-medium rounded bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-300">
            {t('active')}
          </span>
        ) : (
          <span className="inline-flex px-2 py-0.5 text-xs font-medium rounded bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400">
            {t('inactive')}
          </span>
        ),
    },
    {
      id: 'conversations',
      header: t('conversations_abbr'),
      sortAccessor: b => b.conversationCount,
      align: 'right',
      width: '5.5rem',
      hideOnMobile: true,
      cell: b => (
        <span className="text-gray-600 dark:text-gray-300 tabular-nums">
          {b.conversationCount}
        </span>
      ),
    },
    {
      id: 'messages',
      header: t('messages_abbr'),
      sortAccessor: b => b.messageCount,
      align: 'right',
      width: '5.5rem',
      hideOnMobile: true,
      cell: b => (
        <span className="text-gray-600 dark:text-gray-300 tabular-nums">
          {b.messageCount}
        </span>
      ),
    },
    {
      id: 'users',
      header: t('users'),
      sortAccessor: b => b.uniqueUsers,
      align: 'right',
      width: '5rem',
      hideOnMobile: true,
      cell: b => (
        <span className="text-gray-600 dark:text-gray-300 tabular-nums">
          {b.uniqueUsers}
        </span>
      ),
    },
    {
      id: 'createdAt',
      header: t('created'),
      sortAccessor: b => new Date(b.createdAt).getTime(),
      align: 'right',
      width: '7rem',
      hideOnMobile: true,
      cell: b => (
        <span className="text-xs text-gray-500 dark:text-gray-400 tabular-nums whitespace-nowrap">
          {formatDate(b.createdAt)}
        </span>
      ),
    },
  ];

  return (
    <>
      {/* Stat strip — same StatCard the admin dashboard uses. */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 mb-6">
        <StatCard
          icon={<Bot className="w-5 h-5" style={{ color: c.txTeal }} />}
          iconBgColor={c.bgTeal}
          value={(stats?.totalChatbots || 0).toLocaleString()}
          label={t('total_chatbots')}
          size="sm"
        />
        <StatCard
          icon={<Globe className="w-5 h-5" style={{ color: c.txBlue }} />}
          iconBgColor={c.bgBlue}
          value={(stats?.globalChatbots || 0).toLocaleString()}
          label={t('global_ai_tutors')}
          size="sm"
        />
        <StatCard
          icon={<BookOpen className="w-5 h-5" style={{ color: c.txPurple }} />}
          iconBgColor={c.bgPurple}
          value={(stats?.sectionChatbots || 0).toLocaleString()}
          label={t('section_chatbots')}
          size="sm"
        />
        <StatCard
          icon={<Puzzle className="w-5 h-5" style={{ color: c.txOrange }} />}
          iconBgColor={c.bgOrange}
          value={(stats?.agentChatbots || 0).toLocaleString()}
          label={t('agent_chatbots')}
          size="sm"
        />
        <StatCard
          icon={<MessageSquare className="w-5 h-5" style={{ color: c.txGreen }} />}
          iconBgColor={c.bgGreen}
          value={(stats?.totalConversations || 0).toLocaleString()}
          label={t('total_conversations')}
          size="sm"
        />
      </div>

      <DataTable<UnifiedChatbot>
        rows={chatbots}
        columns={columns}
        rowKey={b => b.id}
        isLoading={isLoading}
        pageSize={20}
        globalSearch={{
          placeholder: t('search_chatbot'),
          predicate: (b, q) => {
            const l = q.toLowerCase();
            return (
              b.displayName.toLowerCase().includes(l) ||
              (b.description || '').toLowerCase().includes(l) ||
              (b.courseTitle || '').toLowerCase().includes(l) ||
              (b.creatorName || '').toLowerCase().includes(l) ||
              (b.creatorEmail || '').toLowerCase().includes(l)
            );
          },
        }}
        exportAction={{
          onClick: handleExport,
          label: exportStatus === 'loading' ? t('common:loading') : undefined,
        }}
        rowActions={b => (
          <RowMenu
            items={[
              {
                key: 'details',
                label: t('view_details', { defaultValue: 'View details' }),
                icon: <Eye className="w-3.5 h-3.5" />,
                onClick: () => setDetailsTarget(b),
              },
            ]}
          />
        )}
      />

      {/* Details modal — preserves all the system-prompt / rules / config
          panels that used to live in the expandable row. */}
      <Modal
        isOpen={!!detailsTarget}
        onClose={() => setDetailsTarget(null)}
        title={detailsTarget?.displayName || t('chatbot_registry')}
        size="4xl"
      >
        {detailsTarget && <ChatbotDetailsView chatbot={detailsTarget} />}
      </Modal>
    </>
  );
};

/* ---------- Details panel (separated for readability) ---------- */

const ChatbotDetailsView = ({ chatbot }: { chatbot: UnifiedChatbot }) => {
  const { t } = useTranslation(['admin']);
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6 text-sm">
      <Section title={t('system_prompt')}>
        {chatbot.systemPrompt ? (
          <pre className="max-h-48 overflow-y-auto p-3 bg-gray-100 dark:bg-gray-900 rounded text-gray-700 dark:text-gray-300 whitespace-pre-wrap text-xs">
            {chatbot.systemPrompt}
          </pre>
        ) : (
          <Empty label={t('no_system_prompt')} />
        )}
      </Section>

      <Section title={t('behavior_rules')}>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="text-xs font-medium text-green-700 dark:text-green-400 mb-1">
              {t('dos_rules')}
            </div>
            {chatbot.dosRules?.length ? (
              <ul className="space-y-1">
                {chatbot.dosRules.map((rule, i) => (
                  <li
                    key={i}
                    className="text-xs text-gray-600 dark:text-gray-400 flex items-start gap-1"
                  >
                    <span className="text-green-500">+</span>
                    {rule}
                  </li>
                ))}
              </ul>
            ) : (
              <Empty label={t('none_defined')} />
            )}
          </div>
          <div>
            <div className="text-xs font-medium text-red-700 dark:text-red-400 mb-1">
              {t('donts_rules')}
            </div>
            {chatbot.dontsRules?.length ? (
              <ul className="space-y-1">
                {chatbot.dontsRules.map((rule, i) => (
                  <li
                    key={i}
                    className="text-xs text-gray-600 dark:text-gray-400 flex items-start gap-1"
                  >
                    <span className="text-red-500">-</span>
                    {rule}
                  </li>
                ))}
              </ul>
            ) : (
              <Empty label={t('none_defined')} />
            )}
          </div>
        </div>
      </Section>

      <Section title={t('configuration')}>
        <div className="grid grid-cols-2 gap-2 text-xs text-gray-600 dark:text-gray-400">
          <KV k={t('personality')} v={chatbot.personality} />
          <KV k={t('temperature')} v={chatbot.temperature} />
          <KV k={t('max_tokens')} v={chatbot.maxTokens} />
          <KV k={t('response_style')} v={chatbot.responseStyle} />
          <KV k={t('model')} v={chatbot.modelPreference || t('default_model')} />
          <KV
            k={t('last_activity')}
            v={chatbot.lastActivity ? formatDate(chatbot.lastActivity) : '—'}
          />
        </div>
      </Section>

      <Section title={t('user_experience')}>
        <div className="space-y-3 text-gray-600 dark:text-gray-400">
          <div>
            <div className="text-xs font-medium text-gray-500 dark:text-gray-500 mb-1">
              {t('welcome_message')}
            </div>
            {chatbot.welcomeMessage ? (
              <div className="text-xs bg-blue-50 dark:bg-blue-900/20 p-2 rounded text-blue-700 dark:text-blue-300">
                {chatbot.welcomeMessage}
              </div>
            ) : (
              <Empty label={t('none_defined')} />
            )}
          </div>
          {chatbot.suggestedQuestions?.length ? (
            <div>
              <div className="text-xs font-medium text-gray-500 dark:text-gray-500 mb-1">
                {t('suggested_questions')}
              </div>
              <div className="flex flex-wrap gap-1">
                {chatbot.suggestedQuestions.map((q, i) => (
                  <span
                    key={i}
                    className="text-xs bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded"
                  >
                    {q}
                  </span>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </Section>

      {chatbot.type === 'section' && (
        <Section title={t('course_hierarchy')} full>
          <div className="flex flex-wrap items-center gap-2 text-xs text-gray-600 dark:text-gray-400">
            <span className="font-medium">{t('course')}:</span>
            {chatbot.courseTitle} (#{chatbot.courseId})
            <span>→</span>
            <span className="font-medium">{t('module')}:</span>
            {chatbot.moduleTitle}
            <span>→</span>
            <span className="font-medium">{t('lecture')}:</span>
            {chatbot.lectureTitle} (#{chatbot.lectureId})
            <span>→</span>
            <span className="font-medium">{t('section')}:</span>#
            {chatbot.sectionId}
          </div>
        </Section>
      )}

      {chatbot.type === 'agent' && chatbot.courseId && (
        <Section title={t('course_context')} full>
          <div className="flex flex-wrap items-center gap-2 text-xs text-gray-600 dark:text-gray-400">
            <span className="font-medium">{t('course')}:</span>
            {chatbot.courseTitle} (#{chatbot.courseId})
            {chatbot.moduleTitle && (
              <>
                <span>→</span>
                <span className="font-medium">{t('module')}:</span>
                {chatbot.moduleTitle}
              </>
            )}
            {chatbot.lectureTitle && (
              <>
                <span>→</span>
                <span className="font-medium">{t('lecture')}:</span>
                {chatbot.lectureTitle} (#{chatbot.lectureId})
              </>
            )}
          </div>
          <div className="text-xs text-amber-600 dark:text-amber-400 mt-1">
            {t('designed_by')}: {chatbot.creatorName || chatbot.creatorEmail}
          </div>
        </Section>
      )}

      {chatbot.knowledgeContext && (
        <Section title={t('knowledge_context')} full>
          <pre className="max-h-32 overflow-y-auto p-3 bg-gray-100 dark:bg-gray-900 rounded text-gray-700 dark:text-gray-300 whitespace-pre-wrap text-xs">
            {chatbot.knowledgeContext}
          </pre>
        </Section>
      )}

      {chatbot.personalityPrompt && (
        <Section title={t('personality_prompt')} full>
          <pre className="max-h-32 overflow-y-auto p-3 bg-purple-50 dark:bg-purple-900/20 rounded text-purple-700 dark:text-purple-300 whitespace-pre-wrap text-xs">
            {chatbot.personalityPrompt}
          </pre>
        </Section>
      )}
    </div>
  );
};

const Section = ({
  title,
  children,
  full,
}: {
  title: string;
  children: React.ReactNode;
  full?: boolean;
}) => (
  <div className={`space-y-2 ${full ? 'md:col-span-2' : ''}`}>
    <h4 className="font-semibold text-gray-900 dark:text-gray-100 border-b border-gray-200 dark:border-gray-600 pb-1">
      {title}
    </h4>
    {children}
  </div>
);

const Empty = ({ label }: { label: string }) => (
  <span className="text-gray-400 dark:text-gray-500 text-xs italic">{label}</span>
);

const KV = ({ k, v }: { k: string; v: React.ReactNode }) => (
  <div>
    <span className="text-gray-500 dark:text-gray-500">{k}:</span>{' '}
    {v ?? '—'}
  </div>
);
