import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) => {
      const dv = (opts?.defaultValue as string) ?? key;
      return dv.replace(/\{\{(\w+)\}\}/g, (_m, name) => String(opts?.[name] ?? ''));
    },
  }),
}));

vi.mock('../../hooks/useTheme', () => ({ useTheme: () => ({ isDark: false }) }));

import { ModuleSection } from './ModuleSection';
import type { CurriculumViewMode } from '../../types';

const mod = (over: Record<string, unknown> = {}) =>
  ({
    id: 1,
    title: 'Introduction to Learning Analytics',
    description: 'Day 1. Monday 10th August',
    orderIndex: 0,
    isPublished: true,
    ...over,
  }) as never;

const renderSection = ({ module: moduleOver, ...props }: Record<string, unknown> = {}) =>
  render(
    <MemoryRouter>
      <ModuleSection
        moduleIndex={0}
        courseId={1}
        hasAccess
        {...props}
        // After the spread on purpose: `module` is pulled out above so a
        // partial override merges into the fixture instead of replacing it.
        module={mod((moduleOver as Record<string, unknown>) ?? {})}
      />
    </MemoryRouter>,
  );

const ALL_MODES: CurriculumViewMode[] = ['mini-cards', 'icons', 'list', 'accordion'];

describe('ModuleSection section description', () => {
  it.each(ALL_MODES)('shows the description in %s view', mode => {
    renderSection({ viewMode: mode });

    // It used to be hidden in 'mini-cards' specifically — which is the default
    // for every course, so in practice the description was never visible to a
    // student or to a teacher outside edit mode.
    expect(screen.getByText('Day 1. Monday 10th August')).toBeInTheDocument();
  });

  it('shows the description when no view mode is passed at all', () => {
    // The prop default is also 'mini-cards', so this is the real-world path.
    renderSection();

    expect(screen.getByText('Day 1. Monday 10th August')).toBeInTheDocument();
  });

  it('renders nothing extra when there is no description', () => {
    renderSection({ module: { description: '' } });

    expect(screen.queryByText('Day 1. Monday 10th August')).not.toBeInTheDocument();
    expect(screen.getByText('Introduction to Learning Analytics')).toBeInTheDocument();
  });
});

describe('ModuleSection assigned labs', () => {
  const lab = (over: Record<string, unknown> = {}) => ({
    id: 3,
    lab: { id: 9, name: 'SNA R Chapter', labType: 'sna', description: null },
    ...over,
  });

  it('places an assigned lab by its orderIndex rather than pinning it last', () => {
    renderSection({
      viewMode: 'list',
      labAssignments: [lab({ orderIndex: 0 })],
      lectures: [
        { id: 1, title: 'Second lecture', orderIndex: 1, isPublished: true, contentType: 'text' },
      ],
    });

    const rendered = screen.getByText('SNA R Chapter');
    const lecture = screen.getByText('Second lecture');
    // Labs used to sort with a MAX_SAFE_INTEGER sentinel, so they always came
    // last no matter what the instructor wanted.
    expect(rendered.compareDocumentPosition(lecture) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('renders a section whose only content is an assigned lab', () => {
    renderSection({ viewMode: 'list', labAssignments: [lab({ orderIndex: 0 })] });

    // hasContent did not count labAssignments, so a lab-only section told the
    // student it was empty and never rendered the lab at all.
    expect(screen.getByText('SNA R Chapter')).toBeInTheDocument();
    expect(screen.queryByText('no_content_in_module')).not.toBeInTheDocument();
  });

  it('hides a lab the instructor hid from students', () => {
    renderSection({
      viewMode: 'list',
      labAssignments: [lab({ orderIndex: 0, isPublished: false })],
    });

    expect(screen.queryByText('SNA R Chapter')).not.toBeInTheDocument();
  });

  it('marks a lab the instructor hid', () => {
    renderSection({
      viewMode: 'list',
      labAssignments: [lab({ orderIndex: 0, isPublished: false })],
      showHidden: true,
    });

    expect(screen.getByText('SNA R Chapter')).toBeInTheDocument();
  });
});

describe('ModuleSection subsections', () => {
  const sub = (over: Record<string, unknown> = {}) =>
    ({
      id: 90,
      courseId: 1,
      title: 'Datasets & references',
      description: null,
      label: null,
      orderIndex: 0,
      isPublished: true,
      parentId: 1,
      lectures: [
        { id: 55, title: 'Week 1 dataset', orderIndex: 0, isPublished: true, contentType: 'text' },
      ],
      ...over,
    }) as never;

  const openSubsection = () => fireEvent.click(screen.getByText('Datasets & references').closest('button')!);

  it('renders a subsection folded, so its contents are out of the way', () => {
    renderSection({ subsections: [sub()] });

    expect(screen.getByText('Datasets & references')).toBeInTheDocument();
    // Folded is the whole point — the section was "crammed" before.
    expect(screen.queryByText('Week 1 dataset')).not.toBeInTheDocument();
  });

  it('reveals the contents when the subsection is opened', () => {
    renderSection({ subsections: [sub()] });
    openSubsection();

    expect(screen.getByText('Week 1 dataset')).toBeInTheDocument();
  });

  it.each(ALL_MODES)('renders the subsection in %s view too', mode => {
    renderSection({ viewMode: mode, subsections: [sub()] });

    expect(screen.getByText('Datasets & references')).toBeInTheDocument();
  });

  it('does not call a section empty when a subsection is its only content', () => {
    renderSection({ subsections: [sub()] });

    // hasContent counts subsections; without that a section holding only a
    // resources drawer told the student it had no content at all.
    expect(screen.queryByText('no_content_in_module')).not.toBeInTheDocument();
  });

  it('hides an unpublished subsection from students', () => {
    renderSection({ subsections: [sub({ isPublished: false })] });

    expect(screen.queryByText('Datasets & references')).not.toBeInTheDocument();
  });

  it('shows an unpublished subsection to staff previewing the page', () => {
    renderSection({ subsections: [sub({ isPublished: false })], showHidden: true });

    expect(screen.getByText('Datasets & references')).toBeInTheDocument();
  });

  it('shows the subsection description once opened', () => {
    renderSection({ subsections: [sub({ description: 'Supplementary material' })] });

    expect(screen.queryByText('Supplementary material')).not.toBeInTheDocument();
    openSubsection();
    expect(screen.getByText('Supplementary material')).toBeInTheDocument();
  });

  it('reports an empty subsection as empty rather than looking broken', () => {
    renderSection({ subsections: [sub({ lectures: [] })] });
    openSubsection();

    expect(screen.getByText('no_content_in_module')).toBeInTheDocument();
  });
});
