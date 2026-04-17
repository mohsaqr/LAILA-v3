import { useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Download, FileText, Sparkles, Upload, BookOpen, ChevronLeft, ChevronRight, CheckCircle, Circle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { coursesApi } from '../api/courses';
import { enrollmentsApi } from '../api/enrollments';
import { resolveFileUrl } from '../api/client';
import { useTheme } from '../hooks/useTheme';

import { Card, CardBody } from '../components/common/Card';
import { Breadcrumb } from '../components/common/Breadcrumb';
import { Loading } from '../components/common/Loading';
import { LectureAIHelper } from '../components/lecture';
import { ChatbotSectionStudent } from '../components/course/ChatbotSectionStudent';
import { AssignmentSectionStudent } from '../components/course/AssignmentSectionStudent';
import { marked } from 'marked';
import { sanitizeHtml, isHtmlContent } from '../utils/sanitize';
import { TrackedContent } from '../components/common/TrackedContent';
import activityLogger from '../services/activityLogger';
import { useTracker } from '../services/tracker';
import { LectureSection } from '../types';

// Parse markdown to HTML, then sanitize for XSS safety
const renderMarkdown = (content: string): string => {
  const html = marked.parse(content, { async: false }) as string;
  return sanitizeHtml(html);
};

export const LectureView = () => {
  const { t } = useTranslation(['courses', 'common']);
  const { courseId, lectureId } = useParams<{ courseId: string; lectureId: string }>();
  const { isDark } = useTheme();
  const track = useTracker('lecture');

  const queryClient = useQueryClient();


  // Theme colors
  const colors = {
    bg: isDark ? '#111827' : '#f9fafb',
    bgCard: isDark ? '#1f2937' : '#ffffff',
    bgHeader: isDark ? '#374151' : '#f9fafb',
    bgHover: isDark ? '#374151' : '#f9fafb',
    textPrimary: isDark ? '#f3f4f6' : '#111827',
    textSecondary: isDark ? '#9ca3af' : '#6b7280',
    textMuted: isDark ? '#6b7280' : '#9ca3af',
    border: isDark ? '#374151' : '#e5e7eb',
    borderLight: isDark ? '#374151' : '#f3f4f6',
    bgBlue: isDark ? 'rgba(59, 130, 246, 0.2)' : '#dbeafe',
    textBlue: isDark ? '#93c5fd' : '#2563eb',
    bgTeal: isDark ? 'rgba(8, 143, 143, 0.2)' : '#f0fdfd',
    textTeal: isDark ? '#5eecec' : '#088F8F',
    bgPrimaryLight: isDark ? 'rgba(99, 102, 241, 0.2)' : '#eef2ff',
    textPrimary600: isDark ? '#a5b4fc' : '#4f46e5',
  };

  // Fetch course for breadcrumb and navigation
  const { data: course } = useQuery({
    queryKey: ['course', courseId],
    queryFn: () => coursesApi.getCourseById(parseInt(courseId!)),
    enabled: !!courseId,
  });

  // Fetch lecture content
  const { data: lecture, isLoading } = useQuery({
    queryKey: ['lecture', lectureId],
    queryFn: () => coursesApi.getLectureById(parseInt(lectureId!)),
    enabled: !!lectureId,
  });

  // Fetch course progress to know if this lecture is already completed (students only)
  const { data: courseProgress } = useQuery({
    queryKey: ['courseProgress', courseId],
    queryFn: () => enrollmentsApi.getProgress(parseInt(courseId!)),
    enabled: !!courseId,
    staleTime: 10000,
  });

  const isCompleted = courseProgress?.moduleProgress
    .flatMap(m => m.lectures)
    .some(l => l.lectureId === parseInt(lectureId!) && l.isCompleted) ?? false;

  // Mutation to mark lecture as complete
  const completeMutation = useMutation({
    mutationFn: () => enrollmentsApi.markLectureComplete(
      parseInt(courseId!),
      parseInt(lectureId!),
      lecture?.title,
      lecture?.moduleId,
    ),
    onSuccess: () => {
      toast.success(t('completed'));
      queryClient.invalidateQueries({ queryKey: ['courseProgress', courseId] });
      queryClient.invalidateQueries({ queryKey: ['myEnrollments'] });
    },
    onError: () => {
      toast.error(t('common:error'));
    },
  });

  // Log lecture view
  useEffect(() => {
    if (lecture && courseId) {
      activityLogger.logLectureViewed(
        parseInt(lectureId!),
        lecture.title,
        parseInt(courseId),
        lecture.moduleId
      ).catch(() => {});
    }
  }, [lecture?.id, courseId, lectureId]);

  const currentModule = course?.modules?.find((m: any) =>
    m.lectures?.some((l: any) => l.id === parseInt(lectureId!))
  );

  // Get all lectures in order across all modules for prev/next navigation
  const allLectures = course?.modules?.flatMap(m =>
    (m.lectures || [])
      .filter(l => l.isPublished)
      .map(l => ({ ...l, moduleName: m.title }))
  ) || [];

  const currentIndex = allLectures.findIndex(l => l.id === parseInt(lectureId!));
  const prevLecture = currentIndex > 0 ? allLectures[currentIndex - 1] : null;
  const nextLecture = currentIndex < allLectures.length - 1 ? allLectures[currentIndex + 1] : null;


  if (isLoading) {
    return <Loading fullScreen text={t('loading_lecture')} />;
  }

  if (!lecture) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: colors.bg }}>
        <Card>
          <CardBody className="text-center py-8 px-12">
            <h2 className="text-xl font-bold mb-2" style={{ color: colors.textPrimary }}>{t('lecture_not_found')}</h2>
            <p className="mb-4" style={{ color: colors.textSecondary }}>{t('lecture_not_found_description')}</p>
            <Link to={`/courses/${courseId}`} className="btn btn-primary">
              {t('back_to_course_button')}
            </Link>
          </CardBody>
        </Card>
      </div>
    );
  }

  // Render section content
  const renderSection = (section: LectureSection) => {
    switch (section.type) {
      case 'text':
      case 'ai-generated': {
        const isHtml = isHtmlContent(section.content);
        return (
          <div key={section.id} className="mb-8">
            {section.title && (
              <div className="flex items-center gap-2 mb-4">
                {section.type === 'ai-generated' && <Sparkles className="w-5 h-5" style={{ color: colors.textTeal }} />}
                <h2 className="text-xl font-semibold" style={{ color: colors.textPrimary }}>
                  {section.title}
                </h2>
              </div>
            )}
            {section.content && (
              <TrackedContent context="lecture" courseId={parseInt(courseId!)} objectId={section.id} objectTitle={section.title || undefined}>
                <div
                  className="prose dark:prose-invert max-w-none"
                  style={{ color: colors.textPrimary }}
                  dangerouslySetInnerHTML={{ __html: isHtml ? sanitizeHtml(section.content) : renderMarkdown(section.content) }}
                />
              </TrackedContent>
            )}
          </div>
        );
      }

      case 'file': {
        if (!section.fileUrl) {
          return (
            <div key={section.id} className="mb-8 p-4 rounded-lg text-center" style={{ backgroundColor: colors.bgHover }}>
              <Upload className="w-8 h-8 mx-auto mb-2" style={{ color: colors.textMuted }} />
              <p style={{ color: colors.textSecondary }}>{t('no_file_uploaded')}</p>
            </div>
          );
        }
        const isImage = section.fileType?.startsWith('image/');
        const isPdf = section.fileType === 'application/pdf';
        const handleFileDownload = async (e: React.MouseEvent) => {
          e.preventDefault();
          activityLogger.logFileDownloaded(section.id, section.fileName || undefined, parseInt(lectureId!), parseInt(courseId!)).catch(() => {});
          const url = resolveFileUrl(section.fileUrl!);
          try {
            const res = await fetch(url);
            const blob = await res.blob();
            const blobUrl = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = blobUrl;
            a.download = section.fileName || 'download';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            setTimeout(() => URL.revokeObjectURL(blobUrl), 100);
          } catch {
            window.open(url, '_blank');
          }
        };

        return (
          <div key={section.id} className="mb-8">
            {section.title && (
              <h2 className="text-xl font-semibold mb-4" style={{ color: colors.textPrimary }}>
                {section.title}
              </h2>
            )}
            {isImage ? (
              <img src={resolveFileUrl(section.fileUrl)} alt={section.fileName || ''} className="max-w-full rounded-lg" />
            ) : isPdf ? (
              <div>
                <iframe src={resolveFileUrl(section.fileUrl)} className="w-full h-[600px] rounded-lg border" title={section.fileName || 'PDF'} style={{ borderColor: colors.border }} />
                <a href={resolveFileUrl(section.fileUrl)} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex items-center gap-2 text-primary-600 hover:underline" onClick={handleFileDownload}>
                  <Download className="w-4 h-4" /> Download {section.fileName}
                </a>
              </div>
            ) : (
              <a
                href={resolveFileUrl(section.fileUrl)}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 p-4 rounded-lg transition-colors"
                style={{ backgroundColor: colors.bgHover }}
                onClick={handleFileDownload}
              >
                <FileText className="w-8 h-8" style={{ color: colors.textMuted }} />
                <div className="flex-1">
                  <p className="font-medium" style={{ color: colors.textPrimary }}>{section.fileName}</p>
                  {section.fileSize && <p className="text-sm" style={{ color: colors.textSecondary }}>{(section.fileSize / 1024).toFixed(1)} KB</p>}
                </div>
                <Download className="w-5 h-5" style={{ color: colors.textMuted }} />
              </a>
            )}
          </div>
        );
      }

      case 'chatbot':
        return (
          <div key={section.id} className="mb-8">
            {section.title && (
              <h2 className="text-xl font-semibold mb-4" style={{ color: colors.textPrimary }}>
                {section.title}
              </h2>
            )}
            <ChatbotSectionStudent
              section={section}
              courseId={parseInt(courseId!)}
            />
          </div>
        );

      case 'assignment':
        return (
          <div key={section.id} className="mb-8">
            <AssignmentSectionStudent
              section={section}
              courseId={parseInt(courseId!)}
            />
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Breadcrumb */}
      <div className="mb-6">
        <Breadcrumb
          items={[
            { label: t('courses'), href: '/courses' },
            { label: course?.title || t('course'), href: `/courses/${courseId}` },
            ...(currentModule ? [{ label: currentModule.title }] : []),
            ...(lecture ? [{ label: lecture.title }] : []),
          ]}
        />
      </div>

      {/* Content */}
      <div>
        <Card>
          {/* Lecture Header */}
          <div className="px-6 py-4" style={{ borderBottom: `1px solid ${colors.borderLight}`, backgroundColor: colors.bgHeader }}>
            <h1 className="text-2xl font-bold" style={{ color: colors.textPrimary }}>{lecture.title}</h1>
            {lecture.duration && (
              <p className="text-sm mt-1" style={{ color: colors.textSecondary }}>
                {t('n_minutes', { count: lecture.duration })}
              </p>
            )}
          </div>

          <CardBody className="py-6 px-6">
            {/* Video content */}
            {lecture.videoUrl && (
              <div className="mb-8 aspect-video bg-black rounded-lg overflow-hidden">
                <iframe src={lecture.videoUrl} className="w-full h-full" allowFullScreen />
              </div>
            )}

            {/* Legacy content field */}
            {lecture.content && !lecture.sections?.length && (
              <TrackedContent context="lecture" courseId={parseInt(courseId!)} objectId={parseInt(lectureId!)} objectTitle={lecture.title}>
                <div
                  className="prose max-w-none mb-8"
                  style={{ color: colors.textPrimary }}
                  dangerouslySetInnerHTML={{ __html: renderMarkdown(lecture.content) }}
                />
              </TrackedContent>
            )}

            {/* Sections */}
            {lecture.sections?.sort((a, b) => a.order - b.order).map(renderSection)}

            {/* Attachments */}
            {lecture.attachments && lecture.attachments.length > 0 && (
              <div className="mt-8 pt-6" style={{ borderTop: `1px solid ${colors.border}` }}>
                <h3 className="font-semibold mb-4" style={{ color: colors.textPrimary }}>{t('attachments')}</h3>
                <div className="space-y-2">
                  {lecture.attachments.map(att => (
                    <a
                      key={att.id}
                      href={resolveFileUrl(att.fileUrl)}
                      className="flex items-center gap-3 p-3 rounded-lg transition-colors"
                      style={{ backgroundColor: colors.bgHover }}
                      onClick={async (e) => {
                        e.preventDefault();
                        activityLogger.logFileDownloaded(att.id, att.fileName, parseInt(lectureId!), parseInt(courseId!)).catch(() => {});
                        const url = resolveFileUrl(att.fileUrl);
                        try {
                          const res = await fetch(url);
                          const blob = await res.blob();
                          const blobUrl = URL.createObjectURL(blob);
                          const a = document.createElement('a');
                          a.href = blobUrl;
                          a.download = att.fileName || 'download';
                          document.body.appendChild(a);
                          a.click();
                          document.body.removeChild(a);
                          setTimeout(() => URL.revokeObjectURL(blobUrl), 100);
                        } catch {
                          window.open(url, '_blank');
                        }
                      }}
                    >
                      <FileText className="w-5 h-5" style={{ color: colors.textMuted }} />
                      <span className="flex-1 text-sm" style={{ color: colors.textSecondary }}>{att.fileName}</span>
                      <Download className="w-4 h-4" style={{ color: colors.textMuted }} />
                    </a>
                  ))}
                </div>
              </div>
            )}

            {/* Complete button */}
            {(
              <div className="mt-8 pt-6 flex justify-end" style={{ borderTop: `1px solid ${colors.border}` }}>
                {isCompleted ? (
                  <div className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm text-green-600 bg-green-50 dark:bg-green-900/20 dark:text-green-400 font-medium">
                    <CheckCircle className="w-4 h-4" />
                    {t('completed')}
                  </div>
                ) : (
                  <button
                    onClick={() => {
                      track('marked_complete', { verb: 'completed', objectType: 'lecture', objectId: parseInt(lectureId!), courseId: parseInt(courseId!) });
                      completeMutation.mutate();
                    }}
                    disabled={completeMutation.isPending}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors bg-green-50 hover:bg-green-100 text-green-600 dark:bg-green-900/20 dark:hover:bg-green-900/30 dark:text-green-400 disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {completeMutation.isPending ? (
                      <Circle className="w-4 h-4 animate-spin" />
                    ) : (
                      <CheckCircle className="w-4 h-4" />
                    )}
                    {t('complete')}
                  </button>
                )}
              </div>
            )}
          </CardBody>
        </Card>

        {/* AI Study Helper */}
        <div className="mt-6">
          <LectureAIHelper
            lectureId={parseInt(lectureId!)}
            lectureTitle={lecture.title}
            courseId={parseInt(courseId!)}
          />
        </div>

        {/* Navigation buttons */}
        <div className="mt-6 flex items-center justify-between">
          {prevLecture ? (
            <Link
              to={`/courses/${courseId}/lectures/${prevLecture.id}`}
              className="flex items-center gap-2 px-4 py-2 rounded-lg transition-colors"
              style={{ backgroundColor: colors.bgCard, border: `1px solid ${colors.border}`, color: colors.textPrimary }}
              onClick={() => track('previous_lecture', { verb: 'interacted', objectType: 'lecture', courseId: parseInt(courseId!), payload: { fromLectureId: parseInt(lectureId!), toLectureId: prevLecture.id } })}
            >
              <ChevronLeft className="w-4 h-4" />
              <div className="text-left">
                <p className="text-xs" style={{ color: colors.textSecondary }}>{t('previous_lecture')}</p>
                <p className="text-sm font-medium truncate max-w-[200px]">{prevLecture.title}</p>
              </div>
            </Link>
          ) : (
            <div />
          )}

          {nextLecture ? (
            <Link
              to={`/courses/${courseId}/lectures/${nextLecture.id}`}
              className="flex items-center gap-2 px-4 py-2 rounded-lg transition-colors"
              style={{ backgroundColor: colors.bgCard, border: `1px solid ${colors.border}`, color: colors.textPrimary }}
              onClick={() => track('next_lecture', { verb: 'interacted', objectType: 'lecture', courseId: parseInt(courseId!), payload: { fromLectureId: parseInt(lectureId!), toLectureId: nextLecture.id } })}
            >
              <div className="text-right">
                <p className="text-xs" style={{ color: colors.textSecondary }}>{t('next_lecture')}</p>
                <p className="text-sm font-medium truncate max-w-[200px]">{nextLecture.title}</p>
              </div>
              <ChevronRight className="w-4 h-4" />
            </Link>
          ) : (
            <Link
              to={`/courses/${courseId}`}
              className="flex items-center gap-2 px-4 py-2 rounded-lg transition-colors"
              style={{ backgroundColor: colors.bgPrimaryLight, color: colors.textPrimary600 }}
              onClick={() => track('back_to_course', { verb: 'interacted', objectType: 'course', courseId: parseInt(courseId!) })}
            >
              <BookOpen className="w-4 h-4" />
              <span className="text-sm font-medium">{t('back_to_course_button')}</span>
            </Link>
          )}
        </div>
      </div>
    </div>
  );
};
