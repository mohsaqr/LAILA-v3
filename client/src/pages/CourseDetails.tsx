import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { sanitizeHtml } from '../utils/sanitize';
import { useParams, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Users,
  BookOpen,
  PlayCircle,
  Edit,
  Settings,
  MessageSquare,
  PenSquare,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { coursesApi } from '../api/courses';
import { enrollmentsApi } from '../api/enrollments';
import { useAuth } from '../hooks/useAuth';
import { useTheme } from '../hooks/useTheme';
import { Card, CardBody } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { Loading } from '../components/common/Loading';
import { Breadcrumb } from '../components/common/Breadcrumb';
import { CollaborativeModule } from '../components/course/CollaborativeModule';
import { ModuleSection } from '../components/course/ModuleSection';
import { Modal } from '../components/common/Modal';
import { Input } from '../components/common/Input';
import { useEffect, useRef, useState } from 'react';
import { CurriculumViewMode } from '../types';
import activityLogger from '../services/activityLogger';

export const CourseDetails = () => {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const { isAuthenticated, user, isInstructor: isUserInstructor, isActualAdmin, isActualInstructor } = useAuth();
  const { isDark } = useTheme();
  const { t } = useTranslation(['courses', 'common']);
  const moduleRefs = useRef<Record<number, HTMLElement | null>>({});

  // Activation code modal state
  const [showCodeModal, setShowCodeModal] = useState(false);
  const [activationCode, setActivationCode] = useState('');

  // Theme colors
  const colors = {
    bg: isDark ? '#111827' : '#f9fafb',
    bgCard: isDark ? '#1f2937' : '#ffffff',
    bgHeader: isDark ? '#1f2937' : '#ffffff',
    bgHover: isDark ? '#374151' : '#f9fafb',
    textPrimary: isDark ? '#f3f4f6' : '#111827',
    textSecondary: isDark ? '#9ca3af' : '#6b7280',
    textMuted: isDark ? '#6b7280' : '#9ca3af',
    border: isDark ? '#374151' : '#e5e7eb',
    bgPrimary: isDark ? 'rgba(99, 102, 241, 0.2)' : '#e0e7ff',
    textPrimary600: isDark ? '#a5b4fc' : '#4f46e5',
    bgTeal: isDark ? 'rgba(8, 143, 143, 0.2)' : '#f0fdfd',
    textTeal: isDark ? '#5eecec' : '#088F8F',
  };

  const { data: course, isLoading } = useQuery({
    queryKey: ['course', id],
    queryFn: () => coursesApi.getCourseById(parseInt(id!)),
  });

  const enrollMutation = useMutation({
    mutationFn: (code?: string) => enrollmentsApi.enroll(parseInt(id!), course?.title, code),
    onSuccess: () => {
      toast.success(t('successfully_enrolled'));
      setShowCodeModal(false);
      setActivationCode('');
      queryClient.invalidateQueries({ queryKey: ['course', id] });
      queryClient.invalidateQueries({ queryKey: ['enrollments'] });
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const handleEnrollClick = () => {
    if (course?.activationCode) {
      setShowCodeModal(true);
    } else {
      enrollMutation.mutate(undefined);
    }
  };

  const handleCodeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activationCode.trim()) {
      toast.error(t('enter_activation_code'));
      return;
    }
    enrollMutation.mutate(activationCode.trim());
  };

  // Log course view when course loads
  useEffect(() => {
    if (course && isAuthenticated) {
      activityLogger.logCourseViewed(course.id, course.title).catch(() => {});
    }
  }, [course?.id, isAuthenticated]);

  // Scroll to module
  const scrollToModule = (moduleId: number) => {
    const element = moduleRefs.current[moduleId];
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  if (isLoading) {
    return <Loading fullScreen text={t('loading_course')} />;
  }

  if (!course) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-12 text-center">
        <h2 className="text-2xl font-bold" style={{ color: colors.textPrimary }}>{t('course_not_found')}</h2>
        <Link to="/catalog" className="text-primary-600 hover:underline mt-2 inline-block">{t('back_to_catalog')}</Link>
      </div>
    );
  }

  const isEnrolled = (course as any).enrolled;
  const isCourseInstructor = user?.id === course.instructorId;
  const showInstructorControls = isCourseInstructor && isUserInstructor;
  const hasAccess = isEnrolled || isActualAdmin || isActualInstructor;
  const totalLectures = course.modules?.reduce((sum, m) => sum + (m.lectures?.length || 0), 0) || 0;

  // Get the view mode from course settings, default to 'mini-cards'
  const viewMode: CurriculumViewMode = (course as any).curriculumViewMode || 'mini-cards';

  return (
    <div className="min-h-screen" style={{ backgroundColor: colors.bg }}>
      {/* Breadcrumb */}
      <div style={{ backgroundColor: colors.bgHeader, borderBottom: `1px solid ${colors.border}` }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
          <Breadcrumb
            items={[
              { label: t('courses'), href: '/courses' },
              { label: course.title },
            ]}
          />
        </div>
      </div>

      {/* Instructor Toolbar */}
      {(showInstructorControls || isActualAdmin) && (
        <div className="bg-amber-50 dark:bg-amber-900/20 border-b border-amber-200 dark:border-amber-800">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2 text-amber-800 dark:text-amber-200">
              <PenSquare className="w-5 h-5" />
              <span className="font-medium">{t('instructor_view')}</span>
            </div>
            <div className="flex items-center gap-3">
              <Link
                to={`/teach/courses/${course.id}/curriculum`}
                className="flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg font-medium transition-colors"
              >
                <Edit className="w-4 h-4" />
                {t('edit_course')}
              </Link>
              <Link
                to={`/teach/courses/${course.id}/edit`}
                className="flex items-center gap-2 px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg font-medium transition-colors"
              >
                <Settings className="w-4 h-4" />
                {t('common:settings')}
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Hero Section */}
      <div className="gradient-bg text-white py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h1 className="text-2xl md:text-3xl font-bold mb-2">{course.title}</h1>
          {course.categories && course.categories.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-3">
              {course.categories.map(({ category }) => (
                <span key={category.id} className="px-2.5 py-0.5 text-xs font-medium rounded-full bg-white/20 text-white">
                  {category.title}
                </span>
              ))}
            </div>
          )}
          {course.description && (
            <div className="text-white mb-4 prose prose-sm max-w-none [&_*]:text-white/95 [&_a]:text-white [&_a]:underline" dangerouslySetInnerHTML={{ __html: sanitizeHtml(course.description) }} />
          )}
          <div className="flex flex-wrap items-center gap-4 text-sm">
            <span className="flex items-center gap-1"><Users className="w-4 h-4" /> {t('n_students', { count: course._count?.enrollments || 0 })}</span>
            <span className="flex items-center gap-1"><BookOpen className="w-4 h-4" /> {t('n_modules', { count: course.modules?.length || 0 })}</span>
            <span className="flex items-center gap-1"><PlayCircle className="w-4 h-4" /> {t('n_lessons', { count: totalLectures })}</span>
            <span>{t('by_instructor', { name: course.instructor?.fullname })}</span>
          </div>

          {/* Action buttons for non-enrolled users */}
          <div className="mt-4 flex flex-wrap gap-3">
            {!hasAccess && isAuthenticated && (
              <Button onClick={handleEnrollClick} loading={enrollMutation.isPending} className="bg-white text-primary-600 hover:bg-gray-100">
                {t('enroll_now')}
              </Button>
            )}
            {!isAuthenticated && (
              <Link to="/login" className="btn bg-white text-primary-600 hover:bg-gray-100">{t('sign_in_to_enroll')}</Link>
            )}
          </div>
        </div>
      </div>

      {/* Course Content - Two Column Layout */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col lg:flex-row gap-8">
          {/* Main Content Column */}
          <div className="flex-1 min-w-0">
            {course.modules && course.modules.length > 0 ? (
              <div className={viewMode === 'accordion' ? 'space-y-2' : 'space-y-6'}>
                {course.modules.map((module, moduleIndex) => (
                  <div
                    key={module.id}
                    ref={(el) => { moduleRefs.current[module.id] = el; }}
                  >
                    <ModuleSection
                      module={module}
                      moduleIndex={moduleIndex}
                      courseId={parseInt(id!)}
                      lectures={module.lectures}
                      codeLabs={module.codeLabs}
                      quizzes={module.quizzes}
                      assignments={module.assignments}
                      forums={module.forums}
                      surveys={module.moduleSurveys?.map(ms => ms.survey)}
                      hasAccess={hasAccess}
                      viewMode={viewMode}
                    />
                  </div>
                ))}
              </div>
            ) : (
              <Card>
                <CardBody className="text-center py-8">
                  <BookOpen className="w-12 h-12 mx-auto mb-3" style={{ color: colors.textMuted }} />
                  <p style={{ color: colors.textSecondary }}>{t('no_content_available')}</p>
                </CardBody>
              </Card>
            )}


          </div>

          {/* Sidebar */}
          {hasAccess && (
            <div className="lg:w-96 flex-shrink-0">
              <div className="lg:sticky lg:top-4 space-y-4">
                {/* Module Navigation */}
                {course.modules && course.modules.length > 0 && (
                  <Card>
                    <CardBody className="p-4">
                      <h3 className="font-semibold mb-3" style={{ color: colors.textPrimary }}>
                        {t('modules')}
                      </h3>
                      <nav className="space-y-1">
                        {course.modules.map((module, idx) => (
                          <button
                            key={module.id}
                            onClick={() => scrollToModule(module.id)}
                            className="w-full text-left px-3 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors flex items-center gap-3"
                          >
                            <span
                              className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium flex-shrink-0"
                              style={{ backgroundColor: colors.bgPrimary, color: colors.textPrimary600 }}
                            >
                              {idx + 1}
                            </span>
                            <span
                              className="text-sm truncate"
                              style={{ color: colors.textPrimary }}
                            >
                              {module.title}
                            </span>
                          </button>
                        ))}
                      </nav>
                    </CardBody>
                  </Card>
                )}

                {/* Collaborative Module */}
                <CollaborativeModule
                  courseId={parseInt(id!)}
                  moduleName={(course as any).collaborativeModuleName}
                  isInstructor={showInstructorControls || isActualAdmin}
                />

                {/* Discussion Forums Card */}
                <Link to={`/courses/${id}/forums`}>
                  <Card hover className="transition-shadow">
                    <CardBody className="flex items-center gap-4 p-4">
                      <div
                        className="w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0"
                        style={{ backgroundColor: colors.bgTeal }}
                      >
                        <MessageSquare className="w-6 h-6" style={{ color: colors.textTeal }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-medium" style={{ color: colors.textPrimary }}>
                          {t('discussion_forums')}
                        </h3>
                        <p className="text-sm" style={{ color: colors.textSecondary }}>
                          {t('join_course_discussions')}
                        </p>
                      </div>
                    </CardBody>
                  </Card>
                </Link>

              </div>
            </div>
          )}
        </div>
      </div>

      {/* Activation Code Modal */}
      <Modal isOpen={showCodeModal} onClose={() => { setShowCodeModal(false); setActivationCode(''); }} title={t('enter_activation_code')} size="sm">
        <form onSubmit={handleCodeSubmit} className="space-y-4 p-4">
          <p className="text-sm" style={{ color: colors.textSecondary }}>
            {t('activation_code_required')}
          </p>
          <Input
            type="text"
            placeholder={t('activation_code_placeholder')}
            value={activationCode}
            onChange={(e) => setActivationCode(e.target.value)}
            autoFocus
          />
          <div className="flex justify-end gap-3">
            <Button type="button" variant="secondary" onClick={() => { setShowCodeModal(false); setActivationCode(''); }}>
              {t('common:cancel')}
            </Button>
            <Button type="submit" loading={enrollMutation.isPending}>
              {t('enroll')}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
