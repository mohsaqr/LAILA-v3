import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import {
  AlertTriangle,
  AlertCircle,
  GraduationCap,
  KeyRound,
  Copy,
  Bot,
  Heart,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useTheme } from '../../../hooks/useTheme';
import { resolveFileUrl } from '../../../api/client';
import { sanitizeHtml } from '../../../utils/sanitize';
import { Avatar } from '../../dashboard/Avatar';
import { ModuleSection } from '../../course/ModuleSection';
import { courseTutorApi } from '../../../api/courseTutor';
import { ROLE_LABELS, type CourseRoleType } from '../../../api/courseRoles';
import type { Assignment, Course, CourseModule, CourseRole, CurriculumViewMode } from '../../../types';
import type { Forum } from '../../../api/forums';
import type { PublishCheck } from './stepGates';

interface LabAssignmentItem {
  id: number;
  moduleId: number | null;
  lab: { id: number; name: string; labType: string; description: string | null };
}

interface PublishStepProps {
  course: Course;
  modules: CourseModule[];
  /** Course-level assignments (from getCourseDetails). Grouped per module here. */
  assignments?: Assignment[];
  /** Course-level forums (from getCourseDetails). Grouped per module here. */
  forums?: Forum[];
  /** Course-level lab assignments (from getCourseDetails). Grouped per module here. */
  labAssignments?: LabAssignmentItem[];
  roles: CourseRole[];
  check: PublishCheck;
}

const ROUTING_LABELS: Record<string, string> = {
  free: 'Free Choice',
  all: 'All Tutors (Guided)',
  single: 'Single Tutor',
  smart: 'Smart Routing',
  collaborative: 'Team Mode',
  random: 'Random',
};

/**
 * Publish step — read-only, student-eye review of the course.
 * The Publish action lives in the wizard footer; this view focuses
 * on showing exactly what the student will see.
 */
