/**
 * Multi-correct multiple-choice answers are stored in the existing
 * scalar `correctAnswer` string column as a JSON-encoded array of
 * option strings (e.g. `["Option A","Option C"]`). Legacy rows just
 * hold the raw option string. These helpers normalize both shapes.
 *
 * Same logic exists server-side in quiz.service.ts. Keep them in sync.
 */

/** Decode a stored multi-choice correctAnswer to an array of option strings. */
export const decodeCorrectAnswers = (raw: string | null | undefined): string[] => {
  if (raw == null) return [];
  const trimmed = raw.trim();
  if (!trimmed) return [];
  if (trimmed.startsWith('[')) {
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return parsed.filter(s => typeof s === 'string' && s.length > 0);
      }
    } catch {
      /* fall through to legacy path */
    }
  }
  return [trimmed];
};

/** Encode an array of option strings to a stored correctAnswer value. */
export const encodeCorrectAnswers = (answers: string[]): string =>
  JSON.stringify(answers.filter(Boolean));
