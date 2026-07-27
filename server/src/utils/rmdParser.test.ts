import { describe, it, expect } from 'vitest';
import { parseRmd, cellTitle } from './rmdParser.js';

describe('cellTitle', () => {
  it('titles a markdown cell from its first heading', () => {
    expect(cellTitle({ type: 'markdown', content: '## Building `tna` Model\n\nBody text.' }))
      .toBe('Building tna Model');
  });

  it('falls back to the first line when a markdown cell has no heading', () => {
    expect(cellTitle({ type: 'markdown', content: 'Just a paragraph here.' }))
      .toBe('Just a paragraph here.');
  });

  it('titles a code cell from its first comment', () => {
    expect(cellTitle({ type: 'code', content: '# TNA visualization\nplot(model)' }))
      .toBe('TNA visualization');
  });

  it('is empty for a code cell with no comment', () => {
    expect(cellTitle({ type: 'code', content: 'plot(model)' })).toBe('');
  });

  it('clips a very long title', () => {
    const long = 'x'.repeat(80);
    const out = cellTitle({ type: 'markdown', content: '# ' + long });
    expect(out.length).toBeLessThanOrEqual(60);
    expect(out.endsWith('…')).toBe(true);
  });

  it('is empty for an empty cell', () => {
    expect(cellTitle({ type: 'code', content: '' })).toBe('');
  });
});

