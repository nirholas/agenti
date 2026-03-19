# Adding Custom Tools

This guide explains how to add new tools to Agenti following the established patterns and conventions.

## Tool Structure

Every tool in Agenti follows a consistent pattern:

```typescript
// src/modules/<category>/<tool-name>.ts
import { z } from 'zod';

// 1. Define input schema with Zod
const inputSchema = z.object({
  param1: z.string().describe('Description of parameter'),
  param2: z.number().optional().describe('Optional numeric parameter'),
  chain: z.enum(['ethereum', 'polygon', 'base']).default('ethereum'),
});

// 2. Export the tool definition
export const myNewTool = {
  name: 'my_new_tool',
  description: 'Clear description of what this tool does and when to use it',
  inputSchema,
  async execute(params: unknown) {
    // 3. Validate inputs
    const validated = inputSchema.parse(params);

    // 4. Implement logic
    const result = await doSomething(validated);

    // 5. Return structured response
    return {
      success: true,
      data: result,
    };
  },
};
```

## Step-by-Step Guide

### 1. Choose a Category

Tools are organized in `src/modules/` by category:

| Category | Purpose |
|----------|---------|
| `market-data` | Price and market information |
| `defi` | DeFi protocol interactions |
| `dex-analytics` | DEX pool and trade data |
| `portfolio` | Wallet and portfolio tracking |
| `indicators` | Technical analysis |
| `sentiment` | Social sentiment data |
| `governance` | DAO governance |
| `alerts` | Notification triggers |
| `social` | Social media analytics |

### 2. Create the Tool File

```bash
touch src/modules/<category>/my-new-tool.ts
```

### 3. Define the Input Schema

Use Zod for input validation. Always add `.describe()` to help AI agents understand each parameter:

```typescript
const inputSchema = z.object({
  // Required string parameter
  address: z.string().describe('Wallet address (0x...)'),

  // Optional with default
  chain: z.enum(['ethereum', 'polygon', 'base'])
    .default('ethereum')
    .describe('Target blockchain'),

  // Optional parameter
  limit: z.number().min(1).max(100).optional()
    .describe('Maximum results to return'),

  // Validated format
  tokenAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/)
    .describe('ERC-20 token contract address'),
});
```

### 4. Implement the Execute Function

```typescript
async execute(params: unknown) {
  const validated = inputSchema.parse(params);

  try {
    // Use viem for blockchain interactions
    const client = getPublicClient(validated.chain);
    const result = await client.readContract({
      address: validated.tokenAddress as `0x${string}`,
      abi: erc20Abi,
      functionName: 'balanceOf',
      args: [validated.address as `0x${string}`],
    });

    return {
      success: true,
      data: {
        balance: result.toString(),
        token: validated.tokenAddress,
        chain: validated.chain,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
```

### 5. Register the Tool

Add your tool to the module's index file:

```typescript
// src/modules/<category>/index.ts
export { myNewTool } from './my-new-tool';
```

Then register it in the main tool registry:

```typescript
// src/modules/index.ts
import { myNewTool } from './<category>/my-new-tool';

// Add to the tools array
export const tools = [
  // ... existing tools
  myNewTool,
];
```

### 6. Add Tests

```typescript
// tests/modules/<category>/my-new-tool.test.ts
import { describe, it, expect } from 'vitest';
import { myNewTool } from '../../../src/modules/<category>/my-new-tool';

describe('myNewTool', () => {
  it('should have correct name and description', () => {
    expect(myNewTool.name).toBe('my_new_tool');
    expect(myNewTool.description).toBeTruthy();
  });

  it('should validate input schema', () => {
    expect(() => myNewTool.inputSchema.parse({})).toThrow();
    expect(() => myNewTool.inputSchema.parse({
      address: '0x1234...'
    })).not.toThrow();
  });

  it('should execute successfully', async () => {
    const result = await myNewTool.execute({
      address: '0x...',
      chain: 'ethereum',
    });
    expect(result.success).toBe(true);
  });
});
```

## Best Practices

- **Naming**: Use `snake_case` for tool names, prefix with category (e.g., `defi_aave_supply`)
- **Descriptions**: Write clear, concise descriptions that help AI agents decide when to use the tool
- **Validation**: Always validate inputs with Zod before processing
- **Error handling**: Return structured error responses, never throw unhandled exceptions
- **Idempotency**: Read-only tools should be safe to call multiple times
- **Chain support**: Use the chain parameter pattern for multi-chain tools
