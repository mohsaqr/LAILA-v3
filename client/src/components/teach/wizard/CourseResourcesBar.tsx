import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Activity,
  Award,
  BarChart3,
  ClipboardList,
  LucideIcon,
  Users,
} from 'lucide-react';
import { useTheme } from '../../../hooks/useTheme';

interface CourseResourcesBarProps {
  courseId: number;
  counts?: {
    students?: number;
    certificates?: number;
    activityLogs?: number;
  };
}

type Tone = 'amber' | 'sky' | 'emerald' | 'violet' | 'cyan';

interface Resource {
  key: 'certificates' | 'students' | 'gradebook' | 'logs' | 'analytics';
  label: string;
  icon: LucideIcon;
  to: string;
  tone: Tone;
  count?: number;
}

// Per-pill palette: pastel surface + saturated icon/text so each
// resource is recognizable at a glance without being loud.
const TONE_LIGHT: Record<Tone, { bg: string; border: string; text: string; icon: string; countBg: string; countText: string }> = {
  amber:   { bg: '#fef3c7', border: '#fde68a', text: '#92400e', icon: '#b45309', countBg: '#fde68a', countText: '#78350f' },
  sky:     { bg: '#e0f2fe', border: '#bae6fd', text: '#075985', icon: '#0369a1', countBg: '#bae6fd', countText: '#0c4a6e' },
  emerald: { bg: '#d1fae5', border: '#a7f3d0', text: '#065f46', icon: '#047857', countBg: '#a7f3d0', countText: '#064e3b' },
  violet:  { bg: '#ede9fe', border: '#ddd6fe', text: '#5b21b6', icon: '#6d28d9', countBg: '#ddd6fe', countText: '#4c1d95' },
  cyan:    { bg: '#cffafe', border: '#a5f3fc', text: '#155e75', icon: '#0e7490', countBg: '#a5f3fc', countText: '#164e63' },
};

const TONE_DARK: Record<Tone, { bg: string; border: string; text: string; icon: string; countBg: string; countText: string }> = {
  amber:   { bg: 'rgba(245, 158, 11, 0.12)', border: 'rgba(245, 158, 11, 0.30)', text: '#fcd34d', icon: '#fbbf24', countBg: 'rgba(245, 158, 11, 0.22)', countText: '#fde68a' },
  sky:     { bg: 'rgba(14, 165, 233, 0.12)', border: 'rgba(14, 165, 233, 0.30)', text: '#7dd3fc', icon: '#38bdf8', countBg: 'rgba(14, 165, 233, 0.22)', countText: '#bae6fd' },
  emerald: { bg: 'rgba(16, 185, 129, 0.12)', border: 'rgba(16, 185, 129, 0.30)', text: '#6ee7b7', icon: '#34d399', countBg: 'rgba(16, 185, 129, 0.22)', countText: '#a7f3d0' },
  violet:  { bg: 'rgba(139, 92, 246, 0.14)', border: 'rgba(139, 92, 246, 0.32)', text: '#c4b5fd', icon: '#a78bfa', countBg: 'rgba(139, 92, 246, 0.24)', countText: '#ddd6fe' },
  cyan:    { bg: 'rgba(6, 182, 212, 0.12)',  border: 'rgba(6, 182, 212, 0.30)',  text: '#67e8f9', icon: '#22d3ee', countBg: 'rgba(6, 182, 212, 0.22)',  countText: '#a5f3fc' },
};

/**
 * Fixed quick-link card rendered persistently above the wizard steps.
 * Surfaces the five resources that live outside the wizard flow
 * (Certificates, Students, Gradebook, Logs, Analytics). Each pill has
 * its own pastel tone so instructors recognize destinations at a
 * glance. Horizontally scrollable on narrow viewports.
 */
export const CourseResourcesBar = ({ courseId, counts }: CourseResourcesBarProps) => {
  const { t } = useTranslation(['teaching', 'navigation']);
  const { isDark } = useTheme();
  const palette = isDark ? TONE_DARK : TONE_LIGHT;

  const resources: Resource[] = [
    {
      key: 'certificates',
      label: t('navigation:certificates', { defaultValue: 'Certificates' }),
      icon: Award,
      to: `/teach/courses/${courseId}/certificates`,
      tone: 'amber',
      count: counts?.certificates,
    },
    {
      key: 'students',
      label: t('navigation:students', { defaultValue: 'Students' }),
      icon: Users,
      to: `/teach/courses/${courseId}/students`,
      tone: 'sky',
      count: counts?.students,
    },
    {
      key: 'gradebook',
      label: t('navigation:gradebook', { defaultValue: 'Gradebook' }),
      icon: ClipboardList,
      to: `/teach/courses/${courseId}/gradebook`,
      tone: 'emerald',
    },
    {
      key: 'logs',
      label: t('navigation:logs', { defaultValue: 'Logs' }),
      icon: Activity,
      to: `/teach/courses/${courseId}/logs`,
      tone: 'violet',
      count: counts?.activityLogs,
    },
    {
      key: 'analytics',
      label: t('navigation:analytics', { defaultValue: 'Analytics' }),
      icon: BarChart3,
      to: `/teach/courses/${courseId}/analytics`,
      tone: 'cyan',
    },
  ];

  const cardBg = isDark ? '#1f2937' : '#ffffff';
  const cardBorder = isDark ? '#374151' : '#e5e7eb';
  const headingMuted = isDark ? '#9ca3af' : '#6b7280';

  return (
    <div
      className="mb-6 md:mb-8 rounded-2xl border px-3 py-2.5 sm:px-4 sm:py-3"
      style={{ backgroundColor: cardBg, borderColor: cardBorder }}
    >
      <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
        <span
          className="text-[11px] uppercase tracking-wider font-semibold flex-shrink-0"
          style={{ color: headingMuted }}
        >
          {t('teaching:course_resources', { defaultValue: 'Course resources' })}
        </span>
        <div className="-mx-1 px-1 overflow-x-auto">
          <div className="flex items-center gap-2 min-w-min">
            {resources.map(({ key, label, icon: Icon, to, tone, count }) => {
              const c = palette[tone];
              return (
                <Link
                  key={key}
                  to={to}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-all hover:-translate-y-0.5 hover:shadow-sm whitespace-nowrap"
                  style={{
                    backgroundColor: c.bg,
                    color: c.text,
                    borderColor: c.border,
                  }}
                >
                  <Icon className="w-3.5 h-3.5 flex-shrink-0" style={{ color: c.icon }} />
                  <span>{label}</span>
                  {typeof count === 'number' && (
                    <span
                      className="ml-0.5 inline-flex items-center justify-center min-w-[1.25rem] h-4 px-1 rounded-full text-[10px] font-bold leading-none"
                      style={{ backgroundColor: c.countBg, color: c.countText }}
                    >
                      {count}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
