/**
 * The LAILA plugin builder.
 *
 * Turns a plugin source tree into a `.laila-plugin.zip`: a CommonJS server
 * bundle, an ES-module client bundle, and the manifest, migrations and locale
 * files copied verbatim.
 *
 * ## The one interesting part: sharing React
 *
 * A plugin's client half must use **LAILA's** React instance, not its own. Two
 * React copies in one page means `useState` throws "invalid hook call", context
 * reads `undefined`, and portals land in the wrong tree — the failure is total
 * and the error message points nowhere near the cause.
 *
 * The host publishes its instance on `window.__LAILA_PLUGIN_HOST__`. This
 * builder rewrites `import { useState } from 'react'` to read from there, so a
 * plugin author writes ordinary imports and never thinks about it.
 *
 * The rewrite needs explicit export names, because you cannot re-export the
 * properties of a runtime object with `export *` — ES module exports are
 * static. So the shared modules' export lists are enumerated below. A name
 * missing from a list fails at *build* time with a clear message, which is far
 * better than `undefined is not a function` in a student's browser.
 */

import esbuild from 'esbuild';
import fs from 'fs/promises';
import path from 'path';
import JSZip from 'jszip';

/** Must match `HOST_GLOBAL` in `client/src/plugins/host.ts`. */
const HOST_GLOBAL = '__LAILA_PLUGIN_HOST__';

/**
 * Modules the host shares, and the names it re-exports from each.
 *
 * Kept deliberately short: every entry is a permanent compatibility promise.
 * Anything not listed here a plugin bundles for itself.
 */
const SHARED_MODULES = {
  react: [
    'useState', 'useEffect', 'useMemo', 'useCallback', 'useRef', 'useContext',
    'useReducer', 'useLayoutEffect', 'useId', 'useSyncExternalStore',
    'useTransition', 'useDeferredValue', 'useImperativeHandle', 'useDebugValue',
    'createElement', 'cloneElement', 'createContext', 'createRef', 'forwardRef',
    'memo', 'lazy', 'Suspense', 'Fragment', 'StrictMode', 'Children',
    'isValidElement', 'startTransition', 'Component', 'PureComponent',
  ],
  'react/jsx-runtime': ['jsx', 'jsxs', 'Fragment'],
  'react/jsx-dev-runtime': ['jsxDEV', 'Fragment'],
  'react-dom': ['createPortal', 'flushSync'],
};

/**
 * An esbuild plugin that resolves the shared specifiers to a generated module
 * reading from the host global.
 */
const hostSharePlugin = {
  name: 'laila-host-share',
  setup(build) {
    const filter = new RegExp(
      `^(${Object.keys(SHARED_MODULES).map((m) => m.replace('/', '\\/')).join('|')})$`,
    );

    build.onResolve({ filter }, (args) => ({
      path: args.path,
      namespace: 'laila-host',
    }));

    build.onLoad({ filter: /.*/, namespace: 'laila-host' }, (args) => {
      const names = SHARED_MODULES[args.path];
      // `jsxDEV` only exists in React's development build. Falling back to the
      // production `jsx` keeps a plugin built in dev mode from crashing on a
      // production host, where the dev runtime is absent.
      const lines = [
        `const __host = globalThis.${HOST_GLOBAL};`,
        `if (!__host) throw new Error(${JSON.stringify(
          'LAILA plugin host is not installed — this bundle must be loaded by LAILA, not opened directly',
        )});`,
        `const __m = __host.modules[${JSON.stringify(args.path)}];`,
        `if (!__m) throw new Error(${JSON.stringify(
          `LAILA does not share "${args.path}" with plugins`,
        )});`,
        `export default __m.default ?? __m;`,
        ...names.map((n) =>
          n === 'jsxDEV'
            ? `export const jsxDEV = __m.jsxDEV ?? __m.jsx;`
            : `export const ${n} = __m[${JSON.stringify(n)}];`,
        ),
      ];
      return { contents: lines.join('\n'), loader: 'js' };
    });
  },
};

