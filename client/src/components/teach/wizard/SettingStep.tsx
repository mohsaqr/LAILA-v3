import { useState, useMemo, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Trash2 } from 'lucide-react';
import { CourseForm, type CourseFormData } from '../CourseForm';
import { CourseCardV2 } from '../../courses/CourseCardV2';
import { categoriesApi } from '../../../api/categories';
import { useAuth } from '../../../hooks/useAuth';
import { useTheme } from '../../../hooks/useTheme';
import type { Course } from '../../../types';

interface SettingStepProps {
  initialData?: Partial<Course>;
  /** Fires whenever the form contents change — wizard tracks this for its Continue handler. */
  onChange: (data: CourseFormData) => void;
  /** Per-field validation errors (i18n keys) the wizard set after a failed save. */
  externalErrors?: Record<string, string>;
  /** When set, render a delete button next to the Preview label that triggers this. */
  onDelete?: () => void;
}

export const SettingStep = ({ initialData, onChange, externalErrors, onDelete }: SettingStepProps) => {
  const { t } = useTranslation(['teaching', 'courses']);
  const { user } = useAuth();
  const { isDark } = useTheme();
  const [snapshot, setSnapshot] = useState<CourseFormData | null>(null);

  const { data: categories = [] } = useQuery({
    queryKey: ['categories'],
    queryFn: categoriesApi.getCategories,
  });

  const handleChange = useCallback(
    (data: CourseFormData) => {
      setSnapshot(data);
      onChange(data);
    },
    [onChange],
  );

  // Translate the i18n error keys before handing them to CourseForm so it
  // can render the actual message in red under the field.
  const translatedErrors = useMemo<Record<string, string>>(() => {
    if (!externalErrors) return {};
    const out: Record<string, string> = {};
    for (const [field, key] of Object.entries(externalErrors)) {
      if (!key) continue;
      out[field] = t(`teaching:${key}`, { defaultValue: key });
    }
    return out;
  }, [externalErrors, t]);

  const previewCourse = useMemo<Course>(() => {
    const data = snapshot ?? {
      title: initialData?.title ?? '',
      description: initialData?.description ?? '',
      categoryIds: initialData?.categories?.map(cc => cc.category.id) ?? [],
      difficulty: (initialData?.difficulty ?? '') as CourseFormData['difficulty'],
      thumbnail: initialData?.thumbnail ?? '',
      isPublic: initialData?.isPublic ?? true,
      curriculumViewMode: initialData?.curriculumViewMode ?? 'mini-cards',
    };

    const selectedCategories = categories
      .filter(c => data.categoryIds.includes(c.id))
      .map(c => ({ category: c }));

    return {
      id: initialData?.id ?? -1,
      title: data.title || t('teaching:course_title_placeholder', { defaultValue: 'Untitled course' }),
      slug: initialData?.slug ?? 'preview',
      description: data.description,
      thumbnail: data.thumbnail,
      instructorId: user?.id ?? 0,
      categories: selectedCategories,
      difficulty: data.difficulty || null,
      status: initialData?.status ?? 'draft',
      isPublic: data.isPublic,
      createdAt: initialData?.createdAt ?? new Date().toISOString(),
      updatedAt: initialData?.updatedAt ?? new Date().toISOString(),
      publishedAt: initialData?.publishedAt ?? null,
      curriculumViewMode: data.curriculumViewMode,
      activationCode: initialData?.activationCode ?? null,
      instructor: {
        id: user?.id ?? 0,
        fullname: user?.fullname ?? '',
        email: user?.email,
        avatarUrl: user?.avatarUrl ?? null,
      },
      _count: initialData?._count ?? { enrollments: 0, modules: 0 },
    } as Course;
  }, [snapshot, initialData, categories, user, t]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">
      <div className="lg:col-span-1 order-2 lg:order-1">
        <div className="lg:sticky lg:top-6 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <span
              className="text-xs font-semibold uppercase tracking-wider"
              style={{ color: isDark ? '#9ca3af' : '#6b7280' }}
            >
              {t('teaching:wizard_preview', { defaultValue: 'Preview' })}
            </span>
            {onDelete && (
              <button
                type="button"
                onClick={onDelete}
                className="inline-flex items-center justify-center w-8 h-8 rounded-lg transition-colors"
                style={{
                  color: isDark ? '#fca5a5' : '#dc2626',
                  backgroundColor: 'transparent',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.backgroundColor = isDark
                    ? 'rgba(220,38,38,0.15)'
                    : '#fef2f2';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                }}
                title={t('teaching:delete_course', { defaultValue: 'Delete course' })}
                aria-label={t('teaching:delete_course', { defaultValue: 'Delete course' })}
              >
                <Trash2 className="w-4 h-4" strokeWidth={2.25} />
              </button>
            )}
          </div>
          <div>
            <CourseCardV2
              course={previewCourse}
              progress={null}
              canManage={false}
              studentsLabel={(count) => t('courses:n_students', { count })}
              progressLabel={t('courses:progress')}
              manageLabel={t('courses:manage')}
            />
          </div>
        </div>
      </div>

      <div className="lg:col-span-2 order-1 lg:order-2">
        <CourseForm
          initialData={initialData}
          onSubmit={async () => { /* wizard owns submit */ }}
          submitLabel=""
          onChange={handleChange}
          showSubmit={false}
          externalErrors={translatedErrors}
        />
      </div>
    </div>
  );
};
