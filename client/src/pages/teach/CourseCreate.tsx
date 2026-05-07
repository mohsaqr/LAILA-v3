import { useEffect } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { coursesApi } from '../../api/courses';
import { Card, CardBody } from '../../components/common/Card';
import { Breadcrumb } from '../../components/common/Breadcrumb';
import { CourseForm, CourseFormData } from '../../components/teach/CourseForm';
import activityLogger from '../../services/activityLogger';

export const CourseCreate = () => {
  const { t } = useTranslation(['teaching', 'common']);
  const navigate = useNavigate();

  useEffect(() => {
    activityLogger.logCourseCreateViewed();
  }, []);

  const createMutation = useMutation({
    mutationFn: (data: CourseFormData) =>
      coursesApi.createCourse({
        ...data,
        difficulty: data.difficulty || null,
      } as any),
    onSuccess: course => {
      activityLogger.logCourseCreated(course.id, course.title);
      toast.success(t('course_created'));
      navigate(`/teach/courses/${course.id}/curriculum`);
    },
    onError: () => {
      toast.error(t('failed_to_create_course'));
    },
  });

  const handleSubmit = async (data: CourseFormData) => {
    await createMutation.mutateAsync(data);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 md:py-8">
      <div className="max-w-3xl mx-auto">
      {/* Breadcrumb */}
      <div className="mb-6">
        <Breadcrumb
          homeHref="/"
          items={[
            { label: t('teaching'), href: '/teach' },
            { label: t('create_course') },
          ]}
        />
      </div>

      <Card>
        <CardBody>
          <CourseForm
            onSubmit={handleSubmit}
            submitLabel={t('create_course')}
            loading={createMutation.isPending}
          />
        </CardBody>
      </Card>
      </div>
    </div>
  );
};
