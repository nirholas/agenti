# Prompt: Raise Coverage Thresholds

## Objective

Increase test coverage thresholds in `vitest.config.ts` from their current symbolic levels to meaningful enforcement, in two phases.

## Current Problem

Coverage thresholds in `vitest.config.ts` are effectively zero:

```typescript
thresholds: {
  lines: 10,
  functions: 10,
  branches: 5,
  statements: 10
}
```

This means 90% of your code can be untested and CI still passes.

## Changes Required

### File: `vitest.config.ts`

#### Phase 1 — Immediate (set a realistic floor)

First, run `npm run test:coverage` and check the actual current coverage numbers. Then set thresholds to just below current coverage so they act as a ratchet (coverage can only go up, never down).

If current coverage is, say, 25% lines:

```typescript
thresholds: {
  lines: 25,
  functions: 20,
  branches: 15,
  statements: 25
}
```

#### Phase 2 — Target (after adding tests from other prompts)

Once the untested modules have basic coverage:

```typescript
thresholds: {
  lines: 60,
  functions: 55,
  branches: 45,
  statements: 60
}
```

Long-term target (aspirational):

```typescript
thresholds: {
  lines: 80,
  functions: 75,
  branches: 65,
  statements: 80
}
```

## Steps

1. Run `npm run test:coverage` and note the current numbers
2. Set thresholds to ~2% below current coverage (acts as a ratchet)
3. Commit with message: `chore: set coverage thresholds to current baseline`
4. As you add tests from other prompts, periodically re-run coverage and ratchet up

## Additional: Per-Module Thresholds (Optional)

For critical modules, you can add per-file thresholds in vitest.config.ts:

```typescript
thresholds: {
  lines: 25,
  functions: 20,
  branches: 15,
  statements: 25,
  // Critical paths get higher thresholds
  'src/modules/defi/**': {
    lines: 60,
    branches: 50
  },
  'src/evm/**': {
    lines: 60,
    branches: 50
  }
}
```

## Verification

1. Run `npm run test:coverage` — should pass with new thresholds
2. Delete a test file — re-run coverage — should FAIL
3. Restore the test file
