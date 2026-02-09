import { useQuery } from '@tanstack/react-query';
import { useParams, Link } from 'react-router-dom';
import {
  ArrowLeft,
  FileText,
  Clock,
  CheckCircle,
  AlertCircle,
  Calendar,
  Award,
  Bot,
  TrendingUp,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { assignmentsApi } from '../api/assignments';
import { enrollmentsApi } from '../api/enrollments';
import { useTheme } from '../hooks/useTheme';
import { Card, CardBody } from '../components/common/Card';
import { Loading } from '../components/common/Loading';
import { Button } from '../components/common/Button';
import { Assignment } from '../types';

export const StudentAssignments = () => {
  const { t } = useTranslation(['courses', 'common']);
  const { courseId } = useParams<{ courseId: string }>();
  const parsedCourseId = parseInt(courseId!, 10);
  const { isDark } = useTheme();

  // Theme colors
  const colors = {
    bg: isDark ? '#111827' : '#f9fafb',
    textPrimary: isDark ? '#f3f4f6' : '#111827',
    textSecondary: isDark ? '#9ca3af' : '#6b7280',
    textMuted: isDark ? '#6b7280' : '#9ca3af',
    // Status badge colors
    bgGreen: isDark ? 'rgba(34, 197, 94, 0.2)' : '#dcfce7',
    textGreen: isDark ? '#86efac' : '#15803d',
    bgBlue: isDark ? 'rgba(59, 130, 246, 0.2)' : '#dbeafe',
    textBlue: isDark ? '#93c5fd' : '#1d4ed8',
    bgRed: isDark ? 'rgba(239, 68, 68, 0.2)' : '#fee2e2',
    textRed: isDark ? '#fca5a5' : '#dc2626',
    bgYellow: isDark ? 'rgba(245, 158, 11, 0.2)' : '#fef3c7',
    textYellow: isDark ? '#fcd34d' : '#d97706',
    bgGray: isDark ? '#374151' : '#f3f4f6',
    textGray: isDark ? '#9ca3af' : '#6b7280',
    bgTeal: isDark ? 'rgba(8, 143, 143, 0.2)' : '#f0fdfd',
    textTeal: isDark ? '#5eecec' : '#088F8F',
  };

  const { data: enrollment, isLoading: enrollmentLoading } = useQuery({
    queryKey: ['enrollment', courseId],
    queryFn: () => enrollmentsApi.getEnrollment(parsedCourseId),
  });

  const { data: assignments, isLoading: assignmentsLoading } = useQuery({
    queryKey: ['courseAssignments', courseId],
    queryFn: () => assignmentsApi.getAssignments(parsedCourseId),
    enabled: !!enrollment?.enrolled,
  });

  if (enrollmentLoading || assignmentsLoading) {
    return <Loading fullScreen text={t('loading_assignments')} />;
  }

  if (!enrollment?.enrolled) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card>
          <CardBody className="text-center py-8 px-12">
            <h2 className="text-xl font-bold mb-2" style={{ color: colors.textPrimary }}>{t('not_enrolled_title')}</h2>
            <p className="mb-4" style={{ color: colors.textSecondary }}>{t('need_enroll_assignments')}</p>
            <Link to={`/catalog/${courseId}`} className="btn btn-primary">
              {t('view_course')}
            </Link>
          </CardBody>
        </Card>
      </div>
    );
  }

  const course = enrollment.enrollment?.course;
  const publishedAssignments = assignments?.filter(a => a.isPublished) || [];

  // Sort assignments by due date (upcoming first, then no due date, then past due)
  const sortedAssignments = [...publishedAssignments].sort((a, b) => {
    if (!a.dueDate && !b.dueDate) return 0;
    if (!a.dueDate) return 1;
    if (!b.dueDate) return -1;
    return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
  });

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8" style={{ minHeight: '100vh' }}>
      {/* Header */}
      <div className="mb-6">
        <Link to={`/learn/${courseId}`}>
          <Button variant="ghost" size="sm" icon={<ArrowLeft className="w-4 h-4" />}>
            {t('back_to_course')}
          </Button>
        </Link>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold mb-2" style={{ color: colors.textPrimary }}>{t('assignments')}</h1>
          <p style={{ color: colors.textSecondary }}>{course?.title}</p>
        </div>
        <Link to={`/courses/${parsedCourseId}/grades`}>
          <Button variant="secondary" icon={<TrendingUp className="w-4 h-4" />}>
            {t('my_grades')}
          </Button>
        </Link>
      </div>

      {sortedAssignments.length > 0 ? (
        <div className="space-y-4">
          {sortedAssignments.map(assignment => (
            <AssignmentCard key={assignment.id} assignment={assignment} courseId={parsedCourseId} colors={colors} />
          ))}
        </div>
      ) : (
        <Card>
          <CardBody className="text-center py-12">
            <FileText className="w-16 h-16 mx-auto mb-4" style={{ color: colors.textMuted }} />
            <h3 className="text-lg font-medium mb-2" style={{ color: colors.textPrimary }}>{t('no_assignments_yet')}</h3>
            <p style={{ color: colors.textSecondary }}>{t('check_back_later_assignments')}</p>
          </CardBody>
        </Card>
      )}
    </div>
  );
};

