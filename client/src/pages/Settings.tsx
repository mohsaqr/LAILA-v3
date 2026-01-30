import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Bell, Moon, Globe, Shield, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../hooks/useAuth';
import { usersApi } from '../api/users';
import { Card, CardBody, CardHeader } from '../components/common/Card';
import { Button } from '../components/common/Button';

interface SettingToggleProps {
  label: string;
  description: string;
  enabled: boolean;
  onChange: (enabled: boolean) => void;
}

const SettingToggle = ({ label, description, enabled, onChange }: SettingToggleProps) => (
  <div className="flex items-center justify-between py-3">
    <div>
      <p className="font-medium text-gray-900 dark:text-gray-100">{label}</p>
      <p className="text-sm text-gray-500 dark:text-gray-400">{description}</p>
    </div>
    <button
      onClick={() => onChange(!enabled)}
      className={`relative w-11 h-6 rounded-full transition-colors ${
        enabled ? 'bg-primary-500' : 'bg-gray-300'
      }`}
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
  const queryClient = useQueryClient();

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
      <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-8">Settings</h1>

      <div className="space-y-6">
        {/* Notifications */}
        <Card>
          <CardHeader className="flex items-center gap-3">
            <Bell className="w-5 h-5 text-gray-400" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Notifications</h2>
          </CardHeader>
          <CardBody className="divide-y divide-gray-100 dark:divide-gray-700">
            <SettingToggle
              label="Email Notifications"
              description="Receive email updates about your courses and assignments"
              enabled={settings.emailNotifications}
              onChange={() => handleToggle('emailNotifications')}
            />
          </CardBody>
        </Card>

        {/* Appearance */}
        <Card>
          <CardHeader className="flex items-center gap-3">
            <Moon className="w-5 h-5 text-gray-400" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Appearance</h2>
          </CardHeader>
          <CardBody className="divide-y divide-gray-100 dark:divide-gray-700">
            <SettingToggle
              label="Dark Mode"
              description="Use dark theme across the application"
              enabled={settings.darkMode}
              onChange={() => handleToggle('darkMode')}
            />
          </CardBody>
        </Card>

        {/* Language */}
        <Card>
          <CardHeader className="flex items-center gap-3">
            <Globe className="w-5 h-5 text-gray-400" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Language & Region</h2>
          </CardHeader>
          <CardBody>
            <div className="flex items-center justify-between py-3">
              <div>
                <p className="font-medium text-gray-900 dark:text-gray-100">Language</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">Select your preferred language</p>
              </div>
              <select
                value={settings.language}
                onChange={e => setSettings(s => ({ ...s, language: e.target.value }))}
                className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm dark:bg-gray-700 dark:text-white"
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
            <Shield className="w-5 h-5 text-gray-400" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Security</h2>
          </CardHeader>
          <CardBody className="divide-y divide-gray-100 dark:divide-gray-700">
            <SettingToggle
              label="Two-Factor Authentication"
              description="Add an extra layer of security to your account"
              enabled={settings.twoFactorAuth}
              onChange={() => handleToggle('twoFactorAuth')}
            />
          </CardBody>
        </Card>

        {/* Danger Zone */}
        <Card className="border-red-200">
          <CardHeader className="flex items-center gap-3">
            <Trash2 className="w-5 h-5 text-red-500" />
            <h2 className="text-lg font-semibold text-red-600">Danger Zone</h2>
          </CardHeader>
          <CardBody>
            <div className="flex items-center justify-between py-3">
              <div>
                <p className="font-medium text-gray-900 dark:text-gray-100">Delete Account</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Permanently delete your account and all associated data
                </p>
              </div>
              <Button variant="danger" size="sm">
                Delete Account
              </Button>
            </div>
            <div className="flex items-center justify-between py-3 border-t border-gray-100 dark:border-gray-700">
              <div>
                <p className="font-medium text-gray-900 dark:text-gray-100">Sign Out</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">Sign out from your account</p>
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
