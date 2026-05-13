/**
 * Forum Logs tab — StatCard strip + DataTable + details modal.
 * Style matches /teach/quizzes and the chatbot registry.
 */

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import {
  Eye,
  EyeOff,
  Hash,
  MessageSquare,
  Reply,
  User,
  Users,
} from 'lucide-react';
import { getAuthToken } from '../../../utils/auth';
import { analyticsApi } from '../../../api/admin';
import { StatCard } from '../../../components/admin/StatCard';
import {
  DataTable,
  type ColumnDef,
} from '../../../components/common/DataTable';
import { RowMenu } from '../../../components/common/RowMenu';
import { Modal } from '../../../components/common/Modal';
import { useTheme } from '../../../hooks/useTheme';

interface ForumLogsTabProps {
  exportStatus: 'idle' | 'loading' | 'success' | 'error';
  setExportStatus: (status: 'idle' | 'loading' | 'success' | 'error') => void;
}

interface ForumPost {
  id: number | string;
  createdAt: string;
  authorName: string;
  isAnonymous: boolean;
  threadTitle: string;
  forumTitle: string;
  courseTitle: string;
  content: string;
  fullContent: string;
  isReply: boolean;
}

interface ForumThread {
  id: number | string;
  createdAt: string;
  authorName: string;
  title: string;
  forumTitle: string;
  courseTitle: string;
  postCount: number;
}

