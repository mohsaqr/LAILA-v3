import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ClipboardList, Calendar, Award, AlertCircle, Link as LinkIcon, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { LectureSection, UpdateSectionData } from '../../types';
import { coursesApi } from '../../api/courses';
import { assignmentsApi } from '../../api/assignments';
import { Select, Input, TextArea } from '../common/Input';
import { Button } from '../common/Button';
import { Loading } from '../common/Loading';

interface AssignmentSectionEditorProps {
  section: LectureSection;
  courseId: number;
  lectureId?: number;
  moduleId?: number;
  onChange: (data: UpdateSectionData) => void;
  readOnly?: boolean;
}

interface AssignmentFormData {
  title: string;
  description: string;
  instructions: string;
  submissionType: 'text' | 'file' | 'mixed';
  dueDate: string;
  points: number;
  isPublished: boolean;
}

const initialFormData: AssignmentFormData = {
  title: '',
  description: '',
  instructions: '',
  submissionType: 'text',
  dueDate: '',
  points: 100,
  isPublished: false,
};

export const AssignmentSectionEditor = ({
  section,
  courseId,
  lectureId,
  moduleId,
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
  const [showSelectExisting, setShowSelectExisting] = useState(false);
  const [formData, setFormData] = useState<AssignmentFormData>(initialFormData);

  // Only fetch existing assignments when the "link existing" panel is open
  const { data: assignments, isLoading: assignmentsLoading } = useQuery({
    queryKey: ['courseAssignments', courseId],
    queryFn: () => coursesApi.getAssignmentsForSection(courseId),
    enabled: !readOnly && !!courseId && showSelectExisting,
  });

  const createMutation = useMutation({
    mutationFn: (data: AssignmentFormData) =>
      assignmentsApi.createAssignment(courseId, {
        ...data,
        moduleId: moduleId ?? null,
        lectureId: lectureId ?? null,
        dueDate: data.dueDate ? new Date(data.dueDate).toISOString() : null,
      }),
    onSuccess: (newAssignment) => {
      queryClient.invalidateQueries({ queryKey: ['courseAssignments', courseId] });
      toast.success(t('assignment_created'));
      setSelectedAssignmentId(newAssignment.id);
      onChange({ assignmentId: newAssignment.id });
    },
    onError: () => toast.error(t('failed_to_create_assignment')),
  });

  useEffect(() => {
    setSelectedAssignmentId(section.assignmentId || null);
    setShowDeadline(section.showDeadline ?? true);
    setShowPoints(section.showPoints ?? true);
  }, [section]);

  const handleAssignmentChange = (assignmentId: number | null) => {
    setSelectedAssignmentId(assignmentId);
    onChange({ assignmentId: assignmentId || undefined });
    if (assignmentId) setShowSelectExisting(false);
  };

  const handleShowDeadlineChange = (checked: boolean) => {
    setShowDeadline(checked);
    onChange({ showDeadline: checked });
  };

  const handleShowPointsChange = (checked: boolean) => {
    setShowPoints(checked);
    onChange({ showPoints: checked });
  };

  const handleFormChange = (field: keyof AssignmentFormData, value: string | number | boolean) => {
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
      weekday: 'short', month: 'short', day: 'numeric',
      year: 'numeric', hour: '2-digit', minute: '2-digit',
    });
  };

  // ─── Read-only student view ───────────────────────────────────────────────
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

  // ─── Linked assignment view ───────────────────────────────────────────────
  if (selectedAssignmentId) {
    return (
      <div className="space-y-4">
        {/* Linked assignment card */}
        <div className="flex items-start gap-3 p-3 rounded-lg bg-rose-50 border border-rose-200">
          <div className="w-9 h-9 rounded-lg bg-rose-100 flex items-center justify-center flex-shrink-0">
            <ClipboardList className="w-4 h-4 text-rose-600" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-medium text-gray-900 truncate">
              {selectedAssignment?.title ?? t('linked_assignment')}
            </p>
            {selectedAssignment?.description && (
              <p className="text-sm text-gray-500 truncate">{selectedAssignment.description}</p>
            )}
            <div className="flex items-center gap-3 mt-1 text-xs text-gray-400">
              {selectedAssignment?.dueDate && (
                <span className="flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  {formatDate(selectedAssignment.dueDate)}
                </span>
              )}
              {selectedAssignment?.points !== undefined && (
                <span className="flex items-center gap-1">
                  <Award className="w-3 h-3" />
                  {selectedAssignment.points} {t('points')}
                </span>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={() => handleAssignmentChange(null)}
            className="p-1 rounded hover:bg-rose-100 text-rose-400 hover:text-rose-600 transition-colors"
            title={t('unlink_assignment')}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Display toggles */}
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
      </div>
    );
  }

  // ─── No assignment yet: show create form or "link existing" ──────────────
  return (
    <div className="space-y-4">
      {showSelectExisting ? (
        /* Link existing assignment */
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-gray-700">{t('select_existing_assignment')}</p>
            <button
              type="button"
              onClick={() => setShowSelectExisting(false)}
              className="text-xs text-gray-400 hover:text-gray-600"
            >
              {t('back_to_create')}
            </button>
          </div>
          {assignmentsLoading ? (
            <Loading text={t('loading_assignments')} />
          ) : !assignments?.length ? (
            <div className="text-center py-4 text-gray-500 text-sm">
              <AlertCircle className="w-5 h-5 mx-auto mb-1" />
              {t('no_assignments_in_course')}
            </div>
          ) : (
            <Select
              label=""
              value={selectedAssignmentId?.toString() || ''}
              onChange={e => handleAssignmentChange(e.target.value ? parseInt(e.target.value) : null)}
              options={[
                { value: '', label: t('select_an_assignment') },
                ...(assignments || []).map(a => ({
                  value: a.id.toString(),
                  label: a.module ? `${a.title} (${a.module.title})` : a.title,
                })),
              ]}
            />
          )}
        </div>
      ) : (
        /* Inline create form */
        <form onSubmit={handleSubmit} className="space-y-4">
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
            rows={3}
          />

          <div className="grid grid-cols-2 gap-4">
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

            <Input
              label={t('points')}
              type="number"
              value={formData.points}
              onChange={e => handleFormChange('points', parseInt(e.target.value) || 0)}
              min={0}
            />
          </div>

          <Input
            label={t('due_date')}
            type="datetime-local"
            value={formData.dueDate}
            onChange={e => handleFormChange('dueDate', e.target.value)}
          />

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

          <div className="flex items-center justify-between pt-2 border-t">
            <button
              type="button"
              onClick={() => setShowSelectExisting(true)}
              className="text-xs text-gray-400 hover:text-primary-600 flex items-center gap-1 transition-colors"
            >
              <LinkIcon className="w-3 h-3" />
              {t('link_existing_assignment')}
            </button>
            <Button type="submit" loading={createMutation.isPending}>
              {t('create_assignment')}
            </Button>
          </div>
        </form>
      )}
    </div>
  );
};
