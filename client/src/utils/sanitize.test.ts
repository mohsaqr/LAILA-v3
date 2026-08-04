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

// `style` used to be stripped wholesale, which silently discarded the text
// alignment the toolbar had been offering all along, and blocked text colour
// and image sizing. It is now allowed but filtered to a property allow-list.
describe('sanitizeHtml - inline styles', () => {
  describe('keeps what the editor produces', () => {
    it('keeps text alignment', () => {
      expect(sanitizeHtml('<p style="text-align: center">hi</p>')).toContain('text-align: center');
    });

    it('keeps text colour', () => {
      expect(sanitizeHtml('<span style="color: #ff0000">red</span>')).toContain('color: #ff0000');
    });

    it('keeps colour in the rgb() form Tiptap actually emits', () => {
      // Tiptap normalises #dc2626 to rgb(220, 38, 38) before saving, so the hex
      // case alone does not prove the editor's output survives. rgb()/hsl() also
      // check that the url()/expression() guard is not over-broad about parens.
      expect(sanitizeHtml('<span style="color: rgb(220, 38, 38)">x</span>')).toContain('rgb(220, 38, 38)');
      expect(sanitizeHtml('<span style="color: hsl(0, 72%, 51%)">x</span>')).toContain('hsl(0, 72%, 51%)');
    });

    it('keeps image sizing and float', () => {
      const out = sanitizeHtml('<img src="/a.png" style="width: 50%; float: left">');
      expect(out).toContain('width: 50%');
      expect(out).toContain('float: left');
    });

    it('keeps table structure attributes', () => {
      const out = sanitizeHtml('<table><tbody><tr><td colspan="2" rowspan="3">x</td></tr></tbody></table>');
      expect(out).toContain('colspan="2"');
      expect(out).toContain('rowspan="3"');
    });

    it('keeps allowed properties while dropping disallowed ones in the same attribute', () => {
      const out = sanitizeHtml('<p style="color: red; position: fixed">x</p>');
      expect(out).toContain('color: red');
      expect(out).not.toContain('position');
    });
  });

  describe('drops what it must', () => {
    it('drops positioning — an overlay over unrelated UI is clickjacking', () => {
      const out = sanitizeHtml('<div style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; z-index: 9999">x</div>');
      expect(out).not.toContain('position');
      expect(out).not.toContain('z-index');
    });

    it('drops any value containing url()', () => {
      const out = sanitizeHtml('<p style="background-color: url(https://evil.test/track.png)">x</p>');
      expect(out).not.toContain('url(');
      expect(out).not.toContain('evil.test');
    });

    it('drops javascript: in a style value', () => {
      const out = sanitizeHtml('<p style="background-color: javascript:alert(1)">x</p>');
      expect(out).not.toContain('javascript:');
    });

    it('drops expression()', () => {
      const out = sanitizeHtml('<p style="width: expression(alert(1))">x</p>');
      expect(out).not.toContain('expression');
    });

    it('drops @import', () => {
      expect(sanitizeHtml('<p style="color: red; @import url(x)">x</p>')).not.toContain('@import');
    });

    it('removes the attribute entirely when nothing survives', () => {
      expect(sanitizeHtml('<p style="position: fixed">x</p>')).toBe('<p>x</p>');
    });

    it('still strips <style> elements', () => {
      expect(sanitizeHtml('<style>body{display:none}</style><p>x</p>')).not.toContain('display');
    });

    it('still strips event handlers alongside a valid style', () => {
      const out = sanitizeHtml('<p style="color: red" onclick="alert(1)">x</p>');
      expect(out).toContain('color: red');
      expect(out).not.toContain('onclick');
    });
  });
});
