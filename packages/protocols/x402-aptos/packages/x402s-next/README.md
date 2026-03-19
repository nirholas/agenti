# x402s-next

Next.js middleware for integrating [Shelby Protocol](https://shelby.xyz) with x402a payments.

Part of the [x402s](../x402s) package family.

## Features

- ✅ Next.js App Router middleware
- ✅ Automatic session management
- ✅ x402a payment integration
- ✅ Chunkset tracking and consumption
- ✅ HTTP 402 protocol compliance
- ✅ TypeScript support

## Installation

```bash
npm install x402s-next x402s x402a @shelby-protocol/sdk
```

## Quick Start

### 1. Create middleware.ts

```typescript
// middleware.ts
import { createShelbyMiddleware } from 'x402s-next/middleware';
import { ShelbyGateway } from 'x402s/server';
import { X402Facilitator } from 'x402a/server';
import { ShelbyNodeClient, Network } from '@shelby-protocol/sdk/node';

const gateway = new ShelbyGateway({
  facilitator: new X402Facilitator({
    privateKey: process.env.FACILITATOR_PRIVATE_KEY!,
    contractAddress: process.env.CONTRACT_ADDRESS!,
  }),
  shelbyClient: new ShelbyNodeClient({
    network: Network.SHELBYNET,
    apiKey: process.env.SHELBY_API_KEY!,
  }),
  pricing: {
    octasPerChunkset: "100000",      // 0.001 APT per chunkset
    minPaymentOctas: "1000000",      // 0.01 APT minimum
    maxChunksetsPerSession: 1000,
  }
});

export default createShelbyMiddleware({
  gateway,
  payTo: process.env.PAYMENT_RECIPIENT_ADDRESS!,
  routes: {
    "/api/search": {
      price: "10000000",             // 0.1 APT payment
      chunksets: 100,                // Gets 100 chunksets
      description: "Shelby Search Bundle",
      chunksetsPerRequest: 1,        // Each search = 1 chunkset
    },
    "/api/storage/*": {
      price: "50000000",             // 0.5 APT
      chunksets: 500,
      description: "Shelby Storage Access",
      chunksetsPerRequest: 10,       // Each storage op = 10 chunksets
    }
  },
  onSessionCreated: async (req, sessionId) => {
    console.log(`Session created: ${sessionId}`);
  },
  onSessionUsed: async (req, sessionId, remaining) => {
    console.log(`Session ${sessionId} used, ${remaining} chunksets left`);
  }
});

export const config = {
  matcher: ['/api/search/:path*', '/api/storage/:path*']
};
```

### 2. Create protected API route

```typescript
// app/api/search/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { ShelbyNodeClient } from '@shelby-protocol/sdk/node';

const shelby = new ShelbyNodeClient({
  network: Network.SHELBYNET,
  apiKey: process.env.SHELBY_API_KEY!,
});

export async function GET(request: NextRequest) {
  // Middleware already verified payment/session
  const sessionId = request.headers.get('X-Shelby-Session');
  const chunksetsRemaining = request.headers.get('X-Shelby-Chunksets-Remaining');

  const query = request.nextUrl.searchParams.get('q');

  if (!query) {
    return NextResponse.json({ error: 'Missing query' }, { status: 400 });
  }

  // Use Shelby API with verified session
  const results = await shelby.search(sessionId!, query);

  return NextResponse.json({
    results,
    session: {
      id: sessionId,
      chunksetsRemaining: Number(chunksetsRemaining),
    }
  });
}
```

### 3. Client-side usage

```typescript
import { useState } from 'react';
import { useWallet } from '@aptos-labs/wallet-adapter-react';
import { useShelbySession } from 'x402s/client';

function SearchPage() {
  const { signTransaction } = useWallet();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState(null);

  const {
    session,
    createSession,
    needsRefill,
    isCreating
  } = useShelbySession({
    createSessionEndpoint: '/api/shelby/sessions',
    getSessionEndpoint: '/api/shelby/sessions',
  });

  const handleSearch = async () => {
    // Check if need to pay first
    if (needsRefill) {
      await handlePayment();
    }

    // Search with session
    const res = await fetch(`/api/search?q=${query}`, {
      headers: {
        'X-Shelby-Session': session!.sessionId,
      }
    });

    const data = await res.json();
    setResults(data.results);
  };

  const handlePayment = async () => {
    // Build transaction
    const txRes = await fetch('/api/facilitator/build', {
      method: 'POST',
      body: JSON.stringify({
        from: userAddress,
        to: recipientAddress,
        amount: "10000000", // 0.1 APT
      })
    });
    const { transactionPayload } = await txRes.json();

    // Sign
    const authenticator = await signTransaction(transactionPayload);

    // Create session
    await createSession({
      userAddress,
      authenticator,
      ...transactionPayload
    });
  };

  return (
    <div>
      {session && (
        <div>
          <p>Chunksets: {session.chunksetsRemaining}</p>
        </div>
      )}

      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search..."
      />

      <button onClick={handleSearch} disabled={isCreating}>
        {needsRefill ? 'Pay to Search' : 'Search'}
      </button>

      {results && <Results data={results} />}
    </div>
  );
}
```

## How It Works

1. **Client requests** protected route (e.g., `/api/search`)
2. **Middleware checks** for `X-Shelby-Session` header
3. **If no session**:
   - Returns HTTP 402 with payment requirements
   - Client pays via x402a
   - Middleware verifies payment & creates Shelby session
4. **If has session**:
   - Verifies chunksets available
   - Consumes chunksets for request
   - Allows request through
5. **Session info** attached to request headers for API route

## Response Headers

Middleware adds these headers to successful requests:

- `X-Shelby-Session`: Session ID
- `X-Shelby-Chunksets-Remaining`: Number of chunksets left
- `X-Payment-TxHash`: Transaction hash (on session creation)

## Configuration

### Route Configuration

```typescript
routes: {
  "/api/endpoint": {
    price: "10000000",           // Payment amount in octas
    chunksets: 100,              // Number of chunksets purchased
    description: "Description",  // For payment UI
    chunksetsPerRequest: 1,      // Chunksets consumed per request
  }
}
```

### Lifecycle Hooks

```typescript
{
  onPaymentRequired: async (req, requirements) => {
    // Called when no session/payment
  },
  onSessionCreated: async (req, sessionId) => {
    // Called after successful payment
    // Store session in DB, etc.
  },
  onSessionUsed: async (req, sessionId, remaining) => {
    // Called each time session is used
    // Log usage, send alerts, etc.
  },
  onError: async (req, error) => {
    // Called on errors
  }
}
```

## Environment Variables

```env
FACILITATOR_PRIVATE_KEY=0x...
CONTRACT_ADDRESS=0x...
PAYMENT_RECIPIENT_ADDRESS=0x...
SHELBY_API_KEY=aptoslabs_***
APTOS_NETWORK=testnet
```

## License

MIT
