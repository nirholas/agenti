import { Router, type Request, type Response, type IRouter } from 'express';
import { createFacilitator, type FacilitatorConfig, type TokenConfig, getSolanaPublicKey, networkToCaip2, isStacksNetwork } from '@openfacilitator/core';
import { OpenFacilitator, createPaymentMiddleware, type PaymentPayload, type PaymentRequirements } from '@openfacilitator/sdk';
import { privateKeyToAccount } from 'viem/accounts';

// SDK client for demo endpoint (uses default facilitator)
const demoFacilitator = new OpenFacilitator();
import { z } from 'zod';
import { createTransaction, updateTransactionStatus } from '../db/transactions.js';
import { getClaimableByUserWallet, getClaimsByUserWallet, getClaimById, getClaimsByResourceOwner, getClaimStats } from '../db/claims.js';
import { getFacilitatorById, getFacilitatorByDomainOrSubdomain } from '../db/facilitators.js';
import { getOrCreateResourceOwner, getResourceOwnerById, getResourceOwnerByUserId, getResourceOwnersByFacilitator } from '../db/resource-owners.js';
import { getRefundWalletsByResourceOwner, getRefundWallet, hasRefundWallet } from '../db/refund-wallets.js';
import { createRegisteredServer, getRegisteredServersByResourceOwner, deleteRegisteredServer, regenerateServerApiKey, getRegisteredServerById, updateRegisteredServer } from '../db/registered-servers.js';
import { getOrCreateRefundConfig } from '../db/refund-configs.js';
import { reportFailure, executeClaimPayout, approveClaim, rejectClaim } from '../services/claims.js';
import { generateRefundWallet, getRefundWalletBalances, deleteRefundWallet, SUPPORTED_REFUND_NETWORKS } from '../services/refund-wallet.js';
import { requireAuth } from '../middleware/auth.js';

const router: IRouter = Router();

// Payment requirements schema (shared) - supports both v1 and v2 formats
const paymentRequirementsSchema = z.object({
  scheme: z.string(),
  network: z.string(),
  // v1 field (optional for v2 compatibility)
  maxAmountRequired: z.string().optional(),
  // v2 field (optional for v1 compatibility)
  amount: z.string().optional(),
  resource: z.string().default(''),
  asset: z.string(),
  payTo: z.string().optional(),
  description: z.string().optional(),
  mimeType: z.string().optional(),
  maxTimeoutSeconds: z.number().optional(),
  outputSchema: z.record(z.unknown()).optional(),
  extra: z.record(z.unknown()).optional(),
}).refine(
  (data) => data.maxAmountRequired !== undefined || data.amount !== undefined,
  { message: 'Either maxAmountRequired (v1) or amount (v2) must be provided', path: ['amount'] }
);

/** Get the amount from payment requirements (v1 or v2 format) */
function getRequiredAmount(requirements: { maxAmountRequired?: string; amount?: string }): string {
  return requirements.maxAmountRequired ?? requirements.amount ?? '0';
}

const verifyRequestSchema = z.object({
  x402Version: z.number().optional(),
  paymentPayload: z.union([z.string(), z.object({}).passthrough()]),
  paymentRequirements: paymentRequirementsSchema,
});

const settleRequestSchema = verifyRequestSchema;

/**
 * Normalize paymentPayload to string format
 */
function normalizePaymentPayload(payload: string | object): string {
  if (typeof payload === 'string') {
    return payload;
  }
  return Buffer.from(JSON.stringify(payload)).toString('base64');
}

/**
 * Get free facilitator configuration from environment
 */
