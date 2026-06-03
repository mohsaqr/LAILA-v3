import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ClipboardCheck, FileQuestion, FileText, LucideIcon, MessageSquare } from 'lucide-react';
import { useTheme } from '../../../hooks/useTheme';

interface ContentSubTabsProps {
  courseId: number;
  counts?: {
    assignments?: number;
    quizzes?: number;
    forums?: number;
    surveys?: number;
  };
}

interface Item {
  key: 'assignments' | 'quizzes' | 'forums' | 'surveys';
  label: string;
  icon: LucideIcon;
  to: string;
  count: number | undefined;
}

/**
 * Small horizontal sub-navigation rendered above the curriculum editor
 * on the Content step. Each pill deep-links into the matching manager
 * page (assignments / quizzes / forums / surveys) and shows a tiny
 * inline count. Mobile: horizontally scrollable so the row never wraps.
 */
export const ContentSubTabs = ({ courseId, counts }: ContentSubTabsProps) => {
  const { t } = useTranslation(['teaching', 'navigation']);
  const { isDark } = useTheme();
  const { pathname } = useLocation();

  const items: Item[] = [
    {
      key: 'assignments',
      label: t('navigation:assignments', { defaultValue: 'Assignments' }),
      icon: FileText,
      to: `/teach/courses/${courseId}/assignments`,
      count: counts?.assignments,
    },
    {
      key: 'quizzes',
      label: t('navigation:quizzes', { defaultValue: 'Quizzes' }),
      icon: FileQuestion,
      to: `/teach/courses/${courseId}/quizzes`,
      count: counts?.quizzes,
    },
    {
      key: 'forums',
      label: t('navigation:forums', { defaultValue: 'Forums' }),
      icon: MessageSquare,
      to: `/teach/courses/${courseId}/forums`,
      count: counts?.forums,
    },
    {
      key: 'surveys',
      label: t('navigation:surveys', { defaultValue: 'Surveys' }),
      icon: ClipboardCheck,
      to: `/teach/courses/${courseId}/surveys`,
      count: counts?.surveys,
    },
  ];

  const isActive = (to: string) => pathname.startsWith(to);

  const pillBg = isDark ? '#1f2937' : '#ffffff';
  const pillBorder = isDark ? '#374151' : '#e5e7eb';
  const pillText = isDark ? '#d1d5db' : '#374151';
  const pillHoverBg = isDark ? '#374151' : '#f3f4f6';
  const countBg = isDark ? '#374151' : '#f3f4f6';
  const countText = isDark ? '#9ca3af' : '#6b7280';
  const activeBg = isDark ? 'rgba(8, 143, 143, 0.18)' : '#e6f7f7';
  const activeText = isDark ? '#5eecec' : '#066d6d';
  const activeBorder = '#088F8F';

  return (
    <div className="mb-3 sm:mb-4 -mx-1 px-1 overflow-x-auto">
      <div className="flex items-center gap-2 min-w-min">
        {items.map(({ key, label, icon: Icon, to, count }) => {
          const active = isActive(to);
          return (
            <Link
              key={key}
              to={to}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs font-medium border transition-colors whitespace-nowrap"
              style={{
                backgroundColor: active ? activeBg : pillBg,
                color: active ? activeText : pillText,
                borderColor: active ? activeBorder : pillBorder,
              }}
              onMouseEnter={(e) => {
                if (!active) (e.currentTarget as HTMLElement).style.backgroundColor = pillHoverBg;
              }}
              onMouseLeave={(e) => {
                if (!active) (e.currentTarget as HTMLElement).style.backgroundColor = pillBg;
              }}
            >
              <Icon className="w-3.5 h-3.5 flex-shrink-0" />
              <span>{label}</span>
              {typeof count === 'number' && (
                <span
                  className="ml-0.5 inline-flex items-center justify-center min-w-[1.25rem] h-4 px-1 rounded-full text-[10px] font-semibold leading-none"
                  style={{
                    backgroundColor: active ? activeBorder : countBg,
                    color: active ? '#ffffff' : countText,
                  }}
                >
                  {count}
                </span>
              )}
            </Link>
          );
        })}
      </div>
    </div>
  );
};
