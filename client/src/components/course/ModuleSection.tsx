import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ChevronDown, ChevronRight, FileText, PlayCircle, Layers, FlaskConical, FileQuestion, ClipboardList, MessageSquare, Bot, Network, ListChecks, Folder, Link as LinkIcon, MonitorPlay, FileUp, Image as ImageIcon, EyeOff } from 'lucide-react';
import { useTheme } from '../../hooks/useTheme';
import { ContentCard, ContentType, ContentCardSize } from './ContentCard';
import { toPlainText } from '../../utils/sanitize';
import type { CourseModule, Lecture, CodeLab, Assignment, Survey, ModuleSurvey, ModuleQuiz, CurriculumViewMode } from '../../types';
import type { Forum } from '../../api/forums';
import type { Quiz } from '../../api/quizzes';

interface LabAssignmentItem {
  id: number;
  lab: { id: number; name: string; labType: string; description: string | null };
  orderIndex?: number;
  isPublished?: boolean;
}

interface ModuleSectionProps {
  module: CourseModule;
  moduleIndex: number;
  courseId: number;
  lectures?: Lecture[];
  codeLabs?: CodeLab[];
  quizzes?: (Quiz | ModuleQuiz)[];
  assignments?: Assignment[];
  forums?: Forum[];
  surveys?: (Survey | ModuleSurvey)[];
  labAssignments?: LabAssignmentItem[];
  hasAccess: boolean;
  viewMode?: CurriculumViewMode;
  /** Course staff (admin/instructor/team) preview: show unpublished items with
   *  a "Hidden" tag instead of filtering them out. Students never get this. */
  showHidden?: boolean;
  /** This whole module is unpublished (staff preview) — tag the header too. */
  moduleHidden?: boolean;
  /** Subsections of this module (modules whose parentId is this one). They
   *  render folded at the bottom of this section, via this same component in
   *  `nested` mode — one renderer, two sets of chrome. */
  subsections?: CourseModule[];
  /** Render as a subsection: a folded, tinted strip instead of a full card.
   *  Only ModuleSection sets this, on its own children. */
  nested?: boolean;
}

