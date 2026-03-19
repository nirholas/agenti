# Development Rules

## Project Structure

This is a Bun monorepo with the following structure:

```
packages/
  core/                    # @daydreamsai/facilitator - Pure library
examples/
  *.ts                     # Standalone example scripts
  facilitator-server/      # @daydreamsai/facilitator-server - Server example
```

## Core Principles

### 1. Library vs Application Separation

- `packages/core` is a **library only** - no side effects, no running servers
- Server code, CLI entry points, and default configurations belong in `examples/facilitator-server`
- Examples should be self-contained and import from package names, not relative paths

### 2. Package Imports

Examples and external consumers use package subpath exports:

```typescript
// Good - package imports
import { createFacilitator } from "@daydreamsai/facilitator";
import { createPrivateKeyEvmSigner } from "@daydreamsai/facilitator/signers";
import { createResourceServer } from "@daydreamsai/facilitator/server";
import { createUptoModule } from "@daydreamsai/facilitator/upto";
import { getRpcUrl } from "@daydreamsai/facilitator/config";

// Bad - relative imports (only for internal package use)
import { createFacilitator } from "../src/factory.js";
```

### 3. No Side Effects in Library Code

Library modules must not:
- Execute code at import time (top-level await with side effects)
- Read environment variables at module load
- Create default instances automatically
- Start servers or background processes

Side effects belong in application code (examples, servers).

### 4. Workspace Dependencies

- Use `workspace:*` for internal dependencies during development
- Examples depend on `@daydreamsai/facilitator: "workspace:*"`
- When publishing examples standalone, replace with actual version

## Adding New Features

### Adding a New Export

1. Create the module in `packages/core/src/`
2. Add subpath export to `packages/core/package.json`:
   ```json
   "./my-feature": {
     "import": "./dist/my-feature.js",
     "types": "./dist/my-feature.d.ts"
   }
   ```
3. Run `bun run build` in `packages/core`

### Adding a New Example

1. Create `examples/my-example.ts`
2. Import from package names (not relative paths)
3. Add script to `examples/package.json`
4. Ensure all dependencies are listed in `examples/package.json`

### Adding a New Package

1. Create `packages/my-package/` with `package.json` and `tsconfig.json`
2. Add to root `package.json` workspaces (already covered by `packages/*`)
3. Run `bun install` from root

## Commands

```bash
# Install all dependencies
bun install

# Build core package
cd packages/core && bun run build

# Run an example
cd examples && bun run auth

# Typecheck
cd packages/core && bun run typecheck
cd examples && npx tsc --noEmit

# Run tests
cd packages/core && bun test
```

## Testing

- Tests live in `packages/core/tests/`
- Run with `bun test` from the package directory
- Use `bun test --watch` during development
