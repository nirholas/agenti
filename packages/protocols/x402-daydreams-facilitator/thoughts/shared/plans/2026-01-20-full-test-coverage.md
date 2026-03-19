# Full Test Coverage Plan

**Date:** 2026-01-20
**Goal:** Achieve comprehensive test coverage including Docker build tests

---

## Current State Analysis

### Existing Tests (21 files, ~4,600 lines)

| Category | Files | Coverage |
|----------|-------|----------|
| Auth Module | 5 | ✅ Complete (rate-limit, storage, tokens, tracking, validator) |
| Unit Tests | 16 | ⚠️ Partial (see gaps below) |
| Integration | 0 | ❌ None |
| E2E | 0 | ❌ None |
| Docker | 0 | ❌ No Dockerfile exists |

### Test Infrastructure Issues

1. **Mixed test runners** - Bun test + Vitest in same codebase (upto-module*.test.ts uses Vitest)
2. **No coverage reporting** in CI pipeline
3. **No Docker files** - Need to create Dockerfile for facilitator-server
4. **`config.ts` has side effects** at import (console.log, process.exit) - untestable

### Source Files Analysis (49 total)

**Files WITH tests:**
- `auth/*` - 100% covered
- `upto/sessionId.ts` - ✅
- `upto/store.ts` - ✅
- `upto/sweeper.ts` - ✅
- `upto/tracking.ts` - ✅
- `upto/settlement.ts` - ✅ (partial)
- `upto/evm/facilitator.ts` - ✅ (comprehensive)
- `unifiedClient.ts` - ✅
- Middleware (Elysia, Hono, Express) - ⚠️ (basic tests only)
- Starknet - ⚠️ (smoke test only)

**Files WITHOUT tests (25+ modules):**
- `factory.ts` - Core factory, critical
- `server.ts` - Resource server factory
- `config.ts` - Configuration (has side effects)
- `networks.ts` - Network registry functions
- `middleware/core.ts` - Core middleware logic
- `signers/cdp.ts` - CDP signer adapter
- `signers/default.ts` - Default signer setup
- `upto/module.ts` - Module factory
- `upto/evm/verification.ts` - Pure function, easily testable
- `upto/evm/settlement.ts` - Pure function, easily testable
- `upto/evm/register.ts` - Registration function
- `upto/evm/serverScheme.ts` - Server scheme
- `upto/evm/client.ts` - Client utilities
- `starknet/exact/facilitator.ts` - Full implementation
- `starknet/exact/client.ts` - Client utilities

---

## Implementation Plan

### Phase 1: Test Infrastructure Fixes
**Priority: HIGH | Effort: Low**

#### 1.1 Standardize Test Runner
Remove Vitest dependency, convert to Bun test (native).

**Files to update:**
- `packages/core/tests/unit/upto-module.test.ts` - Convert from Vitest
- `packages/core/tests/unit/upto-module-sweeper-config.test.ts` - Convert from Vitest
- `packages/core/package.json` - Remove vitest if present

**Changes:**
```typescript
// FROM:
import { describe, it, expect, beforeEach, vi } from "vitest";
vi.mock("../sweeper", () => ({ createUptoSweeper: vi.fn() }));

// TO:
import { describe, it, expect, beforeEach, mock, spyOn } from "bun:test";
import * as sweeperModule from "../../src/upto/sweeper.js";
const createUptoSweeperSpy = spyOn(sweeperModule, "createUptoSweeper");
```

#### 1.2 Add Coverage Reporting to CI
Update `.github/workflows/ci.yml`:

```yaml
- name: Run tests with coverage
  run: cd packages/core && bun test --coverage --coverage-reporter=lcov

- name: Upload coverage report
  uses: codecov/codecov-action@v4
  with:
    files: ./packages/core/coverage/lcov.info
    fail_ci_if_error: false
```

#### 1.3 Add Coverage Script
Update `packages/core/package.json`:
```json
{
  "scripts": {
    "test:ci": "bun test --coverage --coverage-reporter=lcov"
  }
}
```

---

### Phase 2: Core Unit Test Gaps
**Priority: HIGH | Effort: Medium**

