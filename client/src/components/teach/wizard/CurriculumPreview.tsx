import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Activity,
  Beaker,
  BookOpen,
  ChevronDown,
  ChevronRight,
  ClipboardCheck,
  ClipboardList,
  FileQuestion,
  FileText,
  MessageSquare,
  Network,
} from 'lucide-react';
import { LessonViewer } from '../lesson-editor';
import type {
  Assignment,
  CodeLab,
  CourseModule,
  Forum,
  LabAssignment,
  Lecture,
  ModuleQuiz,
  ModuleSurvey,
} from '../../../types';

interface CurriculumPreviewProps {
  modules: CourseModule[];
}

type FlatItem =
  | { type: 'lecture'; id: number; orderIndex: number; data: Lecture }
  | { type: 'codelab'; id: number; orderIndex: number; data: CodeLab }
  | { type: 'assignment'; id: number; orderIndex: number; data: Assignment }
  | { type: 'forum'; id: number; orderIndex: number; data: Forum }
  | { type: 'quiz'; id: number; orderIndex: number; data: ModuleQuiz }
  | { type: 'survey'; id: number; orderIndex: number; data: ModuleSurvey }
  | { type: 'labtemplate'; id: number; orderIndex: number; data: LabAssignment }
  | { type: 'interactivelab'; id: number; orderIndex: number; data: string };

const buildFlatItems = (m: CourseModule): FlatItem[] => {
  const lectures = m.lectures || [];
  const codeLabs = m.codeLabs || [];
  const assignments = m.assignments || [];
  const forums = m.forumThreads || [];
  const quizzes = m.quizzes || [];
  const moduleSurveys = m.moduleSurveys || [];
  const labAssignments = (m as any).labAssignments || [];
  const interactiveLabs = (m as any).interactiveLabs
    ? (m as any).interactiveLabs.split(',').map((s: string) => s.trim()).filter(Boolean)
    : [];

  const items: FlatItem[] = [
    ...lectures.map(l => ({ type: 'lecture' as const, id: l.id, orderIndex: l.orderIndex ?? 0, data: l })),
    ...codeLabs.map(c => ({ type: 'codelab' as const, id: c.id, orderIndex: c.orderIndex ?? 0, data: c })),
    ...assignments.map(a => ({ type: 'assignment' as const, id: a.id, orderIndex: (a as any).orderIndex ?? 0, data: a })),
    ...forums.map(f => ({ type: 'forum' as const, id: f.id, orderIndex: f.orderIndex ?? 0, data: f })),
    ...quizzes.map(q => ({ type: 'quiz' as const, id: q.id, orderIndex: (q as any).orderIndex ?? 0, data: q })),
    ...moduleSurveys.map((ms: any) => ({ type: 'survey' as const, id: ms.id, orderIndex: ms.orderIndex ?? 0, data: ms })),
  ];
  const aux: FlatItem[] = [
    ...labAssignments.map((la: LabAssignment) => ({ type: 'labtemplate' as const, id: la.id, orderIndex: Number.MAX_SAFE_INTEGER, data: la })),
    ...interactiveLabs.map((key: string, idx: number) => ({ type: 'interactivelab' as const, id: -(idx + 1), orderIndex: Number.MAX_SAFE_INTEGER + idx, data: key })),
  ];
  return [...items.sort((a, b) => (a.orderIndex - b.orderIndex) || (a.id - b.id)), ...aux];
};

/**
 * Read-only mirror of the Content step's curriculum body. Same module
 * cards, same unified-order flat item list, same color tints. The only
 * interactive element is the lesson chevron toggle, which expands to
 * show the lesson's text content inline. No edit / delete / reorder /
 * add buttons — instructors review here, they don't author.
 */
