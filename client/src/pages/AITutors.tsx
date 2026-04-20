import { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Menu, Heart, BookOpen, ChevronRight } from 'lucide-react';
import { tutorsApi } from '../api/tutors';
import { coursesApi } from '../api/courses';
import { enrollmentsApi } from '../api/enrollments';
import { TutorSidebar, TutorChat, EmotionalPulseHistory } from '../components/tutors';
import { Loading } from '../components/common/Loading';
import { activityLogger } from '../services/activityLogger';
import { useTracker } from '../services/tracker';
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
  const navigate = useNavigate();
  const track = useTracker('ai_tutor');
  const [searchParams] = useSearchParams();

  // URL params for deep linking
  const agentIdFromUrl = searchParams.get('agent');
  const courseIdFromUrl = searchParams.get('courseId');

  // Fetch enrolled courses when no courseId is selected
  const { data: enrollments, isLoading: enrollmentsLoading } = useQuery({
    queryKey: ['myEnrollments'],
    queryFn: enrollmentsApi.getMyEnrollments,
    enabled: !courseIdFromUrl,
    staleTime: 60000,
  });

  // All active enrolled courses (with course data) — shown in the selector
  const enrolledCourses = enrollments?.filter(e => e.status === 'active' && e.course) ?? [];

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
  const [latestEmotion, setLatestEmotion] = useState<EmotionType | null>(null);

  const parsedCourseId = courseIdFromUrl ? parseInt(courseIdFromUrl) : undefined;

  // Fetch session data (includes agents and conversations) — scoped by course
  const { data: sessionData, isLoading: sessionLoading } = useQuery({
    queryKey: ['tutorSession', parsedCourseId],
    queryFn: () => tutorsApi.getSession(parsedCourseId),
    staleTime: 30000, // 30 seconds
  });

  // Fetch course data if we're in a course context (to get routing mode + tutors)
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
    mutationFn: (mode: TutorMode) => tutorsApi.setMode(mode, parsedCourseId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tutorSession', parsedCourseId] });
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
    queryKey: ['tutorConversation', selectedAgent?.id, parsedCourseId],
    queryFn: () => tutorsApi.getConversation(selectedAgent!.id, parsedCourseId),
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
    mutationFn: (chatbotId: number) => tutorsApi.setActiveAgent(chatbotId, parsedCourseId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tutorSession', parsedCourseId] });
    },
  });

  // Send message mutation
  const sendMessageMutation = useMutation({
    mutationFn: ({ chatbotId, message, collaborativeSettings, emotionalPulse }: {
      chatbotId: number;
      message: string;
      collaborativeSettings?: CollaborativeSettings;
      emotionalPulse?: string;
    }) => tutorsApi.sendMessage(chatbotId, message, collaborativeSettings, parsedCourseId, emotionalPulse),
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
      queryClient.invalidateQueries({ queryKey: ['tutorSession', parsedCourseId] });
    },
  });

  // Clear conversation mutation
  const clearConversationMutation = useMutation({
    mutationFn: (chatbotId: number) => tutorsApi.clearConversation(chatbotId, parsedCourseId),
    onSuccess: () => {
      setMessages([]);
      queryClient.invalidateQueries({ queryKey: ['tutorSession', parsedCourseId] });
      queryClient.invalidateQueries({ queryKey: ['tutorConversation', selectedAgent?.id, parsedCourseId] });
    },
  });

  // Handle agent selection
  const handleAgentSelect = useCallback(
    async (agent: TutorAgent) => {
      setSelectedAgent(agent);
      track('agent_selected', { verb: 'selected', objectType: 'tutor_agent', objectId: agent.id, courseId: parsedCourseId, payload: { agentName: agent.displayName } });

      // Update active agent on server
      if (mode === 'manual') {
        activeAgentMutation.mutate(agent.id);
      }
    },
    [mode, activeAgentMutation, track, parsedCourseId]
  );

  // Handle mode change
  const handleModeChange = useCallback(
    async (newMode: TutorMode) => {
      setMode(newMode);
      track('session_started', { verb: 'started', objectType: 'tutor_session', courseId: parsedCourseId, payload: { mode: newMode } });
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
      track('message_sent', { verb: 'interacted', objectType: 'tutor_conversation', objectId: selectedAgent.id, courseId: parsedCourseId, payload: { messageLength: message.length, mode } });

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
          emotionalPulse: latestEmotion || undefined,
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
    [selectedAgent, sendMessageMutation, latestEmotion]
  );

  // Handle clear conversation
  const handleClearConversation = useCallback(() => {
    if (!selectedAgent) return;
    track('conversation_cleared', { verb: 'interacted', objectType: 'tutor_conversation', objectId: selectedAgent.id, courseId: parsedCourseId });
    clearConversationMutation.mutate(selectedAgent.id);
  }, [selectedAgent, clearConversationMutation, conversationData?.id, parsedCourseId, track]);

  // Handle emotional pulse
  const handleEmotionalPulse = useCallback((emotion: EmotionType) => {
    // Store the latest emotion so the next message includes it
    setLatestEmotion(emotion);
    // Trigger refresh of history sidebar
    setPulseRefreshTrigger(prev => prev + 1);
    track('emotional_pulse_submitted', { verb: 'submitted', objectType: 'emotional_pulse', payload: { emotion } });
  }, [track]);

  // Log page view
  useEffect(() => {
    activityLogger.logAITutorsViewed();
  }, []);

  // Agent selection is tracked in handleAgentSelect via track('agent_selected')

  // Loading state
  if (sessionLoading) {
    return <Loading fullScreen text={t('loading_ai_tutors')} />;
  }

  // When courseId is present and we have course-specific tutors, filter the session agents
  // to only show tutors assigned to this course
  const allAgents = sessionData?.agents || [];
  const courseTutors = (courseData as any)?.tutors as any[] | undefined;
  const agents = (courseIdFromUrl && courseTutors)
    ? allAgents.filter(agent =>
        courseTutors.some(ct => ct.id === agent.id || ct.name === agent.name)
      )
    : allAgents;
  const conversations = sessionData?.conversations || [];

  // Show course selection overlay when no courseId is in the URL
  const showCourseSelector = !courseIdFromUrl;
  const selectorLoading = enrollmentsLoading;

  return (
    <div className="h-[calc(100vh-8rem)] flex flex-col relative" style={{ backgroundColor: bgColor }}>

      {/* Course selection overlay — covers only this page content, not navbar/sidebar */}
      {showCourseSelector && (
        <div className="absolute inset-0 z-10 flex items-center justify-center">
          {/* Blurred backdrop */}
          <div className="absolute inset-0 backdrop-blur-sm" style={{ backgroundColor: isDark ? 'rgba(17,24,39,0.6)' : 'rgba(249,250,251,0.6)' }} />

          {/* Selection card */}
          <div
            className="relative z-10 w-full max-w-md mx-4 rounded-2xl shadow-2xl border p-6"
            style={{
              backgroundColor: isDark ? '#1f2937' : '#ffffff',
              borderColor: isDark ? '#374151' : '#e5e7eb',
            }}
          >
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-500 to-secondary-500 flex items-center justify-center flex-shrink-0">
                <BookOpen className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="text-lg font-semibold" style={{ color: isDark ? '#f3f4f6' : '#111827' }}>
                  {t('common:select_course')}
                </h2>
                <p className="text-sm" style={{ color: isDark ? '#9ca3af' : '#6b7280' }}>
                  {t('common:select_course_for_tutor')}
                </p>
              </div>
            </div>

            {selectorLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loading text={t('common:loading')} />
              </div>
            ) : enrolledCourses.length === 0 ? (
              <div className="text-center py-8" style={{ color: isDark ? '#9ca3af' : '#6b7280' }}>
                <BookOpen className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p className="font-medium">{t('common:no_courses_with_tutors')}</p>
                <p className="text-sm mt-1">{t('common:no_courses_with_tutors_hint')}</p>
              </div>
            ) : (
              <ul className="space-y-2 max-h-72 overflow-y-auto">
                {enrolledCourses.map((enrollment) => (
                  <li key={enrollment.courseId}>
                    <button
                      onClick={() => { track('course_selected', { verb: 'selected', objectType: 'tutor_agent', courseId: enrollment.courseId, payload: { courseTitle: enrollment.course?.title } }); navigate(`/ai-tutors?courseId=${enrollment.courseId}`); }}
                      className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-colors hover:bg-primary-50 dark:hover:bg-primary-900/20 group"
                      style={{ border: `1px solid ${isDark ? '#374151' : '#e5e7eb'}` }}
                    >
                      <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary-400 to-secondary-400 flex items-center justify-center flex-shrink-0">
                        <BookOpen className="w-4 h-4 text-white" />
                      </div>
                      <span className="flex-1 font-medium text-sm" style={{ color: isDark ? '#f3f4f6' : '#111827' }}>
                        {enrollment.course?.title}
                      </span>
                      <ChevronRight className="w-4 h-4 opacity-40 group-hover:opacity-100 transition-opacity" style={{ color: isDark ? '#9ca3af' : '#6b7280' }} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      <div className="flex-1 flex relative min-h-0 overflow-hidden">
      {/* Mobile FAB to open sidebar (left) */}
      <button
        onClick={() => { setSidebarOpen(true); track('sidebar_toggled', { verb: 'interacted', objectType: 'tutor_agent', payload: { visible: true } }); }}
        className="lg:hidden fixed bottom-24 left-4 z-20 w-14 h-14 bg-gradient-to-br from-primary-500 to-secondary-500 text-white rounded-full shadow-lg flex items-center justify-center hover:shadow-xl transition-shadow"
        aria-label="Open tutor list"
      >
        <Menu className="w-6 h-6" />
      </button>

      {/* Mobile FAB to open history (right) */}
      {selectedAgent && (
        <button
          onClick={() => setMobileHistoryOpen(true)}
          className="lg:hidden fixed bottom-24 right-4 z-20 w-14 h-14 bg-gradient-to-br from-pink-500 to-rose-500 text-white rounded-full shadow-lg flex items-center justify-center hover:shadow-xl transition-shadow"
          aria-label="Open emotional journey"
        >
          <Heart className="w-6 h-6" />
        </button>
      )}

      {/* Sidebar (left) — blurred when course selector is active */}
      <div className={showCourseSelector ? 'blur-sm pointer-events-none' : ''}>
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
      </div>

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
        courseId={parsedCourseId}
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
