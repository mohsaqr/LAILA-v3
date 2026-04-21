import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-hot-toast';
import {
  Activity as ActivityIcon,
  BarChart3,
  Search,
  Trash2,
  UserPlus,
  Users,
} from 'lucide-react';
import { coursesApi } from '../../api/courses';
import { enrollmentManagementApi } from '../../api/enrollmentManagement';
import { Breadcrumb } from '../../components/common/Breadcrumb';
import { buildTeachingBreadcrumb } from '../../utils/breadcrumbs';
import { Button } from '../../components/common/Button';
import { Card, CardBody } from '../../components/common/Card';
import { EmptyState } from '../../components/common/EmptyState';
import { Loading } from '../../components/common/Loading';
import { ConfirmDialog } from '../../components/common/ConfirmDialog';
import { AddToTeamModal } from '../../components/teach/AddToTeamModal';
import type { ManagedEnrollment } from '../../types';

const PAGE_SIZE = 20;

type StatusFilter = 'all' | 'active' | 'completed' | 'dropped';

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

  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [unenrollTarget, setUnenrollTarget] = useState<ManagedEnrollment | null>(null);
  const [teamTarget, setTeamTarget] = useState<ManagedEnrollment | null>(null);

  // Debounce search input
  useEffect(() => {
    const handle = setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(handle);
  }, [searchInput]);

  const { data: course } = useQuery({
    queryKey: ['course', courseId],
    queryFn: () => coursesApi.getCourseById(courseId),
    enabled: !!courseId,
  });

  const { data, isLoading } = useQuery({
    queryKey: ['courseEnrollments', courseId, page, search],
    queryFn: () =>
      enrollmentManagementApi.getCourseEnrollments(courseId, page, PAGE_SIZE, search || undefined),
    enabled: !!courseId,
  });

  const rawEnrollments = data?.enrollments ?? [];
  const pagination = data?.pagination;

  // Client-side status filter (server does not yet filter by status)
  const enrollments = useMemo(() => {
    if (statusFilter === 'all') return rawEnrollments;
    return rawEnrollments.filter((e) => e.status === statusFilter);
  }, [rawEnrollments, statusFilter]);

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

  const totalPages = pagination?.totalPages ?? 1;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 md:py-8">
      <div className="mb-6">
        <Breadcrumb homeHref="/" items={breadcrumbItems} />
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Users className="w-6 h-6" />
            {t('teaching:students', { defaultValue: 'Students' })}
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {pagination?.total != null
              ? t('teaching:x_enrolled', {
                  defaultValue: '{{count}} enrolled',
                  count: pagination.total,
                })
              : ''}
          </p>
        </div>
      </div>

      <Card>
        <CardBody>
          {/* Toolbar: search + status filter */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder={t('teaching:search_students', {
                  defaultValue: 'Search by name or email…',
                })}
                className="w-full pl-9 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="all">
                {t('teaching:all_statuses', { defaultValue: 'All statuses' })}
              </option>
              <option value="active">{t('teaching:active', { defaultValue: 'Active' })}</option>
              <option value="completed">
                {t('teaching:completed', { defaultValue: 'Completed' })}
              </option>
              <option value="dropped">{t('teaching:dropped', { defaultValue: 'Dropped' })}</option>
            </select>
          </div>

          {isLoading ? (
            <Loading />
          ) : enrollments.length === 0 ? (
            <EmptyState
              icon={Users}
              title={t('teaching:no_students', { defaultValue: 'No students enrolled' })}
              description={
                search || statusFilter !== 'all'
                  ? t('teaching:no_students_match', {
                      defaultValue: 'No students match your filters.',
                    })
                  : t('teaching:no_students_hint', {
                      defaultValue: 'Students will appear here after they enroll.',
                    })
              }
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-700 text-left text-xs uppercase tracking-wider text-gray-500 dark:text-gray-400">
                    <th className="py-2 px-3 font-medium">
                      {t('teaching:name', { defaultValue: 'Name' })}
                    </th>
                    <th className="py-2 px-3 font-medium">
                      {t('teaching:email', { defaultValue: 'Email' })}
                    </th>
                    <th className="py-2 px-3 font-medium">
                      {t('teaching:enrolled', { defaultValue: 'Enrolled' })}
                    </th>
                    <th className="py-2 px-3 font-medium">
                      {t('teaching:last_access', { defaultValue: 'Last access' })}
                    </th>
                    <th className="py-2 px-3 font-medium">
                      {t('teaching:progress', { defaultValue: 'Progress' })}
                    </th>
                    <th className="py-2 px-3 font-medium">
                      {t('teaching:status', { defaultValue: 'Status' })}
                    </th>
                    <th className="py-2 px-3 font-medium text-right">
                      {t('teaching:actions', { defaultValue: 'Actions' })}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {enrollments.map((e) => {
                    const user = e.user;
                    if (!user) return null;
                    return (
                      <tr
                        key={e.id}
                        className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50"
                      >
                        <td className="py-3 px-3 text-gray-900 dark:text-white font-medium whitespace-nowrap">
                          {user.fullname}
                        </td>
                        <td className="py-3 px-3 text-gray-600 dark:text-gray-300">{user.email}</td>
                        <td className="py-3 px-3 text-gray-600 dark:text-gray-300 whitespace-nowrap">
                          {formatDate(e.enrolledAt)}
                        </td>
                        <td className="py-3 px-3 text-gray-600 dark:text-gray-300 whitespace-nowrap">
                          {formatDate(e.lastAccessAt)}
                        </td>
                        <td className="py-3 px-3 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <div className="w-16 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-primary-500"
                                style={{ width: `${Math.round((e.progress ?? 0) * 100) / 1}%` }}
                              />
                            </div>
                            <span className="text-xs text-gray-500 dark:text-gray-400 w-8 text-right">
                              {Math.round(e.progress ?? 0)}%
                            </span>
                          </div>
                        </td>
                        <td className="py-3 px-3 whitespace-nowrap">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                              e.status === 'active'
                                ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                                : e.status === 'completed'
                                ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300'
                                : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'
                            }`}
                          >
                            {e.status}
                          </span>
                        </td>
                        <td className="py-3 px-3">
                          <div className="flex items-center justify-end gap-1 flex-wrap">
                            <Button
                              size="sm"
                              variant="ghost"
                              icon={<ActivityIcon className="w-4 h-4" />}
                              onClick={() =>
                                navigate(
                                  `/teach/courses/${courseId}/logs?userId=${user.id}`
                                )
                              }
                            >
                              {t('teaching:log', { defaultValue: 'Log' })}
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              icon={<BarChart3 className="w-4 h-4" />}
                              onClick={() =>
                                navigate(
                                  `/teach/courses/${courseId}/students/${user.id}/activity`
                                )
                              }
                            >
                              {t('teaching:activity', { defaultValue: 'Activity' })}
                            </Button>
                            <Button
                              size="sm"
                              variant="secondary"
                              icon={<UserPlus className="w-4 h-4" />}
                              onClick={() => setTeamTarget(e)}
                            >
                              {t('teaching:add_to_team', { defaultValue: 'Add to team' })}
                            </Button>
                            <Button
                              size="sm"
                              variant="danger"
                              icon={<Trash2 className="w-4 h-4" />}
                              onClick={() => setUnenrollTarget(e)}
                            >
                              {t('teaching:unenroll', { defaultValue: 'Unenroll' })}
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {pagination && totalPages > 1 && (
            <div className="flex flex-wrap items-center justify-between gap-3 mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {t('teaching:page_n_of_m', {
                  defaultValue: 'Page {{page}} of {{total}}',
                  page: pagination.page,
                  total: totalPages,
                })}
              </span>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  {t('common:previous', { defaultValue: 'Previous' })}
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                >
                  {t('common:next', { defaultValue: 'Next' })}
                </Button>
              </div>
            </div>
          )}
        </CardBody>
      </Card>

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

      {/* Add to team modal */}
      {teamTarget?.user && (
        <AddToTeamModal
          isOpen={!!teamTarget}
          onClose={() => setTeamTarget(null)}
          courseId={courseId}
          user={teamTarget.user}
        />
      )}
    </div>
  );
};
