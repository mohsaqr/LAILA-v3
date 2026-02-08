/**
 * Chatbot Registry Page - Standalone admin page showing all chatbots
 * (both Global AI Tutors and Section Chatbots) with comprehensive details.
 */

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AdminLayout } from '../../components/admin';
import { ChatbotRegistryTab } from './logs/ChatbotRegistryTab';

export const ChatbotRegistry = () => {
  const { t } = useTranslation(['admin', 'common']);
  const [exportStatus, setExportStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');

  return (
    <AdminLayout
      title={t('chatbot_registry')}
      description={t('chatbot_registry_desc')}
    >
      <ChatbotRegistryTab
        exportStatus={exportStatus}
        setExportStatus={setExportStatus}
      />
    </AdminLayout>
  );
};

export default ChatbotRegistry;
