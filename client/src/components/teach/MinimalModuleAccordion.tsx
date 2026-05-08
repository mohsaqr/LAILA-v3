import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ChevronDown,
  ChevronUp,
  Play,
  FileText,
  ClipboardList,
  HelpCircle,
  MessageSquare,
  MoreHorizontal,
  Plus,
} from 'lucide-react';
import { useTheme } from '../../hooks/useTheme';
import type { CourseModule, Lecture } from '../../types';

interface MinimalModuleAccordionProps {
  module: CourseModule;
  /** Zero-based position in the modules list — 1 → "01", 2 → "02", … */
  index: number;
  defaultOpen?: boolean;
  onEditModule: (m: CourseModule) => void;
  onDeleteModule: (m: CourseModule) => void;
  onAddLecture: (m: CourseModule) => void;
  onEditLecture: (l: Lecture) => void;
  onDeleteLecture: (l: Lecture) => void;
}

/**
 * Minimal accordion for the wizard's Content step. Mirrors the
 * reference design: caret + "01 Module Title", description below,
 * and a one-line "What's included" stat row. When expanded, lists
 * the module's lessons in a flat, low-chrome list. Heavy controls
 * (publish toggles, drag handles, per-row icons) are intentionally
 * omitted — the full curriculum editor at /teach/courses/:id/curriculum
 * still hosts those affordances.
 */
