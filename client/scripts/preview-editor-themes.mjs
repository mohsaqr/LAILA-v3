/**
 * Render every lab editor theme to a single offline HTML page.
 *
 * Two hard-won constraints shape this:
 *
 * 1. NO NETWORK. The first version loaded Monaco from a CDN, and when that
 *    failed the reviewer was shown an empty white box — worse than no preview,
 *    because it looked like the feature itself was broken.
 * 2. NO RETYPED COLOURS. It reads `labEditorThemes.ts`, transpiles it, and uses
 *    the real objects, so the page cannot show colours the app does not ship.
 *
 * The code sample is tokenised here rather than by Monaco. That is a faithful
 * preview of the PALETTE, which is what needs judging; it is not a preview of
 * Monaco's own tokeniser, and the page says so.
 *
 *   node scripts/preview-editor-themes.mjs && open tmp/lab-editor-preview.html
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { transformSync } from 'esbuild';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const out = resolve(root, 'tmp');
mkdirSync(out, { recursive: true });

const SRC = resolve(root, 'src/components/labs/authoring/labEditorThemes.ts');
const js = transformSync(readFileSync(SRC, 'utf8'), { loader: 'ts', format: 'esm' }).code;
const { LAB_THEMES, DEFAULT_LIGHT_THEME, DEFAULT_DARK_THEME } = await import(
  `data:text/javascript;base64,${Buffer.from(js).toString('base64')}`
);

const SAMPLE = `# Load the packages this lab needs
library(tidyverse)

options(scipen = 999)

scores <- c(12.5, 8, 21, 3.75)
label  <- "mean score"

summarise_scores <- function(x, na.rm = TRUE) {
  if (length(x) == 0) return(NA)
  mean(x, na.rm = na.rm)
}`;

/** Monaco's R keyword list (basic-languages/r), trimmed to what the sample uses. */
const KEYWORDS = new Set(['library', 'function', 'if', 'else', 'for', 'while', 'return', 'options']);
const CONSTANTS = new Set(['TRUE', 'FALSE', 'NULL', 'NA', 'Inf', 'NaN']);

const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Colour lookup for a theme's rules, by Monaco scope name. */
const colorOf = (theme, token) => {
  const rule = theme.def.rules.find(r => r.token === token);
  return rule ? `#${rule.foreground}` : null;
};

/**
 * Tokenise one line into scope-tagged spans. Deliberately small: comments,
 * strings, numbers, keywords, constants, operators, everything else identifier.
 */
const highlight = (line, theme) => {
  const paint = (text, scope) => {
    const c = colorOf(theme, scope);
    const italic = scope === 'comment' ? ';font-style:italic' : '';
    return c ? `<span style="color:${c}${italic}">${esc(text)}</span>` : esc(text);
  };

  if (line.startsWith('#')) return paint(line, 'comment');

  let html = '';
  // Split on strings first so their contents are never re-tokenised.
  line.split(/("(?:[^"\\]|\\.)*")/g).forEach(part => {
    if (part.startsWith('"')) {
      html += paint(part, 'string');
      return;
    }
    part.split(/([A-Za-z._][A-Za-z0-9._]*|\d+\.?\d*|[^\sA-Za-z0-9._])/g).forEach(tok => {
      if (!tok) return;
      if (KEYWORDS.has(tok)) html += paint(tok, 'keyword');
      else if (CONSTANTS.has(tok)) html += paint(tok, 'constant');
      else if (/^\d/.test(tok)) html += paint(tok, 'number');
      else if (/^[A-Za-z._]/.test(tok)) html += paint(tok, 'identifier');
      else if (/\S/.test(tok)) html += paint(tok, 'operator');
      else html += esc(tok);
    });
  });
  return html;
};

const lum = hex => {
  const n = parseInt(hex.replace('#', ''), 16);
  return 0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255);
};

