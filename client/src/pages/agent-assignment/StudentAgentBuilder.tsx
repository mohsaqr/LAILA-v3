/**
 * Student Agent Builder Page
 *
 * Enhanced 4-tab AI agent builder with comprehensive pedagogical tools
 * and obsessive design process logging.
 */

import { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Award,
  CheckCircle,
  AlertCircle,
  User,
  Sparkles,
  Settings,
  Play,
  Save,
  Bot,
  Clock,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { agentAssignmentsApi } from '../../api/agentAssignments';
import { AgentIdentityTab } from '../../components/agent-assignment/AgentIdentityTab';
import { AgentBehaviorTab } from '../../components/agent-assignment/AgentBehaviorTab';
import { AgentAdvancedTab } from '../../components/agent-assignment/AgentAdvancedTab';
import { AgentTestTab } from '../../components/agent-assignment/AgentTestTab';
import { Card, CardBody } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { Loading } from '../../components/common/Loading';
import { Breadcrumb } from '../../components/common/Breadcrumb';
import {
  AgentConfigFormData,
  PedagogicalRoleConfig,
} from '../../types';
import { getPersonalityById } from '../../config/pedagogicalRoles';
import {
  AgentDesignLogger,
  getDesignLogger,
  endCurrentDesignSession,
} from '../../services/agentDesignLogger';
import { useAuth } from '../../hooks/useAuth';

type TabType = 'identity' | 'behavior' | 'advanced' | 'test';

const TABS: { id: TabType; label: string; icon: React.ElementType }[] = [
  { id: 'identity', label: 'Identity & Role', icon: User },
  { id: 'behavior', label: 'Behavior', icon: Sparkles },
  { id: 'advanced', label: 'Advanced', icon: Settings },
  { id: 'test', label: 'Test & Reflect', icon: Play },
];

// Default form data
const getDefaultFormData = (): AgentConfigFormData => ({
  agentName: '',
  agentTitle: '',
  personaDescription: '',
  systemPrompt: '',
  dosRules: [],
  dontsRules: [],
  welcomeMessage: '',
  avatarImageUrl: null,
  pedagogicalRole: null,
  personality: 'friendly',
  personalityPrompt: '',
  responseStyle: 'balanced',
  temperature: 0.7,
  suggestedQuestions: [],
  knowledgeContext: '',
  reflectionResponses: {},
  selectedPromptBlocks: [],
});

export const StudentAgentBuilder = () => {
  const { courseId, assignmentId } = useParams<{
    courseId: string;
    assignmentId: string;
  }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<TabType>('identity');
  const [formData, setFormData] = useState<AgentConfigFormData>(getDefaultFormData());
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [logger, setLogger] = useState<AgentDesignLogger | null>(null);

  const assId = parseInt(assignmentId!, 10);

  // Initialize logger
  useEffect(() => {
    if (user?.id && assId) {
      const designLogger = getDesignLogger(user.id, assId);
      setLogger(designLogger);
    }

    return () => {
      // End session when component unmounts
      endCurrentDesignSession();
    };
  }, [user?.id, assId]);

  // Fetch agent config
  const { data, isLoading, error } = useQuery({
    queryKey: ['myAgentConfig', assId],
    queryFn: () => agentAssignmentsApi.getMyAgentConfig(assId),
  });

  // Initialize form and logger when data loads
  useEffect(() => {
    if (data?.config) {
      const config = data.config;
      setFormData({
        agentName: config.agentName,
        agentTitle: config.agentTitle || '',
        personaDescription: config.personaDescription || '',
        systemPrompt: config.systemPrompt,
        dosRules: config.dosRules || [],
        dontsRules: config.dontsRules || [],
        welcomeMessage: config.welcomeMessage || '',
        avatarImageUrl: config.avatarImageUrl,
        pedagogicalRole: config.pedagogicalRole || null,
        personality: config.personality || 'friendly',
        personalityPrompt: config.personalityPrompt || '',
        responseStyle: config.responseStyle || 'balanced',
        temperature: config.temperature ?? 0.7,
        suggestedQuestions: config.suggestedQuestions || [],
        knowledgeContext: config.knowledgeContext || '',
        reflectionResponses: config.reflectionResponses || {},
        selectedPromptBlocks: config.selectedPromptBlocks || [],
      });

      // Start logger session with config info
      if (logger) {
        logger.setAgentConfigId(config.id);
        logger.setVersion(config.version);
        logger.startSession(config.id, config.version);
      }
    } else if (logger) {
      // Start session without config (new agent)
      logger.startSession();
    }
  }, [data?.config, logger]);

  // Log tab switches
  const handleTabChange = (newTab: TabType) => {
    if (newTab !== activeTab) {
      logger?.switchTab(newTab);
      setActiveTab(newTab);
    }
  };

  // Create mutation
  const createMutation = useMutation({
    mutationFn: (formDataToSend: AgentConfigFormData) =>
      agentAssignmentsApi.createAgentConfig(assId, formDataToSend),
    onSuccess: (newConfig) => {
      queryClient.invalidateQueries({ queryKey: ['myAgentConfig', assId] });
      toast.success('Agent created successfully!');
      logger?.setAgentConfigId(newConfig.id);
      logger?.setVersion(newConfig.version);
      logger?.logDraftSaved(formData);
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error || 'Failed to create agent');
    },
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: (formDataToSend: Partial<AgentConfigFormData>) =>
      agentAssignmentsApi.updateAgentConfig(assId, formDataToSend),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ['myAgentConfig', assId] });
      toast.success('Agent saved!');
      logger?.setVersion(updated.version);
      logger?.logDraftSaved(formData);
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error || 'Failed to save agent');
    },
  });

  // Form change handler
  const handleChange = useCallback(
    <K extends keyof AgentConfigFormData>(field: K, value: AgentConfigFormData[K]) => {
      setFormData((prev) => ({ ...prev, [field]: value }));
      // Clear error when field is changed
      if (errors[field]) {
        setErrors((prev) => ({ ...prev, [field]: '' }));
      }
    },
    [errors]
  );

  // Role selection handler
  const handleRoleSelect = useCallback(
    (role: PedagogicalRoleConfig) => {
      // Apply role defaults
      setFormData((prev) => ({
        ...prev,
        pedagogicalRole: role.id,
        systemPrompt: role.defaultSystemPrompt,
        dosRules: role.defaultDos,
        dontsRules: role.defaultDonts,
        welcomeMessage: role.exampleWelcome,
        personality: role.recommendedPersonality as any,
        personalityPrompt: getPersonalityById(role.recommendedPersonality)?.prompt || '',
      }));

      logger?.logRoleSelected(role.id, role.name);
      logger?.logTemplateApplied(role.name, 'systemPrompt');
    },
    [logger]
  );

  // Validation
  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.agentName.trim()) {
      newErrors.agentName = 'Agent name is required';
    } else if (formData.agentName.length > 100) {
      newErrors.agentName = 'Agent name must be less than 100 characters';
    }

    if (!formData.systemPrompt.trim()) {
      newErrors.systemPrompt = 'System prompt is required';
    } else if (formData.systemPrompt.length < 10) {
      newErrors.systemPrompt = 'System prompt must be at least 10 characters';
    }

    if (formData.avatarImageUrl) {
      try {
        new URL(formData.avatarImageUrl);
      } catch {
        newErrors.avatarImageUrl = 'Please enter a valid URL';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Save handler
  const handleSave = () => {
    if (!validate()) {
      // Switch to tab with first error
      if (errors.agentName || errors.avatarImageUrl) {
        setActiveTab('identity');
      } else if (errors.systemPrompt) {
        setActiveTab('advanced');
      }
      return;
    }

    if (data?.config) {
      updateMutation.mutate(formData);
    } else {
      createMutation.mutate(formData);
    }
  };

  // Reflection callback from test tab
  const handleTestReflectionSubmit = (promptId: string, response: string) => {
    setFormData((prev) => ({
      ...prev,
      reflectionResponses: {
        ...(prev.reflectionResponses || {}),
        [promptId]: response,
      },
    }));
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
        <Button onClick={() => navigate(`/courses/${courseId}`)}>
          Back to Course
        </Button>
      </div>
    );
  }

  const { assignment, config } = data;
  const isSubmitted = Boolean(config && !config.isDraft);
  const isGraded = config?.submission?.status === 'graded';
  const isPastDue = Boolean(assignment.dueDate && new Date(assignment.dueDate) < new Date());
  const isSaving = createMutation.isPending || updateMutation.isPending;

  // Auto-submit on due date - agent is "submitted" when due date passes
  const isBuilt = isSubmitted || isPastDue;

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Get course info for breadcrumb
  const courseName = assignment.course?.title || 'Course';

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Breadcrumb Navigation */}
      <div className="mb-6">
        <Breadcrumb
          items={[
            { label: 'Courses', href: '/courses' },
            { label: courseName, href: `/courses/${courseId}` },
            { label: assignment.title },
          ]}
        />
      </div>

      {/* Assignment Info */}
      <Card className="mb-6">
        <CardBody>
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 mb-2">{assignment.title}</h1>
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
                      isPastDue ? 'text-green-600' : 'text-gray-500'
                    }`}
                  >
                    {isPastDue ? (
                      <>
                        <CheckCircle className="w-4 h-4" />
                        <span className="font-medium">Submitted on {formatDate(assignment.dueDate)}</span>
                      </>
                    ) : (
                      <>
                        <Clock className="w-4 h-4" />
                        <span>Due {formatDate(assignment.dueDate)}</span>
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Save Button - Only show during building phase */}
            {!isBuilt && (
              <Button
                variant="secondary"
                onClick={handleSave}
                loading={isSaving}
                icon={<Save className="w-4 h-4" />}
              >
                Save Progress
              </Button>
            )}
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
              <p className="text-sm text-blue-800 whitespace-pre-wrap">{assignment.instructions}</p>
            </div>
          )}
        </CardBody>
      </Card>

      {/* Show Builder OR Built Agent View */}
      {isBuilt ? (
        /* Built Agent View - Simple, focused on using the agent */
        <Card>
          <CardBody>
            <div className="text-center py-12">
              {/* Agent Avatar */}
              <div className="mb-6">
                {config?.avatarImageUrl ? (
                  <img
                    src={config.avatarImageUrl}
                    alt={config.agentName}
                    className="w-28 h-28 rounded-full object-cover shadow-lg mx-auto"
                  />
                ) : (
                  <div className="w-28 h-28 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-lg mx-auto">
                    <Bot className="w-14 h-14 text-white" />
                  </div>
                )}
              </div>

              {/* Agent Info */}
              <h2 className="text-2xl font-bold text-gray-900 mb-1">{config?.agentName}</h2>
              {config?.agentTitle && (
                <p className="text-violet-600 font-medium mb-4">{config.agentTitle}</p>
              )}

              {/* Use Agent Button */}
              <Button
                size="lg"
                onClick={() => navigate(`/courses/${courseId}/agent-assignments/${assignmentId}/use`)}
                icon={<Bot className="w-5 h-5" />}
              >
                Chat with {config?.agentName}
              </Button>
            </div>
          </CardBody>
        </Card>
      ) : (
        /* Builder View - Agent is being designed */
        <>
          {/* Tabs */}
          <div className="border-b border-gray-200 mb-6">
            <nav className="-mb-px flex gap-4 sm:gap-8 overflow-x-auto">
              {TABS.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                const isDisabled = tab.id === 'test' && !config;

                return (
                  <button
                    key={tab.id}
                    onClick={() => !isDisabled && handleTabChange(tab.id)}
                    disabled={isDisabled}
                    className={`py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2 whitespace-nowrap ${
                      isActive
                        ? 'border-violet-500 text-violet-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    } ${isDisabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    <Icon className="w-4 h-4" />
                    {tab.label}
                  </button>
                );
              })}
            </nav>
          </div>

          {/* Tab Content */}
          <div className="min-h-[400px]">
            {activeTab === 'identity' && (
              <AgentIdentityTab
                formData={formData}
                errors={errors}
                disabled={false}
                onChange={handleChange}
                onRoleSelect={handleRoleSelect}
                logger={logger}
              />
            )}
            {activeTab === 'behavior' && (
              <AgentBehaviorTab
                formData={formData}
                disabled={false}
                onChange={handleChange}
                logger={logger}
              />
            )}
            {activeTab === 'advanced' && (
              <AgentAdvancedTab
                formData={formData}
                errors={errors}
                disabled={false}
                onChange={handleChange}
                logger={logger}
              />
            )}
            {activeTab === 'test' && (
              <AgentTestTab
                assignmentId={assId}
                config={config}
                reflectionRequirement={assignment.reflectionRequirement}
                onReflectionSubmit={handleTestReflectionSubmit}
                logger={logger}
              />
            )}
          </div>
        </>
      )}

    </div>
  );
};