export const CurriculumPreview = ({ modules }: CurriculumPreviewProps) => {
  const { t } = useTranslation(['teaching']);

  if (modules.length === 0) {
    return (
      <p className="text-sm text-gray-500 dark:text-gray-400">
        {t('wizard_no_modules', { defaultValue: 'No modules yet.' })}
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {modules.map((m, mIndex) => (
        <ModulePreviewCard key={m.id} module={m} moduleIndex={mIndex} />
      ))}
    </div>
  );
};

const ModulePreviewCard = ({ module, moduleIndex }: { module: CourseModule; moduleIndex: number }) => {
  const { t } = useTranslation(['teaching']);
  const [isExpanded, setIsExpanded] = useState(true);
  const flatItems = buildFlatItems(module);

  return (
    <div className="rounded-2xl bg-white dark:bg-gray-800 shadow-sm border border-teal-100 dark:border-teal-900/40 overflow-hidden">
      <div className="relative flex items-center gap-3 px-4 py-3 bg-gradient-to-r from-teal-50 to-cyan-50 dark:from-teal-900/20 dark:to-cyan-900/20 border-b border-teal-100 dark:border-teal-900/40">
        <svg
          className="absolute -top-2 -right-2 w-20 h-20 opacity-25 pointer-events-none"
          viewBox="0 0 60 60"
          aria-hidden="true"
        >
          {[0, 1, 2, 3].flatMap(r =>
            [0, 1, 2, 3].map(col => (
              <circle key={`mp-${r}-${col}`} cx={6 + col * 16} cy={6 + r * 16} r={1.4} fill="#088F8F" />
            ))
          )}
        </svg>

        <button
          type="button"
          onClick={() => setIsExpanded(!isExpanded)}
          className="relative w-10 h-10 rounded-xl flex items-center justify-center font-bold text-lg transition-all hover:scale-105 flex-shrink-0"
          style={{ backgroundColor: 'rgba(8, 143, 143, 0.18)', color: '#066d6d' }}
          title={isExpanded ? t('collapse', { defaultValue: 'Collapse' }) : t('expand', { defaultValue: 'Expand' })}
          aria-expanded={isExpanded}
        >
          {(module.orderIndex ?? moduleIndex) + 1}
        </button>

        <div className="relative flex-1 min-w-0">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-teal-700 dark:text-teal-300 mb-0.5">
            {t('module', { defaultValue: 'Module' })}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-base font-bold text-gray-900 dark:text-white truncate">
              {module.title}
            </h3>
            {!module.isPublished && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-700 dark:bg-amber-800/50 dark:text-amber-200">
                {t('draft')}
              </span>
            )}
          </div>
        </div>
      </div>

      {isExpanded && (
        <div className="p-3 sm:p-4 space-y-2">
          {module.description && (
            <p className="text-sm text-gray-600 dark:text-gray-300 mb-2">
              {module.description}
            </p>
          )}
          {flatItems.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-4">
              {t('no_lessons_yet', { defaultValue: 'No content yet.' })}
            </p>
          ) : (
            flatItems.map(item => <ItemPreviewRow key={`${item.type}-${item.id}`} item={item} />)
          )}
        </div>
      )}
    </div>
  );
};

const ItemPreviewRow = ({ item }: { item: FlatItem }) => {
  const { t } = useTranslation(['teaching']);
  const [isOpen, setIsOpen] = useState(false);

  if (item.type === 'lecture') {
    const lecture = item.data;
    const textSection = lecture.sections?.find(s => s.type === 'text');
    const html = textSection?.content ?? '';
    return (
      <div>
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className={`w-full flex items-center gap-3 p-3 min-h-[64px] bg-gray-50 dark:bg-gray-700/40 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors ${
            isOpen ? 'rounded-t-lg' : 'rounded-lg'
          }`}
          aria-expanded={isOpen}
        >
          <span className="inline-flex items-center justify-center w-7 h-7 rounded text-gray-500 dark:text-gray-400 flex-shrink-0">
            {isOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          </span>
          <span className="flex-1 min-w-0 text-sm font-medium text-gray-900 dark:text-white truncate text-left">
            {lecture.title}
          </span>
          {!lecture.isPublished && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 flex-shrink-0">
              {t('draft')}
            </span>
          )}
        </button>
        {isOpen && (
          <div className="px-4 py-3 bg-gray-50/60 dark:bg-gray-700/20 rounded-b-lg border-t border-gray-100 dark:border-gray-700">
            {html.trim() ? (
              <LessonViewer html={html} />
            ) : (
              <p className="text-sm text-gray-400 italic">
                {t('no_content_yet', { defaultValue: 'This lesson has no content yet.' })}
              </p>
            )}
          </div>
        )}
      </div>
    );
  }

  if (item.type === 'codelab') {
    const c = item.data;
    const blockCount = (c.blocks as any)?.length || 0;
    return (
      <PreviewRow
        tone="emerald"
        Icon={BookOpen}
        title={c.title}
        meta={[t('code_lab', { defaultValue: 'Code Lab' }), t('x_blocks', { count: blockCount })]}
        draft={!c.isPublished}
      />
    );
  }

  if (item.type === 'assignment') {
    const a = item.data;
    const isAi = a.submissionType === 'ai_agent';
    const dueDate = a.dueDate ? new Date(a.dueDate) : null;
    const dueLabel = dueDate
      ? dueDate.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
      : null;
    return (
      <PreviewRow
        tone={isAi ? 'purple' : 'amber'}
        Icon={isAi ? Activity : ClipboardList}
        title={a.title}
        meta={[
          isAi ? t('ai_agent', { defaultValue: 'AI agent' }) : t('assignment', { defaultValue: 'Assignment' }),
          t('x_pts', { count: a.points, defaultValue: '{{count}} pts' }),
          ...(dueLabel ? [dueLabel] : []),
        ]}
        draft={!a.isPublished}
      />
    );
  }

  if (item.type === 'forum') {
    const f = item.data;
    const replyCount = (f._count as any)?.posts || 0;
    return (
      <PreviewRow
        tone="teal"
        Icon={MessageSquare}
        title={f.title}
        meta={[t('forum', { defaultValue: 'Forum' }), t('x_replies', { count: replyCount, defaultValue: '{{count}} replies' })]}
        draft={!f.isPublished}
      />
    );
  }

  if (item.type === 'quiz') {
    const q = item.data;
    return (
      <PreviewRow
        tone="cyan"
        Icon={FileQuestion}
        title={q.title}
        meta={[
          t('quiz_singular', { defaultValue: 'Quiz' }),
          t('x_questions', { count: q._count?.questions || 0, defaultValue: '{{count}} questions' }),
        ]}
        draft={!q.isPublished}
      />
    );
  }

  if (item.type === 'survey') {
    const ms: any = item.data;
    return (
      <PreviewRow
        tone="indigo"
        Icon={ClipboardCheck}
        title={ms.survey?.title ?? ''}
        meta={[
          t('survey_singular', { defaultValue: 'Survey' }),
          t('x_questions', { count: ms.survey?._count?.questions || 0, defaultValue: '{{count}} questions' }),
        ]}
      />
    );
  }

  if (item.type === 'labtemplate') {
    const la = item.data as any;
    return (
      <PreviewRow
        tone="teal"
        Icon={Beaker}
        title={la.lab?.name || t('lab_template', { defaultValue: 'Lab template' })}
        meta={[la.lab?.labType ?? t('lab_template', { defaultValue: 'Lab template' })]}
      />
    );
  }

  if (item.type === 'interactivelab') {
    const key = item.data as string;
    const label = key === 'tna' ? t('interactive_lab_tna') : key === 'sna' ? t('interactive_lab_sna') : key;
    return (
      <PreviewRow
        tone="violet"
        Icon={Network}
        title={label}
        meta={[t('interactive', { defaultValue: 'Interactive' })]}
      />
    );
  }

  return null;
};

