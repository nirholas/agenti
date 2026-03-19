---
name: debug-test-harness
description: Debug x402 integration test failures using test-harness interceptors to trace requests through client/middleware/facilitator
---

# Debug x402 Integration Test Failures with Interceptors

Use this skill when tests using `@faremeter/test-harness` are failing with
unexpected HTTP status codes (especially 500 errors) or protocol validation
errors. The test-harness package provides interceptors that can trace
requests/responses through the x402 protocol stack.

## When to Use This Skill

- Tests returning 500 instead of expected 200/402
- Validation errors like "field X must be a string (was missing)"
- Unclear where in the client -> middleware -> facilitator chain a failure occurs
- Need to inspect request/response bodies at various protocol stages

## Debugging Strategy

### Step 1: Add Event Collectors

Create a minimal debug test that adds logging interceptors to trace the flow:

```typescript
import t from "tap";
import {
  TestHarness,
  createEventCollector,
  createTestFacilitatorHandler,
  createTestPaymentHandler,
  accepts,
} from "@faremeter/test-harness";

await t.test("debug failure", async (t) => {
  const { interceptor: clientLogger, events: clientEvents } =
    createEventCollector();
  const { interceptor: middlewareLogger, events: middlewareEvents } =
    createEventCollector();

  const harness = new TestHarness({
    settleMode: "settle-only",
    accepts: [accepts()],
    facilitatorHandlers: [
      createTestFacilitatorHandler({ payTo: "test-receiver" }),
    ],
    clientHandlers: [createTestPaymentHandler()],
    clientInterceptors: [clientLogger],
    middlewareInterceptors: [middlewareLogger],
  });

  const fetch = harness.createFetch();
  const response = await fetch("/test-resource");

  console.log("\n=== CLIENT EVENTS ===");
  for (const e of clientEvents) {
    console.log(JSON.stringify(e));
  }

  console.log("\n=== MIDDLEWARE EVENTS ===");
  for (const e of middlewareEvents) {
    console.log(JSON.stringify(e));
  }

  console.log("\n=== RESPONSE ===");
  console.log("Status:", response.status);
  console.log("Body:", await response.text());

  t.end();
});
```

Run the debug test with `pnpm tap path/to/debug.test.ts` to see the event flow.

### Step 2: Interpret the Event Flow

The test harness has two interceptor chains:

1. **Client interceptors** - between test code and middleware (resource requests)
2. **Middleware interceptors** - between middleware and facilitator (/accepts, /verify, /settle)

A typical successful flow shows:

```
CLIENT EVENTS:
  request /test-resource -> response 402
  request /test-resource (with payment header) -> response 200

MIDDLEWARE EVENTS:
  request /facilitator/accepts -> response 200
  request /facilitator/settle -> response 200
```

Failure patterns to look for:

- `/accepts` returns 200 but overall response is 500 -> validation error parsing accepts response
- `/settle` returns 200 but overall response is 500 -> validation error parsing settle response
- No middleware events at all -> error occurred before facilitator calls
- Client sees 500 with error message -> read the error message for clues

### Step 3: Capture Full Request/Response Bodies

For deeper inspection, use `createCaptureInterceptor` with matchers:

```typescript
import {
  TestHarness,
  createCaptureInterceptor,
  matchFacilitatorAccepts,
  matchFacilitatorSettle,
  matchAll,
} from "@faremeter/test-harness";

const { interceptor: captureAccepts, captured: acceptsCaptures } =
  createCaptureInterceptor(matchFacilitatorAccepts);

const harness = new TestHarness({
  // ... config ...
  middlewareInterceptors: [captureAccepts],
});

// After test runs:
for (const c of acceptsCaptures) {
  console.log("Request URL:", c.url);
  console.log("Request body:", c.init?.body);
  console.log("Response status:", c.response.status);
  console.log("Response body:", await c.response.clone().text());
}
```

Note: Always call `response.clone()` before reading the body, since Response
bodies can only be consumed once.

