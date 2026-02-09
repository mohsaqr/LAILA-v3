import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Settings, Users } from 'lucide-react';
import toast from 'react-hot-toast';
import { coursesApi } from '../../api/courses';
import { Card, CardBody, CardHeader } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { Loading } from '../../components/common/Loading';
import { CourseForm, CourseFormData } from '../../components/teach/CourseForm';
import { CourseRoleManager } from '../../components/admin/CourseRoleManager';

type TabType = 'settings' | 'team';

export const CourseEdit = () => {
  const { t } = useTranslation(['teaching', 'common']);
  const { id } = useParams<{ id: string }>();
  const courseId = parseInt(id!, 10);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<TabType>('settings');

  const { data: course, isLoading } = useQuery({
    queryKey: ['course', courseId],
    queryFn: () => coursesApi.getCourseById(courseId),
    enabled: !!courseId,
  });

  const updateMutation = useMutation({
    mutationFn: (data: CourseFormData) =>
      coursesApi.updateCourse(courseId, {
        ...data,
        difficulty: data.difficulty || null,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['course', courseId] });
      queryClient.invalidateQueries({ queryKey: ['teachingCourses'] });
      toast.success(t('course_saved'));
      navigate(`/teach/courses/${courseId}/curriculum`);
    },
    onError: () => {
      toast.error(t('failed_to_save_course'));
    },
  });

  const handleSubmit = async (data: CourseFormData) => {
    await updateMutation.mutateAsync(data);
  };

  if (isLoading) {
    return <Loading fullScreen text={t('loading')} />;
  }

  if (!course) {
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">{t('course_not_found')}</h1>
          <p className="text-gray-600 mb-4">{t('no_description')}</p>
          <Button onClick={() => navigate('/teach')}>{t('back_to_dashboard')}</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-6">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate(`/teach/courses/${courseId}/curriculum`)}
          icon={<ArrowLeft className="w-4 h-4" />}
        >
          {t('back_to_curriculum')}
        </Button>
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-1 mb-6 bg-gray-100 p-1 rounded-lg w-fit">
        <button
          onClick={() => setActiveTab('settings')}
          className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            activeTab === 'settings'
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          <Settings className="w-4 h-4" />
          {t('general_settings')}
        </button>
        <button
          onClick={() => setActiveTab('team')}
          className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            activeTab === 'team'
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          <Users className="w-4 h-4" />
          {t('team_members')}
        </button>
      </div>

      {/* Tab Content */}
      {activeTab === 'settings' ? (
        <Card>
          <CardHeader>
            <h1 className="text-2xl font-bold text-gray-900">{t('edit_course')}</h1>
            <p className="text-gray-600 mt-1">{t('course_settings')}</p>
          </CardHeader>
          <CardBody>
            <CourseForm
              initialData={course}
              onSubmit={handleSubmit}
              submitLabel={t('save_changes')}
              loading={updateMutation.isPending}
            />
          </CardBody>
        </Card>
      ) : (
        <CourseRoleManager courseId={courseId} />
      )}
    </div>
  );
};
