import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['test/unit/**/*.test.ts'],
    globals: true,
    environment: 'node',
    testTimeout: 10000,
    coverage: {
      provider: 'v8',
      include: ['packages/ton/src/**/*.ts'],
      exclude: ['packages/ton/src/**/*.d.ts', 'packages/ton/src/**/index.ts'],
      reporter: ['text', 'lcov', 'html'],
      thresholds: {
        lines: 70,
        functions: 75,
        branches: 65,
        statements: 70,
      },
    },
  },
});
