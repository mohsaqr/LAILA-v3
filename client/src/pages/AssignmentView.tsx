import { useState, useEffect, useRef, useMemo } from 'react';
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
  Download,
  Paperclip,
  Loader2,
} from 'lucide-react';
import toast from 'react-hot-toast';
import ReactMarkdown from 'react-markdown';
import { sanitizeHtml, isHtmlContent } from '../utils/sanitize';
import { RichTextEditor } from '../components/forum/RichTextEditor';
import { resolveFileUrl } from '../api/client';
import { useTranslation } from 'react-i18next';
import { assignmentsApi } from '../api/assignments';
import { enrollmentsApi } from '../api/enrollments';
import { INTERACTIVE_LAB_REQUIREMENTS } from '../types';
import { customLabsApi } from '../api/customLabs';
import { uploadsApi } from '../api/uploads';
import { learningAnalyticsApi } from '../api/admin';
import { useLabWebR } from '../hooks/useLabWebR';
import { useLabPyodide } from '../hooks/useLabPyodide';
import { LabRunnerUI, isPythonLab } from './LabRunner';
import { useTheme } from '../hooks/useTheme';
import { Card, CardBody, CardHeader } from '../components/common/Card';
import { Loading } from '../components/common/Loading';
import { Button } from '../components/common/Button';
import { Breadcrumb } from '../components/common/Breadcrumb';
import { PostAssignmentSurveyModal } from '../components/survey';
import { getSessionId, getClientInfo } from '../utils/analytics';
import { debug } from '../utils/debug';

// Thin wrappers that provide the runtime hook and pass courseId directly
const RLabEmbed = ({ lab, courseId }: { lab: any; courseId: number }) => {
  const hook = useLabWebR(lab.labType);
  return <LabRunnerUI lab={lab} hook={hook} courseId={courseId} />;
};

