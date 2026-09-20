/**
 * Locale coverage for the plugin UI.
 *
 * CLAUDE.md requires a new key in **all four** language files. This test makes
 * that mechanical rather than remembered.
 *
 * Scoped to `plugin*` keys on purpose. The locale files carry a substantial
 * amount of pre-existing drift in unrelated namespaces (quiz-practice and MCQ
 * settings keys that exist in some languages and not others), so a blanket
 * parity assertion would fail on day one for reasons nobody here introduced —
 * and a test that is red by default guards nothing. This one is green now and
 * fails the moment a plugin string is added to English alone.
 */

import { describe, it, expect } from 'vitest';

const LANGS = ['en', 'fi', 'es', 'ar'] as const;
const NAMESPACES = ['admin', 'common', 'courses'] as const;

/**
 * Loaded with Vite's glob rather than `fs`: the client has no `@types/node`,
 * and adding one so a test can read a file would put Node's globals in scope
 * for every browser module in the project.
 */
const LOCALE_FILES = import.meta.glob('../../public/locales/*/*.json', {
  eager: true,
}) as Record<string, { default: Record<string, string> }>;

const load = (lang: string, ns: string): Record<string, string> => {
  const entry = Object.entries(LOCALE_FILES).find(([p]) => p.endsWith(`/${lang}/${ns}.json`));
  if (!entry) throw new Error(`Locale file not found: ${lang}/${ns}.json`);
  return entry[1].default;
};

const pluginKeysOf = (dict: Record<string, string>): string[] =>
  Object.keys(dict).filter((k) => k.startsWith('plugin'));

describe('plugin locale coverage', () => {
  it.each(NAMESPACES)('every plugin key in %s exists in all four languages', (ns) => {
    const en = load('en', ns);
    const keys = pluginKeysOf(en);
    expect(keys.length, `expected some plugin keys in ${ns}`).toBeGreaterThan(0);

    for (const lang of LANGS) {
      const dict = load(lang, ns);
      const missing = keys.filter((k) => !(k in dict));
      expect(missing, `${lang}/${ns}.json is missing plugin keys`).toEqual([]);
    }
  });

  // An English string copied into fi/es/ar is a missing translation wearing a
  // disguise: it satisfies a presence check while showing English to the user.
  it.each(NAMESPACES)('plugin keys in %s are actually translated', (ns) => {
    const en = load('en', ns);
    const keys = pluginKeysOf(en);
    for (const lang of LANGS.filter((l) => l !== 'en')) {
      const dict = load(lang, ns);
      const untranslated = keys.filter((k) => dict[k] === en[k]);
      expect(untranslated, `${lang}/${ns}.json still holds the English text`).toEqual([]);
    }
  });

  it('keeps interpolation placeholders identical across languages', () => {
    const placeholders = (s: string) => (s.match(/\{\{\w+\}\}/g) ?? []).sort();
    for (const ns of NAMESPACES) {
      const en = load('en', ns);
      for (const key of pluginKeysOf(en)) {
        const expected = placeholders(en[key]);
        if (!expected.length) continue;
        for (const lang of LANGS.filter((l) => l !== 'en')) {
          // A dropped {{name}} renders a sentence with a hole in it.
          expect(placeholders(load(lang, ns)[key]), `${lang}/${ns}.json:${key}`).toEqual(expected);
        }
      }
    }
  });

  it('parses every locale file as an object of strings', () => {
    for (const lang of LANGS) {
      for (const ns of NAMESPACES) {
        const dict = load(lang, ns);
        expect(typeof dict).toBe('object');
        const nonString = Object.entries(dict).filter(([, v]) => typeof v !== 'string');
        expect(nonString, `${lang}/${ns}.json has non-string values`).toEqual([]);
      }
    }
  });
});
