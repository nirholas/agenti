# Next.js App Router Example

This example demonstrates how to use x402a-next middleware with Next.js App Router to create payment-gated API endpoints.

## Features

- ✅ Payment-gated API routes using x402a middleware
- ✅ Automatic 402 responses for unpaid requests
- ✅ Payment verification with facilitator
- ✅ `/api/x402/supported` endpoint
- ✅ Lifecycle hooks for payment events

## Setup

1. Install dependencies:

```bash
pnpm install
```

2. Configure your payment settings in `middleware.ts`:

```typescript
const config = {
  payTo: '0x1234...', // Your Aptos wallet address
  routes: {
    '/api/stream': {
      price: '1000000', // 0.01 APT in octas
      network: 'aptos-testnet'
    }
  }
};
```

## Running

```bash
pnpm dev
```

The application will start at `http://localhost:3000`.

## API Endpoints

### GET /api/stream

Protected endpoint that requires payment of 0.01 APT.

**Without payment:**

```bash
curl http://localhost:3000/api/stream
# Returns 402 Payment Required with payment requirements
```

**With payment:**

```bash
curl http://localhost:3000/api/stream \\
  -H "X-Payment: <base64-encoded-payment-proof>"
# Returns protected content
```

### GET /api/x402/supported

Returns supported payment types.

```bash
curl http://localhost:3000/api/x402/supported
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

## Project Structure

```
nextjs-app-router/
├── app/
│   ├── api/
│   │   ├── stream/
│   │   │   └── route.ts          # Protected API route
│   │   └── x402/
│   │       └── supported/
│   │           └── route.ts      # Supported payments endpoint
│   └── page.tsx                  # Home page with instructions
├── middleware.ts                 # x402a payment middleware
└── package.json
```

## How It Works

1. **Middleware intercepts requests** to protected routes (`/api/stream`)
2. **Checks for payment header** (`X-Payment`)
3. **If no payment** → returns 402 with payment requirements
4. **If payment present** → verifies with facilitator
5. **If valid** → adds payment headers and allows request through
6. **Route handler** receives request with payment info in headers

## Configuration Options

See [`packages/x402a-next/README.md`](../../packages/x402a-next/README.md) for full configuration options.

## Learn More

- [x402a Documentation](../../packages/x402a/README.md)
- [x402a-next Documentation](../../packages/x402a-next/README.md)
- [x402 Protocol Specification](../../docs/X402A_SPECIFICATION.md)
