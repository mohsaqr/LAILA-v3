import { useState, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { ChevronDown, X, Search, HelpCircle, ImageIcon, Trash2 } from 'lucide-react';
import { Input, TextArea } from '../common/Input';
import { Button } from '../common/Button';
import { Course, CurriculumViewMode, Category } from '../../types';
import { categoriesApi } from '../../api/categories';
import { uploadsApi } from '../../api/uploads';
import { resolveFileUrl } from '../../api/client';

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

// ─── Searchable single-select (matches CategoryMultiSelect style) ────────────

const SearchableSelect = ({
  label,
  options,
  value,
  onChange,
  placeholder = 'Select…',
  infoPopup,
}: {
  label?: string;
  options: { value: string; label: string }[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  infoPopup?: string;
}) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

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

  const selectedOption = options.find(o => o.value === value);
  const filtered = options.filter(o =>
    o.label.toLowerCase().includes(search.toLowerCase())
  );

  const handleSelect = (val: string) => {
    onChange(val);
    setOpen(false);
    setSearch('');
  };

  return (
    <div ref={containerRef} className="relative">
      {label && (
        <div className="flex items-center gap-1.5 mb-1.5">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            {label}
          </label>
          {infoPopup && <InfoPopup text={infoPopup} />}
        </div>
      )}

      <div
        onClick={() => setOpen(o => !o)}
        className={`min-h-[42px] w-full px-3 py-2 flex items-center gap-1.5 rounded-lg border cursor-pointer transition-colors bg-white dark:bg-gray-800 ${
          open
            ? 'border-primary-500 ring-2 ring-primary-500/20'
            : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'
        }`}
      >
        {selectedOption ? (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-300">
            {selectedOption.label}
            <button
              type="button"
              onClick={e => { e.stopPropagation(); onChange(''); }}
              className="hover:text-primary-900 dark:hover:text-primary-100"
            >
              <X className="w-3 h-3" />
            </button>
          </span>
        ) : (
          <span className="text-sm text-gray-400 dark:text-gray-500 flex-1">{placeholder}</span>
        )}
        <ChevronDown className={`w-4 h-4 text-gray-400 ml-auto shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </div>

      {open && (
        <div className="absolute z-50 mt-1 w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-lg">
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

          <ul className="max-h-52 overflow-y-auto py-1">
            {filtered.length === 0 ? (
              <li className="px-4 py-2 text-sm text-gray-400 dark:text-gray-500">No results</li>
            ) : (
              filtered.map(opt => {
                const checked = opt.value === value;
                return (
                  <li
                    key={opt.value}
                    onClick={() => handleSelect(opt.value)}
                    className={`flex items-center gap-2.5 px-3 py-2 text-sm cursor-pointer transition-colors ${
                      checked
                        ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300'
                        : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/40'
                    }`}
                  >
                    <span className={`w-4 h-4 shrink-0 rounded-full border flex items-center justify-center transition-colors ${checked ? 'bg-primary-500 border-primary-500' : 'border-gray-300 dark:border-gray-600'}`}>
                      {checked && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
                    </span>
                    {opt.label}
                  </li>
                );
              })
            )}
          </ul>
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
  const [thumbnailPreview, setThumbnailPreview] = useState<string>('');
  const [uploadingThumbnail, setUploadingThumbnail] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
      if (initialData.thumbnail) {
        setThumbnailPreview(resolveFileUrl(initialData.thumbnail));
      }
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

  const handleThumbnailUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const allowedTypes = ['image/png', 'image/jpeg'];
    if (!allowedTypes.includes(file.type)) {
      setErrors(prev => ({ ...prev, thumbnail: t('thumbnail_invalid_type') }));
      return;
    }
    if (file.size > 1 * 1024 * 1024) {
      setErrors(prev => ({ ...prev, thumbnail: t('thumbnail_too_large') }));
      return;
    }

    setUploadingThumbnail(true);
    setErrors(prev => ({ ...prev, thumbnail: '' }));
    try {
      const result = await uploadsApi.uploadThumbnail(file);
      setFormData(prev => ({ ...prev, thumbnail: result.url }));
      setThumbnailPreview(resolveFileUrl(result.url));
    } catch (err: any) {
      setErrors(prev => ({ ...prev, thumbnail: err.message || t('thumbnail_upload_failed') }));
    } finally {
      setUploadingThumbnail(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleRemoveThumbnail = () => {
    setFormData(prev => ({ ...prev, thumbnail: '' }));
    setThumbnailPreview('');
    if (fileInputRef.current) fileInputRef.current.value = '';
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
        <SearchableSelect
          label={t('difficulty_level')}
          options={difficultyOptions}
          value={formData.difficulty}
          onChange={val => handleChange('difficulty', val)}
          placeholder="Select difficulty…"
        />

        <SearchableSelect
          label={t('curriculum_view_mode')}
          options={viewModeOptions}
          value={formData.curriculumViewMode}
          onChange={val => handleChange('curriculumViewMode', val)}
          placeholder="Select view mode…"
          infoPopup={t('curriculum_view_mode_help')}
        />
      </div>

      <div>
        <div className="flex items-center gap-1.5 mb-1.5">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            {t('course_thumbnail')}
          </label>
          <InfoPopup text={t('thumbnail_help')} />
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept=".png,.jpg,.jpeg"
          onChange={handleThumbnailUpload}
          className="hidden"
        />
        {thumbnailPreview ? (
          <div className="relative w-full max-w-xs">
            <img
              src={thumbnailPreview}
              alt={t('course_thumbnail')}
              className="w-full h-40 object-cover rounded-lg border border-gray-200 dark:border-gray-700"
            />
            <button
              type="button"
              onClick={handleRemoveThumbnail}
              className="absolute top-2 right-2 p-1.5 rounded-full bg-red-500 text-white hover:bg-red-600 transition-colors shadow-sm"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploadingThumbnail}
            className="w-full max-w-xs h-40 flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600 hover:border-primary-400 dark:hover:border-primary-500 bg-gray-50 dark:bg-gray-800/50 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {uploadingThumbnail ? (
              <div className="w-6 h-6 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <ImageIcon className="w-8 h-8 text-gray-400 dark:text-gray-500" />
                <span className="text-sm text-gray-500 dark:text-gray-400">{t('thumbnail_upload')}</span>
                <span className="text-xs text-gray-400 dark:text-gray-500">{t('thumbnail_formats')}</span>
              </>
            )}
          </button>
        )}
        {errors.thumbnail && (
          <p className="mt-1.5 text-sm text-red-500">{errors.thumbnail}</p>
        )}
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
