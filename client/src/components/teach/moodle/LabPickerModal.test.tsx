import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) => {
      const dv = (opts?.defaultValue as string) ?? key;
      return dv.replace(/\{\{(\w+)\}\}/g, (_m, name) => String(opts?.[name] ?? ''));
    },
  }),
}));

import { LabPickerModal } from './LabPickerModal';
import type { CustomLab, LabTemplate } from '../../../types';

Element.prototype.scrollIntoView = vi.fn();

const tpl = (id: number, over: Partial<LabTemplate> = {}): LabTemplate =>
  ({
    id,
    labId: 1,
    title: `Cell ${id}`,
    description: '',
    content: '',
    code: 'mean(x)',
    orderIndex: id,
    locked: false,
    cellType: 'code',
    ...over,
  }) as LabTemplate;

const lab = (over: Partial<CustomLab> = {}): CustomLab =>
  ({
    id: 1,
    name: 'TNA Basics',
    description: 'An intro lab',
    labType: 'tna',
    config: null,
    aiChatbotId: null,
    createdBy: 10,
    isPublic: true,
    createdAt: '',
    updatedAt: '',
    creator: { id: 10, fullname: 'Dr Ada' },
    templates: [tpl(1), tpl(2)],
    _count: { templates: 2, assignments: 3 },
    ...over,
  }) as CustomLab;

/** The library list and the preview both show a lab's name; scope to disambiguate. */
const list = () => within(screen.getByTestId('lab-list'));
const preview = () => within(screen.getByTestId('lab-preview'));

const renderPicker = (props: Partial<React.ComponentProps<typeof LabPickerModal>> = {}) =>
  render(
    <LabPickerModal
      isOpen
      onClose={() => {}}
      labs={[lab()]}
      assignedLabIds={new Set()}
      currentUserId={99}
      selectedLabId=""
      onSelect={() => {}}
      onConfirm={() => {}}
      onBrowseAll={() => {}}
      {...props}
    />
  );

