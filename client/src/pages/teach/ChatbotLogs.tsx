import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useParams, useNavigate } from 'react-router-dom';
import {
  MessageCircle,
  Users,
  MessageSquare,
  Clock,
  ChevronRight,
  User,
  Bot,
  BarChart3,
} from 'lucide-react';
import { coursesApi } from '../../api/courses';
import { Card, CardBody, CardHeader } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { Loading } from '../../components/common/Loading';
import { EmptyState } from '../../components/common/EmptyState';
import { Breadcrumb } from '../../components/common/Breadcrumb';
import { buildTeachingBreadcrumb } from '../../utils/breadcrumbs';
import { ChatbotConversationMessage } from '../../types';

export const ChatbotLogs = () => {
  const { id } = useParams<{ id: string }>();
  const courseId = parseInt(id!, 10);
  const navigate = useNavigate();

  const [selectedSectionId, setSelectedSectionId] = useState<number | null>(null);
  const [selectedConversationId, setSelectedConversationId] = useState<number | null>(null);
  const [conversationsPage, setConversationsPage] = useState(1);

  // Fetch course info
  const { data: course, isLoading: courseLoading } = useQuery({
    queryKey: ['course', courseId],
    queryFn: () => coursesApi.getCourseById(courseId),
    enabled: !!courseId,
  });

  // Fetch chatbot analytics
  const { data: analytics, isLoading: analyticsLoading } = useQuery({
    queryKey: ['chatbotAnalytics', courseId],
    queryFn: () => coursesApi.getChatbotAnalytics(courseId),
    enabled: !!courseId,
  });

  // Fetch chatbot sections
  const { data: sections, isLoading: sectionsLoading } = useQuery({
    queryKey: ['chatbotSections', courseId],
    queryFn: () => coursesApi.getChatbotSections(courseId),
    enabled: !!courseId,
  });

  // Fetch conversations for selected section
  const { data: conversationsData, isLoading: conversationsLoading } = useQuery({
    queryKey: ['chatbotConversations', selectedSectionId, conversationsPage],
    queryFn: () => coursesApi.getChatbotConversations(selectedSectionId!, conversationsPage),
    enabled: !!selectedSectionId,
  });

  // Fetch messages for selected conversation
  const { data: conversationDetail, isLoading: messagesLoading } = useQuery({
    queryKey: ['chatbotMessages', selectedConversationId],
    queryFn: () => coursesApi.getChatbotConversationMessages(selectedConversationId!),
    enabled: !!selectedConversationId,
  });

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatRelativeTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return formatDate(dateStr);
  };

  if (courseLoading || sectionsLoading || analyticsLoading) {
    return <Loading fullScreen text="Loading chatbot logs..." />;
  }

  if (!course) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-8 text-center">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Course Not Found</h1>
        <Button onClick={() => navigate('/teach')}>Back to Dashboard</Button>
      </div>
    );
  }

  const breadcrumbItems = buildTeachingBreadcrumb(id, course?.title || 'Course', 'Chatbot Logs');

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Breadcrumb navigation */}
      <div className="mb-6">
        <Breadcrumb items={breadcrumbItems} />
      </div>

      {/* Course Header */}
      <Card className="mb-6">
        <CardBody className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{course.title}</h1>
            <p className="text-gray-600">Chatbot Conversations & Analytics</p>
          </div>
          <div className="flex items-center gap-2 text-amber-600">
            <MessageCircle className="w-6 h-6" />
            <span className="text-lg font-semibold">AI Chatbot Logs</span>
          </div>
        </CardBody>
      </Card>

      {/* Analytics Overview */}
      {analytics && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardBody className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-lg bg-blue-100 flex items-center justify-center">
                <MessageSquare className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{analytics.totalConversations}</p>
                <p className="text-sm text-gray-500">Conversations</p>
              </div>
            </CardBody>
          </Card>
          <Card>
            <CardBody className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-lg bg-green-100 flex items-center justify-center">
                <MessageCircle className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{analytics.totalMessages}</p>
                <p className="text-sm text-gray-500">Total Messages</p>
              </div>
            </CardBody>
          </Card>
          <Card>
            <CardBody className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-lg bg-purple-100 flex items-center justify-center">
                <Users className="w-6 h-6 text-purple-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{analytics.uniqueStudents}</p>
                <p className="text-sm text-gray-500">Students</p>
              </div>
            </CardBody>
          </Card>
          <Card>
            <CardBody className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-lg bg-amber-100 flex items-center justify-center">
                <BarChart3 className="w-6 h-6 text-amber-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{analytics.avgMessagesPerConversation}</p>
                <p className="text-sm text-gray-500">Avg Msgs/Conv</p>
              </div>
            </CardBody>
          </Card>
        </div>
      )}

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Chatbot Sections List */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <h2 className="text-lg font-semibold text-gray-900">Chatbot Sections</h2>
          </CardHeader>
          <CardBody className="p-0">
            {sections && sections.length > 0 ? (
              <div className="divide-y">
                {sections.map(section => (
                  <button
                    key={section.id}
                    onClick={() => {
                      setSelectedSectionId(section.id);
                      setSelectedConversationId(null);
                      setConversationsPage(1);
                    }}
                    className={`w-full px-4 py-3 text-left hover:bg-gray-50 transition-colors ${
                      selectedSectionId === section.id ? 'bg-primary-50 border-r-2 border-primary-500' : ''
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900 truncate">{section.title}</p>
                        <p className="text-sm text-gray-500 truncate">
                          {section.moduleTitle} &middot; {section.lectureTitle}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 ml-2">
                        <span className="text-xs bg-gray-100 px-2 py-1 rounded-full">
                          {section.totalConversations} chats
                        </span>
                        <ChevronRight className="w-4 h-4 text-gray-400" />
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <div className="p-6">
                <EmptyState
                  icon={MessageCircle}
                  title="No chatbot sections"
                  description="Add chatbot sections to your lessons to see conversations here"
                />
              </div>
            )}
          </CardBody>
        </Card>

        {/* Conversations List */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <h2 className="text-lg font-semibold text-gray-900">
              {selectedSectionId ? 'Student Conversations' : 'Select a Section'}
            </h2>
          </CardHeader>
          <CardBody className="p-0">
            {selectedSectionId ? (
              conversationsLoading ? (
                <div className="p-6">
                  <Loading text="Loading conversations..." />
                </div>
              ) : conversationsData?.conversations && conversationsData.conversations.length > 0 ? (
                <>
                  <div className="divide-y max-h-[500px] overflow-y-auto">
                    {conversationsData.conversations.map(conv => (
                      <button
                        key={conv.id}
                        onClick={() => setSelectedConversationId(conv.id)}
                        className={`w-full px-4 py-3 text-left hover:bg-gray-50 transition-colors ${
                          selectedConversationId === conv.id ? 'bg-primary-50 border-r-2 border-primary-500' : ''
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0">
                            <User className="w-4 h-4 text-gray-500" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-gray-900 truncate">{conv.user.fullname}</p>
                            <p className="text-xs text-gray-500">
                              {conv.messageCount} messages &middot; {formatRelativeTime(conv.updatedAt)}
                            </p>
                          </div>
                          <ChevronRight className="w-4 h-4 text-gray-400" />
                        </div>
                      </button>
                    ))}
                  </div>
                  {conversationsData.pagination.totalPages > 1 && (
                    <div className="px-4 py-3 border-t flex items-center justify-between">
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={conversationsPage === 1}
                        onClick={() => setConversationsPage(p => p - 1)}
                      >
                        Previous
                      </Button>
                      <span className="text-sm text-gray-500">
                        Page {conversationsPage} of {conversationsData.pagination.totalPages}
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={conversationsPage === conversationsData.pagination.totalPages}
                        onClick={() => setConversationsPage(p => p + 1)}
                      >
                        Next
                      </Button>
                    </div>
                  )}
                </>
              ) : (
                <div className="p-6">
                  <EmptyState
                    icon={MessageSquare}
                    title="No conversations yet"
                    description="Students haven't started any conversations with this chatbot"
                  />
                </div>
              )
            ) : (
              <div className="p-6 text-center text-gray-500">
                <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p>Select a chatbot section to view conversations</p>
              </div>
            )}
          </CardBody>
        </Card>

        {/* Conversation Messages */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <h2 className="text-lg font-semibold text-gray-900">
              {conversationDetail?.conversation ? (
                <span>
                  Conversation with {conversationDetail.conversation.user.fullname}
                </span>
              ) : (
                'Select a Conversation'
              )}
            </h2>
            {conversationDetail?.conversation && (
              <p className="text-sm text-gray-500 mt-1">
                Started {formatDate(conversationDetail.conversation.createdAt)}
              </p>
            )}
          </CardHeader>
          <CardBody className="p-0">
            {selectedConversationId ? (
              messagesLoading ? (
                <div className="p-6">
                  <Loading text="Loading messages..." />
                </div>
              ) : conversationDetail?.messages && conversationDetail.messages.length > 0 ? (
                <div className="max-h-[500px] overflow-y-auto p-4 space-y-4">
                  {conversationDetail.messages.map((msg: ChatbotConversationMessage) => (
                    <div
                      key={msg.id}
                      className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}
                    >
                      <div
                        className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                          msg.role === 'user' ? 'bg-blue-100' : 'bg-amber-100'
                        }`}
                      >
                        {msg.role === 'user' ? (
                          <User className="w-4 h-4 text-blue-600" />
                        ) : (
                          <Bot className="w-4 h-4 text-amber-600" />
                        )}
                      </div>
                      <div
                        className={`flex-1 ${msg.role === 'user' ? 'text-right' : ''}`}
                      >
                        <div
                          className={`inline-block px-4 py-2 rounded-lg max-w-[85%] ${
                            msg.role === 'user'
                              ? 'bg-blue-500 text-white'
                              : 'bg-gray-100 text-gray-900'
                          }`}
                        >
                          <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                        </div>
                        <p className="text-xs text-gray-400 mt-1">
                          {formatRelativeTime(msg.createdAt)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-6">
                  <EmptyState
                    icon={MessageCircle}
                    title="No messages"
                    description="This conversation has no messages"
                  />
                </div>
              )
            ) : (
              <div className="p-6 text-center text-gray-500">
                <MessageCircle className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p>Select a conversation to view messages</p>
              </div>
            )}
          </CardBody>
        </Card>
      </div>

      {/* Recent Activity */}
      {analytics?.recentActivity && analytics.recentActivity.length > 0 && (
        <Card className="mt-6">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-gray-500" />
              <h2 className="text-lg font-semibold text-gray-900">Recent Activity</h2>
            </div>
          </CardHeader>
          <CardBody>
            <div className="space-y-3">
              {analytics.recentActivity.map(activity => (
                <div
                  key={activity.id}
                  className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg"
                >
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                      activity.role === 'user' ? 'bg-blue-100' : 'bg-amber-100'
                    }`}
                  >
                    {activity.role === 'user' ? (
                      <User className="w-4 h-4 text-blue-600" />
                    ) : (
                      <Bot className="w-4 h-4 text-amber-600" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-gray-900">{activity.userName}</span>
                      <span className="text-gray-400">&middot;</span>
                      <span className="text-sm text-gray-500">{activity.sectionTitle}</span>
                      <span className="text-gray-400">&middot;</span>
                      <span className="text-xs text-gray-400">{formatRelativeTime(activity.createdAt)}</span>
                    </div>
                    <p className="text-sm text-gray-600">{activity.content}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardBody>
        </Card>
      )}
    </div>
  );
};
