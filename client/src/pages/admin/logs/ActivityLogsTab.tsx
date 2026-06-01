/**
 * Activity Logs tab — StatCard strip + DataTable + details modal.
 * Style matches /teach/quizzes and the chatbot registry.
 */

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import {
  Activity,
  BookOpen,
  Eye,
  ListChecks,
  Users,
} from 'lucide-react';
import { activityLogApi } from '../../../api/admin';
import { StatCard } from '../../../components/admin/StatCard';
import {
  DataTable,
  type ColumnDef,
} from '../../../components/common/DataTable';
import { RowMenu } from '../../../components/common/RowMenu';
import { Modal } from '../../../components/common/Modal';
import { useTheme } from '../../../hooks/useTheme';
import { verbColors, objectTypeColors } from './constants';
import { formatDate } from './exportUtils';

interface ActivityLogsTabProps {
  exportStatus: 'idle' | 'loading' | 'success' | 'error';
  setExportStatus: (status: 'idle' | 'loading' | 'success' | 'error') => void;
  fixedCourseId?: number;
  initialUserId?: number;
}

interface ActivityLog {
  id: number;
  timestamp: string;
  userId: number;
  userEmail: string | null;
  userFullname: string | null;
  userRole: string | null;
  sessionId: string | null;
  verb: string;
  objectType: string;
  objectId: number | null;
  objectTitle: string | null;
  objectSubtype: string | null;
  courseId: number | null;
  courseTitle: string | null;
  courseSlug: string | null;
  moduleId: number | null;
  moduleTitle: string | null;
  moduleOrder: number | null;
  lectureId: number | null;
  lectureTitle: string | null;
  lectureOrder: number | null;
  sectionId: number | null;
  sectionTitle: string | null;
  sectionOrder: number | null;
  success: boolean | null;
  score: number | null;
  maxScore: number | null;
  progress: number | null;
  duration: number | null;
  deviceType: string | null;
  browserName: string | null;
  actionSubtype: string | null;
  route: string | null;
  eventUuid: string | null;
  extensions: Record<string, unknown> | null;
}

