/**
 * Single source of truth for the Content-Security-Policy and the rest of the
 * document security headers.
 *
 * The policy unavoidably exists in more than one place. helmet only decorates
 * responses Express actually handles; when nginx fronts the app it serves the
 * SPA's index.html straight from disk and never reaches Express, so nginx has
 * to declare the same policy itself. Historically the copies drifted — see the
 * `deploy.sh-embeds-its-own-nginx` note in LEARNINGS.md, and the fact that
 * lailalms.net shipped with no document CSP at all because deploy.sh's inline
 * nginx configs never had one.
 *
 * So nothing below is written twice by hand. Everything is derived from
 * CSP_DIRECTIVES:
 *   - `server/src/index.ts` passes it to helmet
 *   - `npm run csp:generate` rewrites the marked regions in
 *     `deploy/nginx/laila.conf` and `deploy/deploy.sh`
 *   - `csp.test.ts` fails if any committed copy has drifted from this file
 *
 * To change the policy: edit here, run `npm run csp:generate`, commit both.
 */

/** WebR downloads its WebAssembly build of R from here (default `baseUrl`). */
export const WEBR_CDN = 'https://webr.r-wasm.org';

/** ...and its R packages from here (default `repoUrl`). */
export const WEBR_PACKAGE_REPO = 'https://repo.r-wasm.org';

/** Pyodide's runtime and wheels. Pinned in `client/src/hooks/useLabPyodide.ts`. */
export const PYODIDE_CDN = 'https://cdn.jsdelivr.net';

/**
 * Google Fonts, linked from `client/index.html` — the stylesheet comes from one
 * origin and the font files from another.
 *
 * These are not optional extras: without them the policy silently blocks the
 * Inter webfont and the app falls back to a system font. `'unsafe-inline'` in
 * style-src does not help — it covers inline styles, not an external
 * stylesheet, which is matched against the source list like any other fetch.
 */
export const GOOGLE_FONTS_CSS = 'https://fonts.googleapis.com';
export const GOOGLE_FONTS_FILES = 'https://fonts.gstatic.com';

/**
 * Directive names are camelCase because that is what helmet expects; the nginx
 * generator converts them to the kebab-case the header actually uses.
 */
export const CSP_DIRECTIVES = {
  defaultSrc: ["'self'"],

  // 'wasm-unsafe-eval' is required to compile WebAssembly at all. Chrome has
  // enforced this since 97: without it `WebAssembly.instantiate` throws under
  // any policy that sets script-src, which would take out both the R and the
  // Python labs. It permits WASM compilation only — it does NOT re-enable
  // eval() for JavaScript, which is why it is preferred over 'unsafe-eval'.
  scriptSrc: ["'self'", "'wasm-unsafe-eval'"],

  // 'unsafe-inline' covers Tailwind and React inline styles — a deliberate,
  // standard relaxation. It does NOT cover the Google Fonts stylesheet, which
  // is an external fetch and has to be listed as an origin.
  styleSrc: ["'self'", "'unsafe-inline'", GOOGLE_FONTS_CSS],

  imgSrc: ["'self'", 'data:', 'blob:'],
  fontSrc: ["'self'", GOOGLE_FONTS_FILES],

  // The labs are not bundled: WebR and Pyodide fetch their runtimes and
  // packages at page load. Under `'self'` alone the browser blocks all three
  // origins and no lab can start — the failure surfaces inside R as a libcurl
  // "Timeout was reached", not as a CSP error, so it is easy to misdiagnose.
  connectSrc: ["'self'", 'ws:', 'wss:', WEBR_CDN, WEBR_PACKAGE_REPO, PYODIDE_CDN],

  // Both runtimes run their interpreter in a Web Worker spawned from a blob:
  // URL. worker-src falls back to child-src and then to default-src, so
  // without this the workers are blocked by `default-src 'self'`.
  workerSrc: ["'self'", 'blob:'],

  // Allow embedding lecture videos from common providers (the rest of the app
  // frames nothing). Uploaded videos are same-origin via media.
  frameSrc: [
    "'self'",
    'https://www.youtube.com',
    'https://www.youtube-nocookie.com',
    'https://player.vimeo.com',
  ],

  objectSrc: ["'none'"],
} as const;

