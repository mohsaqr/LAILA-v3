import { useState, useEffect } from 'react';
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
} from 'lucide-react';
import toast from 'react-hot-toast';
import { coursesApi } from '../api/courses';
import { enrollmentsApi } from '../api/enrollments';
import { Card, CardBody } from '../components/common/Card';
import { Loading } from '../components/common/Loading';
import { ChatbotSectionStudent } from '../components/course/ChatbotSectionStudent';
import { AssignmentSectionStudent } from '../components/course/AssignmentSectionStudent';
import { LectureSection } from '../types';

// Section renderer for different section types - with analytics tracking
const SectionRenderer = ({ section, courseId }: { section: LectureSection; courseId: number }) => {
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
    case 'ai-generated':
      return (
        <div {...trackingAttrs} data-track={`section-view-${section.type}`}>
          <Card>
            {section.title && (
              <div className="px-6 py-3 border-b border-gray-100 bg-gray-50">
                <div className="flex items-center gap-2">
                  {section.type === 'ai-generated' && <Sparkles className="w-4 h-4 text-purple-500" />}
                  <h3 className="font-medium text-gray-900">{section.title}</h3>
                </div>
              </div>
            )}
            <CardBody>
              {section.content ? (
                <div
                  className="prose max-w-none"
                  dangerouslySetInnerHTML={{ __html: section.content }}
                />
              ) : (
                <p className="text-gray-500 italic">No content yet</p>
              )}
            </CardBody>
          </Card>
        </div>
      );

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
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [currentLectureId, setCurrentLectureId] = useState<number | null>(null);

  const { data: enrollment, isLoading: enrollmentLoading } = useQuery({
    queryKey: ['enrollment', courseId],
    queryFn: () => enrollmentsApi.getEnrollment(parseInt(courseId!)),
  });

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

  const completeMutation = useMutation({
    mutationFn: () => enrollmentsApi.markLectureComplete(parseInt(courseId!), currentLectureId!),
    onSuccess: () => {
      toast.success('Lesson completed!');
      queryClient.invalidateQueries({ queryKey: ['progress', courseId] });
      queryClient.invalidateQueries({ queryKey: ['enrollment', courseId] });
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

  const isLectureCompleted = (lectureIdToCheck: number) => {
    return progress?.moduleProgress?.some(m =>
      m.lectures.some(l => l.lectureId === lectureIdToCheck && l.isCompleted)
    );
  };

  if (enrollmentLoading) {
    return <Loading fullScreen text="Loading course..." />;
  }

  if (!enrollment?.enrolled) {
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

  const course = enrollment.enrollment?.course;

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
      className="min-h-screen bg-gray-100 flex"
      data-analytics-context={JSON.stringify(analyticsContext)}
      data-course-id={course?.id}
      data-module-id={currentModule?.id}
      data-lecture-id={currentLectureId || undefined}
    >
      {/* Sidebar - Course Content Menu */}
      <div className={`${sidebarOpen ? 'w-80' : 'w-0'} bg-white border-r border-gray-200 transition-all overflow-hidden flex-shrink-0`}>
        <div className="p-4 border-b border-gray-200">
          <Link to={`/catalog/${courseId}`} className="text-sm text-primary-600 hover:underline flex items-center gap-1">
            <ChevronLeft className="w-4 h-4" /> Course Details
          </Link>
          <h2 className="font-semibold text-gray-900 mt-2 truncate">{course?.title}</h2>
          <Link
            to={`/courses/${courseId}/assignments`}
            className="mt-3 flex items-center gap-2 px-3 py-2 text-sm font-medium text-primary-600 bg-primary-50 hover:bg-primary-100 rounded-lg transition-colors"
          >
            <ClipboardList className="w-4 h-4" />
            View Assignments
          </Link>
        </div>

        <div className="overflow-y-auto h-[calc(100vh-140px)]">
          {course?.modules?.map((module) => (
            <div key={module.id} className="border-b border-gray-100">
              <div className="px-4 py-3 bg-gray-50 flex items-center gap-2">
                <FolderOpen className="w-4 h-4 text-gray-500" />
                <h3 className="font-medium text-sm text-gray-900">{module.title}</h3>
              </div>
              <div>
                {/* Lectures */}
                {module.lectures?.map(lec => (
                  <button
                    key={lec.id}
                    onClick={() => setCurrentLectureId(lec.id)}
                    className={`w-full px-4 py-2.5 flex items-center gap-3 text-left hover:bg-gray-50 ${
                      currentLectureId === lec.id ? 'bg-primary-50 border-r-2 border-primary-500' : ''
                    }`}
                    data-track="sidebar-lecture-select"
                    data-track-category="navigation"
                    data-track-label={lec.title}
                    data-lecture-id={lec.id}
                    data-module-id={module.id}
                  >
                    <BookOpen className={`w-4 h-4 flex-shrink-0 ${currentLectureId === lec.id ? 'text-primary-500' : 'text-gray-400'}`} />
                    <span className={`text-sm ${currentLectureId === lec.id ? 'text-primary-600 font-medium' : 'text-gray-700'}`}>
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
                    className="w-full px-4 py-2.5 flex items-center gap-3 text-left hover:bg-emerald-50 transition-colors"
                    data-track="sidebar-codelab-select"
                    data-track-category="navigation"
                    data-track-label={lab.title}
                    data-codelab-id={lab.id}
                    data-module-id={module.id}
                  >
                    <FlaskConical className="w-4 h-4 flex-shrink-0 text-emerald-500" />
                    <span className="text-sm text-gray-700 hover:text-emerald-600">
                      {lab.title}
                    </span>
                    <span className="ml-auto text-xs bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded">
                      Lab
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {/* Top Bar */}
        <div className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-2 hover:bg-gray-100 rounded-lg"
            title={sidebarOpen ? 'Hide menu' : 'Show menu'}
          >
            {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
          <div className="text-sm text-gray-500">
            {lecture?.title}
          </div>
        </div>

        {/* Lesson Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {lectureLoading ? (
            <Loading text="Loading lesson..." />
          ) : lecture ? (
            <div className="max-w-4xl mx-auto">
              <h1 className="text-2xl font-bold text-gray-900 mb-6">{lecture.title}</h1>

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

              {/* Legacy Content */}
              {lecture.content && (
                <Card
                  className="mb-6"
                  data-section-id="legacy-content"
                  data-section-title="Lecture Content"
                  data-section-type="legacy-text"
                >
                  <CardBody>
                    <div
                      className="prose max-w-none"
                      dangerouslySetInnerHTML={{ __html: lecture.content }}
                    />
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
    </div>
  );
};
