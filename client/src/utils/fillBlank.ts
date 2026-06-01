/**
 * Fill-in-the-blank question encoding.
 *
 * Stored without a schema change, reusing the existing columns:
 *  - `questionText`  : HTML with answer-free blank spans
 *                      `<span data-fitb data-blank="1"></span>` (safe to
 *                      send to students — never contains the answers).
 *  - `correctAnswer` : JSON `{"t":"fitb","blanks":["w1","w2"]}` — blank N
 *                      maps to blanks[N-1]. Instructor-only (the student
 *                      delivery never selects this column).
 *
 * The student's answer is stored in `QuizAnswer.answer` as JSON
 * `{"1":"word","2":"word"}` (blank index → typed word).
 *
 * Server grading mirrors this in quiz.service.ts — keep them in sync.
 */
import { Node, mergeAttributes } from '@tiptap/core';

export interface FillBlankData {
  blanks: string[];
}

const BLANK_SELECTOR = 'span[data-fitb]';

/* --------------------------- Tiptap blank node --------------------------- */

/**
 * Inline atom rendered as a chip. While editing it carries the answer in
 * `data-answer` so the instructor sees it; serialization strips it.
 * Numbering is purely CSS (counter on `.fitb-blank`).
 */
export const FitbBlank = Node.create({
  name: 'fitbBlank',
  inline: true,
  group: 'inline',
  atom: true,
  selectable: true,

  addAttributes() {
    return {
      answer: {
        default: '',
        parseHTML: (el: HTMLElement) =>
          el.getAttribute('data-answer') ?? el.textContent ?? '',
        renderHTML: (attrs: { answer: string }) => ({ 'data-answer': attrs.answer }),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'span[data-fitb]' }];
  },

  renderHTML({ HTMLAttributes, node }) {
    return [
      'span',
      mergeAttributes(HTMLAttributes, { 'data-fitb': '', class: 'fitb-blank' }),
      node.attrs.answer || ' ',
    ];
  },
});

/* ----------------------- editor HTML <-> storage ------------------------- */

const parseDoc = (html: string): Document =>
  new DOMParser().parseFromString(`<div id="__root">${html || ''}</div>`, 'text/html');

/**
 * From the live editor HTML, produce the answer-free template + the ordered
 * blank answers. Each blank span is replaced with an empty numbered marker.
 */
export const parseEditorHtml = (html: string): { template: string; blanks: string[] } => {
  const doc = parseDoc(html);
  const root = doc.getElementById('__root')!;
  const blanks: string[] = [];
  root.querySelectorAll(BLANK_SELECTOR).forEach((el) => {
    const answer = (el.getAttribute('data-answer') ?? el.textContent ?? '').trim();
    blanks.push(answer);
    const slot = doc.createElement('span');
    slot.setAttribute('data-fitb', '');
    slot.setAttribute('data-blank', String(blanks.length));
    slot.setAttribute('class', 'fitb-blank');
    el.replaceWith(slot);
  });
  return { template: root.innerHTML, blanks };
};

/** Rehydrate the editor HTML from a stored template + blank answers. */
export const buildEditorHtml = (template: string, blanks: string[]): string => {
  const doc = parseDoc(template);
  const root = doc.getElementById('__root')!;
  root.querySelectorAll(BLANK_SELECTOR).forEach((el, i) => {
    el.setAttribute('data-answer', blanks[i] ?? '');
    el.setAttribute('class', 'fitb-blank');
    el.textContent = blanks[i] ?? '';
  });
  return root.innerHTML;
};

/** Number of blanks in a stored/edited template. */
export const countBlanks = (html: string): number =>
  parseDoc(html).querySelectorAll(BLANK_SELECTOR).length;

/** True when a question is the new blanked fill-in-blank. */
export const isWordBankText = (questionText: string | undefined): boolean =>
  !!questionText && questionText.includes('data-fitb');

/* --------------------------- correctAnswer ------------------------------- */

export const encodeFillBlank = (blanks: string[]): string =>
  JSON.stringify({ t: 'fitb', blanks: blanks.map((b) => b.trim()).filter(Boolean) });

export const decodeFillBlank = (raw: string | null | undefined): FillBlankData | null => {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed.startsWith('{')) return null;
  try {
    const parsed = JSON.parse(trimmed);
    if (parsed && parsed.t === 'fitb' && Array.isArray(parsed.blanks)) {
      return { blanks: parsed.blanks.filter((s: unknown) => typeof s === 'string') };
    }
  } catch {
    /* not fill-blank JSON */
  }
  return null;
};

/* --------------------------- student answer ------------------------------ */

export const encodeBlankAnswers = (map: Record<number, string>): string =>
  JSON.stringify(map);

export const decodeBlankAnswers = (raw: string | null | undefined): Record<string, string> => {
  if (!raw) return {};
  const trimmed = raw.trim();
  if (!trimmed.startsWith('{')) return {};
  try {
    const parsed = JSON.parse(trimmed);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
};
