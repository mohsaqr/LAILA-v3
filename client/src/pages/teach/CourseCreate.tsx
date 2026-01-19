import { useMutation } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import toast from 'react-hot-toast';
import { coursesApi } from '../../api/courses';
import { Card, CardBody, CardHeader } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { CourseForm, CourseFormData } from '../../components/teach/CourseForm';

export const CourseCreate = () => {
  const navigate = useNavigate();

  const createMutation = useMutation({
    mutationFn: (data: CourseFormData) =>
      coursesApi.createCourse({
        ...data,
        difficulty: data.difficulty || null,
      }),
    onSuccess: course => {
      toast.success('Course created successfully');
      navigate(`/teach/courses/${course.id}/curriculum`);
    },
    onError: () => {
      toast.error('Failed to create course');
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
          Back to Dashboard
        </Button>
      </div>

      <Card>
        <CardHeader>
          <h1 className="text-2xl font-bold text-gray-900">Create New Course</h1>
          <p className="text-gray-600 mt-1">
            Fill in the details below to create your course. You can add modules and lectures after creation.
          </p>
        </CardHeader>
        <CardBody>
          <CourseForm
            onSubmit={handleSubmit}
            submitLabel="Create Course"
            loading={createMutation.isPending}
          />
        </CardBody>
      </Card>
    </div>
  );
};
