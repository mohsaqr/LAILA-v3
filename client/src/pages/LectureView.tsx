import { useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Download, FileText, Sparkles, Upload, BookOpen, ChevronLeft, ChevronRight } from 'lucide-react';
import { coursesApi } from '../api/courses';
import { resolveFileUrl } from '../api/client';
import { useTheme } from '../hooks/useTheme';
import { Card, CardBody } from '../components/common/Card';
import { Loading } from '../components/common/Loading';
import { Breadcrumb } from '../components/common/Breadcrumb';
import { LectureAIHelper } from '../components/lecture';
import { sanitizeHtml } from '../utils/sanitize';
import activityLogger from '../services/activityLogger';
import { LectureSection } from '../types';

export const LectureView = () => {
  const { courseId, lectureId } = useParams<{ courseId: string; lectureId: string }>();
  const { isDark } = useTheme();

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

  // Log lecture view
  useEffect(() => {
    if (lecture && courseId) {
      activityLogger.logLectureStarted(
        parseInt(lectureId!),
        lecture.title,
        parseInt(courseId),
        lecture.moduleId
      ).catch(() => {});
    }
  }, [lecture?.id, courseId, lectureId]);

  // Find current module and lecture position for navigation
  const currentModule = course?.modules?.find(m =>
    m.lectures?.some(l => l.id === parseInt(lectureId!))
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

  // Build breadcrumb items
  const breadcrumbItems: Array<{ label: string; href?: string }> = [
    { label: 'Courses', href: '/courses' },
    { label: course?.title || 'Course', href: `/courses/${courseId}` },
  ];

  if (currentModule) {
    breadcrumbItems.push({ label: currentModule.title });
  }

  if (lecture) {
    breadcrumbItems.push({ label: lecture.title });
  }

  if (isLoading) {
    return <Loading fullScreen text="Loading lecture..." />;
  }

  if (!lecture) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: colors.bg }}>
        <Card>
          <CardBody className="text-center py-8 px-12">
            <h2 className="text-xl font-bold mb-2" style={{ color: colors.textPrimary }}>Lecture Not Found</h2>
            <p className="mb-4" style={{ color: colors.textSecondary }}>The requested lecture could not be found.</p>
            <Link to={`/courses/${courseId}`} className="btn btn-primary">
              Back to Course
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
              <div
                className="prose max-w-none"
                style={{ color: colors.textPrimary }}
                dangerouslySetInnerHTML={{ __html: sanitizeHtml(section.content) }}
              />
            )}
          </div>
        );
      }

      case 'file': {
        if (!section.fileUrl) {
          return (
            <div key={section.id} className="mb-8 p-4 rounded-lg text-center" style={{ backgroundColor: colors.bgHover }}>
              <Upload className="w-8 h-8 mx-auto mb-2" style={{ color: colors.textMuted }} />
              <p style={{ color: colors.textSecondary }}>No file uploaded</p>
            </div>
          );
        }
        const isImage = section.fileType?.startsWith('image/');
        const isPdf = section.fileType === 'application/pdf';
        const handleFileDownload = () => {
          activityLogger.logFileDownloaded(section.id, section.fileName || undefined, parseInt(lectureId!), parseInt(courseId!)).catch(() => {});
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

      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen" style={{ backgroundColor: colors.bg }}>
      {/* Header with Breadcrumb */}
      <div className="sticky top-0 z-10" style={{ backgroundColor: colors.bgCard, borderBottom: `1px solid ${colors.border}` }}>
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center gap-4">
          <Link
            to={`/courses/${courseId}`}
            className="p-2 rounded-lg transition-colors flex-shrink-0 hover:bg-gray-100 dark:hover:bg-gray-800"
            title="Back to course"
          >
            <ArrowLeft className="w-5 h-5" style={{ color: colors.textSecondary }} />
          </Link>
          <Breadcrumb items={breadcrumbItems} />
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 py-8">
        <Card>
          {/* Lecture Header */}
          <div className="px-6 py-4" style={{ borderBottom: `1px solid ${colors.borderLight}`, backgroundColor: colors.bgHeader }}>
            <h1 className="text-2xl font-bold" style={{ color: colors.textPrimary }}>{lecture.title}</h1>
            {lecture.duration && (
              <p className="text-sm mt-1" style={{ color: colors.textSecondary }}>
                {lecture.duration} min
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
              <div
                className="prose max-w-none mb-8"
                style={{ color: colors.textPrimary }}
                dangerouslySetInnerHTML={{ __html: sanitizeHtml(lecture.content) }}
              />
            )}

            {/* Sections */}
            {lecture.sections?.sort((a, b) => a.order - b.order).map(renderSection)}

            {/* Attachments */}
            {lecture.attachments && lecture.attachments.length > 0 && (
              <div className="mt-8 pt-6" style={{ borderTop: `1px solid ${colors.border}` }}>
                <h3 className="font-semibold mb-4" style={{ color: colors.textPrimary }}>Attachments</h3>
                <div className="space-y-2">
                  {lecture.attachments.map(att => (
                    <a
                      key={att.id}
                      href={resolveFileUrl(att.fileUrl)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-3 p-3 rounded-lg transition-colors"
                      style={{ backgroundColor: colors.bgHover }}
                      onClick={() => activityLogger.logFileDownloaded(att.id, att.fileName, parseInt(lectureId!), parseInt(courseId!)).catch(() => {})}
                    >
                      <FileText className="w-5 h-5" style={{ color: colors.textMuted }} />
                      <span className="flex-1 text-sm" style={{ color: colors.textSecondary }}>{att.fileName}</span>
                      <Download className="w-4 h-4" style={{ color: colors.textMuted }} />
                    </a>
                  ))}
                </div>
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
            >
              <ChevronLeft className="w-4 h-4" />
              <div className="text-left">
                <p className="text-xs" style={{ color: colors.textSecondary }}>Previous</p>
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
            >
              <div className="text-right">
                <p className="text-xs" style={{ color: colors.textSecondary }}>Next</p>
                <p className="text-sm font-medium truncate max-w-[200px]">{nextLecture.title}</p>
              </div>
              <ChevronRight className="w-4 h-4" />
            </Link>
          ) : (
            <Link
              to={`/courses/${courseId}`}
              className="flex items-center gap-2 px-4 py-2 rounded-lg transition-colors"
              style={{ backgroundColor: colors.bgPrimaryLight, color: colors.textPrimary600 }}
            >
              <BookOpen className="w-4 h-4" />
              <span className="text-sm font-medium">Back to Course</span>
            </Link>
          )}
        </div>
      </div>
    </div>
  );
};