export const ForumLogsTab = ({
  exportStatus,
  setExportStatus,
}: ForumLogsTabProps) => {
  const { t } = useTranslation(['admin', 'common']);
  const { isDark } = useTheme();
  const [viewMode, setViewMode] = useState<'posts' | 'threads'>('posts');
  const [detailsPost, setDetailsPost] = useState<ForumPost | null>(null);

  const c = {
    bgBlue: isDark ? 'rgba(59,130,246,0.2)' : '#dbeafe',
    bgGreen: isDark ? 'rgba(34,197,94,0.2)' : '#dcfce7',
    bgTeal: isDark ? 'rgba(8,143,143,0.2)' : '#f0fdfd',
    bgPurple: isDark ? 'rgba(139,92,246,0.2)' : '#ede9fe',
    bgOrange: isDark ? 'rgba(249,115,22,0.2)' : '#ffedd5',
    txBlue: isDark ? '#93c5fd' : '#2563eb',
    txGreen: isDark ? '#86efac' : '#16a34a',
    txTeal: isDark ? '#5eecec' : '#088F8F',
    txPurple: isDark ? '#c4b5fd' : '#7c3aed',
    txOrange: isDark ? '#fdba74' : '#ea580c',
  };

  const { data: summary, isLoading } = useQuery({
    queryKey: ['forumSummary'],
    queryFn: () => analyticsApi.getForumSummary(),
  });

  const posts: ForumPost[] = summary?.recentPosts ?? [];
  const threads: ForumThread[] = summary?.recentThreads ?? [];

  const handleExport = async () => {
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
      toast.success(t('export_downloaded', { defaultValue: 'Export downloaded' }));
      setTimeout(() => setExportStatus('idle'), 2000);
    } catch {
      setExportStatus('error');
      toast.error(t('export_failed', { defaultValue: 'Export failed' }));
      setTimeout(() => setExportStatus('idle'), 2000);
    }
  };

  const postColumns: ColumnDef<ForumPost>[] = [
    {
      id: 'time',
      header: t('time'),
      sortAccessor: p => new Date(p.createdAt).getTime(),
      width: '11rem',
      cell: p => (
        <span className="text-xs text-gray-600 dark:text-gray-300 tabular-nums whitespace-nowrap">
          {new Date(p.createdAt).toLocaleString()}
        </span>
      ),
    },
    {
      id: 'author',
      header: t('author'),
      sortAccessor: p => p.authorName.toLowerCase(),
      width: '12rem',
      cell: p => (
        <span
          className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
            p.isAnonymous
              ? 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
              : 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
          }`}
        >
          {p.isAnonymous && <EyeOff className="w-3 h-3 mr-1" />}
          {p.authorName}
        </span>
      ),
    },
    {
      id: 'thread',
      header: t('thread'),
      sortAccessor: p => p.threadTitle.toLowerCase(),
      width: '20%',
      hideOnMobile: true,
      cell: p => (
        <span
          className="block truncate text-sm text-gray-700 dark:text-gray-200"
          title={p.threadTitle}
        >
          {p.threadTitle}
        </span>
      ),
    },
    {
      id: 'course',
      header: t('course'),
      sortAccessor: p => p.courseTitle.toLowerCase(),
      width: '15%',
      hideOnMobile: true,
      cell: p => (
        <span
          className="block truncate text-sm text-gray-600 dark:text-gray-300"
          title={p.courseTitle}
        >
          {p.courseTitle}
        </span>
      ),
    },
    {
      id: 'content',
      header: t('content'),
      sortAccessor: p => p.content.slice(0, 60).toLowerCase(),
      width: '30%',
      cell: p => (
        <p
          className="text-sm truncate text-gray-700 dark:text-gray-300"
          title={p.content}
        >
          {p.content}
        </p>
      ),
    },
    {
      id: 'type',
      header: t('type'),
      sortAccessor: p => (p.isReply ? 'reply' : 'post'),
      width: '6rem',
      filter: {
        kind: 'select',
        options: [
          { value: 'post', label: t('new_post') },
          { value: 'reply', label: t('reply') },
        ],
        predicate: (p, v) => (p.isReply ? 'reply' : 'post') === v,
      },
      cell: p => (
        <span
          className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${
            p.isReply
              ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300'
              : 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
          }`}
        >
          {p.isReply ? t('reply') : t('new_post')}
        </span>
      ),
    },
  ];

  const threadColumns: ColumnDef<ForumThread>[] = [
    {
      id: 'time',
      header: t('time'),
      sortAccessor: th => new Date(th.createdAt).getTime(),
      width: '11rem',
      cell: th => (
        <span className="text-xs text-gray-600 dark:text-gray-300 tabular-nums whitespace-nowrap">
          {new Date(th.createdAt).toLocaleString()}
        </span>
      ),
    },
    {
      id: 'author',
      header: t('author'),
      sortAccessor: th => th.authorName.toLowerCase(),
      width: '12rem',
      cell: th => (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300">
          {th.authorName}
        </span>
      ),
    },
    {
      id: 'title',
      header: t('title'),
      sortAccessor: th => th.title.toLowerCase(),
      width: '32%',
      cell: th => (
        <span
          className="block truncate text-sm font-medium text-gray-700 dark:text-gray-200"
          title={th.title}
        >
          {th.title}
        </span>
      ),
    },
    {
      id: 'forum',
      header: t('forum'),
      sortAccessor: th => th.forumTitle.toLowerCase(),
      width: '18%',
      hideOnMobile: true,
      cell: th => (
        <span
          className="block truncate text-sm text-gray-600 dark:text-gray-300"
          title={th.forumTitle}
        >
          {th.forumTitle}
        </span>
      ),
    },
    {
      id: 'course',
      header: t('course'),
      sortAccessor: th => th.courseTitle.toLowerCase(),
      width: '18%',
      hideOnMobile: true,
      cell: th => (
        <span
          className="block truncate text-sm text-gray-600 dark:text-gray-300"
          title={th.courseTitle}
        >
          {th.courseTitle}
        </span>
      ),
    },
    {
      id: 'posts',
      header: t('posts'),
      sortAccessor: th => th.postCount,
      width: '5rem',
      align: 'right',
      cell: th => (
        <span className="text-sm text-gray-700 dark:text-gray-300 tabular-nums">
          {th.postCount}
        </span>
      ),
    },
  ];

  return (
    <>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 mb-6">
        <StatCard
          icon={<MessageSquare className="w-5 h-5" style={{ color: c.txTeal }} />}
          iconBgColor={c.bgTeal}
          value={(summary?.totalForums || 0).toLocaleString()}
          label={t('forums')}
          size="sm"
        />
        <StatCard
          icon={<Hash className="w-5 h-5" style={{ color: c.txBlue }} />}
          iconBgColor={c.bgBlue}
          value={(summary?.totalThreads || 0).toLocaleString()}
          label={t('threads')}
          size="sm"
        />
        <StatCard
          icon={<Reply className="w-5 h-5" style={{ color: c.txPurple }} />}
          iconBgColor={c.bgPurple}
          value={(summary?.totalPosts || 0).toLocaleString()}
          label={t('posts')}
          size="sm"
        />
        <StatCard
          icon={<Users className="w-5 h-5" style={{ color: c.txGreen }} />}
          iconBgColor={c.bgGreen}
          value={(summary?.namedPosts || 0).toLocaleString()}
          label={t('named_posts')}
          size="sm"
        />
        <StatCard
          icon={<EyeOff className="w-5 h-5" style={{ color: c.txOrange }} />}
          iconBgColor={c.bgOrange}
          value={(summary?.anonymousPosts || 0).toLocaleString()}
          label={t('anonymous')}
          size="sm"
        />
      </div>

      {/* Posts / Threads toggle. Same chip-style switch the existing
          page used — sits above the DataTable so the table stays
          identical to the other tabs. */}
      <div className="flex justify-end mb-3">
        <div className="inline-flex bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
          <button
            type="button"
            onClick={() => setViewMode('posts')}
            className={`px-3 py-1 text-sm rounded-md transition-colors ${
              viewMode === 'posts'
                ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm'
                : 'text-gray-600 dark:text-gray-400'
            }`}
          >
            {t('posts')}
          </button>
          <button
            type="button"
            onClick={() => setViewMode('threads')}
            className={`px-3 py-1 text-sm rounded-md transition-colors ${
              viewMode === 'threads'
                ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm'
                : 'text-gray-600 dark:text-gray-400'
            }`}
          >
            {t('threads')}
          </button>
        </div>
      </div>

      {viewMode === 'posts' ? (
        <DataTable<ForumPost>
          rows={posts}
          columns={postColumns}
          rowKey={p => p.id}
          isLoading={isLoading}
          pageSize={20}
          globalSearch={{
            placeholder: t('search_user_object_course'),
            predicate: (p, q) => {
              const x = q.toLowerCase();
              return (
                p.authorName.toLowerCase().includes(x) ||
                p.threadTitle.toLowerCase().includes(x) ||
                p.courseTitle.toLowerCase().includes(x) ||
                p.content.toLowerCase().includes(x)
              );
            },
          }}
          exportAction={{
            onClick: handleExport,
            label: exportStatus === 'loading' ? t('common:loading') : undefined,
          }}
          rowActions={p => (
            <RowMenu
              items={[
                {
                  key: 'details',
                  label: t('view_details', { defaultValue: 'View details' }),
                  icon: <Eye className="w-3.5 h-3.5" />,
                  onClick: () => setDetailsPost(p),
                },
              ]}
            />
          )}
        />
      ) : (
        <DataTable<ForumThread>
          rows={threads}
          columns={threadColumns}
          rowKey={th => th.id}
          isLoading={isLoading}
          pageSize={20}
          globalSearch={{
            placeholder: t('search_user_object_course'),
            predicate: (th, q) => {
              const x = q.toLowerCase();
              return (
                th.authorName.toLowerCase().includes(x) ||
                th.title.toLowerCase().includes(x) ||
                th.forumTitle.toLowerCase().includes(x) ||
                th.courseTitle.toLowerCase().includes(x)
              );
            },
          }}
          exportAction={{
            onClick: handleExport,
            label: exportStatus === 'loading' ? t('common:loading') : undefined,
          }}
        />
      )}

      <Modal
        isOpen={!!detailsPost}
        onClose={() => setDetailsPost(null)}
        title={t('forum_post_details')}
        size="4xl"
      >
        {detailsPost && <PostDetailsView post={detailsPost} />}
      </Modal>
    </>
  );
};

