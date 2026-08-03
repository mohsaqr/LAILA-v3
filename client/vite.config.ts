import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

import { collectBuildInfo } from '../scripts/build-info.mjs';

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
    plugins: [react()],
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
