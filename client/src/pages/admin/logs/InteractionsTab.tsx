/**
 * User Interactions tab — StatCard strip + DataTable + details modal.
 * Style matches /teach/quizzes and the chatbot registry.
 */

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import {
  Eye,
  Globe,
  MousePointer,
  ScrollText,
  Users,
} from 'lucide-react';
import { analyticsApi, InteractionFilters } from '../../../api/admin';
import { StatCard } from '../../../components/admin/StatCard';
import {
  DataTable,
  type ColumnDef,
} from '../../../components/common/DataTable';
import { RowMenu } from '../../../components/common/RowMenu';
import { Modal } from '../../../components/common/Modal';
import { useTheme } from '../../../hooks/useTheme';
import { formatDate, formatFullDate } from './exportUtils';

interface InteractionsTabProps {
  exportStatus: 'idle' | 'loading' | 'success' | 'error';
  setExportStatus: (status: 'idle' | 'loading' | 'success' | 'error') => void;
  initialUserId?: number;
}

interface InteractionLog {
  id: number;
  timestamp: string;
  sessionId: string | null;
  sessionDuration: number | null;
  timeOnPage: number | null;
  userId: number | null;
  userFullname: string | null;
  userEmail: string | null;
  eventType: string;
  eventCategory: string | null;
  eventAction: string | null;
  eventLabel: string | null;
  eventValue: number | null;
  eventSequence: number | null;
  pagePath: string | null;
  pageUrl: string | null;
  pageTitle: string | null;
  referrerUrl: string | null;
  courseId: number | null;
  courseTitle: string | null;
  moduleId: number | null;
  moduleTitle: string | null;
  lectureId: number | null;
  lectureTitle: string | null;
  elementId: string | null;
  elementType: string | null;
  elementText: string | null;
  elementHref: string | null;
  elementName: string | null;
  elementValue: string | null;
  scrollDepth: number | null;
  viewportWidth: number | null;
  viewportHeight: number | null;
  deviceType: string | null;
  browserName: string | null;
  browserVersion: string | null;
  osName: string | null;
  osVersion: string | null;
  screenWidth: number | null;
  screenHeight: number | null;
  language: string | null;
  timezone: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  metadata: Record<string, unknown> | null;
}

const eventTypeColors: Record<string, string> = {
  click: 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300',
  page_view: 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300',
  scroll: 'bg-cyan-100 dark:bg-cyan-900/30 text-cyan-800 dark:text-cyan-300',
  form_submit: 'bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300',
  focus: 'bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300',
  blur: 'bg-gray-100 dark:bg-gray-700/50 text-gray-800 dark:text-gray-300',
  hover: 'bg-pink-100 dark:bg-pink-900/30 text-pink-800 dark:text-pink-300',
  custom: 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-800 dark:text-indigo-300',
};

