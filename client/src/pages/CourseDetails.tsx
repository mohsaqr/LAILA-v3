import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, Link } from 'react-router-dom';
import {
  Users,
  BookOpen,
  PlayCircle,
  FileText,
  ChevronDown,
  ChevronRight,
  Edit,
  Settings,
  Download,
  FlaskConical,
  Sparkles,
  Upload,
  ClipboardList,
  Bot,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { coursesApi } from '../api/courses';
import { enrollmentsApi } from '../api/enrollments';
import { assignmentsApi } from '../api/assignments';
import { useAuth } from '../hooks/useAuth';
import { useTheme } from '../hooks/useTheme';
import { Card, CardBody } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { Loading } from '../components/common/Loading';
import { Breadcrumb } from '../components/common/Breadcrumb';
import { ChatbotSectionStudent } from '../components/course/ChatbotSectionStudent';
import { AssignmentSectionStudent } from '../components/course/AssignmentSectionStudent';
import { ContentModal } from '../components/content/ContentModal';
import { useState, useEffect } from 'react';
import { LectureSection } from '../types';
import activityLogger from '../services/activityLogger';

// Helper to strip HTML and truncate for preview
const getPreviewText = (html: string, maxLength = 250): string => {
  const div = document.createElement('div');
  div.innerHTML = html;
  const text = div.textContent || div.innerText || '';
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength).trim() + '...';
};

// Section renderer for lecture content
interface SectionRendererProps {
  section: LectureSection;
  courseId: number;
  lectureId?: number;
  moduleId?: number;
  onOpenContent?: (section: LectureSection, lectureId?: number, moduleId?: number) => void;
  colors: Record<string, string>;
}

