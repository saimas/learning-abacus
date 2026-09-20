// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config')
const expoConfig = require('eslint-config-expo/flat')
const stylistic = require('@stylistic/eslint-plugin')

module.exports = defineConfig([
  expoConfig,
  {
    // House style (see docs/superpowers/plans/2026-09-20-phase-1-single-rod-anzan.md):
    // no semicolons, single quotes, 2-space indent. @stylistic replaces the
    // formatting rules TypeScript-eslint dropped, and understands TS syntax
    // (interfaces, generics, type annotations) that core ESLint's `indent`/
    // `quotes`/`semi` rules were not built to parse correctly.
    plugins: {
      '@stylistic': stylistic,
    },
    rules: {
      '@stylistic/semi': ['error', 'never'],
      '@stylistic/quotes': ['error', 'single', { avoidEscape: true }],
      '@stylistic/indent': ['error', 2],
    },
  },
  {
    ignores: ['dist/*'],
  },
])
