import { useState, useRef, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Type, PlayCircle, RotateCcw, Loader2, CircleDot, Upload, FileDown } from 'lucide-react';
import { NotebookCell, CellRunState } from './NotebookCell';
import { ConfirmDialog } from '../../common/ConfirmDialog';
import { CodeLanguage } from '../authoring/CodeEditorField';
import { LabCell, LabCellPatch } from '../authoring/cell';
import type { OutputItem } from '../LabOutput';
import type { AIIntent } from './LabAIPanel';
import { notebookToRmd } from '../../../utils/notebookToRmd';
import { downloadText, toFileSlug } from '../../../utils/downloadFile';

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
  onAskAI?: (cell: LabCell, code: string, error: string | null, intent: AIIntent, output?: string) => void;
  /** True while an add/duplicate/delete/reorder is in flight — disables structural actions. */
  isMutating?: boolean;
  /** Titles the exported .Rmd and names the downloaded file. */
  labName?: string;
  /** Import an .Rmd/.qmd file's cells into this lab. Receives the file text. */
  onImport?: (content: string, fileName: string) => void | Promise<void>;
  /** True while an import is in flight. */
  isImporting?: boolean;
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
  onImport,
  isImporting = false,
  labName,
}: LabNotebookProps) => {
  const { t } = useTranslation(['courses', 'teaching', 'common']);
  // Memoized because NotebookCell is memo'd: a fresh array here would hand every
  // cell a new `cell` prop on every keystroke and defeat it.
  const sorted = useMemo(() => [...cells].sort((a, b) => a.orderIndex - b.orderIndex), [cells]);
  const importInputRef = useRef<HTMLInputElement | null>(null);

  const handleImportFile = async (file: File | undefined) => {
    if (!file || !onImport) return;
    try {
      const text = await file.text();
      await onImport(text, file.name);
    } finally {
      if (importInputRef.current) importInputRef.current.value = '';
    }
  };

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

  // A student's throwaway copies, keyed by the cell they were made from so they
  // stay put when the instructor reorders or the lab refetches. Session-only:
  // nothing here is ever sent anywhere, and the key={labId} remount on both
  // hosts clears them when the lab changes.
  const [scratch, setScratch] = useState<Record<number, LabCell[]>>({});
  // Scratch ids count down from -1. Real cell ids are positive autoincrement,
  // so a negative id can never collide with the instructor's.
  const scratchIdRef = useRef(0);

  const handleScratchCopy = useCallback((source: LabCell) => {
    scratchIdRef.current -= 1;
    const copyCell: LabCell = {
      ...source,
      id: scratchIdRef.current,
      title: `${source.title} (copy)`,
      isScratch: true,
    };
    setScratch(prev => ({ ...prev, [source.id]: [...(prev[source.id] ?? []), copyCell] }));
    // Seed the draft so the copy opens with whatever the student had typed,
    // not the instructor's original.
    setDrafts(prev => ({ ...prev, [copyCell.id]: prev[source.id] ?? source.code }));
  }, []);

  const handleDismissScratch = useCallback((cellId: number) => {
    setScratch(prev => {
      const next: Record<number, LabCell[]> = {};
      for (const [sourceId, list] of Object.entries(prev)) {
        const kept = list.filter(c => c.id !== cellId);
        if (kept.length) next[Number(sourceId)] = kept;
      }
      return next;
    });
    setDrafts(prev => {
      const next = { ...prev };
      delete next[cellId];
      return next;
    });
    setRuns(prev => {
      const next = { ...prev };
      delete next[cellId];
      return next;
    });
  }, []);

  const handleClearOutput = useCallback((cellId: number) => {
    setRuns(prev => {
      const next = { ...prev };
      delete next[cellId];
      return next;
    });
  }, []);

  const handleDeleteRequest = useCallback((c: LabCell) => setDeleteCell(c), []);

  // `runs` changes on every execution, so closing over it would rebuild this on
  // every run and re-render every cell. Read it through a ref instead — the same
  // idiom CodeEditorField uses for its Monaco callbacks.
  const runsRef = useRef(runs);
  runsRef.current = runs;
  const handleAskAI = useCallback(
    (cell: LabCell, code: string, error: string | null, intent: AIIntent) => {
      const out = runsRef.current[cell.id]?.outputs
        ?.filter(o => o.type !== 'plot')
        .map(o => o.content)
        .join('\n')
        .slice(0, 2000);
      onAskAI?.(cell, code, error, intent, out || undefined);
    },
    [onAskAI]
  );

  // One drag-props object per cell, rebuilt only when the cell list itself
  // changes. The closures capture nothing but the id.
  const idKey = sorted.map(c => c.id).join(',');
  const dragPropsById = useMemo(() => {
    if (!canEdit || !onReorder) return {} as Record<number, NonNullable<React.ComponentProps<typeof NotebookCell>['dragProps']>>;
    return Object.fromEntries(
      sorted.map(c => [
        c.id,
        {
          draggable: true,
          onDragStart: (e: React.DragEvent) => {
            e.dataTransfer.setData('text/plain', String(c.id));
            e.dataTransfer.effectAllowed = 'move';
            setDragId(c.id);
          },
          onDragEnd: () => {
            setDragId(null);
            setOverGap(null);
          },
        },
      ])
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idKey, canEdit, onReorder]);

  const runDisabledReason = !runtime.isReady
    ? runtimeStatus ||
      t('courses:runtime_loading', { defaultValue: 'Starting runtime…' })
    : null;

  // What is actually on screen, top to bottom: each instructor cell followed by
  // any scratch copies made from it.
  const displayOrder = useMemo(
    () => sorted.flatMap(c => [c, ...(scratch[c.id] ?? [])]),
    [sorted, scratch]
  );

  // Exports what the reader is actually looking at: the student's current
  // edits and their scratch copies, not the instructor's stored originals.
  // With student edits held only in session, this is the one way out.
  const downloadRmd = () => {
    const name = labName || 'lab';
    downloadText(
      `${toFileSlug(name, 'lab')}.Rmd`,
      notebookToRmd(displayOrder, { labName: name, drafts, language }),
      'text/markdown'
    );
  };

  const runAll = async () => {
    setRunningAll(true);
    try {
      for (const cell of displayOrder) {
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

  const renderGap = (index: number) => (
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
          {canEdit && onImport && (
            <>
              <input
                ref={importInputRef}
                type="file"
                accept=".Rmd,.rmd,.qmd,.md,text/markdown"
                className="hidden"
                onChange={e => void handleImportFile(e.target.files?.[0])}
              />
              <button
                onClick={() => importInputRef.current?.click()}
                disabled={isImporting}
                title={t('teaching:import_rmd_desc', {
                  defaultValue: 'Import an R Markdown / Quarto file as cells',
                })}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 text-xs font-medium transition-colors"
              >
                {isImporting ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Upload className="w-3.5 h-3.5" />
                )}
                {t('teaching:import_rmd', { defaultValue: 'Import .Rmd / .qmd' })}
              </button>
            </>
          )}
          {/* Everyone, not just authors: for a student this is the only way to
              keep their work, since their edits live only in this session. */}
          {sorted.length > 0 && (
            <button
              onClick={downloadRmd}
              title={t('courses:download_rmd_desc', {
                defaultValue: 'Download this notebook as an .Rmd file you can open in RStudio',
              })}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 text-xs font-medium transition-colors"
            >
              <FileDown className="w-3.5 h-3.5" />
              {t('courses:download_rmd', { defaultValue: 'Download .Rmd' })}
            </button>
          )}
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
              {onImport && (
                <button
                  onClick={() => importInputRef.current?.click()}
                  disabled={isImporting}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 text-sm font-medium"
                >
                  {isImporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                  {t('teaching:import_rmd', { defaultValue: 'Import .Rmd / .qmd' })}
                </button>
              )}
            </div>
          )}
        </div>
      ) : (
        <div>
          {renderGap(0)}
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
                onClearOutput={handleClearOutput}
                onSave={canEdit ? onSaveCell : undefined}
                onDuplicate={canEdit ? onDuplicateCell : undefined}
                onDelete={canEdit && onDeleteCell ? handleDeleteRequest : undefined}
                onAskAI={onAskAI ? handleAskAI : undefined}
                onScratchCopy={canEdit ? undefined : handleScratchCopy}
                dragProps={dragPropsById[cell.id]}
              />
              {(scratch[cell.id] ?? []).map(sc => (
                <div key={sc.id} className="mt-3">
                  <NotebookCell
                    cell={sc}
                    index={i}
                    total={sorted.length}
                    language={language}
                    canEdit={false}
                    draft={drafts[sc.id]}
                    onDraftChange={handleDraftChange}
                    run={runs[sc.id]}
                    isRuntimeBusy={!runtime.isReady || runtime.isExecuting || runningAll}
                    runDisabledReason={runDisabledReason}
                    onRun={runOne}
                    onClearOutput={handleClearOutput}
                    onAskAI={onAskAI ? handleAskAI : undefined}
                    onDismissScratch={handleDismissScratch}
                  />
                </div>
              ))}
              {renderGap(i + 1)}
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
