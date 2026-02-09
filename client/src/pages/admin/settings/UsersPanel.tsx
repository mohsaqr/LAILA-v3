import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Search, Download, ChevronLeft, ChevronRight } from 'lucide-react';
import { usersApi } from '../../../api/users';
import { adminApi } from '../../../api/admin';
import { useTheme } from '../../../hooks/useTheme';
import { Button } from '../../../components/common/Button';
import { Loading } from '../../../components/common/Loading';
import toast from 'react-hot-toast';

export const UsersPanel = () => {
  const { t } = useTranslation(['admin', 'common']);
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const limit = 15;
  const { isDark } = useTheme();

  // Theme colors
  const colors = {
    bg: isDark ? '#1f2937' : '#ffffff',
    bgHeader: isDark ? 'rgba(55, 65, 81, 0.5)' : '#f9fafb',
    bgInput: isDark ? '#1f2937' : '#ffffff',
    bgAvatar: isDark ? '#374151' : '#e5e7eb',
    textPrimary: isDark ? '#f3f4f6' : '#111827',
    textSecondary: isDark ? '#9ca3af' : '#6b7280',
    textMuted: isDark ? '#6b7280' : '#9ca3af',
    border: isDark ? '#374151' : '#e5e7eb',
    borderLight: isDark ? '#374151' : '#f3f4f6',
    // Badge colors
    bgRed: isDark ? 'rgba(239, 68, 68, 0.2)' : '#fef2f2',
    textRed: isDark ? '#fca5a5' : '#dc2626',
    bgBlue: isDark ? 'rgba(59, 130, 246, 0.2)' : '#eff6ff',
    textBlue: isDark ? '#93c5fd' : '#1d4ed8',
    bgGray: isDark ? '#374151' : '#f3f4f6',
    textGray: isDark ? '#d1d5db' : '#374151',
    bgGreen: isDark ? 'rgba(34, 197, 94, 0.2)' : '#f0fdf4',
    textGreen: isDark ? '#86efac' : '#15803d',
  };

  const { data, isLoading } = useQuery({
    queryKey: ['users', page, search],
    queryFn: () => usersApi.getUsers(page, limit, search || undefined),
  });

  const toggleStatusMutation = useMutation({
    mutationFn: ({ userId, isActive }: { userId: number; isActive: boolean }) =>
      usersApi.updateUser(userId, { isActive }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast.success(t('user_updated'));
    },
  });

  const handleExport = async () => {
    try {
      const data = await adminApi.exportData('users');
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
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

  if (isLoading) {
    return <Loading text={t('loading_users')} />;
  }

  const users = data?.users || [];
  const pagination = data?.pagination;

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-semibold" style={{ color: colors.textPrimary }}>{t('users')}</h2>
          <p className="text-sm" style={{ color: colors.textSecondary }}>{t('total_users', { count: pagination?.total || 0 })}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleExport}>
            <Download className="w-4 h-4 mr-1" /> {t('common:export')}
          </Button>
        </div>
      </div>

      {/* Search */}
      <div className="mb-4">
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: colors.textMuted }} />
          <input
            type="text"
            placeholder={t('search_users')}
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="w-full pl-10 pr-4 py-2 text-sm rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            style={{
              backgroundColor: colors.bgInput,
              color: colors.textPrimary,
              border: `1px solid ${colors.border}`,
            }}
          />
        </div>
      </div>

      {/* Table */}
      <div className="rounded-lg overflow-hidden" style={{ backgroundColor: colors.bg, border: `1px solid ${colors.border}` }}>
        <table className="w-full">
          <thead>
            <tr style={{ borderBottom: `1px solid ${colors.border}`, backgroundColor: colors.bgHeader }}>
              <th className="text-left text-xs font-medium uppercase tracking-wider px-4 py-3" style={{ color: colors.textSecondary }}>{t('user')}</th>
              <th className="text-left text-xs font-medium uppercase tracking-wider px-4 py-3" style={{ color: colors.textSecondary }}>{t('role')}</th>
              <th className="text-left text-xs font-medium uppercase tracking-wider px-4 py-3" style={{ color: colors.textSecondary }}>{t('status')}</th>
              <th className="text-left text-xs font-medium uppercase tracking-wider px-4 py-3" style={{ color: colors.textSecondary }}>{t('joined')}</th>
              <th className="text-right text-xs font-medium uppercase tracking-wider px-4 py-3" style={{ color: colors.textSecondary }}>{t('actions')}</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user: any, index: number) => (
              <tr
                key={user.id}
                style={{ borderBottom: index < users.length - 1 ? `1px solid ${colors.borderLight}` : 'none' }}
              >
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium"
                      style={{ backgroundColor: colors.bgAvatar, color: colors.textSecondary }}
                    >
                      {user.fullname?.charAt(0)?.toUpperCase()}
                    </div>
                    <div>
                      <p className="text-sm font-medium" style={{ color: colors.textPrimary }}>{user.fullname}</p>
                      <p className="text-xs" style={{ color: colors.textSecondary }}>{user.email}</p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-1">
                    {user.isAdmin && (
                      <span
                        className="inline-flex px-2 py-0.5 text-xs font-medium rounded"
                        style={{ backgroundColor: colors.bgRed, color: colors.textRed }}
                      >{t('role_admin')}</span>
                    )}
                    {user.isInstructor && (
                      <span
                        className="inline-flex px-2 py-0.5 text-xs font-medium rounded"
                        style={{ backgroundColor: colors.bgBlue, color: colors.textBlue }}
                      >{t('role_instructor')}</span>
                    )}
                    {!user.isAdmin && !user.isInstructor && (
                      <span
                        className="inline-flex px-2 py-0.5 text-xs font-medium rounded"
                        style={{ backgroundColor: colors.bgGray, color: colors.textGray }}
                      >{t('role_student')}</span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span
                    className="inline-flex px-2 py-0.5 text-xs font-medium rounded"
                    style={{
                      backgroundColor: user.isActive !== false ? colors.bgGreen : colors.bgGray,
                      color: user.isActive !== false ? colors.textGreen : colors.textMuted,
                    }}
                  >
                    {user.isActive !== false ? t('status_active') : t('status_inactive')}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm" style={{ color: colors.textSecondary }}>
                  {new Date(user.createdAt).toLocaleDateString()}
                </td>
                <td className="px-4 py-3 text-right">
                  <button
                    onClick={() => toggleStatusMutation.mutate({ userId: user.id, isActive: user.isActive === false })}
                    className="text-xs hover:underline"
                    style={{ color: colors.textSecondary }}
                  >
                    {user.isActive !== false ? t('deactivate') : t('activate')}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Pagination */}
        {pagination && pagination.totalPages > 1 && (
          <div
            className="flex items-center justify-between px-4 py-3"
            style={{ borderTop: `1px solid ${colors.border}`, backgroundColor: colors.bgHeader }}
          >
            <p className="text-sm" style={{ color: colors.textSecondary }}>
              {t('page_x_of_y', { page: pagination.page, total: pagination.totalPages })}
            </p>
            <div className="flex gap-1">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="p-1 rounded disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ color: colors.textSecondary }}
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button
                onClick={() => setPage(p => Math.min(pagination.totalPages, p + 1))}
                disabled={page === pagination.totalPages}
                className="p-1 rounded disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ color: colors.textSecondary }}
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
