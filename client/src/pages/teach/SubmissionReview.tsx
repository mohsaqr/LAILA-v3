import { useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Award,
  Check,
  Clock,
  Calendar,
  FileText,
  ExternalLink,
  Bot,
  User,
} from 'lucide-react';
import { resolveFileUrl } from '../../api/client';
import { assignmentsApi } from '../../api/assignments';
import { agentAssignmentsApi } from '../../api/agentAssignments';
import { coursesApi } from '../../api/courses';
import { Card, CardBody } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { Loading } from '../../components/common/Loading';
import { Breadcrumb } from '../../components/common/Breadcrumb';
import { StatusBadge } from '../../components/common/StatusBadge';
import { DataTable, type ColumnDef } from '../../components/common/DataTable';
import { RowMenu } from '../../components/common/RowMenu';
import { sanitizeHtml, isHtmlContent } from '../../utils/sanitize';
import { AssignmentSubmission } from '../../types';
import activityLogger from '../../services/activityLogger';
import { TrackedContent } from '../../components/common/TrackedContent';

type RowStatus = 'graded' | 'submitted' | 'pending' | 'draft';

interface SubmissionRow {
  id: number;
  studentName: string;
  studentEmail: string;
  avatarUrl?: string | null;
  status: RowStatus;
  grade: number | null;
  submittedAt: string | null;
  /** late = past due; grace = within the grace window. */
  late: boolean;
  grace: boolean;
  agentName?: string;
  onView: (() => void) | null;
}

