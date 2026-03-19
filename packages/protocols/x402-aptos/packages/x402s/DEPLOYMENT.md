# x402s Deployment Guide

Complete guide for deploying x402s (x402a + Shelby Protocol integration) to production.

## Overview

x402s bridges **x402a micropayments** (Aptos blockchain) with **Shelby Protocol** (decentralized storage). Users pay in APT, receive Shelby chunksets, and can store/retrieve data.

**Architecture**:
```
User → x402a Payment (APT) → x402s Gateway → Shelby Session (chunksets) → Shelby Storage
```

---

## Prerequisites

### 1. x402a Contract (Already Deployed ✅)

```
Contract Address: 0x966eb1d2d3ed1e199f7d92335b5bb40f7a79dbbfb142ed951035bf78ba1b9744
Network:          Aptos Testnet
Module:           x402_transfer
Status:           Live and operational
```

### 2. Shelby API Key (Required)

Get your API key from: **https://geomi.dev**

- Sign up for Shelby account
- Generate API key
- Copy key to environment variables

### 3. Funded Wallets

**Facilitator Wallet** (pays gas for sponsored transactions):
- Needs APT balance for transaction fees
- Address: `process.env.X402_FACILITATOR_ADDRESS`
- Private key: `process.env.X402_FACILITATOR_PRIVATE_KEY`

---

## Installation

```bash
npm install x402s @shelby-protocol/sdk
```

**Peer Dependencies**:
```bash
npm install x402a @aptos-labs/ts-sdk pino
```

---

## Configuration

### Environment Variables

Create `.env` file:

```bash
# x402a Contract & Facilitator
CONTRACT_ADDRESS=0x966eb1d2d3ed1e199f7d92335b5bb40f7a79dbbfb142ed951035bf78ba1b9744
X402_FACILITATOR_PRIVATE_KEY=0x<your_facilitator_private_key>
X402_FACILITATOR_ADDRESS=0x<your_facilitator_address>
X402_NETWORK=aptos-testnet

# Shelby Protocol
SHELBY_API_KEY=<your_api_key_from_geomi_dev>
SHELBY_NETWORK=SHELBYNET
SHELBY_RPC_URL=https://api.shelbynet.shelby.xyz/shelby

# x402s Pricing
SHELBY_OCTAS_PER_CHUNKSET=100000        # 0.001 APT per chunkset
SHELBY_MIN_PAYMENT_OCTAS=1000000        # 0.01 APT minimum
SHELBY_MAX_CHUNKSETS_PER_SESSION=1000   # Maximum chunksets per session

# Session Storage (Choose one)
SESSION_STORAGE=memory                   # Options: memory, redis, postgres
# REDIS_URL=redis://localhost:6379       # If using Redis
# DATABASE_URL=postgresql://...          # If using PostgreSQL
```

---

## Deployment Options

### Option 1: In-Memory Storage (Development Only)

**Pros**: Zero setup, fast, simple
**Cons**: Sessions lost on restart, single-server only
**Use for**: Development, testing, demos

```typescript
import { X402Facilitator } from 'x402a/server';
import { ShelbyGateway, InMemorySessionStorage } from 'x402s/server';

const gateway = new ShelbyGateway({
  facilitator: new X402Facilitator({
    privateKey: process.env.X402_FACILITATOR_PRIVATE_KEY!,
    contractAddress: process.env.CONTRACT_ADDRESS!,
    network: 'testnet',
  }),
  pricing: {
    octasPerChunkset: process.env.SHELBY_OCTAS_PER_CHUNKSET!,
    minPaymentOctas: process.env.SHELBY_MIN_PAYMENT_OCTAS!,
    maxChunksetsPerSession: 1000,
  },
  apiKey: process.env.SHELBY_API_KEY!,
  sessionStorage: new InMemorySessionStorage(), // Default
});
```

### Option 2: Redis Storage (Recommended for Production)

**Pros**: Fast, distributed, auto-expiration
**Cons**: Requires Redis server
**Use for**: Production, multi-server deployments

```typescript
import { createClient } from 'redis';
import { ShelbyGateway, RedisSessionStorage } from 'x402s/server';

// Connect to Redis
const redis = createClient({ url: process.env.REDIS_URL });
await redis.connect();

const gateway = new ShelbyGateway({
  facilitator: /* ... */,
  pricing: /* ... */,
  apiKey: process.env.SHELBY_API_KEY!,
  sessionStorage: new RedisSessionStorage(redis),
});
```

