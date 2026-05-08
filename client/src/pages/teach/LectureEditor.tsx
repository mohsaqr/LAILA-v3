import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Clock, MoreHorizontal, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { coursesApi } from '../../api/courses';
import { Loading } from '../../components/common/Loading';
import { Breadcrumb } from '../../components/common/Breadcrumb';
import { ConfirmDialog } from '../../components/common/ConfirmDialog';
import { useTheme } from '../../hooks/useTheme';
import { BlockStream } from '../../components/teach/lecture-blocks';
import activityLogger from '../../services/activityLogger';

/**
 * Lecture editor — single continuous block-based canvas.
 *
 * Header: inline-editable title + duration + a "..." menu (delete).
 * Body: BlockStream renders the section list (text / file / chatbot)
 * with an inline + Text · + File · + Chatbot inserter between every
 * pair of blocks plus drag-and-drop reordering.
 */
export const LectureEditor = () => {
  const { t } = useTranslation(['teaching', 'common', 'navigation']);
  const { id, lectureId } = useParams<{ id: string; lectureId: string }>();
  const courseId = parseInt(id!, 10);
  const lecId = parseInt(lectureId!, 10);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { isDark } = useTheme();

  const [title, setTitle] = useState('');
  const [duration, setDuration] = useState(0);
  const [editingTitle, setEditingTitle] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const titleInputRef = useRef<HTMLInputElement>(null);

  const { data: lecture, isLoading } = useQuery({
    queryKey: ['lecture', lecId],
    queryFn: () => coursesApi.getLectureById(lecId),
    enabled: !!lecId,
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
    setDuration(lecture.duration ?? 0);
  }, [lecture]);

  const updateMutation = useMutation({
    mutationFn: (data: { title?: string; duration?: number }) =>
      coursesApi.updateLecture(lecId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lecture', lecId] });
      queryClient.invalidateQueries({ queryKey: ['courseDetails', courseId] });
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
      navigate(`/teach/courses/${courseId}/curriculum`);
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

  if (isLoading || !lecture) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <Loading text={t('common:loading', { defaultValue: 'Loading…' })} />
      </div>
    );
  }

  const muted = isDark ? '#9ca3af' : '#6b7280';
  const subtle = isDark ? '#cbd5e1' : '#374151';
  const titleColor = isDark ? '#f3f4f6' : '#111827';

  return (
    <div className="min-h-screen" style={{ backgroundColor: isDark ? '#0b1220' : '#f8fafc' }}>
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6 md:py-8">
        <div className="mb-6">
          <Breadcrumb
            items={[
              { label: t('navigation:courses'), href: '/teach' },
              { label: course?.title ?? '…', href: `/teach/courses/${courseId}/curriculum` },
              { label: lecture.title ?? t('teaching:lesson', { defaultValue: 'Lesson' }) },
            ]}
          />
        </div>

        {/* Slim back link */}
        <button
          type="button"
          onClick={() => navigate(`/teach/courses/${courseId}/curriculum`)}
          className="inline-flex items-center gap-1.5 text-sm font-medium mb-4 transition-colors"
          style={{ color: muted }}
        >
          <ArrowLeft className="w-4 h-4" />
          {t('teaching:curriculum_editor', { defaultValue: 'Curriculum' })}
        </button>

        {/* Header strip — inline-editable title + duration + menu */}
        <div className="flex items-center gap-3 mb-6">
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
              className="flex-1 text-2xl sm:text-3xl font-bold bg-transparent border-b-2 outline-none px-1"
              style={{
                color: titleColor,
                borderColor: '#0d9488',
              }}
            />
          ) : (
            <button
              type="button"
              onClick={() => setEditingTitle(true)}
              className="flex-1 text-left text-2xl sm:text-3xl font-bold leading-tight truncate"
              style={{ color: titleColor }}
            >
              {title || t('teaching:untitled_lesson', { defaultValue: 'Untitled lesson' })}
            </button>
          )}

          <div
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-sm shrink-0"
            style={{
              color: muted,
              backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : '#f3f4f6',
            }}
          >
            <Clock className="w-3.5 h-3.5" />
            <input
              type="number"
              min={0}
              value={duration}
              onChange={e => setDuration(parseInt(e.target.value) || 0)}
              onBlur={() => commitDuration(duration)}
              className="w-12 bg-transparent outline-none text-right tabular-nums"
              style={{ color: subtle }}
            />
            <span>min</span>
          </div>

          <div className="relative shrink-0">
            <button
              type="button"
              onClick={() => setMenuOpen(o => !o)}
              aria-label={t('common:more_options', { defaultValue: 'More options' })}
              className="inline-flex items-center justify-center w-8 h-8 rounded-lg transition-colors"
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
                    className="w-full text-left px-3 py-2 hover:bg-black/5 dark:hover:bg-white/5 text-red-600 dark:text-red-400 inline-flex items-center gap-2"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    {t('teaching:delete_lesson', { defaultValue: 'Delete lesson' })}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

        <BlockStream lectureId={lecId} initialSections={lecture.sections ?? []} />
      </div>

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