/**
 * Build a plugin.
 *
 * @param {object} opts
 * @param {string} opts.root the plugin source directory (holds laila-plugin.json)
 * @param {string} [opts.outDir] where to write the zip (default `<root>/dist`)
 * @param {boolean} [opts.minify]
 * @returns {Promise<{zipPath: string, manifest: object, bytes: number}>}
 */
export async function buildPlugin({ root, outDir, minify = true }) {
  const manifestPath = path.join(root, 'laila-plugin.json');
  let manifest;
  try {
    manifest = JSON.parse(await fs.readFile(manifestPath, 'utf8'));
  } catch (e) {
    throw new Error(`Cannot read ${manifestPath}: ${e.message}`);
  }
  if (!manifest.id) throw new Error('laila-plugin.json has no "id"');

  const out = outDir ?? path.join(root, 'dist');
  await fs.mkdir(out, { recursive: true });
  const zip = new JSZip();

  // --- server half: CommonJS, because the LAILA server compiles to CJS ------
  if (manifest.server?.entry) {
    const srcEntry = path.join(root, manifest.server.entry.replace(/\.cjs$/, '.ts'));
    const entry = (await exists(srcEntry)) ? srcEntry : path.join(root, manifest.server.entry);
    const result = await esbuild.build({
      entryPoints: [entry],
      bundle: true,
      platform: 'node',
      target: 'node20',
      format: 'cjs',
      minify,
      write: false,
      // The host passes `api` in; a plugin must never bundle a second copy of
      // anything it reaches through it.
      external: ['@prisma/client', 'express'],
    });
    zip.file(manifest.server.entry, result.outputFiles[0].text);
  }

  // --- client half: ESM, React externalised to the host --------------------
  if (manifest.client?.entry) {
    const candidates = ['.tsx', '.ts', '.jsx', '.js'].map((ext) =>
      path.join(root, manifest.client.entry.replace(/\.js$/, ext)),
    );
    let entry = null;
    for (const c of candidates) if (await exists(c)) { entry = c; break; }
    if (!entry) throw new Error(`No source found for client entry "${manifest.client.entry}"`);

    const result = await esbuild.build({
      entryPoints: [entry],
      bundle: true,
      platform: 'browser',
      target: 'es2020',
      format: 'esm',
      minify,
      write: false,
      jsx: 'automatic',
      plugins: [hostSharePlugin],
    });
    zip.file(manifest.client.entry, result.outputFiles[0].text);

    for (const style of manifest.client.styles ?? []) {
      zip.file(style, await fs.readFile(path.join(root, style)));
    }
  }

  // --- verbatim copies -----------------------------------------------------
  zip.file('laila-plugin.json', JSON.stringify(manifest, null, 2));
  for (const dirKey of ['migrations', 'locales']) {
    if (!manifest[dirKey]) continue;
    await addDir(zip, path.join(root, manifest[dirKey]), manifest[dirKey]);
  }

  const buffer = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
  const zipPath = path.join(out, `${manifest.id}-${manifest.version}.laila-plugin.zip`);
  await fs.writeFile(zipPath, buffer);
  return { zipPath, manifest, bytes: buffer.length };
}

const exists = (p) => fs.access(p).then(() => true).catch(() => false);

async function addDir(zip, abs, rel) {
  let entries;
  try {
    entries = await fs.readdir(abs, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    const child = path.join(abs, entry.name);
    const childRel = `${rel}/${entry.name}`;
    if (entry.isDirectory()) await addDir(zip, child, childRel);
    else zip.file(childRel, await fs.readFile(child));
  }
}

// CLI: `node build.mjs [pluginDir]`
if (import.meta.url === `file://${process.argv[1]}`) {
  const root = path.resolve(process.argv[2] ?? '.');
  buildPlugin({ root })
    .then(({ zipPath, manifest, bytes }) => {
      console.log(`Built ${manifest.id}@${manifest.version} → ${zipPath} (${bytes} bytes)`);
    })
    .catch((err) => {
      console.error(`Build failed: ${err.message}`);
      process.exit(1);
    });
}
