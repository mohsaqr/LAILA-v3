import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AdminLayout } from '../../components/admin';

// Import setting panels
import { UsersPanel } from './settings/UsersPanel';
import { EnrollmentsPanel } from './settings/EnrollmentsPanel';
import { LLMPanel } from './settings/LLMPanel';
import { SystemPanel } from './settings/SystemPanel';
import { MCQGenerationPanel } from './settings/MCQGenerationPanel';

type SettingsTab = 'users' | 'enrollments' | 'llm' | 'mcq' | 'system';

export const AdminSettings = () => {
  const { t } = useTranslation(['admin', 'common']);
  const [searchParams] = useSearchParams();
  const activeTab = (searchParams.get('tab') as SettingsTab) || 'users';

  const TAB_TITLES: Record<SettingsTab, { title: string; description: string }> = {
    users: { title: t('users'), description: t('manage_users_permissions') },
    enrollments: { title: t('enrollments'), description: t('course_enrollments_batch') },
    llm: { title: t('llm_providers'), description: t('ai_provider_config') },
    mcq: { title: t('mcq_generation'), description: t('mcq_generation_config') },
    system: { title: t('system_settings'), description: t('general_system_config') },
  };

  const renderPanel = () => {
    switch (activeTab) {
      case 'users':
        return <UsersPanel />;
      case 'enrollments':
        return <EnrollmentsPanel />;
      case 'llm':
        return <LLMPanel />;
      case 'mcq':
        return <MCQGenerationPanel />;
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
