import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ClipboardList, Calendar, Award, AlertCircle, Link as LinkIcon, Edit2, Upload, FileText, Trash2, Pencil, Check, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { Assignment, AssignmentAttachment, LectureSection, UpdateSectionData } from '../../types';
import { coursesApi } from '../../api/courses';
import { assignmentsApi } from '../../api/assignments';
import { uploadsApi } from '../../api/uploads';
import { Select, Input, TextArea } from '../common/Input';
import { RichTextEditor } from '../forum/RichTextEditor';
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

const assignmentToFormData = (a: Assignment): AssignmentFormData => ({
  title: a.title,
  description: a.description ?? '',
  instructions: a.instructions ?? '',
  submissionType: (a.submissionType === 'ai_agent' ? 'text' : a.submissionType) as 'text' | 'file' | 'mixed',
  dueDate: a.dueDate ? new Date(a.dueDate).toISOString().slice(0, 16) : '',
  points: a.points,
  isPublished: a.isPublished,
});

const ALLOWED_EXTENSIONS = '.csv,.xlsx,.png,.jpg,.jpeg,.pdf';
const MAX_FILE_SIZE = 3 * 1024 * 1024; // 3MB

export const AttachmentManager = ({ assignmentId }: { assignmentId: number }) => {
  const { t } = useTranslation(['teaching']);
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState('');
  const [uploading, setUploading] = useState(false);

  const { data: attachments = [] } = useQuery({
    queryKey: ['assignmentAttachments', assignmentId],
    queryFn: () => assignmentsApi.getAttachments(assignmentId),
    enabled: !!assignmentId,
  });

  const addMutation = useMutation({
    mutationFn: (data: { fileName: string; fileUrl: string; fileType: string; fileSize?: number }) =>
      assignmentsApi.addAttachment(assignmentId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assignmentAttachments', assignmentId] });
    },
  });

  const renameMutation = useMutation({
    mutationFn: ({ id, fileName }: { id: number; fileName: string }) =>
      assignmentsApi.updateAttachment(id, { fileName }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assignmentAttachments', assignmentId] });
      setEditingId(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => assignmentsApi.deleteAttachment(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assignmentAttachments', assignmentId] });
    },
  });

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.length) return;

    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        if (file.size > MAX_FILE_SIZE) {
          toast.error(t('file_too_large', { name: file.name, limit: '3MB' }));
          continue;
        }
        const result = await uploadsApi.uploadAssignmentFile(file);
        const ext = file.name.split('.').pop() || '';
        await addMutation.mutateAsync({
          fileName: file.name,
          fileUrl: result.url,
          fileType: ext.toLowerCase(),
          fileSize: file.size,
        });
      }
      toast.success(t('files_uploaded'));
    } catch {
      toast.error(t('file_upload_failed'));
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const startRename = (att: AssignmentAttachment) => {
    setEditingId(att.id);
    setEditName(att.fileName);
  };

  const confirmRename = (id: number) => {
    if (editName.trim()) {
      renameMutation.mutate({ id, fileName: editName.trim() });
    }
  };

  return (
    <div className="space-y-3">
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
        {t('file_attachments')}
      </label>

      {attachments.length > 0 && (
        <div className="space-y-2">
          {attachments.map(att => (
            <div key={att.id} className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg">
              <FileText className="w-4 h-4 text-gray-400 flex-shrink-0" />
              {editingId === att.id ? (
                <>
                  <input
                    type="text"
                    value={editName}
                    onChange={e => setEditName(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') confirmRename(att.id);
                      if (e.key === 'Escape') setEditingId(null);
                    }}
                    className="flex-1 text-sm border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-primary-500"
                    autoFocus
                  />
                  <button onClick={() => confirmRename(att.id)} className="p-1 hover:bg-gray-200 rounded">
                    <Check className="w-3.5 h-3.5 text-green-600" />
                  </button>
                  <button onClick={() => setEditingId(null)} className="p-1 hover:bg-gray-200 rounded">
                    <X className="w-3.5 h-3.5 text-gray-500" />
                  </button>
                </>
              ) : (
                <>
                  <span className="flex-1 text-sm text-gray-700 truncate">{att.fileName}</span>
                  <span className="text-xs text-gray-400 uppercase">{att.fileType}</span>
                  <button onClick={() => startRename(att)} className="p-1 hover:bg-gray-200 rounded" title={t('rename')}>
                    <Pencil className="w-3.5 h-3.5 text-gray-500" />
                  </button>
                  <button onClick={() => deleteMutation.mutate(att.id)} className="p-1 hover:bg-red-100 rounded" title={t('common:delete')}>
                    <Trash2 className="w-3.5 h-3.5 text-red-500" />
                  </button>
                </>
              )}
            </div>
          ))}
        </div>
      )}

      <div
        className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center cursor-pointer hover:border-primary-400 transition-colors"
        onClick={() => fileInputRef.current?.click()}
      >
        <Upload className="w-5 h-5 mx-auto mb-1 text-gray-400" />
        <p className="text-sm text-gray-500">
          {uploading ? t('uploading') : t('click_to_upload_files')}
        </p>
        <p className="text-xs text-gray-400 mt-1">
          {t('allowed_file_formats')} &middot; {t('max_3mb')}
        </p>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept={ALLOWED_EXTENSIONS}
        multiple
        onChange={handleFileSelect}
        className="hidden"
      />
    </div>
  );
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
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState<AssignmentFormData>(initialFormData);
  // Staged files for the create form (uploaded after assignment creation)
  const [stagedFiles, setStagedFiles] = useState<File[]>([]);
  const createFileInputRef = useRef<HTMLInputElement>(null);
  // Cache the full assignment object so title/details are available immediately after create/edit
  const [cachedAssignment, setCachedAssignment] = useState<Assignment | null>(
    section.assignment || null
  );

  // Only fetch existing assignments when the "link existing" panel is open
  const { data: assignments, isLoading: assignmentsLoading } = useQuery({
    queryKey: ['courseAssignments', courseId],
    queryFn: () => coursesApi.getAssignmentsForSection(courseId),
    enabled: !readOnly && !!courseId && showSelectExisting,
  });

  // Fetch full assignment details when edit form is opened
  const { data: fullAssignment, isLoading: fullAssignmentLoading } = useQuery({
    queryKey: ['assignment', selectedAssignmentId],
    queryFn: () => assignmentsApi.getAssignmentById(selectedAssignmentId!),
    enabled: isEditing && !!selectedAssignmentId,
  });

  useEffect(() => {
    if (isEditing && fullAssignment) {
      setFormData(assignmentToFormData(fullAssignment));
      setCachedAssignment(fullAssignment);
    }
  }, [fullAssignment, isEditing]);

  const createMutation = useMutation({
    mutationFn: (data: AssignmentFormData) =>
      assignmentsApi.createAssignment(courseId, {
        ...data,
        moduleId: moduleId ?? null,
        lectureId: lectureId ?? null,
        dueDate: data.dueDate ? new Date(data.dueDate).toISOString() : null,
      }),
    onSuccess: async (newAssignment) => {
      // Upload any staged files
      if (stagedFiles.length > 0) {
        try {
          for (const file of stagedFiles) {
            const result = await uploadsApi.uploadAssignmentFile(file);
            const ext = file.name.split('.').pop() || '';
            await assignmentsApi.addAttachment(newAssignment.id, {
              fileName: file.name,
              fileUrl: result.url,
              fileType: ext.toLowerCase(),
              fileSize: file.size,
            });
          }
        } catch {
          toast.error(t('file_upload_failed'));
        }
        setStagedFiles([]);
      }
      queryClient.invalidateQueries({ queryKey: ['courseAssignments', courseId] });
      queryClient.invalidateQueries({ queryKey: ['assignmentAttachments', newAssignment.id] });
      toast.success(t('assignment_created'));
      setCachedAssignment(newAssignment);
      setSelectedAssignmentId(newAssignment.id);
      onChange({ assignmentId: newAssignment.id });
    },
    onError: () => toast.error(t('failed_to_create_assignment')),
  });

  const updateMutation = useMutation({
    mutationFn: (data: AssignmentFormData) =>
      assignmentsApi.updateAssignment(selectedAssignmentId!, {
        ...data,
        dueDate: data.dueDate ? new Date(data.dueDate).toISOString() : null,
      }),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ['courseAssignments', courseId] });
      toast.success(t('assignment_updated'));
      setCachedAssignment(updated);
      setIsEditing(false);
    },
    onError: () => toast.error(t('failed_to_save_section')),
  });

  useEffect(() => {
    setSelectedAssignmentId(section.assignmentId || null);
    setShowDeadline(section.showDeadline ?? true);
    setShowPoints(section.showPoints ?? true);
    if (section.assignment) setCachedAssignment(section.assignment);
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

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title.trim()) { toast.error(t('title_required')); return; }
    createMutation.mutate(formData);
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title.trim()) { toast.error(t('title_required')); return; }
    updateMutation.mutate(formData);
  };

  const openEdit = () => {
    setFormData(initialFormData);
    setIsEditing(true);
  };

  const selectedAssignment = cachedAssignment || section.assignment ||
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

  // ─── Linked assignment: edit form ─────────────────────────────────────────
  if (selectedAssignmentId && isEditing) {
    if (fullAssignmentLoading) {
      return <Loading text={t('loading_assignment')} />;
    }
    return (
      <form onSubmit={handleEditSubmit} className="space-y-4">
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

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
            {t('instructions')}
          </label>
          <RichTextEditor
            value={formData.instructions}
            onChange={val => handleFormChange('instructions', val)}
            editorClassName="forum-reply-editor px-3 py-2 min-h-[200px] max-h-[400px] overflow-y-auto prose prose-sm dark:prose-invert max-w-none focus-within:outline-none"
          />
        </div>

        {selectedAssignmentId && <AttachmentManager assignmentId={selectedAssignmentId} />}

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
            id="isPublishedEdit"
            checked={formData.isPublished}
            onChange={e => handleFormChange('isPublished', e.target.checked)}
            className="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
          />
          <label htmlFor="isPublishedEdit" className="text-sm text-gray-700">
            {t('publish_immediately')}
          </label>
        </div>

        <div className="flex justify-end gap-3 pt-2 border-t">
          <Button type="button" variant="secondary" onClick={() => setIsEditing(false)}>
            {t('cancel')}
          </Button>
          <Button type="submit" loading={updateMutation.isPending}>
            {t('save_changes')}
          </Button>
        </div>
      </form>
    );
  }

  // ─── Linked assignment: card view ─────────────────────────────────────────
  if (selectedAssignmentId) {
    return (
      <div className="space-y-4">
        <div className="flex items-start gap-3 p-3 rounded-lg bg-rose-50 border border-rose-200">
          <div className="w-9 h-9 rounded-lg bg-rose-100 flex items-center justify-center flex-shrink-0">
            <ClipboardList className="w-4 h-4 text-rose-600" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-medium text-gray-900 truncate">
              {selectedAssignment?.title}
            </p>
            <div className="flex items-center gap-3 mt-1.5 text-xs text-gray-500">
              <span className="flex items-center gap-1">
                <Calendar className="w-3 h-3 text-gray-400" />
                {selectedAssignment?.dueDate
                  ? formatDate(selectedAssignment.dueDate)
                  : t('no_due_date')}
              </span>
              <span className="text-gray-300">•</span>
              <span className="flex items-center gap-1">
                <Award className="w-3 h-3 text-gray-400" />
                {selectedAssignment?.points ?? 0} {t('points')}
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={openEdit}
            className="p-1.5 rounded hover:bg-rose-100 text-rose-400 hover:text-rose-600 transition-colors"
            title={t('edit_assignment')}
          >
            <Edit2 className="w-4 h-4" />
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

  // ─── No assignment yet: create form or link existing ─────────────────────
  return (
    <div className="space-y-4">
      {showSelectExisting ? (
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
        <form onSubmit={handleCreateSubmit} className="space-y-4">
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

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              {t('instructions')}
            </label>
            <RichTextEditor
              value={formData.instructions}
              onChange={val => handleFormChange('instructions', val)}
              editorClassName="forum-reply-editor px-3 py-2 min-h-[200px] max-h-[400px] overflow-y-auto prose prose-sm dark:prose-invert max-w-none focus-within:outline-none"
            />
          </div>

          {/* Staged file attachments (uploaded after assignment creation) */}
          <div className="space-y-3">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              {t('file_attachments')}
            </label>

            {stagedFiles.length > 0 && (
              <div className="space-y-2">
                {stagedFiles.map((file, idx) => (
                  <div key={idx} className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg">
                    <FileText className="w-4 h-4 text-gray-400 flex-shrink-0" />
                    <span className="flex-1 text-sm text-gray-700 truncate">{file.name}</span>
                    <span className="text-xs text-gray-400">{(file.size / 1024).toFixed(0)} KB</span>
                    <button
                      type="button"
                      onClick={() => setStagedFiles(prev => prev.filter((_, i) => i !== idx))}
                      className="p-1 hover:bg-red-100 rounded"
                    >
                      <Trash2 className="w-3.5 h-3.5 text-red-500" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div
              className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center cursor-pointer hover:border-primary-400 transition-colors"
              onClick={() => createFileInputRef.current?.click()}
            >
              <Upload className="w-5 h-5 mx-auto mb-1 text-gray-400" />
              <p className="text-sm text-gray-500">{t('click_to_upload_files')}</p>
              <p className="text-xs text-gray-400 mt-1">
                {t('allowed_file_formats')} &middot; {t('max_3mb')}
              </p>
            </div>

            <input
              ref={createFileInputRef}
              type="file"
              accept={ALLOWED_EXTENSIONS}
              multiple
              onChange={e => {
                const files = e.target.files;
                if (!files?.length) return;
                const valid: File[] = [];
                for (const file of Array.from(files)) {
                  if (file.size > MAX_FILE_SIZE) {
                    toast.error(t('file_too_large', { name: file.name, limit: '3MB' }));
                  } else {
                    valid.push(file);
                  }
                }
                setStagedFiles(prev => [...prev, ...valid]);
                if (createFileInputRef.current) createFileInputRef.current.value = '';
              }}
              className="hidden"
            />
          </div>

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
