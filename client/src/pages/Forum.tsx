import { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, useNavigate } from 'react-router-dom';
import {
  MessageCircle,
  Pin,
  PinOff,
  Lock,
  Unlock,
  Heart,
  Share2,
  Bot,
  Sparkles,
  Trash2,
  MoreVertical,
  Plus,
  Minus,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { forumsApi, ForumPost, CreatePostInput, TutorAgent } from '../api/forums';
import { resolveFileUrl } from '../api/client';
import { coursesApi } from '../api/courses';
import { useAuth } from '../hooks/useAuth';
import { useTheme } from '../hooks/useTheme';
import { Loading } from '../components/common/Loading';
import { Button } from '../components/common/Button';
import { Modal } from '../components/common/Modal';
import { Breadcrumb } from '../components/common/Breadcrumb';
import { ForumAgentSelector } from '../components/forum/ForumAgentSelector';
import { ForumReplyInput } from '../components/forum/ForumReplyInput';
import { buildForumBreadcrumb } from '../utils/breadcrumbs';
import DOMPurify from 'dompurify';
import { activityLogger } from '../services/activityLogger';
import { useTracker } from '../services/tracker';
import { TrackedContent } from '../components/common/TrackedContent';
import { Avatar } from '../components/dashboard/Avatar';
import { formatRelative } from '../utils/relativeTime';
import { extractHashtags, stripHashtags } from '../utils/forumTags';

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
  const track = useTracker('forum');

  const [replyContent, setReplyContent] = useState('');
  const [replyingToId, setReplyingToId] = useState<number | null>(null); // null = reply to thread, number = reply to post
  const [replyingToName, setReplyingToName] = useState<string>('');
  const [showAiSelector, setShowAiSelector] = useState(false);
  const [aiReplyToId, setAiReplyToId] = useState<number | null>(null); // null = reply to thread, number = reply to post
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showThreadActions, setShowThreadActions] = useState(false);
  // Track which top-level comments have their replies expanded. Replies
  // stay collapsed by default — only a tiny summary row hints at them.
  const [expandedReplies, setExpandedReplies] = useState<Set<number>>(new Set());
  const toggleExpandReplies = (postId: number) => {
    setExpandedReplies(prev => {
      const next = new Set(prev);
      if (next.has(postId)) next.delete(postId);
      else next.add(postId);
      return next;
    });
  };
  const replyFormRef = useRef<HTMLDivElement>(null);

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

  // After the forum_collapse_layers migration there's exactly one
  // discussion per forum id. Whether the URL is `/forums/:forumId` or
  // the legacy `/forums/:forumId/threads/:threadId`, both ids point at
  // the same ForumThread record — use whichever the route provided.
  const effectiveThreadId = parsedThreadId ?? parsedForumId;

  const { data: thread, isLoading: threadLoading } = useQuery({
    queryKey: ['thread', effectiveThreadId],
    queryFn: () => forumsApi.getThread(effectiveThreadId),
    enabled: !!effectiveThreadId,
  });
  const forum = thread; // legacy alias used in a few places below
  const forumLoading = threadLoading;

  // Fetch available AI agents for this course
  const { data: agents = [] } = useQuery({
    queryKey: ['forum-agents', parsedCourseId],
    queryFn: () => forumsApi.getForumAgents(parsedCourseId),
    enabled: !!parsedCourseId,
  });

  // Log forum view when forum data loads
  useEffect(() => {
    if (forum && !parsedThreadId) {
      activityLogger.logForumViewed(parsedForumId, forum.title, parsedCourseId);
    }
  }, [forum, parsedForumId, parsedCourseId, parsedThreadId]);

  // Mutations
  // After the collapse there is no "create thread inside a forum" — the
  // forum IS the thread; replies use createPostMutation below.
  const createPostMutation = useMutation({
    mutationFn: (data: CreatePostInput) => forumsApi.createPost(effectiveThreadId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['thread', effectiveThreadId] });
      track('reply_submitted', { verb: 'submitted', objectType: 'forum', objectId: parsedForumId, courseId: parsedCourseId, payload: { isReplyToPost: !!replyingToId, threadId: effectiveThreadId } });
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
      forumsApi.requestAiPost(effectiveThreadId, agentId, parentId),
    onSuccess: (post, variables) => {
      queryClient.invalidateQueries({ queryKey: ['thread', effectiveThreadId] });
      activityLogger.log({ verb: 'interacted', objectType: 'tutor_agent', objectId: variables.agentId, courseId: parseInt(courseId!), extensions: { action: 'forum_ai_reply', forumId: parsedForumId, threadId: effectiveThreadId } });
      track('ai_agent_selected', { verb: 'selected', objectType: 'forum', courseId: parsedCourseId, payload: { agentId: variables.agentId, agentName: post.aiAgentName } });
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
    mutationFn: () => forumsApi.deleteThread(effectiveThreadId),
    onSuccess: () => {
      track('thread_deleted', { verb: 'deleted', objectType: 'forum', objectId: effectiveThreadId, courseId: parsedCourseId });
      toast.success(t('discussion_deleted'));
      navigate(`/courses/${courseId}/forums/${forumId}`);
    },
    onError: (error: any) => toast.error(error.response?.data?.error || t('failed_delete_discussion')),
  });

  const lockThreadMutation = useMutation({
    mutationFn: (isLocked: boolean) => forumsApi.lockThread(effectiveThreadId, isLocked),
    onSuccess: (updatedThread) => {
      queryClient.invalidateQueries({ queryKey: ['thread', effectiveThreadId] });
      toast.success(updatedThread.isLocked ? t('discussion_locked') : t('discussion_unlocked'));
    },
    onError: (error: any) => toast.error(error.response?.data?.error || t('failed_update_discussion')),
  });

  const pinThreadMutation = useMutation({
    mutationFn: (isPinned: boolean) => forumsApi.pinThread(effectiveThreadId, isPinned),
    onSuccess: (updatedThread) => {
      queryClient.invalidateQueries({ queryKey: ['thread', effectiveThreadId] });
      toast.success(updatedThread.isPinned ? t('discussion_pinned') : t('discussion_unpinned'));
    },
    onError: (error: any) => toast.error(error.response?.data?.error || t('failed_update_discussion')),
  });

  // Like toggle with optimistic update.
  const toggleLikeMutation = useMutation({
    mutationFn: () => forumsApi.toggleThreadLike(effectiveThreadId),
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: ['thread', effectiveThreadId] });
      const prev = queryClient.getQueryData<any>(['thread', effectiveThreadId]);
      queryClient.setQueryData(['thread', effectiveThreadId], (old: any) =>
        old
          ? {
              ...old,
              myLike: !old.myLike,
              likeCount: (old.likeCount ?? 0) + (old.myLike ? -1 : 1),
            }
          : old,
      );
      return { prev };
    },
    onError: (_e, _v, ctx: any) => {
      if (ctx?.prev) queryClient.setQueryData(['thread', effectiveThreadId], ctx.prev);
      toast.error(t('failed_to_like', { defaultValue: 'Could not save like' }));
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['thread', effectiveThreadId] });
    },
  });

  const deletePostMutation = useMutation({
    mutationFn: (postId: number) => forumsApi.deletePost(postId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['thread', effectiveThreadId] });
      toast.success(t('comment_deleted', { defaultValue: 'Comment deleted' }));
    },
    onError: (error: any) =>
      toast.error(
        error.response?.data?.error ||
          t('failed_delete_comment', { defaultValue: 'Failed to delete comment' }),
      ),
  });

  const handleShare = async () => {
    const url = window.location.href;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
      } else {
        window.prompt(t('share_link_prompt', { defaultValue: 'Copy this link' }), url);
      }
      toast.success(t('share_link_copied', { defaultValue: 'Link copied' }));
    } catch {
      toast.error(t('share_link_failed', { defaultValue: 'Could not copy link' }));
    }
  };

  // Check if user is instructor/admin for this course
  const isInstructor = user?.isInstructor || user?.isAdmin || false;

  // (formatDate removed — `formatRelative` from utils/relativeTime is
  // used everywhere on this page now.)

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
    track('reply_to_post_started', { verb: 'interacted', objectType: 'forum', objectId: postId, courseId: parsedCourseId });
    setReplyingToId(postId);
    setReplyingToName(authorName);
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
    track('reply_cancelled', { verb: 'interacted', objectType: 'forum', objectId: parsedForumId, courseId: parsedCourseId });
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
      track('ai_requested', { verb: 'interacted', objectType: 'forum', objectId: parsedForumId, courseId: parsedCourseId });
      setShowAiSelector(true);
      setAiReplyToId(postId);
    }
  };

  /**
   * Collect every nested reply under a post as a flat list. Used to
   * power the "5 stacked avatars + first-reply preview" footer and to
   * count the total replies.
   */
  // Render a single post recursively. Each comment / reply uses the
  // same shape: avatar column (with +/- toggle + stacked avatars below
  // the avatar when it has replies), then a content column. Expanded
  // children render under the parent through a small horizontal stub,
  // recursing into renderPost so a reply-of-a-reply keeps its own
  // toggle and stacked-avatar peek.
  const renderPost = (post: ThreadedPost, depth: number = 0) => {
    const maxDepth = 6; // Cap recursion just to keep DOM sane.
    const isAiPost = !!post.isAiGenerated;
    const authorName = isAiPost
      ? (post.aiAgentName || t('tutors:ai_tutor'))
      : (post.author?.fullname || t('anonymous'));
    const isExpanded = expandedReplies.has(post.id);
    const directReplies = post.replies || [];
    const hasReplies = directReplies.length > 0 && depth < maxDepth;
    const visibleAvatars = directReplies.slice(0, 5);

    // The header / body / actions block used by both the parent comment
    // and each expanded reply — DRY'd so the two layouts stay identical.
    const renderContent = (p: ThreadedPost, name: string, isAi: boolean) => (
      <>
        <div className="min-w-0 leading-tight">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span
              className="font-semibold text-sm"
              style={{ color: isAi ? colors.aiAccent : colors.textPrimary }}
            >
              {isAi && <Sparkles size={12} className="inline mr-1" />}
              {name}
            </span>
            {p.author?.isInstructor && !isAi && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                {t('instructor')}
              </span>
            )}
            <span className="text-xs" style={{ color: colors.textSecondary }}>
              {formatRelative(p.createdAt)}
              {p.isEdited && ` · ${t('edited')}`}
            </span>
          </div>
          {isAi && p.requester && (
            <p className="text-[11px] mt-0.5" style={{ color: colors.textSecondary }}>
              {t('requested_by', { name: p.requester.fullname })}
            </p>
          )}
        </div>
        <TrackedContent context="forum" courseId={parsedCourseId} objectId={parsedForumId} objectTitle={name}>
          <div
            className="mt-1.5 text-sm prose prose-sm dark:prose-invert max-w-none break-words"
            style={{ color: colors.textPrimary }}
            dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(p.content) }}
          />
        </TrackedContent>
        {(() => {
          const canR = !thread?.isLocked && depth < maxDepth;
          const canD =
            isInstructor ||
            (!!user && !p.isAnonymous && p.author?.fullname === user.fullname);
          if (!canR && !canD) return null;
          return (
            <div className="mt-2 flex items-center gap-3 text-xs">
              {canD && (
                <button
                  type="button"
                  onClick={() => deletePostMutation.mutate(p.id)}
                  aria-label={t('common:delete', { defaultValue: 'Delete' })}
                  title={t('common:delete', { defaultValue: 'Delete' })}
                  className="inline-flex items-center text-red-500 hover:text-red-600 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
              {canR && (
                <button
                  type="button"
                  onClick={() => handleReplyToPost(p.id, name)}
                  className="inline-flex items-center gap-1 font-medium hover:underline"
                  style={{ color: colors.accent }}
                >
                  <MessageCircle className="w-3.5 h-3.5" />
                  {t('reply', { defaultValue: 'Reply' })}
                </button>
              )}
              {canR && agents.length > 0 && (
                <button
                  type="button"
                  onClick={() => toggleAiSelectorForPost(p.id)}
                  disabled={aiPostMutation.isPending}
                  className="inline-flex items-center gap-1 font-medium hover:underline disabled:opacity-60"
                  style={{ color: colors.aiAccent }}
                >
                  <Bot className="w-3.5 h-3.5" />
                  {t('ask_ai', { defaultValue: 'Ask AI' })}
                </button>
              )}
            </div>
          );
        })()}
        {showAiSelector && aiReplyToId === p.id && (
          <div className="mt-3 p-3 rounded-lg" style={{ backgroundColor: colors.bgHover }}>
            <ForumAgentSelector
              agents={agents}
              onSelect={(agent) => handleAiRequest(agent, p.id)}
              disabled={aiPostMutation.isPending}
              isLoading={aiPostMutation.isPending}
              compact
            />
          </div>
        )}
        {replyingToId === p.id && (
          <div className="mt-3 p-3 rounded-lg" style={{ backgroundColor: colors.bgHover }}>
            <ForumReplyInput
              value={replyContent}
              onChange={setReplyContent}
              onSubmit={handleSubmitReply}
              onAiRequest={(agent) => handleAiRequest(agent, p.id)}
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
      </>
    );

    // Avatar swatch for a post — either the user's uploaded avatar
    // (rendered via the shared <Avatar src=…/> which falls back to
    // initials only when src is empty) or an AI bot's icon.
    const avatarFor = (
      p: ThreadedPost,
      name: string,
      size: 'sm' | 'md' = 'md',
    ) => {
      const aiBox = size === 'sm' ? 'w-8 h-8' : 'w-9 h-9';
      const iconPx = size === 'sm' ? 16 : 18;
      if (p.isAiGenerated) {
        return (
          <div
            className={`${aiBox} rounded-full flex items-center justify-center flex-shrink-0`}
            style={{ backgroundColor: colors.aiAccent }}
          >
            {p.aiAgent?.avatarUrl ? (
              <img src={p.aiAgent.avatarUrl} alt="" className={`${aiBox} rounded-full`} />
            ) : (
              <Bot size={iconPx} className="text-white" />
            )}
          </div>
        );
      }
      const src = p.author?.avatarUrl ? resolveFileUrl(p.author.avatarUrl) : undefined;
      return <Avatar name={name} size={size} src={src} />;
    };

    const isNested = depth > 0;
    return (
      <div key={post.id}>
        <div
          className={isNested ? '' : 'px-6 pt-5 pb-5'}
          style={
            !isNested && isAiPost
              ? { backgroundColor: colors.bgAi }
              : undefined
          }
        >
          <div className="flex items-stretch gap-3">
            {/* Avatar column. When this post has replies, the column
                stretches and we draw a single continuous line below the
                avatar — line, +/- toggle, more line, then either the
                stacked-avatar peek (collapsed) or nothing (expanded —
                the next reply rows continue the line themselves). */}
            <div className="w-9 flex-shrink-0 flex flex-col items-center">
              {avatarFor(post, authorName)}
              {hasReplies && (
                <>
                  <span
                    aria-hidden
                    className="w-0 h-2 border-l-2 mt-1"
                    style={{ borderColor: colors.border }}
                  />
                  <button
                    type="button"
                    onClick={() => toggleExpandReplies(post.id)}
                    className="relative z-10 w-5 h-5 rounded-full border-2 bg-white dark:bg-gray-900 flex items-center justify-center"
                    style={{ borderColor: colors.border, color: colors.textSecondary }}
                    aria-label={
                      isExpanded
                        ? t('hide_replies', { defaultValue: 'Hide replies' })
                        : t('show_replies', { defaultValue: 'Show replies' })
                    }
                    title={`${directReplies.length}`}
                  >
                    {isExpanded ? <Minus className="w-3 h-3" /> : <Plus className="w-3 h-3" />}
                  </button>
                  {!isExpanded ? (
                    <>
                      <span
                        aria-hidden
                        className="w-0 h-2 border-l-2 mb-1"
                        style={{ borderColor: colors.border }}
                      />
                      {/* Stacked avatars — first avatar's centre aligned to
                          the line by shifting 6px left (half-column - half-avatar). */}
                      <div
                        className="flex -space-x-2 self-start"
                        style={{ marginLeft: '6px' }}
                      >
                        {visibleAvatars.map((r, idx) => {
                          const rName = r.isAiGenerated
                            ? (r.aiAgentName || t('tutors:ai_tutor'))
                            : (r.author?.fullname || t('anonymous'));
                          return (
                            <span
                              key={`${r.id}-${idx}`}
                              className="ring-2 ring-white dark:ring-gray-800 rounded-full inline-flex"
                              style={{ zIndex: visibleAvatars.length - idx }}
                            >
                              {r.isAiGenerated && r.aiAgent?.avatarUrl ? (
                                <img
                                  src={r.aiAgent.avatarUrl}
                                  alt=""
                                  className="w-6 h-6 rounded-full object-cover"
                                />
                              ) : (
                                <Avatar
                                  name={rName}
                                  size="xs"
                                  src={
                                    r.author?.avatarUrl
                                      ? resolveFileUrl(r.author.avatarUrl)
                                      : undefined
                                  }
                                />
                              )}
                            </span>
                          );
                        })}
                      </div>
                      {directReplies.length > 5 && (
                        <span
                          className="text-[10px] mt-1"
                          style={{ color: colors.textSecondary }}
                        >
                          +{directReplies.length - 5}
                        </span>
                      )}
                    </>
                  ) : (
                    // Expanded: line continues to the first reply row below.
                    <span
                      aria-hidden
                      className="w-0 flex-1 border-l-2 mt-1"
                      style={{ borderColor: colors.border }}
                    />
                  )}
                </>
              )}
            </div>

            {/* Parent content column. */}
            <div className="flex-1 min-w-0">
              {renderContent(post, authorName, isAiPost)}
            </div>
          </div>

          {/* Expanded direct children — each rendered through the same
              renderPost so a reply-of-a-reply keeps its own avatar
              column, +/- toggle and stacked-avatar peek. A short
              horizontal stub indents the child under the parent's
              vertical line; on the last child the parent's line caps
              cleanly at the stub. */}
          {hasReplies && isExpanded && directReplies.map((reply, i) => {
            const isLast = i === directReplies.length - 1;
            // The avatar's vertical centre sits ~30px from the top of
            // the stub row (pt-3 + half of the w-9 avatar = 12+18).
            const AVATAR_CENTER = 30;
            return (
              <div key={reply.id} className="relative flex items-stretch">
                <span
                  aria-hidden
                  className="absolute border-l-2"
                  style={{
                    left: '17px',
                    top: 0,
                    height: isLast ? `${AVATAR_CENTER}px` : '100%',
                    borderColor: colors.border,
                  }}
                />
                <span
                  aria-hidden
                  className="absolute border-t-2"
                  style={{
                    left: '18px',
                    top: `${AVATAR_CENTER - 1}px`,
                    width: '18px',
                    borderColor: colors.border,
                  }}
                />
                {/* Spacer matching the parent's w-9 avatar column so
                    the stub lands at the right horizontal offset. */}
                <div className="w-9 flex-shrink-0" />
                <div className="flex-1 min-w-0 pt-3">
                  {renderPost(reply, depth + 1)}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };


  const isLoading = forumLoading || threadLoading;

  if (isLoading) {
    return <Loading text={t('loading')} />;
  }

  // Single-discussion view — rendered for any URL shape now that each
  // forum is its own thread.
  if (thread) {
    const threadedPosts = buildThreadedPosts(thread.posts || []);
    const totalReplies = thread.posts?.length || 0;

    // With the flat model, the forum's name and the thread's name are
    // the same; show it once at the end of the breadcrumb trail.
    const threadBreadcrumbs = buildForumBreadcrumb(
      courseId!,
      course?.title || t('course'),
      thread.title,
      undefined,
      isInstructor ? '/teach/forums' : '/forums',
    );

    return (
      <div className="min-h-screen py-6 md:py-8" style={{ backgroundColor: colors.bg }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Breadcrumb navigation */}
          <div className="mb-6">
            <Breadcrumb items={threadBreadcrumbs} />
          </div>

          {/* Discussion post — social-card layout */}
          {(() => {
            const tags = extractHashtags(thread.content);
            const likeCount = (thread as any).likeCount ?? 0;
            const myLike = !!(thread as any).myLike;
            const authorName = thread.author
              ? thread.author.fullname
              : t('anonymous', { defaultValue: 'Anonymous' });
            return (
              <article
                className="mb-6 rounded-2xl border bg-white dark:bg-gray-800"
                style={{ borderColor: colors.border }}
              >
                {/* Author row */}
                <header className="flex items-center justify-between px-6 pt-6">
                  <div className="flex items-center gap-3 min-w-0">
                    <Avatar name={authorName} size="md" />
                    <div className="min-w-0 leading-tight">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-sm font-semibold truncate" style={{ color: colors.textPrimary }}>
                          {authorName}
                        </span>
                        {thread.isPinned && <Pin className="w-3.5 h-3.5 text-yellow-500" />}
                        {thread.isLocked && <Lock className="w-3.5 h-3.5 text-red-500" />}
                      </div>
                      <p className="text-xs" style={{ color: colors.textSecondary }}>
                        {formatRelative(thread.createdAt)}
                      </p>
                    </div>
                  </div>

                  {isInstructor && (
                    <div className="relative">
                      <button
                        onClick={() => setShowThreadActions(!showThreadActions)}
                        className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                        title={t('thread_actions')}
                      >
                        <MoreVertical size={16} style={{ color: colors.textSecondary }} />
                      </button>
                      {showThreadActions && (
                        <div
                          className="absolute right-0 top-full mt-1 w-48 rounded-lg shadow-lg border z-20"
                          style={{ backgroundColor: colors.bgCard, borderColor: colors.border }}
                        >
                          <button
                            onClick={() => {
                              track('thread_pinned', { verb: 'interacted', objectType: 'forum', objectId: effectiveThreadId, courseId: parsedCourseId, payload: { pinned: !thread.isPinned } });
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
                              track('thread_locked', { verb: 'interacted', objectType: 'forum', objectId: effectiveThreadId, courseId: parsedCourseId, payload: { locked: !thread.isLocked } });
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
                </header>

                {/* Title + body */}
                <div className="px-6 pt-5">
                  <h1
                    className="text-xl sm:text-2xl font-semibold leading-snug mb-3"
                    style={{ color: colors.textPrimary }}
                  >
                    {thread.title}
                  </h1>
                  <TrackedContent context="forum" courseId={parsedCourseId} objectId={parsedForumId} objectTitle={thread.title}>
                    <div
                      className="prose prose-sm dark:prose-invert max-w-none break-words"
                      style={{ color: colors.textPrimary }}
                      dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(stripHashtags(thread.content)) }}
                    />
                  </TrackedContent>

                  {tags.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-4">
                      {tags.map(tag => (
                        <span
                          key={tag}
                          className="inline-flex items-center px-2 py-0.5 text-xs rounded-full bg-teal-50 dark:bg-teal-900/20 text-teal-700 dark:text-teal-300"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Footer actions: comments / likes / share */}
                <footer
                  className="mt-5 px-6 py-4 border-t flex items-center gap-5 text-sm"
                  style={{ borderColor: colors.border, color: colors.textSecondary }}
                >
                  <span className="inline-flex items-center gap-1.5">
                    <MessageCircle className="w-4 h-4" />
                    <span className="tabular-nums">{totalReplies}</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => user && toggleLikeMutation.mutate()}
                    disabled={!user || toggleLikeMutation.isPending}
                    aria-pressed={myLike}
                    aria-label={
                      myLike
                        ? t('unlike_post', { defaultValue: 'Unlike' })
                        : t('like_post', { defaultValue: 'Like' })
                    }
                    className="inline-flex items-center gap-1.5 hover:text-rose-500 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                    style={{ color: myLike ? '#e11d48' : colors.textSecondary }}
                  >
                    <Heart className="w-4 h-4" fill={myLike ? 'currentColor' : 'none'} />
                    {likeCount > 0 && <span className="tabular-nums">{likeCount}</span>}
                  </button>
                  <button
                    type="button"
                    onClick={handleShare}
                    aria-label={t('share', { defaultValue: 'Share' })}
                    className="inline-flex items-center gap-1.5 hover:text-teal-600 transition-colors"
                  >
                    <Share2 className="w-4 h-4" />
                  </button>
                </footer>
              </article>
            );
          })()}

          {/* Comments — bare card stack, no header. */}
          {threadedPosts.length > 0 && (
            <div className="space-y-4">
              {threadedPosts.map(post => (
                <article
                  key={post.id}
                  className="rounded-2xl border bg-white dark:bg-gray-800"
                  style={{ borderColor: colors.border }}
                >
                  {renderPost(post, 0)}
                </article>
              ))}
            </div>
          )}

          {/* New comment composer — shown at the bottom. */}
          {replyingToId === null && !thread.isLocked && (
            <div ref={replyFormRef}>
            <article
              className="mt-6 rounded-2xl border bg-white dark:bg-gray-800 p-5"
              style={{ borderColor: colors.border }}
            >
                <ForumReplyInput
                  value={replyContent}
                  onChange={setReplyContent}
                  onSubmit={handleSubmitReply}
                  onAiRequest={(agent) => handleAiRequest(agent)}
                  agents={agents}
                  placeholder={t('comment_placeholder', { defaultValue: 'Share a thoughtful comment…' })}
                  disabled={createPostMutation.isPending}
                  isSubmitting={createPostMutation.isPending}
                  isAiLoading={aiPostMutation.isPending}
                  showAgentSelector={agents.length > 0}
                />
            </article>
            </div>
          )}

          {thread.isLocked && (
            <article
              className="mt-6 rounded-2xl border bg-white dark:bg-gray-800 text-center py-6"
              style={{ borderColor: colors.border }}
            >
              <Lock className="w-8 h-8 mx-auto mb-2" style={{ color: colors.textSecondary }} />
              <p style={{ color: colors.textSecondary }}>{t('discussion_is_locked')}</p>
            </article>
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
                  onClick={() => { track('delete_confirmed', { verb: 'deleted', objectType: 'forum', objectId: effectiveThreadId, courseId: parsedCourseId }); deleteThreadMutation.mutate(); }}
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

  // Discussion not found / not loaded yet.
  return (
    <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: colors.bg }}>
      <p style={{ color: colors.textPrimary }}>{t('forum_not_found')}</p>
    </div>
  );
};
