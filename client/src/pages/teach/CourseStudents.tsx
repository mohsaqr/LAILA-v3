import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-hot-toast';
import { Activity as ActivityIcon, BarChart3, Trash2, Users } from 'lucide-react';
import { coursesApi } from '../../api/courses';
import { enrollmentManagementApi } from '../../api/enrollmentManagement';
import { Breadcrumb } from '../../components/common/Breadcrumb';
import { buildTeachingBreadcrumb } from '../../utils/breadcrumbs';
import { DataTable, type ColumnDef } from '../../components/common/DataTable';
import { RowMenu } from '../../components/common/RowMenu';
import { ConfirmDialog } from '../../components/common/ConfirmDialog';
import type { ManagedEnrollment } from '../../types';

const formatDate = (iso: string | null | undefined) =>
  iso
    ? new Date(iso).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      })
    : '-';

export const CourseStudents = () => {
  const { courseId: courseIdParam } = useParams();
  const courseId = Number(courseIdParam);
  const { t } = useTranslation(['teaching', 'common', 'navigation']);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [unenrollTarget, setUnenrollTarget] = useState<ManagedEnrollment | null>(null);

  const { data: course } = useQuery({
    queryKey: ['course', courseId],
    queryFn: () => coursesApi.getCourseById(courseId),
    enabled: !!courseId,
  });

  // Load the full roster once; DataTable handles search / sort / paging
  // client-side (matches the /teach/quizzes pattern).
  const { data, isLoading } = useQuery({
    queryKey: ['courseEnrollments', courseId, 'all'],
    queryFn: () => enrollmentManagementApi.getCourseEnrollments(courseId, 1, 1000),
    enabled: !!courseId,
  });

  const enrollments = (data?.enrollments ?? []).filter((e) => e.user);

  const unenrollMutation = useMutation({
    mutationFn: (userId: number) => enrollmentManagementApi.removeUserFromCourse(courseId, userId),
    onSuccess: () => {
      toast.success(t('teaching:student_removed', { defaultValue: 'Student removed from course' }));
      queryClient.invalidateQueries({ queryKey: ['courseEnrollments', courseId] });
      setUnenrollTarget(null);
    },
    onError: (err: any) => {
      toast.error(
        err?.message || t('teaching:remove_failed', { defaultValue: 'Failed to remove student' })
      );
      setUnenrollTarget(null);
    },
  });

  const breadcrumbItems = buildTeachingBreadcrumb(
    courseId,
    course?.title,
    t('teaching:students', { defaultValue: 'Students' })
  );

  const statusBadge = (status: ManagedEnrollment['status']) => (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium capitalize ${
        status === 'active'
          ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
          : status === 'completed'
          ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300'
          : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'
      }`}
    >
      {status}
    </span>
  );

  const columns: ColumnDef<ManagedEnrollment>[] = [
    {
      id: 'name',
      header: t('teaching:name', { defaultValue: 'Name' }),
      sortAccessor: (e) => e.user?.fullname.toLowerCase() ?? '',
      width: '24%',
      cell: (e) => (
        <span className="font-medium text-gray-900 dark:text-white truncate block" title={e.user?.fullname}>
          {e.user?.fullname}
        </span>
      ),
    },
    {
      id: 'email',
      header: t('teaching:email', { defaultValue: 'Email' }),
      sortAccessor: (e) => e.user?.email.toLowerCase() ?? '',
      width: '26%',
      cell: (e) => (
        <span className="text-gray-600 dark:text-gray-300 truncate block" title={e.user?.email}>
          {e.user?.email}
        </span>
      ),
    },
    {
      id: 'enrolled',
      header: t('teaching:enrolled', { defaultValue: 'Enrolled' }),
      sortAccessor: (e) => (e.enrolledAt ? new Date(e.enrolledAt).getTime() : 0),
      hideOnMobile: true,
      width: '9rem',
      cell: (e) => (
        <span className="text-gray-600 dark:text-gray-300 whitespace-nowrap">
          {formatDate(e.enrolledAt)}
        </span>
      ),
    },
    {
      id: 'progress',
      header: t('teaching:progress', { defaultValue: 'Progress' }),
      sortAccessor: (e) => Math.max(0, Math.min(100, Math.round(e.progress ?? 0))),
      align: 'right',
      width: '9rem',
      cell: (e) => {
        const pct = Math.max(0, Math.min(100, Math.round(e.progress ?? 0)));
        return (
          <div className="flex items-center gap-2 justify-end">
            <div className="w-20 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-primary-500 transition-[width] duration-300"
                style={{ width: `${pct}%` }}
              />
            </div>
            <span className="text-xs text-gray-500 dark:text-gray-400 w-9 text-right tabular-nums">
              {pct}%
            </span>
          </div>
        );
      },
    },
    {
      id: 'status',
      header: t('teaching:status', { defaultValue: 'Status' }),
      sortAccessor: (e) => e.status,
      width: '8rem',
      filter: {
        kind: 'select',
        options: [
          { value: 'active', label: t('teaching:status_active', { defaultValue: 'Active' }) },
          { value: 'completed', label: t('teaching:status_completed', { defaultValue: 'Completed' }) },
          { value: 'dropped', label: t('teaching:status_dropped', { defaultValue: 'Dropped' }) },
        ],
        predicate: (e, v) => e.status === v,
      },
      cell: (e) => statusBadge(e.status),
    },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 md:py-8">
      <div className="mb-6">
        <Breadcrumb homeHref="/" items={breadcrumbItems} />
      </div>

      <DataTable<ManagedEnrollment>
        rows={enrollments}
        columns={columns}
        rowKey={(e) => e.id}
        isLoading={isLoading}
        pageSize={20}
        globalSearch={{
          placeholder: t('teaching:search_students', {
            defaultValue: 'Search by name or email…',
          }),
          predicate: (e, query) => {
            const lower = query.toLowerCase();
            return (
              (e.user?.fullname.toLowerCase().includes(lower) ?? false) ||
              (e.user?.email.toLowerCase().includes(lower) ?? false)
            );
          },
        }}
        empty={
          <div className="flex items-center justify-center gap-2 py-6 text-sm text-gray-500 dark:text-gray-400">
            <Users className="w-4 h-4" />
            <span>
              {t('teaching:no_students_hint', {
                defaultValue: 'Students will appear here after they enroll.',
              })}
            </span>
          </div>
        }
        rowActions={(e) => (
          <RowMenu
            items={[
              {
                key: 'activity',
                label: t('teaching:activity', { defaultValue: 'Activity' }),
                icon: <BarChart3 className="w-3.5 h-3.5" />,
                onClick: () =>
                  navigate(`/teach/courses/${courseId}/students/${e.user!.id}/activity`),
              },
              {
                key: 'log',
                label: t('teaching:log', { defaultValue: 'Log' }),
                icon: <ActivityIcon className="w-3.5 h-3.5" />,
                onClick: () => navigate(`/teach/courses/${courseId}/logs?userId=${e.user!.id}`),
              },
              {
                key: 'unenroll',
                label: t('teaching:unenroll', { defaultValue: 'Unenroll' }),
                icon: <Trash2 className="w-3.5 h-3.5" />,
                onClick: () => setUnenrollTarget(e),
                destructive: true,
              },
            ]}
          />
        )}
      />

      {/* Unenroll confirmation */}
      <ConfirmDialog
        isOpen={!!unenrollTarget}
        onClose={() => setUnenrollTarget(null)}
        onConfirm={() => {
          if (unenrollTarget?.user) {
            unenrollMutation.mutate(unenrollTarget.user.id);
          }
        }}
        title={t('teaching:confirm_unenroll_title', { defaultValue: 'Remove student?' })}
        message={
          unenrollTarget?.user
            ? t('teaching:confirm_unenroll_message', {
                defaultValue:
                  'Remove {{name}} from this course? They will lose access to all course content.',
                name: unenrollTarget.user.fullname,
              })
            : ''
        }
        confirmText={t('teaching:unenroll', { defaultValue: 'Unenroll' })}
        variant="danger"
        loading={unenrollMutation.isPending}
      />
    </div>
  );
};
