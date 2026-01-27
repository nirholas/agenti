import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  dts: false, // Disabled due to cross-package type conflicts
  clean: true,
  sourcemap: true,
  minify: false,
  outExtension: () => ({ js: '.mjs' }),
  banner: {
    js: '#!/usr/bin/env node',
  },
});