/** One theme rendered as a realistic cell, in its own app-appearance frame. */
const card = (theme, frameDark = null, note = '') => {
  const c = theme.def.colors;
  // The frame is the APP's appearance, which is not the theme's: the default
  // light-mode editor is a dark theme sitting in a white card, and that pairing
  // is the one that actually needs looking at.
  const isDark = frameDark === null ? theme.appearance === 'dark' : frameDark;
  const isDefault = theme.id === DEFAULT_LIGHT_THEME || theme.id === DEFAULT_DARK_THEME;
  const lines = SAMPLE.split('\n')
    .map((l, i) => {
      const active = i === 0;
      return `<div style="display:flex;${active ? `background:${c['editor.lineHighlightBackground']}` : ''}">
        <span style="width:34px;flex:none;text-align:right;padding-right:12px;color:${
          active ? c['editorLineNumber.activeForeground'] : c['editorLineNumber.foreground']
        }">${i + 1}</span>
        <span style="white-space:pre">${highlight(l, theme) || '&nbsp;'}</span></div>`;
    })
    .join('');

  return `<figure class="theme">
    <figcaption>
      <b>${theme.label}</b>
      ${note ? `<em>${note}</em>` : isDefault ? '<em>default</em>' : ''}
      <code>${c['editor.background']}</code>
      <span class="lum">${(255 - lum(c['editor.background'])).toFixed(0)} from white</span>
    </figcaption>
    <div class="frame" style="background:${isDark ? '#111827' : '#f3f4f6'}">
      <div class="cell" style="background:${isDark ? '#1f2937' : '#ffffff'};
           border-color:${isDark ? '#374151' : '#e5e7eb'}">
        <div class="head" style="border-color:${isDark ? 'rgba(55,65,81,.6)' : '#f3f4f6'};
             background:${isDark ? 'rgba(17,24,39,.4)' : 'rgba(249,250,251,.7)'};
             color:${isDark ? '#9ca3af' : '#6b7280'}">
          <span class="badge" style="background:${isDark ? '#374151' : '#f3f4f6'}">[ 1 ]</span>
          Load packages
        </div>
        <div class="pad">
          <div class="ed" style="background:${c['editor.background']};
               border-color:${isDark ? '#374151' : '#e5e7eb'}">${lines}</div>
          <div class="row">
            <span class="run">▶ Run</span>
            <span class="ai" style="border-color:${isDark ? '#4c1d95' : '#ddd6fe'};
                  color:${isDark ? '#c4b5fd' : '#7c3aed'}">✨ Explain · Ask</span>
          </div>
        </div>
      </div>
    </div>
  </figure>`;
};

const group = appearance =>
  LAB_THEMES.filter(t => t.appearance === appearance).map(card).join('');

writeFileSync(
  resolve(out, 'lab-editor-preview.html'),
  `<!doctype html><html><head><meta charset="utf-8">
<title>Lab editor themes</title>
<style>
  body { margin:0; font-family:ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif;
         background:#fafafa; color:#111827; }
  header { padding:18px 24px; border-bottom:1px solid #e5e7eb; background:#fff; }
  h1 { margin:0 0 4px; font-size:17px; }
  header p { margin:0; font-size:13px; color:#6b7280; }
  h2 { font-size:12px; text-transform:uppercase; letter-spacing:.06em; color:#6b7280;
       margin:22px 24px 6px; }
  .grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(400px,1fr)); gap:16px;
          padding:0 24px; }
  .theme { margin:0; }
  figcaption { display:flex; align-items:center; gap:8px; font-size:12px; padding:6px 2px; }
  figcaption em { font-style:normal; background:#059669; color:#fff; border-radius:4px;
                  padding:1px 6px; font-size:10px; text-transform:uppercase; }
  figcaption code { color:#6b7280; }
  .lum { margin-left:auto; color:#9ca3af; font-size:11px; }
  .frame { padding:14px; border-radius:12px; }
  .cell { border-radius:12px; border:1px solid; overflow:hidden; }
  .head { display:flex; align-items:center; gap:8px; padding:8px 12px; border-bottom:1px solid;
          font-size:13px; }
  .badge { font-family:ui-monospace,monospace; font-size:11px; padding:2px 8px; border-radius:6px; }
  .pad { padding:10px; }
  .ed { border:1px solid; border-radius:8px; padding:8px 0; font-family:ui-monospace,
        SFMono-Regular,Menlo,monospace; font-size:12.5px; line-height:1.55; overflow-x:auto; }
  .row { display:flex; align-items:center; margin-top:9px; }
  .run { background:#059669; color:#fff; border-radius:8px; padding:5px 14px; font-size:12px;
         font-weight:600; }
  .ai { margin-left:auto; border:1px solid; border-radius:8px; padding:4px 10px; font-size:12px; }
  footer { margin:26px 24px; padding-top:14px; border-top:1px solid #e5e7eb;
           font-size:12px; color:#6b7280; }
</style></head><body>
<header>
  <h1>Lab editor themes</h1>
  <p>Every preset in the picker. Colours read straight from
     <code>labEditorThemes.ts</code> — nothing here is retyped, and nothing loads
     from the network.</p>
</header>
<h2>Defaults — a dark editor either way</h2>
<div class="grid">
  ${card(LAB_THEMES.find(t => t.id === DEFAULT_LIGHT_THEME), false, 'app in light mode')}
  ${card(LAB_THEMES.find(t => t.id === DEFAULT_DARK_THEME), true, 'app in dark mode')}
</div>
<h2>All dark presets</h2>
<div class="grid">${group('dark')}</div>
<h2>Light presets — opt-in only, never white</h2>
<div class="grid">${group('light')}</div>
<footer>Syntax is tokenised by this script, not by Monaco, so treat it as a preview
  of the palette rather than of Monaco's exact tokenisation.</footer>
</body></html>`
);

console.log('wrote tmp/lab-editor-preview.html (offline, no CDN)');
LAB_THEMES.filter(t => t.appearance === 'light').forEach(t =>
  console.log(
    ' ',
    t.label.padEnd(17),
    t.def.colors['editor.background'],
    `${(255 - lum(t.def.colors['editor.background'])).toFixed(0)} from white`
  )
);
