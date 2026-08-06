import { describe, it, expect, vi, beforeEach } from 'vitest';
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

// Both resolve rather than returning undefined: the click handler calls
// `.catch()` on each, so a bare vi.fn() would throw a TypeError instead of
// testing anything.
vi.mock('../../api/enrollments', () => ({
  enrollmentsApi: { markLectureComplete: vi.fn(() => Promise.resolve()) },
}));
vi.mock('../../services/activityLogger', () => ({
  activityLogger: { logLectureViewed: vi.fn(() => Promise.resolve()) },
}));

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

describe('ModuleSection card layout', () => {
  // 'list' and 'accordion' have their own row renderers and never reach the
  // card grid, so these are the only two modes this describes.
  const CARD_MODES: CurriculumViewMode[] = ['mini-cards', 'icons'];

  // Two items whose content differs by as much as the card can vary: a long
  // title that wraps, a subtitle, and the "Hidden" badge on one but not the
  // other. Left to themselves these render at visibly different heights, which
  // is exactly what the grid has to normalise away.
  const unevenContent = {
    showHidden: true,
    lectures: [
      {
        id: 1,
        title: 'Video: Network measures (by Dragan Gasevic) with a title that wraps',
        description: 'A long description that also wraps onto more than one line',
        orderIndex: 0,
        isPublished: false,
        contentType: 'video',
      },
      { id: 2, title: 'Articles', orderIndex: 1, isPublished: true, contentType: 'text' },
    ],
  };

  it.each(CARD_MODES)('lays %s out on a grid with equal-height rows', mode => {
    const { container } = renderSection({ viewMode: mode, ...unevenContent });

    // `flex flex-wrap` sizes each wrapped row to its own tallest card, so rows
    // did not match each other; `auto-rows-fr` is what makes them uniform.
    const grid = container.querySelector('.auto-rows-fr');
    expect(grid).not.toBeNull();
    expect(grid?.className).toContain('grid');
    expect(grid?.className).not.toContain('flex-wrap');
  });

  it.each(CARD_MODES)('lets the card fill the cell it was given in %s', mode => {
    renderSection({ viewMode: mode, ...unevenContent });

    // The grid stretches the <Link>, not the bordered div inside it. Without
    // h-full on both, the border stopped at the content and the stretch was
    // invisible — the whole reason the cards looked ragged.
    const link = screen.getByText('Articles').closest('a');
    expect(link?.className).toContain('h-full');
    expect(link?.firstElementChild?.className).toContain('h-full');
  });

  it('renders a description as text, not as markup', () => {
    renderSection({
      viewMode: 'mini-cards',
      lectures: [
        {
          id: 1,
          title: 'Assignment 1',
          description: '<p><strong>You have two files</strong> to submit</p>',
          orderIndex: 0,
          isPublished: true,
          contentType: 'text',
        },
      ],
    });

    // The card put the stored HTML straight into a <span>, so students read
    // "<p><strong>You have two files..." on the course page.
    expect(screen.getByText('You have two files to submit')).toBeInTheDocument();
    expect(screen.queryByText(/<p>|<strong>/)).not.toBeInTheDocument();
  });

  it('shows no subtitle at all when the description is only empty markup', () => {
    const { container } = renderSection({
      viewMode: 'mini-cards',
      lectures: [
        { id: 1, title: 'Articles', description: '<p></p>', orderIndex: 0, isPublished: true, contentType: 'text' },
      ],
    });

    // '' would be falsy anyway, but toPlainText must not hand the card a blank
    // string that still reserves a line of layout.
    expect(container.textContent).not.toContain('<p>');
    expect(screen.getByText('Articles')).toBeInTheDocument();
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

// --- Link-only lectures open directly ------------------------------------
//
// Roughly a third of a real course is a "lecture" holding one external link and
// nothing else. Routing those through a wrapper page costs a click and — since
// they are authored to open in a new tab — leaves a dead page behind in the old
// one. The server flags them with `directLink`; these tests pin the behaviour
// that flag buys, in every view mode.

import { enrollmentsApi } from '../../api/enrollments';
import { activityLogger } from '../../services/activityLogger';

const DIRECT_URL = 'https://docs.google.com/document/d/abc/edit?pli=1&tab=t.0';

const linkLecture = (over: Record<string, unknown> = {}) => [{
  id: 7,
  title: 'Slides: INTRODUCTION',
  isPublished: true,
  orderIndex: 0,
  directLink: { url: DIRECT_URL, newTab: true },
  ...over,
}] as never;

const anchorFor = (container: HTMLElement, title: string) =>
  Array.from(container.querySelectorAll('a')).find(a => a.textContent?.includes(title));

describe('ModuleSection link-only lectures', () => {
  beforeEach(() => vi.clearAllMocks());

  it.each(ALL_MODES)('links straight to the destination in %s view', mode => {
    const { container } = renderSection({ viewMode: mode, lectures: linkLecture() });

    const anchor = anchorFor(container, 'Slides: INTRODUCTION');
    expect(anchor).toBeDefined();
    expect(anchor).toHaveAttribute('href', DIRECT_URL);
    // A react-router <Link> would emit an href the router owns; the wrapper
    // page's path must not appear anywhere.
    expect(anchor?.getAttribute('href')).not.toContain('/lectures/');
  });

  it.each(ALL_MODES)('keeps the wrapper page in %s view when there is no direct link', mode => {
    const { container } = renderSection({
      viewMode: mode,
      lectures: linkLecture({ directLink: null }),
    });

    const anchor = anchorFor(container, 'Slides: INTRODUCTION');
    expect(anchor).toHaveAttribute('href', '/courses/1/lectures/7');
  });

  it('opens in a new tab with noopener when the author asked for one', () => {
    const { container } = renderSection({ lectures: linkLecture() });

    const anchor = anchorFor(container, 'Slides: INTRODUCTION');
    expect(anchor).toHaveAttribute('target', '_blank');
    // Without noopener the opened page can navigate this one via window.opener.
    expect(anchor).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('honours data-newtab="false" rather than forcing a new tab', () => {
    const { container } = renderSection({
      lectures: linkLecture({ directLink: { url: DIRECT_URL, newTab: false } }),
    });

    expect(anchorFor(container, 'Slides: INTRODUCTION')).not.toHaveAttribute('target');
  });

  it('records progress when an enrolled student opens the link', () => {
    const { container } = renderSection({ lectures: linkLecture(), trackProgress: true });

    fireEvent.click(anchorFor(container, 'Slides: INTRODUCTION')!);

    // The click IS the visit — the student never reaches the lecture page, so
    // this is the only moment progress can be captured.
    expect(enrollmentsApi.markLectureComplete).toHaveBeenCalledWith(1, 7, 'Slides: INTRODUCTION', 1);
    expect(activityLogger.logLectureViewed).toHaveBeenCalledWith(7, 'Slides: INTRODUCTION', 1, 1);
  });

  it('does not record progress for staff previewing the course', () => {
    const { container } = renderSection({ lectures: linkLecture(), trackProgress: false });

    fireEvent.click(anchorFor(container, 'Slides: INTRODUCTION')!);

    // Staff have no enrollment to write to, and their clicks are not coursework.
    expect(enrollmentsApi.markLectureComplete).not.toHaveBeenCalled();
    expect(activityLogger.logLectureViewed).not.toHaveBeenCalled();
  });

  it('never records progress for an ordinary lecture', () => {
    const { container } = renderSection({
      lectures: linkLecture({ directLink: null }),
      trackProgress: true,
    });

    fireEvent.click(anchorFor(container, 'Slides: INTRODUCTION')!);

    // That lecture's own page owns its progress; completing it from the
    // curriculum would mark it done without the student reading a word.
    expect(enrollmentsApi.markLectureComplete).not.toHaveBeenCalled();
  });
});