const SectionRenderer = ({ section, courseId, lectureId, moduleId, onOpenContent, colors }: SectionRendererProps) => {
  switch (section.type) {
    case 'text':
    case 'ai-generated': {
      const previewText = section.content ? getPreviewText(section.content, 250) : '';
      return (
        <div
          className="mb-4 p-3 rounded-lg border hover:shadow-sm transition-shadow"
          style={{ backgroundColor: colors.bgCard, borderColor: colors.border }}
        >
          <div className="flex items-start gap-3">
            <div
              className="flex-shrink-0 p-2 rounded-lg"
              style={{ backgroundColor: section.type === 'ai-generated' ? colors.bgTeal : colors.bgBlue }}
            >
              {section.type === 'ai-generated' ? (
                <Sparkles className="w-5 h-5" style={{ color: colors.textTeal }} />
              ) : (
                <FileText className="w-5 h-5" style={{ color: colors.textBlue }} />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="font-medium mb-1" style={{ color: colors.textPrimary }}>
                {section.title || 'Text Content'}
              </h4>
              {section.content ? (
                <>
                  <p className="text-sm line-clamp-3 mb-2" style={{ color: colors.textSecondary }}>{previewText}</p>
                  <button
                    onClick={() => onOpenContent?.(section, lectureId, moduleId)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md transition-colors"
                    style={{ backgroundColor: colors.bgPrimaryLight, color: colors.textPrimary600 }}
                  >
                    <BookOpen className="w-4 h-4" />
                    Read Article
                  </button>
                </>
              ) : (
                <p className="text-sm italic" style={{ color: colors.textMuted }}>No content yet</p>
              )}
            </div>
          </div>
        </div>
      );
    }

    case 'file':
      if (!section.fileUrl) {
        return (
          <div className="mb-4 p-4 rounded-lg text-center" style={{ backgroundColor: colors.bgHover }}>
            <Upload className="w-8 h-8 mx-auto mb-2" style={{ color: colors.textMuted }} />
            <p style={{ color: colors.textSecondary }}>No file uploaded</p>
          </div>
        );
      }
      const isImage = section.fileType?.startsWith('image/');
      const isPdf = section.fileType === 'application/pdf';
      return (
        <div className="mb-4">
          {section.title && <h4 className="font-medium mb-2" style={{ color: colors.textPrimary }}>{section.title}</h4>}
          {isImage ? (
            <img src={section.fileUrl} alt={section.fileName || ''} className="max-w-full rounded-lg" />
          ) : isPdf ? (
            <div>
              <iframe src={section.fileUrl} className="w-full h-[500px] rounded-lg border" title={section.fileName || 'PDF'} style={{ borderColor: colors.border }} />
              <a href={section.fileUrl} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex items-center gap-2 text-primary-600 hover:underline">
                <Download className="w-4 h-4" /> Download {section.fileName}
              </a>
            </div>
          ) : (
            <a
              href={section.fileUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 p-4 rounded-lg transition-colors"
              style={{ backgroundColor: colors.bgHover }}
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

    case 'chatbot':
      return (
        <div className="mb-4">
          <ChatbotSectionStudent section={section} />
        </div>
      );

    case 'assignment':
      return (
        <div className="mb-4">
          <AssignmentSectionStudent section={section} courseId={courseId} />
        </div>
      );

    default:
      return null;
  }
};

export const CourseDetails = () => {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const { isAuthenticated, user, isInstructor: isUserInstructor, isActualAdmin, isActualInstructor } = useAuth();
  const { isDark } = useTheme();
  const [expandedModules, setExpandedModules] = useState<number[]>([]);
  const [selectedLectureId, setSelectedLectureId] = useState<number | null>(null);
  const [modalContent, setModalContent] = useState<{ title?: string; content: string } | null>(null);

  // Theme colors
  const colors = {
    bg: isDark ? '#111827' : '#f9fafb',
    bgCard: isDark ? '#1f2937' : '#ffffff',
    bgHeader: isDark ? '#1f2937' : '#ffffff',
    bgHover: isDark ? '#374151' : '#f9fafb',
    bgSelected: isDark ? 'rgba(99, 102, 241, 0.2)' : '#eef2ff',
    textPrimary: isDark ? '#f3f4f6' : '#111827',
    textSecondary: isDark ? '#9ca3af' : '#6b7280',
    textMuted: isDark ? '#6b7280' : '#9ca3af',
    border: isDark ? '#374151' : '#e5e7eb',
    borderLight: isDark ? '#374151' : '#f3f4f6',
    // Icon backgrounds
    bgPrimary: isDark ? 'rgba(99, 102, 241, 0.2)' : '#e0e7ff',
    textPrimary600: isDark ? '#a5b4fc' : '#4f46e5',
    bgPrimaryLight: isDark ? 'rgba(99, 102, 241, 0.2)' : '#eef2ff',
    bgBlue: isDark ? 'rgba(59, 130, 246, 0.2)' : '#dbeafe',
    textBlue: isDark ? '#93c5fd' : '#2563eb',
    bgTeal: isDark ? 'rgba(8, 143, 143, 0.2)' : '#f0fdfd',
    textTeal: isDark ? '#5eecec' : '#088F8F',
    bgAmber: isDark ? 'rgba(245, 158, 11, 0.2)' : '#fef3c7',
    textAmber: isDark ? '#fcd34d' : '#d97706',
    bgEmerald: isDark ? 'rgba(16, 185, 129, 0.2)' : '#d1fae5',
    textEmerald: isDark ? '#6ee7b7' : '#059669',
  };

  const { data: course, isLoading } = useQuery({
    queryKey: ['course', id],
    queryFn: () => coursesApi.getCourseById(parseInt(id!)),
  });

  const { data: enrollmentData } = useQuery({
    queryKey: ['enrollment', id],
    queryFn: () => enrollmentsApi.getEnrollment(parseInt(id!)),
    enabled: isAuthenticated,
  });

  // Fetch assignments for the course (for enrolled users or instructors/admins)
  const { data: assignments } = useQuery({
    queryKey: ['courseAssignments', id],
    queryFn: () => assignmentsApi.getAssignments(parseInt(id!)),
    enabled: isAuthenticated && (enrollmentData?.enrolled || isActualAdmin || isActualInstructor),
  });

  // Filter to only published assignments
  const publishedAssignments = (assignments || []).filter(a => a.isPublished);

  // Fetch selected lecture content
  const { data: lectureContent, isLoading: lectureLoading } = useQuery({
    queryKey: ['lecture', selectedLectureId],
    queryFn: () => coursesApi.getLectureById(selectedLectureId!),
    enabled: !!selectedLectureId,
  });

  const enrollMutation = useMutation({
    mutationFn: () => enrollmentsApi.enroll(parseInt(id!), course?.title),
    onSuccess: () => {
      toast.success('Successfully enrolled!');
      queryClient.invalidateQueries({ queryKey: ['enrollment', id] });
      queryClient.invalidateQueries({ queryKey: ['enrollments'] });
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  // Log course view when course loads
  useEffect(() => {
    if (course && isAuthenticated) {
      activityLogger.logCourseViewed(course.id, course.title).catch(() => {});
    }
  }, [course?.id, isAuthenticated]);

  const toggleModule = (moduleId: number) => {
    setExpandedModules(prev =>
      prev.includes(moduleId) ? prev.filter(mid => mid !== moduleId) : [...prev, moduleId]
    );
  };

  const selectLecture = (lectureId: number, lectureTitle?: string, moduleId?: number) => {
    if (selectedLectureId !== lectureId) {
      // Log lecture started when opening a new lecture
      activityLogger.logLectureStarted(lectureId, lectureTitle, parseInt(id!), moduleId).catch(() => {});
    }
    setSelectedLectureId(selectedLectureId === lectureId ? null : lectureId);
  };

  // Handler for opening content in modal
  const handleOpenContent = (section: LectureSection, lectureId?: number, moduleId?: number) => {
    setModalContent({ title: section.title || undefined, content: section.content || '' });
    // Log section viewed
    activityLogger.logSectionViewed(
      section.id,
      section.title || undefined,
      section.type,
      lectureId,
      parseInt(id!),
      moduleId
    ).catch(() => {});
  };

  // Handler for opening content in new tab
  const handleOpenInNewPage = () => {
    if (modalContent) {
      const contentId = Date.now();
      sessionStorage.setItem(`content-${contentId}`, JSON.stringify(modalContent));
      window.open(`/content/section/${contentId}`, '_blank');
      setModalContent(null);
    }
  };

  if (isLoading) {
    return <Loading fullScreen text="Loading course..." />;
  }

  if (!course) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-12 text-center">
        <h2 className="text-2xl font-bold" style={{ color: colors.textPrimary }}>Course not found</h2>
        <Link to="/catalog" className="text-primary-600 hover:underline mt-2 inline-block">Back to catalog</Link>
      </div>
    );
  }

  const isEnrolled = enrollmentData?.enrolled;
  const isCourseInstructor = user?.id === course.instructorId;
  // Only show instructor controls if user is actual course instructor AND not viewing as student
  const showInstructorControls = isCourseInstructor && isUserInstructor;
  // For ACCESS: use actual roles (so instructors can test student view)
  // For UI CONTROLS: use effective roles (isUserInstructor, isAdmin)
  const hasAccess = isEnrolled || isActualAdmin || isActualInstructor;
  const totalLectures = course.modules?.reduce((sum, m) => sum + (m.lectures?.length || 0), 0) || 0;

  return (
    <div className="min-h-screen" style={{ backgroundColor: colors.bg }}>
      {/* Breadcrumb */}
      <div style={{ backgroundColor: colors.bgHeader, borderBottom: `1px solid ${colors.border}` }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
          <Breadcrumb
            items={[
              { label: 'Courses', href: '/courses' },
              { label: course.category || 'General', href: `/courses?category=${encodeURIComponent(course.category || '')}` },
              { label: course.title },
            ]}
          />
        </div>
      </div>

      {/* Hero Section */}
      <div className="gradient-bg text-white py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h1 className="text-2xl md:text-3xl font-bold mb-2">{course.title}</h1>
          <p className="text-white/90 mb-4">{course.description}</p>
          <div className="flex flex-wrap items-center gap-4 text-sm">
            <span className="flex items-center gap-1"><Users className="w-4 h-4" /> {course._count?.enrollments || 0} students</span>
            <span className="flex items-center gap-1"><BookOpen className="w-4 h-4" /> {course.modules?.length || 0} modules</span>
            <span className="flex items-center gap-1"><PlayCircle className="w-4 h-4" /> {totalLectures} lessons</span>
            <span>by {course.instructor?.fullname}</span>
          </div>

          {/* Action buttons */}
          <div className="mt-4 flex flex-wrap gap-3">
            {showInstructorControls && (
              <>
                <Link to={`/teach/courses/${course.id}/curriculum`} className="btn bg-white/20 hover:bg-white/30 text-white text-sm">
                  <Edit className="w-4 h-4 mr-1" /> Edit Course
                </Link>
                <Link to={`/teach/courses/${course.id}/edit`} className="btn bg-white/20 hover:bg-white/30 text-white text-sm">
                  <Settings className="w-4 h-4 mr-1" /> Settings
                </Link>
              </>
            )}
            {!hasAccess && isAuthenticated && (
              <Button onClick={() => enrollMutation.mutate()} loading={enrollMutation.isPending} className="bg-white text-primary-600 hover:bg-gray-100">
                Enroll Now - Free
              </Button>
            )}
            {!isAuthenticated && (
              <Link to="/login" className="btn bg-white text-primary-600 hover:bg-gray-100">Sign in to Enroll</Link>
            )}
          </div>
        </div>
      </div>

      {/* Course Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {course.modules && course.modules.length > 0 ? (
          <div className="space-y-3">
            {course.modules.map((module, moduleIndex) => (
              <Card key={module.id}>
                <button
                  onClick={() => toggleModule(module.id)}
                  className="w-full p-4 flex items-center justify-between text-left transition-colors"
                  style={{ backgroundColor: expandedModules.includes(module.id) ? colors.bgSelected : 'transparent' }}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center font-medium text-sm"
                      style={{ backgroundColor: colors.bgPrimary, color: colors.textPrimary600 }}
                    >
                      {moduleIndex + 1}
                    </div>
                    <div>
                      <h3 className="font-medium" style={{ color: colors.textPrimary }}>{module.title}</h3>
                      <p className="text-sm" style={{ color: colors.textSecondary }}>{module.lectures?.length || 0} lessons</p>
                    </div>
                  </div>
                  {expandedModules.includes(module.id) ? (
                    <ChevronDown className="w-5 h-5" style={{ color: colors.textMuted }} />
                  ) : (
                    <ChevronRight className="w-5 h-5" style={{ color: colors.textMuted }} />
                  )}
                </button>

                {expandedModules.includes(module.id) && (
                  <div style={{ borderTop: `1px solid ${colors.borderLight}` }}>
                    {/* Lectures */}
                    {module.lectures?.map((lecture) => (
                      <div key={lecture.id}>
                        <button
                          onClick={() => hasAccess && selectLecture(lecture.id, lecture.title, module.id)}
                          disabled={!hasAccess}
                          className={`w-full px-4 py-3 flex items-center gap-3 text-left transition-colors ${!hasAccess ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}
                          style={{
                            backgroundColor: selectedLectureId === lecture.id ? colors.bgSelected : 'transparent',
                          }}
                        >
                          <div
                            className="w-6 h-6 rounded-full flex items-center justify-center"
                            style={{ backgroundColor: hasAccess ? colors.bgPrimary : colors.bgHover }}
                          >
                            {lecture.contentType === 'video' ? (
                              <PlayCircle className="w-4 h-4" style={{ color: hasAccess ? colors.textPrimary600 : colors.textMuted }} />
                            ) : (
                              <FileText className="w-4 h-4" style={{ color: hasAccess ? colors.textPrimary600 : colors.textMuted }} />
                            )}
                          </div>
                          <span className="flex-1 text-sm" style={{ color: hasAccess ? colors.textPrimary : colors.textMuted }}>{lecture.title}</span>
                          {selectedLectureId === lecture.id ? (
                            <ChevronDown className="w-4 h-4" style={{ color: colors.textMuted }} />
                          ) : (
                            <ChevronRight className="w-4 h-4" style={{ color: colors.textMuted }} />
                          )}
                        </button>

                        {/* Inline lecture content */}
                        {selectedLectureId === lecture.id && hasAccess && (
                          <div className="px-4 py-4" style={{ backgroundColor: colors.bgHover, borderTop: `1px solid ${colors.borderLight}` }}>
                            {lectureLoading ? (
                              <div className="text-center py-4"><Loading text="Loading content..." /></div>
                            ) : lectureContent ? (
                              <div>
                                {/* Video */}
                                {lectureContent.videoUrl && (
                                  <div className="mb-4 aspect-video bg-black rounded-lg overflow-hidden">
                                    <iframe src={lectureContent.videoUrl} className="w-full h-full" allowFullScreen />
                                  </div>
                                )}
                                {/* Legacy content - as card */}
                                {lectureContent.content && (
                                  <div
                                    className="mb-4 p-3 rounded-lg border hover:shadow-sm transition-shadow"
                                    style={{ backgroundColor: colors.bgCard, borderColor: colors.border }}
                                  >
                                    <div className="flex items-start gap-3">
                                      <div className="flex-shrink-0 p-2 rounded-lg" style={{ backgroundColor: colors.bgBlue }}>
                                        <FileText className="w-5 h-5" style={{ color: colors.textBlue }} />
                                      </div>
                                      <div className="flex-1 min-w-0">
                                        <h4 className="font-medium mb-1" style={{ color: colors.textPrimary }}>{lectureContent.title}</h4>
                                        <p className="text-sm line-clamp-3 mb-2" style={{ color: colors.textSecondary }}>
                                          {getPreviewText(lectureContent.content, 250)}
                                        </p>
                                        <button
                                          onClick={() => {
                                            setModalContent({ title: lectureContent.title, content: lectureContent.content! });
                                            // Log legacy content viewed
                                            activityLogger.logSectionViewed(
                                              -1,
                                              lectureContent.title,
                                              'legacy-text',
                                              lecture.id,
                                              parseInt(id!),
                                              module.id
                                            ).catch(() => {});
                                          }}
                                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md transition-colors"
                                          style={{ backgroundColor: colors.bgPrimaryLight, color: colors.textPrimary600 }}
                                        >
                                          <BookOpen className="w-4 h-4" />
                                          Read Article
                                        </button>
                                      </div>
                                    </div>
                                  </div>
                                )}
                                {/* Sections */}
                                {lectureContent.sections?.sort((a, b) => a.order - b.order).map((section) => (
                                  <SectionRenderer
                                    key={section.id}
                                    section={section}
                                    courseId={parseInt(id!)}
                                    lectureId={lecture.id}
                                    moduleId={module.id}
                                    onOpenContent={handleOpenContent}
                                    colors={colors}
                                  />
                                ))}
                                {/* Attachments */}
                                {lectureContent.attachments && lectureContent.attachments.length > 0 && (
                                  <div className="mt-4 pt-4" style={{ borderTop: `1px solid ${colors.border}` }}>
                                    <h4 className="font-medium mb-2" style={{ color: colors.textPrimary }}>Attachments</h4>
                                    <div className="space-y-2">
                                      {lectureContent.attachments.map(att => (
                                        <a
                                          key={att.id}
                                          href={att.fileUrl}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="flex items-center gap-2 p-2 rounded transition-colors"
                                          style={{ backgroundColor: colors.bgCard }}
                                        >
                                          <FileText className="w-4 h-4" style={{ color: colors.textMuted }} />
                                          <span className="text-sm" style={{ color: colors.textSecondary }}>{att.fileName}</span>
                                          <Download className="w-4 h-4 ml-auto" style={{ color: colors.textMuted }} />
                                        </a>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                            ) : (
                              <p style={{ color: colors.textSecondary }}>No content available</p>
                            )}
                          </div>
                        )}
                      </div>
                    ))}

                    {/* Code Labs */}
                    {module.codeLabs?.filter(lab => lab.isPublished)?.map(lab => (
                      <Link
                        key={`codelab-${lab.id}`}
                        to={hasAccess ? `/courses/${course.id}/code-labs/${lab.id}` : '#'}
                        className={`w-full px-4 py-3 flex items-center gap-3 ${!hasAccess ? 'opacity-60 cursor-not-allowed' : ''}`}
                        onClick={(e) => !hasAccess && e.preventDefault()}
                      >
                        <FlaskConical className="w-5 h-5" style={{ color: colors.textEmerald }} />
                        <span className="flex-1 text-sm" style={{ color: colors.textPrimary }}>{lab.title}</span>
                        <span
                          className="text-xs px-2 py-0.5 rounded"
                          style={{ backgroundColor: colors.bgEmerald, color: colors.textEmerald }}
                        >
                          Lab
                        </span>
                      </Link>
                    ))}
                  </div>
                )}
              </Card>
            ))}
          </div>
        ) : (
          <Card>
            <CardBody className="text-center py-8">
              <BookOpen className="w-12 h-12 mx-auto mb-3" style={{ color: colors.textMuted }} />
              <p style={{ color: colors.textSecondary }}>No content available yet</p>
            </CardBody>
          </Card>
        )}

        {/* Assignments Section */}
        {hasAccess && publishedAssignments.length > 0 && (
          <div className="mt-8">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2" style={{ color: colors.textPrimary }}>
              <ClipboardList className="w-6 h-6" style={{ color: colors.textAmber }} />
              Assignments
            </h2>
            <div className="space-y-3">
              {publishedAssignments.map((assignment) => (
                <Card key={assignment.id} hover>
                  <Link
                    to={assignment.submissionType === 'ai_agent'
                      ? `/courses/${course.id}/agent-assignments/${assignment.id}`
                      : `/courses/${course.id}/assignments/${assignment.id}`}
                    className="block"
                  >
                    <CardBody className="flex items-center gap-4">
                      <div
                        className="w-12 h-12 rounded-lg flex items-center justify-center"
                        style={{
                          backgroundColor: assignment.submissionType === 'ai_agent' ? colors.bgTeal : colors.bgAmber
                        }}
                      >
                        {assignment.submissionType === 'ai_agent' ? (
                          <Bot className="w-6 h-6" style={{ color: colors.textTeal }} />
                        ) : (
                          <ClipboardList className="w-6 h-6" style={{ color: colors.textAmber }} />
                        )}
                      </div>
                      <div className="flex-1">
                        <h3 className="font-medium" style={{ color: colors.textPrimary }}>{assignment.title}</h3>
                        <div className="flex items-center gap-3 text-sm" style={{ color: colors.textSecondary }}>
                          {assignment.dueDate && (
                            <span>Due: {new Date(assignment.dueDate).toLocaleDateString()}</span>
                          )}
                          <span>{assignment.points} points</span>
                          <span
                            className="px-2 py-0.5 rounded text-xs"
                            style={{
                              backgroundColor: assignment.submissionType === 'ai_agent' ? colors.bgTeal : colors.bgAmber,
                              color: assignment.submissionType === 'ai_agent' ? colors.textTeal : colors.textAmber,
                            }}
                          >
                            {assignment.submissionType === 'ai_agent' ? 'AI Agent' : 'Standard'}
                          </span>
                        </div>
                      </div>
                      <ChevronRight className="w-5 h-5" style={{ color: colors.textMuted }} />
                    </CardBody>
                  </Link>
                </Card>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Content Modal */}
      <ContentModal
        isOpen={!!modalContent}
        onClose={() => setModalContent(null)}
        title={modalContent?.title}
        content={modalContent?.content || ''}
        onOpenInNewPage={handleOpenInNewPage}
      />
    </div>
  );
};
