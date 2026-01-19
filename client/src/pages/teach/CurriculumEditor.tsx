import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { ArrowLeft, Plus, Settings, Eye, EyeOff, Layers, FileEdit, ClipboardList, MessageCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { coursesApi } from '../../api/courses';
import { Card, CardBody, CardHeader } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { Loading } from '../../components/common/Loading';
import { Modal } from '../../components/common/Modal';
import { ConfirmDialog } from '../../components/common/ConfirmDialog';
import { EmptyState } from '../../components/common/EmptyState';
import { StatusBadge } from '../../components/common/StatusBadge';
import { Input, TextArea, Select } from '../../components/common/Input';
import { ModuleItem } from '../../components/teach/ModuleItem';
import { CourseModule, Lecture } from '../../types';

interface ModuleFormData {
  title: string;
  description: string;
  label: string;
}

interface LectureFormData {
  title: string;
  contentType: 'text' | 'video' | 'mixed';
  duration: number;
  isFree: boolean;
}

export const CurriculumEditor = () => {
  const { id } = useParams<{ id: string }>();
  const courseId = parseInt(id!, 10);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Modal states
  const [moduleModal, setModuleModal] = useState<{ isOpen: boolean; module?: CourseModule }>({
    isOpen: false,
  });
  const [lectureModal, setLectureModal] = useState<{
    isOpen: boolean;
    moduleId?: number;
    lecture?: Lecture;
  }>({ isOpen: false });
  const [deleteModuleConfirm, setDeleteModuleConfirm] = useState<CourseModule | null>(null);
  const [deleteLectureConfirm, setDeleteLectureConfirm] = useState<Lecture | null>(null);

  // Form states
  const [moduleForm, setModuleForm] = useState<ModuleFormData>({ title: '', description: '', label: '' });
  const [lectureForm, setLectureForm] = useState<LectureFormData>({
    title: '',
    contentType: 'text',
    duration: 0,
    isFree: false,
  });

  // Queries
  const { data: course, isLoading: courseLoading } = useQuery({
    queryKey: ['course', courseId],
    queryFn: () => coursesApi.getCourseById(courseId),
    enabled: !!courseId,
  });

  const { data: modules, isLoading: modulesLoading } = useQuery({
    queryKey: ['courseModules', courseId],
    queryFn: () => coursesApi.getModules(courseId),
    enabled: !!courseId,
  });

  // Mutations
  const createModuleMutation = useMutation({
    mutationFn: (data: ModuleFormData) => coursesApi.createModule(courseId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['courseModules', courseId] });
      queryClient.invalidateQueries({ queryKey: ['course', courseId] });
      toast.success('Module created');
      closeModuleModal();
    },
    onError: () => toast.error('Failed to create module'),
  });

  const updateModuleMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: ModuleFormData }) =>
      coursesApi.updateModule(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['courseModules', courseId] });
      toast.success('Module updated');
      closeModuleModal();
    },
    onError: () => toast.error('Failed to update module'),
  });

  const deleteModuleMutation = useMutation({
    mutationFn: (id: number) => coursesApi.deleteModule(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['courseModules', courseId] });
      queryClient.invalidateQueries({ queryKey: ['course', courseId] });
      toast.success('Module deleted');
      setDeleteModuleConfirm(null);
    },
    onError: () => toast.error('Failed to delete module'),
  });

  const reorderModulesMutation = useMutation({
    mutationFn: (moduleIds: number[]) => coursesApi.reorderModules(courseId, moduleIds),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['courseModules', courseId] });
    },
    onError: () => toast.error('Failed to reorder modules'),
  });

  const createLectureMutation = useMutation({
    mutationFn: ({ moduleId, data }: { moduleId: number; data: LectureFormData }) =>
      coursesApi.createLecture(moduleId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['courseModules', courseId] });
      toast.success('Lesson created');
      closeLectureModal();
    },
    onError: () => toast.error('Failed to create lesson'),
  });

  const updateLectureMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: LectureFormData }) =>
      coursesApi.updateLecture(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['courseModules', courseId] });
      toast.success('Lesson updated');
      closeLectureModal();
    },
    onError: () => toast.error('Failed to update lesson'),
  });

  const deleteLectureMutation = useMutation({
    mutationFn: (id: number) => coursesApi.deleteLecture(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['courseModules', courseId] });
      toast.success('Lesson deleted');
      setDeleteLectureConfirm(null);
    },
    onError: () => toast.error('Failed to delete lesson'),
  });

  const publishMutation = useMutation({
    mutationFn: () => coursesApi.publishCourse(courseId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['course', courseId] });
      queryClient.invalidateQueries({ queryKey: ['teachingCourses'] });
      toast.success('Course published');
    },
    onError: () => toast.error('Failed to publish course'),
  });

  const unpublishMutation = useMutation({
    mutationFn: () => coursesApi.unpublishCourse(courseId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['course', courseId] });
      queryClient.invalidateQueries({ queryKey: ['teachingCourses'] });
      toast.success('Course unpublished');
    },
    onError: () => toast.error('Failed to unpublish course'),
  });

  // Modal handlers
  const openAddModuleModal = () => {
    setModuleForm({ title: '', description: '', label: '' });
    setModuleModal({ isOpen: true });
  };

  const openEditModuleModal = (module: CourseModule) => {
    setModuleForm({ title: module.title, description: module.description || '', label: module.label || '' });
    setModuleModal({ isOpen: true, module });
  };

  const closeModuleModal = () => {
    setModuleModal({ isOpen: false });
    setModuleForm({ title: '', description: '', label: '' });
  };

  const openAddLectureModal = (module: CourseModule) => {
    setLectureForm({ title: '', contentType: 'text', duration: 0, isFree: false });
    setLectureModal({ isOpen: true, moduleId: module.id });
  };

  const openEditLectureModal = (lecture: Lecture) => {
    setLectureForm({
      title: lecture.title,
      contentType: lecture.contentType,
      duration: lecture.duration || 0,
      isFree: lecture.isFree,
    });
    setLectureModal({ isOpen: true, lecture });
  };

  const closeLectureModal = () => {
    setLectureModal({ isOpen: false });
    setLectureForm({ title: '', contentType: 'text', duration: 0, isFree: false });
  };

  // Form handlers
  const handleModuleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!moduleForm.title.trim()) {
      toast.error('Module title is required');
      return;
    }

    if (moduleModal.module) {
      updateModuleMutation.mutate({ id: moduleModal.module.id, data: moduleForm });
    } else {
      createModuleMutation.mutate(moduleForm);
    }
  };

  const handleLectureSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!lectureForm.title.trim()) {
      toast.error('Lesson title is required');
      return;
    }

    if (lectureModal.lecture) {
      updateLectureMutation.mutate({ id: lectureModal.lecture.id, data: lectureForm });
    } else if (lectureModal.moduleId) {
      createLectureMutation.mutate({ moduleId: lectureModal.moduleId, data: lectureForm });
    }
  };

  // Reorder handlers
  const handleMoveModuleUp = (module: CourseModule) => {
    if (!modules) return;
    const sorted = [...modules].sort((a, b) => a.orderIndex - b.orderIndex);
    const index = sorted.findIndex(m => m.id === module.id);
    if (index <= 0) return;

    const newOrder = [...sorted];
    [newOrder[index - 1], newOrder[index]] = [newOrder[index], newOrder[index - 1]];
    reorderModulesMutation.mutate(newOrder.map(m => m.id));
  };

  const handleMoveModuleDown = (module: CourseModule) => {
    if (!modules) return;
    const sorted = [...modules].sort((a, b) => a.orderIndex - b.orderIndex);
    const index = sorted.findIndex(m => m.id === module.id);
    if (index < 0 || index >= sorted.length - 1) return;

    const newOrder = [...sorted];
    [newOrder[index], newOrder[index + 1]] = [newOrder[index + 1], newOrder[index]];
    reorderModulesMutation.mutate(newOrder.map(m => m.id));
  };

  const handleMoveLectureUp = (lecture: Lecture, module: CourseModule) => {
    const lectures = module.lectures || [];
    const sorted = [...lectures].sort((a, b) => a.orderIndex - b.orderIndex);
    const index = sorted.findIndex(l => l.id === lecture.id);
    if (index <= 0) return;

    const newOrder = [...sorted];
    [newOrder[index - 1], newOrder[index]] = [newOrder[index], newOrder[index - 1]];
    coursesApi.reorderLectures(module.id, newOrder.map(l => l.id)).then(() => {
      queryClient.invalidateQueries({ queryKey: ['courseModules', courseId] });
    });
  };

  const handleMoveLectureDown = (lecture: Lecture, module: CourseModule) => {
    const lectures = module.lectures || [];
    const sorted = [...lectures].sort((a, b) => a.orderIndex - b.orderIndex);
    const index = sorted.findIndex(l => l.id === lecture.id);
    if (index < 0 || index >= sorted.length - 1) return;

    const newOrder = [...sorted];
    [newOrder[index], newOrder[index + 1]] = [newOrder[index + 1], newOrder[index]];
    coursesApi.reorderLectures(module.id, newOrder.map(l => l.id)).then(() => {
      queryClient.invalidateQueries({ queryKey: ['courseModules', courseId] });
    });
  };

  if (courseLoading || modulesLoading) {
    return <Loading fullScreen text="Loading curriculum..." />;
  }

  if (!course) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8 text-center">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Course Not Found</h1>
        <Button onClick={() => navigate('/teach')}>Back to Dashboard</Button>
      </div>
    );
  }

  const sortedModules = [...(modules || [])].sort((a, b) => a.orderIndex - b.orderIndex);

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-6">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate('/teach')}
          icon={<ArrowLeft className="w-4 h-4" />}
        >
          Back to Dashboard
        </Button>
      </div>

      {/* Course Header Card */}
      <Card className="mb-6">
        <CardBody className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h1 className="text-2xl font-bold text-gray-900">{course.title}</h1>
              <StatusBadge status={course.status} />
            </div>
            <p className="text-gray-600">{course.description || 'No description'}</p>
          </div>
          <div className="flex items-center gap-2">
            <Link to={`/teach/courses/${courseId}/assignments`}>
              <Button variant="ghost" size="sm" icon={<ClipboardList className="w-4 h-4" />}>
                Assignments
              </Button>
            </Link>
            <Link to={`/teach/courses/${courseId}/chatbot-logs`}>
              <Button variant="ghost" size="sm" icon={<MessageCircle className="w-4 h-4" />}>
                Chatbot Logs
              </Button>
            </Link>
            <Link to={`/teach/courses/${courseId}/edit`}>
              <Button variant="ghost" size="sm" icon={<Settings className="w-4 h-4" />}>
                Settings
              </Button>
            </Link>
            {course.status === 'published' ? (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => unpublishMutation.mutate()}
                loading={unpublishMutation.isPending}
                icon={<EyeOff className="w-4 h-4" />}
              >
                Unpublish
              </Button>
            ) : (
              <Button
                size="sm"
                onClick={() => publishMutation.mutate()}
                loading={publishMutation.isPending}
                icon={<Eye className="w-4 h-4" />}
              >
                Publish
              </Button>
            )}
          </div>
        </CardBody>
      </Card>

      {/* Curriculum Section */}
      <Card>
        <CardHeader className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Course Curriculum</h2>
            <p className="text-sm text-gray-500">
              Organize your content into modules and lessons
            </p>
          </div>
          <Button onClick={openAddModuleModal} size="sm" icon={<Plus className="w-4 h-4" />}>
            Add Module
          </Button>
        </CardHeader>
        <CardBody>
          {sortedModules.length > 0 ? (
            <div className="space-y-4">
              {sortedModules.map((module, index) => (
                <ModuleItem
                  key={module.id}
                  module={module}
                  courseId={courseId}
                  isFirst={index === 0}
                  isLast={index === sortedModules.length - 1}
                  onEdit={openEditModuleModal}
                  onDelete={setDeleteModuleConfirm}
                  onMoveUp={handleMoveModuleUp}
                  onMoveDown={handleMoveModuleDown}
                  onAddLecture={openAddLectureModal}
                  onEditLecture={openEditLectureModal}
                  onDeleteLecture={setDeleteLectureConfirm}
                  onMoveLectureUp={handleMoveLectureUp}
                  onMoveLectureDown={handleMoveLectureDown}
                />
              ))}
            </div>
          ) : (
            <EmptyState
              icon={Layers}
              title="No modules yet"
              description="Start building your course by adding the first module"
              action={{ label: 'Add Module', onClick: openAddModuleModal }}
            />
          )}
        </CardBody>
      </Card>

      {/* Module Modal */}
      <Modal
        isOpen={moduleModal.isOpen}
        onClose={closeModuleModal}
        title={moduleModal.module ? 'Edit Module' : 'Add Module'}
        size="md"
      >
        <form onSubmit={handleModuleSubmit} className="space-y-4">
          <Input
            label="Module Title"
            value={moduleForm.title}
            onChange={e => setModuleForm(f => ({ ...f, title: e.target.value }))}
            placeholder="e.g., Introduction to the Course"
            required
          />
          <Input
            label="Label (optional)"
            value={moduleForm.label}
            onChange={e => setModuleForm(f => ({ ...f, label: e.target.value }))}
            placeholder="e.g., Week 1 - Foundations"
            helpText="A short label displayed next to the module title"
          />
          <TextArea
            label="Description (optional)"
            value={moduleForm.description}
            onChange={e => setModuleForm(f => ({ ...f, description: e.target.value }))}
            placeholder="Brief description of what this module covers"
            rows={3}
          />
          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="secondary" onClick={closeModuleModal}>
              Cancel
            </Button>
            <Button
              type="submit"
              loading={createModuleMutation.isPending || updateModuleMutation.isPending}
            >
              {moduleModal.module ? 'Update' : 'Create'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Lesson Modal */}
      <Modal
        isOpen={lectureModal.isOpen}
        onClose={closeLectureModal}
        title={lectureModal.lecture ? 'Edit Lesson' : 'Add Lesson'}
        size="md"
      >
        <form onSubmit={handleLectureSubmit} className="space-y-4">
          <Input
            label="Lesson Title"
            value={lectureForm.title}
            onChange={e => setLectureForm(f => ({ ...f, title: e.target.value }))}
            placeholder="e.g., Getting Started"
            required
          />
          <Select
            label="Content Type"
            value={lectureForm.contentType}
            onChange={e =>
              setLectureForm(f => ({
                ...f,
                contentType: e.target.value as 'text' | 'video' | 'mixed',
              }))
            }
            options={[
              { value: 'text', label: 'Text / Article' },
              { value: 'video', label: 'Video' },
              { value: 'mixed', label: 'Mixed Content' },
            ]}
          />
          <Input
            label="Duration (minutes)"
            type="number"
            value={lectureForm.duration}
            onChange={e => setLectureForm(f => ({ ...f, duration: parseInt(e.target.value) || 0 }))}
            min={0}
          />
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="isFree"
              checked={lectureForm.isFree}
              onChange={e => setLectureForm(f => ({ ...f, isFree: e.target.checked }))}
              className="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
            />
            <label htmlFor="isFree" className="text-sm text-gray-700">
              Allow free preview
            </label>
          </div>

          {/* Edit Content Button - only for existing lessons */}
          {lectureModal.lecture && (
            <div className="border-t border-gray-200 pt-4 mt-4">
              <p className="text-sm text-gray-600 mb-3">
                Add text, files, or AI-generated content to this lesson:
              </p>
              <Link
                to={`/teach/courses/${courseId}/lectures/${lectureModal.lecture.id}`}
                className="btn btn-secondary w-full flex items-center justify-center gap-2"
              >
                <FileEdit className="w-4 h-4" />
                Edit Lesson Content
              </Link>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="secondary" onClick={closeLectureModal}>
              Cancel
            </Button>
            <Button
              type="submit"
              loading={createLectureMutation.isPending || updateLectureMutation.isPending}
            >
              {lectureModal.lecture ? 'Update' : 'Create'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Delete Module Confirmation */}
      <ConfirmDialog
        isOpen={!!deleteModuleConfirm}
        onClose={() => setDeleteModuleConfirm(null)}
        onConfirm={() => deleteModuleConfirm && deleteModuleMutation.mutate(deleteModuleConfirm.id)}
        title="Delete Module"
        message={`Are you sure you want to delete "${deleteModuleConfirm?.title}"? All lessons in this module will also be deleted.`}
        confirmText="Delete"
        loading={deleteModuleMutation.isPending}
      />

      {/* Delete Lesson Confirmation */}
      <ConfirmDialog
        isOpen={!!deleteLectureConfirm}
        onClose={() => setDeleteLectureConfirm(null)}
        onConfirm={() =>
          deleteLectureConfirm && deleteLectureMutation.mutate(deleteLectureConfirm.id)
        }
        title="Delete Lesson"
        message={`Are you sure you want to delete "${deleteLectureConfirm?.title}"?`}
        confirmText="Delete"
        loading={deleteLectureMutation.isPending}
      />
    </div>
  );
};
