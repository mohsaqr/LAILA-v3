/**
 * Editor theme presets for lab code cells.
 *
 * Monaco paints its own surface from its own theme system — no Tailwind class
 * or `index.css` rule reaches inside `.monaco-editor` — so a theme definition
 * is the only supported way to colour the editor.
 *
 * Themes are **global per monaco instance**, not per editor, so all of these
 * are defined once and switched between with `setTheme`. Every cell changes at
 * once, which is what you want from a single picker.
 *
 * Palettes are the published ones for each named theme rather than invented
 * colours, so "Solarized" looks like Solarized to anyone who already knows it.
 */

export interface LabThemeDef {
  base: 'vs' | 'vs-dark';
  inherit: boolean;
  rules: { token: string; foreground?: string; fontStyle?: string }[];
  colors: Record<string, string>;
}

export interface LabTheme {
  id: string;
  label: string;
  appearance: 'light' | 'dark';
  def: LabThemeDef;
}

/** Scopes Monaco's R tokenizer actually emits — checked against basic-languages/r. */
const rules = (p: {
  comment: string;
  keyword: string;
  string: string;
  number: string;
  constant: string;
  operator: string;
  identifier: string;
}) => [
  { token: 'comment', foreground: p.comment, fontStyle: 'italic' },
  { token: 'comment.doc', foreground: p.comment, fontStyle: 'italic' },
  { token: 'keyword', foreground: p.keyword },
  { token: 'string', foreground: p.string },
  { token: 'string.escape', foreground: p.string },
  { token: 'number', foreground: p.number },
  { token: 'number.hex', foreground: p.number },
  { token: 'constant', foreground: p.constant },
  { token: 'operator', foreground: p.operator },
  { token: 'delimiter', foreground: p.operator },
  { token: 'identifier', foreground: p.identifier },
];

const surface = (p: {
  bg: string;
  line: string;
  gutter: string;
  gutterActive: string;
  selection: string;
  cursor: string;
}) => ({
  'editor.background': p.bg,
  'editorGutter.background': p.bg,
  'editor.lineHighlightBackground': p.line,
  'editorLineNumber.foreground': p.gutter,
  'editorLineNumber.activeForeground': p.gutterActive,
  'editor.selectionBackground': p.selection,
  'editorCursor.foreground': p.cursor,
});

export const LAB_THEMES: LabTheme[] = [
  {
    id: 'laila-light',
    label: 'Laila Light',
    appearance: 'light',
    def: {
      base: 'vs',
      inherit: true,
      // The darkest of the light surfaces. A light theme still means dark text
      // on a light ground — this is as deep as it can go before the syntax
      // colours stop separating from it.
      colors: surface({
        bg: '#c2c9d4',
        line: '#b3bbc8',
        gutter: '#6b7684',
        gutterActive: '#1f2937',
        selection: '#9fb8d4',
        cursor: '#111827',
      }),
      rules: rules({
        comment: '5a6674',
        keyword: '08417f',
        string: '065f2f',
        number: '7a3800',
        constant: '6b21a8',
        operator: '3f4854',
        identifier: '111827',
      }),
    },
  },
  {
    id: 'laila-grey',
    label: 'Light Grey',
    appearance: 'light',
    def: {
      base: 'vs',
      inherit: true,
      colors: surface({
        bg: '#d7dce4',
        line: '#c7cdd8',
        gutter: '#78828f',
        gutterActive: '#1f2937',
        selection: '#b3cbe6',
        cursor: '#1f2937',
      }),
      rules: rules({
        comment: '626d7b',
        keyword: '0b5cad',
        string: '0a7a3d',
        number: '8f4200',
        constant: '7e22ce',
        operator: '4b5563',
        identifier: '1f2937',
      }),
    },
  },
  {
    id: 'solarized-light',
    label: 'Solarized Light',
    appearance: 'light',
    def: {
      base: 'vs',
      inherit: true,
      // Solarized's own base2 (#eee8d5), not base3 (#fdf6e3). Both are real
      // Solarized backgrounds; base3 is the near-white one, which is out.
      colors: surface({
        bg: '#eee8d5',
        line: '#e2dcc8',
        gutter: '#93a1a1',
        gutterActive: '#586e75',
        selection: '#d8d2bf',
        cursor: '#657b83',
      }),
      rules: rules({
        comment: '93a1a1',
        keyword: '859900',
        string: '2aa198',
        number: 'd33682',
        constant: 'cb4b16',
        operator: '657b83',
        identifier: '586e75',
      }),
    },
  },
  {
    id: 'laila-midnight',
    label: 'Laila Midnight',
    appearance: 'dark',
    def: {
      base: 'vs-dark',
      inherit: true,
      // gray-950, matching markdown code fences (.prose pre in index.css).
      // Built-in vs-dark's #1e1e1e is lighter than both the console below
      // (gray-900) and the fences, which made the editor the palest of three.
      colors: surface({
        bg: '#030712',
        line: '#111827',
        gutter: '#6b7280',
        gutterActive: '#d1d5db',
        selection: '#1f3a5f',
        cursor: '#e5e7eb',
      }),
      rules: [],
    },
  },
  {
    id: 'dracula',
    label: 'Dracula',
    appearance: 'dark',
    def: {
      base: 'vs-dark',
      inherit: true,
      colors: surface({
        bg: '#282a36',
        line: '#343746',
        gutter: '#6272a4',
        gutterActive: '#f8f8f2',
        selection: '#44475a',
        cursor: '#f8f8f2',
      }),
      rules: rules({
        comment: '6272a4',
        keyword: 'ff79c6',
        string: 'f1fa8c',
        number: 'bd93f9',
        constant: 'bd93f9',
        operator: 'ff79c6',
        identifier: 'f8f8f2',
      }),
    },
  },
  {
    id: 'solarized-dark',
    label: 'Solarized Dark',
    appearance: 'dark',
    def: {
      base: 'vs-dark',
      inherit: true,
      colors: surface({
        bg: '#002b36',
        line: '#073642',
        gutter: '#586e75',
        gutterActive: '#93a1a1',
        selection: '#073642',
        cursor: '#839496',
      }),
      rules: rules({
        comment: '586e75',
        keyword: '859900',
        string: '2aa198',
        number: 'd33682',
        constant: 'cb4b16',
        operator: '839496',
        identifier: '93a1a1',
      }),
    },
  },
];

/**
 * The default editor is DARK in both app modes.
 *
 * This is deliberate and was asked for repeatedly: code is a dark surface here
 * regardless of the surrounding theme, which also matches the two neighbours a
 * cell already has — `.prose pre` (markdown fences) and CodeOutput (the console)
 * are both dark with no light variant. The light presets exist for anyone who
 * wants one, but nobody gets one by default.
 */
export const DEFAULT_LIGHT_THEME = 'solarized-dark';
export const DEFAULT_DARK_THEME = 'laila-midnight';

export const themeById = (id: string): LabTheme | undefined =>
  LAB_THEMES.find(t => t.id === id);

/**
 * Resolve the theme to paint with.
 *
 * A stored choice wins, but only while it still exists — a theme removed in a
 * later release would otherwise leave Monaco with an undefined theme name and
 * a silently unstyled editor.
 */
export const resolveTheme = (stored: string | null, isDark: boolean): LabTheme => {
  const picked = stored ? themeById(stored) : undefined;
  if (picked) return picked;
  return themeById(isDark ? DEFAULT_DARK_THEME : DEFAULT_LIGHT_THEME)!;
};
