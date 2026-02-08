import { useState, useEffect } from 'react';
import { Bot, User, CornerDownRight, MessageSquare, Loader2, Send } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { useTheme } from '../../hooks/useTheme';
import { ExplainPost } from '../../api/lectureAIHelper';

interface ExplainThreadCardProps {
  posts: ExplainPost[];
  onFollowUp: (question: string, parentPostId?: number) => void;
  isSubmitting: boolean;
}

export const ExplainThreadCard = ({
  posts,
  onFollowUp,
  isSubmitting,
}: ExplainThreadCardProps) => {
  const { isDark } = useTheme();
  const [followUpInput, setFollowUpInput] = useState('');
  const [showFollowUp, setShowFollowUp] = useState(false);
  const [localSubmitting, setLocalSubmitting] = useState(false);

  const colors = {
    bg: isDark ? '#1f2937' : '#ffffff',
    bgNested: isDark ? '#1e293b' : '#f8fafc',
    textPrimary: isDark ? '#f3f4f6' : '#111827',
    textSecondary: isDark ? '#9ca3af' : '#6b7280',
    border: isDark ? '#374151' : '#e5e7eb',
    bgHover: isDark ? '#374151' : '#f3f4f6',
    accent: '#3b82f6',
    aiAccent: '#0891b2', // Teal for AI
    bgAi: isDark ? 'rgba(8, 145, 178, 0.1)' : 'rgba(8, 145, 178, 0.05)',
    userBubble: '#3b82f6',
  };

  const formatTimeAgo = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  // Reset form when THIS card's submission completes
  useEffect(() => {
    // When we were submitting and global isSubmitting becomes false, our submission completed
    if (localSubmitting && !isSubmitting) {
      setFollowUpInput('');
      setShowFollowUp(false);
      setLocalSubmitting(false);
    }
  }, [isSubmitting, localSubmitting]);

  const handleSubmitFollowUp = () => {
    if (followUpInput.trim() && !isSubmitting && !localSubmitting) {
      setLocalSubmitting(true);
      onFollowUp(followUpInput.trim());
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmitFollowUp();
    }
  };

  // Render a single post (recursively for nested replies)
  const renderPost = (post: ExplainPost, depth: number = 0) => {
    const isUser = post.authorType === 'user';
    const isNested = depth > 0;

    return (
      <div key={post.id} className={isNested ? 'mt-3' : ''}>
        <div
          className={`rounded-lg ${isNested ? 'ml-6 border-l-2 pl-4' : 'p-4'}`}
          style={{
            backgroundColor: !isUser ? colors.bgAi : (isNested ? colors.bgNested : 'transparent'),
            borderLeftColor: isNested ? (isUser ? colors.accent : colors.aiAccent) : undefined,
          }}
        >
          {/* Reply indicator for nested posts */}
          {isNested && (
            <div className="flex items-center gap-1 text-xs mb-2" style={{ color: colors.textSecondary }}>
              <CornerDownRight size={12} />
              <span>{isUser ? 'Follow-up' : 'AI Response'}</span>
            </div>
          )}

          <div className="flex items-start gap-3">
            {/* Avatar */}
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
              style={{
                backgroundColor: isUser ? colors.userBubble : colors.aiAccent,
              }}
            >
              {isUser ? (
                <User size={16} className="text-white" />
              ) : (
                <Bot size={16} className="text-white" />
              )}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span
                  className="font-medium text-sm"
                  style={{ color: isUser ? colors.textPrimary : colors.aiAccent }}
                >
                  {isUser ? 'You' : 'AI Tutor'}
                </span>
                <span className="text-xs" style={{ color: colors.textSecondary }}>
                  {formatTimeAgo(post.createdAt)}
                </span>
              </div>

              <div
                className="mt-2 text-sm prose prose-sm max-w-none dark:prose-invert"
                style={{ color: colors.textPrimary }}
              >
                <ReactMarkdown
                  components={{
                    h1: ({ children }) => <p className="font-bold text-base mb-1">{children}</p>,
                    h2: ({ children }) => <p className="font-bold text-sm mb-1">{children}</p>,
                    h3: ({ children }) => <p className="font-semibold text-sm mb-1">{children}</p>,
                    p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                    ul: ({ children }) => <ul className="list-disc pl-4 mb-2">{children}</ul>,
                    ol: ({ children }) => <ol className="list-decimal pl-4 mb-2">{children}</ol>,
                    li: ({ children }) => <li className="mb-1">{children}</li>,
                    code: ({ children, className }) => {
                      const isBlock = className?.includes('language-');
                      return isBlock ? (
                        <pre className="bg-gray-100 dark:bg-gray-800 p-2 rounded overflow-x-auto text-xs my-2">
                          <code>{children}</code>
                        </pre>
                      ) : (
                        <code className="bg-gray-100 dark:bg-gray-800 px-1 py-0.5 rounded text-xs">{children}</code>
                      );
                    },
                    pre: ({ children }) => <>{children}</>,
                    strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
                    blockquote: ({ children }) => (
                      <blockquote className="border-l-2 border-gray-300 dark:border-gray-600 pl-3 my-2 italic">
                        {children}
                      </blockquote>
                    ),
                  }}
                >
                  {post.content}
                </ReactMarkdown>
              </div>
            </div>
          </div>
        </div>

        {/* Render nested replies */}
        {post.replies && post.replies.length > 0 && (
          <div className="ml-4">
            {post.replies.map((reply) => renderPost(reply, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{
        backgroundColor: colors.bg,
        border: `1px solid ${colors.border}`,
      }}
    >
      {/* Thread posts */}
      <div className="p-4 space-y-4">
        {posts.map((post) => renderPost(post, 0))}
      </div>

      {/* Follow-up section */}
      <div
        className="px-4 py-3 border-t"
        style={{ borderColor: colors.border, backgroundColor: colors.bgHover }}
      >
        {!showFollowUp ? (
          <button
            onClick={() => setShowFollowUp(true)}
            className="flex items-center gap-2 text-sm font-medium transition-colors"
            style={{ color: colors.accent }}
          >
            <MessageSquare size={16} />
            Ask Follow-up
          </button>
        ) : (
          <div className="space-y-3">
            <div className="flex items-end gap-2">
              <textarea
                value={followUpInput}
                onChange={(e) => setFollowUpInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask a follow-up question..."
                disabled={localSubmitting}
                rows={2}
                className="flex-1 px-3 py-2 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 text-sm"
                style={{
                  backgroundColor: isDark ? '#374151' : '#ffffff',
                  border: `1px solid ${colors.border}`,
                  color: colors.textPrimary,
                }}
              />
              <button
                onClick={handleSubmitFollowUp}
                disabled={!followUpInput.trim() || localSubmitting}
                className="p-2 rounded-lg bg-blue-500 text-white hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {localSubmitting ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Send className="w-5 h-5" />
                )}
              </button>
            </div>
            <button
              onClick={() => {
                setShowFollowUp(false);
                setFollowUpInput('');
              }}
              className="text-xs"
              style={{ color: colors.textSecondary }}
            >
              Cancel
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
