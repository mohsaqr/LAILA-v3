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

vi.mock('../../hooks/useTheme', () => ({ useTheme: () => ({ isDark: false }) }));

// The child views mount their own queries and editors. This suite is about the
// collapsed strip, so they are stubbed to markers.
vi.mock('./LectureAIHelperChat', () => ({ LectureAIHelperChat: () => <div>chat</div> }));
vi.mock('./LectureExplainView', () => ({ LectureExplainView: () => <div>explain-view</div> }));
vi.mock('./PDFPageSelector', () => ({ PDFPageSelector: () => <div>pdf-selector</div> }));
vi.mock('./LecturePracticeMode', () => ({ LecturePracticeMode: () => <div>practice-view</div> }));

vi.mock('../../api/lectureAIHelper', () => ({
  lectureAIHelperApi: {
    getAvailability: vi.fn(),
    getPdfInfo: vi.fn(() => Promise.resolve({ pdfs: [] })),
    getSessions: vi.fn(() => Promise.resolve([])),
    chat: vi.fn(),
    getChatHistory: vi.fn(() => Promise.resolve([])),
  },
}));

import { LectureAIHelper } from './LectureAIHelper';
import { lectureAIHelperApi } from '../../api/lectureAIHelper';

const renderHelper = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <LectureAIHelper lectureId={7} lectureTitle="Regression basics" />
    </QueryClientProvider>,
  );
};

/** The three mode buttons in the collapsed strip. */
const modeButtons = () =>
  screen.getAllByRole('button').filter(b => /explain|discuss|practice_mode/.test(b.textContent ?? ''));

describe('LectureAIHelper availability gate', () => {
  beforeEach(() => vi.clearAllMocks());

  it('enables the mode buttons when the lecture qualifies', async () => {
    vi.mocked(lectureAIHelperApi.getAvailability).mockResolvedValue({ available: true, reason: null });
    renderHelper();

    await waitFor(() => expect(lectureAIHelperApi.getAvailability).toHaveBeenCalledWith(7));
    const buttons = modeButtons();
    expect(buttons).toHaveLength(3);
    buttons.forEach(b => expect(b).not.toBeDisabled());
  });

  it('disables the mode buttons and states the reason when it does not', async () => {
    vi.mocked(lectureAIHelperApi.getAvailability).mockResolvedValue({
      available: false,
      reason: 'unsupported',
    });
    renderHelper();

    await waitFor(() => expect(modeButtons()[0]).toBeDisabled());
    modeButtons().forEach(b => expect(b).toBeDisabled());
    expect(screen.getByText('ai_tools_unavailable_unsupported')).toBeInTheDocument();
  });

  it('shows the reason that matches the server, not a generic one', async () => {
    vi.mocked(lectureAIHelperApi.getAvailability).mockResolvedValue({
      available: false,
      reason: 'too_many_pdfs',
    });
    renderHelper();

    await waitFor(() =>
      expect(screen.getByText('ai_tools_unavailable_too_many_pdfs')).toBeInTheDocument(),
    );
  });

  // Note: this exercises the `disabled` attribute, not the early return in
  // handleModeClick — a disabled button never dispatches a click, so that guard
  // is unreachable by design and deliberately uncovered.
  it('stays collapsed when a disabled button is clicked', async () => {
    vi.mocked(lectureAIHelperApi.getAvailability).mockResolvedValue({
      available: false,
      reason: 'disabled',
    });
    renderHelper();

    await waitFor(() => expect(modeButtons()[0]).toBeDisabled());
    fireEvent.click(modeButtons()[0]);

    // Still collapsed: no child view mounted, and the expensive PDF query —
    // which the server would refuse — was never fired.
    expect(screen.queryByText('explain-view')).not.toBeInTheDocument();
    expect(lectureAIHelperApi.getPdfInfo).not.toHaveBeenCalled();
  });

  it('leaves the buttons usable while the availability request is in flight', () => {
    // An eligible lecture is the common case, so the strip must not flash a
    // disabled state on the way in.
    vi.mocked(lectureAIHelperApi.getAvailability).mockReturnValue(new Promise(() => {}));
    renderHelper();

    const buttons = modeButtons();
    expect(buttons).toHaveLength(3);
    buttons.forEach(b => expect(b).not.toBeDisabled());
    expect(screen.queryByText(/ai_tools_unavailable/)).not.toBeInTheDocument();
  });
});
