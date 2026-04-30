import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-hot-toast';
import {
  Activity as ActivityIcon,
  BarChart3,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Search,
  Trash2,
  Users,
  X,
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
import type { ManagedEnrollment } from '../../types';

const PAGE_SIZE = 20;

const formatDate = (iso: string | null | undefined) =>
  iso
    ? new Date(iso).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      })
    : '-';

/**
 * Return the set of page numbers to show in the pagination bar. For short
 * lists we show every page; for longer lists we collapse the middle with
 * ellipses so the footer never grows wider than the card.
 */
const getPageNumbers = (current: number, total: number): (number | 'dots')[] => {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }
  const pages: (number | 'dots')[] = [1];
  const start = Math.max(2, current - 1);
  const end = Math.min(total - 1, current + 1);
  if (start > 2) pages.push('dots');
  for (let i = start; i <= end; i++) pages.push(i);
  if (end < total - 1) pages.push('dots');
  pages.push(total);
  return pages;
};

export const CourseStudents = () => {
  const { courseId: courseIdParam } = useParams();
  const courseId = Number(courseIdParam);
  const { t } = useTranslation(['teaching', 'common', 'navigation']);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  // Enrollment-date range. Empty string ⇢ filter not applied. The native
  // <input type="date"> emits `YYYY-MM-DD`, which the server parses with `new
  // Date(...)` and treats as inclusive of the whole day for the "to" bound.
  const [enrolledFrom, setEnrolledFrom] = useState('');
  const [enrolledTo, setEnrolledTo] = useState('');
  const [page, setPage] = useState(1);
  const [unenrollTarget, setUnenrollTarget] = useState<ManagedEnrollment | null>(null);

  // Debounce search input
  useEffect(() => {
    const handle = setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(handle);
  }, [searchInput]);

  // Date-range changes don't need debouncing (picker fires once per commit).
  // Reset to page 1 whenever a date bound changes so the new result set
  // doesn't land on a now-empty page.
  useEffect(() => {
    setPage(1);
  }, [enrolledFrom, enrolledTo]);

  const hasFilters = !!(search || enrolledFrom || enrolledTo);
  const clearFilters = () => {
    setSearchInput('');
    setSearch('');
    setEnrolledFrom('');
    setEnrolledTo('');
    setPage(1);
  };

  const { data: course } = useQuery({
    queryKey: ['course', courseId],
    queryFn: () => coursesApi.getCourseById(courseId),
    enabled: !!courseId,
  });

  const { data, isLoading } = useQuery({
    queryKey: ['courseEnrollments', courseId, page, search, enrolledFrom, enrolledTo],
    queryFn: () =>
      enrollmentManagementApi.getCourseEnrollments(
        courseId,
        page,
        PAGE_SIZE,
        search || undefined,
        enrolledFrom || undefined,
        enrolledTo || undefined
      ),
    enabled: !!courseId,
  });

  const enrollments = data?.enrollments ?? [];
  const pagination = data?.pagination;

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
  const total = pagination?.total ?? 0;
  const rangeStart = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const rangeEnd = Math.min(page * PAGE_SIZE, total);
  const pageNumbers = getPageNumbers(page, totalPages);

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
          {/* Filter toolbar: search + enrollment-date range + clear.
              On wide screens the controls sit on one row; on narrow screens
              they stack. The "Clear" button only appears when at least one
              filter is active so it doesn't draw the eye when there's nothing
              to clear. */}
          <div className="mb-4 flex flex-col lg:flex-row lg:items-end gap-3">
            <div className="flex-1 min-w-0">
              <label className="block text-xs uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1">
                {t('teaching:search', { defaultValue: 'Search' })}
              </label>
              <div className="relative">
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
            </div>
            <div className="flex flex-col sm:flex-row gap-3 lg:items-end">
              <div>
                <label className="block text-xs uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1">
                  {t('teaching:enrolled_from', { defaultValue: 'Enrolled from' })}
                </label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                  <input
                    type="date"
                    value={enrolledFrom}
                    max={enrolledTo || undefined}
                    onChange={(e) => setEnrolledFrom(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1">
                  {t('teaching:enrolled_to', { defaultValue: 'Enrolled to' })}
                </label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                  <input
                    type="date"
                    value={enrolledTo}
                    min={enrolledFrom || undefined}
                    onChange={(e) => setEnrolledTo(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
              </div>
              {hasFilters && (
                <button
                  type="button"
                  onClick={clearFilters}
                  className="inline-flex items-center justify-center gap-1 px-3 py-2 text-sm font-medium text-gray-600 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800"
                >
                  <X className="w-4 h-4" />
                  {t('teaching:clear_filters', { defaultValue: 'Clear' })}
                </button>
              )}
            </div>
          </div>

          {isLoading ? (
            <Loading />
          ) : enrollments.length === 0 ? (
            <EmptyState
              icon={Users}
              title={t('teaching:no_students', { defaultValue: 'No students enrolled' })}
              description={
                hasFilters
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
                    // Enrollment.progress is stored as a percentage (0–100).
                    // Clamp before applying as width so a stray >100 value
                    // doesn't render a "17% = full bar" glitch like we hit
                    // previously (the old code was (p * 100) / 1 = 1700%).
                    const pct = Math.max(0, Math.min(100, Math.round(e.progress ?? 0)));
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
                        <td className="py-3 px-3 whitespace-nowrap">
                          <div className="flex items-center gap-2">
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
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {t('teaching:showing_range', {
                  defaultValue: 'Showing {{from}}–{{to}} of {{total}}',
                  from: rangeStart,
                  to: rangeEnd,
                  total,
                })}
              </p>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  aria-label={t('common:previous', { defaultValue: 'Previous' })}
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="p-2 rounded-lg border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                {pageNumbers.map((p, idx) =>
                  p === 'dots' ? (
                    <span
                      key={`dots-${idx}`}
                      className="px-2 text-xs text-gray-400 dark:text-gray-500 select-none"
                    >
                      …
                    </span>
                  ) : (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setPage(p)}
                      aria-current={p === page ? 'page' : undefined}
                      className={`min-w-[2rem] px-2.5 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                        p === page
                          ? 'bg-primary-600 border-primary-600 text-white'
                          : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'
                      }`}
                    >
                      {p}
                    </button>
                  )
                )}
                <button
                  type="button"
                  aria-label={t('common:next', { defaultValue: 'Next' })}
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  className="p-2 rounded-lg border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
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
    </div>
  );
};
