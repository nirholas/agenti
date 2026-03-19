/**
 * Express.js x402 API Example
 *
 * This example demonstrates how to build an x402 API for Starknet
 * using Express.js with payment middleware.
 */

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
// eslint-disable-next-line @typescript-eslint/dot-notation
const PAYMENT_RECIPIENT = process.env['PAYMENT_ADDRESS'] ?? '';
// eslint-disable-next-line @typescript-eslint/dot-notation
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
      // eslint-disable-next-line no-console
      console.log(`Payment settled: ${result.transaction}`);
    } else {
      // eslint-disable-next-line no-console
      console.error(`Settlement failed: ${result.errorReason ?? 'unknown'}`);
    }
  } catch (error) {
    // eslint-disable-next-line no-console
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
