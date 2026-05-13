/**
 * Messages tab — StatCard strip + DataTable + details modal.
 * Style matches /teach/quizzes and the chatbot registry.
 */

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import {
  Bot,
  Cpu,
  Eye,
  MessageCircle,
  Users,
  Zap,
} from 'lucide-react';
import { messagesApi, UnifiedMessage } from '../../../api/admin';
import { StatCard } from '../../../components/admin/StatCard';
import {
  DataTable,
  type ColumnDef,
} from '../../../components/common/DataTable';
import { RowMenu } from '../../../components/common/RowMenu';
import { Modal } from '../../../components/common/Modal';
import { useTheme } from '../../../hooks/useTheme';
import { formatDate, formatFullDate } from './exportUtils';

interface MessagesTabProps {
  exportStatus: 'idle' | 'loading' | 'success' | 'error';
  setExportStatus: (status: 'idle' | 'loading' | 'success' | 'error') => void;
  initialUserId?: number;
}

const SYSTEM_TYPE_COLORS: Record<string, string> = {
  chatbot: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  tutor: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
  agent: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
};

const ROLE_COLORS: Record<string, string> = {
  user: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  assistant: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
};

export const MessagesTab = ({
  exportStatus,
  setExportStatus,
  initialUserId,
}: MessagesTabProps) => {
  const { t } = useTranslation(['admin', 'common']);
  const { isDark } = useTheme();
  const [details, setDetails] = useState<UnifiedMessage | null>(null);

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

  const { data: messagesData, isLoading } = useQuery({
    queryKey: ['messages', 'all', initialUserId ?? null],
    queryFn: () =>
      messagesApi.getMessages({
        page: 1,
        limit: 1000,
        ...(initialUserId ? { userId: initialUserId } : {}),
      }),
  });

  const { data: stats } = useQuery({
    queryKey: ['messageStats', initialUserId ?? null],
    queryFn: () =>
      messagesApi.getStats({
        ...(initialUserId ? { userId: initialUserId } : {}),
      }),
  });

  const messages: UnifiedMessage[] = messagesData?.messages ?? [];

  const handleExport = async () => {
    setExportStatus('loading');
    try {
      await messagesApi.exportCSV({
        ...(initialUserId ? { userId: initialUserId } : {}),
      });
      setExportStatus('success');
      toast.success(t('export_downloaded', { defaultValue: 'Export downloaded' }));
      setTimeout(() => setExportStatus('idle'), 2000);
    } catch {
      setExportStatus('error');
      toast.error(t('export_failed', { defaultValue: 'Export failed' }));
      setTimeout(() => setExportStatus('idle'), 2000);
    }
  };

  const columns: ColumnDef<UnifiedMessage>[] = [
    {
      id: 'timestamp',
      header: t('timestamp'),
      sortAccessor: m => new Date(m.timestamp).getTime(),
      width: '11rem',
      cell: m => (
        <span className="text-xs text-gray-600 dark:text-gray-300 tabular-nums whitespace-nowrap">
          {formatDate(m.timestamp)}
        </span>
      ),
    },
    {
      id: 'system',
      header: t('system'),
      sortAccessor: m => m.systemType,
      width: '7rem',
      filter: {
        kind: 'select',
        options: [
          { value: 'chatbot', label: t('chatbot') },
          { value: 'tutor', label: t('tutor') },
          { value: 'agent', label: t('agent_tests') },
        ],
        predicate: (m, v) => m.systemType === v,
      },
      cell: m => (
        <span
          className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
            SYSTEM_TYPE_COLORS[m.systemType] ||
            'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200'
          }`}
        >
          {m.systemType}
        </span>
      ),
    },
    {
      id: 'role',
      header: t('role'),
      sortAccessor: m => m.role,
      width: '6.5rem',
      filter: {
        kind: 'select',
        options: [
          { value: 'user', label: t('common:user', { defaultValue: 'User' }) },
          {
            value: 'assistant',
            label: t('common:assistant', { defaultValue: 'Assistant' }),
          },
        ],
        predicate: (m, v) => m.role === v,
      },
      cell: m => (
        <span
          className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
            ROLE_COLORS[m.role] ||
            'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200'
          }`}
        >
          {m.role}
        </span>
      ),
    },
    {
      id: 'user',
      header: t('user'),
      sortAccessor: m => (m.userFullname || '').toLowerCase(),
      width: '14%',
      cell: m => (
        <div className="min-w-0">
          <p className="text-sm truncate text-gray-700 dark:text-gray-200">
            {m.userFullname || t('common:unknown', { defaultValue: 'Unknown' })}
          </p>
          <p className="text-xs truncate text-gray-500 dark:text-gray-400">
            {m.userEmail}
          </p>
        </div>
      ),
    },
    {
      id: 'course',
      header: t('course'),
      sortAccessor: m => (m.courseTitle || '').toLowerCase(),
      width: '14%',
      hideOnMobile: true,
      cell: m =>
        m.courseTitle ? (
          <span
            className="block truncate text-sm text-gray-600 dark:text-gray-300"
            title={m.courseTitle}
          >
            {m.courseTitle}
          </span>
        ) : (
          <span className="text-xs text-gray-400 dark:text-gray-500">—</span>
        ),
    },
    {
      id: 'content',
      header: t('content'),
      sortAccessor: m => m.content.slice(0, 60).toLowerCase(),
      width: '32%',
      cell: m => (
        <p
          className="text-sm truncate text-gray-700 dark:text-gray-300"
          title={m.content}
        >
          {m.content}
        </p>
      ),
    },
    {
      id: 'model',
      header: t('model'),
      sortAccessor: m => (m.aiModel || '').toLowerCase(),
      width: '10rem',
      hideOnMobile: true,
      cell: m => (
        <span className="text-xs text-gray-500 dark:text-gray-400 font-mono truncate block">
          {m.aiModel || '—'}
        </span>
      ),
    },
    {
      id: 'tokens',
      header: t('tokens', { defaultValue: 'Tokens' }),
      sortAccessor: m => m.totalTokens ?? -1,
      align: 'right',
      width: '5.5rem',
      hideOnMobile: true,
      cell: m => (
        <span className="text-xs text-gray-600 dark:text-gray-300 tabular-nums">
          {m.totalTokens ?? '—'}
        </span>
      ),
    },
  ];

  return (
    <>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 mb-6">
        <StatCard
          icon={<MessageCircle className="w-5 h-5" style={{ color: c.txTeal }} />}
          iconBgColor={c.bgTeal}
          value={(stats?.total || 0).toLocaleString()}
          label={t('total_messages')}
          size="sm"
        />
        <StatCard
          icon={<Bot className="w-5 h-5" style={{ color: c.txBlue }} />}
          iconBgColor={c.bgBlue}
          value={(stats?.chatbot || 0).toLocaleString()}
          label={t('chatbot')}
          size="sm"
        />
        <StatCard
          icon={<Cpu className="w-5 h-5" style={{ color: c.txPurple }} />}
          iconBgColor={c.bgPurple}
          value={(stats?.tutor || 0).toLocaleString()}
          label={t('tutor')}
          size="sm"
        />
        <StatCard
          icon={<Zap className="w-5 h-5" style={{ color: c.txOrange }} />}
          iconBgColor={c.bgOrange}
          value={(stats?.agent || 0).toLocaleString()}
          label={t('agent_tests')}
          size="sm"
        />
        <StatCard
          icon={<Users className="w-5 h-5" style={{ color: c.txGreen }} />}
          iconBgColor={c.bgGreen}
          value={(stats?.uniqueUsers || 0).toLocaleString()}
          label={t('unique_users')}
          size="sm"
        />
      </div>

      <DataTable<UnifiedMessage>
        rows={messages}
        columns={columns}
        rowKey={m => m.id}
        isLoading={isLoading}
        pageSize={20}
        globalSearch={{
          placeholder: t('search_messages', {
            defaultValue: 'Search by user, course, or content…',
          }),
          predicate: (m, q) => {
            const x = q.toLowerCase();
            return (
              (m.userFullname || '').toLowerCase().includes(x) ||
              (m.userEmail || '').toLowerCase().includes(x) ||
              (m.courseTitle || '').toLowerCase().includes(x) ||
              m.content.toLowerCase().includes(x) ||
              (m.aiModel || '').toLowerCase().includes(x)
            );
          },
        }}
        exportAction={{
          onClick: handleExport,
          label: exportStatus === 'loading' ? t('common:loading') : undefined,
        }}
        rowActions={m => (
          <RowMenu
            items={[
              {
                key: 'details',
                label: t('view_details', { defaultValue: 'View details' }),
                icon: <Eye className="w-3.5 h-3.5" />,
                onClick: () => setDetails(m),
              },
            ]}
          />
        )}
      />

      <Modal
        isOpen={!!details}
        onClose={() => setDetails(null)}
        title={t('message_details')}
        size="4xl"
      >
        {details && <MessageDetailsView m={details} />}
      </Modal>
    </>
  );
};

