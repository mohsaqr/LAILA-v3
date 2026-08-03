import { describe, it, expect, beforeEach } from 'vitest';
import { signSubmissionUrl, verifySubmissionSignature, isSafeFilename } from './signedFiles.js';

beforeEach(() => {
  process.env.JWT_SECRET = 'test-signing-secret-at-least-32-chars-long';
});

describe('signedFiles', () => {
  const NOW = 1_000_000_000_000;

  it('round-trips a freshly signed URL', () => {
    const url = signSubmissionUrl('abc.pdf', 60_000, NOW);
    const params = new URLSearchParams(url.split('?')[1]);
    expect(
      verifySubmissionSignature('abc.pdf', params.get('exp')!, params.get('sig')!, NOW + 1),
    ).toBe(true);
  });

  it('rejects an expired signature', () => {
    const url = signSubmissionUrl('abc.pdf', 60_000, NOW);
    const params = new URLSearchParams(url.split('?')[1]);
    // 61s later — past the 60s TTL.
    expect(
      verifySubmissionSignature('abc.pdf', params.get('exp')!, params.get('sig')!, NOW + 61_000),
    ).toBe(false);
  });

  it('rejects a tampered filename', () => {
    const url = signSubmissionUrl('abc.pdf', 60_000, NOW);
    const params = new URLSearchParams(url.split('?')[1]);
    expect(
      verifySubmissionSignature('other.pdf', params.get('exp')!, params.get('sig')!, NOW + 1),
    ).toBe(false);
  });

  it('rejects a tampered expiry (extending the window)', () => {
    const url = signSubmissionUrl('abc.pdf', 60_000, NOW);
    const params = new URLSearchParams(url.split('?')[1]);
    const forgedExp = String(NOW + 10 * 60_000);
    expect(
      verifySubmissionSignature('abc.pdf', forgedExp, params.get('sig')!, NOW + 1),
    ).toBe(false);
  });

  it('rejects a missing signature', () => {
    expect(verifySubmissionSignature('abc.pdf', String(NOW + 60_000), undefined, NOW)).toBe(false);
  });

  it('rejects path-traversal filenames at sign and verify', () => {
    expect(isSafeFilename('../secret.env')).toBe(false);
    expect(isSafeFilename('a/b.pdf')).toBe(false);
    expect(isSafeFilename('ok.pdf')).toBe(true);
    expect(() => signSubmissionUrl('../secret.env')).toThrow();
    expect(verifySubmissionSignature('../secret.env', String(NOW + 60_000), 'deadbeef', NOW)).toBe(false);
  });
});
