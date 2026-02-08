import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  BookOpen,
  ChevronDown,
  ChevronRight,
  PlayCircle,
  FileText,
  Download,
  FlaskConical,
  Sparkles,
  Upload,
  MessageSquare,
} from 'lucide-react';
import { coursesApi } from '../../api/courses';
import { resolveFileUrl } from '../../api/client';
import { useTheme } from '../../hooks/useTheme';
import { Card, CardBody } from '../common/Card';
import { Loading } from '../common/Loading';
import { AssignmentSectionStudent } from './AssignmentSectionStudent';
import { LectureSection } from '../../types';
import activityLogger from '../../services/activityLogger';
import { sanitizeHtml } from '../../utils/sanitize';

interface Forum {
  id: number;
  title: string;
  moduleId?: number;
  isPublished: boolean;
}

interface Module {
  id: number;
  title: string;
  lectures?: {
    id: number;
    title: string;
    contentType?: string;
  }[];
  codeLabs?: {
    id: number;
    title: string;
    isPublished: boolean;
  }[];
}

interface CourseCurriculumProps {
  courseId: number;
  courseName: string;
  modules: Module[];
  forums?: Forum[];
  expandedModules: number[];
  onModuleToggle: (moduleId: number) => void;
  selectedLectureId: number | null;
  onLectureSelect: (lectureId: number, title: string, moduleId: number) => void;
  hasAccess: boolean;
  onOpenContent: (content: {
    title?: string;
    content: string;
    courseId: number;
    courseName: string;
    moduleName?: string;
    lectureName?: string;
  }) => void;
}