function getFreeFacilitatorConfig(): { config: FacilitatorConfig; evmPrivateKey?: string; solanaPrivateKey?: string; stacksPrivateKey?: string; evmAddress?: string } | null {
  const evmPrivateKey = process.env.FREE_FACILITATOR_EVM_KEY;
  const solanaPrivateKey = process.env.FREE_FACILITATOR_SOLANA_KEY;
  const stacksPrivateKey = process.env.FREE_FACILITATOR_STACKS_KEY;
  let evmAddress = process.env.FREE_FACILITATOR_EVM_ADDRESS;
  const solanaAddress = process.env.FREE_FACILITATOR_SOLANA_ADDRESS;

  // At minimum we need one wallet configured
  if (!evmPrivateKey && !solanaPrivateKey && !stacksPrivateKey) {
    return null;
  }

  // Derive EVM address from private key if not explicitly set
  if (evmPrivateKey && !evmAddress) {
    try {
      const account = privateKeyToAccount(evmPrivateKey as `0x${string}`);
      evmAddress = account.address;
    } catch (e) {
      console.error('Failed to derive EVM address from private key:', e);
    }
  }

  // Build supported chains and tokens based on what's configured
  const supportedChains: (number | string)[] = [];
  const supportedTokens: TokenConfig[] = [];

  // Add Base mainnet if EVM key is configured
  if (evmPrivateKey) {
    supportedChains.push(8453); // Base mainnet
    supportedTokens.push({
      symbol: 'USDC',
      address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
      decimals: 6,
      chainId: 8453,
    });
  }

  // Add Solana mainnet if Solana key is configured
  if (solanaPrivateKey) {
    supportedChains.push('solana');
    supportedTokens.push({
      symbol: 'USDC',
      address: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
      decimals: 6,
      chainId: 'solana',
    });
  }

  // Add Stacks mainnet if Stacks key is configured
  if (stacksPrivateKey) {
    supportedChains.push('stacks');
    supportedTokens.push({
      symbol: 'STX',
      address: 'STX',
      decimals: 6,
      chainId: 'stacks',
    });
  }

  const config: FacilitatorConfig = {
    id: 'free-facilitator',
    name: 'OpenFacilitator Free',
    subdomain: 'free',
    ownerAddress: (evmAddress || '0x0000000000000000000000000000000000000000') as `0x${string}`,
    supportedChains,
    supportedTokens,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  return { config, evmPrivateKey, solanaPrivateKey, stacksPrivateKey, evmAddress };
}

/**
 * Check if a network identifier is a Solana network
 */
function isSolanaNetwork(network: string): boolean {
  return network === 'solana' ||
         network === 'solana-mainnet' ||
         network === 'solana-devnet' ||
         network.startsWith('solana:');
}

// isStacksNetwork is imported from @openfacilitator/core

/**
 * GET /free/supported - Get supported payment networks (no auth required)
 */
router.get('/free/supported', (_req: Request, res: Response) => {
  const facilitatorData = getFreeFacilitatorConfig();

  if (!facilitatorData) {
    res.status(503).json({
      error: 'Free facilitator not configured',
      message: 'The free facilitator is not available. Please self-host or use a managed instance.',
    });
    return;
  }

  const facilitator = createFacilitator(facilitatorData.config);
  const supported = facilitator.getSupported();

  // Build signers object with namespace prefixes
  const signers: Record<string, string[]> = {};
  const evmAddress = process.env.FREE_FACILITATOR_EVM_ADDRESS;

  // Add EVM signer and feePayer if configured
  if (evmAddress) {
    signers['eip155:*'] = [evmAddress];

    // Add feePayer to EVM kinds
    supported.kinds = supported.kinds.map(kind => {
      if (kind.network.startsWith('eip155:')) {
        return {
          ...kind,
          extra: {
            ...kind.extra,
            feePayer: evmAddress,
          },
        };
      }
      return kind;
    });
  }

  // Add feePayer for Solana if configured
  if (facilitatorData.solanaPrivateKey) {
    try {
      const solanaFeePayer = getSolanaPublicKey(facilitatorData.solanaPrivateKey);

      // Add to signers
      signers['solana:*'] = [solanaFeePayer];

      // Add feePayer to Solana kinds (both v1 human-readable and v2 CAIP-2 formats)
      supported.kinds = supported.kinds.map(kind => {
        if (isSolanaNetwork(kind.network)) {
          return {
            ...kind,
            extra: {
              ...kind.extra,
              feePayer: solanaFeePayer,
            },
          };
        }
        return kind;
      });
    } catch (e) {
      console.error('Failed to get Solana fee payer address:', e);
    }
  }

  // Add signers and extensions to response
  supported.signers = signers;
  supported.extensions = [];

  res.json(supported);
});

/**
 * POST /free/verify - Verify a payment (no auth required)
 */
router.post('/free/verify', async (req: Request, res: Response) => {
  try {
    const facilitatorData = getFreeFacilitatorConfig();

    if (!facilitatorData) {
      res.status(503).json({
        isValid: false,
        invalidReason: 'Free facilitator not configured',
      });
      return;
    }

    const parsed = verifyRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        isValid: false,
        invalidReason: 'Invalid request format',
        details: parsed.error.issues,
      });
      return;
    }

    const paymentPayload = normalizePaymentPayload(parsed.data.paymentPayload);
    const { paymentRequirements } = parsed.data;

    const facilitator = createFacilitator(facilitatorData.config);
    const result = await facilitator.verify(paymentPayload, paymentRequirements);

    // Log verification (for analytics)
    if (result.payer) {
      createTransaction({
        facilitator_id: 'free-facilitator',
        type: 'verify',
        network: paymentRequirements.network,
        from_address: result.payer,
        to_address: paymentRequirements.payTo || 'unknown',
        amount: getRequiredAmount(paymentRequirements),
        asset: paymentRequirements.asset,
        status: result.isValid ? 'success' : 'failed',
        error_message: result.invalidReason,
      });
    }

    res.json(result);
  } catch (error) {
    console.error('Free verify error:', error);
    res.status(500).json({
      isValid: false,
      invalidReason: 'Internal server error',
    });
  }
});

/**
 * POST /free/settle - Settle a payment (no auth required)
 */