**Redis Setup**:
```bash
# Docker
docker run -d -p 6379:6379 redis:alpine

# Or install locally
brew install redis      # macOS
apt-get install redis   # Ubuntu
```

### Option 3: PostgreSQL Storage (Maximum Reliability)

**Pros**: ACID guarantees, queryable, persistent
**Cons**: Requires database server
**Use for**: Enterprise production, auditing requirements

```typescript
import { Pool } from 'pg';
import { ShelbyGateway, PostgreSQLSessionStorage } from 'x402s/server';

// Connect to PostgreSQL
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const gateway = new ShelbyGateway({
  facilitator: /* ... */,
  pricing: /* ... */,
  apiKey: process.env.SHELBY_API_KEY!,
  sessionStorage: new PostgreSQLSessionStorage(pool),
});
```

**Database Schema**:
```sql
CREATE TABLE shelby_sessions (
  session_id VARCHAR(255) PRIMARY KEY,
  user_address VARCHAR(66) NOT NULL,
  chunksets_remaining INT NOT NULL,
  created_at BIGINT NOT NULL,
  expires_at BIGINT NOT NULL,
  funding_tx_hash VARCHAR(66),
  INDEX idx_user_address (user_address),
  INDEX idx_expires_at (expires_at)
);
```

---

## API Integration

### Next.js App Router Example

```typescript
// app/api/shelby/sessions/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { gateway } from '@/lib/shelby';

export async function POST(request: NextRequest) {
  const body = await request.json();

  // Verify x402a payment and create Shelby session
  const result = await gateway.createSessionFromPayment({
    from: body.from,
    to: body.to,
    amount: body.amount,
    nonce: body.nonce,
    authenticator: body.authenticator,
    validUntil: body.validUntil,
    chainId: body.chainId,
  });

  if (!result.valid) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({
    success: true,
    session: result.session,
    txHash: result.txHash,
  });
}

export async function GET(request: NextRequest) {
  const sessionId = request.nextUrl.searchParams.get('sessionId');

  if (!sessionId) {
    return NextResponse.json({ error: 'Missing sessionId' }, { status: 400 });
  }

  const session = await gateway.getSession(sessionId);

  if (!session) {
    return NextResponse.json({ error: 'Session not found' }, { status: 404 });
  }

  return NextResponse.json(session);
}
```

### Express.js Example

```typescript
import express from 'express';
import { gateway } from './lib/shelby';

const app = express();
app.use(express.json());

app.post('/api/shelby/sessions', async (req, res) => {
  const result = await gateway.createSessionFromPayment(req.body);

  if (!result.valid) {
    return res.status(400).json({ error: result.error });
  }

  res.json({
    success: true,
    session: result.session,
    txHash: result.txHash,
  });
});

app.get('/api/shelby/sessions/:sessionId', async (req, res) => {
  const session = await gateway.getSession(req.params.sessionId);

  if (!session) {
    return res.status(404).json({ error: 'Session not found' });
  }

  res.json(session);
});

app.post('/api/shelby/sessions/:sessionId/use', async (req, res) => {
  const { chunksetsToConsume } = req.body;

  const result = await gateway.useSession(
    req.params.sessionId,
    chunksetsToConsume
  );

  res.json(result);
});

app.listen(3000, () => console.log('x402s server running on port 3000'));
```

---

## Client-Side Integration

### React Hook Example

```typescript
import { useShelbySession } from 'x402s/client';
import { useX402Payment } from 'x402a/client';

function StorageApp() {
  const { executePayment, isProcessing } = useX402Payment({
    contractAddress: '0x966eb1d2d3ed1e199f7d92335b5bb40f7a79dbbfb142ed951035bf78ba1b9744',
    network: 'aptos-testnet',
  });

  const { session, createSession, needsRefill } = useShelbySession({
    createSessionEndpoint: '/api/shelby/sessions',
    getSessionEndpoint: '/api/shelby/sessions',
    onLowChunksets: (remaining) => {
      alert(`Low on chunksets! ${remaining} remaining`);
    },
  });

  const handlePurchaseStorage = async () => {
    // 1. Execute x402a payment (0.1 APT)
    const txHash = await executePayment({
      amount: 0.1,
      recipientAddress: process.env.NEXT_PUBLIC_PLATFORM_ADDRESS,
      paymentType: 'purchase',
      resourceId: 'shelby-storage',
    });

    // 2. Create Shelby session from payment
    if (txHash) {
      await createSession({ txHash });
    }
  };

  return (
    <div>
      {session ? (
        <p>Storage: {session.chunksetsRemaining} chunksets remaining</p>
      ) : (
        <button onClick={handlePurchaseStorage} disabled={isProcessing}>
          Purchase Storage (0.1 APT = 100 chunksets)
        </button>
      )}

      {needsRefill && (
        <button onClick={handlePurchaseStorage}>
          Refill Storage
        </button>
      )}
    </div>
  );
}
```

