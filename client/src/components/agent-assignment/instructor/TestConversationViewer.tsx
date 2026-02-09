import { useState } from 'react';
import { MessageCircle, User, Bot, ChevronDown, ChevronUp, Clock } from 'lucide-react';
import { AgentTestConversation } from '../../../types';
import { Card, CardBody, CardHeader } from '../../common/Card';

interface TestConversationViewerProps {
  conversations: AgentTestConversation[];
}

export const TestConversationViewer = ({ conversations }: TestConversationViewerProps) => {
  const [expandedId, setExpandedId] = useState<number | null>(
    conversations.length > 0 ? conversations[0].id : null
  );

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (conversations.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <MessageCircle className="w-8 h-8 mx-auto mb-2 opacity-50" />
        <p>No test conversations yet</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {conversations.map((conversation) => {
        const isExpanded = expandedId === conversation.id;
        const messageCount = conversation._count?.messages || conversation.messages?.length || 0;

        return (
          <Card key={conversation.id}>
            <CardHeader className="cursor-pointer" onClick={() => setExpandedId(isExpanded ? null : conversation.id)}>
              <div className="flex items-center justify-between w-full">
                <div className="flex items-center gap-3">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center ${
                      conversation.testerRole === 'instructor'
                        ? 'bg-violet-100'
                        : 'bg-blue-100'
                    }`}
                  >
                    <User
                      className={`w-4 h-4 ${
                        conversation.testerRole === 'instructor'
                          ? 'text-violet-600'
                          : 'text-blue-600'
                      }`}
                    />
                  </div>
                  <div>
                    <h4 className="font-medium text-gray-900">
                      {conversation.testerFullname || 'Unknown tester'}
                    </h4>
                    <div className="flex items-center gap-2 text-sm text-gray-500">
                      <span
                        className={`px-2 py-0.5 rounded text-xs ${
                          conversation.testerRole === 'instructor'
                            ? 'bg-violet-100 text-violet-700'
                            : 'bg-blue-100 text-blue-700'
                        }`}
                      >
                        {conversation.testerRole}
                      </span>
                      <span>•</span>
                      <span>{messageCount} messages</span>
                      <span>•</span>
                      <span>v{conversation.configVersion}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="text-sm text-gray-500 flex items-center gap-1">
                    <Clock className="w-4 h-4" />
                    {formatDate(conversation.startedAt)}
                  </div>
                  {isExpanded ? (
                    <ChevronUp className="w-5 h-5 text-gray-400" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-gray-400" />
                  )}
                </div>
              </div>
            </CardHeader>

            {isExpanded && (
              <CardBody className="pt-0">
                <div className="border-t border-gray-100 pt-4">
                  <div className="space-y-3 max-h-96 overflow-y-auto">
                    {conversation.messages && conversation.messages.length > 0 ? (
                      conversation.messages.map((message) => (
                        <div
                          key={message.id}
                          className={`flex ${
                            message.role === 'user' ? 'justify-end' : 'justify-start'
                          }`}
                        >
                          <div
                            className={`max-w-[80%] rounded-lg px-4 py-2 ${
                              message.role === 'user'
                                ? 'bg-blue-100 text-blue-900'
                                : 'bg-gray-100 text-gray-900'
                            }`}
                          >
                            <div className="flex items-center gap-2 mb-1">
                              {message.role === 'user' ? (
                                <User className="w-3 h-3" />
                              ) : (
                                <Bot className="w-3 h-3" />
                              )}
                              <span className="text-xs font-medium capitalize">
                                {message.role}
                              </span>
                              {message.aiModel && (
                                <span className="text-xs text-gray-500">
                                  ({message.aiModel})
                                </span>
                              )}
                            </div>
                            <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                            {message.responseTimeMs && (
                              <p className="text-xs text-gray-500 mt-1">
                                Response time: {(message.responseTimeMs / 1000).toFixed(2)}s
                              </p>
                            )}
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="text-gray-500 text-sm text-center py-4">
                        No messages in this conversation
                      </p>
                    )}
                  </div>
                </div>
              </CardBody>
            )}
          </Card>
        );
      })}
    </div>
  );
};
