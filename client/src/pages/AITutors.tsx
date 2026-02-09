import { useState, useEffect, useCallback } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Menu, Heart, ArrowLeft } from 'lucide-react';
import { tutorsApi } from '../api/tutors';
import { coursesApi } from '../api/courses';
import { TutorSidebar, TutorChat, EmotionalPulseHistory } from '../components/tutors';
import { Loading } from '../components/common/Loading';
import { useTheme } from '../hooks/useTheme';
import type {
  TutorAgent,
  TutorMessage,
  TutorMode,
  RoutingInfo,
  CollaborativeInfo,
  CollaborativeSettings,
} from '../types/tutor';
import type { EmotionType } from '../types';

// Mapping of course routing modes to session modes
type CourseRoutingMode = 'free' | 'all' | 'single' | 'smart' | 'collaborative' | 'random';

const mapCourseRoutingToSessionMode = (routingMode: CourseRoutingMode | undefined): TutorMode | null => {
  switch (routingMode) {
    case 'collaborative':
      return 'collaborative';
    case 'smart':
      return 'router';
    case 'random':
      return 'random';
    default:
      return null; // Use existing session mode
  }
};

interface MessageWithMeta extends TutorMessage {
  routingInfo?: RoutingInfo;
  collaborativeInfo?: CollaborativeInfo;
}

