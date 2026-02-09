import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Moon, Globe, Shield, Trash2, Mail, Bell } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../hooks/useAuth';
import { useTheme } from '../hooks/useTheme';
import { usersApi } from '../api/users';
import { notificationsApi, NotificationPreferences } from '../api/notifications';
import { Card, CardBody, CardHeader } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { useLanguageStore } from '../store/languageStore';
import { supportedLanguages, SupportedLanguage } from '../i18n/config';

interface SettingToggleProps {
  label: string;
  description: string;
  enabled: boolean;
  onChange: (enabled: boolean) => void;
  disabled?: boolean;
  colors: {
    textPrimary: string;
    textSecondary: string;
    toggleOff: string;
  };
}

const SettingToggle = ({ label, description, enabled, onChange, disabled, colors }: SettingToggleProps) => (
  <div className={`flex items-center justify-between py-3 ${disabled ? 'opacity-50' : ''}`}>
    <div>
      <p className="font-medium" style={{ color: colors.textPrimary }}>{label}</p>
      <p className="text-sm" style={{ color: colors.textSecondary }}>{description}</p>
    </div>
    <button
      onClick={() => !disabled && onChange(!enabled)}
      disabled={disabled}
      className="relative w-11 h-6 rounded-full transition-colors"
      style={{ backgroundColor: enabled ? '#088F8F' : colors.toggleOff }}
    >
      <span
        className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${
          enabled ? 'translate-x-5' : 'translate-x-0'
        }`}
      />
    </button>
  </div>
);

export const Settings = () => {
  const { t } = useTranslation(['settings', 'notifications', 'common']);
  const { user, logout } = useAuth();
  const { isDark } = useTheme();
  const queryClient = useQueryClient();
  const { language: currentLanguage, setLanguage } = useLanguageStore();

  const colors = {
    bg: isDark ? '#111827' : '#f9fafb',
    textPrimary: isDark ? '#f3f4f6' : '#111827',
    textSecondary: isDark ? '#9ca3af' : '#6b7280',
    textMuted: isDark ? '#6b7280' : '#9ca3af',
    border: isDark ? '#374151' : '#e5e7eb',
    toggleOff: isDark ? '#4b5563' : '#d1d5db',
    selectBg: isDark ? '#374151' : '#ffffff',
    selectBorder: isDark ? '#4b5563' : '#d1d5db',
  };

  useQuery({
    queryKey: ['userSettings', user?.id],
    queryFn: () => usersApi.getUserSettings(user!.id),
    enabled: !!user,
  });

  // Notification preferences
  const { data: notificationPrefs } = useQuery({
    queryKey: ['notificationPreferences'],
    queryFn: () => notificationsApi.getPreferences(),
    enabled: !!user,
  });

  const updateNotificationPrefsMutation = useMutation({
    mutationFn: (data: Partial<NotificationPreferences>) => notificationsApi.updatePreferences(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notificationPreferences'] });
      toast.success(t('setting_updated'));
    },
    onError: () => toast.error(t('setting_update_failed')),
  });

  const [settings, setSettings] = useState({
    emailNotifications: true,
    darkMode: document.documentElement.classList.contains('dark'),
    language: 'en',
    twoFactorAuth: false,
  });

  const [notifSettings, setNotifSettings] = useState({
    // Email preferences
    emailEnrollment: true,
    emailAssignmentDue: true,
    emailGradePosted: true,
    emailAnnouncement: true,
    emailForumReply: true,
    emailCertificate: true,
    // In-app preferences
    inAppEnabled: true,
    inAppGradePosted: true,
    inAppDeadline: true,
    inAppAnnouncement: true,
    inAppForumReply: true,
    inAppCertificate: true,
  });

  // Sync notification settings when data loads
  useEffect(() => {
    if (notificationPrefs) {
      setNotifSettings({
        emailEnrollment: notificationPrefs.emailEnrollment,
        emailAssignmentDue: notificationPrefs.emailAssignmentDue,
        emailGradePosted: notificationPrefs.emailGradePosted,
        emailAnnouncement: notificationPrefs.emailAnnouncement,
        emailForumReply: notificationPrefs.emailForumReply,
        emailCertificate: notificationPrefs.emailCertificate,
        inAppEnabled: notificationPrefs.inAppEnabled,
        inAppGradePosted: notificationPrefs.inAppGradePosted,
        inAppDeadline: notificationPrefs.inAppDeadline,
        inAppAnnouncement: notificationPrefs.inAppAnnouncement,
        inAppForumReply: notificationPrefs.inAppForumReply,
        inAppCertificate: notificationPrefs.inAppCertificate,
      });
    }
  }, [notificationPrefs]);

  const updateSettingMutation = useMutation({
    mutationFn: ({ key, value }: { key: string; value: string | null }) =>
      usersApi.updateUserSetting(user!.id, key, value),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['userSettings', user?.id] });
      toast.success(t('setting_updated'));
    },
    onError: () => toast.error(t('setting_update_failed')),
  });

  const updateLanguageMutation = useMutation({
    mutationFn: (language: string) =>
      usersApi.updateUserSetting(user!.id, 'language', language),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['userSettings', user?.id] });
      toast.success(t('setting_updated'));
    },
    onError: () => toast.error(t('setting_update_failed')),
  });

  const handleLanguageChange = (newLanguage: SupportedLanguage) => {
    setLanguage(newLanguage);
    if (user) {
      updateLanguageMutation.mutate(newLanguage);
    }
  };

  const handleToggle = (key: keyof typeof settings) => {
    const newValue = !settings[key];
    setSettings(s => ({ ...s, [key]: newValue }));

    // Handle dark mode toggle specially - apply theme immediately
    if (key === 'darkMode') {
      const html = document.documentElement;
      if (newValue) {
        html.classList.add('dark');
      } else {
        html.classList.remove('dark');
      }
      localStorage.setItem('laila-theme-preference', newValue ? 'dark' : 'light');
    }

    updateSettingMutation.mutate({ key, value: newValue ? 'true' : 'false' });
  };

  const handleNotificationToggle = (key: keyof typeof notifSettings) => {
    const newValue = !notifSettings[key];
    setNotifSettings(s => ({ ...s, [key]: newValue }));
    updateNotificationPrefsMutation.mutate({ [key]: newValue });
  };

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <h1 className="text-3xl font-bold mb-8" style={{ color: colors.textPrimary }}>{t('settings')}</h1>

      <div className="space-y-6">
        {/* In-App Notifications */}
        <Card>
          <CardHeader className="flex items-center gap-3">
            <Bell className="w-5 h-5" style={{ color: colors.textMuted }} />
            <h2 className="text-lg font-semibold" style={{ color: colors.textPrimary }}>
              {t('notifications:preferences.in_app_section')}
            </h2>
          </CardHeader>
          <CardBody>
            <div className="divide-y" style={{ borderColor: colors.border }}>
              <SettingToggle
                label={t('notifications:preferences.in_app_enabled')}
                description={t('notifications:preferences.in_app_enabled_description')}
                enabled={notifSettings.inAppEnabled}
                onChange={() => handleNotificationToggle('inAppEnabled')}
                colors={colors}
              />
              <SettingToggle
                label={t('notifications:preferences.in_app_grade_posted')}
                description={t('notifications:preferences.in_app_grade_posted_description')}
                enabled={notifSettings.inAppGradePosted}
                onChange={() => handleNotificationToggle('inAppGradePosted')}
                disabled={!notifSettings.inAppEnabled}
                colors={colors}
              />
              <SettingToggle
                label={t('notifications:preferences.in_app_deadline')}
                description={t('notifications:preferences.in_app_deadline_description')}
                enabled={notifSettings.inAppDeadline}
                onChange={() => handleNotificationToggle('inAppDeadline')}
                disabled={!notifSettings.inAppEnabled}
                colors={colors}
              />
              <SettingToggle
                label={t('notifications:preferences.in_app_announcement')}
                description={t('notifications:preferences.in_app_announcement_description')}
                enabled={notifSettings.inAppAnnouncement}
                onChange={() => handleNotificationToggle('inAppAnnouncement')}
                disabled={!notifSettings.inAppEnabled}
                colors={colors}
              />
              <SettingToggle
                label={t('notifications:preferences.in_app_forum_reply')}
                description={t('notifications:preferences.in_app_forum_reply_description')}
                enabled={notifSettings.inAppForumReply}
                onChange={() => handleNotificationToggle('inAppForumReply')}
                disabled={!notifSettings.inAppEnabled}
                colors={colors}
              />
              <SettingToggle
                label={t('notifications:preferences.in_app_certificate')}
                description={t('notifications:preferences.in_app_certificate_description')}
                enabled={notifSettings.inAppCertificate}
                onChange={() => handleNotificationToggle('inAppCertificate')}
                disabled={!notifSettings.inAppEnabled}
                colors={colors}
              />
            </div>
          </CardBody>
        </Card>

        {/* Email Notifications */}
        <Card>
          <CardHeader className="flex items-center gap-3">
            <Mail className="w-5 h-5" style={{ color: colors.textMuted }} />
            <h2 className="text-lg font-semibold" style={{ color: colors.textPrimary }}>{t('email_notifications')}</h2>
          </CardHeader>
          <CardBody>
            <div className="divide-y" style={{ borderColor: colors.border }}>
              <SettingToggle
                label={t('course_enrollment')}
                description={t('course_enrollment_description')}
                enabled={notifSettings.emailEnrollment}
                onChange={() => handleNotificationToggle('emailEnrollment')}
                colors={colors}
              />
              <SettingToggle
                label={t('assignment_reminders')}
                description={t('assignment_reminders_description')}
                enabled={notifSettings.emailAssignmentDue}
                onChange={() => handleNotificationToggle('emailAssignmentDue')}
                colors={colors}
              />
              <SettingToggle
                label={t('grades_posted')}
                description={t('grades_posted_description')}
                enabled={notifSettings.emailGradePosted}
                onChange={() => handleNotificationToggle('emailGradePosted')}
                colors={colors}
              />
              <SettingToggle
                label={t('announcements')}
                description={t('announcements_description')}
                enabled={notifSettings.emailAnnouncement}
                onChange={() => handleNotificationToggle('emailAnnouncement')}
                colors={colors}
              />
            </div>
          </CardBody>
        </Card>

        {/* Appearance */}
        <Card>
          <CardHeader className="flex items-center gap-3">
            <Moon className="w-5 h-5" style={{ color: colors.textMuted }} />
            <h2 className="text-lg font-semibold" style={{ color: colors.textPrimary }}>{t('appearance')}</h2>
          </CardHeader>
          <CardBody>
            <div style={{ borderColor: colors.border }}>
              <SettingToggle
                label={t('dark_mode')}
                description={t('dark_mode_description')}
                enabled={settings.darkMode}
                onChange={() => handleToggle('darkMode')}
                colors={colors}
              />
            </div>
          </CardBody>
        </Card>

        {/* Language */}
        <Card>
          <CardHeader className="flex items-center gap-3">
            <Globe className="w-5 h-5" style={{ color: colors.textMuted }} />
            <h2 className="text-lg font-semibold" style={{ color: colors.textPrimary }}>
              {t('language_region')}
            </h2>
          </CardHeader>
          <CardBody>
            <div className="flex items-center justify-between py-3">
              <div>
                <p className="font-medium" style={{ color: colors.textPrimary }}>{t('language')}</p>
                <p className="text-sm" style={{ color: colors.textSecondary }}>{t('language_description')}</p>
              </div>
              <select
                value={currentLanguage}
                onChange={e => handleLanguageChange(e.target.value as SupportedLanguage)}
                className="px-3 py-2 rounded-lg text-sm"
                style={{
                  backgroundColor: colors.selectBg,
                  borderColor: colors.selectBorder,
                  color: colors.textPrimary,
                  border: `1px solid ${colors.selectBorder}`,
                }}
              >
                {Object.entries(supportedLanguages).map(([code, { nativeName }]) => (
                  <option key={code} value={code}>{nativeName}</option>
                ))}
              </select>
            </div>
          </CardBody>
        </Card>

        {/* Security */}
        <Card>
          <CardHeader className="flex items-center gap-3">
            <Shield className="w-5 h-5" style={{ color: colors.textMuted }} />
            <h2 className="text-lg font-semibold" style={{ color: colors.textPrimary }}>{t('security')}</h2>
          </CardHeader>
          <CardBody>
            <div style={{ borderColor: colors.border }}>
              <SettingToggle
                label={t('two_factor_auth')}
                description={t('two_factor_auth_description')}
                enabled={settings.twoFactorAuth}
                onChange={() => handleToggle('twoFactorAuth')}
                colors={colors}
              />
            </div>
          </CardBody>
        </Card>

        {/* Danger Zone */}
        <Card style={{ borderColor: isDark ? '#7f1d1d' : '#fecaca' }}>
          <CardHeader className="flex items-center gap-3">
            <Trash2 className="w-5 h-5 text-red-500" />
            <h2 className="text-lg font-semibold text-red-600">{t('danger_zone')}</h2>
          </CardHeader>
          <CardBody>
            <div className="flex items-center justify-between py-3">
              <div>
                <p className="font-medium" style={{ color: colors.textPrimary }}>{t('delete_account')}</p>
                <p className="text-sm" style={{ color: colors.textSecondary }}>
                  {t('delete_account_description')}
                </p>
              </div>
              <Button variant="danger" size="sm">
                {t('delete_account')}
              </Button>
            </div>
            <div
              className="flex items-center justify-between py-3 border-t"
              style={{ borderColor: colors.border }}
            >
              <div>
                <p className="font-medium" style={{ color: colors.textPrimary }}>{t('sign_out')}</p>
                <p className="text-sm" style={{ color: colors.textSecondary }}>{t('sign_out_description')}</p>
              </div>
              <Button variant="outline" size="sm" onClick={() => logout()}>
                {t('sign_out')}
              </Button>
            </div>
          </CardBody>
        </Card>
      </div>
    </div>
  );
};
