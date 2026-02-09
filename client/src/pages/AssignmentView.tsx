import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  FileText,
  Clock,
  CheckCircle,
  AlertCircle,
  Calendar,
  Award,
  Send,
  Save,
  Upload,
  X,
  MessageSquare,
} from 'lucide-react';
import toast from 'react-hot-toast';
import ReactMarkdown from 'react-markdown';
import { useTranslation } from 'react-i18next';
import { assignmentsApi } from '../api/assignments';
import { enrollmentsApi } from '../api/enrollments';
import { learningAnalyticsApi } from '../api/admin';
import { useTheme } from '../hooks/useTheme';
import { Card, CardBody, CardHeader } from '../components/common/Card';
import { Loading } from '../components/common/Loading';
import { Button } from '../components/common/Button';
import { TextArea } from '../components/common/Input';
import { Breadcrumb } from '../components/common/Breadcrumb';
import { PostAssignmentSurveyModal } from '../components/survey';
import { getSessionId, getClientInfo } from '../utils/analytics';
import { debug } from '../utils/debug';

export const AssignmentView = () => {
  const { t } = useTranslation(['courses', 'common']);
  const { courseId, assignmentId } = useParams<{ courseId: string; assignmentId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const parsedCourseId = parseInt(courseId!, 10);
  const parsedAssignmentId = parseInt(assignmentId!, 10);
  const { isDark } = useTheme();

  const [content, setContent] = useState('');
  const [fileUrls, setFileUrls] = useState<string[]>([]);
  const [showSurveyModal, setShowSurveyModal] = useState(false);

  // Theme colors
  const colors = {
    bg: isDark ? '#111827' : '#f9fafb',
    bgCard: isDark ? '#1f2937' : '#ffffff',
    textPrimary: isDark ? '#f3f4f6' : '#111827',
    textSecondary: isDark ? '#9ca3af' : '#6b7280',
    textMuted: isDark ? '#6b7280' : '#9ca3af',
    border: isDark ? '#374151' : '#e5e7eb',
    borderDashed: isDark ? '#4b5563' : '#d1d5db',
    bgFile: isDark ? '#374151' : '#f9fafb',
    // Status badge colors
    bgGreen: isDark ? 'rgba(34, 197, 94, 0.2)' : '#dcfce7',
    textGreen: isDark ? '#86efac' : '#15803d',
    bgGreenCard: isDark ? 'rgba(34, 197, 94, 0.1)' : '#f0fdf4',
    borderGreen: isDark ? 'rgba(34, 197, 94, 0.3)' : '#bbf7d0',
    bgBlue: isDark ? 'rgba(59, 130, 246, 0.2)' : '#dbeafe',
    textBlue: isDark ? '#93c5fd' : '#1d4ed8',
    bgBlueBanner: isDark ? 'rgba(59, 130, 246, 0.1)' : '#eff6ff',
    bgRed: isDark ? 'rgba(239, 68, 68, 0.2)' : '#fee2e2',
    textRed: isDark ? '#fca5a5' : '#dc2626',
    bgYellow: isDark ? 'rgba(245, 158, 11, 0.2)' : '#fef3c7',
    textYellow: isDark ? '#fcd34d' : '#d97706',
    bgGray: isDark ? '#374151' : '#f3f4f6',
    textGray: isDark ? '#9ca3af' : '#6b7280',
  };

  const { data: enrollment, isLoading: enrollmentLoading } = useQuery({
    queryKey: ['enrollment', courseId],
    queryFn: () => enrollmentsApi.getEnrollment(parsedCourseId),
  });

  const { data: assignment, isLoading: assignmentLoading } = useQuery({
    queryKey: ['assignment', assignmentId],
    queryFn: () => assignmentsApi.getAssignmentById(parsedAssignmentId),
    enabled: !!enrollment?.enrolled,
  });

  const { data: mySubmission, isLoading: submissionLoading } = useQuery({
    queryKey: ['mySubmission', assignmentId],
    queryFn: () => assignmentsApi.getMySubmission(parsedAssignmentId),
    enabled: !!enrollment?.enrolled,
  });

  // Track if we've logged the assignment_view event
  const hasLoggedViewRef = useRef(false);

  // Initialize form with existing submission data
  useEffect(() => {
    if (mySubmission) {
      setContent(mySubmission.content || '');
      setFileUrls(mySubmission.fileUrls ? JSON.parse(mySubmission.fileUrls) : []);
    }
  }, [mySubmission]);

  // Log assignment_view event when assignment loads
  useEffect(() => {
    // Don't require enrollment - allows logging for "View As" mode
    if (!assignment || hasLoggedViewRef.current) return;
    hasLoggedViewRef.current = true;

    const clientInfo = getClientInfo();

    learningAnalyticsApi.logAssessmentEvent({
      sessionId: getSessionId(),
      courseId: parsedCourseId,
      assignmentId: parsedAssignmentId,
      eventType: 'assignment_view',
      maxPoints: assignment.points,
      timestamp: Date.now(),
      ...clientInfo,
    }).catch(err => debug.error('Failed to log assignment_view event:', err));
  }, [assignment, parsedCourseId, parsedAssignmentId]);

  const saveDraftMutation = useMutation({
    mutationFn: () =>
      assignmentsApi.submitAssignment(parsedAssignmentId, {
        content,
        fileUrls,
        status: 'draft',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mySubmission', assignmentId] });
      toast.success(t('draft_saved'));
    },
    onError: () => toast.error(t('failed_save_draft')),
  });

  const submitMutation = useMutation({
    mutationFn: () =>
      assignmentsApi.submitAssignment(parsedAssignmentId, {
        content,
        fileUrls,
        status: 'submitted',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mySubmission', assignmentId] });
      queryClient.invalidateQueries({ queryKey: ['courseAssignments', courseId] });
      toast.success(t('assignment_submitted'));

      // Log assignment_submit event
      const clientInfo = getClientInfo();
      learningAnalyticsApi.logAssessmentEvent({
        sessionId: getSessionId(),
        courseId: parsedCourseId,
        assignmentId: parsedAssignmentId,
        eventType: 'assignment_submit',
        maxPoints: assignment?.points,
        timestamp: Date.now(),
        ...clientInfo,
      }).catch(err => debug.error('Failed to log assignment_submit event:', err));

      // Show post-assignment survey modal if configured
      if (assignment?.postSurveyId) {
        setShowSurveyModal(true);
      }
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || t('failed_submit_assignment'));
    },
  });

  if (enrollmentLoading || assignmentLoading || submissionLoading) {
    return <Loading fullScreen text={t('loading_assignment')} />;
  }

  if (!enrollment?.enrolled) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card>
          <CardBody className="text-center py-8 px-12">
            <h2 className="text-xl font-bold mb-2" style={{ color: colors.textPrimary }}>{t('not_enrolled_title')}</h2>
            <p className="mb-4" style={{ color: colors.textSecondary }}>{t('need_enroll_view_assignment')}</p>
            <Link to={`/catalog/${courseId}`} className="btn btn-primary">
              {t('view_course')}
            </Link>
          </CardBody>
        </Card>
      </div>
    );
  }

  if (!assignment) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card>
          <CardBody className="text-center py-8 px-12">
            <h2 className="text-xl font-bold mb-2" style={{ color: colors.textPrimary }}>{t('assignment_not_found')}</h2>
            <Button onClick={() => navigate(`/courses/${courseId}/assignments`)}>
              {t('back_to_assignments')}
            </Button>
          </CardBody>
        </Card>
      </div>
    );
  }

  // Redirect AI agent assignments to the agent builder page
  if (assignment.submissionType === 'ai_agent') {
    navigate(`/courses/${courseId}/agent-assignments/${assignmentId}`, { replace: true });
    return <Loading fullScreen text={t('redirecting_agent_builder')} />;
  }

  const course = enrollment.enrollment?.course;
  const now = new Date();
  const dueDate = assignment.dueDate ? new Date(assignment.dueDate) : null;
  const isPastDue = dueDate ? dueDate < now : false;
  const isSubmitted = mySubmission?.status === 'submitted' || mySubmission?.status === 'graded';
  const isGraded = mySubmission?.status === 'graded';
  const canSubmit = !isPastDue || !isSubmitted;

  const handleSubmit = () => {
    if (!content.trim() && fileUrls.length === 0) {
      toast.error(t('add_content_before_submit'));
      return;
    }
    submitMutation.mutate();
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Breadcrumb */}
      <div className="mb-6">
        <Breadcrumb
          items={[
            { label: t('courses'), href: '/courses' },
            { label: course?.title || t('course'), href: `/courses/${courseId}` },
            { label: t('assignments'), href: `/courses/${courseId}/assignments` },
            { label: assignment.title },
          ]}
        />
      </div>

      {/* Assignment Header */}
      <Card className="mb-6">
        <CardBody>
          <div className="flex items-start justify-between mb-4">
            <div>
              <p className="text-sm mb-1" style={{ color: colors.textSecondary }}>{course?.title}</p>
              <h1 className="text-2xl font-bold" style={{ color: colors.textPrimary }}>{assignment.title}</h1>
            </div>
            <StatusBadge
              isGraded={isGraded}
              isSubmitted={isSubmitted}
              isPastDue={isPastDue}
              hasDraft={mySubmission?.status === 'draft'}
              grade={mySubmission?.grade}
              points={assignment.points}
              colors={colors}
            />
          </div>

          <div className="flex flex-wrap items-center gap-4 text-sm" style={{ color: colors.textSecondary }}>
            <span className="flex items-center gap-1">
              <Award className="w-4 h-4" />
              {t('points_format', { points: assignment.points })}
            </span>
            {dueDate && (
              <span className="flex items-center gap-1" style={{ color: isPastDue ? colors.textRed : colors.textSecondary }}>
                <Calendar className="w-4 h-4" />
                {t('due_at', { date: dueDate.toLocaleDateString(), time: dueDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) })}
              </span>
            )}
            <span className="flex items-center gap-1 capitalize">
              <FileText className="w-4 h-4" />
              {t('submission_type_label', { type: assignment.submissionType })}
            </span>
          </div>
        </CardBody>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Assignment Description */}
          {assignment.description && (
            <Card>
              <CardHeader>
                <h2 className="font-semibold" style={{ color: colors.textPrimary }}>{t('assignment_description')}</h2>
              </CardHeader>
              <CardBody>
                <div className="prose max-w-none" style={{ color: colors.textSecondary }}>
                  <ReactMarkdown>{assignment.description}</ReactMarkdown>
                </div>
              </CardBody>
            </Card>
          )}

          {/* Instructions */}
          {assignment.instructions && (
            <Card>
              <CardHeader>
                <h2 className="font-semibold" style={{ color: colors.textPrimary }}>{t('assignment_instructions')}</h2>
              </CardHeader>
              <CardBody>
                <div className="prose max-w-none" style={{ color: colors.textSecondary }}>
                  <ReactMarkdown>{assignment.instructions}</ReactMarkdown>
                </div>
              </CardBody>
            </Card>
          )}

          {/* Submission Area */}
          {!isGraded && (
            <Card>
              <CardHeader>
                <h2 className="font-semibold" style={{ color: colors.textPrimary }}>{t('your_submission')}</h2>
              </CardHeader>
              <CardBody className="space-y-4">
                {(assignment.submissionType === 'text' || assignment.submissionType === 'mixed') && (
                  <TextArea
                    label={t('your_answer_label')}
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    placeholder={t('write_answer_placeholder')}
                    rows={10}
                    disabled={isSubmitted}
                  />
                )}

                {(assignment.submissionType === 'file' || assignment.submissionType === 'mixed') && (
                  <div>
                    <label className="block text-sm font-medium mb-2" style={{ color: colors.textSecondary }}>
                      {t('file_attachments')}
                    </label>
                    {assignment.allowedFileTypes && (
                      <p className="text-xs mb-2" style={{ color: colors.textMuted }}>
                        {t('allowed_types', { types: assignment.allowedFileTypes })}
                      </p>
                    )}
                    <div
                      className="border-2 border-dashed rounded-lg p-6 text-center"
                      style={{ borderColor: colors.borderDashed }}
                    >
                      <Upload className="w-8 h-8 mx-auto mb-2" style={{ color: colors.textMuted }} />
                      <p className="text-sm" style={{ color: colors.textSecondary }}>
                        {t('file_upload_coming_soon')}
                      </p>
                      <p className="text-xs mt-1" style={{ color: colors.textMuted }}>
                        {t('max_file_size', { size: assignment.maxFileSize || 10 })}
                      </p>
                    </div>

                    {fileUrls.length > 0 && (
                      <div className="mt-4 space-y-2">
                        {fileUrls.map((url, index) => (
                          <div
                            key={index}
                            className="flex items-center gap-2 p-2 rounded"
                            style={{ backgroundColor: colors.bgFile }}
                          >
                            <FileText className="w-4 h-4" style={{ color: colors.textMuted }} />
                            <span className="flex-1 text-sm truncate" style={{ color: colors.textPrimary }}>{url}</span>
                            {!isSubmitted && (
                              <button
                                onClick={() => setFileUrls(fileUrls.filter((_, i) => i !== index))}
                                style={{ color: colors.textRed }}
                              >
                                <X className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {!isSubmitted && canSubmit && (
                  <div className="flex items-center justify-end gap-3 pt-4 border-t" style={{ borderColor: colors.border }}>
                    <Button
                      variant="secondary"
                      onClick={() => saveDraftMutation.mutate()}
                      loading={saveDraftMutation.isPending}
                      icon={<Save className="w-4 h-4" />}
                    >
                      {t('save_draft')}
                    </Button>
                    <Button
                      onClick={handleSubmit}
                      loading={submitMutation.isPending}
                      icon={<Send className="w-4 h-4" />}
                    >
                      {t('submit_assignment')}
                    </Button>
                  </div>
                )}

                {isSubmitted && !isGraded && (
                  <div className="flex items-center gap-2 p-4 rounded-lg" style={{ backgroundColor: colors.bgBlueBanner }}>
                    <CheckCircle className="w-5 h-5" style={{ color: colors.textBlue }} />
                    <p style={{ color: colors.textBlue }}>
                      {t('submitted_waiting_grading')}
                    </p>
                  </div>
                )}
              </CardBody>
            </Card>
          )}

          {/* Graded Submission View */}
          {isGraded && mySubmission && (
            <Card>
              <CardHeader>
                <h2 className="font-semibold" style={{ color: colors.textPrimary }}>{t('your_submission')}</h2>
              </CardHeader>
              <CardBody>
                {mySubmission.content && (
                  <div className="prose max-w-none mb-4" style={{ color: colors.textSecondary }}>
                    <ReactMarkdown>{mySubmission.content}</ReactMarkdown>
                  </div>
                )}
                <p className="text-sm" style={{ color: colors.textMuted }}>
                  {t('submitted_on', { date: new Date(mySubmission.submittedAt).toLocaleString() })}
                </p>
              </CardBody>
            </Card>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Grade Card (if graded) */}
          {isGraded && mySubmission && (
            <Card style={{ backgroundColor: colors.bgGreenCard, borderColor: colors.borderGreen }}>
              <CardHeader>
                <h2 className="font-semibold flex items-center gap-2" style={{ color: colors.textGreen }}>
                  <Award className="w-5 h-5" />
                  {t('your_grade')}
                </h2>
              </CardHeader>
              <CardBody>
                <div className="text-center mb-4">
                  <span className="text-4xl font-bold" style={{ color: colors.textGreen }}>
                    {mySubmission.grade}
                  </span>
                  <span className="text-xl" style={{ color: colors.textGreen }}>/{assignment.points}</span>
                  <p className="text-sm mt-1" style={{ color: colors.textGreen }}>
                    {t('grade_percent', { percent: Math.round((mySubmission.grade! / assignment.points) * 100) })}
                  </p>
                </div>

                {mySubmission.feedback && (
                  <div className="border-t pt-4" style={{ borderColor: colors.borderGreen }}>
                    <h3 className="font-medium flex items-center gap-2 mb-2" style={{ color: colors.textGreen }}>
                      <MessageSquare className="w-4 h-4" />
                      {t('instructor_feedback')}
                    </h3>
                    <p className="text-sm" style={{ color: colors.textGreen }}>{mySubmission.feedback}</p>
                  </div>
                )}

                {mySubmission.gradedAt && (
                  <p className="text-xs mt-4" style={{ color: colors.textGreen }}>
                    {t('graded_on', { date: new Date(mySubmission.gradedAt).toLocaleString() })}
                  </p>
                )}
              </CardBody>
            </Card>
          )}

          {/* Submission Info */}
          <Card>
            <CardHeader>
              <h2 className="font-semibold" style={{ color: colors.textPrimary }}>{t('submission_info')}</h2>
            </CardHeader>
            <CardBody className="space-y-3 text-sm">
              <div className="flex items-center justify-between">
                <span style={{ color: colors.textSecondary }}>{t('status_label')}</span>
                <span className="font-medium capitalize" style={{ color: colors.textPrimary }}>
                  {mySubmission?.status || t('not_started_status')}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span style={{ color: colors.textSecondary }}>{t('common:type')}</span>
                <span className="font-medium capitalize" style={{ color: colors.textPrimary }}>{assignment.submissionType}</span>
              </div>
              <div className="flex items-center justify-between">
                <span style={{ color: colors.textSecondary }}>{t('n_points', { count: assignment.points }).replace(/^\d+\s*/, '')}</span>
                <span className="font-medium" style={{ color: colors.textPrimary }}>{assignment.points}</span>
              </div>
              {dueDate && (
                <div className="flex items-center justify-between">
                  <span style={{ color: colors.textSecondary }}>{t('due_date_label')}</span>
                  <span className="font-medium" style={{ color: isPastDue ? colors.textRed : colors.textPrimary }}>
                    {dueDate.toLocaleDateString()}
                  </span>
                </div>
              )}
              {mySubmission?.submittedAt && (
                <div className="flex items-center justify-between">
                  <span style={{ color: colors.textSecondary }}>{t('submitted_status')}</span>
                  <span className="font-medium" style={{ color: colors.textPrimary }}>
                    {new Date(mySubmission.submittedAt).toLocaleDateString()}
                  </span>
                </div>
              )}
            </CardBody>
          </Card>
        </div>
      </div>

      {/* Post-Assignment Survey Modal */}
      {assignment?.postSurveyId && (
        <PostAssignmentSurveyModal
          surveyId={assignment.postSurveyId}
          assignmentId={parsedAssignmentId}
          isRequired={assignment.postSurveyRequired ?? false}
          isOpen={showSurveyModal}
          onClose={() => setShowSurveyModal(false)}
          onComplete={() => {
            toast.success(t('thank_you_feedback'));
          }}
        />
      )}
    </div>
  );
};

// Status Badge Component
const StatusBadge = ({
  isGraded,
  isSubmitted,
  isPastDue,
  hasDraft,
  grade,
  points,
  colors,
}: {
  isGraded: boolean;
  isSubmitted: boolean;
  isPastDue: boolean;
  hasDraft: boolean;
  grade?: number | null;
  points: number;
  colors: Record<string, string>;
}) => {
  const { t } = useTranslation(['courses']);
  if (isGraded) {
    return (
      <span
        className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium"
        style={{ backgroundColor: colors.bgGreen, color: colors.textGreen }}
      >
        <Award className="w-4 h-4" />
        {t('graded_with_score', { grade, total: points })}
      </span>
    );
  }
  if (isSubmitted) {
    return (
      <span
        className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium"
        style={{ backgroundColor: colors.bgBlue, color: colors.textBlue }}
      >
        <CheckCircle className="w-4 h-4" />
        {t('submitted_status')}
      </span>
    );
  }
  if (isPastDue) {
    return (
      <span
        className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium"
        style={{ backgroundColor: colors.bgRed, color: colors.textRed }}
      >
        <AlertCircle className="w-4 h-4" />
        {t('past_due_status')}
      </span>
    );
  }
  if (hasDraft) {
    return (
      <span
        className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium"
        style={{ backgroundColor: colors.bgYellow, color: colors.textYellow }}
      >
        <Clock className="w-4 h-4" />
        {t('draft_saved_status')}
      </span>
    );
  }
  return (
    <span
      className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium"
      style={{ backgroundColor: colors.bgGray, color: colors.textGray }}
    >
      <FileText className="w-4 h-4" />
      {t('not_started_status')}
    </span>
  );
};
