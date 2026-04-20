import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  User,
  Calendar,
  Award,
  AlertCircle,
  History,
  MessageSquare,
  PlayCircle,
  FileEdit,
  Activity,
  Database,
  Download,
  FileSpreadsheet,
} from 'lucide-react';
import { Breadcrumb } from '../../components/common/Breadcrumb';
import toast from 'react-hot-toast';
import { agentAssignmentsApi } from '../../api/agentAssignments';
import { assignmentsApi } from '../../api/assignments';
import { resolveFileUrl } from '../../api/client';
import { AgentConfigViewer } from '../../components/agent-assignment/instructor/AgentConfigViewer';
import { ConfigHistoryTimeline } from '../../components/agent-assignment/instructor/ConfigHistoryTimeline';
import { TestConversationViewer } from '../../components/agent-assignment/instructor/TestConversationViewer';
import { GradeAgentForm } from '../../components/agent-assignment/instructor/GradeAgentForm';
import { DesignProcessTab } from '../../components/agent-assignment/instructor/DesignProcessTab';
import { Card, CardBody } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { Loading } from '../../components/common/Loading';
import { StatusBadge } from '../../components/common/StatusBadge';
import activityLogger from '../../services/activityLogger';

type TabType = 'config' | 'design' | 'history' | 'conversations' | 'test' | 'datasets' | 'grade';

