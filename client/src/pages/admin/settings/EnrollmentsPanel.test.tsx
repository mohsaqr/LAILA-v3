import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) => {
      const dv = (opts?.defaultValue as string) ?? key;
      return dv.replace(/\{\{(\w+)\}\}/g, (_m, name) => String(opts?.[name] ?? ''));
    },
  }),
}));

vi.mock('react-router-dom', () => ({ useNavigate: () => vi.fn() }));

const toastError = vi.fn();
vi.mock('react-hot-toast', () => ({
  default: { success: vi.fn(), error: (...a: unknown[]) => toastError(...a) },
}));

vi.mock('../../../api/admin', () => ({
  adminApi: {
    getEnrollments: vi.fn().mockResolvedValue({ enrollments: [] }),
    exportData: vi.fn(),
  },
}));

const importPasted = vi.fn();
vi.mock('../../../api/batchEnrollment', () => ({
  batchEnrollmentApi: { importPasted: (...a: unknown[]) => importPasted(...a) },
}));

import { EnrollmentsPanel } from './EnrollmentsPanel';

Element.prototype.scrollIntoView = vi.fn();

const renderPanel = () => {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <EnrollmentsPanel />
    </QueryClientProvider>,
  );
};

/** Open the modal and paste `text` into the textarea. */
const openAndPaste = async (text: string) => {
  fireEvent.click(await screen.findByText('batch_import'));
  const box = await screen.findByPlaceholderText(/email,course_id/);
  fireEvent.change(box, { target: { value: text } });
  return box;
};

const twoCourses = 'email,course_id\na@uef.fi,1\nb@uef.fi,2';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('EnrollmentsPanel batch import', () => {
  it('sends the pasted rows to the server', async () => {
    importPasted.mockResolvedValue({ jobs: [], invalid: [] });
    renderPanel();
    await openAndPaste(twoCourses);

    fireEvent.click(screen.getByText('import'));

    // The regression that prompted all of this: the button used to show a
    // success toast and close, without ever calling the server.
    await waitFor(() => expect(importPasted).toHaveBeenCalledWith(twoCourses));
  });

  it('will not submit an empty paste', async () => {
    renderPanel();
    fireEvent.click(await screen.findByText('batch_import'));

    const button = screen.getByText('import').closest('button')!;
    // Assert the guard itself. Clicking and checking the spy is not enough:
    // mutate() resolves asynchronously, so `not.toHaveBeenCalled()` on the
    // next line passes whether or not the button is actually disabled.
    expect(button).toBeDisabled();

    fireEvent.click(button);
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(importPasted).not.toHaveBeenCalled();
  });

  it('reports the real per-course outcome', async () => {
    importPasted.mockResolvedValue({
      jobs: [
        {
          jobId: 1,
          courseId: 1,
          courseTitle: 'Stats',
          totalRows: 3,
          successCount: 2,
          errorCount: 0,
          alreadyEnrolled: 1,
        },
      ],
      invalid: [],
    });
    renderPanel();
    await openAndPaste(twoCourses);
    fireEvent.click(screen.getByText('import'));

    expect(await screen.findByText('Stats')).toBeInTheDocument();
    expect(screen.getByText(/2 enrolled/)).toBeInTheDocument();
    // 'already enrolled' is a normal outcome, counted apart from failures.
    expect(screen.getByText(/1 already enrolled/)).toBeInTheDocument();
  });

  it('shows rows the parser could not read, with their line numbers', async () => {
    importPasted.mockResolvedValue({
      jobs: [
        {
          jobId: 1,
          courseId: 1,
          courseTitle: 'Stats',
          totalRows: 1,
          successCount: 1,
          errorCount: 0,
          alreadyEnrolled: 0,
        },
      ],
      invalid: [{ rowNumber: 4, email: 'oops', reason: 'Not a valid email address' }],
    });
    renderPanel();
    await openAndPaste(twoCourses);
    fireEvent.click(screen.getByText('import'));

    expect(await screen.findByText(/1 row\(s\) could not be read/)).toBeInTheDocument();
    // The line number is what makes the report actionable.
    expect(screen.getByText(/Row 4.*oops.*Not a valid email address/)).toBeInTheDocument();
  });

  it('warns that imported users cannot sign in yet', async () => {
    importPasted.mockResolvedValue({
      jobs: [
        {
          jobId: 1,
          courseId: 1,
          courseTitle: 'Stats',
          totalRows: 1,
          successCount: 1,
          errorCount: 0,
          alreadyEnrolled: 0,
        },
      ],
      invalid: [],
    });
    renderPanel();
    await openAndPaste(twoCourses);
    fireEvent.click(screen.getByText('import'));

    expect(await screen.findByText(/Forgot password/)).toBeInTheDocument();
  });

  it('does not claim success when the server refuses the import', async () => {
    importPasted.mockRejectedValue({
      response: { data: { error: 'Unknown course ids: 9' } },
    });
    renderPanel();
    await openAndPaste(twoCourses);
    fireEvent.click(screen.getByText('import'));

    // The server names which course failed; that has to reach the operator
    // rather than being flattened into a generic message.
    await waitFor(() => expect(toastError).toHaveBeenCalledWith('Unknown course ids: 9'));
    expect(screen.queryByText(/enrolled/)).not.toBeInTheDocument();
  });
});
