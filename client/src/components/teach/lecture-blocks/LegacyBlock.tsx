import { useTranslation } from 'react-i18next';
import { ClipboardList, Sparkles, Info } from 'lucide-react';
import { useTheme } from '../../../hooks/useTheme';
import type { LectureSection } from '../../../types';

interface LegacyBlockProps {
  section: LectureSection;
}

/**
 * Read-only placeholder for `assignment` and `ai-generated` sections.
 * The new editor doesn't let instructors create these (assignments
 * live at the module level; AI-generated text is a Tiptap text block
 * now), but old courses might still have them so we render a marker
 * with a small note instead of dropping the data.
 */
export const LegacyBlock = ({ section }: LegacyBlockProps) => {
  const { t } = useTranslation('teaching');
  const { isDark } = useTheme();

  const isAssignment = section.type === 'assignment';
  const Icon = isAssignment ? ClipboardList : Sparkles;
  const label = isAssignment
    ? t('assignment', { defaultValue: 'Assignment' })
    : t('ai_generated', { defaultValue: 'AI section' });

  return (
    <div
      className="flex items-start gap-3 rounded-xl border px-4 py-3"
      style={{
        backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : '#fafafa',
        borderColor: isDark ? '#374151' : '#e5e7eb',
      }}
    >
      <div
        className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
        style={{
          backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#f3f4f6',
          color: isDark ? '#9ca3af' : '#6b7280',
        }}
      >
        <Icon className="w-4 h-4" />
      </div>
      <div className="flex-1 min-w-0">
        <p
          className="text-sm font-medium"
          style={{ color: isDark ? '#cbd5e1' : '#374151' }}
        >
          {section.title || label}
        </p>
        <p
          className="text-xs mt-1 inline-flex items-center gap-1"
          style={{ color: isDark ? '#9ca3af' : '#6b7280' }}
        >
          <Info className="w-3 h-3" />
          {t('legacy_section_note', {
            defaultValue: 'Legacy block. Manage from the assignment manager.',
          })}
        </p>
      </div>
    </div>
  );
};
