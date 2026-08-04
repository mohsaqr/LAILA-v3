import { describe, it, expect } from 'vitest';
import { resolveSocketURL } from './socket';

// Production sets VITE_API_URL=/api (deploy/deploy.sh) and nginx proxies
// /socket.io/ to the server (deploy/nginx/laila.conf), so the correct
// production target is same origin. A `||` fallback used to collapse the
// stripped-to-empty value into the dev default, which sent every production
// browser to its OWN localhost:5001 — real-time notifications never connected
// and nothing logged an error, because that is a perfectly valid URL.
describe('resolveSocketURL', () => {
  it('returns undefined (same origin) for the production /api value', () => {
    // undefined, not '' — socket.io-client only treats null/undefined as
    // "use window.location". An empty string is parsed as a relative path and
    // becomes "https://" with no host.
    expect(resolveSocketURL('/api')).toBeUndefined();
  });

  it('handles a trailing slash the same way', () => {
    expect(resolveSocketURL('/api/')).toBeUndefined();
  });

  it('falls back to the dev server only when nothing is configured', () => {
    expect(resolveSocketURL(undefined)).toBe('http://localhost:5001');
    expect(resolveSocketURL('')).toBe('http://localhost:5001');
  });

  it('keeps the origin of an absolute API URL', () => {
    expect(resolveSocketURL('https://laila.lacarm.com/api')).toBe('https://laila.lacarm.com');
    expect(resolveSocketURL('http://127.0.0.1:5001/api')).toBe('http://127.0.0.1:5001');
  });

  it('leaves a bare origin untouched', () => {
    expect(resolveSocketURL('https://laila.lacarm.com')).toBe('https://laila.lacarm.com');
  });

  it('does not strip an /api that is not the suffix', () => {
    expect(resolveSocketURL('https://example.com/api/v2')).toBe('https://example.com/api/v2');
  });
});
