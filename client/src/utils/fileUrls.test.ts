import { describe, it, expect } from 'vitest';
import { parseFileUrls } from './fileUrls';

describe('parseFileUrls', () => {
  it('treats absent and empty as "no attachments", not as a fault', () => {
    for (const raw of [null, undefined, '', '   ']) {
      const r = parseFileUrls(raw);
      expect(r.ok).toBe(true);
      expect(r.ok && r.urls).toEqual([]);
    }
  });

  it('reads a well-formed list', () => {
    const r = parseFileUrls('["/uploads/a.pdf","/uploads/b.png"]');
    expect(r).toEqual({ ok: true, urls: ['/uploads/a.pdf', '/uploads/b.png'] });
  });

  it('reads an explicitly empty list', () => {
    expect(parseFileUrls('[]')).toEqual({ ok: true, urls: [] });
  });

  // The distinction the whole module exists for.
  it('reports truncated JSON as unreadable rather than empty', () => {
    const raw = '["/uploads/a.pd';
    const r = parseFileUrls(raw);
    expect(r.ok).toBe(false);
    expect(r.ok === false && r.raw).toBe(raw);
  });

  it('reports a non-array as unreadable', () => {
    for (const raw of ['{"a":1}', '"just a string"', '42', 'null']) {
      expect(parseFileUrls(raw).ok).toBe(false);
    }
  });

  it('reports a list with a non-string entry as unreadable, rather than dropping it', () => {
    // Silently filtering would present a partially-lost list as complete.
    const r = parseFileUrls('["/uploads/a.pdf", 42]');
    expect(r.ok).toBe(false);
  });

  it('never returns an empty list for input that is not genuinely empty', () => {
    // The invariant that stops "unreadable" from being mistaken for "none".
    const notEmpty = ['["/a"]', 'garbage', '{"a":1}', '["/a", null]'];
    for (const raw of notEmpty) {
      const r = parseFileUrls(raw);
      expect(r.ok && r.urls.length === 0).toBe(false);
    }
  });
});