interface AssignmentCardProps {
  assignment: Assignment;
  courseId: number;
  colors: Record<string, string>;
}

const AssignmentCard = ({ assignment, courseId, colors }: AssignmentCardProps) => {
  const { t } = useTranslation(['courses']);
  const { data: mySubmission } = useQuery({
    queryKey: ['mySubmission', assignment.id],
    queryFn: () => assignmentsApi.getMySubmission(assignment.id),
  });

  const isAgentAssignment = assignment.submissionType === 'ai_agent';
  const now = new Date();
  const dueDate = assignment.dueDate ? new Date(assignment.dueDate) : null;
  const isPastDue = dueDate && dueDate < now;
  const isSubmitted = mySubmission?.status === 'submitted' || mySubmission?.status === 'graded';
  const isGraded = mySubmission?.status === 'graded';

  const getStatusBadge = () => {
    if (isGraded) {
      return (
        <span
          className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium"
          style={{ backgroundColor: colors.bgGreen, color: colors.textGreen }}
        >
          <Award className="w-3 h-3" />
          {t('graded_with_score', { grade: mySubmission?.grade, total: assignment.points })}
        </span>
      );
    }
    if (isSubmitted) {
      return (
        <span
          className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium"
          style={{ backgroundColor: colors.bgBlue, color: colors.textBlue }}
        >
          <CheckCircle className="w-3 h-3" />
          {t('submitted_status')}
        </span>
      );
    }
    if (isPastDue) {
      return (
        <span
          className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium"
          style={{ backgroundColor: colors.bgRed, color: colors.textRed }}
        >
          <AlertCircle className="w-3 h-3" />
          {t('past_due_status')}
        </span>
      );
    }
    if (mySubmission?.status === 'draft') {
      return (
        <span
          className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium"
          style={{ backgroundColor: colors.bgYellow, color: colors.textYellow }}
        >
          <Clock className="w-3 h-3" />
          {t('draft_saved_status')}
        </span>
      );
    }
    return (
      <span
        className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium"
        style={{ backgroundColor: colors.bgGray, color: colors.textGray }}
      >
        <FileText className="w-3 h-3" />
        {t('not_started_status')}
      </span>
    );
  };

  // Use different URL for AI agent assignments
  const assignmentUrl = isAgentAssignment
    ? `/courses/${courseId}/agent-assignments/${assignment.id}`
    : `/courses/${courseId}/assignments/${assignment.id}`;

  return (
    <Link to={assignmentUrl}>
      <Card hover>
        <CardBody className="flex items-center gap-4">
          <div
            className="w-12 h-12 rounded-lg flex items-center justify-center"
            style={{
              backgroundColor: isAgentAssignment
                ? colors.bgTeal
                : isGraded ? colors.bgGreen : isSubmitted ? colors.bgBlue : colors.bgGray
            }}
          >
            {isAgentAssignment ? (
              <Bot className="w-6 h-6" style={{ color: colors.textTeal }} />
            ) : (
              <FileText
                className="w-6 h-6"
                style={{ color: isGraded ? colors.textGreen : isSubmitted ? colors.textBlue : colors.textGray }}
              />
            )}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="font-semibold truncate" style={{ color: colors.textPrimary }}>{assignment.title}</h3>
              {isAgentAssignment && (
                <span
                  className="text-xs px-2 py-0.5 rounded"
                  style={{ backgroundColor: colors.bgTeal, color: colors.textTeal }}
                >
                  {t('ai_agent_label')}
                </span>
              )}
              {getStatusBadge()}
            </div>
            <div className="flex items-center gap-4 text-sm" style={{ color: colors.textSecondary }}>
              <span className="flex items-center gap-1">
                <Award className="w-4 h-4" />
                {t('points_format', { points: assignment.points })}
              </span>
              {dueDate && (
                <span
                  className="flex items-center gap-1"
                  style={{ color: isPastDue && !isSubmitted ? colors.textRed : colors.textSecondary }}
                >
                  <Calendar className="w-4 h-4" />
                  {t('due_at', { date: dueDate.toLocaleDateString(), time: dueDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) })}
                </span>
              )}
              {assignment.module && (
                <span>{assignment.module.title}</span>
              )}
            </div>
          </div>

          <div className="flex-shrink-0">
            <span className="font-medium text-sm text-primary-600">
              {isAgentAssignment
                ? (isGraded ? t('view_grade') : isSubmitted ? t('view_agent') : t('build_agent'))
                : (isGraded ? t('view_grade') : isSubmitted ? t('view_submission') : t('common:view'))
              }
            </span>
          </div>
        </CardBody>
      </Card>
    </Link>
  );
};
