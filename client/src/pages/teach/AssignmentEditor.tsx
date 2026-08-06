import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { withReturnTo, resolveReturnTo } from '../../utils/returnTo';
import { useTranslation } from 'react-i18next';
import { Save } from 'lucide-react';
import toast from 'react-hot-toast';
import { assignmentsApi } from '../../api/assignments';
import { coursesApi } from '../../api/courses';
import { Card, CardBody } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { Loading } from '../../components/common/Loading';
import { Input } from '../../components/common/Input';
import { Breadcrumb } from '../../components/common/Breadcrumb';
import { RichTextEditor } from '../../components/forum/RichTextEditor';
import { SearchableSelect } from '../../components/common/SearchableSelect';
import { Toggle } from '../../components/common/Toggle';
import { AssignmentAttachmentList, useAssignmentAttachments } from '../../components/teach/AssignmentAttachments';
import {
  ASSIGNMENT_FILE_ACCEPT,
  ASSIGNMENT_FILE_FORMATS_LABEL,
  ASSIGNMENT_FILE_MAX_LABEL,
} from '../../constants/assignmentFiles';

/** ISO → datetime-local value. */
const toLocal = (iso?: string | null) => {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const blankForm = () => ({
  title: '',
  description: '',
  submissionType: 'text' as 'text' | 'file' | 'mixed' | 'ai_agent',
  points: 100,
  weight: 1,
  dueDate: '',
  gracePeriodDeadline: '',
  isPublished: false,
});

/**
 * Single create + edit page for an assignment (no popups). Mode is driven by
 * the route params:
 *   - edit:   /teach/courses/:id/assignments/:assignmentId/edit
 *   - create: /teach/courses/:id/modules/:moduleId/assignments/new
 * Nothing is written to the database until the user clicks Save.
 */
export const AssignmentEditor = () => {
  const { t } = useTranslation(['teaching', 'common', 'courses']);
  const { id, assignmentId, moduleId } = useParams<{ id: string; assignmentId?: string; moduleId?: string }>();
  const courseId = parseInt(id!, 10);
  const aId = assignmentId ? parseInt(assignmentId, 10) : null;
  const isNew = aId == null;
  const navigate = useNavigate();
  const location = useLocation();
  // Carried across the create redirect below: a `replace` navigation to the
  // page's own edit URL would otherwise drop it and strand the author.
  const returnTo = new URLSearchParams(location.search).get('returnTo');
  const queryClient = useQueryClient();

  const [form, setForm] = useState(blankForm());
  const attach = useAssignmentAttachments(aId);

  const { data: assignment, isLoading, isError } = useQuery({
    queryKey: ['assignment', aId],
    queryFn: () => assignmentsApi.getAssignmentById(aId!),
    enabled: !isNew && !!aId,
  });
  const { data: course } = useQuery({
    queryKey: ['course', courseId],
    queryFn: () => coursesApi.getCourseById(courseId),
    enabled: !!courseId,
  });

  useEffect(() => {
    if (assignment) {
      setForm({
        title: assignment.title || '',
        description: assignment.description || '',
        submissionType: (assignment.submissionType as ReturnType<typeof blankForm>['submissionType']) || 'text',
        points: assignment.points ?? 100,
        weight: (assignment as { weight?: number }).weight ?? 1,
        dueDate: toLocal(assignment.dueDate),
        gracePeriodDeadline: toLocal(assignment.gracePeriodDeadline),
        isPublished: assignment.isPublished ?? false,
      });
    }
  }, [assignment]);

  const payload = (f: typeof form) => ({
    title: f.title,
    description: f.description,
    submissionType: f.submissionType,
    points: Number(f.points),
    weight: Number(f.weight),
    dueDate: f.dueDate ? new Date(f.dueDate).toISOString() : null,
    gracePeriodDeadline: f.gracePeriodDeadline ? new Date(f.gracePeriodDeadline).toISOString() : null,
    isPublished: f.isPublished,
  });

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['courseDetails', courseId] });
    queryClient.invalidateQueries({ queryKey: ['course', courseId] });
  };

  const createMutation = useMutation({
    mutationFn: (f: typeof form) =>
      assignmentsApi.createAssignment(courseId, { ...payload(f), moduleId: moduleId ? Number(moduleId) : undefined } as never),
    onSuccess: async (created) => {
      // Files picked before the assignment existed had no id to hang off; now
      // there is one. Uploading before navigating keeps the list consistent
      // with what the user sees the moment the edit route takes over.
      await attach.flushStaged(created.id);
      refresh();
      toast.success(t('assignment_created', { defaultValue: 'Assignment created' }));
      navigate(withReturnTo(`/teach/courses/${courseId}/assignments/${created.id}/edit`, returnTo), { replace: true });
    },
    onError: (e: any) => toast.error(e?.response?.data?.error ?? t('common:error')),
  });

  const updateMutation = useMutation({
    mutationFn: (f: typeof form) => assignmentsApi.updateAssignment(aId!, payload(f) as never),
    onSuccess: async () => {
      // Retries anything a failed flush left behind, so "uploads when you save"
      // stays true on the second save rather than only the first.
      await attach.flushStaged(aId!);
      queryClient.invalidateQueries({ queryKey: ['assignment', aId] });
      refresh();
      toast.success(t('common:saved', { defaultValue: 'Saved' }));
    },
    onError: (e: any) => toast.error(e?.response?.data?.error ?? t('common:error')),
  });

  const handleSave = () => {
    if (!form.title.trim()) {
      toast.error(t('title_required', { defaultValue: 'Title is required' }));
      return;
    }
    // Never save an edit whose form was not built from a loaded assignment —
    // see the guard below for why that would destroy data.
    if (!isNew && !assignment) return;
    (isNew ? createMutation : updateMutation).mutate(form);
  };

  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) =>
    setForm(prev => ({ ...prev, [key]: value }));

  // In edit mode the form must never render from `blankForm()`. `isLoading`
  // alone is not enough: if the fetch fails, isLoading goes false while
  // `assignment` stays undefined, so the form would render EMPTY over a real
  // row — and updateAssignment spreads whatever the client sends, so one Save
  // would blank the stored title and description without the user ever
  // touching those fields. Gate on the assignment itself.
  if (!isNew && !assignment) {
    if (isLoading) return <Loading fullScreen text={t('common:loading', { defaultValue: 'Loading…' })} />;
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 md:py-8">
        <Card>
          <CardBody className="text-center py-10 space-y-4">
            <p className="text-gray-700 dark:text-gray-300">
              {isError ? t('failed_to_load_assignment') : t('assignment_not_found')}
            </p>
            <Button variant="secondary" onClick={() => navigate(resolveReturnTo(location.search, `/courses/${courseId}`))}>
              {t('common:back')}
            </Button>
          </CardBody>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 md:py-8">
      <div className="mb-4">
        <Breadcrumb
          items={[
            { label: t('courses:courses', { defaultValue: 'Courses' }), href: '/courses' },
            { label: course?.title || t('courses:course', { defaultValue: 'Course' }), href: `/courses/${courseId}` },
            { label: isNew ? t('new_assignment', { defaultValue: 'New assignment' }) : t('edit_assignment', { defaultValue: 'Edit Assignment' }) },
          ]}
        />
      </div>

      <Card>
        <CardBody className="space-y-5">
          <Input
            label={t('assignment_title', { defaultValue: 'Assignment title' })}
            value={form.title}
            onChange={e => set('title', e.target.value)}
            required
          />

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              {t('common:description', { defaultValue: 'Description' })}
            </label>
            <RichTextEditor
              value={form.description}
              onChange={v => set('description', v)}
              onAttachFiles={attach.attach}
              attachAccept={ASSIGNMENT_FILE_ACCEPT}
              attachBusy={attach.uploading}
              attachTitle={t('attach_files')}
            />
            <p className="mt-1.5 text-xs text-gray-500 dark:text-gray-400">
              {t('attach_files_hint')} {ASSIGNMENT_FILE_FORMATS_LABEL} &middot;{' '}
              {t('max_file_size', { limit: ASSIGNMENT_FILE_MAX_LABEL })}
            </p>
            <AssignmentAttachmentList
              attachments={attach.attachments}
              stagedFiles={attach.stagedFiles}
              onRemove={attach.remove}
              onRemoveStaged={attach.removeStaged}
              removingId={attach.removingId}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <SearchableSelect
              label={t('submission_type', { defaultValue: 'Submission type' })}
              value={form.submissionType}
              onChange={v => set('submissionType', v as typeof form.submissionType)}
              options={[
                { value: 'text', label: t('submission_text', { defaultValue: 'Text' }) },
                { value: 'file', label: t('submission_file', { defaultValue: 'File upload' }) },
                { value: 'mixed', label: t('submission_mixed', { defaultValue: 'Text + file' }) },
                { value: 'ai_agent', label: t('submission_ai_agent', { defaultValue: 'AI agent' }) },
              ]}
            />
            <Input
              type="number"
              label={t('points', { defaultValue: 'Points' })}
              value={String(form.points)}
              onChange={e => set('points', Number(e.target.value))}
              min={0}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              type="datetime-local"
              label={t('due_date', { defaultValue: 'Due date' })}
              value={form.dueDate}
              onChange={e => set('dueDate', e.target.value)}
            />
            <Input
              type="datetime-local"
              label={t('grace_period_deadline', { defaultValue: 'Grace period deadline' })}
              value={form.gracePeriodDeadline}
              onChange={e => set('gracePeriodDeadline', e.target.value)}
            />
          </div>

          <div className="flex items-center justify-between gap-2 pt-4 border-t border-gray-100 dark:border-gray-700">
            <Toggle
              checked={form.isPublished}
              onChange={v => set('isPublished', v)}
              onLabel={t('common:published', { defaultValue: 'Published' })}
              offLabel={t('common:draft', { defaultValue: 'Draft' })}
            />
            <Button icon={<Save className="w-4 h-4" />} onClick={handleSave} loading={createMutation.isPending || updateMutation.isPending}>
              {isNew ? t('common:create', { defaultValue: 'Create' }) : t('common:save', { defaultValue: 'Save' })}
            </Button>
          </div>
        </CardBody>
      </Card>
    </div>
  );
};