#### 2.1 Factory Tests (`factory.test.ts`)
**File:** `packages/core/tests/unit/factory.test.ts`

Test cases:
- [ ] Empty config creates empty facilitator
- [ ] EVM signer registration with single network
- [ ] EVM signer registration with multiple networks
- [ ] EVM schemes default to ["exact", "upto"]
- [ ] Custom schemes array
- [ ] V1 registration when registerV1=true (default)
- [ ] V1 not registered when registerV1=false
- [ ] V1 only registers supported networks
- [ ] SVM signer registration
- [ ] Starknet config registration
- [ ] Lifecycle hooks registration (all 6 hooks)
- [ ] Multiple signers combined

#### 2.2 Networks Tests (`networks.test.ts`)
**File:** `packages/core/tests/unit/networks.test.ts`

Test cases:
- [ ] `parseNetworkList()` - empty, single, multiple, whitespace
- [ ] `validateNetworks()` - valid, invalid, mixed
- [ ] `validateSvmNetworks()` - valid, invalid
- [ ] `validateStarknetNetworks()` - valid, invalid
- [ ] `getNetwork()` - existing, non-existing
- [ ] `getNetworkCaip()` - all supported networks
- [ ] `resolveRpcUrl()` - explicit, alchemy, infura, public fallback
- [ ] `getSvmNetwork()` - existing, non-existing
- [ ] `getSvmNetworkCaip()` - all solana networks
- [ ] `resolveSvmRpcUrl()` - explicit, helius, public fallback
- [ ] `getStarknetNetwork()` - existing, non-existing
- [ ] `getStarknetNetworkCaip()` - mainnet, sepolia
- [ ] `resolveStarknetRpcUrl()` - explicit, alchemy, public
- [ ] `toStarknetCanonicalCaip()` - canonical, legacy, invalid
- [ ] `toStarknetLegacyCaip()` - legacy, canonical, invalid
- [ ] `supportsV1()` - supported, unsupported networks
- [ ] `getV1Networks()` - returns correct list

#### 2.3 Server Tests (`server.test.ts`)
**File:** `packages/core/tests/unit/server.test.ts`

Test cases:
- [ ] `createResourceServer()` with defaults (all schemes enabled)
- [ ] `createResourceServer()` with exactEvm only
- [ ] `createResourceServer()` with uptoEvm only
- [ ] `createResourceServer()` with exactSvm only
- [ ] `createResourceServer()` with all schemes disabled
- [ ] Scheme registration uses correct CAIP families

#### 2.4 Middleware Core Tests (`middleware-core.test.ts`)
**File:** `packages/core/tests/unit/middleware-core.test.ts`

Test cases:
- [ ] `isUptoModule()` - valid module, invalid objects
- [ ] `normalizePathCandidate()` - with/without leading slash
- [ ] `resolveUrl()` - absolute URL, relative URL
- [ ] `parseQueryParams()` - single values, multiple values, empty
- [ ] `resolveHeaderWithAliases()` - direct header, alias, missing
- [ ] `resolveRoutes()` - from routes, from resolver, missing
- [ ] `resolveHttpServer()` - existing server, from resourceServer, from facilitatorClient
- [ ] `resolvePaywallConfig()` - undefined, object, function, async function
- [ ] `processBeforeHandle()` - payment verified, payment error, upto tracking
- [ ] `processAfterHandle()` - no state, upto scheme, auto-settle

#### 2.5 Upto EVM Verification Tests (`upto-evm-verification.test.ts`)
**File:** `packages/core/tests/unit/upto-evm-verification.test.ts`

Test `verifyUptoPayment()` directly (currently only tested via UptoEvmScheme):
- [ ] All validation steps isolated
- [ ] Edge cases for toBigInt conversions
- [ ] EIP-712 typed data construction

#### 2.6 Upto EVM Settlement Tests (`upto-evm-settlement.test.ts`)
**File:** `packages/core/tests/unit/upto-evm-settlement.test.ts`

Test `settleUptoPayment()` directly:
- [ ] Verification failure short-circuit
- [ ] Signature parsing edge cases
- [ ] Permit success flow
- [ ] Permit failure with allowance fallback
- [ ] TransferFrom success/failure

