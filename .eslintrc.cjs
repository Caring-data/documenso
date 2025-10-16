/** @type {import('eslint').Linter.Config} */
module.exports = {
  root: true,
  extends: ['@documenso/eslint-config'],
  rules: {
    '@next/next/no-img-element': 'off',
    'no-unreachable': 'error',
    '@typescript-eslint/no-explicit-any': 'warn',
    '@typescript-eslint/consistent-type-assertions': 'warn',
    '@typescript-eslint/ban-ts-comment': 'warn',
    'react-hooks/exhaustive-deps': 'warn',
    'unused-imports/no-unused-vars': 'warn',
  },
  settings: {
    next: {
      rootDir: ['apps/*/'],
    },
  },
  ignorePatterns: ['lingui.config.ts', 'packages/lib/translations/**/*.js'],
};
