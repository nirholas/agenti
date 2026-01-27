/**
 * ✨ built by nich
 * 🌐 GitHub: github.com/nirholas
 * 💫 Code is poetry written for machines 📝
 */

import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'dist/',
        '**/*.test.ts',
        '**/*.spec.ts'
      ]
    }
  }
});
