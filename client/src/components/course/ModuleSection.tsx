import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ChevronDown, ChevronRight, FileText, PlayCircle, Layers, FlaskConical, FileQuestion, ClipboardList, MessageSquare, Bot } from 'lucide-react';
import { useTheme } from '../../hooks/useTheme';
import { ContentCard, ContentType, ContentCardSize } from './ContentCard';
import type { CourseModule, Lecture, CodeLab, Assignment, CurriculumViewMode } from '../../types';
import type { Forum } from '../../api/forums';
import type { Quiz } from '../../api/quizzes';

interface ModuleSectionProps {
  module: CourseModule;
  moduleIndex: number;
  courseId: number;
  lectures?: Lecture[];
  codeLabs?: CodeLab[];
  quizzes?: Quiz[];
  assignments?: Assignment[];
  forums?: Forum[];
  hasAccess: boolean;
  viewMode?: CurriculumViewMode;
}

// Content item interface for unified handling
interface ContentItem {
  id: number;
  type: ContentType;
  title: string;
  subtitle?: string;
  metadata?: string;
  href: string;
}

// Icon mapping for list/accordion views
const iconMap: Record<ContentType, React.ElementType> = {
  lecture: FileText,
  video: PlayCircle,
  mixed: Layers,
  lab: FlaskConical,
  quiz: FileQuestion,
  assignment: ClipboardList,
  ai_agent: Bot,
  forum: MessageSquare,
  ai: FileText,
};

// Color mapping for list view
const colorMap: Record<ContentType, { bg: string; bgDark: string; text: string; textDark: string }> = {
  lecture: { bg: 'bg-blue-50', bgDark: 'rgba(59, 130, 246, 0.15)', text: '#2563eb', textDark: '#93c5fd' },
  video: { bg: 'bg-purple-50', bgDark: 'rgba(139, 92, 246, 0.15)', text: '#7c3aed', textDark: '#c4b5fd' },
  mixed: { bg: 'bg-slate-50', bgDark: 'rgba(100, 116, 139, 0.15)', text: '#475569', textDark: '#94a3b8' },
  lab: { bg: 'bg-indigo-50', bgDark: 'rgba(99, 102, 241, 0.15)', text: '#4f46e5', textDark: '#a5b4fc' },
  quiz: { bg: 'bg-emerald-50', bgDark: 'rgba(16, 185, 129, 0.15)', text: '#059669', textDark: '#6ee7b7' },
  assignment: { bg: 'bg-amber-50', bgDark: 'rgba(245, 158, 11, 0.15)', text: '#d97706', textDark: '#fcd34d' },
  ai_agent: { bg: 'bg-teal-50', bgDark: 'rgba(8, 143, 143, 0.15)', text: '#0d9488', textDark: '#5eead4' },
  forum: { bg: 'bg-cyan-50', bgDark: 'rgba(6, 182, 212, 0.15)', text: '#0891b2', textDark: '#67e8f9' },
  ai: { bg: 'bg-teal-50', bgDark: 'rgba(20, 184, 166, 0.15)', text: '#0d9488', textDark: '#5eead4' },
};

