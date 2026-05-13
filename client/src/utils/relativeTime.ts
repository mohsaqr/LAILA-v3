/**
 * Format an ISO timestamp as a short, social-style relative string.
 * "just now" / "5m ago" / "2h ago" / "5d ago" / "3w ago". Falls back
 * to a full localized date for timestamps older than ~30 days.
 *
 * Kept locale-agnostic for now (English suffixes) because the forum UI
 * doesn't translate this label yet. If we localize later, switch to
 * Intl.RelativeTimeFormat.
 */
export const formatRelative = (iso: string | null | undefined): string => {
  if (!iso) return '';
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const diffMs = Date.now() - then;
  const sec = Math.floor(diffMs / 1000);
  if (sec < 45) return 'just now';
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}d ago`;
  const week = Math.floor(day / 7);
  if (week < 5) return `${week}w ago`;
  return new Date(iso).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
};
