import { describe, it, expect } from 'vitest';
import { displayFileName } from './fileName';

const UUID = '3f2a1b4c-5d6e-7f80-9a1b-2c3d4e5f6071'; // 36 chars

describe('displayFileName', () => {
  it('recovers the original name from the stored format', () => {
    expect(displayFileName(`/uploads/${UUID}-network-report.pdf`)).toBe('network-report.pdf');
  });

  it('keeps non-ASCII names intact', () => {
    // Arabic and Finnish course material is normal here; the server keeps these
    // characters in the stored name rather than flattening them.
    expect(displayFileName(`/uploads/${UUID}-tehtävä.pdf`)).toBe('tehtävä.pdf');
    expect(displayFileName(`/uploads/${UUID}-تقرير.pdf`)).toBe('تقرير.pdf');
  });

  it('falls back for legacy uploads that stored no name', () => {
    // Files predating the `<uuid>-<stem><ext>` format are just `<uuid><ext>`,
    // so stripping the uuid leaves a bare extension. That rendered as ".png" —
    // the bug this fixes.
    expect(displayFileName(`/uploads/${UUID}.png`, 0)).toBe('file-1.png');
    expect(displayFileName(`/uploads/${UUID}.png`, 2)).toBe('file-3.png');
  });

  it('survives a name that breaks decodeURIComponent', () => {
    // A lone '%' makes decodeURIComponent throw; the name must still render.
    expect(displayFileName(`/uploads/${UUID}-100%-done.pdf`)).toBe('100%-done.pdf');
  });

  it('decodes a percent-encoded name', () => {
    expect(displayFileName(`/uploads/${UUID}-my%20report.pdf`)).toBe('my report.pdf');
  });

  it('handles a url with no path segments', () => {
    expect(displayFileName('', 0)).toBe('file-1');
  });
});
