# Tests

This folder contains unit and integration tests for Clodds.

Structure:

```
tests/
  unit/
  integration/
  helpers/
```

Run locally:

```
npm run test
```

Note: `tests/integration/market-index-live.test.ts`, `tests/integration/market-index-live-kalshi.test.ts`, and `tests/integration/market-index-live-manifold.test.ts` hit real APIs.

See `docs/TEST_PLAN.md` for the current test plan and priorities.
