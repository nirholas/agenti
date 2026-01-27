import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  dts: false, // Temporarily disabled due to OpenAPI type version conflicts
  sourcemap: true,
  clean: true,
  target: 'es2022',
  outExtension: () => ({ js: '.mjs' }),
});
