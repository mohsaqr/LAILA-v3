/**
 * Reading a usable message out of a rejected API call.
 *
 * `api/client.ts`'s response interceptor deliberately does NOT re-throw the
 * AxiosError. It rejects with a plain `Error` carrying `message` and — for a
 * 422 — a `details` array of `{ field, message }` straight from Zod:
 *
 *   const err = new Error(message) as Error & { details?: ... };
 *   if (data.details) err.details = data.details;
 *
 * So any handler reaching for `err.response?.data?.error` always reads
 * `undefined` and falls through to its own generic fallback. That is how the
 * server's precise "knowledgeContext: String must contain at most 2000
 * character(s)" arrives at the student as "Failed to save agent."
 *
 * Use this instead of `err.response?.data?.error` in any `onError`.
 */

export interface ApiErrorDetail {
  field: string;
  message: string;
}

/**
 * `knowledgeContext` -> `Knowledge context`.
 *
 * Zod reports the schema key, which is an internal camelCase name. Showing it
 * raw is still better than hiding the error, but a student needs to be able to
 * map it to a labelled field on screen.
 */
export const humanizeField = (field: string): string => {
  const words = field
    .split('.')
    .pop()!
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
  if (!words) return '';
  return words.charAt(0).toUpperCase() + words.slice(1);
};

/**
 * The most specific message available, in order: the first field-level
 * validation detail, then the error's own message, then `fallback`.
 */
export const apiErrorMessage = (err: unknown, fallback: string): string => {
  const e = err as { details?: unknown; message?: unknown } | null | undefined;

  const details = Array.isArray(e?.details) ? (e.details as ApiErrorDetail[]) : [];
  const first = details.find((d) => d && typeof d.message === 'string' && d.message);
  if (first) {
    const label = typeof first.field === 'string' ? humanizeField(first.field) : '';
    return label ? `${label}: ${first.message}` : first.message;
  }

  return typeof e?.message === 'string' && e.message ? e.message : fallback;
};