// Helper to strip HTML and truncate for preview
const getPreviewText = (html: string, maxLength = 250): string => {
  const div = document.createElement('div');
  div.innerHTML = sanitizeHtml(html);
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
      const handleFileDownload = () => {
        activityLogger.logFileDownloaded(section.id, section.fileName || undefined, lectureId, courseId).catch(() => {});
      };
      return (
        <div className="mb-4">
          {section.title && <h4 className="font-medium mb-2" style={{ color: colors.textPrimary }}>{section.title}</h4>}
          {isImage ? (
            <img src={resolveFileUrl(section.fileUrl)} alt={section.fileName || ''} className="max-w-full rounded-lg" />
          ) : isPdf ? (
            <div>
              <iframe src={resolveFileUrl(section.fileUrl)} className="w-full h-[500px] rounded-lg border" title={section.fileName || 'PDF'} style={{ borderColor: colors.border }} />
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

export const CourseCurriculum = ({
  courseId,
  courseName,
  modules,
  forums = [],
  expandedModules,
  onModuleToggle,
  selectedLectureId,
  onLectureSelect,
  hasAccess,
  onOpenContent,
}: CourseCurriculumProps) => {
  const { isDark } = useTheme();

  const colors = {
    bg: isDark ? '#111827' : '#f9fafb',
    bgCard: isDark ? '#1f2937' : '#ffffff',
    bgHover: isDark ? '#374151' : '#f9fafb',
    bgSelected: isDark ? 'rgba(99, 102, 241, 0.2)' : '#eef2ff',
    textPrimary: isDark ? '#f3f4f6' : '#111827',
    textSecondary: isDark ? '#9ca3af' : '#6b7280',
    textMuted: isDark ? '#6b7280' : '#9ca3af',
    border: isDark ? '#374151' : '#e5e7eb',
    borderLight: isDark ? '#374151' : '#f3f4f6',
    bgPrimary: isDark ? 'rgba(99, 102, 241, 0.2)' : '#e0e7ff',
    textPrimary600: isDark ? '#a5b4fc' : '#4f46e5',
    bgPrimaryLight: isDark ? 'rgba(99, 102, 241, 0.2)' : '#eef2ff',
    bgBlue: isDark ? 'rgba(59, 130, 246, 0.2)' : '#dbeafe',
    textBlue: isDark ? '#93c5fd' : '#2563eb',
    bgTeal: isDark ? 'rgba(8, 143, 143, 0.2)' : '#f0fdfd',
    textTeal: isDark ? '#5eecec' : '#088F8F',
    bgEmerald: isDark ? 'rgba(16, 185, 129, 0.2)' : '#d1fae5',
    textEmerald: isDark ? '#6ee7b7' : '#059669',
  };

  // Group forums by moduleId
  const forumsByModule = forums.reduce((acc: Record<number, Forum[]>, forum: Forum) => {
    if (forum.moduleId && forum.isPublished) {
      if (!acc[forum.moduleId]) acc[forum.moduleId] = [];
      acc[forum.moduleId].push(forum);
    }
    return acc;
  }, {} as Record<number, Forum[]>);

  // Fetch selected lecture content
  const { data: lectureContent, isLoading: lectureLoading } = useQuery({
    queryKey: ['lecture', selectedLectureId],
    queryFn: () => coursesApi.getLectureById(selectedLectureId!),
    enabled: !!selectedLectureId,
  });

  // Find current module for breadcrumb context
  const findModuleForLecture = (lectureId: number) => {
    for (const module of modules) {
      if (module.lectures?.some(l => l.id === lectureId)) {
        return module;
      }
    }
    return null;
  };

  const handleOpenSectionContent = (section: LectureSection, lectureId?: number, moduleId?: number) => {
    const moduleInfo = modules.find(m => m.id === moduleId);
    const lectureInfo = moduleInfo?.lectures?.find(l => l.id === lectureId);

    onOpenContent({
      title: section.title || undefined,
      content: section.content || '',
      courseId,
      courseName,
      moduleName: moduleInfo?.title,
      lectureName: lectureInfo?.title,
    });

    activityLogger.logSectionViewed(
      section.id,
      section.title || undefined,
      section.type,
      lectureId,
      courseId,
      moduleId
    ).catch(() => {});
  };

  if (!modules || modules.length === 0) {
    return (
      <Card>
        <CardBody className="text-center py-8">
          <BookOpen className="w-12 h-12 mx-auto mb-3" style={{ color: colors.textMuted }} />
          <p style={{ color: colors.textSecondary }}>No content available yet</p>
        </CardBody>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {modules.map((module, moduleIndex) => (
        <Card key={module.id}>
          <button
            onClick={() => onModuleToggle(module.id)}
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
                    onClick={() => hasAccess && onLectureSelect(lecture.id, lecture.title, module.id)}
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
                                      onOpenContent({
                                        title: lectureContent.title,
                                        content: lectureContent.content!,
                                        courseId,
                                        courseName,
                                        moduleName: module.title,
                                        lectureName: lecture.title,
                                      });
                                      activityLogger.logSectionViewed(
                                        -1,
                                        lectureContent.title,
                                        'legacy-text',
                                        lecture.id,
                                        courseId,
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
                              courseId={courseId}
                              lectureId={lecture.id}
                              moduleId={module.id}
                              onOpenContent={handleOpenSectionContent}
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
                                    href={resolveFileUrl(att.fileUrl)}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center gap-2 p-2 rounded transition-colors"
                                    style={{ backgroundColor: colors.bgCard }}
                                    onClick={() => activityLogger.logFileDownloaded(att.id, att.fileName, lecture.id, courseId).catch(() => {})}
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
                  to={hasAccess ? `/courses/${courseId}/code-labs/${lab.id}` : '#'}
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

              {/* Module Forums */}
              {forumsByModule[module.id]?.map(forum => (
                <Link
                  key={`forum-${forum.id}`}
                  to={hasAccess ? `/courses/${courseId}/forums/${forum.id}` : '#'}
                  className={`w-full px-4 py-3 flex items-center gap-3 ${!hasAccess ? 'opacity-60 cursor-not-allowed' : ''}`}
                  onClick={(e) => !hasAccess && e.preventDefault()}
                >
                  <MessageSquare className="w-5 h-5" style={{ color: colors.textTeal }} />
                  <span className="flex-1 text-sm" style={{ color: colors.textPrimary }}>{forum.title}</span>
                  <span
                    className="text-xs px-2 py-0.5 rounded"
                    style={{ backgroundColor: colors.bgTeal, color: colors.textTeal }}
                  >
                    Forum
                  </span>
                </Link>
              ))}
            </div>
          )}
        </Card>
      ))}
    </div>
  );
};

export default CourseCurriculum;
