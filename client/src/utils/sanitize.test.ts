import { describe, it, expect } from 'vitest';
import { sanitizeHtml, createSanitizedMarkup, isHtmlContent } from './sanitize';

describe('sanitizeHtml', () => {
  it('should allow safe HTML tags', () => {
    const input = '<p>Hello <strong>World</strong></p>';
    const result = sanitizeHtml(input);
    expect(result).toContain('<p>');
    expect(result).toContain('<strong>');
  });

  it('should strip script tags', () => {
    const input = '<p>Hello</p><script>alert("xss")</script>';
    const result = sanitizeHtml(input);
    expect(result).not.toContain('<script>');
    expect(result).not.toContain('alert');
  });

  it('should strip style tags', () => {
    const input = '<p>Hello</p><style>body { display: none; }</style>';
    const result = sanitizeHtml(input);
    expect(result).not.toContain('<style>');
  });

  it('should strip iframe tags', () => {
    const input = '<iframe src="https://malicious.com"></iframe>';
    const result = sanitizeHtml(input);
    expect(result).not.toContain('<iframe>');
  });

  it('should strip onclick handlers', () => {
    const input = '<button onclick="alert(1)">Click</button>';
    const result = sanitizeHtml(input);
    expect(result).not.toContain('onclick');
  });

  it('should strip onerror handlers', () => {
    const input = '<img src="x" onerror="alert(1)">';
    const result = sanitizeHtml(input);
    expect(result).not.toContain('onerror');
  });

  it('should allow safe attributes', () => {
    const input = '<a href="https://example.com" title="Example">Link</a>';
    const result = sanitizeHtml(input);
    expect(result).toContain('href="https://example.com"');
    expect(result).toContain('title="Example"');
  });

  it('should allow images with src and alt', () => {
    const input = '<img src="image.jpg" alt="Description">';
    const result = sanitizeHtml(input);
    expect(result).toContain('src="image.jpg"');
    expect(result).toContain('alt="Description"');
  });
});

describe('createSanitizedMarkup', () => {
  it('should return an object with __html property', () => {
    const result = createSanitizedMarkup('<p>Hello</p>');
    expect(result).toHaveProperty('__html');
    expect(result.__html).toContain('<p>');
  });

  it('should sanitize the content', () => {
    const result = createSanitizedMarkup('<script>alert(1)</script><p>Safe</p>');
    expect(result.__html).not.toContain('<script>');
    expect(result.__html).toContain('<p>Safe</p>');
  });
});

describe('isHtmlContent', () => {
  it('should detect HTML content starting with <p>', () => {
    expect(isHtmlContent('<p>This is a description</p>')).toBe(true);
  });

  it('should detect HTML content starting with heading tags', () => {
    expect(isHtmlContent('<h1>Title</h1>')).toBe(true);
    expect(isHtmlContent('<h2>Subtitle</h2>')).toBe(true);
    expect(isHtmlContent('<h3>Section</h3>')).toBe(true);
  });

  it('should detect HTML content starting with list tags', () => {
    expect(isHtmlContent('<ul><li>Item</li></ul>')).toBe(true);
    expect(isHtmlContent('<ol><li>Item</li></ol>')).toBe(true);
  });

  it('should detect HTML content starting with div', () => {
    expect(isHtmlContent('<div class="content">Hello</div>')).toBe(true);
  });

  it('should detect HTML content starting with blockquote', () => {
    expect(isHtmlContent('<blockquote>Quote</blockquote>')).toBe(true);
  });

  it('should detect HTML content starting with pre', () => {
    expect(isHtmlContent('<pre>Code block</pre>')).toBe(true);
  });

  it('should detect HTML content starting with table', () => {
    expect(isHtmlContent('<table><tr><td>Cell</td></tr></table>')).toBe(true);
  });

  it('should return false for plain text', () => {
    expect(isHtmlContent('This is plain text')).toBe(false);
  });

  it('should return false for markdown content', () => {
    expect(isHtmlContent('# Heading\n\nSome text')).toBe(false);
    expect(isHtmlContent('**bold** and *italic*')).toBe(false);
  });

  it('should return false for null/undefined/empty', () => {
    expect(isHtmlContent(null)).toBe(false);
    expect(isHtmlContent(undefined)).toBe(false);
    expect(isHtmlContent('')).toBe(false);
  });

  it('should handle leading whitespace in HTML content', () => {
    expect(isHtmlContent('  <p>Indented HTML</p>')).toBe(true);
  });

  it('should return false for inline HTML that is not block-level', () => {
    // e.g. text starting with <span> or <em> — not typical Tiptap output
    expect(isHtmlContent('<span>inline</span>')).toBe(false);
    expect(isHtmlContent('<em>emphasis</em>')).toBe(false);
  });
});
