import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
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
  ClipboardList,
  ClipboardCheck,
  Bot,
} from 'lucide-react';
import { useState } from 'react';
import toast from 'react-hot-toast';
import { useAuth } from '../../hooks/useAuth';
import { useTheme } from '../../hooks/useTheme';
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
  const { t } = useTranslation(['teaching', 'common']);
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { isDark } = useTheme();
  const [deleteConfirm, setDeleteConfirm] = useState<Course | null>(null);
  const [activeMenu, setActiveMenu] = useState<number | null>(null);

  // Theme colors
  const colors = {
    bg: isDark ? '#111827' : '#f9fafb',
    bgCard: isDark ? '#1f2937' : '#ffffff',
    textPrimary: isDark ? '#f3f4f6' : '#111827',
    textSecondary: isDark ? '#9ca3af' : '#6b7280',
    textMuted: isDark ? '#6b7280' : '#9ca3af',
    bgMenu: isDark ? '#1f2937' : '#ffffff',
    bgMenuHover: isDark ? '#374151' : '#f9fafb',
    borderMenu: isDark ? '#374151' : '#f3f4f6',
    // Icon backgrounds
    bgIndigo: isDark ? 'rgba(99, 102, 241, 0.2)' : '#e0e7ff',
    textIndigo: isDark ? '#a5b4fc' : '#4f46e5',
    bgCyan: isDark ? 'rgba(6, 182, 212, 0.2)' : '#cffafe',
    textCyan: isDark ? '#67e8f9' : '#0891b2',
    bgPink: isDark ? 'rgba(236, 72, 153, 0.2)' : '#fce7f3',
    textPink: isDark ? '#f9a8d4' : '#db2777',
    bgYellow: isDark ? 'rgba(245, 158, 11, 0.2)' : '#fef3c7',
    textYellow: isDark ? '#fcd34d' : '#d97706',
  };

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
      toast.success(t('course_published'));
    },
    onError: () => toast.error(t('failed_to_publish_course')),
  });

  const unpublishMutation = useMutation({
    mutationFn: (courseId: number) => coursesApi.unpublishCourse(courseId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teachingCourses'] });
      queryClient.invalidateQueries({ queryKey: ['instructorStats'] });
      toast.success(t('course_unpublished'));
    },
    onError: () => toast.error(t('failed_to_unpublish_course')),
  });

  const deleteMutation = useMutation({
    mutationFn: (courseId: number) => coursesApi.deleteCourse(courseId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teachingCourses'] });
      queryClient.invalidateQueries({ queryKey: ['instructorStats'] });
      toast.success(t('common:deleted'));
      setDeleteConfirm(null);
    },
    onError: () => toast.error(t('common:error')),
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
    return <Loading fullScreen text={t('loading')} />;
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8" style={{ minHeight: '100vh' }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold" style={{ color: colors.textPrimary }}>{t('teach_dashboard')}</h1>
          <p className="mt-1" style={{ color: colors.textSecondary }}>{t('manage_assignments_and_grading')}</p>
        </div>
        <Button onClick={() => navigate('/teach/create')} icon={<Plus className="w-4 h-4" />}>
          {t('create_course')}
        </Button>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <Card>
          <CardBody className="flex items-center gap-4">
            <div
              className="w-12 h-12 rounded-full flex items-center justify-center"
              style={{ backgroundColor: colors.bgIndigo }}
            >
              <BookOpen className="w-6 h-6" style={{ color: colors.textIndigo }} />
            </div>
            <div>
              <p className="text-2xl font-bold" style={{ color: colors.textPrimary }}>{instructorStats?.totalCourses || 0}</p>
              <p className="text-sm" style={{ color: colors.textSecondary }}>{t('your_courses')}</p>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardBody className="flex items-center gap-4">
            <div
              className="w-12 h-12 rounded-full flex items-center justify-center"
              style={{ backgroundColor: colors.bgCyan }}
            >
              <Users className="w-6 h-6" style={{ color: colors.textCyan }} />
            </div>
            <div>
              <p className="text-2xl font-bold" style={{ color: colors.textPrimary }}>{instructorStats?.totalStudents || 0}</p>
              <p className="text-sm" style={{ color: colors.textSecondary }}>{t('total_students')}</p>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardBody className="flex items-center gap-4">
            <div
              className="w-12 h-12 rounded-full flex items-center justify-center"
              style={{ backgroundColor: colors.bgPink }}
            >
              <FileText className="w-6 h-6" style={{ color: colors.textPink }} />
            </div>
            <div>
              <p className="text-2xl font-bold" style={{ color: colors.textPrimary }}>{instructorStats?.totalAssignments || 0}</p>
              <p className="text-sm" style={{ color: colors.textSecondary }}>{t('assignment_manager')}</p>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardBody className="flex items-center gap-4">
            <div
              className="w-12 h-12 rounded-full flex items-center justify-center"
              style={{ backgroundColor: colors.bgYellow }}
            >
              <AlertCircle className="w-6 h-6" style={{ color: colors.textYellow }} />
            </div>
            <div>
              <p className="text-2xl font-bold" style={{ color: colors.textPrimary }}>{instructorStats?.pendingGrading || 0}</p>
              <p className="text-sm" style={{ color: colors.textSecondary }}>{t('pending_grading')}</p>
            </div>
          </CardBody>
        </Card>
      </div>

      {/* Courses List */}
      <div>
        <h2 className="text-xl font-semibold mb-4" style={{ color: colors.textPrimary }}>{t('your_courses')}</h2>

        {coursesLoading ? (
          <Loading text={t('loading')} />
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
                      <h3 className="font-semibold truncate" style={{ color: colors.textPrimary }}>{course.title}</h3>
                      <StatusBadge status={course.status} />
                    </div>
                    <p className="text-sm truncate mb-2" style={{ color: colors.textSecondary }}>
                      {course.description || t('no_description')}
                    </p>
                    <div className="flex items-center gap-4 text-xs" style={{ color: colors.textMuted }}>
                      <span>{course._count?.modules || 0} modules</span>
                      <span>{course._count?.enrollments || 0} students</span>
                      {course.category && <span className="capitalize">{course.category}</span>}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2">
                    <Link to={`/teach/courses/${course.id}/curriculum`}>
                      <Button variant="outline" size="sm">
                        {t('curriculum_editor')}
                      </Button>
                    </Link>
                    <Link to={`/teach/courses/${course.id}/assignments`}>
                      <Button variant="ghost" size="sm">
                        {t('assignment_manager')}
                      </Button>
                    </Link>
                    <Link to={`/teach/courses/${course.id}/gradebook`}>
                      <Button variant="ghost" size="sm" icon={<ClipboardList className="w-4 h-4" />}>
                        {t('gradebook')}
                      </Button>
                    </Link>
                    <Link to={`/teach/courses/${course.id}/surveys`}>
                      <Button variant="ghost" size="sm" icon={<ClipboardCheck className="w-4 h-4" />}>
                        {t('survey_manager')}
                      </Button>
                    </Link>
                    <Link to={`/teach/courses/${course.id}/tutors`}>
                      <Button variant="ghost" size="sm" icon={<Bot className="w-4 h-4" />}>
                        {t('tutor_manager')}
                      </Button>
                    </Link>

                    {/* More Menu */}
                    <div className="relative">
                      <button
                        onClick={() => setActiveMenu(activeMenu === course.id ? null : course.id)}
                        className="p-2 rounded-lg transition-colors"
                        style={{ color: colors.textMuted }}
                      >
                        <MoreVertical className="w-5 h-5" />
                      </button>

                      {activeMenu === course.id && (
                        <>
                          <div
                            className="fixed inset-0 z-10"
                            onClick={() => setActiveMenu(null)}
                          />
                          <div
                            className="absolute right-0 mt-2 w-48 rounded-lg shadow-lg py-1 z-20"
                            style={{ backgroundColor: colors.bgMenu, border: `1px solid ${colors.borderMenu}` }}
                          >
                            <Link
                              to={`/teach/courses/${course.id}/edit`}
                              className="flex items-center gap-2 px-4 py-2 text-sm transition-colors"
                              style={{ color: colors.textSecondary }}
                              onClick={() => setActiveMenu(null)}
                            >
                              <Edit className="w-4 h-4" />
                              {t('edit')}
                            </Link>
                            <button
                              onClick={() => handleTogglePublish(course)}
                              className="w-full flex items-center gap-2 px-4 py-2 text-sm transition-colors"
                              style={{ color: colors.textSecondary }}
                            >
                              {course.status === 'published' ? (
                                <>
                                  <EyeOff className="w-4 h-4" />
                                  {t('unpublish')}
                                </>
                              ) : (
                                <>
                                  <Eye className="w-4 h-4" />
                                  {t('publish')}
                                </>
                              )}
                            </button>
                            <button
                              onClick={() => {
                                setActiveMenu(null);
                                setDeleteConfirm(course);
                              }}
                              className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-600"
                            >
                              <Trash2 className="w-4 h-4" />
                              {t('common:delete')}
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
                title={t('no_courses_created')}
                description={t('no_courses_desc')}
                action={{
                  label: t('create_course'),
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
        title={t('delete_course')}
        message={t('delete_module_confirm', { title: deleteConfirm?.title })}
        confirmText={t('common:delete')}
        loading={deleteMutation.isPending}
      />
    </div>
  );
};
