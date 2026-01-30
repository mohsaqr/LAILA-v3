/**
 * Chatbot Registry Page - Standalone admin page showing all chatbots
 * (both Global AI Tutors and Section Chatbots) with comprehensive details.
 */

import { useState } from 'react';
import { AdminLayout } from '../../components/admin';
import { ChatbotRegistryTab } from './logs/ChatbotRegistryTab';

export const ChatbotRegistry = () => {
  const [exportStatus, setExportStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');

  return (
    <AdminLayout
      title="Chatbot Registry"
      description="View and manage all chatbots across the platform"
    >
      <ChatbotRegistryTab
        exportStatus={exportStatus}
        setExportStatus={setExportStatus}
      />
    </AdminLayout>
  );
};

export default ChatbotRegistry;
