# Prompt: Add Mutation Testing

## Objective

Add mutation testing with Stryker to verify that your tests actually catch bugs — not just that they run without errors. High coverage with weak assertions is a false sense of security.

## What Is Mutation Testing?

Stryker modifies your source code (e.g., changes `>` to `<`, removes a return statement) and reruns your tests. If tests still pass after a mutation, those tests are too weak — they don't actually verify the behavior they claim to test.

## Setup

### 1. Install Stryker

```bash
npm install --save-dev @stryker-mutator/core @stryker-mutator/vitest-runner @stryker-mutator/typescript-checker
```

### 2. Create `stryker.config.json`

```json
{
  "$schema": "https://raw.githubusercontent.com/stryker-mutator/stryker/master/packages/core/schema/stryker-schema.json",
  "packageManager": "npm",
  "testRunner": "vitest",
  "checkers": ["typescript"],
  "tsconfigFile": "tsconfig.json",
  "reporters": ["html", "clear-text", "progress"],
  "htmlReporter": {
    "fileName": "reports/mutation/mutation.html"
  },
  "mutate": [
    "src/modules/**/*.ts",
    "!src/modules/**/*.test.ts",
    "!src/modules/**/index.ts"
  ],
  "ignorePatterns": [
    "dist",
    "node_modules",
    "coverage",
    "tests"
  ],
  "thresholds": {
    "high": 80,
    "low": 60,
    "break": 40
  },
  "concurrency": 4,
  "timeoutMS": 60000,
  "incremental": true,
  "incrementalFile": ".stryker-cache/incremental.json"
}
```

### 3. Add npm Scripts

Add to `package.json`:

```json
{
  "scripts": {
    "test:mutate": "stryker run",
    "test:mutate:incremental": "stryker run --incremental"
  }
}
```

### 4. Add to `.gitignore`

```
# Stryker
reports/mutation/
.stryker-cache/
.stryker-tmp/
```

### 5. Add CI Job (Optional — run weekly, not on every PR)

Add to `.github/workflows/ci.yml` or create a separate workflow:

```yaml
# .github/workflows/mutation-testing.yml
name: Mutation Testing
on:
  schedule:
    - cron: '0 6 * * 1'  # Every Monday at 6am UTC
  workflow_dispatch:

jobs:
  mutation:
    name: Mutation Testing
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v6
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - name: Run Stryker
        run: npm run test:mutate
      - name: Upload mutation report
        uses: actions/upload-artifact@v7
        if: always()
        with:
          name: mutation-report
          path: reports/mutation/
          retention-days: 30
```

## How to Use Results

After running `npm run test:mutate`:

1. Open `reports/mutation/mutation.html` in a browser
2. Look for **survived mutants** — these are bugs your tests would miss
3. Focus on:
   - Mutants in critical paths (DeFi calculations, wallet operations)
   - Mutants that changed comparison operators (`>` to `>=`)
   - Mutants that removed return statements
4. Write targeted tests to kill those mutants

## Start Small

Don't run mutation testing on all 380+ tools at once. Start with critical modules:

```json
"mutate": [
  "src/modules/defi/**/*.ts",
  "src/modules/portfolio/**/*.ts",
  "src/evm/modules/tokens/**/*.ts",
  "src/evm/modules/swap/**/*.ts",
  "!src/**/*.test.ts",
  "!src/**/index.ts"
]
```

Expand scope as you improve test quality.

## Verification

1. Run `npm run test:mutate` on a single module
2. Check the mutation score (aim for 60%+ initially)
3. Fix the weakest tests based on survived mutants
4. Re-run and confirm the score improves