describe('parseRmd', () => {
  it('extracts the title from YAML frontmatter and drops the rest', () => {
    const rmd = `---
title: "My Analysis"
author: Jane Doe
output: html_document
---

Some intro text.`;
    const { title, cells } = parseRmd(rmd);
    expect(title).toBe('My Analysis');
    expect(cells).toEqual([{ type: 'markdown', content: 'Some intro text.' }]);
  });

  it('splits interleaved text and ```{r} chunks in order', () => {
    const rmd = `Intro paragraph.

\`\`\`{r}
x <- 1
print(x)
\`\`\`

Middle text.

\`\`\`{r plot, echo=FALSE}
plot(x)
\`\`\`

Closing text.`;
    const { cells } = parseRmd(rmd);
    expect(cells).toEqual([
      { type: 'markdown', content: 'Intro paragraph.' },
      { type: 'code', content: 'x <- 1\nprint(x)' },
      { type: 'markdown', content: 'Middle text.' },
      { type: 'code', content: 'plot(x)' },
      { type: 'markdown', content: 'Closing text.' },
    ]);
  });

  it('accepts the plain ```r fence style too', () => {
    const rmd = `Text\n\n\`\`\`r\nmean(1:10)\n\`\`\`\n`;
    const { cells } = parseRmd(rmd);
    expect(cells).toEqual([
      { type: 'markdown', content: 'Text' },
      { type: 'code', content: 'mean(1:10)' },
    ]);
  });

  it('honors chunk options and named chunks in the open fence', () => {
    const rmd = `\`\`\`{r setup, include=FALSE, message=FALSE}\nlibrary(dplyr)\n\`\`\``;
    const { cells } = parseRmd(rmd);
    expect(cells).toEqual([{ type: 'code', content: 'library(dplyr)' }]);
  });

  it('leaves non-R fenced blocks inside the text (R only)', () => {
    const rmd = `Before.

\`\`\`python
print("hi")
\`\`\`

After.`;
    const { cells } = parseRmd(rmd);
    // The python block is not a code cell — it stays as ordinary text.
    expect(cells).toHaveLength(1);
    expect(cells[0].type).toBe('markdown');
    expect(cells[0].content).toContain('```python');
    expect(cells[0].content).toContain('After.');
  });

  it('handles a text-only document', () => {
    const { cells } = parseRmd('# Heading\n\nJust prose, no code.');
    expect(cells).toEqual([
      { type: 'markdown', content: '# Heading\n\nJust prose, no code.' },
    ]);
  });

  it('handles a code-only document', () => {
    const { cells } = parseRmd('```{r}\nsummary(cars)\n```');
    expect(cells).toEqual([{ type: 'code', content: 'summary(cars)' }]);
  });

  it('keeps an empty chunk as an empty code cell', () => {
    const { cells } = parseRmd('```{r}\n```');
    expect(cells).toEqual([{ type: 'code', content: '' }]);
  });

  it('closes a trailing chunk that is missing its closing fence', () => {
    const { cells } = parseRmd('Text\n\n```{r}\nx <- 5');
    expect(cells).toEqual([
      { type: 'markdown', content: 'Text' },
      { type: 'code', content: 'x <- 5' },
    ]);
  });

  it('preserves interior indentation and blank lines within code', () => {
    const rmd = '```{r}\nf <- function() {\n  if (TRUE) {\n    1\n  }\n}\n```';
    const { cells } = parseRmd(rmd);
    expect(cells[0]).toEqual({
      type: 'code',
      content: 'f <- function() {\n  if (TRUE) {\n    1\n  }\n}',
    });
  });

  it('normalizes CRLF line endings', () => {
    const { cells } = parseRmd('Text\r\n\r\n```{r}\r\nx <- 1\r\n```\r\n');
    expect(cells).toEqual([
      { type: 'markdown', content: 'Text' },
      { type: 'code', content: 'x <- 1' },
    ]);
  });

  it('returns no title when there is no frontmatter', () => {
    const { title } = parseRmd('```{r}\n1+1\n```');
    expect(title).toBeUndefined();
  });

  it('strips Quarto #| chunk-option lines from the code cell', () => {
    const qmd = `\`\`\`{r}\n#| echo: false\n#| label: fig-plot\nplot(cars)\n\`\`\``;
    const { cells } = parseRmd(qmd);
    expect(cells).toEqual([{ type: 'code', content: 'plot(cars)' }]);
  });

  it('keeps #| lines that appear after code (only the leading block is options)', () => {
    const qmd = `\`\`\`{r}\n#| echo: false\nx <- 1\n#| not an option\n\`\`\``;
    const { cells } = parseRmd(qmd);
    expect(cells).toEqual([{ type: 'code', content: 'x <- 1\n#| not an option' }]);
  });

  it('does NOT treat an R fence nested inside a four-backtick doc fence as code', () => {
    const rmd = [
      'Here is how you write a chunk:',
      '',
      '````markdown',
      '```{r}',
      'this_is_documentation()',
      '```',
      '````',
      '',
      'Real analysis:',
      '',
      '```{r}',
      'actually_run()',
      '```',
    ].join('\n');
    const { cells } = parseRmd(rmd);
    // Exactly one code cell — the real one, not the documented example.
    const code = cells.filter(c => c.type === 'code');
    expect(code).toHaveLength(1);
    expect(code[0].content).toBe('actually_run()');
    // The documentation example stays inside a markdown cell.
    expect(cells.some(c => c.type === 'markdown' && c.content.includes('this_is_documentation()'))).toBe(true);
  });

  it('treats a tilde-fenced block as text, not code', () => {
    const rmd = '~~~\n```{r}\nnot_code()\n```\n~~~';
    const { cells } = parseRmd(rmd);
    expect(cells.every(c => c.type === 'markdown')).toBe(true);
  });

  it('parses a Quarto-style document end to end', () => {
    const qmd = `---
title: "Quarto Demo"
format: html
---

## Setup

\`\`\`{r}
#| message: false
library(dplyr)
\`\`\`

Analysis follows.`;
    const { title, cells } = parseRmd(qmd);
    expect(title).toBe('Quarto Demo');
    expect(cells).toEqual([
      { type: 'markdown', content: '## Setup' },
      { type: 'code', content: 'library(dplyr)' },
      { type: 'markdown', content: 'Analysis follows.' },
    ]);
  });
});
