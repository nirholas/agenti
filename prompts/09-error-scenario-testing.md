# Prompt: Add Comprehensive Error Scenario Testing

## Objective

Create a dedicated error testing suite that verifies every tool handles failures gracefully. In a DeFi/blockchain context, unhandled errors can mean lost funds or stuck transactions.

## Deliverable

### Create `tests/error-scenarios/error-scenarios.test.ts`

A test suite that systematically tests error handling across all tool categories.

## Error Categories to Test

### 1. Network Errors

```typescript
describe("Network Error Handling", () => {
  const networkErrors = [
    { name: "connection refused", error: new Error("ECONNREFUSED") },
    { name: "DNS resolution failed", error: new Error("ENOTFOUND") },
    { name: "connection timeout", error: new Error("ETIMEDOUT") },
    { name: "socket hang up", error: new Error("ECONNRESET") },
    { name: "SSL error", error: new Error("UNABLE_TO_VERIFY_LEAF_SIGNATURE") },
  ]

  for (const { name, error } of networkErrors) {
    it(`should handle ${name}`, async () => {
      global.fetch = vi.fn().mockRejectedValue(error)
      // Call tool, verify it returns an error response (not throws)
    })
  }
})
```

### 2. API Response Errors

```typescript
describe("API Response Error Handling", () => {
  const httpErrors = [
    { status: 400, statusText: "Bad Request" },
    { status: 401, statusText: "Unauthorized" },
    { status: 403, statusText: "Forbidden" },
    { status: 404, statusText: "Not Found" },
    { status: 429, statusText: "Too Many Requests" },
    { status: 500, statusText: "Internal Server Error" },
    { status: 502, statusText: "Bad Gateway" },
    { status: 503, statusText: "Service Unavailable" },
  ]

  for (const { status, statusText } of httpErrors) {
    it(`should handle HTTP ${status} ${statusText}`, async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status,
        statusText,
        json: () => Promise.reject(new Error("No JSON body")),
        text: () => Promise.resolve(statusText),
      })
      // Call tool, verify structured error response
    })
  }
})
```

### 3. Malformed Data Errors

```typescript
describe("Malformed Data Handling", () => {
  it("should handle empty response body", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(null),
    })
  })

  it("should handle non-JSON response", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.reject(new SyntaxError("Unexpected token <")),
      text: () => Promise.resolve("<html>Not Found</html>"),
    })
  })

  it("should handle response with missing expected fields", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({}), // Missing all expected fields
    })
  })

  it("should handle response with wrong types", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ price: "not-a-number", volume: null }),
    })
  })
})
```

### 4. Blockchain-Specific Errors

```typescript
describe("Blockchain Error Handling", () => {
  it("should handle invalid address format", async () => {
    // Pass "0xinvalid" as address
  })

  it("should handle invalid chain ID", async () => {
    // Pass chain ID 99999
  })

  it("should handle reverted transaction simulation", async () => {
    // Mock a contract call that reverts
  })

  it("should handle insufficient balance errors", async () => {
    // Mock insufficient funds response
  })

  it("should handle nonce too low errors", async () => {
    // Mock nonce conflict
  })

  it("should handle gas estimation failures", async () => {
    // Mock gas estimation revert
  })
})
```

### 5. Input Validation Errors

```typescript
describe("Input Validation", () => {
  it("should reject negative amounts", async () => {
    // Pass amount: -1
  })

  it("should reject zero amounts where inappropriate", async () => {
    // Pass amount: 0 to swap tool
  })

  it("should reject extremely large numbers", async () => {
    // Pass amount: "999999999999999999999999999999"
  })

  it("should reject SQL injection attempts in string params", async () => {
    // Pass "'; DROP TABLE --" as a parameter
  })

  it("should reject script injection in string params", async () => {
    // Pass "<script>alert(1)</script>" as a parameter
  })

  it("should handle unicode and special characters", async () => {
    // Pass emoji, null bytes, etc.
  })
})
```

## Test Helper: Error Scenario Runner

Create `tests/helpers/errorScenarios.ts`:

```typescript
import { vi } from "vitest"

export const networkErrors = [
  { name: "ECONNREFUSED", error: () => new Error("connect ECONNREFUSED") },
  { name: "ETIMEDOUT", error: () => new Error("connect ETIMEDOUT") },
  { name: "ENOTFOUND", error: () => new Error("getaddrinfo ENOTFOUND") },
  { name: "ECONNRESET", error: () => new Error("socket hang up") },
] as const

export const httpErrors = [
  { status: 400, text: "Bad Request" },
  { status: 401, text: "Unauthorized" },
  { status: 403, text: "Forbidden" },
  { status: 404, text: "Not Found" },
  { status: 429, text: "Too Many Requests" },
  { status: 500, text: "Internal Server Error" },
  { status: 502, text: "Bad Gateway" },
  { status: 503, text: "Service Unavailable" },
] as const

export function mockFetchError(error: Error) {
  return vi.fn().mockRejectedValue(error)
}

export function mockHttpError(status: number, statusText: string) {
  return vi.fn().mockResolvedValue({
    ok: false,
    status,
    statusText,
    json: () => Promise.reject(new Error("No body")),
    text: () => Promise.resolve(statusText),
  })
}

export function mockMalformedJson() {
  return vi.fn().mockResolvedValue({
    ok: true,
    json: () => Promise.reject(new SyntaxError("Unexpected token")),
    text: () => Promise.resolve("not json"),
  })
}
```

## Verification

```bash
npm test -- tests/error-scenarios/
```

Every test should pass — meaning every tool returns a structured MCP error response rather than throwing an unhandled exception.
