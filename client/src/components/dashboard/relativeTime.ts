/**
 * Compact relative-time formatter — "3h ago", "2d ago", "just now".
 * Used by every dashboard timeline / list row.
 */
export const relativeTime = (iso: string | Date | null | undefined): string => {
  if (!iso) return '';
  const d = typeof iso === 'string' ? new Date(iso) : iso;
  const seconds = Math.round((Date.now() - d.getTime()) / 1000);
  if (seconds < 30) return 'just now';
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d ago`;
  const weeks = Math.round(days / 7);
  if (weeks < 5) return `${weeks}w ago`;
  const months = Math.round(days / 30);
  if (months < 12) return `${months}mo ago`;
  const years = Math.round(days / 365);
  return `${years}y ago`;
};
