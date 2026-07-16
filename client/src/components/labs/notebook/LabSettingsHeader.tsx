import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Save, Settings2, ChevronDown, ChevronUp, Globe, Lock, Sparkles, BookOpen, Copy, Trash2, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { customLabsApi } from '../../../api/customLabs';
import { coursesApi } from '../../../api/courses';
import { chatbotsApi } from '../../../api/chat';
import { Button } from '../../common/Button';
import { CustomLab, Chatbot, Course } from '../../../types';
import { ConfirmDialog } from '../../common/ConfirmDialog';

interface LabSettingsHeaderProps {
  lab: CustomLab;
  canEdit: boolean;
}

/**
 * The lab's identity and settings, ON the lab page. Students see the name and
 * description; owners edit name, description, visibility, and the AI assistant
 * right here — no separate manager page, no buried modal.
 */
export const LabSettingsHeader = ({ lab, canEdit }: LabSettingsHeaderProps) => {
  const { t } = useTranslation(['courses', 'teaching', 'common']);
  const queryClient = useQueryClient();
  // Deep link: /labs/:id?settings=1 lands with the settings panel expanded.
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [open, setOpen] = useState(searchParams.get('settings') === '1');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [assignCourseId, setAssignCourseId] = useState<number | null>(null);
  const [withAssignment, setWithAssignment] = useState(true);
  const [assignPrompt, setAssignPrompt] = useState('');
  const [assignPoints, setAssignPoints] = useState(100);
  const [assignDueDate, setAssignDueDate] = useState('');
  const [name, setName] = useState(lab.name);
  const [description, setDescription] = useState(lab.description ?? '');
  const [isPublic, setIsPublic] = useState(lab.isPublic);
  const [aiChatbotId, setAiChatbotId] = useState<number | null>(lab.aiChatbotId ?? null);

  useEffect(() => {
    setName(lab.name);
    setDescription(lab.description ?? '');
    setIsPublic(lab.isPublic);
    setAiChatbotId(lab.aiChatbotId ?? null);
  }, [lab.id, lab.name, lab.description, lab.isPublic, lab.aiChatbotId]);

  const { data: chatbots = [] } = useQuery({
    queryKey: ['chatbots'],
    queryFn: () => chatbotsApi.getChatbots(),
    enabled: canEdit,
  });

  const { data: myCourses = [] } = useQuery({
    queryKey: ['myCourses'],
    queryFn: coursesApi.getMyCourses,
    enabled: canEdit && open,
  });

  const isDirty =
    name !== lab.name ||
    description !== (lab.description ?? '') ||
    isPublic !== lab.isPublic ||
    aiChatbotId !== (lab.aiChatbotId ?? null);

  const saveMutation = useMutation({
    mutationFn: () =>
      customLabsApi.updateLab(lab.id, { name, description, isPublic, aiChatbotId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lab'] });
      queryClient.invalidateQueries({ queryKey: ['myLabs'] });
      toast.success(t('teaching:lab_updated', { defaultValue: 'Lab settings saved' }));
    },
    onError: (e: Error) =>
      toast.error(e.message || t('teaching:failed_to_update_lab', { defaultValue: 'Failed to save lab' })),
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['lab'] });
    queryClient.invalidateQueries({ queryKey: ['labs'] });
    queryClient.invalidateQueries({ queryKey: ['myLabs'] });
  };

  const assignMutation = useMutation({
    mutationFn: (courseId: number) =>
      customLabsApi.assignToCourse(lab.id, {
        courseId,
        // With the toggle on, the server creates a real gradable Assignment
        // atomically with the attachment; students then get the submit flow.
        enableAssignment: withAssignment,
        ...(withAssignment && {
          prompt: assignPrompt || undefined,
          points: assignPoints,
          dueDate: assignDueDate || undefined,
        }),
      }),
    onSuccess: () => {
      invalidate();
      setAssignCourseId(null);
      setAssignPrompt('');
      toast.success(t('teaching:lab_assigned', { defaultValue: 'Lab assigned to course' }));
    },
    onError: (e: Error) => toast.error(e.message || t('teaching:failed_to_assign_lab', { defaultValue: 'Failed to assign lab' })),
  });

  const unassignMutation = useMutation({
    mutationFn: (courseId: number) => customLabsApi.unassignFromCourse(lab.id, courseId),
    onSuccess: () => {
      invalidate();
      toast.success(t('teaching:lab_unassigned', { defaultValue: 'Lab removed from course' }));
    },
    onError: (e: Error) => toast.error(e.message || t('teaching:failed_to_unassign_lab', { defaultValue: 'Failed to unassign lab' })),
  });

  const duplicateMutation = useMutation({
    mutationFn: () => customLabsApi.duplicateLab(lab.id),
    onSuccess: copy => {
      invalidate();
      toast.success(t('teaching:lab_duplicated', { defaultValue: 'Lab duplicated' }));
      navigate(`/labs/${copy.id}?settings=1`);
    },
    onError: (e: Error) => toast.error(e.message || t('teaching:failed_to_duplicate_lab', { defaultValue: 'Failed to duplicate lab' })),
  });

  const deleteMutation = useMutation({
    mutationFn: () => customLabsApi.deleteLab(lab.id),
    onSuccess: () => {
      invalidate();
      toast.success(t('teaching:lab_deleted', { defaultValue: 'Lab deleted' }));
      navigate('/labs');
    },
    onError: (e: Error) => toast.error(e.message || t('teaching:failed_to_delete_lab', { defaultValue: 'Failed to delete lab' })),
  });

  const attachedBot = chatbots.find((cb: Chatbot) => cb.id === aiChatbotId);
  const inputCls =
    'w-full px-3 py-2 rounded-lg border bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-emerald-500';

  return (
    <div className="mb-6 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm overflow-hidden">
      <div className="flex items-start gap-4 p-5">
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100 truncate">
            {lab.name}
          </h1>
          {lab.description && (
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{lab.description}</p>
          )}
          <div className="mt-2 flex items-center gap-3 text-xs text-gray-400">
            <span className="flex items-center gap-1">
              {lab.isPublic ? <Globe className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
              {lab.isPublic
                ? t('teaching:public', { defaultValue: 'Public' })
                : t('teaching:private', { defaultValue: 'Private' })}
            </span>
            {canEdit && (
              <span className="flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5" />
                {attachedBot
                  ? attachedBot.displayName
                  : t('teaching:ai_assistant_none', { defaultValue: 'No AI assistant' })}
              </span>
            )}
          </div>
        </div>

        {canEdit && (
          <Button
            variant={open ? 'primary' : 'outline'}
            size="sm"
            onClick={() => setOpen(v => !v)}
            icon={<Settings2 className="w-4 h-4" />}
          >
            {t('teaching:lab_settings', { defaultValue: 'Lab settings' })}
            {open ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </Button>
        )}
      </div>

      {canEdit && open && (
        <div className="border-t border-gray-100 dark:border-gray-700 p-5 grid gap-4 sm:grid-cols-2 bg-gray-50/60 dark:bg-gray-900/30">
          <div>
            <label className="block text-sm font-medium mb-1 text-gray-800 dark:text-gray-100">
              {t('teaching:lab_name', { defaultValue: 'Lab name' })} *
            </label>
            <input type="text" value={name} onChange={e => setName(e.target.value)} className={inputCls} />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1 text-gray-800 dark:text-gray-100">
              {t('teaching:ai_assistant', { defaultValue: 'AI Assistant' })}
            </label>
            <select
              value={aiChatbotId ?? ''}
              onChange={e => setAiChatbotId(e.target.value ? Number(e.target.value) : null)}
              className={inputCls}
            >
              <option value="">
                {t('teaching:ai_assistant_none', { defaultValue: 'No AI assistant' })}
              </option>
              {chatbots
                .filter((cb: Chatbot) => cb.isActive)
                .map((cb: Chatbot) => (
                  <option key={cb.id} value={cb.id}>
                    {cb.displayName}
                  </option>
                ))}
            </select>
            <p className="text-xs text-gray-400 mt-1">
              {t('teaching:ai_assistant_hint', {
                defaultValue: 'Students get an "Ask AI" helper in this lab, driven by the chosen agent.',
              })}
            </p>
          </div>

          <div className="sm:col-span-2">
            <label className="block text-sm font-medium mb-1 text-gray-800 dark:text-gray-100">
              {t('common:description')}
            </label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={2}
              className={inputCls}
            />
          </div>

          <label className="flex items-center gap-3 text-sm text-gray-800 dark:text-gray-100">
            <input
              type="checkbox"
              checked={isPublic}
              onChange={e => setIsPublic(e.target.checked)}
              className="w-4 h-4 rounded text-emerald-500"
            />
            {t('teaching:make_lab_public', { defaultValue: 'Make this lab public (visible to all users)' })}
          </label>

          <div className="flex justify-end items-end">
            <Button
              onClick={() => saveMutation.mutate()}
              disabled={!isDirty || !name.trim() || saveMutation.isPending}
              loading={saveMutation.isPending}
              icon={<Save className="w-4 h-4" />}
            >
              {t('common:save')}
            </Button>
          </div>

          {/* Courses */}
          <div className="sm:col-span-2 border-t border-gray-200 dark:border-gray-700 pt-4">
            <label className="block text-sm font-medium mb-2 text-gray-800 dark:text-gray-100">
              <span className="flex items-center gap-1.5">
                <BookOpen className="w-4 h-4" />
                {t('teaching:assigned_courses', { defaultValue: 'Assigned courses' })}
              </span>
            </label>
            {lab.assignments && lab.assignments.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-3">
                {lab.assignments.map(a => (
                  <span
                    key={a.id}
                    className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"
                  >
                    {a.course?.title}
                    <button
                      onClick={() => unassignMutation.mutate(a.courseId)}
                      className="hover:text-red-500"
                      title={t('common:remove', { defaultValue: 'Remove' })}
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
            <div className="flex gap-2">
              <select
                value={assignCourseId ?? ''}
                onChange={e => setAssignCourseId(e.target.value ? Number(e.target.value) : null)}
                className={`${inputCls} flex-1`}
              >
                <option value="">
                  {t('teaching:select_course_placeholder', { defaultValue: 'Select a course…' })}
                </option>
                {myCourses.map((course: Course) => {
                  const already = lab.assignments?.some(a => a.courseId === course.id);
                  return (
                    <option key={course.id} value={course.id} disabled={already}>
                      {course.title}
                      {already ? ` (${t('teaching:already_assigned', { defaultValue: 'assigned' })})` : ''}
                    </option>
                  );
                })}
              </select>
              <Button
                variant="outline"
                onClick={() => assignCourseId && assignMutation.mutate(assignCourseId)}
                disabled={!assignCourseId || assignMutation.isPending}
                loading={assignMutation.isPending}
                icon={<BookOpen className="w-4 h-4" />}
              >
                {t('teaching:assign', { defaultValue: 'Assign' })}
              </Button>
            </div>

            {assignCourseId != null && (
              <div className="mt-3 rounded-lg border border-gray-200 dark:border-gray-700 p-3 space-y-3 bg-white dark:bg-gray-900/40">
                <label className="flex items-center gap-3 text-sm text-gray-800 dark:text-gray-100">
                  <input
                    type="checkbox"
                    checked={withAssignment}
                    onChange={e => setWithAssignment(e.target.checked)}
                    className="w-4 h-4 rounded text-emerald-500"
                  />
                  {t('teaching:create_graded_assignment', {
                    defaultValue: 'Create a graded assignment (students can submit their work)',
                  })}
                </label>
                {withAssignment ? (
                  <div className="grid gap-3 sm:grid-cols-3">
                    <div className="sm:col-span-3">
                      <label className="block text-xs font-medium mb-1 text-gray-600 dark:text-gray-300">
                        {t('teaching:assignment_prompt', { defaultValue: 'Assignment prompt (optional)' })}
                      </label>
                      <textarea
                        value={assignPrompt}
                        onChange={e => setAssignPrompt(e.target.value)}
                        rows={2}
                        className={inputCls}
                        placeholder={t('teaching:assignment_prompt_placeholder', {
                          defaultValue: 'What should students do and submit?',
                        })}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium mb-1 text-gray-600 dark:text-gray-300">
                        {t('teaching:points', { defaultValue: 'Points' })}
                      </label>
                      <input
                        type="number"
                        min={0}
                        value={assignPoints}
                        onChange={e => setAssignPoints(Math.max(0, Number(e.target.value)))}
                        className={inputCls}
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-medium mb-1 text-gray-600 dark:text-gray-300">
                        {t('teaching:due_date', { defaultValue: 'Due date (optional)' })}
                      </label>
                      <input
                        type="datetime-local"
                        value={assignDueDate}
                        onChange={e => setAssignDueDate(e.target.value)}
                        className={inputCls}
                      />
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-amber-600">
                    {t('teaching:assign_no_assignment_hint', {
                      defaultValue: 'Without an assignment, students can open and run the lab but cannot submit work for grading.',
                    })}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Lifecycle */}
          <div className="sm:col-span-2 border-t border-gray-200 dark:border-gray-700 pt-4 flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => duplicateMutation.mutate()}
              disabled={duplicateMutation.isPending}
              loading={duplicateMutation.isPending}
              icon={<Copy className="w-4 h-4" />}
            >
              {t('common:duplicate', { defaultValue: 'Duplicate' })}
            </Button>
            <span className="flex-1" />
            <Button
              variant="danger"
              size="sm"
              onClick={() => setConfirmDelete(true)}
              icon={<Trash2 className="w-4 h-4" />}
            >
              {t('teaching:delete_lab', { defaultValue: 'Delete lab' })}
            </Button>
          </div>
        </div>
      )}

      <ConfirmDialog
        isOpen={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={() => deleteMutation.mutate()}
        title={t('teaching:delete_lab', { defaultValue: 'Delete lab' })}
        message={t('teaching:delete_lab_confirm', {
          name: lab.name,
          defaultValue: 'Are you sure you want to delete "{{name}}"? All of its cells will be deleted too.',
        })}
        loading={deleteMutation.isPending}
        requireSecondConfirm
      />
    </div>
  );
};
