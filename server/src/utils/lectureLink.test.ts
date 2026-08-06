import { describe, it, expect } from 'vitest';
import { extractDirectLink } from './lectureLink.js';

/**
 * The two strings below are copied verbatim out of production
 * (`lecture_sections.content` for lectures 83 and 90). Invented fixtures would
 * have hidden the `&amp;` that the editor's `escapeAttr` writes into every URL
 * carrying a query string.
 */
const REAL_SCHEDULE =
  '<lecture-url data-url="https://docs.google.com/document/d/1cgjQM-2qRNWmMAE08b1kidEYx771WJPOf962ZBi1FvQ/edit?pli=1&amp;tab=t.0#heading=h.mx9er8knpwe" data-title="Schedule" data-newtab="true"></lecture-url>';

const REAL_DISCORD =
  '<lecture-url data-url="https://discord.gg/m58Vuvh2b" data-title="Join the Discord" data-newtab="true"></lecture-url>';

const section = (content: string, type = 'text') => [{ type, content }];

describe('extractDirectLink', () => {
  describe('real production content', () => {
    it('extracts the Schedule link and decodes the &amp; in its query string', () => {
      const link = extractDirectLink(section(REAL_SCHEDULE));
      // The whole point: a raw &amp; here yields a broken Google Docs URL.
      expect(link?.url).toBe(
        'https://docs.google.com/document/d/1cgjQM-2qRNWmMAE08b1kidEYx771WJPOf962ZBi1FvQ/edit?pli=1&tab=t.0#heading=h.mx9er8knpwe',
      );
      expect(link?.url).not.toContain('&amp;');
      expect(link?.newTab).toBe(true);
    });

    it('extracts the Discord link', () => {
      expect(extractDirectLink(section(REAL_DISCORD))).toEqual({
        url: 'https://discord.gg/m58Vuvh2b',
        newTab: true,
      });
    });
  });

  describe('what counts as link-only', () => {
    it('ignores the empty paragraphs Tiptap leaves behind', () => {
      const link = extractDirectLink(section(`<p></p>${REAL_DISCORD}<p>  </p>`));
      expect(link?.url).toBe('https://discord.gg/m58Vuvh2b');
    });

    it('accepts the self-closing serialisation', () => {
      const link = extractDirectLink(section('<lecture-url data-url="https://example.com" />'));
      expect(link?.url).toBe('https://example.com');
    });

    it('reads single-quoted attributes', () => {
      const link = extractDirectLink(section("<lecture-url data-url='https://example.com'></lecture-url>"));
      expect(link?.url).toBe('https://example.com');
    });

    it('honours data-newtab="false" instead of imposing a new tab', () => {
      const link = extractDirectLink(
        section('<lecture-url data-url="https://example.com" data-newtab="false"></lecture-url>'),
      );
      expect(link?.newTab).toBe(false);
    });

    it('treats a missing data-newtab as same-tab', () => {
      const link = extractDirectLink(section('<lecture-url data-url="https://example.com"></lecture-url>'));
      expect(link?.newTab).toBe(false);
    });
  });

  describe('what stays a real page', () => {
    it('refuses a lecture with prose alongside the link', () => {
      expect(extractDirectLink(section(`<p>Read this first.</p>${REAL_DISCORD}`))).toBeNull();
    });

    it('refuses a lecture with text after the link', () => {
      expect(extractDirectLink(section(`${REAL_DISCORD}<p>Then come back.</p>`))).toBeNull();
    });

    it('refuses a lecture with two links', () => {
      expect(extractDirectLink(section(`${REAL_DISCORD}${REAL_SCHEDULE}`))).toBeNull();
    });

    it('refuses a lecture with more than one section', () => {
      expect(extractDirectLink([{ type: 'text', content: REAL_DISCORD }, { type: 'text', content: '<p>Notes</p>' }]))
        .toBeNull();
    });

    it('refuses a file section', () => {
      expect(extractDirectLink([{ type: 'file', content: REAL_DISCORD }])).toBeNull();
    });

    it('refuses an empty, null or missing section list', () => {
      expect(extractDirectLink([])).toBeNull();
      expect(extractDirectLink(null)).toBeNull();
      expect(extractDirectLink(undefined)).toBeNull();
    });

    it('refuses a different marker node', () => {
      expect(extractDirectLink(section('<lecture-embed data-url="https://example.com"></lecture-embed>'))).toBeNull();
    });

    it('refuses a marker with no data-url', () => {
      expect(extractDirectLink(section('<lecture-url data-title="Nowhere"></lecture-url>'))).toBeNull();
    });

    it('refuses an empty data-url', () => {
      expect(extractDirectLink(section('<lecture-url data-url="   "></lecture-url>'))).toBeNull();
    });
  });

  describe('scheme safety', () => {
    // An author controls this string. Rendering it as an href is what makes
    // the check matter — on the lecture page it was only ever displayed.
    it.each([
      ['javascript:alert(document.cookie)'],
      ['JavaScript:alert(1)'],
      ['  javascript:alert(1)'],
      // Deliberately base64 rather than raw markup: a payload containing '>'
      // is rejected by the attribute regex before the scheme check runs, so it
      // would pass this test without proving the allowlist works at all.
      ['data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg=='],
      ['vbscript:msgbox(1)'],
      ['file:///etc/passwd'],
      ['/relative/path'],
      ['not a url at all'],
    ])('refuses %s', raw => {
      const escaped = raw.replace(/"/g, '&quot;');
      expect(extractDirectLink(section(`<lecture-url data-url="${escaped}"></lecture-url>`))).toBeNull();
    });

    it('refuses a javascript: URL smuggled in as entities', () => {
      // &#106; is 'j' — decoding happens before the scheme check, so an
      // entity-encoded scheme must not slip past it.
      const smuggled = '&#106;avascript:alert(1)';
      expect(extractDirectLink(section(`<lecture-url data-url="${smuggled}"></lecture-url>`))).toBeNull();
    });

    it('allows http as well as https', () => {
      expect(extractDirectLink(section('<lecture-url data-url="http://example.com"></lecture-url>'))?.url)
        .toBe('http://example.com');
    });
  });
});
