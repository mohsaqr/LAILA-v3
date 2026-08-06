import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) => (opts?.defaultValue as string) ?? key,
  }),
}));

vi.mock('../../../hooks/useTheme', () => ({ useTheme: () => ({ isDark: false }) }));

// Tiptap only supplies the wrapper element; the node view under test is plain
// React below it. `as` is Tiptap's own prop and is not a DOM attribute.
vi.mock('@tiptap/react', () => ({
  NodeViewWrapper: ({ children, as: _as, ...rest }: Record<string, unknown> & { children?: React.ReactNode }) => (
    <div {...rest}>{children}</div>
  ),
}));

// Type-only, so it survives the runtime mock above.
import type { NodeViewProps } from '@tiptap/react';
import { UrlNodeView, isRedundantTitle } from './UrlNodeView';
import { LessonMediaContext } from './LessonMediaContext';

const renderCard = ({
  title = 'Join the Discord',
  url = 'https://discord.gg/example',
  editable = false,
  pageTitle,
}: { title?: string; url?: string; editable?: boolean; pageTitle?: string } = {}) => {
  // Tiptap hands a node view ~20 props; this component reads three of them, so
  // the fixture supplies those and is cast rather than stubbing the editor.
  const props = {
    node: { attrs: { url, title, newTab: true } },
    editor: { isEditable: editable },
    deleteNode: vi.fn(),
  } as unknown as NodeViewProps;

  return render(
    <LessonMediaContext.Provider value={{ pageTitle }}>
      <UrlNodeView {...props} />
    </LessonMediaContext.Provider>,
  );
};

describe('isRedundantTitle', () => {
  it('matches through the kind label an author puts on the page title', () => {
    // The real pair from the course page: the lecture and the single card it
    // holds said the same thing, one with a "Link:" prefix.
    expect(isRedundantTitle('Join the Discord', 'Link: Join the Discord')).toBe(true);
  });

  it('ignores case, punctuation and spacing', () => {
    expect(isRedundantTitle('join  the discord!', 'Link — Join the Discord')).toBe(true);
  });

  it('keeps a title that says something the heading does not', () => {
    expect(isRedundantTitle('Reading list', 'Week 3: Networks')).toBe(false);
    expect(isRedundantTitle('Syllabus', 'Course resources')).toBe(false);
  });

  it('is false when there is no page title to be redundant with', () => {
    expect(isRedundantTitle('Join the Discord', undefined)).toBe(false);
    expect(isRedundantTitle('Join the Discord', '')).toBe(false);
  });

  it('refuses to match on a title too short to carry meaning', () => {
    // Two characters appear inside almost any heading by chance.
    expect(isRedundantTitle('R', 'Introduction to R programming')).toBe(false);
    expect(isRedundantTitle('Go', 'Getting going with Go')).toBe(false);
  });
});

describe('UrlNodeView on the student page', () => {
  it('does not repeat the heading the page already shows', () => {
    renderCard({ pageTitle: 'Link: Join the Discord' });

    // The student saw "Link: Join the Discord" and then "Join the Discord"
    // again, on a page that held nothing else.
    expect(screen.queryByText('Join the Discord')).not.toBeInTheDocument();
    expect(screen.getByText('discord.gg')).toBeInTheDocument();
  });

  it('keeps the title when it is not what the heading says', () => {
    renderCard({ pageTitle: 'Week 3: Networks' });

    expect(screen.getByText('Join the Discord')).toBeInTheDocument();
    expect(screen.getByText('discord.gg')).toBeInTheDocument();
  });

  it('makes the whole card the link, not just the Open button', () => {
    const { container } = renderCard({ pageTitle: 'Link: Join the Discord' });

    const links = container.querySelectorAll('a');
    expect(links).toHaveLength(1);
    expect(links[0].getAttribute('href')).toBe('https://discord.gg/example');
    // The icon tile and the host line are inside the click target.
    expect(links[0].textContent).toContain('discord.gg');
  });

  it('never nests one link inside another', () => {
    const { container } = renderCard();

    // The card is an <a> and the old "Open" anchor still lived inside it,
    // which is invalid HTML and gives two competing click targets.
    expect(container.querySelector('a a')).toBeNull();
  });

  it('opens in a new tab without leaking the referrer', () => {
    const { container } = renderCard();
    const link = container.querySelector('a');

    expect(link?.getAttribute('target')).toBe('_blank');
    expect(link?.getAttribute('rel')).toBe('noopener noreferrer');
  });

  it('names the link by its real title even when the title is not drawn', () => {
    const { container } = renderCard({ pageTitle: 'Link: Join the Discord' });

    // Hiding the visible title must not cost a screen reader the meaning.
    expect(container.querySelector('a')?.getAttribute('aria-label')).toContain('Join the Discord');
  });

  it('shows a plain card, not a link, for a URL it will not follow', () => {
    const { container } = renderCard({ url: 'javascript:alert(1)' });

    expect(container.querySelector('a')).toBeNull();
  });
});

describe('UrlNodeView in the editor', () => {
  it('keeps the block title even when a page title would match', () => {
    renderCard({ editable: true, pageTitle: 'Link: Join the Discord' });

    // An author is looking at one block among many; its own title is the only
    // label it has, and no page heading is shown next to it.
    expect(screen.getByText('Join the Discord')).toBeInTheDocument();
  });

  it('leaves the card clickable only through Open, so drag and delete still work', () => {
    const { container } = renderCard({ editable: true });

    const links = container.querySelectorAll('a');
    expect(links).toHaveLength(1);
    // The <a> is the Open button, not the card: the card is its ancestor.
    expect(links[0].className).toContain('shrink-0');
    expect(screen.getByLabelText('Delete')).toBeInTheDocument();
  });
});
