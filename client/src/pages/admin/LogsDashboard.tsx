import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  ArrowLeft,
  Activity,
  MessageCircle,
  MousePointer,
  Download,
  Filter,
  RefreshCw,
  Users,
  Clock,
  Bot,
  User,
  FileText,
  BarChart3,
  Monitor,
  BookOpen,
  Layers,
  Hash,
  Zap,
  X,
  Loader2,
  CheckCircle,
} from 'lucide-react';
import { analyticsApi, learningAnalyticsApi, activityLogApi } from '../../api/admin';
import { Card, CardBody, CardHeader } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { Loading } from '../../components/common/Loading';

// Event Type constants for Content and Assessment events
const CONTENT_EVENT_TYPES = [
  'lecture_view', 'video_play', 'video_pause', 'video_complete',
  'video_seek', 'document_download', 'scroll_depth_update', 'lecture_complete',
];

const ASSESSMENT_EVENT_TYPES = [
  'assignment_view', 'assignment_submit', 'grade_received',
  'feedback_view', 'assignment_start',
];

const eventTypeColors: Record<string, string> = {
  // Content events
  lecture_view: 'bg-blue-100 text-blue-800',
  video_play: 'bg-green-100 text-green-800',
  video_pause: 'bg-amber-100 text-amber-800',
  video_complete: 'bg-green-100 text-green-800',
  video_seek: 'bg-cyan-100 text-cyan-800',
  document_download: 'bg-purple-100 text-purple-800',
  scroll_depth_update: 'bg-gray-100 text-gray-800',
  lecture_complete: 'bg-green-100 text-green-800',
  // Assessment events
  assignment_view: 'bg-blue-100 text-blue-800',
  assignment_start: 'bg-purple-100 text-purple-800',
  assignment_submit: 'bg-green-100 text-green-800',
  grade_received: 'bg-amber-100 text-amber-800',
  feedback_view: 'bg-cyan-100 text-cyan-800',
  // Activity log verbs (from learning_activity_logs)
  viewed_course: 'bg-blue-100 text-blue-800',
  started_lecture: 'bg-purple-100 text-purple-800',
  completed_lecture: 'bg-green-100 text-green-800',
  progressed_lecture: 'bg-cyan-100 text-cyan-800',
  enrolled_course: 'bg-green-100 text-green-800',
  viewed_lecture: 'bg-blue-100 text-blue-800',
  viewed_section: 'bg-blue-100 text-blue-800',
  started_video: 'bg-purple-100 text-purple-800',
  paused_video: 'bg-amber-100 text-amber-800',
  completed_video: 'bg-green-100 text-green-800',
  submitted_assignment: 'bg-green-100 text-green-800',
  interacted_chatbot: 'bg-indigo-100 text-indigo-800',
  messaged_chatbot: 'bg-indigo-100 text-indigo-800',
  downloaded_file: 'bg-purple-100 text-purple-800',
};

type TabType = 'activity' | 'chatbot' | 'interactions';

