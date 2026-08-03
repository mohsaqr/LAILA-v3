/**
 * Check a live LAILA deployment from the outside.
 *
 *   node scripts/verify-deployment.mjs https://laila.example.com
 *   node scripts/verify-deployment.mjs https://laila.example.com --expect-version 3.9.0
 *   node scripts/verify-deployment.mjs https://laila.example.com --quick
 *
 * Written after a deployment reported success while serving week-old
 * artifacts. Everything about it looked fine from the shell: the service was
 * up, the database healthy, /api/health returned 200. What was actually wrong
 * only showed up by diffing bundle sizes by hand.
 *
 * So this checks the things that were silently wrong, from outside, over HTTP:
 *
 *   1. the service is up and can say which commit it is running
 *   2. the SPA *document* carries its security headers — not the API, which is
 *      where they were present and useless
 *   3. the CSP still permits the WebR and Pyodide origins, so the R and Python
 *      labs can start
 *   4. the About page — the licence and open-source attribution — is in the
 *      shipped bundle
 *
 * Exits non-zero if any check fails, so it can gate a deploy.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const TIMEOUT_MS = 20_000;

const args = process.argv.slice(2);
const baseUrl = args.find((a) => !a.startsWith('--'));
const quick = args.includes('--quick');
const expectVersionIdx = args.indexOf('--expect-version');
const expectVersion = expectVersionIdx === -1 ? null : args[expectVersionIdx + 1];

if (!baseUrl) {
  console.error('usage: node scripts/verify-deployment.mjs <url> [--expect-version X] [--quick]');
  process.exit(2);
}

const origin = baseUrl.replace(/\/+$/, '');
const isHttps = origin.startsWith('https://');

const results = [];
const pass = (name, detail = '') => results.push({ ok: true, name, detail });
const fail = (name, detail = '') => results.push({ ok: false, name, detail });
const note = (name, detail = '') => results.push({ ok: null, name, detail });

async function get(path, { text = false } = {}) {
  const res = await fetch(`${origin}${path}`, {
    signal: AbortSignal.timeout(TIMEOUT_MS),
    redirect: 'follow',
  });
  return { res, body: text ? await res.text() : null };
}

/**
 * Parse a Content-Security-Policy header into { directive: [tokens] }.
 * Directives are semicolon-separated; the first token is the name.
 */
function parseCsp(header) {
  const out = {};
  for (const part of header.split(';')) {
    const tokens = part.trim().split(/\s+/).filter(Boolean);
    if (tokens.length === 0) continue;
    out[tokens[0].toLowerCase()] = tokens.slice(1);
  }
  return out;
}

/**
 * The policy this repo considers correct, read from the generated block in
 * deploy/nginx/laila.conf. That block is generated from server/src/config/csp.ts
 * and drift-tested, so reading it here keeps one source of truth rather than
 * restating the origins in a third place.
 */
function expectedCsp() {
  const conf = readFileSync(join(REPO_ROOT, 'deploy', 'nginx', 'laila.conf'), 'utf8');
  const match = conf.match(/add_header Content-Security-Policy "([^"]+)"/);
  if (!match) throw new Error('No generated CSP found in deploy/nginx/laila.conf');
  return parseCsp(match[1]);
}

// ── 1. Service identity ────────────────────────────────────────────────────
async function checkHealth() {
  let res, body;
  try {
    ({ res, body } = await get('/api/health', { text: true }));
  } catch (err) {
    fail('service reachable', `${origin}/api/health — ${err.message}`);
    return null;
  }

  if (!res.ok) {
    fail('service healthy', `/api/health returned ${res.status}`);
    return null;
  }

  let health;
  try {
    health = JSON.parse(body);
  } catch {
    fail('service healthy', '/api/health did not return JSON');
    return null;
  }

  pass('service healthy', `${health.status}, db ${health.checks?.database?.status ?? 'unknown'}`);

  // The version alone cannot distinguish two builds — it only moves when
  // someone bumps it. The commit is what actually identifies an artifact.
  if (health.build?.gitSha) {
    const dirty = health.build.gitDirty ? ' (dirty tree)' : '';
    pass('build identified', `${health.version} @ ${health.build.gitSha}${dirty}`);
    if (health.build.builtAt) note('built at', health.build.builtAt);
  } else {
    fail(
      'build identified',
      `version ${health.version}, but no build.gitSha — this deployment predates the build stamp, ` +
        'so it cannot say which commit it is running'
    );
  }

  if (expectVersion) {
    if (health.version === expectVersion) pass('version matches', expectVersion);
    else fail('version matches', `expected ${expectVersion}, deployment reports ${health.version}`);
  }

  return health;
}

