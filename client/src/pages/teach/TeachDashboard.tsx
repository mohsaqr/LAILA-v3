import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import {
  Plus,
  BookOpen,
  Users,
  FileText,
  AlertCircle,
  Edit,
  Trash2,
  Eye,
  EyeOff,
  MoreVertical,
  GraduationCap,
} from 'lucide-react';
import { useState } from 'react';
import toast from 'react-hot-toast';
import { useAuth } from '../../hooks/useAuth';
import { usersApi } from '../../api/users';
import { coursesApi } from '../../api/courses';
import { Card, CardBody } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { Loading } from '../../components/common/Loading';
import { StatusBadge } from '../../components/common/StatusBadge';
import { ConfirmDialog } from '../../components/common/ConfirmDialog';
import { EmptyState } from '../../components/common/EmptyState';
import { Course } from '../../types';

export const TeachDashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [deleteConfirm, setDeleteConfirm] = useState<Course | null>(null);
  const [activeMenu, setActiveMenu] = useState<number | null>(null);

  const { data: instructorStats, isLoading: statsLoading } = useQuery({
    queryKey: ['instructorStats', user?.id],
    queryFn: () => usersApi.getInstructorStats(user!.id),
    enabled: !!user,
  });

  const { data: courses, isLoading: coursesLoading } = useQuery({
    queryKey: ['teachingCourses'],
    queryFn: () => coursesApi.getMyCourses(),
    enabled: !!user,
  });

  const publishMutation = useMutation({
    mutationFn: (courseId: number) => coursesApi.publishCourse(courseId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teachingCourses'] });
      queryClient.invalidateQueries({ queryKey: ['instructorStats'] });
      toast.success('Course published successfully');
    },
    onError: () => toast.error('Failed to publish course'),
  });

  const unpublishMutation = useMutation({
    mutationFn: (courseId: number) => coursesApi.unpublishCourse(courseId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teachingCourses'] });
      queryClient.invalidateQueries({ queryKey: ['instructorStats'] });
      toast.success('Course unpublished');
    },
    onError: () => toast.error('Failed to unpublish course'),
  });

  const deleteMutation = useMutation({
    mutationFn: (courseId: number) => coursesApi.deleteCourse(courseId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teachingCourses'] });
      queryClient.invalidateQueries({ queryKey: ['instructorStats'] });
      toast.success('Course deleted');
      setDeleteConfirm(null);
    },
    onError: () => toast.error('Failed to delete course'),
  });

  const handleTogglePublish = (course: Course) => {
    setActiveMenu(null);
    if (course.status === 'published') {
      unpublishMutation.mutate(course.id);
    } else {
      publishMutation.mutate(course.id);
    }
  };

  if (statsLoading) {
    return <Loading fullScreen text="Loading teaching dashboard..." />;
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Teaching Dashboard</h1>
          <p className="text-gray-600 mt-1">Manage your courses and track student progress</p>
        </div>
        <Button onClick={() => navigate('/teach/create')} icon={<Plus className="w-4 h-4" />}>
          Create Course
        </Button>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <Card>
          <CardBody className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-indigo-100 flex items-center justify-center">
              <BookOpen className="w-6 h-6 text-indigo-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{instructorStats?.totalCourses || 0}</p>
              <p className="text-sm text-gray-500">Your Courses</p>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardBody className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-cyan-100 flex items-center justify-center">
              <Users className="w-6 h-6 text-cyan-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{instructorStats?.totalStudents || 0}</p>
              <p className="text-sm text-gray-500">Total Students</p>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardBody className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-pink-100 flex items-center justify-center">
              <FileText className="w-6 h-6 text-pink-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{instructorStats?.totalAssignments || 0}</p>
              <p className="text-sm text-gray-500">Assignments</p>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardBody className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-yellow-100 flex items-center justify-center">
              <AlertCircle className="w-6 h-6 text-yellow-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{instructorStats?.pendingGrading || 0}</p>
              <p className="text-sm text-gray-500">Pending Grading</p>
            </div>
          </CardBody>
        </Card>
      </div>

      {/* Courses List */}
      <div>
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Your Courses</h2>

        {coursesLoading ? (
          <Loading text="Loading courses..." />
        ) : courses && courses.length > 0 ? (
          <div className="space-y-4">
            {courses.map(course => (
              <Card key={course.id}>
                <CardBody className="flex items-center gap-4">
                  {/* Thumbnail */}
                  <div className="w-20 h-20 rounded-lg bg-gradient-to-br from-primary-500 to-secondary-500 flex items-center justify-center flex-shrink-0 overflow-hidden">
                    {course.thumbnail ? (
                      <img src={course.thumbnail} alt={course.title} className="w-full h-full object-cover" />
                    ) : (
                      <GraduationCap className="w-10 h-10 text-white" />
                    )}
                  </div>

                  {/* Course Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold text-gray-900 truncate">{course.title}</h3>
                      <StatusBadge status={course.status} />
                    </div>
                    <p className="text-sm text-gray-500 truncate mb-2">
                      {course.description || 'No description'}
                    </p>
                    <div className="flex items-center gap-4 text-xs text-gray-400">
                      <span>{course._count?.modules || 0} modules</span>
                      <span>{course._count?.enrollments || 0} students</span>
                      {course.category && <span className="capitalize">{course.category}</span>}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2">
                    <Link to={`/teach/courses/${course.id}/curriculum`}>
                      <Button variant="outline" size="sm">
                        Curriculum
                      </Button>
                    </Link>
                    <Link to={`/teach/courses/${course.id}/assignments`}>
                      <Button variant="ghost" size="sm">
                        Assignments
                      </Button>
                    </Link>

                    {/* More Menu */}
                    <div className="relative">
                      <button
                        onClick={() => setActiveMenu(activeMenu === course.id ? null : course.id)}
                        className="p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100"
                      >
                        <MoreVertical className="w-5 h-5" />
                      </button>

                      {activeMenu === course.id && (
                        <>
                          <div
                            className="fixed inset-0 z-10"
                            onClick={() => setActiveMenu(null)}
                          />
                          <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-100 py-1 z-20">
                            <Link
                              to={`/teach/courses/${course.id}/edit`}
                              className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                              onClick={() => setActiveMenu(null)}
                            >
                              <Edit className="w-4 h-4" />
                              Edit Details
                            </Link>
                            <button
                              onClick={() => handleTogglePublish(course)}
                              className="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                            >
                              {course.status === 'published' ? (
                                <>
                                  <EyeOff className="w-4 h-4" />
                                  Unpublish
                                </>
                              ) : (
                                <>
                                  <Eye className="w-4 h-4" />
                                  Publish
                                </>
                              )}
                            </button>
                            <button
                              onClick={() => {
                                setActiveMenu(null);
                                setDeleteConfirm(course);
                              }}
                              className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                            >
                              <Trash2 className="w-4 h-4" />
                              Delete
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </CardBody>
              </Card>
            ))}
          </div>
        ) : (
          <Card>
            <CardBody>
              <EmptyState
                icon={BookOpen}
                title="No courses yet"
                description="Create your first course to start teaching"
                action={{
                  label: 'Create Course',
                  onClick: () => navigate('/teach/create'),
                }}
              />
            </CardBody>
          </Card>
        )}
      </div>

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={!!deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        onConfirm={() => deleteConfirm && deleteMutation.mutate(deleteConfirm.id)}
        title="Delete Course"
        message={`Are you sure you want to delete "${deleteConfirm?.title}"? This action cannot be undone and will remove all associated modules, lectures, and student enrollments.`}
        confirmText="Delete"
        loading={deleteMutation.isPending}
      />
    </div>
  );
};
