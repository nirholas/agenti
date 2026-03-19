# @x402a/config

Shared configuration files for the x402a monorepo.

## Contents

- **tsconfig.base.json** - Base TypeScript configuration for all packages
- **vitest.config.base.ts** - Base Vitest test configuration
- **playwright.config.base.ts** - Base Playwright E2E test configuration

**Note:** Linting and formatting are handled by [Biome](https://biomejs.dev) at the monorepo root level. See `/biome.json` for configuration.

## Usage

### TypeScript Configuration

In your package's `tsconfig.json`:

```json
{
  "extends": "@x402a/config/tsconfig.base.json",
  "compilerOptions": {
    // Package-specific overrides
  }
}
```

### Vitest Configuration

In your package's `vitest.config.ts`:

```typescript
import { defineConfig, mergeConfig } from "vitest/config";
import { baseConfig } from "@x402a/config/vitest.config.base";

export default mergeConfig(
  baseConfig,
  defineConfig({
    // Package-specific overrides
  })
);
```

### Playwright Configuration

In your root or package's `playwright.config.ts`:

```typescript
import { defineConfig } from "@playwright/test";
import { baseConfig } from "@x402a/config/playwright.config.base";

export default defineConfig({
  ...baseConfig,
  testDir: "./e2e",
  // Project-specific overrides (e.g., webServer)
});
```

### Linting and Formatting

The monorepo uses [Biome](https://biomejs.dev) for linting and formatting, configured at the root level in `/biome.json`.

**Available commands:**
```bash
bun run lint         # Check code quality
bun run lint:fix     # Fix issues automatically
bun run format       # Check formatting
bun run format:write # Format code
bun run check        # Run all checks
```

## Modifying Shared Config

When modifying shared configuration:

1. Consider the impact on all packages in the monorepo
2. Test changes across all packages before committing
3. Document breaking changes in the relevant package changelogs
