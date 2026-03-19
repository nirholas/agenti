/**
 * x402 Facilitator Service Example
 *
 * This example demonstrates how to build an x402 facilitator for Starknet
 * that handles payment verification and settlement on behalf of other applications.
 */

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
