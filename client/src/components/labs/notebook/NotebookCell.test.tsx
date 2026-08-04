import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) => (opts?.defaultValue as string) ?? key,
  }),
}));

// Monaco cannot mount under jsdom and loads from a CDN. Stub the wrapper, not
// the library: this keeps the props NotebookCell actually passes observable.
vi.mock('../authoring/CodeEditorField', () => ({
  CodeEditorField: ({
    value,
    onChange,
    readOnly,
    ariaLabel,
  }: {
    value: string;
    onChange: (v: string) => void;
    readOnly?: boolean;
    ariaLabel?: string;
  }) => (
    <textarea
      data-testid="editor"
      aria-label={ariaLabel}
      value={value}
      readOnly={readOnly}
      onChange={e => onChange(e.target.value)}
    />
  ),
}));

import { NotebookCell } from './NotebookCell';
import type { LabCell } from '../authoring/cell';

Element.prototype.scrollIntoView = vi.fn();

const codeCell: LabCell = {
  id: 7,
  title: 'Step 6',
  prose: 'Group the events',
  code: 'mean(x)',
  orderIndex: 0,
  locked: false,
  cellType: 'code',
};
const markdownCell: LabCell = { ...codeCell, id: 8, cellType: 'markdown' };

const noop = () => {};

const renderCell = (props: Partial<React.ComponentProps<typeof NotebookCell>> = {}) =>
  render(
    <NotebookCell
      cell={codeCell}
      index={0}
      total={1}
      language="r"
      canEdit={false}
      draft={undefined}
      onDraftChange={noop}
      run={undefined}
      isRuntimeBusy={false}
      onRun={noop}
      onClearOutput={noop}
      {...props}
    />
  );

const openMenu = () => fireEvent.click(screen.getByRole('button', { name: 'Cell actions' }));
const resetItem = () =>
  within(screen.getByRole('menu'))
    .getAllByRole('menuitem')
    .find(el => el.textContent?.includes('Reset')) as HTMLButtonElement;
const menuLabels = () =>
  within(screen.getByRole('menu'))
    .getAllByRole('menuitem')
    .map(el => el.textContent?.trim());

describe('NotebookCell overflow menu', () => {
  beforeEach(() => {
    Object.assign(navigator, { clipboard: { writeText: vi.fn().mockResolvedValue(undefined) } });
  });

  it('offers an author lock, duplicate and delete on a code cell', () => {
    renderCell({ canEdit: true, onSave: noop, onDuplicate: noop, onDelete: noop });
    openMenu();
    const labels = menuLabels();

    expect(labels.some(l => l?.includes('Lock'))).toBe(true);
    expect(labels).toContain('Duplicate cell');
    expect(labels).toContain('Delete cell');
    expect(labels.some(l => l?.includes('Reset'))).toBe(false);
  });

  it('omits Lock on a markdown cell instead of rendering an invisible button', () => {
    renderCell({ cell: markdownCell, canEdit: true, onSave: noop, onDuplicate: noop, onDelete: noop });
    openMenu();
    const labels = menuLabels();

    expect(labels.some(l => l?.includes('Lock'))).toBe(false);
    expect(labels).toContain('Duplicate cell');
    expect(labels).toContain('Delete cell');
  });

  it('gives a student a scratch copy and a reset, never lock or delete', () => {
    renderCell({ onScratchCopy: noop });
    openMenu();
    const labels = menuLabels();

    expect(labels).toContain('Duplicate as my scratch copy');
    expect(labels.some(l => l?.includes('Reset'))).toBe(true);
    expect(labels.some(l => l?.includes('Lock'))).toBe(false);
    expect(labels).not.toContain('Delete cell');
  });

  it('renders no trigger at all for a student on a markdown cell', () => {
    renderCell({ cell: markdownCell, onScratchCopy: noop });
    expect(screen.queryByRole('button', { name: 'Cell actions' })).toBeNull();
  });

  it('keeps the four AI actions as buttons outside the menu', () => {
    renderCell({ onAskAI: noop, onScratchCopy: noop });

    for (const name of ['Explain', 'Interpret', 'Debug', 'Ask']) {
      expect(screen.getByRole('button', { name })).toBeTruthy();
    }
    openMenu();
    expect(menuLabels()).not.toContain('Explain');
  });

  it('disables Reset while the code still matches the original', () => {
    renderCell({ onScratchCopy: noop });
    openMenu();
    expect(resetItem().disabled).toBe(true);
  });

  it('enables Reset once the student has changed something', () => {
    renderCell({ draft: 'mean(y)', onScratchCopy: noop });
    openMenu();
    expect(resetItem().disabled).toBe(false);
  });

  it('resets by changing the draft, never by saving', () => {
    const onDraftChange = vi.fn();
    const onSave = vi.fn();
    renderCell({ draft: 'mean(y)', onDraftChange, onSave, onScratchCopy: noop });

    openMenu();
    fireEvent.click(resetItem());

    expect(onDraftChange).toHaveBeenCalledWith(7, 'mean(x)');
    expect(onSave).not.toHaveBeenCalled();
  });
});

describe('NotebookCell copy', () => {
  beforeEach(() => {
    Object.assign(navigator, { clipboard: { writeText: vi.fn().mockResolvedValue(undefined) } });
  });

  it('copies the code and nothing else', () => {
    renderCell({
      run: { outputs: [{ type: 'stdout', content: '[1] 42' }], error: null, running: false, execCount: 1 },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Copy code' }));

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('mean(x)');
    expect(navigator.clipboard.writeText).not.toHaveBeenCalledWith(expect.stringContaining('[1] 42'));
  });

  it('copies what the student has typed, not the original', () => {
    renderCell({ draft: 'sd(x)' });
    fireEvent.click(screen.getByRole('button', { name: 'Copy code' }));

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('sd(x)');
  });
});

describe('NotebookCell scratch copies', () => {
  it('marks a scratch cell as unsaved and offers to discard it', () => {
    const onDismissScratch = vi.fn();
    renderCell({ cell: { ...codeCell, id: -1, isScratch: true }, onDismissScratch });

    expect(screen.getByText('Your copy — not saved')).toBeTruthy();
    openMenu();
    expect(menuLabels()).toContain('Discard this copy');
  });

  it('does not offer to copy a copy', () => {
    renderCell({
      cell: { ...codeCell, id: -1, isScratch: true },
      onScratchCopy: noop,
      onDismissScratch: noop,
    });
    openMenu();
    expect(menuLabels()).not.toContain('Duplicate as my scratch copy');
  });

  it('does not mark an instructor cell as a copy', () => {
    renderCell({ onScratchCopy: noop });
    expect(screen.queryByText('Your copy — not saved')).toBeNull();
  });
});
