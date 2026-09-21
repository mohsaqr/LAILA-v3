/**
 * Structural guards over the locale files.
 *
 * Scope is chosen so this can pass today. The existing
 * `src/plugins/i18n.test.ts` checks key PARITY but only for `plugin*`/`lti_*`
 * keys, because the locales carry substantial pre-existing missing-key drift in
 * `teaching`, `courses` and `admin` that a blanket parity assertion would fail
 * on immediately. That drift is a backlog item, not something a test can fix.
 *
 * These checks are different: they are about keys that DO exist in a locale
 * being structurally sound. Both caught a real, live bug:
 *
 *  - Duplicate keys — all four `tutors.json` defined `ask_question` and `clear`
 *    twice. JSON.parse keeps the last, so in `en` and `es` the first (and
 *    differently-worded) value was silently unreachable.
 *  - Placeholder parity — `courses:score_summary` was translated from the KEY
 *    NAME rather than the value in fi/es/ar ("Score summary"), dropping
 *    `{{correct}}` and `{{total}}`, so every non-English student saw a heading
 *    where their score should have been.
 */

import { describe, it, expect } from 'vitest';

const LOCALES = ['en', 'fi', 'es', 'ar'] as const;

// Vite serves these from public/, so read them as raw text to see the bytes a
// browser would parse — duplicate keys are invisible after JSON.parse.
const files = import.meta.glob('../../public/locales/*/*.json', {
  eager: true,
  query: '?raw',
  import: 'default',
}) as Record<string, string>;

const pathOf = (locale: string, ns: string) =>
  Object.keys(files).find((p) => p.endsWith(`/locales/${locale}/${ns}.json`));

const namespaces = [
  ...new Set(
    Object.keys(files)
      .map((p) => /\/locales\/[^/]+\/([^/]+)\.json$/.exec(p)?.[1])
      .filter((n): n is string => Boolean(n)),
  ),
].sort();

/** Every leaf key, flattened to `a.b.c`. */
const flatten = (obj: unknown, prefix = ''): Record<string, string> => {
  const out: Record<string, string> = {};
  if (obj && typeof obj === 'object' && !Array.isArray(obj)) {
    for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
      const key = prefix ? `${prefix}.${k}` : k;
      if (v && typeof v === 'object' && !Array.isArray(v)) Object.assign(out, flatten(v, key));
      else out[key] = String(v);
    }
  }
  return out;
};

/**
 * Keys defined twice inside the SAME object.
 *
 * Walks the raw text tracking object nesting, skipping string contents so a
 * colon or brace inside a value cannot confuse it.
 */
const duplicateKeys = (raw: string): string[] => {
  const dups: string[] = [];
  const stack: Set<string>[] = [];
  let i = 0;
  while (i < raw.length) {
    const ch = raw[i];
    if (ch === '"') {
      let j = i + 1;
      let text = '';
      while (j < raw.length && raw[j] !== '"') {
        if (raw[j] === '\\') {
          text += raw[j + 1];
          j += 2;
          continue;
        }
        text += raw[j];
        j += 1;
      }
      let k = j + 1;
      while (k < raw.length && /\s/.test(raw[k])) k += 1;
      if (raw[k] === ':' && stack.length) {
        const here = stack[stack.length - 1];
        if (here.has(text)) dups.push(text);
        here.add(text);
      }
      i = j + 1;
      continue;
    }
    if (ch === '{') stack.push(new Set());
    else if (ch === '}') stack.pop();
    i += 1;
  }
  return dups;
};

/** i18next plural category suffixes. */
const PLURAL_SUFFIX = /_(zero|one|two|few|many|other)$/;

/** `{{name}}` placeholders, ignoring i18next formatting suffixes. */
const placeholders = (value: string): Set<string> =>
  new Set([...value.matchAll(/\{\{\s*([^},\s]+)[^}]*\}\}/g)].map((m) => m[1]));

describe('locale files', () => {
  it('finds all four languages for every namespace', () => {
    expect(namespaces.length).toBeGreaterThan(0);
    for (const ns of namespaces) {
      for (const locale of LOCALES) {
        expect(pathOf(locale, ns), `${locale}/${ns}.json is missing`).toBeTruthy();
      }
    }
  });

  it.each(LOCALES)('%s parses as valid JSON', (locale) => {
    for (const ns of namespaces) {
      const raw = files[pathOf(locale, ns)!];
      expect(() => JSON.parse(raw), `${locale}/${ns}.json`).not.toThrow();
    }
  });

  // JSON.parse silently keeps the last of a duplicated key, so the earlier
  // value becomes dead text that still looks live in the file. Neither
  // JSON.parse nor a reviver can report this — by the time either runs the
  // collision is gone — so the raw text has to be scanned.
  it.each(LOCALES)('%s defines each key exactly once per object', (locale) => {
    const offenders: string[] = [];
    for (const ns of namespaces) {
      for (const key of duplicateKeys(files[pathOf(locale, ns)!])) {
        offenders.push(`${locale}/${ns}.json: "${key}" defined more than once`);
      }
    }
    expect(offenders).toEqual([]);
  });

  // The scanner above is the thing being trusted, so prove it both fires and
  // does not over-fire. A naive "count every key in the file" version reported
  // notifications.json, where `title` and `preferences.title` are simply at
  // different depths.
  it('duplicate detection is scoped per object, not per file', () => {
    expect(duplicateKeys('{"a":1,"a":2}')).toEqual(['a']);
    expect(duplicateKeys('{"title":"x","nested":{"title":"y"}}')).toEqual([]);
    expect(duplicateKeys('{"a":"has \\"quote\\" and : colon","a":2}')).toEqual(['a']);
    expect(duplicateKeys('{"list":[{"k":1},{"k":2}]}')).toEqual([]);
  });

  // A translated value that drops an interpolation renders a sentence with the
  // data missing — silently, and only for that language.
  it.each(LOCALES.filter((l) => l !== 'en'))(
    '%s keeps every interpolation placeholder English uses',
    (locale) => {
      const mismatches: string[] = [];
      for (const ns of namespaces) {
        const en = flatten(JSON.parse(files[pathOf('en', ns)!]));
        const other = flatten(JSON.parse(files[pathOf(locale, ns)!]));
        for (const [key, enValue] of Object.entries(en)) {
          // Only keys this locale actually defines: missing keys fall back to
          // English and are the separate, pre-existing drift problem.
          if (!(key in other)) continue;
          // A plural CATEGORY form may legitimately omit the number: Arabic
          // "ردّ واحد" (one reply) carries no numeral, and neither does English
          // "one reply". Parity on those would demand a mistranslation.
          if (PLURAL_SUFFIX.test(key)) continue;
          const want = placeholders(enValue);
          if (want.size === 0) continue;
          const got = placeholders(other[key]);
          const lost = [...want].filter((ph) => !got.has(ph));
          // `{{plural}}` is an English-only pluralisation hack the other
          // languages correctly restructure away.
          const real = lost.filter((ph) => ph !== 'plural');
          if (real.length) {
            mismatches.push(`${locale}/${ns}.json "${key}" drops {{${real.join('}}, {{')}}}`);
          }
        }
      }
      expect(mismatches).toEqual([]);
    },
  );
});
