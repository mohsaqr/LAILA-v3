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
} from 'lucide-react';
import { CodeEditorField, CodeLanguage } from '../authoring/CodeEditorField';
import { MarkdownField } from '../authoring/MarkdownField';
import { CodeOutput } from '../../code/CodeOutput';
import { renderMarkdown } from '../../../utils/renderMarkdown';
import { sanitizeHtml } from '../../../utils/sanitize';
import { LabCell, LabCellPatch } from '../authoring/cell';
import type { OutputItem } from '../LabOutput';

export interface CellRunState {
  outputs: OutputItem[];
  error: string | null;
  running: boolean;
  execCount: number | null;
}

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
  onAskAI?: (cell: LabCell, code: string, error: string | null) => void;
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
  isMutating = false,
  dragProps,
}: NotebookCellProps) => {
  const { t } = useTranslation(['courses', 'teaching', 'common']);
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
                ? 'bg-amber-100 text-amber-700 animate-pulse'
                : run?.error
                  ? 'bg-red-100 text-red-600'
                  : run?.execCount
                    ? 'bg-emerald-100 text-emerald-700'
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
          <span className="shrink-0 px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 text-xs font-medium">
            {t('teaching:unsaved', { defaultValue: 'Unsaved' })}
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

        {/* Author controls — permanently visible */}
        {canEdit && (
          <div className="flex items-center gap-0.5">
            {!isMarkdownCell && (
            <button
              onClick={() => onSave?.(cell.id, { locked: !cell.locked })}
              className={`p-1.5 rounded-md transition-colors ${
                cell.locked
                  ? 'bg-amber-100 text-amber-700 hover:bg-amber-200'
                  : 'text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-600'
              }`}
              title={
                cell.locked
                  ? t('teaching:unlock_cell', { defaultValue: 'Unlock — students can edit' })
                  : t('teaching:lock_cell', {
                      defaultValue: 'Lock — students can run but not edit',
                    })
              }
            >
              {cell.locked ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
            </button>
            )}
            {onDuplicate && (
              <button
                onClick={() => onDuplicate(cell)}
                disabled={isMutating}
                className="p-1.5 rounded-md text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-600 disabled:opacity-40 disabled:cursor-not-allowed"
                title={t('teaching:duplicate_cell', { defaultValue: 'Duplicate cell' })}
              >
                <Copy className="w-4 h-4" />
              </button>
            )}
            {onDelete && (
              <button
                onClick={() => onDelete(cell)}
                disabled={isMutating}
                className="p-1.5 rounded-md text-red-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/30 disabled:opacity-40 disabled:cursor-not-allowed"
                title={t('teaching:delete_block', { defaultValue: 'Delete cell' })}
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
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
          {onAskAI && (
            <button
              onClick={() => onAskAI(cell, code, run?.error ?? null)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-violet-200 dark:border-violet-800 text-violet-600 dark:text-violet-300 hover:bg-violet-50 dark:hover:bg-violet-900/30 text-sm font-medium transition-colors"
            >
              <Sparkles className="w-4 h-4" />
              {t('courses:ask_ai', { defaultValue: 'Ask AI' })}
            </button>
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
