# Setup: NPM Publishing Configuration

status: pending

## Goal
Configure all three packages for public NPM publishing under the `@agenti` scope. Ensure package.json files have all required publishing fields.

## For each package (core, sdk, mcp)

### Required fields to add/verify in package.json:
```json
{
  "version": "0.1.0",
  "license": "Apache-2.0",
  "author": "nirholas",
  "repository": {
    "type": "git",
    "url": "https://github.com/nirholas/agenti"
  },
  "homepage": "https://agenti.cash",
  "bugs": {
    "url": "https://github.com/nirholas/agenti/issues"
  },
  "publishConfig": {
    "access": "public"
  },
  "files": ["dist", "README.md", "LICENSE"],
  "sideEffects": false
}
```

### Build output
Verify each package builds to `dist/` with:
- `dist/index.js` (ESM)
- `dist/index.cjs` (CommonJS)
- `dist/index.d.ts` (types)

If the current tsconfig only outputs ESM, update to dual output using `tsup`:
```json
// package.json build script
"build": "tsup src/index.ts --format esm,cjs --dts"
```

Add `tsup` to devDependencies: `"tsup": "^8.0.0"`

### package.json exports field
```json
"exports": {
  ".": {
    "import": "./dist/index.js",
    "require": "./dist/index.cjs",
    "types": "./dist/index.d.ts"
  }
}
```

For `@agenti/sdk`, also add subpath exports for framework adapters (add as they are built):
```json
"./langchain": {
  "import": "./dist/frameworks/langchain.js",
  "require": "./dist/frameworks/langchain.cjs",
  "types": "./dist/frameworks/langchain.d.ts"
},
"./vercel-ai": { ... },
"./eliza": { ... }
```

## Root package.json
Add changesets for versioning:
```
pnpm add -Dw @changesets/cli
pnpm changeset init
```

This creates `.changeset/config.json` — commit it.

## Verify
Run `pnpm build` and check `dist/` exists in all three packages before marking complete.

Mark this file's status as `complete` when done.
