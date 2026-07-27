import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Activity, KeyRound, Pencil, Trash2, UserCheck, UserPlus, UserX, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { usersApi } from '../../../api/users';
import { adminApi } from '../../../api/admin';
import { userManagementApi } from '../../../api/userManagement';
import { useAuthStore } from '../../../store/authStore';
import { Button } from '../../../components/common/Button';
import { Modal } from '../../../components/common/Modal';
import { SearchableSelect } from '../../../components/common/SearchableSelect';
import {
  DataTable,
  type ColumnDef,
} from '../../../components/common/DataTable';
import { RowMenu } from '../../../components/common/RowMenu';
import { UserFormModal, type UserFormModalUser } from '../../../components/admin/UserFormModal';

type Role = 'student' | 'instructor' | 'admin';
type EnrollAction = 'enroll' | 'unenroll';

interface AdminUser {
  id: number;
  fullname: string;
  email: string;
  isAdmin: boolean;
  isInstructor: boolean;
  isActive?: boolean;
  createdAt?: string;
}

const roleOf = (u: AdminUser): Role =>
  u.isAdmin ? 'admin' : u.isInstructor ? 'instructor' : 'student';

export const UsersPanel = () => {
  const { t } = useTranslation(['admin', 'common']);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const currentUser = useAuthStore(state => state.user);

  // Multi-selection — the panel owns the set so it can act on it.
  const [selected, setSelected] = useState<Set<number>>(new Set());

  // Create / edit form modal.
  const [formOpen, setFormOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<UserFormModalUser | null>(null);

  // Single-row modals.
  const [pwTarget, setPwTarget] = useState<AdminUser | null>(null);
  const [pwValue, setPwValue] = useState('');
  const [pwError, setPwError] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<AdminUser | null>(null);

  // Bulk modals.
  const [bulkRoleOpen, setBulkRoleOpen] = useState(false);
  const [bulkRole, setBulkRole] = useState<Role>('student');
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [enrollAction, setEnrollAction] = useState<EnrollAction | null>(null);
  const [enrollCourseId, setEnrollCourseId] = useState('');
  const [bulkPending, setBulkPending] = useState(false);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['users', 'all'],
    // Pull a large page so DataTable can do client-side filter/sort/page.
    queryFn: () => usersApi.getUsers(1, 1000),
  });

  const users: AdminUser[] = data?.users ?? [];

  const { data: coursesData } = useQuery({
    queryKey: ['admin', 'courses', 'enroll-picker'],
    queryFn: () => adminApi.getCourses(1, 1000),
    enabled: enrollAction !== null,
  });

  const courseOptions = useMemo(
    () =>
      (coursesData?.courses ?? []).map((c: { id: number; title: string }) => ({
        value: String(c.id),
        label: c.title,
      })),
    [coursesData],
  );

  const roles: { value: Role; label: string }[] = useMemo(
    () => [
      { value: 'student', label: t('role_student') },
      { value: 'instructor', label: t('role_instructor') },
      { value: 'admin', label: t('role_admin') },
    ],
    [t],
  );

  // --- Selection helpers -----------------------------------------------------
  const clearSelection = () => setSelected(new Set());

  const toggleRow = (key: number) =>
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const toggleAll = (keys: number[], selectAll: boolean) =>
    setSelected(prev => {
      const next = new Set(prev);
      if (selectAll) keys.forEach(k => next.add(k));
      else keys.forEach(k => next.delete(k));
      return next;
    });

  // --- Single-row mutations --------------------------------------------------
  const toggleStatusMutation = useMutation({
    mutationFn: ({ userId, isActive }: { userId: number; isActive: boolean }) =>
      userManagementApi.updateUser(userId, { isActive }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast.success(t('user_updated'));
    },
    onError: (e: any) =>
      toast.error(e?.response?.data?.error ?? t('user_update_failed')),
  });

  const passwordMutation = useMutation({
    mutationFn: ({ userId, password }: { userId: number; password: string }) =>
      userManagementApi.updateUser(userId, { password }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast.success(t('password_updated'));
      setPwTarget(null);
      setPwValue('');
      setPwError('');
    },
    onError: () => toast.error(t('user_update_failed')),
  });

  const deleteMutation = useMutation({
    mutationFn: (userId: number) => userManagementApi.deleteUser(userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast.success(t('user_deleted'));
      setDeleteTarget(null);
    },
    onError: () => toast.error(t('user_delete_failed')),
  });

  // --- Bulk actions ----------------------------------------------------------
  const reportBulk = (results: PromiseSettledResult<unknown>[]) => {
    const ok = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.length - ok;
    const message = t('bulk_done', { ok, failed });
    // Only a clean run is a success; surface partial/total failure honestly.
    if (failed === 0) toast.success(message);
    else if (ok === 0) toast.error(message);
    else toast(message, { icon: '⚠️' });
    queryClient.invalidateQueries({ queryKey: ['users'] });
    clearSelection();
  };

  const handleBulkRole = async () => {
    setBulkPending(true);
    const results = await Promise.allSettled(
      [...selected].map(id =>
        userManagementApi.updateUserRoles(id, {
          isAdmin: bulkRole === 'admin',
          isInstructor: bulkRole !== 'student',
        }),
      ),
    );
    setBulkPending(false);
    setBulkRoleOpen(false);
    reportBulk(results);
  };

  const handleBulkActive = async (isActive: boolean) => {
    setBulkPending(true);
    const results = await Promise.allSettled(
      [...selected].map(id => userManagementApi.updateUser(id, { isActive })),
    );
    setBulkPending(false);
    reportBulk(results);
  };

  const handleBulkDelete = async () => {
    setBulkPending(true);
    const results = await Promise.allSettled(
      [...selected].map(id => userManagementApi.deleteUser(id)),
    );
    setBulkPending(false);
    setBulkDeleteOpen(false);
    reportBulk(results);
  };

  const handleBulkEnroll = async () => {
    if (!enrollCourseId || !enrollAction) return;
    setBulkPending(true);
    try {
      const res = await userManagementApi.bulkEnroll(
        [...selected],
        Number(enrollCourseId),
        enrollAction,
      );
      const message = t(
        enrollAction === 'enroll' ? 'bulk_enroll_done' : 'bulk_unenroll_done',
        { changed: res.changed, skipped: res.skipped, course: res.courseTitle },
      );
      // If the server reported per-user failures, don't show a clean green toast.
      if (res.errors.length > 0) {
        toast(t('bulk_enroll_partial', { message, failed: res.errors.length }), {
          icon: '⚠️',
        });
      } else {
        toast.success(message);
      }
    } catch {
      toast.error(t('bulk_enroll_failed'));
    }
    setBulkPending(false);
    setEnrollAction(null);
    setEnrollCourseId('');
    queryClient.invalidateQueries({ queryKey: ['users'] });
    clearSelection();
  };

  const openEnroll = (action: EnrollAction) => {
    setEnrollCourseId('');
    setEnrollAction(action);
  };

  const openCreate = () => {
    setEditTarget(null);
    setFormOpen(true);
  };

  const openEdit = (u: AdminUser) => {
    setEditTarget({
      id: u.id,
      fullname: u.fullname,
      email: u.email,
      isAdmin: u.isAdmin,
      isInstructor: u.isInstructor,
      isActive: u.isActive,
    });
    setFormOpen(true);
  };

  const handlePasswordSave = () => {
    if (!pwTarget) return;
    if (!pwValue || pwValue.length < 8) {
      setPwError(t('error_password_min'));
      return;
    }
    passwordMutation.mutate({ userId: pwTarget.id, password: pwValue });
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
      header: t('common:status'),
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
        error={isError}
        onRetry={() => void refetch()}
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
        createCta={{
          label: t('add_user'),
          onClick: openCreate,
          icon: <UserPlus className="w-4 h-4" />,
        }}
        selection={{
          selectedKeys: selected,
          onToggleRow: key => toggleRow(Number(key)),
          onToggleAll: (keys, selectAll) => toggleAll(keys.map(Number), selectAll),
          isSelectable: u => u.id !== currentUser?.id,
          onClear: clearSelection,
          renderBulkBar: (count, clear) => (
            <div className="flex flex-wrap items-center gap-2 rounded-lg border border-indigo-200 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-900/20 px-3 py-2">
              <span className="text-sm font-medium text-indigo-700 dark:text-indigo-300">
                {t('n_selected', { count })}
              </span>
              <div className="flex flex-wrap items-center gap-1.5 ml-auto">
                <Button size="sm" variant="secondary" disabled={bulkPending} onClick={() => setBulkRoleOpen(true)}>
                  {t('change_role')}
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={bulkPending}
                  onClick={() => handleBulkActive(true)}
                >
                  {t('activate')}
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={bulkPending}
                  onClick={() => handleBulkActive(false)}
                >
                  {t('deactivate')}
                </Button>
                <Button size="sm" variant="secondary" disabled={bulkPending} onClick={() => openEnroll('enroll')}>
                  {t('enroll')}
                </Button>
                <Button size="sm" variant="secondary" disabled={bulkPending} onClick={() => openEnroll('unenroll')}>
                  {t('unenroll')}
                </Button>
                <Button size="sm" variant="danger" disabled={bulkPending} onClick={() => setBulkDeleteOpen(true)}>
                  {t('delete')}
                </Button>
                <button
                  type="button"
                  onClick={clear}
                  aria-label={t('common:clear', { defaultValue: 'Clear' })}
                  className="p-1.5 rounded hover:bg-indigo-100 dark:hover:bg-indigo-800/40 text-indigo-600 dark:text-indigo-300"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          ),
        }}
        rowActions={u => {
          const isSelf = u.id === currentUser?.id;
          return (
            <RowMenu
              items={[
                {
                  key: 'edit',
                  label: t('edit_user'),
                  icon: <Pencil className="w-3.5 h-3.5" />,
                  onClick: () => openEdit(u),
                },
                {
                  key: 'password',
                  label: t('change_password'),
                  icon: <KeyRound className="w-3.5 h-3.5" />,
                  onClick: () => {
                    setPwValue('');
                    setPwError('');
                    setPwTarget(u);
                  },
                },
                {
                  key: 'logs',
                  label: t('view_logs', { defaultValue: 'View Logs' }),
                  icon: <Activity className="w-3.5 h-3.5" />,
                  onClick: () => navigate(`/admin/logs?userId=${u.id}`),
                },
                {
                  key: 'toggle',
                  label: u.isActive !== false ? t('deactivate') : t('activate'),
                  icon:
                    u.isActive !== false ? (
                      <UserX className="w-3.5 h-3.5" />
                    ) : (
                      <UserCheck className="w-3.5 h-3.5" />
                    ),
                  // You can't deactivate your own account (you're the one using it).
                  disabled: isSelf,
                  onClick: () => {
                    if (isSelf) return;
                    toggleStatusMutation.mutate({
                      userId: u.id,
                      isActive: u.isActive === false,
                    });
                  },
                },
                {
                  key: 'delete',
                  label: t('delete'),
                  icon: <Trash2 className="w-3.5 h-3.5" />,
                  destructive: true,
                  disabled: isSelf,
                  onClick: () => {
                    if (isSelf) return;
                    setDeleteTarget(u);
                  },
                },
              ]}
            />
          );
        }}
      />

      {/* Create / edit user form */}
      <UserFormModal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        user={editTarget}
        onSaved={() => queryClient.invalidateQueries({ queryKey: ['users'] })}
      />

      {/* Change password modal */}
      <Modal
        isOpen={!!pwTarget}
        onClose={() => setPwTarget(null)}
        title={t('change_password')}
        size="sm"
      >
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            {t('set_new_password_for', { name: pwTarget?.fullname })}
          </label>
          <input
            type="password"
            value={pwValue}
            onChange={e => setPwValue(e.target.value)}
            autoComplete="new-password"
            className={`w-full px-3 py-2 text-sm rounded-lg border bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-offset-1 ${
              pwError
                ? 'border-red-400 dark:border-red-500'
                : 'border-gray-200 dark:border-gray-700'
            }`}
          />
          {pwError && (
            <p className="text-xs text-red-600 dark:text-red-400">{pwError}</p>
          )}
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <Button variant="outline" size="sm" onClick={() => setPwTarget(null)}>
            {t('common:cancel')}
          </Button>
          <Button
            size="sm"
            onClick={handlePasswordSave}
            loading={passwordMutation.isPending}
            disabled={passwordMutation.isPending}
          >
            {t('common:save')}
          </Button>
        </div>
      </Modal>

      {/* Single-row delete confirm */}
      <Modal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title={t('delete_user')}
        size="sm"
      >
        <p className="text-sm text-gray-600 dark:text-gray-300">
          {t('confirm_delete_user', { name: deleteTarget?.fullname })}
        </p>
        <div className="flex justify-end gap-2 mt-4">
          <Button variant="outline" size="sm" onClick={() => setDeleteTarget(null)}>
            {t('common:cancel')}
          </Button>
          <Button
            variant="danger"
            size="sm"
            onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
            loading={deleteMutation.isPending}
            disabled={deleteMutation.isPending}
          >
            {t('delete')}
          </Button>
        </div>
      </Modal>

      {/* Bulk change-role modal */}
      <Modal
        isOpen={bulkRoleOpen}
        onClose={() => setBulkRoleOpen(false)}
        title={t('change_role')}
        size="sm"
      >
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
          {t('n_selected', { count: selected.size })}
        </p>
        <div className="space-y-3">
          {roles.map(({ value, label }) => (
            <label
              key={value}
              className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                bulkRole === value
                  ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20'
                  : 'border-gray-200 dark:border-gray-700'
              }`}
            >
              <input
                type="radio"
                name="bulk-role"
                value={value}
                checked={bulkRole === value}
                onChange={() => setBulkRole(value)}
                className="accent-indigo-500"
              />
              <span className="text-sm font-medium text-gray-800 dark:text-gray-100">
                {label}
              </span>
            </label>
          ))}
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <Button variant="outline" size="sm" onClick={() => setBulkRoleOpen(false)}>
            {t('common:cancel')}
          </Button>
          <Button size="sm" onClick={handleBulkRole} loading={bulkPending} disabled={bulkPending}>
            {t('common:save')}
          </Button>
        </div>
      </Modal>

      {/* Bulk enroll / unenroll modal */}
      <Modal
        isOpen={enrollAction !== null}
        onClose={() => setEnrollAction(null)}
        title={enrollAction === 'unenroll' ? t('unenroll') : t('enroll')}
        size="sm"
      >
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
          {t('n_selected', { count: selected.size })}
        </p>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
          {t('select_course')}
        </label>
        <SearchableSelect
          value={enrollCourseId}
          onChange={setEnrollCourseId}
          options={courseOptions}
        />
        <div className="flex justify-end gap-2 mt-4">
          <Button variant="outline" size="sm" onClick={() => setEnrollAction(null)}>
            {t('common:cancel')}
          </Button>
          <Button
            size="sm"
            onClick={handleBulkEnroll}
            loading={bulkPending}
            disabled={bulkPending || !enrollCourseId}
          >
            {enrollAction === 'unenroll' ? t('unenroll') : t('enroll')}
          </Button>
        </div>
      </Modal>

      {/* Bulk delete confirm */}
      <Modal
        isOpen={bulkDeleteOpen}
        onClose={() => setBulkDeleteOpen(false)}
        title={t('delete_user')}
        size="sm"
      >
        <p className="text-sm text-gray-600 dark:text-gray-300">
          {t('confirm_bulk_delete', { count: selected.size })}
        </p>
        <div className="flex justify-end gap-2 mt-4">
          <Button variant="outline" size="sm" onClick={() => setBulkDeleteOpen(false)}>
            {t('common:cancel')}
          </Button>
          <Button
            variant="danger"
            size="sm"
            onClick={handleBulkDelete}
            loading={bulkPending}
            disabled={bulkPending}
          >
            {t('delete')}
          </Button>
        </div>
      </Modal>
    </div>
  );
};
