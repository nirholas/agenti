/**
 * Stats API - x402 protected endpoint for platform statistics
 *
 * GET /stats/solana - Stats via Solana payment ($5 USDC)
 * GET /stats/base - Stats via Base payment ($5 USDC)
 */
import { Router, type Request, type Response, type IRouter } from 'express';
import { OpenFacilitator, createPaymentMiddleware, type PaymentRequirements } from '@openfacilitator/sdk';
import { getGlobalStats } from '../db/transactions.js';

const router: IRouter = Router();

// Configuration
const STATS_PRICE_ATOMIC = '5000000'; // $5 USDC (6 decimals)

// Solana config (USDC mint is constant, treasury configurable)
const USDC_SOLANA_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
const SOLANA_TREASURY = process.env.TREASURY_SOLANA!;

// Base config (USDC address is constant, treasury configurable)
const USDC_BASE = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
const BASE_TREASURY = process.env.TREASURY_BASE!;

// Facilitator endpoint (configurable for self-hosted deployments)
const FACILITATOR_URL = process.env.STATS_FACILITATOR_URL || 'https://pay.openfacilitator.io';
const API_URL = process.env.API_URL || 'https://api.openfacilitator.io';

// Initialize SDK client
const facilitator = new OpenFacilitator({ url: FACILITATOR_URL });

// Shared output schema for stats response
const OUTPUT_SCHEMA = {
  type: 'object',
  properties: {
    success: { type: 'boolean' },
    paymentTxHash: { type: 'string' },
    timestamp: { type: 'string' },
    stats: {
      type: 'object',
      properties: {
        global: {
          type: 'object',
          properties: {
            totalTransactionsAllTime: { type: 'number' },
            totalTransactions24h: { type: 'number' },
            volumeUsdAllTime: { type: 'string' },
            volumeUsd24h: { type: 'string' },
            uniqueWallets: { type: 'number' },
          },
        },
        paymentLinks: {
          type: 'object',
          properties: {
            totalSellers: { type: 'number' },
            totalLinks: { type: 'number' },
            totalPayments: { type: 'number' },
            volumeUsd: { type: 'string' },
          },
        },
        facilitators: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              name: { type: 'string' },
              subdomain: { type: 'string' },
              transactionCount: { type: 'number' },
              volumeUsd: { type: 'string' },
              uniqueWallets: { type: 'number' },
              totalSellers: { type: 'number' },
              totalLinks: { type: 'number' },
            },
          },
        },
      },
    },
  },
};

// Base requirements by network (feePayer added dynamically from facilitator)
const BASE_REQUIREMENTS = {
  solana: {
    scheme: 'exact',
    network: 'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp', // CAIP-2 Solana mainnet
    amount: STATS_PRICE_ATOMIC,
    resource: `${API_URL}/stats/solana`,
    asset: USDC_SOLANA_MINT,
    payTo: SOLANA_TREASURY,
    maxTimeoutSeconds: 300,
    description: 'OpenFacilitator Platform Statistics - $5 per request',
    outputSchema: OUTPUT_SCHEMA,
  },
  base: {
    scheme: 'exact',
    network: 'eip155:8453', // CAIP-2 Base mainnet
    amount: STATS_PRICE_ATOMIC,
    resource: `${API_URL}/stats/base`,
    asset: USDC_BASE,
    payTo: BASE_TREASURY,
    maxTimeoutSeconds: 300,
    description: 'OpenFacilitator Platform Statistics - $5 per request',
    outputSchema: OUTPUT_SCHEMA,
  },
};

// Get requirements with feePayer from facilitator SDK
async function getRequirements(network: 'solana' | 'base'): Promise<PaymentRequirements> {
  const baseReq = BASE_REQUIREMENTS[network];
  const feePayer = await facilitator.getFeePayer(baseReq.network);

  return {
    ...baseReq,
    extra: feePayer ? { feePayer } : undefined,
  } as PaymentRequirements;
}

// Get all requirements for multi-network 402 response
async function getAllRequirements(): Promise<PaymentRequirements[]> {
  const [solana, base] = await Promise.all([
    getRequirements('solana'),
    getRequirements('base'),
  ]);
  return [solana, base];
}

