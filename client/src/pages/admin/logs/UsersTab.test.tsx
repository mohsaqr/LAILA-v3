import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

/**
 * The roster tab exists because the other log tabs answer "what happened"
 * and nobody can answer "who stopped showing up" by scanning event rows.
 * These pin the two things that makes it useful: last-login and last-seen
 * stay separate columns, and a never-seen account is rendered rather than
 * dropped.
 */

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

const getUserRoster = vi.fn();
vi.mock('../../../api/admin', () => ({
  activityLogApi: { getUserRoster: (...a: unknown[]) => getUserRoster(...a) },
}));

import { UsersTab } from './UsersTab';

const row = (over: Record<string, unknown> = {}) => ({
  userId: 1, name: 'Ada Lovelace', email: 'ada@x.edu', role: 'student',
  isActive: true, status: 'active', joinedAt: Date.parse('2026-01-01'),
  lastLogin: Date.parse('2026-08-11'),
  lastSeen: Date.now() - 3 * 86_400_000,
  lastSeenSource: 'interaction',
  sources: { activity: null, interaction: null, auth: null, enrollment: null },
  events: 588, interactions: 12,
  lastAction: { verb: 'viewed', objectType: 'lecture', objectTitle: 'SNA intro', courseTitle: 'C', at: Date.now() },
  ...over,
});

const renderTab = (courseId?: number) => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <UsersTab courseId={courseId} />
    </QueryClientProvider>,
  );
};

beforeEach(() => getUserRoster.mockReset());

describe('the roster shows presence, not events', () => {
  it('renders a person with both dates side by side', async () => {
    getUserRoster.mockResolvedValue({ data: [row()], total: 1 });
    renderTab();

    await screen.findByText('Ada Lovelace');
    // Both columns present: collapsing them would hide that logins lag badly.
    expect(screen.getByText(new Date(Date.parse('2026-08-11')).toLocaleDateString())).toBeInTheDocument();
    expect(screen.getByText('3d ago')).toBeInTheDocument();
  });

  it('labels a never-seen account instead of leaving it blank', async () => {
    getUserRoster.mockResolvedValue({
      data: [row({ lastSeen: null, lastSeenSource: null, lastLogin: null, events: 0, lastAction: null })],
      total: 1,
    });
    renderTab();

    await screen.findByText('Ada Lovelace');
    expect(screen.getByText('Never')).toBeInTheDocument();
  });

  it('shows what the person last did', async () => {
    getUserRoster.mockResolvedValue({ data: [row()], total: 1 });
    renderTab();

    expect(await screen.findByText(/SNA intro/)).toBeInTheDocument();
  });
});

describe('scoping', () => {
  it('requests the site-wide roster with no course', async () => {
    getUserRoster.mockResolvedValue({ data: [], total: 0 });
    renderTab();

    await screen.findByText('No users found');
    expect(getUserRoster).toHaveBeenCalledWith({ courseId: undefined, limit: 500 });
  });

  it('passes the course through when embedded in course logs', async () => {
    getUserRoster.mockResolvedValue({ data: [], total: 0 });
    renderTab(3);

    await screen.findByText('No users found');
    expect(getUserRoster).toHaveBeenCalledWith({ courseId: 3, limit: 500 });
  });
});
