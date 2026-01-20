import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Calendar,
  Award,
  CheckCircle,
  Clock,
  AlertCircle,
  Send,
  FileEdit,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { agentAssignmentsApi } from '../../api/agentAssignments';
import { AgentBuilderForm } from '../../components/agent-assignment/AgentBuilderForm';
import { AgentTestPanel } from '../../components/agent-assignment/AgentTestPanel';
import { Card, CardBody } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { Loading } from '../../components/common/Loading';
import { StatusBadge } from '../../components/common/StatusBadge';
import { AgentConfigFormData } from '../../types';

export const StudentAgentBuilder = () => {
  const { courseId, assignmentId } = useParams<{
    courseId: string;
    assignmentId: string;
  }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'build' | 'test'>('build');

  const assId = parseInt(assignmentId!, 10);

  // Fetch agent config
  const { data, isLoading, error } = useQuery({
    queryKey: ['myAgentConfig', assId],
    queryFn: () => agentAssignmentsApi.getMyAgentConfig(assId),
  });

  // Create mutation
  const createMutation = useMutation({
    mutationFn: (formData: AgentConfigFormData) =>
      agentAssignmentsApi.createAgentConfig(assId, formData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['myAgentConfig', assId] });
      toast.success('Agent created successfully!');
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error || 'Failed to create agent');
    },
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: (formData: Partial<AgentConfigFormData>) =>
      agentAssignmentsApi.updateAgentConfig(assId, formData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['myAgentConfig', assId] });
      toast.success('Agent saved!');
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error || 'Failed to save agent');
    },
  });

  // Submit mutation
  const submitMutation = useMutation({
    mutationFn: () => agentAssignmentsApi.submitAgentConfig(assId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['myAgentConfig', assId] });
      toast.success('Agent submitted for grading!');
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error || 'Failed to submit agent');
    },
  });

  // Unsubmit mutation
  const unsubmitMutation = useMutation({
    mutationFn: () => agentAssignmentsApi.unsubmitAgentConfig(assId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['myAgentConfig', assId] });
      toast.success('Agent returned to draft');
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error || 'Failed to unsubmit');
    },
  });

  const handleSave = (formData: AgentConfigFormData) => {
    if (data?.config) {
      updateMutation.mutate(formData);
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleSubmit = () => {
    if (confirm('Are you sure you want to submit your agent for grading? You can unsubmit later if needed.')) {
      submitMutation.mutate();
    }
  };

  const handleUnsubmit = () => {
    if (confirm('Return your agent to draft mode? You can make changes and submit again.')) {
      unsubmitMutation.mutate();
    }
  };

  if (isLoading) {
    return <Loading fullScreen text="Loading assignment..." />;
  }

  if (error || !data) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8 text-center">
        <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Failed to Load Assignment</h1>
        <p className="text-gray-600 mb-4">
          {(error as any)?.response?.data?.error || 'Something went wrong'}
        </p>
        <Button onClick={() => navigate(`/courses/${courseId}/assignments`)}>
          Back to Assignments
        </Button>
      </div>
    );
  }

  const { assignment, config } = data;
  const isSubmitted = Boolean(config && !config.isDraft);
  const isGraded = config?.submission?.status === 'graded';
  const isPastDue = Boolean(assignment.dueDate && new Date(assignment.dueDate) < new Date());

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getStatus = () => {
    if (isGraded) return 'graded';
    if (isSubmitted) return 'submitted';
    if (config) return 'draft';
    return 'not_started';
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-6">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate(`/courses/${courseId}/assignments`)}
          icon={<ArrowLeft className="w-4 h-4" />}
        >
          Back to Assignments
        </Button>
      </div>

      {/* Assignment Info */}
      <Card className="mb-6">
        <CardBody>
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 mb-2">
                {assignment.title}
              </h1>
              {assignment.description && (
                <p className="text-gray-600 mb-4">{assignment.description}</p>
              )}
              <div className="flex flex-wrap items-center gap-4 text-sm">
                <div className="flex items-center gap-1.5 text-gray-500">
                  <Award className="w-4 h-4" />
                  <span>{assignment.points} points</span>
                </div>
                {assignment.dueDate && (
                  <div
                    className={`flex items-center gap-1.5 ${
                      isPastDue ? 'text-red-500' : 'text-gray-500'
                    }`}
                  >
                    <Calendar className="w-4 h-4" />
                    <span>Due {formatDate(assignment.dueDate)}</span>
                    {isPastDue && <span className="font-medium">(Past due)</span>}
                  </div>
                )}
                <StatusBadge status={getStatus()} />
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col gap-2">
              {config && !isGraded && (
                <>
                  {isSubmitted ? (
                    <Button
                      variant="secondary"
                      onClick={handleUnsubmit}
                      loading={unsubmitMutation.isPending}
                      icon={<FileEdit className="w-4 h-4" />}
                    >
                      Return to Draft
                    </Button>
                  ) : (
                    <Button
                      onClick={handleSubmit}
                      loading={submitMutation.isPending}
                      disabled={isPastDue}
                      icon={<Send className="w-4 h-4" />}
                    >
                      Submit for Grading
                    </Button>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Grade Display */}
          {isGraded && config?.submission && (
            <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle className="w-5 h-5 text-green-600" />
                <span className="font-semibold text-green-800">Graded</span>
              </div>
              <div className="text-2xl font-bold text-green-900 mb-1">
                {config.submission.grade}/{assignment.points} points
              </div>
              {config.submission.feedback && (
                <div className="mt-2">
                  <p className="text-sm font-medium text-green-800">Feedback:</p>
                  <p className="text-sm text-green-700">{config.submission.feedback}</p>
                </div>
              )}
            </div>
          )}

          {/* Instructions */}
          {assignment.instructions && (
            <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <h3 className="font-medium text-blue-900 mb-2">Instructions</h3>
              <p className="text-sm text-blue-800 whitespace-pre-wrap">
                {assignment.instructions}
              </p>
            </div>
          )}
        </CardBody>
      </Card>

      {/* Tabs */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="-mb-px flex gap-8">
          <button
            onClick={() => setActiveTab('build')}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'build'
                ? 'border-violet-500 text-violet-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Build Agent
          </button>
          <button
            onClick={() => setActiveTab('test')}
            disabled={!config}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'test'
                ? 'border-violet-500 text-violet-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            } ${!config ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            Test Agent
          </button>
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 'build' ? (
        <AgentBuilderForm
          initialData={config}
          onSave={handleSave}
          isSaving={createMutation.isPending || updateMutation.isPending}
          disabled={isSubmitted}
        />
      ) : config ? (
        <AgentTestPanel assignmentId={assId} config={config} />
      ) : (
        <div className="text-center py-12">
          <Clock className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            Create Your Agent First
          </h3>
          <p className="text-gray-600">
            Build and save your agent before testing it.
          </p>
        </div>
      )}
    </div>
  );
};
