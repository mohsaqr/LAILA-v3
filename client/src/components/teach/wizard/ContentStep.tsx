import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Eye,
  ChevronDown,
  ChevronRight,
  GraduationCap,
  Clock,
  Video,
  FileText,
  Layers,
} from 'lucide-react';
import { useTheme } from '../../../hooks/useTheme';
import { resolveFileUrl } from '../../../api/client';
import { sanitizeHtml } from '../../../utils/sanitize';
import type { Course, CourseModule, Lecture } from '../../../types';

interface ContentStepProps {
  course: Course;
  modules: CourseModule[];
}

const lectureIcon = (contentType: Lecture['contentType']) => {
  if (contentType === 'video') return Video;
  if (contentType === 'mixed') return Layers;
  return FileText;
};

export const ContentStep = ({ course, modules }: ContentStepProps) => {
  const { t } = useTranslation(['teaching', 'courses']);
  const { isDark } = useTheme();
  const [openModule, setOpenModule] = useState<number | null>(modules[0]?.id ?? null);

  const description = course.description ?? '';
  const isHtml = description.trim().startsWith('<');
  const thumbnail = course.thumbnail
    ? resolveFileUrl(course.thumbnail) || course.thumbnail
    : null;

  return (
    <div className="space-y-5">
      <div
        className="rounded-xl border px-4 py-3 flex items-start gap-3 text-sm"
        style={{
          backgroundColor: isDark ? 'rgba(8,143,143,0.10)' : '#ecfeff',
          borderColor: isDark ? 'rgba(8,143,143,0.25)' : '#a5f3fc',
          color: isDark ? '#cbd5e1' : '#0f172a',
        }}
      >
        <Eye className="w-5 h-5 mt-0.5 shrink-0" style={{ color: isDark ? '#22d3d3' : '#077575' }} />
        <span>
          {t('teaching:wizard_preview_banner', {
            defaultValue: 'Preview only — students see this layout once you publish.',
          })}
        </span>
      </div>

      <div
        className="rounded-2xl overflow-hidden border"
        style={{
          backgroundColor: isDark ? '#1f2937' : '#ffffff',
          borderColor: isDark ? '#374151' : '#f3f4f6',
        }}
      >
        <div
          className="aspect-[16/5] flex items-center justify-center relative"
          style={{ backgroundImage: 'linear-gradient(135deg, #088F8F 0%, #14b8a6 100%)' }}
        >
          {thumbnail ? (
            <img src={thumbnail} alt={course.title} className="w-full h-full object-cover" />
          ) : (
            <GraduationCap className="w-14 h-14 text-white/80" />
          )}
        </div>

        <div className="p-5 sm:p-6">
          {course.categories && course.categories.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-3">
              {course.categories.map(cc => (
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
            className="text-2xl sm:text-3xl font-bold mb-3 leading-tight"
            style={{ color: isDark ? '#f3f4f6' : '#111827' }}
          >
            {course.title || t('teaching:course_title_placeholder', { defaultValue: 'Untitled course' })}
          </h1>

          {description.trim() && (
            <div
              className="prose prose-sm max-w-none leading-relaxed"
              style={{ color: isDark ? '#cbd5e1' : '#374151' }}
              dangerouslySetInnerHTML={
                isHtml
                  ? { __html: sanitizeHtml(description) }
                  : { __html: sanitizeHtml(description.replace(/\n/g, '<br/>')) }
              }
            />
          )}
        </div>
      </div>

      <div
        className="rounded-2xl border overflow-hidden"
        style={{
          backgroundColor: isDark ? '#1f2937' : '#ffffff',
          borderColor: isDark ? '#374151' : '#f3f4f6',
        }}
      >
        <div
          className="px-5 py-3.5 border-b text-sm font-semibold uppercase tracking-wider"
          style={{
            color: isDark ? '#9ca3af' : '#6b7280',
            borderColor: isDark ? '#374151' : '#f3f4f6',
          }}
        >
          {t('teaching:curriculum_editor', { defaultValue: 'Curriculum' })}
          <span className="ml-2 font-normal">
            · {t('courses:n_modules', { count: modules.length, defaultValue: '{{count}} modules' })}
          </span>
        </div>

        {modules.length === 0 ? (
          <div className="p-8 text-center text-sm" style={{ color: isDark ? '#9ca3af' : '#6b7280' }}>
            {t('teaching:wizard_no_modules', { defaultValue: 'No modules yet — add some in the Structure step.' })}
          </div>
        ) : (
          <ul>
            {modules.map((m, i) => {
              const lectures = m.lectures ?? [];
              const isOpen = openModule === m.id;
              return (
                <li
                  key={m.id}
                  className="border-b last:border-b-0"
                  style={{ borderColor: isDark ? '#374151' : '#f3f4f6' }}
                >
                  <button
                    type="button"
                    onClick={() => setOpenModule(isOpen ? null : m.id)}
                    className="w-full flex items-center gap-3 px-5 py-3.5 text-left transition-colors hover:bg-black/5 dark:hover:bg-white/5"
                  >
                    <span
                      className="inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-semibold shrink-0"
                      style={{
                        backgroundColor: isDark ? 'rgba(8,143,143,0.20)' : '#ccfbfb',
                        color: isDark ? '#22d3d3' : '#065c5c',
                      }}
                    >
                      {i + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div
                        className="text-sm font-semibold truncate"
                        style={{ color: isDark ? '#f3f4f6' : '#111827' }}
                      >
                        {m.title}
                      </div>
                      <div className="text-xs" style={{ color: isDark ? '#9ca3af' : '#6b7280' }}>
                        {lectures.length}{' '}
                        {t('teaching:lectures', {
                          count: lectures.length,
                          defaultValue: 'lectures',
                        })}
                      </div>
                    </div>
                    {isOpen ? (
                      <ChevronDown className="w-4 h-4 shrink-0 text-gray-400" />
                    ) : (
                      <ChevronRight className="w-4 h-4 shrink-0 text-gray-400" />
                    )}
                  </button>
                  {isOpen && lectures.length > 0 && (
                    <ul
                      className="pb-2"
                      style={{ backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : '#fafafa' }}
                    >
                      {lectures.map(l => {
                        const Icon = lectureIcon(l.contentType);
                        return (
                          <li
                            key={l.id}
                            className="flex items-center gap-3 px-5 py-2 pl-14 text-sm"
                            style={{ color: isDark ? '#cbd5e1' : '#374151' }}
                          >
                            <Icon className="w-4 h-4 shrink-0 text-gray-400" />
                            <span className="flex-1 truncate">{l.title}</span>
                            {l.duration ? (
                              <span
                                className="text-xs flex items-center gap-1 shrink-0"
                                style={{ color: isDark ? '#9ca3af' : '#6b7280' }}
                              >
                                <Clock className="w-3 h-3" />
                                {l.duration}m
                              </span>
                            ) : null}
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
};
