import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { tmpdir } from 'node:os';

/**
 * Tests for deploy/patch-nginx-include.mjs, which adds the security-header
 * `include` to a live nginx config.
 *
 * This runs unattended, as root, against a config that may be certbot-managed.
 * The two properties that make that acceptable are that it only ever touches
 * the locations serving the SPA document, and that running it twice is a no-op
 * — so they are asserted here rather than assumed.
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

const PATCHER = resolve(repoRoot(), 'deploy/patch-nginx-include.mjs');
const SNIPPET = '/etc/nginx/snippets/laila-security-headers.conf';

const CONFIG = `server {
    listen 443 ssl;
    server_name laila.example.com;

    location /api/ {
        proxy_pass http://127.0.0.1:5001;
    }

    location /assets/ {
        alias /opt/laila/client/dist/assets/;
        add_header Cache-Control "public, immutable";
    }

    location / {
        root /opt/laila/client/dist;
        try_files $uri $uri/ /index.html;

        location = /index.html {
            expires 5m;
            add_header Cache-Control "public, must-revalidate";
        }
    }
}
`;

let dir: string;
let configPath: string;

/** @returns stdout — empty when nothing needed changing. */
function patch(path: string): string {
  return execFileSync('node', [PATCHER, path, '--snippet', SNIPPET], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  });
}

function check(path: string): number {
  try {
    execFileSync('node', [PATCHER, path, '--snippet', SNIPPET, '--check'], { stdio: 'ignore' });
    return 0;
  } catch (err: any) {
    return err.status ?? 1;
  }
}

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'laila-nginx-'));
  configPath = join(dir, 'laila');
  writeFileSync(configPath, CONFIG);
});

afterEach(() => rmSync(dir, { recursive: true, force: true }));

describe('patch-nginx-include', () => {
  it('adds the include to both SPA locations', () => {
    const patched = patch(configPath);
    const includes = patched.match(new RegExp(`include ${SNIPPET};`, 'g')) ?? [];
    // `location /` and the nested `location = /index.html`. The nested one is
    // required: nginx drops inherited add_headers in a location that sets its
    // own (this one sets Cache-Control) and does not cascade into nested ones.
    expect(includes).toHaveLength(2);
  });

  // It runs as root against a config that may be certbot-managed, so leaving
  // anything else alone is the property that makes that safe.
  it('leaves other locations untouched', () => {
    const patched = patch(configPath);
    const apiBlock = patched.slice(patched.indexOf('location /api/'), patched.indexOf('location /assets/'));
    const assetsBlock = patched.slice(patched.indexOf('location /assets/'), patched.indexOf('location / {'));
    expect(apiBlock).not.toContain(SNIPPET);
    expect(assetsBlock).not.toContain(SNIPPET);
  });

  // Safe to re-run, and therefore safe from a cron or a repeated installer run.
  it('is idempotent', () => {
    writeFileSync(configPath, patch(configPath));
    expect(patch(configPath)).toBe('');
  });

  it('preserves the surrounding config verbatim', () => {
    const patched = patch(configPath);
    // Removing the lines it added must give back the original byte for byte —
    // nothing reindented, reordered or reformatted.
    const withoutAdded = patched
      .split('\n')
      .filter((line) => !line.includes(SNIPPET))
      .join('\n');
    expect(withoutAdded.trimEnd()).toBe(CONFIG.trimEnd());
  });

  it('--check reports unpatched then patched', () => {
    expect(check(configPath), 'unpatched config should exit 1').toBe(1);
    writeFileSync(configPath, patch(configPath));
    expect(check(configPath), 'patched config should exit 0').toBe(0);
  });

  it('does not match a location whose path merely starts with /', () => {
    writeFileSync(
      configPath,
      'server {\n    location /uploads/ {\n        proxy_pass http://127.0.0.1:5001;\n    }\n}\n'
    );
    expect(patch(configPath)).toBe('');
    expect(readFileSync(configPath, 'utf8')).not.toContain(SNIPPET);
  });
});