export const SubmissionReview = () => {
  const { t } = useTranslation(['teaching', 'navigation', 'common', 'courses']);
  const { id, assignmentId } = useParams<{ id: string; assignmentId: string }>();
  const courseId = parseInt(id!, 10);
  const assId = parseInt(assignmentId!, 10);
  const navigate = useNavigate();

  useEffect(() => {
    if (assId && courseId) activityLogger.logSubmissionListViewed(assId, courseId);
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

  const { data: submissions = [], isLoading: submissionsLoading } = useQuery({
    queryKey: ['assignmentSubmissions', assId],
    queryFn: () => assignmentsApi.getSubmissions(assId),
    enabled: !!assId && !isAgentAssignment && !assignmentLoading,
  });

  const { data: agentSubmissions = [], isLoading: agentSubmissionsLoading } = useQuery({
    queryKey: ['agentSubmissions', assId],
    queryFn: () => agentAssignmentsApi.getAgentSubmissions(assId),
    enabled: !!assId && isAgentAssignment && !assignmentLoading,
  });

  const formatDate = (dateStr: string, utc = false) =>
    new Date(dateStr).toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      ...(utc ? { timeZone: 'UTC' } : {}),
    });

  const lateInfo = (submittedAt: string | null | undefined) => {
    if (!submittedAt || !assignment?.dueDate) return { late: false, grace: false };
    const s = new Date(submittedAt);
    const due = new Date(assignment.dueDate);
    if (s <= due) return { late: false, grace: false };
    if (
      assignment.gracePeriodDeadline &&
      s <= new Date(assignment.gracePeriodDeadline)
    )
      return { late: true, grace: true };
    return { late: true, grace: false };
  };

  const rows: SubmissionRow[] = useMemo(() => {
    if (isAgentAssignment) {
      return agentSubmissions.map((c) => {
        const status: RowStatus =
          c.submission?.status === 'graded'
            ? 'graded'
            : !c.isDraft
            ? 'submitted'
            : 'draft';
        const { late, grace } = lateInfo(c.submittedAt);
        return {
          id: c.id,
          studentName: c.user?.fullname || t('unknown_student'),
          studentEmail: c.user?.email || '',
          avatarUrl: (c.user as { avatarUrl?: string | null } | undefined)?.avatarUrl ?? null,
          status,
          grade: c.submission?.status === 'graded' ? c.submission.grade ?? null : null,
          submittedAt: c.submittedAt || null,
          late,
          grace,
          agentName: c.agentName,
          onView: c.submission
            ? () =>
                navigate(
                  `/teach/courses/${courseId}/assignments/${assId}/agent-submissions/${c.submission!.id}`,
                )
            : null,
        };
      });
    }
    return (submissions as AssignmentSubmission[]).map((s) => {
      const status: RowStatus =
        s.status === 'graded' ? 'graded' : s.status === 'submitted' ? 'submitted' : 'pending';
      const { late, grace } = lateInfo(s.submittedAt);
      return {
        id: s.id,
        studentName: s.user?.fullname || t('unknown_student'),
        studentEmail: s.user?.email || '',
        avatarUrl: s.user?.avatarUrl ?? null,
        status,
        grade: s.status === 'graded' ? s.grade ?? null : null,
        submittedAt: s.submittedAt || null,
        late,
        grace,
        onView: () =>
          navigate(`/teach/courses/${courseId}/assignments/${assId}/submissions/${s.id}`),
      };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAgentAssignment, agentSubmissions, submissions, assignment, courseId, assId]);

  const loading =
    assignmentLoading || (isAgentAssignment ? agentSubmissionsLoading : submissionsLoading);

  if (loading) return <Loading fullScreen text={t('loading_submissions')} />;

  if (!assignment) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 md:py-8 text-center">
        <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
          {t('assignment_not_found')}
        </h1>
        <Button onClick={() => navigate(`/teach/courses/${courseId}/assignments`)}>
          {t('back_to_assignments')}
        </Button>
      </div>
    );
  }

  const pendingCount = rows.filter((r) => r.status === 'submitted').length;
  const gradedCount = rows.filter((r) => r.status === 'graded').length;

  const studentOptions = Array.from(
    new Map(rows.map((r) => [r.studentName, r.studentName])).keys(),
  )
    .sort()
    .map((n) => ({ value: n, label: n }));

  const columns: ColumnDef<SubmissionRow>[] = [
    {
      id: 'student',
      header: t('teaching:student', { defaultValue: 'Student' }),
      sortAccessor: (r) => r.studentName.toLowerCase(),
      width: '30%',
      filter: {
        kind: 'select',
        options: studentOptions,
        predicate: (r, v) => r.studentName === v,
      },
      cell: (r) => (
        <div className="flex items-center gap-2.5 min-w-0">
          {r.avatarUrl ? (
            <img
              src={resolveFileUrl(r.avatarUrl) || ''}
              alt=""
              aria-hidden="true"
              className="w-7 h-7 rounded-full object-cover flex-shrink-0"
            />
          ) : (
            <span className="w-7 h-7 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center flex-shrink-0">
              <User className="w-4 h-4 text-gray-500 dark:text-gray-400" />
            </span>
          )}
          <div className="min-w-0">
            <p className="font-medium text-gray-800 dark:text-gray-100 truncate" title={r.studentName}>
              {r.studentName}
            </p>
            {r.studentEmail && (
              <p className="text-xs text-gray-500 dark:text-gray-400 truncate" title={r.studentEmail}>
                {r.studentEmail}
              </p>
            )}
          </div>
        </div>
      ),
    },
    ...(isAgentAssignment
      ? [
          {
            id: 'agent',
            header: t('teaching:agent', { defaultValue: 'Agent' }),
            sortAccessor: (r: SubmissionRow) => r.agentName?.toLowerCase() ?? '',
            hideOnMobile: true,
            width: '22%',
            cell: (r: SubmissionRow) => (
              <span className="text-gray-600 dark:text-gray-300 truncate">{r.agentName || '—'}</span>
            ),
          } as ColumnDef<SubmissionRow>,
        ]
      : []),
    {
      id: 'status',
      header: t('teaching:status', { defaultValue: 'Status' }),
      sortAccessor: (r) => r.status,
      width: '8rem',
      filter: {
        kind: 'select',
        options: [
          { value: 'submitted', label: t('common:status_submitted', { defaultValue: 'Submitted' }) },
          { value: 'graded', label: t('common:status_graded', { defaultValue: 'Graded' }) },
          { value: 'pending', label: t('common:status_pending', { defaultValue: 'Pending' }) },
          { value: 'draft', label: t('common:status_draft', { defaultValue: 'Draft' }) },
        ],
        predicate: (r, v) => r.status === v,
      },
      cell: (r) => <StatusBadge status={r.status} />,
    },
    {
      id: 'grade',
      header: t('teaching:grade', { defaultValue: 'Grade' }),
      sortAccessor: (r) => r.grade ?? -1,
      align: 'right',
      hideOnMobile: true,
      width: '7rem',
      cell: (r) =>
        r.grade != null ? (
          <span className="font-medium tabular-nums text-gray-800 dark:text-gray-100">
            {r.grade}/{assignment.points}
          </span>
        ) : (
          <span className="text-gray-400">—</span>
        ),
    },
    {
      id: 'submitted',
      header: t('teaching:submitted', { defaultValue: 'Submitted' }),
      sortAccessor: (r) => (r.submittedAt ? new Date(r.submittedAt).getTime() : 0),
      align: 'right',
      width: '13rem',
      filter: {
        kind: 'date',
        // v is YYYY-MM-DD from the calendar; match the same local day.
        predicate: (r, v) =>
          !!r.submittedAt &&
          new Date(r.submittedAt).toLocaleDateString('en-CA') === v,
      },
      cell: (r) =>
        r.submittedAt ? (
          <span
            className={`text-sm tabular-nums ${
              r.grace
                ? 'text-amber-600 font-medium'
                : r.late
                ? 'text-red-500 font-medium'
                : 'text-gray-600 dark:text-gray-300'
            }`}
          >
            {formatDate(r.submittedAt)}
            {r.grace && ` (${t('courses:grace_period_status', { defaultValue: 'Grace Period' })})`}
          </span>
        ) : (
          <span className="text-gray-400">—</span>
        ),
    },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 md:py-8">
      <div className="mb-6">
        <Breadcrumb
          homeHref="/"
          items={[
            { label: t('navigation:courses'), href: '/courses' },
            ...(course
              ? [{ label: course.title, href: `/teach/courses/${courseId}/curriculum` }]
              : []),
            { label: t('navigation:assignments'), href: `/teach/courses/${courseId}/assignments` },
            { label: assignment.title },
            { label: t('submissions') },
          ]}
        />
      </div>

      {/* Compact assignment header */}
      <Card className="mb-6">
        <CardBody>
          <div className="flex items-center gap-2 mb-1">
            {isAgentAssignment ? (
              <Bot className="w-4 h-4 text-violet-600" />
            ) : (
              <FileText className="w-4 h-4 text-blue-600" />
            )}
            <span className="text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
              {t('submissions')}
            </span>
          </div>
          <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            {assignment.title}
          </h1>
          {assignment.description &&
            (isHtmlContent(assignment.description) ? (
              <TrackedContent
                context="assignment"
                courseId={courseId}
                objectId={assId}
                objectTitle={assignment.title}
              >
                <div
                  className="text-sm text-gray-600 dark:text-gray-300 mt-1 prose prose-sm dark:prose-invert max-w-none"
                  dangerouslySetInnerHTML={{ __html: sanitizeHtml(assignment.description) }}
                />
              </TrackedContent>
            ) : (
              <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">
                {assignment.description}
              </p>
            ))}
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm mt-3 text-gray-500 dark:text-gray-400">
            <span className="flex items-center gap-1.5">
              <Award className="w-4 h-4" />
              {t('x_points', { count: assignment.points })}
            </span>
            <span className="flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-yellow-500" />
              {t('pending_count', { count: pendingCount })}
            </span>
            <span className="flex items-center gap-1.5">
              <Check className="w-4 h-4 text-green-500" />
              {t('graded_count', { count: gradedCount })}
            </span>
            <span className="flex items-center gap-1.5">
              <Calendar className="w-4 h-4" />
              {assignment.dueDate
                ? `${t('due_date')}: ${formatDate(assignment.dueDate, true)}`
                : t('no_due_date')}
            </span>
          </div>
        </CardBody>
      </Card>

      <DataTable<SubmissionRow>
        rows={rows}
        columns={columns}
        rowKey={(r) => r.id}
        pageSize={20}
        globalSearch={{
          placeholder: t('teaching:search_students', {
            defaultValue: 'Search by name or email…',
          }),
          predicate: (r, q) => {
            const lower = q.toLowerCase();
            return (
              r.studentName.toLowerCase().includes(lower) ||
              r.studentEmail.toLowerCase().includes(lower)
            );
          },
        }}
        empty={
          <div className="flex items-center justify-center gap-2 py-6 text-sm text-gray-500 dark:text-gray-400">
            <FileText className="w-4 h-4" />
            <span>{t('no_submissions_yet')}</span>
          </div>
        }
        rowActions={(r) =>
          r.onView ? (
            <RowMenu
              items={[
                {
                  key: 'view',
                  label: t('view_answer'),
                  icon: <ExternalLink className="w-3.5 h-3.5" />,
                  onClick: r.onView,
                },
              ]}
            />
          ) : null
        }
      />
    </div>
  );
};
