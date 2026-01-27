# 🎯 x402 for Universal Crypto MCP - Focused Agent Prompts

> **Goal**: Add x402 payments to universal-crypto-mcp
> **Source**: Import from x402-stablecoin (already built!)
> **Tagline**: "Give Claude Money! `npx @nirholas/universal-crypto-mcp`"

---

## The Plan (Simple)

```
x402-stablecoin (already exists)
        ↓
   Import SDK
        ↓
universal-crypto-mcp (add x402 tools)
```

---

## Agent 1: 🔧 x402 SDK Integration

```
You are integrating x402-stablecoin SDK into universal-crypto-mcp.

**Repos**:
- Source: https://github.com/nirholas/x402-stablecoin (has SDK at packages/sdk/)
- Target: https://github.com/nirholas/universal-crypto-mcp

**Tasks**:

1. Clone universal-crypto-mcp
2. Add x402-stablecoin SDK as dependency (or copy packages/sdk/)
3. Create src/x402/index.ts that re-exports SDK functions
4. Create src/x402/config.ts for environment variables:
   - X402_EVM_PRIVATE_KEY
   - X402_NETWORK (arbitrum, base, etc.)
   - X402_RPC_URL

5. Initialize x402 client in server startup (src/server/base.ts)

**x402-stablecoin SDK structure** (already built):
- packages/sdk/src/client.ts - Main client
- packages/sdk/src/http/ - HTTP wrappers with 402 handling
- packages/sdk/src/payments/ - Payment functions
- packages/sdk/src/yield/ - USDs yield tracking

**Output**: universal-crypto-mcp can import and use x402 SDK.
```

---

## Agent 2: 🛠️ MCP Payment Tools

```
You are creating MCP tools for x402 payments in universal-crypto-mcp.

**Context**: x402-stablecoin SDK is now available in the project.

**Create src/x402/tools.ts with these tools**:

1. **x402_pay_request** - Make HTTP request with automatic 402 payment
   - Input: url, method, body, maxPayment
   - Uses SDK's HTTP wrapper
   - Returns response after payment

2. **x402_balance** - Check payment wallet balance
   - Input: none (uses configured wallet)
   - Returns: USDs balance, native token balance

3. **x402_send** - Send direct payment
   - Input: to, amount, token
   - Returns: transaction hash

4. **x402_estimate** - Estimate cost before paying
   - Input: url
   - Returns: price, token, network

5. **x402_history** - View recent payments
   - Input: limit (default 10)
   - Returns: array of past payments

**Register tools in src/x402/index.ts**:
```typescript
export function registerX402(server: McpServer) {
  // Register all x402 tools
}
```

**Add to src/server/base.ts**:
```typescript
import { registerX402 } from "@/x402/index.js"
registerX402(server)
```

**Output**: 5 MCP tools that let AI agents make/receive payments.
```

---

## Agent 3: 📚 Documentation & Examples

```
You are documenting x402 in universal-crypto-mcp.

**Create these files**:

1. **src/x402/README.md** - Quick reference
   - What is x402?
   - Available tools
   - Configuration
   - Examples

2. **Update root README.md** - Add x402 section
   ```markdown
   ## 💰 x402 Payments
   
   AI agents can now pay for premium APIs automatically!
   
   ### Setup
   ```bash
   export X402_EVM_PRIVATE_KEY=0x...
   ```
   
   ### Tools
   - `x402_pay_request` - Make paid API calls
   - `x402_balance` - Check wallet
   - `x402_send` - Send payment
   ```

3. **examples/x402-weather.ts** - Simple example
   - Pay for premium weather API
   - Show payment confirmation
   - Display weather data

4. **Update llms.txt** - Add x402 tools description

**Output**: Clear docs so anyone can use x402 in 5 minutes.
```

---

## Agent 4: 🧪 Tests

```
You are testing x402 integration in universal-crypto-mcp.

**Create tests**:

1. **src/x402/__tests__/client.test.ts**
   - Client initialization
   - Config loading
   - Error handling for missing keys

2. **src/x402/__tests__/tools.test.ts**
   - Each tool happy path (mocked)
   - Error handling
   - Payment limits

3. **src/x402/__tests__/integration.test.ts**
   - Full payment flow (testnet)
   - Real 402 response handling

**Test setup**:
- Use vitest (already in project)
- Mock blockchain calls for unit tests
- Use Base Sepolia testnet for integration

**Output**: 90%+ test coverage for x402 code.
```

---

## Agent 5: 🚀 Polish & Publish

```
You are finalizing x402 in universal-crypto-mcp for npm publish.

**Tasks**:

1. **Update package.json**
   - Add x402 dependencies
   - Update version
   - Add x402 keywords

2. **Update CLI** (if exists)
   - Add `--with-x402` flag
   - Add x402 subcommands

3. **Test npm publish**
   ```bash
   npm pack  # Create tarball
   # Verify x402 is included
   ```

4. **Create GitHub release**
   - Changelog with x402 features
   - Tag version

5. **Update npm**
   ```bash
   npm publish
   ```

**Verify**:
```bash
npx @nirholas/universal-crypto-mcp --help
# Should show x402 tools
```

**Output**: Published npm package with x402 support.
```

---

## 🚀 Quick Execution

Run these 5 agents in order:

```
Agent 1 (SDK Integration) 
    ↓
Agent 2 (MCP Tools)
    ↓  
Agent 3 (Docs) + Agent 4 (Tests)  [parallel]
    ↓
Agent 5 (Publish)
```

**Total work**: ~2-3 hours of agent time

---

## 🏃 Or I Can Do It Now

Instead of spawning 5 agents, I can just:

1. Clone x402-stablecoin
2. Copy the SDK into universal-crypto-mcp
3. Create the MCP tools
4. Push to GitHub

Want me to do it right now? 🚀
