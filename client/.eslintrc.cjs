/**
 * ESLint config for the client.
 *
 * This file was missing: every lint dependency was installed, `npm run lint`
 * was wired up in package.json, and CLAUDE.md documented it as a command — but
 * with no config ESLint 8 refuses to start, so the script had never been able
 * to run. The practical cost was `react-hooks`: the rules that catch a missing
 * effect dependency or a conditionally-called hook were installed and silent.
 *
 * Scope note: `@typescript-eslint` runs WITHOUT type-aware rules (no
 * `parserOptions.project`). Type-aware linting would duplicate what
 * `tsc --noEmit` already enforces in CI, at several times the runtime, so the
 * division of labour is deliberate — tsc owns types, ESLint owns the patterns
 * types cannot see.
 */
module.exports = {
  root: true,
  env: { browser: true, es2020: true, node: true },
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:react-hooks/recommended',
  ],
  ignorePatterns: [
    'dist',
    'build',
    'coverage',
    'node_modules',
    'public',
    '.eslintrc.cjs',
    'vite.config.ts',
    '*.config.js',
    '*.config.cjs',
  ],
  parser: '@typescript-eslint/parser',
  parserOptions: { ecmaVersion: 'latest', sourceType: 'module' },
  plugins: ['@typescript-eslint', 'react-refresh'],
  rules: {
    'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],

    // `any` is pervasive in this codebase at Prisma and axios boundaries.
    // Failing the build on it would mean either a mass rewrite or blanket
    // disable comments, and neither finds bugs. tsc is the type authority.
    '@typescript-eslint/no-explicit-any': 'off',

    // Deliberately-unused values are marked with a leading underscore, a
    // convention already used in the codebase (e.g. `_isInstructor`).
    '@typescript-eslint/no-unused-vars': [
      'error',
      { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' },
    ],
    'no-unused-vars': 'off',

    // An empty catch is the silent-failure pattern this project treats as a
    // defect; allow it only where the author wrote down why.
    'no-empty': ['error', { allowEmptyCatch: false }],
  },
  overrides: [
    {
      // Tests legitimately use empty mocks and throwaway bindings.
      files: ['**/*.test.ts', '**/*.test.tsx', '**/test/**'],
      rules: { '@typescript-eslint/no-empty-function': 'off', 'no-empty': 'off' },
    },
  ],
};
