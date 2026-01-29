/**
 * Agent Test Tab Component
 *
 * Fourth tab of the enhanced agent builder containing:
 * - Test chat interface
 * - Post-test reflection prompts
 * - Conversation analytics
 * - Design iteration suggestions
 */

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import {
  Play,
  RotateCcw,
  MessageSquare,
  Clock,
  BarChart2,
  AlertCircle,
  Lightbulb,
} from 'lucide-react';
import { agentAssignmentsApi } from '../../api/agentAssignments';
import {
  AgentTestMessage,
  StudentAgentConfig,
  ReflectionPromptTrigger,
} from '../../types';
import { TestChatInterface } from './TestChatInterface';
import { ReflectionPrompt } from './ReflectionPrompt';
import { Button } from '../common/Button';
import { AgentDesignLogger } from '../../services/agentDesignLogger';

interface AgentTestTabProps {
  assignmentId: number;
  config: StudentAgentConfig | null;
  reflectionRequirement?: 'required' | 'optional' | 'disabled' | null;
  onReflectionSubmit?: (promptId: string, response: string) => void;
  logger?: AgentDesignLogger | null;
}

export const AgentTestTab = ({
  assignmentId,
  config,
  reflectionRequirement = 'optional',
  onReflectionSubmit,
  logger,
}: AgentTestTabProps) => {
  const [conversationId, setConversationId] = useState<number | null>(null);
  const [messages, setMessages] = useState<AgentTestMessage[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [testCount, setTestCount] = useState(0);
  const [totalMessages, setTotalMessages] = useState(0);
  const [showReflection, setShowReflection] = useState(false);
  const [currentReflectionTrigger, setCurrentReflectionTrigger] =
    useState<ReflectionPromptTrigger | null>(null);
  const [hasSeenFirstTestReflection, setHasSeenFirstTestReflection] = useState(false);

  // Start conversation mutation
  const startConversationMutation = useMutation({
    mutationFn: () => {
      if (!config) throw new Error('No agent config');
      return agentAssignmentsApi.startTestConversation(assignmentId, config.id);
    },
    onSuccess: (data) => {
      setConversationId(data.conversation.id);
      setMessages([]);
      setError(null);
      setTestCount((prev) => prev + 1);
      logger?.logTestStarted(data.conversation.id);
    },
    onError: (err: any) => {
      setError(err.response?.data?.error || 'Failed to start conversation');
    },
  });

  // Send message mutation
  const sendMessageMutation = useMutation({
    mutationFn: (message: string) => {
      if (!conversationId) throw new Error('No conversation started');
      return agentAssignmentsApi.sendTestMessage(assignmentId, conversationId, message);
    },
    onSuccess: (data) => {
      const newMessages = [
        ...messages,
        {
          id: Date.now(),
          conversationId: conversationId!,
          role: 'user' as const,
          content: data.userMessage.content,
          messageIndex: data.userMessage.messageIndex,
          createdAt: new Date().toISOString(),
        },
        {
          id: data.assistantMessage.id,
          conversationId: conversationId!,
          role: 'assistant' as const,
          content: data.assistantMessage.content,
          messageIndex: data.assistantMessage.messageIndex,
          createdAt: data.assistantMessage.createdAt,
        },
      ];
      setMessages(newMessages);
      setTotalMessages((prev) => prev + 2);
      setError(null);

      logger?.logTestMessageSent(conversationId!, newMessages.length - 1);
      logger?.logTestResponseReceived(conversationId!, newMessages.length);

      // Show first test reflection after a few messages
      if (
        !hasSeenFirstTestReflection &&
        newMessages.length >= 4 &&
        reflectionRequirement !== 'disabled'
      ) {
        setHasSeenFirstTestReflection(true);
        setCurrentReflectionTrigger('first_test_completed');
        setShowReflection(true);
        logger?.logReflectionShown(
          'first_test_completed',
          'Did your agent behave as expected? What surprised you?'
        );
      }
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
    logger?.logTestReset();
  };

  const handleReflectionSubmit = (promptId: string, response: string) => {
    setShowReflection(false);
    setCurrentReflectionTrigger(null);
    logger?.logReflectionSubmitted(promptId, response);
    onReflectionSubmit?.(promptId, response);
  };

  const handleReflectionDismiss = (promptId: string) => {
    setShowReflection(false);
    setCurrentReflectionTrigger(null);
    logger?.logReflectionDismissed(promptId);
  };

  // Calculate analytics
  const avgResponseLength =
    messages.filter((m) => m.role === 'assistant').reduce((sum, m) => sum + m.content.length, 0) /
    Math.max(1, messages.filter((m) => m.role === 'assistant').length);

  if (!config) {
    return (
      <div className="text-center py-12">
        <AlertCircle className="w-12 h-12 text-amber-500 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">Create Your Agent First</h3>
        <p className="text-gray-600">
          Fill out the Identity, Behavior, and Advanced settings, then save your agent to test it.
        </p>
      </div>
    );
  }

  // If no conversation started, show start button
  if (!conversationId) {
    return (
      <div className="space-y-6">
        <div className="bg-gradient-to-br from-violet-50 to-purple-50 rounded-lg border border-violet-200 p-8 text-center">
          <div className="w-16 h-16 bg-violet-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Play className="w-8 h-8 text-violet-600" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Test Your Agent</h3>
          <p className="text-gray-600 mb-6 max-w-md mx-auto">
            Start a test conversation to see how your agent responds. You can have multiple test
            conversations to refine your agent's behavior.
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

        {/* Test History Stats */}
        {testCount > 0 && (
          <div className="bg-gray-50 rounded-lg p-4">
            <h4 className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
              <BarChart2 className="w-4 h-4" />
              Testing Stats
            </h4>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <div className="text-2xl font-bold text-violet-600">{testCount}</div>
                <div className="text-xs text-gray-500">Test conversations</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-violet-600">{totalMessages}</div>
                <div className="text-xs text-gray-500">Total messages</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-violet-600">
                  {Math.round(avgResponseLength)}
                </div>
                <div className="text-xs text-gray-500">Avg response length</div>
              </div>
            </div>
          </div>
        )}

        {/* Testing Tips */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <Lightbulb className="w-5 h-5 text-blue-500 mt-0.5" />
            <div>
              <h4 className="text-sm font-medium text-blue-800">Testing Tips</h4>
              <ul className="mt-2 text-sm text-blue-700 space-y-1">
                <li>Try different types of questions to see how your agent handles variety</li>
                <li>Test edge cases and unexpected inputs</li>
                <li>Check if the personality and tone match your expectations</li>
                <li>Make note of any responses that need improvement</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Conversation Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h3 className="text-lg font-semibold text-gray-900">Test Conversation</h3>
          <span className="text-sm text-gray-500 flex items-center gap-1">
            <MessageSquare className="w-4 h-4" />
            {messages.length} messages
          </span>
        </div>
        <Button
          variant="secondary"
          size="sm"
          onClick={handleResetConversation}
          icon={<RotateCcw className="w-4 h-4" />}
        >
          New Conversation
        </Button>
      </div>

      {/* Chat Interface */}
      <div className="h-[500px]">
        <TestChatInterface
          agentName={config.agentName}
          agentTitle={config.agentTitle}
          avatarImageUrl={config.avatarImageUrl}
          welcomeMessage={config.welcomeMessage}
          messages={messages}
          onSendMessage={handleSendMessage}
          isSending={sendMessageMutation.isPending}
          error={error}
          suggestedQuestions={config.suggestedQuestions || undefined}
        />
      </div>

      {/* Quick Stats */}
      <div className="flex items-center justify-between text-sm text-gray-500 bg-gray-50 rounded-lg p-3">
        <span>Test #{testCount} in this session</span>
        <span className="flex items-center gap-1">
          <Clock className="w-4 h-4" />
          {messages.filter((m) => m.role === 'assistant').length} agent responses
        </span>
      </div>

      {/* Reflection Prompt Modal/Inline */}
      {showReflection && currentReflectionTrigger && (
        <ReflectionPrompt
          trigger={currentReflectionTrigger}
          required={reflectionRequirement === 'required'}
          onSubmit={handleReflectionSubmit}
          onDismiss={handleReflectionDismiss}
        />
      )}
    </div>
  );
};
