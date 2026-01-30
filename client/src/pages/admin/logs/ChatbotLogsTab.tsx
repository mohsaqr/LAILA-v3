/**
 * Chatbot Logs Tab Component for the Logs Dashboard.
 * Displays chatbot interaction logs with detailed analytics.
 */

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  MessageCircle,
  Clock,
  Users,
  Bot,
  User,
  BookOpen,
  Layers,
  Activity,
  Zap,
  Hash,
  Monitor,
  RefreshCw,
  Download,
  Loader2,
  X,
} from 'lucide-react';
import { analyticsApi } from '../../../api/admin';
import { Card, CardBody, CardHeader } from '../../../components/common/Card';
import { Button } from '../../../components/common/Button';
import { Loading } from '../../../components/common/Loading';
import { exportChatbotLogs, formatFullDate } from './exportUtils';
import { debug } from '../../../utils/debug';

interface ChatbotLogsTabProps {
  exportStatus: 'idle' | 'loading' | 'success' | 'error';
  setExportStatus: (status: 'idle' | 'loading' | 'success' | 'error') => void;
}

export const ChatbotLogsTab = ({ exportStatus, setExportStatus }: ChatbotLogsTabProps) => {
  const [selectedChatbotLog, setSelectedChatbotLog] = useState<any | null>(null);

  const { data: chatbotSummary, isLoading: chatbotLoading, refetch: refetchChatbot } = useQuery({
    queryKey: ['chatbotSummary'],
    queryFn: () => analyticsApi.getChatbotSummary(),
  });

  const handleExportChatbot = async () => {
    setExportStatus('loading');
    try {
      await exportChatbotLogs();
      setExportStatus('success');
      setTimeout(() => setExportStatus('idle'), 2000);
    } catch (error: unknown) {
      debug.error('Export failed:', error);
      setExportStatus('error');
      const message = error instanceof Error ? error.message : 'Unknown error';
      alert(`Export failed: ${message}. Check console for details.`);
      setTimeout(() => setExportStatus('idle'), 2000);
    }
  };

  if (chatbotLoading) {
    return <Loading text="Loading chatbot logs..." />;
  }

  if (!chatbotSummary) {
    return null;
  }

  return (
    <>
      {/* Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardBody className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
              <MessageCircle className="w-6 h-6 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{chatbotSummary.totalLogs}</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">Total Logs</p>
            </div>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-lg bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
              <Bot className="w-6 h-6 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{chatbotSummary.byChatbot?.length || 0}</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">Active Chatbots</p>
            </div>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
              <Clock className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                {chatbotSummary.responseTimeStats?.avg?.toFixed(2) || 0}s
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400">Avg Response</p>
            </div>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
              <Users className="w-6 h-6 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{chatbotSummary.byUser?.length || 0}</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">Unique Users</p>
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
              <BookOpen className="w-4 h-4 text-gray-500 dark:text-gray-400" />
              <h3 className="font-semibold text-gray-900 dark:text-gray-100 text-sm">By Course</h3>
            </div>
          </CardHeader>
          <CardBody className="pt-0">
            <div className="space-y-2 max-h-40 overflow-y-auto">
              {chatbotSummary.byCourse?.length > 0 ? (
                chatbotSummary.byCourse.map((item: any) => (
                  <div key={item.courseId} className="flex items-center justify-between text-sm">
                    <span className="text-gray-700 dark:text-gray-300 truncate" title={item.courseTitle}>
                      {item.courseTitle || `Course #${item.courseId}`}
                    </span>
                    <span className="px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded text-xs font-medium">
                      {item.count}
                    </span>
                  </div>
                ))
              ) : (
                <p className="text-gray-400 dark:text-gray-500 text-sm">No data</p>
              )}
            </div>
          </CardBody>
        </Card>

        {/* By Module */}
        <Card>
          <CardHeader className="py-3">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-gray-500 dark:text-gray-400" />
              <h3 className="font-semibold text-gray-900 dark:text-gray-100 text-sm">By Module</h3>
            </div>
          </CardHeader>
          <CardBody className="pt-0">
            <div className="space-y-2 max-h-40 overflow-y-auto">
              {chatbotSummary.byModule?.length > 0 ? (
                chatbotSummary.byModule.map((item: any) => (
                  <div key={item.moduleId} className="flex items-center justify-between text-sm">
                    <span className="text-gray-700 dark:text-gray-300 truncate" title={item.moduleTitle}>
                      {item.moduleTitle || `Module #${item.moduleId}`}
                    </span>
                    <span className="px-2 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded text-xs font-medium">
                      {item.count}
                    </span>
                  </div>
                ))
              ) : (
                <p className="text-gray-400 dark:text-gray-500 text-sm">No data</p>
              )}
            </div>
          </CardBody>
        </Card>

        {/* By Event Type */}
        <Card>
          <CardHeader className="py-3">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-gray-500 dark:text-gray-400" />
              <h3 className="font-semibold text-gray-900 dark:text-gray-100 text-sm">By Event Type</h3>
            </div>
          </CardHeader>
          <CardBody className="pt-0">
            <div className="space-y-2">
              {chatbotSummary.byEventType?.map((item: any) => (
                <div key={item.eventType} className="flex items-center justify-between text-sm">
                  <span className="text-gray-700 dark:text-gray-300 capitalize">{item.eventType?.replace(/_/g, ' ')}</span>
                  <span className="px-2 py-0.5 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 rounded text-xs font-medium">
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
              <Zap className="w-4 h-4 text-gray-500 dark:text-gray-400" />
              <h3 className="font-semibold text-gray-900 dark:text-gray-100 text-sm">By AI Model</h3>
            </div>
          </CardHeader>
          <CardBody className="pt-0">
            <div className="space-y-2">
              {chatbotSummary.byAiModel?.length > 0 ? (
                chatbotSummary.byAiModel.map((item: any) => (
                  <div key={item.model} className="flex items-center justify-between text-sm">
                    <span className="text-gray-700 dark:text-gray-300 font-mono text-xs">{item.model}</span>
                    <span className="px-2 py-0.5 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 rounded text-xs font-medium">
                      {item.count}
                    </span>
                  </div>
                ))
              ) : (
                <p className="text-gray-400 dark:text-gray-500 text-sm">No data</p>
              )}
            </div>
          </CardBody>
        </Card>

        {/* By User */}
        <Card>
          <CardHeader className="py-3">
            <div className="flex items-center gap-2">
              <User className="w-4 h-4 text-gray-500 dark:text-gray-400" />
              <h3 className="font-semibold text-gray-900 dark:text-gray-100 text-sm">Top Users</h3>
            </div>
          </CardHeader>
          <CardBody className="pt-0">
            <div className="space-y-2 max-h-40 overflow-y-auto">
              {chatbotSummary.byUser?.length > 0 ? (
                chatbotSummary.byUser.slice(0, 5).map((item: any) => (
                  <div key={item.userId} className="flex items-center justify-between text-sm">
                    <span className="text-gray-700 dark:text-gray-300 truncate">{item.userName || `User #${item.userId}`}</span>
                    <span className="px-2 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded text-xs font-medium">
                      {item.count}
                    </span>
                  </div>
                ))
              ) : (
                <p className="text-gray-400 dark:text-gray-500 text-sm">No data</p>
              )}
            </div>
          </CardBody>
        </Card>

        {/* Message Stats */}
        <Card>
          <CardHeader className="py-3">
            <div className="flex items-center gap-2">
              <Hash className="w-4 h-4 text-gray-500 dark:text-gray-400" />
              <h3 className="font-semibold text-gray-900 dark:text-gray-100 text-sm">Message Stats</h3>
            </div>
          </CardHeader>
          <CardBody className="pt-0">
            <div className="space-y-3 text-sm">
              <div>
                <p className="text-gray-500 dark:text-gray-400 text-xs">Avg Message Length</p>
                <p className="font-medium text-gray-900 dark:text-gray-100">
                  {Math.round(chatbotSummary.messageLengthStats?.avgChars || 0)} chars / {Math.round(chatbotSummary.messageLengthStats?.avgWords || 0)} words
                </p>
              </div>
              <div>
                <p className="text-gray-500 dark:text-gray-400 text-xs">Avg Response Length</p>
                <p className="font-medium text-gray-900 dark:text-gray-100">
                  {Math.round(chatbotSummary.responseLengthStats?.avgChars || 0)} chars / {Math.round(chatbotSummary.responseLengthStats?.avgWords || 0)} words
                </p>
              </div>
              <div>
                <p className="text-gray-500 dark:text-gray-400 text-xs">Response Time Range</p>
                <p className="font-medium text-gray-900 dark:text-gray-100">
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
          <h3 className="font-semibold text-gray-900 dark:text-gray-100">Recent Chatbot Interactions</h3>
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
              <thead className="bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-700">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Timestamp</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">From</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Chatbot</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Course</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Content</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Model</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {chatbotSummary.recentLogs?.flatMap((item: any) => {
                  const rows = [];
                  // User message row
                  if (item.messageContent) {
                    rows.push(
                      <tr key={`${item.id}-user`} className="hover:bg-blue-50 dark:hover:bg-blue-900/20 cursor-pointer" onClick={() => setSelectedChatbotLog(item)}>
                        <td className="px-3 py-2 text-gray-500 dark:text-gray-400 whitespace-nowrap text-xs">
                          {new Date(item.timestamp).toLocaleString()}
                        </td>
                        <td className="px-3 py-2">
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300">
                            {item.userFullname || 'User'}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-xs text-gray-600 dark:text-gray-400">
                          <div>{item.chatbotTitle || 'Unnamed'}</div>
                          <div className="text-gray-400 dark:text-gray-500 text-[10px]">ID: {item.conversationId}</div>
                        </td>
                        <td className="px-3 py-2 text-xs">
                          <div className="text-blue-600 dark:text-blue-400 truncate max-w-[100px]" title={item.courseTitle}>{item.courseTitle || '-'}</div>
                        </td>
                        <td className="px-3 py-2">
                          <div className="text-xs text-gray-800 dark:text-gray-200 max-w-[350px]" title={item.messageContent}>
                            {item.messageContent}
                          </div>
                        </td>
                        <td className="px-3 py-2 text-gray-400 dark:text-gray-500 text-xs">-</td>
                      </tr>
                    );
                  }
                  // Bot response row
                  if (item.responseContent) {
                    rows.push(
                      <tr key={`${item.id}-bot`} className="hover:bg-green-50 dark:hover:bg-green-900/20 cursor-pointer bg-gray-50/50 dark:bg-gray-800/50" onClick={() => setSelectedChatbotLog(item)}>
                        <td className="px-3 py-2 text-gray-500 dark:text-gray-400 whitespace-nowrap text-xs">
                          {new Date(new Date(item.timestamp).getTime() + (item.responseTime || 1) * 1000).toLocaleString()}
                        </td>
                        <td className="px-3 py-2">
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300">
                            Bot
                          </span>
                        </td>
                        <td className="px-3 py-2 text-xs text-gray-600 dark:text-gray-400">
                          <div>{item.chatbotTitle || 'Unnamed'}</div>
                          <div className="text-gray-400 dark:text-gray-500 text-[10px]">ID: {item.conversationId}</div>
                        </td>
                        <td className="px-3 py-2 text-xs">
                          <div className="text-blue-600 dark:text-blue-400 truncate max-w-[100px]" title={item.courseTitle}>{item.courseTitle || '-'}</div>
                        </td>
                        <td className="px-3 py-2">
                          <div className="text-xs text-gray-800 dark:text-gray-200 max-w-[350px]" title={item.responseContent}>
                            {item.responseContent}
                          </div>
                        </td>
                        <td className="px-3 py-2 text-xs">
                          <div className="font-mono text-gray-600 dark:text-gray-400">{item.aiModel || '-'}</div>
                          <div className="text-gray-400 dark:text-gray-500 text-[10px]">{item.responseTime?.toFixed(2)}s</div>
                        </td>
                      </tr>
                    );
                  }
                  // Conversation start
                  if (!item.messageContent && !item.responseContent && item.eventType === 'conversation_start') {
                    rows.push(
                      <tr key={`${item.id}-start`} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer" onClick={() => setSelectedChatbotLog(item)}>
                        <td className="px-3 py-2 text-gray-500 dark:text-gray-400 whitespace-nowrap text-xs">
                          {new Date(item.timestamp).toLocaleString()}
                        </td>
                        <td className="px-3 py-2">
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300">
                            System
                          </span>
                        </td>
                        <td className="px-3 py-2 text-xs text-gray-600 dark:text-gray-400">
                          <div>{item.chatbotTitle || 'Unnamed'}</div>
                          <div className="text-gray-400 dark:text-gray-500 text-[10px]">ID: {item.conversationId}</div>
                        </td>
                        <td className="px-3 py-2 text-xs">
                          <div className="text-blue-600 dark:text-blue-400 truncate max-w-[100px]" title={item.courseTitle}>{item.courseTitle || '-'}</div>
                        </td>
                        <td className="px-3 py-2">
                          <span className="text-xs text-gray-500 dark:text-gray-400 italic">Conversation started by {item.userFullname || 'User'}</span>
                        </td>
                        <td className="px-3 py-2 text-gray-400 dark:text-gray-500 text-xs">-</td>
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

      {/* Chatbot Log Detail Modal */}
      {selectedChatbotLog && (
        <ChatbotLogDetailModal
          log={selectedChatbotLog}
          onClose={() => setSelectedChatbotLog(null)}
        />
      )}
    </>
  );
};

interface ChatbotLogDetailModalProps {
  log: any;
  onClose: () => void;
}

const ChatbotLogDetailModal = ({ log, onClose }: ChatbotLogDetailModalProps) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between bg-gray-50 dark:bg-gray-700/50">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Chatbot Interaction Details</h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded">
            <X className="w-5 h-5 text-gray-600 dark:text-gray-300" />
          </button>
        </div>

        {/* Modal Content */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Left Column */}
            <div className="space-y-4">
              {/* Timing */}
              <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
                <h4 className="font-semibold text-gray-900 dark:text-gray-100 mb-3 flex items-center gap-2">
                  <Clock className="w-4 h-4" /> Timing
                </h4>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div><span className="text-gray-500 dark:text-gray-400">Timestamp:</span></div>
                  <div className="font-medium text-gray-900 dark:text-gray-100">{formatFullDate(log.timestamp)}</div>
                  <div><span className="text-gray-500 dark:text-gray-400">Session ID:</span></div>
                  <div className="font-mono text-xs text-gray-900 dark:text-gray-100">{log.sessionId}</div>
                </div>
              </div>

              {/* User */}
              <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
                <h4 className="font-semibold text-gray-900 dark:text-gray-100 mb-3 flex items-center gap-2">
                  <User className="w-4 h-4" /> User
                </h4>
                <div className="text-sm">
                  <p className="font-medium text-gray-900 dark:text-gray-100">{log.userFullname || 'Anonymous'}</p>
                  <p className="text-gray-500 dark:text-gray-400">{log.userEmail}</p>
                </div>
              </div>

              {/* Course Hierarchy */}
              <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4">
                <h4 className="font-semibold text-gray-900 dark:text-gray-100 mb-3 flex items-center gap-2">
                  <BookOpen className="w-4 h-4" /> Course Hierarchy
                </h4>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2">
                    <span className="w-16 text-gray-500 dark:text-gray-400">Course:</span>
                    <span className="font-medium text-gray-900 dark:text-gray-100">{log.courseTitle || '-'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-16 text-gray-500 dark:text-gray-400">Module:</span>
                    <span className="text-gray-900 dark:text-gray-100">{log.moduleTitle || '-'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-16 text-gray-500 dark:text-gray-400">Lecture:</span>
                    <span className="text-gray-900 dark:text-gray-100">{log.lectureTitle || '-'}</span>
                  </div>
                </div>
              </div>

              {/* Client Info */}
              <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-4">
                <h4 className="font-semibold text-gray-900 dark:text-gray-100 mb-3 flex items-center gap-2">
                  <Monitor className="w-4 h-4" /> Client
                </h4>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div><span className="text-gray-500 dark:text-gray-400">Device:</span></div>
                  <div className="text-gray-900 dark:text-gray-100">{log.deviceType || '-'}</div>
                  <div><span className="text-gray-500 dark:text-gray-400">Browser:</span></div>
                  <div className="text-gray-900 dark:text-gray-100">{log.browserName} {log.browserVersion}</div>
                </div>
              </div>
            </div>

            {/* Right Column */}
            <div className="space-y-4">
              {/* Event */}
              <div className="bg-amber-50 dark:bg-amber-900/20 rounded-lg p-4">
                <h4 className="font-semibold text-gray-900 dark:text-gray-100 mb-3 flex items-center gap-2">
                  <Activity className="w-4 h-4" /> Event
                </h4>
                <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                  log.eventType === 'error' ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400' :
                  log.eventType === 'message_received' ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' :
                  log.eventType === 'message_sent' ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400' :
                  'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400'
                }`}>
                  {log.eventType?.replace(/_/g, ' ')}
                </span>
              </div>

              {/* Chatbot Config */}
              <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
                <h4 className="font-semibold text-gray-900 dark:text-gray-100 mb-3 flex items-center gap-2">
                  <Bot className="w-4 h-4" /> Chatbot Config
                </h4>
                <div className="space-y-2 text-sm">
                  <div><span className="text-gray-500 dark:text-gray-400">Title:</span> <span className="text-gray-900 dark:text-gray-100">{log.chatbotTitle || '-'}</span></div>
                  <div><span className="text-gray-500 dark:text-gray-400">Intro:</span> <span className="text-gray-900 dark:text-gray-100">{log.chatbotIntro || '-'}</span></div>
                  {log.chatbotSystemPrompt && (
                    <div>
                      <span className="text-gray-500 dark:text-gray-400">System Prompt:</span>
                      <pre className="mt-1 p-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded text-xs whitespace-pre-wrap max-h-24 overflow-y-auto text-gray-900 dark:text-gray-100">
                        {log.chatbotSystemPrompt}
                      </pre>
                    </div>
                  )}
                </div>
              </div>

              {/* Message */}
              {log.messageContent && (
                <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
                  <h4 className="font-semibold text-gray-900 dark:text-gray-100 mb-2">User Message</h4>
                  <p className="text-sm bg-white dark:bg-gray-800 rounded p-3 border border-gray-200 dark:border-gray-600 text-gray-900 dark:text-gray-100">{log.messageContent}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                    {log.messageCharCount} chars / {log.messageWordCount} words
                  </p>
                </div>
              )}

              {/* Response */}
              {log.responseContent && (
                <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4">
                  <h4 className="font-semibold text-gray-900 dark:text-gray-100 mb-2">AI Response</h4>
                  <p className="text-sm bg-white dark:bg-gray-800 rounded p-3 border border-gray-200 dark:border-gray-600 whitespace-pre-wrap max-h-48 overflow-y-auto text-gray-900 dark:text-gray-100">
                    {log.responseContent}
                  </p>
                  <div className="flex flex-wrap gap-4 text-xs text-gray-500 dark:text-gray-400 mt-2">
                    <span>{log.responseCharCount} chars</span>
                    <span>Response: {log.responseTime?.toFixed(2)}s</span>
                    <span>Model: {log.aiModel}</span>
                  </div>
                </div>
              )}

              {/* Error */}
              {log.errorMessage && (
                <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-4">
                  <h4 className="font-semibold text-red-700 dark:text-red-400 mb-2">Error</h4>
                  <p className="text-sm text-red-600 dark:text-red-400">{log.errorMessage}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