export const LogsDashboard = () => {
  const [activeTab, setActiveTab] = useState<TabType>('activity');
  const [selectedChatbotLog, setSelectedChatbotLog] = useState<any | null>(null);
  const [exportStatus, setExportStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');

  // Activity Log filters
  const [activityFilters, setActivityFilters] = useState({
    eventType: '',
    startDate: '',
    endDate: '',
  });

  // Fetch from learning_activity_logs table (the working one)
  const { data: activityLogsData, isLoading: activityLogsLoading, refetch: refetchActivityLogs } = useQuery({
    queryKey: ['activityLogs', activityFilters],
    queryFn: () => activityLogApi.getLogs({
      startDate: activityFilters.startDate || undefined,
      endDate: activityFilters.endDate || undefined,
      page: 1,
      limit: 100,
    }),
    enabled: activeTab === 'activity',
  });

  // Also fetch from new content/assessment event tables
  const { data: contentEventSummary, isLoading: contentLoading, refetch: refetchContent } = useQuery({
    queryKey: ['contentEventSummary', activityFilters],
    queryFn: () => learningAnalyticsApi.getContentEventSummary({
      startDate: activityFilters.startDate || undefined,
      endDate: activityFilters.endDate || undefined,
      eventType: activityFilters.eventType && CONTENT_EVENT_TYPES.includes(activityFilters.eventType) ? activityFilters.eventType : undefined,
    }),
    enabled: activeTab === 'activity',
  });

  const { data: assessmentEventSummary, isLoading: assessmentLoading, refetch: refetchAssessment } = useQuery({
    queryKey: ['assessmentEventSummary', activityFilters],
    queryFn: () => learningAnalyticsApi.getAssessmentEventSummary({
      startDate: activityFilters.startDate || undefined,
      endDate: activityFilters.endDate || undefined,
      eventType: activityFilters.eventType && ASSESSMENT_EVENT_TYPES.includes(activityFilters.eventType) ? activityFilters.eventType : undefined,
    }),
    enabled: activeTab === 'activity',
  });

  const activityLoading = activityLogsLoading || contentLoading || assessmentLoading;
  const refetchActivity = () => {
    refetchActivityLogs();
    refetchContent();
    refetchAssessment();
  };

  // Combine recent events from all sources
  const combinedRecentEvents = [
    // From learning_activity_logs (activityLogger)
    ...(activityLogsData?.logs || []).map((e: any) => ({
      ...e,
      source: 'activity',
      eventType: `${e.verb}_${e.objectType}`,
    })),
    // From content_event_logs
    ...(contentEventSummary?.recentEvents || []).map((e: any) => ({ ...e, source: 'content' })),
    // From assessment_event_logs
    ...(assessmentEventSummary?.recentEvents || []).map((e: any) => ({ ...e, source: 'assessment' })),
  ].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()).slice(0, 100);

  const totalActivities = (activityLogsData?.pagination?.total || 0) + (contentEventSummary?.totalEvents || 0) + (assessmentEventSummary?.totalEvents || 0);

  // Chatbot Log queries
  const { data: chatbotSummary, isLoading: chatbotLoading, refetch: refetchChatbot } = useQuery({
    queryKey: ['chatbotSummary'],
    queryFn: () => analyticsApi.getChatbotSummary(),
    enabled: activeTab === 'chatbot',
  });

  // Interactions queries
  const { data: interactionSummary, isLoading: interactionsLoading, refetch: refetchInteractions } = useQuery({
    queryKey: ['interactionSummary'],
    queryFn: () => analyticsApi.getInteractionSummary(),
    enabled: activeTab === 'interactions',
  });

  const handleExportActivity = async () => {
    setExportStatus('loading');
    try {
      // Export combined data as JSON
      const data = {
        contentEvents: contentEventSummary?.recentEvents || [],
        assessmentEvents: assessmentEventSummary?.recentEvents || [],
        exportedAt: new Date().toISOString(),
      };
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `activity-logs-${Date.now()}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setExportStatus('success');
      setTimeout(() => setExportStatus('idle'), 2000);
    } catch (error: any) {
      console.error('Export failed:', error);
      setExportStatus('error');
      alert(`Export failed: ${error?.message || 'Unknown error'}. Check console for details.`);
      setTimeout(() => setExportStatus('idle'), 2000);
    }
  };

  const handleExportChatbot = async () => {
    setExportStatus('loading');
    try {
      const data = await analyticsApi.exportChatbotLogs();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `chatbot-logs-${Date.now()}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setExportStatus('success');
      setTimeout(() => setExportStatus('idle'), 2000);
    } catch (error: any) {
      console.error('Export failed:', error);
      setExportStatus('error');
      alert(`Export failed: ${error?.message || 'Unknown error'}. Check console for details.`);
      setTimeout(() => setExportStatus('idle'), 2000);
    }
  };

  const handleExportInteractions = async () => {
    setExportStatus('loading');
    try {
      const data = await analyticsApi.exportInteractions();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `interactions-${Date.now()}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setExportStatus('success');
      setTimeout(() => setExportStatus('idle'), 2000);
    } catch (error: any) {
      console.error('Export failed:', error);
      setExportStatus('error');
      alert(`Export failed: ${error?.message || 'Unknown error'}. Check console for details.`);
      setTimeout(() => setExportStatus('idle'), 2000);
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatFullDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

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

      {/* Activity Log Tab */}
      {activeTab === 'activity' && (
        <>
          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <Card>
              <CardBody className="p-4">
                <div className="text-sm text-gray-500">Total Activities</div>
                <div className="text-2xl font-bold">{totalActivities.toLocaleString()}</div>
              </CardBody>
            </Card>
            <Card>
              <CardBody className="p-4">
                <div className="text-sm text-gray-500">Content Events</div>
                <div className="text-2xl font-bold">{(contentEventSummary?.totalEvents || 0).toLocaleString()}</div>
              </CardBody>
            </Card>
            <Card>
              <CardBody className="p-4">
                <div className="text-sm text-gray-500">Assessment Events</div>
                <div className="text-2xl font-bold">{(assessmentEventSummary?.totalEvents || 0).toLocaleString()}</div>
              </CardBody>
            </Card>
            <Card>
              <CardBody className="p-4">
                <div className="text-sm text-gray-500">Event Types</div>
                <div className="text-2xl font-bold">
                  {(contentEventSummary?.byEventType?.length || 0) + (assessmentEventSummary?.byEventType?.length || 0)}
                </div>
              </CardBody>
            </Card>
          </div>

          {/* Filters */}
          <Card className="mb-6">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Filter className="w-4 h-4" />
                  Filters
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => refetchActivity()}>
                    <RefreshCw className="w-4 h-4 mr-1" />
                    Refresh
                  </Button>
                  <Button size="sm" onClick={handleExportActivity} disabled={exportStatus === 'loading'}>
                    {exportStatus === 'loading' ? (
                      <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                    ) : exportStatus === 'success' ? (
                      <CheckCircle className="w-4 h-4 mr-1 text-green-500" />
                    ) : (
                      <Download className="w-4 h-4 mr-1" />
                    )}
                    {exportStatus === 'loading' ? 'Exporting...' : exportStatus === 'success' ? 'Done!' : 'Export JSON'}
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardBody>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Event Type</label>
                  <select
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                    value={activityFilters.eventType}
                    onChange={(e) => setActivityFilters({ ...activityFilters, eventType: e.target.value })}
                  >
                    <option value="">All Events</option>
                    <optgroup label="Content Events">
                      {CONTENT_EVENT_TYPES.map((t) => (
                        <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>
                      ))}
                    </optgroup>
                    <optgroup label="Assessment Events">
                      {ASSESSMENT_EVENT_TYPES.map((t) => (
                        <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>
                      ))}
                    </optgroup>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
                  <input
                    type="date"
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                    value={activityFilters.startDate}
                    onChange={(e) => setActivityFilters({ ...activityFilters, startDate: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
                  <input
                    type="date"
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                    value={activityFilters.endDate}
                    onChange={(e) => setActivityFilters({ ...activityFilters, endDate: e.target.value })}
                  />
                </div>
                <div className="flex items-end">
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => setActivityFilters({ eventType: '', startDate: '', endDate: '' })}
                  >
                    Clear Filters
                  </Button>
                </div>
              </div>
            </CardBody>
          </Card>

          {/* Logs Table */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <span>Activity Logs</span>
                <span className="text-sm text-gray-500">
                  {combinedRecentEvents.length} recent events (showing up to 100)
                </span>
              </div>
            </CardHeader>
            <CardBody className="p-0">
              {activityLoading ? (
                <div className="p-8"><Loading /></div>
              ) : combinedRecentEvents.length === 0 ? (
                <div className="p-8 text-center text-gray-500">No activity logs found</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 border-b">
                      <tr>
                        <th className="px-4 py-3 text-left font-medium text-gray-600">Timestamp</th>
                        <th className="px-4 py-3 text-left font-medium text-gray-600">User</th>
                        <th className="px-4 py-3 text-left font-medium text-gray-600">Event Type</th>
                        <th className="px-4 py-3 text-left font-medium text-gray-600">Course</th>
                        <th className="px-4 py-3 text-left font-medium text-gray-600">Details</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {combinedRecentEvents.map((log: any, index: number) => (
                        <tr key={`${log.source}-${log.id}-${index}`} className="hover:bg-gray-50">
                          <td className="px-4 py-3 whitespace-nowrap text-gray-600">
                            {formatDate(log.timestamp)}
                          </td>
                          <td className="px-4 py-3">
                            <div className="font-medium">{log.userFullname || 'Unknown'}</div>
                            <div className="text-xs text-gray-500">{log.userEmail}</div>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${eventTypeColors[log.eventType] || 'bg-gray-100 text-gray-800'}`}>
                              {log.source === 'activity' ? `${log.verb} ${log.objectType}` : log.eventType?.replace(/_/g, ' ')}
                            </span>
                            <div className="text-xs text-gray-400 mt-0.5">
                              {log.source === 'activity' ? 'Activity' : log.source === 'content' ? 'Content' : 'Assessment'}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            {log.courseTitle ? (
                              <div className="text-sm text-gray-700 truncate max-w-[150px]">{log.courseTitle}</div>
                            ) : (
                              <span className="text-gray-400">-</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-xs text-gray-500">
                            {/* Activity log details (from learning_activity_logs) */}
                            {log.source === 'activity' && (
                              <>
                                {log.objectTitle && <div>{log.objectType}: {log.objectTitle}</div>}
                                {log.lectureTitle && <div>Lecture: {log.lectureTitle}</div>}
                                {log.moduleTitle && <div>Module: {log.moduleTitle}</div>}
                                {log.progress != null && <div>Progress: {log.progress}%</div>}
                              </>
                            )}
                            {/* Content event details */}
                            {log.source === 'content' && (
                              <>
                                {log.lectureTitle && <div>Lecture: {log.lectureTitle}</div>}
                                {log.moduleTitle && <div>Module: {log.moduleTitle}</div>}
                                {log.videoPercentWatched != null && <div>Video: {log.videoPercentWatched}%</div>}
                                {log.scrollDepthPercent != null && <div>Scroll: {log.scrollDepthPercent}%</div>}
                                {log.documentFileName && <div>File: {log.documentFileName}</div>}
                              </>
                            )}
                            {/* Assessment event details */}
                            {log.source === 'assessment' && (
                              <>
                                {log.assignmentTitle && <div>Assignment: {log.assignmentTitle}</div>}
                                {log.grade != null && <div>Grade: {log.grade}/{log.maxPoints || '?'}</div>}
                                {log.attemptNumber && <div>Attempt: #{log.attemptNumber}</div>}
                              </>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardBody>
          </Card>
        </>
      )}

      {/* Chatbot Logs Tab */}
      {activeTab === 'chatbot' && (
        <>
          {chatbotLoading ? (
            <Loading text="Loading chatbot logs..." />
          ) : chatbotSummary ? (
            <>
              {/* Stats Row */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <Card>
                  <CardBody className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-lg bg-amber-100 flex items-center justify-center">
                      <MessageCircle className="w-6 h-6 text-amber-600" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-gray-900">{chatbotSummary.totalLogs}</p>
                      <p className="text-sm text-gray-500">Total Logs</p>
                    </div>
                  </CardBody>
                </Card>
                <Card>
                  <CardBody className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-lg bg-green-100 flex items-center justify-center">
                      <Bot className="w-6 h-6 text-green-600" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-gray-900">{chatbotSummary.byChatbot?.length || 0}</p>
                      <p className="text-sm text-gray-500">Active Chatbots</p>
                    </div>
                  </CardBody>
                </Card>
                <Card>
                  <CardBody className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-lg bg-blue-100 flex items-center justify-center">
                      <Clock className="w-6 h-6 text-blue-600" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-gray-900">
                        {chatbotSummary.responseTimeStats?.avg?.toFixed(2) || 0}s
                      </p>
                      <p className="text-sm text-gray-500">Avg Response</p>
                    </div>
                  </CardBody>
                </Card>
                <Card>
                  <CardBody className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-lg bg-purple-100 flex items-center justify-center">
                      <Users className="w-6 h-6 text-purple-600" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-gray-900">{chatbotSummary.byUser?.length || 0}</p>
                      <p className="text-sm text-gray-500">Unique Users</p>
                    </div>
                  </CardBody>
                </Card>
              </div>

              {/* Breakdowns Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
                {/* By Course */}
                <Card>
                  <CardHeader className="py-3">
                    <div className="flex items-center gap-2">
                      <BookOpen className="w-4 h-4 text-gray-500" />
                      <h3 className="font-semibold text-gray-900 text-sm">By Course</h3>
                    </div>
                  </CardHeader>
                  <CardBody className="pt-0">
                    <div className="space-y-2 max-h-40 overflow-y-auto">
                      {chatbotSummary.byCourse?.length > 0 ? (
                        chatbotSummary.byCourse.map((item: any) => (
                          <div key={item.courseId} className="flex items-center justify-between text-sm">
                            <span className="text-gray-700 truncate" title={item.courseTitle}>
                              {item.courseTitle || `Course #${item.courseId}`}
                            </span>
                            <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs font-medium">
                              {item.count}
                            </span>
                          </div>
                        ))
                      ) : (
                        <p className="text-gray-400 text-sm">No data</p>
                      )}
                    </div>
                  </CardBody>
                </Card>

                {/* By Module */}
                <Card>
                  <CardHeader className="py-3">
                    <div className="flex items-center gap-2">
                      <Layers className="w-4 h-4 text-gray-500" />
                      <h3 className="font-semibold text-gray-900 text-sm">By Module</h3>
                    </div>
                  </CardHeader>
                  <CardBody className="pt-0">
                    <div className="space-y-2 max-h-40 overflow-y-auto">
                      {chatbotSummary.byModule?.length > 0 ? (
                        chatbotSummary.byModule.map((item: any) => (
                          <div key={item.moduleId} className="flex items-center justify-between text-sm">
                            <span className="text-gray-700 truncate" title={item.moduleTitle}>
                              {item.moduleTitle || `Module #${item.moduleId}`}
                            </span>
                            <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded text-xs font-medium">
                              {item.count}
                            </span>
                          </div>
                        ))
                      ) : (
                        <p className="text-gray-400 text-sm">No data</p>
                      )}
                    </div>
                  </CardBody>
                </Card>

                {/* By Event Type */}
                <Card>
                  <CardHeader className="py-3">
                    <div className="flex items-center gap-2">
                      <Activity className="w-4 h-4 text-gray-500" />
                      <h3 className="font-semibold text-gray-900 text-sm">By Event Type</h3>
                    </div>
                  </CardHeader>
                  <CardBody className="pt-0">
                    <div className="space-y-2">
                      {chatbotSummary.byEventType?.map((item: any) => (
                        <div key={item.eventType} className="flex items-center justify-between text-sm">
                          <span className="text-gray-700 capitalize">{item.eventType?.replace(/_/g, ' ')}</span>
                          <span className="px-2 py-0.5 bg-purple-100 text-purple-700 rounded text-xs font-medium">
                            {item.count}
                          </span>
                        </div>
                      ))}
                    </div>
                  </CardBody>
                </Card>

                {/* By AI Model */}
                <Card>
                  <CardHeader className="py-3">
                    <div className="flex items-center gap-2">
                      <Zap className="w-4 h-4 text-gray-500" />
                      <h3 className="font-semibold text-gray-900 text-sm">By AI Model</h3>
                    </div>
                  </CardHeader>
                  <CardBody className="pt-0">
                    <div className="space-y-2">
                      {chatbotSummary.byAiModel?.length > 0 ? (
                        chatbotSummary.byAiModel.map((item: any) => (
                          <div key={item.model} className="flex items-center justify-between text-sm">
                            <span className="text-gray-700 font-mono text-xs">{item.model}</span>
                            <span className="px-2 py-0.5 bg-amber-100 text-amber-700 rounded text-xs font-medium">
                              {item.count}
                            </span>
                          </div>
                        ))
                      ) : (
                        <p className="text-gray-400 text-sm">No data</p>
                      )}
                    </div>
                  </CardBody>
                </Card>

                {/* By User */}
                <Card>
                  <CardHeader className="py-3">
                    <div className="flex items-center gap-2">
                      <User className="w-4 h-4 text-gray-500" />
                      <h3 className="font-semibold text-gray-900 text-sm">Top Users</h3>
                    </div>
                  </CardHeader>
                  <CardBody className="pt-0">
                    <div className="space-y-2 max-h-40 overflow-y-auto">
                      {chatbotSummary.byUser?.length > 0 ? (
                        chatbotSummary.byUser.slice(0, 5).map((item: any) => (
                          <div key={item.userId} className="flex items-center justify-between text-sm">
                            <span className="text-gray-700 truncate">{item.userName || `User #${item.userId}`}</span>
                            <span className="px-2 py-0.5 bg-gray-100 text-gray-700 rounded text-xs font-medium">
                              {item.count}
                            </span>
                          </div>
                        ))
                      ) : (
                        <p className="text-gray-400 text-sm">No data</p>
                      )}
                    </div>
                  </CardBody>
                </Card>

                {/* Message Stats */}
                <Card>
                  <CardHeader className="py-3">
                    <div className="flex items-center gap-2">
                      <Hash className="w-4 h-4 text-gray-500" />
                      <h3 className="font-semibold text-gray-900 text-sm">Message Stats</h3>
                    </div>
                  </CardHeader>
                  <CardBody className="pt-0">
                    <div className="space-y-3 text-sm">
                      <div>
                        <p className="text-gray-500 text-xs">Avg Message Length</p>
                        <p className="font-medium">
                          {Math.round(chatbotSummary.messageLengthStats?.avgChars || 0)} chars / {Math.round(chatbotSummary.messageLengthStats?.avgWords || 0)} words
                        </p>
                      </div>
                      <div>
                        <p className="text-gray-500 text-xs">Avg Response Length</p>
                        <p className="font-medium">
                          {Math.round(chatbotSummary.responseLengthStats?.avgChars || 0)} chars / {Math.round(chatbotSummary.responseLengthStats?.avgWords || 0)} words
                        </p>
                      </div>
                      <div>
                        <p className="text-gray-500 text-xs">Response Time Range</p>
                        <p className="font-medium">
                          {chatbotSummary.responseTimeStats?.min?.toFixed(2) || 0}s - {chatbotSummary.responseTimeStats?.max?.toFixed(2) || 0}s
                        </p>
                      </div>
                    </div>
                  </CardBody>
                </Card>
              </div>

              {/* Recent Logs Table */}
              <Card>
                <CardHeader className="flex items-center justify-between">
                  <h3 className="font-semibold text-gray-900">Recent Chatbot Interactions</h3>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => refetchChatbot()}>
                      <RefreshCw className="w-4 h-4 mr-1" />
                      Refresh
                    </Button>
                    <Button variant="ghost" size="sm" onClick={handleExportChatbot} disabled={exportStatus === 'loading'}>
                      {exportStatus === 'loading' ? (
                        <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                      ) : (
                        <Download className="w-4 h-4 mr-1" />
                      )}
                      Export JSON
                    </Button>
                  </div>
                </CardHeader>
                <CardBody className="p-0">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 border-b">
                        <tr>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Timestamp</th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">From</th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Chatbot</th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Course</th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Content</th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Model</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {chatbotSummary.recentLogs?.flatMap((item: any) => {
                          const rows = [];
                          // User message row
                          if (item.messageContent) {
                            rows.push(
                              <tr key={`${item.id}-user`} className="hover:bg-blue-50 cursor-pointer" onClick={() => setSelectedChatbotLog(item)}>
                                <td className="px-3 py-2 text-gray-500 whitespace-nowrap text-xs">
                                  {new Date(item.timestamp).toLocaleString()}
                                </td>
                                <td className="px-3 py-2">
                                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                                    {item.userFullname || 'User'}
                                  </span>
                                </td>
                                <td className="px-3 py-2 text-xs text-gray-600">
                                  <div>{item.chatbotTitle || 'Unnamed'}</div>
                                  <div className="text-gray-400 text-[10px]">ID: {item.conversationId}</div>
                                </td>
                                <td className="px-3 py-2 text-xs">
                                  <div className="text-blue-600 truncate max-w-[100px]" title={item.courseTitle}>{item.courseTitle || '-'}</div>
                                </td>
                                <td className="px-3 py-2">
                                  <div className="text-xs text-gray-800 max-w-[350px]" title={item.messageContent}>
                                    {item.messageContent}
                                  </div>
                                </td>
                                <td className="px-3 py-2 text-gray-400 text-xs">-</td>
                              </tr>
                            );
                          }
                          // Bot response row
                          if (item.responseContent) {
                            rows.push(
                              <tr key={`${item.id}-bot`} className="hover:bg-green-50 cursor-pointer bg-gray-50/50" onClick={() => setSelectedChatbotLog(item)}>
                                <td className="px-3 py-2 text-gray-500 whitespace-nowrap text-xs">
                                  {new Date(new Date(item.timestamp).getTime() + (item.responseTime || 1) * 1000).toLocaleString()}
                                </td>
                                <td className="px-3 py-2">
                                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                                    Bot
                                  </span>
                                </td>
                                <td className="px-3 py-2 text-xs text-gray-600">
                                  <div>{item.chatbotTitle || 'Unnamed'}</div>
                                  <div className="text-gray-400 text-[10px]">ID: {item.conversationId}</div>
                                </td>
                                <td className="px-3 py-2 text-xs">
                                  <div className="text-blue-600 truncate max-w-[100px]" title={item.courseTitle}>{item.courseTitle || '-'}</div>
                                </td>
                                <td className="px-3 py-2">
                                  <div className="text-xs text-gray-800 max-w-[350px]" title={item.responseContent}>
                                    {item.responseContent}
                                  </div>
                                </td>
                                <td className="px-3 py-2 text-xs">
                                  <div className="font-mono text-gray-600">{item.aiModel || '-'}</div>
                                  <div className="text-gray-400 text-[10px]">{item.responseTime?.toFixed(2)}s</div>
                                </td>
                              </tr>
                            );
                          }
                          // Conversation start (no message/response)
                          if (!item.messageContent && !item.responseContent && item.eventType === 'conversation_start') {
                            rows.push(
                              <tr key={`${item.id}-start`} className="hover:bg-gray-50 cursor-pointer" onClick={() => setSelectedChatbotLog(item)}>
                                <td className="px-3 py-2 text-gray-500 whitespace-nowrap text-xs">
                                  {new Date(item.timestamp).toLocaleString()}
                                </td>
                                <td className="px-3 py-2">
                                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-800">
                                    System
                                  </span>
                                </td>
                                <td className="px-3 py-2 text-xs text-gray-600">
                                  <div>{item.chatbotTitle || 'Unnamed'}</div>
                                  <div className="text-gray-400 text-[10px]">ID: {item.conversationId}</div>
                                </td>
                                <td className="px-3 py-2 text-xs">
                                  <div className="text-blue-600 truncate max-w-[100px]" title={item.courseTitle}>{item.courseTitle || '-'}</div>
                                </td>
                                <td className="px-3 py-2">
                                  <span className="text-xs text-gray-500 italic">Conversation started by {item.userFullname || 'User'}</span>
                                </td>
                                <td className="px-3 py-2 text-gray-400 text-xs">-</td>
                              </tr>
                            );
                          }
                          return rows;
                        })}
                      </tbody>
                    </table>
                  </div>
                </CardBody>
              </Card>
            </>
          ) : null}
        </>
      )}

      {/* User Interactions Tab */}
      {activeTab === 'interactions' && (
        <>
          {interactionsLoading ? (
            <Loading text="Loading interaction data..." />
          ) : interactionSummary ? (
            <>
              {/* Stats Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <Card>
                  <CardBody className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-lg bg-blue-100 flex items-center justify-center">
                      <MousePointer className="w-6 h-6 text-blue-600" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-gray-900">{interactionSummary.totalInteractions}</p>
                      <p className="text-sm text-gray-500">Total Interactions</p>
                    </div>
                  </CardBody>
                </Card>
                <Card>
                  <CardBody className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-lg bg-green-100 flex items-center justify-center">
                      <Users className="w-6 h-6 text-green-600" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-gray-900">{interactionSummary.uniqueSessions}</p>
                      <p className="text-sm text-gray-500">Unique Sessions</p>
                    </div>
                  </CardBody>
                </Card>
                <Card>
                  <CardBody className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-lg bg-purple-100 flex items-center justify-center">
                      <Activity className="w-6 h-6 text-purple-600" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-gray-900">{interactionSummary.byType?.length || 0}</p>
                      <p className="text-sm text-gray-500">Event Types</p>
                    </div>
                  </CardBody>
                </Card>
                <Card>
                  <CardBody className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-lg bg-amber-100 flex items-center justify-center">
                      <FileText className="w-6 h-6 text-amber-600" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-gray-900">{interactionSummary.byPage?.length || 0}</p>
                      <p className="text-sm text-gray-500">Pages Tracked</p>
                    </div>
                  </CardBody>
                </Card>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
                {/* By Type */}
                <Card>
                  <CardHeader><h3 className="font-semibold text-gray-900 text-sm">By Event Type</h3></CardHeader>
                  <CardBody>
                    <div className="space-y-2">
                      {interactionSummary.byType?.map((item: any) => (
                        <div key={item.type} className="flex items-center justify-between text-sm">
                          <span className="text-gray-700 capitalize">{item.type?.replace('_', ' ')}</span>
                          <span className="px-2 py-0.5 bg-gray-100 rounded text-xs font-medium">{item.count}</span>
                        </div>
                      ))}
                    </div>
                  </CardBody>
                </Card>

                {/* By Page */}
                <Card>
                  <CardHeader><h3 className="font-semibold text-gray-900 text-sm">Top Pages</h3></CardHeader>
                  <CardBody>
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {interactionSummary.byPage?.slice(0, 10).map((item: any) => (
                        <div key={item.page} className="flex items-center justify-between text-sm">
                          <span className="text-gray-700 truncate max-w-[150px]" title={item.page}>{item.page}</span>
                          <span className="px-2 py-0.5 bg-gray-100 rounded text-xs font-medium">{item.count}</span>
                        </div>
                      ))}
                    </div>
                  </CardBody>
                </Card>

                {/* By Device/Browser */}
                <Card>
                  <CardHeader><h3 className="font-semibold text-gray-900 text-sm">Devices & Browsers</h3></CardHeader>
                  <CardBody>
                    <div className="space-y-3">
                      <div>
                        <p className="text-xs text-gray-500 mb-1">Devices</p>
                        <div className="space-y-1">
                          {interactionSummary.byDevice?.map((item: any) => (
                            <div key={item.device} className="flex items-center justify-between text-sm">
                              <span className="text-gray-700 capitalize">{item.device}</span>
                              <span className="px-2 py-0.5 bg-gray-100 rounded text-xs font-medium">{item.count}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 mb-1">Browsers</p>
                        <div className="space-y-1">
                          {interactionSummary.byBrowser?.map((item: any) => (
                            <div key={item.browser} className="flex items-center justify-between text-sm">
                              <span className="text-gray-700">{item.browser}</span>
                              <span className="px-2 py-0.5 bg-gray-100 rounded text-xs font-medium">{item.count}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </CardBody>
                </Card>
              </div>

              {/* Recent Interactions */}
              <Card>
                <CardHeader className="flex items-center justify-between">
                  <h3 className="font-semibold text-gray-900">Recent Interactions</h3>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => refetchInteractions()}>
                      <RefreshCw className="w-4 h-4 mr-1" />
                      Refresh
                    </Button>
                    <Button variant="ghost" size="sm" onClick={handleExportInteractions} disabled={exportStatus === 'loading'}>
                      {exportStatus === 'loading' ? (
                        <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                      ) : (
                        <Download className="w-4 h-4 mr-1" />
                      )}
                      Export JSON
                    </Button>
                  </div>
                </CardHeader>
                <CardBody className="p-0">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 border-b">
                        <tr>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Timestamp</th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">User</th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Event</th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Course / Module / Lecture</th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Page / Element</th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Client</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {interactionSummary.recentInteractions?.slice(0, 50).map((item: any) => (
                          <tr key={item.id} className="hover:bg-gray-50">
                            <td className="px-3 py-2 whitespace-nowrap">
                              <div className="text-xs font-medium text-gray-700">{new Date(item.timestamp).toLocaleDateString()}</div>
                              <div className="text-xs text-gray-500">{new Date(item.timestamp).toLocaleTimeString()}</div>
                            </td>
                            <td className="px-3 py-2">
                              <div className="text-sm font-medium text-gray-900">{item.userFullname || item.user?.fullname || 'Anonymous'}</div>
                              <div className="text-xs text-gray-500">{item.userEmail || item.user?.email || ''}</div>
                            </td>
                            <td className="px-3 py-2">
                              <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs capitalize font-medium">
                                {item.eventType?.replace('_', ' ')}
                              </span>
                            </td>
                            <td className="px-3 py-2 max-w-[280px]">
                              {item.courseTitle ? (
                                <div className="space-y-0.5">
                                  <div className="text-xs font-medium text-gray-900">{item.courseTitle}</div>
                                  {item.moduleTitle && <div className="text-xs text-gray-600">Module: {item.moduleTitle}</div>}
                                  {item.lectureTitle && <div className="text-xs text-gray-500">Lecture: {item.lectureTitle}</div>}
                                </div>
                              ) : (
                                <div className="text-xs text-gray-400">{item.pagePath}</div>
                              )}
                            </td>
                            <td className="px-3 py-2 text-xs">
                              {item.elementType && (
                                <span className="px-1.5 py-0.5 bg-gray-100 rounded text-gray-600">{item.elementType}</span>
                              )}
                              {item.scrollDepth != null && (
                                <div className="text-gray-400 mt-1">Scroll: {item.scrollDepth}%</div>
                              )}
                            </td>
                            <td className="px-3 py-2 text-xs text-gray-500">
                              <div className="font-medium">{item.deviceType}</div>
                              <div>{item.browserName}</div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardBody>
              </Card>
            </>
          ) : null}
        </>
      )}

      {/* Chatbot Log Detail Modal */}
      {selectedChatbotLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b flex items-center justify-between bg-gray-50">
              <h3 className="text-lg font-semibold">Chatbot Interaction Details</h3>
              <button
                onClick={() => setSelectedChatbotLog(null)}
                className="p-1 hover:bg-gray-200 rounded"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="flex-1 overflow-y-auto p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Left Column */}
                <div className="space-y-4">
                  {/* Timing */}
                  <div className="bg-gray-50 rounded-lg p-4">
                    <h4 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                      <Clock className="w-4 h-4" /> Timing
                    </h4>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div><span className="text-gray-500">Timestamp:</span></div>
                      <div className="font-medium">{formatFullDate(selectedChatbotLog.timestamp)}</div>
                      <div><span className="text-gray-500">Session ID:</span></div>
                      <div className="font-mono text-xs">{selectedChatbotLog.sessionId}</div>
                    </div>
                  </div>

                  {/* User */}
                  <div className="bg-blue-50 rounded-lg p-4">
                    <h4 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                      <User className="w-4 h-4" /> User
                    </h4>
                    <div className="text-sm">
                      <p className="font-medium">{selectedChatbotLog.userFullname || 'Anonymous'}</p>
                      <p className="text-gray-500">{selectedChatbotLog.userEmail}</p>
                    </div>
                  </div>

                  {/* Course Hierarchy */}
                  <div className="bg-green-50 rounded-lg p-4">
                    <h4 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                      <BookOpen className="w-4 h-4" /> Course Hierarchy
                    </h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex items-center gap-2">
                        <span className="w-16 text-gray-500">Course:</span>
                        <span className="font-medium">{selectedChatbotLog.courseTitle || '-'}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="w-16 text-gray-500">Module:</span>
                        <span>{selectedChatbotLog.moduleTitle || '-'}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="w-16 text-gray-500">Lecture:</span>
                        <span>{selectedChatbotLog.lectureTitle || '-'}</span>
                      </div>
                    </div>
                  </div>

                  {/* Client Info */}
                  <div className="bg-purple-50 rounded-lg p-4">
                    <h4 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                      <Monitor className="w-4 h-4" /> Client
                    </h4>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div><span className="text-gray-500">Device:</span></div>
                      <div>{selectedChatbotLog.deviceType || '-'}</div>
                      <div><span className="text-gray-500">Browser:</span></div>
                      <div>{selectedChatbotLog.browserName} {selectedChatbotLog.browserVersion}</div>
                    </div>
                  </div>
                </div>

                {/* Right Column */}
                <div className="space-y-4">
                  {/* Event */}
                  <div className="bg-amber-50 rounded-lg p-4">
                    <h4 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                      <Activity className="w-4 h-4" /> Event
                    </h4>
                    <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                      selectedChatbotLog.eventType === 'error' ? 'bg-red-100 text-red-700' :
                      selectedChatbotLog.eventType === 'message_received' ? 'bg-green-100 text-green-700' :
                      selectedChatbotLog.eventType === 'message_sent' ? 'bg-blue-100 text-blue-700' :
                      'bg-purple-100 text-purple-700'
                    }`}>
                      {selectedChatbotLog.eventType?.replace(/_/g, ' ')}
                    </span>
                  </div>

                  {/* Chatbot Config */}
                  <div className="bg-gray-50 rounded-lg p-4">
                    <h4 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                      <Bot className="w-4 h-4" /> Chatbot Config
                    </h4>
                    <div className="space-y-2 text-sm">
                      <div><span className="text-gray-500">Title:</span> {selectedChatbotLog.chatbotTitle || '-'}</div>
                      <div><span className="text-gray-500">Intro:</span> {selectedChatbotLog.chatbotIntro || '-'}</div>
                      {selectedChatbotLog.chatbotSystemPrompt && (
                        <div>
                          <span className="text-gray-500">System Prompt:</span>
                          <pre className="mt-1 p-2 bg-white border rounded text-xs whitespace-pre-wrap max-h-24 overflow-y-auto">
                            {selectedChatbotLog.chatbotSystemPrompt}
                          </pre>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Message */}
                  {selectedChatbotLog.messageContent && (
                    <div className="bg-blue-50 rounded-lg p-4">
                      <h4 className="font-semibold text-gray-900 mb-2">User Message</h4>
                      <p className="text-sm bg-white rounded p-3 border">{selectedChatbotLog.messageContent}</p>
                      <p className="text-xs text-gray-500 mt-2">
                        {selectedChatbotLog.messageCharCount} chars / {selectedChatbotLog.messageWordCount} words
                      </p>
                    </div>
                  )}

                  {/* Response */}
                  {selectedChatbotLog.responseContent && (
                    <div className="bg-green-50 rounded-lg p-4">
                      <h4 className="font-semibold text-gray-900 mb-2">AI Response</h4>
                      <p className="text-sm bg-white rounded p-3 border whitespace-pre-wrap max-h-48 overflow-y-auto">
                        {selectedChatbotLog.responseContent}
                      </p>
                      <div className="flex flex-wrap gap-4 text-xs text-gray-500 mt-2">
                        <span>{selectedChatbotLog.responseCharCount} chars</span>
                        <span>Response: {selectedChatbotLog.responseTime?.toFixed(2)}s</span>
                        <span>Model: {selectedChatbotLog.aiModel}</span>
                      </div>
                    </div>
                  )}

                  {/* Error */}
                  {selectedChatbotLog.errorMessage && (
                    <div className="bg-red-50 rounded-lg p-4">
                      <h4 className="font-semibold text-red-700 mb-2">Error</h4>
                      <p className="text-sm text-red-600">{selectedChatbotLog.errorMessage}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LogsDashboard;
