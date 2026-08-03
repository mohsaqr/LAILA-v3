/**
 * Regenerate the nginx security-header blocks from server/src/config/csp.ts.
 *
 *   npm run csp:generate     rewrite the blocks in place
 *   npm run csp:check        exit 1 if any committed block has drifted
 *
 * nginx needs its own copy of the policy because it serves the SPA's
 * index.html from disk and never reaches Express, and it needs that copy
 * repeated at every location that sets any add_header (nginx drops inherited
 * headers from a location declaring its own, and does not cascade into nested
 * locations). Keeping those copies in step by hand is what failed before; this
 * regenerates all of them from one definition.
 *
 * All the rewriting logic lives in config/csp.ts as a pure function so this
 * script and config/csp.test.ts cannot disagree. Only file I/O is here.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

import { NGINX_GENERATED_TARGETS, renderSecurityHeaderBlocks } from '../src/config/csp.js';

/**
 * Walk up from the current directory to the repository root.
 *
 * Neither `__dirname` nor `import.meta.url` is portable here: the package is
 * CommonJS (so import.meta is rejected) while vitest may load the same code as
 * ESM (where __dirname is undefined). Walking up from cwd works under both.
 */
function findRepoRoot(): string {
  let dir = process.cwd();
  for (;;) {
    if (existsSync(join(dir, 'deploy')) && existsSync(join(dir, 'server'))) return dir;
    const parent = dirname(dir);
    if (parent === dir) {
      throw new Error(`Could not locate the repository root walking up from ${process.cwd()}`);
    }
    dir = parent;
  }
}

function main(): void {
  const checkOnly = process.argv.includes('--check');
  const root = findRepoRoot();

  let drifted = 0;
  let totalBlocks = 0;

  for (const relativePath of NGINX_GENERATED_TARGETS) {
    const path = resolve(root, relativePath);
    const current = readFileSync(path, 'utf8');
    const { content: next, blocks } = renderSecurityHeaderBlocks(current);
    totalBlocks += blocks;

    if (blocks === 0) {
      console.error(`✗ ${relativePath}: no laila-security-headers markers found`);
      console.error('  Restore the markers, or remove the file from NGINX_GENERATED_TARGETS.');
      process.exit(1);
    }

    if (next === current) {
      if (!checkOnly) console.log(`  unchanged  ${relativePath} (${blocks} block(s))`);
      continue;
    }

    drifted += 1;
    if (checkOnly) {
      console.error(`✗ ${relativePath} has drifted from server/src/config/csp.ts`);
    } else {
      writeFileSync(path, next);
      console.log(`  updated    ${relativePath} (${blocks} block(s))`);
    }
  }

  if (checkOnly) {
    if (drifted > 0) {
      console.error('\nRun `npm run csp:generate` and commit the result.');
      process.exit(1);
    }
    console.log(`✓ ${totalBlocks} nginx security-header blocks match server/src/config/csp.ts`);
  }
}

main();