export const AITutors = () => {
  const { t } = useTranslation(['courses', 'common']);
  const { isDark } = useTheme();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();

  // URL params for deep linking
  const agentIdFromUrl = searchParams.get('agent');
  const courseIdFromUrl = searchParams.get('courseId');

  // Theme colors
  const bgColor = isDark ? '#111827' : '#f9fafb';

  // Local state
  const [selectedAgent, setSelectedAgent] = useState<TutorAgent | null>(null);
  const [messages, setMessages] = useState<MessageWithMeta[]>([]);
  const [mode, setMode] = useState<TutorMode>('manual');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(true);
  const [mobileHistoryOpen, setMobileHistoryOpen] = useState(false);
  const [pulseRefreshTrigger, setPulseRefreshTrigger] = useState(0);

  // Fetch session data (includes agents and conversations)
  const { data: sessionData, isLoading: sessionLoading } = useQuery({
    queryKey: ['tutorSession'],
    queryFn: tutorsApi.getSession,
    staleTime: 30000, // 30 seconds
  });

  // Fetch course data if we're in a course context (to get routing mode)
  const { data: courseData } = useQuery({
    queryKey: ['course', courseIdFromUrl],
    queryFn: () => coursesApi.getCourseById(parseInt(courseIdFromUrl!)),
    enabled: !!courseIdFromUrl,
    staleTime: 60000, // 1 minute
  });

  // Track if we've applied course settings (to avoid re-applying on every session change)
  const [courseSettingsApplied, setCourseSettingsApplied] = useState(false);

  // Mode change mutation - defined early so it can be used in initialization effect
  const modeMutation = useMutation({
    mutationFn: tutorsApi.setMode,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tutorSession'] });
    },
  });

  // Initialize state from session data
  useEffect(() => {
    if (sessionData) {
      let effectiveMode = sessionData.session.mode;

      // If we have course settings and haven't applied them yet, check if we need to override mode
      if (courseData && !courseSettingsApplied) {
        const courseRoutingMode = (courseData as any).tutorRoutingMode as CourseRoutingMode | undefined;
        const mappedMode = mapCourseRoutingToSessionMode(courseRoutingMode);

        if (mappedMode && mappedMode !== effectiveMode) {
          effectiveMode = mappedMode;
          // Update the session mode on the server to match course setting
          modeMutation.mutate(mappedMode);
        }
        setCourseSettingsApplied(true);
      }

      setMode(effectiveMode);

      // In collaborative/router/random mode, always use first agent for unified team chat
      if (effectiveMode === 'collaborative' || effectiveMode === 'router' || effectiveMode === 'random') {
        if (sessionData.agents.length > 0) {
          setSelectedAgent(sessionData.agents[0]);
        }
        return;
      }

      // Manual mode: Priority: URL agent param > active session agent
      if (agentIdFromUrl) {
        const agentFromUrl = sessionData.agents.find(
          (a) => a.id === parseInt(agentIdFromUrl)
        );
        if (agentFromUrl) {
          setSelectedAgent(agentFromUrl);
          return;
        }
      }

      // If there's an active agent in session, select it
      if (sessionData.session.activeAgentId) {
        const activeAgent = sessionData.agents.find(
          (a) => a.id === sessionData.session.activeAgentId
        );
        if (activeAgent) {
          setSelectedAgent(activeAgent);
        }
      }
    }
  }, [sessionData, agentIdFromUrl, courseData, courseSettingsApplied]);

  // Fetch conversation when agent is selected
  const { data: conversationData, isLoading: conversationLoading } = useQuery({
    queryKey: ['tutorConversation', selectedAgent?.id],
    queryFn: () => tutorsApi.getConversation(selectedAgent!.id),
    enabled: !!selectedAgent,
    staleTime: 10000, // 10 seconds
  });

  // Update messages when conversation data changes
  // Parse synthesizedFrom back into collaborativeInfo for saved messages
  useEffect(() => {
    if (conversationData) {
      const messagesWithMeta: MessageWithMeta[] = conversationData.messages.map((msg) => {
        // If this message has synthesizedFrom, parse it back to collaborativeInfo
        if (msg.synthesizedFrom && msg.role === 'assistant') {
          try {
            const parsed = JSON.parse(msg.synthesizedFrom);
            // Handle both old format (array) and new format ({ style, agentContributions })
            const agentContributions = Array.isArray(parsed) ? parsed : parsed.agentContributions;
            const style = Array.isArray(parsed) ? 'parallel' : (parsed.style || 'parallel');
            if (Array.isArray(agentContributions) && agentContributions.length > 0) {
              return {
                ...msg,
                collaborativeInfo: {
                  style: style as 'parallel' | 'sequential' | 'debate' | 'random',
                  agentContributions,
                },
              };
            }
          } catch {
            // Invalid JSON, skip
          }
        }
        return msg;
      });
      setMessages(messagesWithMeta);
    } else {
      setMessages([]);
    }
  }, [conversationData]);

  // Active agent mutation
  const activeAgentMutation = useMutation({
    mutationFn: tutorsApi.setActiveAgent,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tutorSession'] });
    },
  });

  // Send message mutation
  const sendMessageMutation = useMutation({
    mutationFn: ({ chatbotId, message, collaborativeSettings }: {
      chatbotId: number;
      message: string;
      collaborativeSettings?: CollaborativeSettings;
    }) => tutorsApi.sendMessage(chatbotId, message, collaborativeSettings),
    onSuccess: (response) => {
      // Add the new messages to the list
      const newMessages: MessageWithMeta[] = [
        response.userMessage,
        {
          ...response.assistantMessage,
          routingInfo: response.routingInfo,
          collaborativeInfo: response.collaborativeInfo,
        },
      ];
      setMessages((prev) => [...prev, ...newMessages]);

      // Invalidate conversations to update previews
      queryClient.invalidateQueries({ queryKey: ['tutorSession'] });
    },
  });

  // Clear conversation mutation
  const clearConversationMutation = useMutation({
    mutationFn: tutorsApi.clearConversation,
    onSuccess: () => {
      setMessages([]);
      queryClient.invalidateQueries({ queryKey: ['tutorSession'] });
      queryClient.invalidateQueries({ queryKey: ['tutorConversation', selectedAgent?.id] });
    },
  });

  // Handle agent selection
  const handleAgentSelect = useCallback(
    async (agent: TutorAgent) => {
      setSelectedAgent(agent);

      // Update active agent on server
      if (mode === 'manual') {
        activeAgentMutation.mutate(agent.id);
      }
    },
    [mode, activeAgentMutation]
  );

  // Handle mode change
  const handleModeChange = useCallback(
    async (newMode: TutorMode) => {
      setMode(newMode);
      modeMutation.mutate(newMode);

      // In collaborative/router/random mode, switch to team chat (first agent)
      const availableAgents = sessionData?.agents || [];
      if ((newMode === 'collaborative' || newMode === 'router' || newMode === 'random') && availableAgents.length > 0) {
        setSelectedAgent(availableAgents[0]);
      }
    },
    [modeMutation, sessionData?.agents]
  );

  // Handle send message
  const handleSendMessage = useCallback(
    async (message: string, collaborativeSettings?: CollaborativeSettings) => {
      if (!selectedAgent) return;

      // Optimistic update - add user message immediately
      const optimisticUserMessage: MessageWithMeta = {
        id: Date.now(),
        conversationId: 0,
        role: 'user',
        content: message,
        createdAt: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, optimisticUserMessage]);

      try {
        await sendMessageMutation.mutateAsync({
          chatbotId: selectedAgent.id,
          message,
          collaborativeSettings,
        });
        // Remove optimistic message as real messages were added in onSuccess
        setMessages((prev) => prev.filter((m) => m.id !== optimisticUserMessage.id));
      } catch (error) {
        // Remove optimistic message on error
        setMessages((prev) => prev.filter((m) => m.id !== optimisticUserMessage.id));
        // Could show an error toast here
        console.error('Failed to send message:', error);
      }
    },
    [selectedAgent, sendMessageMutation]
  );

  // Handle clear conversation
  const handleClearConversation = useCallback(() => {
    if (!selectedAgent) return;
    clearConversationMutation.mutate(selectedAgent.id);
  }, [selectedAgent, clearConversationMutation]);

  // Handle emotional pulse
  const handleEmotionalPulse = useCallback((_emotion: EmotionType) => {
    // Trigger refresh of history sidebar
    setPulseRefreshTrigger(prev => prev + 1);
  }, []);

  // Loading state
  if (sessionLoading) {
    return <Loading fullScreen text={t('loading_ai_tutors')} />;
  }

  const agents = sessionData?.agents || [];
  const conversations = sessionData?.conversations || [];

  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col relative" style={{ backgroundColor: bgColor }}>
      {/* Course context breadcrumb */}
      {courseIdFromUrl && (
        <div className="flex-shrink-0 px-4 py-2 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
          <Link
            to={`/courses/${courseIdFromUrl}`}
            className="inline-flex items-center gap-2 text-sm text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300"
          >
            <ArrowLeft className="w-4 h-4" />
            {t('back_to_course_button')}
          </Link>
        </div>
      )}

      <div className="flex-1 flex relative min-h-0 overflow-hidden">
      {/* Mobile FAB to open sidebar (left) */}
      <button
        onClick={() => setSidebarOpen(true)}
        className="lg:hidden fixed bottom-6 left-6 z-20 w-14 h-14 bg-gradient-to-br from-primary-500 to-secondary-500 text-white rounded-full shadow-lg flex items-center justify-center hover:shadow-xl transition-shadow"
        aria-label="Open tutor list"
      >
        <Menu className="w-6 h-6" />
      </button>

      {/* Mobile FAB to open history (right) */}
      {selectedAgent && (
        <button
          onClick={() => setMobileHistoryOpen(true)}
          className="lg:hidden fixed bottom-6 right-6 z-20 w-14 h-14 bg-gradient-to-br from-pink-500 to-rose-500 text-white rounded-full shadow-lg flex items-center justify-center hover:shadow-xl transition-shadow"
          aria-label="Open emotional journey"
        >
          <Heart className="w-6 h-6" />
        </button>
      )}

      {/* Sidebar (left) */}
      <TutorSidebar
        agents={agents}
        conversations={conversations}
        selectedAgent={selectedAgent}
        onAgentSelect={handleAgentSelect}
        mode={mode}
        onModeChange={handleModeChange}
        isLoading={sendMessageMutation.isPending}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      {/* Chat Area (center) */}
      <TutorChat
        agent={selectedAgent}
        agents={agents}
        messages={messages}
        onSendMessage={handleSendMessage}
        onClearConversation={handleClearConversation}
        onModeChange={handleModeChange}
        isLoading={sendMessageMutation.isPending || conversationLoading}
        mode={mode}
        conversationId={conversationData?.id}
        onEmotionalPulse={handleEmotionalPulse}
      />

      {/* Emotional Pulse History (right) - Desktop */}
      {selectedAgent && (
        <EmotionalPulseHistory
          agentId={selectedAgent.id}
          agentName={selectedAgent.displayName}
          isOpen={historyOpen}
          onClose={() => setHistoryOpen(false)}
          refreshTrigger={pulseRefreshTrigger}
        />
      )}

      {/* Emotional Pulse History - Mobile overlay */}
      {selectedAgent && (
        <EmotionalPulseHistory
          agentId={selectedAgent.id}
          agentName={selectedAgent.displayName}
          isOpen={mobileHistoryOpen}
          onClose={() => setMobileHistoryOpen(false)}
          isMobile={true}
          refreshTrigger={pulseRefreshTrigger}
        />
      )}
      </div>
    </div>
  );
};
