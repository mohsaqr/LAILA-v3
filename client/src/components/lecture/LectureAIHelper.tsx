import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Bot, Minus, Plus, BookOpen, MessageCircle, Clock, ChevronRight, ArrowLeft } from 'lucide-react';
import { useTheme } from '../../hooks/useTheme';
import { lectureAIHelperApi, LectureAIHelperMode, LectureAISession, LectureAIMessage } from '../../api/lectureAIHelper';
import { LectureAIHelperChat } from './LectureAIHelperChat';
import { LectureExplainView } from './LectureExplainView';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp?: string;
}

interface LectureAIHelperProps {
  lectureId: number;
  lectureTitle: string;
  courseId: number;
}

const MODE_CONFIG: Record<LectureAIHelperMode, {
  label: string;
  icon: typeof BookOpen;
  description: string;
  placeholder: string;
  welcomeMessage: string;
  newSessionLabel: string;
}> = {
  explain: {
    label: 'Explain',
    icon: BookOpen,
    description: 'Get clear explanations of lecture concepts',
    placeholder: 'Ask me to explain any concept from the lecture...',
    welcomeMessage: "Hi! I'm here to help you understand the lecture content. Ask me about any concept, term, or topic from this lecture, and I'll explain it clearly with examples.",
    newSessionLabel: 'New Explanation Thread',
  },
  discuss: {
    label: 'Discuss',
    icon: MessageCircle,
    description: 'Engage in Socratic discussion',
    placeholder: 'Share your thoughts or ask a discussion question...',
    welcomeMessage: "Let's discuss the lecture material together! I'll ask thought-provoking questions to help you think critically about the content. What aspect would you like to explore?",
    newSessionLabel: 'New Discussion',
  },
};

// Explain mode: shows thread list directly
// Discuss mode: shows sessions -> chat flow
type ViewState = 'collapsed' | 'explain' | 'sessions' | 'chat';

