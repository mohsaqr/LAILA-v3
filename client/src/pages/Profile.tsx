import { useState, useRef, useEffect } from 'react';
import { useMutation } from '@tanstack/react-query';
import { User, Mail, Shield, Calendar, Save, Camera } from 'lucide-react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../hooks/useAuth';
import { useTheme } from '../hooks/useTheme';
import { activityLogger } from '../services/activityLogger';
import { useTracker } from '../services/tracker';
import { authApi } from '../api/auth';
import { useAuthStore } from '../store/authStore';
import { resolveFileUrl } from '../api/client';
import { Card, CardBody, CardHeader } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { Input } from '../components/common/Input';

export const Profile = () => {
  const { t } = useTranslation(['settings', 'common']);
  const { user } = useAuth();
  const { isDark } = useTheme();
  const track = useTracker('profile');
  const setUser = useAuthStore(s => s.setUser);
  const [isEditing, setIsEditing] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [formData, setFormData] = useState({
    fullname: user?.fullname || '',
    email: user?.email || '',
  });

  // Theme colors
  const colors = {
    textPrimary: isDark ? '#f3f4f6' : '#111827',
    textSecondary: isDark ? '#9ca3af' : '#6b7280',
    iconColor: isDark ? '#9ca3af' : '#9ca3af',
  };

  useEffect(() => {
    activityLogger.logProfileViewed();
  }, []);

  const updateMutation = useMutation({
    mutationFn: (data: { fullname: string }) => authApi.updateProfile(data),
    onSuccess: (updated) => {
      setUser({ ...user!, fullname: updated.fullname });
      activityLogger.logProfileUpdated({ field: 'fullname' });
      toast.success(t('profile_updated'));
      setIsEditing(false);
    },
    onError: (error: any) => toast.error(error.message || t('failed_update_profile')),
  });

  const handleSave = () => {
    if (!formData.fullname.trim()) {
      toast.error(t('name_required'));
      return;
    }
    track('save_clicked', { verb: 'interacted', objectType: 'profile' });
    updateMutation.mutate({ fullname: formData.fullname });
  };

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploadingAvatar(true);
    try {
      const { avatarUrl } = await authApi.uploadAvatar(file);
      setUser({ ...user!, avatarUrl });
      activityLogger.logProfileUpdated({ field: 'avatar' });
      toast.success(t('profile_updated'));
    } catch (error: any) {
      toast.error(error.message || t('failed_update_profile'));
    } finally {
      setIsUploadingAvatar(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const getRoleBadges = () => {
    const badges = [];
    if (user?.isAdmin) badges.push({ label: t('role_admin'), color: 'bg-red-100 text-red-700' });
    if (user?.isInstructor) badges.push({ label: t('role_instructor'), color: 'bg-blue-100 text-blue-700' });
    if (!user?.isAdmin && !user?.isInstructor) badges.push({ label: t('role_student'), color: 'bg-green-100 text-green-700' });
    return badges;
  };

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-6 md:py-8">
      <h1 className="text-2xl sm:text-3xl font-bold mb-6 md:mb-8" style={{ color: colors.textPrimary }}>{t('profile')}</h1>

      <div className="space-y-6">
        {/* Profile Card */}
        <Card>
          <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
            <h2 className="text-lg font-semibold" style={{ color: colors.textPrimary }}>{t('personal_information')}</h2>
            {!isEditing ? (
              <Button variant="outline" size="sm" onClick={() => { track('edit_started', { verb: 'interacted', objectType: 'profile' }); setIsEditing(true); }}>
                {t('common:edit')}
              </Button>
            ) : (
              <div className="flex gap-2 flex-wrap">
                <Button variant="ghost" size="sm" onClick={() => { track('edit_cancelled', { verb: 'interacted', objectType: 'profile' }); setIsEditing(false); }}>
                  {t('common:cancel')}
                </Button>
                <Button
                  size="sm"
                  onClick={handleSave}
                  loading={updateMutation.isPending}
                  icon={<Save className="w-4 h-4" />}
                >
                  {t('common:save')}
                </Button>
              </div>
            )}
          </CardHeader>
          <CardBody className="space-y-6">
            {/* Avatar */}
            <div className="flex items-center gap-4">
              <div className="relative w-20 h-20">
                {user?.avatarUrl ? (
                  <img
                    src={resolveFileUrl(user.avatarUrl)}
                    alt={user.fullname}
                    className="w-20 h-20 rounded-full object-cover"
                  />
                ) : (
                  <div className="w-20 h-20 rounded-full bg-gradient-to-br from-primary-500 to-secondary-500 flex items-center justify-center">
                    <User className="w-10 h-10 text-white" />
                  </div>
                )}
                {isEditing && (
                  <button
                    type="button"
                    onClick={() => { track('avatar_upload_clicked', { verb: 'interacted', objectType: 'profile' }); fileInputRef.current?.click(); }}
                    disabled={isUploadingAvatar}
                    className="absolute inset-0 rounded-full flex items-center justify-center transition-opacity"
                    style={{ backgroundColor: 'rgba(0,0,0,0.45)' }}
                    title="Change photo"
                  >
                    <Camera className="w-6 h-6 text-white" />
                  </button>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/gif,image/webp"
                  className="hidden"
                  onChange={handleAvatarChange}
                />
              </div>
              <div>
                <h3 className="text-xl font-semibold" style={{ color: colors.textPrimary }}>{user?.fullname}</h3>
                <div className="flex gap-2 mt-1">
                  {getRoleBadges().map(badge => (
                    <span
                      key={badge.label}
                      className={`px-2 py-0.5 text-xs font-medium rounded ${badge.color}`}
                    >
                      {badge.label}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* Fields */}
            <div className="grid gap-4">
              <div className="flex items-center gap-3">
                <User className="w-5 h-5" style={{ color: colors.iconColor }} />
                {isEditing ? (
                  <Input
                    value={formData.fullname}
                    onChange={e => setFormData(f => ({ ...f, fullname: e.target.value }))}
                    onBlur={() => track('name_changed', { verb: 'updated', objectType: 'profile', payload: { field: 'fullname' } })}
                    placeholder={t('full_name_placeholder')}
                    className="flex-1"
                  />
                ) : (
                  <div>
                    <p className="text-sm" style={{ color: colors.textSecondary }}>{t('full_name')}</p>
                    <p style={{ color: colors.textPrimary }}>{user?.fullname}</p>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-3">
                <Mail className="w-5 h-5" style={{ color: colors.iconColor }} />
                <div>
                  <p className="text-sm" style={{ color: colors.textSecondary }}>{t('email')}</p>
                  <p style={{ color: colors.textPrimary }}>{user?.email}</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <Shield className="w-5 h-5" style={{ color: colors.iconColor }} />
                <div>
                  <p className="text-sm" style={{ color: colors.textSecondary }}>{t('account_status')}</p>
                  <p style={{ color: colors.textPrimary }}>
                    {user?.isConfirmed ? t('verified') : t('pending_verification')}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <Calendar className="w-5 h-5" style={{ color: colors.iconColor }} />
                <div>
                  <p className="text-sm" style={{ color: colors.textSecondary }}>{t('member_since')}</p>
                  <p style={{ color: colors.textPrimary }}>
                    {user?.createdAt
                      ? new Date(user.createdAt).toLocaleDateString('en-US', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric',
                        })
                      : t('na')}
                  </p>
                </div>
              </div>
            </div>
          </CardBody>
        </Card>

        {/* Security Card */}
        <Card>
          <CardHeader>
            <h2 className="text-lg font-semibold" style={{ color: colors.textPrimary }}>{t('security')}</h2>
          </CardHeader>
          <CardBody>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
              <div>
                <p className="font-medium" style={{ color: colors.textPrimary }}>{t('current_password').replace('Current ', '')}</p>
                <p className="text-sm" style={{ color: colors.textSecondary }}>{t('last_changed_never')}</p>
              </div>
              <Button variant="outline" size="sm">
                {t('change_password')}
              </Button>
            </div>
          </CardBody>
        </Card>
      </div>
    </div>
  );
};
