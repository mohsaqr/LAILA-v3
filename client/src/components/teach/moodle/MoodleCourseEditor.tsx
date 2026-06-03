import { useMemo, useRef, useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  ChevronDown, ChevronRight, Pencil, MoreVertical, Trash2, Eye, EyeOff, Plus,
  Check, X, FileText, FlaskConical, ClipboardList, MessageSquare, FileQuestion, ClipboardCheck,
  Beaker, Network,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { coursesApi } from '../../../api/courses';
import { assignmentsApi } from '../../../api/assignments';
import { quizzesApi } from '../../../api/quizzes';
import { forumsApi } from '../../../api/forums';
import { codeLabsApi } from '../../../api/codeLabs';
import { customLabsApi } from '../../../api/customLabs';
import { surveysApi } from '../../../api/surveys';
import { Loading } from '../../common/Loading';
import { ConfirmDialog } from '../../common/ConfirmDialog';

type ItemType = 'lecture' | 'codelab' | 'assignment' | 'quiz' | 'forum' | 'survey' | 'lab' | 'interactive';

interface EditorItem {
  type: ItemType;
  /** Primary id (moduleSurvey id for surveys; lab-assignment id for labs;
   *  synthetic index for interactive labs). */
  id: number;
  /** Underlying survey id (surveys only). */
  surveyId?: number;
  /** Underlying custom-lab template id (assigned labs only). */
  labId?: number;
  /** Interactive lab key, e.g. 'tna' / 'sna' (interactive labs only). */
  interactiveKey?: string;
  title: string;
  isPublished: boolean;
  orderIndex: number;
  /** View link for the title. */
  viewHref: string;
  /** Reference items (assigned lab / interactive lab) can't be renamed/edited
   *  inline — only removed from the module. */
  reference?: boolean;
}

const ITEM_META: Record<ItemType, { Icon: typeof FileText; color: string }> = {
  lecture: { Icon: FileText, color: '#475569' },
  codelab: { Icon: FlaskConical, color: '#059669' },
  assignment: { Icon: ClipboardList, color: '#d97706' },
  forum: { Icon: MessageSquare, color: '#0d9488' },
  quiz: { Icon: FileQuestion, color: '#0891b2' },
  survey: { Icon: ClipboardCheck, color: '#4f46e5' },
  lab: { Icon: Beaker, color: '#0d9488' },
  interactive: { Icon: Network, color: '#7c3aed' },
};

interface MoodleCourseEditorProps {
  courseId: number;
}

export const MoodleCourseEditor = ({ courseId }: MoodleCourseEditorProps) => {
  const { t } = useTranslation(['teaching', 'common', 'courses']);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: details, isLoading } = useQuery({
    queryKey: ['courseDetails', courseId],
    queryFn: () => coursesApi.getCourseDetails(courseId),
    enabled: !!courseId,
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['courseDetails', courseId] });
  const refresh = () => {
    invalidate();
    queryClient.invalidateQueries({ queryKey: ['course', courseId] });
  };

  // ─── Mutations (rename / delete / toggle publish per type) ───────────────
  const mut = {
    moduleUpdate: useMutation({ mutationFn: ({ id, data }: { id: number; data: Record<string, unknown> }) => coursesApi.updateModule(id, data), onSuccess: refresh }),
    moduleDelete: useMutation({ mutationFn: (id: number) => coursesApi.deleteModule(id), onSuccess: refresh }),
    moduleCreate: useMutation({ mutationFn: (data: Record<string, unknown>) => coursesApi.createModule(courseId, data), onSuccess: refresh }),

    lectureUpdate: useMutation({ mutationFn: ({ id, data }: { id: number; data: Record<string, unknown> }) => coursesApi.updateLecture(id, data), onSuccess: refresh }),
    lectureDelete: useMutation({ mutationFn: (id: number) => coursesApi.deleteLecture(id), onSuccess: refresh }),

    codelabUpdate: useMutation({ mutationFn: ({ id, data }: { id: number; data: Record<string, unknown> }) => codeLabsApi.updateCodeLab(id, data), onSuccess: refresh }),
    codelabDelete: useMutation({ mutationFn: (id: number) => codeLabsApi.deleteCodeLab(id), onSuccess: refresh }),

    assignmentUpdate: useMutation({ mutationFn: ({ id, data }: { id: number; data: Record<string, unknown> }) => assignmentsApi.updateAssignment(id, data), onSuccess: refresh }),
    assignmentDelete: useMutation({ mutationFn: (id: number) => assignmentsApi.deleteAssignment(id), onSuccess: refresh }),

    quizUpdate: useMutation({ mutationFn: ({ id, data }: { id: number; data: Record<string, unknown> }) => quizzesApi.updateQuiz(id, data), onSuccess: refresh }),
    quizDelete: useMutation({ mutationFn: (id: number) => quizzesApi.deleteQuiz(id), onSuccess: refresh }),

    forumUpdate: useMutation({ mutationFn: ({ id, data }: { id: number; data: Record<string, unknown> }) => forumsApi.updateForum(id, data), onSuccess: refresh }),
    forumDelete: useMutation({ mutationFn: (id: number) => forumsApi.deleteForum(id), onSuccess: refresh }),

    surveyUpdate: useMutation({ mutationFn: ({ id, data }: { id: number; data: Record<string, unknown> }) => surveysApi.updateSurvey(id, data), onSuccess: refresh }),
    surveyRemove: useMutation({ mutationFn: ({ moduleId, surveyId }: { moduleId: number; surveyId: number }) => surveysApi.removeSurveyFromModule(moduleId, surveyId), onSuccess: refresh }),

    labUnassign: useMutation({ mutationFn: (labId: number) => customLabsApi.unassignFromCourse(labId, courseId), onSuccess: refresh }),
    interactiveRemove: useMutation({
      mutationFn: ({ moduleId, key }: { moduleId: number; key: string }) => {
        const mod = details?.course?.modules?.find((m: { id: number }) => m.id === moduleId) as { interactiveLabs?: string } | undefined;
        const remaining = (mod?.interactiveLabs ? mod.interactiveLabs.split(',').map(s => s.trim()).filter(Boolean) : [])
          .filter(k => k !== key);
        return coursesApi.updateModule(moduleId, { interactiveLabs: remaining.length ? remaining.join(',') : null } as never);
      },
      onSuccess: refresh,
    }),
  };

  const onError = () => toast.error(t('common:error', { defaultValue: 'Something went wrong' }));

  // Rename an item's title.
  const renameItem = (item: EditorItem, title: string) => {
    const data = { title };
    const opts = { onSuccess: refresh, onError };
    switch (item.type) {
      case 'lecture': mut.lectureUpdate.mutate({ id: item.id, data }, opts); break;
      case 'codelab': mut.codelabUpdate.mutate({ id: item.id, data }, opts); break;
      case 'assignment': mut.assignmentUpdate.mutate({ id: item.id, data }, opts); break;
      case 'quiz': mut.quizUpdate.mutate({ id: item.id, data }, opts); break;
      case 'forum': mut.forumUpdate.mutate({ id: item.id, data }, opts); break;
      case 'survey': if (item.surveyId) mut.surveyUpdate.mutate({ id: item.surveyId, data }, opts); break;
    }
  };

  const toggleItem = (item: EditorItem) => {
    const data = { isPublished: !item.isPublished };
    const opts = { onError };
    switch (item.type) {
      case 'lecture': mut.lectureUpdate.mutate({ id: item.id, data }, opts); break;
      case 'codelab': mut.codelabUpdate.mutate({ id: item.id, data }, opts); break;
      case 'assignment': mut.assignmentUpdate.mutate({ id: item.id, data }, opts); break;
      case 'quiz': mut.quizUpdate.mutate({ id: item.id, data }, opts); break;
      case 'forum': mut.forumUpdate.mutate({ id: item.id, data }, opts); break;
      case 'survey': if (item.surveyId) mut.surveyUpdate.mutate({ id: item.surveyId, data }, opts); break;
    }
  };

  const deleteItem = (item: EditorItem, moduleId: number) => {
    const opts = { onError };
    switch (item.type) {
      case 'lecture': mut.lectureDelete.mutate(item.id, opts); break;
      case 'codelab': mut.codelabDelete.mutate(item.id, opts); break;
      case 'assignment': mut.assignmentDelete.mutate(item.id, opts); break;
      case 'quiz': mut.quizDelete.mutate(item.id, opts); break;
      case 'forum': mut.forumDelete.mutate(item.id, opts); break;
      case 'survey': if (item.surveyId) mut.surveyRemove.mutate({ moduleId, surveyId: item.surveyId }, opts); break;
      case 'lab': if (item.labId) mut.labUnassign.mutate(item.labId, opts); break;
      case 'interactive': if (item.interactiveKey) mut.interactiveRemove.mutate({ moduleId, key: item.interactiveKey }, opts); break;
    }
  };

  // Open the dedicated editor page for an item.
  const editItem = (item: EditorItem) => {
    switch (item.type) {
      case 'lecture': navigate(`/teach/courses/${courseId}/lectures/${item.id}`); break;
      case 'codelab': navigate(`/teach/courses/${courseId}/code-labs/${item.id}`); break;
      case 'quiz': navigate(`/teach/courses/${courseId}/quizzes/${item.id}`); break;
      case 'assignment': navigate(`/teach/courses/${courseId}/assignments/${item.id}/edit`); break;
      case 'forum': navigate(`/teach/courses/${courseId}/forums/${item.id}/edit`); break;
      case 'survey': navigate(`/teach/surveys?courseId=${courseId}`); break;
    }
  };

  // Navigate to a dedicated "new" page per type — nothing is written to the
  // database until the user fills the form and clicks Save/Create there.
  const addItem = (moduleId: number, type: ItemType) => {
    const base = `/teach/courses/${courseId}/modules/${moduleId}`;
    switch (type) {
      case 'lecture': navigate(`${base}/lessons/new`); break;
      case 'codelab': navigate(`${base}/code-labs/new`); break;
      case 'quiz': navigate(`${base}/quizzes/new`); break;
      case 'assignment': navigate(`${base}/assignments/new`); break;
      case 'forum': navigate(`${base}/forums/new`); break;
      case 'survey': navigate(`/teach/surveys?courseId=${courseId}`); break;
    }
  };

  // ─── Build modules with their (sorted) items ─────────────────────────────
  const modules = useMemo(() => {
    const course = details?.course;
    if (!course?.modules) return [];
    const assignments = details?.assignments ?? [];
    const forums = details?.forums ?? [];
    const labs = (details as { labs?: any[] } | undefined)?.labs ?? [];
    // Pin assigned labs + interactive labs to the end, mirroring the student
    // view's ordering.
    const LAB_ORDER = Number.MAX_SAFE_INTEGER - 2;
    const INTERACTIVE_ORDER = Number.MAX_SAFE_INTEGER - 1;
    const interactiveLabel = (key: string) =>
      key === 'tna' ? t('interactive_lab_tna', { defaultValue: 'Interactive TNA Exercise' })
      : key === 'sna' ? t('interactive_lab_sna', { defaultValue: 'Interactive SNA Exercise' })
      : key;
    return [...course.modules]
      .sort((a, b) => (a.orderIndex ?? 0) - (b.orderIndex ?? 0))
      .map(m => {
        const interactiveKeys = (m as { interactiveLabs?: string }).interactiveLabs
          ? (m as { interactiveLabs?: string }).interactiveLabs!.split(',').map(s => s.trim()).filter(Boolean)
          : [];
        const items: EditorItem[] = [
          ...(m.lectures ?? []).map((l: any) => ({ type: 'lecture' as const, id: l.id, title: l.title, isPublished: !!l.isPublished, orderIndex: l.orderIndex ?? 0, viewHref: `/courses/${courseId}/lectures/${l.id}` })),
          ...((m as any).codeLabs ?? []).map((c: any) => ({ type: 'codelab' as const, id: c.id, title: c.title, isPublished: !!c.isPublished, orderIndex: c.orderIndex ?? 0, viewHref: `/teach/courses/${courseId}/code-labs/${c.id}` })),
          ...((m as any).quizzes ?? []).map((q: any) => ({ type: 'quiz' as const, id: q.id, title: q.title, isPublished: !!q.isPublished, orderIndex: q.orderIndex ?? 0, viewHref: `/teach/courses/${courseId}/quizzes/${q.id}` })),
          ...assignments.filter((a: any) => a.moduleId === m.id).map((a: any) => ({ type: 'assignment' as const, id: a.id, title: a.title, isPublished: !!a.isPublished, orderIndex: a.orderIndex ?? 0, viewHref: `/teach/courses/${courseId}/assignments/${a.id}/edit` })),
          ...forums.filter((f: any) => f.moduleId === m.id).map((f: any) => ({ type: 'forum' as const, id: f.id, title: f.title, isPublished: !!f.isPublished, orderIndex: f.orderIndex ?? 0, viewHref: `/courses/${courseId}/forums/${f.id}` })),
          ...((m as any).moduleSurveys ?? []).map((ms: any) => ({ type: 'survey' as const, id: ms.id, surveyId: ms.survey?.id, title: ms.survey?.title ?? 'Survey', isPublished: !!ms.survey?.isPublished, orderIndex: ms.orderIndex ?? 0, viewHref: `/teach/surveys?courseId=${courseId}` })),
          // Assigned lab templates (Python SNA Lab, etc.) — reference items.
          ...labs.filter((la: any) => la.moduleId === m.id).map((la: any) => ({ type: 'lab' as const, id: la.id, labId: la.labId ?? la.lab?.id, title: la.lab?.name ?? la.title ?? 'Lab', isPublished: true, orderIndex: LAB_ORDER, viewHref: `/courses/${courseId}`, reference: true })),
          // Interactive labs (TNA / SNA) stored on the module — reference items.
          ...interactiveKeys.map((key, idx) => ({ type: 'interactive' as const, id: idx, interactiveKey: key, title: interactiveLabel(key), isPublished: true, orderIndex: INTERACTIVE_ORDER + idx, viewHref: `/courses/${courseId}`, reference: true })),
        ].sort((a, b) => (a.orderIndex - b.orderIndex) || (a.id - b.id));
        return { id: m.id, title: m.title, isPublished: (m as any).isPublished ?? true, items };
      });
  }, [details, courseId, t]);

  const [deleteTarget, setDeleteTarget] = useState<
    | { kind: 'module'; id: number; title: string }
    | { kind: 'item'; item: EditorItem; moduleId: number; title: string }
    | null
  >(null);

  if (isLoading) return <Loading text={t('common:loading', { defaultValue: 'Loading…' })} />;

  return (
    <div className="space-y-4">
      {modules.map(m => (
        <ModuleCard
          key={m.id}
          module={m}
          onRenameModule={(title) => mut.moduleUpdate.mutate({ id: m.id, data: { title } }, { onError })}
          onToggleModule={() => mut.moduleUpdate.mutate({ id: m.id, data: { isPublished: !m.isPublished } }, { onError })}
          onDeleteModule={() => setDeleteTarget({ kind: 'module', id: m.id, title: m.title })}
          onRenameItem={renameItem}
          onToggleItem={toggleItem}
          onEditItem={editItem}
          onDeleteItem={(item) => setDeleteTarget({ kind: 'item', item, moduleId: m.id, title: item.title })}
          onAddItem={(type) => addItem(m.id, type)}
        />
      ))}

      <button
        type="button"
        onClick={() => mut.moduleCreate.mutate({ title: t('new_section', { defaultValue: 'New section' }) }, { onError })}
        className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-dashed border-gray-300 dark:border-gray-600 text-sm font-medium text-gray-500 dark:text-gray-400 hover:border-teal-400 hover:text-teal-600 transition-colors"
      >
        <Plus className="w-4 h-4" />
        {t('add_section', { defaultValue: 'Add section' })}
      </button>

      <ConfirmDialog
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (!deleteTarget) return;
          if (deleteTarget.kind === 'module') mut.moduleDelete.mutate(deleteTarget.id, { onError });
          else deleteItem(deleteTarget.item, deleteTarget.moduleId);
          setDeleteTarget(null);
        }}
        title={t('common:delete', { defaultValue: 'Delete' })}
        message={t('delete_confirm_named', { defaultValue: 'Delete "{{title}}"? This cannot be undone.', title: deleteTarget?.title ?? '' })}
        confirmText={t('common:delete', { defaultValue: 'Delete' })}
        requireSecondConfirm
      />
    </div>
  );
};