describe('LabPickerModal library', () => {
  it('lists labs the viewer did not create', () => {
    // The whole point: the old picker only ever showed your own.
    renderPicker({ currentUserId: 99, labs: [lab({ createdBy: 10 })] });
    expect(list().getByText('TNA Basics')).toBeTruthy();
  });

  it('shows the owner, so two similarly named labs are distinguishable', () => {
    renderPicker();
    expect(list().getByText('Dr Ada')).toBeTruthy();
  });

  it('shows how many cells a lab has', () => {
    renderPicker();
    expect(list().getByText('2 cells')).toBeTruthy();
  });

  it('labels a lab you own as yours', () => {
    renderPicker({ currentUserId: 10 });
    expect(list().getByText('Yours')).toBeTruthy();
  });

  it('labels an admin-authored lab as a template', () => {
    renderPicker({ currentUserId: 99, adminCreatorIds: new Set([10]) });
    expect(list().getByText('Template')).toBeTruthy();
  });

  it('labels anyone else\'s public lab as shared', () => {
    renderPicker({ currentUserId: 99 });
    expect(list().getByText('Shared')).toBeTruthy();
  });

  it('marks an already-attached lab and refuses to select it', () => {
    const onSelect = vi.fn();
    renderPicker({ assignedLabIds: new Set([1]), onSelect });

    expect(list().getByText('Already in this course')).toBeTruthy();
    const row = list().getByText('TNA Basics').closest('button') as HTMLButtonElement;
    expect(row.disabled).toBe(true);
    fireEvent.click(row);
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('filters by name, description and author', () => {
    const labs = [lab({ id: 1, name: 'TNA Basics' }), lab({ id: 2, name: 'SNA Deep Dive', creator: { id: 11, fullname: 'Prof Lin' } })];

    renderPicker({ labs });
    const box = screen.getByPlaceholderText('Search by name, description or author…');

    fireEvent.change(box, { target: { value: 'Lin' } });
    expect(list().queryByText('TNA Basics')).toBeNull();
    expect(list().getByText('SNA Deep Dive')).toBeTruthy();
  });

  it('narrows to just your labs on the Yours filter', () => {
    const labs = [lab({ id: 1, name: 'Mine', createdBy: 99 }), lab({ id: 2, name: 'Theirs', createdBy: 10 })];
    renderPicker({ labs, currentUserId: 99 });

    fireEvent.click(screen.getByRole('button', { name: 'Yours' }));
    expect(list().getByText('Mine')).toBeTruthy();
    expect(list().queryByText('Theirs')).toBeNull();
  });

  it('says so when nothing matches instead of showing an empty list', () => {
    renderPicker();
    fireEvent.change(screen.getByPlaceholderText('Search by name, description or author…'), {
      target: { value: 'zzzz' },
    });
    expect(screen.getByText('No labs match your search.')).toBeTruthy();
  });
});

describe('LabPickerModal preview', () => {
  it('prompts for a selection before anything is picked', () => {
    renderPicker();
    expect(screen.getByText('Select a lab to see what it contains.')).toBeTruthy();
  });

  it('previews the selected lab\'s cells', () => {
    renderPicker({ selectedLabId: '1' });
    expect(preview().getByText('Cell 1')).toBeTruthy();
    expect(preview().getByText('Cell 2')).toBeTruthy();
  });

  it('truncates a long cell rather than dumping the whole file', () => {
    const long = tpl(1, { code: ['1', '2', '3', '4', '5', '6'].map(n => `line${n}()`).join('\n') });
    renderPicker({ labs: [lab({ templates: [long] })], selectedLabId: '1' });

    expect(preview().getByText(/line4\(\)/)).toBeTruthy();
    expect(preview().queryByText(/line6\(\)/)).toBeNull();
  });

  it('shows no code block for a text cell', () => {
    renderPicker({
      labs: [lab({ templates: [tpl(1, { cellType: 'markdown', code: 'should_not_show()' })] })],
      selectedLabId: '1',
    });
    expect(screen.queryByText(/should_not_show/)).toBeNull();
  });

  it('reports how widely the lab is already used', () => {
    renderPicker({ selectedLabId: '1' });
    expect(preview().getByText('Used in 3 courses')).toBeTruthy();
  });

  it('keeps Add disabled until a lab is chosen', () => {
    const { rerender } = renderPicker();
    expect((screen.getByRole('button', { name: 'Add lab' }) as HTMLButtonElement).disabled).toBe(true);

    rerender(
      <LabPickerModal
        isOpen
        onClose={() => {}}
        labs={[lab()]}
        assignedLabIds={new Set()}
        currentUserId={99}
        selectedLabId="1"
        onSelect={() => {}}
        onConfirm={() => {}}
        onBrowseAll={() => {}}
      />
    );
    expect((screen.getByRole('button', { name: 'Add lab' }) as HTMLButtonElement).disabled).toBe(false);
  });

  it('renders the grading fields only alongside a chosen lab', () => {
    const { rerender } = renderPicker({ children: <div>grading fields</div> });
    expect(screen.queryByText('grading fields')).toBeNull();

    rerender(
      <LabPickerModal
        isOpen
        onClose={() => {}}
        labs={[lab()]}
        assignedLabIds={new Set()}
        currentUserId={99}
        selectedLabId="1"
        onSelect={() => {}}
        onConfirm={() => {}}
        onBrowseAll={() => {}}
      >
        <div>grading fields</div>
      </LabPickerModal>
    );
    expect(screen.getByText('grading fields')).toBeTruthy();
  });

  it('confirms with the chosen lab', () => {
    const onConfirm = vi.fn();
    renderPicker({ selectedLabId: '1', onConfirm });
    fireEvent.click(screen.getByRole('button', { name: 'Add lab' }));
    expect(onConfirm).toHaveBeenCalled();
  });
});

describe('LabPickerModal selection', () => {
  it('selects the lab that was clicked', () => {
    const onSelect = vi.fn();
    renderPicker({ labs: [lab({ id: 1 }), lab({ id: 2, name: 'Other' })], onSelect });

    fireEvent.click(list().getByText('Other').closest('button')!);
    expect(onSelect).toHaveBeenCalledWith('2');
  });

  it('marks the selected row for assistive tech', () => {
    renderPicker({ selectedLabId: '1' });
    const row = list().getByText('TNA Basics').closest('button')!;
    expect(row.getAttribute('aria-current')).toBe('true');
  });
});
