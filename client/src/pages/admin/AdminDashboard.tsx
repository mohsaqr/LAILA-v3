import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import {
  Users,
  BookOpen,
  GraduationCap,
  MessageSquare,
  FileText,
  TrendingUp,
  UserPlus,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { adminApi } from '../../api/admin';
import { useTheme } from '../../hooks/useTheme';
import { AdminLayout, StatCard } from '../../components/admin';
import { Card, CardBody, CardHeader } from '../../components/common/Card';
import { Loading } from '../../components/common/Loading';

export const AdminDashboard = () => {
  const { t } = useTranslation(['admin', 'common']);
  const { isDark } = useTheme();
  const { data: adminData, isLoading } = useQuery({
    queryKey: ['adminStats'],
    queryFn: () => adminApi.getStats(),
  });

  // Theme colors
  const colors = {
    textPrimary: isDark ? '#f3f4f6' : '#111827',
    textSecondary: isDark ? '#9ca3af' : '#6b7280',
    textMuted: isDark ? '#6b7280' : '#9ca3af',
    border: isDark ? '#374151' : '#f3f4f6',
    bgAvatar: isDark ? 'rgba(59, 130, 246, 0.2)' : '#dbeafe',
    textAvatar: isDark ? '#93c5fd' : '#2563eb',
    bgAvatarGreen: isDark ? 'rgba(34, 197, 94, 0.2)' : '#dcfce7',
    textAvatarGreen: isDark ? '#86efac' : '#16a34a',
    linkColor: isDark ? '#5eecec' : '#088F8F',
    // Stat card icon colors
    bgBlue: isDark ? 'rgba(59, 130, 246, 0.2)' : '#dbeafe',
    bgGreen: isDark ? 'rgba(34, 197, 94, 0.2)' : '#dcfce7',
    bgTeal: isDark ? 'rgba(8, 143, 143, 0.2)' : '#f0fdfd',
    bgIndigo: isDark ? 'rgba(99, 102, 241, 0.2)' : '#e0e7ff',
    bgCyan: isDark ? 'rgba(6, 182, 212, 0.2)' : '#cffafe',
    bgOrange: isDark ? 'rgba(249, 115, 22, 0.2)' : '#ffedd5',
    bgPink: isDark ? 'rgba(236, 72, 153, 0.2)' : '#fce7f3',
    textBlue: isDark ? '#93c5fd' : '#2563eb',
    textGreen: isDark ? '#86efac' : '#16a34a',
    textTeal: isDark ? '#5eecec' : '#088F8F',
    textIndigo: isDark ? '#a5b4fc' : '#4f46e5',
    textCyan: isDark ? '#67e8f9' : '#0891b2',
    textOrange: isDark ? '#fdba74' : '#ea580c',
    textPink: isDark ? '#f9a8d4' : '#db2777',
    // Brand card
    bgBrand: isDark ? '#1f2937' : '#111827',
    bgBrandGradient: isDark ? '#374151' : '#1f2937',
    borderBrand: isDark ? '#4b5563' : '#374151',
  };

  if (isLoading) {
    return <Loading fullScreen text={t('loading_admin_dashboard')} />;
  }

  const stats = adminData?.stats;

  return (
    <AdminLayout
      title={t('overview')}
      description={t('platform_statistics_desc')}
    >
      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <StatCard
          icon={<Users className="w-6 h-6" style={{ color: colors.textBlue }} />}
          iconBgColor={colors.bgBlue}
          value={stats?.totalUsers || 0}
          label={t('total_users')}
        />
        <StatCard
          icon={<TrendingUp className="w-6 h-6" style={{ color: colors.textGreen }} />}
          iconBgColor={colors.bgGreen}
          value={stats?.activeUsers || 0}
          label={t('active_users')}
        />
        <StatCard
          icon={<BookOpen className="w-6 h-6" style={{ color: colors.textTeal }} />}
          iconBgColor={colors.bgTeal}
          value={stats?.totalCourses || 0}
          label={t('total_courses')}
        />
        <StatCard
          icon={<GraduationCap className="w-6 h-6" style={{ color: colors.textIndigo }} />}
          iconBgColor={colors.bgIndigo}
          value={stats?.publishedCourses || 0}
          label={t('common:published')}
        />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <StatCard
          icon={<UserPlus className="w-6 h-6" style={{ color: colors.textCyan }} />}
          iconBgColor={colors.bgCyan}
          value={stats?.totalEnrollments || 0}
          label={t('enrollments')}
        />
        <StatCard
          icon={<FileText className="w-6 h-6" style={{ color: colors.textOrange }} />}
          iconBgColor={colors.bgOrange}
          value={stats?.totalAssignments || 0}
          label={t('assignments')}
        />
        <StatCard
          icon={<MessageSquare className="w-6 h-6" style={{ color: colors.textPink }} />}
          iconBgColor={colors.bgPink}
          value={stats?.totalChatLogs || 0}
          label={t('chat_sessions')}
        />
        <div
          className="rounded-xl p-4 flex items-center justify-center"
          style={{
            background: `linear-gradient(to bottom right, ${colors.bgBrand}, ${colors.bgBrandGradient})`,
            border: `1px solid ${colors.borderBrand}`,
          }}
        >
          <div className="text-center">
            <p className="text-2xl font-bold text-white">LAILA</p>
            <p className="text-xs" style={{ color: colors.textMuted }}>{t('admin_panel')}</p>
          </div>
        </div>
      </div>

      {/* Recent Activity Section */}
      <h2 className="text-lg font-semibold mb-4" style={{ color: colors.textPrimary }}>{t('recent_activity')}</h2>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Users */}
        <Card>
          <CardHeader className="flex items-center justify-between">
            <h3 className="font-medium" style={{ color: colors.textPrimary }}>{t('new_users')}</h3>
            <Link
              to="/admin/settings?tab=users"
              className="text-sm hover:underline"
              style={{ color: colors.linkColor }}
            >
              {t('view_all')}
            </Link>
          </CardHeader>
          <CardBody className="p-0">
            <div className="divide-y" style={{ borderColor: colors.border }}>
              {adminData?.recentUsers?.slice(0, 5).map((user: any) => (
                <div key={user.id} className="flex items-center gap-3 px-6 py-3">
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center"
                    style={{ backgroundColor: colors.bgAvatar }}
                  >
                    <span className="text-sm font-medium" style={{ color: colors.textAvatar }}>
                      {user.fullname?.charAt(0)?.toUpperCase() || '?'}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate" style={{ color: colors.textPrimary }}>{user.fullname}</p>
                    <p className="text-xs truncate" style={{ color: colors.textSecondary }}>{user.email}</p>
                  </div>
                  <span className="text-xs" style={{ color: colors.textMuted }}>
                    {new Date(user.createdAt).toLocaleDateString()}
                  </span>
                </div>
              ))}
              {(!adminData?.recentUsers || adminData.recentUsers.length === 0) && (
                <div className="px-6 py-8 text-center text-sm" style={{ color: colors.textSecondary }}>
                  {t('no_recent_users')}
                </div>
              )}
            </div>
          </CardBody>
        </Card>

        {/* Recent Enrollments */}
        <Card>
          <CardHeader className="flex items-center justify-between">
            <h3 className="font-medium" style={{ color: colors.textPrimary }}>{t('new_enrollments')}</h3>
            <Link
              to="/admin/settings?tab=enrollments"
              className="text-sm hover:underline"
              style={{ color: colors.linkColor }}
            >
              {t('view_all')}
            </Link>
          </CardHeader>
          <CardBody className="p-0">
            <div className="divide-y" style={{ borderColor: colors.border }}>
              {adminData?.recentEnrollments?.slice(0, 5).map((enrollment: any) => (
                <div key={enrollment.id} className="flex items-center gap-3 px-6 py-3">
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center"
                    style={{ backgroundColor: colors.bgAvatarGreen }}
                  >
                    <GraduationCap className="w-4 h-4" style={{ color: colors.textAvatarGreen }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate" style={{ color: colors.textPrimary }}>
                      {enrollment.user?.fullname}
                    </p>
                    <p className="text-xs truncate" style={{ color: colors.textSecondary }}>{enrollment.course?.title}</p>
                  </div>
                  <span className="text-xs" style={{ color: colors.textMuted }}>
                    {new Date(enrollment.enrolledAt).toLocaleDateString()}
                  </span>
                </div>
              ))}
              {(!adminData?.recentEnrollments || adminData.recentEnrollments.length === 0) && (
                <div className="px-6 py-8 text-center text-sm" style={{ color: colors.textSecondary }}>
                  {t('no_recent_enrollments')}
                </div>
              )}
            </div>
          </CardBody>
        </Card>
      </div>
    </AdminLayout>
  );
};