export const InteractionsTab = ({
  exportStatus,
  setExportStatus,
  initialUserId,
}: InteractionsTabProps) => {
  const { t } = useTranslation(['admin', 'common']);
  const { isDark } = useTheme();
  const [details, setDetails] = useState<InteractionLog | null>(null);

  const c = {
    bgBlue: isDark ? 'rgba(59,130,246,0.2)' : '#dbeafe',
    bgGreen: isDark ? 'rgba(34,197,94,0.2)' : '#dcfce7',
    bgTeal: isDark ? 'rgba(8,143,143,0.2)' : '#f0fdfd',
    bgPurple: isDark ? 'rgba(139,92,246,0.2)' : '#ede9fe',
    txBlue: isDark ? '#93c5fd' : '#2563eb',
    txGreen: isDark ? '#86efac' : '#16a34a',
    txTeal: isDark ? '#5eecec' : '#088F8F',
    txPurple: isDark ? '#c4b5fd' : '#7c3aed',
  };

  const baseFilters: InteractionFilters = {
    page: 1,
    limit: 1000,
    sortBy: 'timestamp',
    sortOrder: 'desc',
    ...(initialUserId ? { userId: initialUserId } : {}),
  };

  const { data: logsData, isLoading } = useQuery({
    queryKey: ['interactions', 'all', initialUserId ?? null],
    queryFn: () => analyticsApi.queryInteractions(baseFilters),
  });

  const { data: filterOptions } = useQuery({
    queryKey: ['interactionFilterOptions'],
    queryFn: () => analyticsApi.getInteractionFilterOptions(),
    staleTime: 5 * 60 * 1000,
  });

  const { data: summary } = useQuery({
    queryKey: ['interactionSummary'],
    queryFn: () => analyticsApi.getInteractionSummary({}),
  });

  const logs: InteractionLog[] = logsData?.logs ?? [];

  const handleExport = async () => {
    setExportStatus('loading');
    try {
      await analyticsApi.exportInteractionsJSON(baseFilters);
      setExportStatus('success');
      toast.success(t('export_downloaded', { defaultValue: 'Export downloaded' }));
      setTimeout(() => setExportStatus('idle'), 2000);
    } catch {
      setExportStatus('error');
      toast.error(t('export_failed', { defaultValue: 'Export failed' }));
      setTimeout(() => setExportStatus('idle'), 2000);
    }
  };

  const columns: ColumnDef<InteractionLog>[] = [
    {
      id: 'timestamp',
      header: t('timestamp'),
      sortAccessor: l => new Date(l.timestamp).getTime(),
      width: '11rem',
      cell: l => (
        <span className="text-xs text-gray-600 dark:text-gray-300 tabular-nums whitespace-nowrap">
          {formatDate(l.timestamp)}
        </span>
      ),
    },
    {
      id: 'user',
      header: t('user'),
      sortAccessor: l => (l.userFullname || '').toLowerCase(),
      width: '14%',
      filter: {
        kind: 'select',
        options:
          filterOptions?.users.map(u => ({
            value: String(u.id),
            label: u.fullname || u.email || `User #${u.id}`,
          })) ?? [],
        predicate: (l, v) => String(l.userId ?? '') === v,
      },
      cell: l => (
        <div className="min-w-0">
          <p className="text-sm truncate text-gray-700 dark:text-gray-200">
            {l.userFullname || t('common:anonymous', { defaultValue: 'Anonymous' })}
          </p>
          <p className="text-xs truncate text-gray-500 dark:text-gray-400">
            {l.userEmail}
          </p>
        </div>
      ),
    },
    {
      id: 'event',
      header: t('event'),
      sortAccessor: l => l.eventType,
      width: '8rem',
      filter: {
        kind: 'select',
        options:
          filterOptions?.eventTypes.map(e => ({
            value: e.eventType,
            label: `${e.eventType} (${e.count})`,
          })) ?? [],
        predicate: (l, v) => l.eventType === v,
      },
      cell: l => (
        <div>
          <span
            className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${
              eventTypeColors[l.eventType] ||
              'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200'
            }`}
          >
            {l.eventType}
          </span>
          {l.eventAction && (
            <p className="text-[10px] text-gray-400 mt-0.5">{l.eventAction}</p>
          )}
        </div>
      ),
    },
    {
      id: 'page',
      header: t('page_label'),
      sortAccessor: l => (l.pagePath || '').toLowerCase(),
      width: '20%',
      filter: {
        kind: 'select',
        options:
          filterOptions?.pages.map(p => ({
            value: p.path,
            label: p.path,
          })) ?? [],
        predicate: (l, v) => l.pagePath === v,
      },
      cell: l => (
        <div className="min-w-0">
          <p
            className="text-sm truncate text-gray-700 dark:text-gray-200 font-mono text-xs"
            title={l.pagePath || ''}
          >
            {l.pagePath || '—'}
          </p>
          {l.pageTitle && (
            <p
              className="text-xs truncate text-gray-400 dark:text-gray-500"
              title={l.pageTitle}
            >
              {l.pageTitle}
            </p>
          )}
        </div>
      ),
    },
    {
      id: 'course',
      header: t('course'),
      sortAccessor: l => (l.courseTitle || '').toLowerCase(),
      width: '14%',
      hideOnMobile: true,
      filter: {
        kind: 'select',
        options:
          filterOptions?.courses
            .filter(co => co.id != null)
            .map(co => ({
              value: String(co.id),
              label: co.title || `Course #${co.id}`,
            })) ?? [],
        predicate: (l, v) => String(l.courseId ?? '') === v,
      },
      cell: l =>
        l.courseTitle ? (
          <span
            className="block truncate text-sm text-gray-600 dark:text-gray-300"
            title={l.courseTitle}
          >
            {l.courseTitle}
          </span>
        ) : (
          <span className="text-xs text-gray-400 dark:text-gray-500">—</span>
        ),
    },
    {
      id: 'device',
      header: t('device'),
      sortAccessor: l => l.deviceType || '',
      width: '8rem',
      hideOnMobile: true,
      cell: l => (
        <div className="min-w-0">
          <p className="text-xs text-gray-600 dark:text-gray-300">
            {l.deviceType || '—'}
          </p>
          <p className="text-[10px] text-gray-400 dark:text-gray-500 truncate">
            {l.browserName}
          </p>
        </div>
      ),
    },
    {
      id: 'scroll',
      header: t('scroll'),
      sortAccessor: l => l.scrollDepth ?? -1,
      width: '7rem',
      align: 'right',
      hideOnMobile: true,
      cell: l =>
        l.scrollDepth != null ? (
          <div className="flex items-center gap-1.5 justify-end">
            <div className="w-10 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-cyan-500 dark:bg-cyan-400 rounded-full"
                style={{ width: `${l.scrollDepth}%` }}
              />
            </div>
            <span className="text-xs text-gray-600 dark:text-gray-300 tabular-nums">
              {l.scrollDepth}%
            </span>
          </div>
        ) : (
          <span className="text-xs text-gray-400 dark:text-gray-500">—</span>
        ),
    },
  ];

  return (
    <>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 mb-6">
        <StatCard
          icon={<MousePointer className="w-5 h-5" style={{ color: c.txBlue }} />}
          iconBgColor={c.bgBlue}
          value={(summary?.totalInteractions || 0).toLocaleString()}
          label={t('total_interactions')}
          size="sm"
        />
        <StatCard
          icon={<Users className="w-5 h-5" style={{ color: c.txGreen }} />}
          iconBgColor={c.bgGreen}
          value={(summary?.uniqueSessions || 0).toLocaleString()}
          label={t('unique_sessions')}
          size="sm"
        />
        <StatCard
          icon={<Globe className="w-5 h-5" style={{ color: c.txPurple }} />}
          iconBgColor={c.bgPurple}
          value={(summary?.byPage?.length || 0).toLocaleString()}
          label={t('pages_tracked')}
          size="sm"
        />
        <StatCard
          icon={<ScrollText className="w-5 h-5" style={{ color: c.txTeal }} />}
          iconBgColor={c.bgTeal}
          value={(filterOptions?.eventTypes.length || 0).toLocaleString()}
          label={t('event_type')}
          size="sm"
        />
      </div>

      <DataTable<InteractionLog>
        rows={logs}
        columns={columns}
        rowKey={l => l.id}
        isLoading={isLoading}
        pageSize={20}
        globalSearch={{
          placeholder: t('search_user_page_course'),
          predicate: (l, q) => {
            const x = q.toLowerCase();
            return (
              (l.userFullname || '').toLowerCase().includes(x) ||
              (l.userEmail || '').toLowerCase().includes(x) ||
              (l.pagePath || '').toLowerCase().includes(x) ||
              (l.pageTitle || '').toLowerCase().includes(x) ||
              (l.courseTitle || '').toLowerCase().includes(x) ||
              l.eventType.toLowerCase().includes(x)
            );
          },
        }}
        exportAction={{
          onClick: handleExport,
          label: exportStatus === 'loading' ? t('common:loading') : undefined,
        }}
        rowActions={l => (
          <RowMenu
            items={[
              {
                key: 'details',
                label: t('view_details', { defaultValue: 'View details' }),
                icon: <Eye className="w-3.5 h-3.5" />,
                onClick: () => setDetails(l),
              },
            ]}
          />
        )}
      />

      <Modal
        isOpen={!!details}
        onClose={() => setDetails(null)}
        title={details?.eventType || t('user_interactions')}
        size="4xl"
      >
        {details && <InteractionDetailsView log={details} />}
      </Modal>
    </>
  );
};

