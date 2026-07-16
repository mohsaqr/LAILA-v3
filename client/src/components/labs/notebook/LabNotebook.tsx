import { useState, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Type, PlayCircle, RotateCcw, Loader2, CircleDot } from 'lucide-react';
import { NotebookCell, CellRunState } from './NotebookCell';
import { ConfirmDialog } from '../../common/ConfirmDialog';
import { CodeLanguage } from '../authoring/CodeEditorField';
import { LabCell, LabCellPatch } from '../authoring/cell';
import type { OutputItem } from '../LabOutput';

export interface NotebookRuntime {
  isReady: boolean;
  isExecuting: boolean;
  executeCode: (
    code: string
  ) => Promise<{ success: boolean; outputs: OutputItem[]; error?: string }>;
  reset?: () => void | Promise<void>;
}

export interface LabNotebookProps {
  cells: LabCell[];
  language: CodeLanguage;
  canEdit: boolean;
  runtime: NotebookRuntime;
  /** Shown while the runtime is still booting (wasm download etc). */
  runtimeStatus?: string;
  onSaveCell?: (cellId: number, patch: LabCellPatch) => void;
  /** Insert a new cell so it lands at `position` in the current order. */
  onAddCell?: (position: number, cellType: 'code' | 'markdown') => void;
  onDuplicateCell?: (cell: LabCell) => void;
  onDeleteCell?: (cell: LabCell) => void;
  onReorder?: (ids: number[]) => void;
  /** Activity/analytics hook — fires after every cell run. */
  onCellRun?: (
    cell: LabCell,
    code: string,
    result: { success: boolean; outputs: OutputItem[] }
  ) => void;
  onAskAI?: (cell: LabCell, code: string, error: string | null, output?: string) => void;
  /** True while an add/duplicate/delete/reorder is in flight — disables structural actions. */
  isMutating?: boolean;
}

/**
 * THE lab surface. Standalone labs, course code labs, authoring and student
 * views all render this one component — capabilities differ only by props, so
 * there is exactly one editor to maintain and the experiences cannot drift.
 */
