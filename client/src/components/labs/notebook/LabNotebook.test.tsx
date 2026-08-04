import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) => (opts?.defaultValue as string) ?? key,
  }),
}));

vi.mock('../../common/ConfirmDialog', () => ({ ConfirmDialog: () => null }));

/**
 * Stub the cell so the notebook's wiring is observable: every render records the
 * props each cell was handed, and a few buttons let a test trigger the callbacks
 * the real cell would.
 */
const renders: Record<number, Record<string, unknown>[]> = {};

vi.mock('./NotebookCell', () => ({
  NotebookCell: (props: Record<string, unknown>) => {
    const cell = props.cell as { id: number; title: string; isScratch?: boolean };
    (renders[cell.id] ??= []).push(props);
    return (
      <div data-testid={`cell-${cell.id}`} data-scratch={cell.isScratch ? 'yes' : 'no'}>
        <span>{cell.title}</span>
        <button onClick={() => (props.onScratchCopy as (c: unknown) => void)?.(cell)}>
          {`scratch-${cell.id}`}
        </button>
        <button onClick={() => (props.onDismissScratch as (id: number) => void)?.(cell.id)}>
          {`dismiss-${cell.id}`}
        </button>
        <button onClick={() => (props.onDraftChange as (id: number, c: string) => void)(cell.id, 'typed')}>
          {`type-${cell.id}`}
        </button>
      </div>
    );
  },
}));

import { LabNotebook } from './LabNotebook';
import type { LabCell } from '../authoring/cell';

const cells: LabCell[] = [
  { id: 1, title: 'One', prose: '', code: 'a', orderIndex: 0, locked: false, cellType: 'code' },
  { id: 2, title: 'Two', prose: '', code: 'b', orderIndex: 1, locked: false, cellType: 'code' },
];

const runtime = {
  isReady: true,
  isExecuting: false,
  executeCode: vi.fn().mockResolvedValue({ success: true, outputs: [] }),
};

const renderNotebook = (props: Record<string, unknown> = {}) =>
  render(
    <LabNotebook
      cells={cells}
      language="r"
      canEdit={false}
      runtime={runtime as never}
      {...props}
    />
  );

describe('LabNotebook scratch copies', () => {
  beforeEach(() => {
    for (const k of Object.keys(renders)) delete renders[Number(k)];
  });

  it('adds a scratch copy directly beneath the cell it came from', () => {
    renderNotebook();
    fireEvent.click(screen.getByText('scratch-1'));

    expect(screen.getByText('One (copy)')).toBeTruthy();
    const ids = [...document.querySelectorAll('[data-testid^="cell-"]')].map(
      el => el.getAttribute('data-testid')
    );
    // Between its source and the next instructor cell, not appended at the end.
    expect(ids).toEqual(['cell-1', 'cell--1', 'cell-2']);
  });

  it('marks the copy as scratch and leaves the original alone', () => {
    renderNotebook();
    fireEvent.click(screen.getByText('scratch-1'));

    expect(screen.getByTestId('cell--1').getAttribute('data-scratch')).toBe('yes');
    expect(screen.getByTestId('cell-1').getAttribute('data-scratch')).toBe('no');
  });

  it('uses negative ids so a copy can never collide with a real cell', () => {
    renderNotebook();
    fireEvent.click(screen.getByText('scratch-1'));
    fireEvent.click(screen.getByText('scratch-2'));

    const ids = [...document.querySelectorAll('[data-testid^="cell-"]')]
      .map(el => Number(el.getAttribute('data-testid')!.replace('cell-', '')))
      .filter(n => n < 0);
    expect(ids).toEqual([-1, -2]);
  });

  it('discards a copy without touching the original', () => {
    renderNotebook();
    fireEvent.click(screen.getByText('scratch-1'));
    fireEvent.click(screen.getByText('dismiss--1'));

    expect(screen.queryByTestId('cell--1')).toBeNull();
    expect(screen.getByTestId('cell-1')).toBeTruthy();
  });

  it('never offers the scratch action to an author', () => {
    renderNotebook({ canEdit: true, onSaveCell: vi.fn() });
    const props = renders[1][0];
    expect(props.onScratchCopy).toBeUndefined();
  });

  it('offers it to a student', () => {
    renderNotebook();
    expect(renders[1][0].onScratchCopy).toBeTypeOf('function');
  });

  it('never hands a scratch cell a save or duplicate handler', () => {
    renderNotebook({ onSaveCell: vi.fn(), onDuplicateCell: vi.fn() });
    fireEvent.click(screen.getByText('scratch-1'));

    const scratchProps = renders[-1][0];
    expect(scratchProps.onSave).toBeUndefined();
    expect(scratchProps.onDuplicate).toBeUndefined();
    expect(scratchProps.onDelete).toBeUndefined();
    expect(scratchProps.canEdit).toBe(false);
  });
});

