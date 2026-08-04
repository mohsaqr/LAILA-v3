import { describe, it, expect } from 'vitest';
import { notebookToRmd } from './notebookToRmd';
import type { LabCell } from '../components/labs/authoring/cell';

const cell = (over: Partial<LabCell> = {}): LabCell => ({
  id: 1,
  title: 'Step 1',
  prose: 'Load the data',
  code: 'df <- read.csv("g.csv")',
  orderIndex: 0,
  locked: false,
  cellType: 'code',
  ...over,
});

describe('notebookToRmd', () => {
  it('emits a runnable {r} chunk, not an inert ```r fence', () => {
    const out = notebookToRmd([cell()], { labName: 'Lab' });

    // RStudio only gives a run arrow to the braced form.
    expect(out).toContain('```{r}\ndf <- read.csv("g.csv")\n```');
    expect(out).not.toContain('```r\n');
  });

  it('writes a YAML header with the lab name', () => {
    const out = notebookToRmd([], { labName: 'Sequence Analysis' });
    expect(out.startsWith('---\ntitle: "Sequence Analysis"\noutput: html_document\n---')).toBe(true);
  });

  it('escapes quotes in the title instead of producing broken YAML', () => {
    const out = notebookToRmd([], { labName: 'The "real" lab' });
    expect(out).toContain('title: "The \\"real\\" lab"');
  });

  it('exports what the student has typed, not the instructor original', () => {
    const out = notebookToRmd([cell()], { labName: 'Lab', drafts: { 1: 'summary(df)' } });

    expect(out).toContain('summary(df)');
    expect(out).not.toContain('read.csv');
  });

  it('keeps titles as headings, since duplicate chunk labels are fatal to knitr', () => {
    const out = notebookToRmd([cell({ title: 'Step 1' }), cell({ id: 2, title: 'Step 1 (copy)' })], {
      labName: 'Lab',
    });

    expect(out).toContain('## Step 1');
    expect(out).toContain('## Step 1 (copy)');
    // No labels at all means no way for two cells to collide.
    expect(out).not.toMatch(/```\{r [^}]/);
  });

  it('renders a markdown cell as prose with no chunk', () => {
    const out = notebookToRmd(
      [cell({ cellType: 'markdown', title: 'Background', prose: 'Some **context**.', code: '' })],
      { labName: 'Lab' }
    );

    expect(out).toContain('## Background');
    expect(out).toContain('Some **context**.');
    expect(out).not.toContain('```');
  });

  it('never emits a chunk for a markdown cell even if it carries stale code', () => {
    const out = notebookToRmd([cell({ cellType: 'markdown', code: 'mean(x)' })], { labName: 'Lab' });
    expect(out).not.toContain('mean(x)');
  });

  it('skips an empty code cell rather than writing a hollow chunk', () => {
    const out = notebookToRmd([cell({ code: '   ' })], { labName: 'Lab' });
    expect(out).not.toContain('```');
  });

  it('lengthens the fence when the code itself contains a fence', () => {
    const code = 'x <- "\n```\n"';
    const out = notebookToRmd([cell({ code })], { labName: 'Lab' });

    // A 3-backtick fence would close the chunk early and corrupt the rest.
    expect(out).toContain('````{r}');
    expect(out.trimEnd().endsWith('````')).toBe(true);
  });

  it('uses python chunks for a python lab', () => {
    const out = notebookToRmd([cell({ code: 'print(1)' })], { labName: 'Lab', language: 'python' });
    expect(out).toContain('```{python}');
  });

  it('preserves cell order', () => {
    const out = notebookToRmd(
      [cell({ id: 1, title: 'First', code: 'one()' }), cell({ id: 2, title: 'Second', code: 'two()' })],
      { labName: 'Lab' }
    );
    expect(out.indexOf('one()')).toBeLessThan(out.indexOf('two()'));
  });

  it('produces a document the importer would parse back into the same cells', () => {
    // Mirrors server/src/utils/rmdParser.ts: a fence whose info string is
    // {r ...} or bare r/R opens a code chunk.
    const out = notebookToRmd([cell({ title: 'A', prose: 'p', code: 'f()' })], { labName: 'Lab' });
    const isRInfo = (info: string) => /^\{[rR](?:[\s,}].*)?\}$/.test(info) || /^[rR]$/.test(info);

    const opens = out
      .split('\n')
      .map(l => /^\s*(`{3,})\s*(.*?)\s*$/.exec(l))
      .filter(Boolean)
      .map(m => m![2])
      .filter(Boolean);

    expect(opens.length).toBe(1);
    expect(isRInfo(opens[0])).toBe(true);
  });
});
