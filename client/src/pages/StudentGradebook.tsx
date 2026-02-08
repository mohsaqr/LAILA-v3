import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useParams, Link } from 'react-router-dom';
import {
  ArrowLeft,
  FileText,
  Calendar,
  Award,
  CheckCircle,
  Clock,
  AlertCircle,
  Bot,
  TrendingUp,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { assignmentsApi } from '../api/assignments';
import { enrollmentsApi } from '../api/enrollments';
import { useTheme } from '../hooks/useTheme';
import { Card, CardBody } from '../components/common/Card';
import { Loading } from '../components/common/Loading';
import { Button } from '../components/common/Button';
import { Assignment } from '../types';

type SortOption = 'dueDate' | 'grade' | 'status' | 'title';
type SortDirection = 'asc' | 'desc';

export const StudentGradebook = () => {
  const { t } = useTranslation(['courses', 'common']);
  const { courseId } = useParams<{ courseId: string }>();
  const parsedCourseId = parseInt(courseId!, 10);
  const { isDark } = useTheme();

  const [sortBy, setSortBy] = useState<SortOption>('dueDate');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  // Theme colors
  const colors = {
    bg: isDark ? '#111827' : '#f9fafb',
    bgCard: isDark ? '#1f2937' : '#ffffff',
    textPrimary: isDark ? '#f3f4f6' : '#111827',
    textSecondary: isDark ? '#9ca3af' : '#6b7280',
    textMuted: isDark ? '#6b7280' : '#9ca3af',
    border: isDark ? '#374151' : '#e5e7eb',
    // Status colors
    bgGreen: isDark ? 'rgba(34, 197, 94, 0.2)' : '#dcfce7',
    textGreen: isDark ? '#86efac' : '#15803d',
    bgBlue: isDark ? 'rgba(59, 130, 246, 0.2)' : '#dbeafe',
    textBlue: isDark ? '#93c5fd' : '#1d4ed8',
    bgYellow: isDark ? 'rgba(245, 158, 11, 0.2)' : '#fef3c7',
    textYellow: isDark ? '#fcd34d' : '#d97706',
    bgRed: isDark ? 'rgba(239, 68, 68, 0.2)' : '#fee2e2',
    textRed: isDark ? '#fca5a5' : '#dc2626',
    bgGray: isDark ? '#374151' : '#f3f4f6',
    textGray: isDark ? '#9ca3af' : '#6b7280',
    bgTeal: isDark ? 'rgba(8, 143, 143, 0.2)' : '#f0fdfd',
    textTeal: isDark ? '#5eecec' : '#088F8F',
    // Summary card
    bgSummary: isDark ? 'rgba(34, 197, 94, 0.1)' : '#f0fdf4',
    borderSummary: isDark ? 'rgba(34, 197, 94, 0.3)' : '#bbf7d0',
    bgIndigo: isDark ? 'rgba(99, 102, 241, 0.2)' : '#e0e7ff',
    textIndigo: isDark ? '#a5b4fc' : '#4f46e5',
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

  // Fetch submission status for each assignment
  const assignmentIds = assignments?.filter(a => a.isPublished).map(a => a.id) || [];
  const { data: submissions } = useQuery({
    queryKey: ['mySubmissions', assignmentIds],
    queryFn: async () => {
      const results = await Promise.all(
        assignmentIds.map(async id => {
          try {
            const submission = await assignmentsApi.getMySubmission(id);
            return { assignmentId: id, submission };
          } catch {
            return { assignmentId: id, submission: null };
          }
        })
      );
      return results;
    },
    enabled: assignmentIds.length > 0,
  });

  if (enrollmentLoading || assignmentsLoading) {
    return <Loading fullScreen text={t('loading_grades')} />;
  }

  if (!enrollment?.enrolled) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card>
          <CardBody className="text-center py-8 px-12">
            <h2 className="text-xl font-bold mb-2" style={{ color: colors.textPrimary }}>{t('not_enrolled_title')}</h2>
            <p className="mb-4" style={{ color: colors.textSecondary }}>{t('need_enroll_grades')}</p>
            <Link to={`/courses/${courseId}`}>
              <Button>{t('view_course')}</Button>
            </Link>
          </CardBody>
        </Card>
      </div>
    );
  }

  const course = enrollment.enrollment?.course;
  const publishedAssignments = assignments?.filter(a => a.isPublished) || [];

  // Get submission for an assignment
  const getSubmission = (assignmentId: number) => {
    return submissions?.find(s => s.assignmentId === assignmentId)?.submission;
  };

  // Calculate overall grade
  const calculateOverallGrade = () => {
    let totalEarned = 0;
    let totalPossible = 0;
    let gradedCount = 0;

    publishedAssignments.forEach(assignment => {
      const submission = getSubmission(assignment.id);
      totalPossible += assignment.points;
      if (submission?.grade !== null && submission?.grade !== undefined) {
        totalEarned += submission.grade;
        gradedCount++;
      }
    });

    return {
      totalEarned,
      totalPossible,
      percentage: totalPossible > 0 ? Math.round((totalEarned / totalPossible) * 100) : 0,
      gradedCount,
      totalCount: publishedAssignments.length,
    };
  };

  // Sort assignments
  const sortAssignments = (assignmentsList: Assignment[]) => {
    return [...assignmentsList].sort((a, b) => {
      const subA = getSubmission(a.id);
      const subB = getSubmission(b.id);

      let comparison = 0;

      switch (sortBy) {
        case 'dueDate':
          if (!a.dueDate && !b.dueDate) comparison = 0;
          else if (!a.dueDate) comparison = 1;
          else if (!b.dueDate) comparison = -1;
          else comparison = new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
          break;
        case 'grade':
          const gradeA = subA?.grade ?? -1;
          const gradeB = subB?.grade ?? -1;
          comparison = gradeA - gradeB;
          break;
        case 'status':
          const statusOrder = { graded: 0, submitted: 1, draft: 2, none: 3 };
          const statusA = subA?.status || 'none';
          const statusB = subB?.status || 'none';
          comparison = (statusOrder[statusA as keyof typeof statusOrder] || 3) - (statusOrder[statusB as keyof typeof statusOrder] || 3);
          break;
        case 'title':
          comparison = a.title.localeCompare(b.title);
          break;
      }

      return sortDirection === 'asc' ? comparison : -comparison;
    });
  };

  const toggleSort = (option: SortOption) => {
    if (sortBy === option) {
      setSortDirection(d => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(option);
      setSortDirection('asc');
    }
  };

  const overallGrade = calculateOverallGrade();
  const sortedAssignments = sortAssignments(publishedAssignments);

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8" style={{ minHeight: '100vh' }}>
      {/* Header */}
      <div className="mb-6">
        <Link to={`/courses/${courseId}/assignments`}>
          <Button variant="ghost" size="sm" icon={<ArrowLeft className="w-4 h-4" />}>
            {t('back_to_assignments')}
          </Button>
        </Link>
      </div>

      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2" style={{ color: colors.textPrimary }}>{t('my_grades')}</h1>
        <p style={{ color: colors.textSecondary }}>{course?.title}</p>
      </div>

      {/* Overall Grade Summary */}
      <Card
        className="mb-8"
        style={{
          backgroundColor: colors.bgSummary,
          borderColor: colors.borderSummary,
          borderWidth: '1px',
        }}
      >
        <CardBody>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-4">
              <div
                className="w-16 h-16 rounded-full flex items-center justify-center"
                style={{ backgroundColor: colors.bgGreen }}
              >
                <TrendingUp className="w-8 h-8" style={{ color: colors.textGreen }} />
              </div>
              <div>
                <h2 className="text-lg font-semibold" style={{ color: colors.textGreen }}>
                  {t('overall_grade')}
                </h2>
                <p className="text-sm" style={{ color: colors.textSecondary }}>
                  {t('assignments_graded_of', { graded: overallGrade.gradedCount, total: overallGrade.totalCount })}
                </p>
              </div>
            </div>
            <div className="text-center sm:text-right">
              <div className="text-4xl font-bold" style={{ color: colors.textGreen }}>
                {overallGrade.percentage}%
              </div>
              <div className="text-sm" style={{ color: colors.textSecondary }}>
                {overallGrade.totalEarned}/{overallGrade.totalPossible} {t('n_points', { count: overallGrade.totalPossible }).replace(/^\d+\s*/, '')}
              </div>
            </div>
          </div>
        </CardBody>
      </Card>

      {/* Sort Options */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <span className="text-sm" style={{ color: colors.textSecondary }}>{t('sort_by_label')}</span>
        {[
          { key: 'dueDate', label: t('due_date_label') },
          { key: 'grade', label: t('grade_label') },
          { key: 'status', label: t('status_label') },
          { key: 'title', label: t('title_label') },
        ].map(option => (
          <button
            key={option.key}
            onClick={() => toggleSort(option.key as SortOption)}
            className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm transition-colors"
            style={{
              backgroundColor: sortBy === option.key ? colors.bgIndigo : colors.bgGray,
              color: sortBy === option.key ? colors.textIndigo : colors.textSecondary,
            }}
          >
            {option.label}
            {sortBy === option.key && (
              sortDirection === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />
            )}
          </button>
        ))}
      </div>

      {/* Assignments List */}
      {sortedAssignments.length > 0 ? (
        <div className="space-y-4">
          {sortedAssignments.map(assignment => (
            <AssignmentGradeCard
              key={assignment.id}
              assignment={assignment}
              submission={getSubmission(assignment.id)}
              courseId={parsedCourseId}
              colors={colors}
            />
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

interface AssignmentGradeCardProps {
  assignment: Assignment;
  submission: {
    status: string;
    grade: number | null;
    submittedAt: string;
  } | null | undefined;
  courseId: number;
  colors: Record<string, string>;
}

const AssignmentGradeCard = ({ assignment, submission, courseId, colors }: AssignmentGradeCardProps) => {
  const { t } = useTranslation(['courses', 'common']);
  const isAgentAssignment = assignment.submissionType === 'ai_agent';
  const now = new Date();
  const dueDate = assignment.dueDate ? new Date(assignment.dueDate) : null;
  const isPastDue = dueDate && dueDate < now;
  const isSubmitted = submission?.status === 'submitted' || submission?.status === 'graded';
  const isGraded = submission?.status === 'graded';

  const getStatusBadge = () => {
    if (isGraded) {
      return (
        <span
          className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium"
          style={{ backgroundColor: colors.bgGreen, color: colors.textGreen }}
        >
          <CheckCircle className="w-3 h-3" />
          {t('common:completed')}
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
    if (submission?.status === 'draft') {
      return (
        <span
          className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium"
          style={{ backgroundColor: colors.bgYellow, color: colors.textYellow }}
        >
          <Clock className="w-3 h-3" />
          {t('common:draft')}
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

  const assignmentUrl = isAgentAssignment
    ? `/courses/${courseId}/agent-assignments/${assignment.id}`
    : `/courses/${courseId}/assignments/${assignment.id}`;

  return (
    <Link to={assignmentUrl}>
      <Card hover>
        <CardBody className="flex items-center gap-4">
          {/* Icon */}
          <div
            className="w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{
              backgroundColor: isAgentAssignment
                ? colors.bgTeal
                : isGraded ? colors.bgGreen : isSubmitted ? colors.bgBlue : colors.bgGray,
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

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <h3 className="font-semibold truncate" style={{ color: colors.textPrimary }}>
                {assignment.title}
              </h3>
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
            <div className="flex flex-wrap items-center gap-4 text-sm" style={{ color: colors.textSecondary }}>
              {dueDate && (
                <span
                  className="flex items-center gap-1"
                  style={{ color: isPastDue && !isSubmitted ? colors.textRed : colors.textSecondary }}
                >
                  <Calendar className="w-4 h-4" />
                  {t('due_date', { date: dueDate.toLocaleDateString() })}
                </span>
              )}
              <span className="flex items-center gap-1">
                <Award className="w-4 h-4" />
                {t('points_format', { points: assignment.points })}
              </span>
            </div>
          </div>

          {/* Grade Display */}
          <div className="text-right flex-shrink-0">
            {isGraded && submission?.grade !== null && submission?.grade !== undefined ? (
              <div>
                <div className="text-2xl font-bold" style={{ color: colors.textGreen }}>
                  {submission.grade}
                </div>
                <div className="text-sm" style={{ color: colors.textSecondary }}>
                  /{assignment.points}
                </div>
                <div className="text-xs" style={{ color: colors.textGreen }}>
                  {t('grade_percent', { percent: Math.round((submission.grade / assignment.points) * 100) })}
                </div>
              </div>
            ) : (
              <div className="text-sm" style={{ color: colors.textMuted }}>
                --/{assignment.points}
              </div>
            )}
          </div>
        </CardBody>
      </Card>
    </Link>
  );
};
