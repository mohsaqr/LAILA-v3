import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  User,
  Calendar,
  Award,
  AlertCircle,
  History,
  MessageSquare,
  PlayCircle,
  FileEdit,
  Activity,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { agentAssignmentsApi } from '../../api/agentAssignments';
import { assignmentsApi } from '../../api/assignments';
import { AgentConfigViewer } from '../../components/agent-assignment/instructor/AgentConfigViewer';
import { ConfigHistoryTimeline } from '../../components/agent-assignment/instructor/ConfigHistoryTimeline';
import { TestConversationViewer } from '../../components/agent-assignment/instructor/TestConversationViewer';
import { InstructorTestPanel } from '../../components/agent-assignment/instructor/InstructorTestPanel';
import { GradeAgentForm } from '../../components/agent-assignment/instructor/GradeAgentForm';
import { DesignProcessTab } from '../../components/agent-assignment/instructor/DesignProcessTab';
import { Card, CardBody } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { Loading } from '../../components/common/Loading';
import { StatusBadge } from '../../components/common/StatusBadge';

type TabType = 'config' | 'design' | 'history' | 'conversations' | 'test' | 'grade';

export const AgentSubmissionReview = () => {
  const { id, assignmentId, submissionId } = useParams<{
    id: string;
    assignmentId: string;
    submissionId: string;
  }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<TabType>('config');

  const courseId = parseInt(id!, 10);
  const assId = parseInt(assignmentId!, 10);
  const subId = parseInt(submissionId!, 10);

  // Fetch assignment
  const { data: assignment, isLoading: assignmentLoading } = useQuery({
    queryKey: ['assignment', assId],
    queryFn: () => assignmentsApi.getAssignmentById(assId),
  });

  // Fetch submission detail
  const { data: submission, isLoading: submissionLoading } = useQuery({
    queryKey: ['agentSubmission', assId, subId],
    queryFn: () => agentAssignmentsApi.getAgentSubmissionDetail(assId, subId),
  });

  // Fetch config history
  const { data: configHistory = [] } = useQuery({
    queryKey: ['agentConfigHistory', assId, subId],
    queryFn: () => agentAssignmentsApi.getConfigHistory(assId, subId),
    enabled: activeTab === 'history',
  });

  // Fetch test conversations
  const { data: testConversations = [] } = useQuery({
    queryKey: ['agentTestConversations', assId, subId],
    queryFn: () => agentAssignmentsApi.getSubmissionTestConversations(assId, subId),
    enabled: activeTab === 'conversations',
  });

  // Grade mutation
  const gradeMutation = useMutation({
    mutationFn: ({ grade, feedback }: { grade: number; feedback: string }) =>
      agentAssignmentsApi.gradeAgentSubmission(subId, { grade, feedback }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agentSubmission', assId, subId] });
      queryClient.invalidateQueries({ queryKey: ['agentSubmissions', assId] });
      toast.success('Submission graded successfully!');
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error || 'Failed to grade submission');
    },
  });

  const handleGrade = (grade: number, feedback: string) => {
    gradeMutation.mutate({ grade, feedback });
  };

  if (assignmentLoading || submissionLoading) {
    return <Loading fullScreen text="Loading submission..." />;
  }

  if (!assignment || !submission || !submission.agentConfig) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8 text-center">
        <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Submission Not Found</h1>
        <Button
          onClick={() =>
            navigate(`/teach/courses/${courseId}/assignments/${assId}/submissions`)
          }
        >
          Back to Submissions
        </Button>
      </div>
    );
  }

  const config = submission.agentConfig;
  const student = submission.user;
  const isGraded = submission.status === 'graded';

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const tabs: { id: TabType; label: string; icon: React.ReactNode }[] = [
    { id: 'config', label: 'Configuration', icon: <FileEdit className="w-4 h-4" /> },
    { id: 'design', label: 'Design Process', icon: <Activity className="w-4 h-4" /> },
    { id: 'history', label: 'Change History', icon: <History className="w-4 h-4" /> },
    {
      id: 'conversations',
      label: 'Test Conversations',
      icon: <MessageSquare className="w-4 h-4" />,
    },
    { id: 'test', label: 'Test Agent', icon: <PlayCircle className="w-4 h-4" /> },
    { id: 'grade', label: 'Grade', icon: <Award className="w-4 h-4" /> },
  ];

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-6">
        <Button
          variant="ghost"
          size="sm"
          onClick={() =>
            navigate(`/teach/courses/${courseId}/assignments/${assId}/submissions`)
          }
          icon={<ArrowLeft className="w-4 h-4" />}
        >
          Back to Submissions
        </Button>
      </div>

      {/* Submission Info */}
      <Card className="mb-6">
        <CardBody>
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
            <div>
              <h1 className="text-xl font-bold text-gray-900 mb-1">
                {assignment.title}
              </h1>
              <div className="flex items-center gap-3 mb-4">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center">
                    <User className="w-4 h-4 text-gray-500" />
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">
                      {student?.fullname || 'Unknown Student'}
                    </p>
                    <p className="text-sm text-gray-500">{student?.email}</p>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-4 text-sm">
                <div className="flex items-center gap-1.5 text-gray-500">
                  <Award className="w-4 h-4" />
                  <span>{assignment.points} points</span>
                </div>
                <div className="flex items-center gap-1.5 text-gray-500">
                  <Calendar className="w-4 h-4" />
                  <span>Submitted {formatDate(submission.submittedAt)}</span>
                </div>
                <StatusBadge status={isGraded ? 'graded' : 'submitted'} />
              </div>
            </div>

            {/* Grade Display */}
            {isGraded && (
              <div className="text-right">
                <div className="text-3xl font-bold text-gray-900">
                  {submission.grade}/{assignment.points}
                </div>
                <p className="text-sm text-gray-500">Grade</p>
              </div>
            )}
          </div>

          {/* Agent Name Badge */}
          <div className="mt-4 p-3 bg-violet-50 border border-violet-200 rounded-lg">
            <p className="text-sm text-violet-800">
              <span className="font-medium">Agent Name:</span> {config.agentName}
              <span className="text-violet-600 ml-2">• Version {config.version}</span>
            </p>
          </div>
        </CardBody>
      </Card>

      {/* Tabs */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="-mb-px flex gap-6 overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2 whitespace-nowrap ${
                activeTab === tab.id
                  ? 'border-violet-500 text-violet-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 'config' && <AgentConfigViewer config={config} />}

      {activeTab === 'design' && <DesignProcessTab agentConfigId={config.id} />}

      {activeTab === 'history' && <ConfigHistoryTimeline logs={configHistory} />}

      {activeTab === 'conversations' && (
        <TestConversationViewer conversations={testConversations} />
      )}

      {activeTab === 'test' && (
        <InstructorTestPanel
          assignmentId={assId}
          submissionId={subId}
          config={config}
        />
      )}

      {activeTab === 'grade' && (
        <GradeAgentForm
          studentName={student?.fullname || 'Unknown Student'}
          maxPoints={assignment.points}
          currentGrade={submission.grade}
          currentFeedback={submission.feedback}
          onGrade={handleGrade}
          isGrading={gradeMutation.isPending}
        />
      )}
    </div>
  );
};
