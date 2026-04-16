import { useNavigate, useParams } from 'react-router-dom';
import { MessageCircle, User, Clock, ChevronRight } from 'lucide-react';
import { AgentTestConversation } from '../../../types';
import { Card } from '../../common/Card';

interface TestConversationViewerProps {
  conversations: AgentTestConversation[];
}

/**
 * Instructor/admin list of a student's test conversations. Each row is a
 * navigation target — clicking opens a full-screen ConversationReplay page
 * that mirrors the live student test chat in read-only mode, instead of
 * the previous inline accordion preview.
 */
export const TestConversationViewer = ({ conversations }: TestConversationViewerProps) => {
  const navigate = useNavigate();
  const { id, assignmentId, submissionId } = useParams<{
    id: string;
    assignmentId: string;
    submissionId: string;
  }>();

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

  if (conversations.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <MessageCircle className="w-8 h-8 mx-auto mb-2 opacity-50" />
        <p>No test conversations yet</p>
      </div>
    );
  }

  const openConversation = (conversationId: number) => {
    navigate(
      `/teach/courses/${id}/assignments/${assignmentId}/agent-submissions/${submissionId}/conversations/${conversationId}`
    );
  };

  return (
    <div className="space-y-3">
      {conversations.map((conversation) => {
        const messageCount = conversation._count?.messages || conversation.messages?.length || 0;
        const isInstructor = conversation.testerRole === 'instructor';

        return (
          <Card
            key={conversation.id}
            className="cursor-pointer transition-shadow hover:shadow-md"
          >
            <button
              type="button"
              onClick={() => openConversation(conversation.id)}
              className="w-full text-left p-4 flex items-center justify-between gap-4"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                    isInstructor ? 'bg-violet-100' : 'bg-blue-100'
                  }`}
                >
                  <User
                    className={`w-5 h-5 ${
                      isInstructor ? 'text-violet-600' : 'text-blue-600'
                    }`}
                  />
                </div>
                <div className="min-w-0">
                  <h4 className="font-medium text-gray-900 truncate">
                    {conversation.testerFullname || 'Unknown tester'}
                  </h4>
                  <div className="flex items-center gap-2 text-sm text-gray-500 flex-wrap">
                    <span
                      className={`px-2 py-0.5 rounded text-xs ${
                        isInstructor
                          ? 'bg-violet-100 text-violet-700'
                          : 'bg-blue-100 text-blue-700'
                      }`}
                    >
                      {conversation.testerRole}
                    </span>
                    <span>•</span>
                    <span>
                      {messageCount} message{messageCount === 1 ? '' : 's'}
                    </span>
                    <span>•</span>
                    <span>v{conversation.configVersion}</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3 flex-shrink-0">
                <div className="text-sm text-gray-500 hidden sm:flex items-center gap-1">
                  <Clock className="w-4 h-4" />
                  {formatDate(conversation.startedAt)}
                </div>
                <ChevronRight className="w-5 h-5 text-gray-400" />
              </div>
            </button>
          </Card>
        );
      })}
    </div>
  );
};