const PythonLabEmbed = ({ lab, courseId }: { lab: any; courseId: number }) => {
  const hook = useLabPyodide(lab.labType);
  return <LabRunnerUI lab={lab} hook={hook} courseId={courseId} />;
};

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
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Theme colors
  const colors = useMemo(() => ({
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
  }), [isDark]);

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

  // Find lab linked to this assignment (if any)
  const { data: courseLabs } = useQuery({
    queryKey: ['courseLabs', courseId],
    queryFn: () => customLabsApi.getLabsForCourse(parsedCourseId),
    enabled: !!enrollment?.enrolled,
  });
  const linkedLabId = courseLabs?.find(la => la.assignmentId === parsedAssignmentId)?.labId ?? null;
  const { data: linkedLab } = useQuery({
    queryKey: ['lab', linkedLabId],
    queryFn: () => customLabsApi.getLabById(linkedLabId!),
    enabled: linkedLabId != null,
  });

  // Track if we've logged the assignment_view event
  const hasLoggedViewRef = useRef(false);

  // Initialize form with existing submission data
  useEffect(() => {
    if (mySubmission) {
      setContent(mySubmission.content || '');
      try {
        const parsed = mySubmission.fileUrls ? JSON.parse(mySubmission.fileUrls) : [];
        setFileUrls(Array.isArray(parsed)
          ? parsed.filter((v): v is string => typeof v === 'string')
          : []);
      } catch {
        setFileUrls([]);
      }
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

  // Redirect interactive lab assignments to their exercise page (pass assignmentId for submission targeting)
  if (assignment.agentRequirements === INTERACTIVE_LAB_REQUIREMENTS.TNA) {
    navigate(`/courses/${courseId}/tna-exercise?assignmentId=${assignmentId}`, { replace: true });
    return <Loading fullScreen text={t('redirecting', { defaultValue: 'Redirecting to lab...' })} />;
  }
  if (assignment.agentRequirements === INTERACTIVE_LAB_REQUIREMENTS.SNA) {
    navigate(`/courses/${courseId}/sna-exercise?assignmentId=${assignmentId}`, { replace: true });
    return <Loading fullScreen text={t('redirecting', { defaultValue: 'Redirecting to lab...' })} />;
  }

  const course = enrollment.enrollment?.course;
  const now = new Date();
  const dueDate = assignment.dueDate ? new Date(assignment.dueDate) : null;
  const isPastDue = dueDate ? dueDate < now : false;
  const isSubmitted = mySubmission?.status === 'submitted' || mySubmission?.status === 'graded';
  const isGraded = mySubmission?.status === 'graded';
  const canSubmit = !isPastDue && !isSubmitted;

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploading(true);
    try {
      const { url } = await uploadsApi.uploadAssignmentSubmission(file, parsedAssignmentId);
      setFileUrls(prev => [...prev, url]);
      toast.success(t('file_uploaded', { defaultValue: 'File uploaded' }));
    } catch {
      toast.error(t('file_upload_failed', { defaultValue: 'File upload failed' }));
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleSubmit = () => {
    const hasMedia = /<(img|figure|svg)\s/i.test(content || '');
    const isContentEmpty = !hasMedia && (!content || content.replace(/<[^>]*>/g, '').trim() === '');
    if (isContentEmpty && fileUrls.length === 0) {
      toast.error(t('add_content_before_submit'));
      return;
    }
    submitMutation.mutate();
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
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

      <div className={`grid grid-cols-1 ${isGraded ? 'lg:grid-cols-3' : ''} gap-6`}>
        {/* Main Content */}
        <div className={`${isGraded ? 'lg:col-span-2' : ''} space-y-6`}>
          {/* Embedded Lab (if assignment has a linked lab) */}
          {linkedLab && (
            isPythonLab(linkedLab.labType)
              ? <PythonLabEmbed lab={linkedLab} courseId={parsedCourseId} />
              : <RLabEmbed lab={linkedLab} courseId={parsedCourseId} />
          )}

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
                {isHtmlContent(assignment.instructions) ? (
                  <div
                    className="prose dark:prose-invert max-w-none"
                    style={{ color: colors.textSecondary }}
                    dangerouslySetInnerHTML={{ __html: sanitizeHtml(assignment.instructions) }}
                  />
                ) : (
                  <p className="whitespace-pre-wrap" style={{ color: colors.textSecondary }}>
                    {assignment.instructions}
                  </p>
                )}
              </CardBody>
            </Card>
          )}

          {/* Attachments */}
          {assignment.attachments && assignment.attachments.length > 0 && (
            <Card>
              <CardHeader>
                <h2 className="font-semibold flex items-center gap-2" style={{ color: colors.textPrimary }}>
                  <Paperclip className="w-4 h-4" />
                  {t('attachments')}
                </h2>
              </CardHeader>
              <CardBody>
                <div className="space-y-2">
                  {assignment.attachments.map(att => (
                    <a
                      key={att.id}
                      href={resolveFileUrl(att.fileUrl)}
                      download={att.fileName}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors group"
                      style={{ backgroundColor: colors.bgFile }}
                    >
                      <FileText className="w-5 h-5 flex-shrink-0" style={{ color: colors.textMuted }} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate" style={{ color: colors.textPrimary }}>{att.fileName}</p>
                        <p className="text-xs" style={{ color: colors.textMuted }}>
                          {att.fileType.toUpperCase()}{att.fileSize ? ` · ${(att.fileSize / 1024).toFixed(0)} KB` : ''}
                        </p>
                      </div>
                      <Download className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: colors.textSecondary }} />
                    </a>
                  ))}
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
                  isSubmitted ? (
                    <div>
                      <label className="block text-sm font-medium mb-2" style={{ color: colors.textSecondary }}>
                        {t('your_answer_label')}
                      </label>
                      {isHtmlContent(content) ? (
                        <div
                          className="prose max-w-none p-4 rounded-lg border text-sm"
                          style={{ backgroundColor: colors.bgFile, borderColor: colors.border, color: colors.textPrimary }}
                          dangerouslySetInnerHTML={{ __html: sanitizeHtml(content) }}
                        />
                      ) : (
                        <p
                          className="p-4 rounded-lg border text-sm whitespace-pre-wrap"
                          style={{ backgroundColor: colors.bgFile, borderColor: colors.border, color: colors.textPrimary }}
                        >
                          {content}
                        </p>
                      )}
                    </div>
                  ) : (
                    <div>
                      <label className="block text-sm font-medium mb-2" style={{ color: colors.textSecondary }}>
                        {t('your_answer_label')}
                      </label>
                      <RichTextEditor
                        value={content}
                        onChange={setContent}
                        placeholder={t('write_answer_placeholder')}
                      />
                    </div>
                  )
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
                      role="button"
                      tabIndex={isSubmitted || isUploading ? -1 : 0}
                      className="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors hover:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
                      style={{ borderColor: colors.borderDashed }}
                      onClick={() => !isSubmitted && !isUploading && fileInputRef.current?.click()}
                      onKeyDown={(e) => {
                        if ((e.key === 'Enter' || e.key === ' ') && !isSubmitted && !isUploading) {
                          e.preventDefault();
                          fileInputRef.current?.click();
                        }
                      }}
                      aria-disabled={isSubmitted || isUploading}
                      aria-label={t('click_to_upload_file', { defaultValue: 'Click to upload a file' })}
                    >
                      {isUploading
                        ? <Loader2 className="w-8 h-8 mx-auto mb-2 animate-spin" style={{ color: colors.textMuted }} />
                        : <Upload className="w-8 h-8 mx-auto mb-2" style={{ color: colors.textMuted }} />
                      }
                      <p className="text-sm" style={{ color: colors.textSecondary }}>
                        {isUploading
                          ? t('uploading', { defaultValue: 'Uploading...' })
                          : isSubmitted
                            ? t('submission_locked', { defaultValue: 'Submission locked' })
                            : t('click_to_upload_file', { defaultValue: 'Click to upload a file' })
                        }
                      </p>
                      {assignment.maxFileSize && (
                        <p className="text-xs mt-1" style={{ color: colors.textMuted }}>
                          {t('max_file_size', { size: assignment.maxFileSize })}
                        </p>
                      )}
                    </div>
                    <input
                      ref={fileInputRef}
                      type="file"
                      className="hidden"
                      onChange={handleFileUpload}
                      accept={assignment.allowedFileTypes || undefined}
                      disabled={isSubmitted}
                    />

                    {fileUrls.length > 0 && (
                      <div className="mt-4 space-y-2">
                        {fileUrls.map((url, index) => {
                          const rawName = url.split('/').pop() ?? `file-${index + 1}`;
                          let displayName: string;
                          try {
                            displayName = decodeURIComponent(rawName.replace(/^[\w-]{36}/, '').replace(/^-/, '')) || rawName;
                          } catch {
                            displayName = rawName;
                          }
                          const isPdf = url.toLowerCase().endsWith('.pdf');
                          const resolvedUrl = resolveFileUrl(url);

                          return (
                            <div key={index}>
                              {isPdf && isSubmitted ? (
                                <div className="rounded-lg border overflow-hidden" style={{ borderColor: colors.border }}>
                                  <div className="flex items-center justify-between px-3 py-2" style={{ backgroundColor: colors.bgFile }}>
                                    <div className="flex items-center gap-2">
                                      <FileText className="w-4 h-4" style={{ color: colors.textMuted }} />
                                      <span className="text-sm font-medium truncate" style={{ color: colors.textPrimary }}>{displayName}</span>
                                    </div>
                                    <a href={resolvedUrl} download={displayName} target="_blank" rel="noopener noreferrer" style={{ color: colors.textSecondary }}>
                                      <Download className="w-3.5 h-3.5" />
                                    </a>
                                  </div>
                                  <iframe src={resolvedUrl} className="w-full border-0" style={{ height: '500px' }} title={displayName} sandbox="allow-same-origin" />
                                </div>
                              ) : (
                                <div className="flex items-center gap-2 p-2 rounded" style={{ backgroundColor: colors.bgFile }}>
                                  <FileText className="w-4 h-4" style={{ color: colors.textMuted }} />
                                  <span className="flex-1 text-sm truncate" style={{ color: colors.textPrimary }}>{displayName}</span>
                                  {isSubmitted && (
                                    <a href={resolvedUrl} download={displayName} target="_blank" rel="noopener noreferrer" style={{ color: colors.textSecondary }}>
                                      <Download className="w-4 h-4" />
                                    </a>
                                  )}
                                  {!isSubmitted && (
                                    <button onClick={() => setFileUrls(fileUrls.filter((_, i) => i !== index))} style={{ color: colors.textRed }}>
                                      <X className="w-4 h-4" />
                                    </button>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })}
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
                  isHtmlContent(mySubmission.content) ? (
                    <div
                      className="prose max-w-none mb-4 text-sm"
                      style={{ color: colors.textSecondary }}
                      dangerouslySetInnerHTML={{ __html: sanitizeHtml(mySubmission.content) }}
                    />
                  ) : (
                    <p className="mb-4 text-sm whitespace-pre-wrap" style={{ color: colors.textSecondary }}>
                      {mySubmission.content}
                    </p>
                  )
                )}
                {fileUrls.length > 0 && (
                  <div className="mb-4 space-y-2">
                    <label className="block text-sm font-medium mb-1" style={{ color: colors.textSecondary }}>
                      {t('file_attachments')}
                    </label>
                    {fileUrls.map((url, index) => {
                      const rawName = url.split('/').pop() ?? `file-${index + 1}`;
                      let displayName: string;
                      try {
                        displayName = decodeURIComponent(rawName.replace(/^[\w-]{36}/, '').replace(/^-/, '')) || rawName;
                      } catch {
                        displayName = rawName;
                      }
                      const isPdf = url.toLowerCase().endsWith('.pdf');
                      const resolvedUrl = resolveFileUrl(url);

                      if (isPdf) {
                        return (
                          <div key={index} className="rounded-lg border overflow-hidden" style={{ borderColor: colors.border }}>
                            <div className="flex items-center justify-between px-3 py-2" style={{ backgroundColor: colors.bgFile }}>
                              <div className="flex items-center gap-2">
                                <FileText className="w-4 h-4" style={{ color: colors.textMuted }} />
                                <span className="text-sm font-medium truncate" style={{ color: colors.textPrimary }}>{displayName}</span>
                              </div>
                              <a href={resolvedUrl} download={displayName} target="_blank" rel="noopener noreferrer" style={{ color: colors.textSecondary }}>
                                <Download className="w-3.5 h-3.5" />
                              </a>
                            </div>
                            <iframe src={resolvedUrl} className="w-full border-0" style={{ height: '500px' }} title={displayName} sandbox="allow-same-origin" />
                          </div>
                        );
                      }
                      return (
                        <div key={index} className="flex items-center gap-2 p-2 rounded" style={{ backgroundColor: colors.bgFile }}>
                          <FileText className="w-4 h-4" style={{ color: colors.textMuted }} />
                          <span className="flex-1 text-sm truncate" style={{ color: colors.textPrimary }}>{displayName}</span>
                          <a href={resolvedUrl} download={displayName} target="_blank" rel="noopener noreferrer" style={{ color: colors.textSecondary }}>
                            <Download className="w-4 h-4" />
                          </a>
                        </div>
                      );
                    })}
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
