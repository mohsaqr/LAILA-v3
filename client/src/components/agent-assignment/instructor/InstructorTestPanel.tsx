import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Play, RotateCcw } from 'lucide-react';
import { agentAssignmentsApi } from '../../../api/agentAssignments';
import { AgentTestMessage, StudentAgentConfig } from '../../../types';
import { TestChatInterface } from '../TestChatInterface';
import { Button } from '../../common/Button';

interface InstructorTestPanelProps {
  assignmentId: number;
  submissionId: number;
  config: StudentAgentConfig;
}

export const InstructorTestPanel = ({
  assignmentId,
  submissionId,
  config,
}: InstructorTestPanelProps) => {
  const [conversationId, setConversationId] = useState<number | null>(null);
  const [messages, setMessages] = useState<AgentTestMessage[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Start conversation mutation
  const startConversationMutation = useMutation({
    mutationFn: () =>
      agentAssignmentsApi.startInstructorTest(assignmentId, submissionId),
    onSuccess: (data) => {
      setConversationId(data.conversation.id);
      setMessages([]);
      setError(null);
    },
    onError: (err: any) => {
      setError(err.response?.data?.error || 'Failed to start conversation');
    },
  });

  // Send message mutation
  const sendMessageMutation = useMutation({
    mutationFn: (message: string) => {
      if (!conversationId) throw new Error('No conversation started');
      return agentAssignmentsApi.sendMessage(conversationId, message);
    },
    onSuccess: (data) => {
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now(),
          conversationId: conversationId!,
          role: 'user',
          content: data.userMessage.content,
          messageIndex: data.userMessage.messageIndex,
          createdAt: new Date().toISOString(),
        },
        {
          id: data.assistantMessage.id,
          conversationId: conversationId!,
          role: 'assistant',
          content: data.assistantMessage.content,
          messageIndex: data.assistantMessage.messageIndex,
          createdAt: data.assistantMessage.createdAt,
        },
      ]);
      setError(null);
    },
    onError: (err: any) => {
      setError(err.response?.data?.error || 'Failed to send message');
    },
  });

  const handleStartConversation = () => {
    startConversationMutation.mutate();
  };

  const handleSendMessage = (message: string) => {
    sendMessageMutation.mutate(message);
  };

  const handleResetConversation = () => {
    setConversationId(null);
    setMessages([]);
    setError(null);
  };

  if (!conversationId) {
    return (
      <div className="bg-gradient-to-br from-violet-50 to-purple-50 rounded-lg border border-violet-200 p-8 text-center">
        <div className="w-16 h-16 bg-violet-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <Play className="w-8 h-8 text-violet-600" />
        </div>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Test This Agent</h3>
        <p className="text-gray-600 mb-6 max-w-md mx-auto">
          Start a test conversation to evaluate the student's agent. This will be logged
          separately from the student's own tests.
        </p>
        <Button
          onClick={handleStartConversation}
          loading={startConversationMutation.isPending}
          icon={<Play className="w-4 h-4" />}
        >
          Start Test Conversation
        </Button>
        {error && <p className="text-sm text-red-500 mt-4">{error}</p>}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">Instructor Test</h3>
        <Button
          variant="secondary"
          size="sm"
          onClick={handleResetConversation}
          icon={<RotateCcw className="w-4 h-4" />}
        >
          New Conversation
        </Button>
      </div>

      <div className="h-[400px]">
        <TestChatInterface
          agentName={config.agentName}
          avatarImageUrl={config.avatarImageUrl}
          welcomeMessage={config.welcomeMessage}
          messages={messages}
          onSendMessage={handleSendMessage}
          isSending={sendMessageMutation.isPending}
          error={error}
        />
      </div>
    </div>
  );
};
