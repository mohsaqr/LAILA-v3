import { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Sparkles } from 'lucide-react';
import { coursesApi } from '../api/courses';
import { useTheme } from '../hooks/useTheme';
import { Card, CardBody } from '../components/common/Card';
import { Loading } from '../components/common/Loading';
import { Breadcrumb } from '../components/common/Breadcrumb';
import { buildContentBreadcrumb } from '../utils/breadcrumbs';
import { sanitizeHtml } from '../utils/sanitize';
import activityLogger from '../services/activityLogger';
import { TrackedContent } from '../components/common/TrackedContent';

interface LocationState {
  title?: string;
  content?: string;
  type?: string;
  courseId?: number;
  courseName?: string;
  moduleName?: string;
  lectureName?: string;
}

export const ContentView = () => {
  const { type, id } = useParams<{ type: string; id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const state = location.state as LocationState | null;
  const { isDark } = useTheme();
  const { t } = useTranslation(['courses', 'common']);

  // Theme colors
  const colors = {
    bg: isDark ? '#111827' : '#f9fafb',
    bgCard: isDark ? '#1f2937' : '#ffffff',
    bgHeader: isDark ? '#374151' : '#f9fafb',
    textPrimary: isDark ? '#f3f4f6' : '#111827',
    textSecondary: isDark ? '#9ca3af' : '#6b7280',
    border: isDark ? '#374151' : '#e5e7eb',
    borderLight: isDark ? '#374151' : '#f3f4f6',
  };

  // Try to get content from sessionStorage (for new tab opens)
  const [storedContent, setStoredContent] = useState<LocationState | null>(null);

  useEffect(() => {
    if (id) {
      const stored = sessionStorage.getItem(`content-${id}`);
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          setStoredContent(parsed);
          // Clean up after reading
          sessionStorage.removeItem(`content-${id}`);
        } catch {
          // Ignore parsing errors
        }
      }
    }
  }, [id]);

  // If content was passed via state or sessionStorage, use it directly
  const passedContent = state?.content || storedContent?.content;
  const passedTitle = state?.title || storedContent?.title;
  const passedType = state?.type || storedContent?.type;
  const passedCourseId = state?.courseId || storedContent?.courseId;
  const passedCourseName = state?.courseName || storedContent?.courseName;
  const passedModuleName = state?.moduleName || storedContent?.moduleName;
  const passedLectureName = state?.lectureName || storedContent?.lectureName;

  // If type is 'section', we need to fetch the lecture containing that section
  // For now, sections are passed via state for simplicity
  const { data: lecture, isLoading } = useQuery({
    queryKey: ['lecture', id],
    queryFn: () => coursesApi.getLectureById(parseInt(id!)),
    enabled: type === 'lecture' && !passedContent,
  });

  const handleBack = () => {
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate('/dashboard');
    }
  };

  // Determine content source.
  //
  // Everything from here to the logging effect below must stay ABOVE the
  // `isLoading` early return. The effect used to sit after it, so the first
  // render (query in flight) returned before reaching the hook and the second
  // render (query settled) called it — one more hook than the render before,
  // which is the "Rendered more hooks than during the previous render" crash.
  // It reproduced on any direct visit to /content/lecture/:id — a refresh or a
  // shared link — where no content arrives via router state and the query
  // therefore actually runs. `react-hooks/rules-of-hooks` flags it.
  let title = passedTitle;
  let content = passedContent;
  const contentType = passedType || type;

  if (type === 'lecture' && lecture && !passedContent) {
    title = lecture.title;
    content = lecture.content || '';
  }

  // Build breadcrumb with context if available
  const breadcrumbItems = buildContentBreadcrumb(
    passedCourseId,
    passedCourseName,
    passedModuleName,
    passedLectureName,
    title
  );

  // Log content view. The `content &&` guard already makes this a no-op while
  // the query is in flight, so hoisting it changes nothing about when it fires.
  useEffect(() => {
    if (content && id) {
      const contentId = parseInt(id, 10);
      if (!isNaN(contentId)) {
        activityLogger.logContentViewed(contentId, title, contentType, passedCourseId);
      }
    }
  }, [id, title, contentType, passedCourseId, content]);

  if (isLoading) {
    return <Loading fullScreen text={t('loading_content')} />;
  }

  if (!content) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: colors.bg }}>
        <Card>
          <CardBody className="text-center py-8 px-12">
            <h2 className="text-xl font-bold mb-2" style={{ color: colors.textPrimary }}>{t('content_not_found')}</h2>
            <p className="mb-4" style={{ color: colors.textSecondary }}>{t('content_not_found_description')}</p>
            <button onClick={handleBack} className="btn btn-primary">
              {t('go_back')}
            </button>
          </CardBody>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: colors.bg }}>
      {/* Header with Breadcrumb */}
      <div className="sticky top-0 z-10" style={{ backgroundColor: colors.bgCard, borderBottom: `1px solid ${colors.border}` }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center gap-4">
          <button
            onClick={handleBack}
            className="p-2 rounded-lg transition-colors flex-shrink-0"
            title={t('go_back')}
            style={{ color: colors.textSecondary }}
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <Breadcrumb items={breadcrumbItems} />
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 md:py-8">
        <Card>
          {title && (
            <div className="px-4 sm:px-6 py-4" style={{ borderBottom: `1px solid ${colors.borderLight}`, backgroundColor: colors.bgHeader }}>
              <div className="flex items-center gap-2">
                {contentType === 'ai-generated' && <Sparkles className="w-5 h-5 text-purple-500" />}
                <h1 className="text-xl sm:text-2xl font-bold" style={{ color: colors.textPrimary }}>{title}</h1>
              </div>
            </div>
          )}
          <CardBody className="py-6 px-4 sm:px-6">
            <TrackedContent context="content" objectId={id ? parseInt(id, 10) : undefined} objectTitle={title} courseId={passedCourseId}>
              <div
                className="prose max-w-none"
                style={{ color: colors.textPrimary }}
                dangerouslySetInnerHTML={{ __html: sanitizeHtml(content) }}
              />
            </TrackedContent>
          </CardBody>
        </Card>
      </div>
    </div>
  );
};
