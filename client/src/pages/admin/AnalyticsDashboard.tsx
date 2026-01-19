import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  ArrowLeft,
  MousePointer,
  MessageCircle,
  Users,
  Clock,
  Download,
  Eye,
  Bot,
  User,
  FileText,
  BarChart3,
  Activity,
  Monitor,
  BookOpen,
  Layers,
  Hash,
  Zap,
  X,
} from 'lucide-react';
import { analyticsApi } from '../../api/admin';
import { Card, CardBody, CardHeader } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { Loading } from '../../components/common/Loading';
import { ExportPanel } from '../../components/admin/ExportPanel';

export const AnalyticsDashboard = () => {
  const [activeTab, setActiveTab] = useState<'interactions' | 'chatbot' | 'export'>('chatbot');
  const [selectedChatbotLog, setSelectedChatbotLog] = useState<any | null>(null);

  // Fetch interaction summary
  const { data: interactionSummary, isLoading: interactionsLoading } = useQuery({
    queryKey: ['interactionSummary'],
    queryFn: () => analyticsApi.getInteractionSummary(),
    enabled: activeTab === 'interactions',
  });

  // Fetch chatbot summary
  const { data: chatbotSummary, isLoading: chatbotLoading } = useQuery({
    queryKey: ['chatbotSummary'],
    queryFn: () => analyticsApi.getChatbotSummary(),
    enabled: activeTab === 'chatbot',
  });

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  const formatRelativeTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSecs = Math.floor(diffMs / 1000);
    const diffMins = Math.floor(diffSecs / 60);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffSecs < 60) return `${diffSecs}s ago`;
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return formatDate(dateStr);
  };

  const handleExportInteractions = async () => {
    try {
      const data = await analyticsApi.exportInteractions();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `interactions-${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Export failed:', error);
    }
  };

  const handleExportChatbot = async () => {
    try {
      const data = await analyticsApi.exportChatbotLogs();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `chatbot-logs-${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Export failed:', error);
    }
  };

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
            <h1 className="text-2xl font-bold text-gray-900">Analytics Dashboard</h1>
            <p className="text-gray-600">Comprehensive logging for every interaction and chatbot conversation</p>
          </div>
          <div className="flex items-center gap-2">
            <BarChart3 className="w-8 h-8 text-primary-600" />
          </div>
        </CardBody>
      </Card>

      {/* Tab Navigation */}
      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setActiveTab('chatbot')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 ${
            activeTab === 'chatbot'
              ? 'bg-primary-600 text-white'
              : 'bg-white text-gray-700 hover:bg-gray-100 border'
          }`}
        >
          <MessageCircle className="w-4 h-4" />
          Chatbot Logs
        </button>
        <button
          onClick={() => setActiveTab('interactions')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 ${
            activeTab === 'interactions'
              ? 'bg-primary-600 text-white'
              : 'bg-white text-gray-700 hover:bg-gray-100 border'
          }`}
        >
          <MousePointer className="w-4 h-4" />
          User Interactions
        </button>
        <button
          onClick={() => setActiveTab('export')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 ${
            activeTab === 'export'
              ? 'bg-primary-600 text-white'
              : 'bg-white text-gray-700 hover:bg-gray-100 border'
          }`}
        >
          <Download className="w-4 h-4" />
          Export Data
        </button>
      </div>

      {/* Chatbot Tab */}
      {activeTab === 'chatbot' && (
        <>
          {chatbotLoading ? (
            <Loading text="Loading chatbot analytics..." />
          ) : chatbotSummary ? (
            <>
              {/* Stats Row 1 */}
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
                  <Button variant="ghost" size="sm" onClick={handleExportChatbot} icon={<Download className="w-4 h-4" />}>
                    Export All
                  </Button>
                </CardHeader>
                <CardBody className="p-0">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 border-b">
                        <tr>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Time</th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">User</th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Course / Module / Lecture</th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Chatbot</th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Event</th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Model</th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Time</th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Device</th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {chatbotSummary.recentLogs?.map((item: any) => (
                          <tr key={item.id} className="hover:bg-gray-50">
                            <td className="px-3 py-2 text-gray-500 whitespace-nowrap">
                              <div className="flex flex-col">
                                <span className="font-medium">{formatRelativeTime(item.timestamp)}</span>
                                <span className="text-xs text-gray-400">{formatDate(item.timestamp)}</span>
                              </div>
                            </td>
                            <td className="px-3 py-2">
                              <div className="flex flex-col">
                                <span className="font-medium text-gray-900">{item.userFullname || 'Anonymous'}</span>
                                <span className="text-xs text-gray-400">{item.userEmail}</span>
                              </div>
                            </td>
                            <td className="px-3 py-2">
                              <div className="flex flex-col text-xs">
                                <span className="text-blue-600">{item.courseTitle || '-'}</span>
                                <span className="text-gray-500">{item.moduleTitle} &gt; {item.lectureTitle}</span>
                              </div>
                            </td>
                            <td className="px-3 py-2 text-gray-600">
                              {item.chatbotTitle || 'Unnamed'}
                            </td>
                            <td className="px-3 py-2">
                              <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                                item.eventType === 'error' ? 'bg-red-100 text-red-700' :
                                item.eventType === 'message_received' ? 'bg-green-100 text-green-700' :
                                item.eventType === 'message_sent' ? 'bg-blue-100 text-blue-700' :
                                item.eventType === 'conversation_start' ? 'bg-purple-100 text-purple-700' :
                                'bg-gray-100 text-gray-700'
                              }`}>
                                {item.eventType?.replace(/_/g, ' ')}
                              </span>
                            </td>
                            <td className="px-3 py-2 text-gray-500 font-mono text-xs">
                              {item.aiModel || '-'}
                            </td>
                            <td className="px-3 py-2 text-gray-500">
                              {item.responseTime ? `${item.responseTime.toFixed(2)}s` : '-'}
                            </td>
                            <td className="px-3 py-2">
                              <div className="flex flex-col text-xs text-gray-500">
                                <span>{item.deviceType || '-'}</span>
                                <span>{item.browserName}</span>
                              </div>
                            </td>
                            <td className="px-3 py-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setSelectedChatbotLog(item)}
                                icon={<Eye className="w-4 h-4" />}
                              >
                                View
                              </Button>
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

      {/* Interactions Tab */}
      {activeTab === 'interactions' && (
        <>
          {interactionsLoading ? (
            <Loading text="Loading interaction analytics..." />
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
                  <Button variant="ghost" size="sm" onClick={handleExportInteractions} icon={<Download className="w-4 h-4" />}>
                    Export
                  </Button>
                </CardHeader>
                <CardBody className="p-0">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 border-b">
                        <tr>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Time</th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">User</th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Context</th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Element</th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Device</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {interactionSummary.recentInteractions?.slice(0, 50).map((item: any) => (
                          <tr key={item.id} className="hover:bg-gray-50">
                            <td className="px-3 py-2 text-gray-500 whitespace-nowrap">
                              {formatRelativeTime(item.timestamp)}
                            </td>
                            <td className="px-3 py-2 text-gray-900">
                              {item.userFullname || item.user?.fullname || 'Anonymous'}
                            </td>
                            <td className="px-3 py-2">
                              <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs capitalize">
                                {item.eventType?.replace('_', ' ')}
                              </span>
                            </td>
                            <td className="px-3 py-2 max-w-[250px]">
                              {/* Show course/module/lecture context if available */}
                              {item.courseTitle ? (
                                <div className="space-y-0.5">
                                  <div className="text-xs font-medium text-gray-900 truncate" title={item.courseTitle}>
                                    {item.courseTitle}
                                  </div>
                                  {item.moduleTitle && (
                                    <div className="text-xs text-gray-500 truncate" title={item.moduleTitle}>
                                      Module: {item.moduleTitle}
                                    </div>
                                  )}
                                  {item.lectureTitle && (
                                    <div className="text-xs text-gray-400 truncate" title={item.lectureTitle}>
                                      Lecture: {item.lectureTitle}
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <span className="text-gray-600 text-xs truncate" title={item.pagePath}>
                                  {item.pageTitle || item.pagePath}
                                </span>
                              )}
                            </td>
                            <td className="px-3 py-2 text-gray-500">
                              {item.elementType && (
                                <span className="text-xs">
                                  <span className="px-1.5 py-0.5 bg-gray-100 rounded text-gray-600">{item.elementType}</span>
                                  {item.elementText && (
                                    <div className="text-gray-400 mt-0.5 truncate max-w-[120px]" title={item.elementText}>
                                      "{item.elementText.substring(0, 25)}{item.elementText.length > 25 ? '...' : ''}"
                                    </div>
                                  )}
                                </span>
                              )}
                            </td>
                            <td className="px-3 py-2 text-xs text-gray-500">
                              <div>{item.deviceType}</div>
                              <div className="text-gray-400">{item.browserName}</div>
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

      {/* Export Tab */}
      {activeTab === 'export' && <ExportPanel />}

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
                      <div className="font-medium">{formatDate(selectedChatbotLog.timestamp)}</div>
                      <div><span className="text-gray-500">Session ID:</span></div>
                      <div className="font-mono text-xs">{selectedChatbotLog.sessionId}</div>
                      <div><span className="text-gray-500">Session Duration:</span></div>
                      <div>{selectedChatbotLog.sessionDuration}s</div>
                      <div><span className="text-gray-500">Event Sequence:</span></div>
                      <div>#{selectedChatbotLog.eventSequence}</div>
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
                        {selectedChatbotLog.moduleOrderIndex !== null && (
                          <span className="text-xs text-gray-400">(#{selectedChatbotLog.moduleOrderIndex})</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="w-16 text-gray-500">Lecture:</span>
                        <span>{selectedChatbotLog.lectureTitle || '-'}</span>
                        {selectedChatbotLog.lectureOrderIndex !== null && (
                          <span className="text-xs text-gray-400">(#{selectedChatbotLog.lectureOrderIndex})</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="w-16 text-gray-500">Section:</span>
                        <span>#{selectedChatbotLog.sectionId}</span>
                        {selectedChatbotLog.sectionOrderIndex !== null && (
                          <span className="text-xs text-gray-400">(order: {selectedChatbotLog.sectionOrderIndex})</span>
                        )}
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
                      <div><span className="text-gray-500">OS:</span></div>
                      <div>{selectedChatbotLog.osName} {selectedChatbotLog.osVersion}</div>
                      <div><span className="text-gray-500">Screen:</span></div>
                      <div>{selectedChatbotLog.screenWidth}x{selectedChatbotLog.screenHeight}</div>
                      <div><span className="text-gray-500">Language:</span></div>
                      <div>{selectedChatbotLog.language}</div>
                      <div><span className="text-gray-500">Timezone:</span></div>
                      <div>{selectedChatbotLog.timezone}</div>
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
                    <div className="flex items-center gap-2">
                      <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                        selectedChatbotLog.eventType === 'error' ? 'bg-red-100 text-red-700' :
                        selectedChatbotLog.eventType === 'message_received' ? 'bg-green-100 text-green-700' :
                        selectedChatbotLog.eventType === 'message_sent' ? 'bg-blue-100 text-blue-700' :
                        'bg-purple-100 text-purple-700'
                      }`}>
                        {selectedChatbotLog.eventType?.replace(/_/g, ' ')}
                      </span>
                      {selectedChatbotLog.conversationId && (
                        <span className="text-sm text-gray-500">
                          Conversation #{selectedChatbotLog.conversationId}
                          (msg {selectedChatbotLog.messageIndex} of {selectedChatbotLog.conversationMessageCount})
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Chatbot Config */}
                  <div className="bg-gray-50 rounded-lg p-4">
                    <h4 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                      <Bot className="w-4 h-4" /> Chatbot Config (at interaction time)
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
                        <span>{selectedChatbotLog.responseCharCount} chars / {selectedChatbotLog.responseWordCount} words</span>
                        <span>Response: {selectedChatbotLog.responseTime?.toFixed(2)}s</span>
                        <span>Model: {selectedChatbotLog.aiModel}</span>
                        {selectedChatbotLog.totalTokens && (
                          <span>Tokens: {selectedChatbotLog.promptTokens} + {selectedChatbotLog.completionTokens} = {selectedChatbotLog.totalTokens}</span>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Error */}
                  {selectedChatbotLog.errorMessage && (
                    <div className="bg-red-50 rounded-lg p-4">
                      <h4 className="font-semibold text-red-700 mb-2">Error</h4>
                      <p className="text-sm text-red-600">{selectedChatbotLog.errorMessage}</p>
                      {selectedChatbotLog.errorCode && (
                        <p className="text-xs text-red-500 mt-1">Code: {selectedChatbotLog.errorCode}</p>
                      )}
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
