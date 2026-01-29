/**
 * Logs Dashboard - Main component for viewing platform activity logs.
 * Refactored to use extracted tab components for better maintainability.
 */

import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft,
  Activity,
  MessageCircle,
  MousePointer,
  BarChart3,
} from 'lucide-react';
import { Card, CardBody } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
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
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-6">
        <Link to="/admin">
          <Button variant="ghost" size="sm" icon={<ArrowLeft className="w-4 h-4" />}>
            Back to Admin
          </Button>
        </Link>
      </div>

      <Card className="mb-6">
        <CardBody className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Logs & Analytics</h1>
            <p className="text-gray-600">Comprehensive logging for all platform activities</p>
          </div>
          <BarChart3 className="w-8 h-8 text-primary-600" />
        </CardBody>
      </Card>

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
    </div>
  );
};

export default LogsDashboard;
