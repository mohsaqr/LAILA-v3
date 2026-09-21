/**
 * Reading the `fileUrls` column of an assignment submission.
 *
 * The column stores a JSON array of URL strings. Three call sites used to parse
 * it inline with `catch { return [] }`, which made a submission whose JSON is
 * unreadable look exactly like a submission with no attachments. That is not a
 * cosmetic confusion:
 *
 *  - The instructor's grading page showed "no files" and they graded accordingly.
 *  - The student's form showed no attachment, and because the form then posted
 *    `fileUrls: []` on the next save, the server — where `[]` is truthy and so
 *    takes the `JSON.stringify` branch rather than Prisma's leave-alone
 *    `undefined` — wrote `"[]"` over the real URLs. A display-only parse failure
 *    escalated into permanent loss of the submitted file when the student
 *    pressed Save.
 *
 * So the result is deliberately a discriminated union: callers must decide what
 * to do about `ok: false` rather than receiving an empty array that lies. The
 * corrupt case is recoverable — the original text is handed back in `raw` so a
 * human can see what is actually stored.
 *
 * Strictness note: a well-formed array containing a non-string entry is treated
 * as corrupt rather than silently filtered. Everything that writes this column
 * writes `string[]`, so a number or null in there means something already went
 * wrong, and quietly dropping the bad entry would hide a partially-lost list.
 */

export type FileUrlsResult =
  | { ok: true; urls: string[] }
  | { ok: false; raw: string };

export function parseFileUrls(raw: string | null | undefined): FileUrlsResult {
  // Absent or empty genuinely means "no attachments" — not a fault.
  if (raw === null || raw === undefined || raw.trim() === '') {
    return { ok: true, urls: [] };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ok: false, raw };
  }

  if (!Array.isArray(parsed)) return { ok: false, raw };
  if (!parsed.every((v): v is string => typeof v === 'string')) return { ok: false, raw };

  return { ok: true, urls: parsed };
}
