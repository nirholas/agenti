import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    'payments/index': 'src/payments/index.ts',
    'http/index': 'src/http/index.ts',
    'yield/index': 'src/yield/index.ts',
    'contracts/index': 'src/contracts/index.ts',
  },
  format: ['esm', 'cjs'],
  dts: true,
  clean: true,
  sourcemap: true,
  splitting: false,
  treeshake: true,
  minify: false,
  outDir: 'dist',
  target: 'node18',
  external: ['express'],
  esbuildOptions(options) {
    options.banner = {
      js: '// @x402/sdk - X402 Payment Protocol SDK\n// https://github.com/nirholas/x402',
    };
  },
});
