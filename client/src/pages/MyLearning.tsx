import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { BookOpen, GraduationCap, Clock, ArrowRight, CheckCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { enrollmentsApi } from '../api/enrollments';
import { useTheme } from '../hooks/useTheme';
import { Card, CardBody } from '../components/common/Card';
import { Loading } from '../components/common/Loading';
import { Enrollment } from '../types';

export const MyLearning = () => {
  const { t } = useTranslation(['courses', 'common']);
  const { isDark } = useTheme();
  const { data: enrollments, isLoading } = useQuery({
    queryKey: ['enrollments'],
    queryFn: () => enrollmentsApi.getMyEnrollments(),
  });

  // Theme colors
  const colors = {
    bg: isDark ? '#111827' : '#f9fafb',
    textPrimary: isDark ? '#f3f4f6' : '#111827',
    textSecondary: isDark ? '#9ca3af' : '#6b7280',
    textMuted: isDark ? '#6b7280' : '#9ca3af',
    bgProgress: isDark ? '#374151' : '#e5e7eb',
  };

  const activeEnrollments = enrollments?.filter(e => e.status === 'active') || [];
  const completedEnrollments = enrollments?.filter(e => e.status === 'completed') || [];

  if (isLoading) {
    return <Loading fullScreen text={t('my_learning_loading')} />;
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8" style={{ backgroundColor: colors.bg, minHeight: '100vh' }}>
      <h1 className="text-3xl font-bold mb-8" style={{ color: colors.textPrimary }}>{t('my_learning')}</h1>

      {/* Active Courses */}
      <section className="mb-12">
        <h2 className="text-xl font-semibold mb-4" style={{ color: colors.textPrimary }}>{t('in_progress_title')}</h2>

        {activeEnrollments.length > 0 ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {activeEnrollments.map(enrollment => (
              <EnrollmentCard key={enrollment.id} enrollment={enrollment} />
            ))}
          </div>
        ) : (
          <Card>
            <CardBody className="text-center py-12">
              <BookOpen className="w-16 h-16 mx-auto mb-4" style={{ color: colors.textMuted }} />
              <h3 className="text-lg font-medium mb-2" style={{ color: colors.textPrimary }}>{t('no_active_courses')}</h3>
              <p className="mb-4" style={{ color: colors.textSecondary }}>{t('start_learning')}</p>
              <Link to="/catalog" className="btn btn-primary">
                {t('browse_courses')}
              </Link>
            </CardBody>
          </Card>
        )}
      </section>

      {/* Completed Courses */}
      {completedEnrollments.length > 0 && (
        <section>
          <h2 className="text-xl font-semibold mb-4" style={{ color: colors.textPrimary }}>{t('completed')}</h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {completedEnrollments.map(enrollment => (
              <EnrollmentCard key={enrollment.id} enrollment={enrollment} completed />
            ))}
          </div>
        </section>
      )}
    </div>
  );
};

const EnrollmentCard = ({ enrollment, completed = false }: { enrollment: Enrollment; completed?: boolean }) => {
  const { t } = useTranslation(['courses']);
  const { isDark } = useTheme();

  const colors = {
    textPrimary: isDark ? '#f3f4f6' : '#111827',
    textSecondary: isDark ? '#9ca3af' : '#6b7280',
    textMuted: isDark ? '#6b7280' : '#9ca3af',
    bgProgress: isDark ? '#374151' : '#e5e7eb',
  };

  return (
    <Link to={`/courses/${enrollment.courseId}`}>
      <Card hover className="h-full">
        {/* Thumbnail */}
        <div className={`h-32 ${completed ? 'bg-green-500' : 'bg-gradient-to-br from-primary-500 to-secondary-500'} rounded-t-xl flex items-center justify-center relative`}>
          <GraduationCap className="w-12 h-12 text-white/80" />
          {completed && (
            <div className="absolute top-3 right-3 bg-white rounded-full p-1">
              <CheckCircle className="w-5 h-5 text-green-500" />
            </div>
          )}
        </div>

        <CardBody>
          <h3 className="font-semibold mb-2" style={{ color: colors.textPrimary }}>{enrollment.course?.title}</h3>
          <p className="text-sm mb-4" style={{ color: colors.textSecondary }}>{enrollment.course?.instructor?.fullname}</p>

          {/* Progress */}
          <div className="mb-4">
            <div className="flex items-center justify-between text-sm mb-1">
              <span style={{ color: colors.textSecondary }}>{t('progress')}</span>
              <span className="font-medium" style={{ color: colors.textPrimary }}>{enrollment.progress}%</span>
            </div>
            <div className="h-2 rounded-full overflow-hidden" style={{ backgroundColor: colors.bgProgress }}>
              <div
                className={`h-full ${completed ? 'bg-green-500' : 'bg-gradient-to-r from-primary-500 to-secondary-500'}`}
                style={{ width: `${enrollment.progress}%` }}
              />
            </div>
          </div>

          <div className="flex items-center justify-between text-sm" style={{ color: colors.textSecondary }}>
            {enrollment.lastAccessAt ? (
              <span className="flex items-center gap-1">
                <Clock className="w-4 h-4" />
                {t('last_accessed', { date: new Date(enrollment.lastAccessAt).toLocaleDateString() })}
              </span>
            ) : (
              <span>{t('not_started')}</span>
            )}
            <ArrowRight className="w-4 h-4" />
          </div>
        </CardBody>
      </Card>
    </Link>
  );
};
