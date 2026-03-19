# Prompt: Harden CI Pipeline

## Objective

Remove all `|| true` fallbacks from `.github/workflows/ci.yml` so that lint, test, and security failures actually block merges. The current CI is effectively decorative — everything passes regardless of errors.

## Current Problem

Every CI step silently swallows failures:

```yaml
# These all pass even when broken:
run: npm run lint:eslint || npm run lint || true
run: npm run lint:tsc || npm run typecheck || true
run: npm run format:check || true
run: npm run test:coverage || npm test || true
run: npm test -- --config vitest.config.ts tests/integration/ || true
run: npm run test:e2e || true
run: npm audit --audit-level=high || true
run: npm test || true  # matrix tests
```

## Changes Required

### File: `.github/workflows/ci.yml`

1. **Lint job** — replace the fallback chains with direct commands:
   ```yaml
   - name: Run ESLint
     run: npm run lint:eslint

   - name: Run TypeScript type check
     run: npm run lint:tsc

   - name: Check formatting
     run: npm run format:check
   ```

2. **Unit test job** — remove fallback:
   ```yaml
   - name: Run unit tests with coverage
     run: npm run test:coverage
   ```

3. **Integration test job** — remove `|| true`:
   ```yaml
   - name: Run integration tests
     run: npm test -- --config vitest.config.ts tests/integration/
   ```

4. **E2E test job** — remove `|| true`:
   ```yaml
   - name: Run E2E tests
     run: npm run test:e2e
   ```

5. **Security audit** — keep `|| true` ONLY for security audit since npm audit can fail on transitive deps you don't control, but add `continue-on-error: true` instead for better visibility:
   ```yaml
   - name: Run security audit
     run: npm audit --audit-level=high
     continue-on-error: true
   ```

6. **Matrix tests** — remove `|| true`:
   ```yaml
   - name: Run tests
     run: npm test
   ```

## Verification

After making changes:
1. Push to a branch and open a PR
2. Intentionally break a lint rule — confirm CI fails
3. Intentionally break a test — confirm CI fails
4. Confirm the build job still passes on clean code

## Notes

- Do NOT add `|| true` back "temporarily" — that's how we got here
- If a step legitimately needs to be non-blocking, use `continue-on-error: true` at the step level so GitHub still shows it as a warning