export const ActivityLogsTab = ({
  exportStatus,
  setExportStatus,
  fixedCourseId,
  initialUserId,
}: ActivityLogsTabProps) => {
  const { t } = useTranslation(['admin', 'common']);
  const { isDark } = useTheme();
  const [details, setDetails] = useState<ActivityLog | null>(null);

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

  // Single big fetch — DataTable does client-side filter / sort / page.
  const { data: logsData, isLoading } = useQuery({
    queryKey: ['activityLogs', 'all', fixedCourseId ?? null, initialUserId ?? null],
    queryFn: () =>
      activityLogApi.getLogs({
        page: 1,
        limit: 1000,
        sortBy: 'timestamp',
        sortOrder: 'desc',
        ...(fixedCourseId ? { courseId: fixedCourseId } : {}),
        ...(initialUserId ? { userId: initialUserId } : {}),
      }),
  });

  const { data: filterOptions } = useQuery({
    queryKey: ['activityLogFilterOptions', fixedCourseId ?? null],
    queryFn: () => activityLogApi.getFilterOptions(fixedCourseId),
    staleTime: 5 * 60 * 1000,
  });

  const { data: stats } = useQuery({
    queryKey: ['activityLogStats', fixedCourseId ?? null],
    queryFn: () =>
      activityLogApi.getStats({ courseId: fixedCourseId }),
  });

  const logs: ActivityLog[] = logsData?.logs ?? [];

  const handleExport = async () => {
    setExportStatus('loading');
    try {
      await activityLogApi.exportJSON({
        ...(fixedCourseId ? { courseId: fixedCourseId } : {}),
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

  const columns: ColumnDef<ActivityLog>[] = [
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
      width: '16%',
      filter: {
        kind: 'select',
        options:
          filterOptions?.users.map(u => ({
            value: String(u.id),
            label: u.fullname || u.email || `User #${u.id}`,
          })) ?? [],
        predicate: (l, v) => String(l.userId) === v,
      },
      cell: l => (
        <div className="min-w-0">
          <p className="text-sm truncate text-gray-700 dark:text-gray-200">
            {l.userFullname || t('common:unknown', { defaultValue: 'Unknown' })}
          </p>
          <p className="text-xs truncate text-gray-500 dark:text-gray-400">
            {l.userEmail}
          </p>
        </div>
      ),
    },
    {
      id: 'verb',
      header: t('verb'),
      sortAccessor: l => l.verb,
      width: '9rem',
      filter: {
        kind: 'select',
        options:
          filterOptions?.verbs.map(v => ({
            value: v.verb,
            label: `${v.verb} (${v.count})`,
          })) ?? [],
        predicate: (l, v) => l.verb === v,
      },
      cell: l => (
        <span
          className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${
            verbColors[l.verb] ||
            'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200'
          }`}
        >
          {l.verb}
        </span>
      ),
    },
    {
      id: 'objectType',
      header: t('object_type'),
      sortAccessor: l => l.objectType,
      width: '9rem',
      hideOnMobile: true,
      filter: {
        kind: 'select',
        options:
          filterOptions?.objectTypes.map(o => ({
            value: o.objectType,
            label: `${o.objectType} (${o.count})`,
          })) ?? [],
        predicate: (l, v) => l.objectType === v,
      },
      cell: l => (
        <span
          className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${
            objectTypeColors[l.objectType] ||
            'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200'
          }`}
        >
          {l.objectType}
        </span>
      ),
    },
    {
      id: 'object',
      header: t('object'),
      sortAccessor: l => (l.objectTitle || '').toLowerCase(),
      width: '14%',
      hideOnMobile: true,
      cell: l => (
        <div className="min-w-0">
          <p
            className="text-sm truncate text-gray-700 dark:text-gray-200"
            title={l.objectTitle || ''}
          >
            {l.objectTitle || '—'}
          </p>
          {l.objectSubtype && (
            <p className="text-xs truncate text-gray-400 dark:text-gray-500">
              {l.objectSubtype}
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
      filter: !fixedCourseId
        ? {
            kind: 'select',
            options:
              filterOptions?.courses
                .filter(c => c.id != null)
                .map(c => ({
                  value: String(c.id),
                  label: c.title || `Course #${c.id}`,
                })) ?? [],
            predicate: (l, v) => String(l.courseId ?? '') === v,
          }
        : undefined,
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
      id: 'progress',
      header: t('progress'),
      sortAccessor: l => l.progress ?? -1,
      width: '8rem',
      hideOnMobile: true,
      cell: l =>
        l.progress != null ? (
          <div className="flex items-center gap-2">
            <div className="w-14 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-500 dark:bg-blue-400 rounded-full"
                style={{ width: `${l.progress}%` }}
              />
            </div>
            <span className="text-xs text-gray-600 dark:text-gray-300 tabular-nums">
              {l.progress}%
            </span>
          </div>
        ) : (
          <span className="text-xs text-gray-400 dark:text-gray-500">—</span>
        ),
    },
    {
      id: 'duration',
      header: t('duration'),
      sortAccessor: l => l.duration ?? -1,
      align: 'right',
      width: '5.5rem',
      hideOnMobile: true,
      cell: l => (
        <span className="text-xs text-gray-600 dark:text-gray-300 tabular-nums">
          {l.duration != null ? `${l.duration}s` : '—'}
        </span>
      ),
    },
  ];

  return (
    <>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 mb-6">
        <StatCard
          icon={<Activity className="w-5 h-5" style={{ color: c.txBlue }} />}
          iconBgColor={c.bgBlue}
          value={(stats?.totalActivities || 0).toLocaleString()}
          label={t('total_activities')}
          size="sm"
        />
        <StatCard
          icon={<Users className="w-5 h-5" style={{ color: c.txGreen }} />}
          iconBgColor={c.bgGreen}
          value={(filterOptions?.users.length || 0).toLocaleString()}
          label={t('unique_users')}
          size="sm"
        />
        <StatCard
          icon={<ListChecks className="w-5 h-5" style={{ color: c.txTeal }} />}
          iconBgColor={c.bgTeal}
          value={(filterOptions?.verbs.length || 0).toLocaleString()}
          label={t('verb')}
          size="sm"
        />
        <StatCard
          icon={<BookOpen className="w-5 h-5" style={{ color: c.txPurple }} />}
          iconBgColor={c.bgPurple}
          value={(filterOptions?.courses.length || 0).toLocaleString()}
          label={t('courses')}
          size="sm"
        />
      </div>

      <DataTable<ActivityLog>
        rows={logs}
        columns={columns}
        rowKey={l => l.id}
        isLoading={isLoading}
        pageSize={20}
        globalSearch={{
          placeholder: t('search_user_object_course'),
          predicate: (l, q) => {
            const x = q.toLowerCase();
            return (
              (l.userFullname || '').toLowerCase().includes(x) ||
              (l.userEmail || '').toLowerCase().includes(x) ||
              (l.objectTitle || '').toLowerCase().includes(x) ||
              (l.courseTitle || '').toLowerCase().includes(x) ||
              l.verb.toLowerCase().includes(x) ||
              l.objectType.toLowerCase().includes(x)
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
        title={details?.verb || t('activity_log')}
        size="4xl"
      >
        {details && <ActivityDetailsView log={details} />}
      </Modal>
    </>
  );
};

const ActivityDetailsView = ({ log }: { log: ActivityLog }) => {
  const { t } = useTranslation(['admin', 'common']);
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
      <Section title={t('user_context')}>
        <KV k={t('id')} v={log.userId} />
        <KV k={t('email')} v={log.userEmail} />
        <KV k={t('name')} v={log.userFullname} />
        <KV k={t('role')} v={log.userRole} />
        <KV
          k={t('session')}
          v={
            log.sessionId
              ? `${log.sessionId.substring(0, 16)}…`
              : null
          }
        />
      </Section>

      <Section title={t('object')}>
        <KV k={t('object_type')} v={log.objectType} />
        <KV k={t('object')} v={log.objectTitle} />
        <KV k={t('id')} v={log.objectId} />
        <KV k="Subtype" v={log.objectSubtype} />
        <KV k="Action" v={log.actionSubtype} />
        {log.route && <KV k="Route" v={<span className="font-mono text-xs">{log.route}</span>} />}
      </Section>

      <Section title={t('course_hierarchy')}>
        <KV
          k={t('course')}
          v={log.courseTitle ? `${log.courseTitle} (#${log.courseId})` : null}
        />
        <KV k={t('module')} v={log.moduleTitle} />
        <KV k={t('lecture')} v={log.lectureTitle} />
        <KV k={t('section')} v={log.sectionTitle} />
      </Section>

      <Section title={t('results')}>
        <KV
          k={t('common:success')}
          v={
            log.success != null
              ? log.success
                ? t('common:yes')
                : t('common:no')
              : null
          }
        />
        <KV
          k={t('score')}
          v={
            log.score != null
              ? `${log.score}${log.maxScore != null ? ` / ${log.maxScore}` : ''}`
              : null
          }
        />
        <KV
          k={t('progress')}
          v={log.progress != null ? `${log.progress}%` : null}
        />
        <KV
          k={t('duration')}
          v={log.duration != null ? `${log.duration} ${t('seconds')}` : null}
        />
      </Section>

      <Section title={t('client_info')}>
        <KV k={t('device')} v={log.deviceType} />
        <KV k={t('browser')} v={log.browserName} />
      </Section>

      {log.extensions && Object.keys(log.extensions).length > 0 && (
        <Section title={t('extensions')} full>
          <pre className="max-h-48 overflow-y-auto p-3 bg-gray-100 dark:bg-gray-900 rounded text-xs text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
            {JSON.stringify(log.extensions, null, 2)}
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
