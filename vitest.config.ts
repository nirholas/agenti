import { defineConfig } from 'vitest/config'
import { dirname, resolve } from 'path'
import { fileURLToPath } from 'url'

const root = dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  resolve: {
    alias: {
      '@agenti/core': resolve(root, 'packages/core/src/index.ts'),
      '@agenti/sdk': resolve(root, 'packages/sdk/src/index.ts'),
    },
  },
  test: {
    globals: true,
    environment: 'node',
  },
})
