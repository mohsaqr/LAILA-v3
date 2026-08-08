/**
 * Data builders for the Student Activity views (Heatmap | Bubbles | Calendar)
 * and the daily stacked-area curves — ported from Carmdash
 * (moodle-tna/src/sidepanel/tabs/activity-tab.ts). The time-window navigation,
 * grid bucketing, and calendar/timeline series construction are copied
 * verbatim; only the event shape is adapted from Moodle log entries to LAILA
 * activity-log events (verb + objectType resolved to a learning state by the
 * dashboard's interpretation chain).
 */
import type { CalendarTreemapData } from './carm/calendar-treemap';

/** Slim event from GET /api/activity-log/events. */
export interface ActivityEvent {
  userId: number;
  userName: string;
  verb: string;
  objectType: string;
  objectTitle: string | null;
  timestamp: number;
}

export type TimeMode = 'day_hour' | 'week_day' | 'month_day';
export type CalCategoryMode = 'states' | 'resources' | 'types';

/* ── Window navigation (verbatim from Carmdash) ─────────────────
 *   day_hour → 1 week (Sun..Sat)
 *   week_day → 1 calendar month
 *   month_day → 1 calendar year
 */

export function getWindowEnd(start: number, timeMode: TimeMode): number {
  const d = new Date(start);
  if (timeMode === 'day_hour') return new Date(d.getFullYear(), d.getMonth(), d.getDate() + 7).getTime();
  if (timeMode === 'week_day') return new Date(d.getFullYear(), d.getMonth() + 1, 1).getTime();
  return new Date(d.getFullYear() + 1, 0, 1).getTime();
}

export function snapToWindowStart(ts: number, timeMode: TimeMode): number {
  const d = new Date(ts);
  if (timeMode === 'day_hour') {
    // Snap to Sunday of that week
    return new Date(d.getFullYear(), d.getMonth(), d.getDate() - d.getDay()).getTime();
  }
  if (timeMode === 'week_day') return new Date(d.getFullYear(), d.getMonth(), 1).getTime();
  return new Date(d.getFullYear(), 0, 1).getTime();
}

export function shiftWindow(start: number, dir: 1 | -1, timeMode: TimeMode): number {
  const d = new Date(start);
  if (timeMode === 'day_hour') return new Date(d.getFullYear(), d.getMonth(), d.getDate() + dir * 7).getTime();
  if (timeMode === 'week_day') return new Date(d.getFullYear(), d.getMonth() + dir, 1).getTime();
  return new Date(d.getFullYear() + dir, 0, 1).getTime();
}

const MONTH_SHORT_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTH_FULL_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export function formatWindowLabel(start: number, timeMode: TimeMode): string {
  const d = new Date(start);
  if (timeMode === 'day_hour') {
    const end = new Date(start + 6 * 86400000);
    if (d.getMonth() === end.getMonth()) {
      return `${d.getDate()}–${end.getDate()} ${MONTH_SHORT_NAMES[d.getMonth()]} ${d.getFullYear()}`;
    }
    return `${d.getDate()} ${MONTH_SHORT_NAMES[d.getMonth()]} – ${end.getDate()} ${MONTH_SHORT_NAMES[end.getMonth()]} ${end.getFullYear()}`;
  }
  if (timeMode === 'week_day') return `${MONTH_FULL_NAMES[d.getMonth()]} ${d.getFullYear()}`;
  return String(d.getFullYear());
}

/* ── Grid bucketing for the Heatmap/Bubbles views (verbatim) ──── */

export interface GridStudent {
  userId: number;
  student: string;
  count: number;
  states: Record<string, number>;
}

export interface ActivityGrid {
  grid: GridStudent[][][];
  maxTotalCell: number;
  maxStudent: number;
  xLen: number;
  yLen: number;
  xLabels: string[];
  yLabels: string[];
  getCell: (d: Date, ts: number) => [number, number] | null;
}

