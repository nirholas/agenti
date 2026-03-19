/**
 * Facilitator Client Usage Example
 *
 * This example demonstrates how to use the FacilitatorClient
 * to delegate payment processing to a facilitator service.
 */

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
// eslint-disable-next-line @typescript-eslint/dot-notation
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
  // eslint-disable-next-line no-console
  console.log('Facilitator supports:', supported.kinds);
  // eslint-disable-next-line no-console
  console.log('Extensions:', supported.extensions);
  // eslint-disable-next-line no-console
  console.log('Signers:', supported.signers);
}

/**
 * API endpoint that uses the facilitator for payment processing
 */
async function handlePaidResource(req: Request, res: Response): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/dot-notation
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
    // eslint-disable-next-line no-console
    console.log('Settlement:', settleResult.success ? 'Success' : 'Failed');
  } catch {
    res.status(400).json({ error: 'Payment processing failed' });
  }
}

// Export for use
export { facilitator, checkFacilitatorCapabilities, handlePaidResource };
