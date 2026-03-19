# x402a-next

EXPERIMENTAL: Next.js middleware for x402a Aptos micropayment protocol.

**Warning**: This is an experimental v0.1.0 release. Not recommended for production use with real funds. Use testnet only.

## Installation

```bash
npm install x402a x402a-next
# or
pnpm add x402a x402a-next
# or
yarn add x402a x402a-next
```

## Quick Start

### App Router (Next.js 13+)

Create a middleware file in your project root:

```typescript
// middleware.ts
import { createPaymentMiddleware } from 'x402a-next/middleware';

export const middleware = createPaymentMiddleware({
  payTo: '0x1234...', // Your Aptos wallet address
  routes: {
    '/api/stream': {
      price: '1000000', // 0.01 APT in octas
      network: 'aptos-testnet',
      description: 'Audio streaming access'
    },
    '/api/premium/*': {
      price: '500000', // 0.005 APT
      network: 'aptos-testnet'
    }
  },
  facilitator: {
    url: 'https://your-facilitator.com'
  },
  debug: true
});

export const config = {
  matcher: '/api/:path*'
};
```

## Features

- **Drop-in middleware** for Next.js App Router
- **Pattern matching** for routes (exact, wildcard, parameters)
- **Automatic 402 responses** with payment requirements
- **Payment verification** via facilitator or client-side
- **Lifecycle hooks** for payment events
- **TypeScript support** with full type definitions
- **Edge runtime compatible** for App Router

## Configuration

### MiddlewareConfig

```typescript
interface MiddlewareConfig {
  // Required: Address to receive payments
  payTo: string;

  // Required: Route configurations
  routes: Record<string, RouteConfig>;

  // Optional: Facilitator for payment verification
  facilitator?: {
    url: string;
    headers?: Record<string, string>;
    timeout?: number;
  };

  // Optional: Lifecycle hooks
  onPaymentRequired?: (req: Request, requirements: PaymentRequirements) => void;
  onPaymentVerified?: (req: Request, payer: string) => void;
  onPaymentSettled?: (req: Request, txHash: string) => void;
  onPaymentError?: (req: Request, error: Error) => void;

  // Optional: Debug logging
  debug?: boolean;
}
```

### RouteConfig

```typescript
interface RouteConfig {
  // Required: Price in octas
  price: string;

  // Optional: Network (default: 'aptos-testnet')
  network?: 'aptos-testnet' | 'aptos-mainnet';

  // Optional: Description shown to users
  description?: string;

  // Optional: Custom resource identifier
  resource?: string;

  // Optional: Override with custom payment requirements
  paymentRequirements?: PaymentRequirements;
}
```

## Route Patterns

x402a-next supports flexible route matching:

```typescript
routes: {
  // Exact match
  '/api/stream': { price: '1000000' },

  // Wildcard
  '/api/premium/*': { price: '500000' },

  // Parameter
  '/api/content/:id': { price: '250000' }
}
```

## Lifecycle Hooks

```typescript
createPaymentMiddleware({
  payTo: '0x123...',
  routes: { '/api/data': { price: '1000000' } },

  // Called when payment is required
  onPaymentRequired: async (req, requirements) => {
    console.log('Payment required:', requirements);
  },

  // Called when payment is verified
  onPaymentVerified: async (req, payer) => {
    console.log('Payment verified from:', payer);
    // Update database, log analytics, etc.
  },

  // Called when payment settles on-chain
  onPaymentSettled: async (req, txHash) => {
    console.log('Payment settled:', txHash);
  },

  // Called on errors
  onPaymentError: async (req, error) => {
    console.error('Payment error:', error);
  }
});
```

## /supported Endpoint

Create an endpoint that returns supported payment types:

### App Router

```typescript
// app/api/x402/supported/route.ts
import { createSupportedHandler } from 'x402a-next/middleware';

const config = {
  payTo: '0x123...',
  routes: {
    '/api/stream': { price: '1000000', network: 'aptos-testnet' }
  }
};

export const GET = createSupportedHandler(config);
```

Response:

```json
{
  "x402Version": 1,
  "kinds": [
    {
      "x402Version": 1,
      "scheme": "exact",
      "network": "aptos-testnet",
      "resource": "/api/stream"
    }
  ]
}
```

## Edge Runtime

x402a-next is compatible with Next.js Edge Runtime:

```typescript
// middleware.ts
export const config = {
  runtime: 'edge',
  matcher: '/api/:path*'
};
```

## Examples

See the [examples](../../examples) directory for complete working examples:

- `examples/next-app-router` - App Router with payment middleware

## License

MIT - see [LICENSE](../../LICENSE)
