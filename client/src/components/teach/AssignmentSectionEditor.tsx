import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ClipboardList, Calendar, Award, AlertCircle, Plus, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { LectureSection, UpdateSectionData, CourseModule } from '../../types';
import { coursesApi } from '../../api/courses';
import { assignmentsApi } from '../../api/assignments';
import { Select, Input, TextArea } from '../common/Input';
import { Button } from '../common/Button';
import { Loading } from '../common/Loading';

interface AssignmentSectionEditorProps {
  section: LectureSection;
  courseId: number;
  onChange: (data: UpdateSectionData) => void;
  readOnly?: boolean;
}

interface AssignmentFormData {
  title: string;
  description: string;
  instructions: string;
  moduleId: number | null;
  submissionType: 'text' | 'file' | 'mixed';
  dueDate: string;
  points: number;
  isPublished: boolean;
}

const initialFormData: AssignmentFormData = {
  title: '',
  description: '',
  instructions: '',
  moduleId: null,
  submissionType: 'text',
  dueDate: '',
  points: 100,
  isPublished: false,
};

export const AssignmentSectionEditor = ({
  section,
  courseId,
  onChange,
  readOnly = false,
}: AssignmentSectionEditorProps) => {
  const { t } = useTranslation(['teaching']);
  const queryClient = useQueryClient();
  const [selectedAssignmentId, setSelectedAssignmentId] = useState<number | null>(
    section.assignmentId || null
  );
  const [showDeadline, setShowDeadline] = useState(section.showDeadline ?? true);
  const [showPoints, setShowPoints] = useState(section.showPoints ?? true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [formData, setFormData] = useState<AssignmentFormData>(initialFormData);

  // Fetch available assignments for the course
  const { data: assignments, isLoading } = useQuery({
    queryKey: ['courseAssignments', courseId],
    queryFn: () => coursesApi.getAssignmentsForSection(courseId),
    enabled: !readOnly && !!courseId,
  });

  // Fetch course modules for assignment builder
  const { data: modules } = useQuery({
    queryKey: ['courseModules', courseId],
    queryFn: () => coursesApi.getModules(courseId),
    enabled: !readOnly && !!courseId && showCreateModal,
  });

  // Create assignment mutation
  const createMutation = useMutation({
    mutationFn: (data: AssignmentFormData) =>
      assignmentsApi.createAssignment(courseId, {
        ...data,
        dueDate: data.dueDate ? new Date(data.dueDate).toISOString() : null,
      }),
    onSuccess: (newAssignment) => {
      queryClient.invalidateQueries({ queryKey: ['courseAssignments', courseId] });
      toast.success(t('assignment_created'));
      // Auto-select the newly created assignment
      setSelectedAssignmentId(newAssignment.id);
      onChange({ assignmentId: newAssignment.id });
      closeModal();
    },
    onError: () => toast.error(t('failed_to_create_assignment')),
  });

  // Sync with external changes
  useEffect(() => {
    setSelectedAssignmentId(section.assignmentId || null);
    setShowDeadline(section.showDeadline ?? true);
    setShowPoints(section.showPoints ?? true);
  }, [section]);

  const handleAssignmentChange = (assignmentId: number | null) => {
    setSelectedAssignmentId(assignmentId);
    onChange({ assignmentId: assignmentId || undefined });
  };

  const handleShowDeadlineChange = (checked: boolean) => {
    setShowDeadline(checked);
    onChange({ showDeadline: checked });
  };

  const handleShowPointsChange = (checked: boolean) => {
    setShowPoints(checked);
    onChange({ showPoints: checked });
  };

  const openCreateModal = () => {
    setFormData(initialFormData);
    setShowCreateModal(true);
  };

  const closeModal = () => {
    setShowCreateModal(false);
    setFormData(initialFormData);
  };

  const handleFormChange = (field: keyof AssignmentFormData, value: string | number | boolean | null) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title.trim()) {
      toast.error(t('title_required'));
      return;
    }
    createMutation.mutate(formData);
  };

  const selectedAssignment = section.assignment ||
    assignments?.find(a => a.id === selectedAssignmentId);

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return null;
    return new Date(dateStr).toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (readOnly) {
    if (!selectedAssignment) {
      return (
        <div className="text-center py-6 text-gray-500">
          <ClipboardList className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p>{t('no_assignment_selected')}</p>
        </div>
      );
    }

    return (
      <div className="bg-gray-50 rounded-lg p-4">
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-lg bg-rose-100 flex items-center justify-center flex-shrink-0">
            <ClipboardList className="w-5 h-5 text-rose-600" />
          </div>
          <div className="flex-1">
            <h4 className="font-medium text-gray-900">{selectedAssignment.title}</h4>
            {selectedAssignment.description && (
              <p className="text-sm text-gray-600 mt-1">{selectedAssignment.description}</p>
            )}
            <div className="flex items-center gap-4 mt-2 text-sm text-gray-500">
              {showDeadline && selectedAssignment.dueDate && (
                <span className="flex items-center gap-1">
                  <Calendar className="w-4 h-4" />
                  {formatDate(selectedAssignment.dueDate)}
                </span>
              )}
              {showPoints && (
                <span className="flex items-center gap-1">
                  <Award className="w-4 h-4" />
                  {selectedAssignment.points} {t('points')}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return <Loading text={t('loading_assignments')} />;
  }

  const assignmentOptions = [
    { value: '', label: t('select_an_assignment') },
    ...(assignments || []).map(a => ({
      value: a.id.toString(),
      label: a.module ? `${a.title} (${a.module.title})` : a.title,
    })),
  ];

  return (
    <div className="space-y-4">
      {/* Assignment Selector with Create Button */}
      <div className="flex items-end gap-3">
        <div className="flex-1">
          <Select
            label={t('assignment')}
            value={selectedAssignmentId?.toString() || ''}
            onChange={e => handleAssignmentChange(e.target.value ? parseInt(e.target.value) : null)}
            options={assignmentOptions}
            helpText={t('select_assignment_help')}
          />
        </div>
        <Button
          type="button"
          variant="secondary"
          onClick={openCreateModal}
          icon={<Plus className="w-4 h-4" />}
          className="mb-6"
        >
          {t('create_new')}
        </Button>
      </div>

      {/* Display Options */}
      {selectedAssignmentId && (
        <>
          <div className="flex items-center gap-6">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={showDeadline}
                onChange={e => handleShowDeadlineChange(e.target.checked)}
                className="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
              />
              <span className="text-sm text-gray-700">{t('show_deadline')}</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={showPoints}
                onChange={e => handleShowPointsChange(e.target.checked)}
                className="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
              />
              <span className="text-sm text-gray-700">{t('show_points')}</span>
            </label>
          </div>

          {/* Preview */}
          <div className="border border-dashed border-gray-300 rounded-lg p-4 bg-gray-50">
            <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">{t('student_preview')}</p>
            {selectedAssignment ? (
              <div className="bg-white rounded-lg p-4 shadow-sm">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-lg bg-rose-100 flex items-center justify-center flex-shrink-0">
                    <ClipboardList className="w-5 h-5 text-rose-600" />
                  </div>
                  <div className="flex-1">
                    <h4 className="font-medium text-gray-900">{selectedAssignment.title}</h4>
                    {selectedAssignment.description && (
                      <p className="text-sm text-gray-600 mt-1">{selectedAssignment.description}</p>
                    )}
                    <div className="flex items-center gap-4 mt-2 text-sm text-gray-500">
                      {showDeadline && selectedAssignment.dueDate && (
                        <span className="flex items-center gap-1">
                          <Calendar className="w-4 h-4" />
                          {formatDate(selectedAssignment.dueDate)}
                        </span>
                      )}
                      {showPoints && (
                        <span className="flex items-center gap-1">
                          <Award className="w-4 h-4" />
                          {selectedAssignment.points} {t('points')}
                        </span>
                      )}
                    </div>
                    <button className="mt-3 px-4 py-2 text-sm font-medium text-white bg-rose-600 rounded-lg hover:bg-rose-700 transition-colors">
                      {t('view_assignment')}
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-4 text-gray-500">
                <AlertCircle className="w-6 h-6 mx-auto mb-1" />
                <p className="text-sm">{t('assignment_not_found')}</p>
              </div>
            )}
          </div>
        </>
      )}

      {/* No assignments message */}
      {!isLoading && (!assignments || assignments.length === 0) && !selectedAssignmentId && (
        <div className="text-center py-6 bg-gray-50 rounded-lg">
          <AlertCircle className="w-8 h-8 mx-auto mb-2 text-gray-400" />
          <p className="text-gray-600">{t('no_assignments_in_course')}</p>
          <p className="text-sm text-gray-500 mt-1 mb-3">
            {t('create_assignment_to_embed')}
          </p>
          <Button
            type="button"
            variant="primary"
            onClick={openCreateModal}
            icon={<Plus className="w-4 h-4" />}
          >
            {t('create_assignment')}
          </Button>
        </div>
      )}

      {/* Create Assignment Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h3 className="text-lg font-semibold text-gray-900">{t('create_assignment')}</h3>
              <button
                onClick={closeModal}
                className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <Input
                label={t('title')}
                value={formData.title}
                onChange={e => handleFormChange('title', e.target.value)}
                placeholder={t('assignment_title_placeholder')}
                required
              />

              <TextArea
                label={t('description')}
                value={formData.description}
                onChange={e => handleFormChange('description', e.target.value)}
                placeholder={t('assignment_description_placeholder')}
                rows={2}
              />

              <TextArea
                label={t('instructions')}
                value={formData.instructions}
                onChange={e => handleFormChange('instructions', e.target.value)}
                placeholder={t('assignment_instructions_placeholder')}
                rows={4}
              />

              <div className="grid grid-cols-2 gap-4">
                <Select
                  label={t('module_optional')}
                  value={formData.moduleId?.toString() || ''}
                  onChange={e =>
                    handleFormChange('moduleId', e.target.value ? parseInt(e.target.value) : null)
                  }
                  options={[
                    { value: '', label: t('no_specific_module') },
                    ...(modules || []).map((m: CourseModule) => ({
                      value: m.id.toString(),
                      label: m.title,
                    })),
                  ]}
                />

                <Select
                  label={t('submission_type')}
                  value={formData.submissionType}
                  onChange={e =>
                    handleFormChange('submissionType', e.target.value as 'text' | 'file' | 'mixed')
                  }
                  options={[
                    { value: 'text', label: t('text_entry') },
                    { value: 'file', label: t('file_upload') },
                    { value: 'mixed', label: t('text_and_file') },
                  ]}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <Input
                  label={t('due_date')}
                  type="datetime-local"
                  value={formData.dueDate}
                  onChange={e => handleFormChange('dueDate', e.target.value)}
                />

                <Input
                  label={t('points')}
                  type="number"
                  value={formData.points}
                  onChange={e => handleFormChange('points', parseInt(e.target.value) || 0)}
                  min={0}
                />
              </div>

              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="isPublished"
                  checked={formData.isPublished}
                  onChange={e => handleFormChange('isPublished', e.target.checked)}
                  className="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                />
                <label htmlFor="isPublished" className="text-sm text-gray-700">
                  {t('publish_immediately')}
                </label>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t">
                <Button type="button" variant="secondary" onClick={closeModal}>
                  {t('cancel')}
                </Button>
                <Button type="submit" loading={createMutation.isPending}>
                  {t('create_and_select')}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