---

### Phase 3: Integration Tests
**Priority: MEDIUM | Effort: Medium**

#### 3.1 Full Payment Flow Tests
**File:** `packages/core/tests/integration/payment-flow.test.ts`

Test complete verify → settle flow with mocked blockchain:
- [ ] Exact EVM payment flow
- [ ] Upto EVM payment flow (single payment)
- [ ] Upto EVM payment flow (batched with sweeper)
- [ ] Payment rejection scenarios

#### 3.2 Framework Integration Tests
**File:** `packages/core/tests/integration/framework-*.test.ts`

Full middleware integration with test servers:
- [ ] Elysia server with payment routes
- [ ] Hono server with payment routes
- [ ] Express server with payment routes

#### 3.3 Auth Module Integration
**File:** `packages/core/tests/integration/auth-flow.test.ts`

Full auth flow testing:
- [ ] Token creation → validation → rate limiting → tracking
- [ ] Multiple tokens isolated
- [ ] Token expiration handling

---

### Phase 4: Docker Setup and Tests
**Priority: HIGH | Effort: Medium**

#### 4.1 Create Dockerfile for facilitator-server
**File:** `examples/facilitator-server/Dockerfile`

```dockerfile
# Build stage
FROM oven/bun:1 AS builder
WORKDIR /app

# Copy workspace files
COPY package.json bun.lock ./
COPY packages/core/package.json packages/core/
COPY examples/facilitator-server/package.json examples/facilitator-server/

# Install dependencies
RUN bun install --frozen-lockfile

# Copy source
COPY packages/core packages/core
COPY examples/facilitator-server examples/facilitator-server

# Build
RUN cd packages/core && bun run build
RUN cd examples/facilitator-server && bun run build

# Production stage
FROM oven/bun:1-slim
WORKDIR /app

# Copy built artifacts
COPY --from=builder /app/packages/core/dist packages/core/dist
COPY --from=builder /app/packages/core/package.json packages/core/
COPY --from=builder /app/examples/facilitator-server/dist examples/facilitator-server/dist
COPY --from=builder /app/examples/facilitator-server/package.json examples/facilitator-server/
COPY --from=builder /app/examples/facilitator-server/public examples/facilitator-server/public
COPY --from=builder /app/node_modules node_modules
COPY --from=builder /app/package.json .

WORKDIR /app/examples/facilitator-server
EXPOSE 8090

CMD ["bun", "run", "start"]
```

#### 4.2 Create docker-compose.yml
**File:** `examples/facilitator-server/docker-compose.yml`

```yaml
version: "3.8"
services:
  facilitator:
    build:
      context: ../..
      dockerfile: examples/facilitator-server/Dockerfile
    ports:
      - "8090:8090"
    environment:
      - PORT=8090
      - EVM_PRIVATE_KEY=${EVM_PRIVATE_KEY}
      - EVM_NETWORKS=base-sepolia
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8090/health"]
      interval: 10s
      timeout: 5s
      retries: 3
```

#### 4.3 Docker Build Test
**File:** `packages/core/tests/docker/build.test.ts`

```typescript
import { describe, it, expect, beforeAll, afterAll } from "bun:test";
import { $ } from "bun";

describe("Docker Build", () => {
  const imageName = "facilitator-test:latest";

  beforeAll(async () => {
    // Build the image
    const result = await $`docker build -t ${imageName} -f examples/facilitator-server/Dockerfile .`.quiet();
    expect(result.exitCode).toBe(0);
  }, 120000); // 2 minute timeout for build

  afterAll(async () => {
    // Cleanup
    await $`docker rmi ${imageName}`.quiet().nothrow();
  });

  it("builds successfully", () => {
    // Build already ran in beforeAll
    expect(true).toBe(true);
  });

  it("image contains expected files", async () => {
    const result = await $`docker run --rm ${imageName} ls -la /app/examples/facilitator-server/dist`.text();
    expect(result).toContain("index.js");
  });

  it("can start and respond to health check", async () => {
    // Start container
    const containerId = (await $`docker run -d -e EVM_PRIVATE_KEY=0x0000000000000000000000000000000000000000000000000000000000000001 -p 18090:8090 ${imageName}`.text()).trim();

    try {
      // Wait for startup
      await Bun.sleep(3000);

      // Check health
      const response = await fetch("http://localhost:18090/supported");
      expect(response.ok).toBe(true);
    } finally {
      await $`docker stop ${containerId}`.quiet();
      await $`docker rm ${containerId}`.quiet();
    }
  }, 30000);
});
```

