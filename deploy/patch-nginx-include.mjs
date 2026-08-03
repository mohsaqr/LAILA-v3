/**
 * Insert the LAILA security-header `include` into an nginx site config.
 *
 *   node deploy/patch-nginx-include.mjs <config> [--snippet <path>] [--check]
 *
 * Adds the include as the first directive inside every location that serves
 * the SPA document — `location / { … }` and any nested `location = /index.html
 * { … }`. Both are required: nginx discards every inherited add_header from a
 * location that declares one of its own, and does not cascade them into nested
 * locations, so the nested block needs its own copy or the actual page is
 * served with no headers.
 *
 * Idempotent. Running it twice changes nothing, so it is safe from a cron or a
 * re-run of the installer.
 *
 * Prints the patched config to stdout; the caller writes it, tests it with
 * `nginx -t`, and restores its backup if that fails. Exits 0 with no output
 * when nothing needed changing. `--check` reports what it would do and exits 1
 * if the config is missing an include.
 */
import { readFileSync } from 'node:fs';

const DEFAULT_SNIPPET = '/etc/nginx/snippets/laila-security-headers.conf';

const args = process.argv.slice(2);
const configPath = args.find((a) => !a.startsWith('--'));
const checkOnly = args.includes('--check');
const snippetIdx = args.indexOf('--snippet');
const snippet = snippetIdx === -1 ? DEFAULT_SNIPPET : args[snippetIdx + 1];

if (!configPath) {
  console.error('usage: node patch-nginx-include.mjs <config> [--snippet <path>] [--check]');
  process.exit(2);
}

const INCLUDE = `include ${snippet};`;

/**
 * `location / {` — the SPA catch-all. The path must be exactly `/`, so
 * `location /api/ {` and friends are left alone.
 */
const SPA_LOCATION = /^(\s*)location\s+\/\s*\{\s*$/;

/** `location = /index.html {` — the nested exact-match block. */
const INDEX_LOCATION = /^(\s*)location\s*=\s*\/index\.html\s*\{\s*$/;

const lines = readFileSync(configPath, 'utf8').split('\n');
const out = [];
const added = [];

for (let i = 0; i < lines.length; i += 1) {
  const line = lines[i];
  out.push(line);

  const match = line.match(SPA_LOCATION) ?? line.match(INDEX_LOCATION);
  if (!match) continue;

  const indent = `${match[1]}    `;
  const label = line.trim().replace(/\s*\{$/, '');

  // Only look as far as this block's own closing brace, so an include that
  // belongs to a sibling block is never mistaken for this one's. Depth starts
  // at 1 for the brace just consumed.
  let depth = 1;
  let present = false;
  for (let j = i + 1; j < lines.length && depth > 0; j += 1) {
    const inner = lines[j];
    if (inner.includes(snippet)) {
      present = true;
      break;
    }
    depth += (inner.match(/\{/g) ?? []).length;
    depth -= (inner.match(/\}/g) ?? []).length;
  }

  if (!present) {
    out.push(`${indent}${INCLUDE}`);
    added.push(label);
  }
}

if (added.length === 0) {
  console.error(`✓ ${configPath}: include already present in every SPA location`);
  process.exit(0);
}

if (checkOnly) {
  console.error(`✗ ${configPath}: missing the include in ${added.length} location(s):`);
  for (const label of added) console.error(`    ${label}`);
  process.exit(1);
}

console.error(`  adding the include to ${added.length} location(s):`);
for (const label of added) console.error(`    ${label}`);

process.stdout.write(out.join('\n'));
