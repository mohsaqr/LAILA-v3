import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Edit, Eye, EyeOff, ClipboardList, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { Breadcrumb } from '../../components/common/Breadcrumb';
import { buildTeachingListBreadcrumb } from '../../utils/breadcrumbs';
import { ConfirmDialog } from '../../components/common/ConfirmDialog';
import { DataTable, type ColumnDef } from '../../components/common/DataTable';
import { RowMenu } from '../../components/common/RowMenu';
import { coursesApi } from '../../api/courses';
import { resolveFileUrl } from '../../api/client';
import { assignmentsApi, type InstructorAssignment } from '../../api/assignments';

export const AssignmentList = () => {
  const { t } = useTranslation(['teaching', 'common', 'navigation']);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const courseIdParam = searchParams.get('courseId');

  const [deleteTarget, setDeleteTarget] = useState<InstructorAssignment | null>(null);

  const { data: allAssignments = [], isLoading } = useQuery({
    queryKey: ['assignments', 'instructor'],
    queryFn: () => assignmentsApi.getInstructorAssignments(),
  });

  // Scoped to a single course when reached from a curriculum link.
  const assignments = courseIdParam
    ? allAssignments.filter(a => String(a.courseId) === courseIdParam)
    : allAssignments;

  // Owned courses feed the "Filter by course" select (cached query —
  // shared with /teach/quizzes & /teach/forums).
  const { data: myCourses = [] } = useQuery({
    queryKey: ['my-courses'],
    queryFn: () => coursesApi.getMyCourses(),
  });

  const togglePublishMutation = useMutation({
    mutationFn: ({ id, isPublished }: { id: number; isPublished: boolean }) =>
      assignmentsApi.updateAssignment(id, { isPublished }),
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: ['assignments', 'instructor'] });
      toast.success(
        vars.isPublished
          ? t('teaching:assignment_published')
          : t('teaching:assignment_unpublished'),
      );
    },
    onError: () => toast.error(t('teaching:failed_to_update_assignment')),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => assignmentsApi.deleteAssignment(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assignments', 'instructor'] });
      toast.success(t('teaching:assignment_deleted'));
      setDeleteTarget(null);
    },
    onError: () => toast.error(t('teaching:failed_to_delete_assignment')),
  });

  const openAssignment = (a: InstructorAssignment) =>
    `/teach/courses/${a.courseId}/assignments/${a.id}/submissions`;

  const columns: ColumnDef<InstructorAssignment>[] = [
    {
      id: 'title',
      header: t('teaching:assignment_column_assignment'),
      sortAccessor: a => a.title.toLowerCase(),
      width: '32%',
      cell: a => (
        <Link
          to={openAssignment(a)}
          className="block truncate font-normal text-gray-700 dark:text-gray-200 hover:text-teal-600 dark:hover:text-teal-400"
          title={a.title}
        >
          {a.title}
        </Link>
      ),
    },
    {
      id: 'course',
      header: t('teaching:quiz_column_course', { defaultValue: 'Course' }),
      sortAccessor: a => a.courseName.toLowerCase(),
      width: '28%',
      filter: {
        kind: 'select',
        options: myCourses.map(c => ({ value: String(c.id), label: c.title })),
        predicate: (a, v) => String(a.courseId) === v,
      },
      cell: a => {
        const thumb = a.courseThumbnail
          ? resolveFileUrl(a.courseThumbnail) || a.courseThumbnail
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
            <span className="truncate text-gray-600 dark:text-gray-300" title={a.courseName}>
              {a.courseName}
            </span>
          </div>
        );
      },
    },
    {
      id: 'type',
      header: t('teaching:assignment_column_type'),
      sortAccessor: a => a.submissionType,
      hideOnMobile: true,
      width: '8rem',
      cell: a => (
        <span className="capitalize text-gray-600 dark:text-gray-300">
          {a.submissionType.replace('_', ' ')}
        </span>
      ),
    },
    {
      id: 'due',
      header: t('teaching:assignment_column_due'),
      sortAccessor: a => (a.dueDate ? new Date(a.dueDate).getTime() : 0),
      align: 'right',
      hideOnMobile: true,
      width: '11rem',
      cell: a => (
        <span className="text-gray-600 dark:text-gray-300 tabular-nums">
          {a.dueDate
            ? new Date(a.dueDate).toLocaleString(undefined, {
                dateStyle: 'medium',
                timeStyle: 'short',
              })
            : '—'}
        </span>
      ),
    },
    {
      id: 'points',
      header: t('teaching:assignment_column_points'),
      sortAccessor: a => a.points,
      align: 'right',
      hideOnMobile: true,
      width: '6rem',
      cell: a => (
        <span className="text-gray-600 dark:text-gray-300 tabular-nums">{a.points}</span>
      ),
    },
    {
      id: 'submissions',
      header: t('teaching:assignment_column_submissions'),
      sortAccessor: a => a.submissionCount,
      align: 'right',
      width: '7rem',
      cell: a => (
        <span className="text-gray-600 dark:text-gray-300 tabular-nums">
          {a.submissionCount}
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
                  t('navigation:assignments'),
                  courseIdParam,
                  myCourses.find(c => String(c.id) === courseIdParam)?.title ||
                    assignments[0]?.courseName ||
                    t('navigation:assignments'),
                )
              : [{ label: t('navigation:assignments') }]
          }
        />
      </div>

      <DataTable<InstructorAssignment>
        rows={assignments}
        columns={columns}
        rowKey={a => a.id}
        isLoading={isLoading}
        pageSize={20}
        globalSearch={{
          placeholder: t('teaching:search_assignments_placeholder'),
          predicate: (a, query) => {
            const lower = query.toLowerCase();
            return (
              a.title.toLowerCase().includes(lower) ||
              a.courseName.toLowerCase().includes(lower)
            );
          },
        }}
        empty={
          <div className="flex items-center justify-center gap-2 py-6 text-sm text-gray-500 dark:text-gray-400">
            <ClipboardList className="w-4 h-4" />
            <span>{t('teaching:assignments_appear_here')}</span>
          </div>
        }
        rowActions={a => (
          <RowMenu
            items={[
              {
                key: 'edit',
                label: t('common:edit', { defaultValue: 'Edit' }),
                icon: <Edit className="w-3.5 h-3.5" />,
                onClick: () =>
                  navigate(`/teach/courses/${a.courseId}/setup?step=content`),
              },
              {
                key: 'submissions',
                label: t('teaching:submissions', { defaultValue: 'Submissions' }),
                icon: <ClipboardList className="w-3.5 h-3.5" />,
                onClick: () => navigate(openAssignment(a)),
              },
              {
                key: 'publish',
                label: a.isPublished
                  ? t('teaching:unpublish', { defaultValue: 'Unpublish' })
                  : t('teaching:publish', { defaultValue: 'Publish' }),
                icon: a.isPublished ? (
                  <EyeOff className="w-3.5 h-3.5" />
                ) : (
                  <Eye className="w-3.5 h-3.5" />
                ),
                onClick: () =>
                  togglePublishMutation.mutate({ id: a.id, isPublished: !a.isPublished }),
              },
              {
                key: 'delete',
                label: t('common:delete', { defaultValue: 'Delete' }),
                icon: <Trash2 className="w-3.5 h-3.5" />,
                onClick: () => setDeleteTarget(a),
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
        title={t('teaching:confirm_delete_assignment_title')}
        message={t('teaching:confirm_delete_assignment_body', { title: deleteTarget?.title })}
        confirmText={t('common:delete', { defaultValue: 'Delete' })}
        loading={deleteMutation.isPending}
      />
    </div>
  );
};