export const LectureAIHelper = ({ lectureId, lectureTitle }: LectureAIHelperProps) => {
  const { isDark } = useTheme();
  const queryClient = useQueryClient();
  const [viewState, setViewState] = useState<ViewState>('collapsed');
  const [mode, setMode] = useState<LectureAIHelperMode>('explain');
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [sessionId, setSessionId] = useState<string | undefined>();

  // Theme colors
  const colors = {
    bg: isDark ? '#1f2937' : '#ffffff',
    bgHeader: isDark ? '#374151' : '#f9fafb',
    bgHover: isDark ? '#374151' : '#f3f4f6',
    textPrimary: isDark ? '#f3f4f6' : '#111827',
    textSecondary: isDark ? '#9ca3af' : '#6b7280',
    border: isDark ? '#374151' : '#e5e7eb',
    accent: '#3b82f6',
    accentLight: isDark ? 'rgba(59, 130, 246, 0.2)' : '#dbeafe',
  };

  // Fetch sessions for this lecture (only for Discuss mode)
  const { data: sessions = [], isLoading: sessionsLoading } = useQuery({
    queryKey: ['lectureAIHelperSessions', lectureId],
    queryFn: () => lectureAIHelperApi.getSessions(lectureId),
    enabled: viewState === 'sessions' || viewState === 'chat',
  });

  // Chat mutation
  const chatMutation = useMutation({
    mutationFn: async (message: string) => {
      return lectureAIHelperApi.chat(lectureId, {
        mode,
        message,
        sessionId,
      });
    },
    onSuccess: (data, message) => {
      setMessages((prev) => [
        ...prev,
        { role: 'user', content: message, timestamp: new Date().toISOString() },
        { role: 'assistant', content: data.reply, timestamp: new Date().toISOString() },
      ]);
      setSessionId(data.sessionId);
      setInputValue('');
      // Refresh sessions list
      queryClient.invalidateQueries({ queryKey: ['lectureAIHelperSessions', lectureId] });
    },
  });

  // Load session history
  const loadSession = useCallback(async (session: LectureAISession) => {
    try {
      const history = await lectureAIHelperApi.getHistory(lectureId, session.sessionId);
      setMessages(history.map((msg: LectureAIMessage) => ({
        role: msg.role,
        content: msg.content,
        timestamp: msg.timestamp,
      })));
      setSessionId(session.sessionId);
      setMode(session.mode);
      setViewState('chat');
    } catch (error) {
      console.error('Failed to load session:', error);
    }
  }, [lectureId]);

  // Handle mode button click - different behavior for each mode
  const handleModeClick = useCallback((selectedMode: LectureAIHelperMode) => {
    setMode(selectedMode);
    if (selectedMode === 'explain') {
      // Explain mode: show thread list directly
      setViewState('explain');
    } else {
      // Discuss mode: show sessions list
      setViewState('sessions');
    }
  }, []);

  // Start new session
  const handleNewSession = useCallback(() => {
    setMessages([
      {
        role: 'assistant',
        content: MODE_CONFIG[mode].welcomeMessage,
        timestamp: new Date().toISOString(),
      },
    ]);
    setSessionId(undefined);
    setViewState('chat');
  }, [mode]);

  // Handle send message
  const handleSend = useCallback(() => {
    if (inputValue.trim() && !chatMutation.isPending) {
      chatMutation.mutate(inputValue.trim());
    }
  }, [inputValue, chatMutation]);

  // Back to sessions (Discuss mode only)
  const handleBackToSessions = useCallback(() => {
    if (mode === 'discuss') {
      setViewState('sessions');
    }
  }, [mode]);

  // Filter sessions for Discuss mode only
  const filteredSessions = sessions.filter((s: LectureAISession) => s.mode === 'discuss');

  const currentConfig = MODE_CONFIG[mode];
  const Icon = currentConfig.icon;

  // Format relative time
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

  return (
    <div
      className="rounded-xl shadow-lg overflow-hidden"
      style={{
        backgroundColor: colors.bg,
        border: `1px solid ${colors.border}`,
      }}
    >
      {/* Header bar - always visible */}
      <div
        className="px-4 py-3 flex items-center justify-between"
        style={{ backgroundColor: colors.bgHeader }}
      >
        <div className="flex items-center gap-3">
          {viewState === 'chat' && mode === 'discuss' && (
            <button
              onClick={handleBackToSessions}
              className="p-1.5 rounded-lg transition-colors hover:bg-opacity-80"
              style={{ backgroundColor: colors.bgHover, color: colors.textSecondary }}
              title="Back to sessions"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
          )}
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center"
            style={{ backgroundColor: colors.accentLight }}
          >
            <Bot className="w-4 h-4" style={{ color: colors.accent }} />
          </div>
          <div>
            <h3 className="font-medium text-sm" style={{ color: colors.textPrimary }}>
              AI Study Helper
              {(viewState === 'explain' || viewState === 'sessions' || viewState === 'chat') && (
                <span className="ml-2 text-xs font-normal" style={{ color: colors.textSecondary }}>
                  - {currentConfig.label}
                </span>
              )}
            </h3>
            {viewState === 'collapsed' && (
              <p className="text-xs" style={{ color: colors.textSecondary }}>
                Get help understanding "{lectureTitle}"
              </p>
            )}
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-2">
          {viewState !== 'collapsed' && (
            <button
              onClick={() => setViewState('collapsed')}
              className="p-2 rounded-lg transition-colors hover:bg-opacity-80"
              style={{ color: colors.textSecondary }}
              title="Minimize"
            >
              <Minus className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Collapsed state - mode buttons */}
      {viewState === 'collapsed' && (
        <div className="px-4 py-3 flex items-center gap-2 border-t" style={{ borderColor: colors.border }}>
          {(Object.keys(MODE_CONFIG) as LectureAIHelperMode[]).map((modeKey) => {
            const config = MODE_CONFIG[modeKey];
            const ModeIcon = config.icon;

            return (
              <button
                key={modeKey}
                onClick={() => handleModeClick(modeKey)}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                style={{
                  backgroundColor: colors.bgHover,
                  color: colors.textSecondary,
                }}
                title={config.description}
              >
                <ModeIcon className="w-4 h-4" />
                {config.label}
              </button>
            );
          })}
        </div>
      )}

      {/* Explain mode - Thread-based Q&A view */}
      {viewState === 'explain' && (
        <>
          {/* Mode tabs */}
          <div className="flex border-t border-b" style={{ borderColor: colors.border }}>
            {(Object.keys(MODE_CONFIG) as LectureAIHelperMode[]).map((modeKey) => {
              const config = MODE_CONFIG[modeKey];
              const ModeIcon = config.icon;
              const isActive = mode === modeKey;

              return (
                <button
                  key={modeKey}
                  onClick={() => handleModeClick(modeKey)}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium transition-colors"
                  style={{
                    backgroundColor: isActive ? colors.bg : colors.bgHeader,
                    color: isActive ? colors.accent : colors.textSecondary,
                    borderBottom: isActive ? `2px solid ${colors.accent}` : '2px solid transparent',
                  }}
                >
                  <ModeIcon className="w-4 h-4" />
                  {config.label}
                </button>
              );
            })}
          </div>
          <LectureExplainView lectureId={lectureId} />
        </>
      )}

      {/* Sessions list view (Discuss mode only) */}
      {viewState === 'sessions' && (
        <div className="border-t" style={{ borderColor: colors.border }}>
          {/* Mode tabs */}
          <div className="flex border-b" style={{ borderColor: colors.border }}>
            {(Object.keys(MODE_CONFIG) as LectureAIHelperMode[]).map((modeKey) => {
              const config = MODE_CONFIG[modeKey];
              const ModeIcon = config.icon;
              const isActive = mode === modeKey;

              return (
                <button
                  key={modeKey}
                  onClick={() => handleModeClick(modeKey)}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium transition-colors"
                  style={{
                    backgroundColor: isActive ? colors.bg : colors.bgHeader,
                    color: isActive ? colors.accent : colors.textSecondary,
                    borderBottom: isActive ? `2px solid ${colors.accent}` : '2px solid transparent',
                  }}
                >
                  <ModeIcon className="w-4 h-4" />
                  {config.label}
                </button>
              );
            })}
          </div>

          {/* New session button */}
          <button
            onClick={handleNewSession}
            className="w-full flex items-center gap-3 px-4 py-3 text-sm font-medium transition-colors border-b"
            style={{
              backgroundColor: colors.accentLight,
              color: colors.accent,
              borderColor: colors.border,
            }}
          >
            <Plus className="w-4 h-4" />
            {currentConfig.newSessionLabel}
          </button>

          {/* Sessions list */}
          <div className="max-h-64 overflow-y-auto">
            {sessionsLoading ? (
              <div className="px-4 py-8 text-center" style={{ color: colors.textSecondary }}>
                Loading sessions...
              </div>
            ) : filteredSessions.length === 0 ? (
              <div className="px-4 py-8 text-center" style={{ color: colors.textSecondary }}>
                <p className="mb-2">No previous sessions</p>
                <p className="text-xs">Start a new discussion above</p>
              </div>
            ) : (
              filteredSessions.map((session: LectureAISession) => (
                <button
                  key={session.sessionId}
                  onClick={() => loadSession(session)}
                  className="w-full flex items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-opacity-50"
                  style={{
                    borderBottom: `1px solid ${colors.border}`,
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = colors.bgHover)}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                >
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                    style={{ backgroundColor: colors.bgHover }}
                  >
                    <Icon className="w-4 h-4" style={{ color: colors.textSecondary }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p
                      className="text-sm font-medium truncate"
                      style={{ color: colors.textPrimary }}
                    >
                      {session.firstMessage || 'New conversation'}
                    </p>
                    <div className="flex items-center gap-2 text-xs" style={{ color: colors.textSecondary }}>
                      <Clock className="w-3 h-3" />
                      <span>{formatTimeAgo(session.lastActivity)}</span>
                      <span>•</span>
                      <span>{session.messageCount} messages</span>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 flex-shrink-0" style={{ color: colors.textSecondary }} />
                </button>
              ))
            )}
          </div>
        </div>
      )}

      {/* Chat view */}
      {viewState === 'chat' && (
        <>
          <LectureAIHelperChat
            messages={messages}
            isLoading={chatMutation.isPending}
            inputValue={inputValue}
            onInputChange={setInputValue}
            onSend={handleSend}
            placeholder={currentConfig.placeholder}
          />

          {/* Error display */}
          {chatMutation.isError && (
            <div className="px-4 py-2 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm">
              Failed to get response. Please try again.
            </div>
          )}
        </>
      )}
    </div>
  );
};
