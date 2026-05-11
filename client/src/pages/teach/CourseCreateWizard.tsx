import { useEffect, useMemo, useState, useCallback } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams, useSearchParams, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Settings as SettingsIcon,
  Layers,
  Users as UsersIcon,
  Bot,
  Send,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { coursesApi } from '../../api/courses';
import { courseRolesApi } from '../../api/courseRoles';
import { Breadcrumb } from '../../components/common/Breadcrumb';
import { Loading } from '../../components/common/Loading';
import { ConfirmDialog } from '../../components/common/ConfirmDialog';
import { useAuth } from '../../hooks/useAuth';
import { useTheme } from '../../hooks/useTheme';
import activityLogger from '../../services/activityLogger';
import { Stepper, type StepperItem } from '../../components/teach/wizard/Stepper';
import { SettingStep } from '../../components/teach/wizard/SettingStep';
import { ContentStep } from '../../components/teach/wizard/ContentStep';
import { TutorsStep } from '../../components/teach/wizard/TutorsStep';
import { TeamStep } from '../../components/teach/wizard/TeamStep';
import { PublishStep } from '../../components/teach/wizard/PublishStep';
import { CourseResourcesBar } from '../../components/teach/wizard/CourseResourcesBar';
import {
  STEP_ORDER,
  computeUnlockedSteps,
  validateSetting,
  validatePublish,
  type StepId,
  type WizardCtx,
} from '../../components/teach/wizard/stepGates';
import type { CourseFormData } from '../../components/teach/CourseForm';
import type { Course } from '../../types';

const isStepId = (s: string | null): s is StepId =>
  !!s && (STEP_ORDER as string[]).includes(s);