router.post('/free/settle', async (req: Request, res: Response) => {
  try {
    const facilitatorData = getFreeFacilitatorConfig();

    const parsed = settleRequestSchema.safeParse(req.body);
    const networkForError = parsed.success ? parsed.data.paymentRequirements.network : '';

    if (!facilitatorData) {
      res.status(503).json({
        success: false,
        transaction: '',
        payer: '',
        network: networkForError,
        errorReason: 'Free facilitator not configured',
      });
      return;
    }

    if (!parsed.success) {
      res.status(400).json({
        success: false,
        transaction: '',
        payer: '',
        network: networkForError,
        errorReason: 'Invalid request format',
        details: parsed.error.issues,
      });
      return;
    }

    // After this point, parsed.success is true so we can access the full requirements
    const paymentRequirements = parsed.data.paymentRequirements;
    const paymentPayload = normalizePaymentPayload(parsed.data.paymentPayload);

    const facilitator = createFacilitator(facilitatorData.config);

    // Determine which private key to use based on network (supports both v1 and CAIP-2 formats)
    const isSolana = isSolanaNetwork(paymentRequirements.network);
    const isStacks = isStacksNetwork(paymentRequirements.network);

    let privateKey: string | undefined;

    if (isSolana) {
      if (!facilitatorData.solanaPrivateKey) {
        res.status(503).json({
          success: false,
          transaction: '',
          payer: '',
          network: paymentRequirements.network,
          errorReason: 'Solana not available on free facilitator',
        });
        return;
      }
      privateKey = facilitatorData.solanaPrivateKey;
    } else if (isStacks) {
      if (!facilitatorData.stacksPrivateKey) {
        res.status(503).json({
          success: false,
          transaction: '',
          payer: '',
          network: paymentRequirements.network,
          errorReason: 'Stacks not available on free facilitator',
        });
        return;
      }
      privateKey = facilitatorData.stacksPrivateKey;
    } else {
      if (!facilitatorData.evmPrivateKey) {
        res.status(503).json({
          success: false,
          transaction: '',
          payer: '',
          network: paymentRequirements.network,
          errorReason: 'EVM chains not available on free facilitator',
        });
        return;
      }
      privateKey = facilitatorData.evmPrivateKey;
    }

    const result = await facilitator.settle(paymentPayload, paymentRequirements, privateKey);

    // Log settlement
    const decoded = Buffer.from(paymentPayload, 'base64').toString('utf-8');
    const parsedPayload = JSON.parse(decoded);

    // Extract from_address - handle both flat and nested payload structures
    let fromAddress = 'unknown';
    if (isSolana) {
      fromAddress = paymentRequirements.payTo || 'solana-payer';
    } else {
      // For EVM, use authorization.from - handle both nested and flat formats
      const authorization = parsedPayload.authorization || parsedPayload.payload?.authorization;
      fromAddress = authorization?.from || 'unknown';
    }

    const txRecord = createTransaction({
      facilitator_id: 'free-facilitator',
      type: 'settle',
      network: paymentRequirements.network,
      from_address: fromAddress,
      to_address: paymentRequirements.payTo || 'unknown',
      amount: getRequiredAmount(paymentRequirements),
      asset: paymentRequirements.asset,
      status: result.success ? 'pending' : 'failed',
      transaction_hash: result.transaction,
      error_message: result.errorReason,
    });

    if (result.success && txRecord) {
      updateTransactionStatus(txRecord.id, 'success');
    }

    res.json(result);
  } catch (error) {
    console.error('Free settle error:', error);
    res.status(500).json({
      success: false,
      transaction: '',
      payer: '',
      network: '',
      errorReason: 'Internal server error',
    });
  }
});

/**
 * GET /free/info - Get info about the free facilitator
 */
router.get('/free/info', (_req: Request, res: Response) => {
  const facilitatorData = getFreeFacilitatorConfig();
  
  const evmAddress = facilitatorData?.evmAddress || process.env.FREE_FACILITATOR_EVM_ADDRESS;
  // Always derive Solana address from the private key to prevent env var mismatch
  const solanaAddress = facilitatorData?.solanaPrivateKey
    ? getSolanaPublicKey(facilitatorData.solanaPrivateKey)
    : process.env.FREE_FACILITATOR_SOLANA_ADDRESS;

  res.json({
    name: 'OpenFacilitator Free',
    description: 'Free public x402 payment facilitator. No account required.',
    endpoints: {
      supported: 'https://api.openfacilitator.io/free/supported',
      verify: 'https://api.openfacilitator.io/free/verify',
      settle: 'https://api.openfacilitator.io/free/settle',
    },
    networks: {
      base: facilitatorData?.evmPrivateKey ? {
        available: true,
        feePayerAddress: evmAddress,
      } : { available: false },
      solana: facilitatorData?.solanaPrivateKey ? {
        available: true,
        feePayerAddress: solanaAddress,
      } : { available: false },
    },
    limits: {
      note: 'Fair use policy applies. For high-volume usage, please self-host or get a managed instance.',
    },
  });
});

// ============================================
// DEMO ENDPOINT (for testing refund protection)
// ============================================

// Demo endpoint configuration
const DEMO_PRICE = '100000'; // 0.10 USDC (6 decimals)
const DEMO_RESOURCE = 'https://api.openfacilitator.io/demo/unreliable';
const SOLANA_USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';

/**
 * Build demo payment requirements for both networks
 */
async function getDemoRequirements(): Promise<PaymentRequirements[]> {
  const [baseFeePayer, solanaFeePayer] = await Promise.all([
    demoFacilitator.getFeePayer('eip155:8453'),
    demoFacilitator.getFeePayer('solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp'),
  ]);

  const requirements: PaymentRequirements[] = [];

  if (process.env.TREASURY_BASE) {
    requirements.push({
      scheme: 'exact',
      network: 'eip155:8453',
      amount: DEMO_PRICE,
      asset: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
      payTo: process.env.TREASURY_BASE,
      maxTimeoutSeconds: 300,
      resource: DEMO_RESOURCE,
      description: 'Demo endpoint - Base USDC ($0.10)',
      extra: baseFeePayer ? { feePayer: baseFeePayer } : undefined,
    });
  }

  if (process.env.TREASURY_SOLANA) {
    requirements.push({
      scheme: 'exact',
      network: 'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp',
      amount: DEMO_PRICE,
      asset: SOLANA_USDC_MINT,
      payTo: process.env.TREASURY_SOLANA,
      maxTimeoutSeconds: 300,
      resource: DEMO_RESOURCE,
      description: 'Demo endpoint - Solana USDC ($0.10)',
      extra: solanaFeePayer ? { feePayer: solanaFeePayer } : undefined,
    });
  }

  return requirements;
}