describe('LabNotebook referential stability', () => {
  beforeEach(() => {
    for (const k of Object.keys(renders)) delete renders[Number(k)];
  });

  it('keeps cell 2 props identical when cell 1 is edited', () => {
    renderNotebook({ onAskAI: vi.fn(), onDeleteCell: vi.fn() });
    const before = renders[2][renders[2].length - 1];

    fireEvent.click(screen.getByText('type-1'));

    const after = renders[2][renders[2].length - 1];
    // NotebookCell is memo'd; unstable props here mean every Monaco editor
    // re-renders on every keystroke, which is what the memo exists to prevent.
    expect(after.cell).toBe(before.cell);
    expect(after.onClearOutput).toBe(before.onClearOutput);
    expect(after.onAskAI).toBe(before.onAskAI);
    expect(after.onRun).toBe(before.onRun);
    expect(after.onDraftChange).toBe(before.onDraftChange);
  });
});

describe('LabNotebook .Rmd download', () => {
  beforeEach(() => {
    for (const k of Object.keys(renders)) delete renders[Number(k)];
  });

  it('offers the download to students, not only authors', () => {
    renderNotebook({ labName: 'My Lab' });
    expect(screen.getByRole('button', { name: /Download \.Rmd/ })).toBeTruthy();
  });

  it('exports the student\'s edits and scratch copies, not the stored originals', () => {
    const captured: { name?: string } = {};
    // jsdom's Blob has no .text(), so record the content as it is constructed.
    const written: string[] = [];
    const RealBlob = globalThis.Blob;
    vi.stubGlobal(
      'Blob',
      class {
        constructor(parts: string[]) {
          written.push(parts.join(''));
        }
      }
    );
    const createObjectURL = vi.fn(() => 'blob:x');
    Object.assign(URL, { createObjectURL, revokeObjectURL: vi.fn() });
    const origCreate = document.createElement.bind(document);
    vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      const el = origCreate(tag) as HTMLAnchorElement;
      if (tag === 'a') {
        Object.defineProperty(el, 'download', {
          set: (v: string) => { captured.name = v; },
          get: () => captured.name ?? '',
          configurable: true,
        });
        el.click = () => {};
      }
      return el;
    });

    renderNotebook({ labName: 'My Lab' });
    fireEvent.click(screen.getByText('type-1'));       // student edits cell 1
    fireEvent.click(screen.getByText('scratch-2'));    // and makes a scratch copy
    fireEvent.click(screen.getByRole('button', { name: /Download \.Rmd/ }));

    const body = written[0];
    vi.mocked(document.createElement).mockRestore();
    vi.stubGlobal('Blob', RealBlob);

    expect(captured.name).toBe('my-lab.Rmd');
    expect(body).toContain('title: "My Lab"');
    // The student's edit, not cell 1's stored code.
    expect(body).toContain('typed');
    expect(body).not.toContain('```{r}\na\n```');
    // And the scratch copy they made.
    expect(body).toContain('Two (copy)');
  });

  it('hides the download when the notebook is empty', () => {
    renderNotebook({ cells: [], labName: 'My Lab' });
    expect(screen.queryByRole('button', { name: /Download \.Rmd/ })).toBeNull();
  });
});
