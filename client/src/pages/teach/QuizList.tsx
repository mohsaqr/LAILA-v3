import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Edit, Eye, EyeOff, FileQuestion, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { Breadcrumb } from '../../components/common/Breadcrumb';
import { buildTeachingListBreadcrumb } from '../../utils/breadcrumbs';
import { ConfirmDialog } from '../../components/common/ConfirmDialog';
import { DataTable, type ColumnDef } from '../../components/common/DataTable';
import { RowMenu } from '../../components/common/RowMenu';
import { coursesApi } from '../../api/courses';
import { resolveFileUrl } from '../../api/client';
import { quizzesApi, type InstructorQuiz } from '../../api/quizzes';

export const QuizList = () => {
  const { t } = useTranslation(['teaching', 'common', 'navigation']);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const courseIdParam = searchParams.get('courseId');

  const [deleteTarget, setDeleteTarget] = useState<InstructorQuiz | null>(null);

  const { data: allQuizzes = [], isLoading } = useQuery({
    queryKey: ['quizzes', 'instructor'],
    queryFn: () => quizzesApi.getInstructorQuizzes(),
  });

  // When reached from a course's curriculum the list is scoped to that
  // course via ?courseId= (and the breadcrumb gains a course crumb).
  const quizzes = courseIdParam
    ? allQuizzes.filter(q => String(q.courseId) === courseIdParam)
    : allQuizzes;

  // Owned courses feed the "Filter by course" select. Cached query —
  // also used by TeachDashboard, so this is usually a hit.
  const { data: myCourses = [] } = useQuery({
    queryKey: ['my-courses'],
    queryFn: () => coursesApi.getMyCourses(),
  });

  const togglePublishMutation = useMutation({
    mutationFn: ({ id, isPublished }: { id: number; isPublished: boolean }) =>
      quizzesApi.updateQuiz(id, { isPublished }),
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: ['quizzes', 'instructor'] });
      toast.success(
        vars.isPublished
          ? t('teaching:quiz_published', { defaultValue: 'Quiz published' })
          : t('teaching:quiz_unpublished', { defaultValue: 'Quiz unpublished' }),
      );
    },
    onError: () =>
      toast.error(
        t('teaching:failed_to_update_quiz', { defaultValue: 'Failed to update quiz' }),
      ),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => quizzesApi.deleteQuiz(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quizzes', 'instructor'] });
      toast.success(t('teaching:quiz_deleted'));
      setDeleteTarget(null);
    },
    onError: () => toast.error(t('teaching:failed_to_delete_quiz')),
  });

  const columns: ColumnDef<InstructorQuiz>[] = [
    {
      id: 'title',
      header: t('teaching:quiz_column_quiz', { defaultValue: 'Quiz' }),
      sortAccessor: q => q.title.toLowerCase(),
      width: '32%',
      cell: q => (
        <Link
          to={`/teach/courses/${q.courseId}/quizzes/${q.id}`}
          className="block truncate font-normal text-gray-700 dark:text-gray-200 hover:text-teal-600 dark:hover:text-teal-400"
          title={q.title}
        >
          {q.title}
        </Link>
      ),
    },
    {
      id: 'course',
      header: t('teaching:quiz_column_course', { defaultValue: 'Course' }),
      sortAccessor: q => q.courseName.toLowerCase(),
      width: '30%',
      filter: {
        kind: 'select',
        options: myCourses.map(c => ({
          value: String(c.id),
          label: c.title,
        })),
        predicate: (q, v) => String(q.courseId) === v,
      },
      cell: q => {
        const thumb = q.courseThumbnail
          ? resolveFileUrl(q.courseThumbnail) || q.courseThumbnail
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
              title={q.courseName}
            >
              {q.courseName}
            </span>
          </div>
        );
      },
    },
    {
      id: 'time',
      header: t('teaching:quiz_column_time', { defaultValue: 'Time' }),
      sortAccessor: q => q.timeLimit,
      align: 'right',
      hideOnMobile: true,
      width: '6rem',
      cell: q => (
        <span className="text-gray-600 dark:text-gray-300 tabular-nums">
          {q.timeLimit ?? '—'}
        </span>
      ),
    },
    {
      id: 'maxAttempts',
      header: t('teaching:quiz_column_attempts_short', { defaultValue: 'Attempts' }),
      sortAccessor: q => q.maxAttempts,
      align: 'right',
      hideOnMobile: true,
      width: '6rem',
      cell: q => (
        <span className="text-gray-600 dark:text-gray-300 tabular-nums">
          {q.maxAttempts}
        </span>
      ),
    },
    {
      id: 'participants',
      header: t('teaching:quiz_column_participants_short', { defaultValue: 'People' }),
      sortAccessor: q => q.participantCount,
      align: 'right',
      width: '5.5rem',
      cell: q => (
        <span className="text-gray-600 dark:text-gray-300 tabular-nums">
          {q.participantCount}
        </span>
      ),
    },
    {
      id: 'questions',
      header: t('teaching:quiz_column_questions', { defaultValue: 'Questions' }),
      sortAccessor: q => q.questionCount,
      align: 'right',
      width: '7rem',
      cell: q => (
        <span className="text-gray-600 dark:text-gray-300 tabular-nums">
          {q.questionCount}
        </span>
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
                  t('navigation:quizzes'),
                  courseIdParam,
                  myCourses.find(c => String(c.id) === courseIdParam)?.title ||
                    quizzes[0]?.courseName ||
                    t('navigation:quizzes'),
                )
              : [{ label: t('navigation:quizzes') }]
          }
        />
      </div>

      <DataTable<InstructorQuiz>
        rows={quizzes}
        columns={columns}
        rowKey={q => q.id}
        isLoading={isLoading}
        pageSize={20}
        globalSearch={{
          placeholder: t('teaching:search_quizzes_placeholder', {
            defaultValue: 'Search by quiz or course…',
          }),
          predicate: (q, query) => {
            const lower = query.toLowerCase();
            return (
              q.title.toLowerCase().includes(lower) ||
              q.courseName.toLowerCase().includes(lower)
            );
          },
        }}
        empty={
          <div className="flex items-center justify-center gap-2 py-6 text-sm text-gray-500 dark:text-gray-400">
            <FileQuestion className="w-4 h-4" />
            <span>{t('teaching:quizzes_appear_here')}</span>
          </div>
        }
        rowActions={q => (
          <RowMenu
            items={[
              {
                key: 'edit',
                label: t('common:edit', { defaultValue: 'Edit' }),
                icon: <Edit className="w-3.5 h-3.5" />,
                onClick: () =>
                  navigate(`/teach/courses/${q.courseId}/quizzes/${q.id}`),
              },
              {
                key: 'publish',
                label: q.isPublished
                  ? t('teaching:unpublish', { defaultValue: 'Unpublish' })
                  : t('teaching:publish', { defaultValue: 'Publish' }),
                icon: q.isPublished ? (
                  <EyeOff className="w-3.5 h-3.5" />
                ) : (
                  <Eye className="w-3.5 h-3.5" />
                ),
                onClick: () =>
                  togglePublishMutation.mutate({
                    id: q.id,
                    isPublished: !q.isPublished,
                  }),
              },
              {
                key: 'delete',
                label: t('common:delete', { defaultValue: 'Delete' }),
                icon: <Trash2 className="w-3.5 h-3.5" />,
                onClick: () => setDeleteTarget(q),
                destructive: true,
              },
            ]}
          />
        )}
      />

      {/* Delete confirmation */}
      <ConfirmDialog
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
        title={t('teaching:confirm_delete_quiz_title', { defaultValue: 'Delete quiz?' })}
        message={t('teaching:confirm_delete_quiz_body', {
          defaultValue: 'This deletes the quiz and all its questions and attempts.',
          title: deleteTarget?.title,
        })}
        confirmText={t('common:delete', { defaultValue: 'Delete' })}
        loading={deleteMutation.isPending}
      />
    </div>
  );
};