---

## Production Checklist

### Security

- [ ] Store private keys in secure vault (AWS Secrets Manager, HashiCorp Vault)
- [ ] Use environment variables for all sensitive data
- [ ] Enable HTTPS/TLS for all API endpoints
- [ ] Implement rate limiting on payment endpoints
- [ ] Add CORS restrictions
- [ ] Monitor for suspicious payment patterns

### Monitoring

- [ ] Set up logging (Pino is built-in)
- [ ] Monitor facilitator wallet balance
- [ ] Track session creation/usage metrics
- [ ] Set up alerts for low wallet balance
- [ ] Monitor Shelby API rate limits

### Reliability

- [ ] Use Redis or PostgreSQL for session storage (not in-memory)
- [ ] Implement session expiry cleanup cron job
- [ ] Set up database backups (if using PostgreSQL)
- [ ] Configure Redis persistence (if using Redis)
- [ ] Test failover scenarios

### Performance

- [ ] Enable connection pooling for database
- [ ] Cache frequently accessed sessions
- [ ] Monitor API latency
- [ ] Optimize chunkset calculation
- [ ] Consider CDN for static assets

---

## Troubleshooting

### "Shelby API key invalid"
- Verify key from https://geomi.dev
- Check `SHELBY_API_KEY` environment variable
- Ensure key hasn't expired

### "Session not found"
- Check session storage configuration
- Verify session hasn't expired (24 hour default)
- Check database/Redis connectivity

### "Insufficient funds"
- Ensure facilitator wallet has APT balance
- Check `X402_FACILITATOR_ADDRESS` balance on explorer
- Fund wallet: https://aptoslabs.com/testnet-faucet

### "Payment verification failed"
- Verify x402a contract address is correct
- Check network (testnet vs mainnet)
- Ensure nonce hasn't been used
- Verify signature is valid

---

## Costs & Pricing

### Aptos Gas Fees
- Registry initialization: ~0.0005 APT (one-time per user)
- Sponsored transfer: ~0.0003 APT per transaction
- Facilitator pays gas, not end user

### Shelby Storage
- Configurable via `SHELBY_OCTAS_PER_CHUNKSET`
- Default: 100,000 octas = 0.001 APT per chunkset
- 1 chunkset = 10 MB user data (16 MB total with erasure coding)
- Example: 0.1 APT = 100 chunksets = 1 GB storage

### Recommended Pricing
```
Small:   0.01 APT =  10 chunksets =  100 MB
Medium:  0.05 APT =  50 chunksets =  500 MB
Large:   0.10 APT = 100 chunksets = 1000 MB
XLarge:  0.50 APT = 500 chunksets = 5000 MB
```

---

## Support & Resources

- **x402a Documentation**: https://github.com/raintree-technology/x402a
- **Shelby Protocol**: https://shelby.xyz
- **Shelby SDK**: https://www.npmjs.com/package/@shelby-protocol/sdk
- **Aptos Explorer**: https://explorer.aptoslabs.com
- **API Key**: https://geomi.dev

---

## Status

- ✅ x402a contract deployed and verified
- ✅ Shelby RPC client implemented
- ✅ Session storage abstraction (memory/Redis/PostgreSQL)
- ✅ React hooks for client integration
- ⏳ Waiting for Shelby RPC session APIs (currently uses virtual sessions)

**Current Limitation**: Shelby Protocol's RPC session management APIs are not yet publicly available. x402s creates virtual sessions tracked locally until the APIs are released. All infrastructure is in place to switch to real Shelby RPC sessions when available.
