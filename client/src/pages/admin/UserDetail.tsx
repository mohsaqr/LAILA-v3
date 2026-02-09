import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import {
  Edit2,
  Trash2,
  BookOpen,
  GraduationCap,
  Mail,
  Calendar,
  Clock,
  Shield,
  ShieldCheck,
  Plus,
  X,
} from 'lucide-react';
import { userManagementApi } from '../../api/userManagement';
import { coursesApi } from '../../api/courses';
import { Card, CardBody, CardHeader } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { Loading } from '../../components/common/Loading';
import { Modal } from '../../components/common/Modal';
import { ConfirmDialog } from '../../components/common/ConfirmDialog';
import { Input } from '../../components/common/Input';
import { Breadcrumb } from '../../components/common/Breadcrumb';
import { UpdateUserData, Course } from '../../types';

export const UserDetail = () => {
  const { t } = useTranslation(['admin', 'common']);
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const userId = parseInt(id!);

  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isAddEnrollmentModalOpen, setIsAddEnrollmentModalOpen] = useState(false);
  const [isRemoveEnrollmentDialogOpen, setIsRemoveEnrollmentDialogOpen] = useState(false);
  const [enrollmentToRemove, setEnrollmentToRemove] = useState<{ id: number; title: string } | null>(null);
  const [editForm, setEditForm] = useState<UpdateUserData>({});
  const [selectedCourseId, setSelectedCourseId] = useState<number | null>(null);

  const { data: user, isLoading, error } = useQuery({
    queryKey: ['userDetail', userId],
    queryFn: () => userManagementApi.getUserDetails(userId),
  });

  const { data: courses } = useQuery({
    queryKey: ['allCourses'],
    queryFn: () => coursesApi.getCourses({ page: 1, limit: 100 }),
    enabled: isAddEnrollmentModalOpen,
  });

  const updateUserMutation = useMutation({
    mutationFn: (data: UpdateUserData) => userManagementApi.updateUser(userId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['userDetail', userId] });
      setIsEditModalOpen(false);
      setEditForm({});
    },
  });

  const deleteUserMutation = useMutation({
    mutationFn: () => userManagementApi.deleteUser(userId),
    onSuccess: () => {
      navigate('/admin/users');
    },
  });

  const addEnrollmentMutation = useMutation({
    mutationFn: (courseId: number) => userManagementApi.addUserEnrollment(userId, courseId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['userDetail', userId] });
      setIsAddEnrollmentModalOpen(false);
      setSelectedCourseId(null);
    },
  });

  const removeEnrollmentMutation = useMutation({
    mutationFn: (enrollmentId: number) => userManagementApi.removeUserEnrollment(userId, enrollmentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['userDetail', userId] });
      setIsRemoveEnrollmentDialogOpen(false);
      setEnrollmentToRemove(null);
    },
  });

  const handleOpenEditModal = () => {
    if (!user) return;
    setEditForm({
      fullname: user.fullname,
      email: user.email,
      isActive: user.isActive,
      isInstructor: user.isInstructor,
      isAdmin: user.isAdmin,
    });
    setIsEditModalOpen(true);
  };

  const handleRemoveEnrollment = (enrollmentId: number, courseTitle: string) => {
    setEnrollmentToRemove({ id: enrollmentId, title: courseTitle });
    setIsRemoveEnrollmentDialogOpen(true);
  };

  // Filter out courses user is already enrolled in
  const availableCourses = courses?.courses.filter(
    (course: Course) => !user?.enrollments.some((e) => e.courseId === course.id)
  );

  const breadcrumbItems = [
    { label: t('admin'), href: '/admin' },
    { label: t('users'), href: '/admin/users' },
    { label: user?.fullname || t('user_details') },
  ];

  if (isLoading) {
    return <Loading fullScreen text={t('loading_user_details')} />;
  }

  if (error || !user) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center py-12">
          <p className="text-red-500">{t('user_not_found_error')}</p>
          <Link to="/admin/users">
            <Button variant="outline" className="mt-4">
              {t('back_to_users')}
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Breadcrumb navigation */}
      <div className="mb-6">
        <Breadcrumb items={breadcrumbItems} homeHref="/admin" />
      </div>

      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">{user.fullname}</h1>
          <p className="text-gray-600">{user.email}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleOpenEditModal}>
            <Edit2 className="w-4 h-4 mr-2" />
            {t('common:edit')}
          </Button>
          <Button variant="outline" onClick={() => setIsDeleteDialogOpen(true)} className="text-red-500">
            <Trash2 className="w-4 h-4 mr-2" />
            {t('common:delete')}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* User Info */}
        <Card>
          <CardHeader>
            <h2 className="font-semibold text-gray-900">{t('user_information')}</h2>
          </CardHeader>
          <CardBody className="space-y-4">
            <div className="flex items-center gap-3">
              <Mail className="w-5 h-5 text-gray-400" />
              <div>
                <p className="text-sm text-gray-500">{t('email')}</p>
                <p className="font-medium">{user.email}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Calendar className="w-5 h-5 text-gray-400" />
              <div>
                <p className="text-sm text-gray-500">{t('joined')}</p>
                <p className="font-medium">{new Date(user.createdAt).toLocaleDateString()}</p>
              </div>
            </div>
            {user.lastLogin && (
              <div className="flex items-center gap-3">
                <Clock className="w-5 h-5 text-gray-400" />
                <div>
                  <p className="text-sm text-gray-500">{t('last_login')}</p>
                  <p className="font-medium">{new Date(user.lastLogin).toLocaleString()}</p>
                </div>
              </div>
            )}
            <div className="pt-4 border-t">
              <p className="text-sm text-gray-500 mb-2">{t('roles')}</p>
              <div className="flex flex-wrap gap-2">
                {user.isAdmin && (
                  <span className="flex items-center gap-1 px-2 py-1 text-sm bg-red-100 text-red-700 rounded">
                    <ShieldCheck className="w-4 h-4" />
                    {t('admin')}
                  </span>
                )}
                {user.isInstructor && (
                  <span className="flex items-center gap-1 px-2 py-1 text-sm bg-blue-100 text-blue-700 rounded">
                    <Shield className="w-4 h-4" />
                    {t('instructor')}
                  </span>
                )}
                {!user.isAdmin && !user.isInstructor && (
                  <span className="px-2 py-1 text-sm bg-gray-100 text-gray-700 rounded">
                    {t('student')}
                  </span>
                )}
              </div>
            </div>
            <div className="pt-4 border-t">
              <p className="text-sm text-gray-500 mb-2">{t('common:status')}</p>
              <span
                className={`px-2 py-1 text-sm rounded ${
                  user.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'
                }`}
              >
                {user.isActive ? t('common:active') : t('common:inactive')}
              </span>
            </div>
          </CardBody>
        </Card>

        {/* Enrollments */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <GraduationCap className="w-5 h-5 text-primary-500" />
              <h2 className="font-semibold text-gray-900">
                {t('enrollments')} ({user.enrollments.length})
              </h2>
            </div>
            <Button size="sm" onClick={() => setIsAddEnrollmentModalOpen(true)}>
              <Plus className="w-4 h-4 mr-1" />
              {t('common:add')}
            </Button>
          </CardHeader>
          <CardBody className="p-0">
            {user.enrollments.length === 0 ? (
              <div className="text-center py-8 text-gray-500">{t('no_enrollments_yet')}</div>
            ) : (
              <div className="divide-y divide-gray-100">
                {user.enrollments.map((enrollment) => (
                  <div
                    key={enrollment.id}
                    className="flex items-center justify-between px-6 py-4 hover:bg-gray-50"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded bg-primary-100 flex items-center justify-center">
                        <BookOpen className="w-5 h-5 text-primary-600" />
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">{enrollment.course?.title}</p>
                        <p className="text-sm text-gray-500">
                          {enrollment.course?.instructor?.fullname}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <div className="flex items-center gap-2">
                          <div className="w-24 h-2 bg-gray-200 rounded-full">
                            <div
                              className="h-full bg-primary-500 rounded-full"
                              style={{ width: `${enrollment.progress}%` }}
                            />
                          </div>
                          <span className="text-sm text-gray-500">{enrollment.progress}%</span>
                        </div>
                        <p className="text-xs text-gray-400">
                          {t('enrolled')}: {new Date(enrollment.enrolledAt).toLocaleDateString()}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          handleRemoveEnrollment(enrollment.id, enrollment.course?.title || '')
                        }
                        className="text-red-500"
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardBody>
        </Card>

        {/* Taught Courses (if instructor) */}
        {user.taughtCourses.length > 0 && (
          <Card className="lg:col-span-3">
            <CardHeader>
              <div className="flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-blue-500" />
                <h2 className="font-semibold text-gray-900">
                  {t('teaching')} ({user.taughtCourses.length} {t('courses')})
                </h2>
              </div>
            </CardHeader>
            <CardBody className="p-0">
              <div className="divide-y divide-gray-100">
                {user.taughtCourses.map((course) => (
                  <div
                    key={course.id}
                    className="flex items-center justify-between px-6 py-4 hover:bg-gray-50"
                  >
                    <div>
                      <p className="font-medium text-gray-900">{course.title}</p>
                      <p className="text-sm text-gray-500">/{course.slug}</p>
                    </div>
                    <div className="flex items-center gap-4">
                      <span
                        className={`px-2 py-0.5 text-xs rounded ${
                          course.status === 'published'
                            ? 'bg-green-100 text-green-700'
                            : course.status === 'draft'
                            ? 'bg-yellow-100 text-yellow-700'
                            : 'bg-gray-100 text-gray-700'
                        }`}
                      >
                        {course.status}
                      </span>
                      <span className="text-sm text-gray-500">
                        {course._count.enrollments} {t('students')}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </CardBody>
          </Card>
        )}
      </div>

      {/* Edit User Modal */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => {
          setIsEditModalOpen(false);
          setEditForm({});
        }}
        title={t('edit_user')}
      >
        <div className="space-y-4">
          <Input
            label={t('full_name')}
            value={editForm.fullname || ''}
            onChange={(e) => setEditForm({ ...editForm, fullname: e.target.value })}
          />
          <Input
            label={t('email')}
            type="email"
            value={editForm.email || ''}
            onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
          />
          <Input
            label={t('new_password')}
            type="password"
            value={editForm.password || ''}
            onChange={(e) => setEditForm({ ...editForm, password: e.target.value || undefined })}
          />
          <div className="space-y-2">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={editForm.isActive ?? true}
                onChange={(e) => setEditForm({ ...editForm, isActive: e.target.checked })}
                className="rounded border-gray-300"
              />
              <span className="text-sm">{t('common:active')}</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={editForm.isInstructor ?? false}
                onChange={(e) => setEditForm({ ...editForm, isInstructor: e.target.checked })}
                className="rounded border-gray-300"
              />
              <span className="text-sm">{t('instructor')}</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={editForm.isAdmin ?? false}
                onChange={(e) => setEditForm({ ...editForm, isAdmin: e.target.checked })}
                className="rounded border-gray-300"
              />
              <span className="text-sm">{t('admin')}</span>
            </label>
          </div>
          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={() => setIsEditModalOpen(false)}>
              {t('common:cancel')}
            </Button>
            <Button
              onClick={() => updateUserMutation.mutate(editForm)}
              disabled={updateUserMutation.isPending}
            >
              {updateUserMutation.isPending ? t('saving') : t('save_changes')}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Delete User Dialog */}
      <ConfirmDialog
        isOpen={isDeleteDialogOpen}
        onClose={() => setIsDeleteDialogOpen(false)}
        onConfirm={() => deleteUserMutation.mutate()}
        title={t('delete_user')}
        message={t('confirm_delete_user', { name: user.fullname })}
        confirmText={t('common:delete')}
        loading={deleteUserMutation.isPending}
      />

      {/* Add Enrollment Modal */}
      <Modal
        isOpen={isAddEnrollmentModalOpen}
        onClose={() => {
          setIsAddEnrollmentModalOpen(false);
          setSelectedCourseId(null);
        }}
        title={t('add_enrollment')}
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('select_course')}
            </label>
            <select
              value={selectedCourseId || ''}
              onChange={(e) => setSelectedCourseId(Number(e.target.value) || null)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
            >
              <option value="">{t('choose_course')}</option>
              {availableCourses?.map((course: Course) => (
                <option key={course.id} value={course.id}>
                  {course.title}
                </option>
              ))}
            </select>
          </div>
          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={() => setIsAddEnrollmentModalOpen(false)}>
              {t('common:cancel')}
            </Button>
            <Button
              onClick={() => selectedCourseId && addEnrollmentMutation.mutate(selectedCourseId)}
              disabled={!selectedCourseId || addEnrollmentMutation.isPending}
            >
              {addEnrollmentMutation.isPending ? t('adding') : t('add_enrollment')}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Remove Enrollment Dialog */}
      <ConfirmDialog
        isOpen={isRemoveEnrollmentDialogOpen}
        onClose={() => {
          setIsRemoveEnrollmentDialogOpen(false);
          setEnrollmentToRemove(null);
        }}
        onConfirm={() => enrollmentToRemove && removeEnrollmentMutation.mutate(enrollmentToRemove.id)}
        title={t('remove_enrollment')}
        message={t('confirm_remove_enrollment', { user: user.fullname, course: enrollmentToRemove?.title })}
        confirmText={t('common:remove')}
        loading={removeEnrollmentMutation.isPending}
      />
    </div>
  );
};
