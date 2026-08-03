#!/usr/bin/env node
/**
 * Build the open-source attribution list rendered by the About page.
 *
 * Reads the DIRECT dependencies of the client and server packages and looks up
 * each one's declared license and version from its installed package.json.
 * Direct dependencies only: the full transitive tree runs to thousands of
 * packages, which is what a machine-readable NOTICE file is for, not a page a
 * person reads.
 *
 * Run from the repo root after changing dependencies:
 *   node scripts/generate-third-party-licenses.mjs
 *
 * Output: client/src/data/third-party-licenses.json (committed, so the client
 * build needs no filesystem access and the list is reviewable in a diff).
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'client/src/data/third-party-licenses.json');

const readJson = p => JSON.parse(readFileSync(p, 'utf8'));

/**
 * Packages whose declared `license` field is not machine-readable. Leaving
 * these as-is would print "SEE LICENSE IN LICENCE.md" on an attribution page,
 * which attributes nothing. Resolved by reading the referenced file.
 */
const OVERRIDES = {
  webr: {
    license: 'GPL-2.0 / GPL-3.0 (bundles R)',
    note: 'Ships a WebAssembly build of R and its toolchain; see the package LICENCE.md for the full component list (R, libgfortran, PCRE2, XZ Utils and others).',
  },
};

/** Declared license, normalising the legacy {type} object and dual licenses. */
function licenseOf(pkg) {
  if (typeof pkg.license === 'string') return pkg.license;
  if (pkg.license?.type) return pkg.license.type;
  if (Array.isArray(pkg.licenses)) {
    return pkg.licenses.map(l => l.type ?? l).join(' OR ');
  }
  return 'UNKNOWN';
}

function collect(workspace) {
  const pkgPath = path.join(ROOT, workspace, 'package.json');
  const deps = Object.keys(readJson(pkgPath).dependencies ?? {});
  const out = [];
  for (const name of deps.sort()) {
    const installed = path.join(ROOT, workspace, 'node_modules', name, 'package.json');
    if (!existsSync(installed)) {
      out.push({ name, version: null, license: 'NOT INSTALLED', homepage: null });
      continue;
    }
    const pkg = readJson(installed);
    const override = OVERRIDES[name];
    out.push({
      name,
      version: pkg.version ?? null,
      license: override?.license ?? licenseOf(pkg),
      homepage: pkg.homepage ?? pkg.repository?.url?.replace(/^git\+|\.git$/g, '') ?? null,
      ...(override?.note ? { note: override.note } : {}),
    });
  }
  return out;
}

const client = collect('client');
const server = collect('server');
const all = [...client, ...server];

// The Carm license text is embedded here rather than imported with Vite's
// `?raw`, because LICENSE sits at the repo root — outside the client's Vite
// root — and importing across that boundary trips `server.fs.allow`.
const carmLicense = readFileSync(path.join(ROOT, 'LICENSE'), 'utf8').trim();

// Version comes from the licence heading, never a literal in the page — a
// hardcoded "v1.3" beside v1.4 text is worse than showing no version at all.
const carmLicenseVersion = carmLicense.match(/^#\s*(.+)$/m)?.[1]?.trim() ?? 'Carm Research License';

// Tally so the page can lead with "N packages under M licenses" without
// recomputing it in the browser.
const byLicense = {};
for (const d of all) byLicense[d.license] = (byLicense[d.license] ?? 0) + 1;

mkdirSync(path.dirname(OUT), { recursive: true });
writeFileSync(
  OUT,
  JSON.stringify(
    {
      generatedFrom: 'direct dependencies of client/package.json and server/package.json',
      carmLicense,
      carmLicenseVersion,
      counts: { total: all.length, client: client.length, server: server.length },
      byLicense: Object.fromEntries(Object.entries(byLicense).sort((a, b) => b[1] - a[1])),
      client,
      server,
    },
    null,
    2
  ) + '\n'
);

const unknown = all.filter(d => d.license === 'UNKNOWN' || d.license === 'NOT INSTALLED');
console.log(`wrote ${path.relative(ROOT, OUT)}`);
console.log(`  ${all.length} packages (${client.length} client, ${server.length} server)`);
console.log(`  licenses: ${Object.entries(byLicense).map(([k, v]) => `${k}=${v}`).join(', ')}`);
if (unknown.length) console.log(`  ⚠ needs attention: ${unknown.map(d => d.name).join(', ')}`);