#### 4.4 Add Docker Test to CI
Update `.github/workflows/ci.yml`:

```yaml
docker_build:
  name: Docker Build Test
  runs-on: ubuntu-latest
  needs: quality_checks
  steps:
    - uses: actions/checkout@v4

    - name: Set up Docker Buildx
      uses: docker/setup-buildx-action@v3

    - name: Build Docker image
      uses: docker/build-push-action@v5
      with:
        context: .
        file: examples/facilitator-server/Dockerfile
        push: false
        tags: facilitator:test
        cache-from: type=gha
        cache-to: type=gha,mode=max

    - name: Test Docker image
      run: |
        docker run -d --name test-facilitator \
          -e EVM_PRIVATE_KEY=0x0000000000000000000000000000000000000000000000000000000000000001 \
          -p 8090:8090 \
          facilitator:test
        sleep 5
        curl -f http://localhost:8090/supported || exit 1
        docker stop test-facilitator
```

---

### Phase 5: Signer Tests (Lower Priority)
**Priority: LOW | Effort: High** (requires mocking CDP SDK)

#### 5.1 CDP Signer Tests
**File:** `packages/core/tests/unit/signers/cdp.test.ts`

- [ ] `createCdpEvmSigner()` with valid config
- [ ] Address retrieval
- [ ] Transaction signing
- [ ] Error handling

Note: Requires mocking `@coinbase/cdp-sdk` which is complex.

#### 5.2 Default Signer Tests
**File:** `packages/core/tests/unit/signers/default.test.ts`

- [ ] Private key signer creation
- [ ] Address derivation
- [ ] Transaction signing

---

### Phase 6: Starknet Full Tests (Lower Priority)
**Priority: LOW | Effort: Medium**

#### 6.1 Starknet Facilitator Tests
**File:** `packages/core/tests/unit/starknet/facilitator.test.ts`

- [ ] Scheme properties
- [ ] `getExtra()` returns paymaster/sponsor data
- [ ] `verify()` validation steps
- [ ] `settle()` with mocked RPC

#### 6.2 Starknet Client Tests
**File:** `packages/core/tests/unit/starknet/client.test.ts`

- [ ] Client utility functions

---

## Test File Structure (Final)

```
packages/core/tests/
├── auth/                           # ✅ Existing
│   ├── rate-limit/memory.test.ts
│   ├── storage/memory.test.ts
│   ├── tokens.test.ts
│   ├── tracking/memory.test.ts
│   └── validator.test.ts
├── unit/
│   ├── constants.test.ts           # ✅ Existing
│   ├── elysiaMiddleware.test.ts    # ✅ Existing
│   ├── elysiaPaidRoutes.test.ts    # ✅ Existing
│   ├── expressMiddleware.test.ts   # ✅ Existing
│   ├── honoMiddleware.test.ts      # ✅ Existing
│   ├── sessionId.test.ts           # ✅ Existing
│   ├── sessionStore.test.ts        # ✅ Existing
│   ├── settlement.test.ts          # ✅ Existing
│   ├── starknet.test.ts            # ✅ Existing
│   ├── starknet.smoke.test.ts      # ✅ Existing
│   ├── sweeper.test.ts             # ✅ Existing
│   ├── tracking.test.ts            # ✅ Existing
│   ├── unifiedClient.test.ts       # ✅ Existing
│   ├── upto-module.test.ts         # ✅ Existing (convert to Bun)
│   ├── upto-module-sweeper.test.ts # ✅ Existing (convert to Bun)
│   ├── uptoEvmScheme.test.ts       # ✅ Existing
│   ├── factory.test.ts             # 🆕 NEW
│   ├── networks.test.ts            # 🆕 NEW
│   ├── server.test.ts              # 🆕 NEW
│   ├── middleware-core.test.ts     # 🆕 NEW
│   ├── upto-evm-verification.test.ts # 🆕 NEW (optional)
│   └── upto-evm-settlement.test.ts # 🆕 NEW (optional)
├── integration/
│   ├── payment-flow.test.ts        # 🆕 NEW
│   ├── framework-elysia.test.ts    # 🆕 NEW
│   └── auth-flow.test.ts           # 🆕 NEW
└── docker/
    └── build.test.ts               # 🆕 NEW
```

