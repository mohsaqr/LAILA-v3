import { useState, useEffect, useRef, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, Link } from 'react-router-dom';
import {
  ChevronLeft,
  CheckCircle,
  FileText,
  Menu,
  X,
  Download,
  ClipboardList,
  Upload,
  Sparkles,
  BookOpen,
  FolderOpen,
  FlaskConical,
  Bot,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { coursesApi } from '../api/courses';
import { enrollmentsApi } from '../api/enrollments';
import { assignmentsApi } from '../api/assignments';
import { learningAnalyticsApi } from '../api/admin';
import { Card, CardBody } from '../components/common/Card';
import { Loading } from '../components/common/Loading';
import { Breadcrumb } from '../components/common/Breadcrumb';
import { ChatbotSectionStudent } from '../components/course/ChatbotSectionStudent';
import { AssignmentSectionStudent } from '../components/course/AssignmentSectionStudent';
import { ContentModal } from '../components/content/ContentModal';
import { LectureSection } from '../types';
import { getSessionId, getClientInfo } from '../utils/analytics';
import activityLogger from '../services/activityLogger';
import { debug } from '../utils/debug';
import { useAuth } from '../hooks/useAuth';

// Helper to strip HTML and truncate for preview
const getPreviewText = (html: string, maxLength = 200): string => {
  const div = document.createElement('div');
  div.innerHTML = html;
  const text = div.textContent || div.innerText || '';
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength).trim() + '...';
};

// Section renderer for different section types - with analytics tracking
interface SectionRendererProps {
  section: LectureSection;
  courseId: number;
  onOpenTextContent?: (section: LectureSection) => void;
}

