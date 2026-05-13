import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { sanitizeHtml } from '../utils/sanitize';
import { useParams, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Users,
  BookOpen,
  LineChart,
  Settings,
  GraduationCap,
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
import { CourseUpcomingAssignments } from '../components/course/CourseUpcomingAssignments';
import { MiniCalendar } from '../components/dashboard/MiniCalendar';
import { ModuleSection } from '../components/course/ModuleSection';
import { Modal } from '../components/common/Modal';
import { Input } from '../components/common/Input';
import { Avatar } from '../components/dashboard/Avatar';
import { resolveFileUrl } from '../api/client';
import { useEffect, useRef, useState } from 'react';
import { CurriculumViewMode } from '../types';
import activityLogger from '../services/activityLogger';
import { useTracker } from '../services/tracker';
import { TrackedContent } from '../components/common/TrackedContent';

export const CourseDetails = () => {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const { isAuthenticated, user, isActualAdmin } = useAuth();
  const { isDark } = useTheme();
  const { t } = useTranslation(['courses', 'common']);
  const track = useTracker('course');
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
    bgPurple: isDark ? 'rgba(139, 92, 246, 0.2)' : '#f5f3ff',
    textPurple: isDark ? '#c4b5fd' : '#7c3aed',
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
      activityLogger.logCourseEnrolled(parseInt(id!), course?.title);
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const handleEnrollClick = () => {
    track('enroll_clicked', { verb: 'interacted', objectType: 'course', objectId: parseInt(id!), courseId: parseInt(id!) });
    if ((course as any)?.hasActivationCode) {
      track('activation_modal_opened', { verb: 'interacted', objectType: 'course', objectId: parseInt(id!), courseId: parseInt(id!) });
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
    track('activation_code_submitted', { verb: 'interacted', objectType: 'course', objectId: parseInt(id!), courseId: parseInt(id!) });
    enrollMutation.mutate(activationCode.trim());
  };

  // Log course view when course loads
  useEffect(() => {
    if (course && isAuthenticated) {
      activityLogger.logCourseViewed(course.id, course.title).catch(() => {});
    }
  }, [course?.id, isAuthenticated]);

  // (Module scroll-to helper removed — sidebar Modules card was retired.)

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
  const isTeamMember = (course as any)?.isTeamMember;
  const isCourseInstructor = user?.id === course.instructorId;
  const showInstructorControls = isCourseInstructor || isTeamMember;
  const hasAccess = isEnrolled || isActualAdmin || isCourseInstructor || isTeamMember;
  const canManage = showInstructorControls || isActualAdmin;
  const thumbnail = course.thumbnail
    ? resolveFileUrl(course.thumbnail) || course.thumbnail
    : null;
  const studentCount = course._count?.enrollments ?? 0;
  const moduleCount = course.modules?.length ?? 0;

  // Get the view mode from course settings, default to 'mini-cards'
  const viewMode: CurriculumViewMode = (course as any).curriculumViewMode || 'mini-cards';

  // Flatten this course's published assignments and build the calendar
  // bucket so the sidebar can show upcoming items + a small month view.
  const courseAssignments = (course.modules ?? []).flatMap(
    m => m.assignments ?? [],
  );
  const assignmentsByDate = (() => {
    const map = new Map<string, number>();
    for (const a of courseAssignments) {
      if (!a.isPublished || !a.dueDate) continue;
      const d = new Date(a.dueDate);
      const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      map.set(iso, (map.get(iso) ?? 0) + 1);
    }
    return map;
  })();

  return (
    <div className="min-h-screen" style={{ backgroundColor: colors.bg }}>
      {/* Breadcrumb — matches the dashboard / catalog pattern (inline,
          no full-width bar, just sitting in the max-w container). */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 md:pt-8">
        <div className="mb-4">
          <Breadcrumb
            items={[
              { label: t('courses'), href: '/courses' },
              { label: course.title },
            ]}
          />
        </div>
      </div>

      {/* Hero — info on the left, thumbnail card on the right. */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div
          className="rounded-2xl border p-4 sm:p-5"
          style={{
            backgroundColor: isDark ? '#1f2937' : '#ffffff',
            borderColor: isDark ? '#374151' : '#e5e7eb',
          }}
        >
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            {/* Left — info */}
            <div className="lg:col-span-2 flex flex-col gap-2.5">
              {(course.categories?.length ?? 0) > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {course.categories!.map(({ category }) => (
                    <span
                      key={category.id}
                      className="text-[11px] font-medium px-2.5 py-1 rounded-full"
                      style={{
                        backgroundColor: isDark ? 'rgba(8,143,143,0.18)' : '#ccfbfb',
                        color: isDark ? '#22d3d3' : '#065c5c',
                      }}
                    >
                      {category.title}
                    </span>
                  ))}
                  {course.difficulty && (
                    <span
                      className="text-[11px] font-medium px-2.5 py-1 rounded-full"
                      style={{
                        backgroundColor: isDark ? 'rgba(245,158,11,0.18)' : '#fef3c7',
                        color: isDark ? '#fcd34d' : '#92400e',
                      }}
                    >
                      {course.difficulty}
                    </span>
                  )}
                </div>
              )}

              <h1
                className="text-2xl sm:text-3xl font-bold leading-tight"
                style={{ color: colors.textPrimary }}
              >
                {course.title}
              </h1>

              {course.description && (
                <TrackedContent
                  context="course"
                  courseId={parseInt(id!)}
                  objectId={parseInt(id!)}
                  objectTitle={course.title}
                >
                  <div
                    className="prose prose-sm dark:prose-invert max-w-none"
                    style={{ color: colors.textSecondary }}
                    dangerouslySetInnerHTML={{ __html: sanitizeHtml(course.description) }}
                  />
                </TrackedContent>
              )}

              {/* Stats strip — small and inline, right after the description. */}
              <div
                className="flex flex-wrap items-center gap-3 text-xs"
                style={{ color: colors.textMuted }}
              >
                <span className="inline-flex items-center gap-1">
                  <Users className="w-3.5 h-3.5" />
                  <span className="tabular-nums">{studentCount}</span>
                  <span>{t('student', { defaultValue: 'Student' })}</span>
                </span>
                <span style={{ color: colors.textMuted }}>·</span>
                <span className="inline-flex items-center gap-1">
                  <BookOpen className="w-3.5 h-3.5" />
                  <span className="tabular-nums">{moduleCount}</span>
                  <span>{t('module', { defaultValue: 'Module' })}</span>
                </span>
              </div>

              {/* Instructor + Enroll on one line. */}
              <div className="flex flex-wrap items-center gap-3 mt-1">
                {course.instructor && (
                  <div className="flex items-center gap-2 min-w-0">
                    <Avatar
                      src={course.instructor.avatarUrl
                        ? resolveFileUrl(course.instructor.avatarUrl)
                        : null}
                      name={course.instructor.fullname || '?'}
                      size="xs"
                    />
                    <span
                      className="text-xs font-medium truncate"
                      style={{ color: colors.textSecondary }}
                    >
                      {course.instructor.fullname}
                    </span>
                  </div>
                )}
                {/* Action cluster — all buttons share size, padding,
                    icon treatment and radius. Primary actions use the
                    brand gradient fill; Manage uses the soft secondary
                    tint to signal its different role. */}
                <div className="ml-auto flex items-center gap-2 flex-wrap">
                  {!isEnrolled && isAuthenticated && (
                    <button
                      type="button"
                      onClick={handleEnrollClick}
                      disabled={enrollMutation.isPending}
                      className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-sm font-semibold shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md disabled:opacity-60 disabled:cursor-not-allowed"
                      style={{
                        backgroundImage:
                          'linear-gradient(135deg, #088F8F 0%, #14b8a6 100%)',
                        color: '#ffffff',
                      }}
                    >
                      <GraduationCap className="w-4 h-4" strokeWidth={2.25} />
                      {enrollMutation.isPending
                        ? t('common:loading', { defaultValue: 'Loading…' })
                        : t('enroll_now')}
                    </button>
                  )}
                  {isEnrolled && (
                    <Link
                      to={`/courses/${id}/analytics`}
                      onClick={() =>
                        track('analytics_link_clicked', {
                          verb: 'interacted',
                          objectType: 'analytics',
                          courseId: parseInt(id!),
                        })
                      }
                      className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-sm font-semibold shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
                      style={{
                        backgroundImage:
                          'linear-gradient(135deg, #088F8F 0%, #14b8a6 100%)',
                        color: '#ffffff',
                      }}
                    >
                      <LineChart className="w-4 h-4" strokeWidth={2.25} />
                      {t('learning_analytics', { defaultValue: 'Learning Analytics' })}
                    </Link>
                  )}
                  {!isAuthenticated && (
                    <Link
                      to="/login"
                      className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-sm font-semibold shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
                      style={{
                        backgroundImage:
                          'linear-gradient(135deg, #088F8F 0%, #14b8a6 100%)',
                        color: '#ffffff',
                      }}
                    >
                      <GraduationCap className="w-4 h-4" strokeWidth={2.25} />
                      {t('sign_in_to_enroll')}
                    </Link>
                  )}
                  {canManage && (
                    <Link
                      to={`/teach/courses/${course.id}/setup?step=setting`}
                      className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-sm font-semibold transition-all hover:-translate-y-0.5"
                      style={{
                        backgroundColor: isDark ? 'rgba(8,143,143,0.18)' : '#ccfbfb',
                        color: isDark ? '#22d3d3' : '#065c5c',
                      }}
                    >
                      <Settings className="w-4 h-4" strokeWidth={2.25} />
                      {t('manage', { defaultValue: 'Manage' })}
                    </Link>
                  )}
                </div>
              </div>
            </div>

            {/* Right — thumbnail card */}
            <div className="lg:col-span-1">
              <div
                className="aspect-video w-full rounded-2xl overflow-hidden flex items-center justify-center"
                style={{
                  backgroundImage: 'linear-gradient(135deg, #088F8F 0%, #14b8a6 100%)',
                }}
              >
                {thumbnail ? (
                  <img
                    src={thumbnail}
                    alt={course.title}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <GraduationCap className="w-12 h-12 text-white/80" />
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Course Content - Two Column Layout */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 md:py-8">
        <div className="flex flex-col lg:flex-row gap-4 md:gap-8">
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
                      forums={module.forumThreads}
                      surveys={module.moduleSurveys as any}
                      labAssignments={(module as any).labAssignments}
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
              <div className="lg:sticky lg:top-4 space-y-8">
                {/* Compact month calendar marked with this course's
                    assignment deadlines. */}
                {assignmentsByDate.size > 0 && (
                  <MiniCalendar itemsByDate={assignmentsByDate} />
                )}

                {/* Upcoming assignments for this course (sidebar). */}
                <CourseUpcomingAssignments
                  courseId={parseInt(id!)}
                  assignments={courseAssignments}
                />

                {/* Collaborative Module */}
                <CollaborativeModule
                  courseId={parseInt(id!)}
                  tutors={(course as any).tutors}
                  moduleName={(course as any).collaborativeModuleName}
                  isInstructor={showInstructorControls || isActualAdmin}
                />
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
