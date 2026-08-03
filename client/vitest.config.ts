import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

import { collectBuildInfo } from '../scripts/build-info.mjs';

export default defineConfig({
  // Mirrors vite.config.ts. Without it, anything importing a module that
  // reads __BUILD_INFO__ (the About page) fails on an undefined global under
  // test while working perfectly in a real build.
  define: {
    __BUILD_INFO__: JSON.stringify(collectBuildInfo(path.resolve(__dirname, 'package.json'))),
  },
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    coverage: {
      reporter: ['text', 'json', 'html'],
      exclude: ['node_modules/', 'src/test/'],
    },
  },
});
