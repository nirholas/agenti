# Usage Examples

This guide provides practical examples for integrating the `x402-starknet` library into your applications.

> **Note:** All code examples in this guide are available as runnable TypeScript files in the [`examples/`](../examples/) directory.

## Table of Contents

- [Building an x402 Client](#building-an-x402-client)
- [Building an x402 API](#building-an-x402-api)
- [Building an x402 Facilitator](#building-an-x402-facilitator)
- [Complete Integration Example](#complete-integration-example)
- [Server-Side Examples](#server-side-examples)
  - [Building Payment Requirements](#building-payment-requirements)
  - [Validating Incoming Requests](#validating-incoming-requests)
  - [Verifying Payments](#verifying-payments)
  - [Settling Payments](#settling-payments)
- [Client-Side Examples](#client-side-examples)
  - [Creating Payment Payloads](#creating-payment-payloads)
- [Utility Examples](#utility-examples)
  - [Network Utilities](#network-utilities)
  - [Token Utilities](#token-utilities)
  - [Provider Factory](#provider-factory)

---

## Building an x402 Client

An x402 client handles payment flows from the user's perspective. It receives payment requirements from APIs, creates signed payment payloads, and submits them to complete purchases.

### Basic Client Setup

```typescript
import { Account, RpcProvider } from 'starknet';
import {
  createPaymentPayload,
  decodePaymentRequired,
  encodePaymentSignature,
  DEFAULT_PAYMASTER_ENDPOINTS,
  HTTP_HEADERS,
  type PaymentPayload,
  type PaymentRequired,
  type PaymentRequirements,
} from 'x402-starknet';

// Initialize Starknet provider
const provider = new RpcProvider({
  nodeUrl: 'https://starknet-sepolia.public.blastapi.io',
});

// These would come from your wallet or environment
declare const accountAddress: string;
declare const privateKey: string;

// Create account (starknet.js v9+)
const account = new Account({
  provider,
  address: accountAddress,
  signer: privateKey,
});

/**
 * Complete x402 client that handles the payment flow
 */
class X402Client {
  private account: Account;

  constructor(account: Account) {
    this.account = account;
  }

  /**
   * Make a request to a paid API endpoint
   */
  async fetchWithPayment(
    url: string,
    options: RequestInit = {}
  ): Promise<Response> {
    // Step 1: Make initial request
    const response = await fetch(url, options);

    // Step 2: Check if payment is required
    if (response.status !== 402) {
      return response;
    }

    // Step 3: Extract payment requirements from 402 response
    const paymentRequiredHeader = response.headers.get(
      HTTP_HEADERS.PAYMENT_REQUIRED
    );
    if (!paymentRequiredHeader) {
      throw new Error('402 response missing PAYMENT-REQUIRED header');
    }

    const paymentRequired: PaymentRequired = decodePaymentRequired(
      paymentRequiredHeader
    );
    console.log('Payment required:', paymentRequired.error);

    // Step 4: Select the best payment option (if multiple offered)
    const requirements = this.selectPayment(paymentRequired.accepts);

    // Step 5: Create signed payment payload
    const payload = await this.createPayment(requirements);

    // Step 6: Retry request with payment - merge headers properly
    let existingHeaders: Record<string, string> = {};
    if (options.headers instanceof Headers) {
      options.headers.forEach((value, key) => {
        existingHeaders[key] = value;
      });
    } else if (Array.isArray(options.headers)) {
      existingHeaders = Object.fromEntries(options.headers) as Record<
        string,
        string
      >;
    } else if (options.headers) {
      existingHeaders = options.headers as Record<string, string>;
    }

    const paidResponse = await fetch(url, {
      ...options,
      headers: {
        ...existingHeaders,
        [HTTP_HEADERS.PAYMENT_SIGNATURE]: encodePaymentSignature(payload),
      },
    });

    return paidResponse;
  }

  /**
   * Select the best payment option from available requirements
   * This is a simple implementation - you can add more sophisticated logic
   * (e.g., check balances, prefer certain tokens, etc.)
   */
  private selectPayment(
    accepts: Array<PaymentRequirements>
  ): PaymentRequirements {
    // For simplicity, just pick the first option
    // In production, you might check balances, prefer certain tokens, etc.
    const first = accepts[0];
    if (!first) {
      throw new Error('No payment options available');
    }
    return first;
  }

  /**
   * Create a signed payment payload
   */
  private async createPayment(
    requirements: PaymentRequirements
  ): Promise<PaymentPayload> {
    const paymasterEndpoint = DEFAULT_PAYMASTER_ENDPOINTS[requirements.network];

    const payload = await createPaymentPayload(this.account, 2, requirements, {
      endpoint: paymasterEndpoint,
      network: requirements.network,
    });

    return payload;
  }
}

// Usage example
async function main(): Promise<void> {
  const client = new X402Client(account);

  // Fetch from a paid API - payment is handled automatically
  const response = await client.fetchWithPayment(
    'https://api.example.com/premium-data'
  );
  const data = await response.json();
  console.log('Received data:', data);
}
main().catch(console.error);
```

### React/Frontend Integration

```typescript
import { useAccount, useProvider } from '@starknet-react/core';
import {
  createPaymentPayload,
  decodePaymentRequired,
  encodePaymentSignature,
  DEFAULT_PAYMASTER_ENDPOINTS,
  HTTP_HEADERS,
} from 'x402-starknet';

function usePaidFetch() {
  const { account } = useAccount();

  const fetchWithPayment = async (url: string) => {
    // Initial request
    const response = await fetch(url);

    if (response.status === 402) {
      const header = response.headers.get(HTTP_HEADERS.PAYMENT_REQUIRED);
      const paymentRequired = decodePaymentRequired(header!);

      // Show user what they're paying for
      const requirements = paymentRequired.accepts[0];
      const confirmed = await confirmPayment(requirements);

      if (!confirmed) {
        throw new Error('Payment declined by user');
      }

      // Create payment
      const payload = await createPaymentPayload(account!, 2, requirements, {
        endpoint: DEFAULT_PAYMASTER_ENDPOINTS[requirements.network],
        network: requirements.network,
      });

      // Retry with payment
      return fetch(url, {
        headers: {
          [HTTP_HEADERS.PAYMENT_SIGNATURE]: encodePaymentSignature(payload),
        },
      });
    }

    return response;
  };

  return { fetchWithPayment };
}
```

---

## Building an x402 API

An x402 API protects resources behind payments. It returns 402 responses with payment requirements, verifies incoming payments, and settles them after providing resources.

### Express.js API Server

```typescript
import type { Request, Response, NextFunction } from 'express';
import {
  // Payment requirements builders
  buildUSDCPayment,
  buildSTRKPayment,
  // Verification and settlement
  verifyPayment,
  settlePayment,
  createProvider,
  createPaymasterConfig,
  // HTTP utilities
  encodePaymentRequired,
  decodePaymentSignature,
  HTTP_HEADERS,
  // Validation schemas
  PAYMENT_PAYLOAD_SCHEMA,
  // Types
  type PaymentRequired,
  type PaymentRequirements,
} from 'x402-starknet';

// Configuration
const PAYMENT_RECIPIENT = process.env['PAYMENT_ADDRESS'] ?? '';
const PAYMASTER_API_KEY = process.env['PAYMASTER_API_KEY'];

// Extended request type with payment info
interface PaymentRequest extends Request {
  payment?: {
    payload: ReturnType<typeof PAYMENT_PAYLOAD_SCHEMA.parse>;
    requirements: PaymentRequirements;
    provider: ReturnType<typeof createProvider>;
  };
}

/**
 * Middleware to handle x402 payment flow
 */
function requirePayment(
  requirements: PaymentRequirements
): (req: PaymentRequest, res: Response, next: NextFunction) => Promise<void> {
  return async (
    req: PaymentRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    // Check for payment header
    const paymentHeader =
      req.headers[HTTP_HEADERS.PAYMENT_SIGNATURE.toLowerCase()];

    if (!paymentHeader) {
      // No payment - return 402 with requirements
      const paymentRequired: PaymentRequired = {
        x402Version: 2,
        error: 'Payment required to access this resource',
        resource: {
          url: req.originalUrl,
          description: 'Protected API endpoint',
        },
        accepts: [requirements],
      };

      res.status(402);
      res.header(
        HTTP_HEADERS.PAYMENT_REQUIRED,
        encodePaymentRequired(paymentRequired)
      );
      res.json(paymentRequired);
      return;
    }

    try {
      // Parse and validate payment payload
      const rawPayload = decodePaymentSignature(paymentHeader as string);
      const payload = PAYMENT_PAYLOAD_SCHEMA.parse(rawPayload);

      // Verify payment
      const provider = createProvider(requirements.network);
      const verification = await verifyPayment(provider, payload, requirements);

      if (!verification.isValid) {
        res.status(402).json({
          error: 'Payment verification failed',
          reason: verification.invalidReason,
        });
        return;
      }

      // Attach payment info to request for later settlement
      req.payment = { payload, requirements, provider };
      next();
    } catch (error) {
      res.status(400).json({
        error: 'Invalid payment payload',
        details: String(error),
      });
    }
  };
}

/**
 * Settle payment after response is sent
 */
async function settlePaymentAfterResponse(req: PaymentRequest): Promise<void> {
  const payment = req.payment;
  if (!payment) return;

  const { payload, requirements, provider } = payment;

  try {
    const paymasterConfig = createPaymasterConfig(requirements.network, {
      apiKey: PAYMASTER_API_KEY,
    });

    const result = await settlePayment(provider, payload, requirements, {
      paymasterConfig,
    });

    if (result.success) {
      console.log(`Payment settled: ${result.transaction}`);
    } else {
      console.error(`Settlement failed: ${result.errorReason ?? 'unknown'}`);
    }
  } catch (error) {
    console.error('Settlement error:', error);
  }
}

// Define payment requirements for endpoints
const premiumDataPayment = buildUSDCPayment({
  network: 'starknet:mainnet',
  amount: 0.1, // $0.10 per request
  payTo: PAYMENT_RECIPIENT,
});

const aiGenerationPayment = buildSTRKPayment({
  network: 'starknet:sepolia',
  amount: 1, // 1 STRK per generation
  payTo: PAYMENT_RECIPIENT,
});

// Example route handlers (would be used with express app)
async function handlePremiumData(
  req: PaymentRequest,
  res: Response
): Promise<void> {
  // Serve the protected resource
  const data = { premium: true, data: 'Exclusive content here' };
  res.json(data);

  // Settle payment after response
  await settlePaymentAfterResponse(req);
}

async function handleAIGeneration(
  req: PaymentRequest,
  res: Response
): Promise<void> {
  const { prompt } = req.body as { prompt: string };

  // Generate content (your AI logic here)
  const result = { generated: `Response to: ${prompt}` };
  res.json(result);

  // Settle payment
  await settlePaymentAfterResponse(req);
}

function handlePublic(_req: Request, res: Response): void {
  res.json({ message: 'This is free content' });
}

// Export for use in an actual Express app
export {
  requirePayment,
  settlePaymentAfterResponse,
  premiumDataPayment,
  aiGenerationPayment,
  handlePremiumData,
  handleAIGeneration,
  handlePublic,
  type PaymentRequest,
};
```

### Hono Framework Example

```typescript
import { Hono } from 'hono';
import {
  buildETHPayment,
  verifyPayment,
  settlePayment,
  createProvider,
  createSettlementOptions,
  encodePaymentRequired,
  decodePaymentSignature,
  HTTP_HEADERS,
  PAYMENT_PAYLOAD_SCHEMA,
  type PaymentRequired,
} from 'x402-starknet';

const app = new Hono();

// Payment middleware factory
function x402Middleware(
  amount: number,
  asset: 'ETH' | 'STRK' | 'USDC' = 'ETH'
) {
  const builders = {
    ETH: buildETHPayment,
    STRK: buildSTRKPayment,
    USDC: buildUSDCPayment,
  };

  return async (c: any, next: () => Promise<void>) => {
    const requirements = builders[asset]({
      network: 'starknet:sepolia',
      amount,
      payTo: process.env.PAYMENT_ADDRESS!,
    });

    const paymentHeader = c.req.header(HTTP_HEADERS.PAYMENT_SIGNATURE);

    if (!paymentHeader) {
      const paymentRequired: PaymentRequired = {
        x402Version: 2,
        error: 'Payment required',
        resource: { url: c.req.url },
        accepts: [requirements],
      };

      c.header(
        HTTP_HEADERS.PAYMENT_REQUIRED,
        encodePaymentRequired(paymentRequired)
      );
      return c.json(paymentRequired, 402);
    }

    const payload = PAYMENT_PAYLOAD_SCHEMA.parse(
      decodePaymentSignature(paymentHeader)
    );

    const provider = createProvider(requirements.network);
    const verification = await verifyPayment(provider, payload, requirements);

    if (!verification.isValid) {
      return c.json({ error: verification.invalidReason }, 402);
    }

    c.set('payment', { payload, requirements, provider });
    await next();

    // Settle after response
    const options = createSettlementOptions(requirements.network);
    await settlePayment(provider, payload, requirements, options);
  };
}

// Apply middleware to routes
app.get('/api/premium', x402Middleware(0.001, 'ETH'), (c) => {
  return c.json({ data: 'Premium content' });
});

export default app;
```

---

## Building an x402 Facilitator

A facilitator is a service that handles payment verification and settlement on behalf of other applications. Instead of each API implementing its own payment processing, they can delegate to a facilitator.

### Facilitator Service

```typescript
import type { Request, Response } from 'express';
import {
  verifyPayment,
  settlePayment,
  createProvider,
  createPaymasterConfig,
  PAYMENT_PAYLOAD_SCHEMA,
  PAYMENT_REQUIREMENTS_SCHEMA,
  getSupportedNetworks,
  getAvailableTokens,
  getTokenAddress,
  type VerifyResponse,
  type SettleResponse,
  type SupportedResponse,
  type SupportedKind,
} from 'x402-starknet';

/**
 * GET /supported
 * Returns the payment schemes, networks, and tokens this facilitator supports
 */
function handleSupported(_req: Request, res: Response): void {
  const networks = getSupportedNetworks();

  // Build list of supported payment kinds
  const kinds: Array<SupportedKind> = [];

  for (const network of networks) {
    const tokens = getAvailableTokens(network);
    for (const token of tokens) {
      const asset = getTokenAddress(token, network);
      if (asset) {
        kinds.push({
          x402Version: 2,
          scheme: 'exact',
          network: network,
          extra: { asset },
        });
      }
    }
  }

  const response: SupportedResponse = {
    kinds,
    extensions: [], // Add supported extensions here
    signers: {
      starknet: ['SNIP-6'], // Supported signature standards
    },
  };

  res.json(response);
}

/**
 * POST /verify
 * Verifies a payment payload against requirements
 */
async function handleVerify(req: Request, res: Response): Promise<void> {
  try {
    const { paymentPayload, paymentRequirements } = req.body as {
      paymentPayload: unknown;
      paymentRequirements: unknown;
    };

    // Validate inputs
    const payload = PAYMENT_PAYLOAD_SCHEMA.parse(paymentPayload);
    const requirements = PAYMENT_REQUIREMENTS_SCHEMA.parse(paymentRequirements);

    // Create provider for the network
    const provider = createProvider(requirements.network);

    // Verify the payment
    const result: VerifyResponse = await verifyPayment(
      provider,
      payload,
      requirements
    );

    res.json(result);
  } catch (error) {
    res.status(400).json({
      isValid: false,
      invalidReason: 'verification_failed',
      payer: '',
      details: { error: String(error) },
    });
  }
}

/**
 * POST /settle
 * Settles a verified payment by executing the transaction
 */
async function handleSettle(req: Request, res: Response): Promise<void> {
  try {
    const { paymentPayload, paymentRequirements } = req.body as {
      paymentPayload: unknown;
      paymentRequirements: unknown;
    };

    // Validate inputs
    const payload = PAYMENT_PAYLOAD_SCHEMA.parse(paymentPayload);
    const requirements = PAYMENT_REQUIREMENTS_SCHEMA.parse(paymentRequirements);

    // Create provider
    const provider = createProvider(requirements.network);

    // Configure settlement options with paymaster
    const paymasterConfig = createPaymasterConfig(requirements.network, {
      apiKey: process.env.PAYMASTER_API_KEY,
    });

    // Execute settlement
    const result: SettleResponse = await settlePayment(
      provider,
      payload,
      requirements,
      { paymasterConfig }
    );

    res.json(result);
  } catch (error) {
    res.status(400).json({
      success: false,
      transaction: '',
      network: '',
      errorReason: String(error),
    });
  }
}

/**
 * POST /verify-and-settle
 * Combined endpoint that verifies and settles in one call
 */
async function handleVerifyAndSettle(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const { paymentPayload, paymentRequirements } = req.body as {
      paymentPayload: unknown;
      paymentRequirements: unknown;
    };

    const payload = PAYMENT_PAYLOAD_SCHEMA.parse(paymentPayload);
    const requirements = PAYMENT_REQUIREMENTS_SCHEMA.parse(paymentRequirements);
    const provider = createProvider(requirements.network);

    // First verify
    const verification = await verifyPayment(provider, payload, requirements);

    if (!verification.isValid) {
      res.json({
        verified: false,
        settled: false,
        verifyResult: verification,
      });
      return;
    }

    // Then settle
    const paymasterConfig = createPaymasterConfig(requirements.network, {
      apiKey: process.env.PAYMASTER_API_KEY,
    });

    const settlement = await settlePayment(provider, payload, requirements, {
      paymasterConfig,
    });

    res.json({
      verified: true,
      settled: settlement.success,
      verifyResult: verification,
      settleResult: settlement,
    });
  } catch (error) {
    res.status(400).json({
      verified: false,
      settled: false,
      error: String(error),
    });
  }
}

// Export handlers for use in an actual Express app
export { handleSupported, handleVerify, handleSettle, handleVerifyAndSettle };
```

### Using the Facilitator Client

Applications can use the facilitator client to delegate payment processing:

```typescript
import type { Request, Response } from 'express';
import {
  createFacilitatorClient,
  buildUSDCPayment,
  decodePaymentSignature,
  encodePaymentRequired,
  HTTP_HEADERS,
  PAYMENT_PAYLOAD_SCHEMA,
  type PaymentRequired,
} from 'x402-starknet';

// Create facilitator client
const facilitatorApiKey = process.env['FACILITATOR_API_KEY'];
const facilitator = createFacilitatorClient({
  baseUrl: 'https://facilitator.example.com',
  apiKey: facilitatorApiKey,
  timeout: 30000,
});

/**
 * Check what the facilitator supports
 */
async function checkFacilitatorCapabilities(): Promise<void> {
  const supported = await facilitator.supported();
  console.log('Facilitator supports:', supported.kinds);
  console.log('Extensions:', supported.extensions);
  console.log('Signers:', supported.signers);
}

/**
 * API endpoint that uses the facilitator for payment processing
 */
async function handlePaidResource(req: Request, res: Response): Promise<void> {
  const paymentAddress = process.env['PAYMENT_ADDRESS'];
  if (!paymentAddress) {
    res.status(500).json({ error: 'Payment address not configured' });
    return;
  }

  const requirements = buildUSDCPayment({
    network: 'starknet:mainnet',
    amount: 0.05,
    payTo: paymentAddress,
  });

  const paymentHeader =
    req.headers[HTTP_HEADERS.PAYMENT_SIGNATURE.toLowerCase()];

  if (!paymentHeader) {
    // Return 402 with requirements
    const paymentRequired: PaymentRequired = {
      x402Version: 2,
      error: 'Payment required',
      resource: {
        url: req.originalUrl,
        description: 'Premium content',
      },
      accepts: [requirements],
    };

    res.status(402);
    res.header(
      HTTP_HEADERS.PAYMENT_REQUIRED,
      encodePaymentRequired(paymentRequired)
    );
    res.json(paymentRequired);
    return;
  }

  try {
    const payload = PAYMENT_PAYLOAD_SCHEMA.parse(
      decodePaymentSignature(paymentHeader as string)
    );

    // Delegate verification to facilitator
    const verifyResult = await facilitator.verify(payload, requirements);

    if (!verifyResult.isValid) {
      res.status(402).json({
        error: 'Payment invalid',
        reason: verifyResult.invalidReason,
      });
      return;
    }

    // Serve the resource
    res.json({ data: 'Your paid content here' });

    // Delegate settlement to facilitator
    const settleResult = await facilitator.settle(payload, requirements);
    console.log('Settlement:', settleResult.success ? 'Success' : 'Failed');
  } catch {
    res.status(400).json({ error: 'Payment processing failed' });
  }
}

// Export for use
export { facilitator, checkFacilitatorCapabilities, handlePaidResource };
```

### Facilitator with Caching and Rate Limiting

```typescript
import express from 'express';
import {
  verifyPayment,
  settlePayment,
  createProvider,
  createSettlementOptions,
  PAYMENT_PAYLOAD_SCHEMA,
  PAYMENT_REQUIREMENTS_SCHEMA,
} from 'x402-starknet';

const app = express();
app.use(express.json());

// Simple in-memory cache for verification results
const verificationCache = new Map<string, { result: any; expiry: number }>();
const CACHE_TTL = 60000; // 1 minute

// Track settled transactions to prevent double-settlement
const settledTransactions = new Set<string>();

function getCacheKey(payload: any, requirements: any): string {
  return `${JSON.stringify(payload)}-${JSON.stringify(requirements)}`;
}

app.post('/verify', async (req, res) => {
  try {
    const { paymentPayload, paymentRequirements } = req.body;
    const payload = PAYMENT_PAYLOAD_SCHEMA.parse(paymentPayload);
    const requirements = PAYMENT_REQUIREMENTS_SCHEMA.parse(paymentRequirements);

    // Check cache
    const cacheKey = getCacheKey(payload, requirements);
    const cached = verificationCache.get(cacheKey);

    if (cached && cached.expiry > Date.now()) {
      return res.json(cached.result);
    }

    // Verify
    const provider = createProvider(requirements.network);
    const result = await verifyPayment(provider, payload, requirements);

    // Cache valid results
    if (result.isValid) {
      verificationCache.set(cacheKey, {
        result,
        expiry: Date.now() + CACHE_TTL,
      });
    }

    res.json(result);
  } catch (error) {
    res.status(400).json({ isValid: false, error: String(error) });
  }
});

app.post('/settle', async (req, res) => {
  try {
    const { paymentPayload, paymentRequirements } = req.body;
    const payload = PAYMENT_PAYLOAD_SCHEMA.parse(paymentPayload);
    const requirements = PAYMENT_REQUIREMENTS_SCHEMA.parse(paymentRequirements);

    // Generate unique ID for this payment
    const paymentId = JSON.stringify(payload.payload);

    // Prevent double-settlement
    if (settledTransactions.has(paymentId)) {
      return res.status(409).json({
        success: false,
        errorReason: 'already_settled',
      });
    }

    // Settle
    const provider = createProvider(requirements.network);
    const options = createSettlementOptions(requirements.network, {
      apiKey: process.env.PAYMASTER_API_KEY,
    });

    const result = await settlePayment(
      provider,
      payload,
      requirements,
      options
    );

    if (result.success) {
      settledTransactions.add(paymentId);
    }

    res.json(result);
  } catch (error) {
    res.status(400).json({ success: false, error: String(error) });
  }
});

app.listen(4000);
```

---

## Complete Integration Example

This example shows the full payment flow from building requirements to settlement:

```typescript
import {
  // Core functions
  createPaymentPayload,
  verifyPayment,
  settlePayment,
  // Validation schemas
  PAYMENT_PAYLOAD_SCHEMA,
  PAYMENT_REQUIREMENTS_SCHEMA,
  // Network utilities
  isStarknetNetwork,
  validateNetwork,
  // Provider
  createProvider,
  // Paymaster
  createSettlementOptions,
  // Builders
  buildUSDCPayment,
  // Types
  type PaymentPayload,
  type PaymentRequirements,
} from 'x402-starknet';

// ============================================================================
// Server: Build payment requirements
// ============================================================================

const requirements = buildUSDCPayment({
  network: 'starknet:mainnet',
  amount: 1.5, // $1.50 USDC
  payTo: '0x1234567890abcdef...',
});

// Return requirements to client in 402 response
// The client will use these to create a payment

// ============================================================================
// Client: Create payment payload
// ============================================================================

// Client receives requirements and creates a signed payment
const payload = await createPaymentPayload(
  account, // Starknet account instance
  2, // x402 version
  requirements,
  {
    endpoint: 'https://starknet.paymaster.avnu.fi',
    network: 'starknet:mainnet',
  }
);

// Client sends payload back to server in PAYMENT-SIGNATURE header

// ============================================================================
// Server: Validate incoming request
// ============================================================================

// Parse and validate the incoming payload (type-safe)
const validatedPayload = PAYMENT_PAYLOAD_SCHEMA.parse(rawPayload);
const validatedRequirements =
  PAYMENT_REQUIREMENTS_SCHEMA.parse(rawRequirements);

// ============================================================================
// Server: Verify payment before providing resource
// ============================================================================

const provider = createProvider(validatedRequirements.network);

const verification = await verifyPayment(
  provider,
  validatedPayload,
  validatedRequirements
);

if (!verification.valid) {
  console.error('Payment invalid:', verification.invalidReason);
  // Return 402 with error details
}

// ============================================================================
// Server: Settle payment after providing resource
// ============================================================================

const settlementOptions = createSettlementOptions(
  validatedRequirements.network,
  {
    apiKey: process.env.PAYMASTER_API_KEY,
  }
);

const result = await settlePayment(
  provider,
  validatedPayload,
  validatedRequirements,
  settlementOptions
);

if (result.success) {
  console.log('Payment settled:', result.transaction);
} else {
  console.error('Settlement failed:', result.error);
}
```

---

## Server-Side Examples

### Building Payment Requirements

Use the builder utilities to create payment requirements with automatic token resolution and amount conversion:

```typescript
import {
  buildPaymentRequirements,
  buildETHPayment,
  buildSTRKPayment,
  buildUSDCPayment,
} from 'x402-starknet';

// Generic builder with any token
const requirements = buildPaymentRequirements({
  network: 'starknet:mainnet',
  amount: 1.5, // Human-readable amount
  asset: 'USDC', // Token symbol or contract address
  payTo: '0x1234...',
  maxTimeoutSeconds: 600, // Optional, defaults to 300
});

// Token-specific builders
const ethPayment = buildETHPayment({
  network: 'starknet:sepolia',
  amount: 0.001, // 0.001 ETH
  payTo: '0x1234...',
});

const strkPayment = buildSTRKPayment({
  network: 'starknet:sepolia',
  amount: 10, // 10 STRK
  payTo: '0x1234...',
});

const usdcPayment = buildUSDCPayment({
  network: 'starknet:mainnet', // USDC only on mainnet
  amount: 5.99, // $5.99 USDC
  payTo: '0x1234...',
});

// Using a custom token address
const customTokenPayment = buildPaymentRequirements({
  network: 'starknet:mainnet',
  amount: 1000000, // Amount in atomic units for custom tokens
  asset: '0xCustomTokenContractAddress...',
  payTo: '0x1234...',
  extra: {
    name: 'Custom Token',
    symbol: 'CTK',
    decimals: 18,
  },
});
```

### Validating Incoming Requests

Use Zod schemas for type-safe validation of incoming payment data:

```typescript
import {
  PAYMENT_PAYLOAD_SCHEMA,
  PAYMENT_REQUIREMENTS_SCHEMA,
  PAYMENT_REQUIRED_SCHEMA,
  type PaymentPayload,
  type PaymentRequirements,
} from 'x402-starknet';

// Parse and validate - throws on invalid data
function validatePaymentRequest(rawPayload: unknown, rawRequirements: unknown) {
  const payload: PaymentPayload = PAYMENT_PAYLOAD_SCHEMA.parse(rawPayload);
  const requirements: PaymentRequirements =
    PAYMENT_REQUIREMENTS_SCHEMA.parse(rawRequirements);

  return { payload, requirements };
}

// Safe parsing - returns result object
function safeValidatePayload(rawPayload: unknown) {
  const result = PAYMENT_PAYLOAD_SCHEMA.safeParse(rawPayload);

  if (result.success) {
    return { valid: true, payload: result.data };
  } else {
    return { valid: false, errors: result.error.errors };
  }
}

// Validate 402 response structure
function validatePaymentRequired(rawResponse: unknown) {
  return PAYMENT_REQUIRED_SCHEMA.parse(rawResponse);
}
```

### Verifying Payments

Verify that a payment is valid before providing the resource:

```typescript
import {
  verifyPayment,
  createProvider,
  type VerifyResponse,
} from 'x402-starknet';

async function handlePaymentVerification(
  payload: PaymentPayload,
  requirements: PaymentRequirements
): Promise<VerifyResponse> {
  const provider = createProvider(requirements.network);

  const verification = await verifyPayment(provider, payload, requirements);

  if (!verification.valid) {
    // Handle different failure reasons
    switch (verification.invalidReason) {
      case 'insufficient_funds':
        console.error('User has insufficient token balance');
        break;
      case 'expired':
        console.error('Payment authorization has expired');
        break;
      case 'invalid_signature':
        console.error('Payment signature is invalid');
        break;
      case 'network_mismatch':
        console.error('Payment network does not match requirements');
        break;
      default:
        console.error(
          'Payment verification failed:',
          verification.invalidReason
        );
    }
  }

  return verification;
}
```

### Settling Payments

Execute the payment transaction after providing the resource:

```typescript
import {
  settlePayment,
  createProvider,
  createSettlementOptions,
  createPaymasterConfig,
  type SettleResponse,
} from 'x402-starknet';

async function settleUserPayment(
  payload: PaymentPayload,
  requirements: PaymentRequirements
): Promise<SettleResponse> {
  const provider = createProvider(requirements.network);

  // Option 1: Using createSettlementOptions helper
  const options = createSettlementOptions(requirements.network, {
    apiKey: process.env.PAYMASTER_API_KEY,
  });

  const result = await settlePayment(provider, payload, requirements, options);

  // Option 2: Using createPaymasterConfig directly
  const paymasterConfig = createPaymasterConfig(requirements.network, {
    endpoint: process.env.PAYMASTER_ENDPOINT,
    apiKey: process.env.PAYMASTER_API_KEY,
  });

  const result2 = await settlePayment(provider, payload, requirements, {
    paymasterConfig,
  });

  return result;
}
```

---

## Client-Side Examples

### Creating Payment Payloads

Create signed payment payloads from a Starknet wallet:

```typescript
import {
  createPaymentPayload,
  DEFAULT_PAYMASTER_ENDPOINTS,
  type PaymentPayload,
  type PaymentRequirements,
} from 'x402-starknet';
import { Account } from 'starknet';

async function createPayment(
  account: Account,
  requirements: PaymentRequirements
): Promise<PaymentPayload> {
  // Get the appropriate paymaster endpoint
  const paymasterEndpoint = DEFAULT_PAYMASTER_ENDPOINTS[requirements.network];

  const payload = await createPaymentPayload(
    account,
    2, // x402 version
    requirements,
    {
      endpoint: paymasterEndpoint,
      network: requirements.network,
    }
  );

  return payload;
}
```

---

## Utility Examples

### Network Utilities

Work with Starknet network identifiers:

```typescript
import {
  isStarknetNetwork,
  validateNetwork,
  parseStarknetNetwork,
  buildStarknetCAIP2,
  getNetworkReference,
  isTestnet,
  isMainnet,
  getSupportedNetworks,
  STARKNET_NETWORKS,
  NETWORK_NAMES,
} from 'x402-starknet';

// Type guard for network validation
function processRequest(network: string) {
  if (!isStarknetNetwork(network)) {
    throw new Error(`Unsupported network: ${network}`);
  }

  // network is now typed as StarknetNetworkId
  console.log(`Processing for ${NETWORK_NAMES[network]}`);
}

// Validate and throw if invalid
const validNetwork = validateNetwork('starknet:sepolia');

// Parse CAIP-2 identifier
const parsed = parseStarknetNetwork('starknet:mainnet');
console.log(parsed); // { namespace: 'starknet', reference: 'mainnet' }

// Build CAIP-2 from reference
const caip2 = buildStarknetCAIP2('sepolia');
console.log(caip2); // 'starknet:sepolia'

// Get reference string
const reference = getNetworkReference('starknet:mainnet');
console.log(reference); // 'mainnet'

// Check network type
if (isTestnet('starknet:sepolia')) {
  console.log('Running on testnet');
}

if (isMainnet('starknet:mainnet')) {
  console.log('Running on mainnet - be careful!');
}

// Get all supported networks
const networks = getSupportedNetworks();
console.log(networks); // ['starknet:mainnet', 'starknet:sepolia', 'starknet:devnet']
```

### Token Utilities

Work with token addresses and amounts:

```typescript
import {
  getTokenAddress,
  getTokenDecimals,
  getTokenSymbol,
  toAtomicUnits,
  fromAtomicUnits,
  isTokenAvailable,
  getAvailableTokens,
  ETH_ADDRESSES,
  STRK_ADDRESSES,
  USDC_ADDRESSES,
  TOKEN_DECIMALS,
} from 'x402-starknet';

// Get token address for a network
const usdcAddress = getTokenAddress('USDC', 'starknet:mainnet');
const ethAddress = getTokenAddress('ETH', 'starknet:sepolia');

// Get token decimals
const usdcDecimals = getTokenDecimals('USDC'); // 6
const ethDecimals = getTokenDecimals('ETH'); // 18

// Convert between human-readable and atomic units
const atomicAmount = toAtomicUnits(1.5, 'USDC'); // '1500000'
const humanAmount = fromAtomicUnits('1500000', 'USDC'); // 1.5

// Identify token from address
const symbol = getTokenSymbol(usdcAddress, 'starknet:mainnet'); // 'USDC'

// Check token availability
if (isTokenAvailable('USDC', 'starknet:sepolia')) {
  console.log('USDC is available on sepolia');
} else {
  console.log('USDC is not available on sepolia');
}

// Get all available tokens for a network
const tokens = getAvailableTokens('starknet:mainnet');
console.log(tokens); // ['ETH', 'STRK', 'USDC']

const sepoliaTokens = getAvailableTokens('starknet:sepolia');
console.log(sepoliaTokens); // ['ETH', 'STRK']

// Direct access to address constants
console.log(ETH_ADDRESSES['starknet:mainnet']);
console.log(TOKEN_DECIMALS); // { ETH: 18, STRK: 18, USDC: 6 }
```

### Provider Factory

Create RPC providers with sensible defaults:

```typescript
import { createProvider, getChainId, DEFAULT_RPC_URLS } from 'x402-starknet';

// Create provider with default public RPC
const provider = createProvider('starknet:sepolia');

// Create provider with custom RPC URL
const customProvider = createProvider('starknet:mainnet', {
  rpcUrl: 'https://your-rpc-endpoint.com',
});

// Create provider with additional options
const configuredProvider = createProvider('starknet:mainnet', {
  rpcUrl: process.env.STARKNET_RPC_URL,
  headers: {
    'X-API-Key': process.env.RPC_API_KEY,
  },
});

// Get chain ID constant for Starknet.js
const chainId = getChainId('starknet:mainnet');
// Returns constants.StarknetChainId.SN_MAIN

// Access default RPC URLs
console.log(DEFAULT_RPC_URLS['starknet:sepolia']);
// 'https://starknet-sepolia.public.blastapi.io'
```

---

## Error Handling

Handle errors using the typed error classes:

```typescript
import {
  createPaymentPayload,
  X402Error,
  PaymentError,
  NetworkError,
  ERROR_CODES,
} from 'x402-starknet';

async function handlePayment() {
  try {
    const payload = await createPaymentPayload(
      account,
      2,
      requirements,
      config
    );
    return payload;
  } catch (error) {
    if (error instanceof PaymentError) {
      switch (error.code) {
        case ERROR_CODES.ECONFLICT:
          console.error('Insufficient funds:', error.message);
          break;
        case ERROR_CODES.EINVALID_INPUT:
          console.error('Invalid payload:', error.message);
          break;
        case ERROR_CODES.ETIMEOUT:
          console.error('Operation timed out:', error.message);
          break;
        default:
          console.error('Payment error:', error.message);
      }
    } else if (error instanceof NetworkError) {
      switch (error.code) {
        case ERROR_CODES.ENETWORK:
          console.error('Network error:', error.message);
          break;
        case ERROR_CODES.EPAYMASTER:
          console.error('Paymaster error:', error.message);
          break;
        default:
          console.error('Network-related error:', error.message);
      }
    } else if (error instanceof X402Error) {
      console.error('x402 error:', error.code, error.message);
    } else {
      throw error; // Re-throw unknown errors
    }
  }
}

// Using error factory methods
const insufficientFundsError = PaymentError.insufficientFunds(
  '1000000',
  '500000'
);
const unsupportedNetworkError =
  NetworkError.unsupportedNetwork('starknet:unknown');
```

---

## HTTP Header Utilities

Work with x402 HTTP headers:

```typescript
import {
  encodePaymentSignature,
  decodePaymentSignature,
  encodePaymentRequired,
  decodePaymentRequired,
  HTTP_HEADERS,
  type PaymentPayload,
  type PaymentRequired,
} from 'x402-starknet';

// Server: Create 402 response
function create402Response(paymentRequired: PaymentRequired): Response {
  const encoded = encodePaymentRequired(paymentRequired);

  return new Response(null, {
    status: 402,
    headers: {
      [HTTP_HEADERS.PAYMENT_REQUIRED]: encoded,
      'Content-Type': 'application/json',
    },
  });
}

// Client: Parse 402 response
function parse402Response(response: Response): PaymentRequired {
  const header = response.headers.get(HTTP_HEADERS.PAYMENT_REQUIRED);
  if (!header) {
    throw new Error('Missing PAYMENT-REQUIRED header');
  }
  return decodePaymentRequired(header);
}

// Client: Send payment in request
function createPaymentRequest(url: string, payload: PaymentPayload): Request {
  const encoded = encodePaymentSignature(payload);

  return new Request(url, {
    headers: {
      [HTTP_HEADERS.PAYMENT_SIGNATURE]: encoded,
    },
  });
}

// Server: Extract payment from request
function extractPayment(request: Request): PaymentPayload | null {
  const header = request.headers.get(HTTP_HEADERS.PAYMENT_SIGNATURE);
  if (!header) {
    return null;
  }
  return decodePaymentSignature(header);
}
```

---

## Extensions System

Work with protocol extensions:

```typescript
import {
  createExtensionRegistry,
  defineExtension,
  createExtensionData,
  hasExtension,
  validateExtensions,
  globalRegistry,
} from 'x402-starknet';

// Define a custom extension
const receiptsExtension = defineExtension('receipts', {
  description: 'Payment receipts for record-keeping',
  schema: {
    type: 'object',
    properties: {
      receiptId: { type: 'string' },
      timestamp: { type: 'number' },
    },
    required: ['receiptId'],
  },
});

// Create a registry and register extensions
const registry = createExtensionRegistry();
registry.register(receiptsExtension);

// Or use the global registry
globalRegistry.register(receiptsExtension);

// Create extension data for a payment
const extensionData = createExtensionData(registry, {
  receipts: {
    receiptId: 'rcpt_123456',
    timestamp: Date.now(),
  },
});

// Check if extensions are present
if (hasExtension(extensionData, 'receipts')) {
  console.log('Payment includes receipt data');
}

// Validate extensions against registry
const validation = validateExtensions(registry, extensionData);
if (!validation.valid) {
  console.error('Invalid extensions:', validation.errors);
}
```

---

## See Also

- [Paymaster Setup Guide](./paymaster-setup.md) - Configure paymaster for gasless transactions
- [Exact Scheme Specification](./scheme_exact_starknet.md) - Protocol specification details
- [API Surface](./api-surface.md) - Complete API reference
