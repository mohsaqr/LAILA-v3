import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

/**
 * Edit Mode used to live in `useState`, so it was lost on every refresh and on
 * every trip out to a lecture/assignment editor. It now lives in the URL. These
 * cover the two things that has to get right: the URL drives it, and the URL
 * alone is not enough — a viewer who may not manage the course must never be
 * left inside the editor with its exit control hidden.
 */

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) => (opts?.defaultValue as string) ?? key,
  }),
}));

vi.mock('../hooks/useTheme', () => ({ useTheme: () => ({ isDark: false }) }));

// Far too large to render, and irrelevant here — all we need to know is
// whether the page chose it.
vi.mock('../components/teach/moodle/MoodleCourseEditor', () => ({
  MoodleCourseEditor: () => <div data-testid="course-editor" />,
}));

// The page calls `.catch()` on these, so they must return promises.
vi.mock('../services/activityLogger', () => ({
  default: {
    logCourseEnrolled: vi.fn(() => Promise.resolve()),
    logCourseViewed: vi.fn(() => Promise.resolve()),
  },
}));
vi.mock('../services/tracker', () => ({ useTracker: () => ({ track: vi.fn() }) }));
vi.mock('../components/common/TrackedContent', () => ({
  TrackedContent: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

// The fixture is inline because vi.mock factories are hoisted above every
// const in this file. `instructorId: 7` is the owner the tests sign in as.
vi.mock('../api/courses', () => ({
  coursesApi: {
    getCourseById: vi.fn(() => Promise.resolve({
      id: 3,
      title: 'Networks 101',
      description: 'A course',
      status: 'published',
      instructorId: 7,
      modules: [
        {
          id: 11,
          title: 'Week 1',
          parentId: null,
          orderIndex: 0,
          isPublished: true,
          lectures: [{ id: 21, title: 'Lecture: Intro', orderIndex: 0, isPublished: true, contentType: 'text' }],
        },
      ],
      _count: { enrollments: 4 },
    })),
    regenerateActivationCode: vi.fn(),
    publishCourse: vi.fn(),
    unpublishCourse: vi.fn(),
  },
}));
vi.mock('../api/enrollments', () => ({ enrollmentsApi: { enroll: vi.fn() } }));
vi.mock('../api/client', () => ({
  default: { get: vi.fn() },
  resolveFileUrl: (u: string) => u,
}));

const authState = {
  isAuthenticated: true,
  user: { id: 7, isInstructor: true, isAdmin: false },
  isActualAdmin: false,
  viewAsRole: null as string | null,
};
vi.mock('../hooks/useAuth', () => ({ useAuth: () => authState }));

import { CourseDetails } from './CourseDetails';

/** Reports the live URL so a toggle's effect on it can be asserted. */
const LocationProbe = () => {
  const location = useLocation();
  return <div data-testid="url">{`${location.pathname}${location.search}`}</div>;
};

const renderPage = (initialUrl: string) => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[initialUrl]}>
        <LocationProbe />
        <Routes>
          <Route path="/courses/:id" element={<CourseDetails />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
};

const editorShown = () => screen.queryByTestId('course-editor') !== null;

beforeEach(() => {
  authState.user = { id: 7, isInstructor: true, isAdmin: false };
  authState.isActualAdmin = false;
  authState.viewAsRole = null;
});

describe('CourseDetails edit mode comes from the URL', () => {
  it('opens the editor when the URL asks for it', async () => {
    renderPage('/courses/3?edit=1');

    // This is also the refresh case: a fresh mount at this URL is exactly what
    // a browser reload produces, and it used to come back in read-only.
    await waitFor(() => expect(editorShown()).toBe(true));
  });

  it('shows the read-only course without the parameter', async () => {
    renderPage('/courses/3');

    await screen.findByText('Week 1');
    expect(editorShown()).toBe(false);
  });

  it('ignores a value that is not exactly 1', async () => {
    renderPage('/courses/3?edit=maybe');

    await screen.findByText('Week 1');
    expect(editorShown()).toBe(false);
  });

  it('writes the parameter when Edit Mode is switched on', async () => {
    renderPage('/courses/3');

    fireEvent.click(await screen.findByText('Edit Mode'));

    await waitFor(() => expect(screen.getByTestId('url').textContent).toBe('/courses/3?edit=1'));
    expect(editorShown()).toBe(true);
  });

  it('clears the parameter when Edit Mode is switched off', async () => {
    renderPage('/courses/3?edit=1');

    fireEvent.click(await screen.findByText('Exit Edit Mode'));

    await waitFor(() => expect(screen.getByTestId('url').textContent).toBe('/courses/3'));
    expect(editorShown()).toBe(false);
  });

  it('keeps any other query parameter when toggling', async () => {
    renderPage('/courses/3?tab=grades');

    fireEvent.click(await screen.findByText('Edit Mode'));

    await waitFor(() => {
      const url = screen.getByTestId('url').textContent ?? '';
      expect(url).toContain('tab=grades');
      expect(url).toContain('edit=1');
    });
  });
});

describe('CourseDetails edit mode is refused to viewers who cannot manage', () => {
  it('does not strand a teacher who switched to previewing as a student', async () => {
    // The toggle that exits the editor is hidden for a student preview, so
    // rendering the editor anyway left no way out.
    authState.viewAsRole = 'student';
    renderPage('/courses/3?edit=1');

    await screen.findByText('Week 1');
    expect(editorShown()).toBe(false);
    expect(screen.queryByText('Exit Edit Mode')).not.toBeInTheDocument();
  });

  it('does not open the editor for a user who does not own the course', async () => {
    authState.user = { id: 99, isInstructor: true, isAdmin: false };
    renderPage('/courses/3?edit=1');

    // A global isInstructor flag is true for instructors of unrelated courses
    // and must never be enough on its own: a non-owner who is not enrolled or
    // course staff gets the enrolment gate, not the content and not the editor.
    await screen.findByText('Enroll to access this course');
    expect(editorShown()).toBe(false);
    expect(screen.queryByText('Week 1')).not.toBeInTheDocument();
  });

  it('opens for an admin, who may manage any course', async () => {
    authState.user = { id: 99, isInstructor: false, isAdmin: true };
    authState.isActualAdmin = true;
    renderPage('/courses/3?edit=1');

    await waitFor(() => expect(editorShown()).toBe(true));
  });
});
