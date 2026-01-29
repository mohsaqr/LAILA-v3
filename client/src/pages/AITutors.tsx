import { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { tutorsApi } from '../api/tutors';
import { TutorSidebar, TutorChat } from '../components/tutors';
import { Loading } from '../components/common/Loading';
import type {
  TutorAgent,
  TutorMessage,
  TutorMode,
  RoutingInfo,
  CollaborativeInfo,
} from '../types/tutor';

interface MessageWithMeta extends TutorMessage {
  routingInfo?: RoutingInfo;
  collaborativeInfo?: CollaborativeInfo;
}

export const AITutors = () => {
  const queryClient = useQueryClient();

  // Local state
  const [selectedAgent, setSelectedAgent] = useState<TutorAgent | null>(null);
  const [messages, setMessages] = useState<MessageWithMeta[]>([]);
  const [mode, setMode] = useState<TutorMode>('manual');

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

  // Loading state
  if (sessionLoading) {
    return <Loading fullScreen text="Loading AI Tutors..." />;
  }

  const agents = sessionData?.agents || [];
  const conversations = sessionData?.conversations || [];

  return (
    <div className="h-[calc(100vh-4rem)] flex">
      {/* Sidebar */}
      <TutorSidebar
        agents={agents}
        conversations={conversations}
        selectedAgent={selectedAgent}
        onAgentSelect={handleAgentSelect}
        mode={mode}
        onModeChange={handleModeChange}
        isLoading={sendMessageMutation.isPending}
      />

      {/* Chat Area */}
      <TutorChat
        agent={selectedAgent}
        messages={messages}
        onSendMessage={handleSendMessage}
        onClearConversation={handleClearConversation}
        isLoading={sendMessageMutation.isPending || conversationLoading}
        mode={mode}
      />
    </div>
  );
};