export const ModuleSection = ({
  module,
  moduleIndex,
  courseId,
  lectures = [],
  codeLabs = [],
  quizzes = [],
  assignments = [],
  forums = [],
  hasAccess,
  viewMode = 'mini-cards',
}: ModuleSectionProps) => {
  const { t } = useTranslation(['courses']);
  const { isDark } = useTheme();
  const [isExpanded, setIsExpanded] = useState(true);

  const colors = {
    bg: isDark ? '#111827' : '#f9fafb',
    bgCard: isDark ? '#1f2937' : '#ffffff',
    textPrimary: isDark ? '#f3f4f6' : '#111827',
    textSecondary: isDark ? '#9ca3af' : '#6b7280',
    border: isDark ? '#374151' : '#e5e7eb',
    bgPrimary: isDark ? 'rgba(99, 102, 241, 0.2)' : '#e0e7ff',
    textPrimary600: isDark ? '#a5b4fc' : '#4f46e5',
    bgHover: isDark ? '#374151' : '#f9fafb',
  };

  // Filter published items
  const publishedLectures = lectures.filter(l => l.isPublished);
  const publishedLabs = codeLabs.filter(l => l.isPublished);
  const publishedQuizzes = quizzes.filter(q => q.isPublished);
  const publishedAssignments = assignments.filter(a => a.isPublished);
  const publishedForums = forums.filter(f => f.isPublished);

  // Check if module has any content
  const hasContent =
    publishedLectures.length > 0 ||
    publishedLabs.length > 0 ||
    publishedQuizzes.length > 0 ||
    publishedAssignments.length > 0 ||
    publishedForums.length > 0;

  // Helper to determine lecture content type
  const getLectureContentType = (lecture: Lecture): ContentType => {
    if (lecture.contentType === 'video') return 'video';
    if (lecture.contentType === 'mixed') return 'mixed';
    return 'lecture';
  };

  // Build unified content items list
  const contentItems: ContentItem[] = [
    ...publishedLectures.map(lecture => ({
      id: lecture.id,
      type: getLectureContentType(lecture),
      title: lecture.title,
      metadata: lecture.duration ? t('x_min', { count: lecture.duration }) : undefined,
      href: `/courses/${courseId}/lectures/${lecture.id}`,
    })),
    ...publishedLabs.map(lab => ({
      id: lab.id,
      type: 'lab' as ContentType,
      title: lab.title,
      subtitle: lab.description || undefined,
      href: `/courses/${courseId}/code-labs/${lab.id}`,
    })),
    ...publishedQuizzes.map(quiz => ({
      id: quiz.id,
      type: 'quiz' as ContentType,
      title: quiz.title,
      subtitle: quiz.description || undefined,
      metadata: quiz._count?.questions ? t('x_questions', { count: quiz._count.questions }) : undefined,
      href: `/courses/${courseId}/quizzes/${quiz.id}`,
    })),
    ...publishedAssignments.map(assignment => ({
      id: assignment.id,
      type: (assignment.submissionType === 'ai_agent' ? 'ai_agent' : 'assignment') as ContentType,
      title: assignment.title,
      metadata: assignment.dueDate
        ? t('due_date_short', { date: new Date(assignment.dueDate).toLocaleDateString() })
        : t('x_pts', { count: assignment.points }),
      href: assignment.submissionType === 'ai_agent'
        ? `/courses/${courseId}/agent-assignments/${assignment.id}`
        : `/courses/${courseId}/assignments/${assignment.id}`,
    })),
    ...publishedForums.map(forum => ({
      id: forum.id,
      type: 'forum' as ContentType,
      title: forum.title,
      subtitle: forum.description || undefined,
      metadata: forum._count?.threads ? t('x_threads', { count: forum._count.threads }) : undefined,
      href: `/courses/${courseId}/forums/${forum.id}`,
    })),
  ];

  // Calculate content counts for module header
  const contentCount = contentItems.length;

  // Get card size based on view mode
  const getCardSize = (): ContentCardSize => {
    switch (viewMode) {
      case 'mini-cards': return 'mini';
      case 'icons': return 'icon';
      default: return 'normal';
    }
  };

  // Get grid classes based on view mode
  const getGridClasses = (): string => {
    switch (viewMode) {
      case 'mini-cards':
        return 'flex flex-wrap gap-2';
      case 'icons':
        return 'grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3';
      case 'list':
        return 'flex flex-col gap-1';
      default:
        return 'grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3';
    }
  };

  // Render list item
  const renderListItem = (item: ContentItem) => {
    const Icon = iconMap[item.type];
    const colorConfig = colorMap[item.type];

    const content = (
      <div
        className={`flex items-center gap-3 px-4 py-2.5 rounded-lg transition-colors ${
          hasAccess ? 'hover:bg-opacity-50 cursor-pointer' : 'opacity-50 cursor-not-allowed'
        }`}
        style={{ backgroundColor: hasAccess && isDark ? colors.bgHover : 'transparent' }}
      >
        <div
          className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${!isDark ? colorConfig.bg : ''}`}
          style={{ backgroundColor: isDark ? colorConfig.bgDark : undefined }}
        >
          <Icon
            className="w-4 h-4"
            style={{ color: isDark ? colorConfig.textDark : colorConfig.text }}
          />
        </div>
        <span
          className="flex-1 text-sm font-medium truncate"
          style={{ color: colors.textPrimary }}
        >
          {item.title}
        </span>
        {item.metadata && (
          <span
            className="text-xs flex-shrink-0"
            style={{ color: colors.textSecondary }}
          >
            {item.metadata}
          </span>
        )}
      </div>
    );

    if (hasAccess) {
      return (
        <Link key={`${item.type}-${item.id}`} to={item.href}>
          {content}
        </Link>
      );
    }
    return <div key={`${item.type}-${item.id}`}>{content}</div>;
  };

  // Render accordion item
  const renderAccordionItem = (item: ContentItem) => {
    const Icon = iconMap[item.type];
    const colorConfig = colorMap[item.type];

    const content = (
      <div
        className={`flex items-center gap-3 px-3 py-2 transition-colors ${
          hasAccess ? 'hover:bg-opacity-50 cursor-pointer' : 'opacity-50 cursor-not-allowed'
        }`}
        style={{ backgroundColor: hasAccess && isDark ? colors.bgHover : 'transparent' }}
      >
        <Icon
          className="w-4 h-4 flex-shrink-0"
          style={{ color: isDark ? colorConfig.textDark : colorConfig.text }}
        />
        <span
          className="text-sm truncate"
          style={{ color: colors.textPrimary }}
        >
          {item.title}
        </span>
      </div>
    );

    if (hasAccess) {
      return (
        <Link key={`${item.type}-${item.id}`} to={item.href}>
          {content}
        </Link>
      );
    }
    return <div key={`${item.type}-${item.id}`}>{content}</div>;
  };

  // Accordion view mode
  if (viewMode === 'accordion') {
    return (
      <section id={`module-${module.id}`}>
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors"
          style={{
            backgroundColor: colors.bgCard,
            border: `1px solid ${colors.border}`,
          }}
        >
          {isExpanded ? (
            <ChevronDown className="w-5 h-5" style={{ color: colors.textSecondary }} />
          ) : (
            <ChevronRight className="w-5 h-5" style={{ color: colors.textSecondary }} />
          )}
          <div
            className="w-7 h-7 rounded-full flex items-center justify-center text-sm font-semibold flex-shrink-0"
            style={{ backgroundColor: colors.bgPrimary, color: colors.textPrimary600 }}
          >
            {moduleIndex + 1}
          </div>
          <span
            className="font-semibold text-left flex-1"
            style={{ color: colors.textPrimary }}
          >
            {module.title}
          </span>
          <span
            className="text-sm"
            style={{ color: colors.textSecondary }}
          >
            {t('x_items', { count: contentCount })}
          </span>
        </button>

        {isExpanded && hasContent && (
          <div
            className="ml-8 mt-1 border-l-2 pl-4 py-2"
            style={{ borderColor: colors.border }}
          >
            {contentItems.map(renderAccordionItem)}
          </div>
        )}

        {isExpanded && !hasContent && (
          <div
            className="ml-8 mt-1 border-l-2 pl-4 py-4"
            style={{ borderColor: colors.border }}
          >
            <p
              className="text-sm"
              style={{ color: colors.textSecondary }}
            >
              {t('no_content_in_module')}
            </p>
          </div>
        )}
      </section>
    );
  }

  // Card-based views (mini-cards, icons, normal)
  return (
    <section
      id={`module-${module.id}`}
      className="rounded-2xl border overflow-hidden"
      style={{ backgroundColor: colors.bgCard, borderColor: colors.border }}
    >
      {/* Module Header */}
      <div
        className="p-4 sm:p-6 border-b"
        style={{ borderColor: colors.border }}
      >
        <div className="flex items-center gap-3 sm:gap-4">
          <div
            className="w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center font-semibold text-base sm:text-lg flex-shrink-0"
            style={{ backgroundColor: colors.bgPrimary, color: colors.textPrimary600 }}
          >
            {moduleIndex + 1}
          </div>
          <div className="flex-1 min-w-0">
            <h2
              className="text-lg sm:text-xl font-semibold truncate"
              style={{ color: colors.textPrimary }}
            >
              {module.title}
            </h2>
            {module.description && viewMode !== 'mini-cards' && (
              <p
                className="text-sm mt-1 line-clamp-2"
                style={{ color: colors.textSecondary }}
              >
                {module.description}
              </p>
            )}
            <p
              className="text-xs sm:text-sm mt-1"
              style={{ color: colors.textSecondary }}
            >
              {t('x_items', { count: contentCount })}
            </p>
          </div>
        </div>
      </div>

      {/* Content Grid/List */}
      <div className="p-4 sm:p-6">
        {hasContent ? (
          viewMode === 'list' ? (
            <div className={getGridClasses()}>
              {contentItems.map(renderListItem)}
            </div>
          ) : (
            <div className={getGridClasses()}>
              {contentItems.map((item) => (
                <ContentCard
                  key={`${item.type}-${item.id}`}
                  type={item.type}
                  title={item.title}
                  subtitle={item.subtitle}
                  metadata={viewMode === 'mini-cards' ? undefined : item.metadata}
                  href={hasAccess ? item.href : undefined}
                  disabled={!hasAccess}
                  size={getCardSize()}
                />
              ))}
            </div>
          )
        ) : (
          <p
            className="text-center py-8"
            style={{ color: colors.textSecondary }}
          >
            {t('no_content_in_module')}
          </p>
        )}
      </div>
    </section>
  );
};

export default ModuleSection;
