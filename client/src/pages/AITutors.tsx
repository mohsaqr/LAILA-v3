import { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Menu, Heart } from 'lucide-react';
import { tutorsApi } from '../api/tutors';
import { TutorSidebar, TutorChat, EmotionalPulseHistory } from '../components/tutors';
import { Loading } from '../components/common/Loading';
import { useTheme } from '../hooks/useTheme';
import type {
  TutorAgent,
  TutorMessage,
  TutorMode,
  RoutingInfo,
  CollaborativeInfo,
} from '../types/tutor';
import type { EmotionType } from '../types';

interface MessageWithMeta extends TutorMessage {
  routingInfo?: RoutingInfo;
  collaborativeInfo?: CollaborativeInfo;
}

export const AITutors = () => {
  const { isDark } = useTheme();
  const queryClient = useQueryClient();

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

  // Initialize state from session data
  useEffect(() => {
    if (sessionData) {
      setMode(sessionData.session.mode);

      // If there's an active agent, select it
      if (sessionData.session.activeAgentId) {
        const activeAgent = sessionData.agents.find(
          (a) => a.id === sessionData.session.activeAgentId
        );
        if (activeAgent) {
          setSelectedAgent(activeAgent);
        }
      }
    }
  }, [sessionData]);

  // Fetch conversation when agent is selected
  const { data: conversationData, isLoading: conversationLoading } = useQuery({
    queryKey: ['tutorConversation', selectedAgent?.id],
    queryFn: () => tutorsApi.getConversation(selectedAgent!.id),
    enabled: !!selectedAgent,
    staleTime: 10000, // 10 seconds
  });

  // Update messages when conversation data changes
  useEffect(() => {
    if (conversationData) {
      setMessages(conversationData.messages);
    } else {
      setMessages([]);
    }
  }, [conversationData]);

  // Mode change mutation
  const modeMutation = useMutation({
    mutationFn: tutorsApi.setMode,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tutorSession'] });
    },
  });

  // Active agent mutation
  const activeAgentMutation = useMutation({
    mutationFn: tutorsApi.setActiveAgent,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tutorSession'] });
    },
  });

  // Send message mutation
  const sendMessageMutation = useMutation({
    mutationFn: ({ chatbotId, message }: { chatbotId: number; message: string }) =>
      tutorsApi.sendMessage(chatbotId, message),
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
    },
    [modeMutation]
  );

  // Handle send message
  const handleSendMessage = useCallback(
    async (message: string) => {
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
    return <Loading fullScreen text="Loading AI Tutors..." />;
  }

  const agents = sessionData?.agents || [];
  const conversations = sessionData?.conversations || [];

  return (
    <div className="h-[calc(100vh-4rem)] flex relative" style={{ backgroundColor: bgColor }}>
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
        messages={messages}
        onSendMessage={handleSendMessage}
        onClearConversation={handleClearConversation}
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
  );
};