export const CourseCreateWizard = () => {
  const { t } = useTranslation(['teaching', 'common', 'navigation']);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { isDark } = useTheme();
  const { id } = useParams<{ id: string }>();
  const [searchParams, setSearchParams] = useSearchParams();

  const courseId = id ? parseInt(id, 10) : null;
  const requestedStep = searchParams.get('step');
  const [activeStep, setActiveStep] = useState<StepId>(
    isStepId(requestedStep) ? requestedStep : 'setting',
  );

  // Stay in sync with URL changes (e.g. user navigates via back button).
  useEffect(() => {
    if (isStepId(requestedStep) && requestedStep !== activeStep) {
      setActiveStep(requestedStep);
    }
  }, [requestedStep, activeStep]);

  // Hydrate the existing draft when /teach/courses/:id/setup is hit.
  const { data: courseDetails, isLoading: detailsLoading } = useQuery({
    queryKey: ['courseDetails', courseId],
    queryFn: () => coursesApi.getCourseDetails(courseId!),
    enabled: courseId != null,
  });

  const course = courseDetails?.course as Course | undefined;

  // The Setting step's live form snapshot. Drives both the live preview
  // and the "Save & Continue" mutation.
  const [formSnapshot, setFormSnapshot] = useState<CourseFormData | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  // Modules are needed both to gate Structure→next and to render ContentStep.
  const { data: modules = [] } = useQuery({
    queryKey: ['courseDetails', courseId, 'modules'],
    queryFn: () => coursesApi.getModules(courseId!),
    enabled: courseId != null,
  });

  const { data: roles = [] } = useQuery({
    queryKey: ['courseRoles', courseId],
    queryFn: () => courseRolesApi.getCourseRoles(courseId!),
    enabled: courseId != null,
  });

  // Drives both the in-Content sub-tabs and the persistent Resources bar.
  const { data: resourceCounts } = useQuery({
    queryKey: ['courseResourceCounts', courseId],
    queryFn: () => coursesApi.getResourceCounts(courseId!),
    enabled: courseId != null,
  });

  useEffect(() => {
    if (!courseId) {
      activityLogger.logCourseCreateViewed();
    }
  }, [courseId]);

  const ctx: WizardCtx = useMemo(() => {
    let publishedLectures = 0;
    for (const m of modules) {
      for (const l of m.lectures ?? []) {
        if (l.isPublished) publishedLectures += 1;
      }
    }
    return {
      courseId,
      modulesCount: modules.length,
      publishedLecturesCount: publishedLectures,
    };
  }, [courseId, modules]);

  const unlocked = useMemo(() => computeUnlockedSteps(ctx), [ctx]);

  const steps: StepperItem[] = [
    { id: 'setting', label: t('teaching:wizard_step_setting', { defaultValue: 'Setting' }),     icon: SettingsIcon },
    { id: 'content', label: t('teaching:wizard_step_content', { defaultValue: 'Content' }),     icon: Layers },
    { id: 'tutors',  label: t('teaching:wizard_step_tutors',  { defaultValue: 'AI Tutors' }),   icon: Bot },
    { id: 'team',    label: t('teaching:wizard_step_team',    { defaultValue: 'Team Members' }),icon: UsersIcon },
    { id: 'publish', label: t('teaching:wizard_step_publish', { defaultValue: 'Publish' }),     icon: Send },
  ];

  const goToStep = useCallback(
    (id: StepId) => {
      setActiveStep(id);
      const next = new URLSearchParams(searchParams);
      next.set('step', id);
      setSearchParams(next, { replace: false });
    },
    [searchParams, setSearchParams],
  );

  const createMutation = useMutation({
    mutationFn: (data: CourseFormData) =>
      coursesApi.createCourse({ ...data, difficulty: data.difficulty || null } as Partial<Course>),
    onSuccess: created => {
      activityLogger.logCourseCreated(created.id, created.title);
      toast.success(t('teaching:course_created', { defaultValue: 'Course created' }));
      queryClient.invalidateQueries({ queryKey: ['courses'] });
      navigate(`/teach/courses/${created.id}/setup?step=content`, { replace: true });
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.error ?? err?.message ?? t('teaching:failed_to_create_course');
      toast.error(msg);
      setErrors({ form: msg });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => coursesApi.deleteCourse(courseId!),
    onSuccess: () => {
      toast.success(t('teaching:course_deleted', { defaultValue: 'Course deleted' }));
      queryClient.invalidateQueries({ queryKey: ['courses'] });
      navigate('/courses', { replace: true });
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.error ?? err?.message ?? t('common:error');
      toast.error(msg);
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: CourseFormData) =>
      coursesApi.updateCourse(courseId!, {
        ...data,
        difficulty: data.difficulty || null,
      } as Partial<Course>),
    onSuccess: () => {
      toast.success(t('teaching:course_saved', { defaultValue: 'Saved' }));
      queryClient.invalidateQueries({ queryKey: ['courseDetails', courseId] });
      queryClient.invalidateQueries({ queryKey: ['courses'] });
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.error ?? err?.message ?? t('teaching:failed_to_save_course');
      toast.error(msg);
      setErrors({ form: msg });
    },
  });

  const publishMutation = useMutation({
    mutationFn: () => coursesApi.publishCourse(courseId!),
    onSuccess: () => {
      toast.success(t('teaching:course_published', { defaultValue: 'Course published' }));
      queryClient.invalidateQueries({ queryKey: ['courses'] });
      queryClient.invalidateQueries({ queryKey: ['courseDetails', courseId] });
      navigate(`/courses/${courseId}`);
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.error ?? err?.message ?? t('teaching:failed_to_save_course');
      toast.error(msg);
    },
  });

  const handleSettingContinue = useCallback(async () => {
    if (!formSnapshot) {
      // Form hasn't loaded a snapshot yet — nothing to save.
      return;
    }
    const result = validateSetting(formSnapshot);
    if (!result.valid) {
      setErrors(result.errors);
      return;
    }
    setErrors({});
    if (courseId == null) {
      await createMutation.mutateAsync(formSnapshot);
      // navigate handled in onSuccess
    } else {
      await updateMutation.mutateAsync(formSnapshot);
      goToStep('content');
    }
  }, [formSnapshot, courseId, createMutation, updateMutation, goToStep, t]);

  const handleStepChange = useCallback(
    (id: StepId) => {
      if (!unlocked.has(id)) return;
      goToStep(id);
    },
    [unlocked, goToStep],
  );

  const handleBack = useCallback(() => {
    const i = STEP_ORDER.indexOf(activeStep);
    if (i > 0) goToStep(STEP_ORDER[i - 1]);
  }, [activeStep, goToStep]);

  const handleForward = useCallback(() => {
    const i = STEP_ORDER.indexOf(activeStep);
    const next = STEP_ORDER[i + 1];
    if (!next) return;
    if (activeStep === 'setting') {
      handleSettingContinue();
      return;
    }
    if (unlocked.has(next)) {
      goToStep(next);
    } else {
      toast.error(
        t('teaching:wizard_locked_step', {
          defaultValue: 'Complete the previous step first.',
        }),
      );
    }
  }, [activeStep, unlocked, goToStep, handleSettingContinue, t]);

  const colors = {
    bg: isDark ? '#0b1220' : '#f8fafc',
    text: isDark ? '#f3f4f6' : '#111827',
    muted: isDark ? '#9ca3af' : '#6b7280',
  };

  if (courseId != null && detailsLoading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <Loading text={t('teaching:loading_courses', { defaultValue: 'Loading…' })} />
      </div>
    );
  }

  // For the Setting step's preview when there is no draft yet, build a
  // placeholder Course from form state. Setting itself owns this internally.

  const breadcrumb = course
    ? [
        { label: t('navigation:courses'), href: '/teach' },
        { label: course.title, href: `/courses/${course.id}` },
        { label: t('teaching:setup', { defaultValue: 'Setup' }) },
      ]
    : [
        { label: t('navigation:courses'), href: '/teach' },
        { label: t('teaching:create_course') },
      ];

  return (
    <div style={{ backgroundColor: colors.bg, minHeight: '100vh' }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 md:py-8">
        <div className="mb-6 md:mb-8">
          <Breadcrumb items={breadcrumb} />
        </div>

        {courseId != null && (
          <CourseResourcesBar courseId={courseId} counts={resourceCounts} />
        )}

        <div className="mb-6 md:mb-8">
          <Stepper
            steps={steps}
            activeStep={activeStep}
            unlockedSteps={unlocked}
            onStepClick={handleStepChange}
            lockedTooltip={t('teaching:wizard_locked_step', {
              defaultValue: 'Complete the previous step first.',
            })}
          />
        </div>

        <div className="mb-8">
          {activeStep === 'setting' && (
            <SettingStep
              initialData={course}
              onChange={data => {
                setFormSnapshot(data);
                if (Object.keys(errors).length > 0) setErrors({});
              }}
              externalErrors={errors}
              onDelete={courseId != null ? () => setDeleteConfirmOpen(true) : undefined}
            />
          )}

          {activeStep === 'content' && courseId != null && (
            <ContentStep courseId={courseId} resourceCounts={resourceCounts} />
          )}

          {activeStep === 'tutors' && courseId != null && (
            <TutorsStep courseId={courseId} />
          )}

          {activeStep === 'team' && courseId != null && course && (
            <TeamStep courseId={courseId} instructorId={course.instructorId} />
          )}

          {activeStep === 'publish' && course && (
            <PublishStep
              course={course}
              // courseDetails ships modules with full lecture sections
              // (content, fileUrl, chatbot fields). The lighter `modules`
              // query from getModules omits sections, so the inline
              // lecture preview in Publish would render "No content yet".
              modules={(course.modules as typeof modules) ?? modules}
              roles={roles}
              check={validatePublish(ctx, roles.length, course.isPublic)}
            />
          )}
        </div>

        {/* Unified footer: Back + (optional Skip) + primary action.
            All buttons same size, no icons, consistent across steps. */}
        <div
          className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-5 border-t"
          style={{ borderColor: isDark ? '#374151' : '#e5e7eb' }}
        >
          <button
            type="button"
            onClick={handleBack}
            disabled={STEP_ORDER.indexOf(activeStep) === 0}
            className="inline-flex items-center justify-center px-5 py-2 rounded-lg text-sm font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            style={{
              backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#f3f4f6',
              color: isDark ? '#cbd5e1' : '#374151',
            }}
          >
            {t('teaching:wizard_back', { defaultValue: 'Back' })}
          </button>

          <div className="flex items-center gap-2">
            {(activeStep === 'team' || activeStep === 'tutors') && (
              <button
                type="button"
                onClick={() => {
                  const i = STEP_ORDER.indexOf(activeStep);
                  const next = STEP_ORDER[i + 1];
                  if (next) goToStep(next);
                }}
                className="inline-flex items-center justify-center px-5 py-2 rounded-lg text-sm font-medium transition-all"
                style={{
                  backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#f3f4f6',
                  color: isDark ? '#cbd5e1' : '#374151',
                }}
              >
                {t('teaching:wizard_skip', { defaultValue: 'Skip for now' })}
              </button>
            )}
            {activeStep === 'publish' ? (
              (() => {
                const check = course
                  ? validatePublish(ctx, roles.length, course.isPublic)
                  : { blockers: ['no_course'], warnings: [] };
                const blocked = check.blockers.length > 0;
                return (
                  <button
                    type="button"
                    onClick={() => publishMutation.mutate()}
                    disabled={blocked || publishMutation.isPending}
                    className="inline-flex items-center justify-center px-5 py-2 rounded-lg text-sm font-medium shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:hover:shadow-sm"
                    style={{
                      backgroundImage: 'linear-gradient(135deg, #088F8F 0%, #14b8a6 100%)',
                      color: '#ffffff',
                    }}
                  >
                    {publishMutation.isPending
                      ? t('common:loading')
                      : t('teaching:publish', { defaultValue: 'Publish' })}
                  </button>
                );
              })()
            ) : (
              <button
                type="button"
                onClick={handleForward}
                disabled={createMutation.isPending || updateMutation.isPending}
                className="inline-flex items-center justify-center px-5 py-2 rounded-lg text-sm font-medium shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md disabled:opacity-60 disabled:cursor-not-allowed"
                style={{
                  backgroundImage: 'linear-gradient(135deg, #088F8F 0%, #14b8a6 100%)',
                  color: '#ffffff',
                }}
              >
                {activeStep === 'setting'
                  ? t('teaching:wizard_continue', { defaultValue: 'Save & Continue' })
                  : t('common:next')}
              </button>
            )}
          </div>
        </div>

        {!user && (
          <div className="text-sm" style={{ color: colors.muted }}>
            <Link to="/login" className="text-primary-600 hover:underline">
              {t('common:loading')}
            </Link>
          </div>
        )}
      </div>

      <ConfirmDialog
        isOpen={deleteConfirmOpen}
        onClose={() => setDeleteConfirmOpen(false)}
        onConfirm={() => {
          deleteMutation.mutate();
          setDeleteConfirmOpen(false);
        }}
        title={t('teaching:delete_course', { defaultValue: 'Delete course' })}
        message={t('teaching:delete_course_confirm', {
          title: course?.title ?? '',
          defaultValue:
            'Delete "{{title}}"? This will permanently remove the course and all its content.',
        })}
        confirmText={t('common:delete')}
        loading={deleteMutation.isPending}
      />
    </div>
  );
};
