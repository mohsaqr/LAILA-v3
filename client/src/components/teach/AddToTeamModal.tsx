import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-hot-toast';
import { UserPlus } from 'lucide-react';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import {
  courseRolesApi,
  CourseRoleType,
  ROLE_LABELS,
  ROLE_DEFAULT_PERMISSIONS,
} from '../../api/courseRoles';

interface AddToTeamModalProps {
  isOpen: boolean;
  onClose: () => void;
  courseId: number;
  user: { id: number; fullname: string; email: string };
}

const ROLE_OPTIONS: CourseRoleType[] = ['ta', 'co_instructor', 'course_admin'];

export const AddToTeamModal = ({ isOpen, onClose, courseId, user }: AddToTeamModalProps) => {
  const { t } = useTranslation(['teaching', 'common']);
  const queryClient = useQueryClient();
  const [role, setRole] = useState<CourseRoleType>('ta');

  const mutation = useMutation({
    mutationFn: () =>
      courseRolesApi.assignRole(courseId, user.id, role, ROLE_DEFAULT_PERMISSIONS[role]),
    onSuccess: () => {
      toast.success(
        t('teaching:added_to_team', {
          defaultValue: '{{name}} added to team as {{role}}',
          name: user.fullname,
          role: ROLE_LABELS[role],
        })
      );
      queryClient.invalidateQueries({ queryKey: ['courseRoles', courseId] });
      queryClient.invalidateQueries({ queryKey: ['courseEnrollments', courseId] });
      onClose();
    },
    onError: (err: any) => {
      toast.error(
        err?.message ||
          t('teaching:add_to_team_failed', { defaultValue: 'Failed to add to team' })
      );
    },
  });

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t('teaching:add_to_team', { defaultValue: 'Add to team' })}
      size="md"
    >
      <div className="space-y-4">
        <div className="flex items-center gap-3 p-3 rounded-lg bg-gray-50 dark:bg-gray-800">
          <div className="w-10 h-10 rounded-full bg-primary-100 dark:bg-primary-900 flex items-center justify-center flex-shrink-0">
            <UserPlus className="w-5 h-5 text-primary-600 dark:text-primary-300" />
          </div>
          <div className="min-w-0">
            <p className="font-medium text-gray-900 dark:text-white truncate">{user.fullname}</p>
            <p className="text-sm text-gray-500 dark:text-gray-400 truncate">{user.email}</p>
          </div>
        </div>

        <div>
          <label
            htmlFor="add-to-team-role"
            className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1"
          >
            {t('teaching:role', { defaultValue: 'Role' })}
          </label>
          <select
            id="add-to-team-role"
            value={role}
            onChange={(e) => setRole(e.target.value as CourseRoleType)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            {ROLE_OPTIONS.map((r) => (
              <option key={r} value={r}>
                {ROLE_LABELS[r]}
              </option>
            ))}
          </select>
          <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
            {t('teaching:default_permissions', { defaultValue: 'Default permissions' })}:{' '}
            {ROLE_DEFAULT_PERMISSIONS[role].join(', ')}
          </p>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" onClick={onClose} disabled={mutation.isPending}>
            {t('common:cancel')}
          </Button>
          <Button onClick={() => mutation.mutate()} loading={mutation.isPending}>
            {t('teaching:add', { defaultValue: 'Add' })}
          </Button>
        </div>
      </div>
    </Modal>
  );
};