export const PublishStep = ({
  course,
  modules,
  assignments = [],
  forums = [],
  labAssignments = [],
  roles,
  check,
}: PublishStepProps) => {
  const { t } = useTranslation(['teaching', 'common', 'admin']);
  const { isDark } = useTheme();

  const { data: tutors = [] } = useQuery({
    queryKey: ['courseTutors', String(course.id)],
    queryFn: () => courseTutorApi.getCourseTutors(course.id),
  });

  const cardBg = isDark ? '#1f2937' : '#ffffff';
  const cardBorder = isDark ? '#374151' : '#e5e7eb';
  const subtle = isDark ? '#cbd5e1' : '#374151';
  const muted = isDark ? '#9ca3af' : '#6b7280';
  const titleColor = isDark ? '#f3f4f6' : '#111827';
  const dividerColor = isDark ? '#374151' : '#f3f4f6';

  const description = course.description ?? '';
  const isHtml = description.trim().startsWith('<');
  const thumbnail = course.thumbnail
    ? resolveFileUrl(course.thumbnail) || course.thumbnail
    : null;

  const routingMode = (course as any).tutorRoutingMode as string | undefined;
  const emotionalPulseOn = (course as any).emotionalPulseEnabled !== false;
  const viewMode: CurriculumViewMode =
    ((course as any).curriculumViewMode as CurriculumViewMode | undefined) || 'mini-cards';

  const copyCode = () => {
    if (!course.activationCode) return;
    navigator.clipboard.writeText(course.activationCode);
    toast.success(t('teaching:code_copied', { defaultValue: 'Activation code copied' }));
  };

  return (
    <div className="space-y-5">
      {/* ─── Hero — card style, not banner ────────────────────────────── */}
      <div
        className="rounded-2xl border p-5 sm:p-6"
        style={{ backgroundColor: cardBg, borderColor: cardBorder }}
      >
        <div className="flex flex-col sm:flex-row gap-5 items-stretch">
          <div className="sm:w-72 sm:shrink-0 sm:self-stretch">
            <div
              className="w-full h-48 sm:h-full min-h-[12rem] rounded-xl overflow-hidden flex items-center justify-center"
              style={{ backgroundImage: 'linear-gradient(135deg, #088F8F 0%, #14b8a6 100%)' }}
            >
              {thumbnail ? (
                <img
                  src={thumbnail}
                  alt={course.title}
                  className="w-full h-full object-cover"
                />
              ) : (
                <GraduationCap className="w-10 h-10 text-white/80" />
              )}
            </div>
          </div>

          <div className="flex-1 min-w-0 space-y-3">
            {(course.categories?.length ?? 0) > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {course.categories!.map(cc => (
                  <span
                    key={cc.category.id}
                    className="text-[11px] font-medium px-2.5 py-1 rounded-full"
                    style={{
                      backgroundColor: isDark ? 'rgba(8,143,143,0.18)' : '#ccfbfb',
                      color: isDark ? '#22d3d3' : '#065c5c',
                    }}
                  >
                    {cc.category.title}
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
              className="text-xl sm:text-2xl font-bold leading-tight"
              style={{ color: titleColor }}
            >
              {course.title}
            </h1>

            {description && (
              <div
                className="prose prose-sm dark:prose-invert max-w-none"
                style={{ color: subtle }}
                dangerouslySetInnerHTML={
                  isHtml
                    ? { __html: sanitizeHtml(description) }
                    : { __html: sanitizeHtml(description.replace(/\n/g, '<br/>')) }
                }
              />
            )}

            {course.activationCode && (
              <div
                className="inline-flex items-center gap-2 rounded-lg px-3 py-2 border"
                style={{
                  backgroundColor: isDark ? 'rgba(245,158,11,0.10)' : '#fffbeb',
                  borderColor: isDark ? 'rgba(245,158,11,0.30)' : '#fde68a',
                }}
              >
                <KeyRound className="w-4 h-4" style={{ color: isDark ? '#fcd34d' : '#92400e' }} />
                <span
                  className="text-xs uppercase tracking-wider font-semibold"
                  style={{ color: muted }}
                >
                  {t('teaching:activation_code', { defaultValue: 'Activation Code' })}
                </span>
                <code
                  className="font-mono font-bold text-sm tabular-nums"
                  style={{ color: isDark ? '#fcd34d' : '#92400e' }}
                >
                  {course.activationCode}
                </code>
                <button
                  type="button"
                  onClick={copyCode}
                  aria-label={t('teaching:copy_code', { defaultValue: 'Copy code' })}
                  title={t('teaching:copy_code', { defaultValue: 'Copy code' })}
                  className="inline-flex items-center justify-center w-6 h-6 rounded hover:bg-black/5 dark:hover:bg-white/5"
                  style={{ color: muted }}
                >
                  <Copy className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Curriculum — renders the same ModuleSection used on the
          student-facing course page, honoring course.curriculumViewMode.
          getCourseDetails ships assignments/forums/labAssignments at
          the course level (not nested per module), so we group them
          by moduleId here before handing to ModuleSection. */}
      <Section title={t('teaching:curriculum_editor', { defaultValue: 'Curriculum' })}>
        {modules.length === 0 ? (
          <p className="text-sm" style={{ color: muted }}>
            {t('teaching:wizard_no_modules', { defaultValue: 'No modules yet.' })}
          </p>
        ) : (
          <div className="space-y-4">
            {modules.map((module, mIndex) => {
              const moduleAssignments =
                module.assignments?.length
                  ? module.assignments
                  : assignments.filter(a => (a as any).moduleId === module.id);
              const moduleForums =
                module.forums?.length
                  ? module.forums
                  : forums.filter(f => (f as any).moduleId === module.id);
              const moduleLabAssignments =
                (module as any).labAssignments?.length
                  ? (module as any).labAssignments
                  : labAssignments.filter(la => la.moduleId === module.id);
              return (
                <ModuleSection
                  key={module.id}
                  module={module}
                  moduleIndex={mIndex}
                  courseId={course.id}
                  lectures={module.lectures}
                  codeLabs={module.codeLabs}
                  quizzes={module.quizzes}
                  assignments={moduleAssignments}
                  forums={moduleForums}
                  surveys={module.moduleSurveys as any}
                  labAssignments={moduleLabAssignments}
                  hasAccess
                  viewMode={viewMode}
                />
              );
            })}
          </div>
        )}
      </Section>

      {/* ─── AI Tutors ─────────────────────────────────────────────────── */}
      <Section title={t('teaching:wizard_step_tutors', { defaultValue: 'AI Tutors' })}>
        {tutors.length === 0 ? (
          <p className="text-sm" style={{ color: muted }}>
            {t('teaching:no_tutors_yet', { defaultValue: 'No AI tutors attached.' })}
          </p>
        ) : (
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {tutors.map(tutor => {
              const name = tutor.customName || tutor.chatbot?.displayName || '—';
              const desc = tutor.customDescription || tutor.chatbot?.description;
              return (
                <li
                  key={tutor.id}
                  className="flex items-center gap-3 rounded-lg border px-3 py-2"
                  style={{ backgroundColor: cardBg, borderColor: cardBorder }}
                >
                  <div
                    className="w-9 h-9 rounded-full flex items-center justify-center shrink-0"
                    style={{
                      backgroundColor: isDark ? 'rgba(167,139,250,0.18)' : '#ede9fe',
                      color: isDark ? '#a78bfa' : '#7c3aed',
                    }}
                  >
                    {tutor.chatbot?.avatarUrl ? (
                      <img
                        src={tutor.chatbot.avatarUrl}
                        alt=""
                        className="w-full h-full rounded-full object-cover"
                      />
                    ) : (
                      <Bot className="w-4 h-4" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate" style={{ color: subtle }}>
                      {name}
                    </p>
                    {desc && (
                      <p className="text-xs truncate" style={{ color: muted }}>
                        {desc}
                      </p>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        <div
          className="mt-4 pt-4 border-t flex flex-col sm:flex-row gap-3 sm:gap-6 text-sm"
          style={{ borderColor: dividerColor }}
        >
          {routingMode && (
            <div className="flex items-center gap-2">
              <span
                className="text-xs uppercase tracking-wider font-semibold"
                style={{ color: muted }}
              >
                {t('teaching:tutor_routing', { defaultValue: 'Tutor Routing' })}
              </span>
              <span
                className="px-2 py-0.5 rounded-md text-xs font-medium"
                style={{
                  backgroundColor: isDark ? 'rgba(8,143,143,0.18)' : '#ccfbfb',
                  color: isDark ? '#22d3d3' : '#065c5c',
                }}
              >
                {ROUTING_LABELS[routingMode] ?? routingMode}
              </span>
            </div>
          )}
          <div className="flex items-center gap-2">
            <Heart
              className="w-3.5 h-3.5"
              style={{ color: emotionalPulseOn ? '#ec4899' : muted }}
            />
            <span
              className="text-xs uppercase tracking-wider font-semibold"
              style={{ color: muted }}
            >
              {t('teaching:emotional_pulse', { defaultValue: 'Emotional Pulse' })}
            </span>
            <span
              className="px-2 py-0.5 rounded-md text-xs font-medium"
              style={{
                backgroundColor: emotionalPulseOn
                  ? (isDark ? 'rgba(16,185,129,0.18)' : '#d1fae5')
                  : (isDark ? 'rgba(255,255,255,0.06)' : '#f3f4f6'),
                color: emotionalPulseOn
                  ? (isDark ? '#34d399' : '#065f46')
                  : muted,
              }}
            >
              {emotionalPulseOn
                ? t('common:enabled', { defaultValue: 'On' })
                : t('common:disabled', { defaultValue: 'Off' })}
            </span>
          </div>
        </div>
      </Section>

      {/* ─── Team members table — hidden when no members ────────────── */}
      {roles.length > 0 && (
        <Section title={t('teaching:wizard_step_team', { defaultValue: 'Team Members' })}>
          <div
            className="rounded-lg border overflow-hidden"
            style={{ borderColor: cardBorder }}
          >
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: `1px solid ${dividerColor}` }}>
                  <th
                    className="text-left px-4 py-2.5 text-xs font-semibold uppercase tracking-wider"
                    style={{ color: muted }}
                  >
                    {t('common:name', { defaultValue: 'Name' })}
                  </th>
                  <th
                    className="text-left px-4 py-2.5 text-xs font-semibold uppercase tracking-wider hidden sm:table-cell"
                    style={{ color: muted }}
                  >
                    {t('common:email', { defaultValue: 'Email' })}
                  </th>
                  <th
                    className="text-left px-4 py-2.5 text-xs font-semibold uppercase tracking-wider"
                    style={{ color: muted }}
                  >
                    {t('admin:role', { defaultValue: 'Role' })}
                  </th>
                </tr>
              </thead>
              <tbody>
                {roles.map(role => (
                  <tr
                    key={role.id}
                    style={{ borderBottom: `1px solid ${dividerColor}` }}
                    className="last:border-b-0"
                  >
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2.5">
                        <Avatar
                          src={(role.user as any)?.avatarUrl
                            ? resolveFileUrl((role.user as any).avatarUrl)
                            : null}
                          name={role.user?.fullname || role.user?.email || '?'}
                          size="sm"
                        />
                        <span className="font-medium truncate" style={{ color: subtle }}>
                          {role.user?.fullname || '—'}
                        </span>
                      </div>
                    </td>
                    <td
                      className="px-4 py-2.5 truncate hidden sm:table-cell"
                      style={{ color: muted }}
                    >
                      {role.user?.email || '—'}
                    </td>
                    <td className="px-4 py-2.5">
                      <span
                        className="inline-block px-2 py-0.5 rounded-md text-xs font-medium"
                        style={{
                          backgroundColor: isDark ? 'rgba(8,143,143,0.18)' : '#ccfbfb',
                          color: isDark ? '#22d3d3' : '#065c5c',
                        }}
                      >
                        {ROLE_LABELS[role.role as CourseRoleType] ?? role.role}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
      )}

      {/* ─── Blockers / warnings ──────────────────────────────────────── */}
      {check.blockers.length > 0 && (
        <div
          className="rounded-xl border px-4 py-3.5"
          style={{
            backgroundColor: isDark ? 'rgba(220,38,38,0.10)' : '#fef2f2',
            borderColor: isDark ? 'rgba(220,38,38,0.30)' : '#fecaca',
          }}
        >
          <div
            className="flex items-start gap-2 text-sm font-semibold mb-1.5"
            style={{ color: isDark ? '#fca5a5' : '#991b1b' }}
          >
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
            {t('teaching:wizard_publish_blockers', { defaultValue: 'Resolve before publishing' })}
          </div>
          <ul
            className="space-y-1 pl-6 text-sm list-disc"
            style={{ color: isDark ? '#fca5a5' : '#991b1b' }}
          >
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
          <div
            className="flex items-start gap-2 text-sm font-semibold mb-1.5"
            style={{ color: isDark ? '#fcd34d' : '#92400e' }}
          >
            <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
            {t('teaching:wizard_publish_warnings', { defaultValue: 'Worth a quick look' })}
          </div>
          <ul
            className="space-y-1 pl-6 text-sm list-disc"
            style={{ color: isDark ? '#fcd34d' : '#92400e' }}
          >
            {check.warnings.map(w => (
              <li key={w}>{t(`teaching:wizard_${w}`, { defaultValue: w })}</li>
            ))}
          </ul>
        </div>
      )}

    </div>
  );
};

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => {
  const { isDark } = useTheme();
  return (
    <div
      className="rounded-2xl border p-5 sm:p-6"
      style={{
        backgroundColor: isDark ? '#1f2937' : '#ffffff',
        borderColor: isDark ? '#374151' : '#e5e7eb',
      }}
    >
      <h2
        className="text-xs font-semibold uppercase tracking-wider mb-3"
        style={{ color: isDark ? '#9ca3af' : '#6b7280' }}
      >
        {title}
      </h2>
      {children}
    </div>
  );
};

