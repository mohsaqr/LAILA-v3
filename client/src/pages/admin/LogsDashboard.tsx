/**
 * Logs Dashboard - Main component for viewing platform activity logs.
 * Refactored to use extracted tab components for better maintainability.
 */

import { useState } from 'react';
import {
  Activity,
  MousePointer,
  MessagesSquare,
} from 'lucide-react';
import { AdminLayout } from '../../components/admin';
import { useTheme } from '../../hooks/useTheme';
import { TabType } from './logs/constants';
import { ActivityLogsTab } from './logs/ActivityLogsTab';
import { InteractionsTab } from './logs/InteractionsTab';
import { MessagesTab } from './logs/MessagesTab';

export const LogsDashboard = () => {
  const [activeTab, setActiveTab] = useState<TabType>('activity');
  const [exportStatus, setExportStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const { isDark } = useTheme();

  // Theme colors
  const colors = {
    bgInactive: isDark ? '#1f2937' : '#ffffff',
    textInactive: isDark ? '#d1d5db' : '#374151',
    border: isDark ? '#374151' : '#e5e7eb',
  };

  const tabs: { id: TabType; label: string; icon: React.ReactNode }[] = [
    { id: 'activity', label: 'Activity Log', icon: <Activity className="w-4 h-4" /> },
    { id: 'messages', label: 'Messages', icon: <MessagesSquare className="w-4 h-4" /> },
    { id: 'interactions', label: 'User Interactions', icon: <MousePointer className="w-4 h-4" /> },
  ];

  return (
    <AdminLayout
      title="Logs & Analytics"
      description="Comprehensive logging for all platform activities"
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
    </AdminLayout>
  );
};

export default LogsDashboard;