/**
 * The non-CSP security headers nginx must set on the SPA document. helmet sets
 * its own equivalents on the responses Express handles.
 *
 * `Strict-Transport-Security` is deliberately absent here and added only for
 * the https variant — sending HSTS from a plaintext listener is meaningless at
 * best, and on the pre-certbot HTTP config it would pin a host to https before
 * a certificate exists.
 */
export const NGINX_SECURITY_HEADERS: ReadonlyArray<readonly [string, string]> = [
  ['X-Frame-Options', 'SAMEORIGIN'],
  ['X-Content-Type-Options', 'nosniff'],
  ['Referrer-Policy', 'strict-origin-when-cross-origin'],
];

export const HSTS_HEADER: readonly [string, string] = [
  'Strict-Transport-Security',
  'max-age=31536000; includeSubDomains',
];

/** `connectSrc` -> `connect-src` */
function toKebabCase(name: string): string {
  return name.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);
}

/**
 * Render the policy as the single-line string an HTTP header carries.
 *
 * @param scheme  'https' adds `upgrade-insecure-requests`. It is omitted for
 *                'http' because on a plaintext listener (localhost, or the
 *                pre-certbot config) it would rewrite every subresource
 *                request to https and break asset loading outright.
 */
export function buildCspHeader(scheme: 'http' | 'https'): string {
  const directives = Object.entries(CSP_DIRECTIVES).map(
    ([name, values]) => `${toKebabCase(name)} ${values.join(' ')}`
  );
  if (scheme === 'https') directives.push('upgrade-insecure-requests');
  return directives.join('; ');
}

/**
 * Render the full `add_header` block for an nginx location.
 *
 * nginx's `add_header` does not inherit into a location that declares any
 * `add_header` of its own, and does not cascade into nested locations either,
 * so this block has to be repeated verbatim at every level that sets headers.
 * That repetition is exactly what this generator exists to keep honest.
 */
export function buildNginxHeaderBlock(scheme: 'http' | 'https', indent: string): string {
  const headers: Array<readonly [string, string]> = [
    ['Content-Security-Policy', buildCspHeader(scheme)],
    ...NGINX_SECURITY_HEADERS,
  ];
  if (scheme === 'https') headers.push(HSTS_HEADER);

  return headers
    .map(([name, value]) => `${indent}add_header ${name} "${value}" always;`)
    .join('\n');
}

/**
 * Delimits a generated block in an nginx config or in deploy.sh's heredocs:
 *
 *   # >>> laila-security-headers <scheme> >>>
 *   ...generated add_header lines...
 *   # <<< laila-security-headers <<<
 *
 * Captures the indent (1) and the scheme (2). `[\s\S]*?` is lazy so two
 * adjacent blocks in one file cannot be swallowed into a single match.
 */
const BLOCK_RE =
  /^([ \t]*)# >>> laila-security-headers (http|https) >>>\n[\s\S]*?^[ \t]*# <<< laila-security-headers <<<$/gm;

/**
 * Rewrite every marked block in `content` from the definitions above.
 *
 * Deliberately pure — it takes and returns text and touches no filesystem — so
 * the generator script and the drift test share one implementation and cannot
 * disagree about what "correct" means.
 */
export function renderSecurityHeaderBlocks(content: string): {
  content: string;
  blocks: number;
} {
  let blocks = 0;

  const rendered = content.replace(BLOCK_RE, (_match, indent: string, scheme: string) => {
    blocks += 1;
    return [
      `${indent}# >>> laila-security-headers ${scheme} >>>`,
      buildNginxHeaderBlock(scheme as 'http' | 'https', indent),
      `${indent}# <<< laila-security-headers <<<`,
    ].join('\n');
  });

  return { content: rendered, blocks };
}

/** Files carrying generated blocks, relative to the repository root. */
export const NGINX_GENERATED_TARGETS = [
  'deploy/nginx/laila.conf',
  'deploy/deploy.sh',
  // Standalone snippet for hosts that are already installed: deploy.sh's
  // inline configs are only written during install, and re-running the
  // installer would overwrite the live server/.env. Included by reference so
  // an existing (possibly certbot-managed) config never has to be rewritten.
  'deploy/nginx/security-headers.conf',
] as const;
