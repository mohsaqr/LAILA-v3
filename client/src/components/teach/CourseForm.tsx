import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Input, TextArea, Select } from '../common/Input';
import { Button } from '../common/Button';
import { Course, CurriculumViewMode } from '../../types';

export interface CourseFormData {
  title: string;
  description: string;
  category: string;
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

export const CourseForm = ({ initialData, onSubmit, submitLabel, loading }: CourseFormProps) => {
  const { t } = useTranslation(['teaching']);

  const categoryOptions = [
    { value: '', label: t('select_category') },
    { value: 'programming', label: t('category_programming') },
    { value: 'data-science', label: t('category_data_science') },
    { value: 'design', label: t('category_design') },
    { value: 'business', label: t('category_business') },
    { value: 'marketing', label: t('category_marketing') },
    { value: 'language', label: t('category_language') },
    { value: 'education', label: t('category_education') },
    { value: 'other', label: t('category_other') },
  ];

  const difficultyOptions = [
    { value: '', label: t('select_difficulty') },
    { value: 'beginner', label: t('difficulty_beginner') },
    { value: 'intermediate', label: t('difficulty_intermediate') },
    { value: 'advanced', label: t('difficulty_advanced') },
  ];

  const viewModeOptions = [
    { value: 'mini-cards', label: t('view_mode_mini_cards') },
    { value: 'icons', label: t('view_mode_icons') },
    { value: 'list', label: t('view_mode_list') },
    { value: 'accordion', label: t('view_mode_accordion') },
  ];
  const [formData, setFormData] = useState<CourseFormData>({
    title: '',
    description: '',
    category: '',
    difficulty: '' as CourseFormData['difficulty'],
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
        category: initialData.category || '',
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
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
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

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Select
          label={t('category')}
          value={formData.category}
          onChange={e => handleChange('category', e.target.value)}
          options={categoryOptions}
        />

        <Select
          label={t('difficulty_level')}
          value={formData.difficulty}
          onChange={e => handleChange('difficulty', e.target.value)}
          options={difficultyOptions}
        />
      </div>

      <Input
        label={t('thumbnail_url')}
        value={formData.thumbnail}
        onChange={e => handleChange('thumbnail', e.target.value)}
        placeholder="https://example.com/image.jpg"
        helpText={t('thumbnail_help')}
      />

      <Select
        label={t('curriculum_view_mode')}
        value={formData.curriculumViewMode}
        onChange={e => handleChange('curriculumViewMode', e.target.value)}
        options={viewModeOptions}
        helpText={t('curriculum_view_mode_help')}
      />

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
