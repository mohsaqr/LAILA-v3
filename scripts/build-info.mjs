/**
 * Collect the identity of a build: version, git commit, branch, timestamp.
 *
 * Why this exists: a LAILA deployment could not say what it was running.
 * `/api/health` reported `npm_package_version`, which node only populates when
 * the process is started through npm — the deployed service runs
 * `node dist/index.js` under systemd, so it fell back to a hardcoded string and
 * every release looked identical from outside. A stale deploy was therefore
 * indistinguishable from a fresh one, and one actually shipped week-old
 * artifacts without anything noticing.
 *
 * The version alone is not enough: it only changes when someone remembers to
 * bump it. The git SHA changes every commit, so it identifies a build exactly.
 *
 * Consumed by:
 *   - `node scripts/build-info.mjs` (from the server prebuild) which writes
 *     server/build-info.json, read at runtime and reported by /api/health
 *   - client/vite.config.ts, which injects it as a compile-time constant for
 *     the About page
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

/**
 * Run a git command, returning null rather than throwing.
 *
 * Everything here is best-effort by design: a deployment unpacked from a
 * tarball, or built in a container without the .git directory, still has to
 * boot. Missing git data degrades the stamp; it must never fail the build.
 */
function git(args) {
  try {
    return execFileSync('git', args, {
      cwd: REPO_ROOT,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    return null;
  }
}

/**
 * @param {string} packageJsonPath  package whose version this build carries
 * @returns {{version: string, gitSha: string|null, gitBranch: string|null,
 *            gitDirty: boolean|null, builtAt: string}}
 */
export function collectBuildInfo(packageJsonPath = join(REPO_ROOT, 'package.json')) {
  let version = 'unknown';
  try {
    version = JSON.parse(readFileSync(packageJsonPath, 'utf8')).version ?? 'unknown';
  } catch {
    // Leave 'unknown'; check-versions.mjs is what enforces this is readable.
  }

  const status = git(['status', '--porcelain']);

  return {
    version,
    gitSha: git(['rev-parse', '--short=12', 'HEAD']),
    gitBranch: git(['rev-parse', '--abbrev-ref', 'HEAD']),
    // A dirty tree means the artifact does not correspond to any commit —
    // worth surfacing, because it makes the SHA a half-truth.
    gitDirty: status === null ? null : status.length > 0,
    builtAt: new Date().toISOString(),
  };
}

/**
 * Write the server's stamp. Kept out of git (it changes every build); the
 * server tolerates its absence and falls back to package.json alone.
 */
export function writeServerBuildInfo() {
  const target = join(REPO_ROOT, 'server', 'build-info.json');
  const info = collectBuildInfo(join(REPO_ROOT, 'server', 'package.json'));
  writeFileSync(target, `${JSON.stringify(info, null, 2)}\n`);
  return { target, info };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const { info } = writeServerBuildInfo();
  const sha = info.gitSha ?? 'no-git';
  console.log(`build-info: ${info.version} @ ${sha}${info.gitDirty ? '-dirty' : ''}`);
}
