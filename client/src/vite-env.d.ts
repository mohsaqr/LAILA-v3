/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

/**
 * Build identity, injected at compile time by `define` in vite.config.ts (and
 * mirrored in vitest.config.ts so tests see the same shape). Shown on the
 * About page so a served bundle can be traced back to an exact commit — the
 * version alone only moves when someone bumps it.
 */
declare const __BUILD_INFO__: {
  version: string;
  gitSha: string | null;
  gitBranch: string | null;
  gitDirty: boolean | null;
  builtAt: string;
};
