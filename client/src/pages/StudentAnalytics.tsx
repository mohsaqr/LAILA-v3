import { useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../store/authStore';
import { coursesApi } from '../api/courses';
import { Dashboard } from './admin/Dashboard';
import { Breadcrumb } from '../components/common/Breadcrumb';
import { activityLogger } from '../services/activityLogger';

export const StudentAnalytics = () => {
  const { courseId } = useParams();
  const { t } = useTranslation(['courses']);
  const user = useAuthStore((state) => state.user);
  const parsedCourseId = Number(courseId);

  const { data: course } = useQuery({
    queryKey: ['course', courseId],
    queryFn: () => coursesApi.getCourseById(parsedCourseId),
    enabled: !!parsedCourseId,
  });

  useEffect(() => {
    if (parsedCourseId) {
      activityLogger.log({
        verb: 'viewed',
        objectType: 'analytics',
        objectId: parsedCourseId,
        objectTitle: 'Student Analytics',
        courseId: parsedCourseId,
      });
    }
  }, [parsedCourseId]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-6">
        <Breadcrumb
          homeHref="/"
          items={[
            { label: course?.title || t('course'), href: `/courses/${courseId}` },
            { label: t('my_learning_analytics') },
          ]}
        />
      </div>
      <Dashboard mode="student" fixedCourseId={parsedCourseId} fixedUserId={user?.id} />
    </div>
  );
};