/**
 * Demo x402 resource that randomly fails ~50% of the time.
 * Used to test refund protection flow.
 * Supports both Base (EVM) and Solana payments.
 *
 * Uses the SDK middleware to dogfood our own payment handling.
 * The middleware handles 402 responses, verification, and settlement.
 * We handle the random failure and manual refund reporting.
 */
const demoPaymentMiddleware = createPaymentMiddleware({
  facilitator: demoFacilitator,
  getRequirements: getDemoRequirements,
  // Enable refundProtection so 402 includes supportsRefunds: true
  // But we'll handle the actual failure reporting manually for custom behavior
  refundProtection: process.env.DEMO_REFUND_API_KEY ? {
    apiKey: process.env.DEMO_REFUND_API_KEY,
    facilitatorUrl: process.env.API_URL || 'https://api.openfacilitator.io',
  } : undefined,
});

// GET just returns 402 (middleware handles it)
router.get('/demo/unreliable', demoPaymentMiddleware, (_req: Request, res: Response) => {
  // This won't be reached - middleware returns 402 for GET without payment
  res.status(402).json({ error: 'Payment Required' });
});

// POST processes payment and randomly fails
router.post('/demo/unreliable', demoPaymentMiddleware, async (req: Request, res: Response) => {
  // Payment was verified and settled by middleware
  const paymentContext = (req as { paymentContext?: { transactionHash: string; userWallet: string; amount: string; asset: string; network: string } }).paymentContext;

  if (!paymentContext) {
    res.status(500).json({ success: false, error: 'Payment context missing' });
    return;
  }

  // RANDOMLY FAIL ~50% of the time
  const shouldFail = Math.random() < 0.5;

  if (shouldFail) {
    // Report failure manually (not throwing, so middleware won't auto-report)
    const demoApiKey = process.env.DEMO_REFUND_API_KEY;
    let refundReported = false;
    let claimId: string | undefined;

    console.log('[demo/unreliable] Failure triggered, reporting refund...');

    if (demoApiKey) {
      const claimResult = await reportFailure({
        apiKey: demoApiKey,
        originalTxHash: paymentContext.transactionHash,
        userWallet: paymentContext.userWallet,
        amount: paymentContext.amount,
        asset: paymentContext.asset,
        network: paymentContext.network,
        reason: 'Demo endpoint simulated failure',
      });
      console.log('[demo/unreliable] Refund report result:', claimResult);
      refundReported = claimResult.success;
      claimId = claimResult.claimId;
    }

    res.status(500).json({
      success: false,
      error: 'Simulated random failure',
      message: 'This endpoint randomly fails to demonstrate refund protection.',
      refundReported,
      claimId,
      transactionHash: paymentContext.transactionHash,
      payer: paymentContext.userWallet,
      amount: paymentContext.amount,
      asset: paymentContext.asset,
      network: paymentContext.network,
    });
    return;
  }

  // Success!
  res.json({
    success: true,
    message: 'You got lucky! The unreliable endpoint succeeded this time.',
    transactionHash: paymentContext.transactionHash,
    payer: paymentContext.userWallet,
    network: paymentContext.network,
  });
});

// ============================================
// CLAIMS ENDPOINTS (for SDK and users)
// ============================================

/**
 * POST /claims/report-failure - Report a failure from a registered server
 * Header: X-Server-Api-Key (required)
 */
