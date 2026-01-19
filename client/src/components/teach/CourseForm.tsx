import { useState, useEffect } from 'react';
import { Input, TextArea, Select } from '../common/Input';
import { Button } from '../common/Button';
import { Course } from '../../types';

export interface CourseFormData {
  title: string;
  description: string;
  category: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced' | '';
  thumbnail: string;
  isPublic: boolean;
}

interface CourseFormProps {
  initialData?: Partial<Course>;
  onSubmit: (data: CourseFormData) => Promise<void>;
  submitLabel: string;
  loading?: boolean;
}

const categoryOptions = [
  { value: '', label: 'Select category' },
  { value: 'programming', label: 'Programming' },
  { value: 'data-science', label: 'Data Science' },
  { value: 'design', label: 'Design' },
  { value: 'business', label: 'Business' },
  { value: 'marketing', label: 'Marketing' },
  { value: 'language', label: 'Language' },
  { value: 'education', label: 'Education' },
  { value: 'other', label: 'Other' },
];

const difficultyOptions = [
  { value: '', label: 'Select difficulty' },
  { value: 'beginner', label: 'Beginner' },
  { value: 'intermediate', label: 'Intermediate' },
  { value: 'advanced', label: 'Advanced' },
];

export const CourseForm = ({ initialData, onSubmit, submitLabel, loading }: CourseFormProps) => {
  const [formData, setFormData] = useState<CourseFormData>({
    title: '',
    description: '',
    category: '',
    difficulty: '' as CourseFormData['difficulty'],
    thumbnail: '',
    isPublic: true,
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
      });
    }
  }, [initialData]);

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.title.trim()) {
      newErrors.title = 'Title is required';
    } else if (formData.title.length < 3) {
      newErrors.title = 'Title must be at least 3 characters';
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
        label="Course Title"
        value={formData.title}
        onChange={e => handleChange('title', e.target.value)}
        placeholder="e.g., Introduction to Machine Learning"
        error={errors.title}
        required
      />

      <TextArea
        label="Description"
        value={formData.description}
        onChange={e => handleChange('description', e.target.value)}
        placeholder="Describe what students will learn in this course..."
        rows={4}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Select
          label="Category"
          value={formData.category}
          onChange={e => handleChange('category', e.target.value)}
          options={categoryOptions}
        />

        <Select
          label="Difficulty Level"
          value={formData.difficulty}
          onChange={e => handleChange('difficulty', e.target.value)}
          options={difficultyOptions}
        />
      </div>

      <Input
        label="Thumbnail URL"
        value={formData.thumbnail}
        onChange={e => handleChange('thumbnail', e.target.value)}
        placeholder="https://example.com/image.jpg"
        helpText="Enter a URL for the course thumbnail image"
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
          Make this course publicly visible in the catalog
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