// Content item interface for unified handling
interface ContentItem {
  id: number;
  type: ContentType;
  title: string;
  subtitle?: string;
  metadata?: string;
  href: string;
  isFree?: boolean;
  /** Sort key. Items with the same orderIndex tie-break by id. */
  orderIndex: number;
  /** Unpublished item, surfaced only to course staff with a "Hidden" tag. */
  hidden?: boolean;
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
  interactive_lab: Network,
  survey: ListChecks,
  folder: Folder,
  url: LinkIcon,
  embed: MonitorPlay,
  file: FileUp,
  image: ImageIcon,
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
  interactive_lab: { bg: 'bg-violet-50', bgDark: 'rgba(139, 92, 246, 0.15)', text: '#7c3aed', textDark: '#c4b5fd' },
  survey: { bg: 'bg-rose-50', bgDark: 'rgba(244, 63, 94, 0.15)', text: '#e11d48', textDark: '#fb7185' },
  folder: { bg: 'bg-amber-50', bgDark: 'rgba(245, 158, 11, 0.15)', text: '#d97706', textDark: '#fcd34d' },
  url: { bg: 'bg-sky-50', bgDark: 'rgba(2, 132, 199, 0.15)', text: '#0284c7', textDark: '#7dd3fc' },
  embed: { bg: 'bg-violet-50', bgDark: 'rgba(139, 92, 246, 0.15)', text: '#7c3aed', textDark: '#c4b5fd' },
  file: { bg: 'bg-teal-50', bgDark: 'rgba(13, 148, 136, 0.15)', text: '#0d9488', textDark: '#5eead4' },
  image: { bg: 'bg-cyan-50', bgDark: 'rgba(8, 145, 178, 0.15)', text: '#0891b2', textDark: '#67e8f9' },
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
  surveys = [],
  labAssignments = [],
  hasAccess,
  viewMode = 'mini-cards',
  showHidden = false,
  moduleHidden = false,
  subsections = [],
  nested = false,
}: ModuleSectionProps) => {
  const { t } = useTranslation(['courses']);
  const { isDark } = useTheme();
  // A subsection starts folded — tucking supplementary material out of the way
  // is the entire point of it. The accordion view keeps its open default.
  const [isExpanded, setIsExpanded] = useState(!nested);

  const colors = {
    bg: isDark ? '#111827' : '#f9fafb',
    bgCard: isDark ? '#1f2937' : '#ffffff',
    // Subsections sit on a deliberately darker fill than the card they are in,
    // in both themes, so nesting reads without an indent.
    bgNested: isDark ? '#111827' : '#f3f4f6',
    textPrimary: isDark ? '#f3f4f6' : '#111827',
    textSecondary: isDark ? '#9ca3af' : '#6b7280',
    border: isDark ? '#374151' : '#e5e7eb',
    bgPrimary: isDark ? 'rgba(99, 102, 241, 0.2)' : '#e0e7ff',
    textPrimary600: isDark ? '#a5b4fc' : '#4f46e5',
    bgHover: isDark ? '#374151' : '#f9fafb',
  };

  // Only published items are visible to students. Course staff previewing the
  // page (showHidden) also see unpublished items, tagged "Hidden" below.
  const keepPublished = <T,>(arr: T[], isPub: (x: T) => boolean) =>
    showHidden ? arr : arr.filter(isPub);
  const publishedLectures = keepPublished(lectures, l => !!l.isPublished);
  const publishedLabs = keepPublished(codeLabs, l => !!l.isPublished);
  const publishedQuizzes = keepPublished(quizzes, q => !!q.isPublished);
  const publishedAssignments = keepPublished(assignments, a => !!a.isPublished);
  const publishedForums = keepPublished(forums, f => !!f.isPublished);
  // Survey items may arrive as a bare Survey or as a ModuleSurvey junction
  // ({ survey: {...} }); the publish flag lives on the inner survey for the
  // latter (mirrors the id/title/href resolution below).
  const surveyIsPublished = (s: any) => s.survey?.isPublished ?? s.isPublished;
  const publishedSurveys = keepPublished(surveys, surveyIsPublished);
  // Assigned labs are gated like every other type. The server already omits
  // hidden ones for students, but this path also renders the staff preview
  // (showHidden), and a client-side filter means visibility does not depend on
  // exactly one query being right. Rows predating the isPublished column
  // report undefined, which counts as visible.
  const visibleLabAssignments = keepPublished(labAssignments, la => la.isPublished !== false);
  // The server already drops subsections of a hidden parent, but gate them here
  // too so visibility never rests on exactly one query being right.
  const visibleSubsections = keepPublished(subsections, s => s.isPublished !== false);

  // Check if module has any content.
  // Assigned labs were missing from this list, so a section holding only labs
  // reported itself empty and rendered "no content" instead of its labs.
  // Subsections count for the same reason: a section whose only content is a
  // "Datasets & references" drawer is not empty.
  const hasItems =
    publishedLectures.length > 0 ||
    publishedLabs.length > 0 ||
    publishedQuizzes.length > 0 ||
    publishedAssignments.length > 0 ||
    publishedForums.length > 0 ||
    publishedSurveys.length > 0 ||
    visibleLabAssignments.length > 0;
  const hasContent = hasItems || visibleSubsections.length > 0;

  // Resource kinds derived server-side (getCourseById) for media-as-section
  // lectures, so each shows its own icon instead of the generic lesson one.
  const RESOURCE_KINDS: ContentType[] = ['folder', 'url', 'embed', 'video', 'file', 'image'];

  // Helper to determine lecture content type
  const getLectureContentType = (lecture: Lecture): ContentType => {
    const kind = (lecture as { resourceKind?: string }).resourceKind;
    if (kind && RESOURCE_KINDS.includes(kind as ContentType)) return kind as ContentType;
    if (lecture.contentType === 'video') return 'video';
    if (lecture.contentType === 'mixed') return 'mixed';
    return 'lecture';
  };

  // Build unified content items list. Each entry carries the
  // type-specific `orderIndex` so the final list can be sorted into a
  // single sequence — matches the instructor's reordering in the
  // curriculum editor (lecture, codelab, assignment, forum, quiz,
  // survey all share one global order via the reorder-items endpoint).
  const contentItems: ContentItem[] = [
    ...publishedLectures.map(lecture => ({
      id: lecture.id,
      type: getLectureContentType(lecture),
      title: lecture.title,
      subtitle: (lecture as { description?: string }).description || undefined,
      metadata: lecture.duration ? t('x_min', { count: lecture.duration }) : undefined,
      href: `/courses/${courseId}/lectures/${lecture.id}`,
      isFree: lecture.isFree,
      orderIndex: lecture.orderIndex ?? 0,
      hidden: !lecture.isPublished,
    })),
    ...publishedLabs.map(lab => ({
      id: lab.id,
      type: 'lab' as ContentType,
      title: lab.title,
      subtitle: lab.description || undefined,
      href: `/courses/${courseId}/code-labs/${lab.id}`,
      orderIndex: lab.orderIndex ?? 0,
      hidden: !lab.isPublished,
    })),
    ...visibleLabAssignments.map(la => ({
      id: la.id,
      type: 'lab' as ContentType,
      title: la.lab.name,
      subtitle: la.lab.description || undefined,
      href: `/labs/${la.lab.id}?courseId=${courseId}`,
      // Assigned labs now carry a real orderIndex, so they take the position
      // the instructor gave them. Existing rows default to 0; falling back to
      // the old end-pin sentinel would instead freeze them last forever.
      orderIndex: la.orderIndex ?? 0,
      hidden: la.isPublished === false,
    })),
    ...publishedQuizzes.map(quiz => ({
      id: quiz.id,
      type: 'quiz' as ContentType,
      title: quiz.title,
      subtitle: quiz.description || undefined,
      metadata: quiz._count?.questions ? t('x_questions', { count: quiz._count.questions }) : undefined,
      href: `/courses/${courseId}/quizzes/${quiz.id}`,
      orderIndex: quiz.orderIndex ?? 0,
      hidden: !quiz.isPublished,
    })),
    ...publishedAssignments.map(assignment => ({
      id: assignment.id,
      type: (assignment.submissionType === 'ai_agent' ? 'ai_agent' : 'assignment') as ContentType,
      title: assignment.title,
      subtitle: (assignment as { description?: string }).description || undefined,
      metadata: assignment.dueDate
        ? t('due_date_short', { date: new Date(assignment.dueDate).toLocaleDateString(undefined, { timeZone: 'UTC' }) })
        : t('x_pts', { count: assignment.points }),
      href: assignment.submissionType === 'ai_agent'
        ? `/courses/${courseId}/agent-assignments/${assignment.id}`
        : `/courses/${courseId}/assignments/${assignment.id}`,
      orderIndex: assignment.orderIndex ?? 0,
      hidden: !assignment.isPublished,
    })),
    ...publishedForums.map(forum => ({
      id: forum.id,
      type: 'forum' as ContentType,
      title: forum.title,
      subtitle: forum.description || undefined,
      metadata: forum._count?.posts
        ? t('x_replies', { count: forum._count.posts, defaultValue: '{{count}} replies' })
        : undefined,
      href: `/courses/${courseId}/forums/${forum.id}`,
      orderIndex: forum.orderIndex ?? 0,
      hidden: !forum.isPublished,
    })),
    ...publishedSurveys.map((s: any) => ({
      id: s.survey?.id ?? s.id,
      type: 'survey' as ContentType,
      title: s.survey?.title ?? s.title,
      subtitle: (s.survey?.description ?? s.description) || undefined,
      metadata: (s.survey?._count?.questions ?? s._count?.questions)
        ? t('x_questions', { count: s.survey?._count?.questions ?? s._count?.questions })
        : undefined,
      href: `/surveys/${s.survey?.id ?? s.id}?moduleId=${module.id}&courseId=${courseId}`,
      orderIndex: s.orderIndex ?? 0,
      hidden: !surveyIsPublished(s),
    })),
    ...(module.interactiveLabs
      ? module.interactiveLabs.split(',').map((key: string) => key.trim()).filter(Boolean)
          // Hide interactive lab if it's already linked as an assignment
          .filter((key: string) => {
            const req = key === 'tna' ? 'interactive_lab_tna' : key === 'sna' ? 'interactive_lab_sna' : null;
            return !req || !publishedAssignments.some(a => a.agentRequirements === req);
          })
          .map((key: string, idx: number) => ({
            id: -(idx + 1),
            type: 'interactive_lab' as ContentType,
            title: key === 'tna' ? t('exercise.title') : key === 'sna' ? t('sna.title') : key,
            href: `/courses/${courseId}/${key}-exercise`,
            // Interactive labs have no orderIndex; pin after the
            // unified sequence.
            orderIndex: Number.MAX_SAFE_INTEGER - 1 + idx,
          }))
      : []),
  ].sort((a, b) => (a.orderIndex - b.orderIndex) || (a.id - b.id));

  // Get card size based on view mode
  const getCardSize = (): ContentCardSize => {
    switch (viewMode) {
      case 'mini-cards': return 'mini';
      case 'icons': return 'icon';
      default: return 'normal';
    }
  };

  // Get grid classes based on view mode.
  //
  // `auto-rows-fr` is load-bearing, not decoration. Cards hold between one and
  // six rows of content (title 1-2 lines, optional subtitle, optional "Hidden"
  // badge), so left alone every card is a different height. In an auto-height
  // grid, `1fr` implicit rows all resolve to the tallest row's content, which
  // is the only way to make rows match EACH OTHER — `flex flex-wrap`, which
  // mini-cards used to use, sizes every wrapped row independently.
  const getGridClasses = (): string => {
    switch (viewMode) {
      case 'mini-cards':
        return 'grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 auto-rows-fr';
      case 'icons':
        return 'grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3 auto-rows-fr';
      case 'list':
        return 'flex flex-col gap-1';
      default:
        return 'grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 auto-rows-fr';
    }
  };

  // Amber "Hidden" pill for unpublished items (course-staff preview only).
  const hiddenBadge = (
    <span
      className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded flex-shrink-0"
      style={{
        backgroundColor: isDark ? 'rgba(245, 158, 11, 0.15)' : '#fef3c7',
        color: isDark ? '#fcd34d' : '#b45309',
      }}
    >
      <EyeOff className="w-3 h-3" />
      {t('hidden', { defaultValue: 'Hidden' })}
    </span>
  );

  // Render list item
  const renderListItem = (item: ContentItem) => {
    const Icon = iconMap[item.type];
    const colorConfig = colorMap[item.type];
    const canAccess = hasAccess || item.isFree;

    const content = (
      <div
        className={`flex items-center gap-3 px-4 py-2.5 rounded-lg transition-colors ${
          canAccess ? 'cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/60' : 'opacity-50 cursor-not-allowed'
        }`}
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
          className="flex-1 min-w-0 text-sm font-medium truncate"
          style={{ color: colors.textPrimary }}
          title={item.title}
        >
          {item.title}
        </span>
        {item.hidden && hiddenBadge}
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

    if (canAccess) {
      return (
        <Link
          key={`${item.type}-${item.id}`}
          to={item.href}
          className="block rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-800"
        >
          {content}
        </Link>
      );
    }
    return <div key={`${item.type}-${item.id}`} aria-disabled="true">{content}</div>;
  };

  // Render accordion item
  const renderAccordionItem = (item: ContentItem) => {
    const Icon = iconMap[item.type];
    const colorConfig = colorMap[item.type];
    const canAccess = hasAccess || item.isFree;

    const content = (
      <div
        className={`flex items-center gap-3 px-3 py-2 rounded-md transition-colors ${
          canAccess ? 'cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/60' : 'opacity-50 cursor-not-allowed'
        }`}
      >
        <Icon
          className="w-4 h-4 flex-shrink-0"
          style={{ color: isDark ? colorConfig.textDark : colorConfig.text }}
        />
        <span
          className="text-sm truncate min-w-0"
          style={{ color: colors.textPrimary }}
          title={item.title}
        >
          {item.title}
        </span>
        {item.hidden && hiddenBadge}
      </div>
    );

    if (canAccess) {
      return (
        <Link
          key={`${item.type}-${item.id}`}
          to={item.href}
          className="block rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-800"
        >
          {content}
        </Link>
      );
    }
    return <div key={`${item.type}-${item.id}`} aria-disabled="true">{content}</div>;
  };

  // The items of this section, laid out per the course's view mode. Shared by
  // the card view and the expanded body of a subsection so a "Datasets" drawer
  // looks like the section it sits in.
  const itemsBody = viewMode === 'list' ? (
    <div className={getGridClasses()}>{contentItems.map(renderListItem)}</div>
  ) : (
    <div className={getGridClasses()}>
      {contentItems.map((item) => {
        const canAccess = hasAccess || item.isFree;
        return (
          <ContentCard
            key={`${item.type}-${item.id}`}
            type={item.type}
            title={item.title}
            // Descriptions are authored in Tiptap and stored as HTML. The card
            // shows its subtitle in a clamped <span>, so the raw string leaked
            // markup onto the page: "<p><strong>You have two files...".
            subtitle={toPlainText(item.subtitle) || undefined}
            metadata={viewMode === 'mini-cards' ? undefined : item.metadata}
            href={canAccess ? item.href : undefined}
            disabled={!canAccess}
            size={getCardSize()}
            hidden={item.hidden}
          />
        );
      })}
    </div>
  );

  // Subsections render at the bottom of this section's body, folded. Recursion
  // through this same component keeps one content pipeline; only the chrome
  // differs. Nesting is one level, so a nested render never has its own.
  const subsectionBlocks = visibleSubsections.length > 0 && (
    <div className={hasItems ? 'mt-4 space-y-2' : 'space-y-2'}>
      {visibleSubsections.map(sub => (
        <ModuleSection
          key={sub.id}
          nested
          module={sub}
          moduleIndex={0}
          courseId={courseId}
          lectures={sub.lectures}
          codeLabs={sub.codeLabs}
          quizzes={sub.quizzes}
          assignments={sub.assignments}
          forums={sub.forumThreads as never}
          surveys={sub.moduleSurveys as never}
          labAssignments={(sub as { labAssignments?: LabAssignmentItem[] }).labAssignments}
          hasAccess={hasAccess}
          viewMode={viewMode}
          showHidden={showHidden}
          moduleHidden={showHidden && sub.isPublished === false}
        />
      ))}
    </div>
  );

  // Subsection: a folded, tinted strip. Rendered by the parent ModuleSection,
  // never directly by a page.
  if (nested) {
    return (
      <section
        id={`module-${module.id}`}
        className="rounded-xl border overflow-hidden"
        style={{ backgroundColor: colors.bgNested, borderColor: colors.border }}
      >
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          aria-expanded={isExpanded}
          className="w-full flex items-center gap-2.5 px-4 py-2.5 text-left transition-colors hover:bg-gray-200/60 dark:hover:bg-gray-700/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-inset"
        >
          {isExpanded ? (
            <ChevronDown className="w-4 h-4 flex-shrink-0" style={{ color: colors.textSecondary }} />
          ) : (
            <ChevronRight className="w-4 h-4 flex-shrink-0" style={{ color: colors.textSecondary }} />
          )}
          <Folder className="w-4 h-4 flex-shrink-0" style={{ color: colors.textSecondary }} />
          <span
            className="text-sm font-semibold truncate min-w-0"
            style={{ color: colors.textPrimary }}
            title={module.title}
          >
            {module.title}
          </span>
          {moduleHidden && hiddenBadge}
          {contentItems.length > 0 && (
            <span className="ml-auto text-xs flex-shrink-0" style={{ color: colors.textSecondary }}>
              {contentItems.length}
            </span>
          )}
        </button>

        {isExpanded && (
          <div className="px-4 pb-3">
            {module.description && (
              <p className="text-sm mb-2" style={{ color: colors.textSecondary }}>
                {module.description}
              </p>
            )}
            {hasItems ? itemsBody : (
              <p className="text-sm py-2" style={{ color: colors.textSecondary }}>
                {t('no_content_in_module')}
              </p>
            )}
          </div>
        )}
      </section>
    );
  }

  // Accordion view mode
  if (viewMode === 'accordion') {
    return (
      <section id={`module-${module.id}`}>
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          aria-expanded={isExpanded}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors hover:bg-gray-50 dark:hover:bg-gray-700/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-900"
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
          {/* Accordion has its own header markup, so the description needs
              rendering here too — fixing only the card/list header left this
              view still dropping it. */}
          <span className="text-left flex-1 min-w-0">
            <span
              className="font-semibold block"
              style={{ color: colors.textPrimary }}
            >
              {module.title}
            </span>
            {module.description && (
              <span
                className="block text-sm line-clamp-2"
                style={{ color: colors.textSecondary }}
              >
                {module.description}
              </span>
            )}
          </span>
          {moduleHidden && hiddenBadge}
        </button>

        {isExpanded && hasContent && (
          <div
            className="ml-8 mt-1 border-l-2 pl-4 py-2"
            style={{ borderColor: colors.border }}
          >
            {contentItems.map(renderAccordionItem)}
            {subsectionBlocks}
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
            <div className="flex items-center gap-2 min-w-0">
              <h2
                className="text-lg sm:text-xl font-semibold truncate"
                style={{ color: colors.textPrimary }}
              >
                {module.title}
              </h2>
              {moduleHidden && hiddenBadge}
            </div>
            {/* Shown in every view mode. This was gated on
                `viewMode !== 'mini-cards'`, and 'mini-cards' is the default for
                every course — so a section description typed in the editor was
                invisible to students (and to teachers outside edit mode) unless
                someone had changed the course's curriculum view. */}
            {module.description && (
              <p
                className="text-sm mt-1 line-clamp-2"
                style={{ color: colors.textSecondary }}
              >
                {module.description}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Content Grid/List, then any subsections folded at the bottom. */}
      <div className="p-4 sm:p-6">
        {hasContent ? (
          <>
            {hasItems && itemsBody}
            {subsectionBlocks}
          </>
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