router.post('/claims/report-failure', async (req: Request, res: Response) => {
  try {
    const apiKey = req.headers['x-server-api-key'] as string;

    if (!apiKey) {
      res.status(401).json({ success: false, error: 'Missing X-Server-Api-Key header' });
      return;
    }

    const { originalTxHash, userWallet, amount, asset, network, reason } = req.body;

    if (!originalTxHash || !userWallet || !amount || !asset || !network) {
      res.status(400).json({
        success: false,
        error: 'Missing required fields: originalTxHash, userWallet, amount, asset, network',
      });
      return;
    }

    const result = await reportFailure({
      apiKey,
      originalTxHash,
      userWallet,
      amount,
      asset,
      network,
      reason,
    });

    if (!result.success) {
      res.status(400).json(result);
      return;
    }

    res.status(201).json(result);
  } catch (error) {
    console.error('Report failure error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/**
 * GET /api/claims - Get claimable refunds for a wallet
 * Query params: wallet (required), facilitator (optional subdomain)
 */
router.get('/api/claims', async (req: Request, res: Response) => {
  try {
    const wallet = req.query.wallet as string;
    const facilitatorSubdomain = req.query.facilitator as string | undefined;

    if (!wallet) {
      res.status(400).json({ error: 'Missing wallet query parameter' });
      return;
    }

    let facilitatorId: string | undefined;
    if (facilitatorSubdomain) {
      const facilitator = getFacilitatorByDomainOrSubdomain(facilitatorSubdomain);
      if (!facilitator) {
        res.status(404).json({ error: 'Facilitator not found' });
        return;
      }
      facilitatorId = facilitator.id;
    }

    const claims = getClaimableByUserWallet(wallet, facilitatorId);

    res.json({
      claims: claims.map((c) => ({
        id: c.id,
        originalTxHash: c.original_tx_hash,
        amount: c.amount,
        asset: c.asset,
        network: c.network,
        reason: c.reason,
        status: c.status,
        reportedAt: c.reported_at,
        expiresAt: c.expires_at,
      })),
    });
  } catch (error) {
    console.error('Get claimable error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/claims/history - Get claim history for a wallet
 */
router.get('/api/claims/history', async (req: Request, res: Response) => {
  try {
    const wallet = req.query.wallet as string;
    const facilitatorSubdomain = req.query.facilitator as string | undefined;

    if (!wallet) {
      res.status(400).json({ error: 'Missing wallet query parameter' });
      return;
    }

    let facilitatorId: string | undefined;
    if (facilitatorSubdomain) {
      const facilitator = getFacilitatorByDomainOrSubdomain(facilitatorSubdomain);
      if (!facilitator) {
        res.status(404).json({ error: 'Facilitator not found' });
        return;
      }
      facilitatorId = facilitator.id;
    }

    const claims = getClaimsByUserWallet(wallet, facilitatorId);

    res.json({
      claims: claims.map((c) => ({
        id: c.id,
        originalTxHash: c.original_tx_hash,
        amount: c.amount,
        asset: c.asset,
        network: c.network,
        reason: c.reason,
        status: c.status,
        payoutTxHash: c.payout_tx_hash,
        reportedAt: c.reported_at,
        paidAt: c.paid_at,
        expiresAt: c.expires_at,
      })),
    });
  } catch (error) {
    console.error('Get claims history error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/claims/:id/execute - Execute a claim payout (only for approved claims)
 * Note: In production, you'd want signature verification here
 */
router.post('/api/claims/:id/execute', async (req: Request, res: Response) => {
  try {
    const claim = getClaimById(req.params.id);
    if (!claim) {
      res.status(404).json({ error: 'Claim not found' });
      return;
    }

    if (claim.status !== 'approved') {
      res.status(400).json({
        error: `Claim is not approved for payout (current status: ${claim.status})`,
      });
      return;
    }

    // TODO: In production, verify wallet signature to prove ownership
    // const { signature } = req.body;
    // if (!verifySignature(claim.user_wallet, signature)) {
    //   return res.status(403).json({ error: 'Invalid signature' });
    // }

    const result = await executeClaimPayout(req.params.id);

    if (!result.success) {
      res.status(500).json({ error: result.error || 'Payout failed' });
      return;
    }

    res.json({
      success: true,
      transactionHash: result.transactionHash,
    });
  } catch (error) {
    console.error('Execute claim error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ============================================
// RESOURCE OWNER ENDPOINTS (for third-party API owners)
// Uses session auth (same as dashboard login)
// ============================================

/**
 * POST /api/resource-owners/register - Register as a resource owner
 * Body: { facilitator: string (domain or subdomain), name?: string, refundAddress?: string }
 * Auth: Session (login required)
 */
router.post('/api/resource-owners/register', requireAuth, async (req: Request, res: Response) => {
  try {
    const { facilitator: domainOrSubdomain, name, refundAddress } = req.body;
    if (!domainOrSubdomain) {
      res.status(400).json({ error: 'Missing facilitator identifier' });
      return;
    }

    const facilitator = getFacilitatorByDomainOrSubdomain(domainOrSubdomain);
    if (!facilitator) {
      res.status(404).json({ error: 'Facilitator not found' });
      return;
    }

    // Check if refunds are enabled for this facilitator
    const refundConfig = getOrCreateRefundConfig(facilitator.id);
    if (refundConfig.enabled !== 1) {
      res.status(400).json({ error: 'Refunds are not enabled for this facilitator' });
      return;
    }

    const resourceOwner = getOrCreateResourceOwner({
      facilitator_id: facilitator.id,
      user_id: req.user!.id,
      name,
      refund_address: refundAddress,
    });

    res.status(201).json({
      id: resourceOwner.id,
      facilitatorId: resourceOwner.facilitator_id,
      userId: resourceOwner.user_id,
      refundAddress: resourceOwner.refund_address,
      name: resourceOwner.name,
      createdAt: resourceOwner.created_at,
    });
  } catch (error) {
    console.error('Register resource owner error:', error);
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack');
    res.status(500).json({ error: 'Internal server error', details: error instanceof Error ? error.message : String(error) });
  }
});

/**
 * GET /api/resource-owners/me - Get current resource owner profile
 * Query: facilitator (domain or subdomain)
 * Auth: Session (login required)
 */
router.get('/api/resource-owners/me', requireAuth, async (req: Request, res: Response) => {
  try {
    const facilitatorIdentifier = req.query.facilitator as string;
    if (!facilitatorIdentifier) {
      res.status(400).json({ error: 'Missing facilitator query parameter' });
      return;
    }

    const facilitator = getFacilitatorByDomainOrSubdomain(facilitatorIdentifier);
    if (!facilitator) {
      res.status(404).json({ error: 'Facilitator not found' });
      return;
    }

    const resourceOwner = getResourceOwnerByUserId(facilitator.id, req.user!.id);
    if (!resourceOwner) {
      res.status(404).json({ error: 'Resource owner not found. Please register first.' });
      return;
    }

    res.json({
      id: resourceOwner.id,
      facilitatorId: resourceOwner.facilitator_id,
      userId: resourceOwner.user_id,
      refundAddress: resourceOwner.refund_address,
      name: resourceOwner.name,
      createdAt: resourceOwner.created_at,
    });
  } catch (error) {
    console.error('Get resource owner error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Verify resource owner access - checks user owns the resource owner record
 */
function verifyResourceOwnerAccess(req: Request, res: Response): { resourceOwnerId: string; userId: string } | null {
  if (!req.user) {
    res.status(401).json({ error: 'Authentication required' });
    return null;
  }

  const resourceOwnerId = req.params.resourceOwnerId;
  const resourceOwner = getResourceOwnerById(resourceOwnerId);

  if (!resourceOwner) {
    res.status(404).json({ error: 'Resource owner not found' });
    return null;
  }

  if (resourceOwner.user_id !== req.user.id) {
    res.status(403).json({ error: 'Access denied' });
    return null;
  }

  return { resourceOwnerId, userId: req.user.id };
}

/**
 * GET /api/resource-owners/:resourceOwnerId/wallets - Get refund wallets with balances
 */
router.get('/api/resource-owners/:resourceOwnerId/wallets', requireAuth, async (req: Request, res: Response) => {
  try {
    const access = verifyResourceOwnerAccess(req, res);
    if (!access) return;

    const wallets = await getRefundWalletBalances(access.resourceOwnerId);

    res.json({
      wallets,
      supportedNetworks: SUPPORTED_REFUND_NETWORKS,
    });
  } catch (error) {
    console.error('Get wallets error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/resource-owners/:resourceOwnerId/wallets - Generate refund wallet
 * Body: { network: string }
 */
router.post('/api/resource-owners/:resourceOwnerId/wallets', requireAuth, async (req: Request, res: Response) => {
  try {
    const access = verifyResourceOwnerAccess(req, res);
    if (!access) return;

    const { network } = req.body;
    if (!network) {
      res.status(400).json({ error: 'Missing network' });
      return;
    }

    if (!SUPPORTED_REFUND_NETWORKS.includes(network)) {
      res.status(400).json({
        error: `Unsupported network: ${network}. Supported: ${SUPPORTED_REFUND_NETWORKS.join(', ')}`
      });
      return;
    }

    const result = await generateRefundWallet(access.resourceOwnerId, network);

    res.status(result.created ? 201 : 200).json({
      address: result.address,
      network,
      created: result.created,
      message: result.created
        ? `Wallet generated. Send USDC to ${result.address} to fund refunds.`
        : 'Wallet already exists for this network.',
    });
  } catch (error) {
    console.error('Generate wallet error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * DELETE /api/resource-owners/:resourceOwnerId/wallets/:network - Delete refund wallet
 */
router.delete('/api/resource-owners/:resourceOwnerId/wallets/:network', requireAuth, async (req: Request, res: Response) => {
  try {
    const access = verifyResourceOwnerAccess(req, res);
    if (!access) return;

    const { network } = req.params;
    const deleted = deleteRefundWallet(access.resourceOwnerId, network);

    if (!deleted) {
      res.status(404).json({ error: 'Wallet not found' });
      return;
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Delete wallet error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/resource-owners/:resourceOwnerId/servers - Get registered servers
 */
router.get('/api/resource-owners/:resourceOwnerId/servers', requireAuth, async (req: Request, res: Response) => {
  try {
    const access = verifyResourceOwnerAccess(req, res);
    if (!access) return;

    const servers = getRegisteredServersByResourceOwner(access.resourceOwnerId);

    res.json({
      servers: servers.map((s) => ({
        id: s.id,
        url: s.url,
        name: s.name,
        active: s.active === 1,
        createdAt: s.created_at,
      })),
    });
  } catch (error) {
    console.error('Get servers error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/resource-owners/:resourceOwnerId/servers - Create an API key
 * Body: { url?: string, name?: string }
 * At least one of url or name is required for identification.
 * Returns the API key ONCE - store it securely!
 */
router.post('/api/resource-owners/:resourceOwnerId/servers', requireAuth, async (req: Request, res: Response) => {
  try {
    const access = verifyResourceOwnerAccess(req, res);
    if (!access) return;

    const { url, name } = req.body;
    if (!url && !name) {
      res.status(400).json({ error: 'Provide a label or URL to identify this API key' });
      return;
    }

    const { server, apiKey } = createRegisteredServer({
      resource_owner_id: access.resourceOwnerId,
      url,
      name,
    });

    res.status(201).json({
      server: {
        id: server.id,
        url: server.url,
        name: server.name,
        active: server.active === 1,
        createdAt: server.created_at,
      },
      apiKey,
      warning: 'Store this API key securely! It will not be shown again.',
    });
  } catch (error) {
    console.error('Register server error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * DELETE /api/resource-owners/:resourceOwnerId/servers/:serverId - Delete a server
 */
router.delete('/api/resource-owners/:resourceOwnerId/servers/:serverId', requireAuth, async (req: Request, res: Response) => {
  try {
    const access = verifyResourceOwnerAccess(req, res);
    if (!access) return;

    const { serverId } = req.params;

    // Verify server belongs to this resource owner
    const server = getRegisteredServerById(serverId);
    if (!server || server.resource_owner_id !== access.resourceOwnerId) {
      res.status(404).json({ error: 'Server not found' });
      return;
    }

    const deleted = deleteRegisteredServer(serverId);
    if (!deleted) {
      res.status(404).json({ error: 'Server not found' });
      return;
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Delete server error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * PATCH /api/resource-owners/:resourceOwnerId/servers/:serverId - Update server/API key details
 */
router.patch('/api/resource-owners/:resourceOwnerId/servers/:serverId', requireAuth, async (req: Request, res: Response) => {
  try {
    const access = verifyResourceOwnerAccess(req, res);
    if (!access) return;

    const { serverId } = req.params;
    const { name, url } = req.body;

    // Verify server belongs to this resource owner
    const server = getRegisteredServerById(serverId);
    if (!server || server.resource_owner_id !== access.resourceOwnerId) {
      res.status(404).json({ error: 'API key not found' });
      return;
    }

    const updated = updateRegisteredServer(serverId, {
      name: name !== undefined ? name : undefined,
      url: url !== undefined ? url : undefined,
    });

    if (!updated) {
      res.status(500).json({ error: 'Failed to update API key' });
      return;
    }

    res.json({
      id: updated.id,
      url: updated.url,
      name: updated.name,
      active: updated.active === 1,
      createdAt: updated.created_at,
    });
  } catch (error) {
    console.error('Update server error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/resource-owners/:resourceOwnerId/servers/:serverId/regenerate-key - Regenerate API key
 */
router.post('/api/resource-owners/:resourceOwnerId/servers/:serverId/regenerate-key', requireAuth, async (req: Request, res: Response) => {
  try {
    const access = verifyResourceOwnerAccess(req, res);
    if (!access) return;

    const { serverId } = req.params;

    // Verify server belongs to this resource owner
    const server = getRegisteredServerById(serverId);
    if (!server || server.resource_owner_id !== access.resourceOwnerId) {
      res.status(404).json({ error: 'Server not found' });
      return;
    }

    const result = regenerateServerApiKey(serverId);
    if (!result) {
      res.status(404).json({ error: 'Server not found' });
      return;
    }

    res.json({
      apiKey: result.apiKey,
      warning: 'Store this API key securely! The old key is now invalid.',
    });
  } catch (error) {
    console.error('Regenerate key error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/resource-owners/:resourceOwnerId/claims - Get claims for resource owner
 * Query: status (optional filter)
 */
router.get('/api/resource-owners/:resourceOwnerId/claims', requireAuth, async (req: Request, res: Response) => {
  try {
    const access = verifyResourceOwnerAccess(req, res);
    if (!access) return;

    const status = req.query.status as string | undefined;
    const claims = getClaimsByResourceOwner(access.resourceOwnerId, {
      status: status as 'pending' | 'approved' | 'paid' | 'rejected' | 'expired' | undefined
    });
    const stats = getClaimStats(access.resourceOwnerId);

    res.json({
      claims: claims.map((c) => ({
        id: c.id,
        serverId: c.server_id,
        originalTxHash: c.original_tx_hash,
        userWallet: c.user_wallet,
        amount: c.amount,
        asset: c.asset,
        network: c.network,
        reason: c.reason,
        status: c.status,
        payoutTxHash: c.payout_tx_hash,
        reportedAt: c.reported_at,
        paidAt: c.paid_at,
        expiresAt: c.expires_at,
      })),
      stats,
    });
  } catch (error) {
    console.error('Get claims error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/resource-owners/:resourceOwnerId/claims/:claimId/approve - Approve a claim
 */
router.post('/api/resource-owners/:resourceOwnerId/claims/:claimId/approve', requireAuth, async (req: Request, res: Response) => {
  try {
    const access = verifyResourceOwnerAccess(req, res);
    if (!access) return;

    const { claimId } = req.params;
    const claim = getClaimById(claimId);

    if (!claim || claim.resource_owner_id !== access.resourceOwnerId) {
      res.status(404).json({ error: 'Claim not found' });
      return;
    }

    const updated = approveClaim(claimId);
    if (!updated) {
      res.status(400).json({ error: 'Claim cannot be approved (may not be pending)' });
      return;
    }

    res.json({
      id: updated.id,
      status: updated.status,
    });
  } catch (error) {
    console.error('Approve claim error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/resource-owners/:resourceOwnerId/claims/:claimId/reject - Reject a claim
 */
router.post('/api/resource-owners/:resourceOwnerId/claims/:claimId/reject', requireAuth, async (req: Request, res: Response) => {
  try {
    const access = verifyResourceOwnerAccess(req, res);
    if (!access) return;

    const { claimId } = req.params;
    const claim = getClaimById(claimId);

    if (!claim || claim.resource_owner_id !== access.resourceOwnerId) {
      res.status(404).json({ error: 'Claim not found' });
      return;
    }

    const updated = rejectClaim(claimId);
    if (!updated) {
      res.status(400).json({ error: 'Claim cannot be rejected' });
      return;
    }

    res.json({
      id: updated.id,
      status: updated.status,
    });
  } catch (error) {
    console.error('Reject claim error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/resource-owners/:resourceOwnerId/claims/:claimId/payout - Execute payout
 */
router.post('/api/resource-owners/:resourceOwnerId/claims/:claimId/payout', requireAuth, async (req: Request, res: Response) => {
  try {
    const access = verifyResourceOwnerAccess(req, res);
    if (!access) return;

    const { claimId } = req.params;
    const claim = getClaimById(claimId);

    if (!claim || claim.resource_owner_id !== access.resourceOwnerId) {
      res.status(404).json({ error: 'Claim not found' });
      return;
    }

    if (claim.status !== 'approved') {
      res.status(400).json({ error: `Claim must be approved before payout (current: ${claim.status})` });
      return;
    }

    const result = await executeClaimPayout(claimId);

    if (!result.success) {
      res.status(500).json({ error: result.error || 'Payout failed' });
      return;
    }

    res.json({
      success: true,
      transactionHash: result.transactionHash,
    });
  } catch (error) {
    console.error('Execute payout error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/resource-owners/:resourceOwnerId/stats - Get stats for resource owner
 */
router.get('/api/resource-owners/:resourceOwnerId/stats', requireAuth, async (req: Request, res: Response) => {
  try {
    const access = verifyResourceOwnerAccess(req, res);
    if (!access) return;

    const stats = getClaimStats(access.resourceOwnerId);
    const wallets = await getRefundWalletBalances(access.resourceOwnerId);
    const servers = getRegisteredServersByResourceOwner(access.resourceOwnerId);

    res.json({
      claims: stats,
      wallets: wallets.length,
      servers: servers.filter(s => s.active === 1).length,
      totalWalletBalance: wallets.reduce((sum, w) => sum + parseFloat(w.balance), 0).toFixed(2),
    });
  } catch (error) {
    console.error('Get stats error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ============================================
// Verification API
// ============================================

/**
 * GET /api/verify - Verify if a facilitator supports refunds
 *
 * Query params:
 * - facilitator: subdomain or custom domain of the facilitator
 *
 * Response:
 * {
 *   verified: boolean,
 *   supportsRefunds: boolean,
 *   facilitator: string,
 *   facilitatorName: string,
 *   badgeUrl: string
 * }
 */
router.get('/api/verify', async (req: Request, res: Response) => {
  try {
    let { facilitator: facilitatorId } = req.query;

    if (!facilitatorId || typeof facilitatorId !== 'string') {
      res.status(400).json({
        verified: false,
        supportsRefunds: false,
        error: 'Missing facilitator parameter',
      });
      return;
    }

    const baseUrl = process.env.DASHBOARD_URL || 'https://openfacilitator.io';

    // Handle special case: free facilitator (pay.openfacilitator.io)
    if (facilitatorId === 'pay' || facilitatorId === 'pay.openfacilitator.io') {
      // Free facilitator supports refunds if DEMO_REFUND_API_KEY is configured
      const supportsRefunds = !!process.env.DEMO_REFUND_API_KEY;
      res.json({
        verified: true,
        supportsRefunds,
        facilitator: 'pay',
        facilitatorName: 'OpenFacilitator (Free)',
        badgeUrl: supportsRefunds ? `${baseUrl}/badges/refund-protected.svg` : null,
        verifyUrl: `${baseUrl}/verify?facilitator=pay`,
      });
      return;
    }

    // Look up facilitator by custom domain
    const facilitator = getFacilitatorByDomainOrSubdomain(facilitatorId);

    if (!facilitator) {
      res.status(404).json({
        verified: false,
        supportsRefunds: false,
        error: 'Facilitator not found',
      });
      return;
    }

    // Check if refund protection is enabled
    // A facilitator supports refunds if any resource owner has:
    // 1. Refund config enabled
    // 2. At least one refund wallet
    // 3. At least one API key for reporting failures

    const resourceOwners = getResourceOwnersByFacilitator(facilitator.id);
    let supportsRefunds = false;

    for (const resourceOwner of resourceOwners) {
      const refundConfig = getOrCreateRefundConfig(resourceOwner.id);
      const wallets = getRefundWalletsByResourceOwner(resourceOwner.id);
      const servers = getRegisteredServersByResourceOwner(resourceOwner.id);

      // Has refunds if: config enabled + at least one wallet + at least one API key
      if (refundConfig.enabled === 1 && wallets.length > 0 && servers.some(s => s.active === 1)) {
        supportsRefunds = true;
        break;
      }
    }

    const facilitatorDomain = facilitator.custom_domain || facilitator.subdomain;
    res.json({
      verified: true,
      supportsRefunds,
      facilitator: facilitatorDomain,
      facilitatorName: facilitator.name,
      badgeUrl: supportsRefunds
        ? `${baseUrl}/badges/refund-protected.svg`
        : null,
      verifyUrl: `${baseUrl}/verify?facilitator=${facilitatorDomain}`,
    });
  } catch (error) {
    console.error('Verify error:', error);
    res.status(500).json({
      verified: false,
      supportsRefunds: false,
      error: 'Internal server error',
    });
  }
});

export { router as publicRouter };

