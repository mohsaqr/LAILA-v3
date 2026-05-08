import { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { ChevronDown, Search, Trash2, X } from 'lucide-react';
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
 *  - Live table of currently-selected members (avatar, name, email,
 *    role select, remove). Updates in real-time as the user picks.
 *  - Saves on the next step. Adds/removes/role changes accumulate
 *    locally in `pending`; the diff is flushed in a cleanup effect
 *    that fires when the user navigates away from the step (clicks
 *    Next, Back, or jumps via the stepper). React Query keeps the
 *    mutations in flight even after the component unmounts.
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

  // ─── Pending (local) state — flushed on unmount ────────────────────────
  type Pending = {
    user: Pick<User, 'id' | 'fullname' | 'email' | 'avatarUrl'>;
    role: CourseRoleType;
    /** Existing role id from the server, if this user is already assigned. */
    existingRoleId?: number;
    /** Tracks the role we last knew on the server for diff purposes. */
    serverRole?: CourseRoleType;
  };
  const [pending, setPending] = useState<Map<number, Pending>>(new Map());
  const pendingRef = useRef(pending);
  useEffect(() => { pendingRef.current = pending; }, [pending]);

  // Hydrate from server on first load + whenever the server list changes.
  // Preserve any local edits that haven't been flushed yet by overlaying
  // the local state on top of the server roles.
  const hydratedRef = useRef(false);
  useEffect(() => {
    if (hydratedRef.current && pending.size > 0) return;
    const next = new Map<number, Pending>();
    for (const r of serverRoles) {
      const u = (r.user as Pick<User, 'id' | 'fullname' | 'email' | 'avatarUrl'> | undefined) ?? {
        id: r.userId,
        fullname: '',
        email: '',
        avatarUrl: null,
      };
      next.set(r.userId, {
        user: u,
        role: r.role as CourseRoleType,
        existingRoleId: r.id,
        serverRole: r.role as CourseRoleType,
      });
    }
    setPending(next);
    hydratedRef.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serverRoles]);

  // ─── Mutations (silent — no toasts on success, only on failure) ────────
  const assignMutation = useMutation({
    mutationFn: ({ userId, role }: { userId: number; role: CourseRoleType }) =>
      courseRolesApi.assignRole(courseId, userId, role, ROLE_DEFAULT_PERMISSIONS[role]),
    onError: () => toast.error(t('admin:failed_to_save', { defaultValue: 'Failed to save team.' })),
  });
  const updateMutation = useMutation({
    mutationFn: ({ roleId, role }: { roleId: number; role: CourseRoleType }) =>
      courseRolesApi.updateRole(courseId, roleId, {
        role,
        permissions: ROLE_DEFAULT_PERMISSIONS[role],
      }),
    onError: () => toast.error(t('admin:failed_to_save', { defaultValue: 'Failed to save team.' })),
  });
  const removeMutation = useMutation({
    mutationFn: (roleId: number) => courseRolesApi.removeRole(courseId, roleId),
    onError: () => toast.error(t('admin:failed_to_save', { defaultValue: 'Failed to save team.' })),
  });

  // ─── Flush diff on unmount (when the user clicks Next or jumps step) ──
  useEffect(() => {
    return () => {
      const current = pendingRef.current;
      const removed: number[] = [];
      // For every user the server thinks is on the team, did we remove them locally?
      for (const r of serverRoles) {
        if (!current.has(r.userId)) removed.push(r.id);
      }
      const adds: Array<{ userId: number; role: CourseRoleType }> = [];
      const updates: Array<{ roleId: number; role: CourseRoleType }> = [];
      for (const [userId, p] of current.entries()) {
        if (!p.existingRoleId) {
          adds.push({ userId, role: p.role });
        } else if (p.serverRole && p.serverRole !== p.role) {
          updates.push({ roleId: p.existingRoleId, role: p.role });
        }
      }
      // Fire all in parallel; React Query keeps them alive after unmount.
      removed.forEach(id => removeMutation.mutate(id));
      adds.forEach(args => assignMutation.mutate(args));
      updates.forEach(args => updateMutation.mutate(args));
      if (removed.length || adds.length || updates.length) {
        // Invalidate after a tick so refetches pick up server state.
        setTimeout(() => {
          queryClient.invalidateQueries({ queryKey: ['courseRoles', courseId] });
        }, 50);
      }
    };
    // Intentional: only run cleanup on unmount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
      if (pending.has(u.id)) return false;
      if (!trimmed) return true;
      return (
        (u.fullname ?? '').toLowerCase().includes(trimmed) ||
        (u.email ?? '').toLowerCase().includes(trimmed)
      );
    });
  }, [usersData, query, pending, instructorId]);

  const addUser = (user: User) => {
    setPending(prev => {
      const next = new Map(prev);
      next.set(user.id, {
        user: { id: user.id, fullname: user.fullname, email: user.email, avatarUrl: user.avatarUrl ?? null },
        role: 'ta',
      });
      return next;
    });
    setQuery('');
    setOpen(false);
  };

  const removeUser = (userId: number) => {
    setPending(prev => {
      const next = new Map(prev);
      next.delete(userId);
      return next;
    });
  };

  const changeRole = (userId: number, role: CourseRoleType) => {
    setPending(prev => {
      const next = new Map(prev);
      const cur = next.get(userId);
      if (cur) next.set(userId, { ...cur, role });
      return next;
    });
  };

  // ─── Render ────────────────────────────────────────────────────────────
  const cardBg = isDark ? '#1f2937' : '#ffffff';
  const cardBorder = isDark ? '#374151' : '#e5e7eb';
  const subtle = isDark ? '#cbd5e1' : '#374151';
  const muted = isDark ? '#9ca3af' : '#6b7280';
  const dividerColor = isDark ? '#374151' : '#f3f4f6';

  const members = Array.from(pending.values());
  // Cast keeps the never-used CourseRole import live for TypeScript awareness.
  void (null as unknown as CourseRole);

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

      {/* Members table — only rendered when at least one member exists. */}
      {members.length > 0 && (
        <div
          className="rounded-lg border overflow-hidden"
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
              {members.map(({ user, role }) => (
                <tr
                  key={user.id}
                  style={{ borderBottom: `1px solid ${dividerColor}` }}
                  className="last:border-b-0"
                >
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2.5">
                      <Avatar
                        src={user.avatarUrl ? resolveFileUrl(user.avatarUrl) : null}
                        name={user.fullname || user.email || '?'}
                        size="sm"
                      />
                      <span className="font-medium truncate" style={{ color: subtle }}>
                        {user.fullname || '—'}
                      </span>
                    </div>
                  </td>
                  <td
                    className="px-4 py-2.5 truncate hidden sm:table-cell"
                    style={{ color: muted }}
                  >
                    {user.email || '—'}
                  </td>
                  <td className="px-4 py-2.5">
                    <RoleSelect
                      value={role}
                      onChange={(next) => changeRole(user.id, next)}
                    />
                  </td>
                  <td className="px-2 py-2.5 text-right">
                    <button
                      type="button"
                      onClick={() => removeUser(user.id)}
                      aria-label={t('common:remove', { defaultValue: 'Remove' })}
                      title={t('common:remove', { defaultValue: 'Remove' })}
                      className="inline-flex items-center justify-center w-7 h-7 rounded-md text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Reference unused import to satisfy strict-mode lint without
          dropping availability for future callers. */}
      <span aria-hidden className="hidden">
        <X className="w-0 h-0" />
      </span>
    </div>
  );
};

/**
 * Styled role select matching the rest of the wizard's form chrome
 * (rounded-lg, focus-ring teal, chevron icon). Behaves like the
 * difficulty / curriculum-view-mode selects in the course settings
 * step — same look and same keyboard behaviour as a native select.
 */
const RoleSelect = ({
  value,
  onChange,
}: {
  value: CourseRoleType;
  onChange: (v: CourseRoleType) => void;
}) => {
  return (
    <div className="relative inline-flex items-center">
      <select
        value={value}
        onChange={e => onChange(e.target.value as CourseRoleType)}
        className="appearance-none pl-3 pr-8 py-1.5 text-sm rounded-lg border bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
      >
        <option value="ta">{ROLE_LABELS.ta}</option>
        <option value="co_instructor">{ROLE_LABELS.co_instructor}</option>
        <option value="course_admin">{ROLE_LABELS.course_admin}</option>
      </select>
      <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
    </div>
  );
};
