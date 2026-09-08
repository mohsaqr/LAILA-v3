import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { activityLogApi, type UserRosterRow } from '../../../api/admin';
import { DataTable, type ColumnDef } from '../../../components/common/DataTable';

interface UsersTabProps {
  /** Scopes the roster to one course; omit for the site-wide view. */
  courseId?: number;
}

/**
 * The "who was last seen when" roster.
 *
 * The other log tabs list events, so a per-row "last seen" there would repeat
 * the same date on every line for a user. This tab inverts it: one row per
 * person, sorted quietest first, which is the question the logs are usually
 * being opened to answer.
 *
 * `lastLogin` and `lastSeen` are deliberately shown side by side. They are not
 * the same thing and they disagree by weeks in practice — logins only update
 * on the password path, so an account created through email verification shows
 * a blank login while generating hundreds of events. Collapsing them into one
 * column would quietly hide that.
 */
export const UsersTab = ({ courseId }: UsersTabProps) => {
  const { t } = useTranslation(['admin', 'common']);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['userRoster', courseId ?? null],
    queryFn: () => activityLogApi.getUserRoster({ courseId, limit: 500 }),
  });

  const rows = data?.data ?? [];

  const fmtDate = (ms: number | null) =>
    ms == null ? null : new Date(ms).toLocaleDateString();

  /** Whole days since `ms`, or null when never. */
  const daysSince = (ms: number | null) =>
    ms == null ? null : Math.floor((Date.now() - ms) / 86_400_000);

  /**
   * Staleness is shown with a word as well as a colour — colour alone is not
   * an accessible way to encode a distinction.
   */
  const staleness = (ms: number | null): { label: string; className: string } => {
    const days = daysSince(ms);
    if (days == null) {
      return { label: t('never', { defaultValue: 'Never' }), className: 'text-gray-400 dark:text-gray-500' };
    }
    if (days <= 7) {
      return { label: t('recent', { defaultValue: 'Recent' }), className: 'text-emerald-700 dark:text-emerald-400' };
    }
    if (days <= 30) {
      return { label: t('idle', { defaultValue: 'Idle' }), className: 'text-amber-700 dark:text-amber-400' };
    }
    return { label: t('dormant', { defaultValue: 'Dormant' }), className: 'text-red-700 dark:text-red-400' };
  };

  const columns: ColumnDef<UserRosterRow>[] = [
    {
      id: 'name',
      header: t('name', { defaultValue: 'Name' }),
      sortAccessor: r => r.name.toLowerCase(),
      cell: r => (
        <div className="min-w-0">
          <div className="truncate font-medium text-gray-900 dark:text-gray-100">{r.name}</div>
          <div className="truncate text-xs text-gray-500 dark:text-gray-400">{r.email}</div>
        </div>
      ),
    },
    {
      id: 'role',
      header: t('role', { defaultValue: 'Role' }),
      width: '7rem',
      hideOnMobile: true,
      sortAccessor: r => r.role,
      cell: r => (
        <span className="text-xs text-gray-600 dark:text-gray-300 capitalize">{r.role}</span>
      ),
    },
    {
      id: 'lastLogin',
      header: t('last_login', { defaultValue: 'Last login' }),
      width: '8rem',
      align: 'right',
      hideOnMobile: true,
      // Never-logged-in sorts below every real date rather than above it.
      sortAccessor: r => r.lastLogin ?? 0,
      cell: r => (
        <span className="text-xs tabular-nums text-gray-600 dark:text-gray-300">
          {fmtDate(r.lastLogin) ?? '—'}
        </span>
      ),
    },
    {
      id: 'lastSeen',
      header: t('last_seen', { defaultValue: 'Last seen' }),
      width: '10rem',
      align: 'right',
      sortAccessor: r => r.lastSeen ?? 0,
      cell: r => {
        const state = staleness(r.lastSeen);
        const days = daysSince(r.lastSeen);
        return (
          <div className="text-right">
            <div className="text-xs tabular-nums text-gray-900 dark:text-gray-100">
              {fmtDate(r.lastSeen) ?? '—'}
            </div>
            <div className={`text-xs ${state.className}`}>
              {days == null
                ? state.label
                : t('days_ago', { count: days, defaultValue: '{{count}}d ago' })}
            </div>
          </div>
        );
      },
    },
    {
      id: 'events',
      header: t('events', { defaultValue: 'Events' }),
      width: '6rem',
      align: 'right',
      hideOnMobile: true,
      sortAccessor: r => r.events,
      cell: r => (
        <span className="text-xs tabular-nums text-gray-600 dark:text-gray-300">
          {r.events.toLocaleString()}
        </span>
      ),
    },
    {
      id: 'lastAction',
      header: t('last_action', { defaultValue: 'Last action' }),
      hideOnMobile: true,
      cell: r =>
        r.lastAction ? (
          <span className="text-xs text-gray-600 dark:text-gray-300">
            <span className="font-medium">{r.lastAction.verb}</span>{' '}
            {r.lastAction.objectType}
            {r.lastAction.objectTitle ? ` · ${r.lastAction.objectTitle}` : ''}
          </span>
        ) : (
          <span className="text-xs text-gray-400 dark:text-gray-500">—</span>
        ),
    },
  ];

  return (
    <DataTable<UserRosterRow>
      rows={rows}
      columns={columns}
      rowKey={r => r.userId}
      isLoading={isLoading}
      error={isError}
      onRetry={() => refetch()}
      pageSize={25}
      globalSearch={{
        placeholder: t('search_users', { defaultValue: 'Search users…' }),
        predicate: (r, q) =>
          r.name.toLowerCase().includes(q.toLowerCase()) ||
          r.email.toLowerCase().includes(q.toLowerCase()),
      }}
      empty={t('no_users_found', { defaultValue: 'No users found' })}
    />
  );
};
