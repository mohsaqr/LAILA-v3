import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Edit, Eye, EyeOff, MessageSquare, Pin, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { Breadcrumb } from '../../components/common/Breadcrumb';
import { buildTeachingListBreadcrumb } from '../../utils/breadcrumbs';
import { ConfirmDialog } from '../../components/common/ConfirmDialog';
import { DataTable, type ColumnDef } from '../../components/common/DataTable';
import { RowMenu } from '../../components/common/RowMenu';
import { ForumWizardModal, type ForumWizardFormData } from '../../components/teach/ForumWizardModal';
import { coursesApi } from '../../api/courses';
import { resolveFileUrl } from '../../api/client';
import { forumsApi, type InstructorForumThread } from '../../api/forums';

export const TeachForumList = () => {
  const { t } = useTranslation(['teaching', 'common', 'navigation']);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const courseIdParam = searchParams.get('courseId');

  const [deleteTarget, setDeleteTarget] = useState<InstructorForumThread | null>(null);
  const [editTarget, setEditTarget] = useState<InstructorForumThread | null>(null);
  const [editForm, setEditForm] = useState<ForumWizardFormData>({
    title: '',
    content: '',
    isPublished: true,
    allowAnonymous: false,
  });

  const openEditModal = (row: InstructorForumThread) => {
    setEditTarget(row);
    setEditForm({
      title: row.title,
      content: row.content,
      isPublished: row.isPublished,
      allowAnonymous: row.allowAnonymous,
    });
  };

  const closeEditModal = () => {
    setEditTarget(null);
    setEditForm({ title: '', content: '', isPublished: true, allowAnonymous: false });
  };

  const { data: allThreads = [], isLoading } = useQuery({
    queryKey: ['forums', 'instructor'],
    queryFn: () => forumsApi.getInstructorForumThreads(),
  });

  // Scoped to a single course when reached from a curriculum link.
  const threads = courseIdParam
    ? allThreads.filter(th => String(th.courseId) === courseIdParam)
    : allThreads;

  // Courses for the filter dropdown (cached — also used by /teach/quizzes).
  const { data: myCourses = [] } = useQuery({
    queryKey: ['my-courses'],
    queryFn: () => coursesApi.getMyCourses(),
  });

  const togglePublishMutation = useMutation({
    mutationFn: ({ id, isPublished }: { id: number; isPublished: boolean }) =>
      forumsApi.updateForum(id, { isPublished }),
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: ['forums', 'instructor'] });
      toast.success(
        vars.isPublished
          ? t('teaching:forum_published', { defaultValue: 'Forum published' })
          : t('teaching:forum_unpublished', { defaultValue: 'Forum unpublished' }),
      );
    },
    onError: () =>
      toast.error(
        t('teaching:failed_update_forum', { defaultValue: 'Failed to update forum' }),
      ),
  });

  const togglePinMutation = useMutation({
    mutationFn: ({ id, isPinned }: { id: number; isPinned: boolean }) =>
      forumsApi.pinThread(id, isPinned),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['forums', 'instructor'] });
    },
    onError: () =>
      toast.error(
        t('teaching:failed_update_forum', { defaultValue: 'Failed to update forum' }),
      ),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: ForumWizardFormData }) =>
      forumsApi.updateForum(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['forums', 'instructor'] });
      toast.success(t('teaching:forum_updated_success', { defaultValue: 'Forum updated' }));
      closeEditModal();
    },
    onError: () =>
      toast.error(
        t('teaching:failed_update_forum', { defaultValue: 'Failed to update forum' }),
      ),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => forumsApi.deleteForum(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['forums', 'instructor'] });
      toast.success(t('teaching:forum_deleted_success', { defaultValue: 'Forum deleted' }));
      setDeleteTarget(null);
    },
    onError: () =>
      toast.error(
        t('teaching:failed_delete_forum', { defaultValue: 'Failed to delete forum' }),
      ),
  });

  const columns: ColumnDef<InstructorForumThread>[] = [
    {
      id: 'title',
      header: t('teaching:forum_title', { defaultValue: 'Forum' }),
      sortAccessor: t => t.title.toLowerCase(),
      width: '38%',
      cell: t => (
        <Link
          to={`/courses/${t.courseId}/forums/${t.id}`}
          className="block truncate font-normal text-gray-700 dark:text-gray-200 hover:text-teal-600 dark:hover:text-teal-400"
          title={t.title}
        >
          {t.title}
        </Link>
      ),
    },
    {
      id: 'course',
      header: t('teaching:quiz_column_course', { defaultValue: 'Course' }),
      sortAccessor: t => t.courseName.toLowerCase(),
      width: '30%',
      filter: {
        kind: 'select',
        options: myCourses.map(c => ({
          value: String(c.id),
          label: c.title,
        })),
        predicate: (t, v) => String(t.courseId) === v,
      },
      cell: t => {
        const thumb = t.courseThumbnail
          ? resolveFileUrl(t.courseThumbnail) || t.courseThumbnail
          : null;
        return (
          <div className="flex items-center gap-2 min-w-0">
            {thumb ? (
              <img
                src={thumb}
                alt=""
                aria-hidden="true"
                className="w-6 h-6 rounded object-cover flex-shrink-0"
              />
            ) : (
              <div
                className="w-6 h-6 rounded flex-shrink-0"
                style={{ backgroundColor: 'rgba(8,143,143,0.18)' }}
                aria-hidden="true"
              />
            )}
            <span
              className="truncate text-gray-600 dark:text-gray-300"
              title={t.courseName}
            >
              {t.courseName}
            </span>
          </div>
        );
      },
    },
    {
      id: 'replies',
      header: t('teaching:responses', { defaultValue: 'Replies' }),
      sortAccessor: t => t.replyCount,
      align: 'right',
      width: '7rem',
      cell: t => (
        <span className="text-gray-600 dark:text-gray-300 tabular-nums">
          {t.replyCount}
        </span>
      ),
    },
    {
      id: 'pinned',
      header: t('teaching:pinned', { defaultValue: 'Pinned' }),
      sortAccessor: t => (t.isPinned ? 1 : 0),
      align: 'center',
      width: '5.5rem',
      hideOnMobile: true,
      cell: t =>
        t.isPinned ? (
          <Pin className="inline-block w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
        ) : (
          <span className="text-gray-400">—</span>
        ),
    },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 md:py-8">
      <div className="mb-6">
        <Breadcrumb
          homeHref="/"
          items={
            courseIdParam
              ? buildTeachingListBreadcrumb(
                  t('navigation:forums', { defaultValue: 'Forums' }),
                  courseIdParam,
                  myCourses.find(c => String(c.id) === courseIdParam)?.title ||
                    threads[0]?.courseName ||
                    t('navigation:forums', { defaultValue: 'Forums' }),
                )
              : [{ label: t('navigation:forums', { defaultValue: 'Forums' }) }]
          }
        />
      </div>

      <DataTable<InstructorForumThread>
        rows={threads}
        columns={columns}
        rowKey={t => t.id}
        isLoading={isLoading}
        pageSize={20}
        globalSearch={{
          placeholder: t('teaching:search_forums_placeholder', {
            defaultValue: 'Search forums…',
          }),
          predicate: (row, q) => {
            const lower = q.toLowerCase();
            return (
              row.title.toLowerCase().includes(lower) ||
              row.courseName.toLowerCase().includes(lower)
            );
          },
        }}
        empty={
          <div className="flex items-center justify-center gap-2 py-6 text-sm text-gray-500 dark:text-gray-400">
            <MessageSquare className="w-4 h-4" />
            <span>{t('teaching:no_forums_created', { defaultValue: 'Forums appear here once you create them from your courses.' })}</span>
          </div>
        }
        rowActions={row => (
          <RowMenu
            items={[
              {
                key: 'open',
                label: t('teaching:view_forum', { defaultValue: 'View' }),
                icon: <Eye className="w-3.5 h-3.5" />,
                onClick: () => navigate(`/courses/${row.courseId}/forums/${row.id}`),
              },
              {
                key: 'edit',
                label: t('common:edit', { defaultValue: 'Edit' }),
                icon: <Edit className="w-3.5 h-3.5" />,
                onClick: () => openEditModal(row),
              },
              {
                key: 'publish',
                label: row.isPublished
                  ? t('teaching:unpublish', { defaultValue: 'Unpublish' })
                  : t('teaching:publish', { defaultValue: 'Publish' }),
                icon: row.isPublished ? (
                  <EyeOff className="w-3.5 h-3.5" />
                ) : (
                  <Eye className="w-3.5 h-3.5" />
                ),
                onClick: () =>
                  togglePublishMutation.mutate({ id: row.id, isPublished: !row.isPublished }),
              },
              {
                key: 'pin',
                label: row.isPinned
                  ? t('teaching:unpin', { defaultValue: 'Unpin' })
                  : t('teaching:pin', { defaultValue: 'Pin' }),
                icon: <Pin className="w-3.5 h-3.5" />,
                onClick: () =>
                  togglePinMutation.mutate({ id: row.id, isPinned: !row.isPinned }),
              },
              {
                key: 'delete',
                label: t('common:delete', { defaultValue: 'Delete' }),
                icon: <Trash2 className="w-3.5 h-3.5" />,
                onClick: () => setDeleteTarget(row),
                destructive: true,
              },
            ]}
          />
        )}
      />

      <ConfirmDialog
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
        title={t('teaching:delete_forum', { defaultValue: 'Delete forum?' })}
        message={t('teaching:delete_forum_threads_warning', {
          defaultValue: 'This deletes the discussion and every reply under it.',
        })}
        confirmText={t('common:delete', { defaultValue: 'Delete' })}
        loading={deleteMutation.isPending}
      />

      {/* Inline edit wizard — opens pre-filled from the row action. */}
      <ForumWizardModal
        isOpen={!!editTarget}
        isEdit
        courseTitle={editTarget?.courseName ?? ''}
        form={editForm}
        setForm={updater => setEditForm(updater)}
        isSubmitting={updateMutation.isPending}
        onClose={closeEditModal}
        onSubmit={() =>
          editTarget && updateMutation.mutate({ id: editTarget.id, data: editForm })
        }
      />
    </div>
  );
};