// ─── Module card ────────────────────────────────────────────────────────────

interface ModuleCardProps {
  module: { id: number; title: string; isPublished: boolean; items: EditorItem[] };
  onRenameModule: (title: string) => void;
  onToggleModule: () => void;
  onDeleteModule: () => void;
  onRenameItem: (item: EditorItem, title: string) => void;
  onToggleItem: (item: EditorItem) => void;
  onEditItem: (item: EditorItem) => void;
  onDeleteItem: (item: EditorItem) => void;
  onAddItem: (type: ItemType) => void;
}

const ADD_TYPES: { type: ItemType; labelKey: string; fallback: string }[] = [
  { type: 'lecture', labelKey: 'add_lesson', fallback: 'Add Lesson' },
  { type: 'codelab', labelKey: 'add_code_lab', fallback: 'Add Code Lab' },
  { type: 'assignment', labelKey: 'add_assignment', fallback: 'Add Assignment' },
  { type: 'forum', labelKey: 'add_forum', fallback: 'Add Forum' },
  { type: 'quiz', labelKey: 'add_quiz', fallback: 'Add Quiz' },
  { type: 'survey', labelKey: 'add_survey', fallback: 'Add Survey' },
];

const ModuleCard = ({
  module, onRenameModule, onToggleModule, onDeleteModule,
  onRenameItem, onToggleItem, onEditItem, onDeleteItem, onAddItem,
}: ModuleCardProps) => {
  const { t } = useTranslation(['teaching', 'common']);
  const [open, setOpen] = useState(true);
  const [addOpen, setAddOpen] = useState(false);

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3">
        <button type="button" onClick={() => setOpen(o => !o)} className="p-1 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700" aria-label={open ? t('collapse', { defaultValue: 'Collapse' }) : t('expand', { defaultValue: 'Expand' })}>
          {open ? <ChevronDown className="w-5 h-5 text-gray-500" /> : <ChevronRight className="w-5 h-5 text-gray-500" />}
        </button>
        <InlineTitle
          title={module.title}
          onSave={onRenameModule}
          className="text-base font-bold text-gray-900 dark:text-white"
        />
        {!module.isPublished && <HiddenBadge />}
        <div className="ml-auto">
          <ItemMenu
            isPublished={module.isPublished}
            onEdit={undefined}
            onToggle={onToggleModule}
            onDelete={onDeleteModule}
          />
        </div>
      </div>

      {open && (
        <div className="px-4 pb-4">
          <div className="border-t border-dashed border-gray-200 dark:border-gray-700 pt-2 space-y-1">
            {module.items.map(item => (
              <ItemRow
                key={`${item.type}-${item.id}`}
                item={item}
                onRename={(title) => onRenameItem(item, title)}
                onToggle={() => onToggleItem(item)}
                onEdit={() => onEditItem(item)}
                onDelete={() => onDeleteItem(item)}
              />
            ))}
          </div>

          {/* Bottom + add bar */}
          <div className="relative mt-3 flex items-center">
            <div className="flex-1 border-t border-dashed border-gray-200 dark:border-gray-700" />
            <button
              type="button"
              onClick={() => setAddOpen(o => !o)}
              className="mx-2 inline-flex items-center justify-center w-8 h-8 rounded-lg bg-teal-50 dark:bg-teal-900/30 text-teal-600 dark:text-teal-300 hover:bg-teal-100 transition-colors"
              aria-label={t('add', { defaultValue: 'Add' })}
            >
              <Plus className="w-4 h-4" />
            </button>
            <div className="flex-1 border-t border-dashed border-gray-200 dark:border-gray-700" />
          </div>

          {addOpen && (
            <div className="mt-2 flex flex-wrap items-center justify-center gap-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/40 p-3">
              {ADD_TYPES.map(({ type, labelKey, fallback }) => {
                const { Icon, color } = ITEM_META[type];
                return (
                  <button
                    key={type}
                    type="button"
                    onClick={() => { setAddOpen(false); onAddItem(type); }}
                    className="inline-flex flex-col items-center gap-1 px-3 py-2 rounded-lg hover:bg-white dark:hover:bg-gray-800 transition-colors min-w-[72px]"
                  >
                    <Icon className="w-5 h-5" style={{ color }} />
                    <span className="text-xs font-medium text-gray-700 dark:text-gray-200">{t(labelKey, { defaultValue: fallback })}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// ─── Item row ─────────────────────────────────────────────────────────────

const ItemRow = ({
  item, onRename, onToggle, onEdit, onDelete,
}: {
  item: EditorItem;
  onRename: (title: string) => void;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) => {
  const { Icon, color } = ITEM_META[item.type];
  return (
    <div className="group/item flex items-center gap-2.5 px-2 py-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/40">
      <Icon className="w-4 h-4 shrink-0" style={{ color }} />
      {item.reference ? (
        // Assigned lab / interactive lab — reference to a shared resource, so
        // the title isn't renamed inline and there's no edit/hide, only remove.
        <Link to={item.viewHref} className="text-sm font-medium text-teal-700 dark:text-teal-300 truncate hover:underline">
          {item.title}
        </Link>
      ) : (
        <InlineTitle
          title={item.title}
          onSave={onRename}
          href={item.viewHref}
          className="text-sm font-medium text-teal-700 dark:text-teal-300"
        />
      )}
      {!item.isPublished && <HiddenBadge />}
      <div className="ml-auto">
        <ItemMenu
          isPublished={item.isPublished}
          onEdit={item.reference ? undefined : onEdit}
          onToggle={item.reference ? undefined : onToggle}
          onDelete={onDelete}
        />
      </div>
    </div>
  );
};

/** Small opaque "Hidden" pill — keeps the row visually identical to visible
 *  items (no translucency) while still flagging hidden-from-students status. */
const HiddenBadge = () => {
  const { t } = useTranslation(['teaching']);
  return (
    <span className="inline-flex items-center gap-1 shrink-0 text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-300">
      <EyeOff className="w-3 h-3" />
      {t('hidden', { defaultValue: 'Hidden' })}
    </span>
  );
};

// ─── Inline editable title (pencil → input) ─────────────────────────────────

const InlineTitle = ({
  title, onSave, href, className = '', dimmed = false,
}: {
  title: string;
  onSave: (title: string) => void;
  href?: string;
  className?: string;
  dimmed?: boolean;
}) => {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(title);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { if (editing) { setDraft(title); setTimeout(() => inputRef.current?.select(), 0); } }, [editing, title]);

  const commit = () => {
    const v = draft.trim();
    setEditing(false);
    if (v && v !== title) onSave(v);
  };

  if (editing) {
    return (
      <span className="inline-flex items-center gap-1 flex-1 min-w-0">
        <input
          ref={inputRef}
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') setEditing(false); }}
          className="flex-1 min-w-0 px-2 py-1 text-sm rounded border border-teal-400 focus:outline-none focus:ring-2 focus:ring-teal-300 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
        />
        <button type="button" onClick={commit} className="p-1 rounded text-teal-600 hover:bg-teal-50 dark:hover:bg-teal-900/30" aria-label="Save"><Check className="w-4 h-4" /></button>
        <button type="button" onClick={() => setEditing(false)} className="p-1 rounded text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700" aria-label="Cancel"><X className="w-4 h-4" /></button>
      </span>
    );
  }

  return (
    <span className={`inline-flex items-center gap-1.5 min-w-0 ${dimmed ? 'opacity-60' : ''}`}>
      {href ? (
        <Link to={href} className={`truncate hover:underline ${className}`}>{title}</Link>
      ) : (
        <span className={`truncate ${className}`}>{title}</span>
      )}
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="p-0.5 rounded text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 shrink-0"
        aria-label="Edit title"
        title="Edit title"
      >
        <Pencil className="w-3.5 h-3.5" />
      </button>
    </span>
  );
};

// ─── 3-dots menu (edit / hide / delete) ─────────────────────────────────────

const ItemMenu = ({
  isPublished, onEdit, onToggle, onDelete,
}: {
  isPublished: boolean;
  onEdit?: () => void;
  onToggle?: () => void;
  onDelete: () => void;
}) => {
  const { t } = useTranslation(['common', 'teaching']);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  const Row = ({ icon, label, onClick, danger }: { icon: React.ReactNode; label: string; onClick: () => void; danger?: boolean }) => (
    <button
      type="button"
      onClick={() => { setOpen(false); onClick(); }}
      className={`w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-gray-50 dark:hover:bg-gray-700/50 ${danger ? 'text-red-600' : 'text-gray-700 dark:text-gray-200'}`}
    >
      {icon}{label}
    </button>
  );

  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={() => setOpen(o => !o)} className="p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500" aria-label={t('common:more', { defaultValue: 'More' })}>
        <MoreVertical className="w-4 h-4" />
      </button>
      {open && (
        <div className="absolute right-0 mt-1 w-44 z-30 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-lg py-1">
          {onEdit && <Row icon={<Pencil className="w-4 h-4" />} label={t('common:edit', { defaultValue: 'Edit' })} onClick={onEdit} />}
          {onToggle && (
            <Row
              icon={isPublished ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              label={isPublished ? t('teaching:hide', { defaultValue: 'Hide' }) : t('teaching:show', { defaultValue: 'Show' })}
              onClick={onToggle}
            />
          )}
          <Row icon={<Trash2 className="w-4 h-4" />} label={t('common:delete', { defaultValue: 'Delete' })} onClick={onDelete} danger />
        </div>
      )}
    </div>
  );
};
