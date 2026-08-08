import { describe, it, expect } from 'vitest';
import {
  buildCalData, buildDailySeries, buildGrid, buildHourly,
  formatWindowLabel, getWindowEnd, shiftWindow, snapToWindowStart,
  type ActivityEvent,
} from './activityViews';

const ev = (over: Partial<ActivityEvent>): ActivityEvent => ({
  userId: 1,
  userName: 'Alice',
  verb: 'viewed',
  objectType: 'lecture',
  objectTitle: 'Intro',
  timestamp: 0,
  ...over,
});

// Local-time constructor so bucket assertions hold in any timezone.
const at = (y: number, m: number, d: number, h = 0) => new Date(y, m, d, h).getTime();

const stateOf = (e: ActivityEvent) => (e.verb === 'viewed' ? 'learning' : 'browsing');

describe('window navigation (carmdash-ported)', () => {
  it('day_hour windows are one Sunday-anchored week', () => {
    // 2026-08-05 is a Wednesday → snaps back to Sunday 2026-08-02
    const start = snapToWindowStart(at(2026, 7, 5, 13), 'day_hour');
    expect(new Date(start).getDay()).toBe(0);
    expect(new Date(start).getDate()).toBe(2);
    expect(getWindowEnd(start, 'day_hour') - start).toBe(7 * 86400000);
    expect(new Date(shiftWindow(start, 1, 'day_hour')).getDate()).toBe(9);
  });

  it('week_day windows are calendar months and month_day windows are years', () => {
    const mStart = snapToWindowStart(at(2026, 7, 15), 'week_day');
    expect(new Date(mStart).getDate()).toBe(1);
    expect(new Date(getWindowEnd(mStart, 'week_day')).getMonth()).toBe(8);

    const yStart = snapToWindowStart(at(2026, 7, 15), 'month_day');
    expect(new Date(yStart).getMonth()).toBe(0);
    expect(new Date(getWindowEnd(yStart, 'month_day')).getFullYear()).toBe(2027);
  });

  it('formats window labels per mode', () => {
    expect(formatWindowLabel(at(2026, 7, 2), 'day_hour')).toBe('2–8 Aug 2026');
    expect(formatWindowLabel(at(2026, 7, 1), 'week_day')).toBe('August 2026');
    expect(formatWindowLabel(at(2026, 0, 1), 'month_day')).toBe('2026');
  });
});

describe('buildGrid', () => {
  it('buckets per-student counts with per-state breakdowns (day_hour)', () => {
    const events = [
      ev({ timestamp: at(2026, 7, 3, 10) }),                            // Mon 10:00 Alice viewed
      ev({ timestamp: at(2026, 7, 3, 10), verb: 'scrolled' }),          // Mon 10:00 Alice browsing
      ev({ timestamp: at(2026, 7, 3, 10), userName: 'Bob', userId: 2 }),// Mon 10:00 Bob
      ev({ timestamp: at(2026, 7, 4, 9) }),                             // Tue 09:00 Alice
    ];
    const g = buildGrid(events, 'day_hour', null, stateOf);

    expect(g.xLen).toBe(24);
    expect(g.yLen).toBe(7);
    const mon10 = g.grid[1][10];
    expect(mon10).toHaveLength(2);
    const alice = mon10.find(s => s.student === 'Alice')!;
    expect(alice.count).toBe(2);
    expect(alice.states).toEqual({ learning: 1, browsing: 1 });
    expect(g.maxTotalCell).toBe(3);
    expect(g.maxStudent).toBe(2);
    expect(g.grid[2][9]).toHaveLength(1);
  });

  it('applies the window filter and drops null states', () => {
    const inWindow = at(2026, 7, 3, 10);
    const outWindow = at(2026, 6, 1, 10);
    const events = [ev({ timestamp: inWindow }), ev({ timestamp: outWindow })];
    const windowStart = snapToWindowStart(inWindow, 'day_hour');

    const g = buildGrid(events, 'day_hour', windowStart, stateOf);
    expect(g.grid.flat(2)).toHaveLength(1);

    const none = buildGrid(events, 'day_hour', null, () => null);
    expect(none.grid.flat(2)).toHaveLength(0);
  });
});

describe('buildHourly / buildDailySeries / buildCalData', () => {
  const events = [
    ev({ timestamp: at(2026, 7, 3, 10) }),
    ev({ timestamp: at(2026, 7, 3, 10), verb: 'scrolled', objectTitle: 'Quiz 1', objectType: 'quiz' }),
    ev({ timestamp: at(2026, 7, 4, 22) }),
  ];

  it('precomputes per-day 24-hour vectors', () => {
    const hourly = buildHourly(events);
    expect(hourly['2026-08-03'][10]).toBe(2);
    expect(hourly['2026-08-04'][22]).toBe(1);
    expect(hourly['2026-08-03']).toHaveLength(24);
  });

  it('builds daily series by state, resource, and type', () => {
    const byState = buildDailySeries(events, 'states', stateOf);
    expect(byState.days).toEqual(['2026-08-03', '2026-08-04']);
    expect(byState.series['learning']).toEqual([1, 1]);
    expect(byState.series['browsing']).toEqual([1, 0]);

    const byRes = buildDailySeries(events, 'resources', stateOf);
    expect(byRes.labels).toContain('Intro');
    expect(byRes.labels).toContain('Quiz 1');

    const byType = buildDailySeries(events, 'types', stateOf);
    expect(byType.series['lecture']).toEqual([1, 1]);
    expect(byType.series['quiz']).toEqual([1, 0]);
  });

  it('labels are ordered by total count and calData carries hourly', () => {
    const cal = buildCalData(events, 'states', stateOf);
    expect(cal.labels[0]).toBe('learning');
    expect(cal.hourly?.['2026-08-03'][10]).toBe(2);
  });
});
