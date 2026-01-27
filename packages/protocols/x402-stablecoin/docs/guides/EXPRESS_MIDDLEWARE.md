# Express Middleware Integration Guide

Protect your API routes with HTTP 402 payment gates using the X402 SDK.

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Installing @x402/sdk](#installing-x402sdk)
3. [Protecting Routes with 402](#protecting-routes-with-402)
4. [Price Tiers and Metering](#price-tiers-and-metering)
5. [Handling Subscriptions](#handling-subscriptions)
6. [Testing in Development](#testing-in-development)
7. [Production Deployment Checklist](#production-deployment-checklist)
8. [Troubleshooting](#troubleshooting)
9. [Related Guides](#related-guides)

---

## Prerequisites

Before you begin, ensure you have:

- **Node.js 18+** installed
- **Express.js** application set up
- An Arbitrum wallet to receive payments
- Understanding of Express middleware patterns

---

## Installing @x402/sdk

```bash
# Using pnpm
pnpm add @x402/sdk express viem

# Using npm
npm install @x402/sdk express viem

# Using yarn
yarn add @x402/sdk express viem
```

### TypeScript Setup

```bash
# Install type definitions
pnpm add -D @types/express typescript
```

Create or update your `tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "esModuleInterop": true,
    "strict": true,
    "outDir": "./dist"
  },
  "include": ["src/**/*"]
}
```

---

## Protecting Routes with 402

### Basic Payment Gate

```typescript
// src/server.ts
import express from 'express';
import { createPaymentGate } from '@x402/sdk/http';

const app = express();
app.use(express.json());

// Configure payment gate
const paymentGate = createPaymentGate({
  amount: '0.01',           // $0.01 per request
  token: 'USDs',            // Payment token
  chain: 'arbitrum',        // Blockchain
  recipient: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0', // Your wallet
  resource: 'premium-api',  // Optional identifier
});

// Protect your premium routes
app.get('/api/premium/data', paymentGate, (req, res) => {
  res.json({
    message: 'Access granted!',
    data: { /* your premium data */ },
  });
});

// Public routes (no payment required)
app.get('/api/public/info', (req, res) => {
  res.json({ status: 'ok' });
});

app.listen(3000, () => {
  console.log('Server running on port 3000');
});
```

### How It Works

1. Client makes request without payment
2. Server returns `402 Payment Required` with payment details
3. Client makes payment on Arbitrum
4. Client retries request with `X-Payment-Proof` header
5. Server verifies payment and grants access

### 402 Response Format

```json
{
  "error": "Payment Required",
  "code": "PAYMENT_REQUIRED",
  "payment": {
    "amount": "0.01",
    "token": "USDs",
    "chain": "arbitrum",
    "recipient": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0",
    "resource": "premium-api",
    "validUntil": "2026-01-22T12:00:00Z"
  }
}
```

Response headers:
```
HTTP/1.1 402 Payment Required
X-Payment-Required: {"amount":"0.01","token":"USDs",...}
X-Payment-Chain: arbitrum
X-Payment-Recipient: 0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0
```

---

## Price Tiers and Metering

### Dynamic Pricing

```typescript
import { createDynamicPaymentGate } from '@x402/sdk/http';

// Price based on request parameters
const dynamicGate = createDynamicPaymentGate({
  token: 'USDs',
  chain: 'arbitrum',
  recipient: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0',
  
  // Calculate price dynamically
  calculatePrice: (req) => {
    const { tier, quantity } = req.query;
    
    const basePrices = {
      basic: 0.01,
      standard: 0.05,
      premium: 0.10,
    };
    
    const basePrice = basePrices[tier as string] || basePrices.basic;
    const qty = parseInt(quantity as string) || 1;
    
    return (basePrice * qty).toString();
  },
});

app.get('/api/data', dynamicGate, (req, res) => {
  res.json({ tier: req.query.tier, quantity: req.query.quantity });
});
```

### Per-Operation Pricing

```typescript
// Different prices for different operations
const prices: Record<string, string> = {
  'GET:/api/read': '0.001',
  'POST:/api/write': '0.01',
  'POST:/api/compute': '0.05',
  'GET:/api/premium': '0.10',
};

const operationGate = createDynamicPaymentGate({
  token: 'USDs',
  chain: 'arbitrum',
  recipient: process.env.RECIPIENT_ADDRESS as `0x${string}`,
  
  calculatePrice: (req) => {
    const key = `${req.method}:${req.path}`;
    return prices[key] || '0.01'; // Default price
  },
});

// Apply to all API routes
app.use('/api', operationGate);
```

### Usage-Based Metering

```typescript
interface UsageRecord {
  userId: string;
  endpoint: string;
  timestamp: Date;
  amount: string;
}

class UsageMeter {
  private records: UsageRecord[] = [];
  
  record(userId: string, endpoint: string, amount: string) {
    this.records.push({
      userId,
      endpoint,
      timestamp: new Date(),
      amount,
    });
  }
  
  getUsage(userId: string, since: Date): UsageRecord[] {
    return this.records.filter(
      r => r.userId === userId && r.timestamp >= since
    );
  }
  
  getTotalSpent(userId: string, since: Date): number {
    return this.getUsage(userId, since)
      .reduce((sum, r) => sum + parseFloat(r.amount), 0);
  }
}

const meter = new UsageMeter();

// Middleware to track usage
function trackUsage(amount: string) {
  return (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const userId = req.headers['x-user-id'] as string;
    if (userId) {
      meter.record(userId, req.path, amount);
    }
    next();
  };
}

app.get('/api/data', paymentGate, trackUsage('0.01'), (req, res) => {
  res.json({ data: 'your data' });
});

// Usage report endpoint
app.get('/api/usage', (req, res) => {
  const userId = req.headers['x-user-id'] as string;
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // 30 days
  
  res.json({
    records: meter.getUsage(userId, since),
    totalSpent: meter.getTotalSpent(userId, since),
  });
});
```

---

## Handling Subscriptions

### Subscription Middleware

```typescript
import { createPublicClient, http } from 'viem';
import { arbitrum } from 'viem/chains';

const SUBSCRIPTION_CONTRACT = '0x...'; // X402Subscription contract address

interface SubscriptionInfo {
  isActive: boolean;
  tier: string;
  expiresAt: Date;
}

// Check on-chain subscription status
async function checkSubscription(subscriber: string): Promise<SubscriptionInfo | null> {
  const publicClient = createPublicClient({
    chain: arbitrum,
    transport: http(),
  });
  
  try {
    const subscription = await publicClient.readContract({
      address: SUBSCRIPTION_CONTRACT,
      abi: subscriptionABI,
      functionName: 'getSubscription',
      args: [subscriber],
    });
    
    return {
      isActive: subscription.active,
      tier: subscription.tier,
      expiresAt: new Date(Number(subscription.expiresAt) * 1000),
    };
  } catch {
    return null;
  }
}

// Subscription check middleware
function requireSubscription(requiredTier?: string) {
  return async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const subscriberAddress = req.headers['x-subscriber-address'] as string;
    
    if (!subscriberAddress) {
      return res.status(401).json({ error: 'Subscriber address required' });
    }
    
    const subscription = await checkSubscription(subscriberAddress);
    
    if (!subscription || !subscription.isActive) {
      return res.status(402).json({
        error: 'Subscription required',
        subscriptionPlans: getSubscriptionPlans(),
      });
    }
    
    if (requiredTier && subscription.tier !== requiredTier) {
      return res.status(403).json({
        error: `${requiredTier} tier subscription required`,
        currentTier: subscription.tier,
      });
    }
    
    // Attach subscription info to request
    (req as any).subscription = subscription;
    next();
  };
}

// Usage
app.get('/api/basic', requireSubscription(), (req, res) => {
  res.json({ message: 'Welcome, subscriber!' });
});

app.get('/api/premium', requireSubscription('premium'), (req, res) => {
  res.json({ message: 'Welcome, premium subscriber!' });
});
```

### Subscription Plans

```typescript
function getSubscriptionPlans() {
  return [
    {
      tier: 'basic',
      name: 'Basic Plan',
      price: '10.00',
      interval: 'month',
      features: ['100 API calls/day', 'Standard support'],
    },
    {
      tier: 'pro',
      name: 'Pro Plan',
      price: '50.00',
      interval: 'month',
      features: ['Unlimited API calls', 'Priority support', 'Webhooks'],
    },
    {
      tier: 'premium',
      name: 'Premium Plan',
      price: '100.00',
      interval: 'month',
      features: ['Everything in Pro', 'Dedicated support', 'Custom features'],
    },
  ];
}

// Subscription signup endpoint
app.post('/api/subscribe', async (req, res) => {
  const { tier, subscriberAddress } = req.body;
  
  const plans = getSubscriptionPlans();
  const plan = plans.find(p => p.tier === tier);
  
  if (!plan) {
    return res.status(400).json({ error: 'Invalid tier' });
  }
  
  // Return subscription contract details
  res.json({
    plan,
    contractAddress: SUBSCRIPTION_CONTRACT,
    functionToCall: 'createSubscription',
    parameters: {
      recipient: process.env.RECIPIENT_ADDRESS,
      amount: plan.price,
      interval: 30 * 24 * 60 * 60, // 30 days in seconds
    },
  });
});
```

---

## Testing in Development

### Mock Payment Gate

```typescript
// src/middleware/mockPaymentGate.ts

interface MockConfig {
  enabled: boolean;
  autoApprove: boolean;
  delay?: number;
}

export function createMockPaymentGate(config: MockConfig) {
  return (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (!config.enabled) {
      // In production, use real payment gate
      return next();
    }
    
    // Check for mock payment header
    const mockPayment = req.headers['x-mock-payment'];
    
    if (mockPayment === 'approved' || config.autoApprove) {
      console.log('[MOCK] Payment auto-approved for:', req.path);
      
      if (config.delay) {
        setTimeout(next, config.delay);
      } else {
        next();
      }
      return;
    }
    
    // Return mock 402 response
    res.status(402).json({
      error: 'Payment Required',
      code: 'PAYMENT_REQUIRED',
      payment: {
        amount: '0.01',
        token: 'USDs',
        chain: 'arbitrum-sepolia', // Testnet
        recipient: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0',
      },
      mock: true,
    });
  };
}

// Usage in development
const isDev = process.env.NODE_ENV === 'development';

const paymentMiddleware = isDev
  ? createMockPaymentGate({ enabled: true, autoApprove: false })
  : createPaymentGate({ /* real config */ });

app.get('/api/premium', paymentMiddleware, handler);
```

### Test Payment Flow

```typescript
// tests/payment.test.ts
import request from 'supertest';
import { app } from '../src/server';

describe('Payment Gate', () => {
  it('should return 402 without payment', async () => {
    const res = await request(app)
      .get('/api/premium/data')
      .expect(402);
    
    expect(res.body.error).toBe('Payment Required');
    expect(res.body.payment).toBeDefined();
    expect(res.body.payment.amount).toBe('0.01');
  });
  
  it('should grant access with valid payment proof', async () => {
    const res = await request(app)
      .get('/api/premium/data')
      .set('X-Payment-Proof', '0x1234...valid-tx-hash')
      .set('X-Payment-Token', 'USDs')
      .expect(200);
    
    expect(res.body.message).toBe('Access granted!');
  });
  
  it('should reject invalid payment proof', async () => {
    const res = await request(app)
      .get('/api/premium/data')
      .set('X-Payment-Proof', 'invalid-proof')
      .expect(402);
    
    expect(res.body.error).toBe('Payment Required');
  });
});
```

### Local Development Setup

```typescript
// src/dev-server.ts
import express from 'express';
import { createPaymentGate } from '@x402/sdk/http';

const app = express();

// Use testnet for development
const paymentGate = createPaymentGate({
  amount: '0.01',
  token: 'USDs',
  chain: 'arbitrum-sepolia', // Testnet
  recipient: process.env.DEV_RECIPIENT as `0x${string}`,
  
  // Custom verification for testing
  verifyPayment: async (txHash, request) => {
    if (process.env.SKIP_PAYMENT_VERIFICATION === 'true') {
      console.log('[DEV] Skipping payment verification');
      return true;
    }
    // Real verification logic
    return await verifyOnChain(txHash, request);
  },
});

app.use('/api/premium', paymentGate);

// Development-only endpoints
if (process.env.NODE_ENV === 'development') {
  // Endpoint to simulate successful payment
  app.get('/dev/approve-payment', (req, res) => {
    res.json({
      mockTxHash: '0x' + 'a'.repeat(64),
      instructions: 'Use this hash in X-Payment-Proof header',
    });
  });
}
```

---

## Production Deployment Checklist

### ✅ Security Checklist

```typescript
// src/production-config.ts

// 1. Use environment variables for sensitive data
const config = {
  recipientAddress: process.env.RECIPIENT_ADDRESS,
  privateKey: process.env.PRIVATE_KEY,
  rpcUrl: process.env.ARBITRUM_RPC_URL,
};

// Validate required env vars
const requiredEnvVars = ['RECIPIENT_ADDRESS', 'PRIVATE_KEY', 'ARBITRUM_RPC_URL'];
for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    throw new Error(`Missing required environment variable: ${envVar}`);
  }
}

// 2. Enable security headers
import helmet from 'helmet';
app.use(helmet());

// 3. Enable CORS properly
import cors from 'cors';
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || false,
  credentials: true,
}));

// 4. Rate limiting
import rateLimit from 'express-rate-limit';
app.use(rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  message: { error: 'Rate limit exceeded' },
}));

// 5. Request validation
import { body, validationResult } from 'express-validator';
app.post('/api/endpoint',
  body('amount').isNumeric(),
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    next();
  },
  handler
);
```

### ✅ Monitoring Setup

```typescript
// src/monitoring.ts
import { createLogger, transports, format } from 'winston';

// Structured logging
const logger = createLogger({
  level: 'info',
  format: format.combine(
    format.timestamp(),
    format.json()
  ),
  transports: [
    new transports.Console(),
    new transports.File({ filename: 'payments.log' }),
  ],
});

// Payment tracking middleware
function paymentLogger(req: express.Request, res: express.Response, next: express.NextFunction) {
  const startTime = Date.now();
  
  res.on('finish', () => {
    if (req.headers['x-payment-proof']) {
      logger.info('Payment processed', {
        path: req.path,
        method: req.method,
        paymentProof: req.headers['x-payment-proof'],
        responseStatus: res.statusCode,
        duration: Date.now() - startTime,
      });
    }
  });
  
  next();
}

app.use(paymentLogger);
```

### ✅ High Availability

```typescript
// docker-compose.yml
version: '3.8'
services:
  api:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - RECIPIENT_ADDRESS=${RECIPIENT_ADDRESS}
      - ARBITRUM_RPC_URL=${ARBITRUM_RPC_URL}
    deploy:
      replicas: 3
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/health"]
      interval: 30s
      timeout: 10s
      retries: 3

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
    depends_on:
      - api
```

### ✅ Production Environment Variables

```bash
# .env.production

# Server
NODE_ENV=production
PORT=3000

# Payment Configuration
RECIPIENT_ADDRESS=0x...your-production-wallet
ARBITRUM_RPC_URL=https://arb-mainnet.g.alchemy.com/v2/YOUR-API-KEY

# Security
ALLOWED_ORIGINS=https://yourdomain.com,https://app.yourdomain.com
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_REQUESTS=100

# Monitoring
LOG_LEVEL=info
SENTRY_DSN=https://...@sentry.io/...

# Payment Verification
PAYMENT_CACHE_TTL_MS=86400000  # 24 hours
MIN_CONFIRMATIONS=1
```

---

## Troubleshooting

### Payment verification always fails

**Cause:** RPC node not synced or payment not confirmed.

**Solution:**
```typescript
// Wait for confirmations before verifying
const verifyPaymentOnChain = async (txHash: string, minConfirmations = 2) => {
  const receipt = await publicClient.waitForTransactionReceipt({
    hash: txHash as `0x${string}`,
    confirmations: minConfirmations,
  });
  
  return receipt.status === 'success';
};
```

### 402 responses not including payment headers

**Cause:** Middleware not setting headers correctly.

**Solution:**
```typescript
res.status(402)
  .set({
    'X-Payment-Required': JSON.stringify(paymentRequest),
    'X-Payment-Chain': 'arbitrum',
    'X-Payment-Recipient': recipient,
    'Access-Control-Expose-Headers': 'X-Payment-Required, X-Payment-Chain, X-Payment-Recipient',
  })
  .json({ error: 'Payment Required', payment: paymentRequest });
```

### CORS issues with payment headers

**Cause:** Custom headers not exposed.

**Solution:**
```typescript
app.use(cors({
  origin: true,
  credentials: true,
  exposedHeaders: [
    'X-Payment-Required',
    'X-Payment-Chain', 
    'X-Payment-Recipient',
    'X-Payment-Token',
  ],
}));
```

### Payment cache not working

**Cause:** Payment proof being revalidated on every request.

**Solution:**
```typescript
// Use a cache for verified payments
const paymentCache = new Map<string, { verified: boolean; expiresAt: number }>();

async function verifyWithCache(txHash: string): Promise<boolean> {
  const cached = paymentCache.get(txHash);
  
  if (cached && Date.now() < cached.expiresAt) {
    return cached.verified;
  }
  
  const verified = await verifyOnChain(txHash);
  paymentCache.set(txHash, {
    verified,
    expiresAt: Date.now() + 24 * 60 * 60 * 1000, // 24 hours
  });
  
  return verified;
}
```

---

## Related Guides

- [Quick Start](./QUICK_START.md) - Basic X402 setup
- [AI Agent Integration](./AI_AGENT_INTEGRATION.md) - Build AI agents with payment capabilities
- [Smart Contract Integration](./SMART_CONTRACT_INTEGRATION.md) - Direct contract interaction
- [Yield Tracking](./YIELD_TRACKING.md) - Monitor earned yield

---

## Resources

- [X402 SDK Documentation](/docs/API_REFERENCE.md)
- [Express.js Documentation](https://expressjs.com/)
- [Arbitrum Documentation](https://docs.arbitrum.io/)
- [Example Server Code](https://github.com/nirholas/x402/tree/main/facilitator)
