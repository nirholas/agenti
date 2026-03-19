import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['server/test/**/*.test.ts'],
    globals: true,
    environment: 'node',
    testTimeout: 30000,
  },
});
