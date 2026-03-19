import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    testTimeout: 30000, // 30s timeout for network calls
    hookTimeout: 30000,
    setupFiles: ['./src/setup.ts'],
  },
});

