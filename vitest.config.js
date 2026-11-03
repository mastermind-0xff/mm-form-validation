import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.spec.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.spec.ts', 'src/test-utils/**'],
      reporter: ['text', 'html'],
      thresholds: { statements: 95, branches: 90, functions: 95, lines: 95 },
    },
  },
});
