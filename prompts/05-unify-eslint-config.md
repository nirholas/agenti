# Prompt: Unify ESLint Configuration Across Monorepo

## Objective

Consolidate the mix of ESLint config formats (flat config at root, legacy `.eslintrc` in packages) into a single consistent setup.

## Current Problem

The root uses the modern flat config (`eslint.config.js`) but 7 packages still use legacy `.eslintrc.json` or `.eslintrc.cjs`:

1. `packages/generators/extract-llms-docs/.eslintrc.json` — extends `next/core-web-vitals`
2. `packages/protocols/x402-stablecoin/.eslintrc.json`
3. `packages/tools/ai-agents-library/.eslintrc.cjs` — uses `@lobehub/lint`
4. `packages/tools/defi-agents/.eslintrc.cjs` — uses `@lobehub/lint`
5. `packages/tools/lyra-registry/.eslintrc.json`
6. `packages/tools/lyra-tool-discovery/llms-forge/.eslintrc.json`
7. `packages/wallets/solana-wallet-toolkit/typescript/.eslintrc.json`

## Strategy

There are two valid approaches. Choose based on how independent the packages are:

### Option A: Shared Root Config (recommended if packages share the same TypeScript/Node setup)

1. Delete all `.eslintrc.json` and `.eslintrc.cjs` files in packages
2. Update the root `eslint.config.js` to include package source files:
   ```javascript
   // Add to the ignores section — remove packages from ignore
   // Add new file matcher for packages
   {
     files: ['packages/**/src/**/*.ts'],
     // Same rules as main src/ or a subset
   }
   ```
3. For packages with special needs (e.g., Next.js), add targeted overrides:
   ```javascript
   {
     files: ['packages/generators/extract-llms-docs/**/*.{ts,tsx,js,jsx}'],
     // Next.js specific rules
   }
   ```

### Option B: Per-Package Flat Configs (recommended if packages are truly independent)

1. Convert each `.eslintrc.json` / `.eslintrc.cjs` to `eslint.config.js` (flat config format)
2. Create a shared config package or file they can all import:
   ```javascript
   // packages/shared-eslint-config.js
   import rootConfig from '../../eslint.config.js'
   export default rootConfig
   ```

## Steps

1. Read each of the 7 legacy config files to understand what rules they define
2. Determine which packages have unique needs (Next.js, LobeHub) vs which are standard TypeScript
3. For standard TypeScript packages: delete the local config (root config applies)
4. For special packages: convert to flat config format with targeted overrides
5. Update the root `eslint.config.js` to cover `packages/**/src/**/*.ts`
6. Run `npx eslint packages/` and fix any new violations
7. Update the CI `lint:eslint` script if needed to cover packages

## Special Cases

- **`extract-llms-docs`** uses Next.js — may need `eslint-config-next` in flat config format or a separate config
- **`ai-agents-library` and `defi-agents`** use `@lobehub/lint` — check if this supports flat config, otherwise extract the specific rules it enables

## Verification

```bash
# Should lint all source files with no config warnings
npx eslint src/ packages/ --max-warnings=0

# Should not find any legacy config files
find packages -name ".eslintrc*" -type f
# (should return nothing)
```

## Notes

- Don't change any lint RULES in this prompt — only unify the config format
- If a package has intentionally different rules, preserve them as overrides in the flat config
