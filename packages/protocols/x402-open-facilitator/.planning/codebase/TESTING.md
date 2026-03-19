# Testing Patterns

**Analysis Date:** 2026-01-19

## Test Framework

**Runner:**
- Vitest (multiple versions across packages)
- Server: vitest ^4.0.16
- SDK: vitest ^1.0.0
- Integration tests: vitest ^3.2.4
- Config files: `vitest.config.ts` in each package

**Assertion Library:**
- Vitest built-in (`expect` from vitest)

**Run Commands:**
```bash
# Server package
pnpm --filter @openfacilitator/server test       # Run all tests
pnpm --filter @openfacilitator/server test:watch # Watch mode

# Integration tests
pnpm --filter @openfacilitator/integration-tests test       # Run non-real tests
pnpm --filter @openfacilitator/integration-tests test:watch # Watch mode
pnpm --filter @openfacilitator/integration-tests test:all   # All tests including real
pnpm --filter @openfacilitator/integration-tests test:solana # Real Solana tests
pnpm --filter @openfacilitator/integration-tests test:base   # Real Base tests
```

## Test File Organization

**Location:**
- Co-located with source in server: `packages/server/src/server.test.ts`
- Dedicated test package for integration: `packages/integration-tests/src/*.test.ts`

**Naming:**
- Unit/integration tests: `*.test.ts`
- Real network tests: `*-real.test.ts` (excluded by default)

**Structure:**
```
packages/
├── server/
│   └── src/
│       └── server.test.ts          # Unit tests for server
└── integration-tests/
    └── src/
        ├── setup.ts                # Test configuration
        ├── endpoints.test.ts       # API endpoint tests
        ├── solana-real.test.ts     # Real Solana transactions
        └── base-real.test.ts       # Real Base transactions
```

## Test Structure

**Suite Organization:**
```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';

describe('Feature Name', () => {
  let dependency: Type;

  beforeAll(() => {
    // Setup - runs once before all tests in describe block
    dependency = initializeDependency();
  });

  afterAll(() => {
    // Cleanup - runs once after all tests
    cleanup();
  });

  describe('sub-feature', () => {
    it('should do something specific', async () => {
      // Arrange
      const input = createInput();

      // Act
      const result = await functionUnderTest(input);

      // Assert
      expect(result).toBeDefined();
      expect(result.property).toBe(expected);
    });
  });
});
```

**Patterns:**
- Use nested `describe` blocks for grouping related tests
- Use `beforeAll`/`afterAll` for expensive setup (not `beforeEach`)
- Descriptive test names with "should" prefix
- Skip tests conditionally with early return and log message

## Mocking

**Framework:** Vitest built-in (vi.mock not heavily used)

**Patterns:**
- Prefer real instances over mocks where possible
- Use test database for server tests:
  ```typescript
  beforeAll(() => {
    process.env.DATABASE_PATH = testDbPath;
    initializeDatabase(testDbPath);
    app = createServer();
  });

  afterAll(() => {
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
  });
  ```

**What to Mock:**
- External APIs when testing in isolation
- Time-dependent operations
- Random/UUID generation for deterministic tests

**What NOT to Mock:**
- Database operations (use test database instead)
- Internal business logic
- HTTP handling (use supertest for request simulation)

## Fixtures and Factories

**Test Data:**
```typescript
// Direct object creation (preferred for simple cases)
const invalidPayment = {
  x402Version: 1 as const,
  scheme: 'exact',
  network: 'solana',
  payload: {
    signature: 'invalid_signature',
    authorization: {
      from: 'invalid_address',
      to: 'invalid_address',
      amount: '1000000',
      asset: 'USDC',
    },
  },
};

const requirements = {
  scheme: 'exact',
  network: 'solana',
  maxAmountRequired: '1000000',
  asset: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
};
```

**Location:**
- Inline in test files for simple fixtures
- Setup file for shared configuration: `packages/integration-tests/src/setup.ts`

