import { useEffect, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { userManagementApi } from '../../api/userManagement';
import { Button } from '../common/Button';
import { Modal } from '../common/Modal';

type Role = 'student' | 'instructor' | 'admin';

export interface UserFormModalUser {
  id: number;
  fullname: string;
  email: string;
  isAdmin: boolean;
  isInstructor: boolean;
  isActive?: boolean;
}

interface UserFormModalProps {
  open: boolean;
  onClose: () => void;
  /** Null/undefined = create mode; object = edit mode. */
  user?: UserFormModalUser | null;
  onSaved: () => void;
}

const roleOf = (u: UserFormModalUser): Role =>
  u.isAdmin ? 'admin' : u.isInstructor ? 'instructor' : 'student';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Create/edit form for admin user management. Drives both modes off the
 * `user` prop: absent = create (password required), present = edit
 * (password optional, active toggle shown). Styling mirrors the role
 * modal in UsersPanel.tsx.
 */
export const UserFormModal = ({ open, onClose, user, onSaved }: UserFormModalProps) => {
  const { t } = useTranslation(['admin', 'common']);
  const isEdit = !!user;

  const [fullname, setFullname] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<Role>('student');
  const [isActive, setIsActive] = useState(true);
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Reset the form whenever the modal opens or the target user changes.
  useEffect(() => {
    if (!open) return;
    setFullname(user?.fullname ?? '');
    setEmail(user?.email ?? '');
    setRole(user ? roleOf(user) : 'student');
    setIsActive(user?.isActive !== false);
    setPassword('');
    setErrors({});
  }, [open, user]);

  const roles: { value: Role; label: string }[] = [
    { value: 'student', label: t('role_student') },
    { value: 'instructor', label: t('role_instructor') },
    { value: 'admin', label: t('role_admin') },
  ];

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (isEdit && user) {
        return userManagementApi.updateUser(user.id, {
          fullname,
          email,
          isAdmin: role === 'admin',
          isInstructor: role !== 'student',
          isActive,
          ...(password ? { password } : {}),
        });
      }
      return userManagementApi.createUser({
        fullname,
        email,
        password,
        role,
        isActive,
      });
    },
    onSuccess: () => {
      toast.success(isEdit ? t('user_updated') : t('user_created'));
      onSaved();
      onClose();
    },
    onError: () => {
      toast.error(isEdit ? t('user_update_failed') : t('user_create_failed'));
    },
  });

  const validate = (): boolean => {
    const next: Record<string, string> = {};
    if (!fullname.trim()) next.fullname = t('error_fullname_required');
    if (!email.trim()) next.email = t('error_email_required');
    else if (!EMAIL_RE.test(email.trim())) next.email = t('error_email_invalid');
    if (!isEdit) {
      if (!password) next.password = t('error_password_required');
      else if (password.length < 8) next.password = t('error_password_min');
    } else if (password && password.length < 8) {
      next.password = t('error_password_min');
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = () => {
    if (!validate()) return;
    saveMutation.mutate();
  };

  const inputCls =
    'w-full px-3 py-2 text-sm rounded-lg border bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-offset-1';

  return (
    <Modal
      isOpen={open}
      onClose={onClose}
      title={isEdit ? t('edit_user') : t('add_user')}
      size="md"
    >
      <div className="space-y-4">
        {/* Full name */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
            {t('full_name')}
          </label>
          <input
            type="text"
            value={fullname}
            onChange={e => setFullname(e.target.value)}
            className={`${inputCls} ${
              errors.fullname
                ? 'border-red-400 dark:border-red-500'
                : 'border-gray-200 dark:border-gray-700'
            }`}
          />
          {errors.fullname && (
            <p className="mt-1 text-xs text-red-600 dark:text-red-400">{errors.fullname}</p>
          )}
        </div>

        {/* Email */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
            {t('email')}
          </label>
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            className={`${inputCls} ${
              errors.email
                ? 'border-red-400 dark:border-red-500'
                : 'border-gray-200 dark:border-gray-700'
            }`}
          />
          {errors.email && (
            <p className="mt-1 text-xs text-red-600 dark:text-red-400">{errors.email}</p>
          )}
        </div>

        {/* Role */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
            {t('role')}
          </label>
          <div className="space-y-2">
            {roles.map(({ value, label }) => (
              <label
                key={value}
                className={`flex items-center gap-3 p-2.5 rounded-lg border cursor-pointer transition-colors ${
                  role === value
                    ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20'
                    : 'border-gray-200 dark:border-gray-700'
                }`}
              >
                <input
                  type="radio"
                  name="user-form-role"
                  value={value}
                  checked={role === value}
                  onChange={() => setRole(value)}
                  className="accent-indigo-500"
                />
                <span className="text-sm font-medium text-gray-800 dark:text-gray-100">
                  {label}
                </span>
              </label>
            ))}
          </div>
        </div>

        {/* Active toggle — edit mode only */}
        {isEdit && (
          <label className="flex items-center justify-between p-2.5 rounded-lg border border-gray-200 dark:border-gray-700 cursor-pointer">
            <span className="text-sm font-medium text-gray-800 dark:text-gray-100">
              {t('status_active')}
            </span>
            <input
              type="checkbox"
              checked={isActive}
              onChange={e => setIsActive(e.target.checked)}
              className="accent-indigo-500 w-4 h-4 cursor-pointer"
            />
          </label>
        )}

        {/* Password */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
            {isEdit ? t('set_new_password') : t('password')}
          </label>
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder={isEdit ? t('leave_blank_to_keep') : undefined}
            autoComplete="new-password"
            className={`${inputCls} ${
              errors.password
                ? 'border-red-400 dark:border-red-500'
                : 'border-gray-200 dark:border-gray-700'
            }`}
          />
          {errors.password && (
            <p className="mt-1 text-xs text-red-600 dark:text-red-400">{errors.password}</p>
          )}
        </div>
      </div>

      <div className="flex justify-end gap-2 mt-5">
        <Button variant="outline" size="sm" onClick={onClose}>
          {t('common:cancel')}
        </Button>
        <Button
          size="sm"
          onClick={handleSubmit}
          loading={saveMutation.isPending}
          disabled={saveMutation.isPending}
        >
          {isEdit ? t('save_changes') : t('add_user')}
        </Button>
      </div>
    </Modal>
  );
};