const InteractionDetailsView = ({ log }: { log: InteractionLog }) => {
  const { t } = useTranslation(['admin']);
  return (
    <div className="space-y-4">
      <div className="text-xs text-gray-500 dark:text-gray-400 tabular-nums">
        {formatFullDate(log.timestamp)}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
        <Section title={t('user_context')}>
          <KV k={t('id')} v={log.userId} />
          <KV k={t('email')} v={log.userEmail} />
          <KV k={t('name')} v={log.userFullname} />
          <KV
            k={t('session')}
            v={log.sessionId ? `${log.sessionId.substring(0, 16)}…` : null}
          />
          <KV
            k={t('session_duration')}
            v={log.sessionDuration != null ? `${log.sessionDuration}s` : null}
          />
          <KV
            k={t('time_on_page')}
            v={log.timeOnPage != null ? `${log.timeOnPage}s` : null}
          />
        </Section>

        <Section title={t('event_details')}>
          <KV k={t('type')} v={log.eventType} />
          <KV k={t('event_category')} v={log.eventCategory} />
          <KV k={t('event_action')} v={log.eventAction} />
          <KV k={t('event_label')} v={log.eventLabel} />
          <KV k={t('event_value')} v={log.eventValue} />
          <KV k={t('event_sequence')} v={log.eventSequence} />
        </Section>

        <Section title={t('page_course')}>
          <KV
            k={t('page_label')}
            v={<span className="font-mono text-xs">{log.pagePath}</span>}
          />
          <KV k={t('title_label')} v={log.pageTitle} />
          <KV
            k={t('referrer')}
            v={
              log.referrerUrl
                ? `${log.referrerUrl.substring(0, 30)}…`
                : null
            }
          />
          <KV
            k={t('course')}
            v={
              log.courseTitle
                ? `${log.courseTitle} (#${log.courseId})`
                : null
            }
          />
          <KV k={t('module')} v={log.moduleTitle} />
          <KV k={t('lecture')} v={log.lectureTitle} />
        </Section>

        <Section title={t('client_info')}>
          <KV k={t('device')} v={log.deviceType} />
          <KV
            k={t('browser')}
            v={
              log.browserName
                ? `${log.browserName} ${log.browserVersion || ''}`.trim()
                : null
            }
          />
          <KV
            k={t('os')}
            v={log.osName ? `${log.osName} ${log.osVersion || ''}`.trim() : null}
          />
          <KV
            k={t('screen')}
            v={
              log.screenWidth && log.screenHeight
                ? `${log.screenWidth}×${log.screenHeight}`
                : null
            }
          />
          <KV
            k={t('viewport')}
            v={
              log.viewportWidth && log.viewportHeight
                ? `${log.viewportWidth}×${log.viewportHeight}`
                : null
            }
          />
          <KV k={t('language_label')} v={log.language} />
          <KV k={t('timezone_label')} v={log.timezone} />
        </Section>

        {(log.elementId || log.elementType || log.elementText) && (
          <Section title={t('element_details')} full>
            <KV k={t('element_id')} v={log.elementId} />
            <KV k={t('element_type_label')} v={log.elementType} />
            <KV k={t('element_name')} v={log.elementName} />
            <KV k={t('element_value_label')} v={log.elementValue} />
            {log.elementText && (
              <KV
                k={t('element_text')}
                v={
                  log.elementText.length > 100
                    ? `${log.elementText.slice(0, 100)}…`
                    : log.elementText
                }
              />
            )}
            {log.elementHref && (
              <KV
                k={t('element_href')}
                v={<span className="font-mono text-xs">{log.elementHref}</span>}
              />
            )}
          </Section>
        )}

        {log.metadata && Object.keys(log.metadata).length > 0 && (
          <Section title={t('metadata_expand')} full>
            <pre className="max-h-48 overflow-y-auto p-3 bg-gray-100 dark:bg-gray-900 rounded text-xs text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
              {JSON.stringify(log.metadata, null, 2)}
            </pre>
          </Section>
        )}
      </div>
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
  <div className={`space-y-2 ${full ? 'md:col-span-2 lg:col-span-3' : ''}`}>
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