const MessageDetailsView = ({ m }: { m: UnifiedMessage }) => {
  const { t } = useTranslation(['admin']);
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <span
          className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
            SYSTEM_TYPE_COLORS[m.systemType] || 'bg-gray-100 dark:bg-gray-700 text-gray-700'
          }`}
        >
          {m.systemType}
        </span>
        <span
          className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
            ROLE_COLORS[m.role] || 'bg-gray-100 dark:bg-gray-700 text-gray-700'
          }`}
        >
          {m.role}
        </span>
        <span className="text-xs text-gray-500 dark:text-gray-400 tabular-nums">
          {formatFullDate(m.timestamp)}
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
        <Section title={t('user')}>
          <KV k={t('name')} v={m.userFullname} />
          <KV k={t('email')} v={m.userEmail} />
          <KV k="ID" v={m.userId} />
        </Section>

        <Section title="Context">
          <KV k={t('course')} v={m.courseTitle} />
          <KV k={t('module')} v={m.moduleTitle} />
          <KV k={t('lecture')} v={m.lectureTitle} />
          {m.contextName && <KV k="Chatbot" v={m.contextName} />}
          {m.agentName && (
            <KV k="Agent" v={`${m.agentName} (v${m.agentVersion})`} />
          )}
        </Section>

        <Section title={t('configuration')}>
          <KV k={t('model')} v={<span className="font-mono text-xs">{m.aiModel}</span>} />
          <KV k="Provider" v={m.aiProvider} />
          <KV k={t('temperature')} v={m.temperature} />
          <KV k={t('max_tokens')} v={m.maxTokens} />
        </Section>

        <Section title="Tokens">
          <KV k="Prompt" v={m.promptTokens} />
          <KV k="Completion" v={m.completionTokens} />
          <KV k="Total" v={m.totalTokens} />
          <KV
            k={t('last_activity')}
            v={
              m.responseTimeMs
                ? `${(m.responseTimeMs / 1000).toFixed(2)}s`
                : null
            }
          />
        </Section>

        {(m.routingReason || m.synthesizedFrom) && (
          <Section title="Routing" full>
            {m.routingReason && <KV k="Reason" v={m.routingReason} />}
            {m.routingConfidence != null && (
              <KV
                k="Confidence"
                v={`${(m.routingConfidence * 100).toFixed(1)}%`}
              />
            )}
            {m.synthesizedFrom && (
              <KV
                k="Synthesized from"
                v={<span className="font-mono text-xs">{m.synthesizedFrom}</span>}
              />
            )}
          </Section>
        )}

        {(m.deviceType || m.browserName || m.ipAddress) && (
          <Section title="Client" full>
            <KV k={t('device')} v={m.deviceType} />
            <KV k={t('browser')} v={m.browserName} />
            <KV k="IP" v={<span className="font-mono text-xs">{m.ipAddress}</span>} />
          </Section>
        )}
      </div>

      <Section title={t('content')} full>
        <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-3 max-h-72 overflow-y-auto">
          <pre className="text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap break-words">
            {m.content}
          </pre>
        </div>
      </Section>

      {m.systemPrompt && (
        <Section title={t('system_prompt')} full>
          <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-3 max-h-48 overflow-y-auto">
            <pre className="text-xs text-gray-700 dark:text-gray-300 whitespace-pre-wrap break-words">
              {m.systemPrompt}
            </pre>
          </div>
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
    <div className="space-y-1 text-gray-600 dark:text-gray-400">{children}</div>
  </div>
);

const KV = ({ k, v }: { k: string; v: React.ReactNode }) => (
  <div>
    <span className="text-gray-500 dark:text-gray-500">{k}:</span>{' '}
    {v ?? '—'}
  </div>
);

