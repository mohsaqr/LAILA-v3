import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Clock, MoreHorizontal, Trash2, Save } from 'lucide-react';
import toast from 'react-hot-toast';
import { coursesApi } from '../../api/courses';
import { Loading } from '../../components/common/Loading';
import { Breadcrumb } from '../../components/common/Breadcrumb';
import { ConfirmDialog } from '../../components/common/ConfirmDialog';
import { SearchableSelect } from '../../components/common/SearchableSelect';
import { Card, CardBody } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { Input, TextArea } from '../../components/common/Input';
import { Toggle } from '../../components/common/Toggle';
import { useTheme } from '../../hooks/useTheme';
import { SectionListEditor, type SectionListEditorHandle } from '../../components/teach/lesson-editor';
import activityLogger from '../../services/activityLogger';

/**
 * Lecture editor — the editable twin of the student lecture page
 * (/courses/:id/lectures/:lectureId). Same page chrome (container,
 * breadcrumb) and the same rich-text editor (LessonEditor — bold/italic/
 * lists/links + image/video/chatbot/embed), with an editable title,
 * duration and content type in the header.
 */
export const LectureEditor = () => {
  const { t } = useTranslation(['teaching', 'common', 'navigation', 'courses']);
  const { id, lectureId, moduleId } = useParams<{ id: string; lectureId?: string; moduleId?: string }>();
  const courseId = parseInt(id!, 10);
  const isNew = !lectureId;
  const lecId = lectureId ? parseInt(lectureId, 10) : NaN;
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { isDark } = useTheme();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [duration, setDuration] = useState(0);
  const [contentType, setContentType] = useState<'text' | 'video' | 'mixed'>('mixed');
  const [isPublished, setIsPublished] = useState(false);
  const [editingTitle, setEditingTitle] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const editorRef = useRef<SectionListEditorHandle>(null);

  // Flush the editor's autosave, confirm, and return to the course.
  const handleSave = async () => {
    setSaving(true);
    try {
      await editorRef.current?.flush();
      await queryClient.invalidateQueries({ queryKey: ['courseDetails', courseId] });
      toast.success(t('common:saved', { defaultValue: 'Saved' }));
      navigate(`/courses/${courseId}`);
    } catch {
      toast.error(t('common:error', { defaultValue: 'Something went wrong' }));
    } finally {
      setSaving(false);
    }
  };

  const { data: lecture, isLoading } = useQuery({
    queryKey: ['lecture', lecId],
    queryFn: () => coursesApi.getLectureById(lecId),
    enabled: !isNew && !!lecId,
  });

  const { data: course } = useQuery({
    queryKey: ['course', courseId],
    queryFn: () => coursesApi.getCourseById(courseId),
    enabled: !!courseId,
  });

  useEffect(() => {
    if (lecId && courseId) {
      activityLogger.logLectureEditorViewed(lecId, undefined, courseId);
    }
  }, [lecId, courseId]);

  useEffect(() => {
    if (!lecture) return;
    setTitle(lecture.title ?? '');
    setDescription((lecture as { description?: string }).description ?? '');
    setDuration(lecture.duration ?? 0);
    setIsPublished((lecture as { isPublished?: boolean }).isPublished ?? false);
  }, [lecture]);

  const updateMutation = useMutation({
    mutationFn: (data: { title?: string; description?: string; duration?: number; contentType?: string; isPublished?: boolean }) =>
      coursesApi.updateLecture(lecId, data as never),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lecture', lecId] });
      queryClient.invalidateQueries({ queryKey: ['courseDetails', courseId] });
      queryClient.invalidateQueries({ queryKey: ['course', courseId] });
      toast.success(
        t('teaching:lesson_updated_message', {
          defaultValue: 'Your changes to this lesson have been saved.',
        }),
      );
    },
    onError: () => {
      toast.error(t('teaching:failed_to_save_lesson', { defaultValue: 'Failed to save.' }));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => coursesApi.deleteLecture(lecId),
    onSuccess: () => {
      toast.success(t('teaching:lesson_deleted', { defaultValue: 'Lesson deleted' }));
      queryClient.invalidateQueries({ queryKey: ['courseDetails', courseId] });
      navigate(`/courses/${courseId}`);
    },
    onError: () => {
      toast.error(t('teaching:failed_to_delete_lesson', { defaultValue: 'Failed to delete.' }));
    },
  });

  const commitTitle = () => {
    const trimmed = title.trim();
    setEditingTitle(false);
    if (!trimmed) {
      setTitle(lecture?.title ?? '');
      return;
    }
    if (trimmed !== (lecture?.title ?? '')) {
      updateMutation.mutate({ title: trimmed });
    }
  };

  const commitDuration = (value: number) => {
    if (value === (lecture?.duration ?? 0)) return;
    updateMutation.mutate({ duration: value });
  };

  const commitDescription = () => {
    const next = description.trim();
    if (next === ((lecture as { description?: string })?.description ?? '')) return;
    updateMutation.mutate({ description: next });
  };

  // ─── Create mode — nothing is written until "Create" is clicked ──────────
  const createMutation = useMutation({
    mutationFn: () =>
      coursesApi.createLecture(Number(moduleId), { title: title.trim(), description: description.trim() || undefined, contentType, duration, isFree: false, isPublished } as never),
    onSuccess: (created: { id: number }) => {
      queryClient.invalidateQueries({ queryKey: ['courseDetails', courseId] });
      queryClient.invalidateQueries({ queryKey: ['course', courseId] });
      toast.success(t('teaching:lesson_created', { defaultValue: 'Lesson created' }));
      navigate(`/teach/courses/${courseId}/lectures/${created.id}`, { replace: true });
    },
    onError: () => toast.error(t('teaching:failed_to_save_lesson', { defaultValue: 'Failed to save.' })),
  });

  if (isNew) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 md:py-8">
        <div className="mb-4">
          <Breadcrumb
            items={[
              { label: t('navigation:courses', { defaultValue: 'Courses' }), href: '/courses' },
              { label: course?.title ?? '…', href: `/courses/${courseId}` },
              { label: t('new_lesson', { defaultValue: 'New lesson' }) },
            ]}
          />
        </div>
        <Card>
          <CardBody className="space-y-5">
            <Input
              label={t('lesson_title', { defaultValue: 'Lesson title' })}
              value={title}
              onChange={e => setTitle(e.target.value)}
              required
            />
            <TextArea
              label={t('description', { defaultValue: 'Description' })}
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={2}
              placeholder={t('description_placeholder', { defaultValue: 'Add a short description (shown on the course page)…' })}
            />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <SearchableSelect
                label={t('content_type', { defaultValue: 'Content type' })}
                value={contentType}
                onChange={v => setContentType(v as 'text' | 'video' | 'mixed')}
                options={[
                  { value: 'text', label: t('content_type_text', { defaultValue: 'Text' }) },
                  { value: 'video', label: t('content_type_video', { defaultValue: 'Video' }) },
                  { value: 'mixed', label: t('content_type_mixed', { defaultValue: 'Mixed' }) },
                ]}
              />
              <Input
                type="number"
                label={t('duration_minutes', { defaultValue: 'Duration (minutes)' })}
                value={String(duration)}
                onChange={e => setDuration(parseInt(e.target.value) || 0)}
                min={0}
              />
            </div>
            <div className="flex items-center justify-between gap-2 pt-4 border-t border-gray-100 dark:border-gray-700">
              <Toggle
                checked={isPublished}
                onChange={setIsPublished}
                onLabel={t('common:published', { defaultValue: 'Published' })}
                offLabel={t('common:draft', { defaultValue: 'Draft' })}
              />
              <Button
                icon={<Save className="w-4 h-4" />}
                loading={createMutation.isPending}
                onClick={() => {
                  if (!title.trim()) { toast.error(t('title_required', { defaultValue: 'Title is required' })); return; }
                  createMutation.mutate();
                }}
              >
                {t('common:create', { defaultValue: 'Create' })}
              </Button>
            </div>
          </CardBody>
        </Card>
      </div>
    );
  }

  if (isLoading || !lecture) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <Loading text={t('common:loading', { defaultValue: 'Loading…' })} />
      </div>
    );
  }

  const muted = isDark ? '#9ca3af' : '#6b7280';
  const subtle = isDark ? '#cbd5e1' : '#374151';
  const titleColor = isDark ? '#f3f4f6' : '#111827';

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 md:py-8">
      <div className="mb-4">
        <Breadcrumb
          items={[
            { label: t('navigation:courses', { defaultValue: 'Courses' }), href: '/courses' },
            // Course name links to the course VIEW page (not setup).
            { label: course?.title ?? '…', href: `/courses/${courseId}` },
            { label: lecture.title ?? t('teaching:lesson', { defaultValue: 'Lesson' }) },
          ]}
        />
      </div>

      {/* Header strip — inline-editable title + duration + type + menu */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        {editingTitle ? (
          <input
            ref={titleInputRef}
            autoFocus
            type="text"
            value={title}
            onChange={e => setTitle(e.target.value)}
            onBlur={commitTitle}
            onKeyDown={e => {
              if (e.key === 'Enter') commitTitle();
              if (e.key === 'Escape') { setTitle(lecture.title ?? ''); setEditingTitle(false); }
            }}
            className="flex-1 min-w-[200px] text-2xl sm:text-3xl font-bold bg-transparent border-b-2 outline-none px-1"
            style={{ color: titleColor, borderColor: '#0d9488' }}
          />
        ) : (
          <button
            type="button"
            onClick={() => setEditingTitle(true)}
            className="flex-1 min-w-[200px] text-left text-2xl sm:text-3xl font-bold leading-tight truncate rounded px-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-400 hover:opacity-80 transition-opacity"
            style={{ color: titleColor }}
            title={t('common:edit', { defaultValue: 'Edit' })}
          >
            {title || t('teaching:untitled_lesson', { defaultValue: 'Untitled lesson' })}
          </button>
        )}

        {/* Content type */}
        <div className="w-40 shrink-0">
          <SearchableSelect
            value={lecture.contentType ?? 'mixed'}
            onChange={v => updateMutation.mutate({ contentType: v })}
            options={[
              { value: 'text', label: t('content_type_text', { defaultValue: 'Text' }) },
              { value: 'video', label: t('content_type_video', { defaultValue: 'Video' }) },
              { value: 'mixed', label: t('content_type_mixed', { defaultValue: 'Mixed' }) },
            ]}
          />
        </div>

        {/* Duration */}
        <div
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-sm shrink-0"
          style={{ color: muted, backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : '#f3f4f6' }}
        >
          <Clock className="w-3.5 h-3.5" />
          <input
            type="number"
            min={0}
            value={duration}
            onChange={e => setDuration(parseInt(e.target.value) || 0)}
            onBlur={() => commitDuration(duration)}
            aria-label={t('duration_minutes', { defaultValue: 'Duration (minutes)' })}
            className="w-12 bg-transparent outline-none text-right tabular-nums rounded focus-visible:ring-2 focus-visible:ring-teal-400"
            style={{ color: subtle }}
          />
          <span>{t('min', { defaultValue: 'min' })}</span>
        </div>

        {/* Publish / draft */}
        <Toggle
          checked={isPublished}
          onChange={v => { setIsPublished(v); updateMutation.mutate({ isPublished: v }); }}
          onLabel={t('common:published', { defaultValue: 'Published' })}
          offLabel={t('common:draft', { defaultValue: 'Draft' })}
          className="shrink-0"
        />

        <Button
          icon={<Save className="w-4 h-4" />}
          loading={saving}
          onClick={handleSave}
          className="shrink-0"
        >
          {t('common:save', { defaultValue: 'Save' })}
        </Button>

        <div className="relative shrink-0">
          <button
            type="button"
            onClick={() => setMenuOpen(o => !o)}
            aria-label={t('common:more_options', { defaultValue: 'More options' })}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            className="inline-flex items-center justify-center w-8 h-8 rounded-lg transition-colors hover:bg-black/5 dark:hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-400"
            style={{ color: muted }}
          >
            <MoreHorizontal className="w-4 h-4" />
          </button>
          {menuOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
              <div
                className="absolute right-0 mt-1 w-44 rounded-lg shadow-lg py-1 z-20 text-sm"
                style={{
                  backgroundColor: isDark ? '#1f2937' : '#ffffff',
                  border: `1px solid ${isDark ? '#374151' : '#e5e7eb'}`,
                }}
              >
                <button
                  type="button"
                  onClick={() => { setDeleteOpen(true); setMenuOpen(false); }}
                  className="w-full text-left px-3 py-2 hover:bg-black/5 dark:hover:bg-white/5 focus:outline-none focus-visible:bg-black/5 dark:focus-visible:bg-white/5 text-red-600 dark:text-red-400 inline-flex items-center gap-2"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  {t('teaching:delete_lesson', { defaultValue: 'Delete lesson' })}
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Lesson description — shown under the lesson on the course front page. */}
      <textarea
        value={description}
        onChange={e => setDescription(e.target.value)}
        onBlur={commitDescription}
        rows={2}
        placeholder={t('description_placeholder', { defaultValue: 'Add a short description (shown on the course page)…' })}
        className="w-full mb-4 px-3 py-2 text-sm rounded-lg border outline-none focus:ring-2 focus:ring-teal-400 resize-none"
        style={{
          backgroundColor: isDark ? '#1f2937' : '#ffffff',
          borderColor: isDark ? '#374151' : '#e5e7eb',
          color: isDark ? '#f3f4f6' : '#111827',
        }}
      />

      {/* Same rich-text editor as the student page (read-only there) — bold/
          italic/lists/links + image / video / chatbot / video embed. */}
      <SectionListEditor ref={editorRef} lectureId={lecId} initialSections={lecture.sections ?? []} courseId={courseId} legacyContent={(lecture as { content?: string }).content ?? ''} />

      <ConfirmDialog
        isOpen={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={() => { deleteMutation.mutate(); setDeleteOpen(false); }}
        title={t('teaching:delete_lesson', { defaultValue: 'Delete lesson' })}
        message={t('teaching:delete_lesson_confirm', {
          title: lecture.title ?? '',
          defaultValue: 'Delete "{{title}}"? This will remove all of its content.',
        })}
        confirmText={t('common:delete')}
        loading={deleteMutation.isPending}
      />
    </div>
  );
};
