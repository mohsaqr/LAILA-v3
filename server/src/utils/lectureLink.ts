/**
 * Detect "link-only" lectures — a lecture page whose entire content is one
 * external link and nothing else.
 *
 * Roughly a third of a real course can be built this way: a page per slide
 * deck, per tutorial, per tool. Every one of them costs a student a click on a
 * page that shows them a single link and then (because these are authored with
 * `data-newtab="true"`) opens it in a *new* tab, leaving the wrapper behind in
 * the old one. Detecting the shape lets the curriculum link straight to the
 * destination.
 *
 * The shape is the signal: nothing is stored to say "this is a link page", and
 * asking authors to declare it would mean editing every existing one. A lecture
 * qualifies only when it is unambiguous — exactly one section, holding exactly
 * one `<lecture-url>` node, with no prose around it. Anything else is a real
 * page and keeps its wrapper.
 */

/** Sections as selected for the curriculum payload. */
export interface LinkSection {
  type?: string | null;
  content?: string | null;
}

export interface DirectLink {
  url: string;
  /** Honours the author's `data-newtab` choice rather than imposing one. */
  newTab: boolean;
}

/**
 * Decode the HTML entities that can appear inside an attribute value.
 *
 * This is not optional politeness. The editor writes attributes through
 * `escapeAttr`, so a perfectly ordinary Google Docs URL is stored as
 * `...edit?pli=1&amp;tab=t.0`. Handing that to an `href` verbatim yields a
 * broken link, and the breakage is invisible in the markup. The browser-side
 * parser (`parseMarker`) gets this for free from `DOMParser`; Node does not.
 */
const decodeEntities = (value: string): string =>
  value.replace(/&(#x[0-9a-fA-F]+|#\d+|[a-zA-Z]+);/g, (match, entity: string) => {
    if (entity.startsWith('#x') || entity.startsWith('#X')) {
      const code = parseInt(entity.slice(2), 16);
      return Number.isFinite(code) ? String.fromCodePoint(code) : match;
    }
    if (entity.startsWith('#')) {
      const code = parseInt(entity.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : match;
    }
    const named: Record<string, string> = {
      amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ',
    };
    return named[entity.toLowerCase()] ?? match;
  });

/** Read one attribute off a marker tag's attribute blob, single or double quoted. */
const attr = (attrs: string, name: string): string | null => {
  const match = attrs.match(new RegExp(`\\b${name}\\s*=\\s*("([^"]*)"|'([^']*)')`, 'i'));
  if (!match) return null;
  return decodeEntities(match[2] ?? match[3] ?? '');
};

/**
 * Only `http(s)` may become an `href`.
 *
 * The URL is author-supplied, and an author is not necessarily trusted the way
 * the platform is: a `javascript:` URL rendered into an anchor executes in the
 * student's session on click. Today that string is only ever displayed on a
 * page; promoting it to a real link in the curriculum list is what makes the
 * scheme check load-bearing. Anything that is not http/https falls back to the
 * ordinary lecture page, where it is inert.
 */
const isSafeHttpUrl = (raw: string): boolean => {
  try {
    const protocol = new URL(raw).protocol.toLowerCase();
    return protocol === 'http:' || protocol === 'https:';
  } catch {
    return false;
  }
};

/**
 * The direct link for a link-only lecture, or null if the lecture is a real
 * page. Null is always the safe answer: it simply means "keep today's
 * behaviour".
 */
export const extractDirectLink = (sections?: LinkSection[] | null): DirectLink | null => {
  // Exactly one section. A lecture with a link *and* something else is a page.
  if (!sections || sections.length !== 1) return null;

  const section = sections[0];
  if (section.type === 'file') return null;

  // Empty paragraphs are editor residue, not content — Tiptap leaves them
  // behind when an author deletes surrounding text. Ignoring them is the
  // difference between catching these lectures and catching almost none.
  const body = (section.content ?? '')
    .replace(/<p>(\s|&nbsp;|<br\s*\/?>)*<\/p>/gi, '')
    .trim();

  // One marker tag, nothing before or after it. Both the paired and
  // self-closing serialisations are accepted.
  const lone = body.match(/^<lecture-url\b([^>]*?)\s*(?:\/>|><\/lecture-url>)$/i);
  if (!lone) return null;

  const attrs = lone[1] ?? '';
  const url = (attr(attrs, 'data-url') ?? '').trim();
  if (!url || !isSafeHttpUrl(url)) return null;

  return { url, newTab: (attr(attrs, 'data-newtab') ?? '').toLowerCase() === 'true' };
};
