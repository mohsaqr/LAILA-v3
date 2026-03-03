import { useState, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { ChevronDown, X, Search, HelpCircle } from 'lucide-react';
import { Input, TextArea, Select } from '../common/Input';
import { Button } from '../common/Button';
import { Course, CurriculumViewMode, Category } from '../../types';
import { categoriesApi } from '../../api/categories';

export interface CourseFormData {
  title: string;
  description: string;
  categoryIds: number[];
  difficulty: 'beginner' | 'intermediate' | 'advanced' | '';
  thumbnail: string;
  isPublic: boolean;
  curriculumViewMode: CurriculumViewMode;
}

interface CourseFormProps {
  initialData?: Partial<Course>;
  onSubmit: (data: CourseFormData) => Promise<void>;
  submitLabel: string;
  loading?: boolean;
}

// ─── Info popup ───────────────────────────────────────────────────────────────

const InfoPopup = ({ text }: { text: string }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', handler);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative inline-flex items-center">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="text-gray-400 hover:text-primary-500 dark:hover:text-primary-400 transition-colors focus:outline-none"
        aria-label="More information"
      >
        <HelpCircle className="w-3.5 h-3.5" />
      </button>
      {open && (
        <div className="absolute left-5 top-0 z-50 w-64 p-3 text-xs leading-relaxed rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300">
          {text}
        </div>
      )}
    </div>
  );
};

// ─── Multi-select component ───────────────────────────────────────────────────

interface MultiSelectProps {
  label: string;
  allCategories: Category[];
  selectedIds: number[];
  onChange: (ids: number[]) => void;
}

