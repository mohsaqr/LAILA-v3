import { describe, it, expect } from 'vitest';
import { sanitizeHtml, createSanitizedMarkup } from './sanitize';

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