export const AgentSubmissionReview = () => {
  const { t } = useTranslation(['teaching', 'common']);
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

  useEffect(() => {
    if (subId && courseId) {
      activityLogger.logAgentSubmissionViewed(subId, courseId);
    }
  }, [subId, courseId]);

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

  const { data: datasets = [] } = useQuery({
    queryKey: ['agentSubmissionDatasets', assId, subId],
    queryFn: () => agentAssignmentsApi.getSubmissionDatasets(assId, subId),
    enabled: activeTab === 'datasets',
  });

  // Grade mutation
  const gradeMutation = useMutation({
    mutationFn: ({ grade, feedback }: { grade: number; feedback: string }) =>
      agentAssignmentsApi.gradeAgentSubmission(subId, { grade, feedback }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agentSubmission', assId, subId] });
      queryClient.invalidateQueries({ queryKey: ['agentSubmissions', assId] });
      toast.success(t('submission_graded_successfully'));
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error || t('failed_to_grade'));
    },
  });

  const handleGrade = (grade: number, feedback: string) => {
    gradeMutation.mutate({ grade, feedback });
  };

  if (assignmentLoading || submissionLoading) {
    return <Loading fullScreen text={t('loading_submission')} />;
  }

  if (!assignment || !submission || !submission.agentConfig) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8 text-center">
        <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
        <h1 className="text-2xl font-bold text-gray-900 mb-2">{t('submission_not_found')}</h1>
        <Button
          onClick={() =>
            navigate(`/teach/courses/${courseId}/assignments/${assId}/submissions`)
          }
        >
          {t('back_to_submissions')}
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
    { id: 'config', label: t('configuration'), icon: <FileEdit className="w-4 h-4" /> },
    { id: 'design', label: t('design_process'), icon: <Activity className="w-4 h-4" /> },
    { id: 'history', label: t('change_history'), icon: <History className="w-4 h-4" /> },
    {
      id: 'conversations',
      label: t('test_conversations'),
      icon: <MessageSquare className="w-4 h-4" />,
    },
    { id: 'test', label: t('test_agent'), icon: <PlayCircle className="w-4 h-4" /> },
    { id: 'datasets', label: t('datasets'), icon: <Database className="w-4 h-4" /> },
    { id: 'grade', label: t('grade_tab'), icon: <Award className="w-4 h-4" /> },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 md:py-8">
      {/* Breadcrumb */}
      <div className="mb-6">
        <Breadcrumb
          items={[
            { label: t('common:teaching', { defaultValue: 'Teaching' }), href: '/teach' },
            {
              label: assignment.course?.title || `Course #${courseId}`,
              href: `/teach/courses/${courseId}`,
            },
            { label: t('assignments'), href: `/teach/courses/${courseId}/assignments` },
            {
              label: assignment.title,
              href: `/teach/courses/${courseId}/assignments/${assId}`,
            },
            {
              label: t('submissions', { defaultValue: 'Submissions' }),
              href: `/teach/courses/${courseId}/assignments/${assId}/submissions`,
            },
            { label: student?.fullname || t('unknown_student') },
          ]}
        />
      </div>

      {/* Submission Info */}
      <Card className="mb-6">
        <CardBody>
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
            <div>
              <h1 className="text-lg sm:text-xl font-bold text-gray-900 mb-1">
                {assignment.title}
              </h1>
              <div className="flex items-center gap-3 mb-4">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center">
                    <User className="w-4 h-4 text-gray-500" />
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">
                      {student?.fullname || t('unknown_student')}
                    </p>
                    <p className="text-sm text-gray-500">{student?.email}</p>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-4 text-sm">
                <div className="flex items-center gap-1.5 text-gray-500">
                  <Award className="w-4 h-4" />
                  <span>{t('x_points', { count: assignment.points })}</span>
                </div>
                <div className="flex items-center gap-1.5 text-gray-500">
                  <Calendar className="w-4 h-4" />
                  <span>{t('submitted_at', { date: formatDate(submission.submittedAt) })}</span>
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
                <p className="text-sm text-gray-500">{t('grade')}</p>
              </div>
            )}
          </div>

          {/* Agent Name Badge */}
          <div className="mt-4 p-3 bg-violet-50 border border-violet-200 rounded-lg">
            <p className="text-sm text-violet-800">
              <span className="font-medium">{t('agent_name')}:</span> {config.agentName}
              <span className="text-violet-600 ml-2">• {t('version')} {config.version}</span>
            </p>
          </div>
        </CardBody>
      </Card>

      {/* Tabs */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="-mb-px flex gap-4 sm:gap-6 overflow-x-auto">
          {tabs.map((tab) => {
            // "Test Agent" is not a local tab — clicking it navigates to a
            // dedicated full-screen instructor chat page so the testing
            // experience mirrors the student's own test chat.
            const isTestTab = tab.id === 'test';
            return (
              <button
                key={tab.id}
                onClick={() => {
                  if (isTestTab) {
                    navigate(
                      `/teach/courses/${courseId}/assignments/${assId}/agent-submissions/${subId}/test`
                    );
                    return;
                  }
                  setActiveTab(tab.id);
                }}
                className={`py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2 whitespace-nowrap ${
                  activeTab === tab.id && !isTestTab
                    ? 'border-violet-500 text-violet-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                {tab.icon}
                {tab.label}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 'config' && <AgentConfigViewer config={config} />}

      {activeTab === 'design' && <DesignProcessTab agentConfigId={config.id} />}

      {activeTab === 'history' && <ConfigHistoryTimeline logs={configHistory} />}

      {activeTab === 'conversations' && (
        <TestConversationViewer conversations={testConversations} />
      )}

      {activeTab === 'datasets' && (
        <Card>
          <CardBody>
            {datasets.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <Database className="w-10 h-10 mx-auto mb-3 opacity-40" />
                <p className="text-sm">{t('no_datasets_generated')}</p>
              </div>
            ) : (
              <div className="space-y-4">
                <h3 className="text-base sm:text-lg font-semibold">{t('generated_datasets')}</h3>
                {datasets.map((ds) => (
                  <div key={ds.id} className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <FileSpreadsheet className="w-4 h-4 text-violet-500" />
                        <span className="font-medium text-sm">{ds.name}</span>
                      </div>
                      <a
                        href={resolveFileUrl(ds.fileUrl)}
                        download={ds.name}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-violet-600 hover:text-violet-800 bg-violet-50 hover:bg-violet-100 rounded-lg transition-colors"
                      >
                        <Download className="w-3.5 h-3.5" />
                        {t('download')}
                      </a>
                    </div>
                    <div className="text-xs text-gray-500 space-y-1">
                      {ds.rowCount && <span>{ds.rowCount} rows</span>}
                      {ds.aiModel && <span> · {ds.aiModel}</span>}
                      <span> · {new Date(ds.createdAt).toLocaleDateString()}</span>
                    </div>
                    {ds.description && (
                      <div className="mt-3 p-3 bg-white dark:bg-gray-700 rounded border border-gray-200 dark:border-gray-600">
                        <p className="text-xs font-medium text-gray-500 mb-1">{t('used_prompt')}</p>
                        <p className="text-sm text-gray-700 dark:text-gray-300">{ds.description}</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardBody>
        </Card>
      )}

      {activeTab === 'grade' && (
        <GradeAgentForm
          studentName={student?.fullname || t('unknown_student')}
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
