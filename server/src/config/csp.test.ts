import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

import {
  CSP_DIRECTIVES,
  NGINX_GENERATED_TARGETS,
  PYODIDE_CDN,
  WEBR_CDN,
  WEBR_PACKAGE_REPO,
  buildCspHeader,
  renderSecurityHeaderBlocks,
} from './csp.js';

/**
 * Walk up to the repository root. Neither __dirname nor import.meta.url is
 * portable across the CommonJS build and vitest's ESM loader; walking up from
 * cwd works under both.
 */
function repoRoot(): string {
  let dir = process.cwd();
  for (;;) {
    if (existsSync(join(dir, 'deploy')) && existsSync(join(dir, 'server'))) return dir;
    const parent = dirname(dir);
    if (parent === dir) throw new Error(`Repo root not found from ${process.cwd()}`);
    dir = parent;
  }
}

describe('Content-Security-Policy', () => {
  // The R and Python labs download their WebAssembly runtimes and packages at
  // page load rather than being bundled. Under `connect-src 'self'` the browser
  // blocks all three origins and no lab can start — and the failure surfaces
  // inside R as a libcurl "Timeout was reached", not as a CSP error, which is
  // exactly how it went undiagnosed before.
  it('permits the WebR and Pyodide origins in connect-src', () => {
    for (const origin of [WEBR_CDN, WEBR_PACKAGE_REPO, PYODIDE_CDN]) {
      expect(CSP_DIRECTIVES.connectSrc, `connect-src must allow ${origin}`).toContain(origin);
    }
  });

  // Chrome has enforced this since 97: with any script-src set and no
  // 'wasm-unsafe-eval', WebAssembly.instantiate throws and both lab runtimes
  // fail to boot. It enables WASM compilation only, not JavaScript eval().
  it("permits WebAssembly compilation via 'wasm-unsafe-eval'", () => {
    expect(CSP_DIRECTIVES.scriptSrc).toContain("'wasm-unsafe-eval'");
    expect(CSP_DIRECTIVES.scriptSrc).not.toContain("'unsafe-eval'");
  });

  // Both runtimes spawn their interpreter in a Web Worker created from a blob:
  // URL. worker-src falls back to child-src then default-src, so without an
  // explicit blob: the workers are blocked by `default-src 'self'`.
  it('permits blob: workers', () => {
    expect(CSP_DIRECTIVES.workerSrc).toContain('blob:');
  });

  it('adds upgrade-insecure-requests only to the https variant', () => {
    expect(buildCspHeader('https')).toContain('upgrade-insecure-requests');
    // On a plaintext listener this would rewrite every subresource request to
    // https and break asset loading outright.
    expect(buildCspHeader('http')).not.toContain('upgrade-insecure-requests');
  });

  it('renders directive names in kebab-case', () => {
    const header = buildCspHeader('https');
    expect(header).toContain('connect-src ');
    expect(header).toContain('worker-src ');
    expect(header).not.toContain('connectSrc');
  });
});

describe('generated nginx security-header blocks', () => {
  const root = repoRoot();

  // The policy has to exist in nginx as well as helmet: nginx serves the SPA's
  // index.html from disk and never reaches Express. It then has to be repeated
  // at every location that sets any add_header, because nginx drops inherited
  // headers from such a location and does not cascade into nested ones. That
  // left five hand-maintained copies, and they drifted — deploy.sh's inline
  // configs ended up with no CSP at all, which is how a deployment shipped its
  // pages unprotected. This asserts every committed copy still matches csp.ts.
  it.each(NGINX_GENERATED_TARGETS)('%s matches config/csp.ts', (relativePath) => {
    const path = resolve(root, relativePath);
    const current = readFileSync(path, 'utf8');
    const { content: expected, blocks } = renderSecurityHeaderBlocks(current);

    expect(blocks, `${relativePath} has no laila-security-headers markers`).toBeGreaterThan(0);
    expect(
      current === expected,
      `${relativePath} has drifted — run \`npm run csp:generate\` and commit the result`
    ).toBe(true);
  });

  it('covers every location that sets add_header in laila.conf', () => {
    const conf = readFileSync(resolve(root, 'deploy/nginx/laila.conf'), 'utf8');
    // Both the SPA catch-all and the nested index.html location must carry a
    // block; a missing one silently serves that path with no CSP.
    expect(conf.match(/# >>> laila-security-headers/g)).toHaveLength(2);
  });

  it('gives deploy.sh both of its inline nginx configs a policy', () => {
    const sh = readFileSync(resolve(root, 'deploy/deploy.sh'), 'utf8');
    // Two heredocs (localhost and pre-certbot) x two locations each.
    expect(sh.match(/# >>> laila-security-headers/g)).toHaveLength(4);
    // These listeners are plaintext, so they must use the http variant.
    expect(sh).not.toContain('# >>> laila-security-headers https >>>');
  });

  // The standalone snippet is the only way to fix a host that is already
  // installed: deploy.sh writes its nginx config once, at install time, and
  // re-running it would overwrite the live server/.env. Included by reference
  // so a certbot-managed config never has to be rewritten.
  describe('security-headers.conf snippet', () => {
    const snippet = readFileSync(resolve(root, 'deploy/nginx/security-headers.conf'), 'utf8');

    it('carries exactly one generated block, in the https variant', () => {
      expect(snippet.match(/# >>> laila-security-headers/g)).toHaveLength(1);
      // It is included by TLS-terminating hosts, so HSTS and
      // upgrade-insecure-requests belong here — unlike deploy.sh's listeners.
      expect(snippet).toContain('# >>> laila-security-headers https >>>');
      expect(snippet).toContain('Strict-Transport-Security');
    });

    it('contains only directives, so it is valid inside a location block', () => {
      const code = snippet
        .split('\n')
        .filter((line) => line.trim() && !line.trim().startsWith('#'));
      // An `include` is spliced in where it appears; a stray server/location
      // wrapper here would be a syntax error at every include site.
      expect(code.every((line) => line.trim().startsWith('add_header '))).toBe(true);
      expect(code.every((line) => line.trim().endsWith(';'))).toBe(true);
    });

    it('tells the operator how to install and include it', () => {
      // A snippet that is installed but never included is inert and looks like
      // success, so the instructions have to travel with the file.
      expect(snippet).toContain('include /etc/nginx/snippets/laila-security-headers.conf;');
      expect(snippet).toContain('update-nginx-headers.sh');
    });
  });
});