// Create middleware with refund protection if API key is configured
const statsPaymentMiddleware = createPaymentMiddleware({
  facilitator,
  getRequirements: getAllRequirements,
  refundProtection: process.env.DEMO_REFUND_API_KEY ? {
    apiKey: process.env.DEMO_REFUND_API_KEY,
    facilitatorUrl: API_URL,
  } : undefined,
});

// Handler for stats requests (called after middleware)
function handleStatsSuccess(req: Request, res: Response) {
  const paymentContext = (req as { paymentContext?: { transactionHash: string } }).paymentContext;
  const stats = getGlobalStats();

  res.json({
    success: true,
    paymentTxHash: paymentContext?.transactionHash,
    timestamp: new Date().toISOString(),
    stats,
  });
}

/**
 * GET /stats/solana - Platform statistics (Solana payment)
 */
router.get('/stats/solana', statsPaymentMiddleware, handleStatsSuccess);

/**
 * GET /stats/base - Platform statistics (Base payment)
 */
router.get('/stats/base', statsPaymentMiddleware, handleStatsSuccess);

/**
 * GET /stats - Show available endpoints with payment requirements
 */
router.get('/stats', async (_req: Request, res: Response) => {
  const requirements = await getAllRequirements();

  // Add supportsRefunds if refund protection is configured
  const accepts = requirements.map((req) => ({
    ...req,
    extra: {
      ...req.extra,
      ...(process.env.DEMO_REFUND_API_KEY ? { supportsRefunds: true } : {}),
    },
  }));

  res.status(402).json({
    x402Version: 2,
    accepts,
    error: 'Payment Required',
    message: 'Use /stats/solana or /stats/base for network-specific endpoints',
    endpoints: {
      solana: `${API_URL}/stats/solana`,
      base: `${API_URL}/stats/base`,
    },
  });
});

/**
 * GET /stats/price - Get the current price for stats access (no payment required)
 */
router.get('/stats/price', (_req: Request, res: Response) => {
  res.json({
    priceUsd: '5.00',
    priceAtomic: STATS_PRICE_ATOMIC,
    endpoints: {
      solana: {
        url: `${API_URL}/stats/solana`,
        network: 'solana',
        asset: USDC_SOLANA_MINT,
        payTo: SOLANA_TREASURY,
      },
      base: {
        url: `${API_URL}/stats/base`,
        network: 'base',
        asset: USDC_BASE,
        payTo: BASE_TREASURY,
      },
    },
  });
});

// OpenFacilitator icon SVG
const ICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
  <rect width="32" height="32" rx="6" fill="hsl(217, 91%, 50%)"/>
  <g transform="translate(4, 4)" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none">
    <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/>
    <path d="m9 12 2 2 4-4"/>
  </g>
</svg>`;

/**
 * GET /.well-known/x402-verification.json - Domain verification for x402jobs
 */
router.get('/.well-known/x402-verification.json', (_req: Request, res: Response) => {
  res.json({ x402: '5529268e5dda' });
});

/**
 * GET /.well-known/x402watch.txt - Domain verification for x402watch
 */
router.get('/.well-known/x402watch.txt', (_req: Request, res: Response) => {
  res.setHeader('Content-Type', 'text/plain');
  res.send('6142d507013540b1a88d478c53854394');
});

/**
 * GET /favicon.ico - Serve OpenFacilitator icon for API domain
 */
router.get('/favicon.ico', (_req: Request, res: Response) => {
  res.setHeader('Content-Type', 'image/svg+xml');
  res.setHeader('Cache-Control', 'public, max-age=86400');
  res.send(ICON_SVG);
});

/**
 * GET /icon.svg - Serve OpenFacilitator icon for API domain
 */
router.get('/icon.svg', (_req: Request, res: Response) => {
  res.setHeader('Content-Type', 'image/svg+xml');
  res.setHeader('Cache-Control', 'public, max-age=86400');
  res.send(ICON_SVG);
});

export { router as statsRouter };
