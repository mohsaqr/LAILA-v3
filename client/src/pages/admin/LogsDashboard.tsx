/**
 * Logs Dashboard - Main component for viewing platform activity logs.
 * Refactored to use extracted tab components for better maintainability.
 */

import { useState } from 'react';
import {
  Activity,
  MessageCircle,
  MousePointer,
} from 'lucide-react';
import { AdminLayout } from '../../components/admin';
import { TabType } from './logs/constants';
import { ActivityLogsTab } from './logs/ActivityLogsTab';
import { ChatbotLogsTab } from './logs/ChatbotLogsTab';
import { InteractionsTab } from './logs/InteractionsTab';

export const LogsDashboard = () => {
  const [activeTab, setActiveTab] = useState<TabType>('activity');
  const [exportStatus, setExportStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');

  const tabs: { id: TabType; label: string; icon: React.ReactNode }[] = [
    { id: 'activity', label: 'Activity Log', icon: <Activity className="w-4 h-4" /> },
    { id: 'chatbot', label: 'Chatbot Logs', icon: <MessageCircle className="w-4 h-4" /> },
    { id: 'interactions', label: 'User Interactions', icon: <MousePointer className="w-4 h-4" /> },
  ];

  return (
    <AdminLayout
      title="Logs & Analytics"
      description="Comprehensive logging for all platform activities"
    >
      {/* Tab Navigation */}
      <div className="flex gap-2 mb-6 border-b border-gray-200 pb-4">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 ${
              activeTab === tab.id
                ? 'bg-primary-600 text-white'
                : 'bg-white text-gray-700 hover:bg-gray-100 border'
            }`}
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
        />
      )}

      {activeTab === 'chatbot' && (
        <ChatbotLogsTab
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
    </AdminLayout>
  );
};

export default LogsDashboard;
