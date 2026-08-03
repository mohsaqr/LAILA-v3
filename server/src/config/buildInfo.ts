/**
 * What this running server actually is: version, commit, build time.
 *
 * `/api/health` used to report `process.env.npm_package_version`, which node
 * only sets when the process is started through npm. The deployed service runs
 * `node dist/index.js` under systemd, so it reported a hardcoded fallback and
 * every release looked the same from outside. A deployment that cannot name
 * itself cannot be verified — and one shipped week-old artifacts while
 * reporting success, which took a bundle-size diff to spot.
 *
 * `build-info.json` is written next to package.json by the prebuild step
 * (scripts/build-info.mjs) and is intentionally not committed: it changes on
 * every build. Its absence is not an error — a source checkout run with `tsx`
 * has never had one — so the version still comes from package.json and the git
 * fields simply read null.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';

export interface BuildInfo {
  version: string;
  gitSha: string | null;
  gitBranch: string | null;
  gitDirty: boolean | null;
  builtAt: string | null;
}

/**
 * Resolved relative to this file, which sits one level below the package root
 * as both `src/config/` -> `../../` and `dist/config/` -> `../../`.
 */
function packageRoot(): string {
  return path.join(__dirname, '..', '..');
}

function readJson(file: string): any | null {
  try {
    return JSON.parse(readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
}

function readText(file: string): string | null {
  try {
    return readFileSync(file, 'utf8').trim();
  } catch {
    return null;
  }
}

/**
 * Last-resort commit lookup: read `.git` directly.
 *
 * The stamp is normally written by the prebuild, but not every deploy path
 * runs it — DEPLOYMENT.md documents a rebuild that calls `npx tsc` directly,
 * which skips npm lifecycle scripts entirely. Since a deployment is a git
 * checkout anyway, the commit is right there on disk. No child process and no
 * git binary required, so this is safe to do at module load.
 *
 * Returns null for anything unusual (worktree, packed-refs miss, no .git) —
 * a missing SHA is honest, a wrong one is not.
 */
function readGitHead(repoRoot: string): { sha: string; branch: string | null } | null {
  const gitDir = path.join(repoRoot, '.git');
  const head = readText(path.join(gitDir, 'HEAD'));
  if (!head) return null;

  // Detached HEAD stores the sha directly.
  if (/^[0-9a-f]{40}$/.test(head)) return { sha: head.slice(0, 12), branch: null };

  const ref = head.match(/^ref:\s*(.+)$/)?.[1];
  if (!ref) return null;
  const branch = ref.replace(/^refs\/heads\//, '');

  // Loose ref first, then packed-refs (a freshly cloned deploy uses packed).
  const loose = readText(path.join(gitDir, ...ref.split('/')));
  if (loose && /^[0-9a-f]{40}$/.test(loose)) return { sha: loose.slice(0, 12), branch };

  const packed = readText(path.join(gitDir, 'packed-refs'));
  const fromPacked = packed
    ?.split('\n')
    .find((line) => line.endsWith(` ${ref}`))
    ?.split(' ')[0];

  return fromPacked && /^[0-9a-f]{40}$/.test(fromPacked)
    ? { sha: fromPacked.slice(0, 12), branch }
    : null;
}

function load(): BuildInfo {
  let root: string;
  try {
    root = packageRoot();
  } catch {
    // __dirname is absent if this module is ever loaded as ESM.
    return { version: 'unknown', gitSha: null, gitBranch: null, gitDirty: null, builtAt: null };
  }

  const pkg = readJson(path.join(root, 'package.json'));
  const stamp = readJson(path.join(root, 'build-info.json'));

  // The stamp is preferred: it records the commit as of the *build*, whereas
  // .git reflects the checkout right now. They differ if someone pulls without
  // rebuilding — which is exactly the failure this is all here to expose, so
  // the build-time value is the truthful one.
  const fallback = stamp?.gitSha ? null : readGitHead(path.join(root, '..'));

  return {
    // package.json is the authority on the version even when a stamp exists:
    // a stale build-info.json must never outrank the source of truth.
    version: pkg?.version ?? stamp?.version ?? 'unknown',
    gitSha: stamp?.gitSha ?? fallback?.sha ?? null,
    gitBranch: stamp?.gitBranch ?? fallback?.branch ?? null,
    // Only the prebuild can know this; .git alone cannot tell us cheaply.
    gitDirty: stamp?.gitDirty ?? null,
    builtAt: stamp?.builtAt ?? null,
  };
}

export const BUILD_INFO: BuildInfo = load();

/** Convenience for the many places that only want the version string. */
export const APP_VERSION: string = BUILD_INFO.version;