export const LabNotebook = ({
  cells,
  language,
  canEdit,
  runtime,
  runtimeStatus,
  onSaveCell,
  onAddCell,
  onDuplicateCell,
  onDeleteCell,
  onReorder,
  onCellRun,
  onAskAI,
  isMutating = false,
}: LabNotebookProps) => {
  const { t } = useTranslation(['courses', 'teaching', 'common']);
  const sorted = [...cells].sort((a, b) => a.orderIndex - b.orderIndex);

  // Students' code edits are local-only; authors' drafts persist on blur via
  // NotebookCell. Either way the draft is the source of truth for Run.
  const [drafts, setDrafts] = useState<Record<number, string>>({});
  const [runs, setRuns] = useState<Record<number, CellRunState>>({});
  const [runningAll, setRunningAll] = useState(false);
  const [deleteCell, setDeleteCell] = useState<LabCell | null>(null);
  const execCounter = useRef(0);
  // runtime.isExecuting is React state and flips asynchronously; this ref is
  // the synchronous lock that actually serializes runs on the shared session.
  const execLock = useRef(false);

  const handleDraftChange = useCallback((cellId: number, code: string) => {
    setDrafts(prev => ({ ...prev, [cellId]: code }));
  }, []);

  const runOne = useCallback(
    async (cell: LabCell, code: string) => {
      if (!runtime.isReady || runtime.isExecuting || execLock.current) return false;
      execLock.current = true;
      setRuns(prev => ({
        ...prev,
        [cell.id]: { outputs: [], error: null, running: true, execCount: prev[cell.id]?.execCount ?? null },
      }));
      let result: { success: boolean; outputs: OutputItem[]; error?: string };
      try {
        result = await runtime.executeCode(code);
      } finally {
        execLock.current = false;
      }
      execCounter.current += 1;
      setRuns(prev => ({
        ...prev,
        [cell.id]: {
          outputs: result.outputs,
          error: result.success ? null : (result.error ?? 'Execution failed'),
          running: false,
          execCount: execCounter.current,
        },
      }));
      onCellRun?.(cell, code, result);
      return result.success;
    },
    [runtime, onCellRun]
  );

  const runDisabledReason = !runtime.isReady
    ? runtimeStatus ||
      t('courses:runtime_loading', { defaultValue: 'Starting runtime…' })
    : null;

  const runAll = async () => {
    setRunningAll(true);
    try {
      for (const cell of sorted) {
        if (cell.cellType === 'markdown') continue;
        const ok = await runOne(cell, drafts[cell.id] ?? cell.code);
        if (!ok) break; // stop at first failure, like every notebook does
      }
    } finally {
      setRunningAll(false);
    }
  };

  const handleReset = async () => {
    await runtime.reset?.();
    setRuns({});
    execCounter.current = 0;
  };

  // ── Native drag reorder (house pattern: drag handle + drop gaps) ─────────
  const [dragId, setDragId] = useState<number | null>(null);
  const [overGap, setOverGap] = useState<number | null>(null);

  const dropOnGap = (gapIndex: number) => {
    if (dragId == null || !onReorder) return;
    const ids = sorted.map(c => c.id);
    const from = ids.indexOf(dragId);
    if (from < 0) return;
    ids.splice(from, 1);
    const insertAt = gapIndex > from ? gapIndex - 1 : gapIndex;
    ids.splice(insertAt, 0, dragId);
    setDragId(null);
    setOverGap(null);
    onReorder(ids);
  };

  const Gap = ({ index }: { index: number }) => (
    <div
      onDragOver={e => {
        if (dragId != null) {
          e.preventDefault();
          setOverGap(index);
        }
      }}
      onDragLeave={() => setOverGap(g => (g === index ? null : g))}
      onDrop={e => {
        e.preventDefault();
        dropOnGap(index);
      }}
      className={`relative flex items-center justify-center transition-all ${
        dragId != null ? 'h-10' : 'h-6'
      }`}
    >
      {dragId != null && (
        <div
          className={`absolute inset-x-4 h-1 rounded-full transition-colors ${
            overGap === index ? 'bg-emerald-500' : 'bg-emerald-200/60 dark:bg-emerald-800/60'
          }`}
        />
      )}
      {canEdit && onAddCell && dragId == null && (
        <div className="z-10 flex items-center gap-1.5">
          <button
            onClick={() => onAddCell(index, 'code')}
            disabled={isMutating}
            className="flex items-center gap-1 px-2.5 py-1 rounded-full border border-dashed border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-xs text-gray-500 hover:text-emerald-600 hover:border-emerald-400 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Plus className="w-3 h-3" />
            {t('teaching:add_code_cell', { defaultValue: 'Code' })}
          </button>
          <button
            onClick={() => onAddCell(index, 'markdown')}
            disabled={isMutating}
            className="flex items-center gap-1 px-2.5 py-1 rounded-full border border-dashed border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-xs text-gray-500 hover:text-sky-600 hover:border-sky-400 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Type className="w-3 h-3" />
            {t('teaching:add_text_cell', { defaultValue: 'Text' })}
          </button>
        </div>
      )}
    </div>
  );

  return (
    <div>
      {/* Toolbar */}
      <div className="sticky top-20 z-20 -mx-1 px-1 pb-2">
        <div className="flex items-center gap-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white/95 dark:bg-gray-800/95 backdrop-blur px-4 py-2.5 shadow-sm">
          <span className="flex items-center gap-1.5 text-xs font-medium">
            {runtime.isReady ? (
              <>
                <CircleDot className="w-3.5 h-3.5 text-emerald-500" />
                <span className="text-gray-600 dark:text-gray-300">
                  {language === 'python' ? 'Python' : 'R'}{' '}
                  {t('courses:runtime_ready', { defaultValue: 'ready' })}
                </span>
              </>
            ) : (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-500" />
                <span className="text-gray-500">
                  {runtimeStatus ||
                    t('courses:runtime_loading', { defaultValue: 'Starting runtime…' })}
                </span>
              </>
            )}
          </span>
          <span className="text-xs text-gray-400">
            {t('courses:cell_count', { count: sorted.length, defaultValue: '{{count}} cells' })}
          </span>
          <span className="flex-1" />
          <button
            onClick={runAll}
            disabled={!runtime.isReady || runtime.isExecuting || runningAll || sorted.length === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-medium transition-colors"
          >
            {runningAll ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <PlayCircle className="w-3.5 h-3.5" />
            )}
            {t('courses:run_all', { defaultValue: 'Run all' })}
          </button>
          {runtime.reset && (
            <button
              onClick={handleReset}
              disabled={runtime.isExecuting || runningAll}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 text-xs font-medium transition-colors"
              title={t('courses:reset_session_hint', {
                defaultValue: 'Clear all variables and outputs',
              })}
            >
              <RotateCcw className="w-3.5 h-3.5" />
              {t('courses:reset_session', { defaultValue: 'Reset session' })}
            </button>
          )}
        </div>
      </div>

      {/* Cells */}
      {sorted.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed border-gray-200 dark:border-gray-700 p-10 text-center">
          <p className="text-sm text-gray-400 mb-3">
            {t('courses:no_cells_yet', { defaultValue: 'This lab has no cells yet.' })}
          </p>
          {canEdit && onAddCell && (
            <div className="flex items-center justify-center gap-2">
              <button
                onClick={() => onAddCell(0, 'code')}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium"
              >
                <Plus className="w-4 h-4" />
                {t('teaching:add_code_cell', { defaultValue: 'Code' })}
              </button>
              <button
                onClick={() => onAddCell(0, 'markdown')}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-sky-600 hover:bg-sky-700 text-white text-sm font-medium"
              >
                <Type className="w-4 h-4" />
                {t('teaching:add_text_cell', { defaultValue: 'Text' })}
              </button>
            </div>
          )}
        </div>
      ) : (
        <div>
          <Gap index={0} />
          {sorted.map((cell, i) => (
            <div key={cell.id}>
              <NotebookCell
                cell={cell}
                index={i}
                total={sorted.length}
                language={language}
                canEdit={canEdit}
                draft={drafts[cell.id]}
                onDraftChange={handleDraftChange}
                run={runs[cell.id]}
                isRuntimeBusy={!runtime.isReady || runtime.isExecuting || runningAll}
                runDisabledReason={runDisabledReason}
                isMutating={isMutating}
                onRun={runOne}
                onClearOutput={cellId =>
                  setRuns(prev => {
                    const next = { ...prev };
                    delete next[cellId];
                    return next;
                  })
                }
                onSave={canEdit ? onSaveCell : undefined}
                onDuplicate={canEdit ? onDuplicateCell : undefined}
                onDelete={canEdit && onDeleteCell ? c => setDeleteCell(c) : undefined}
                onAskAI={
                  onAskAI
                    ? (cell, code, error) => {
                        const out = runs[cell.id]?.outputs
                          ?.filter(o => o.type !== 'plot')
                          .map(o => o.content)
                          .join('\n')
                          .slice(0, 2000);
                        onAskAI(cell, code, error, out || undefined);
                      }
                    : undefined
                }
                dragProps={
                  canEdit && onReorder
                    ? {
                        draggable: true,
                        onDragStart: e => {
                          e.dataTransfer.setData('text/plain', String(cell.id));
                          e.dataTransfer.effectAllowed = 'move';
                          setDragId(cell.id);
                        },
                        onDragEnd: () => {
                          setDragId(null);
                          setOverGap(null);
                        },
                      }
                    : undefined
                }
              />
              <Gap index={i + 1} />
            </div>
          ))}
        </div>
      )}

      <ConfirmDialog
        isOpen={!!deleteCell}
        onClose={() => setDeleteCell(null)}
        onConfirm={() => {
          if (deleteCell) onDeleteCell?.(deleteCell);
          setDeleteCell(null);
        }}
        title={t('teaching:delete_block', { defaultValue: 'Delete cell' })}
        message={t('teaching:delete_template_confirm', {
          name: deleteCell?.title ?? '',
          defaultValue: 'Are you sure you want to delete "{{name}}"?',
        })}
      />
    </div>
  );
};
