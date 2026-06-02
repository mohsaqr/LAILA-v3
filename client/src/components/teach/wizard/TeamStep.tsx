import { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { ChevronDown, Search, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { useTheme } from '../../../hooks/useTheme';
import { Avatar } from '../../dashboard/Avatar';
import { resolveFileUrl } from '../../../api/client';
import {
  courseRolesApi,
  ROLE_DEFAULT_PERMISSIONS,
  ROLE_LABELS,
  type CourseRoleType,
} from '../../../api/courseRoles';
import { usersApi } from '../../../api/users';
import type { User, CourseRole } from '../../../types';

interface TeamStepProps {
  courseId: number;
  instructorId: number;
}

/**
 * Wizard step 4 — Team Members.
 *
 *  - Searchable instructor picker. Type a name → matching candidates
 *    drop down → click to add. No popup, no card grid of all 100
 *    instructors.
 *  - Live table of the course's roles, read straight from the
 *    ['courseRoles'] query (avatar, name, email, role select, remove).
 *  - Each add / role-change / remove is persisted IMMEDIATELY (assign /
 *    update / remove role) with an optimistic cache update, so changes
 *    survive a page refresh. Every mutation invalidates the query on
 *    settle to re-sync with the server.
 */
export const TeamStep = ({ courseId, instructorId }: TeamStepProps) => {
  const { t } = useTranslation(['admin', 'common', 'teaching']);
  const { isDark } = useTheme();
  const queryClient = useQueryClient();

  // ─── Server data ───────────────────────────────────────────────────────
  const { data: serverRoles = [] } = useQuery({
    queryKey: ['courseRoles', courseId],
    queryFn: () => courseRolesApi.getCourseRoles(courseId),
  });

  const { data: usersData } = useQuery({
    queryKey: ['instructorsForRoles'],
    queryFn: () => usersApi.getUsers(1, 1000, undefined, 'instructor'),
  });

  // Users already on the team — so the picker can exclude them.
  const assignedUserIds = useMemo(
    () => new Set(serverRoles.map(r => r.userId)),
    [serverRoles],
  );

  // ─── Mutations — persist each change immediately (so it survives a page
  //     refresh) with optimistic cache updates. The member list is read
  //     straight from the ['courseRoles'] query, which each mutation
  //     invalidates on settle. ────────────────────────────────────────────
  const failToast = () =>
    toast.error(t('admin:failed_to_save', { defaultValue: 'Failed to save team.' }));
  const invalidateRoles = () =>
    queryClient.invalidateQueries({ queryKey: ['courseRoles', courseId] });
  const snapshot = async () => {
    await queryClient.cancelQueries({ queryKey: ['courseRoles', courseId] });
    return queryClient.getQueryData<CourseRole[]>(['courseRoles', courseId]);
  };
  const rollback = (ctx: { prev?: CourseRole[] } | undefined) => {
    if (ctx?.prev) queryClient.setQueryData(['courseRoles', courseId], ctx.prev);
    failToast();
  };

  const assignMutation = useMutation({
    mutationFn: ({ userId, role }: { userId: number; role: CourseRoleType }) =>
      courseRolesApi.assignRole(courseId, userId, role, ROLE_DEFAULT_PERMISSIONS[role]),
    onMutate: async ({ userId, role }) => {
      const prev = await snapshot();
      const u = (usersData?.users ?? []).find(x => x.id === userId);
      const optimistic = {
        id: -Date.now(),
        courseId,
        userId,
        role,
        permissions: ROLE_DEFAULT_PERMISSIONS[role],
        user: u ? { id: u.id, fullname: u.fullname, email: u.email, avatarUrl: u.avatarUrl ?? null } : undefined,
      } as unknown as CourseRole;
      queryClient.setQueryData<CourseRole[]>(['courseRoles', courseId], old => [optimistic, ...(old ?? [])]);
      return { prev };
    },
    onError: (_e, _v, ctx) => rollback(ctx as { prev?: CourseRole[] }),
    onSettled: invalidateRoles,
  });

  const updateMutation = useMutation({
    mutationFn: ({ roleId, role }: { roleId: number; role: CourseRoleType }) =>
      courseRolesApi.updateRole(courseId, roleId, { role, permissions: ROLE_DEFAULT_PERMISSIONS[role] }),
    onMutate: async ({ roleId, role }) => {
      const prev = await snapshot();
      queryClient.setQueryData<CourseRole[]>(['courseRoles', courseId], old =>
        (old ?? []).map(r => (r.id === roleId ? { ...r, role } : r)));
      return { prev };
    },
    onError: (_e, _v, ctx) => rollback(ctx as { prev?: CourseRole[] }),
    onSettled: invalidateRoles,
  });

  const removeMutation = useMutation({
    mutationFn: (roleId: number) => courseRolesApi.removeRole(courseId, roleId),
    onMutate: async roleId => {
      const prev = await snapshot();
      queryClient.setQueryData<CourseRole[]>(['courseRoles', courseId], old =>
        (old ?? []).filter(r => r.id !== roleId));
      return { prev };
    },
    onError: (_e, _v, ctx) => rollback(ctx as { prev?: CourseRole[] }),
    onSettled: invalidateRoles,
  });

  // ─── Search picker ────────────────────────────────────────────────────
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  const candidates = useMemo<User[]>(() => {
    const all = usersData?.users ?? [];
    const trimmed = query.trim().toLowerCase();
    return all.filter(u => {
      if (u.id === instructorId) return false;
      if (u.isAdmin) return false;
      if (assignedUserIds.has(u.id)) return false;
      if (!trimmed) return true;
      return (
        (u.fullname ?? '').toLowerCase().includes(trimmed) ||
        (u.email ?? '').toLowerCase().includes(trimmed)
      );
    });
  }, [usersData, query, assignedUserIds, instructorId]);

  const addUser = (user: User) => {
    assignMutation.mutate({ userId: user.id, role: 'ta' });
    setQuery('');
    setOpen(false);
  };

  const removeUser = (roleId: number) => removeMutation.mutate(roleId);

  const changeRole = (roleId: number, role: CourseRoleType) => updateMutation.mutate({ roleId, role });

  // ─── Render ────────────────────────────────────────────────────────────
  const cardBg = isDark ? '#1f2937' : '#ffffff';
  const cardBorder = isDark ? '#374151' : '#e5e7eb';
  const subtle = isDark ? '#cbd5e1' : '#374151';
  const muted = isDark ? '#9ca3af' : '#6b7280';
  const dividerColor = isDark ? '#374151' : '#f3f4f6';

  // Member list is the server roles directly (with optimistic updates applied
  // to the query cache by the mutations above).
  const members = serverRoles as Array<
    CourseRole & { user?: Pick<User, 'id' | 'fullname' | 'email' | 'avatarUrl'> | null }
  >;

  return (
    <div className="space-y-4">
      {/* Compact searchable picker — opens to the full instructor list
          on focus, filters as the user types. */}
      <div ref={wrapperRef} className="relative max-w-sm">
        <Search
          className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5"
          style={{ color: muted }}
        />
        <input
          type="text"
          value={query}
          onFocus={() => setOpen(true)}
          onChange={e => { setQuery(e.target.value); setOpen(true); }}
          placeholder={t('admin:search_to_add_member', {
            defaultValue: 'Search instructors…',
          })}
          className="w-full pl-8 pr-3 py-1.5 text-xs rounded-md border focus:outline-none focus:ring-2 focus:ring-primary-300"
          style={{ backgroundColor: cardBg, borderColor: cardBorder, color: subtle }}
        />
        {open && (
          <div
            className="absolute left-0 right-0 mt-1 rounded-md border shadow-lg z-20 max-h-64 overflow-y-auto"
            style={{ backgroundColor: cardBg, borderColor: cardBorder }}
          >
            {candidates.length === 0 ? (
              <div className="px-3 py-4 text-sm text-center" style={{ color: muted }}>
                {query.trim()
                  ? t('common:no_results', { defaultValue: 'No matches' })
                  : t('admin:no_team_members', { defaultValue: 'No instructors to add.' })}
              </div>
            ) : (
              candidates.slice(0, 50).map(user => (
                <button
                  key={user.id}
                  type="button"
                  onClick={() => addUser(user)}
                  className="w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-black/5 dark:hover:bg-white/5"
                >
                  <Avatar
                    src={user.avatarUrl ? resolveFileUrl(user.avatarUrl) : null}
                    name={user.fullname || user.email || '?'}
                    size="sm"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate" style={{ color: subtle }}>
                      {user.fullname}
                    </p>
                    <p className="text-xs truncate" style={{ color: muted }}>
                      {user.email}
                    </p>
                  </div>
                </button>
              ))
            )}
          </div>
        )}
      </div>

      {/* Members table — only rendered when at least one member exists.
          No overflow-hidden so the role-select popover can escape the
          rounded border without being clipped. */}
      {members.length > 0 && (
        <div
          className="rounded-lg border"
          style={{ backgroundColor: cardBg, borderColor: cardBorder }}
        >
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: `1px solid ${dividerColor}` }}>
                <th className="text-left px-4 py-2.5 text-xs font-semibold uppercase tracking-wider" style={{ color: muted }}>
                  {t('common:name', { defaultValue: 'Name' })}
                </th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold uppercase tracking-wider hidden sm:table-cell" style={{ color: muted }}>
                  {t('common:email', { defaultValue: 'Email' })}
                </th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold uppercase tracking-wider" style={{ color: muted }}>
                  {t('admin:role', { defaultValue: 'Role' })}
                </th>
                <th className="px-4 py-2.5 w-10"></th>
              </tr>
            </thead>
            <tbody>
              {members.map(m => {
                const user = m.user;
                return (
                  <tr
                    key={m.id}
                    style={{ borderBottom: `1px solid ${dividerColor}` }}
                    className="last:border-b-0"
                  >
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2.5">
                        <Avatar
                          src={user?.avatarUrl ? resolveFileUrl(user.avatarUrl) : null}
                          name={user?.fullname || user?.email || '?'}
                          size="sm"
                        />
                        <span className="font-medium truncate" style={{ color: subtle }}>
                          {user?.fullname || '—'}
                        </span>
                      </div>
                    </td>
                    <td
                      className="px-4 py-2.5 truncate hidden sm:table-cell"
                      style={{ color: muted }}
                    >
                      {user?.email || '—'}
                    </td>
                    <td className="px-4 py-2.5">
                      <RoleSelect
                        value={m.role as CourseRoleType}
                        onChange={(next) => changeRole(m.id, next)}
                      />
                    </td>
                    <td className="px-2 py-2.5 text-right">
                      <button
                        type="button"
                        onClick={() => removeUser(m.id)}
                        aria-label={t('common:remove', { defaultValue: 'Remove' })}
                        title={t('common:remove', { defaultValue: 'Remove' })}
                        className="inline-flex items-center justify-center w-7 h-7 rounded-md text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

/**
 * Role select that matches the Difficulty Level dropdown on the
 * Setting step: rounded border, the selected value renders as a
 * teal chip, and the dropdown lists each option with a radio-style
 * indicator. No search field — three options doesn't need one.
 */
const RoleSelect = ({
  value,
  onChange,
}: {
  value: CourseRoleType;
  onChange: (v: CourseRoleType) => void;
}) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  const options: Array<{ value: CourseRoleType; label: string }> = [
    { value: 'ta', label: ROLE_LABELS.ta },
    { value: 'co_instructor', label: ROLE_LABELS.co_instructor },
    { value: 'course_admin', label: ROLE_LABELS.course_admin },
  ];
  const selected = options.find(o => o.value === value);

  return (
    <div ref={ref} className="relative w-44">
      <div
        onClick={() => setOpen(o => !o)}
        className={`min-h-[36px] w-full px-2.5 py-1.5 flex items-center gap-1.5 rounded-lg border cursor-pointer transition-colors bg-white dark:bg-gray-800 ${
          open
            ? 'border-primary-500 ring-2 ring-primary-500/20'
            : 'border-gray-300 dark:border-gray-600 hover:border-gray-400'
        }`}
      >
        {selected && (
          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-300">
            {selected.label}
          </span>
        )}
        <ChevronDown
          className={`w-4 h-4 text-gray-400 ml-auto shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </div>

      {open && (
        <div className="absolute z-50 mt-1 w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-lg">
          <ul className="py-1">
            {options.map(opt => {
              const checked = opt.value === value;
              return (
                <li
                  key={opt.value}
                  onClick={() => { onChange(opt.value); setOpen(false); }}
                  className={`flex items-center gap-2.5 px-3 py-2 text-sm cursor-pointer transition-colors ${
                    checked
                      ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300'
                      : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/40'
                  }`}
                >
                  <span
                    className={`w-4 h-4 shrink-0 rounded-full border flex items-center justify-center transition-colors ${
                      checked ? 'bg-primary-500 border-primary-500' : 'border-gray-300 dark:border-gray-600'
                    }`}
                  >
                    {checked && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
                  </span>
                  {opt.label}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
};