**Configuration Pattern:**
```typescript
// setup.ts
import { config } from 'dotenv';
config();

export const TEST_CONFIG = {
  FREE_ENDPOINT: 'https://pay.openfacilitator.io',
  CUSTOM_DOMAIN: process.env.TEST_CUSTOM_DOMAIN || 'https://pay.x402.jobs',
  SOLANA_PRIVATE_KEY: process.env.TEST_SOLANA_PRIVATE_KEY,
  TIMEOUT: 30000,
};

export async function validateEndpoint(url: string): Promise<boolean> {
  try {
    const response = await fetch(`${url}/supported`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });
    return response.ok;
  } catch {
    return false;
  }
}
```

## Coverage

**Requirements:** None enforced

**View Coverage:**
```bash
# Not configured - no coverage scripts defined
```

## Test Types

**Unit Tests:**
- Location: `packages/server/src/server.test.ts`
- Scope: Individual functions, route handlers
- Uses: Real test database, supertest for HTTP
- Example: Auth routes, health check

**Integration Tests:**
- Location: `packages/integration-tests/src/endpoints.test.ts`
- Scope: End-to-end API testing against live endpoints
- Uses: SDK client, real HTTP requests
- Tests: verify, settle, supported endpoints

**E2E/Real Network Tests:**
- Location: `packages/integration-tests/src/*-real.test.ts`
- Scope: Actual blockchain transactions
- Excluded by default: `--exclude='**/*-real*'`
- Requires: Funded wallet, environment variables

## Common Patterns

**Async Testing:**
```typescript
it('should handle async operation', async () => {
  const result = await facilitator.verify(payment, requirements);
  expect(result.isValid).toBe(false);
});
```

**Error Testing:**
```typescript
it('should reject invalid payment payload', async () => {
  const invalidPayment = { /* ... */ };
  const result = await facilitator.verify(invalidPayment, requirements);

  expect(result.isValid).toBe(false);
  // Error message is optional - may or may not be present
});
```

**Conditional Test Execution:**
```typescript
it('should be reachable', async () => {
  if (!isAvailable) {
    console.log(`Skipping: ${TEST_CONFIG.CUSTOM_DOMAIN} not available`);
    return;
  }

  const isHealthy = await facilitator.health();
  expect(isHealthy).toBe(true);
});
```

**HTTP Testing with Supertest:**
```typescript
import request from 'supertest';

it('POST /api/auth/sign-up/email should not return 404', async () => {
  const response = await request(app)
    .post('/api/auth/sign-up/email')
    .send({
      email: 'test@example.com',
      password: 'testpassword123',
      name: 'Test User',
    })
    .set('Content-Type', 'application/json');

  expect(response.status).not.toBe(404);
});
```

**Test Database Management:**
```typescript
const testDbPath = './data/test-openfacilitator.db';

beforeAll(() => {
  process.env.DATABASE_PATH = testDbPath;
  process.env.BETTER_AUTH_SECRET = 'test-secret-for-testing-only';
  process.env.BETTER_AUTH_URL = 'http://localhost:5002';

  initializeDatabase(testDbPath);
  initializeAuth(testDbPath);
  app = createServer();
});

afterAll(() => {
  if (fs.existsSync(testDbPath)) {
    fs.unlinkSync(testDbPath);
  }
});
```

## Vitest Configuration

**Server Package:**
```typescript
// packages/server/vitest.config.ts - implied by package.json scripts
// Uses default vitest configuration
```

**Integration Tests:**
```typescript
// packages/integration-tests/vitest.config.ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,                // Enable global test functions
    environment: 'node',          // Node.js environment
    testTimeout: 30000,           // 30s timeout for network calls
    hookTimeout: 30000,           // 30s timeout for hooks
    setupFiles: ['./src/setup.ts'], // Run setup before tests
  },
});
```

## Test Naming Conventions

**Test Scripts:**
```json
{
  "test": "vitest run --exclude='**/*-real*'",
  "test:watch": "vitest",
  "test:free": "vitest run --testNamePattern='free endpoint'",
  "test:custom": "vitest run --testNamePattern='custom domain'",
  "test:solana": "vitest run src/solana-real.test.ts",
  "test:base": "vitest run src/base-real.test.ts",
  "test:real": "vitest run src/*-real.test.ts",
  "test:all": "vitest run"
}
```

**Pattern-Based Filtering:**
- Use `--testNamePattern` for running specific test groups
- Use file paths for running specific test files
- Use `--exclude` pattern for default exclusions

---

*Testing analysis: 2026-01-19*