const CategoryMultiSelect = ({ label, allCategories, selectedIds, onChange }: MultiSelectProps) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setSearch('');
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const selected = allCategories.filter(c => selectedIds.includes(c.id));
  const filtered = allCategories.filter(c =>
    c.title.toLowerCase().includes(search.toLowerCase())
  );

  const toggle = (id: number) => {
    onChange(
      selectedIds.includes(id)
        ? selectedIds.filter(x => x !== id)
        : [...selectedIds, id]
    );
  };

  const remove = (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(selectedIds.filter(x => x !== id));
  };

  return (
    <div ref={containerRef} className="relative">
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
        {label}
      </label>

      {/* Trigger */}
      <div
        onClick={() => setOpen(o => !o)}
        className={`min-h-[42px] w-full px-3 py-2 flex flex-wrap items-center gap-1.5 rounded-lg border cursor-pointer transition-colors ${
          open
            ? 'border-primary-500 ring-2 ring-primary-500/20'
            : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'
        } bg-white dark:bg-gray-800`}
      >
        {selected.length === 0 ? (
          <span className="text-sm text-gray-400 dark:text-gray-500 flex-1">
            Select categories…
          </span>
        ) : (
          selected.map(cat => (
            <span
              key={cat.id}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-300"
            >
              {cat.title}
              <button
                type="button"
                onClick={e => remove(cat.id, e)}
                className="hover:text-primary-900 dark:hover:text-primary-100 transition-colors"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          ))
        )}
        <ChevronDown
          className={`w-4 h-4 text-gray-400 ml-auto shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </div>

      {/* Dropdown */}
      {open && (
        <div className="absolute z-50 mt-1 w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-lg">
          {/* Search inside dropdown */}
          <div className="p-2 border-b border-gray-100 dark:border-gray-700">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
              <input
                autoFocus
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search…"
                className="w-full pl-7 pr-3 py-1.5 text-sm rounded-md border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-primary-500"
                onClick={e => e.stopPropagation()}
              />
            </div>
          </div>

          {/* Options list */}
          <ul className="max-h-52 overflow-y-auto py-1">
            {filtered.length === 0 ? (
              <li className="px-4 py-2 text-sm text-gray-400 dark:text-gray-500">
                No results
              </li>
            ) : (
              filtered.map(cat => {
                const checked = selectedIds.includes(cat.id);
                return (
                  <li
                    key={cat.id}
                    onClick={() => toggle(cat.id)}
                    className={`flex items-center gap-2.5 px-3 py-2 text-sm cursor-pointer transition-colors ${
                      checked
                        ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300'
                        : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/40'
                    }`}
                  >
                    <span
                      className={`w-4 h-4 shrink-0 rounded border flex items-center justify-center transition-colors ${
                        checked
                          ? 'bg-primary-500 border-primary-500'
                          : 'border-gray-300 dark:border-gray-600'
                      }`}
                    >
                      {checked && (
                        <svg className="w-2.5 h-2.5 text-white" viewBox="0 0 10 8" fill="none">
                          <path d="M1 4l3 3 5-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      )}
                    </span>
                    {cat.title}
                  </li>
                );
              })
            )}
          </ul>

          {/* Footer: count + clear */}
          {selectedIds.length > 0 && (
            <div className="px-3 py-2 border-t border-gray-100 dark:border-gray-700 flex items-center justify-between">
              <span className="text-xs text-gray-400 dark:text-gray-500">
                {selectedIds.length} selected
              </span>
              <button
                type="button"
                onClick={e => { e.stopPropagation(); onChange([]); }}
                className="text-xs text-red-500 hover:text-red-700 dark:hover:text-red-400 transition-colors"
              >
                Clear all
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// ─── Main form ────────────────────────────────────────────────────────────────

export const CourseForm = ({ initialData, onSubmit, submitLabel, loading }: CourseFormProps) => {
  const { t } = useTranslation(['teaching']);

  const { data: categories = [] } = useQuery({
    queryKey: ['categories'],
    queryFn: categoriesApi.getCategories,
  });

  const difficultyOptions = [
    { value: '', label: 'Select difficulty' },
    { value: 'beginner', label: 'Beginner' },
    { value: 'intermediate', label: 'Intermediate' },
    { value: 'advanced', label: 'Advanced' },
  ];

  const viewModeOptions = [
    { value: 'mini-cards', label: 'Mini Cards' },
    { value: 'icons', label: 'Icons' },
    { value: 'list', label: 'List' },
    { value: 'accordion', label: 'Accordion' },
  ];

  const [formData, setFormData] = useState<CourseFormData>({
    title: '',
    description: '',
    categoryIds: [],
    difficulty: '',
    thumbnail: '',
    isPublic: true,
    curriculumViewMode: 'mini-cards',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (initialData) {
      setFormData({
        title: initialData.title || '',
        description: initialData.description || '',
        categoryIds: initialData.categories?.map(cc => cc.category.id) ?? [],
        difficulty: (initialData.difficulty || '') as CourseFormData['difficulty'],
        thumbnail: initialData.thumbnail || '',
        isPublic: initialData.isPublic ?? true,
        curriculumViewMode: initialData.curriculumViewMode || 'mini-cards',
      });
    }
  }, [initialData]);

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};
    if (!formData.title.trim()) {
      newErrors.title = t('title_required');
    } else if (formData.title.length < 3) {
      newErrors.title = t('title_min_length');
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    await onSubmit(formData);
  };

  const handleChange = (field: keyof CourseFormData, value: string | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors(prev => ({ ...prev, [field]: '' }));
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <Input
        label={t('course_title')}
        value={formData.title}
        onChange={e => handleChange('title', e.target.value)}
        placeholder={t('course_title_placeholder')}
        error={errors.title}
        required
      />

      <TextArea
        label={t('description')}
        value={formData.description}
        onChange={e => handleChange('description', e.target.value)}
        placeholder={t('course_description_placeholder')}
        rows={4}
      />

      <CategoryMultiSelect
        label={t('category')}
        allCategories={categories}
        selectedIds={formData.categoryIds}
        onChange={ids => setFormData(prev => ({ ...prev, categoryIds: ids }))}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Select
          label={t('difficulty_level')}
          value={formData.difficulty}
          onChange={e => handleChange('difficulty', e.target.value)}
          options={difficultyOptions}
        />

        <div>
          <div className="flex items-center gap-1.5 mb-1.5">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              {t('curriculum_view_mode')}
            </label>
            <InfoPopup text={t('curriculum_view_mode_help')} />
          </div>
          <Select
            value={formData.curriculumViewMode}
            onChange={e => handleChange('curriculumViewMode', e.target.value)}
            options={viewModeOptions}
          />
        </div>
      </div>

      <div>
        <div className="flex items-center gap-1.5 mb-1.5">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            {t('thumbnail_url')}
          </label>
          <InfoPopup text={t('thumbnail_help')} />
        </div>
        <Input
          value={formData.thumbnail}
          onChange={e => handleChange('thumbnail', e.target.value)}
          placeholder="https://example.com/image.jpg"
        />
      </div>

      <div className="flex items-center gap-3">
        <input
          type="checkbox"
          id="isPublic"
          checked={formData.isPublic}
          onChange={e => handleChange('isPublic', e.target.checked)}
          className="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
        />
        <label htmlFor="isPublic" className="text-sm text-gray-700">
          {t('make_public')}
        </label>
      </div>

      <div className="flex justify-end gap-3 pt-4 border-t">
        <Button type="submit" loading={loading}>
          {submitLabel}
        </Button>
      </div>
    </form>
  );
};
