import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

/**
 * The publish control in Edit Mode used to be ONE button whose label was the
 * course's state ("Published") and whose click did the opposite ("unpublish"),
 * disclosed only by a hover tooltip. It read as a status badge, so it got
 * clicked as one, and a live course with 47 enrolled students went dark
 * without a warning — students see a bare 404, indistinguishable from a
 * deleted course.
 *
 * These cover the contract that replaced it: the badge reports state and is
 * inert, the button names the action it performs, and the destructive
 * direction is confirmed before anything is sent.
 */

// Interpolates `{{name}}` the way i18next does, because one of the strings
// under test earns its keep entirely through its `count` placeholder.
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) => {
      const template = (opts?.defaultValue as string) ?? key;
      return template.replace(/\{\{(\w+)\}\}/g, (whole, name: string) =>
        opts && name in opts ? String(opts[name]) : whole,
      );
    },
  }),
}));

vi.mock('../hooks/useTheme', () => ({ useTheme: () => ({ isDark: false }) }));

vi.mock('../components/teach/moodle/MoodleCourseEditor', () => ({
  MoodleCourseEditor: () => <div data-testid="course-editor" />,
}));

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

// `courseStatus` is a mutable box because vi.mock factories are hoisted above
// every const in this file, so the fixture cannot close over a plain literal
// that individual tests reassign.
const courseStatus = { value: 'published' };

vi.mock('../api/courses', () => ({
  coursesApi: {
    getCourseById: vi.fn(() => Promise.resolve({
      id: 3,
      title: 'Networks 101',
      description: 'A course',
      status: courseStatus.value,
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
      _count: { enrollments: 47 },
    })),
    regenerateActivationCode: vi.fn(),
    publishCourse: vi.fn(() => Promise.resolve({ id: 3, status: 'published' })),
    unpublishCourse: vi.fn(() => Promise.resolve({ id: 3, status: 'draft' })),
  },
}));
vi.mock('../api/enrollments', () => ({ enrollmentsApi: { enroll: vi.fn() } }));
vi.mock('../api/client', () => ({
  default: { get: vi.fn() },
  resolveFileUrl: (u: string) => u,
}));

vi.mock('../hooks/useAuth', () => ({
  useAuth: () => ({
    isAuthenticated: true,
    user: { id: 7, isInstructor: true, isAdmin: false },
    isActualAdmin: false,
    viewAsRole: null,
  }),
}));

import { CourseDetails } from './CourseDetails';
import { coursesApi } from '../api/courses';

const renderEditMode = () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/courses/3?edit=1']}>
        <Routes>
          <Route path="/courses/:id" element={<CourseDetails />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
};

beforeEach(() => {
  courseStatus.value = 'published';
  vi.mocked(coursesApi.publishCourse).mockClear();
  vi.mocked(coursesApi.unpublishCourse).mockClear();
});

describe('the status badge reports state and does nothing else', () => {
  it('shows Published for a published course and is not a control', async () => {
    renderEditMode();
    const badge = await screen.findByTestId('course-status-badge');

    expect(badge).toHaveTextContent('Published');
    // The whole defect was a badge that was secretly a button.
    expect(badge.tagName).toBe('SPAN');
    expect(badge.closest('button')).toBeNull();
  });

  it('shows Draft for an unpublished course', async () => {
    courseStatus.value = 'draft';
    renderEditMode();

    expect(await screen.findByTestId('course-status-badge')).toHaveTextContent('Draft');
  });

  it('does not call the API when the badge is clicked', async () => {
    renderEditMode();

    fireEvent.click(await screen.findByTestId('course-status-badge'));

    expect(coursesApi.unpublishCourse).not.toHaveBeenCalled();
    expect(coursesApi.publishCourse).not.toHaveBeenCalled();
  });
});

describe('the action button names the action, not the state', () => {
  it('offers Unpublish while the course is published', async () => {
    renderEditMode();

    expect(await screen.findByTestId('course-publish-action')).toHaveTextContent('Unpublish');
  });

  it('offers Publish while the course is a draft', async () => {
    courseStatus.value = 'draft';
    renderEditMode();

    expect(await screen.findByTestId('course-publish-action')).toHaveTextContent('Publish');
  });
});

describe('unpublishing is confirmed before anything is sent', () => {
  it('opens a confirmation instead of unpublishing on the first click', async () => {
    renderEditMode();

    fireEvent.click(await screen.findByTestId('course-publish-action'));

    await screen.findByText('Unpublish this course?');
    // The regression that mattered: one click used to be enough.
    expect(coursesApi.unpublishCourse).not.toHaveBeenCalled();
  });

  it('states how many students lose access', async () => {
    renderEditMode();

    fireEvent.click(await screen.findByTestId('course-publish-action'));

    expect(await screen.findByText(/47 enrolled student/)).toBeInTheDocument();
  });

  it('unpublishes once the dialog is confirmed', async () => {
    renderEditMode();

    fireEvent.click(await screen.findByTestId('course-publish-action'));
    // Scoped to the dialog: the page's own action button carries the same
    // label, which is correct — the confirm restates the action it confirms.
    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Unpublish' }));

    await waitFor(() => expect(coursesApi.unpublishCourse).toHaveBeenCalledWith(3));
  });

  it('sends nothing when the dialog is cancelled', async () => {
    renderEditMode();

    fireEvent.click(await screen.findByTestId('course-publish-action'));
    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'cancel' }));

    await waitFor(() =>
      expect(screen.queryByText('Unpublish this course?')).not.toBeInTheDocument(),
    );
    expect(coursesApi.unpublishCourse).not.toHaveBeenCalled();
  });
});

describe('publishing is not obstructed', () => {
  it('publishes on a single click, with no confirmation', async () => {
    courseStatus.value = 'draft';
    renderEditMode();

    fireEvent.click(await screen.findByTestId('course-publish-action'));

    await waitFor(() => expect(coursesApi.publishCourse).toHaveBeenCalledWith(3));
    expect(screen.queryByText('Unpublish this course?')).not.toBeInTheDocument();
  });
});
