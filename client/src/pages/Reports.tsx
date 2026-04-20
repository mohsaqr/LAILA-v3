import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { BarChart3, ChevronRight } from 'lucide-react';
import { enrollmentsApi } from '../api/enrollments';
import { Breadcrumb } from '../components/common/Breadcrumb';
import { useTheme } from '../hooks/useTheme';

export const Reports = () => {
  const { t } = useTranslation(['navigation', 'courses', 'common']);
  const { isDark } = useTheme();

  const { data: enrollments, isLoading } = useQuery({
    queryKey: ['my-enrollments'],
    queryFn: enrollmentsApi.getMyEnrollments,
  });

  const activeEnrollments = enrollments?.filter((e) => e.status === 'active' && e.course) || [];

  const colors = {
    textPrimary: isDark ? '#f3f4f6' : '#111827',
    textSecondary: isDark ? '#9ca3af' : '#6b7280',
    bgCard: isDark ? '#1f2937' : '#ffffff',
    border: isDark ? '#374151' : '#e5e7eb',
    iconBg: isDark ? 'rgba(99, 102, 241, 0.2)' : '#eef2ff',
    iconColor: isDark ? '#a5b4fc' : '#4f46e5',
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 md:py-8">
      {/* Breadcrumb */}
      <div className="mb-6">
        <Breadcrumb items={[{ label: t('reports') }]} />
      </div>

      <div className="mb-6 md:mb-8">
        <h1 className="text-xl sm:text-2xl font-bold" style={{ color: colors.textPrimary }}>
          {t('reports')}
        </h1>
        <p className="mt-1" style={{ color: colors.textSecondary }}>
          {t('courses:select_course_for_reports')}
        </p>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="rounded-xl p-5 animate-pulse"
              style={{ backgroundColor: colors.bgCard, border: `1px solid ${colors.border}` }}
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-lg" style={{ backgroundColor: colors.iconBg }} />
                <div className="flex-1 space-y-2">
                  <div className="h-4 rounded w-3/4" style={{ backgroundColor: colors.border }} />
                  <div className="h-3 rounded w-1/2" style={{ backgroundColor: colors.border }} />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : activeEnrollments.length === 0 ? (
        <div className="text-center py-16">
          <BarChart3 className="w-16 h-16 mx-auto mb-4" style={{ color: colors.textSecondary }} />
          <h2 className="text-lg font-medium" style={{ color: colors.textPrimary }}>
            {t('courses:no_enrollments')}
          </h2>
          <p className="mt-1" style={{ color: colors.textSecondary }}>
            {t('courses:enroll_to_see_reports')}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {activeEnrollments.map((enrollment) => (
            <Link
              key={enrollment.id}
              to={`/courses/${enrollment.courseId}/analytics`}
              className="rounded-xl p-5 transition-shadow hover:shadow-lg group"
              style={{ backgroundColor: colors.bgCard, border: `1px solid ${colors.border}` }}
            >
              <div className="flex items-center gap-4">
                <div
                  className="w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ backgroundColor: colors.iconBg }}
                >
                  <BarChart3 className="w-6 h-6" style={{ color: colors.iconColor }} />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium truncate" style={{ color: colors.textPrimary }}>
                    {enrollment.course!.title}
                  </h3>
                  {enrollment.course!.instructor && (
                    <p className="text-sm truncate" style={{ color: colors.textSecondary }}>
                      {enrollment.course!.instructor.fullname}
                    </p>
                  )}
                </div>
                <ChevronRight
                  className="w-5 h-5 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                  style={{ color: colors.textSecondary }}
                />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
};
