import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  User,
  Calendar,
  Award,
  Check,
  Clock,
  FileText,
  ExternalLink,
  Bot,
  MessageSquare,
} from 'lucide-react';
import { assignmentsApi } from '../../api/assignments';
import { agentAssignmentsApi } from '../../api/agentAssignments';
import { coursesApi } from '../../api/courses';
import { Card, CardBody, CardHeader } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { Loading } from '../../components/common/Loading';
import { Breadcrumb } from '../../components/common/Breadcrumb';
import { StatusBadge } from '../../components/common/StatusBadge';
import { EmptyState } from '../../components/common/EmptyState';
import { sanitizeHtml, isHtmlContent } from '../../utils/sanitize';
import { AssignmentSubmission } from '../../types';
import activityLogger from '../../services/activityLogger';
import { TrackedContent } from '../../components/common/TrackedContent';

export const SubmissionReview = () => {
  const { t } = useTranslation(['teaching', 'navigation']);
  const { id, assignmentId } = useParams<{ id: string; assignmentId: string }>();
  const courseId = parseInt(id!, 10);
  const assId = parseInt(assignmentId!, 10);
  const navigate = useNavigate();

  useEffect(() => {
    if (assId && courseId) {
      activityLogger.logSubmissionListViewed(assId, courseId);
    }
  }, [assId, courseId]);

  const { data: course } = useQuery({
    queryKey: ['course', courseId],
    queryFn: () => coursesApi.getCourseById(courseId),
    enabled: !!courseId,
  });

  const { data: assignment, isLoading: assignmentLoading } = useQuery({
    queryKey: ['assignment', assId],
    queryFn: () => assignmentsApi.getAssignmentById(assId),
    enabled: !!assId,
  });

  const isAgentAssignment = assignment?.submissionType === 'ai_agent';

  // Regular submissions
  const { data: submissions, isLoading: submissionsLoading } = useQuery({
    queryKey: ['assignmentSubmissions', assId],
    queryFn: () => assignmentsApi.getSubmissions(assId),
    enabled: !!assId && !isAgentAssignment && !assignmentLoading,
  });

  // Agent submissions
  const { data: agentSubmissions = [], isLoading: agentSubmissionsLoading } = useQuery({
    queryKey: ['agentSubmissions', assId],
    queryFn: () => agentAssignmentsApi.getAgentSubmissions(assId),
    enabled: !!assId && isAgentAssignment && !assignmentLoading,
  });

  const formatDate = (dateStr: string, utc = false) => {
    return new Date(dateStr).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      ...(utc ? { timeZone: 'UTC' } : {}),
    });
  };

  const getSubmissionStatus = (submission: AssignmentSubmission) => {
    if (submission.status === 'graded') return 'graded';
    if (submission.status === 'submitted') return 'submitted';
    return 'pending';
  };

  const getAgentSubmissionStatus = (config: typeof agentSubmissions[0]) => {
    if (config.submission?.status === 'graded') return 'graded';
    if (!config.isDraft) return 'submitted';
    return 'draft';
  };

  const getTypeLabel = () => {
    switch (assignment?.submissionType) {
      case 'ai_agent': return t('ai_agent_assignment');
      case 'file': return t('file_assignment');
      case 'mixed': return t('mixed_assignment');
      default: return t('text_assignment');
    }
  };

  const loading = assignmentLoading || (isAgentAssignment ? agentSubmissionsLoading : submissionsLoading);

  if (loading) {
    return <Loading fullScreen text={t('loading_submissions')} />;
  }

  if (!assignment) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6 md:py-8 text-center">
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900 mb-2">{t('assignment_not_found')}</h1>
        <Button onClick={() => navigate(`/teach/courses/${courseId}/assignments`)}>
          {t('back_to_assignments')}
        </Button>
      </div>
    );
  }

  const pendingCount = isAgentAssignment
    ? agentSubmissions.filter(s => !s.isDraft && s.submission?.status !== 'graded').length
    : submissions?.filter(s => s.status === 'submitted').length || 0;
  const gradedCount = isAgentAssignment
    ? agentSubmissions.filter(s => s.submission?.status === 'graded').length
    : submissions?.filter(s => s.status === 'graded').length || 0;
  const totalCount = isAgentAssignment ? agentSubmissions.length : (submissions?.length || 0);

  const TypeIcon = isAgentAssignment ? Bot : FileText;
  const typeColor = isAgentAssignment ? 'text-violet-600' : 'text-blue-600';
  const typeBg = isAgentAssignment ? 'bg-violet-100' : 'bg-blue-100';

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 md:py-8">
      {/* Breadcrumb */}
      <div className="mb-6">
        <Breadcrumb
          homeHref="/"
          items={[
            { label: t('navigation:courses'), href: '/teach' },
            ...(course
              ? [{ label: course.title, href: `/teach/courses/${courseId}/curriculum` }]
              : []),
            { label: t('navigation:assignments'), href: `/teach/courses/${courseId}/assignments` },
            { label: assignment.title },
            { label: t('submissions') },
          ]}
        />
      </div>

      {/* Assignment Header */}
      <Card className="mb-6">
        <CardBody>
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <TypeIcon className={`w-5 h-5 ${typeColor}`} />
                <span className={`text-sm font-medium ${typeColor} ${typeBg} px-2 py-0.5 rounded`}>
                  {getTypeLabel()}
                </span>
              </div>
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900 mb-2">{assignment.title}</h1>
              {assignment.description && (
                isHtmlContent(assignment.description)
                  ? <TrackedContent context="assignment" courseId={courseId} objectId={assId} objectTitle={assignment.title}>
                      <div className="text-gray-600 mb-4 prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: sanitizeHtml(assignment.description) }} />
                    </TrackedContent>
                  : <p className="text-gray-600 mb-4">{assignment.description}</p>
              )}
              <div className="flex flex-wrap items-center gap-4 sm:gap-6 text-sm">
                <div className="flex items-center gap-2 text-gray-500">
                  <Award className="w-4 h-4" />
                  <span>{t('x_points', { count: assignment.points })}</span>
                </div>
                <div className="flex items-center gap-2 text-gray-500">
                  <Clock className="w-4 h-4 text-yellow-500" />
                  <span>{t('pending_count', { count: pendingCount })}</span>
                </div>
                <div className="flex items-center gap-2 text-gray-500">
                  <Check className="w-4 h-4 text-green-500" />
                  <span>{t('graded_count', { count: gradedCount })}</span>
                </div>
                <div className="flex items-center gap-2 text-gray-500">
                  <Calendar className="w-4 h-4" />
                  <span>
                    {assignment.dueDate
                      ? `${t('due_date')}: ${formatDate(assignment.dueDate, true)}`
                      : t('no_due_date')}
                  </span>
                </div>
                {assignment.gracePeriodDeadline && (
                  <div className="flex items-center gap-2 text-amber-600">
                    <Clock className="w-4 h-4" />
                    <span>
                      {t('courses:grace_period_deadline', { defaultValue: 'Grace Period Deadline' })}: {formatDate(assignment.gracePeriodDeadline, true)}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </CardBody>
      </Card>

      {/* Submissions List */}
      <Card>
        <CardHeader>
          <h2 className="text-lg sm:text-xl font-semibold text-gray-900">
            {t('submissions_count', { count: totalCount })}
          </h2>
        </CardHeader>
        <CardBody>
          {isAgentAssignment ? (
            /* Agent Submissions */
            agentSubmissions.length > 0 ? (
              <div className="space-y-4">
                {agentSubmissions.map((config) => (
                  <div
                    key={config.id}
                    className="border border-gray-200 rounded-lg p-4"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center">
                          <User className="w-5 h-5 text-gray-500" />
                        </div>
                        <div>
                          <h3 className="font-medium text-gray-900">
                            {config.user?.fullname || t('unknown_student')}
                          </h3>
                          <p className="text-sm text-gray-500">{config.user?.email}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <StatusBadge status={getAgentSubmissionStatus(config)} />
                        {config.submission?.status === 'graded' && (
                          <span className="text-lg font-semibold text-gray-900">
                            {config.submission.grade}/{assignment.points}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Agent Info */}
                    <div className="flex items-center gap-4 text-sm text-gray-600">
                      <div className="flex items-center gap-1.5">
                        <Bot className="w-4 h-4 text-violet-500" />
                        <span className="font-medium">{config.agentName}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <MessageSquare className="w-4 h-4 text-gray-400" />
                        <span>
                          {config._count?.testConversations || 0} {t('test_conversations')}
                        </span>
                      </div>
                      <span className="text-gray-400">&middot;</span>
                      <span>{t('version')} {config.version}</span>
                    </div>

                    {/* Submission date */}
                    {config.submittedAt && (
                      <div className={`mt-2 text-xs ${
                        assignment.dueDate && assignment.gracePeriodDeadline
                          && new Date(config.submittedAt) > new Date(assignment.dueDate)
                          && new Date(config.submittedAt) <= new Date(assignment.gracePeriodDeadline)
                          ? 'text-amber-600 font-medium'
                          : assignment.dueDate && new Date(config.submittedAt) > new Date(assignment.dueDate)
                          ? 'text-red-500 font-medium'
                          : 'text-gray-500'
                      }`}>
                        {t('submitted')} {formatDate(config.submittedAt)}
                        {assignment.dueDate && assignment.gracePeriodDeadline
                          && new Date(config.submittedAt) > new Date(assignment.dueDate)
                          && new Date(config.submittedAt) <= new Date(assignment.gracePeriodDeadline)
                          && ` (${t('courses:grace_period_status', { defaultValue: 'Grace Period' })})`}
                      </div>
                    )}

                    {/* Feedback preview */}
                    {config.submission?.feedback && (
                      <div className="mt-3 p-2 bg-green-50 border border-green-200 rounded text-sm text-green-700">
                        <span className="font-medium">{t('feedback')}: </span>
                        {config.submission.feedback.length > 100
                          ? `${config.submission.feedback.slice(0, 100)}...`
                          : config.submission.feedback}
                      </div>
                    )}

                    {/* View Answer button */}
                    {config.submission && (
                      <div className="mt-3 flex justify-end">
                        <Button
                          size="sm"
                          onClick={() =>
                            navigate(
                              `/teach/courses/${courseId}/assignments/${assId}/agent-submissions/${config.submission!.id}`
                            )
                          }
                        >
                          {t('view_answer')}
                        </Button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState
                icon={Bot}
                title={t('no_submissions_yet')}
                description={t('no_submissions_description')}
              />
            )
          ) : (
            /* Regular Submissions */
            submissions && submissions.length > 0 ? (
              <div className="space-y-4">
                {submissions.map(submission => (
                  <div
                    key={submission.id}
                    className="border border-gray-200 rounded-lg p-4"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center">
                          <User className="w-5 h-5 text-gray-500" />
                        </div>
                        <div>
                          <h3 className="font-medium text-gray-900">
                            {submission.user?.fullname || t('unknown_student')}
                          </h3>
                          <p className="text-sm text-gray-500">{submission.user?.email}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <StatusBadge status={getSubmissionStatus(submission)} />
                        {submission.status === 'graded' && (
                          <span className="text-lg font-semibold text-gray-900">
                            {submission.grade}/{assignment.points}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Submission date */}
                    <div className={`mt-2 text-xs ${
                      assignment.dueDate && assignment.gracePeriodDeadline
                        && new Date(submission.submittedAt) > new Date(assignment.dueDate)
                        && new Date(submission.submittedAt) <= new Date(assignment.gracePeriodDeadline)
                        ? 'text-amber-600 font-medium'
                        : assignment.dueDate && new Date(submission.submittedAt) > new Date(assignment.dueDate)
                        ? 'text-red-500 font-medium'
                        : 'text-gray-500'
                    }`}>
                      {t('submitted_at', { date: formatDate(submission.submittedAt) })}
                      {assignment.dueDate && assignment.gracePeriodDeadline
                        && new Date(submission.submittedAt) > new Date(assignment.dueDate)
                        && new Date(submission.submittedAt) <= new Date(assignment.gracePeriodDeadline)
                        && ` (${t('courses:grace_period_status', { defaultValue: 'Grace Period' })})`}
                    </div>

                    {/* Existing Feedback */}
                    {submission.feedback && (
                      <div className="mt-3 p-2 bg-green-50 border border-green-200 rounded text-sm text-green-700">
                        <span className="font-medium">{t('feedback')}: </span>
                        {submission.feedback.length > 100
                          ? `${submission.feedback.slice(0, 100)}...`
                          : submission.feedback}
                      </div>
                    )}

                    {/* Actions */}
                    <div className="mt-3 flex justify-end">
                      <Button
                        size="sm"
                        onClick={() =>
                          navigate(
                            `/teach/courses/${courseId}/assignments/${assId}/submissions/${submission.id}`
                          )
                        }
                        icon={<ExternalLink className="w-3 h-3" />}
                      >
                        {t('view_answer')}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState
                icon={FileText}
                title={t('no_submissions_yet')}
                description={t('no_submissions_description')}
              />
            )
          )}
        </CardBody>
      </Card>
    </div>
  );
};
