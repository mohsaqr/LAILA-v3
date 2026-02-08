import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  GraduationCap,
  Search,
  Trash2,
  Plus,
  ChevronLeft,
  ChevronRight,
  Filter,
  Users,
  TrendingUp,
  CheckCircle,
} from 'lucide-react';
import { enrollmentManagementApi } from '../../api/enrollmentManagement';
import { usersApi } from '../../api/users';
import { coursesApi } from '../../api/courses';
import { Card, CardBody, CardHeader } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { Loading } from '../../components/common/Loading';
import { Modal } from '../../components/common/Modal';
import { ConfirmDialog } from '../../components/common/ConfirmDialog';
import { Breadcrumb } from '../../components/common/Breadcrumb';
import { buildAdminBreadcrumb } from '../../utils/breadcrumbs';
import { ManagedEnrollment } from '../../types';

export const EnrollmentsManagement = () => {
  const { t } = useTranslation(['admin', 'common', 'courses']);
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [courseFilter, setCourseFilter] = useState<number | undefined>(undefined);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [enrollmentToDelete, setEnrollmentToDelete] = useState<ManagedEnrollment | null>(null);

  // Add enrollment form state
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [selectedCourseId, setSelectedCourseId] = useState<number | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ['managedEnrollments', page, search, statusFilter, courseFilter],
    queryFn: () =>
      enrollmentManagementApi.getEnrollments(page, 20, {
        search: search || undefined,
        status: statusFilter || undefined,
        courseId: courseFilter,
      }),
  });

  const { data: stats } = useQuery({
    queryKey: ['enrollmentStats'],
    queryFn: () => enrollmentManagementApi.getEnrollmentStats(),
  });

  const { data: usersData } = useQuery({
    queryKey: ['allUsersForEnrollment'],
    queryFn: () => usersApi.getUsers(1, 1000),
    enabled: isAddModalOpen,
  });

  const { data: coursesData } = useQuery({
    queryKey: ['allCoursesForEnrollment'],
    queryFn: () => coursesApi.getCourses({ page: 1, limit: 1000 }),
    enabled: isAddModalOpen || courseFilter !== undefined,
  });

  const createEnrollmentMutation = useMutation({
    mutationFn: ({ userId, courseId }: { userId: number; courseId: number }) =>
      enrollmentManagementApi.createEnrollment(userId, courseId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['managedEnrollments'] });
      queryClient.invalidateQueries({ queryKey: ['enrollmentStats'] });
      setIsAddModalOpen(false);
      setSelectedUserId(null);
      setSelectedCourseId(null);
    },
  });

  const deleteEnrollmentMutation = useMutation({
    mutationFn: (id: number) => enrollmentManagementApi.deleteEnrollment(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['managedEnrollments'] });
      queryClient.invalidateQueries({ queryKey: ['enrollmentStats'] });
      setIsDeleteDialogOpen(false);
      setEnrollmentToDelete(null);
    },
  });

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSearch(searchInput);
    setPage(1);
  };

  const handleDeleteClick = (enrollment: ManagedEnrollment) => {
    setEnrollmentToDelete(enrollment);
    setIsDeleteDialogOpen(true);
  };

  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-red-500">{t('error_loading_users')}</p>
      </div>
    );
  }

  const breadcrumbItems = buildAdminBreadcrumb(t('enrollments'));

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Breadcrumb navigation */}
      <div className="mb-6">
        <Breadcrumb items={breadcrumbItems} homeHref="/admin" />
      </div>

      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">{t('enrollments_management')}</h1>
          <p className="text-gray-600 mt-1">{t('manage_enrollments')}</p>
        </div>
        <Button onClick={() => setIsAddModalOpen(true)}>
          <Plus className="w-4 h-4 mr-2" />
          {t('add_enrollment')}
        </Button>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <Card>
            <CardBody className="text-center py-4">
              <GraduationCap className="w-6 h-6 text-blue-500 mx-auto mb-2" />
              <p className="text-2xl font-bold text-gray-900">{stats.totalEnrollments}</p>
              <p className="text-xs text-gray-500">{t('total_enrollments')}</p>
            </CardBody>
          </Card>
          <Card>
            <CardBody className="text-center py-4">
              <Users className="w-6 h-6 text-green-500 mx-auto mb-2" />
              <p className="text-2xl font-bold text-gray-900">{stats.activeEnrollments}</p>
              <p className="text-xs text-gray-500">{t('common:active')}</p>
            </CardBody>
          </Card>
          <Card>
            <CardBody className="text-center py-4">
              <CheckCircle className="w-6 h-6 text-purple-500 mx-auto mb-2" />
              <p className="text-2xl font-bold text-gray-900">{stats.completedEnrollments}</p>
              <p className="text-xs text-gray-500">{t('common:completed')}</p>
            </CardBody>
          </Card>
          <Card>
            <CardBody className="text-center py-4">
              <TrendingUp className="w-6 h-6 text-cyan-500 mx-auto mb-2" />
              <p className="text-2xl font-bold text-gray-900">{stats.recentEnrollments}</p>
              <p className="text-xs text-gray-500">{t('last_7_days')}</p>
            </CardBody>
          </Card>
        </div>
      )}

      {/* Search and Filters */}
      <Card className="mb-6">
        <CardBody>
          <div className="flex flex-col md:flex-row gap-4">
            <form onSubmit={handleSearch} className="flex-1 flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder={t('search_by_user')}
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                />
              </div>
              <Button type="submit">{t('common:search')}</Button>
            </form>
            <div className="flex gap-2 items-center">
              <Filter className="w-4 h-4 text-gray-400" />
              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setPage(1);
                }}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
              >
                <option value="">{t('all_status')}</option>
                <option value="active">{t('common:active')}</option>
                <option value="completed">{t('common:completed')}</option>
                <option value="dropped">{t('common:inactive')}</option>
              </select>
              <select
                value={courseFilter || ''}
                onChange={(e) => {
                  setCourseFilter(e.target.value ? Number(e.target.value) : undefined);
                  setPage(1);
                }}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 max-w-[200px]"
              >
                <option value="">{t('all_courses')}</option>
                {coursesData?.courses?.map((course: any) => (
                  <option key={course.id} value={course.id}>
                    {course.title}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </CardBody>
      </Card>

      {/* Enrollments Table */}
      <Card>
        <CardHeader className="flex items-center justify-between">
          <h2 className="font-semibold text-gray-900">
            {t('enrollments')} ({data?.pagination.total || 0})
          </h2>
        </CardHeader>
        <CardBody className="p-0">
          {isLoading ? (
            <Loading text={t('loading_enrollments')} />
          ) : (
            <>
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      {t('student')}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      {t('courses:course')}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      {t('courses:progress')}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      {t('common:status')}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      {t('courses:enrolled')}
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                      {t('common:actions')}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {data?.enrollments.map((enrollment) => (
                    <tr key={enrollment.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <div>
                          <Link
                            to={`/admin/users/${enrollment.userId}`}
                            className="text-sm font-medium text-gray-900 hover:text-primary-600"
                          >
                            {enrollment.user?.fullname}
                          </Link>
                          <p className="text-xs text-gray-500">{enrollment.user?.email}</p>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div>
                          <p className="text-sm font-medium text-gray-900">
                            {enrollment.course?.title}
                          </p>
                          <p className="text-xs text-gray-500">
                            {enrollment.course?.instructor?.fullname}
                          </p>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <div className="w-24 h-2 bg-gray-200 rounded-full">
                            <div
                              className="h-full bg-primary-500 rounded-full"
                              style={{ width: `${enrollment.progress}%` }}
                            />
                          </div>
                          <span className="text-xs text-gray-500">{enrollment.progress}%</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`px-2 py-0.5 text-xs rounded ${
                            enrollment.status === 'active'
                              ? 'bg-green-100 text-green-700'
                              : enrollment.status === 'completed'
                              ? 'bg-purple-100 text-purple-700'
                              : 'bg-gray-100 text-gray-700'
                          }`}
                        >
                          {enrollment.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {new Date(enrollment.enrolledAt).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex justify-end">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteClick(enrollment)}
                            className="text-red-500 hover:text-red-700"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Pagination */}
              {data && data.pagination.totalPages > 1 && (
                <div className="flex items-center justify-between px-6 py-4 border-t">
                  <p className="text-sm text-gray-500">
                    {t('page_of_pages', { page: data.pagination.page, total: data.pagination.totalPages })}
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={page === 1}
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage((p) => Math.min(data.pagination.totalPages, p + 1))}
                      disabled={page === data.pagination.totalPages}
                    >
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              )}

              {data?.enrollments.length === 0 && (
                <div className="text-center py-12 text-gray-500">{t('no_enrollments_found')}</div>
              )}
            </>
          )}
        </CardBody>
      </Card>

      {/* Add Enrollment Modal */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => {
          setIsAddModalOpen(false);
          setSelectedUserId(null);
          setSelectedCourseId(null);
        }}
        title={t('add_enrollment')}
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">{t('user')}</label>
            <select
              value={selectedUserId || ''}
              onChange={(e) => setSelectedUserId(Number(e.target.value) || null)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
            >
              <option value="">{t('common:select')}...</option>
              {usersData?.users?.map((user: any) => (
                <option key={user.id} value={user.id}>
                  {user.fullname} ({user.email})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">{t('courses:course')}</label>
            <select
              value={selectedCourseId || ''}
              onChange={(e) => setSelectedCourseId(Number(e.target.value) || null)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
            >
              <option value="">{t('common:select')}...</option>
              {coursesData?.courses?.map((course: any) => (
                <option key={course.id} value={course.id}>
                  {course.title}
                </option>
              ))}
            </select>
          </div>
          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={() => setIsAddModalOpen(false)}>
              {t('common:cancel')}
            </Button>
            <Button
              onClick={() =>
                selectedUserId &&
                selectedCourseId &&
                createEnrollmentMutation.mutate({
                  userId: selectedUserId,
                  courseId: selectedCourseId,
                })
              }
              disabled={!selectedUserId || !selectedCourseId || createEnrollmentMutation.isPending}
            >
              {createEnrollmentMutation.isPending ? t('common:loading') : t('add_enrollment')}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Delete Enrollment Dialog */}
      <ConfirmDialog
        isOpen={isDeleteDialogOpen}
        onClose={() => {
          setIsDeleteDialogOpen(false);
          setEnrollmentToDelete(null);
        }}
        onConfirm={() => enrollmentToDelete && deleteEnrollmentMutation.mutate(enrollmentToDelete.id)}
        title={t('unenroll')}
        message={t('confirm_unenroll', { user: enrollmentToDelete?.user?.fullname, course: enrollmentToDelete?.course?.title })}
        confirmText={t('common:remove')}
        loading={deleteEnrollmentMutation.isPending}
      />
    </div>
  );
};
