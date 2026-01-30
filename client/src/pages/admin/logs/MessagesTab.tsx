/**
 * Messages Tab Component for the Logs Dashboard.
 * Unified view of all messages across Chatbot, Tutor, and Agent systems.
 */

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  MessageCircle,
  Clock,
  Users,
  Bot,
  User,
  Zap,
  RefreshCw,
  Download,
  Loader2,
  X,
  Filter,
  FileSpreadsheet,
  ChevronDown,
  ChevronUp,
  BookOpen,
  Cpu,
} from 'lucide-react';
import { messagesApi, UnifiedMessage, MessageFilters } from '../../../api/admin';
import { Card, CardBody, CardHeader } from '../../../components/common/Card';
import { Button } from '../../../components/common/Button';
import { Loading } from '../../../components/common/Loading';
import { formatDate, formatFullDate } from './exportUtils';
import { debug } from '../../../utils/debug';

interface MessagesTabProps {
  exportStatus: 'idle' | 'loading' | 'success' | 'error';
  setExportStatus: (status: 'idle' | 'loading' | 'success' | 'error') => void;
}

const SYSTEM_TYPE_COLORS: Record<string, string> = {
  chatbot: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  tutor: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
  agent: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
};

const ROLE_COLORS: Record<string, string> = {
  user: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  assistant: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
};