## Available Interceptor Tools

### Matchers (what to intercept)

```typescript
import {
  matchFacilitatorAccepts, // /facilitator/accepts endpoint
  matchFacilitatorVerify, // /facilitator/verify endpoint
  matchFacilitatorSettle, // /facilitator/settle endpoint
  matchFacilitatorSupported, // /facilitator/supported endpoint
  matchFacilitator, // any facilitator endpoint
  matchResource, // non-facilitator requests (resources)
  matchURL, // custom URL pattern (string or RegExp)
  matchMethod, // filter by HTTP method
  matchAll, // matches everything
  matchNone, // matches nothing
  and, // combine matchers with AND
  or, // combine matchers with OR
  not, // negate a matcher
} from "@faremeter/test-harness";

// Examples:
matchURL("/my-endpoint");
matchURL(/\/api\/v[12]\//);
matchMethod("POST");
and(matchFacilitatorSettle, matchMethod("POST"));
or(matchFacilitatorVerify, matchFacilitatorSettle);
not(matchFacilitator);
```

### Logging and Capture

```typescript
import {
  createEventCollector,
  createConsoleLoggingInterceptor,
  createCaptureInterceptor,
} from "@faremeter/test-harness";

// Collect events for later inspection
const { interceptor, events, clear } = createEventCollector();
// events: Array<{ type, url, method, status?, error?, timestamp }>

// Log to console in real-time
const logInterceptor = createConsoleLoggingInterceptor("[PREFIX]");

// Capture full request/response for matching requests
const { interceptor, captured, clear } = createCaptureInterceptor(
  matchFacilitatorAccepts,
);
// captured: Array<{ url, init, response, timestamp }>
```

### Hooks (custom inspection)

```typescript
import {
  createRequestHook,
  createResponseHook,
  createHook,
} from "@faremeter/test-harness";

// Run code before matching requests
createRequestHook(matchFacilitatorSettle, (url, init) => {
  console.log("Settling:", JSON.parse(init?.body as string));
});

// Run code after matching responses
createResponseHook(matchFacilitatorSettle, async (url, response, init) => {
  console.log("Settle result:", await response.clone().json());
});

// Both hooks in one
createHook(matchFacilitatorSettle, {
  onRequest: (url, init) => {
    /* ... */
  },
  onResponse: async (url, response, init) => {
    /* ... */
  },
});
```

### Failure Injection (for testing error paths)

```typescript
import {
  createFailureInterceptor,
  failOnce,
  failNTimes,
  failUntilCleared,
  failWhen,
  networkError,
  timeoutError,
  httpError,
} from "@faremeter/test-harness";

// Always fail matching requests
createFailureInterceptor(matchFacilitatorSettle, () =>
  networkError("connection refused"),
);

// Fail only the first matching request
failOnce(matchFacilitatorAccepts, () =>
  httpError(500, "Internal Server Error"),
);

// Fail first N matching requests
failNTimes(3, matchFacilitatorVerify, () => timeoutError());

// Fail until manually cleared
const interceptor = failUntilCleared(matchFacilitator, () => networkError());
// Later: interceptor.clear();

// Conditional failure
failWhen(
  matchFacilitatorSettle,
  ({ attemptCount }) => attemptCount <= 2, // fail first 2 attempts
  () => httpError(503, "Service Unavailable"),
);
```

### Response Factories

```typescript
import {
  jsonResponse,
  httpError,
  networkError,
  timeoutError,
  verifySuccessResponse,
  verifyFailedResponse,
  settleSuccessResponse,
  settleFailedResponse,
} from "@faremeter/test-harness";

// Generic JSON response
jsonResponse(200, { data: "value" });

// HTTP error response
httpError(500, "Internal Server Error");
httpError(400, "Bad Request");

// Network-level errors (thrown, not returned)
networkError("connection refused");
timeoutError();

// Protocol-specific responses
verifySuccessResponse();
verifyFailedResponse("insufficient payment");
settleSuccessResponse("0xtxhash", "eip155:1");
settleFailedResponse("transaction failed");
```