const PostDetailsView = ({ post }: { post: ForumPost }) => {
  const { t } = useTranslation(['admin']);
  return (
    <div className="space-y-4 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <span
          className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
            post.isReply
              ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300'
              : 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
          }`}
        >
          {post.isReply ? t('reply_to_post') : t('original_post')}
        </span>
        <span
          className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
            post.isAnonymous
              ? 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
              : 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
          }`}
        >
          {post.isAnonymous && <EyeOff className="w-3 h-3 mr-1" />}
          <User className="w-3 h-3 mr-1" />
          {post.authorName}
        </span>
        <span className="text-xs text-gray-500 dark:text-gray-400 tabular-nums">
          {new Date(post.createdAt).toLocaleString()}
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <KV k={t('course')} v={post.courseTitle} />
        <KV k={t('forum')} v={post.forumTitle} />
        <KV k={t('thread')} v={post.threadTitle} />
      </div>

      <div>
        <h4 className="font-semibold text-gray-900 dark:text-gray-100 border-b border-gray-200 dark:border-gray-600 pb-1 mb-2">
          {t('content')}
        </h4>
        <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-3 max-h-72 overflow-y-auto">
          <pre className="text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap break-words">
            {post.fullContent || post.content}
          </pre>
        </div>
      </div>
    </div>
  );
};

const KV = ({ k, v }: { k: string; v: React.ReactNode }) => (
  <div>
    <span className="text-gray-500 dark:text-gray-500">{k}:</span>{' '}
    {v ?? '—'}
  </div>
);
