# AI Agent Integration Guide

Build AI agents that can autonomously make X402 payments to access paid APIs and services.

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Setting Up MCP Server](#setting-up-mcp-server)
3. [Configuring Claude to Use X402 Tools](#configuring-claude-to-use-x402-tools)
4. [Configuring GPT to Use X402 Tools](#configuring-gpt-to-use-x402-tools)
5. [Handling 402 Responses Programmatically](#handling-402-responses-programmatically)
6. [Best Practices for AI Payment Flows](#best-practices-for-ai-payment-flows)
7. [Cost Management and Budgets](#cost-management-and-budgets)
8. [Example: Building a Paid API Wrapper](#example-building-a-paid-api-wrapper)
9. [Troubleshooting](#troubleshooting)
10. [Related Guides](#related-guides)

---

## Prerequisites

Before starting, ensure you have:

- **Node.js 18+** installed
- **@x402/sdk** package installed
- An Arbitrum wallet with USDs tokens
- API key for Claude (Anthropic) or GPT (OpenAI)
- Basic understanding of tool calling / function calling

```bash
# Install required packages
pnpm add @x402/sdk @anthropic-ai/sdk openai viem
```

---

## Setting Up MCP Server

The Model Context Protocol (MCP) server provides X402 tools to AI agents.

### 1. Create the MCP Server

```typescript
// mcp-server.ts
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createX402Client } from '@x402/sdk';
import { privateKeyToAccount } from 'viem/accounts';

// Initialize X402 client
const account = privateKeyToAccount(process.env.PRIVATE_KEY as `0x${string}`);
const x402Client = createX402Client({ chain: 'arbitrum', account });

// Create MCP server
const server = new Server(
  { name: 'x402-mcp', version: '1.0.0' },
  { capabilities: { tools: {} } }
);

// Register X402 tools
server.setRequestHandler('tools/list', async () => ({
  tools: [
    {
      name: 'check_balance',
      description: 'Check USDs balance and yield earned for the wallet',
      inputSchema: {
        type: 'object',
        properties: {},
        required: [],
      },
    },
    {
      name: 'make_payment',
      description: 'Make an X402 payment using USDs to a recipient',
      inputSchema: {
        type: 'object',
        properties: {
          recipient: { type: 'string', description: 'Recipient address (0x...)' },
          amount: { type: 'string', description: 'Amount in USDs (e.g., "0.01")' },
          reason: { type: 'string', description: 'Reason for the payment' },
        },
        required: ['recipient', 'amount', 'reason'],
      },
    },
    {
      name: 'call_paid_api',
      description: 'Call an API that may require X402 payment, handling 402 automatically',
      inputSchema: {
        type: 'object',
        properties: {
          url: { type: 'string', description: 'The API URL to call' },
          method: { type: 'string', enum: ['GET', 'POST'], description: 'HTTP method' },
          body: { type: 'string', description: 'Request body (for POST)' },
        },
        required: ['url', 'method'],
      },
    },
  ],
}));

// Handle tool calls
server.setRequestHandler('tools/call', async (request) => {
  const { name, arguments: args } = request.params;

  switch (name) {
    case 'check_balance': {
      const balance = await x402Client.getBalance();
      const yield_ = await x402Client.getYieldEarned();
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            balance: balance.formatted,
            yieldEarned: yield_.formatted,
            currency: 'USDs',
          }),
        }],
      };
    }

    case 'make_payment': {
      const { recipient, amount, reason } = args as any;
      console.log(`[X402] Payment: ${amount} USDs to ${recipient}`);
      console.log(`[X402] Reason: ${reason}`);
      
      const receipt = await x402Client.pay({ recipient, amount });
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            success: true,
            txHash: receipt.transactionHash,
            amount,
            recipient,
          }),
        }],
      };
    }

    case 'call_paid_api': {
      const { url, method, body } = args as any;
      const response = await x402Client.fetchWith402Handling(url, {
        method,
        body: body ? JSON.parse(body) : undefined,
      });
      
      return {
        content: [{
          type: 'text',
          text: await response.text(),
        }],
      };
    }

    default:
      throw new Error(`Unknown tool: ${name}`);
  }
});

// Start server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('[X402 MCP] Server started');
}

main().catch(console.error);
```

### 2. Configure Claude Desktop

Add to your Claude Desktop configuration (`~/Library/Application Support/Claude/claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "x402": {
      "command": "node",
      "args": ["/path/to/mcp-server.js"],
      "env": {
        "PRIVATE_KEY": "0x...your-private-key"
      }
    }
  }
}
```

---

## Configuring Claude to Use X402 Tools

### Using the Anthropic SDK

```typescript
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// Define X402 tools
const tools = [
  {
    name: 'check_balance',
    description: 'Check USDs balance and yield earned for your wallet',
    input_schema: {
      type: 'object' as const,
      properties: {},
      required: [],
    },
  },
  {
    name: 'make_payment',
    description: 'Make an X402 payment using USDs',
    input_schema: {
      type: 'object' as const,
      properties: {
        recipient: {
          type: 'string',
          description: 'The recipient address for the payment',
        },
        amount: {
          type: 'string',
          description: 'The amount to pay in USDs (e.g., "0.01")',
        },
        reason: {
          type: 'string',
          description: 'Why this payment is being made',
        },
      },
      required: ['recipient', 'amount', 'reason'],
    },
  },
  {
    name: 'call_paid_api',
    description: 'Call a paid API that requires X402 payment',
    input_schema: {
      type: 'object' as const,
      properties: {
        endpoint: {
          type: 'string',
          description: 'The API endpoint to call',
        },
        method: {
          type: 'string',
          enum: ['GET', 'POST'],
        },
        body: {
          type: 'string',
          description: 'Request body for POST requests',
        },
      },
      required: ['endpoint', 'method'],
    },
  },
];

// Send message with tool access
const response = await anthropic.messages.create({
  model: 'claude-sonnet-4-20250514',
  max_tokens: 4096,
  tools,
  messages: [
    {
      role: 'user',
      content: 'Check my USDs balance and then pay $0.05 to 0x742d...0bEb0 for API access',
    },
  ],
});

// Handle tool calls in response
for (const block of response.content) {
  if (block.type === 'tool_use') {
    const result = await handleToolCall(block.name, block.input);
    // Continue conversation with tool result
  }
}
```

### Tool Handler Implementation

```typescript
import { createX402Client } from '@x402/sdk';
import { privateKeyToAccount } from 'viem/accounts';

const account = privateKeyToAccount(process.env.PRIVATE_KEY as `0x${string}`);
const x402Client = createX402Client({ chain: 'arbitrum', account });

async function handleToolCall(name: string, input: any): Promise<string> {
  switch (name) {
    case 'check_balance': {
      const balance = await x402Client.getBalance();
      const yieldEarned = await x402Client.getYieldEarned();
      return JSON.stringify({
        balance: balance.formatted,
        yieldEarned: yieldEarned.formatted,
        apy: '10.2%',
        currency: 'USDs',
      });
    }

    case 'make_payment': {
      const { recipient, amount, reason } = input;
      console.log(`💸 Making payment: ${amount} USDs to ${recipient}`);
      console.log(`   Reason: ${reason}`);
      
      const receipt = await x402Client.pay({ recipient, amount });
      return JSON.stringify({
        success: true,
        txHash: receipt.transactionHash,
        amount,
        recipient,
      });
    }

    case 'call_paid_api': {
      const { endpoint, method, body } = input;
      const response = await x402Client.fetchWith402Handling(endpoint, {
        method,
        body,
      });
      
      if (response.status === 402) {
        // Payment required - extract details
        const paymentInfo = response.headers.get('X-Payment-Required');
        return JSON.stringify({
          status: 402,
          paymentRequired: JSON.parse(paymentInfo || '{}'),
        });
      }
      
      return await response.text();
    }

    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}
```

---

## Configuring GPT to Use X402 Tools

### Using OpenAI SDK

```typescript
import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Define X402 functions for GPT
const functions = [
  {
    name: 'check_balance',
    description: 'Check USDs balance and yield earned',
    parameters: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
  {
    name: 'make_payment',
    description: 'Make an X402 payment using USDs',
    parameters: {
      type: 'object',
      properties: {
        recipient: {
          type: 'string',
          description: 'Recipient address (0x...)',
        },
        amount: {
          type: 'string',
          description: 'Amount in USDs',
        },
        reason: {
          type: 'string',
          description: 'Payment reason',
        },
      },
      required: ['recipient', 'amount', 'reason'],
    },
  },
];

// Chat completion with function calling
const response = await openai.chat.completions.create({
  model: 'gpt-4',
  messages: [
    {
      role: 'user',
      content: 'Pay $0.10 USDs to 0x742d...0bEb0 to access the weather API',
    },
  ],
  functions,
  function_call: 'auto',
});

// Handle function calls
const message = response.choices[0].message;
if (message.function_call) {
  const { name, arguments: args } = message.function_call;
  const result = await handleToolCall(name, JSON.parse(args));
  
  // Send result back to GPT
  const followUp = await openai.chat.completions.create({
    model: 'gpt-4',
    messages: [
      { role: 'user', content: 'Pay $0.10 USDs to 0x742d...0bEb0' },
      message,
      { role: 'function', name, content: result },
    ],
  });
}
```

---

## Handling 402 Responses Programmatically

### Automatic 402 Handling

```typescript
import { fetchWith402Handling, HTTP402Handler } from '@x402/sdk/http';
import { privateKeyToAccount } from 'viem/accounts';

const account = privateKeyToAccount(process.env.PRIVATE_KEY as `0x${string}`);

// Method 1: Simple fetch wrapper
const response = await fetchWith402Handling(
  'https://api.paidservice.com/data',
  { method: 'GET' },
  {
    account,
    chain: 'arbitrum',
    maxAmount: '1.00', // Budget cap
    autoApprove: true, // Automatically pay if under maxAmount
  }
);

// Method 2: HTTP402Handler class for more control
const handler = new HTTP402Handler({
  account,
  chain: 'arbitrum',
  onPaymentRequired: async (paymentRequest) => {
    console.log(`Payment required: ${paymentRequest.amount} ${paymentRequest.token}`);
    console.log(`To: ${paymentRequest.recipient}`);
    
    // Custom approval logic
    const approved = await askUserForApproval(paymentRequest);
    return approved;
  },
});

const result = await handler.fetch('https://api.paidservice.com/data');
```

### Manual 402 Handling

```typescript
async function callPaidApi(url: string, options: RequestInit = {}) {
  // First attempt
  let response = await fetch(url, options);
  
  if (response.status === 402) {
    // Parse payment requirements
    const paymentRequired = response.headers.get('X-Payment-Required');
    const paymentInfo = JSON.parse(paymentRequired || '{}');
    
    console.log('Payment required:', paymentInfo);
    
    // Make payment
    const receipt = await x402Client.pay({
      recipient: paymentInfo.recipient,
      amount: paymentInfo.amount,
    });
    
    // Retry with payment proof
    response = await fetch(url, {
      ...options,
      headers: {
        ...options.headers,
        'X-Payment-Proof': receipt.transactionHash,
        'X-Payment-Token': 'USDs',
      },
    });
  }
  
  return response;
}
```

---

## Best Practices for AI Payment Flows

### 1. Implement Approval Workflows

Never let AI agents make unlimited payments. Always implement approval checks:

```typescript
interface PaymentApproval {
  maxSinglePayment: string;  // e.g., "1.00"
  dailyBudget: string;       // e.g., "10.00"
  requireConfirmation: boolean;
  allowedRecipients?: string[];
}

class ApprovedPaymentHandler {
  private spentToday = 0;
  
  constructor(private config: PaymentApproval) {}
  
  async approvePayment(amount: string, recipient: string): Promise<boolean> {
    const amountNum = parseFloat(amount);
    
    // Check single payment limit
    if (amountNum > parseFloat(this.config.maxSinglePayment)) {
      console.log(`❌ Payment of ${amount} exceeds max single payment`);
      return false;
    }
    
    // Check daily budget
    if (this.spentToday + amountNum > parseFloat(this.config.dailyBudget)) {
      console.log(`❌ Payment would exceed daily budget`);
      return false;
    }
    
    // Check allowed recipients
    if (this.config.allowedRecipients) {
      if (!this.config.allowedRecipients.includes(recipient)) {
        console.log(`❌ Recipient not in allowed list`);
        return false;
      }
    }
    
    // Optional confirmation
    if (this.config.requireConfirmation) {
      const confirmed = await this.getUserConfirmation(amount, recipient);
      if (!confirmed) return false;
    }
    
    this.spentToday += amountNum;
    return true;
  }
}
```

### 2. Log All Payments

```typescript
interface PaymentLog {
  timestamp: Date;
  amount: string;
  recipient: string;
  reason: string;
  txHash: string;
  agentId: string;
}

class PaymentLogger {
  private logs: PaymentLog[] = [];
  
  log(payment: PaymentLog) {
    this.logs.push(payment);
    console.log(`[PAYMENT LOG] ${JSON.stringify(payment)}`);
    
    // Optionally persist to database
    this.persistToDatabase(payment);
  }
  
  async getRecentPayments(agentId: string, days: number = 7): Promise<PaymentLog[]> {
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    return this.logs.filter(
      log => log.agentId === agentId && log.timestamp > cutoff
    );
  }
}
```

### 3. Implement Retry Logic

```typescript
async function robustPaidApiCall(
  url: string,
  maxRetries: number = 3,
  retryDelay: number = 1000
): Promise<Response> {
  let lastError: Error | null = null;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await callPaidApi(url);
      
      if (response.ok) {
        return response;
      }
      
      if (response.status === 402) {
        // Payment handled internally, retry
        continue;
      }
      
      // Other error, throw
      throw new Error(`API error: ${response.status}`);
    } catch (error) {
      lastError = error as Error;
      console.log(`Attempt ${attempt} failed: ${error}`);
      
      if (attempt < maxRetries) {
        await new Promise(r => setTimeout(r, retryDelay * attempt));
      }
    }
  }
  
  throw lastError || new Error('Max retries exceeded');
}
```

---

## Cost Management and Budgets

### Setting Up Budget Controls

```typescript
import { createX402Client } from '@x402/sdk';

// Configure client with budget limits
const x402Client = createX402Client({
  chain: 'arbitrum',
  account,
  budget: {
    perTransaction: '1.00',    // Max $1 per transaction
    perHour: '5.00',           // Max $5 per hour
    perDay: '50.00',           // Max $50 per day
    perMonth: '500.00',        // Max $500 per month
    alertThreshold: 0.8,       // Alert at 80% of limits
    onLimitReached: (limit) => {
      console.log(`⚠️ Budget limit reached: ${limit}`);
      notifyAdmin(`Agent reached ${limit} budget limit`);
    },
  },
});
```

### Monitoring Agent Spending

```typescript
interface SpendingReport {
  agentId: string;
  period: 'hour' | 'day' | 'week' | 'month';
  totalSpent: string;
  transactionCount: number;
  avgTransactionSize: string;
  topRecipients: { address: string; amount: string }[];
}

async function generateSpendingReport(agentId: string): Promise<SpendingReport> {
  const payments = await paymentLogger.getRecentPayments(agentId, 30);
  
  const totalSpent = payments.reduce(
    (sum, p) => sum + parseFloat(p.amount),
    0
  );
  
  // Group by recipient
  const byRecipient = payments.reduce((acc, p) => {
    acc[p.recipient] = (acc[p.recipient] || 0) + parseFloat(p.amount);
    return acc;
  }, {} as Record<string, number>);
  
  return {
    agentId,
    period: 'month',
    totalSpent: totalSpent.toFixed(2),
    transactionCount: payments.length,
    avgTransactionSize: (totalSpent / payments.length).toFixed(4),
    topRecipients: Object.entries(byRecipient)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([address, amount]) => ({
        address,
        amount: amount.toFixed(2),
      })),
  };
}
```

---

## Example: Building a Paid API Wrapper

Here's a complete example of wrapping a paid API for AI agents:

```typescript
// paid-api-wrapper.ts
import { createX402Client } from '@x402/sdk';
import { privateKeyToAccount } from 'viem/accounts';

interface PaidApiConfig {
  baseUrl: string;
  apiKeyHeader?: string;
  maxPaymentPerCall: string;
  dailyBudget: string;
}

class PaidApiWrapper {
  private x402Client;
  private dailySpend = 0;
  private lastResetDate = new Date().toDateString();

  constructor(private config: PaidApiConfig) {
    const account = privateKeyToAccount(process.env.PRIVATE_KEY as `0x${string}`);
    this.x402Client = createX402Client({ chain: 'arbitrum', account });
  }

  private resetDailySpendIfNeeded() {
    const today = new Date().toDateString();
    if (today !== this.lastResetDate) {
      this.dailySpend = 0;
      this.lastResetDate = today;
    }
  }

  async call(endpoint: string, options: RequestInit = {}): Promise<any> {
    this.resetDailySpendIfNeeded();

    const url = `${this.config.baseUrl}${endpoint}`;
    
    // First attempt
    let response = await fetch(url, options);
    
    if (response.status === 402) {
      // Check budget
      const paymentInfo = JSON.parse(
        response.headers.get('X-Payment-Required') || '{}'
      );
      const amount = parseFloat(paymentInfo.amount || '0');
      
      if (amount > parseFloat(this.config.maxPaymentPerCall)) {
        throw new Error(`Payment ${amount} exceeds max per call`);
      }
      
      if (this.dailySpend + amount > parseFloat(this.config.dailyBudget)) {
        throw new Error(`Payment would exceed daily budget`);
      }
      
      // Make payment
      console.log(`💳 Paying ${paymentInfo.amount} USDs for API access`);
      const receipt = await this.x402Client.pay({
        recipient: paymentInfo.recipient,
        amount: paymentInfo.amount,
      });
      
      this.dailySpend += amount;
      
      // Retry with payment proof
      response = await fetch(url, {
        ...options,
        headers: {
          ...options.headers,
          'X-Payment-Proof': receipt.transactionHash,
        },
      });
    }
    
    if (!response.ok) {
      throw new Error(`API error: ${response.status} ${response.statusText}`);
    }
    
    return response.json();
  }

  async getSpendingSummary() {
    this.resetDailySpendIfNeeded();
    return {
      dailySpend: this.dailySpend.toFixed(2),
      dailyBudget: this.config.dailyBudget,
      remaining: (parseFloat(this.config.dailyBudget) - this.dailySpend).toFixed(2),
    };
  }
}

// Usage example
const weatherApi = new PaidApiWrapper({
  baseUrl: 'https://api.paidweather.com',
  maxPaymentPerCall: '0.10',
  dailyBudget: '5.00',
});

// AI agent can use this
const weather = await weatherApi.call('/v1/forecast?city=NYC');
console.log('Weather:', weather);
```

### Exposing as AI Tools

```typescript
// Create tools from the wrapper
function createPaidApiTools(wrapper: PaidApiWrapper) {
  return [
    {
      name: 'get_weather',
      description: 'Get weather forecast for a city (may require payment)',
      input_schema: {
        type: 'object',
        properties: {
          city: { type: 'string', description: 'City name' },
        },
        required: ['city'],
      },
      handler: async (input: { city: string }) => {
        const data = await wrapper.call(`/v1/forecast?city=${input.city}`);
        return JSON.stringify(data);
      },
    },
    {
      name: 'check_api_budget',
      description: 'Check remaining budget for paid API calls',
      input_schema: {
        type: 'object',
        properties: {},
        required: [],
      },
      handler: async () => {
        const summary = await wrapper.getSpendingSummary();
        return JSON.stringify(summary);
      },
    },
  ];
}
```

---

## Troubleshooting

### "Insufficient balance" when making payment

**Cause:** The wallet doesn't have enough USDs tokens.

**Solution:**
```typescript
// Check balance before payments
const balance = await x402Client.getBalance();
if (parseFloat(balance.formatted) < parseFloat(amount)) {
  throw new Error(`Insufficient balance: ${balance.formatted} < ${amount}`);
}
```

### Tool calls not being triggered

**Cause:** Tool descriptions may not be clear enough for the AI.

**Solution:** Improve tool descriptions:
```typescript
{
  name: 'make_payment',
  description: `Make a payment using USDs cryptocurrency. 
    Use this when you need to pay for an API, service, or resource.
    Always specify the reason for the payment.`,
  // ...
}
```

### Payment verification failing on retry

**Cause:** The payment proof header is not being sent correctly.

**Solution:**
```typescript
// Ensure headers are correctly formatted
const headers = new Headers(options.headers);
headers.set('X-Payment-Proof', txHash);
headers.set('X-Payment-Chain', 'arbitrum');
headers.set('X-Payment-Token', 'USDs');
```

### Daily budget exceeded unexpectedly

**Cause:** Budget tracking not persisting across restarts.

**Solution:** Persist budget state to database:
```typescript
// Store in Redis or database
await redis.set(`budget:${agentId}:${today}`, JSON.stringify(budgetState));
```

---

## Related Guides

- [Quick Start](./QUICK_START.md) - Basic X402 payment setup
- [Express Middleware](./EXPRESS_MIDDLEWARE.md) - Protect your own APIs
- [Smart Contract Integration](./SMART_CONTRACT_INTEGRATION.md) - Direct contract interaction
- [Yield Tracking](./YIELD_TRACKING.md) - Monitor earned yield

---

## Resources

- [Anthropic Tool Use Documentation](https://docs.anthropic.com/claude/docs/tool-use)
- [OpenAI Function Calling](https://platform.openai.com/docs/guides/function-calling)
- [Model Context Protocol](https://modelcontextprotocol.io/)
- [X402 SDK API Reference](/docs/API_REFERENCE.md)