// ── 2 & 3. Document security headers and the lab origins ───────────────────
async function checkDocument() {
  let res, body;
  try {
    ({ res, body } = await get('/', { text: true }));
  } catch (err) {
    fail('SPA document reachable', err.message);
    return null;
  }

  if (!res.ok) {
    fail('SPA document reachable', `/ returned ${res.status}`);
    return null;
  }
  pass('SPA document reachable', `${res.status} ${res.headers.get('content-type') ?? ''}`.trim());

  // The header must be on the *document*. When nginx serves index.html from
  // disk, helmet never sees the request — the CSP then appears only on /api
  // responses, where it protects nothing, and the pages ship unprotected.
  const cspHeader = res.headers.get('content-security-policy');
  if (!cspHeader) {
    fail(
      'document has a CSP',
      'no Content-Security-Policy on the SPA document. If nginx fronts this host it must set ' +
        'the headers itself — see the generated block in deploy/nginx/laila.conf'
    );
  } else {
    pass('document has a CSP');

    const live = parseCsp(cspHeader);
    const want = expectedCsp();

    // WebR and Pyodide download their runtimes and packages at page load. If
    // connect-src does not allow them the labs cannot start, and the failure
    // surfaces inside R as a libcurl timeout rather than as a CSP error.
    const requiredOrigins = (want['connect-src'] ?? []).filter((t) => t.startsWith('https://'));
    const liveConnect = live['connect-src'] ?? [];
    const missingOrigins = requiredOrigins.filter((o) => !liveConnect.includes(o));
    if (missingOrigins.length === 0) {
      pass('CSP permits the lab runtimes', `${requiredOrigins.length} origins allowed`);
    } else {
      fail('CSP permits the lab runtimes', `connect-src is missing ${missingOrigins.join(', ')}`);
    }

    // Chrome refuses WebAssembly.instantiate under any script-src without this.
    const liveScript = live['script-src'] ?? [];
    if ((want['script-src'] ?? []).includes("'wasm-unsafe-eval'")) {
      if (liveScript.includes("'wasm-unsafe-eval'") || liveScript.includes("'unsafe-eval'")) {
        pass('CSP permits WebAssembly');
      } else {
        fail('CSP permits WebAssembly', "script-src lacks 'wasm-unsafe-eval'");
      }
    }

    // Both runtimes spawn their interpreter in a worker from a blob: URL.
    const liveWorker = live['worker-src'] ?? live['child-src'] ?? live['default-src'] ?? [];
    if (liveWorker.includes('blob:')) pass('CSP permits blob: workers');
    else fail('CSP permits blob: workers', 'worker-src (or its fallback) lacks blob:');
  }

  for (const [header, label] of [
    ['x-content-type-options', 'nosniff'],
    ['x-frame-options', 'X-Frame-Options'],
    ['referrer-policy', 'Referrer-Policy'],
  ]) {
    if (res.headers.get(header)) pass(`document sets ${label}`);
    else fail(`document sets ${label}`, `missing ${header} on the document response`);
  }

  if (isHttps) {
    if (res.headers.get('strict-transport-security')) pass('document sets HSTS');
    else fail('document sets HSTS', 'missing strict-transport-security');
  }

  return body;
}

// ── 4. The About page is actually in the shipped bundle ────────────────────
async function checkAboutShipped(indexHtml) {
  if (quick) {
    note('About page shipped', 'skipped (--quick)');
    return;
  }
  if (!indexHtml) return;

  const bundlePath = indexHtml.match(/\/assets\/index-[A-Za-z0-9_-]+\.js/)?.[0];
  if (!bundlePath) {
    fail('About page shipped', 'could not find the main bundle in index.html');
    return;
  }

  let body;
  try {
    ({ body } = await get(bundlePath, { text: true }));
  } catch (err) {
    fail('About page shipped', `could not fetch ${bundlePath} — ${err.message}`);
    return;
  }

  // The licence name is embedded in the bundle via the generated attribution
  // manifest. Its absence means the build predates the About page — which is
  // exactly how a deployment came to serve no licence notice at all.
  if (body.includes('Carm Research License')) {
    pass('About page shipped', `${bundlePath} (${Math.round(body.length / 1024)} KB)`);
  } else {
    fail(
      'About page shipped',
      `${bundlePath} contains no licence text — this build predates the About page, ` +
        'so the deployment serves no licence notice or open-source attribution'
    );
  }
}

// ── Run ────────────────────────────────────────────────────────────────────
console.log(`\nVerifying ${origin}\n`);

await checkHealth();
const indexHtml = await checkDocument();
await checkAboutShipped(indexHtml);

console.log('');
for (const { ok, name, detail } of results) {
  const mark = ok === null ? '·' : ok ? '✓' : '✗';
  const stream = ok === false ? console.error : console.log;
  stream(`  ${mark} ${name}${detail ? `: ${detail}` : ''}`);
}

const failed = results.filter((r) => r.ok === false).length;
const passed = results.filter((r) => r.ok === true).length;

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
