# Error Handling

This guide covers error handling patterns in Agenti and how to diagnose common issues.

## Error Response Format

All tools return a consistent error format:

```json
{
  "success": false,
  "error": "Human-readable error message",
  "code": "ERROR_CODE",
  "details": {}
}
```

## Error Categories

### Input Validation Errors

Thrown by Zod when parameters don't match the schema:

```json
{
  "success": false,
  "error": "Invalid input: Expected string, received number at 'address'",
  "code": "VALIDATION_ERROR"
}
```

**Resolution**: Check parameter types and required fields match the tool's input schema.

### RPC/Network Errors

Blockchain RPC connectivity issues:

```json
{
  "success": false,
  "error": "Failed to connect to Ethereum RPC",
  "code": "RPC_ERROR",
  "details": { "chain": "ethereum", "rpcUrl": "https://..." }
}
```

**Resolution**:
- Verify RPC endpoint is accessible
- Check rate limits on your RPC provider
- Try an alternative RPC endpoint
- Ensure network connectivity

### Transaction Errors

On-chain transaction failures:

```json
{
  "success": false,
  "error": "Transaction reverted: insufficient balance",
  "code": "TX_ERROR",
  "details": { "txHash": "0x...", "reason": "ERC20: transfer amount exceeds balance" }
}
```

**Resolution**:
- Check wallet balance (including gas)
- Verify token approvals are in place
- Ensure contract addresses are correct
- Check if the contract is paused or restricted

### API Rate Limit Errors

External API rate limiting:

```json
{
  "success": false,
  "error": "Rate limit exceeded for CoinGecko API",
  "code": "RATE_LIMIT",
  "details": { "retryAfter": 60 }
}
```

**Resolution**:
- Wait and retry after the specified period
- Upgrade API tier for higher limits
- Enable caching to reduce API calls

### Authentication Errors

Missing or invalid credentials:

```json
{
  "success": false,
  "error": "PRIVATE_KEY environment variable not set",
  "code": "AUTH_ERROR"
}
```

**Resolution**: Set required environment variables per the [authentication guide](./authentication.md).

## Writing Error-Safe Tools

### Pattern

```typescript
export const myTool = {
  name: 'my_tool',
  description: '...',
  inputSchema,
  async execute(params: unknown) {
    // 1. Validate input (throws ZodError on failure)
    const validated = inputSchema.parse(params);

    try {
      // 2. Execute logic
      const result = await someOperation(validated);

      // 3. Return success
      return { success: true, data: result };
    } catch (error) {
      // 4. Return structured error
      if (error instanceof SomeSpecificError) {
        return {
          success: false,
          error: error.message,
          code: 'SPECIFIC_ERROR',
        };
      }
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        code: 'UNKNOWN_ERROR',
      };
    }
  },
};
```

### Guidelines

1. **Always validate inputs** first with Zod
2. **Catch specific errors** before generic ones
3. **Include error codes** for programmatic handling
4. **Provide actionable messages** that help the AI agent recover
5. **Never expose sensitive data** in error messages (no private keys, API secrets)
6. **Log errors** for debugging but sanitize sensitive information

## Retry Strategy

Built-in retry logic uses exponential backoff:

```
Attempt 1: immediate
Attempt 2: 1 second delay
Attempt 3: 2 second delay
Attempt 4: 4 second delay
(max 3 retries)
```

Retryable errors:
- Network timeouts
- RPC rate limits
- Temporary API failures (5xx)

Non-retryable errors:
- Validation errors (4xx)
- Insufficient balance
- Invalid addresses
- Authentication failures

## Debugging

### Enable Debug Logging

```env
LOG_LEVEL=debug
```

### Common Debug Steps

1. Check the MCP server logs for error details
2. Verify environment variables are set
3. Test RPC connectivity: `curl -X POST your-rpc-url`
4. Check wallet balance on block explorer
5. Verify contract addresses on chain explorer
