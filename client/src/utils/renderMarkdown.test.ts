import { describe, it, expect } from 'vitest';
import { renderMarkdown } from './renderMarkdown';

describe('renderMarkdown', () => {
  it('renders headers, bold, italic, inline code and links (unchanged behavior)', () => {
    expect(renderMarkdown('# Title')).toContain('<h1');
    expect(renderMarkdown('## Sub')).toContain('<h2');
    expect(renderMarkdown('**bold**')).toContain('<strong>bold</strong>');
    expect(renderMarkdown('*it*')).toContain('<em>it</em>');
    expect(renderMarkdown('`x`')).toContain('<code');
    const link = renderMarkdown('[R](https://r-project.org)');
    expect(link).toContain('href="https://r-project.org"');
    expect(link).toContain('>R</a>');
  });

  it('wraps consecutive bullet list items in a <ul>', () => {
    const html = renderMarkdown('- a\n- b');
    expect(html).toContain('<ul');
    expect((html.match(/<li/g) || []).length).toBe(2);
  });

  it('renders a fenced code block', () => {
    const html = renderMarkdown('```r\nmean(1:10)\n```');
    expect(html).toContain('<pre');
    expect(html).toContain('mean(1:10)');
  });

  it('renders an image as <img> (not as a link)', () => {
    const html = renderMarkdown('![a chart](/img/plot.png)');
    expect(html).toContain('<img');
    expect(html).toContain('src="/img/plot.png"');
    expect(html).toContain('alt="a chart"');
    expect(html).not.toContain('<a ');
  });

  it('renders a GFM table into a real <table>', () => {
    const md = `| Name | Score |\n| --- | --- |\n| Ann | 90 |\n| Bo | 85 |`;
    const html = renderMarkdown(md);
    expect(html).toContain('<table');
    expect(html).toContain('<th');
    expect(html).toContain('Name');
    expect(html).toContain('Score');
    expect((html.match(/<tr>/g) || []).length).toBe(3); // header + two body rows
    expect((html.match(/<th /g) || []).length).toBe(2); // two header cells
    expect((html.match(/<td/g) || []).length).toBe(4); // 2x2 body cells
    expect(html).toContain('Ann');
    // The table must not be left as raw pipe text.
    expect(html).not.toContain('| Ann |');
  });

  it('renders a table alongside surrounding prose', () => {
    const md = `Intro line.\n\n| A | B |\n| --- | --- |\n| 1 | 2 |\n\nOutro line.`;
    const html = renderMarkdown(md);
    expect(html).toContain('Intro line.');
    expect(html).toContain('<table');
    expect(html).toContain('Outro line.');
    // The table should not be trapped inside a <p>…</p> wrapper.
    expect(html).not.toMatch(/<p[^>]*>\s*<table/);
  });

  it('escapes HTML inside table cells', () => {
    const md = `| Code |\n| --- |\n| <script> |`;
    const html = renderMarkdown(md);
    expect(html).toContain('&lt;script&gt;');
    expect(html).not.toContain('<script>');
  });

  it('leaves ordinary pipe text alone when it is not a table', () => {
    const html = renderMarkdown('a | b | c without a separator row');
    expect(html).not.toContain('<table');
  });
});
