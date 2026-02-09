import { useMutation } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft } from 'lucide-react';
import toast from 'react-hot-toast';
import { coursesApi } from '../../api/courses';
import { useTheme } from '../../hooks/useTheme';
import { Card, CardBody, CardHeader } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { CourseForm, CourseFormData } from '../../components/teach/CourseForm';

export const CourseCreate = () => {
  const { t } = useTranslation(['teaching', 'common']);
  const navigate = useNavigate();
  const { isDark } = useTheme();

  // Theme colors
  const colors = {
    textPrimary: isDark ? '#f3f4f6' : '#111827',
    textSecondary: isDark ? '#9ca3af' : '#6b7280',
  };

  const createMutation = useMutation({
    mutationFn: (data: CourseFormData) =>
      coursesApi.createCourse({
        ...data,
        difficulty: data.difficulty || null,
      }),
    onSuccess: course => {
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
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-6">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate('/teach')}
          icon={<ArrowLeft className="w-4 h-4" />}
        >
          {t('back_to_dashboard')}
        </Button>
      </div>

      <Card>
        <CardHeader>
          <h1 className="text-2xl font-bold" style={{ color: colors.textPrimary }}>{t('create_new_course')}</h1>
          <p className="mt-1" style={{ color: colors.textSecondary }}>
            {t('no_courses_desc')}
          </p>
        </CardHeader>
        <CardBody>
          <CourseForm
            onSubmit={handleSubmit}
            submitLabel={t('create_course')}
            loading={createMutation.isPending}
          />
        </CardBody>
      </Card>
    </div>
  );
};
