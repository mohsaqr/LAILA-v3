import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  MessageSquare,
  Plus,
  Pin,
  PinOff,
  Lock,
  Unlock,
  Eye,
  User,
  Reply,
  CornerDownRight,
  Bot,
  Sparkles,
  Trash2,
  MoreVertical,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { forumsApi, ForumThread, ForumPost, CreateThreadInput, CreatePostInput, TutorAgent } from '../api/forums';
import { coursesApi } from '../api/courses';
import { useAuth } from '../hooks/useAuth';
import { useTheme } from '../hooks/useTheme';
import { Card, CardBody } from '../components/common/Card';
import { Loading } from '../components/common/Loading';
import { Button } from '../components/common/Button';
import { Modal } from '../components/common/Modal';
import { Breadcrumb } from '../components/common/Breadcrumb';
import { ForumAgentSelector } from '../components/forum/ForumAgentSelector';
import { ForumReplyInput } from '../components/forum/ForumReplyInput';
import { buildForumBreadcrumb, buildThreadBreadcrumb } from '../utils/breadcrumbs';

interface ThreadedPost extends ForumPost {
  replies?: ThreadedPost[];
}

export const Forum = () => {
  const { courseId, forumId, threadId } = useParams<{ courseId: string; forumId: string; threadId?: string }>();
  const { user } = useAuth();
  const { t } = useTranslation(['courses', 'common']);
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const parsedForumId = parseInt(forumId!, 10);
  const parsedThreadId = threadId ? parseInt(threadId, 10) : null;
  const { isDark } = useTheme();

  const [isCreateThreadOpen, setIsCreateThreadOpen] = useState(false);
  const [newThread, setNewThread] = useState<CreateThreadInput>({ title: '', content: '' });
  const [replyContent, setReplyContent] = useState('');
  const [replyingToId, setReplyingToId] = useState<number | null>(null); // null = reply to thread, number = reply to post
  const [replyingToName, setReplyingToName] = useState<string>('');
  const [showAiSelector, setShowAiSelector] = useState(false);
  const [aiReplyToId, setAiReplyToId] = useState<number | null>(null); // null = reply to thread, number = reply to post
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showThreadActions, setShowThreadActions] = useState(false);

  const colors = {
    bg: isDark ? '#111827' : '#f9fafb',
    bgCard: isDark ? '#1f2937' : '#ffffff',
    textPrimary: isDark ? '#f3f4f6' : '#111827',
    textSecondary: isDark ? '#9ca3af' : '#6b7280',
    border: isDark ? '#374151' : '#e5e7eb',
    bgHover: isDark ? '#374151' : '#f3f4f6',
    bgInput: isDark ? '#374151' : '#ffffff',
    bgPinned: isDark ? 'rgba(234, 179, 8, 0.1)' : '#fefce8',
    bgReply: isDark ? '#1e293b' : '#f8fafc',
    accent: '#088F8F',
    aiAccent: '#0891b2', // Teal for AI
    bgAi: isDark ? 'rgba(8, 145, 178, 0.1)' : 'rgba(8, 145, 178, 0.05)',
  };

  // Get course ID for fetching agents
  const parsedCourseId = parseInt(courseId!, 10);

  // Fetch course info for breadcrumbs
  const { data: course } = useQuery({
    queryKey: ['course', parsedCourseId],
    queryFn: () => coursesApi.getCourseById(parsedCourseId),
    enabled: !!parsedCourseId,
  });

  // Fetch forum or thread based on URL
  const { data: forum, isLoading: forumLoading } = useQuery({
    queryKey: ['forum', parsedForumId],
    queryFn: () => forumsApi.getForum(parsedForumId),
    enabled: !parsedThreadId,
  });

  const { data: thread, isLoading: threadLoading } = useQuery({
    queryKey: ['thread', parsedThreadId],
    queryFn: () => forumsApi.getThread(parsedThreadId!),
    enabled: !!parsedThreadId,
  });

  // Fetch available AI agents for this course
  const { data: agents = [] } = useQuery({
    queryKey: ['forum-agents', parsedCourseId],
    queryFn: () => forumsApi.getForumAgents(parsedCourseId),
    enabled: !!parsedCourseId,
  });

  // Mutations
  const createThreadMutation = useMutation({
    mutationFn: (data: CreateThreadInput) => forumsApi.createThread(parsedForumId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['forum', parsedForumId] });
      toast.success(t('discussion_started'));
      setIsCreateThreadOpen(false);
      setNewThread({ title: '', content: '' });
    },
    onError: (error: any) => toast.error(error.response?.data?.error || t('failed_create_discussion')),
  });

  const createPostMutation = useMutation({
    mutationFn: (data: CreatePostInput) => forumsApi.createPost(parsedThreadId!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['thread', parsedThreadId] });
      toast.success(t('reply_posted'));
      setReplyContent('');
      setReplyingToId(null);
      setReplyingToName('');
    },
    onError: (error: any) => toast.error(error.response?.data?.error || t('failed_post_reply')),
  });

  // AI post mutation
  const aiPostMutation = useMutation({
    mutationFn: ({ agentId, parentId }: { agentId: number; parentId?: number }) =>
      forumsApi.requestAiPost(parsedThreadId!, agentId, parentId),
    onSuccess: (post) => {
      queryClient.invalidateQueries({ queryKey: ['thread', parsedThreadId] });
      toast.success(t('ai_responded', { name: post.aiAgentName || t('tutors:ai_tutor') }));
      setShowAiSelector(false);
      setAiReplyToId(null);
    },
    onError: (error: any) => {
      const errorMsg = error.response?.data?.error || t('failed_ai_response');
      toast.error(errorMsg);
    },
  });

  // Thread management mutations (instructor only)
  const deleteThreadMutation = useMutation({
    mutationFn: () => forumsApi.deleteThread(parsedThreadId!),
    onSuccess: () => {
      toast.success(t('discussion_deleted'));
      navigate(`/courses/${courseId}/forums/${forumId}`);
    },
    onError: (error: any) => toast.error(error.response?.data?.error || t('failed_delete_discussion')),
  });

  const lockThreadMutation = useMutation({
    mutationFn: (isLocked: boolean) => forumsApi.lockThread(parsedThreadId!, isLocked),
    onSuccess: (updatedThread) => {
      queryClient.invalidateQueries({ queryKey: ['thread', parsedThreadId] });
      toast.success(updatedThread.isLocked ? t('discussion_locked') : t('discussion_unlocked'));
    },
    onError: (error: any) => toast.error(error.response?.data?.error || t('failed_update_discussion')),
  });

  const pinThreadMutation = useMutation({
    mutationFn: (isPinned: boolean) => forumsApi.pinThread(parsedThreadId!, isPinned),
    onSuccess: (updatedThread) => {
      queryClient.invalidateQueries({ queryKey: ['thread', parsedThreadId] });
      toast.success(updatedThread.isPinned ? t('discussion_pinned') : t('discussion_unpinned'));
    },
    onError: (error: any) => toast.error(error.response?.data?.error || t('failed_update_discussion')),
  });

  // Check if user is instructor/admin for this course
  const isInstructor = user?.isInstructor || user?.isAdmin || false;

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return t('just_now');
    if (diffMins < 60) return t('m_ago', { count: diffMins });
    if (diffHours < 24) return t('h_ago', { count: diffHours });
    if (diffDays < 7) return t('d_ago', { count: diffDays });
    return date.toLocaleDateString();
  };

  // Build threaded posts structure
  const buildThreadedPosts = (posts: ForumPost[]): ThreadedPost[] => {
    const postMap = new Map<number, ThreadedPost>();
    const rootPosts: ThreadedPost[] = [];

    // First pass: create map of all posts with empty replies array
    posts.forEach(post => {
      postMap.set(post.id, { ...post, replies: [] });
    });

    // Second pass: build tree structure
    posts.forEach(post => {
      const threadedPost = postMap.get(post.id)!;
      if (post.parentId && postMap.has(post.parentId)) {
        postMap.get(post.parentId)!.replies!.push(threadedPost);
      } else {
        rootPosts.push(threadedPost);
      }
    });

    return rootPosts;
  };

  const handleReplyToPost = (postId: number, authorName: string) => {
    setReplyingToId(postId);
    setReplyingToName(authorName);
    setReplyContent('');
  };

  const handleReplyToThread = () => {
    setReplyingToId(null);
    setReplyingToName('');
    setReplyContent('');
  };

  const handleSubmitReply = () => {
    // Check for @mentions to trigger AI after posting
    const mentionMatch = replyContent.match(/@(\w+)/);
    let mentionedAgent: TutorAgent | undefined;

    if (mentionMatch) {
      const mentionName = mentionMatch[1].toLowerCase();
      mentionedAgent = agents.find(
        a => a.displayName.toLowerCase().includes(mentionName) ||
             a.name.toLowerCase().includes(mentionName)
      );
    }

    const data: CreatePostInput = {
      content: replyContent,
      ...(replyingToId !== null && { parentId: replyingToId }),
    };

    createPostMutation.mutate(data, {
      onSuccess: (newPost) => {
        // If an agent was mentioned, trigger AI response to the new post
        if (mentionedAgent) {
          aiPostMutation.mutate({ agentId: mentionedAgent.id, parentId: newPost.id });
        }
      },
    });
  };

  const cancelReply = () => {
    setReplyingToId(null);
    setReplyingToName('');
    setReplyContent('');
  };

  // Handle AI agent request
  const handleAiRequest = (agent: TutorAgent, parentId?: number) => {
    aiPostMutation.mutate({ agentId: agent.id, parentId });
  };

  const toggleAiSelectorForPost = (postId: number | null) => {
    if (aiReplyToId === postId && showAiSelector) {
      setShowAiSelector(false);
      setAiReplyToId(null);
    } else {
      setShowAiSelector(true);
      setAiReplyToId(postId);
    }
  };

  // Render a single post with its nested replies
  const renderPost = (post: ThreadedPost, depth: number = 0) => {
    const maxDepth = 3; // Max nesting level for visual clarity
    const isNested = depth > 0;
    const showReplyButton = !thread?.isLocked && depth < maxDepth;
    const isAiPost = post.isAiGenerated;

    return (
      <div key={post.id} className={isNested ? 'mt-3' : ''}>
        <div
          className={`rounded-lg ${isNested ? 'ml-6 border-l-2' : ''}`}
          style={{
            backgroundColor: isAiPost ? colors.bgAi : (isNested ? colors.bgReply : colors.bgCard),
            borderLeftColor: isNested ? (isAiPost ? colors.aiAccent : colors.accent) : undefined,
          }}
        >
          <div className="p-4">
            {/* Reply indicator for nested posts */}
            {isNested && (
              <div className="flex items-center gap-1 text-xs mb-2" style={{ color: colors.textSecondary }}>
                <CornerDownRight size={12} />
                <span>{isAiPost ? t('ai_response') : t('reply')}</span>
              </div>
            )}

            <div className="flex items-start gap-3">
              {/* Avatar - different for AI posts */}
              {isAiPost ? (
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                  style={{ backgroundColor: colors.aiAccent }}
                >
                  {post.aiAgent?.avatarUrl ? (
                    <img src={post.aiAgent.avatarUrl} alt="" className="w-8 h-8 rounded-full" />
                  ) : (
                    <Bot size={16} className="text-white" />
                  )}
                </div>
              ) : (
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                  style={{ backgroundColor: colors.bgHover }}
                >
                  <User size={16} style={{ color: colors.textSecondary }} />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  {isAiPost ? (
                    <>
                      <span className="font-medium text-sm flex items-center gap-1" style={{ color: colors.aiAccent }}>
                        <Sparkles size={14} />
                        {post.aiAgentName || t('tutors:ai_tutor')}
                      </span>
                      <span
                        className="text-xs px-2 py-0.5 rounded"
                        style={{
                          backgroundColor: isDark ? 'rgba(8, 145, 178, 0.2)' : 'rgba(8, 145, 178, 0.1)',
                          color: colors.aiAccent,
                        }}
                      >
                        {t('tutors:ai_tutor')}
                      </span>
                    </>
                  ) : (
                    <>
                      <span className="font-medium text-sm" style={{ color: colors.textPrimary }}>
                        {post.author ? post.author.fullname : t('anonymous')}
                      </span>
                      {post.author?.isInstructor && (
                        <span className="text-xs px-2 py-0.5 rounded bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                          {t('instructor')}
                        </span>
                      )}
                    </>
                  )}
                  <span className="text-xs" style={{ color: colors.textSecondary }}>
                    {formatDate(post.createdAt)}
                    {post.isEdited && ` ${t('edited')}`}
                  </span>
                </div>

                {/* Show who requested the AI response */}
                {isAiPost && post.requester && (
                  <p className="text-xs mt-0.5" style={{ color: colors.textSecondary }}>
                    {t('requested_by', { name: post.requester.fullname })}
                  </p>
                )}

                <p className="mt-2 text-sm whitespace-pre-wrap" style={{ color: colors.textPrimary }}>
                  {post.content}
                </p>

                {/* Reply and Ask AI buttons */}
                {showReplyButton && (
                  <div className="mt-3 pt-2 border-t flex items-center gap-2" style={{ borderColor: colors.border }}>
                    <button
                      onClick={() => handleReplyToPost(post.id, isAiPost ? (post.aiAgentName || t('tutors:ai_tutor')) : (post.author?.fullname || t('anonymous')))}
                      className="flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                      style={{ color: colors.accent }}
                    >
                      <Reply size={14} />
                      {t('reply')}
                    </button>
                    {agents.length > 0 && (
                      <button
                        onClick={() => toggleAiSelectorForPost(post.id)}
                        className="flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                        style={{ color: colors.aiAccent }}
                        disabled={aiPostMutation.isPending}
                      >
                        <Bot size={14} />
                        {t('ask_ai')}
                      </button>
                    )}
                  </div>
                )}

                {/* AI selector for this post */}
                {showAiSelector && aiReplyToId === post.id && (
                  <div className="mt-3 p-3 rounded-lg" style={{ backgroundColor: colors.bgHover }}>
                    <ForumAgentSelector
                      agents={agents}
                      onSelect={(agent) => handleAiRequest(agent, post.id)}
                      disabled={aiPostMutation.isPending}
                      isLoading={aiPostMutation.isPending}
                      compact
                    />
                  </div>
                )}

                {/* Inline reply form */}
                {replyingToId === post.id && (
                  <div className="mt-3 p-3 rounded-lg" style={{ backgroundColor: colors.bgHover }}>
                    <ForumReplyInput
                      value={replyContent}
                      onChange={setReplyContent}
                      onSubmit={handleSubmitReply}
                      onAiRequest={(agent) => handleAiRequest(agent, post.id)}
                      agents={agents}
                      placeholder={t('reply_placeholder')}
                      disabled={createPostMutation.isPending}
                      isSubmitting={createPostMutation.isPending}
                      isAiLoading={aiPostMutation.isPending}
                      replyingToName={replyingToName}
                      onCancelReply={cancelReply}
                      showAgentSelector={agents.length > 0}
                    />
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Render nested replies */}
        {post.replies && post.replies.length > 0 && (
          <div className="ml-4">
            {post.replies.map(reply => renderPost(reply, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  const isLoading = forumLoading || threadLoading;

  if (isLoading) {
    return <Loading text={t('loading')} />;
  }

  // Thread View
  if (parsedThreadId && thread) {
    const threadedPosts = buildThreadedPosts(thread.posts || []);
    const totalReplies = thread.posts?.length || 0;

    const threadBreadcrumbs = buildThreadBreadcrumb(
      courseId!,
      course?.title || t('course'),
      forumId!,
      thread.forum?.title || t('forums'),
      thread.title
    );

    return (
      <div className="min-h-screen py-8" style={{ backgroundColor: colors.bg }}>
        <div className="max-w-4xl mx-auto px-4">
          {/* Breadcrumb navigation */}
          <div className="mb-6">
            <Breadcrumb items={threadBreadcrumbs} />
          </div>

          {/* Thread header */}
          <Card className="mb-6">
            <CardBody>
              <div className="flex items-start gap-4">
                <div
                  className="w-12 h-12 rounded-full flex items-center justify-center"
                  style={{ backgroundColor: colors.bgHover }}
                >
                  <User size={24} style={{ color: colors.textSecondary }} />
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      {thread.isPinned && <Pin size={14} className="text-yellow-500" />}
                      {thread.isLocked && <Lock size={14} className="text-red-500" />}
                      <h1 className="text-xl font-bold" style={{ color: colors.textPrimary }}>
                        {thread.title}
                      </h1>
                    </div>

                    {/* Instructor actions dropdown */}
                    {isInstructor && (
                      <div className="relative">
                        <button
                          onClick={() => setShowThreadActions(!showThreadActions)}
                          className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                          title={t('thread_actions')}
                        >
                          <MoreVertical size={18} style={{ color: colors.textSecondary }} />
                        </button>

                        {showThreadActions && (
                          <div
                            className="absolute right-0 top-full mt-1 w-48 rounded-lg shadow-lg border z-20"
                            style={{ backgroundColor: colors.bgCard, borderColor: colors.border }}
                          >
                            <button
                              onClick={() => {
                                pinThreadMutation.mutate(!thread.isPinned);
                                setShowThreadActions(false);
                              }}
                              className="w-full flex items-center gap-2 px-4 py-2.5 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                              style={{ color: colors.textPrimary }}
                              disabled={pinThreadMutation.isPending}
                            >
                              {thread.isPinned ? <PinOff size={16} /> : <Pin size={16} />}
                              {thread.isPinned ? t('unpin_discussion') : t('pin_discussion')}
                            </button>
                            <button
                              onClick={() => {
                                lockThreadMutation.mutate(!thread.isLocked);
                                setShowThreadActions(false);
                              }}
                              className="w-full flex items-center gap-2 px-4 py-2.5 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                              style={{ color: colors.textPrimary }}
                              disabled={lockThreadMutation.isPending}
                            >
                              {thread.isLocked ? <Unlock size={16} /> : <Lock size={16} />}
                              {thread.isLocked ? t('unlock_discussion') : t('lock_discussion')}
                            </button>
                            <div className="border-t" style={{ borderColor: colors.border }} />
                            <button
                              onClick={() => {
                                setShowDeleteConfirm(true);
                                setShowThreadActions(false);
                              }}
                              className="w-full flex items-center gap-2 px-4 py-2.5 text-sm hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors text-red-600"
                            >
                              <Trash2 size={16} />
                              {t('delete_discussion')}
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  <p className="text-sm mb-4" style={{ color: colors.textSecondary }}>
                    {thread.author ? thread.author.fullname : t('anonymous')} · {formatDate(thread.createdAt)} · {thread.viewCount} {t('views')}
                  </p>
                  <p style={{ color: colors.textPrimary }} className="whitespace-pre-wrap">
                    {thread.content}
                  </p>

                  {/* Reply to thread button and Ask AI */}
                  {!thread.isLocked && (
                    <div className="mt-4 pt-4 border-t" style={{ borderColor: colors.border }}>
                      <div className="flex items-center gap-3">
                        <button
                          onClick={handleReplyToThread}
                          className="flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                          style={{ color: colors.accent }}
                        >
                          <Reply size={16} />
                          {t('reply_to_thread')}
                        </button>
                        {agents.length > 0 && (
                          <button
                            onClick={() => toggleAiSelectorForPost(null)}
                            className="flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                            style={{ color: colors.aiAccent }}
                            disabled={aiPostMutation.isPending}
                          >
                            <Bot size={16} />
                            {t('ask_ai')}
                          </button>
                        )}
                      </div>

                      {/* AI selector for thread-level reply */}
                      {showAiSelector && aiReplyToId === null && (
                        <div className="mt-3 p-3 rounded-lg" style={{ backgroundColor: colors.bgHover }}>
                          <ForumAgentSelector
                            agents={agents}
                            onSelect={(agent) => handleAiRequest(agent)}
                            disabled={aiPostMutation.isPending}
                            isLoading={aiPostMutation.isPending}
                          />
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </CardBody>
          </Card>

          {/* Replies section */}
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold" style={{ color: colors.textPrimary }}>
              {totalReplies} {totalReplies === 1 ? t('reply') : t('replies')}
            </h2>
          </div>

          {threadedPosts.length > 0 ? (
            <div className="space-y-4">
              {threadedPosts.map(post => (
                <Card key={post.id}>
                  {renderPost(post, 0)}
                </Card>
              ))}
            </div>
          ) : (
            <Card>
              <CardBody className="text-center py-8">
                <MessageSquare className="w-10 h-10 mx-auto mb-2" style={{ color: colors.textSecondary }} />
                <p style={{ color: colors.textSecondary }}>{t('no_replies_yet')}</p>
              </CardBody>
            </Card>
          )}

          {/* New reply form (replying to thread) - shown at the bottom */}
          {replyingToId === null && !thread.isLocked && (
            <Card className="mt-6">
              <CardBody>
                <h3 className="font-medium mb-3 flex items-center gap-2" style={{ color: colors.textPrimary }}>
                  <MessageSquare size={18} />
                  {t('post_a_reply')}
                </h3>
                <ForumReplyInput
                  value={replyContent}
                  onChange={setReplyContent}
                  onSubmit={handleSubmitReply}
                  onAiRequest={(agent) => handleAiRequest(agent)}
                  agents={agents}
                  placeholder={t('reply_thread_placeholder')}
                  disabled={createPostMutation.isPending}
                  isSubmitting={createPostMutation.isPending}
                  isAiLoading={aiPostMutation.isPending}
                  showAgentSelector={agents.length > 0}
                />
              </CardBody>
            </Card>
          )}

          {thread.isLocked && (
            <Card className="mt-6">
              <CardBody className="text-center py-6">
                <Lock className="w-8 h-8 mx-auto mb-2" style={{ color: colors.textSecondary }} />
                <p style={{ color: colors.textSecondary }}>{t('discussion_is_locked')}</p>
              </CardBody>
            </Card>
          )}

          {/* Delete confirmation modal */}
          <Modal
            isOpen={showDeleteConfirm}
            onClose={() => setShowDeleteConfirm(false)}
            title={t('delete_discussion')}
          >
            <div className="space-y-4">
              <p style={{ color: colors.textPrimary }}>
                {t('delete_discussion_confirm')}
              </p>
              <div className="flex justify-end gap-2 pt-4">
                <Button variant="secondary" onClick={() => setShowDeleteConfirm(false)}>
                  {t('common:cancel')}
                </Button>
                <Button
                  variant="danger"
                  onClick={() => deleteThreadMutation.mutate()}
                  disabled={deleteThreadMutation.isPending}
                >
                  {deleteThreadMutation.isPending ? t('deleting') : t('delete')}
                </Button>
              </div>
            </div>
          </Modal>

          {/* Click outside to close thread actions dropdown */}
          {showThreadActions && (
            <div
              className="fixed inset-0 z-10"
              onClick={() => setShowThreadActions(false)}
            />
          )}
        </div>
      </div>
    );
  }

  // Forum View (list of threads)
  if (!forum) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: colors.bg }}>
        <p style={{ color: colors.textPrimary }}>{t('forum_not_found')}</p>
      </div>
    );
  }

  const forumBreadcrumbs = buildForumBreadcrumb(
    courseId!,
    course?.title || t('course'),
    forum.title
  );

  return (
    <div className="min-h-screen py-8" style={{ backgroundColor: colors.bg }}>
      <div className="max-w-4xl mx-auto px-4">
        {/* Breadcrumb navigation */}
        <div className="mb-6">
          <Breadcrumb items={forumBreadcrumbs} />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <div>
              <h1 className="text-2xl font-bold" style={{ color: colors.textPrimary }}>
                {forum.title}
              </h1>
              {forum.description && (
                <p className="text-sm" style={{ color: colors.textSecondary }}>{forum.description}</p>
              )}
            </div>
          </div>
          <Button onClick={() => setIsCreateThreadOpen(true)}>
            <Plus size={18} />
            {t('new_discussion')}
          </Button>
        </div>

        {/* Threads list */}
        {forum.threads && forum.threads.length > 0 ? (
          <div className="space-y-3">
            {forum.threads.map((thread: ForumThread) => (
              <Link
                key={thread.id}
                to={`/courses/${courseId}/forums/${forumId}/threads/${thread.id}`}
                className="block"
              >
                <Card
                  className="hover:shadow-md transition-shadow"
                  style={thread.isPinned ? { backgroundColor: colors.bgPinned } : {}}
                >
                  <CardBody>
                    <div className="flex items-start gap-4">
                      <div
                        className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
                        style={{ backgroundColor: colors.bgHover }}
                      >
                        <MessageSquare size={20} style={{ color: colors.textSecondary }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          {thread.isPinned && <Pin size={14} className="text-yellow-500 flex-shrink-0" />}
                          {thread.isLocked && <Lock size={14} className="text-red-500 flex-shrink-0" />}
                          <h3 className="font-semibold truncate" style={{ color: colors.textPrimary }}>
                            {thread.title}
                          </h3>
                        </div>
                        <p className="text-sm line-clamp-2 mb-2" style={{ color: colors.textSecondary }}>
                          {thread.content}
                        </p>
                        <div className="flex items-center gap-4 text-xs" style={{ color: colors.textSecondary }}>
                          <span>{thread.author ? thread.author.fullname : t('anonymous')}</span>
                          <span>{formatDate(thread.createdAt)}</span>
                          <span className="flex items-center gap-1">
                            <MessageSquare size={12} />
                            {thread.replyCount || 0} {t('replies')}
                          </span>
                          <span className="flex items-center gap-1">
                            <Eye size={12} />
                            {thread.viewCount} {t('views')}
                          </span>
                        </div>
                      </div>
                    </div>
                  </CardBody>
                </Card>
              </Link>
            ))}
          </div>
        ) : (
          <Card>
            <CardBody className="text-center py-12">
              <MessageSquare className="w-12 h-12 mx-auto mb-4" style={{ color: colors.textSecondary }} />
              <p style={{ color: colors.textPrimary }}>{t('no_discussions_yet')}</p>
              <p className="text-sm mt-1" style={{ color: colors.textSecondary }}>
                {t('start_first_discussion')}
              </p>
              <Button onClick={() => setIsCreateThreadOpen(true)} className="mt-4">
                <Plus size={18} />
                {t('start_discussion')}
              </Button>
            </CardBody>
          </Card>
        )}
      </div>

      {/* Create Thread Modal */}
      <Modal
        isOpen={isCreateThreadOpen}
        onClose={() => setIsCreateThreadOpen(false)}
        title={t('start_new_discussion')}
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: colors.textPrimary }}>
              {t('discussion_title')}
            </label>
            <input
              value={newThread.title}
              onChange={(e) => setNewThread({ ...newThread, title: e.target.value })}
              placeholder={t('discussion_title_placeholder')}
              className="w-full px-3 py-2 rounded-lg"
              style={{ backgroundColor: colors.bgInput, borderColor: colors.border, borderWidth: 1, color: colors.textPrimary }}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: colors.textPrimary }}>
              {t('discussion_content')}
            </label>
            <textarea
              value={newThread.content}
              onChange={(e) => setNewThread({ ...newThread, content: e.target.value })}
              placeholder={t('discussion_content_placeholder')}
              rows={6}
              className="w-full px-3 py-2 rounded-lg"
              style={{ backgroundColor: colors.bgInput, borderColor: colors.border, borderWidth: 1, color: colors.textPrimary }}
            />
          </div>
          {forum?.allowAnonymous && (
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={newThread.isAnonymous}
                onChange={(e) => setNewThread({ ...newThread, isAnonymous: e.target.checked })}
                className="w-4 h-4"
              />
              <span className="text-sm" style={{ color: colors.textPrimary }}>{t('post_anonymously')}</span>
            </label>
          )}
          <div className="flex justify-end gap-2 pt-4">
            <Button variant="secondary" onClick={() => setIsCreateThreadOpen(false)}>
              {t('common:cancel')}
            </Button>
            <Button
              onClick={() => createThreadMutation.mutate(newThread)}
              disabled={!newThread.title.trim() || !newThread.content.trim() || createThreadMutation.isPending}
            >
              {t('start_discussion')}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
