import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import toast from 'react-hot-toast';
import { coursesApi } from '../../api/courses';
import { Card, CardBody, CardHeader } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { Loading } from '../../components/common/Loading';
import { CourseForm, CourseFormData } from '../../components/teach/CourseForm';

export const CourseEdit = () => {
  const { id } = useParams<{ id: string }>();
  const courseId = parseInt(id!, 10);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

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
      toast.success('Course updated successfully');
      navigate(`/teach/courses/${courseId}/curriculum`);
    },
    onError: () => {
      toast.error('Failed to update course');
    },
  });

  const handleSubmit = async (data: CourseFormData) => {
    await updateMutation.mutateAsync(data);
  };

  if (isLoading) {
    return <Loading fullScreen text="Loading course..." />;
  }

  if (!course) {
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Course Not Found</h1>
          <p className="text-gray-600 mb-4">The course you're looking for doesn't exist.</p>
          <Button onClick={() => navigate('/teach')}>Back to Dashboard</Button>
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
          Back to Curriculum
        </Button>
      </div>

      <Card>
        <CardHeader>
          <h1 className="text-2xl font-bold text-gray-900">Edit Course</h1>
          <p className="text-gray-600 mt-1">Update your course details below.</p>
        </CardHeader>
        <CardBody>
          <CourseForm
            initialData={course}
            onSubmit={handleSubmit}
            submitLabel="Save Changes"
            loading={updateMutation.isPending}
          />
        </CardBody>
      </Card>
    </div>
  );
};
