import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

import { collectBuildInfo } from '../scripts/build-info.mjs';
import { buildCspHeader } from '../server/src/config/csp';

/**
 * Ship the Content-Security-Policy inside index.html itself.
 *
 * A CSP delivered as an HTTP header only reaches pages the sender actually
 * serves. Where nginx fronts the app it serves index.html straight from disk,
 * so Express — and therefore helmet — never sees that request, and the pages go
 * out with no policy at all while the header sits uselessly on /api responses.
 * Fixing that per host means editing nginx on every server.
 *
 * A `<meta http-equiv>` travels with the bundle instead, so an ordinary code
 * deploy protects every host regardless of what is in front of it. Same source
 * as the header (server/src/config/csp.ts), so the two cannot disagree.
 *
 * Two deliberate constraints:
 *
 *  - The `http` variant is used, i.e. without `upgrade-insecure-requests`. The
 *    same built HTML may be served over plain HTTP (a localhost install), where
 *    that directive rewrites every subresource request to https and breaks
 *    asset loading outright. TLS hosts still get it from the header.
 *  - `head-prepend`, because a meta policy only governs content that appears
 *    after it. Anything the browser has already started fetching is beyond its
 *    reach.
 *
 * Where a header is ALSO present the browser enforces both policies
 * independently, so the effective result is their intersection. That is safe
 * here: the meta policy is the header's directives minus one, never stricter.
 *
 * Build only. In dev, Vite serves its own HTML with inline HMR machinery that
 * `script-src 'self'` would block.
 */
function cspMetaTag() {
  return {
    name: 'laila-csp-meta',
    apply: 'build' as const,
    transformIndexHtml() {
      return [
        {
          tag: 'meta',
          attrs: {
            'http-equiv': 'Content-Security-Policy',
            content: buildCspHeader('http'),
          },
          injectTo: 'head-prepend' as const,
        },
      ];
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  // Baked in at build time so the About page can state exactly which artifact
  // is being served. Injected as a constant rather than written to a file so
  // nothing generated has to be committed or gitignored. Shares its collector
  // with the server's stamp, so the two cannot report different commits.
  const buildInfo = collectBuildInfo(path.resolve(__dirname, 'package.json'));

  return {
    define: {
      __BUILD_INFO__: JSON.stringify(buildInfo),
    },
    plugins: [react(), cspMetaTag()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    optimizeDeps: {
      exclude: ['pyodide'],
    },
    server: {
      port: parseInt(env.VITE_PORT || '5174'),
      strictPort: true,   // fail instead of drifting to 5175, 5176, …
      proxy: {
        '/api': {
          target: env.VITE_API_TARGET || 'http://127.0.0.1:5001',
          changeOrigin: true,
        },
        '/uploads': {
          target: env.VITE_API_TARGET || 'http://127.0.0.1:5001',
          changeOrigin: true,
        },
      },
    },
  };
});
