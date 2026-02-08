import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  UserPlus,
  Trash2,
  Edit2,
  Shield,
  Users,
} from 'lucide-react';
import {
  courseRolesApi,
  CourseRoleType,
  Permission,
  ROLE_LABELS,
  PERMISSION_LABELS,
  ROLE_DEFAULT_PERMISSIONS,
} from '../../api/courseRoles';
import { usersApi } from '../../api/users';
import { Card, CardBody, CardHeader } from '../common/Card';
import { Button } from '../common/Button';
import { Modal } from '../common/Modal';
import { ConfirmDialog } from '../common/ConfirmDialog';
import { Loading } from '../common/Loading';
import { CourseRole, User } from '../../types';

interface CourseRoleManagerProps {
  courseId: number;
}

export const CourseRoleManager = ({ courseId }: CourseRoleManagerProps) => {
  const { t } = useTranslation(['admin', 'common']);
  const queryClient = useQueryClient();
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedRole, setSelectedRole] = useState<CourseRole | null>(null);

  // Form state
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [selectedRoleType, setSelectedRoleType] = useState<CourseRoleType>('ta');
  const [selectedPermissions, setSelectedPermissions] = useState<Permission[]>([]);

  const { data: roles, isLoading } = useQuery({
    queryKey: ['courseRoles', courseId],
    queryFn: () => courseRolesApi.getCourseRoles(courseId),
  });

  const { data: usersData } = useQuery({
    queryKey: ['allUsersForRoles'],
    queryFn: () => usersApi.getUsers(1, 1000),
    enabled: isAddModalOpen,
  });

  const assignRoleMutation = useMutation({
    mutationFn: () =>
      courseRolesApi.assignRole(courseId, selectedUserId!, selectedRoleType, selectedPermissions),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['courseRoles', courseId] });
      setIsAddModalOpen(false);
      resetForm();
    },
  });

  const updateRoleMutation = useMutation({
    mutationFn: () =>
      courseRolesApi.updateRole(courseId, selectedRole!.id, {
        role: selectedRoleType,
        permissions: selectedPermissions,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['courseRoles', courseId] });
      setIsEditModalOpen(false);
      setSelectedRole(null);
      resetForm();
    },
  });

  const removeRoleMutation = useMutation({
    mutationFn: () => courseRolesApi.removeRole(courseId, selectedRole!.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['courseRoles', courseId] });
      setIsDeleteDialogOpen(false);
      setSelectedRole(null);
    },
  });

  const resetForm = () => {
    setSelectedUserId(null);
    setSelectedRoleType('ta');
    setSelectedPermissions([]);
  };

  const handleRoleTypeChange = (role: CourseRoleType) => {
    setSelectedRoleType(role);
    setSelectedPermissions(ROLE_DEFAULT_PERMISSIONS[role]);
  };

  const handlePermissionToggle = (permission: Permission) => {
    setSelectedPermissions((prev) =>
      prev.includes(permission) ? prev.filter((p) => p !== permission) : [...prev, permission]
    );
  };

  const handleEditRole = (role: CourseRole) => {
    setSelectedRole(role);
    setSelectedRoleType(role.role);
    setSelectedPermissions(role.permissions as unknown as Permission[] || []);
    setIsEditModalOpen(true);
  };

  const handleDeleteRole = (role: CourseRole) => {
    setSelectedRole(role);
    setIsDeleteDialogOpen(true);
  };

  // Filter out users who already have a role
  const availableUsers = usersData?.users.filter(
    (user: User) => !roles?.some((role) => role.userId === user.id)
  );

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'ta':
        return 'bg-blue-100 text-blue-700';
      case 'co_instructor':
        return 'bg-purple-100 text-purple-700';
      case 'course_admin':
        return 'bg-orange-100 text-orange-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  if (isLoading) {
    return <Loading text={t('loading_course_roles')} />;
  }

  return (
    <Card>
      <CardHeader className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Shield className="w-5 h-5 text-primary-500" />
          <h2 className="font-semibold text-gray-900">{t('course_team')}</h2>
        </div>
        <Button size="sm" onClick={() => setIsAddModalOpen(true)}>
          <UserPlus className="w-4 h-4 mr-1" />
          {t('add_role')}
        </Button>
      </CardHeader>
      <CardBody className="p-0">
        {roles?.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <Users className="w-12 h-12 mx-auto mb-2 text-gray-300" />
            <p>{t('no_team_members')}</p>
            <p className="text-sm">{t('add_team_suggestion')}</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {roles?.map((role) => (
              <div
                key={role.id}
                className="flex items-center justify-between px-6 py-4 hover:bg-gray-50"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center">
                    <Users className="w-5 h-5 text-gray-500" />
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">{role.user?.fullname}</p>
                    <p className="text-sm text-gray-500">{role.user?.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`px-2 py-1 text-xs rounded ${getRoleColor(role.role)}`}>
                    {ROLE_LABELS[role.role as CourseRoleType]}
                  </span>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="sm" onClick={() => handleEditRole(role)}>
                      <Edit2 className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteRole(role)}
                      className="text-red-500"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardBody>

      {/* Add Role Modal */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => {
          setIsAddModalOpen(false);
          resetForm();
        }}
        title={t('add_team_member')}
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">{t('select_user')}</label>
            <select
              value={selectedUserId || ''}
              onChange={(e) => setSelectedUserId(Number(e.target.value) || null)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
            >
              <option value="">{t('choose_user')}</option>
              {availableUsers?.map((user: User) => (
                <option key={user.id} value={user.id}>
                  {user.fullname} ({user.email})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">{t('role')}</label>
            <select
              value={selectedRoleType}
              onChange={(e) => handleRoleTypeChange(e.target.value as CourseRoleType)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
            >
              <option value="ta">{ROLE_LABELS.ta}</option>
              <option value="co_instructor">{ROLE_LABELS.co_instructor}</option>
              <option value="course_admin">{ROLE_LABELS.course_admin}</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">{t('permissions')}</label>
            <div className="space-y-2">
              {(Object.keys(PERMISSION_LABELS) as Permission[]).map((permission) => (
                <label key={permission} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={selectedPermissions.includes(permission)}
                    onChange={() => handlePermissionToggle(permission)}
                    className="rounded border-gray-300"
                  />
                  <span className="text-sm">{PERMISSION_LABELS[permission]}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={() => setIsAddModalOpen(false)}>
              {t('common:cancel')}
            </Button>
            <Button
              onClick={() => assignRoleMutation.mutate()}
              disabled={!selectedUserId || assignRoleMutation.isPending}
            >
              {assignRoleMutation.isPending ? t('adding') : t('add_role')}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Edit Role Modal */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => {
          setIsEditModalOpen(false);
          setSelectedRole(null);
          resetForm();
        }}
        title={t('edit_role_title', { name: selectedRole?.user?.fullname })}
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">{t('role')}</label>
            <select
              value={selectedRoleType}
              onChange={(e) => handleRoleTypeChange(e.target.value as CourseRoleType)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
            >
              <option value="ta">{ROLE_LABELS.ta}</option>
              <option value="co_instructor">{ROLE_LABELS.co_instructor}</option>
              <option value="course_admin">{ROLE_LABELS.course_admin}</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">{t('permissions')}</label>
            <div className="space-y-2">
              {(Object.keys(PERMISSION_LABELS) as Permission[]).map((permission) => (
                <label key={permission} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={selectedPermissions.includes(permission)}
                    onChange={() => handlePermissionToggle(permission)}
                    className="rounded border-gray-300"
                  />
                  <span className="text-sm">{PERMISSION_LABELS[permission]}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={() => setIsEditModalOpen(false)}>
              {t('common:cancel')}
            </Button>
            <Button
              onClick={() => updateRoleMutation.mutate()}
              disabled={updateRoleMutation.isPending}
            >
              {updateRoleMutation.isPending ? t('saving') : t('save_changes')}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Delete Confirmation */}
      <ConfirmDialog
        isOpen={isDeleteDialogOpen}
        onClose={() => {
          setIsDeleteDialogOpen(false);
          setSelectedRole(null);
        }}
        onConfirm={() => removeRoleMutation.mutate()}
        title={t('remove_team_member')}
        message={t('confirm_remove_team_member', { name: selectedRole?.user?.fullname })}
        confirmText={t('common:remove')}
        loading={removeRoleMutation.isPending}
      />
    </Card>
  );
};
