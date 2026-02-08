/**
 * Forum Logs Tab Component for the Logs Dashboard.
 * Displays forum activity logs including threads, posts, and user participation.
 */

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import {
  MessageSquare,
  Users,
  BookOpen,
  User,
  Clock,
  RefreshCw,
  Download,
  Loader2,
  X,
  Reply,
  Eye,
  EyeOff,
  Hash,
  FileSpreadsheet,
  FileText,
} from 'lucide-react';
import { getAuthToken } from '../../../utils/auth';
import { analyticsApi } from '../../../api/admin';
import { Card, CardBody, CardHeader } from '../../../components/common/Card';
import { Button } from '../../../components/common/Button';
import { Loading } from '../../../components/common/Loading';

interface ForumLogsTabProps {
  exportStatus: 'idle' | 'loading' | 'success' | 'error';
  setExportStatus: (status: 'idle' | 'loading' | 'success' | 'error') => void;
}

export const ForumLogsTab = ({ exportStatus, setExportStatus }: ForumLogsTabProps) => {
  const { t } = useTranslation(['admin', 'common']);
  const [selectedPost, setSelectedPost] = useState<any | null>(null);
  const [viewMode, setViewMode] = useState<'posts' | 'threads'>('posts');

  const { data: forumSummary, isLoading, refetch } = useQuery({
    queryKey: ['forumSummary'],
    queryFn: () => analyticsApi.getForumSummary(),
  });

  const handleExportJSON = async () => {
    if (!forumSummary) return;
    setExportStatus('loading');
    try {
      const blob = new Blob([JSON.stringify(forumSummary, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `forum-logs-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setExportStatus('success');
      setTimeout(() => setExportStatus('idle'), 2000);
    } catch {
      setExportStatus('error');
      setTimeout(() => setExportStatus('idle'), 2000);
    }
  };

  const handleExportCSV = async () => {
    setExportStatus('loading');
    try {
      const response = await fetch('/api/admin/forum-export/csv', {
        headers: { Authorization: `Bearer ${getAuthToken()}` },
      });
      if (!response.ok) throw new Error('Export failed');
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `forum-posts-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setExportStatus('success');
      setTimeout(() => setExportStatus('idle'), 2000);
    } catch {
      setExportStatus('error');
      setTimeout(() => setExportStatus('idle'), 2000);
    }
  };

  const handleExportExcel = async () => {
    setExportStatus('loading');
    try {
      const response = await fetch('/api/admin/forum-export/excel', {
        headers: { Authorization: `Bearer ${getAuthToken()}` },
      });
      if (!response.ok) throw new Error('Export failed');
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `forum-export-${new Date().toISOString().slice(0, 10)}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setExportStatus('success');
      setTimeout(() => setExportStatus('idle'), 2000);
    } catch {
      setExportStatus('error');
      setTimeout(() => setExportStatus('idle'), 2000);
    }
  };

  if (isLoading) {
    return <Loading text={t('loading_forum_logs')} />;
  }

  if (!forumSummary) {
    return null;
  }

  return (
    <>
      {/* Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        <Card>
          <CardBody className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
              <MessageSquare className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{forumSummary.totalForums}</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">{t('forums')}</p>
            </div>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
              <Hash className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{forumSummary.totalThreads}</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">{t('threads')}</p>
            </div>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
              <Reply className="w-6 h-6 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{forumSummary.totalPosts}</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">{t('posts')}</p>
            </div>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
              <Eye className="w-6 h-6 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{forumSummary.namedPosts}</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">{t('named_posts')}</p>
            </div>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-lg bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
              <EyeOff className="w-6 h-6 text-gray-600 dark:text-gray-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{forumSummary.anonymousPosts}</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">{t('anonymous')}</p>
            </div>
          </CardBody>
        </Card>
      </div>

      {/* Breakdowns Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        {/* By Course */}
        <Card>
          <CardHeader className="py-3">
            <div className="flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-gray-500 dark:text-gray-400" />
              <h3 className="font-semibold text-gray-900 dark:text-gray-100 text-sm">{t('forums_by_course')}</h3>
            </div>
          </CardHeader>
          <CardBody className="pt-0">
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {forumSummary.byCourse?.length > 0 ? (
                forumSummary.byCourse.map((item: any) => (
                  <div key={item.forumId} className="flex items-center justify-between text-sm">
                    <div className="flex-1 min-w-0">
                      <span className="text-gray-700 dark:text-gray-300 truncate block" title={item.forumTitle}>
                        {item.forumTitle}
                      </span>
                      <span className="text-gray-400 dark:text-gray-500 text-xs truncate block" title={item.courseTitle}>
                        {item.courseTitle}
                      </span>
                    </div>
                    <span className="px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded text-xs font-medium ml-2">
                      {item.threadCount} {t('threads')}
                    </span>
                  </div>
                ))
              ) : (
                <p className="text-gray-400 dark:text-gray-500 text-sm">{t('no_forums_yet')}</p>
              )}
            </div>
          </CardBody>
        </Card>

        {/* Top Posters */}
        <Card>
          <CardHeader className="py-3">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-gray-500 dark:text-gray-400" />
              <h3 className="font-semibold text-gray-900 dark:text-gray-100 text-sm">{t('top_contributors')}</h3>
            </div>
          </CardHeader>
          <CardBody className="pt-0">
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {forumSummary.byUser?.length > 0 ? (
                forumSummary.byUser.map((item: any, index: number) => (
                  <div key={item.userId} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-xs font-medium text-gray-600 dark:text-gray-300">
                        {index + 1}
                      </span>
                      <div>
                        <span className="text-gray-700 dark:text-gray-300">{item.userName}</span>
                        <span className="text-gray-400 dark:text-gray-500 text-xs block">{item.userEmail}</span>
                      </div>
                    </div>
                    <span className="px-2 py-0.5 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 rounded text-xs font-medium">
                      {item.count} {t('posts')}
                    </span>
                  </div>
                ))
              ) : (
                <p className="text-gray-400 dark:text-gray-500 text-sm">{t('common:no_data')}</p>
              )}
            </div>
          </CardBody>
        </Card>
      </div>

      {/* Recent Activity Table */}
      <Card>
        <CardHeader className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h3 className="font-semibold text-gray-900 dark:text-gray-100">{t('recent_forum_activity')}</h3>
            <div className="flex gap-1 bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
              <button
                onClick={() => setViewMode('posts')}
                className={`px-3 py-1 text-sm rounded-md transition-colors ${
                  viewMode === 'posts'
                    ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm'
                    : 'text-gray-600 dark:text-gray-400'
                }`}
              >
                {t('posts')}
              </button>
              <button
                onClick={() => setViewMode('threads')}
                className={`px-3 py-1 text-sm rounded-md transition-colors ${
                  viewMode === 'threads'
                    ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm'
                    : 'text-gray-600 dark:text-gray-400'
                }`}
              >
                {t('threads')}
              </button>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              <RefreshCw className="w-4 h-4 mr-1" />
              {t('common:refresh')}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleExportExcel}
              disabled={exportStatus === 'loading'}
              title={t('export_excel_tooltip')}
            >
              {exportStatus === 'loading' ? (
                <Loader2 className="w-4 h-4 mr-1 animate-spin" />
              ) : (
                <FileSpreadsheet className="w-4 h-4 mr-1 text-green-600" />
              )}
              {t('excel')}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleExportCSV}
              disabled={exportStatus === 'loading'}
              title={t('export_csv_tooltip')}
            >
              {exportStatus === 'loading' ? (
                <Loader2 className="w-4 h-4 mr-1 animate-spin" />
              ) : (
                <FileText className="w-4 h-4 mr-1 text-blue-600" />
              )}
              {t('csv')}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleExportJSON}
              disabled={exportStatus === 'loading'}
              title={t('export_json_tooltip')}
            >
              {exportStatus === 'loading' ? (
                <Loader2 className="w-4 h-4 mr-1 animate-spin" />
              ) : (
                <Download className="w-4 h-4 mr-1" />
              )}
              {t('json')}
            </Button>
          </div>
        </CardHeader>
        <CardBody className="p-0">
          <div className="overflow-x-auto">
            {viewMode === 'posts' ? (
              <table className="w-full text-sm">
                <thead className="bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-700">
                  <tr>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">{t('time')}</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">{t('author')}</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">{t('thread')}</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">{t('course')}</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">{t('content')}</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">{t('type')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {forumSummary.recentPosts?.map((post: any) => (
                    <tr
                      key={post.id}
                      className="hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer"
                      onClick={() => setSelectedPost(post)}
                    >
                      <td className="px-3 py-2 text-gray-500 dark:text-gray-400 whitespace-nowrap text-xs">
                        {new Date(post.createdAt).toLocaleString()}
                      </td>
                      <td className="px-3 py-2">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                          post.isAnonymous
                            ? 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                            : 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300'
                        }`}>
                          {post.isAnonymous && <EyeOff className="w-3 h-3 mr-1" />}
                          {post.authorName}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-xs">
                        <div className="text-gray-700 dark:text-gray-300 truncate max-w-[150px]" title={post.threadTitle}>
                          {post.threadTitle}
                        </div>
                      </td>
                      <td className="px-3 py-2 text-xs">
                        <div className="text-blue-600 dark:text-blue-400 truncate max-w-[100px]" title={post.courseTitle}>
                          {post.courseTitle}
                        </div>
                      </td>
                      <td className="px-3 py-2">
                        <div className="text-xs text-gray-800 dark:text-gray-200 max-w-[300px] truncate" title={post.content}>
                          {post.content}
                        </div>
                      </td>
                      <td className="px-3 py-2">
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                          post.isReply
                            ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400'
                            : 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                        }`}>
                          {post.isReply ? t('reply') : t('new_post')}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-700">
                  <tr>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">{t('time')}</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">{t('author')}</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">{t('title')}</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">{t('forum')}</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">{t('course')}</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">{t('posts')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {forumSummary.recentThreads?.map((thread: any) => (
                    <tr
                      key={thread.id}
                      className="hover:bg-gray-50 dark:hover:bg-gray-700/50"
                    >
                      <td className="px-3 py-2 text-gray-500 dark:text-gray-400 whitespace-nowrap text-xs">
                        {new Date(thread.createdAt).toLocaleString()}
                      </td>
                      <td className="px-3 py-2">
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300">
                          {thread.authorName}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-xs">
                        <div className="text-gray-700 dark:text-gray-300 font-medium truncate max-w-[200px]" title={thread.title}>
                          {thread.title}
                        </div>
                      </td>
                      <td className="px-3 py-2 text-xs">
                        <div className="text-gray-600 dark:text-gray-400 truncate max-w-[120px]" title={thread.forumTitle}>
                          {thread.forumTitle}
                        </div>
                      </td>
                      <td className="px-3 py-2 text-xs">
                        <div className="text-blue-600 dark:text-blue-400 truncate max-w-[100px]" title={thread.courseTitle}>
                          {thread.courseTitle}
                        </div>
                      </td>
                      <td className="px-3 py-2">
                        <span className="px-2 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded text-xs font-medium">
                          {thread.postCount}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </CardBody>
      </Card>

      {/* Post Detail Modal */}
      {selectedPost && (
        <PostDetailModal
          post={selectedPost}
          onClose={() => setSelectedPost(null)}
        />
      )}
    </>
  );
};

interface PostDetailModalProps {
  post: any;
  onClose: () => void;
}

const PostDetailModal = ({ post, onClose }: PostDetailModalProps) => {
  const { t } = useTranslation(['admin', 'common']);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between bg-gray-50 dark:bg-gray-700/50">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{t('forum_post_details')}</h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded">
            <X className="w-5 h-5 text-gray-600 dark:text-gray-300" />
          </button>
        </div>

        {/* Modal Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {/* Metadata */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
              <h4 className="font-semibold text-gray-900 dark:text-gray-100 mb-2 flex items-center gap-2">
                <Clock className="w-4 h-4" /> {t('timestamp')}
              </h4>
              <p className="text-sm text-gray-700 dark:text-gray-300">
                {new Date(post.createdAt).toLocaleString()}
              </p>
            </div>
            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
              <h4 className="font-semibold text-gray-900 dark:text-gray-100 mb-2 flex items-center gap-2">
                <User className="w-4 h-4" /> {t('author')}
              </h4>
              <div className="flex items-center gap-2">
                {post.isAnonymous && <EyeOff className="w-4 h-4 text-gray-400" />}
                <span className="text-sm text-gray-700 dark:text-gray-300">{post.authorName}</span>
                {post.isAnonymous && <span className="text-xs text-gray-500">({t('anonymous')})</span>}
              </div>
            </div>
          </div>

          {/* Location */}
          <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4">
            <h4 className="font-semibold text-gray-900 dark:text-gray-100 mb-2 flex items-center gap-2">
              <BookOpen className="w-4 h-4" /> {t('location')}
            </h4>
            <div className="space-y-1 text-sm">
              <p><span className="text-gray-500 dark:text-gray-400">{t('course')}:</span> <span className="text-gray-900 dark:text-gray-100">{post.courseTitle}</span></p>
              <p><span className="text-gray-500 dark:text-gray-400">{t('forum')}:</span> <span className="text-gray-900 dark:text-gray-100">{post.forumTitle}</span></p>
              <p><span className="text-gray-500 dark:text-gray-400">{t('thread')}:</span> <span className="text-gray-900 dark:text-gray-100">{post.threadTitle}</span></p>
            </div>
          </div>

          {/* Type */}
          <div className="flex items-center gap-2">
            <span className={`px-3 py-1 rounded-full text-sm font-medium ${
              post.isReply
                ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400'
                : 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
            }`}>
              {post.isReply ? t('reply_to_post') : t('original_post')}
            </span>
          </div>

          {/* Content */}
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
            <h4 className="font-semibold text-gray-900 dark:text-gray-100 mb-2">{t('content')}</h4>
            <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
              {post.fullContent}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
