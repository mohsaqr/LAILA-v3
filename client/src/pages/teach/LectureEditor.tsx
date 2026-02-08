import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
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
      toast.success('Lesson saved');
    },
    onError: () => toast.error('Failed to save lesson'),
  });

  const createSectionMutation = useMutation({
    mutationFn: (type: 'text' | 'file' | 'ai-generated' | 'chatbot' | 'assignment') =>
      coursesApi.createSection(lecId, { type }),
    onSuccess: (newSection) => {
      queryClient.invalidateQueries({ queryKey: ['lecture', lecId] });
      // Auto-expand the newly created section
      setExpandedSectionId(newSection.id);
      toast.success('Section added');
    },
    onError: () => toast.error('Failed to add section'),
  });

  const updateSectionMutation = useMutation({
    mutationFn: ({ sectionId, data }: { sectionId: number; data: UpdateSectionData }) =>
      coursesApi.updateSection(sectionId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lecture', lecId] });
    },
    onError: () => toast.error('Failed to update section'),
  });

  const deleteSectionMutation = useMutation({
    mutationFn: (sectionId: number) => coursesApi.deleteSection(sectionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lecture', lecId] });
      toast.success('Section deleted');
      setDeleteSectionConfirm(null);
    },
    onError: () => toast.error('Failed to delete section'),
  });

  const reorderSectionsMutation = useMutation({
    mutationFn: (sectionIds: number[]) => coursesApi.reorderSections(lecId, sectionIds),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lecture', lecId] });
    },
    onError: () => toast.error('Failed to reorder sections'),
  });

  const handleSave = () => {
    if (!formData.title.trim()) {
      toast.error('Title is required');
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
    return <Loading fullScreen text="Loading lesson..." />;
  }

  if (!lecture) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8 text-center">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Lesson Not Found</h1>
        <Button onClick={() => navigate(`/teach/courses/${courseId}/curriculum`)}>
          Back to Curriculum
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
            { label: 'Teaching', href: '/teach' },
            { label: course?.title || 'Course', href: `/courses/${courseId}` },
            { label: 'Curriculum', href: `/teach/courses/${courseId}/curriculum` },
            { label: lecture.title || 'Lesson' },
          ]}
        />
        <Button
          size="sm"
          onClick={handleSave}
          loading={updateLectureMutation.isPending}
          icon={<Save className="w-4 h-4" />}
        >
          Save
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Lesson Title */}
          <Card>
            <CardHeader>
              <h1 className="text-xl font-semibold text-gray-900">Edit Lesson</h1>
            </CardHeader>
            <CardBody>
              <Input
                label="Lesson Title"
                value={formData.title}
                onChange={e => handleChange('title', e.target.value)}
                placeholder="Enter lesson title"
                required
              />
            </CardBody>
          </Card>

          {/* Sections */}
          <Card>
            <CardHeader className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Sections</h2>
                <p className="text-sm text-gray-500">
                  Add and organize your lesson content
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
                  title="No sections yet"
                  description="Add your first section to start building this lesson"
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
              <h2 className="font-semibold text-gray-900">Settings</h2>
            </CardHeader>
            <CardBody className="space-y-4">
              <Select
                label="Content Type"
                value={formData.contentType}
                onChange={e =>
                  handleChange('contentType', e.target.value as 'text' | 'video' | 'mixed')
                }
                options={[
                  { value: 'text', label: 'Text / Article' },
                  { value: 'video', label: 'Video' },
                  { value: 'mixed', label: 'Mixed Content' },
                ]}
              />

              {(formData.contentType === 'video' || formData.contentType === 'mixed') && (
                <Input
                  label="Video URL"
                  value={formData.videoUrl}
                  onChange={e => handleChange('videoUrl', e.target.value)}
                  placeholder="https://youtube.com/watch?v=..."
                  helpText="YouTube, Vimeo, or direct video URL"
                />
              )}

              <Input
                label="Duration (minutes)"
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
                  Allow free preview
                </label>
              </div>
            </CardBody>
          </Card>

          {/* Section Guide */}
          <Card>
            <CardHeader>
              <h2 className="font-semibold text-gray-900">Section Types</h2>
            </CardHeader>
            <CardBody>
              <ul className="space-y-3 text-sm">
                <li className="flex items-start gap-3">
                  <span className="flex-shrink-0 w-6 h-6 bg-blue-100 text-blue-600 rounded flex items-center justify-center text-xs font-medium">
                    T
                  </span>
                  <div>
                    <span className="font-medium text-gray-900">Text</span>
                    <p className="text-gray-500">Write rich content with Markdown support</p>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <span className="flex-shrink-0 w-6 h-6 bg-green-100 text-green-600 rounded flex items-center justify-center text-xs font-medium">
                    F
                  </span>
                  <div>
                    <span className="font-medium text-gray-900">File</span>
                    <p className="text-gray-500">Upload PDFs, documents, images</p>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <span className="flex-shrink-0 w-6 h-6 bg-purple-100 text-purple-600 rounded flex items-center justify-center text-xs font-medium">
                    AI
                  </span>
                  <div>
                    <span className="font-medium text-gray-900">AI Generated</span>
                    <p className="text-gray-500">Generate content using AI assistance</p>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <span className="flex-shrink-0 w-6 h-6 bg-amber-100 text-amber-600 rounded flex items-center justify-center text-xs font-medium">
                    C
                  </span>
                  <div>
                    <span className="font-medium text-gray-900">Chatbot</span>
                    <p className="text-gray-500">Interactive AI assistant for students</p>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <span className="flex-shrink-0 w-6 h-6 bg-rose-100 text-rose-600 rounded flex items-center justify-center text-xs font-medium">
                    A
                  </span>
                  <div>
                    <span className="font-medium text-gray-900">Assignment</span>
                    <p className="text-gray-500">Embed a course assignment</p>
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
        title="Delete Section"
        message="Are you sure you want to delete this section? This action cannot be undone."
        confirmText="Delete"
        loading={deleteSectionMutation.isPending}
      />
    </div>
  );
};
