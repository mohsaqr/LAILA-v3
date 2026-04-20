import { useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { coursesApi } from '../../api/courses';
import { Breadcrumb } from '../../components/common/Breadcrumb';
import { Dashboard } from '../admin/Dashboard';
import activityLogger from '../../services/activityLogger';

export const CourseAnalytics = () => {
  const { id } = useParams();
  const { t } = useTranslation(['teaching', 'navigation']);
  const courseId = Number(id);

  useEffect(() => {
    if (courseId) {
      activityLogger.logCourseAnalyticsViewed(courseId);
    }
  }, [courseId]);

  const { data: course } = useQuery({
    queryKey: ['course', courseId],
    queryFn: () => coursesApi.getCourseById(courseId),
    enabled: !!courseId,
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 md:py-8">
      <div className="mb-6">
        <Breadcrumb
          homeHref="/"
          items={[
            ...(course
              ? [{ label: course.title, href: `/teach/courses/${courseId}/curriculum` }]
              : []),
            { label: t('navigation:analytics') },
          ]}
        />
      </div>
      <Dashboard mode="instructor" fixedCourseId={courseId} />
    </div>
  );
};
