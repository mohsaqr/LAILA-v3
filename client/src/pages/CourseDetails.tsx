import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Users,
  BookOpen,
  PlayCircle,
  Edit,
  Settings,
  ClipboardList,
  Bot,
  MessageSquare,
  PenSquare,
  FileText,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { coursesApi } from '../api/courses';
import { enrollmentsApi } from '../api/enrollments';
import { assignmentsApi } from '../api/assignments';
import { forumsApi, Forum } from '../api/forums';
import { quizzesApi, Quiz } from '../api/quizzes';
import { useAuth } from '../hooks/useAuth';
import { useTheme } from '../hooks/useTheme';
import { Card, CardBody } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { Loading } from '../components/common/Loading';
import { Breadcrumb } from '../components/common/Breadcrumb';
import { CollaborativeModule } from '../components/course/CollaborativeModule';
import { ModuleSection } from '../components/course/ModuleSection';
import { useEffect, useRef } from 'react';
import { Assignment, CurriculumViewMode } from '../types';
import activityLogger from '../services/activityLogger';

export const CourseDetails = () => {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const { isAuthenticated, user, isInstructor: isUserInstructor, isActualAdmin, isActualInstructor } = useAuth();
  const { isDark } = useTheme();
  const { t } = useTranslation(['courses', 'common']);
  const moduleRefs = useRef<Record<number, HTMLElement | null>>({});

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
    bgAmber: isDark ? 'rgba(245, 158, 11, 0.2)' : '#fef3c7',
    textAmber: isDark ? '#fcd34d' : '#d97706',
    bgEmerald: isDark ? 'rgba(16, 185, 129, 0.2)' : '#d1fae5',
    textEmerald: isDark ? '#6ee7b7' : '#059669',
  };

  const { data: course, isLoading } = useQuery({
    queryKey: ['course', id],
    queryFn: () => coursesApi.getCourseById(parseInt(id!)),
  });

  const { data: enrollmentData } = useQuery({
    queryKey: ['enrollment', id],
    queryFn: () => enrollmentsApi.getEnrollment(parseInt(id!)),
    enabled: isAuthenticated,
  });

  // Fetch assignments for the course
  const { data: assignments } = useQuery({
    queryKey: ['courseAssignments', id],
    queryFn: () => assignmentsApi.getAssignments(parseInt(id!)),
    enabled: isAuthenticated && (enrollmentData?.enrolled || isActualAdmin || isActualInstructor),
  });

  // Fetch quizzes for the course
  const { data: quizzes } = useQuery({
    queryKey: ['courseQuizzes', id],
    queryFn: () => quizzesApi.getQuizzes(parseInt(id!)),
    enabled: isAuthenticated && (enrollmentData?.enrolled || isActualAdmin || isActualInstructor),
  });

  // Fetch forums for the course
  const { data: forums } = useQuery({
    queryKey: ['courseForums', id],
    queryFn: () => forumsApi.getForums(parseInt(id!)),
    enabled: isAuthenticated && (enrollmentData?.enrolled || isActualAdmin || isActualInstructor),
  });

  // Group items by moduleId
  const assignmentsByModule = (assignments || []).reduce((acc: Record<number, Assignment[]>, assignment: Assignment) => {
    if (assignment.moduleId && assignment.isPublished) {
      if (!acc[assignment.moduleId]) acc[assignment.moduleId] = [];
      acc[assignment.moduleId].push(assignment);
    }
    return acc;
  }, {} as Record<number, Assignment[]>);

  const quizzesByModule = (quizzes || []).reduce((acc: Record<number, Quiz[]>, quiz: Quiz) => {
    if (quiz.moduleId && quiz.isPublished) {
      if (!acc[quiz.moduleId]) acc[quiz.moduleId] = [];
      acc[quiz.moduleId].push(quiz);
    }
    return acc;
  }, {} as Record<number, Quiz[]>);

  const forumsByModule = (forums || []).reduce((acc: Record<number, Forum[]>, forum: Forum) => {
    if (forum.moduleId && forum.isPublished) {
      if (!acc[forum.moduleId]) acc[forum.moduleId] = [];
      acc[forum.moduleId].push(forum);
    }
    return acc;
  }, {} as Record<number, Forum[]>);

  // Standalone items (not assigned to a module)
  const standaloneAssignments = (assignments || []).filter(a => !a.moduleId && a.isPublished);
  const standaloneQuizzes = (quizzes || []).filter(q => !q.moduleId && q.isPublished);
  const standaloneForums = (forums || []).filter(f => !f.moduleId && f.isPublished);

  const enrollMutation = useMutation({
    mutationFn: () => enrollmentsApi.enroll(parseInt(id!), course?.title),
    onSuccess: () => {
      toast.success(t('successfully_enrolled'));
      queryClient.invalidateQueries({ queryKey: ['enrollment', id] });
      queryClient.invalidateQueries({ queryKey: ['enrollments'] });
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

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

  const isEnrolled = enrollmentData?.enrolled;
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
              { label: course.category || t('general'), href: `/courses?category=${encodeURIComponent(course.category || '')}` },
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
          <p className="text-white/90 mb-4">{course.description}</p>
          <div className="flex flex-wrap items-center gap-4 text-sm">
            <span className="flex items-center gap-1"><Users className="w-4 h-4" /> {t('n_students', { count: course._count?.enrollments || 0 })}</span>
            <span className="flex items-center gap-1"><BookOpen className="w-4 h-4" /> {t('n_modules', { count: course.modules?.length || 0 })}</span>
            <span className="flex items-center gap-1"><PlayCircle className="w-4 h-4" /> {t('n_lessons', { count: totalLectures })}</span>
            <span>{t('by_instructor', { name: course.instructor?.fullname })}</span>
          </div>

          {/* Action buttons for non-enrolled users */}
          <div className="mt-4 flex flex-wrap gap-3">
            {!hasAccess && isAuthenticated && (
              <Button onClick={() => enrollMutation.mutate()} loading={enrollMutation.isPending} className="bg-white text-primary-600 hover:bg-gray-100">
                {t('enroll_now_free')}
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
                      quizzes={quizzesByModule[module.id]}
                      assignments={assignmentsByModule[module.id]}
                      forums={forumsByModule[module.id]}
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

            {/* Standalone Assignments Section */}
            {hasAccess && standaloneAssignments.length > 0 && (
              <div className="mt-8">
                <h2 className="text-xl font-bold mb-4 flex items-center gap-2" style={{ color: colors.textPrimary }}>
                  <ClipboardList className="w-6 h-6" style={{ color: colors.textAmber }} />
                  {t('course_assignments')}
                </h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                  {standaloneAssignments.map((assignment) => (
                    <Link
                      key={assignment.id}
                      to={assignment.submissionType === 'ai_agent'
                        ? `/courses/${course.id}/agent-assignments/${assignment.id}`
                        : `/courses/${course.id}/assignments/${assignment.id}`}
                    >
                      <Card hover className="h-full">
                        <CardBody className="flex items-start gap-4">
                          <div
                            className="w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0"
                            style={{
                              backgroundColor: assignment.submissionType === 'ai_agent' ? colors.bgTeal : colors.bgAmber
                            }}
                          >
                            {assignment.submissionType === 'ai_agent' ? (
                              <Bot className="w-6 h-6" style={{ color: colors.textTeal }} />
                            ) : (
                              <ClipboardList className="w-6 h-6" style={{ color: colors.textAmber }} />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <h3 className="font-medium line-clamp-2" style={{ color: colors.textPrimary }}>{assignment.title}</h3>
                            <div className="flex items-center gap-2 mt-1 text-sm" style={{ color: colors.textSecondary }}>
                              {assignment.dueDate && (
                                <span>{t('due_date', { date: new Date(assignment.dueDate).toLocaleDateString() })}</span>
                              )}
                              <span>{t('n_points', { count: assignment.points })}</span>
                            </div>
                          </div>
                        </CardBody>
                      </Card>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* Standalone Quizzes Section */}
            {hasAccess && standaloneQuizzes.length > 0 && (
              <div className="mt-8">
                <h2 className="text-xl font-bold mb-4 flex items-center gap-2" style={{ color: colors.textPrimary }}>
                  <FileText className="w-6 h-6" style={{ color: colors.textEmerald }} />
                  {t('course_quizzes')}
                </h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                  {standaloneQuizzes.map((quiz) => (
                    <Link key={quiz.id} to={`/courses/${course.id}/quizzes/${quiz.id}`}>
                      <Card hover className="h-full">
                        <CardBody className="flex items-start gap-4">
                          <div
                            className="w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0"
                            style={{ backgroundColor: colors.bgEmerald }}
                          >
                            <FileText className="w-6 h-6" style={{ color: colors.textEmerald }} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <h3 className="font-medium line-clamp-2" style={{ color: colors.textPrimary }}>{quiz.title}</h3>
                            <p className="text-sm mt-1" style={{ color: colors.textSecondary }}>
                              {t('n_questions', { count: quiz._count?.questions || 0 })}
                            </p>
                          </div>
                        </CardBody>
                      </Card>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* Standalone Forums Section */}
            {hasAccess && standaloneForums.length > 0 && (
              <div className="mt-8">
                <h2 className="text-xl font-bold mb-4 flex items-center gap-2" style={{ color: colors.textPrimary }}>
                  <MessageSquare className="w-6 h-6" style={{ color: colors.textTeal }} />
                  {t('course_forums')}
                </h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                  {standaloneForums.map((forum) => (
                    <Link key={forum.id} to={`/courses/${course.id}/forums/${forum.id}`}>
                      <Card hover className="h-full">
                        <CardBody className="flex items-start gap-4">
                          <div
                            className="w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0"
                            style={{ backgroundColor: colors.bgTeal }}
                          >
                            <MessageSquare className="w-6 h-6" style={{ color: colors.textTeal }} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <h3 className="font-medium line-clamp-2" style={{ color: colors.textPrimary }}>{forum.title}</h3>
                            {forum.description && (
                              <p className="text-sm mt-1 line-clamp-1" style={{ color: colors.textSecondary }}>
                                {forum.description}
                              </p>
                            )}
                            <p className="text-sm mt-1" style={{ color: colors.textSecondary }}>
                              {t('n_threads', { count: forum._count?.threads || 0 })}
                            </p>
                          </div>
                        </CardBody>
                      </Card>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Sidebar */}
          {hasAccess && (
            <div className="lg:w-80 flex-shrink-0">
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
    </div>
  );
};
