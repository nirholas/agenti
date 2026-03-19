# Testing Guide

Agenti uses Vitest for unit and integration testing. This guide covers how to run, write, and organize tests.

## Running Tests

```bash
# Run all tests
npm test

# Run specific test file
npm test -- tests/modules/market-data/price.test.ts

# Run tests matching a pattern
npm test -- --grep "market_data"

# Run with coverage
npm test -- --coverage

# Run in watch mode
npm test -- --watch

# Run E2E tests
npm run test:e2e

# Interactive MCP inspector
npm run test:inspector
```

## Test Structure

```
tests/
├── modules/           # Module-level unit tests
│   ├── market-data/
│   ├── defi/
│   ├── portfolio/
│   └── ...
├── vendors/           # Vendor integration tests
│   ├── solana/
│   ├── cosmos/
│   └── ...
├── server/            # Server transport tests
│   ├── http.test.ts
│   ├── sse.test.ts
│   └── stdio.test.ts
├── e2e/               # End-to-end tests
│   └── mcp-flow.test.ts
└── fixtures/          # Test data and mocks
    └── ...
```

## Writing Tests

### Unit Test Pattern

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { myTool } from '../../../src/modules/category/my-tool';

describe('myTool', () => {
  // Test tool metadata
  it('should have correct name', () => {
    expect(myTool.name).toBe('my_tool');
  });

  it('should have a description', () => {
    expect(myTool.description).toBeTruthy();
    expect(myTool.description.length).toBeGreaterThan(10);
  });

  // Test input validation
  describe('input validation', () => {
    it('should accept valid input', () => {
      const result = myTool.inputSchema.safeParse({
        address: '0x1234567890abcdef1234567890abcdef12345678',
        chain: 'ethereum',
      });
      expect(result.success).toBe(true);
    });

    it('should reject invalid input', () => {
      const result = myTool.inputSchema.safeParse({});
      expect(result.success).toBe(false);
    });

    it('should apply defaults', () => {
      const result = myTool.inputSchema.parse({
        address: '0x...',
      });
      expect(result.chain).toBe('ethereum');
    });
  });

  // Test execution
  describe('execute', () => {
    it('should return success response', async () => {
      const result = await myTool.execute({
        address: '0x...',
        chain: 'ethereum',
      });
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
    });

    it('should handle errors gracefully', async () => {
      const result = await myTool.execute({
        address: 'invalid',
        chain: 'ethereum',
      });
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });
});
```

### Mocking External APIs

```typescript
import { vi } from 'vitest';
import axios from 'axios';

vi.mock('axios');

beforeEach(() => {
  vi.mocked(axios.get).mockResolvedValue({
    data: { price: 43250 },
  });
});
```

### Testing Blockchain Interactions

```typescript
import { vi } from 'vitest';
import { createPublicClient } from 'viem';

// Mock viem client
vi.mock('viem', async () => {
  const actual = await vi.importActual('viem');
  return {
    ...actual,
    createPublicClient: vi.fn().mockReturnValue({
      readContract: vi.fn().mockResolvedValue(BigInt('1000000000000000000')),
    }),
  };
});
```

## MCP Inspector Testing

The MCP inspector provides an interactive way to test tools:

```bash
npm run test:inspector
```

This opens a browser-based interface where you can:
- Browse all available tools
- Execute tools with custom inputs
- View response formats
- Debug tool behavior

## Best Practices

1. **Test input validation** - Verify Zod schemas accept valid and reject invalid inputs
2. **Test happy path** - Ensure tools return correct data for valid inputs
3. **Test error handling** - Verify graceful error responses
4. **Mock external calls** - Don't make real API/blockchain calls in unit tests
5. **Use fixtures** - Share test data across related tests
6. **Test edge cases** - Empty arrays, zero values, max limits
7. **Keep tests fast** - Unit tests should complete in under 1 second each

## Continuous Integration

Tests run automatically on pull requests via GitHub Actions. See `.github/workflows/` for CI configuration.
