import { describe, it, expect } from 'vitest';
import path from 'node:path';
import {
  UPLOADS_DIR,
  findUploadUrls,
  newUploadUrlFor,
  resolveUploadPath,
  rewriteUploadUrls,
} from './uploadFiles.js';

describe('findUploadUrls', () => {
  it('finds URLs in columns, TipTap attributes and escaped JSON alike', () => {
    const json = JSON.stringify({
      fileUrl: '/uploads/11111111-1111-1111-1111-111111111111-notes.pdf',
      content:
        '<lecture-file data-url="/uploads/22222222-2222-2222-2222-222222222222-slides.pptx"></lecture-file>' +
        '<lecture-folder data-files="[{&quot;fileUrl&quot;:&quot;/uploads/33333333-3333-3333-3333-333333333333-a.csv&quot;}]">' +
        '<img src="/uploads/44444444-4444-4444-4444-444444444444-pic.png">' +
        '<video src="/uploads/courses/videos/55555555-5555-5555-5555-555555555555-clip.mp4">',
      config: '{"dataset":"/uploads/datasets/66666666-6666-6666-6666-666666666666-d.csv"}',
    });
    expect(findUploadUrls(json)).toEqual([
      '/uploads/11111111-1111-1111-1111-111111111111-notes.pdf',
      '/uploads/22222222-2222-2222-2222-222222222222-slides.pptx',
      '/uploads/33333333-3333-3333-3333-333333333333-a.csv',
      '/uploads/44444444-4444-4444-4444-444444444444-pic.png',
      '/uploads/courses/videos/55555555-5555-5555-5555-555555555555-clip.mp4',
      '/uploads/datasets/66666666-6666-6666-6666-666666666666-d.csv',
    ]);
  });

  it('deduplicates and drops derived slide caches', () => {
    const text = '/uploads/a.pdf /uploads/a.pdf /uploads/slides/abc/1.png';
    expect(findUploadUrls(text)).toEqual(['/uploads/a.pdf']);
  });

  it('does not swallow sentence punctuation after a URL', () => {
    expect(findUploadUrls('see /uploads/a.pdf. Then /uploads/b.pdf;')).toEqual(['/uploads/a.pdf', '/uploads/b.pdf']);
  });

  it('returns nothing for text without uploads', () => {
    expect(findUploadUrls('<p>hello</p>')).toEqual([]);
  });
});

describe('resolveUploadPath', () => {
  it('maps a URL under the uploads directory', () => {
    expect(resolveUploadPath('/uploads/courses/videos/x.mp4')).toBe(
      path.join(UPLOADS_DIR, 'courses', 'videos', 'x.mp4'),
    );
  });

  it('refuses traversal and foreign prefixes', () => {
    expect(resolveUploadPath('/uploads/../.env')).toBeNull();
    expect(resolveUploadPath('/uploads/a/../../.env')).toBeNull();
    expect(resolveUploadPath('/uploads/')).toBeNull();
    expect(resolveUploadPath('/etc/passwd')).toBeNull();
    expect(resolveUploadPath('/uploads/%')).toBeNull();
  });
});

describe('newUploadUrlFor', () => {
  it('keeps directory, stem and extension and swaps the uuid', () => {
    const url = newUploadUrlFor('/uploads/courses/videos/11111111-1111-1111-1111-111111111111-clip.mp4');
    expect(url).toMatch(/^\/uploads\/courses\/videos\/[0-9a-f-]{36}-clip\.mp4$/);
    expect(url).not.toContain('11111111-1111-1111-1111-111111111111');
  });

  it('falls back to a stem for legacy uuid-only names', () => {
    expect(newUploadUrlFor('/uploads/11111111-1111-1111-1111-111111111111.pdf')).toMatch(
      /^\/uploads\/[0-9a-f-]{36}-file\.pdf$/,
    );
  });
});

describe('rewriteUploadUrls', () => {
  it('replaces every occurrence and is prefix-safe', () => {
    const map = new Map([
      ['/uploads/a', '/uploads/NEW-a'],
      ['/uploads/a.pdf', '/uploads/NEW-a.pdf'],
    ]);
    const out = rewriteUploadUrls('x /uploads/a.pdf y /uploads/a z /uploads/a.pdf', map);
    expect(out).toBe('x /uploads/NEW-a.pdf y /uploads/NEW-a z /uploads/NEW-a.pdf');
  });

  it('is the identity for an empty map', () => {
    expect(rewriteUploadUrls('/uploads/a.pdf', new Map())).toBe('/uploads/a.pdf');
  });
});
