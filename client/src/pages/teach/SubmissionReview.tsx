import { useQuery } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  ArrowLeft,
  User,
  Calendar,
  Award,
  Check,
  Clock,
  FileText,
  ExternalLink,
} from 'lucide-react';
import { assignmentsApi } from '../../api/assignments';
import { Card, CardBody, CardHeader } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { Loading } from '../../components/common/Loading';
import { StatusBadge } from '../../components/common/StatusBadge';
import { EmptyState } from '../../components/common/EmptyState';
import { AssignmentSubmission } from '../../types';

export const SubmissionReview = () => {
  const { t } = useTranslation('teaching');
  const { id, assignmentId } = useParams<{ id: string; assignmentId: string }>();
  const courseId = parseInt(id!, 10);
  const assId = parseInt(assignmentId!, 10);
  const navigate = useNavigate();

  const { data: assignment, isLoading: assignmentLoading } = useQuery({
    queryKey: ['assignment', assId],
    queryFn: () => assignmentsApi.getAssignmentById(assId),
    enabled: !!assId,
  });

  const { data: submissions, isLoading: submissionsLoading } = useQuery({
    queryKey: ['assignmentSubmissions', assId],
    queryFn: () => assignmentsApi.getSubmissions(assId),
    enabled: !!assId,
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

  const getSubmissionStatus = (submission: AssignmentSubmission) => {
    if (submission.status === 'graded') return 'graded';
    if (submission.status === 'submitted') return 'submitted';
    return 'pending';
  };

  const getTypeLabel = () => {
    switch (assignment?.submissionType) {
      case 'file': return t('file_assignment');
      case 'mixed': return t('mixed_assignment');
      default: return t('text_assignment');
    }
  };

  if (assignmentLoading || submissionsLoading) {
    return <Loading fullScreen text={t('loading_submissions')} />;
  }

  if (!assignment) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8 text-center">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">{t('assignment_not_found')}</h1>
        <Button onClick={() => navigate(`/teach/courses/${courseId}/assignments`)}>
          {t('back_to_assignments')}
        </Button>
      </div>
    );
  }

  const pendingCount = submissions?.filter(s => s.status === 'submitted').length || 0;
  const gradedCount = submissions?.filter(s => s.status === 'graded').length || 0;

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Back button */}
      <div className="mb-6">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate(`/teach/courses/${courseId}/assignments`)}
          icon={<ArrowLeft className="w-4 h-4" />}
        >
          {t('back_to_assignments')}
        </Button>
      </div>

      {/* Assignment Header */}
      <Card className="mb-6">
        <CardBody>
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <FileText className="w-5 h-5 text-blue-600" />
                <span className="text-sm font-medium text-blue-600 bg-blue-100 px-2 py-0.5 rounded">
                  {getTypeLabel()}
                </span>
              </div>
              <h1 className="text-2xl font-bold text-gray-900 mb-2">{assignment.title}</h1>
              {assignment.description && (
                <p className="text-gray-600 mb-4">{assignment.description}</p>
              )}
              <div className="flex items-center gap-6 text-sm">
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
                      ? `${t('due_date')}: ${formatDate(assignment.dueDate)}`
                      : t('no_due_date')}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </CardBody>
      </Card>

      {/* Submissions List */}
      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold text-gray-900">
            {t('submissions_count', { count: submissions?.length || 0 })}
          </h2>
        </CardHeader>
        <CardBody>
          {submissions && submissions.length > 0 ? (
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
                  <div className="mt-2 text-xs text-gray-500">
                    {t('submitted_at', { date: formatDate(submission.submittedAt) })}
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
          )}
        </CardBody>
      </Card>
    </div>
  );
};