type Tone = 'amber' | 'emerald' | 'teal' | 'cyan' | 'indigo' | 'violet' | 'purple';

const TONE_CLASSES: Record<Tone, { bg: string; iconBorder: string; iconText: string; metaText: string }> = {
  amber:   { bg: 'bg-amber-50 dark:bg-amber-900/20',   iconBorder: 'border-amber-200',   iconText: 'text-amber-600',   metaText: 'text-amber-600' },
  emerald: { bg: 'bg-emerald-50 dark:bg-emerald-900/20', iconBorder: 'border-emerald-200', iconText: 'text-emerald-600', metaText: 'text-emerald-600' },
  teal:    { bg: 'bg-teal-50 dark:bg-teal-900/20',     iconBorder: 'border-teal-200',    iconText: 'text-teal-600',    metaText: 'text-teal-600' },
  cyan:    { bg: 'bg-cyan-50 dark:bg-cyan-900/20',     iconBorder: 'border-cyan-200',    iconText: 'text-cyan-600',    metaText: 'text-cyan-600' },
  indigo:  { bg: 'bg-indigo-50 dark:bg-indigo-900/20', iconBorder: 'border-indigo-200',  iconText: 'text-indigo-600',  metaText: 'text-indigo-600' },
  violet:  { bg: 'bg-violet-50 dark:bg-violet-900/20', iconBorder: 'border-violet-200',  iconText: 'text-violet-600',  metaText: 'text-violet-600' },
  purple:  { bg: 'bg-purple-50 dark:bg-purple-900/20', iconBorder: 'border-purple-200',  iconText: 'text-purple-600',  metaText: 'text-purple-600' },
};

const PreviewRow = ({
  tone,
  Icon,
  title,
  meta,
  draft,
}: {
  tone: Tone;
  Icon: React.ElementType;
  title: string;
  meta: string[];
  draft?: boolean;
}) => {
  const { t } = useTranslation(['teaching']);
  const c = TONE_CLASSES[tone];
  return (
    <div className={`flex items-center gap-3 p-3 min-h-[64px] rounded-lg ${c.bg}`}>
      <div className={`flex items-center justify-center w-8 h-8 rounded bg-white border ${c.iconBorder} flex-shrink-0`}>
        <Icon className={`w-4 h-4 ${c.iconText}`} />
      </div>
      <div className="flex-1 min-w-0">
        <h4 className="text-sm font-medium text-gray-900 dark:text-white truncate">{title}</h4>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-gray-500">
          {meta.map((m, i) => (
            <span key={i} className={i === 0 ? `${c.metaText} font-medium` : undefined}>
              {i > 0 && <span className="text-gray-400 mr-2">•</span>}
              {m}
            </span>
          ))}
          {draft && (
            <>
              <span className="text-gray-400">•</span>
              <FileText className="w-3 h-3 hidden" />
              <span className="text-amber-600">{t('draft')}</span>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
