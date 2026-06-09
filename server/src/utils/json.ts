/**
 * Shared defensive JSON helpers.
 *
 * Stored "array" columns (survey question options, multiple-choice answer
 * values, etc.) are normally written via JSON.stringify, but legacy rows,
 * hand-edited data, or a value whose type changed after it was persisted can
 * hold a bare string. A single such row must never throw and 500 a whole
 * endpoint, so decode defensively.
 */

/**
 * Decode a stored value into a string array without ever throwing.
 *
 * - A JSON array string (`["A","B"]`) is parsed and returned as-is.
 * - A non-empty bare string (`"A"`) is wrapped as `["A"]`.
 * - Empty / null / undefined yields `[]`.
 */
export const safeJsonArray = (raw: string | null | undefined): string[] => {
  const trimmed = (raw ?? '').trim();
  if (trimmed.startsWith('[')) {
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) return parsed as string[];
    } catch {
      // fall through to the raw-string fallback
    }
  }
  return trimmed ? [trimmed] : [];
};