export const MessagesTab = ({ exportStatus, setExportStatus }: MessagesTabProps) => {
  const [filters, setFilters] = useState<MessageFilters>({
    page: 1,
    limit: 50,
  });
  const [showFilters, setShowFilters] = useState(false);
  const [expandedMessages, setExpandedMessages] = useState<Set<string>>(new Set());
  const [selectedMessage, setSelectedMessage] = useState<UnifiedMessage | null>(null);

  // Fetch stats
  const { data: stats, isLoading: statsLoading, refetch: refetchStats } = useQuery({
    queryKey: ['messageStats', filters.startDate, filters.endDate, filters.systemType, filters.courseId, filters.userId],
    queryFn: () => messagesApi.getStats({
      startDate: filters.startDate,
      endDate: filters.endDate,
      systemType: filters.systemType,
      courseId: filters.courseId,
      userId: filters.userId,
    }),
  });

  // Fetch messages
  const { data: messagesData, isLoading: messagesLoading, refetch: refetchMessages } = useQuery({
    queryKey: ['messages', filters],
    queryFn: () => messagesApi.getMessages(filters),
  });

  const handleRefresh = () => {
    refetchStats();
    refetchMessages();
  };

  const handleExportCSV = async () => {
    setExportStatus('loading');
    try {
      await messagesApi.exportCSV(filters);
      setExportStatus('success');
      setTimeout(() => setExportStatus('idle'), 2000);
    } catch (error: unknown) {
      debug.error('CSV Export failed:', error);
      setExportStatus('error');
      const message = error instanceof Error ? error.message : 'Unknown error';
      alert(`Export failed: ${message}`);
      setTimeout(() => setExportStatus('idle'), 2000);
    }
  };

  const handleExportExcel = async () => {
    setExportStatus('loading');
    try {
      await messagesApi.exportExcel(filters);
      setExportStatus('success');
      setTimeout(() => setExportStatus('idle'), 2000);
    } catch (error: unknown) {
      debug.error('Excel Export failed:', error);
      setExportStatus('error');
      const message = error instanceof Error ? error.message : 'Unknown error';
      alert(`Export failed: ${message}`);
      setTimeout(() => setExportStatus('idle'), 2000);
    }
  };

  const toggleMessageExpand = (id: string) => {
    const newExpanded = new Set(expandedMessages);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedMessages(newExpanded);
  };

  const handlePageChange = (newPage: number) => {
    setFilters(prev => ({ ...prev, page: newPage }));
  };

  if (statsLoading && messagesLoading) {
    return <Loading text="Loading messages..." />;
  }

  return (
    <>
      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardBody className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-lg bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
              <MessageCircle className="w-6 h-6 text-gray-600 dark:text-gray-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{stats?.total || 0}</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">Total Messages</p>
            </div>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
              <Bot className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{stats?.chatbot || 0}</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">Chatbot</p>
            </div>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
              <Cpu className="w-6 h-6 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{stats?.tutor || 0}</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">Tutor</p>
            </div>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
              <Zap className="w-6 h-6 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{stats?.agent || 0}</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">Agent Tests</p>
            </div>
          </CardBody>
        </Card>
      </div>

      {/* Additional Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardBody className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-lg bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
              <Users className="w-6 h-6 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{stats?.uniqueUsers || 0}</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">Unique Users</p>
            </div>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-lg bg-cyan-100 dark:bg-cyan-900/30 flex items-center justify-center">
              <Clock className="w-6 h-6 text-cyan-600 dark:text-cyan-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                {stats?.avgResponseTimeMs ? `${(stats.avgResponseTimeMs / 1000).toFixed(2)}s` : 'N/A'}
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400">Avg Response</p>
            </div>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-lg bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center">
              <Zap className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                {stats?.totalTokens ? stats.totalTokens.toLocaleString() : '0'}
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400">Total Tokens</p>
            </div>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-lg bg-rose-100 dark:bg-rose-900/30 flex items-center justify-center">
              <BookOpen className="w-6 h-6 text-rose-600 dark:text-rose-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                {stats?.byCourse?.length || 0}
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400">Courses</p>
            </div>
          </CardBody>
        </Card>
      </div>

      {/* Breakdowns Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        {/* By Model */}
        <Card>
          <CardHeader className="py-3">
            <div className="flex items-center gap-2">
              <Cpu className="w-4 h-4 text-gray-500 dark:text-gray-400" />
              <h3 className="font-semibold text-gray-900 dark:text-gray-100 text-sm">By AI Model</h3>
            </div>
          </CardHeader>
          <CardBody className="pt-0">
            <div className="space-y-2 max-h-40 overflow-y-auto">
              {stats?.byModel && stats.byModel.length > 0 ? (
                stats.byModel.map((item) => (
                  <div key={item.model} className="flex items-center justify-between text-sm">
                    <span className="text-gray-700 dark:text-gray-300 font-mono text-xs truncate" title={item.model}>
                      {item.model || 'Unknown'}
                    </span>
                    <span className="px-2 py-0.5 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 rounded text-xs font-medium">
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
              {stats?.byCourse && stats.byCourse.length > 0 ? (
                stats.byCourse.map((item) => (
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
      </div>

      {/* Filters & Actions */}
      <Card className="mb-6">
        <CardHeader className="flex items-center justify-between">
          <h3 className="font-semibold text-gray-900 dark:text-gray-100">Messages</h3>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setShowFilters(!showFilters)}>
              <Filter className="w-4 h-4 mr-1" />
              Filters
              {showFilters ? <ChevronUp className="w-4 h-4 ml-1" /> : <ChevronDown className="w-4 h-4 ml-1" />}
            </Button>
            <Button variant="outline" size="sm" onClick={handleRefresh}>
              <RefreshCw className="w-4 h-4 mr-1" />
              Refresh
            </Button>
            <Button variant="ghost" size="sm" onClick={handleExportCSV} disabled={exportStatus === 'loading'}>
              {exportStatus === 'loading' ? (
                <Loader2 className="w-4 h-4 mr-1 animate-spin" />
              ) : (
                <Download className="w-4 h-4 mr-1" />
              )}
              CSV
            </Button>
            <Button variant="ghost" size="sm" onClick={handleExportExcel} disabled={exportStatus === 'loading'}>
              {exportStatus === 'loading' ? (
                <Loader2 className="w-4 h-4 mr-1 animate-spin" />
              ) : (
                <FileSpreadsheet className="w-4 h-4 mr-1" />
              )}
              Excel
            </Button>
          </div>
        </CardHeader>

        {/* Filters Panel */}
        {showFilters && (
          <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Start Date</label>
                <input
                  type="date"
                  value={filters.startDate || ''}
                  onChange={(e) => setFilters(prev => ({ ...prev, startDate: e.target.value || undefined, page: 1 }))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">End Date</label>
                <input
                  type="date"
                  value={filters.endDate || ''}
                  onChange={(e) => setFilters(prev => ({ ...prev, endDate: e.target.value || undefined, page: 1 }))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">System Type</label>
                <select
                  value={filters.systemType || ''}
                  onChange={(e) => setFilters(prev => ({ ...prev, systemType: e.target.value as MessageFilters['systemType'] || undefined, page: 1 }))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm"
                >
                  <option value="">All Systems</option>
                  <option value="chatbot">Chatbot</option>
                  <option value="tutor">Tutor</option>
                  <option value="agent">Agent Tests</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">User ID</label>
                <input
                  type="number"
                  placeholder="Filter by user ID"
                  value={filters.userId || ''}
                  onChange={(e) => setFilters(prev => ({ ...prev, userId: e.target.value ? parseInt(e.target.value) : undefined, page: 1 }))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm"
                />
              </div>
            </div>
            <div className="mt-4 flex justify-end">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setFilters({ page: 1, limit: 50 })}
              >
                Clear Filters
              </Button>
            </div>
          </div>
        )}

        {/* Messages Table */}
        <CardBody className="p-0">
          {messagesLoading ? (
            <div className="p-8 text-center">
              <Loading text="Loading messages..." />
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-700">
                    <tr>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Timestamp</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">System</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Session</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">User</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Course</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Module/Assignment</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Lecture/Section</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Chatbot/Agent</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Role</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Content</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Device</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    {messagesData?.messages && messagesData.messages.length > 0 ? (
                      messagesData.messages.map((msg) => (
                        <tr
                          key={msg.id}
                          className="hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer"
                          onClick={() => setSelectedMessage(msg)}
                        >
                          <td className="px-3 py-2 text-gray-500 dark:text-gray-400 whitespace-nowrap text-xs">
                            {formatDate(msg.timestamp)}
                          </td>
                          <td className="px-3 py-2">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${SYSTEM_TYPE_COLORS[msg.systemType]}`}>
                              {msg.systemType}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-xs">
                            <span className="font-mono text-gray-600 dark:text-gray-400 truncate max-w-[80px] block" title={msg.sessionId || ''}>
                              {msg.sessionId ? msg.sessionId.slice(0, 8) + '...' : '-'}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-xs">
                            <div className="text-gray-900 dark:text-gray-100">{msg.userFullname || 'Unknown'}</div>
                            <div className="text-gray-400 dark:text-gray-500 text-[10px]">{msg.userEmail}</div>
                          </td>
                          <td className="px-3 py-2 text-xs">
                            {msg.courseTitle ? (
                              <div className="text-blue-600 dark:text-blue-400 truncate max-w-[120px]" title={msg.courseTitle}>
                                {msg.courseTitle}
                              </div>
                            ) : (
                              <span className="text-gray-400">-</span>
                            )}
                          </td>
                          <td className="px-3 py-2 text-xs">
                            {msg.moduleTitle ? (
                              <div className="text-gray-700 dark:text-gray-300 truncate max-w-[120px]" title={msg.moduleTitle}>
                                {msg.moduleTitle}
                              </div>
                            ) : (
                              <span className="text-gray-400">-</span>
                            )}
                          </td>
                          <td className="px-3 py-2 text-xs">
                            {msg.lectureTitle ? (
                              <div className="text-gray-600 dark:text-gray-400 truncate max-w-[120px]" title={msg.lectureTitle}>
                                {msg.lectureTitle}
                              </div>
                            ) : (
                              <span className="text-gray-400">-</span>
                            )}
                          </td>
                          <td className="px-3 py-2 text-xs">
                            {msg.contextName || msg.agentName ? (
                              <div className="text-purple-600 dark:text-purple-400 truncate max-w-[100px]" title={msg.contextName || msg.agentName || ''}>
                                {msg.contextName || msg.agentName}
                              </div>
                            ) : (
                              <span className="text-gray-400">-</span>
                            )}
                          </td>
                          <td className="px-3 py-2">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${ROLE_COLORS[msg.role]}`}>
                              {msg.role}
                            </span>
                          </td>
                          <td className="px-3 py-2">
                            <div
                              className={`text-xs text-gray-800 dark:text-gray-200 ${expandedMessages.has(msg.id) ? '' : 'max-w-[250px] truncate'}`}
                              onClick={(e) => { e.stopPropagation(); toggleMessageExpand(msg.id); }}
                            >
                              {msg.content}
                            </div>
                            {msg.content.length > 80 && (
                              <button
                                className="text-blue-600 dark:text-blue-400 text-[10px] hover:underline"
                                onClick={(e) => { e.stopPropagation(); toggleMessageExpand(msg.id); }}
                              >
                                {expandedMessages.has(msg.id) ? 'Show less' : 'Show more'}
                              </button>
                            )}
                          </td>
                          <td className="px-3 py-2 text-xs text-gray-600 dark:text-gray-400">
                            {msg.deviceType || '-'}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={11} className="px-3 py-8 text-center text-gray-500 dark:text-gray-400">
                          No messages found
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {messagesData?.pagination && messagesData.pagination.totalPages > 1 && (
                <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between">
                  <div className="text-sm text-gray-500 dark:text-gray-400">
                    Showing {((messagesData.pagination.page - 1) * messagesData.pagination.limit) + 1} -{' '}
                    {Math.min(messagesData.pagination.page * messagesData.pagination.limit, messagesData.pagination.total)} of{' '}
                    {messagesData.pagination.total} messages
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={messagesData.pagination.page <= 1}
                      onClick={() => handlePageChange(messagesData.pagination.page - 1)}
                    >
                      Previous
                    </Button>
                    <span className="px-3 py-1 text-sm text-gray-700 dark:text-gray-300">
                      Page {messagesData.pagination.page} of {messagesData.pagination.totalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={messagesData.pagination.page >= messagesData.pagination.totalPages}
                      onClick={() => handlePageChange(messagesData.pagination.page + 1)}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardBody>
      </Card>

      {/* Message Detail Modal */}
      {selectedMessage && (
        <MessageDetailModal
          message={selectedMessage}
          onClose={() => setSelectedMessage(null)}
        />
      )}
    </>
  );
};

interface MessageDetailModalProps {
  message: UnifiedMessage;
  onClose: () => void;
}

const MessageDetailModal = ({ message, onClose }: MessageDetailModalProps) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between bg-gray-50 dark:bg-gray-700/50">
          <div className="flex items-center gap-3">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Message Details</h3>
            <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${SYSTEM_TYPE_COLORS[message.systemType]}`}>
              {message.systemType}
            </span>
            <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${ROLE_COLORS[message.role]}`}>
              {message.role}
            </span>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded">
            <X className="w-5 h-5 text-gray-600 dark:text-gray-300" />
          </button>
        </div>

        {/* Modal Content */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Left Column */}
            <div className="space-y-4">
              {/* Timing & Session */}
              <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
                <h4 className="font-semibold text-gray-900 dark:text-gray-100 mb-3 flex items-center gap-2">
                  <Clock className="w-4 h-4" /> Timing & Session
                </h4>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div><span className="text-gray-500 dark:text-gray-400">Timestamp:</span></div>
                  <div className="font-medium text-gray-900 dark:text-gray-100">{formatFullDate(message.timestamp)}</div>
                  <div><span className="text-gray-500 dark:text-gray-400">Session ID:</span></div>
                  <div className="font-mono text-xs text-gray-900 dark:text-gray-100">{message.sessionId || '-'}</div>
                  <div><span className="text-gray-500 dark:text-gray-400">Conversation ID:</span></div>
                  <div className="font-mono text-xs text-gray-900 dark:text-gray-100">{message.conversationId || '-'}</div>
                  {message.messageIndex !== null && (
                    <>
                      <div><span className="text-gray-500 dark:text-gray-400">Message Index:</span></div>
                      <div className="text-gray-900 dark:text-gray-100">{message.messageIndex}</div>
                    </>
                  )}
                </div>
              </div>

              {/* User */}
              <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
                <h4 className="font-semibold text-gray-900 dark:text-gray-100 mb-3 flex items-center gap-2">
                  <User className="w-4 h-4" /> User
                </h4>
                <div className="text-sm">
                  <p className="font-medium text-gray-900 dark:text-gray-100">{message.userFullname || 'Unknown'}</p>
                  <p className="text-gray-500 dark:text-gray-400">{message.userEmail || '-'}</p>
                  <p className="text-gray-500 dark:text-gray-400 text-xs">ID: {message.userId || '-'}</p>
                </div>
              </div>

              {/* Context */}
              <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4">
                <h4 className="font-semibold text-gray-900 dark:text-gray-100 mb-3 flex items-center gap-2">
                  <BookOpen className="w-4 h-4" /> Context
                </h4>
                <div className="space-y-2 text-sm">
                  {message.courseTitle && (
                    <div className="flex items-center gap-2">
                      <span className="w-20 text-gray-500 dark:text-gray-400">Course:</span>
                      <span className="font-medium text-gray-900 dark:text-gray-100">{message.courseTitle}</span>
                      {message.courseId && <span className="text-xs text-gray-400">(ID: {message.courseId})</span>}
                    </div>
                  )}
                  {message.moduleTitle && (
                    <div className="flex items-center gap-2">
                      <span className="w-20 text-gray-500 dark:text-gray-400">Module:</span>
                      <span className="text-gray-900 dark:text-gray-100">{message.moduleTitle}</span>
                      {message.moduleId && <span className="text-xs text-gray-400">(ID: {message.moduleId})</span>}
                    </div>
                  )}
                  {message.lectureTitle && (
                    <div className="flex items-center gap-2">
                      <span className="w-20 text-gray-500 dark:text-gray-400">Lecture:</span>
                      <span className="text-gray-900 dark:text-gray-100">{message.lectureTitle}</span>
                      {message.lectureId && <span className="text-xs text-gray-400">(ID: {message.lectureId})</span>}
                    </div>
                  )}
                  {message.sectionId && (
                    <div className="flex items-center gap-2">
                      <span className="w-20 text-gray-500 dark:text-gray-400">Section ID:</span>
                      <span className="text-gray-900 dark:text-gray-100">{message.sectionId}</span>
                    </div>
                  )}
                  {message.contextName && (
                    <div className="flex items-center gap-2">
                      <span className="w-20 text-gray-500 dark:text-gray-400">Name:</span>
                      <span className="text-gray-900 dark:text-gray-100">{message.contextName}</span>
                    </div>
                  )}
                  {message.agentName && (
                    <div className="flex items-center gap-2">
                      <span className="w-20 text-gray-500 dark:text-gray-400">Agent:</span>
                      <span className="text-gray-900 dark:text-gray-100">{message.agentName} (v{message.agentVersion})</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Device/Client Info */}
              {(message.deviceType || message.browserName || message.ipAddress) && (
                <div className="bg-slate-50 dark:bg-slate-900/20 rounded-lg p-4">
                  <h4 className="font-semibold text-gray-900 dark:text-gray-100 mb-3 flex items-center gap-2">
                    <Cpu className="w-4 h-4" /> Client Info
                  </h4>
                  <div className="space-y-2 text-sm">
                    {message.deviceType && (
                      <div className="flex items-center gap-2">
                        <span className="w-20 text-gray-500 dark:text-gray-400">Device:</span>
                        <span className="text-gray-900 dark:text-gray-100">{message.deviceType}</span>
                      </div>
                    )}
                    {message.browserName && (
                      <div className="flex items-center gap-2">
                        <span className="w-20 text-gray-500 dark:text-gray-400">Browser:</span>
                        <span className="text-gray-900 dark:text-gray-100">{message.browserName}</span>
                      </div>
                    )}
                    {message.ipAddress && (
                      <div className="flex items-center gap-2">
                        <span className="w-20 text-gray-500 dark:text-gray-400">IP Address:</span>
                        <span className="font-mono text-xs text-gray-900 dark:text-gray-100">{message.ipAddress}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Right Column */}
            <div className="space-y-4">
              {/* AI Settings */}
              <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-4">
                <h4 className="font-semibold text-gray-900 dark:text-gray-100 mb-3 flex items-center gap-2">
                  <Cpu className="w-4 h-4" /> AI Settings
                </h4>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div><span className="text-gray-500 dark:text-gray-400">Model:</span></div>
                  <div className="font-mono text-xs text-gray-900 dark:text-gray-100">{message.aiModel || '-'}</div>
                  <div><span className="text-gray-500 dark:text-gray-400">Provider:</span></div>
                  <div className="text-gray-900 dark:text-gray-100">{message.aiProvider || '-'}</div>
                  {message.temperature !== null && (
                    <>
                      <div><span className="text-gray-500 dark:text-gray-400">Temperature:</span></div>
                      <div className="text-gray-900 dark:text-gray-100">{message.temperature}</div>
                    </>
                  )}
                  {message.maxTokens !== null && (
                    <>
                      <div><span className="text-gray-500 dark:text-gray-400">Max Tokens:</span></div>
                      <div className="text-gray-900 dark:text-gray-100">{message.maxTokens}</div>
                    </>
                  )}
                </div>
              </div>

              {/* Token Usage */}
              <div className="bg-amber-50 dark:bg-amber-900/20 rounded-lg p-4">
                <h4 className="font-semibold text-gray-900 dark:text-gray-100 mb-3 flex items-center gap-2">
                  <Zap className="w-4 h-4" /> Token Usage
                </h4>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div><span className="text-gray-500 dark:text-gray-400">Prompt:</span></div>
                  <div className="text-gray-900 dark:text-gray-100">{message.promptTokens ?? '-'}</div>
                  <div><span className="text-gray-500 dark:text-gray-400">Completion:</span></div>
                  <div className="text-gray-900 dark:text-gray-100">{message.completionTokens ?? '-'}</div>
                  <div><span className="text-gray-500 dark:text-gray-400">Total:</span></div>
                  <div className="font-medium text-gray-900 dark:text-gray-100">{message.totalTokens ?? '-'}</div>
                  <div><span className="text-gray-500 dark:text-gray-400">Response Time:</span></div>
                  <div className="text-gray-900 dark:text-gray-100">
                    {message.responseTimeMs ? `${(message.responseTimeMs / 1000).toFixed(2)}s` : '-'}
                  </div>
                </div>
              </div>

              {/* Routing Info (Tutor) */}
              {(message.routingReason || message.synthesizedFrom) && (
                <div className="bg-cyan-50 dark:bg-cyan-900/20 rounded-lg p-4">
                  <h4 className="font-semibold text-gray-900 dark:text-gray-100 mb-3 flex items-center gap-2">
                    <Bot className="w-4 h-4" /> Routing
                  </h4>
                  <div className="space-y-2 text-sm">
                    {message.routingReason && (
                      <div>
                        <span className="text-gray-500 dark:text-gray-400">Reason:</span>
                        <p className="text-gray-900 dark:text-gray-100">{message.routingReason}</p>
                      </div>
                    )}
                    {message.routingConfidence !== null && (
                      <div>
                        <span className="text-gray-500 dark:text-gray-400">Confidence:</span>
                        <span className="ml-2 text-gray-900 dark:text-gray-100">{(message.routingConfidence * 100).toFixed(1)}%</span>
                      </div>
                    )}
                    {message.synthesizedFrom && (
                      <div>
                        <span className="text-gray-500 dark:text-gray-400">Synthesized From:</span>
                        <p className="text-gray-900 dark:text-gray-100 text-xs font-mono">{message.synthesizedFrom}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Message Content */}
          <div className="mt-6 bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
            <h4 className="font-semibold text-gray-900 dark:text-gray-100 mb-3 flex items-center gap-2">
              <MessageCircle className="w-4 h-4" /> Message Content
            </h4>
            <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-600">
              <pre className="text-sm text-gray-900 dark:text-gray-100 whitespace-pre-wrap break-words">
                {message.content}
              </pre>
            </div>
          </div>

          {/* System Prompt */}
          {message.systemPrompt && (
            <div className="mt-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
              <h4 className="font-semibold text-gray-900 dark:text-gray-100 mb-3 flex items-center gap-2">
                <Bot className="w-4 h-4" /> System Prompt
              </h4>
              <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-600 max-h-48 overflow-y-auto">
                <pre className="text-xs text-gray-700 dark:text-gray-300 whitespace-pre-wrap break-words">
                  {message.systemPrompt}
                </pre>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
