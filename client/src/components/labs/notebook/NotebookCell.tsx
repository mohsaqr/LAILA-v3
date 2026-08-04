import { useState, useEffect, useRef, memo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Play,
  Loader2,
  GripVertical,
  Lock,
  Unlock,
  Copy,
  Trash2,
  Pencil,
  Check,
  Sparkles,
  X,
  RotateCcw,
} from 'lucide-react';
import { RowMenu, RowMenuItem } from '../../common/RowMenu';
import { useCopyToClipboard } from '../../../hooks/useCopyToClipboard';
import { CodeEditorField, CodeLanguage } from '../authoring/CodeEditorField';
import { MarkdownField } from '../authoring/MarkdownField';
import { CodeOutput } from '../../code/CodeOutput';
import { renderMarkdown } from '../../../utils/renderMarkdown';
import { sanitizeHtml } from '../../../utils/sanitize';
import { LabCell, LabCellPatch } from '../authoring/cell';
import type { OutputItem } from '../LabOutput';
import type { AIIntent } from './LabAIPanel';

export interface CellRunState {
  outputs: OutputItem[];
  error: string | null;
  running: boolean;
  execCount: number | null;
}

/**
 * The AI actions offered per cell. Explain reads the code, Interpret reads the
 * result, Debug reads the failure; Ask leaves the question to the student.
 */
const AI_ACTIONS: {
  intent: AIIntent;
  labelKey: string;
  fallback: string;
  hintKey: string;
  hintFallback: string;
}[] = [
  {
    intent: 'explain', labelKey: 'courses:ai_explain', fallback: 'Explain',
    hintKey: 'courses:ai_explain_hint', hintFallback: 'Explain what this code does',
  },
  {
    intent: 'interpret', labelKey: 'courses:ai_interpret', fallback: 'Interpret',
    hintKey: 'courses:ai_interpret_hint', hintFallback: 'Interpret the result — run the cell first',
  },
  {
    intent: 'debug', labelKey: 'courses:ai_debug', fallback: 'Debug',
    hintKey: 'courses:ai_debug_hint', hintFallback: 'Find and explain the problem — run the cell first',
  },
  {
    intent: 'ask', labelKey: 'courses:ai_ask', fallback: 'Ask',
    hintKey: 'courses:ai_ask_hint', hintFallback: 'Ask your own question about this cell',
  },
];

interface NotebookCellProps {
  cell: LabCell;
  index: number;
  total: number;
  language: CodeLanguage;
  canEdit: boolean;
  /** Local (unsaved-for-students) code for this cell; falls back to cell.code. */
  draft: string | undefined;
  onDraftChange: (cellId: number, code: string) => void;
  run: CellRunState | undefined;
  isRuntimeBusy: boolean;
  /** Why Run is disabled, shown right next to the button (e.g. "Starting R…"). */
  runDisabledReason?: string | null;
  onRun: (cell: LabCell, code: string) => void;
  onClearOutput: (cellId: number) => void;
  onSave?: (cellId: number, patch: LabCellPatch) => void;
  onDuplicate?: (cell: LabCell) => void;
  onDelete?: (cell: LabCell) => void;
  onAskAI?: (cell: LabCell, code: string, error: string | null, intent: AIIntent) => void;
  /** Students only: make a session-only scratch copy of this cell. */
  onScratchCopy?: (cell: LabCell) => void;
  /** Discard a scratch copy. Only supplied for scratch cells. */
  onDismissScratch?: (cellId: number) => void;
  /** Disables structural actions while another add/duplicate/reorder is in flight. */
  isMutating?: boolean;
  /** Native HTML5 drag wiring, provided by the notebook (authors only). */
  dragProps?: {
    draggable: boolean;
    onDragStart: (e: React.DragEvent) => void;
    onDragEnd: () => void;
  };
}

/**
 * The one lab cell, rendered identically for authors and students. Role only
 * changes which affordances exist: authors persist edits, toggle locks, and
 * manage cells; students edit code locally (unless locked) and run it.
 * Every control is permanently visible — nothing is hidden behind hover.
 */
