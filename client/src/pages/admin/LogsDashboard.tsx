/**
 * Logs Dashboard - Main component for viewing platform activity logs.
 * Refactored to use extracted tab components for better maintainability.
 */

import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import {
  Activity,
  MousePointer,
  MessagesSquare,
  Bot,
  MessageSquare,
} from 'lucide-react';
import { AdminLayout } from '../../components/admin';
import { useTheme } from '../../hooks/useTheme';
import { TabType } from './logs/constants';
import { ActivityLogsTab } from './logs/ActivityLogsTab';
import { InteractionsTab } from './logs/InteractionsTab';
import { MessagesTab } from './logs/MessagesTab';
import { ChatbotRegistryTab } from './logs/ChatbotRegistryTab';
import { ForumLogsTab } from './logs/ForumLogsTab';
import activityLogger from '../../services/activityLogger';
import { useTracker } from '../../services/tracker';

export const LogsDashboard = () => {
  const { t } = useTranslation(['admin', 'common']);
  const [searchParams] = useSearchParams();
  const initialUserId = useMemo(() => {
    const uid = searchParams.get('userId');
    return uid ? parseInt(uid, 10) : undefined;
  }, [searchParams]);
  const [activeTab, setActiveTab] = useState<TabType>('activity');
  const [exportStatus, setExportStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const { isDark } = useTheme();
  const track = useTracker('admin.logs');

  // Log page view
  useEffect(() => {
    activityLogger.logAdminLogsViewed();
  }, []);

  // Log tab switches
  useEffect(() => {
    activityLogger.logTabSwitched('analytics', activeTab);
    track('tab_switched', { verb: 'interacted', objectType: 'analytics', payload: { tab: activeTab } });
  }, [activeTab, track]);

  // Log export
  useEffect(() => {
    if (exportStatus === 'loading') {
      activityLogger.logExportRequested('analytics', 'csv');
    }
  }, [exportStatus]);

  // Theme colors
  const colors = {
    bgInactive: isDark ? '#1f2937' : '#ffffff',
    textInactive: isDark ? '#d1d5db' : '#374151',
    border: isDark ? '#374151' : '#e5e7eb',
  };

  const tabs: { id: TabType; label: string; icon: React.ReactNode }[] = [
    { id: 'activity', label: t('activity_log'), icon: <Activity className="w-4 h-4" /> },
    { id: 'messages', label: t('messages'), icon: <MessagesSquare className="w-4 h-4" /> },
    { id: 'interactions', label: t('user_interactions'), icon: <MousePointer className="w-4 h-4" /> },
    { id: 'chatbots', label: t('chatbot_registry'), icon: <Bot className="w-4 h-4" /> },
    { id: 'forums', label: t('forum_logs'), icon: <MessageSquare className="w-4 h-4" /> },
  ];

  return (
    <AdminLayout
      title={t('logs_analytics')}
      description={t('logs_analytics_desc')}
    >
      {/* Tab Navigation */}
      <div className="flex gap-2 mb-6 pb-4" style={{ borderBottom: `1px solid ${colors.border}` }}>
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 ${
              activeTab === tab.id
                ? 'bg-primary-600 text-white'
                : ''
            }`}
            style={activeTab !== tab.id ? {
              backgroundColor: colors.bgInactive,
              color: colors.textInactive,
              border: `1px solid ${colors.border}`,
            } : undefined}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'activity' && (
        <ActivityLogsTab
          exportStatus={exportStatus}
          setExportStatus={setExportStatus}
          initialUserId={initialUserId}
        />
      )}

      {activeTab === 'messages' && (
        <MessagesTab
          exportStatus={exportStatus}
          setExportStatus={setExportStatus}
        />
      )}

      {activeTab === 'interactions' && (
        <InteractionsTab
          exportStatus={exportStatus}
          setExportStatus={setExportStatus}
        />
      )}

      {activeTab === 'chatbots' && (
        <ChatbotRegistryTab
          exportStatus={exportStatus}
          setExportStatus={setExportStatus}
        />
      )}

      {activeTab === 'forums' && (
        <ForumLogsTab
          exportStatus={exportStatus}
          setExportStatus={setExportStatus}
        />
      )}
    </AdminLayout>
  );
};

export default LogsDashboard;
