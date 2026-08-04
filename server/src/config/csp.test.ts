import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

import {
  CSP_DIRECTIVES,
  GOOGLE_FONTS_CSS,
  GITHUB_RAW,
  GOOGLE_FONTS_FILES,
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

  // Lab notebooks load their datasets from GitHub. Without this the fetch is
  // blocked and R reports a ten-second libcurl timeout rather than anything
  // resembling a CSP error, which is exactly how it went misdiagnosed.
  // Only the raw host is listed: github.com/<o>/<r>/raw/... returns a 302 with
  // an empty access-control-allow-origin and can never work from a browser.
  it('permits the GitHub raw host in connect-src', () => {
    expect(CSP_DIRECTIVES.connectSrc).toContain(GITHUB_RAW);
    expect(CSP_DIRECTIVES.connectSrc).not.toContain('https://github.com');
  });

  // Chrome has enforced this since 97: with any script-src set and no
  // 'wasm-unsafe-eval', WebAssembly.instantiate throws and both lab runtimes
  // fail to boot. It enables WASM compilation only, not JavaScript eval().
  it("permits WebAssembly compilation via 'wasm-unsafe-eval'", () => {
    expect(CSP_DIRECTIVES.scriptSrc).toContain("'wasm-unsafe-eval'");
  });

  // This assertion used to be its inverse — script-src deliberately withheld
  // 'unsafe-eval' — and that is what silently broke the labs: webR's Emscripten
  // runtime calls eval() when it dynamically links libRblas.so, so R.js loaded
  // and then died on its first side module. It surfaced as an eternal
  // "Initializing R..." rather than an error, because the CSP NetworkError
  // became an unhandled rejection inside the worker and init() never settled.
  //
  // Keep the token. It is a genuine relaxation of the policy, accepted because
  // no configuration without it runs R at all — verified by bisecting the
  // deployed policy against a bare `new WebR()` page.
  it("permits eval() for webR's Emscripten runtime", () => {
    expect(CSP_DIRECTIVES.scriptSrc).toContain("'unsafe-eval'");
  });

  // Neither runtime is bundled: they fetch executable JavaScript from these
  // origins. webR's worker runs from a blob: and therefore inherits this
  // policy, so its importScripts of R.js is matched against script-src — being
  // listed in connect-src covers the worker bootstrap fetch but not the
  // scripts that worker goes on to load.
  it('permits the runtime CDNs in script-src, not just connect-src', () => {
    for (const origin of [WEBR_CDN, PYODIDE_CDN]) {
      expect(CSP_DIRECTIVES.scriptSrc, `script-src must allow ${origin}`).toContain(origin);
    }
    // R packages arrive as data for the virtual filesystem and are never
    // executed as JavaScript, so this one stays out of script-src.
    expect(CSP_DIRECTIVES.scriptSrc).not.toContain(WEBR_PACKAGE_REPO);
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

  // Without these the policy silently blocks the Inter webfont linked from
  // index.html and the app drops to a system font. 'unsafe-inline' in
  // style-src does not cover an external stylesheet — that is matched against
  // the source list like any other fetch.
  it('permits the Google Fonts origins', () => {
    expect(CSP_DIRECTIVES.styleSrc).toContain(GOOGLE_FONTS_CSS);
    expect(CSP_DIRECTIVES.fontSrc).toContain(GOOGLE_FONTS_FILES);
  });

  // `script-src 'self'` blocks inline scripts outright. index.html used to
  // carry one (the pre-paint dark-theme setter); it was moved to
  // public/theme-init.js so the policy needs no sha256 hash maintained across
  // helmet, the nginx blocks and the meta tag.
  describe('index.html stays compatible with the policy', () => {
    const indexHtml = readFileSync(resolve(repoRoot(), 'client/index.html'), 'utf8');

    it('has no inline script', () => {
      const inline = indexHtml.match(/<script(?![^>]*\ssrc=)[^>]*>[\s\S]*?<\/script>/gi) ?? [];
      expect(
        inline,
        "inline scripts are blocked by script-src 'self' — move it to a file under client/public/"
      ).toHaveLength(0);
    });

    it('loads the theme initialiser as a same-origin file', () => {
      expect(indexHtml).toContain('src="/theme-init.js"');
      expect(existsSync(resolve(repoRoot(), 'client/public/theme-init.js'))).toBe(true);
    });

    it('references only font origins the policy allows', () => {
      const externals = [...indexHtml.matchAll(/https:\/\/[a-z0-9.-]+/gi)].map((m) => m[0]);
      const allowed = [GOOGLE_FONTS_CSS, GOOGLE_FONTS_FILES];
      for (const origin of new Set(externals)) {
        expect(allowed, `${origin} is referenced by index.html but not allowed by the CSP`).toContain(
          origin
        );
      }
    });
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

  // nginx drops EVERY inherited add_header in a location that declares one of
  // its own, and does not cascade into nested locations. So every such location
  // needs its own block — three in laila.conf: the SPA catch-all, the nested
  // index.html, and /assets/, which sets Cache-Control and therefore shipped
  // the JS and CSS bundles with no nosniff at all.
  it('covers every location that sets add_header in laila.conf', () => {
    const conf = readFileSync(resolve(root, 'deploy/nginx/laila.conf'), 'utf8');
    expect(conf.match(/# >>> laila-security-headers/g)).toHaveLength(3);
  });

  it('gives deploy.sh both of its inline nginx configs a policy', () => {
    const sh = readFileSync(resolve(root, 'deploy/deploy.sh'), 'utf8');
    // Two heredocs (localhost and pre-certbot) x three locations each.
    expect(sh.match(/# >>> laila-security-headers/g)).toHaveLength(6);
    // These listeners are plaintext, so they must use the http variant.
    expect(sh).not.toContain('# >>> laila-security-headers https >>>');
  });

  // A location that declares add_header and has no block is the exact bug this
  // guards: it looks protected because the server block above sets headers, but
  // nginx has already discarded them for that location.
  it('leaves no add_header location in laila.conf without a block', () => {
    const conf = readFileSync(resolve(root, 'deploy/nginx/laila.conf'), 'utf8');
    // Split on location openings; any chunk with an add_header that is not a
    // generated one must also contain a marker.
    const chunks = conf.split(/^\s*location\s/m).slice(1);
    for (const chunk of chunks) {
      const body = chunk.slice(0, chunk.indexOf('\n    }'));
      const declaresOwn = /^\s*add_header\s+Cache-Control/m.test(body);
      if (!declaresOwn) continue;
      expect(
        body,
        `a location sets Cache-Control but has no security-header block: ${chunk.slice(0, 40)}`
      ).toContain('# >>> laila-security-headers');
    }
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