const NotebookCellInner = ({
  cell,
  index: _index,
  total: _total,
  language,
  canEdit,
  draft,
  onDraftChange,
  run,
  isRuntimeBusy,
  runDisabledReason,
  onRun,
  onClearOutput,
  onSave,
  onDuplicate,
  onDelete,
  onAskAI,
  onScratchCopy,
  onDismissScratch,
  isMutating = false,
  dragProps,
}: NotebookCellProps) => {
  const { t } = useTranslation(['courses', 'teaching', 'common']);
  const { copied, copy } = useCopyToClipboard();
  const [editingProse, setEditingProse] = useState(false);
  const [title, setTitle] = useState(cell.title);
  const [prose, setProse] = useState(cell.prose);

  useEffect(() => {
    setTitle(cell.title);
    setProse(cell.prose);
    setEditingProse(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cell.id]);

  const code = draft ?? cell.code;
  const metaDirty = canEdit && (title !== cell.title || prose !== cell.prose);
  const codeDirty = canEdit && code !== cell.code;

  // Unmount flush covers navigation away with unsaved edits — including CODE,
  // since Monaco's blur is not guaranteed to fire when the widget unmounts.
  const flushRef = useRef<() => void>(() => {});
  flushRef.current = () => {
    if (metaDirty || codeDirty) onSave?.(cell.id, { title, prose, code });
  };
  useEffect(() => () => flushRef.current(), []);

  const saveMeta = () => {
    if (metaDirty) onSave?.(cell.id, { title, prose });
  };
  const saveCode = () => {
    if (codeDirty) onSave?.(cell.id, { code });
  };
  const saveAll = () => {
    if (metaDirty || codeDirty) onSave?.(cell.id, { title, prose, code });
  };

  const isMarkdownCell = cell.cellType === 'markdown';
  const codeReadOnly = cell.locked && !canEdit;
  const running = run?.running ?? false;
  const execBadge = running ? '*' : run?.execCount ?? ' ';

  const runCell = () => {
    if (!isRuntimeBusy && !running) onRun(cell, code);
  };

  const isScratch = !!cell.isScratch;

  // Secondary actions, assembled per role and cell type. Ordering is stable so
  // the menu does not reshuffle as a cell's state changes.
  const menuItems: RowMenuItem[] = [];
  if (canEdit && !isMarkdownCell) {
    menuItems.push({
      key: 'lock',
      label: cell.locked
        ? t('teaching:unlock_cell', { defaultValue: 'Unlock — students can edit' })
        : t('teaching:lock_cell', { defaultValue: 'Lock — students can run but not edit' }),
      icon: cell.locked ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />,
      onClick: () => onSave?.(cell.id, { locked: !cell.locked }),
    });
  }
  if (onDuplicate) {
    menuItems.push({
      key: 'duplicate',
      label: t('teaching:duplicate_cell', { defaultValue: 'Duplicate cell' }),
      icon: <Copy className="w-4 h-4" />,
      disabled: isMutating,
      onClick: () => onDuplicate(cell),
    });
  }
  // Students get a throwaway copy instead — nothing is written to the lab.
  if (onScratchCopy && !isMarkdownCell && !isScratch) {
    menuItems.push({
      key: 'scratch',
      label: t('courses:duplicate_scratch', { defaultValue: 'Duplicate as my scratch copy' }),
      icon: <Copy className="w-4 h-4" />,
      onClick: () => onScratchCopy(cell),
    });
  }
  if (!canEdit && !isMarkdownCell && !codeReadOnly) {
    menuItems.push({
      key: 'reset',
      label: t('courses:reset_to_starter', {
        defaultValue: "Reset to the instructor's original code",
      }),
      icon: <RotateCcw className="w-4 h-4" />,
      disabled: code === cell.code,
      onClick: () => onDraftChange(cell.id, cell.code),
    });
  }
  if (onDismissScratch && isScratch) {
    menuItems.push({
      key: 'dismiss',
      label: t('courses:dismiss_scratch', { defaultValue: 'Discard this copy' }),
      icon: <Trash2 className="w-4 h-4" />,
      destructive: true,
      onClick: () => onDismissScratch(cell.id),
    });
  }
  if (onDelete) {
    menuItems.push({
      key: 'delete',
      label: t('teaching:delete_block', { defaultValue: 'Delete cell' }),
      icon: <Trash2 className="w-4 h-4" />,
      disabled: isMutating,
      destructive: true,
      onClick: () => onDelete(cell),
    });
  }

  return (
    <div className="group/cell relative rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm transition-shadow focus-within:ring-2 focus-within:ring-emerald-500/40 focus-within:border-emerald-300">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-100 dark:border-gray-700/60 rounded-t-xl bg-gray-50/70 dark:bg-gray-900/40">
        {dragProps && (
          <span
            draggable={dragProps.draggable}
            onDragStart={dragProps.onDragStart}
            onDragEnd={dragProps.onDragEnd}
            className="cursor-grab active:cursor-grabbing p-1 -ml-1 rounded text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
            title={t('teaching:drag_to_reorder', { defaultValue: 'Drag to reorder' })}
          >
            <GripVertical className="w-4 h-4" />
          </span>
        )}

        {isMarkdownCell ? (
          <span className="shrink-0 min-w-[2.4rem] text-center text-xs px-1.5 py-0.5 rounded-md bg-sky-100 dark:bg-sky-900/40 text-sky-700 dark:text-sky-300 font-medium">
            {t('teaching:text_cell_badge', { defaultValue: 'Text' })}
          </span>
        ) : (
          <span
            className={`shrink-0 min-w-[2.4rem] text-center font-mono text-xs px-1.5 py-0.5 rounded-md ${
              running
                ? 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 animate-pulse'
                : run?.error
                  ? 'bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-300'
                  : run?.execCount
                    ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-400'
            }`}
            title={t('courses:execution_count', { defaultValue: 'Execution count' })}
          >
            [{execBadge}]
          </span>
        )}

        {canEdit ? (
          <input
            type="text"
            value={title}
            onChange={e => setTitle(e.target.value)}
            onBlur={saveMeta}
            className="flex-1 min-w-0 bg-transparent text-sm font-semibold text-gray-900 dark:text-gray-100 border-b border-dashed border-gray-300 dark:border-gray-600 focus:border-emerald-500 focus:outline-none"
            placeholder={t('teaching:block_title_placeholder', { defaultValue: 'Cell title' })}
            title={t('teaching:click_to_rename', { defaultValue: 'Click to rename' })}
          />
        ) : (
          <h3 className="flex-1 min-w-0 truncate text-sm font-semibold text-gray-900 dark:text-gray-100">
            {cell.title}
          </h3>
        )}

        {(metaDirty || codeDirty) && (
          <span className="shrink-0 px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 text-xs font-medium">
            {t('teaching:unsaved', { defaultValue: 'Unsaved' })}
          </span>
        )}

        {isScratch && (
          <span
            className="shrink-0 flex items-center gap-1 px-2 py-0.5 rounded-full bg-sky-100 dark:bg-sky-900/40 text-sky-700 dark:text-sky-300 text-xs font-medium"
            title={t('courses:scratch_cell_hint', {
              defaultValue: 'A copy just for you. It is not saved and disappears when you leave.',
            })}
          >
            {t('courses:scratch_cell_badge', { defaultValue: 'Your copy — not saved' })}
          </span>
        )}

        {cell.locked && !canEdit && (
          <span
            className="shrink-0 flex items-center gap-1 px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-300 text-xs"
            title={t('teaching:locked_cell_hint', {
              defaultValue: 'Locked — students can run this cell but not edit it',
            })}
          >
            <Lock className="w-3 h-3" />
            {t('teaching:locked', { defaultValue: 'Locked' })}
          </span>
        )}

        {/* Secondary actions. Permanently visible, never hover-revealed — see
            the component note above. Rendered only when it would hold
            something, so a student on a text cell gets no empty trigger. */}
        {menuItems.length > 0 && (
          <div className="shrink-0">
            <RowMenu
              items={menuItems}
              ariaLabel={t('courses:cell_actions', { defaultValue: 'Cell actions' })}
              // Clears the AI drawer (z-60), which a cell menu can overlap.
              zIndex={70}
            />
          </div>
        )}
      </div>

      {/* Prose */}
      {canEdit && editingProse ? (
        <div className="px-4 pt-3">
          <MarkdownField value={prose} onChange={setProse} rows={4} />
          <button
            onClick={() => {
              saveMeta();
              setEditingProse(false);
            }}
            className="mt-1 mb-2 flex items-center gap-1 px-2.5 py-1 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium"
          >
            <Check className="w-3.5 h-3.5" />
            {t('common:done', { defaultValue: 'Done' })}
          </button>
        </div>
      ) : (
        (prose.trim() || canEdit) && (
          <div className="px-4 pt-3">
            {canEdit && (
              <button
                onClick={() => setEditingProse(true)}
                className="mb-1 flex items-center gap-1 text-xs text-gray-400 hover:text-emerald-600"
              >
                <Pencil className="w-3 h-3" />
                {prose.trim()
                  ? t('teaching:edit_instructions', { defaultValue: 'Edit instructions' })
                  : t('teaching:add_instructions', { defaultValue: 'Add instructions…' })}
              </button>
            )}
            {prose.trim() && (
              <div
                className="prose prose-sm dark:prose-invert max-w-none text-gray-600 dark:text-gray-300"
                dangerouslySetInnerHTML={{ __html: sanitizeHtml(renderMarkdown(prose)) }}
              />
            )}
          </div>
        )
      )}

      {/* Code — code cells only; markdown cells are prose-only content */}
      {isMarkdownCell ? (
        <div className="pb-4" />
      ) : (
      <div className="p-4 space-y-3">
        <CodeEditorField
          value={code}
          onChange={value => onDraftChange(cell.id, value)}
          onBlur={canEdit ? saveCode : undefined}
          onSave={canEdit ? saveAll : undefined}
          onRun={runCell}
          language={language}
          height={`${Math.min(440, Math.max(120, (code.split('\n').length + 2) * 20))}px`}
          readOnly={codeReadOnly}
          ariaLabel={cell.title}
        />

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={runCell}
            disabled={isRuntimeBusy || running}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium shadow-sm transition-colors"
          >
            {running ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
            {t('common:run', { defaultValue: 'Run' })}
          </button>
          <kbd className="hidden sm:inline text-[10px] text-gray-400 border border-gray-200 dark:border-gray-600 rounded px-1.5 py-0.5">
            ⌘⏎
          </kbd>
          {/* Why Run is disabled, said WHERE the button is */}
          {runDisabledReason && !running && (
            <span className="flex items-center gap-1.5 text-xs text-amber-600">
              <Loader2 className="w-3 h-3 animate-spin" />
              {runDisabledReason}
            </span>
          )}
          {codeReadOnly && (
            <span className="text-xs text-gray-400 flex items-center gap-1">
              <Lock className="w-3 h-3" />
              {t('courses:locked_run_only', { defaultValue: 'Run only' })}
            </span>
          )}
          <span className="flex-1" />
          <button
            onClick={() => void copy(code)}
            title={t('courses:copy_code', { defaultValue: 'Copy code' })}
            aria-label={t('courses:copy_code', { defaultValue: 'Copy code' })}
            className="p-1.5 rounded-md text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-600 transition-colors"
          >
            {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
          </button>
          {onAskAI && (
            <div className="flex items-center gap-1 rounded-lg border border-violet-200 dark:border-violet-800 p-0.5">
              <Sparkles className="w-4 h-4 ml-1.5 mr-0.5 text-violet-500 dark:text-violet-300 shrink-0" />
              {AI_ACTIONS.map(({ intent, labelKey, fallback, hintKey, hintFallback }) => (
                <button
                  key={intent}
                  onClick={() => onAskAI(cell, code, run?.error ?? null, intent)}
                  // Interpret and Debug need something to look at; offering them
                  // before a run would send the AI an empty output block.
                  disabled={intent !== 'explain' && intent !== 'ask' && !run}
                  title={t(hintKey, { defaultValue: hintFallback })}
                  className="px-2.5 py-1 rounded-md text-violet-600 dark:text-violet-300 hover:bg-violet-50 dark:hover:bg-violet-900/30 disabled:opacity-40 disabled:cursor-not-allowed text-xs font-medium transition-colors"
                >
                  {t(labelKey, { defaultValue: fallback })}
                </button>
              ))}
            </div>
          )}
          {run && !running && (
            <button
              onClick={() => onClearOutput(cell.id)}
              className="p-1.5 rounded-md text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
              title={t('courses:clear_output', { defaultValue: 'Clear output' })}
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {(run || running) && (
          <div data-cell-output={cell.id}>
            <CodeOutput
              code={code}
              title={cell.title}
              outputs={run?.outputs ?? []}
              isExecuting={running}
              error={run?.error}
              language={language}
            />
          </div>
        )}
      </div>
      )}
    </div>
  );
};

/**
 * Memoized: with 20+ cells each carrying a live Monaco editor, re-rendering
 * every cell on any keystroke is the dominant UI cost. Parent callbacks must
 * stay referentially stable for this to engage.
 */
export const NotebookCell = memo(NotebookCellInner);