## Real Examples from the Codebase

### Example 1: Capturing 402 Response Headers

From `tests/x402v2/data-structures.test.ts` - using `createCaptureInterceptor`
to inspect the PAYMENT-REQUIRED header structure:

```typescript
const { interceptor: captureInterceptor, captured } =
  createCaptureInterceptor(matchResource);

const harness = new TestHarness({
  supportedVersions: { x402v2: true },
  settleMode: "settle-only",
  accepts: [accepts({ maxAmountRequired: "10000" })],
  facilitatorHandlers: [
    createTestFacilitatorHandler({ payTo: "test-receiver" }),
  ],
  clientHandlers: [createTestPaymentHandler()],
  clientInterceptors: [captureInterceptor, createV2ResponseInterceptor()],
});

const fetch = harness.createFetch();
await fetch("/test-resource");

// Inspect the captured 402 response
const firstCapture = captured[0];
const paymentRequiredHeader =
  firstCapture.response.headers.get("PAYMENT-REQUIRED");
const body = JSON.parse(atob(paymentRequiredHeader));

// Now inspect body.accepts, body.resource, etc.
```

### Example 2: Simulating Network Failures

From `tests/x402v2/network-failures.test.ts` - using `createFailureInterceptor`
to simulate facilitator being unreachable:

```typescript
let interceptorCalled = false;

const harness = new TestHarness({
  supportedVersions: { x402v2: true },
  settleMode: "settle-only",
  accepts: [accepts()],
  facilitatorHandlers: [
    createTestFacilitatorHandler({ payTo: "test-receiver" }),
  ],
  clientHandlers: [createTestPaymentHandler()],
  clientInterceptors: [createV2ResponseInterceptor()],
  middlewareInterceptors: [
    createFailureInterceptor(matchFacilitatorAccepts, () => {
      interceptorCalled = true;
      return networkError("connection refused");
    }),
  ],
});

const fetch = harness.createFetch();
const response = await fetch("/test-resource");

t.ok(interceptorCalled, "failure interceptor should have been called");
t.equal(
  response.status,
  500,
  "should return 500 when facilitator is unreachable",
);
```

## Common Root Causes

### 1. Missing Required Fields in Responses

**Symptom:** Error message like "field X must be a string (was missing)"

**Diagnosis:** The facilitator or middleware is returning a response that doesn't
match the expected type schema. Use `createCaptureInterceptor` to capture the
actual response body and compare it against the type definitions in
`@faremeter/types/x402` or `@faremeter/types/x402v2`.

**Example:** The v1 `x402PaymentRequiredResponse` type requires an `error` field,
but if the facilitator `/accepts` endpoint omits it, the middleware validation
will fail with a 500 error.

### 2. Protocol Version Mismatch

**Symptom:** 400 error with "server does not support x402 protocol version X"

**Diagnosis:** Check the `supportedVersions` config in the test harness. The
client may be sending a v2 payment to a v1-only server, or vice versa.

### 3. Network Normalization Issues

**Symptom:** 400 error with "no matching payment handler found"

**Diagnosis:** The handler's network matching logic may expect CAIP-2 format
(e.g., `eip155:1`) but receive legacy format (e.g., `base-sepolia`), or vice
versa. Check the network values in both the accepts config and the handler.

### 4. Handler Returning Null

**Symptom:** 400 error with "no matching payment handler found"

**Diagnosis:** All facilitator handlers returned `null` for the given
requirements. Verify that:

- The test's `accepts` config matches what the handler expects
- The handler's `isMatchingRequirement` logic is correct
- The scheme/network/asset values align

## Cleanup

Remove any debug test files before committing. The interceptor-based debugging
should be temporary and not checked into the repository unless it adds permanent
test coverage value.

If you created a file like `debug.test.ts` or `harness-debug.test.ts`, delete it
after diagnosing the issue.
