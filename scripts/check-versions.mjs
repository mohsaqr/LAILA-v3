/**
 * Fail if the root, client and server package versions disagree.
 *
 * LAILA reports one version — /api/health serves the server's, the About page
 * shows the client's — so if they diverge the product misreports itself and
 * two deployments can look identical while differing. Bumping one and
 * forgetting the others is the easiest possible mistake; this makes it loud.
 *
 *   node scripts/check-versions.mjs
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

const PACKAGES = ['package.json', 'client/package.json', 'server/package.json'];

const found = PACKAGES.map((relativePath) => {
  const raw = readFileSync(join(REPO_ROOT, relativePath), 'utf8');
  return { relativePath, version: JSON.parse(raw).version };
});

const versions = new Set(found.map((p) => p.version));

if (versions.size === 1) {
  console.log(`✓ version ${found[0].version} is consistent across ${found.length} packages`);
  process.exit(0);
}

console.error('✗ package versions disagree:\n');
for (const { relativePath, version } of found) {
  console.error(`    ${version.padEnd(12)} ${relativePath}`);
}
console.error('\nSet all three to the same version before building or releasing.');
process.exit(1);
