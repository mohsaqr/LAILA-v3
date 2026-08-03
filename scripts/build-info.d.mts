/**
 * Types for build-info.mjs, which is plain ESM JavaScript so that both the
 * client's Vite config and the server's prebuild can run it without a compile
 * step. TypeScript resolves `.d.mts` for a `.mjs` import.
 */
export interface BuildInfo {
  version: string;
  gitSha: string | null;
  gitBranch: string | null;
  gitDirty: boolean | null;
  builtAt: string;
}

export declare const REPO_ROOT: string;

export declare function collectBuildInfo(packageJsonPath?: string): BuildInfo;

export declare function writeServerBuildInfo(): { target: string; info: BuildInfo };