const SectionRenderer = ({ section, courseId, onOpenTextContent }: SectionRendererProps) => {
  // Common tracking attributes for this section
  const trackingAttrs = {
    'data-section-id': section.id,
    'data-section-title': section.title || '',
    'data-section-type': section.type,
    'data-section-order': section.order,
    'data-track-category': 'section',
  };

  switch (section.type) {
    case 'text':
    case 'ai-generated': {
      const previewText = section.content ? getPreviewText(section.content, 250) : '';

      return (
        <div {...trackingAttrs} data-track={`section-view-${section.type}`}>
          <Card className="hover:shadow-md transition-shadow">
            <CardBody>
              <div className="flex items-start gap-4">
                {/* Icon */}
                <div className={`flex-shrink-0 p-3 rounded-lg ${section.type === 'ai-generated' ? 'bg-purple-100' : 'bg-blue-100'}`}>
                  {section.type === 'ai-generated' ? (
                    <Sparkles className="w-6 h-6 text-purple-600" />
                  ) : (
                    <FileText className="w-6 h-6 text-blue-600" />
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-gray-900 mb-1">
                    {section.title || 'Text Content'}
                  </h3>
                  {section.content ? (
                    <p className="text-gray-600 text-sm line-clamp-3 mb-3">{previewText}</p>
                  ) : (
                    <p className="text-gray-400 text-sm italic mb-3">No content yet</p>
                  )}
                  {section.content && (
                    <button
                      onClick={() => onOpenTextContent?.(section)}
                      className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-primary-600 bg-primary-50 hover:bg-primary-100 rounded-lg transition-colors"
                    >
                      <BookOpen className="w-4 h-4" />
                      Read Article
                    </button>
                  )}
                </div>
              </div>
            </CardBody>
          </Card>
        </div>
      );
    }

    case 'file':
      if (!section.fileUrl) {
        return (
          <div {...trackingAttrs} data-track="section-file-empty">
            <Card>
              <CardBody className="text-center py-6">
                <Upload className="w-8 h-8 mx-auto text-gray-400 mb-2" />
                <p className="text-gray-500">No file uploaded</p>
              </CardBody>
            </Card>
          </div>
        );
      }

      // Check if it's an image
      const isImage = section.fileType?.startsWith('image/');
      // Check if it's a PDF
      const isPdf = section.fileType === 'application/pdf';

      return (
        <div {...trackingAttrs} data-track={`section-file-${isPdf ? 'pdf' : isImage ? 'image' : 'download'}`} data-file-name={section.fileName} data-file-type={section.fileType}>
          <Card>
            {section.title && (
              <div className="px-6 py-3 border-b border-gray-100 bg-gray-50">
                <h3 className="font-medium text-gray-900">{section.title}</h3>
              </div>
            )}
            <CardBody>
              {isImage ? (
                <img
                  src={section.fileUrl}
                  alt={section.fileName || 'Section image'}
                  className="max-w-full rounded-lg"
                  data-track="image-view"
                  data-track-label={section.fileName}
                />
              ) : isPdf ? (
                <div>
                  <iframe
                    src={section.fileUrl}
                    className="w-full h-[600px] rounded-lg border"
                    title={section.fileName || 'PDF document'}
                    data-track="pdf-view"
                    data-track-label={section.fileName}
                  />
                  <a
                    href={section.fileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-3 inline-flex items-center gap-2 text-primary-600 hover:underline"
                    data-track="file-download"
                    data-track-label={section.fileName}
                    data-track-category="content"
                  >
                    <Download className="w-4 h-4" />
                    Download {section.fileName}
                  </a>
                </div>
              ) : (
                <a
                  href={section.fileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                  data-track="file-download"
                  data-track-label={section.fileName}
                  data-track-category="content"
                >
                  <FileText className="w-8 h-8 text-gray-500" />
                  <div className="flex-1">
                    <p className="font-medium text-gray-900">{section.fileName}</p>
                    {section.fileSize && (
                      <p className="text-sm text-gray-500">
                        {(section.fileSize / 1024).toFixed(1)} KB
                      </p>
                    )}
                  </div>
                  <Download className="w-5 h-5 text-gray-400" />
                </a>
              )}
            </CardBody>
          </Card>
        </div>
      );

    case 'chatbot':
      return (
        <div {...trackingAttrs} data-track="section-chatbot">
          <ChatbotSectionStudent section={section} />
        </div>
      );

    case 'assignment':
      return (
        <div {...trackingAttrs} data-track="section-assignment">
          <AssignmentSectionStudent section={section} courseId={courseId} />
        </div>
      );

    default:
      return null;
  }
};

export const CoursePlayer = () => {
  const { courseId, lectureId } = useParams<{ courseId: string; lectureId?: string }>();
  const queryClient = useQueryClient();
  const { isActualAdmin, isActualInstructor } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [currentLectureId, setCurrentLectureId] = useState<number | null>(null);
  const [modalContent, setModalContent] = useState<LectureSection | null>(null);

  const { data: enrollment, isLoading: enrollmentLoading } = useQuery({
    queryKey: ['enrollment', courseId],
    queryFn: () => enrollmentsApi.getEnrollment(parseInt(courseId!)),
  });

  // Fetch course directly for instructors/admins who may not be enrolled
  const { data: courseData, isLoading: courseLoading } = useQuery({
    queryKey: ['course', courseId],
    queryFn: () => coursesApi.getCourseById(parseInt(courseId!)),
    enabled: !enrollment?.enrolled && (isActualAdmin || isActualInstructor),
  });

  // Allow access if enrolled OR if actual admin/instructor (for testing View As mode)
  const hasAccess = enrollment?.enrolled || isActualAdmin || isActualInstructor;

  // Use enrollment course data if enrolled, otherwise use direct course data
  const course = enrollment?.enrollment?.course || courseData;

  // Fetch assignments for the course
  const { data: assignments } = useQuery({
    queryKey: ['courseAssignments', courseId],
    queryFn: () => assignmentsApi.getAssignments(parseInt(courseId!)),
    enabled: hasAccess,
  });

  // Group assignments by moduleId
  const assignmentsByModule = useMemo(() => {
    const map: Record<number, typeof assignments> = {};
    (assignments || []).filter(a => a.isPublished).forEach(assignment => {
      if (assignment.moduleId) {
        if (!map[assignment.moduleId]) {
          map[assignment.moduleId] = [];
        }
        map[assignment.moduleId]!.push(assignment);
      }
    });
    return map;
  }, [assignments]);

  // Get assignments without a module (unassigned)
  const unassignedAssignments = useMemo(() => {
    return (assignments || []).filter(a => a.isPublished && !a.moduleId);
  }, [assignments]);

  const { data: progress } = useQuery({
    queryKey: ['progress', courseId],
    queryFn: () => enrollmentsApi.getProgress(parseInt(courseId!)),
    enabled: !!enrollment?.enrolled,
  });

  const { data: lecture, isLoading: lectureLoading } = useQuery({
    queryKey: ['lecture', currentLectureId],
    queryFn: () => coursesApi.getLectureById(currentLectureId!),
    enabled: !!currentLectureId,
  });

  // Track which lectures have been logged to avoid duplicate events
  const loggedLecturesRef = useRef<Set<number>>(new Set());

  const completeMutation = useMutation({
    mutationFn: () => enrollmentsApi.markLectureComplete(parseInt(courseId!), currentLectureId!),
    onSuccess: () => {
      toast.success('Lesson completed!');
      queryClient.invalidateQueries({ queryKey: ['progress', courseId] });
      queryClient.invalidateQueries({ queryKey: ['enrollment', courseId] });

      // Log lecture_complete event
      const course = enrollment?.enrollment?.course;
      const currentModule = course?.modules?.find(m =>
        m.lectures?.some(l => l.id === currentLectureId)
      );
      const clientInfo = getClientInfo();
      learningAnalyticsApi.logContentEvent({
        sessionId: getSessionId(),
        courseId: course?.id,
        moduleId: currentModule?.id,
        lectureId: currentLectureId!,
        eventType: 'lecture_complete',
        timestamp: Date.now(),
        ...clientInfo,
      }).catch(err => debug.error('Failed to log lecture_complete event:', err));
    },
  });

  // Set initial lecture
  useEffect(() => {
    if (lectureId) {
      setCurrentLectureId(parseInt(lectureId));
    } else if (enrollment?.enrollment?.course?.modules) {
      const firstLecture = enrollment.enrollment.course.modules[0]?.lectures?.[0];
      if (firstLecture) {
        setCurrentLectureId(firstLecture.id);
      }
    }
  }, [lectureId, enrollment]);

  // Log lecture_view event when lecture changes
  useEffect(() => {
    // Only require currentLectureId and lecture data - don't require enrollment
    // This allows logging for "View As" mode and ensures events are tracked
    if (!currentLectureId || !lecture) {
      return;
    }

    // Only log if we haven't logged this lecture in this session
    if (loggedLecturesRef.current.has(currentLectureId)) {
      return;
    }
    loggedLecturesRef.current.add(currentLectureId);

    const course = enrollment?.enrollment?.course;
    const currentModule = course?.modules?.find(m =>
      m.lectures?.some(l => l.id === currentLectureId)
    );
    const clientInfo = getClientInfo();

    learningAnalyticsApi.logContentEvent({
      sessionId: getSessionId(),
      courseId: course?.id || parseInt(courseId!),
      moduleId: currentModule?.id,
      lectureId: currentLectureId,
      eventType: 'lecture_view',
      timestamp: Date.now(),
      ...clientInfo,
    }).catch(err => debug.error('Failed to log lecture_view event:', err));
  }, [currentLectureId, lecture, enrollment, courseId]);

  const isLectureCompleted = (lectureIdToCheck: number) => {
    return progress?.moduleProgress?.some(m =>
      m.lectures.some(l => l.lectureId === lectureIdToCheck && l.isCompleted)
    );
  };

  // Handler for opening text content in modal
  const handleOpenTextContent = (section: LectureSection) => {
    setModalContent(section);
    // Log section viewed
    activityLogger.logSectionViewed(
      section.id,
      section.title || undefined,
      section.type,
      currentLectureId || undefined,
      parseInt(courseId!),
      currentModule?.id
    ).catch(() => {});
  };

  // Handler for opening text content in new browser tab
  const handleOpenInNewPage = () => {
    if (modalContent) {
      // Store content in sessionStorage for the new tab to retrieve
      const contentData = {
        title: modalContent.title,
        content: modalContent.content,
        type: modalContent.type,
      };
      sessionStorage.setItem(`content-${modalContent.id}`, JSON.stringify(contentData));
      // Open in new browser tab
      window.open(`/content/section/${modalContent.id}`, '_blank');
      // Close the modal
      setModalContent(null);
    }
  };

  if (enrollmentLoading || courseLoading) {
    return <Loading fullScreen text="Loading course..." />;
  }

  if (!hasAccess) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card>
          <CardBody className="text-center py-8 px-12">
            <h2 className="text-xl font-bold text-gray-900 mb-2">Not Enrolled</h2>
            <p className="text-gray-600 mb-4">You need to enroll in this course to access the content</p>
            <Link to={`/catalog/${courseId}`} className="btn btn-primary">
              View Course
            </Link>
          </CardBody>
        </Card>
      </div>
    );
  }

  // Find current module for analytics context
  const currentModule = course?.modules?.find(m =>
    m.lectures?.some(l => l.id === currentLectureId)
  );

  // Build analytics context for tracking
  const analyticsContext = {
    courseId: course?.id,
    courseTitle: course?.title,
    moduleId: currentModule?.id,
    moduleTitle: currentModule?.title,
    lectureId: currentLectureId,
    lectureTitle: lecture?.title,
  };

  return (
    <div
      className="min-h-screen bg-gray-100 dark:bg-gray-900 flex"
      data-analytics-context={JSON.stringify(analyticsContext)}
      data-course-id={course?.id}
      data-module-id={currentModule?.id}
      data-lecture-id={currentLectureId || undefined}
    >
      {/* Mobile sidebar backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-30 lg:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar - Course Content Menu */}
      <div
        className={`
          fixed inset-y-0 left-0 z-40 w-80 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 transition-transform duration-300 ease-in-out flex-shrink-0
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
          lg:relative lg:translate-x-0 ${!sidebarOpen && 'lg:w-0 lg:overflow-hidden'}
        `}
      >
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <Link to={`/catalog/${courseId}`} className="text-sm text-primary-600 dark:text-primary-400 hover:underline flex items-center gap-1">
              <ChevronLeft className="w-4 h-4" /> Course Details
            </Link>
            {/* Close button - mobile only */}
            <button
              onClick={() => setSidebarOpen(false)}
              className="lg:hidden p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:text-gray-300 dark:hover:bg-gray-700"
              aria-label="Close sidebar"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <h2 className="font-semibold text-gray-900 dark:text-gray-100 mt-2 truncate">{course?.title}</h2>
          <Link
            to={`/courses/${courseId}/assignments`}
            className="mt-3 flex items-center gap-2 px-3 py-2 text-sm font-medium text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-900/30 hover:bg-primary-100 dark:hover:bg-primary-900/50 rounded-lg transition-colors"
          >
            <ClipboardList className="w-4 h-4" />
            View Assignments
          </Link>
        </div>

        <div className="overflow-y-auto h-[calc(100vh-140px)]">
          {course?.modules?.map((module) => (
            <div key={module.id} className="border-b border-gray-100 dark:border-gray-700">
              <div className="px-4 py-3 bg-gray-50 dark:bg-gray-700/50 flex items-center gap-2">
                <FolderOpen className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                <h3 className="font-medium text-sm text-gray-900 dark:text-gray-100">{module.title}</h3>
              </div>
              <div>
                {/* Lectures */}
                {module.lectures?.map(lec => (
                  <button
                    key={lec.id}
                    onClick={() => {
                      setCurrentLectureId(lec.id);
                      setSidebarOpen(false);
                    }}
                    className={`w-full px-4 py-2.5 flex items-center gap-3 text-left hover:bg-gray-50 dark:hover:bg-gray-700 ${
                      currentLectureId === lec.id ? 'bg-primary-50 dark:bg-primary-900/30 border-r-2 border-primary-500' : ''
                    }`}
                    data-track="sidebar-lecture-select"
                    data-track-category="navigation"
                    data-track-label={lec.title}
                    data-lecture-id={lec.id}
                    data-module-id={module.id}
                  >
                    <BookOpen className={`w-4 h-4 flex-shrink-0 ${currentLectureId === lec.id ? 'text-primary-500 dark:text-primary-400' : 'text-gray-400'}`} />
                    <span className={`text-sm ${currentLectureId === lec.id ? 'text-primary-600 dark:text-primary-400 font-medium' : 'text-gray-700 dark:text-gray-300'}`}>
                      {lec.title}
                    </span>
                    {isLectureCompleted(lec.id) && (
                      <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0 ml-auto" />
                    )}
                  </button>
                ))}

                {/* Code Labs */}
                {module.codeLabs?.filter(lab => lab.isPublished)?.map(lab => (
                  <Link
                    key={`codelab-${lab.id}`}
                    to={`/courses/${courseId}/code-labs/${lab.id}`}
                    className="w-full px-4 py-2.5 flex items-center gap-3 text-left hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-colors"
                    data-track="sidebar-codelab-select"
                    data-track-category="navigation"
                    data-track-label={lab.title}
                    data-codelab-id={lab.id}
                    data-module-id={module.id}
                    onClick={() => setSidebarOpen(false)}
                  >
                    <FlaskConical className="w-4 h-4 flex-shrink-0 text-emerald-500" />
                    <span className="text-sm text-gray-700 dark:text-gray-300 hover:text-emerald-600 dark:hover:text-emerald-400">
                      {lab.title}
                    </span>
                    <span className="ml-auto text-xs bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-400 px-1.5 py-0.5 rounded">
                      Lab
                    </span>
                  </Link>
                ))}

                {/* Assignments */}
                {assignmentsByModule[module.id]?.map(assignment => (
                  <Link
                    key={`assignment-${assignment.id}`}
                    to={assignment.submissionType === 'ai_agent'
                      ? `/courses/${courseId}/agent-assignments/${assignment.id}`
                      : `/courses/${courseId}/assignments/${assignment.id}`}
                    className={`w-full px-4 py-2.5 flex items-center gap-3 text-left transition-colors ${
                      assignment.submissionType === 'ai_agent'
                        ? 'hover:bg-purple-50'
                        : 'hover:bg-amber-50'
                    }`}
                    data-track="sidebar-assignment-select"
                    data-track-category="navigation"
                    data-track-label={assignment.title}
                    data-assignment-id={assignment.id}
                    data-module-id={module.id}
                  >
                    {assignment.submissionType === 'ai_agent' ? (
                      <Bot className="w-4 h-4 flex-shrink-0 text-purple-500" />
                    ) : (
                      <ClipboardList className="w-4 h-4 flex-shrink-0 text-amber-500" />
                    )}
                    <span className={`text-sm text-gray-700 ${
                      assignment.submissionType === 'ai_agent'
                        ? 'hover:text-purple-600'
                        : 'hover:text-amber-600'
                    }`}>
                      {assignment.title}
                    </span>
                    <span className={`ml-auto text-xs px-1.5 py-0.5 rounded ${
                      assignment.submissionType === 'ai_agent'
                        ? 'bg-purple-100 text-purple-700'
                        : 'bg-amber-100 text-amber-700'
                    }`}>
                      {assignment.submissionType === 'ai_agent' ? 'AI' : 'Due'}
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          ))}

          {/* Unassigned Assignments (not linked to any module) */}
          {unassignedAssignments.length > 0 && (
            <div className="border-b border-gray-100">
              <div className="px-4 py-3 bg-amber-50 flex items-center gap-2">
                <ClipboardList className="w-4 h-4 text-amber-500" />
                <h3 className="font-medium text-sm text-gray-900">Assignments</h3>
              </div>
              <div>
                {unassignedAssignments.map(assignment => (
                  <Link
                    key={`assignment-${assignment.id}`}
                    to={assignment.submissionType === 'ai_agent'
                      ? `/courses/${courseId}/agent-assignments/${assignment.id}`
                      : `/courses/${courseId}/assignments/${assignment.id}`}
                    className={`w-full px-4 py-2.5 flex items-center gap-3 text-left transition-colors ${
                      assignment.submissionType === 'ai_agent'
                        ? 'hover:bg-purple-50'
                        : 'hover:bg-amber-50'
                    }`}
                    data-track="sidebar-assignment-select"
                    data-track-category="navigation"
                    data-track-label={assignment.title}
                    data-assignment-id={assignment.id}
                  >
                    {assignment.submissionType === 'ai_agent' ? (
                      <Bot className="w-4 h-4 flex-shrink-0 text-purple-500" />
                    ) : (
                      <ClipboardList className="w-4 h-4 flex-shrink-0 text-amber-500" />
                    )}
                    <span className={`text-sm text-gray-700 ${
                      assignment.submissionType === 'ai_agent'
                        ? 'hover:text-purple-600'
                        : 'hover:text-amber-600'
                    }`}>
                      {assignment.title}
                    </span>
                    <span className={`ml-auto text-xs px-1.5 py-0.5 rounded ${
                      assignment.submissionType === 'ai_agent'
                        ? 'bg-purple-100 text-purple-700'
                        : 'bg-amber-100 text-amber-700'
                    }`}>
                      {assignment.submissionType === 'ai_agent' ? 'AI' : 'Due'}
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Bar with Breadcrumb */}
        <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 py-3">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg flex-shrink-0 text-gray-600 dark:text-gray-300"
              title={sidebarOpen ? 'Hide menu' : 'Show menu'}
              aria-label={sidebarOpen ? 'Hide course menu' : 'Show course menu'}
            >
              {sidebarOpen ? <X className="w-5 h-5 hidden lg:block" /> : <Menu className="w-5 h-5" />}
              <Menu className="w-5 h-5 lg:hidden" />
            </button>
            <Breadcrumb
              items={[
                { label: 'Courses', href: '/courses' },
                { label: course?.title || 'Course', href: `/courses/${courseId}` },
                ...(currentModule ? [{ label: currentModule.title, href: `/courses/${courseId}/player` }] : []),
                ...(lecture ? [{ label: lecture.title }] : []),
              ]}
            />
          </div>
        </div>

        {/* Lesson Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {lectureLoading ? (
            <Loading text="Loading lesson..." />
          ) : lecture ? (
            <div className="max-w-4xl mx-auto">
              <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-6">{lecture.title}</h1>

              {/* Video */}
              {lecture.videoUrl && (
                <div
                  className="mb-6 aspect-video bg-black rounded-lg overflow-hidden"
                  data-section-id="video"
                  data-section-title="Video"
                  data-section-type="video"
                  data-track="video-view"
                  data-track-category="content"
                  data-track-label={lecture.title}
                >
                  <iframe
                    src={lecture.videoUrl}
                    className="w-full h-full"
                    allowFullScreen
                  />
                </div>
              )}

              {/* Legacy Content - Show as card with Read Article button */}
              {lecture.content && (
                <Card
                  className="mb-6 hover:shadow-md transition-shadow"
                  data-section-id="legacy-content"
                  data-section-title="Lecture Content"
                  data-section-type="legacy-text"
                >
                  <CardBody>
                    <div className="flex items-start gap-4">
                      <div className="flex-shrink-0 p-3 rounded-lg bg-blue-100 dark:bg-blue-900/30">
                        <FileText className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-1">
                          {lecture.title || 'Lecture Content'}
                        </h3>
                        <p className="text-gray-600 dark:text-gray-400 text-sm line-clamp-3 mb-3">
                          {getPreviewText(lecture.content, 250)}
                        </p>
                        <button
                          onClick={() => {
                            setModalContent({
                              id: -1,
                              lectureId: lecture.id,
                              type: 'text',
                              order: 0,
                              title: lecture.title,
                              content: lecture.content,
                              createdAt: '',
                              updatedAt: '',
                            } as LectureSection);
                            // Log legacy content viewed
                            activityLogger.logSectionViewed(
                              -1,
                              lecture.title,
                              'legacy-text',
                              lecture.id,
                              parseInt(courseId!),
                              currentModule?.id
                            ).catch(() => {});
                          }}
                          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-primary-600 bg-primary-50 hover:bg-primary-100 rounded-lg transition-colors"
                        >
                          <BookOpen className="w-4 h-4" />
                          Read Article
                        </button>
                      </div>
                    </div>
                  </CardBody>
                </Card>
              )}

              {/* Sections */}
              {lecture.sections && lecture.sections.length > 0 && (
                <div className="space-y-6 mb-6">
                  {[...lecture.sections]
                    .sort((a, b) => a.order - b.order)
                    .map((section) => (
                      <SectionRenderer
                        key={section.id}
                        section={section}
                        courseId={parseInt(courseId!)}
                        onOpenTextContent={handleOpenTextContent}
                      />
                    ))}
                </div>
              )}

              {/* Attachments */}
              {lecture.attachments && lecture.attachments.length > 0 && (
                <Card
                  className="mb-6"
                  data-section-id="attachments"
                  data-section-title="Attachments"
                  data-section-type="attachments"
                >
                  <CardBody>
                    <h3 className="font-medium text-gray-900 mb-3">Attachments</h3>
                    <div className="space-y-2">
                      {lecture.attachments.map(attachment => (
                        <a
                          key={attachment.id}
                          href={attachment.fileUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg hover:bg-gray-100"
                          data-track="attachment-download"
                          data-track-category="content"
                          data-track-label={attachment.fileName}
                        >
                          <FileText className="w-5 h-5 text-gray-500" />
                          <span className="flex-1 text-sm text-gray-700">{attachment.fileName}</span>
                          <Download className="w-4 h-4 text-gray-400" />
                        </a>
                      ))}
                    </div>
                  </CardBody>
                </Card>
              )}

              {/* Complete Button - Optional progress tracking */}
              <div className="mt-8 pt-6 border-t border-gray-200">
                {!isLectureCompleted(lecture.id) ? (
                  <button
                    onClick={() => completeMutation.mutate()}
                    disabled={completeMutation.isPending}
                    className="flex items-center gap-2 text-sm text-gray-600 hover:text-green-600 transition-colors"
                    data-track="lesson-complete"
                    data-track-category="progress"
                    data-track-label={lecture.title}
                  >
                    <CheckCircle className="w-4 h-4" />
                    {completeMutation.isPending ? 'Saving...' : 'Mark as read'}
                  </button>
                ) : (
                  <span className="flex items-center gap-2 text-sm text-green-600">
                    <CheckCircle className="w-4 h-4" />
                    Completed
                  </span>
                )}
              </div>
            </div>
          ) : (
            <div className="text-center py-12">
              <p className="text-gray-500">Select a lesson to begin</p>
            </div>
          )}
        </div>
      </div>

      {/* Content Modal for text sections */}
      <ContentModal
        isOpen={!!modalContent}
        onClose={() => setModalContent(null)}
        title={modalContent?.title || undefined}
        content={modalContent?.content || ''}
        onOpenInNewPage={handleOpenInNewPage}
      />
    </div>
  );
};
