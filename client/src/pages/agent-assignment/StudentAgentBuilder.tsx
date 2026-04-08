/**
 * Student Agent Builder Page
 *
 * Enhanced 4-tab AI agent builder with comprehensive pedagogical tools
 * and obsessive design process logging.
 */

import { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { sanitizeHtml, isHtmlContent } from '../../utils/sanitize';
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
  Database,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { agentAssignmentsApi } from '../../api/agentAssignments';
import { AgentIdentityTab } from '../../components/agent-assignment/AgentIdentityTab';
import { AgentBehaviorTab } from '../../components/agent-assignment/AgentBehaviorTab';
import { AgentAdvancedTab } from '../../components/agent-assignment/AgentAdvancedTab';
import { AgentTestTab } from '../../components/agent-assignment/AgentTestTab';
import { AgentDatasetTab } from '../../components/agent-assignment/AgentDatasetTab';
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

type TabType = 'identity' | 'behavior' | 'advanced' | 'test' | 'dataset';

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
  const { t } = useTranslation(['teaching', 'common', 'navigation']);
  const { courseId, assignmentId } = useParams<{
    courseId: string;
    assignmentId: string;
  }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const TABS: { id: TabType; label: string; icon: React.ElementType }[] = [
    { id: 'identity', label: t('identity_role'), icon: User },
    { id: 'behavior', label: t('behavior'), icon: Sparkles },
    { id: 'advanced', label: t('advanced'), icon: Settings },
    { id: 'test', label: t('test_reflect'), icon: Play },
    { id: 'dataset', label: t('generate_dataset'), icon: Database },
  ];
  const [activeTab, setActiveTab] = useState<TabType>('identity');
  const [formData, setFormData] = useState<AgentConfigFormData>(getDefaultFormData());
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [logger, setLogger] = useState<AgentDesignLogger | null>(null);
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);

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
      toast.success(t('agent_created'));
      logger?.setAgentConfigId(newConfig.id);
      logger?.setVersion(newConfig.version);
      logger?.logDraftSaved(formData);
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error || t('failed_to_create_agent'));
    },
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: (formDataToSend: Partial<AgentConfigFormData>) =>
      agentAssignmentsApi.updateAgentConfig(assId, formDataToSend),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ['myAgentConfig', assId] });
      toast.success(t('agent_saved'));
      logger?.setVersion(updated.version);
      logger?.logDraftSaved(formData);
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error || t('failed_to_save_agent'));
    },
  });

  // Submit mutation
  const submitMutation = useMutation({
    mutationFn: () => agentAssignmentsApi.submitAgentConfig(assId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['myAgentConfig', assId] });
      toast.success(t('agent_submitted'));
      logger?.logSubmissionCompleted(formData);
      setShowSubmitConfirm(false);
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error || t('failed_to_submit_agent'));
      setShowSubmitConfirm(false);
    },
  });

  // Unsubmit mutation
  const unsubmitMutation = useMutation({
    mutationFn: () => agentAssignmentsApi.unsubmitAgentConfig(assId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['myAgentConfig', assId] });
      toast.success(t('agent_unsubmitted'));
      logger?.logUnsubmitRequested();
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error || t('failed_to_unsubmit_agent'));
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
      newErrors.agentName = t('agent_name_required');
    } else if (formData.agentName.length > 100) {
      newErrors.agentName = t('agent_name_max_length');
    }

    if (!formData.systemPrompt.trim()) {
      newErrors.systemPrompt = t('system_prompt_required');
    } else if (formData.systemPrompt.length < 10) {
      newErrors.systemPrompt = t('system_prompt_min_length');
    }

    if (formData.avatarImageUrl) {
      try {
        new URL(formData.avatarImageUrl);
      } catch {
        newErrors.avatarImageUrl = t('invalid_avatar_url');
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
    return <Loading fullScreen text={t('loading_assignment')} />;
  }

  if (error || !data) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8 text-center">
        <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
        <h1 className="text-2xl font-bold text-gray-900 mb-2">{t('failed_to_load_assignment')}</h1>
        <p className="text-gray-600 mb-4">
          {(error as any)?.response?.data?.error || t('something_went_wrong')}
        </p>
        <Button onClick={() => navigate(`/courses/${courseId}`)}>
          {t('back_to_course')}
        </Button>
      </div>
    );
  }

  const { assignment, config } = data;
  const isSubmitted = Boolean(config && !config.isDraft);
  const isGraded = config?.submission?.status === 'graded';
  const isPastDue = Boolean(assignment.dueDate && new Date(assignment.dueDate.replace('Z', '')) < new Date());
  const isInGracePeriod = isPastDue && Boolean(assignment.gracePeriodDeadline && new Date(assignment.gracePeriodDeadline.replace('Z', '')) > new Date());
  const isFullyPastDue = isPastDue && !isInGracePeriod;
  const isSaving = createMutation.isPending || updateMutation.isPending;
  const isSubmitting = submitMutation.isPending;
  const isBuilt = isSubmitted;

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
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Breadcrumb */}
      <div className="mb-6">
        <Breadcrumb
          items={[
            { label: t('navigation:courses'), href: '/courses' },
            { label: courseName, href: `/courses/${courseId}` },
            { label: t('assignments'), href: `/courses/${courseId}/assignments` },
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
                isHtmlContent(assignment.description)
                  ? <div className="text-gray-600 mb-4 prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: sanitizeHtml(assignment.description) }} />
                  : <p className="text-gray-600 mb-4">{assignment.description}</p>
              )}
              <div className="flex flex-wrap items-center gap-4 text-sm">
                <div className="flex items-center gap-1.5 text-gray-500">
                  <Award className="w-4 h-4" />
                  <span>{t('x_points', { count: assignment.points })}</span>
                </div>
                {assignment.dueDate && (
                  <div
                    className={`flex items-center gap-1.5 ${
                      isSubmitted ? 'text-green-600' : isFullyPastDue ? 'text-red-500' : isInGracePeriod ? 'text-red-500' : 'text-gray-500'
                    }`}
                  >
                    {isSubmitted ? (
                      <>
                        <CheckCircle className="w-4 h-4" />
                        <span className="font-medium">{t('submitted')}</span>
                      </>
                    ) : isInGracePeriod ? (
                      <>
                        <AlertCircle className="w-4 h-4" />
                        <span className="font-medium">{t('courses:grace_period_status', { defaultValue: 'Grace Period' })}</span>
                      </>
                    ) : isFullyPastDue ? (
                      <>
                        <AlertCircle className="w-4 h-4" />
                        <span className="font-medium">{t('past_due', { date: formatDate(assignment.dueDate) })}</span>
                      </>
                    ) : (
                      <>
                        <Clock className="w-4 h-4" />
                        <span>{t('due_on', { date: formatDate(assignment.dueDate) })}</span>
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Action Buttons - Only show during building phase */}
            {!isBuilt && (
              <div className="flex items-center gap-2 flex-shrink-0">
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={handleSave}
                  loading={isSaving}
                  disabled={isSubmitting}
                  icon={<Save className="w-4 h-4" />}
                  className="whitespace-nowrap"
                >
                  {t('save_progress')}
                </Button>

                {/* Submit for Grading */}
                {config && config.isDraft && !showSubmitConfirm && (
                  <Button
                    size="sm"
                    onClick={() => {
                      logger?.logSubmissionAttempted();
                      setShowSubmitConfirm(true);
                    }}
                    disabled={isSaving || isFullyPastDue}
                    icon={<CheckCircle className="w-4 h-4" />}
                    className="whitespace-nowrap"
                  >
                    {t('common:submit')}
                  </Button>
                )}

                {/* Inline confirmation */}
                {showSubmitConfirm && (
                  <div className="flex items-center gap-2 bg-yellow-50 border border-yellow-200 rounded-lg px-3 py-2">
                    <span className="text-sm text-yellow-800 font-medium">{t('confirm_submit_agent')}</span>
                    <Button
                      size="sm"
                      onClick={() => submitMutation.mutate()}
                      loading={isSubmitting}
                    >
                      {t('confirm')}
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => setShowSubmitConfirm(false)}
                      disabled={isSubmitting}
                    >
                      {t('common:cancel')}
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Grade Display */}
          {isGraded && config?.submission && (
            <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle className="w-5 h-5 text-green-600" />
                <span className="font-semibold text-green-800">{t('graded_label')}</span>
              </div>
              <div className="text-2xl font-bold text-green-900 mb-1">
                {config.submission.grade}/{assignment.points} {t('points')}
              </div>
              {config.submission.feedback && (
                <div className="mt-2">
                  <p className="text-sm font-medium text-green-800">{t('feedback_label')}</p>
                  <p className="text-sm text-green-700">{config.submission.feedback}</p>
                </div>
              )}
            </div>
          )}

          {/* Instructions */}
          {assignment.instructions && (
            <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <h3 className="font-medium text-blue-900 mb-2">{t('instructions_header')}</h3>
              {isHtmlContent(assignment.instructions)
                ? <div className="text-sm text-blue-800 prose prose-sm max-w-none prose-blue" dangerouslySetInnerHTML={{ __html: sanitizeHtml(assignment.instructions) }} />
                : <p className="text-sm text-blue-800 whitespace-pre-wrap">{assignment.instructions}</p>
              }
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
                {t('chat_with_agent', { name: config?.agentName })}
              </Button>

              {/* Unsubmit - only before grading */}
              {!isGraded && (
                <div className="mt-4">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => unsubmitMutation.mutate()}
                    loading={unsubmitMutation.isPending}
                  >
                    {t('unsubmit_to_edit')}
                  </Button>
                </div>
              )}
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
                const isDisabled = (tab.id === 'test' || tab.id === 'dataset') && !config;

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
            {activeTab === 'dataset' && (
              <AgentDatasetTab
                assignmentId={assId}
                config={config}
              />
            )}
          </div>
        </>
      )}

    </div>
  );
};
