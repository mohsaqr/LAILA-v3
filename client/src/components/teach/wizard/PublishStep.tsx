import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, CheckCircle2, Send, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { coursesApi } from '../../../api/courses';
import { useTheme } from '../../../hooks/useTheme';
import type { Course } from '../../../types';
import type { PublishCheck } from './stepGates';

interface PublishStepProps {
  course: Course;
  modulesCount: number;
  publishedLecturesCount: number;
  teamMembersCount: number;
  check: PublishCheck;
}

export const PublishStep = ({
  course,
  modulesCount,
  publishedLecturesCount,
  teamMembersCount,
  check,
}: PublishStepProps) => {
  const { t } = useTranslation(['teaching', 'courses', 'common']);
  const { isDark } = useTheme();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const publishMutation = useMutation({
    mutationFn: () => coursesApi.publishCourse(course.id),
    onSuccess: () => {
      toast.success(t('course_published', { defaultValue: 'Course published' }));
      queryClient.invalidateQueries({ queryKey: ['courses'] });
      queryClient.invalidateQueries({ queryKey: ['courseDetails', course.id] });
      navigate(`/courses/${course.id}`);
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.error ?? err?.message ?? t('failed_to_save_course');
      toast.error(msg);
    },
  });

  const summary: Array<{ label: string; value: string | number }> = [
    { label: t('teaching:course_title'), value: course.title || '—' },
    {
      label: t('teaching:category'),
      value: course.categories?.map(cc => cc.category.title).join(', ') || '—',
    },
    { label: t('teaching:difficulty_level'), value: course.difficulty || '—' },
    { label: t('teaching:modules', { defaultValue: 'Modules' }), value: modulesCount },
    {
      label: t('teaching:lectures', { count: publishedLecturesCount, defaultValue: 'Published lectures' }),
      value: publishedLecturesCount,
    },
    { label: t('teaching:team_members'), value: teamMembersCount },
    {
      label: t('teaching:make_public'),
      value: course.isPublic ? t('common:yes') : t('common:no'),
    },
  ];

  return (
    <div className="space-y-5">
      <div
        className="rounded-2xl border p-5 sm:p-6"
        style={{
          backgroundColor: isDark ? '#1f2937' : '#ffffff',
          borderColor: isDark ? '#374151' : '#f3f4f6',
        }}
      >
        <h2
          className="text-lg font-semibold mb-4 flex items-center gap-2"
          style={{ color: isDark ? '#f3f4f6' : '#111827' }}
        >
          <CheckCircle2 className="w-5 h-5" style={{ color: isDark ? '#22d3d3' : '#077575' }} />
          {t('teaching:wizard_publish_summary', { defaultValue: 'Ready to publish?' })}
        </h2>

        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
          {summary.map(item => (
            <div key={item.label} className="flex items-baseline justify-between gap-3">
              <dt
                className="text-xs uppercase tracking-wider font-semibold shrink-0"
                style={{ color: isDark ? '#9ca3af' : '#6b7280' }}
              >
                {item.label}
              </dt>
              <dd
                className="text-sm font-medium text-right truncate"
                style={{ color: isDark ? '#e5e7eb' : '#111827' }}
              >
                {item.value}
              </dd>
            </div>
          ))}
        </dl>
      </div>

      {check.blockers.length > 0 && (
        <div
          className="rounded-xl border px-4 py-3.5"
          style={{
            backgroundColor: isDark ? 'rgba(220,38,38,0.10)' : '#fef2f2',
            borderColor: isDark ? 'rgba(220,38,38,0.30)' : '#fecaca',
          }}
        >
          <div className="flex items-start gap-2 text-sm font-semibold mb-1.5" style={{ color: isDark ? '#fca5a5' : '#991b1b' }}>
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
            {t('teaching:wizard_publish_blockers', { defaultValue: 'Resolve before publishing' })}
          </div>
          <ul className="space-y-1 pl-6 text-sm list-disc" style={{ color: isDark ? '#fca5a5' : '#991b1b' }}>
            {check.blockers.map(b => (
              <li key={b}>{t(`teaching:wizard_${b}`, { defaultValue: b })}</li>
            ))}
          </ul>
        </div>
      )}

      {check.warnings.length > 0 && (
        <div
          className="rounded-xl border px-4 py-3.5"
          style={{
            backgroundColor: isDark ? 'rgba(245,158,11,0.10)' : '#fffbeb',
            borderColor: isDark ? 'rgba(245,158,11,0.30)' : '#fde68a',
          }}
        >
          <div className="flex items-start gap-2 text-sm font-semibold mb-1.5" style={{ color: isDark ? '#fcd34d' : '#92400e' }}>
            <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
            {t('teaching:wizard_publish_warnings', { defaultValue: 'Worth a quick look' })}
          </div>
          <ul className="space-y-1 pl-6 text-sm list-disc" style={{ color: isDark ? '#fcd34d' : '#92400e' }}>
            {check.warnings.map(w => (
              <li key={w}>{t(`teaching:wizard_${w}`, { defaultValue: w })}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex justify-end pt-2">
        <button
          type="button"
          onClick={() => publishMutation.mutate()}
          disabled={check.blockers.length > 0 || publishMutation.isPending}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:hover:shadow-sm"
          style={{
            backgroundImage: 'linear-gradient(135deg, #088F8F 0%, #14b8a6 100%)',
            color: '#ffffff',
          }}
        >
          <Send className="w-4 h-4" strokeWidth={2.5} />
          {publishMutation.isPending
            ? t('common:loading')
            : t('teaching:publish', { defaultValue: 'Publish course' })}
        </button>
      </div>
    </div>
  );
};
