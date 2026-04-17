import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Activity, Bot } from 'lucide-react';
import { coursesApi } from '../../api/courses';
import { Breadcrumb } from '../../components/common/Breadcrumb';
import { buildTeachingBreadcrumb } from '../../utils/breadcrumbs';
import { useTheme } from '../../hooks/useTheme';
import { ActivityLogsTab } from '../admin/logs/ActivityLogsTab';
import { ChatbotLogs } from './ChatbotLogs';
import activityLogger from '../../services/activityLogger';

type TabId = 'activity' | 'chatbot';

export const CourseLogs = () => {
  const { id } = useParams();
  const { t } = useTranslation(['admin', 'navigation', 'teaching']);
  const { isDark } = useTheme();
  const courseId = Number(id);
  const [activeTab, setActiveTab] = useState<TabId>('activity');
  const [exportStatus, setExportStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');

  useEffect(() => {
    if (courseId) {
      activityLogger.logCourseLogsViewed(courseId);
    }
  }, [courseId]);

  const { data: course } = useQuery({
    queryKey: ['course', courseId],
    queryFn: () => coursesApi.getCourseById(courseId),
    enabled: !!courseId,
  });

  const colors = {
    bgInactive: isDark ? '#1f2937' : '#ffffff',
    textInactive: isDark ? '#d1d5db' : '#374151',
    border: isDark ? '#374151' : '#e5e7eb',
  };

  const tabs: { id: TabId; label: string; icon: React.ReactNode }[] = [
    { id: 'activity', label: t('admin:activity_log'), icon: <Activity className="w-4 h-4" /> },
    { id: 'chatbot', label: t('navigation:chatbot_logs'), icon: <Bot className="w-4 h-4" /> },
  ];

  const breadcrumbItems = buildTeachingBreadcrumb(courseId, course?.title, t('navigation:logs'));

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-6">
        <Breadcrumb homeHref="/" items={breadcrumbItems} />
      </div>

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
          fixedCourseId={courseId}
        />
      )}

      {activeTab === 'chatbot' && (
        <ChatbotLogs embedded />
      )}
    </div>
  );
};
