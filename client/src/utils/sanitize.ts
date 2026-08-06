import DOMPurify from 'dompurify';

/**
 * CSS properties an author may set through the rich text editor.
 *
 * `style` has to be allowed at all because Tiptap expresses formatting as
 * inline CSS — text alignment and colour have no other representation. It was
 * previously stripped wholesale, which silently discarded the alignment the
 * toolbar had been offering all along: the editor showed centred text, the
 * saved-and-rendered version was left-aligned, and nothing reported a problem.
 *
 * Allow-list rather than deny-list, because the danger in CSS is not one known
 * set of properties. `position`/`z-index` allow an invisible overlay on top of
 * unrelated UI (clickjacking), `content` can inject text, and anything
 * accepting `url()` is a request to an arbitrary host. Only what the toolbar
 * can actually produce is listed here.
 */
const ALLOWED_CSS_PROPS = new Set([
  'color',
  'background-color',
  'text-align',
  'width',
  'height',
  'max-width',
  'float',
  'margin',
  'margin-left',
  'margin-right',
  'font-weight',
  'font-style',
  'text-decoration',
  'vertical-align',
  // Needed to centre an image: an <img> is inline, so auto margins do nothing
  // until it is a block. `display: none` is the only abuse here and it only
  // hides the author's own content.
  'display',
]);

/** Values carrying a fetch, a script, or an escape from the value grammar. */
const DANGEROUS_CSS_VALUE = /url\s*\(|expression\s*\(|javascript:|@import|[<>{};]/i;

let hookInstalled = false;

/**
 * Filter every surviving `style` attribute down to ALLOWED_CSS_PROPS.
 *
 * DOMPurify does drop the classic script-in-CSS vectors on its own, but it
 * keeps layout properties, so allowing `style` unfiltered would let any forum
 * post position itself over the page. This runs after DOMPurify's own pass and
 * rebuilds the attribute from scratch.
 */
const installStyleFilter = (): void => {
  if (hookInstalled) return;
  hookInstalled = true;

  DOMPurify.addHook('afterSanitizeAttributes', (node) => {
    const el = node as Element;
    if (!el.getAttribute || !el.hasAttribute?.('style')) return;

    const declarations = (el.getAttribute('style') || '')
      .split(';')
      .map(part => part.trim())
      .filter(Boolean)
      .map(part => {
        const idx = part.indexOf(':');
        if (idx === -1) return null;
        const prop = part.slice(0, idx).trim().toLowerCase();
        const value = part.slice(idx + 1).trim();
        if (!ALLOWED_CSS_PROPS.has(prop)) return null;
        if (!value || DANGEROUS_CSS_VALUE.test(value)) return null;
        return `${prop}: ${value}`;
      })
      .filter((d): d is string => d !== null);

    if (declarations.length > 0) el.setAttribute('style', `${declarations.join('; ')};`);
    else el.removeAttribute('style');
  });
};

/**
 * Sanitize HTML content to prevent XSS attacks.
 * Uses DOMPurify with a safe default configuration.
 */
export const sanitizeHtml = (dirty: string): string => {
  installStyleFilter();
  return DOMPurify.sanitize(dirty, {
    ALLOWED_TAGS: [
      'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
      'p', 'br', 'hr',
      'ul', 'ol', 'li',
      'strong', 'b', 'em', 'i', 'u', 's', 'strike',
      'a', 'img',
      'pre', 'code',
      'blockquote',
      'table', 'thead', 'tbody', 'tr', 'th', 'td', 'colgroup', 'col', 'caption',
      'div', 'span',
    ],
    ALLOWED_ATTR: [
      'href', 'src', 'alt', 'title', 'class', 'id',
      'target', 'rel', 'width', 'height',
      // Presentational formatting the editor produces. `style` is filtered
      // down to ALLOWED_CSS_PROPS by the hook above; the rest are table
      // structure, which is meaningless to strip once tables are allowed.
      'style', 'colspan', 'rowspan', 'colwidth', 'align',
    ],
    ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i,
    ALLOW_DATA_ATTR: false,
    ADD_ATTR: ['target'],
    FORBID_TAGS: ['script', 'style', 'iframe', 'form', 'input', 'object', 'embed'],
    FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover', 'onfocus', 'onblur'],
  });
};

/**
 * Detect whether a string is HTML content (from RichTextEditor / Tiptap).
 * Matches known block-level tags that Tiptap wraps output in.
 * Returns false for plain text that happens to start with '<' (e.g. code snippets).
 */
export const isHtmlContent = (text: string | null | undefined): boolean => {
  if (!text) return false;
  return /^<(p|h[1-6]|ul|ol|div|blockquote|pre|table)[\s>]/i.test(text.trim());
};

/**
 * Reduce rich-text HTML to a single line of plain text.
 *
 * Descriptions are authored in Tiptap and stored as HTML, but a card subtitle
 * is a one-line summary in a clamped `<span>` — rendering the raw string there
 * shows the student `<p><strong>You have two files...`, and rendering it as
 * HTML would inject block elements into a text run.
 *
 * Parsing rather than regex-stripping, so `&amp;` comes back as `&` and a
 * stray `<` in prose cannot eat the rest of the sentence. `parseFromString`
 * builds an inert document: no script runs, no resource is fetched.
 */
export const toPlainText = (html: string | null | undefined): string => {
  if (!html) return '';
  // Block boundaries carry no whitespace of their own, so "<p>a</p><p>b</p>"
  // would otherwise collapse to "ab".
  const spaced = html
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<\/(p|div|h[1-6]|li|tr|blockquote|pre)>/gi, ' ');
  const doc = new DOMParser().parseFromString(spaced, 'text/html');
  return (doc.body.textContent || '').replace(/\s+/g, ' ').trim();
};

/**
 * Sanitize HTML and return props for dangerouslySetInnerHTML.
 * This is a convenience wrapper for React components.
 */
export const createSanitizedMarkup = (dirty: string): { __html: string } => {
  return { __html: sanitizeHtml(dirty) };
};
