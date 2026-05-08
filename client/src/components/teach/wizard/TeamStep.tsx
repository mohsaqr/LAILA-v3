import { useState, useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { CheckSquare, Square, Users } from 'lucide-react';
import toast from 'react-hot-toast';
import { Card, CardBody } from '../../common/Card';
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
 * Wizard step 4 — Team Members. Same minimal pattern as the AI
 * Tutors step:
 *   - No banner intro, no "Add Role" popup, no Course Team header card.
 *   - 2-column grid of available instructors as checkbox rows.
 *   - Click a row → toggle the user as a TA (default role) instantly.
 *     Auto-saves; no Save button.
 *   - For an added user, a small inline role select (TA /
 *     Co-Instructor / Course Admin) lets the instructor change the
 *     role without opening a modal.
 */
export const TeamStep = ({ courseId, instructorId }: TeamStepProps) => {
  const { t } = useTranslation(['admin', 'teaching']);
  const { isDark } = useTheme();
  const queryClient = useQueryClient();

  const [busyUserId, setBusyUserId] = useState<number | null>(null);

  const { data: roles = [] } = useQuery({
    queryKey: ['courseRoles', courseId],
    queryFn: () => courseRolesApi.getCourseRoles(courseId),
  });

  const { data: usersData } = useQuery({
    queryKey: ['instructorsForRoles'],
    queryFn: () => usersApi.getUsers(1, 1000, undefined, 'instructor'),
  });

  // Eligible candidates: instructors that aren't the course owner and
  // aren't admins. Already-assigned users keep their slot but render
  // with the checked state and a role selector.
  const eligible = useMemo<User[]>(() => {
    const all = usersData?.users ?? [];
    return all.filter(u => u.id !== instructorId && !u.isAdmin);
  }, [usersData, instructorId]);

  const roleByUserId = useMemo(() => {
    const map = new Map<number, CourseRole>();
    for (const r of roles) map.set(r.userId, r);
    return map;
  }, [roles]);

  const assignMutation = useMutation({
    mutationFn: ({ userId, role }: { userId: number; role: CourseRoleType }) =>
      courseRolesApi.assignRole(courseId, userId, role, ROLE_DEFAULT_PERMISSIONS[role]),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['courseRoles', courseId] });
    },
    onError: () => toast.error(t('admin:failed_to_save', { defaultValue: 'Failed to update team.' })),
    onSettled: () => setBusyUserId(null),
  });

  const updateMutation = useMutation({
    mutationFn: ({ roleId, role }: { roleId: number; role: CourseRoleType }) =>
      courseRolesApi.updateRole(courseId, roleId, {
        role,
        permissions: ROLE_DEFAULT_PERMISSIONS[role],
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['courseRoles', courseId] });
    },
    onError: () => toast.error(t('admin:failed_to_save', { defaultValue: 'Failed to update team.' })),
  });

  const removeMutation = useMutation({
    mutationFn: (roleId: number) => courseRolesApi.removeRole(courseId, roleId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['courseRoles', courseId] });
    },
    onError: () => toast.error(t('admin:failed_to_save', { defaultValue: 'Failed to update team.' })),
    onSettled: () => setBusyUserId(null),
  });

  const toggleUser = (user: User) => {
    if (busyUserId != null) return;
    setBusyUserId(user.id);
    const existing = roleByUserId.get(user.id);
    if (existing) {
      removeMutation.mutate(existing.id);
    } else {
      assignMutation.mutate({ userId: user.id, role: 'ta' });
    }
  };

  const changeRole = (roleId: number, next: CourseRoleType) => {
    updateMutation.mutate({ roleId, role: next });
  };

  const muted = isDark ? '#9ca3af' : '#6b7280';
  const subtle = isDark ? '#cbd5e1' : '#374151';

  return (
    <Card>
      <CardBody>
        <h2 className="text-base font-semibold mb-3" style={{ color: isDark ? '#f3f4f6' : '#111827' }}>
          {t('admin:course_team', { defaultValue: 'Course team' })}
        </h2>

        {eligible.length === 0 ? (
          <div className="flex flex-col items-center py-8 text-center" style={{ color: muted }}>
            <Users className="w-10 h-10 mb-2 opacity-60" />
            <p className="text-sm">
              {t('admin:no_team_members', { defaultValue: 'No instructors to assign yet.' })}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {eligible.map(user => {
              const assigned = roleByUserId.get(user.id);
              const isAssigned = !!assigned;
              return (
                <div
                  key={user.id}
                  className="flex items-center gap-3 p-3 rounded-lg border transition-colors"
                  style={{
                    backgroundColor: isAssigned
                      ? (isDark ? 'rgba(8,143,143,0.10)' : '#ecfeff')
                      : (isDark ? '#1f2937' : '#ffffff'),
                    borderColor: isAssigned ? '#0d9488' : (isDark ? '#374151' : '#e5e7eb'),
                  }}
                >
                  <button
                    type="button"
                    onClick={() => toggleUser(user)}
                    aria-label={isAssigned
                      ? t('common:remove', { defaultValue: 'Remove' })
                      : t('admin:add_team_member', { defaultValue: 'Add' })}
                    className="shrink-0 inline-flex items-center justify-center w-5 h-5"
                    disabled={busyUserId === user.id}
                  >
                    {isAssigned ? (
                      <CheckSquare className="w-5 h-5 text-primary-600" />
                    ) : (
                      <Square className="w-5 h-5" style={{ color: muted }} />
                    )}
                  </button>

                  <Avatar
                    src={user.avatarUrl ? resolveFileUrl(user.avatarUrl) : null}
                    name={user.fullname || user.email || '?'}
                    size="sm"
                  />

                  <button
                    type="button"
                    onClick={() => toggleUser(user)}
                    className="flex-1 min-w-0 text-left"
                    disabled={busyUserId === user.id}
                  >
                    <p className="text-sm font-medium truncate" style={{ color: subtle }}>
                      {user.fullname}
                    </p>
                    <p className="text-xs truncate" style={{ color: muted }}>
                      {user.email}
                    </p>
                  </button>

                  {isAssigned && assigned && (
                    <select
                      value={assigned.role}
                      onChange={e => changeRole(assigned.id, e.target.value as CourseRoleType)}
                      className="text-xs px-2 py-1 rounded border focus:outline-none focus:ring-2 focus:ring-primary-300"
                      style={{
                        backgroundColor: isDark ? '#1f2937' : '#ffffff',
                        borderColor: isDark ? '#374151' : '#e5e7eb',
                        color: subtle,
                      }}
                      onClick={e => e.stopPropagation()}
                    >
                      <option value="ta">{ROLE_LABELS.ta}</option>
                      <option value="co_instructor">{ROLE_LABELS.co_instructor}</option>
                      <option value="course_admin">{ROLE_LABELS.course_admin}</option>
                    </select>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardBody>
    </Card>
  );
};
