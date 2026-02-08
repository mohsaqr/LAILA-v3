import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Save, Layers } from 'lucide-react';
import toast from 'react-hot-toast';
import { coursesApi } from '../../api/courses';
import { Card, CardBody, CardHeader } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { Loading } from '../../components/common/Loading';
import { Breadcrumb } from '../../components/common/Breadcrumb';
import { Input, Select } from '../../components/common/Input';
import { EmptyState } from '../../components/common/EmptyState';
import { ConfirmDialog } from '../../components/common/ConfirmDialog';
import { SectionEditor, AddSectionToolbar } from '../../components/teach/SectionEditor';
import { UpdateSectionData } from '../../types';

export const LectureEditor = () => {
  const { t } = useTranslation(['teaching', 'common']);
  const { id, lectureId } = useParams<{ id: string; lectureId: string }>();
  const courseId = parseInt(id!, 10);
  const lecId = parseInt(lectureId!, 10);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();

  // Track if we've already processed the addSection param
  const addSectionProcessed = useRef(false);

  const [formData, setFormData] = useState({
    title: '',
    contentType: 'text' as 'text' | 'video' | 'mixed',
    videoUrl: '',
    duration: 0,
    isFree: false,
  });
  const [deleteSectionConfirm, setDeleteSectionConfirm] = useState<number | null>(null);
  const [expandedSectionId, setExpandedSectionId] = useState<number | null>(null);

  // Query for lecture data
  const { data: lecture, isLoading } = useQuery({
    queryKey: ['lecture', lecId],
    queryFn: () => coursesApi.getLectureById(lecId),
    enabled: !!lecId,
  });

  // Query for course data (for context)
  const { data: course } = useQuery({
    queryKey: ['course', courseId],
    queryFn: () => coursesApi.getCourseById(courseId),
    enabled: !!courseId,
  });

  useEffect(() => {
    if (lecture) {
      setFormData({
        title: lecture.title || '',
        contentType: lecture.contentType || 'text',
        videoUrl: lecture.videoUrl || '',
        duration: lecture.duration || 0,
        isFree: lecture.isFree || false,
      });
    }
  }, [lecture]);

  // Mutations
  const updateLectureMutation = useMutation({
    mutationFn: (data: typeof formData) => coursesApi.updateLecture(lecId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lecture', lecId] });
      queryClient.invalidateQueries({ queryKey: ['courseModules', courseId] });
      toast.success(t('lesson_saved'));
    },
    onError: () => toast.error(t('failed_to_save_lesson_msg')),
  });

  const createSectionMutation = useMutation({
    mutationFn: (type: 'text' | 'file' | 'ai-generated' | 'chatbot' | 'assignment') =>
      coursesApi.createSection(lecId, { type }),
    onSuccess: (newSection) => {
      queryClient.invalidateQueries({ queryKey: ['lecture', lecId] });
      // Auto-expand the newly created section
      setExpandedSectionId(newSection.id);
      toast.success(t('section_added'));
    },
    onError: () => toast.error(t('failed_to_add_section')),
  });

  const updateSectionMutation = useMutation({
    mutationFn: ({ sectionId, data }: { sectionId: number; data: UpdateSectionData }) =>
      coursesApi.updateSection(sectionId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lecture', lecId] });
    },
    onError: () => toast.error(t('failed_to_save_section')),
  });

  const deleteSectionMutation = useMutation({
    mutationFn: (sectionId: number) => coursesApi.deleteSection(sectionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lecture', lecId] });
      toast.success(t('section_deleted'));
      setDeleteSectionConfirm(null);
    },
    onError: () => toast.error(t('failed_to_delete_section')),
  });

  const reorderSectionsMutation = useMutation({
    mutationFn: (sectionIds: number[]) => coursesApi.reorderSections(lecId, sectionIds),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lecture', lecId] });
    },
    onError: () => toast.error(t('failed_to_reorder_sections')),
  });

  const handleSave = () => {
    if (!formData.title.trim()) {
      toast.error(t('title_required_msg'));
      return;
    }
    updateLectureMutation.mutate(formData);
  };

  const handleChange = (field: keyof typeof formData, value: string | number | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleAddSection = (type: 'text' | 'file' | 'ai-generated' | 'chatbot' | 'assignment') => {
    createSectionMutation.mutate(type);
  };

  // Auto-add section from URL param (e.g., ?addSection=text)
  useEffect(() => {
    const addSectionType = searchParams.get('addSection') as 'text' | 'file' | 'ai-generated' | 'chatbot' | 'assignment' | null;

    if (addSectionType && lecture && !addSectionProcessed.current && !createSectionMutation.isPending) {
      addSectionProcessed.current = true;
      // Clear the param from URL
      searchParams.delete('addSection');
      setSearchParams(searchParams, { replace: true });
      // Add the section
      createSectionMutation.mutate(addSectionType);
    }
  }, [searchParams, lecture, createSectionMutation.isPending, setSearchParams]);

  const handleUpdateSection = (sectionId: number, data: UpdateSectionData) => {
    updateSectionMutation.mutate({ sectionId, data });
  };

  const handleDeleteSection = (sectionId: number) => {
    setDeleteSectionConfirm(sectionId);
  };

  const handleMoveSection = (sectionId: number, direction: 'up' | 'down') => {
    if (!lecture?.sections) return;

    const sections = [...lecture.sections].sort((a, b) => a.order - b.order);
    const currentIndex = sections.findIndex(s => s.id === sectionId);

    if (direction === 'up' && currentIndex > 0) {
      const newOrder = [...sections];
      [newOrder[currentIndex - 1], newOrder[currentIndex]] = [
        newOrder[currentIndex],
        newOrder[currentIndex - 1],
      ];
      reorderSectionsMutation.mutate(newOrder.map(s => s.id));
    } else if (direction === 'down' && currentIndex < sections.length - 1) {
      const newOrder = [...sections];
      [newOrder[currentIndex], newOrder[currentIndex + 1]] = [
        newOrder[currentIndex + 1],
        newOrder[currentIndex],
      ];
      reorderSectionsMutation.mutate(newOrder.map(s => s.id));
    }
  };

  if (isLoading) {
    return <Loading fullScreen text={t('loading_lesson')} />;
  }

  if (!lecture) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8 text-center">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">{t('lesson_not_found')}</h1>
        <Button onClick={() => navigate(`/teach/courses/${courseId}/curriculum`)}>
          {t('back_to_curriculum')}
        </Button>
      </div>
    );
  }

  const sections = lecture.sections
    ? [...lecture.sections].sort((a, b) => a.order - b.order)
    : [];

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header with Breadcrumb */}
      <div className="flex items-center justify-between mb-6">
        <Breadcrumb
          items={[
            { label: t('teaching'), href: '/teach' },
            { label: course?.title || t('course'), href: `/courses/${courseId}` },
            { label: t('curriculum_editor'), href: `/teach/courses/${courseId}/curriculum` },
            { label: lecture.title || t('lesson_title') },
          ]}
        />
        <Button
          size="sm"
          onClick={handleSave}
          loading={updateLectureMutation.isPending}
          icon={<Save className="w-4 h-4" />}
        >
          {t('save')}
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Lesson Title */}
          <Card>
            <CardHeader>
              <h1 className="text-xl font-semibold text-gray-900">{t('edit_lesson')}</h1>
            </CardHeader>
            <CardBody>
              <Input
                label={t('lesson_title')}
                value={formData.title}
                onChange={e => handleChange('title', e.target.value)}
                placeholder={t('enter_lesson_title')}
                required
              />
            </CardBody>
          </Card>

          {/* Sections */}
          <Card>
            <CardHeader className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">{t('sections')}</h2>
                <p className="text-sm text-gray-500">
                  {t('add_organize_content')}
                </p>
              </div>
            </CardHeader>
            <CardBody>
              {sections.length > 0 ? (
                <div className="space-y-2">
                  {sections.map((section, index) => (
                    <SectionEditor
                      key={section.id}
                      section={section}
                      index={index}
                      totalSections={sections.length}
                      onUpdate={handleUpdateSection}
                      onDelete={handleDeleteSection}
                      onMoveUp={(id) => handleMoveSection(id, 'up')}
                      onMoveDown={(id) => handleMoveSection(id, 'down')}
                      lectureTitle={formData.title}
                      courseTitle={course?.title}
                      courseId={courseId}
                      isExpanded={expandedSectionId === section.id}
                      onToggleExpand={(id) => setExpandedSectionId(expandedSectionId === id ? null : id)}
                    />
                  ))}
                </div>
              ) : (
                <EmptyState
                  icon={Layers}
                  title={t('no_sections_yet')}
                  description={t('add_first_section_desc')}
                />
              )}

              <AddSectionToolbar onAddSection={handleAddSection} />
            </CardBody>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Settings */}
          <Card>
            <CardHeader>
              <h2 className="font-semibold text-gray-900">{t('lesson_settings')}</h2>
            </CardHeader>
            <CardBody className="space-y-4">
              <Select
                label={t('content_type_label')}
                value={formData.contentType}
                onChange={e =>
                  handleChange('contentType', e.target.value as 'text' | 'video' | 'mixed')
                }
                options={[
                  { value: 'text', label: t('text_article') },
                  { value: 'video', label: t('video') },
                  { value: 'mixed', label: t('mixed_content') },
                ]}
              />

              {(formData.contentType === 'video' || formData.contentType === 'mixed') && (
                <Input
                  label={t('video_url')}
                  value={formData.videoUrl}
                  onChange={e => handleChange('videoUrl', e.target.value)}
                  placeholder="https://youtube.com/watch?v=..."
                  helpText={t('video_url_help')}
                />
              )}

              <Input
                label={t('duration_minutes')}
                type="number"
                value={formData.duration}
                onChange={e => handleChange('duration', parseInt(e.target.value) || 0)}
                min={0}
              />

              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="isFree"
                  checked={formData.isFree}
                  onChange={e => handleChange('isFree', e.target.checked)}
                  className="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                />
                <label htmlFor="isFree" className="text-sm text-gray-700">
                  {t('allow_free_preview')}
                </label>
              </div>
            </CardBody>
          </Card>

          {/* Section Guide */}
          <Card>
            <CardHeader>
              <h2 className="font-semibold text-gray-900">{t('section_types_guide')}</h2>
            </CardHeader>
            <CardBody>
              <ul className="space-y-3 text-sm">
                <li className="flex items-start gap-3">
                  <span className="flex-shrink-0 w-6 h-6 bg-blue-100 text-blue-600 rounded flex items-center justify-center text-xs font-medium">
                    T
                  </span>
                  <div>
                    <span className="font-medium text-gray-900">{t('text_section_guide')}</span>
                    <p className="text-gray-500">{t('text_section_desc')}</p>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <span className="flex-shrink-0 w-6 h-6 bg-green-100 text-green-600 rounded flex items-center justify-center text-xs font-medium">
                    F
                  </span>
                  <div>
                    <span className="font-medium text-gray-900">{t('file_section_guide')}</span>
                    <p className="text-gray-500">{t('file_section_desc')}</p>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <span className="flex-shrink-0 w-6 h-6 bg-purple-100 text-purple-600 rounded flex items-center justify-center text-xs font-medium">
                    AI
                  </span>
                  <div>
                    <span className="font-medium text-gray-900">{t('ai_generated_guide')}</span>
                    <p className="text-gray-500">{t('ai_generated_desc')}</p>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <span className="flex-shrink-0 w-6 h-6 bg-amber-100 text-amber-600 rounded flex items-center justify-center text-xs font-medium">
                    C
                  </span>
                  <div>
                    <span className="font-medium text-gray-900">{t('chatbot_guide')}</span>
                    <p className="text-gray-500">{t('chatbot_desc')}</p>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <span className="flex-shrink-0 w-6 h-6 bg-rose-100 text-rose-600 rounded flex items-center justify-center text-xs font-medium">
                    A
                  </span>
                  <div>
                    <span className="font-medium text-gray-900">{t('assignment_guide')}</span>
                    <p className="text-gray-500">{t('assignment_desc')}</p>
                  </div>
                </li>
              </ul>
            </CardBody>
          </Card>
        </div>
      </div>

      {/* Delete Section Confirmation */}
      <ConfirmDialog
        isOpen={deleteSectionConfirm !== null}
        onClose={() => setDeleteSectionConfirm(null)}
        onConfirm={() => deleteSectionConfirm && deleteSectionMutation.mutate(deleteSectionConfirm)}
        title={t('delete_section')}
        message={t('delete_section_confirm')}
        confirmText={t('common:delete')}
        loading={deleteSectionMutation.isPending}
      />
    </div>
  );
};
