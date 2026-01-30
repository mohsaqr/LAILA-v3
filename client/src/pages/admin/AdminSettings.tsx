import { useSearchParams } from 'react-router-dom';
import { AdminLayout } from '../../components/admin';

// Import setting panels
import { UsersPanel } from './settings/UsersPanel';
import { EnrollmentsPanel } from './settings/EnrollmentsPanel';
import { LLMPanel } from './settings/LLMPanel';
import { SystemPanel } from './settings/SystemPanel';

type SettingsTab = 'users' | 'enrollments' | 'llm' | 'system';

const TAB_TITLES: Record<SettingsTab, { title: string; description: string }> = {
  users: { title: 'Users', description: 'Manage users and permissions' },
  enrollments: { title: 'Enrollments', description: 'Course enrollments and batch import' },
  llm: { title: 'LLM Providers', description: 'AI provider configuration' },
  system: { title: 'System Settings', description: 'General system configuration' },
};

export const AdminSettings = () => {
  const [searchParams] = useSearchParams();
  const activeTab = (searchParams.get('tab') as SettingsTab) || 'users';

  const renderPanel = () => {
    switch (activeTab) {
      case 'users':
        return <UsersPanel />;
      case 'enrollments':
        return <EnrollmentsPanel />;
      case 'llm':
        return <LLMPanel />;
      case 'system':
        return <SystemPanel />;
      default:
        return <UsersPanel />;
    }
  };

  const { title, description } = TAB_TITLES[activeTab] || TAB_TITLES.users;

  return (
    <AdminLayout
      title={title}
      description={description}
    >
      {renderPanel()}
    </AdminLayout>
  );
};
