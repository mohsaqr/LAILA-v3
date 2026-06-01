/**
 * Pull `#hashtag` tokens out of a rich-text body for display as chip
 * pills below the discussion content. Strips HTML first so anchors
 * like `<a href="#anchor">` don't get falsely picked up.
 *
 * Returns each unique tag without the leading `#`, in the order they
 * first appear in the body.
 */
export const extractHashtags = (html: string | null | undefined): string[] => {
  if (!html) return [];
  const text = html.replace(/<[^>]*>/g, ' ');
  const matches = text.matchAll(/#([\p{L}\p{N}_-]+)/gu);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const m of matches) {
    const tag = m[1];
    const lower = tag.toLowerCase();
    if (seen.has(lower)) continue;
    seen.add(lower);
    out.push(tag);
  }
  return out;
};

/**
 * Remove `#tag` tokens from the body so chips are not duplicated by
 * the same words appearing inline. Tokens inside HTML attributes
 * (e.g. `href="#anchor"`) are preserved by skipping anything between
 * `<` and `>` while substituting in the text segments.
 */
export const stripHashtags = (html: string | null | undefined): string => {
  if (!html) return '';
  const TAG_RE = /<[^>]*>/g;
  const HASH_RE = /\s?#[\p{L}\p{N}_-]+/gu;
  let out = '';
  let last = 0;
  for (const m of html.matchAll(TAG_RE)) {
    const start = m.index ?? 0;
    out += html.slice(last, start).replace(HASH_RE, '');
    out += m[0];
    last = start + m[0].length;
  }
  out += html.slice(last).replace(HASH_RE, '');
  return out.replace(/\s{2,}/g, ' ').trim();
};
