import { useParams, useSearchParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { ShieldX } from 'lucide-react';
import { coursesApi } from '../../api/courses';
import { useAuth } from '../../hooks/useAuth';
import { useTheme } from '../../hooks/useTheme';
import { Loading } from '../common/Loading';
import { Card, CardBody } from '../common/Card';
import { Button } from '../common/Button';

interface RequireEnrollmentProps {
  children: React.ReactNode;
  courseIdParam?: string;
}

export const RequireEnrollment = ({
  children,
  courseIdParam = 'courseId',
}: RequireEnrollmentProps) => {
  const { t } = useTranslation(['errors', 'courses']);
  const { isDark } = useTheme();
  const { isAdmin, isInstructor } = useAuth();
  const params = useParams();
  const [searchParams] = useSearchParams();

  // Get courseId from URL params or query string
  const courseId = params[courseIdParam] || searchParams.get('courseId');

  // Admins and instructors bypass enrollment check
  const shouldCheck = !!courseId && !isAdmin && !isInstructor;

  // Use the course API which already includes enrollment status
  const { data: course, isLoading } = useQuery({
    queryKey: ['course', courseId],
    queryFn: () => coursesApi.getCourseById(parseInt(courseId!)),
    enabled: shouldCheck,
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  // Admins/instructors always pass
  if (!shouldCheck) {
    return <>{children}</>;
  }

  if (isLoading) {
    return <Loading text={t('common:loading')} />;
  }

  // If not enrolled, show forbidden page
  if (!(course as any)?.enrolled) {
    const colors = {
      bg: isDark ? '#111827' : '#f9fafb',
      cardBg: isDark ? '#1f2937' : '#ffffff',
      textPrimary: isDark ? '#f3f4f6' : '#111827',
      textSecondary: isDark ? '#9ca3af' : '#6b7280',
    };

    return (
      <div
        className="min-h-[60vh] flex items-center justify-center px-4"
        style={{ backgroundColor: colors.bg }}
      >
        <Card className="max-w-md w-full">
          <CardBody className="text-center py-12">
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6"
              style={{ backgroundColor: isDark ? 'rgba(239, 68, 68, 0.2)' : '#fee2e2' }}
            >
              <ShieldX className="w-8 h-8 text-red-500" />
            </div>
            <h2 className="text-xl font-bold mb-2" style={{ color: colors.textPrimary }}>
              {t('access_denied')}
            </h2>
            <p className="mb-6" style={{ color: colors.textSecondary }}>
              {t('not_enrolled')}
            </p>
            <div className="flex gap-3 justify-center">
              <Link to={`/courses/${courseId}`}>
                <Button variant="primary">
                  {t('courses:view_course')}
                </Button>
              </Link>
              <Link to="/courses">
                <Button variant="secondary">
                  {t('courses:browse_courses')}
                </Button>
              </Link>
            </div>
          </CardBody>
        </Card>
      </div>
    );
  }

  return <>{children}</>;
};
