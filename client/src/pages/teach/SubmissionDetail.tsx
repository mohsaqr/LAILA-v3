import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  ArrowLeft,
  User,
  Calendar,
  Award,
  AlertCircle,
  FileText,
  Download,
  CheckCircle,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { assignmentsApi } from '../../api/assignments';
import { coursesApi } from '../../api/courses';
import { Card, CardBody } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { Loading } from '../../components/common/Loading';
import { StatusBadge } from '../../components/common/StatusBadge';
import { Input, TextArea } from '../../components/common/Input';
import { Breadcrumb } from '../../components/common/Breadcrumb';
import { buildTeachingBreadcrumb } from '../../utils/breadcrumbs';
import { resolveFileUrl } from '../../api/client';
import { sanitizeHtml, isHtmlContent } from '../../utils/sanitize';

export const SubmissionDetail = () => {
  const { t } = useTranslation(['teaching', 'common', 'navigation']);
  const { id, assignmentId, submissionId } = useParams<{
    id: string;
    assignmentId: string;
    submissionId: string;
  }>();
  const courseId = parseInt(id!, 10);
  const assId = parseInt(assignmentId!, 10);
  const subId = parseInt(submissionId!, 10);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [gradeForm, setGradeForm] = useState({ grade: 0, feedback: '' });

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

  const { data: submission, isLoading: submissionLoading } = useQuery({
    queryKey: ['submission', subId],
    queryFn: () => assignmentsApi.getSubmissionById(subId),
    enabled: !!subId,
  });

  // Initialise form when submission loads
  useEffect(() => {
    if (submission) {
      setGradeForm({
        grade: submission.grade ?? 0,
        feedback: submission.feedback ?? '',
      });
    }
  }, [submission?.id]);

  const gradeMutation = useMutation({
    mutationFn: () =>
      assignmentsApi.gradeSubmission(subId, {
        grade: gradeForm.grade,
        feedback: gradeForm.feedback,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['submission', subId] });
      queryClient.invalidateQueries({ queryKey: ['assignmentSubmissions', assId] });
      toast.success(t('submission_graded'));
    },
    onError: () => toast.error(t('failed_to_grade_submission')),
  });

  const handleFileDownload = async (fileUrl: string, fileName: string) => {
    const url = resolveFileUrl(fileUrl);
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error('failed');
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(blobUrl), 100);
    } catch {
      window.open(url, '_blank');
    }
  };

  const handleGradeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (gradeForm.grade < 0 || gradeForm.grade > (assignment?.points ?? 100)) {
      toast.error(t('grade_range_error', { max: assignment?.points ?? 100 }));
      return;
    }
    gradeMutation.mutate();
  };

  if (assignmentLoading || submissionLoading) {
    return <Loading fullScreen text={t('loading_submission')} />;
  }

  if (!assignment || !submission) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8 text-center">
        <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
        <h1 className="text-2xl font-bold text-gray-900 mb-4">{t('submission_not_found')}</h1>
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

  const isGraded = submission.status === 'graded';
  let fileUrls: string[] = [];
  try {
    const parsed = submission.fileUrls ? JSON.parse(submission.fileUrls) : [];
    fileUrls = Array.isArray(parsed)
      ? parsed.filter((v): v is string => typeof v === 'string')
      : [];
  } catch {
    fileUrls = [];
  }

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

  const breadcrumbItems = [
    ...buildTeachingBreadcrumb(id, course?.title ?? t('course'), t('navigation:assignments')),
    {
      label: assignment.title,
      href: `/teach/courses/${courseId}/assignments/${assId}/submissions`,
    },
    { label: submission.user?.fullname ?? t('unknown_student') },
  ];

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-6">
        <Breadcrumb homeHref="/" items={breadcrumbItems} />
      </div>

      {/* Back button */}
      <div className="mb-6">
        <Button
          variant="ghost"
          size="sm"
          onClick={() =>
            navigate(`/teach/courses/${courseId}/assignments/${assId}/submissions`)
          }
          icon={<ArrowLeft className="w-4 h-4" />}
        >
          {t('back_to_submissions')}
        </Button>
      </div>

      {/* Submission Header */}
      <Card className="mb-6">
        <CardBody>
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
            <div>
              <h1 className="text-xl font-bold text-gray-900 mb-3">{assignment.title}</h1>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-9 h-9 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0">
                  <User className="w-5 h-5 text-gray-500" />
                </div>
                <div>
                  <p className="font-medium text-gray-900">
                    {submission.user?.fullname ?? t('unknown_student')}
                  </p>
                  <p className="text-sm text-gray-500">{submission.user?.email}</p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-4 text-sm">
                <div className="flex items-center gap-1.5 text-gray-500">
                  <Calendar className="w-4 h-4" />
                  <span>{t('submitted_at', { date: formatDate(submission.submittedAt) })}</span>
                </div>
                <div className="flex items-center gap-1.5 text-gray-500">
                  <Award className="w-4 h-4" />
                  <span>{t('x_points', { count: assignment.points })}</span>
                </div>
                <StatusBadge status={isGraded ? 'graded' : 'submitted'} />
              </div>
            </div>

            {isGraded && (
              <div className="text-right flex-shrink-0">
                <div className="text-3xl font-bold text-green-600">
                  {submission.grade}/{assignment.points}
                </div>
                <p className="text-sm text-gray-500">{t('grade')}</p>
                {submission.gradedBy && (
                  <p className="text-xs text-gray-400 mt-1">
                    {t('graded_by', { name: submission.gradedBy.fullname })}
                  </p>
                )}
              </div>
            )}
          </div>
        </CardBody>
      </Card>

      {/* Text Answer */}
      {submission.content && (
        <Card className="mb-6">
          <CardBody>
            <h2 className="text-base font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <FileText className="w-4 h-4 text-gray-500" />
              {t('text_answer')}
            </h2>
            <div className="bg-gray-50 rounded-lg p-4 border border-gray-100">
              {isHtmlContent(submission.content) ? (
                <div
                  className="prose prose-sm max-w-none text-gray-800"
                  dangerouslySetInnerHTML={{ __html: sanitizeHtml(submission.content) }}
                />
              ) : (
                <p className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">
                  {submission.content}
                </p>
              )}
            </div>
          </CardBody>
        </Card>
      )}

      {/* File Attachments */}
      {fileUrls.length > 0 && (
        <Card className="mb-6">
          <CardBody>
            <h2 className="text-base font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <Download className="w-4 h-4 text-gray-500" />
              {t('submitted_files', { count: fileUrls.length })}
            </h2>
            <div className="space-y-2">
              {fileUrls.map((url, index) => {
                const rawName = url.split('/').pop() ?? `file-${index + 1}`;
                let displayName: string;
                try {
                  displayName = decodeURIComponent(rawName.replace(/^[\w-]{36}/, '').replace(/^-/, '')) || rawName;
                } catch {
                  displayName = rawName;
                }
                const isPdf = url.toLowerCase().endsWith('.pdf') || displayName.toLowerCase().endsWith('.pdf');
                const resolvedUrl = resolveFileUrl(url);

                if (isPdf) {
                  return (
                    <div key={index} className="rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
                      {/* Header row */}
                      <div className="flex items-center justify-between px-4 py-2.5 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
                        <div className="flex items-center gap-2">
                          <FileText className="w-4 h-4 text-indigo-500" />
                          <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{displayName}</span>
                        </div>
                        <button onClick={() => handleFileDownload(url, displayName)}
                          className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-indigo-600 transition-colors">
                          <Download className="w-3.5 h-3.5" /> Download
                        </button>
                      </div>
                      {/* Inline viewer */}
                      <iframe src={resolvedUrl} className="w-full border-0" style={{ height: '700px' }}
                        title={displayName} sandbox="allow-same-origin" />
                    </div>
                  );
                }

                return (
                  <button
                    key={index}
                    onClick={() => handleFileDownload(url, displayName)}
                    className="w-full flex items-center gap-3 p-3 border border-gray-200 rounded-lg hover:bg-blue-50 hover:border-blue-300 transition-colors text-left"
                  >
                    <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0">
                      <Download className="w-4 h-4 text-blue-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{displayName}</p>
                      <p className="text-xs text-gray-500">{t('click_to_download')}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </CardBody>
        </Card>
      )}

      {/* No answer provided */}
      {!submission.content && fileUrls.length === 0 && (
        <Card className="mb-6">
          <CardBody>
            <div className="text-center py-8 text-gray-400">
              <FileText className="w-10 h-10 mx-auto mb-2" />
              <p className="text-sm">{t('no_answer_provided')}</p>
            </div>
          </CardBody>
        </Card>
      )}

      {/* Grade & Notes */}
      <Card>
        <CardBody>
          <h2 className="text-base font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Award className="w-4 h-4 text-gray-500" />
            {isGraded ? t('update_grade') : t('grade_submission')}
          </h2>

          <form onSubmit={handleGradeSubmit} className="space-y-4">
            <Input
              label={t('grade_out_of', { max: assignment.points })}
              type="number"
              value={gradeForm.grade}
              onChange={e =>
                setGradeForm(f => ({ ...f, grade: parseInt(e.target.value) || 0 }))
              }
              min={0}
              max={assignment.points}
              required
            />

            <TextArea
              label={t('notes_and_feedback')}
              value={gradeForm.feedback}
              onChange={e => setGradeForm(f => ({ ...f, feedback: e.target.value }))}
              placeholder={t('feedback_placeholder')}
              rows={5}
            />

            <div className="flex items-center justify-end gap-3 pt-2 border-t">
              <Button
                type="button"
                variant="secondary"
                onClick={() =>
                  navigate(`/teach/courses/${courseId}/assignments/${assId}/submissions`)
                }
              >
                {t('common:cancel')}
              </Button>
              <Button
                type="submit"
                loading={gradeMutation.isPending}
                icon={<CheckCircle className="w-4 h-4" />}
              >
                {isGraded ? t('update_grade') : t('submit_grade')}
              </Button>
            </div>
          </form>
        </CardBody>
      </Card>
    </div>
  );
};