export const MinimalModuleAccordion = ({
  module,
  index,
  defaultOpen = false,
  onEditModule,
  onDeleteModule,
  onAddLecture,
  onEditLecture,
  onDeleteLecture,
}: MinimalModuleAccordionProps) => {
  const { t } = useTranslation('teaching');
  const { isDark } = useTheme();
  const [open, setOpen] = useState(defaultOpen);
  const [menuOpen, setMenuOpen] = useState(false);

  const lectures = module.lectures ?? [];
  const codeLabs = module.codeLabs ?? [];
  const assignments = module.assignments ?? [];
  const quizzes = module.quizzes ?? [];
  const forums = module.forums ?? [];

  // Split lectures by type so the summary reads naturally.
  const videoCount = lectures.filter(l => l.contentType === 'video' || l.contentType === 'mixed').length;
  const readingCount = lectures.filter(l => l.contentType === 'text').length;

  const stats: Array<{ icon: typeof Play; count: number; label: string }> = [];
  if (videoCount > 0) stats.push({ icon: Play, count: videoCount, label: t('lectures', { count: videoCount, defaultValue: 'videos' }) });
  if (readingCount > 0) stats.push({ icon: FileText, count: readingCount, label: t('readings', { defaultValue: 'readings' }) });
  if (assignments.length > 0) stats.push({ icon: ClipboardList, count: assignments.length, label: t('assignments', { defaultValue: 'assignments' }) });
  if (quizzes.length > 0) stats.push({ icon: HelpCircle, count: quizzes.length, label: t('quizzes', { defaultValue: 'quizzes' }) });
  if (forums.length > 0) stats.push({ icon: MessageSquare, count: forums.length, label: t('forums', { defaultValue: 'forums' }) });
  if (codeLabs.length > 0) stats.push({ icon: ClipboardList, count: codeLabs.length, label: t('labs', { defaultValue: 'labs' }) });

  const cardBg = isDark ? '#1f2937' : '#ffffff';
  const cardBorder = isDark ? '#374151' : '#e5e7eb';
  const titleColor = isDark ? '#f3f4f6' : '#111827';
  const mutedColor = isDark ? '#9ca3af' : '#6b7280';
  const subtleColor = isDark ? '#d1d5db' : '#374151';
  const dividerColor = isDark ? '#374151' : '#f3f4f6';

  return (
    <div
      className="rounded-xl border overflow-hidden"
      style={{ backgroundColor: cardBg, borderColor: cardBorder }}
    >
      <div className="flex items-start gap-3 px-4 py-4">
        <button
          type="button"
          onClick={() => setOpen(o => !o)}
          aria-label={open ? t('collapse', { defaultValue: 'Collapse' }) : t('expand', { defaultValue: 'Expand' })}
          aria-expanded={open}
          className="inline-flex items-center justify-center w-7 h-7 rounded-full transition-colors mt-0.5 shrink-0"
          style={{ color: mutedColor, backgroundColor: 'transparent' }}
          onMouseEnter={e => { e.currentTarget.style.backgroundColor = isDark ? 'rgba(255,255,255,0.06)' : '#f3f4f6'; }}
          onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent'; }}
        >
          {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>

        <button
          type="button"
          onClick={() => setOpen(o => !o)}
          className="flex-1 min-w-0 text-left"
        >
          <h3 className="text-base sm:text-lg font-semibold leading-tight" style={{ color: titleColor }}>
            <span className="tabular-nums mr-2" style={{ color: mutedColor }}>
              {String(index + 1).padStart(2, '0')}
            </span>
            {module.title}
          </h3>
        </button>

        <div className="relative shrink-0">
          <button
            type="button"
            onClick={() => setMenuOpen(o => !o)}
            aria-label={t('common:more_options', { defaultValue: 'More options' })}
            className="inline-flex items-center justify-center w-8 h-8 rounded-lg transition-colors"
            style={{ color: mutedColor, backgroundColor: 'transparent' }}
            onMouseEnter={e => { e.currentTarget.style.backgroundColor = isDark ? 'rgba(255,255,255,0.06)' : '#f3f4f6'; }}
            onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent'; }}
          >
            <MoreHorizontal className="w-4 h-4" />
          </button>
          {menuOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
              <div
                className="absolute right-0 mt-1 w-36 rounded-lg shadow-lg py-1 z-20 text-sm"
                style={{ backgroundColor: cardBg, border: `1px solid ${cardBorder}` }}
              >
                <button
                  type="button"
                  onClick={() => { onEditModule(module); setMenuOpen(false); }}
                  className="w-full text-left px-3 py-2 hover:bg-black/5 dark:hover:bg-white/5"
                  style={{ color: subtleColor }}
                >
                  {t('common:edit', { defaultValue: 'Edit' })}
                </button>
                <button
                  type="button"
                  onClick={() => { onDeleteModule(module); setMenuOpen(false); }}
                  className="w-full text-left px-3 py-2 hover:bg-black/5 dark:hover:bg-white/5 text-red-600 dark:text-red-400"
                >
                  {t('common:delete', { defaultValue: 'Delete' })}
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {open && (
        <div className="px-4 pb-4">
          {module.description && (
            <p
              className="text-sm leading-relaxed mb-4"
              style={{ color: subtleColor }}
            >
              {module.description}
            </p>
          )}

          {stats.length > 0 && (
            <div className="mb-4">
              <h4 className="text-sm font-semibold mb-2" style={{ color: titleColor }}>
                {t('whats_included', { defaultValue: "What's included" })}
              </h4>
              <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm" style={{ color: subtleColor }}>
                {stats.map(({ icon: Icon, count, label }, i) => (
                  <span key={i} className="inline-flex items-center gap-1.5">
                    <Icon className="w-4 h-4" style={{ color: mutedColor }} />
                    <span className="tabular-nums">{count}</span>
                    <span>{label}</span>
                  </span>
                ))}
              </div>
            </div>
          )}

          {lectures.length > 0 && (
            <div
              className="rounded-lg border divide-y"
              style={{ borderColor: dividerColor, ['--tw-divide-opacity' as any]: '1' }}
            >
              {lectures.map((lecture, i) => (
                <div
                  key={lecture.id}
                  className="flex items-center gap-3 px-3 py-2.5 group"
                  style={{ borderColor: dividerColor }}
                >
                  <span
                    className="text-xs tabular-nums w-6 shrink-0"
                    style={{ color: mutedColor }}
                  >
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <button
                    type="button"
                    onClick={() => onEditLecture(lecture)}
                    className="flex-1 min-w-0 text-left text-sm truncate hover:underline"
                    style={{ color: subtleColor }}
                  >
                    {lecture.title}
                  </button>
                  <button
                    type="button"
                    onClick={() => onDeleteLecture(lecture)}
                    className="text-xs opacity-0 group-hover:opacity-100 transition-opacity text-red-500 hover:text-red-700 dark:hover:text-red-400 px-2 py-1 rounded"
                  >
                    {t('common:delete', { defaultValue: 'Delete' })}
                  </button>
                </div>
              ))}
            </div>
          )}

          <button
            type="button"
            onClick={() => onAddLecture(module)}
            className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium transition-colors"
            style={{ color: '#0d9488' }}
          >
            <Plus className="w-4 h-4" />
            {t('add_lecture', { defaultValue: 'Add lesson' })}
          </button>
        </div>
      )}
    </div>
  );
};
