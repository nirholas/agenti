# x402s

HTTP 402 Payment Required integration for [Shelby Protocol](https://shelby.xyz) on Aptos blockchain.

Built on top of [x402a](../x402a), x402s bridges Aptos micropayments with Shelby's session-based storage and compute access system.

## Features

- ✅ Accept x402a payments and convert to Shelby sessions
- ✅ Session management with automatic chunkset tracking
- ✅ React hooks for client-side integration
- ✅ Next.js middleware (coming in x402s-next)
- ✅ Full TypeScript support
- ✅ Built on Aptos blockchain

## Installation

```bash
npm install x402s x402a @shelby-protocol/sdk @aptos-labs/ts-sdk
```

## Quick Start

### Server-side (Gateway)

```typescript
import { X402Facilitator } from 'x402a/server';
import { ShelbyNodeClient, Network } from '@shelby-protocol/sdk/node';
import { ShelbyGateway } from 'x402s/server';

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
    octasPerChunkset: "100000", // 0.001 APT per chunkset
    minPaymentOctas: "1000000", // 0.01 APT minimum
    maxChunksetsPerSession: 1000,
  }
});

// Accept payment and create session
const result = await gateway.createSessionFromPayment({
  userAddress: "0x123...",
  authenticator: signedAuthenticator,
  nonce: "...",
  validUntil: 1234567890,
  chainId: 2, // testnet
  transaction: "0x...",
});

console.log(`Session created: ${result.session?.sessionId}`);
console.log(`Chunksets: ${result.session?.chunksetsRemaining}`);
```

### Client-side (React)

```tsx
import { useShelbySession } from 'x402s/client';
import { useWallet } from '@aptos-labs/wallet-adapter-react';

function MyComponent() {
  const { signTransaction } = useWallet();

  const {
    session,
    createSession,
    needsRefill,
    isCreating
  } = useShelbySession({
    createSessionEndpoint: '/api/shelby/sessions',
    getSessionEndpoint: '/api/shelby/sessions',
    onLowChunksets: (remaining) => {
      alert(`Only ${remaining} chunksets remaining!`);
    }
  });

  const handlePayment = async () => {
    // 1. Get transaction from facilitator
    const txResponse = await fetch('/api/facilitator/build', {
      method: 'POST',
      body: JSON.stringify({
        from: userAddress,
        to: recipientAddress,
        amount: "10000000", // 0.1 APT
      })
    });
    const { transactionPayload } = await txResponse.json();

    // 2. Sign with wallet
    const authenticator = await signTransaction(transactionPayload);

    // 3. Create session
    await createSession({
      userAddress,
      authenticator,
      ...transactionPayload
    });
  };

  return (
    <div>
      {needsRefill ? (
        <button onClick={handlePayment} disabled={isCreating}>
          {isCreating ? 'Processing...' : 'Pay to Access'}
        </button>
      ) : (
        <div>
          <p>Active session</p>
          <p>Chunksets remaining: {session?.chunksetsRemaining}</p>
        </div>
      )}
    </div>
  );
}
```

## Architecture

```
┌─────────────┐
│   Client    │  useShelbySession hook
│  (Browser)  │
└──────┬──────┘
       │ x402a payment
       ▼
┌─────────────────┐
│  ShelbyGateway  │  Verifies payment + creates session
│  (Next.js API)  │
└────────┬────────┘
         │
         ├─────────► x402a Facilitator (Aptos blockchain)
         │           └─ Submit transaction
         │           └─ Pay gas fees
         │
         └─────────► Shelby API
                     └─ Create session
                     └─ Track chunksets
```

## Payment Flow

1. **Client requests access** to protected resource
2. **Server returns 402** with payment requirements
3. **Client pays via x402a** (signs transaction, facilitator submits)
4. **Gateway verifies payment** on Aptos blockchain
5. **Gateway creates Shelby session** with purchased chunksets
6. **Client uses session** to access Shelby storage/compute
7. **Session auto-refreshes** to track chunkset consumption

## Pricing

You configure the conversion rate between APT and Shelby chunksets:

```typescript
pricing: {
  octasPerChunkset: "100000",     // 0.001 APT = 1 chunkset
  minPaymentOctas: "1000000",     // 0.01 APT minimum payment
  maxChunksetsPerSession: 1000,   // Cap per session
}
```

Example: 0.1 APT payment = 100 chunksets

## Status

**Status**: Experimental (v0.1.0)
**Network**: Testnet only
**Production**: Not recommended for production use with real funds

## Packages

- `x402s` - Core SDK (this package)
- `x402s-next` - Next.js middleware (coming soon)

## License

MIT

## Links

- [x402a](../x402a) - Base HTTP 402 implementation
- [Shelby Protocol](https://shelby.xyz)
- [Aptos](https://aptos.dev)
