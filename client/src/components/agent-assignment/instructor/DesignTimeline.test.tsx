import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DesignTimeline } from './DesignTimeline';

const baseEvent = {
  id: 1,
  timestamp: '2026-04-12T21:55:05Z',
};

describe('DesignTimeline — tab_time_recorded label', () => {
  it('shows the tab name alongside the "Time on tab" label', () => {
    render(
      <DesignTimeline
        events={[
          {
            ...baseEvent,
            eventType: 'tab_time_recorded',
            eventCategory: 'navigation',
            activeTab: 'identity',
          },
        ]}
      />
    );

    expect(screen.getByText('Time on tab: identity')).toBeInTheDocument();
  });

  it('keeps the friendly label for tab_switch and appends the destination tab', () => {
    render(
      <DesignTimeline
        events={[
          {
            ...baseEvent,
            id: 2,
            eventType: 'tab_switch',
            eventCategory: 'navigation',
            activeTab: 'advanced',
          },
        ]}
      />
    );

    expect(screen.getByText('Switched tab to advanced')).toBeInTheDocument();
  });

  it('falls back to the friendly label when activeTab is missing', () => {
    render(
      <DesignTimeline
        events={[
          {
            ...baseEvent,
            id: 3,
            eventType: 'tab_time_recorded',
            eventCategory: 'navigation',
          },
        ]}
      />
    );

    expect(screen.getByText('Time on tab')).toBeInTheDocument();
  });

  it('hides legacy pause/resume session rows', () => {
    render(
      <DesignTimeline
        events={[
          {
            ...baseEvent,
            id: 4,
            eventType: 'design_session_pause',
            eventCategory: 'session',
          },
          {
            ...baseEvent,
            id: 5,
            eventType: 'design_session_resume',
            eventCategory: 'session',
          },
          {
            ...baseEvent,
            id: 6,
            eventType: 'design_session_start',
            eventCategory: 'session',
          },
        ]}
      />
    );

    expect(screen.queryByText('Paused session')).not.toBeInTheDocument();
    expect(screen.queryByText('Resumed session')).not.toBeInTheDocument();
    expect(screen.getByText('Started designing')).toBeInTheDocument();
  });
});
