import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';
import globals from 'globals';

export default tseslint.config(
  {
    ignores: [
      'dist',
      'node_modules',
      'coverage',
      // local notes and references, git-ignored
      '.claude',
      'resources',
    ],
  },
  js.configs.recommended,
  {
    // root configs and examples run in Node
    files: ['*.js', 'examples/**/*.js'],
    languageOptions: { globals: globals.node },
  },
  {
    files: ['src/**/*.ts'],
    extends: [...tseslint.configs.strictTypeChecked],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      '@typescript-eslint/restrict-template-expressions': [
        'error',
        { allowNumber: true },
      ],
    },
  },
  {
    files: ['src/**/*.spec.ts', 'src/test-utils/**/*.ts'],
    rules: { '@typescript-eslint/no-non-null-assertion': 'off' },
  },
  prettier
);