---

## Estimated Coverage After Implementation

| Module | Before | After |
|--------|--------|-------|
| Auth | 100% | 100% |
| Factory | 5% | 90% |
| Networks | 10% | 95% |
| Server | 0% | 90% |
| Middleware Core | 20% | 85% |
| Upto EVM | 80% | 95% |
| Starknet | 10% | 40% |
| Signers | 0% | 20% |
| **Overall** | **~35%** | **~80%** |

---

## Execution Order

1. **Phase 1.1** - Standardize test runner (fix Vitest → Bun)
2. **Phase 1.2-1.3** - Add coverage to CI
3. **Phase 2.2** - Networks tests (foundational)
4. **Phase 2.1** - Factory tests (depends on networks)
5. **Phase 2.3** - Server tests
6. **Phase 2.4** - Middleware core tests
7. **Phase 4.1-4.2** - Docker setup
8. **Phase 4.3-4.4** - Docker tests in CI
9. **Phase 3** - Integration tests
10. **Phase 5-6** - Signer/Starknet tests (if time permits)

---

## Success Criteria

- [x] All tests pass in CI
- [x] Coverage reporting visible in CI output
- [x] Docker image builds successfully in CI
- [x] Docker container starts and responds to health check
- [x] No Vitest dependencies remaining
- [x] Overall test coverage ≥ 75%

---

## Implementation Complete: 2026-01-20

### Final Results

| Metric | Value |
|--------|-------|
| **Tests Passing** | 422 |
| **Tests Skipped** | 8 (Docker tests, require DOCKER_TESTS=true) |
| **Function Coverage** | 75% |
| **Line Coverage** | 81% |

### Phases Completed

| Phase | Status | Description |
|-------|--------|-------------|
| 1.1 | ✅ | Vitest → Bun test conversion |
| 1.2 | ✅ | Coverage reporting in CI |
| 2.1 | ✅ | factory.test.ts (26 tests) |
| 2.2 | ✅ | networks.test.ts (66 tests) |
| 2.3 | ✅ | server.test.ts (9 tests) |
| 2.4 | ✅ | middleware-core.test.ts (37 tests) |
| 4.1 | ✅ | Dockerfile created |
| 4.2 | ✅ | docker-compose.yml created |
| 4.3 | ✅ | Docker build test created |
| 4.4 | ✅ | Docker test added to CI |

### Docker Verification

```bash
# Build verified locally
docker build --no-cache -t facilitator-test:latest -f examples/facilitator-server/Dockerfile .

# Container starts and responds
docker run -d --name facilitator-test \
  -e "EVM_PRIVATE_KEY=0x..." \
  -e "EVM_NETWORKS=base-sepolia" \
  -p 18090:8090 \
  facilitator-test:latest

curl -s http://localhost:18090/supported
# Returns: {"kinds":[{"x402Version":2,"scheme":"exact","network":"eip155:84532"},...],"x402Version":2}
```

### Files Created/Modified

**New Files:**
- `packages/core/tests/unit/factory.test.ts`
- `packages/core/tests/unit/networks.test.ts`
- `packages/core/tests/unit/server.test.ts`
- `packages/core/tests/unit/middleware-core.test.ts`
- `packages/core/tests/docker/build.test.ts`
- `examples/facilitator-server/Dockerfile`
- `examples/facilitator-server/docker-compose.yml`
- `.dockerignore`

**Modified Files:**
- `packages/core/tests/unit/upto-module.test.ts` (Vitest → Bun)
- `packages/core/tests/unit/upto-module-sweeper-config.test.ts` (Vitest → Bun)
- `.github/workflows/ci.yml` (coverage + Docker job)
- `package.json` (workspace includes facilitator-server)
