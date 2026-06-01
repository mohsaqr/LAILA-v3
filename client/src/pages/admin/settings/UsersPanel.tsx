import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Activity, Pencil, UserCheck, UserX } from 'lucide-react';
import toast from 'react-hot-toast';
import { usersApi } from '../../../api/users';
import { adminApi } from '../../../api/admin';
import { useAuthStore } from '../../../store/authStore';
import { Button } from '../../../components/common/Button';
import { Modal } from '../../../components/common/Modal';
import {
  DataTable,
  type ColumnDef,
} from '../../../components/common/DataTable';
import { RowMenu } from '../../../components/common/RowMenu';

type Role = 'student' | 'instructor' | 'admin';

interface AdminUser {
  id: number;
  fullname: string;
  email: string;
  isAdmin: boolean;
  isInstructor: boolean;
  isActive?: boolean;
  createdAt?: string;
}

interface EditableUser {
  id: number;
  fullname: string;
  isAdmin: boolean;
  isInstructor: boolean;
}

const roleOf = (u: AdminUser): Role =>
  u.isAdmin ? 'admin' : u.isInstructor ? 'instructor' : 'student';

export const UsersPanel = () => {
  const { t } = useTranslation(['admin', 'common']);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const currentUser = useAuthStore(state => state.user);

  const [editUser, setEditUser] = useState<EditableUser | null>(null);
  const [selectedRole, setSelectedRole] = useState<Role>('student');

  const { data, isLoading } = useQuery({
    queryKey: ['users', 'all'],
    // Pull a large page so DataTable can do client-side filter/sort/page.
    queryFn: () => usersApi.getUsers(1, 1000),
  });

  const users: AdminUser[] = data?.users ?? [];

  const toggleStatusMutation = useMutation({
    mutationFn: ({ userId, isActive }: { userId: number; isActive: boolean }) =>
      usersApi.updateUser(userId, { isActive }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast.success(t('user_updated'));
    },
  });

  const changeRoleMutation = useMutation({
    mutationFn: ({
      userId,
      isAdmin,
      isInstructor,
    }: {
      userId: number;
      isAdmin: boolean;
      isInstructor: boolean;
    }) => usersApi.updateUser(userId, { isAdmin, isInstructor }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast.success(t('user_updated'));
      setEditUser(null);
    },
  });

  const openEditRole = (user: AdminUser) => {
    if (user.id === currentUser?.id) {
      toast.error(t('cannot_change_own_role'));
      return;
    }
    setSelectedRole(roleOf(user));
    setEditUser({
      id: user.id,
      fullname: user.fullname,
      isAdmin: user.isAdmin,
      isInstructor: user.isInstructor,
    });
  };

  const handleRoleSave = () => {
    if (!editUser) return;
    changeRoleMutation.mutate({
      userId: editUser.id,
      isAdmin: selectedRole === 'admin',
      isInstructor: selectedRole === 'admin' || selectedRole === 'instructor',
    });
  };

  const handleExport = async () => {
    try {
      const payload = await adminApi.exportData('users');
      const blob = new Blob([JSON.stringify(payload, null, 2)], {
        type: 'application/json',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `users-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(t('export_downloaded'));
    } catch {
      toast.error(t('export_failed'));
    }
  };

  const roles: { value: Role; label: string }[] = useMemo(
    () => [
      { value: 'student', label: t('role_student') },
      { value: 'instructor', label: t('role_instructor') },
      { value: 'admin', label: t('role_admin') },
    ],
    [t],
  );

  const columns: ColumnDef<AdminUser>[] = [
    {
      id: 'user',
      header: t('user'),
      sortAccessor: u => u.fullname.toLowerCase(),
      width: '40%',
      cell: u => (
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-7 h-7 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-xs font-medium text-gray-600 dark:text-gray-300 flex-shrink-0">
            {u.fullname?.charAt(0)?.toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="text-sm truncate text-gray-700 dark:text-gray-200" title={u.fullname}>
              {u.fullname}
            </p>
            <p className="text-xs truncate text-gray-500 dark:text-gray-400" title={u.email}>
              {u.email}
            </p>
          </div>
        </div>
      ),
    },
    {
      id: 'role',
      header: t('role'),
      sortAccessor: u => roleOf(u),
      width: '8rem',
      filter: {
        kind: 'select',
        options: roles.map(r => ({ value: r.value, label: r.label })),
        predicate: (u, v) => roleOf(u) === v,
      },
      cell: u => {
        const r = roleOf(u);
        const cls =
          r === 'admin'
            ? 'bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300'
            : r === 'instructor'
            ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
            : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200';
        return (
          <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded ${cls}`}>
            {t(`role_${r}`)}
          </span>
        );
      },
    },
    {
      id: 'status',
      header: t('status'),
      sortAccessor: u => (u.isActive !== false ? 'active' : 'inactive'),
      width: '7rem',
      hideOnMobile: true,
      filter: {
        kind: 'select',
        options: [
          { value: 'active', label: t('status_active') },
          { value: 'inactive', label: t('status_inactive') },
        ],
        predicate: (u, v) => (u.isActive !== false ? 'active' : 'inactive') === v,
      },
      cell: u =>
        u.isActive !== false ? (
          <span className="inline-flex px-2 py-0.5 text-xs font-medium rounded bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-300">
            {t('status_active')}
          </span>
        ) : (
          <span className="inline-flex px-2 py-0.5 text-xs font-medium rounded bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400">
            {t('status_inactive')}
          </span>
        ),
    },
    {
      id: 'joined',
      header: t('joined'),
      sortAccessor: u => (u.createdAt ? new Date(u.createdAt).getTime() : 0),
      width: '7rem',
      hideOnMobile: true,
      align: 'right',
      cell: u => (
        <span className="text-xs text-gray-600 dark:text-gray-300 tabular-nums">
          {u.createdAt ? new Date(u.createdAt).toLocaleDateString() : '—'}
        </span>
      ),
    },
  ];

  return (
    <div>
      <DataTable<AdminUser>
        rows={users}
        columns={columns}
        rowKey={u => u.id}
        isLoading={isLoading}
        pageSize={15}
        globalSearch={{
          placeholder: t('search_users'),
          predicate: (u, q) => {
            const l = q.toLowerCase();
            return (
              u.fullname.toLowerCase().includes(l) ||
              u.email.toLowerCase().includes(l)
            );
          },
        }}
        exportAction={{ onClick: handleExport }}
        rowActions={u => (
          <RowMenu
            items={[
              {
                key: 'edit',
                label: t('change_role'),
                icon: <Pencil className="w-3.5 h-3.5" />,
                onClick: () => openEditRole(u),
              },
              {
                key: 'logs',
                label: t('view_logs', { defaultValue: 'View Logs' }),
                icon: <Activity className="w-3.5 h-3.5" />,
                onClick: () => navigate(`/admin/logs?userId=${u.id}`),
              },
              {
                key: 'toggle',
                label:
                  u.isActive !== false
                    ? t('deactivate')
                    : t('activate'),
                icon:
                  u.isActive !== false ? (
                    <UserX className="w-3.5 h-3.5" />
                  ) : (
                    <UserCheck className="w-3.5 h-3.5" />
                  ),
                onClick: () =>
                  toggleStatusMutation.mutate({
                    userId: u.id,
                    isActive: u.isActive === false,
                  }),
              },
            ]}
          />
        )}
      />

      {/* Change Role Modal */}
      <Modal
        isOpen={!!editUser}
        onClose={() => setEditUser(null)}
        title={t('edit_role_title', { name: editUser?.fullname })}
        size="sm"
      >
        <div className="space-y-3">
          {roles.map(({ value, label }) => (
            <label
              key={value}
              className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                selectedRole === value
                  ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20'
                  : 'border-gray-200 dark:border-gray-700'
              }`}
            >
              <input
                type="radio"
                name="role"
                value={value}
                checked={selectedRole === value}
                onChange={() => setSelectedRole(value)}
                className="accent-indigo-500"
              />
              <span className="text-sm font-medium text-gray-800 dark:text-gray-100">
                {label}
              </span>
            </label>
          ))}
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <Button variant="outline" size="sm" onClick={() => setEditUser(null)}>
            {t('common:cancel')}
          </Button>
          <Button
            size="sm"
            onClick={handleRoleSave}
            disabled={changeRoleMutation.isPending}
          >
            {t('common:save')}
          </Button>
        </div>
      </Modal>
    </div>
  );
};
