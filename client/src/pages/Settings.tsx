import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Bell, Moon, Globe, Shield, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../hooks/useAuth';
import { useTheme } from '../hooks/useTheme';
import { usersApi } from '../api/users';
import { Card, CardBody, CardHeader } from '../components/common/Card';
import { Button } from '../components/common/Button';

interface SettingToggleProps {
  label: string;
  description: string;
  enabled: boolean;
  onChange: (enabled: boolean) => void;
  colors: {
    textPrimary: string;
    textSecondary: string;
    toggleOff: string;
  };
}

const SettingToggle = ({ label, description, enabled, onChange, colors }: SettingToggleProps) => (
  <div className="flex items-center justify-between py-3">
    <div>
      <p className="font-medium" style={{ color: colors.textPrimary }}>{label}</p>
      <p className="text-sm" style={{ color: colors.textSecondary }}>{description}</p>
    </div>
    <button
      onClick={() => onChange(!enabled)}
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
  const { user, logout } = useAuth();
  const { isDark } = useTheme();
  const queryClient = useQueryClient();

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

  const [settings, setSettings] = useState({
    emailNotifications: true,
    darkMode: document.documentElement.classList.contains('dark'),
    language: 'en',
    twoFactorAuth: false,
  });

  const updateSettingMutation = useMutation({
    mutationFn: ({ key, value }: { key: string; value: string | null }) =>
      usersApi.updateUserSetting(user!.id, key, value),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['userSettings', user?.id] });
      toast.success('Setting updated');
    },
    onError: () => toast.error('Failed to update setting'),
  });

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

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <h1 className="text-3xl font-bold mb-8" style={{ color: colors.textPrimary }}>Settings</h1>

      <div className="space-y-6">
        {/* Notifications */}
        <Card>
          <CardHeader className="flex items-center gap-3">
            <Bell className="w-5 h-5" style={{ color: colors.textMuted }} />
            <h2 className="text-lg font-semibold" style={{ color: colors.textPrimary }}>Notifications</h2>
          </CardHeader>
          <CardBody>
            <div style={{ borderColor: colors.border }}>
              <SettingToggle
                label="Email Notifications"
                description="Receive email updates about your courses and assignments"
                enabled={settings.emailNotifications}
                onChange={() => handleToggle('emailNotifications')}
                colors={colors}
              />
            </div>
          </CardBody>
        </Card>

        {/* Appearance */}
        <Card>
          <CardHeader className="flex items-center gap-3">
            <Moon className="w-5 h-5" style={{ color: colors.textMuted }} />
            <h2 className="text-lg font-semibold" style={{ color: colors.textPrimary }}>Appearance</h2>
          </CardHeader>
          <CardBody>
            <div style={{ borderColor: colors.border }}>
              <SettingToggle
                label="Dark Mode"
                description="Use dark theme across the application"
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
            <h2 className="text-lg font-semibold" style={{ color: colors.textPrimary }}>Language & Region</h2>
          </CardHeader>
          <CardBody>
            <div className="flex items-center justify-between py-3">
              <div>
                <p className="font-medium" style={{ color: colors.textPrimary }}>Language</p>
                <p className="text-sm" style={{ color: colors.textSecondary }}>Select your preferred language</p>
              </div>
              <select
                value={settings.language}
                onChange={e => setSettings(s => ({ ...s, language: e.target.value }))}
                className="px-3 py-2 rounded-lg text-sm"
                style={{
                  backgroundColor: colors.selectBg,
                  borderColor: colors.selectBorder,
                  color: colors.textPrimary,
                  border: `1px solid ${colors.selectBorder}`,
                }}
              >
                <option value="en">English</option>
                <option value="ar">Arabic</option>
                <option value="es">Spanish</option>
                <option value="fr">French</option>
              </select>
            </div>
          </CardBody>
        </Card>

        {/* Security */}
        <Card>
          <CardHeader className="flex items-center gap-3">
            <Shield className="w-5 h-5" style={{ color: colors.textMuted }} />
            <h2 className="text-lg font-semibold" style={{ color: colors.textPrimary }}>Security</h2>
          </CardHeader>
          <CardBody>
            <div style={{ borderColor: colors.border }}>
              <SettingToggle
                label="Two-Factor Authentication"
                description="Add an extra layer of security to your account"
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
            <h2 className="text-lg font-semibold text-red-600">Danger Zone</h2>
          </CardHeader>
          <CardBody>
            <div className="flex items-center justify-between py-3">
              <div>
                <p className="font-medium" style={{ color: colors.textPrimary }}>Delete Account</p>
                <p className="text-sm" style={{ color: colors.textSecondary }}>
                  Permanently delete your account and all associated data
                </p>
              </div>
              <Button variant="danger" size="sm">
                Delete Account
              </Button>
            </div>
            <div
              className="flex items-center justify-between py-3 border-t"
              style={{ borderColor: colors.border }}
            >
              <div>
                <p className="font-medium" style={{ color: colors.textPrimary }}>Sign Out</p>
                <p className="text-sm" style={{ color: colors.textSecondary }}>Sign out from your account</p>
              </div>
              <Button variant="outline" size="sm" onClick={() => logout()}>
                Sign Out
              </Button>
            </div>
          </CardBody>
        </Card>
      </div>
    </div>
  );
};