export function buildGrid(
  events: ActivityEvent[],
  timeMode: TimeMode,
  windowStart: number | null,
  getState: (e: ActivityEvent) => string | null,
): ActivityGrid {
  // Apply the window filter (no-op when "All time").
  const windowEnd = windowStart !== null ? getWindowEnd(windowStart, timeMode) : 0;
  const windowedLogs = windowStart === null
    ? events
    : events.filter(l => l.timestamp >= windowStart && l.timestamp < windowEnd);

  const validT = windowedLogs.filter(l => l.timestamp > 0).sort((a, b) => a.timestamp - b.timestamp);
  const minTs = validT.length ? validT[0].timestamp : 0;
  const maxTs = validT.length ? validT[validT.length - 1].timestamp : 0;

  let xLen = 0, yLen = 0;
  let xLabels: string[] = [], yLabels: string[] = [];
  let getCell: (d: Date, ts: number) => [number, number] | null = () => null;

  if (timeMode === 'day_hour') {
    xLen = 24; yLen = 7;
    xLabels = Array.from({ length: 24 }, (_, i) => String(i));
    yLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    getCell = (d) => [d.getHours(), d.getDay()];
  } else if (timeMode === 'week_day') {
    const WEEK_MS = 7 * 86400000;
    const wks = Math.max(1, Math.ceil((maxTs - minTs) / WEEK_MS));
    xLen = wks; yLen = 7;
    xLabels = Array.from({ length: wks }, (_, i) => `W${i + 1}`);
    yLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    getCell = (_d, ts) => [Math.floor((ts - minTs) / WEEK_MS), _d.getDay()];
  } else {
    xLen = 31; yLen = 12;
    xLabels = Array.from({ length: 31 }, (_, i) => String(i + 1));
    yLabels = MONTH_SHORT_NAMES.slice();
    getCell = (d) => [d.getDate() - 1, d.getMonth()];
  }

  const grid: GridStudent[][][] = Array.from({ length: yLen }, () => Array.from({ length: xLen }, () => []));
  // Keyed by userId, not display name: two students can share a name, and a
  // name change mid-course must not split one student into two bubbles.
  const cellMap = new Map<string, Map<number, { name: string; count: number; states: Record<string, number> }>>();

  for (const log of windowedLogs) {
    if (log.timestamp <= 0) continue;
    const st = getState(log);
    if (st === null) continue;
    const d = new Date(log.timestamp);
    const cell = getCell(d, log.timestamp);
    if (!cell || cell[0] < 0 || cell[0] >= xLen || cell[1] < 0 || cell[1] >= yLen) continue;
    const [xIdx, yIdx] = cell;

    const key = `${yIdx}|${xIdx}`;
    let sMap = cellMap.get(key);
    if (!sMap) { sMap = new Map(); cellMap.set(key, sMap); }

    let sData = sMap.get(log.userId);
    if (!sData) { sData = { name: log.userName, count: 0, states: {} }; sMap.set(log.userId, sData); }

    sData.states[st] = (sData.states[st] ?? 0) + 1;
    sData.count++;
  }

  for (const [key, sMap] of cellMap.entries()) {
    const [yIdx, xIdx] = key.split('|').map(Number);
    if (grid[yIdx] && grid[yIdx][xIdx]) {
      for (const [userId, data] of sMap.entries()) {
        grid[yIdx][xIdx].push({ userId, student: data.name, count: data.count, states: data.states });
      }
    }
  }

  const maxTotalCell = Math.max(...grid.flatMap(r => r.map(c => c.reduce((sum, s) => sum + s.count, 0))), 1);
  const maxStudent = Math.max(...grid.flatMap(r => r.map(c => (c.length > 0 ? Math.max(...c.map(s => s.count)) : 0))), 1);

  return { grid, maxTotalCell, maxStudent, xLen, yLen, xLabels, yLabels, getCell };
}

/* ── Calendar + curves series (verbatim, LAILA category modes) ── */

function dateKey(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Per-day hourly activity (24 values per day), for the calendar's day view. */
export function buildHourly(events: ActivityEvent[]): Record<string, number[]> {
  const hourlyData: Record<string, number[]> = {};
  for (const log of events) {
    if (log.timestamp <= 0) continue;
    const dk = dateKey(log.timestamp);
    const byHour = hourlyData[dk] ?? (hourlyData[dk] = new Array(24).fill(0));
    byHour[new Date(log.timestamp).getHours()] += 1;
  }
  return hourlyData;
}

/**
 * Daily series keyed by category. Category modes:
 *   states    → learning state (interpretation chain)
 *   resources → objectTitle (top 10)
 *   types     → objectType
 */
export function buildDailySeries(
  events: ActivityEvent[],
  mode: CalCategoryMode,
  getState: (e: ActivityEvent) => string | null,
): { days: string[]; labels: string[]; series: Record<string, number[]> } {
  const keyOf = (log: ActivityEvent): string | null => {
    if (mode === 'states') return getState(log);
    if (mode === 'types') return log.objectType || null;
    return log.objectTitle && log.objectTitle !== '-' ? log.objectTitle : null;
  };

  const counts = new Map<string, number>();
  for (const log of events) {
    if (log.timestamp <= 0) continue;
    const key = keyOf(log);
    if (!key) continue;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  // Resources are capped at the top 10 like Carmdash; states/types are few.
  const topItems = Array.from(counts.entries())
    .sort(([, a], [, b]) => b - a)
    .slice(0, mode === 'resources' ? 10 : counts.size)
    .map(([k]) => k);
  const topSet = new Set(topItems);

  const dailyCounts = new Map<string, Map<string, number>>();
  for (const log of events) {
    if (log.timestamp <= 0) continue;
    const key = keyOf(log);
    if (!key || !topSet.has(key)) continue;
    const dk = dateKey(log.timestamp);
    if (!dailyCounts.has(dk)) dailyCounts.set(dk, new Map());
    const dayMap = dailyCounts.get(dk)!;
    dayMap.set(key, (dayMap.get(key) ?? 0) + 1);
  }

  const days = Array.from(dailyCounts.keys()).sort();
  const series: Record<string, number[]> = {};
  for (const r of topItems) series[r] = days.map(day => dailyCounts.get(day)?.get(r) ?? 0);
  return { days, labels: topItems, series };
}

export function buildCalData(
  events: ActivityEvent[],
  mode: CalCategoryMode,
  getState: (e: ActivityEvent) => string | null,
): CalendarTreemapData {
  const { days, labels, series } = buildDailySeries(events, mode, getState);
  return { days, labels, series, hourly: buildHourly(events) };
}
