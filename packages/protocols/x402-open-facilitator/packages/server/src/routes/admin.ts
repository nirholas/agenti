import { Router, type Request, type Response, type IRouter } from 'express';
import { z } from 'zod';
import {
  createFacilitator,
  getFacilitatorById,
  getFacilitatorsByOwner,
  updateFacilitator,
  deleteFacilitator,
  ensureFacilitatorMarker,
} from '../db/facilitators.js';
import { getTransactionsByFacilitator, getTransactionStats, getDailyStats } from '../db/transactions.js';
import {
  createProduct,
  getProductById,
  getProductsByFacilitator,
  updateProduct,
  deleteProduct,
  getProductStats,
  getProductPayments,
  getFacilitatorProductsStats,
  isProductSlugUnique,
} from '../db/products.js';
import {
  createWebhook,
  getWebhookById,
  getWebhooksByFacilitator,
  updateWebhook,
  deleteWebhook,
  regenerateWebhookSecret,
} from '../db/webhooks.js';
import {
  createPendingFacilitator,
  getPendingFacilitatorByUserId,
  deletePendingFacilitatorsForUser,
} from '../db/pending-facilitators.js';
import {
  createProxyUrl,
  getProxyUrlById,
  getProxyUrlsByFacilitator,
  updateProxyUrl,
  deleteProxyUrl,
  isSlugUnique as isProxySlugUnique,
} from '../db/proxy-urls.js';
import {
  createStorefront,
  getStorefrontById,
  getStorefrontBySlug,
  getStorefrontsByFacilitator,
  updateStorefront,
  deleteStorefront,
  isStorefrontSlugUnique,
  addProductToStorefront,
  removeProductFromStorefront,
  getStorefrontProducts,
  getStorefrontStats,
  getFacilitatorStorefrontsStats,
} from '../db/storefronts.js';
import {
  getOrCreateRefundConfig,
  updateRefundConfig,
} from '../db/refund-configs.js';
import {
  getRefundWallet,
  getRefundWalletsByResourceOwner,
} from '../db/refund-wallets.js';
import {
  getRegisteredServerById,
  getRegisteredServersByResourceOwner,
} from '../db/registered-servers.js';
import {
  getClaimsByResourceOwner,
  getClaimById,
  getClaimStats,
} from '../db/claims.js';
import {
  getResourceOwnersByFacilitator,
  getResourceOwnerById,
} from '../db/resource-owners.js';
import {
  getUserPreference,
  upsertUserPreference,
} from '../db/user-preferences.js';
import { getSubscriptionsByUserId } from '../db/subscriptions.js';
import {
  getRefundWalletBalance,
  getRefundWalletBalances,
  SUPPORTED_REFUND_NETWORKS,
} from '../services/refund-wallet.js';
import { getDatabase } from '../db/index.js';
import {
  defaultTokens,
  getWalletAddress,
  getWalletBalance,
  generateSolanaKeypair,
  getSolanaPublicKey,
  getSolanaBalance,
  isValidSolanaPrivateKey,
  getNonceStatus,
  forceResetNonce,
} from '@openfacilitator/core';
import { requireAuth, optionalAuth } from '../middleware/auth.js';

// Helper to convert SQLite datetime (YYYY-MM-DD HH:MM:SS) to ISO format
function formatSqliteDate(dateStr: string | null | undefined): string | null {
  if (!dateStr) return null;
  try {
    // SQLite datetime format: YYYY-MM-DD HH:MM:SS (in UTC)
    // Convert to ISO format with Z suffix to indicate UTC
    return new Date(dateStr.replace(' ', 'T') + 'Z').toISOString();
  } catch {
    return dateStr;
  }
}
import { 
  addCustomDomain, 
  removeCustomDomain, 
  getDomainStatus, 
  isRailwayConfigured 
} from '../services/railway.js';
import crypto from 'crypto';
import { getAddressFromPrivateKey } from '@stacks/transactions';
import { encryptPrivateKey, decryptPrivateKey, generateWallet } from '../utils/crypto.js';
import {
  generateWalletForUser,
  generateBaseWalletForUser,
  getWalletForUser,
  getWalletForUserByNetwork,
  getAllWalletsForUser,
  getUSDCBalance,
  getBaseUSDCBalance,
  getStacksSTXBalance,
} from '../services/wallet.js';
import { generateWebhookSecret, deliverWebhook } from '../services/webhook.js';
import type { Hex } from 'viem';

const router: IRouter = Router();

// Apply optional auth to all routes first to get user context
router.use(optionalAuth);

// Validation schemas - chainId can be number (EVM) or string (Solana)
const chainIdSchema = z.union([z.number(), z.string()]);

const createFacilitatorSchema = z.object({
  name: z.string().min(1).max(100),
  subdomain: z
    .string()
    .min(3)
    .max(63)
    .regex(/^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/, 'Invalid subdomain format'),
  customDomain: z.string().max(255).optional(),
  ownerAddress: z.string().optional(),
  supportedChains: z.array(chainIdSchema).optional(),
  supportedTokens: z
    .array(
      z.object({
        address: z.string(),
        symbol: z.string(),
        decimals: z.number(),
        chainId: chainIdSchema,
      })
    )
    .optional(),
});

const updateFacilitatorSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  customDomain: z.string().max(255).optional().nullable(),
  additionalDomains: z.array(z.string().max(255)).optional(),
  supportedChains: z.array(chainIdSchema).optional(),
  supportedTokens: z
    .array(
      z.object({
        address: z.string(),
        symbol: z.string(),
        decimals: z.number(),
        chainId: chainIdSchema,
      })
    )
    .optional(),
  webhookUrl: z.string().url().max(2048).optional().nullable(),
});

/**
 * GET /api/admin/me - Get current user info
 */
router.get('/me', requireAuth, async (req: Request, res: Response) => {
  res.json({
    id: req.user!.id,
    email: req.user!.email,
    name: req.user!.name,
    emailVerified: req.user!.emailVerified,
    createdAt: req.user!.createdAt,
  });
});

/**
 * GET /api/admin/wallet - Get user's billing wallet info and USDC balance
 */
router.get('/wallet', requireAuth, async (req: Request, res: Response) => {
  try {
    const wallet = getWalletForUser(req.user!.id);
    if (!wallet) {
      res.status(404).json({ error: 'Wallet not found', hasWallet: false });
      return;
    }

    const { formatted } = await getUSDCBalance(wallet.address);

    res.json({
      hasWallet: true,
      address: wallet.address,
      network: wallet.network,
      balance: formatted,
      token: 'USDC',
    });
  } catch (error) {
    console.error('Get wallet error:', error);
    res.status(500).json({ error: 'Failed to get wallet info' });
  }
});

/**
 * POST /api/admin/wallet/create - Create billing wallet for user
 */
router.post('/wallet/create', requireAuth, async (req: Request, res: Response) => {
  try {
    const result = await generateWalletForUser(req.user!.id);

    res.json({
      address: result.address,
      network: 'solana',
      created: result.created,
      message: result.created
        ? 'Wallet created successfully. Fund this address with USDC on Solana.'
        : 'Wallet already exists.',
    });
  } catch (error) {
    console.error('Create wallet error:', error);
    res.status(500).json({ error: 'Failed to create wallet' });
  }
});

/**
 * GET /api/admin/wallets - Get all user wallets with balances
 */
router.get('/wallets', requireAuth, async (req: Request, res: Response) => {
  try {
    const wallets = getAllWalletsForUser(req.user!.id);

    // Fetch balance for each wallet
    const walletsWithBalances = await Promise.all(
      wallets.map(async (wallet) => {
        try {
          const { formatted } =
            wallet.network === 'base'
              ? await getBaseUSDCBalance(wallet.address)
              : await getUSDCBalance(wallet.address);

          return {
            network: wallet.network as 'solana' | 'base',
            address: wallet.address,
            balance: formatted,
            token: 'USDC',
          };
        } catch (error) {
          console.error(`Error fetching balance for ${wallet.network} wallet:`, error);
          return {
            network: wallet.network as 'solana' | 'base',
            address: wallet.address,
            balance: '0.00',
            token: 'USDC',
          };
        }
      })
    );

    res.json(walletsWithBalances);
  } catch (error) {
    console.error('Get wallets error:', error);
    res.status(500).json({ error: 'Failed to get wallets' });
  }
});

/**
 * GET /api/admin/wallets/:chain - Get specific wallet by chain
 * chain = 'solana' | 'base'
 */
router.get('/wallets/:chain', requireAuth, async (req: Request, res: Response) => {
  try {
    const { chain } = req.params;

    // Validate chain parameter
    if (chain !== 'solana' && chain !== 'base') {
      res.status(400).json({ error: 'Invalid chain. Must be "solana" or "base".' });
      return;
    }

    const wallet = getWalletForUserByNetwork(req.user!.id, chain);
    if (!wallet) {
      res.status(404).json({
        error: `No ${chain} wallet found`,
        hasWallet: false,
        network: chain,
      });
      return;
    }

    const { formatted } =
      chain === 'base'
        ? await getBaseUSDCBalance(wallet.address)
        : await getUSDCBalance(wallet.address);

    res.json({
      network: chain as 'solana' | 'base',
      address: wallet.address,
      balance: formatted,
      token: 'USDC',
    });
  } catch (error) {
    console.error('Get wallet by chain error:', error);
    res.status(500).json({ error: 'Failed to get wallet' });
  }
});

/**
 * POST /api/admin/wallets/:chain/create - Create wallet for specific chain
 * chain = 'solana' | 'base'
 */
router.post('/wallets/:chain/create', requireAuth, async (req: Request, res: Response) => {
  try {
    const { chain } = req.params;

    // Validate chain parameter
    if (chain !== 'solana' && chain !== 'base') {
      res.status(400).json({ error: 'Invalid chain. Must be "solana" or "base".' });
      return;
    }

    const result =
      chain === 'base'
        ? await generateBaseWalletForUser(req.user!.id)
        : await generateWalletForUser(req.user!.id);

    res.json({
      address: result.address,
      network: chain,
      created: result.created,
      message: result.created
        ? `${chain.charAt(0).toUpperCase() + chain.slice(1)} wallet created successfully. Fund this address with USDC.`
        : `${chain.charAt(0).toUpperCase() + chain.slice(1)} wallet already exists.`,
    });
  } catch (error) {
    console.error('Create wallet error:', error);
    res.status(500).json({ error: 'Failed to create wallet' });
  }
});

/**
 * GET /api/admin/wallets/:chain/balance - Refresh balance for specific wallet
 */
router.get('/wallets/:chain/balance', requireAuth, async (req: Request, res: Response) => {
  try {
    const { chain } = req.params;

    // Validate chain parameter
    if (chain !== 'solana' && chain !== 'base') {
      res.status(400).json({ error: 'Invalid chain. Must be "solana" or "base".' });
      return;
    }

    const wallet = getWalletForUserByNetwork(req.user!.id, chain);
    if (!wallet) {
      res.status(404).json({
        error: `No ${chain} wallet found`,
        hasWallet: false,
        network: chain,
      });
      return;
    }

    const { formatted } =
      chain === 'base'
        ? await getBaseUSDCBalance(wallet.address)
        : await getUSDCBalance(wallet.address);

    res.json({
      balance: formatted,
      token: 'USDC',
    });
  } catch (error) {
    console.error('Get wallet balance error:', error);
    res.status(500).json({ error: 'Failed to get balance' });
  }
});

/**
 * GET /api/admin/preference - Get user's chain preference
 * Returns stored preference or calculates default from payment history and wallet balances
 */
router.get('/preference', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;

    // Check for existing preference
    const preference = getUserPreference(userId);

    if (preference) {
      return res.json({ preferredChain: preference.preferred_chain });
    }

    // Calculate default if no preference set
    // Get payment history
    const subscriptions = getSubscriptionsByUserId(userId);
    const payments = subscriptions.map(s => ({
      chain: 'solana', // Legacy payments were Solana-only
      date: s.created_at,
    }));

    // Get wallet balances
    const wallets = getAllWalletsForUser(userId);
    const walletsWithBalances = await Promise.all(
      wallets.map(async (w) => {
        const balance = w.network === 'solana'
          ? await getUSDCBalance(w.address)
          : await getBaseUSDCBalance(w.address);
        return {
          network: w.network as 'base' | 'solana',
          address: w.address,
          balance: balance.formatted,
          token: 'USDC',
        };
      })
    );

    // Determine default
    let defaultChain: 'base' | 'solana' = 'solana';

    // Check payments first
    if (payments.length > 0) {
      const sorted = [...payments].sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
      );
      const mostRecent = sorted[0].chain.toLowerCase();
      if (mostRecent === 'base' || mostRecent === 'solana') {
        defaultChain = mostRecent;
      }
    } else {
      // Check balances
      const baseWallet = walletsWithBalances.find(w => w.network === 'base');
      const solanaWallet = walletsWithBalances.find(w => w.network === 'solana');
      const baseBalance = baseWallet ? parseFloat(baseWallet.balance) : 0;
      const solanaBalance = solanaWallet ? parseFloat(solanaWallet.balance) : 0;

      if (baseBalance > solanaBalance) defaultChain = 'base';
    }

    return res.json({ preferredChain: defaultChain });
  } catch (error) {
    console.error('Error getting preference:', error);
    return res.status(500).json({ error: 'Failed to get preference' });
  }
});

/**
 * PUT /api/admin/preference - Update user's chain preference
 */
router.put('/preference', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { preferredChain } = req.body;

    if (!preferredChain || !['base', 'solana'].includes(preferredChain)) {
      return res.status(400).json({ error: 'Invalid preferredChain. Must be "base" or "solana".' });
    }

    const preference = upsertUserPreference(userId, preferredChain);

    return res.json({
      preferredChain: preference.preferred_chain,
      updated: true,
    });
  } catch (error) {
    console.error('Error updating preference:', error);
    return res.status(500).json({ error: 'Failed to update preference' });
  }
});

/**
 * POST /api/admin/pending-facilitator - Save a pending facilitator request (before payment)
 */
router.post('/pending-facilitator', requireAuth, async (req: Request, res: Response) => {
  try {
    const { name, customDomain } = req.body;

    if (!name || !customDomain) {
      res.status(400).json({ error: 'Name and customDomain are required' });
      return;
    }

    const userId = req.user!.id;
    const subdomain = customDomain.replace(/\./g, '-');

    // Delete any existing pending facilitators for this user
    deletePendingFacilitatorsForUser(userId);

    // Create new pending facilitator
    const pending = createPendingFacilitator(userId, name, customDomain, subdomain);

    console.log(`[Pending Facilitator] Created pending request for user ${userId}: ${name} (${customDomain})`);

    res.status(201).json({
      id: pending.id,
      name: pending.name,
      customDomain: pending.custom_domain,
      subdomain: pending.subdomain,
      createdAt: pending.created_at,
    });
  } catch (error) {
    console.error('Create pending facilitator error:', error);
    res.status(500).json({ error: 'Failed to create pending facilitator request' });
  }
});

/**
 * POST /api/admin/facilitators - Create a new facilitator
 */
router.post('/facilitators', requireAuth, async (req: Request, res: Response) => {
  try {
    const parsed = createFacilitatorSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: 'Invalid request',
        details: parsed.error.issues,
      });
      return;
    }

    const { name, subdomain, customDomain, supportedChains, supportedTokens } = parsed.data;
    // Use the authenticated user's ID as owner, or wallet address if provided
    const ownerAddress = parsed.data.ownerAddress || req.user!.id;

    // Default to production chains: Base Mainnet + Solana Mainnet
    const chains = supportedChains || [8453, 'solana'];
    const tokens = supportedTokens || defaultTokens.filter((t) => chains.includes(t.chainId));

    const facilitator = createFacilitator({
      name,
      subdomain,
      custom_domain: customDomain,
      owner_address: ownerAddress,
      supported_chains: JSON.stringify(chains),
      supported_tokens: JSON.stringify(tokens),
    });

    if (!facilitator) {
      res.status(409).json({
        error: 'Subdomain already exists',
      });
      return;
    }

    // Ensure facilitator owner has enrollment marker for volume tracking
    ensureFacilitatorMarker(ownerAddress);

    // Register custom domain with Railway (not subdomain - we only support custom domains)
    let railwayStatus: { success: boolean; error?: string } = { success: false };

    if (customDomain && isRailwayConfigured()) {
      console.log(`Registering custom domain with Railway: ${customDomain}`);
      railwayStatus = await addCustomDomain(customDomain);
      if (railwayStatus.success) {
        console.log(`Successfully registered ${customDomain} with Railway`);
      } else {
        console.error(`Failed to register ${customDomain} with Railway:`, railwayStatus.error);
      }
    } else if (!customDomain) {
      console.log('No custom domain provided, skipping Railway registration');
    } else {
      console.log('Railway not configured, skipping domain registration');
    }

    res.status(201).json({
      id: facilitator.id,
      name: facilitator.name,
      subdomain: facilitator.subdomain,
      customDomain: facilitator.custom_domain,
      ownerAddress: facilitator.owner_address,
      supportedChains: JSON.parse(facilitator.supported_chains),
      supportedTokens: JSON.parse(facilitator.supported_tokens),
      url: customDomain ? `https://${customDomain}` : null,
      createdAt: formatSqliteDate(facilitator.created_at),
      railwayRegistered: railwayStatus.success,
      railwayError: railwayStatus.error,
    });
  } catch (error) {
    console.error('Create facilitator error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/admin/facilitators - List facilitators for the authenticated user
 * Note: Domain status is NOT fetched here to keep the list fast.
 * Domain status is fetched on the detail page instead.
 */
router.get('/facilitators', requireAuth, (req: Request, res: Response) => {
  try {
    // Use authenticated user's ID, or allow owner query param for backwards compatibility
    const ownerAddress = (req.query.owner as string) || req.user!.id;

    const facilitators = getFacilitatorsByOwner(ownerAddress);

    // Map facilitators without calling Railway API (fast)
    const facilitatorsWithStatus = facilitators.map((f) => {
      const stats = getTransactionStats(f.id);

      return {
        id: f.id,
        name: f.name,
        subdomain: f.subdomain,
        customDomain: f.custom_domain,
        additionalDomains: JSON.parse(f.additional_domains || '[]'),
        ownerAddress: f.owner_address,
        supportedChains: JSON.parse(f.supported_chains),
        supportedTokens: JSON.parse(f.supported_tokens),
        url: f.custom_domain
          ? `https://${f.custom_domain}`
          : `https://${f.subdomain}.openfacilitator.io`,
        favicon: f.favicon || null,
        // Domain status will be fetched on detail page, not here
        domainStatus: f.custom_domain ? 'unknown' : null,
        dnsRecords: null,
        stats: {
          totalSettled: stats.totalAmountSettled,
          totalVerifications: stats.verified,
          totalSettlements: stats.settled,
        },
        createdAt: formatSqliteDate(f.created_at),
        updatedAt: formatSqliteDate(f.updated_at),
      };
    });

    res.json(facilitatorsWithStatus);
  } catch (error) {
    console.error('List facilitators error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/admin/facilitators/:id - Get a specific facilitator
 */
router.get('/facilitators/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const facilitator = getFacilitatorById(req.params.id);
    if (!facilitator) {
      res.status(404).json({ error: 'Facilitator not found' });
      return;
    }

    res.json({
      id: facilitator.id,
      name: facilitator.name,
      subdomain: facilitator.subdomain,
      customDomain: facilitator.custom_domain,
      additionalDomains: JSON.parse(facilitator.additional_domains || '[]'),
      ownerAddress: facilitator.owner_address,
      supportedChains: JSON.parse(facilitator.supported_chains),
      supportedTokens: JSON.parse(facilitator.supported_tokens),
      url: facilitator.custom_domain
        ? `https://${facilitator.custom_domain}`
        : `https://${facilitator.subdomain}.openfacilitator.io`,
      favicon: facilitator.favicon || null,
      createdAt: formatSqliteDate(facilitator.created_at),
      updatedAt: formatSqliteDate(facilitator.updated_at),
    });
  } catch (error) {
    console.error('Get facilitator error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * PATCH /api/admin/facilitators/:id - Update a facilitator
 */
router.patch('/facilitators/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const parsed = updateFacilitatorSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: 'Invalid request',
        details: parsed.error.issues,
      });
      return;
    }

    const updates: Record<string, string> = {};
    if (parsed.data.name) updates.name = parsed.data.name;
    if (parsed.data.customDomain !== undefined) {
      updates.custom_domain = parsed.data.customDomain || '';
    }
    if (parsed.data.additionalDomains !== undefined) {
      updates.additional_domains = JSON.stringify(parsed.data.additionalDomains);
    }
    if (parsed.data.supportedChains) {
      updates.supported_chains = JSON.stringify(parsed.data.supportedChains);
    }
    if (parsed.data.supportedTokens) {
      updates.supported_tokens = JSON.stringify(parsed.data.supportedTokens);
    }
    // Handle webhook URL updates
    if (parsed.data.webhookUrl !== undefined) {
      const existingFacilitator = getFacilitatorById(req.params.id);
      if (parsed.data.webhookUrl) {
        updates.webhook_url = parsed.data.webhookUrl;
        // Auto-generate secret if setting URL for the first time
        if (!existingFacilitator?.webhook_secret) {
          updates.webhook_secret = generateWebhookSecret();
        }
      } else {
        // Clear webhook when URL is set to null/empty
        updates.webhook_url = '';
        updates.webhook_secret = '';
      }
    }

    const facilitator = updateFacilitator(req.params.id, updates);
    if (!facilitator) {
      res.status(404).json({ error: 'Facilitator not found' });
      return;
    }

    res.json({
      id: facilitator.id,
      name: facilitator.name,
      subdomain: facilitator.subdomain,
      customDomain: facilitator.custom_domain,
      additionalDomains: JSON.parse(facilitator.additional_domains || '[]'),
      ownerAddress: facilitator.owner_address,
      supportedChains: JSON.parse(facilitator.supported_chains),
      supportedTokens: JSON.parse(facilitator.supported_tokens),
      url: facilitator.custom_domain
        ? `https://${facilitator.custom_domain}`
        : `https://${facilitator.subdomain}.openfacilitator.io`,
      createdAt: formatSqliteDate(facilitator.created_at),
      updatedAt: formatSqliteDate(facilitator.updated_at),
    });
  } catch (error) {
    console.error('Update facilitator error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * DELETE /api/admin/facilitators/:id - Delete a facilitator
 */
router.delete('/facilitators/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    // Get facilitator first to know the subdomain for Railway cleanup
    const facilitator = getFacilitatorById(req.params.id);
    if (!facilitator) {
      res.status(404).json({ error: 'Facilitator not found' });
      return;
    }

    const deleted = deleteFacilitator(req.params.id);
    if (!deleted) {
      res.status(404).json({ error: 'Facilitator not found' });
      return;
    }

    // Remove subdomain from Railway
    if (isRailwayConfigured()) {
      const subdomainFull = `${facilitator.subdomain}.openfacilitator.io`;
      console.log(`Removing subdomain from Railway: ${subdomainFull}`);
      const result = await removeCustomDomain(subdomainFull);
      if (result.success) {
        console.log(`Successfully removed ${subdomainFull} from Railway`);
      } else {
        // Log but don't fail the delete - the facilitator is already deleted
        console.error(`Failed to remove ${subdomainFull} from Railway:`, result.error);
      }
    }

    res.status(204).send();
  } catch (error) {
    console.error('Delete facilitator error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/admin/facilitators/:id/transactions - Get transaction history
 */
router.get('/facilitators/:id/transactions', requireAuth, async (req: Request, res: Response) => {
  try {
    const facilitator = getFacilitatorById(req.params.id);
    if (!facilitator) {
      res.status(404).json({ error: 'Facilitator not found' });
      return;
    }

    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;

    const transactions = getTransactionsByFacilitator(req.params.id, limit, offset);
    const stats = getTransactionStats(req.params.id);

    res.json({
      transactions: transactions.map((t) => ({
        id: t.id,
        type: t.type,
        network: t.network,
        fromAddress: t.from_address,
        toAddress: t.to_address,
        amount: t.amount,
        asset: t.asset,
        transactionHash: t.transaction_hash,
        status: t.status,
        errorMessage: t.error_message,
        createdAt: formatSqliteDate(t.created_at),
      })),
      stats: {
        totalVerifications: stats.verified,
        totalSettlements: stats.settled,
        totalFailed: stats.failed,
        total: stats.total,
        totalAmountSettled: stats.totalAmountSettled,
      },
      pagination: {
        limit,
        offset,
      },
    });
  } catch (error) {
    console.error('Get transactions error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/admin/facilitators/:id/chart-data - Get daily aggregated stats for charts
 */
router.get('/facilitators/:id/chart-data', requireAuth, async (req: Request, res: Response) => {
  try {
    const facilitator = getFacilitatorById(req.params.id);
    if (!facilitator) {
      res.status(404).json({ error: 'Facilitator not found' });
      return;
    }

    const days = parseInt(req.query.days as string) || 30;
    const dailyStats = getDailyStats(req.params.id, days);

    res.json({
      days,
      data: dailyStats,
    });
  } catch (error) {
    console.error('Get chart data error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/admin/facilitators/:id/wallet - Generate a new wallet for the facilitator
 */
router.post('/facilitators/:id/wallet', requireAuth, async (req: Request, res: Response) => {
  try {
    const facilitator = getFacilitatorById(req.params.id);
    if (!facilitator) {
      res.status(404).json({ error: 'Facilitator not found' });
      return;
    }

    // Check if wallet already exists
    if (facilitator.encrypted_private_key) {
      res.status(409).json({ error: 'Wallet already exists. Delete it first to generate a new one.' });
      return;
    }

    // Generate new wallet
    const wallet = generateWallet();
    
    // Get the address from the private key
    const address = getWalletAddress(wallet.privateKey as Hex);
    
    // Encrypt and store
    const encryptedKey = encryptPrivateKey(wallet.privateKey);
    const updated = updateFacilitator(req.params.id, { encrypted_private_key: encryptedKey });
    
    if (!updated) {
      res.status(500).json({ error: 'Failed to save wallet' });
      return;
    }

    res.status(201).json({
      success: true,
      address,
      message: 'Wallet generated. Fund this address with ETH for gas fees.',
    });
  } catch (error) {
    console.error('Generate wallet error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/admin/facilitators/:id/wallet/import - Import an existing private key
 */
router.post('/facilitators/:id/wallet/import', requireAuth, async (req: Request, res: Response) => {
  try {
    const facilitator = getFacilitatorById(req.params.id);
    if (!facilitator) {
      res.status(404).json({ error: 'Facilitator not found' });
      return;
    }

    const { privateKey } = req.body;
    if (!privateKey || typeof privateKey !== 'string') {
      res.status(400).json({ error: 'Private key is required' });
      return;
    }

    // Validate private key format
    if (!/^0x[a-fA-F0-9]{64}$/.test(privateKey)) {
      res.status(400).json({ error: 'Invalid private key format. Must be 0x-prefixed 64 hex characters.' });
      return;
    }

    // Get address from private key
    const address = getWalletAddress(privateKey as Hex);
    
    // Encrypt and store
    const encryptedKey = encryptPrivateKey(privateKey);
    const updated = updateFacilitator(req.params.id, { encrypted_private_key: encryptedKey });
    
    if (!updated) {
      res.status(500).json({ error: 'Failed to save wallet' });
      return;
    }

    res.status(201).json({
      success: true,
      address,
      message: 'Wallet imported successfully.',
    });
  } catch (error) {
    console.error('Import wallet error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/admin/facilitators/:id/wallet - Get wallet info (address, balances)
 */
router.get('/facilitators/:id/wallet', requireAuth, async (req: Request, res: Response) => {
  try {
    const facilitator = getFacilitatorById(req.params.id);
    if (!facilitator) {
      res.status(404).json({ error: 'Facilitator not found' });
      return;
    }

    if (!facilitator.encrypted_private_key) {
      res.json({
        hasWallet: false,
        address: null,
        balances: {},
      });
      return;
    }

    // Decrypt private key to get address
    const privateKey = decryptPrivateKey(facilitator.encrypted_private_key);
    const address = getWalletAddress(privateKey as Hex);

    // Get balances for supported EVM chains
    const balances: Record<string, { balance: string; formatted: string }> = {};
    const supportedChains = JSON.parse(facilitator.supported_chains) as (number | string)[];
    
    for (const chainId of supportedChains) {
      // Only get balances for EVM chains (number chainIds)
      if (typeof chainId === 'number') {
        try {
          const result = await getWalletBalance(chainId, address);
          balances[String(chainId)] = {
            balance: result.balance.toString(),
            formatted: result.formatted,
          };
        } catch (e) {
          // Skip chains that fail to fetch balance
          console.error(`Failed to get balance for chain ${chainId}:`, e);
        }
      }
    }

    res.json({
      hasWallet: true,
      address,
      balances,
    });
  } catch (error) {
    console.error('Get wallet error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * DELETE /api/admin/facilitators/:id/wallet - Remove EVM wallet
 */
router.delete('/facilitators/:id/wallet', requireAuth, async (req: Request, res: Response) => {
  try {
    const facilitator = getFacilitatorById(req.params.id);
    if (!facilitator) {
      res.status(404).json({ error: 'Facilitator not found' });
      return;
    }

    if (!facilitator.encrypted_private_key) {
      res.status(404).json({ error: 'No EVM wallet configured' });
      return;
    }

    // Remove wallet
    const updated = updateFacilitator(req.params.id, { encrypted_private_key: '' });
    
    if (!updated) {
      res.status(500).json({ error: 'Failed to remove wallet' });
      return;
    }

    res.json({ success: true, message: 'Wallet removed' });
  } catch (error) {
    console.error('Delete wallet error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ============= SOLANA WALLET ENDPOINTS =============

/**
 * POST /api/admin/facilitators/:id/wallet/solana - Generate a new Solana wallet
 */
router.post('/facilitators/:id/wallet/solana', requireAuth, async (req: Request, res: Response) => {
  try {
    const facilitator = getFacilitatorById(req.params.id);
    if (!facilitator) {
      res.status(404).json({ error: 'Facilitator not found' });
      return;
    }

    // Check if Solana wallet already exists
    if (facilitator.encrypted_solana_private_key) {
      res.status(409).json({ error: 'Solana wallet already exists. Delete it first to generate a new one.' });
      return;
    }

    // Generate new Solana wallet
    const wallet = generateSolanaKeypair();
    
    // Encrypt and store
    const encryptedKey = encryptPrivateKey(wallet.privateKey);
    const updated = updateFacilitator(req.params.id, { encrypted_solana_private_key: encryptedKey });
    
    if (!updated) {
      res.status(500).json({ error: 'Failed to save Solana wallet' });
      return;
    }

    res.status(201).json({
      success: true,
      address: wallet.publicKey,
      message: 'Solana wallet generated. Fund this address with SOL for transaction fees.',
    });
  } catch (error) {
    console.error('Generate Solana wallet error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/admin/facilitators/:id/wallet/solana/import - Import an existing Solana private key
 */
router.post('/facilitators/:id/wallet/solana/import', requireAuth, async (req: Request, res: Response) => {
  try {
    const facilitator = getFacilitatorById(req.params.id);
    if (!facilitator) {
      res.status(404).json({ error: 'Facilitator not found' });
      return;
    }

    const { privateKey } = req.body;
    if (!privateKey || typeof privateKey !== 'string') {
      res.status(400).json({ error: 'Private key is required' });
      return;
    }

    // Validate Solana private key format (base58, 64 bytes when decoded)
    if (!isValidSolanaPrivateKey(privateKey)) {
      res.status(400).json({ error: 'Invalid Solana private key format. Must be base58-encoded 64-byte key.' });
      return;
    }

    // Get public key from private key
    const address = getSolanaPublicKey(privateKey);
    
    // Encrypt and store
    const encryptedKey = encryptPrivateKey(privateKey);
    const updated = updateFacilitator(req.params.id, { encrypted_solana_private_key: encryptedKey });
    
    if (!updated) {
      res.status(500).json({ error: 'Failed to save Solana wallet' });
      return;
    }

    res.status(201).json({
      success: true,
      address,
      message: 'Solana wallet imported successfully.',
    });
  } catch (error) {
    console.error('Import Solana wallet error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/admin/facilitators/:id/wallet/solana - Get Solana wallet info
 */
router.get('/facilitators/:id/wallet/solana', requireAuth, async (req: Request, res: Response) => {
  try {
    const facilitator = getFacilitatorById(req.params.id);
    if (!facilitator) {
      res.status(404).json({ error: 'Facilitator not found' });
      return;
    }

    if (!facilitator.encrypted_solana_private_key) {
      res.json({
        hasWallet: false,
        address: null,
        balance: null,
      });
      return;
    }

    // Decrypt private key to get address
    const privateKey = decryptPrivateKey(facilitator.encrypted_solana_private_key);
    const address = getSolanaPublicKey(privateKey);

    // Get SOL balance
    let balance = null;
    try {
      const result = await getSolanaBalance('solana', address);
      balance = {
        sol: result.formatted,
        lamports: result.balance.toString(),
      };
    } catch (e) {
      console.error('Failed to get Solana balance:', e);
    }

    res.json({
      hasWallet: true,
      address,
      balance,
    });
  } catch (error) {
    console.error('Get Solana wallet error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * DELETE /api/admin/facilitators/:id/wallet/solana - Remove Solana wallet
 */
router.delete('/facilitators/:id/wallet/solana', requireAuth, async (req: Request, res: Response) => {
  try {
    const facilitator = getFacilitatorById(req.params.id);
    if (!facilitator) {
      res.status(404).json({ error: 'Facilitator not found' });
      return;
    }

    if (!facilitator.encrypted_solana_private_key) {
      res.status(404).json({ error: 'No Solana wallet configured' });
      return;
    }

    // Remove wallet
    const updated = updateFacilitator(req.params.id, { encrypted_solana_private_key: '' });
    
    if (!updated) {
      res.status(500).json({ error: 'Failed to remove Solana wallet' });
      return;
    }

    res.json({ success: true, message: 'Solana wallet removed' });
  } catch (error) {
    console.error('Delete Solana wallet error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ============= STACKS WALLET ENDPOINTS =============

/**
 * POST /api/admin/facilitators/:id/wallet/stacks - Generate a new Stacks wallet
 */
router.post('/facilitators/:id/wallet/stacks', requireAuth, async (req: Request, res: Response) => {
  try {
    const facilitator = getFacilitatorById(req.params.id);
    if (!facilitator) {
      res.status(404).json({ error: 'Facilitator not found' });
      return;
    }

    // Check if Stacks wallet already exists
    if (facilitator.encrypted_stacks_private_key) {
      res.status(409).json({ error: 'Stacks wallet already exists. Delete it first to generate a new one.' });
      return;
    }

    // Generate new Stacks wallet
    const privateKey = crypto.randomBytes(32).toString('hex');
    const address = getAddressFromPrivateKey(privateKey, 'mainnet');
    const encryptedKey = encryptPrivateKey(privateKey);

    const updated = updateFacilitator(req.params.id, { encrypted_stacks_private_key: encryptedKey });

    if (!updated) {
      res.status(500).json({ error: 'Failed to save Stacks wallet' });
      return;
    }

    res.status(201).json({
      success: true,
      address,
      message: 'Stacks wallet generated. Fund this address with STX for transaction fees.',
    });
  } catch (error) {
    console.error('Generate Stacks wallet error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/admin/facilitators/:id/wallet/stacks/import - Import an existing Stacks private key
 */
router.post('/facilitators/:id/wallet/stacks/import', requireAuth, async (req: Request, res: Response) => {
  try {
    const facilitator = getFacilitatorById(req.params.id);
    if (!facilitator) {
      res.status(404).json({ error: 'Facilitator not found' });
      return;
    }

    const { privateKey } = req.body;
    if (!privateKey || typeof privateKey !== 'string') {
      res.status(400).json({ error: 'Private key is required' });
      return;
    }

    // Validate private key format (64 or 66 hex chars, with optional 0x prefix)
    const clean = privateKey.startsWith('0x') ? privateKey.slice(2) : privateKey;
    if (!/^[a-fA-F0-9]{64,66}$/.test(clean)) {
      res.status(400).json({ error: 'Invalid Stacks private key format (expected 64-66 hex characters)' });
      return;
    }

    // Derive Stacks address and encrypt
    const address = getAddressFromPrivateKey(clean, 'mainnet');
    const encryptedKey = encryptPrivateKey(clean);

    const updated = updateFacilitator(req.params.id, { encrypted_stacks_private_key: encryptedKey });

    if (!updated) {
      res.status(500).json({ error: 'Failed to save Stacks wallet' });
      return;
    }

    res.status(201).json({
      success: true,
      address,
      message: 'Stacks wallet imported successfully.',
    });
  } catch (error) {
    console.error('Import Stacks wallet error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/admin/facilitators/:id/wallet/stacks - Get Stacks wallet info
 */
router.get('/facilitators/:id/wallet/stacks', requireAuth, async (req: Request, res: Response) => {
  try {
    const facilitator = getFacilitatorById(req.params.id);
    if (!facilitator) {
      res.status(404).json({ error: 'Facilitator not found' });
      return;
    }

    if (!facilitator.encrypted_stacks_private_key) {
      res.json({ hasWallet: false, address: null, balance: null });
      return;
    }

    // Decrypt to get address
    const privateKey = decryptPrivateKey(facilitator.encrypted_stacks_private_key);
    const address = getAddressFromPrivateKey(privateKey, 'mainnet');

    // Get balance
    let balance: { stx: string; microStx: string } | null = null;
    try {
      const balanceInfo = await getStacksSTXBalance(address);
      balance = { stx: balanceInfo.formatted, microStx: balanceInfo.balance.toString() };
    } catch {
      // Balance check may fail if node is unreachable
    }

    res.json({
      hasWallet: true,
      address,
      balance,
    });
  } catch (error) {
    console.error('Get Stacks wallet error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * DELETE /api/admin/facilitators/:id/wallet/stacks - Remove Stacks wallet
 */
router.delete('/facilitators/:id/wallet/stacks', requireAuth, async (req: Request, res: Response) => {
  try {
    const facilitator = getFacilitatorById(req.params.id);
    if (!facilitator) {
      res.status(404).json({ error: 'Facilitator not found' });
      return;
    }

    if (!facilitator.encrypted_stacks_private_key) {
      res.status(404).json({ error: 'No Stacks wallet configured' });
      return;
    }

    // Remove the Stacks wallet
    const updated = updateFacilitator(req.params.id, { encrypted_stacks_private_key: '' });

    if (!updated) {
      res.status(500).json({ error: 'Failed to remove Stacks wallet' });
      return;
    }

    res.json({ success: true, message: 'Stacks wallet removed' });
  } catch (error) {
    console.error('Delete Stacks wallet error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/admin/facilitators/:id/export - Generate self-host config
 */
router.post('/facilitators/:id/export', requireAuth, async (req: Request, res: Response) => {
  try {
    const facilitator = getFacilitatorById(req.params.id);
    if (!facilitator) {
      res.status(404).json({ error: 'Facilitator not found' });
      return;
    }

    // Generate Docker Compose configuration for self-hosting
    const dockerCompose = `version: '3.8'

services:
  openfacilitator:
    image: ghcr.io/rawgroundbeef/openfacilitator:latest
    ports:
      - "3001:3001"
    environment:
      - NODE_ENV=production
      - FACILITATOR_NAME=${facilitator.name}
      - FACILITATOR_SUBDOMAIN=${facilitator.subdomain}
      - OWNER_ADDRESS=${facilitator.owner_address}
      - SUPPORTED_CHAINS=${facilitator.supported_chains}
      - DATABASE_PATH=/data/openfacilitator.db
    volumes:
      - openfacilitator-data:/data
    restart: unless-stopped

volumes:
  openfacilitator-data:
`;

    const envFile = `# OpenFacilitator Configuration
NODE_ENV=production
PORT=3001
HOST=0.0.0.0

# Facilitator Settings
FACILITATOR_NAME="${facilitator.name}"
FACILITATOR_SUBDOMAIN="${facilitator.subdomain}"
OWNER_ADDRESS="${facilitator.owner_address}"
SUPPORTED_CHAINS='${facilitator.supported_chains}'
SUPPORTED_TOKENS='${facilitator.supported_tokens}'

# Database
DATABASE_PATH=./data/openfacilitator.db

# Optional: Custom RPC endpoints
# BASE_RPC_URL=https://mainnet.base.org
# BASE_SEPOLIA_RPC_URL=https://sepolia.base.org
`;

    res.json({
      dockerCompose,
      envFile,
      instructions: `
# Self-hosting Instructions

1. Save the docker-compose.yml file
2. Save the .env file in the same directory
3. Run: docker compose up -d
4. Your facilitator will be available at http://localhost:3001

For production:
- Set up a reverse proxy (nginx, caddy) with SSL
- Point your domain to the server
- Update the HOST environment variable
      `.trim(),
    });
  } catch (error) {
    console.error('Export facilitator error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/admin/facilitators/:id/domain - Setup custom domain via Railway
 */
router.post('/facilitators/:id/domain', requireAuth, async (req: Request, res: Response) => {
  try {
    const facilitator = getFacilitatorById(req.params.id);
    if (!facilitator) {
      res.status(404).json({ error: 'Facilitator not found' });
      return;
    }

    if (!facilitator.custom_domain) {
      res.status(400).json({ error: 'No custom domain configured for this facilitator' });
      return;
    }

    if (!isRailwayConfigured()) {
      // Return manual setup instructions when Railway API is not configured
      res.json({
        success: true,
        domain: facilitator.custom_domain,
        status: 'manual_setup',
        message: 'Please add this domain manually in Railway: Settings → Networking → Custom Domains. Railway will provide the DNS target value.',
      });
      return;
    }

    const result = await addCustomDomain(facilitator.custom_domain);
    
    if (!result.success) {
      // If Railway API fails, return manual instructions
      console.error('Railway API failed:', result.error);
      res.json({
        success: false,
        domain: facilitator.custom_domain,
        status: 'error',
        message: `Railway API error: ${result.error}. Please try again or add domain manually in Railway Dashboard.`,
      });
      return;
    }

    res.json({
      success: true,
      domain: result.domain,
      status: result.status,
      message: 'Domain added to Railway. Configure your DNS records.',
      dnsRecords: result.dnsRecords,
    });
  } catch (error) {
    console.error('Setup domain error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to setup domain. Please try again.',
    });
  }
});

/**
 * DELETE /api/admin/facilitators/:id/domain - Remove custom domain from Railway
 */
router.delete('/facilitators/:id/domain', requireAuth, async (req: Request, res: Response) => {
  try {
    const facilitator = getFacilitatorById(req.params.id);
    if (!facilitator) {
      res.status(404).json({ error: 'Facilitator not found' });
      return;
    }

    if (!facilitator.custom_domain) {
      res.status(400).json({ error: 'No custom domain configured for this facilitator' });
      return;
    }

    if (!isRailwayConfigured()) {
      res.status(503).json({ error: 'Railway integration not configured' });
      return;
    }

    const result = await removeCustomDomain(facilitator.custom_domain);
    
    if (!result.success) {
      res.status(400).json({ error: result.error });
      return;
    }

    res.json({ success: true, message: 'Domain removed from Railway' });
  } catch (error) {
    console.error('Remove domain error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/admin/facilitators/:id/subdomain/status - Check subdomain DNS status
 */
router.get('/facilitators/:id/subdomain/status', requireAuth, async (req: Request, res: Response) => {
  try {
    const facilitator = getFacilitatorById(req.params.id);
    if (!facilitator) {
      res.status(404).json({ error: 'Facilitator not found' });
      return;
    }

    const subdomainFull = `${facilitator.subdomain}.openfacilitator.io`;

    if (!isRailwayConfigured()) {
      // Railway not configured - subdomains won't work without it
      res.json({
        domain: subdomainFull,
        status: 'unconfigured',
        railwayConfigured: false,
        message: 'Railway integration not configured. Subdomain routing is not available.',
      });
      return;
    }

    const status = await getDomainStatus(subdomainFull);
    
    if (!status) {
      // Domain not added to Railway yet
      res.json({
        domain: subdomainFull,
        status: 'not_added',
        railwayConfigured: true,
        message: 'Subdomain not yet registered with Railway. This happens automatically when the facilitator is created.',
      });
      return;
    }

    res.json({
      domain: subdomainFull,
      status: status.status,
      railwayConfigured: true,
      dnsRecords: status.dnsRecords,
      message: status.status === 'active' 
        ? 'Subdomain is active and ready to use!'
        : 'DNS propagation in progress. This is managed by the platform administrator.',
    });
  } catch (error) {
    console.error('Get subdomain status error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/admin/facilitators/:id/domain/status - Check domain DNS status
 */
router.get('/facilitators/:id/domain/status', requireAuth, async (req: Request, res: Response) => {
  try {
    const facilitator = getFacilitatorById(req.params.id);
    if (!facilitator) {
      res.status(404).json({ error: 'Facilitator not found' });
      return;
    }

    if (!facilitator.custom_domain) {
      res.status(400).json({ error: 'No custom domain configured for this facilitator' });
      return;
    }

    if (!isRailwayConfigured()) {
      // Return basic status without Railway integration
      res.json({
        domain: facilitator.custom_domain,
        status: 'unconfigured',
        railwayConfigured: false,
        message: 'Railway integration not configured. Please contact support.',
      });
      return;
    }

    const status = await getDomainStatus(facilitator.custom_domain);
    
    if (!status) {
      res.json({
        domain: facilitator.custom_domain,
        status: 'not_added',
        railwayConfigured: true,
        message: 'Domain not yet added to Railway. Click "Setup Domain" to add it.',
      });
      return;
    }

    res.json({
      ...status,
      railwayConfigured: true,
    });
  } catch (error) {
    console.error('Get domain status error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/admin/facilitators/:id/raw
 * Get raw facilitator data (temporary admin endpoint)
 * TODO: Remove after debugging
 */
router.get('/facilitators/:id/raw', (req: Request, res: Response) => {
  try {
    const facilitator = getFacilitatorById(req.params.id);
    if (!facilitator) {
      res.status(404).json({ error: 'Facilitator not found' });
      return;
    }
    // Return raw data without transforming
    res.json({
      id: facilitator.id,
      name: facilitator.name,
      subdomain: facilitator.subdomain,
      custom_domain: facilitator.custom_domain,
      additional_domains: facilitator.additional_domains,
      owner_address: facilitator.owner_address,
      supported_chains: facilitator.supported_chains,
      created_at: facilitator.created_at,
      updated_at: facilitator.updated_at,
    });
  } catch (error) {
    console.error('Get raw facilitator error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * PATCH /api/admin/facilitators/:id/domains
 * Update domains directly (temporary admin endpoint)
 * TODO: Remove after debugging
 */
router.patch('/facilitators/:id/domains', (req: Request, res: Response) => {
  try {
    const { custom_domain, additional_domains } = req.body;

    const updates: Record<string, string> = {};
    if (custom_domain !== undefined) {
      updates.custom_domain = custom_domain || '';
    }
    if (additional_domains !== undefined) {
      updates.additional_domains = JSON.stringify(additional_domains);
    }

    const facilitator = updateFacilitator(req.params.id, updates);
    if (!facilitator) {
      res.status(404).json({ error: 'Facilitator not found' });
      return;
    }

    res.json({
      success: true,
      custom_domain: facilitator.custom_domain,
      additional_domains: facilitator.additional_domains,
    });
  } catch (error) {
    console.error('Update domains error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * DELETE /api/admin/subscriptions/clear
 * Clear all subscriptions (temporary admin endpoint)
 * TODO: Remove this after testing
 */
router.delete('/subscriptions/clear', requireAuth, (req: Request, res: Response) => {
  try {
    const db = getDatabase();
    const result = db.prepare('DELETE FROM subscriptions').run();
    console.log(`[Admin] Cleared ${result.changes} subscriptions`);
    res.json({
      success: true,
      message: `Cleared ${result.changes} subscriptions`
    });
  } catch (error) {
    console.error('Clear subscriptions error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/admin/facilitators/:id/favicon - Upload favicon
 * Expects base64-encoded image data in request body
 */
router.post('/facilitators/:id/favicon', requireAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { favicon } = req.body;

    if (!favicon) {
      res.status(400).json({ error: 'No favicon data provided' });
      return;
    }

    // Validate it's a valid base64 data URL or raw base64
    const isDataUrl = favicon.startsWith('data:image/');
    const isBase64 = /^[A-Za-z0-9+/=]+$/.test(favicon.replace(/^data:image\/[a-z]+;base64,/, ''));
    
    if (!isDataUrl && !isBase64) {
      res.status(400).json({ error: 'Invalid favicon format. Expected base64-encoded image.' });
      return;
    }

    // Check size (max 100KB for base64)
    const base64Data = favicon.replace(/^data:image\/[a-z]+;base64,/, '');
    const sizeInBytes = (base64Data.length * 3) / 4;
    if (sizeInBytes > 100 * 1024) {
      res.status(400).json({ error: 'Favicon too large. Maximum size is 100KB.' });
      return;
    }

    const facilitator = getFacilitatorById(id);
    if (!facilitator) {
      res.status(404).json({ error: 'Facilitator not found' });
      return;
    }

    // Update facilitator with favicon
    const updated = updateFacilitator(id, { favicon });
    if (!updated) {
      res.status(500).json({ error: 'Failed to update favicon' });
      return;
    }

    res.json({ success: true, message: 'Favicon uploaded successfully' });
  } catch (error) {
    console.error('Upload favicon error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * DELETE /api/admin/facilitators/:id/favicon - Remove favicon
 */
router.delete('/facilitators/:id/favicon', requireAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const facilitator = getFacilitatorById(id);
    if (!facilitator) {
      res.status(404).json({ error: 'Facilitator not found' });
      return;
    }

    // Clear favicon
    const updated = updateFacilitator(id, { favicon: null });
    if (!updated) {
      res.status(500).json({ error: 'Failed to remove favicon' });
      return;
    }

    res.json({ success: true, message: 'Favicon removed' });
  } catch (error) {
    console.error('Remove favicon error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/admin/facilitators/:id/favicon - Get facilitator's favicon
 */
router.get('/facilitators/:id/favicon', requireAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const facilitator = getFacilitatorById(id);
    if (!facilitator) {
      res.status(404).json({ error: 'Facilitator not found' });
      return;
    }

    res.json({
      hasFavicon: !!facilitator.favicon,
      favicon: facilitator.favicon || null,
    });
  } catch (error) {
    console.error('Get favicon error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ============= WEBHOOK ENDPOINTS =============

/**
 * GET /api/admin/facilitators/:id/webhook - Get webhook configuration
 * Returns URL and whether a secret exists (but not the secret itself for security)
 */
router.get('/facilitators/:id/webhook', requireAuth, async (req: Request, res: Response) => {
  try {
    const facilitator = getFacilitatorById(req.params.id);
    if (!facilitator) {
      res.status(404).json({ error: 'Facilitator not found' });
      return;
    }

    res.json({
      webhookUrl: facilitator.webhook_url || null,
      hasSecret: !!facilitator.webhook_secret,
      // Only return secret on initial setup or regeneration
    });
  } catch (error) {
    console.error('Get webhook error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * PUT /api/admin/facilitators/:id/webhook - Set webhook URL (generates secret if needed)
 */
router.put('/facilitators/:id/webhook', requireAuth, async (req: Request, res: Response) => {
  try {
    const { url } = req.body;

    if (url && typeof url !== 'string') {
      res.status(400).json({ error: 'Invalid URL' });
      return;
    }

    // Validate URL format if provided
    if (url) {
      try {
        new URL(url);
      } catch {
        res.status(400).json({ error: 'Invalid URL format' });
        return;
      }
    }

    const facilitator = getFacilitatorById(req.params.id);
    if (!facilitator) {
      res.status(404).json({ error: 'Facilitator not found' });
      return;
    }

    const updates: Record<string, string> = {};
    let newSecret: string | null = null;

    if (url) {
      updates.webhook_url = url;
      // Generate secret if setting URL for the first time
      if (!facilitator.webhook_secret) {
        newSecret = generateWebhookSecret();
        updates.webhook_secret = newSecret;
      }
    } else {
      // Clear webhook
      updates.webhook_url = '';
      updates.webhook_secret = '';
    }

    const updated = updateFacilitator(req.params.id, updates);
    if (!updated) {
      res.status(500).json({ error: 'Failed to update webhook' });
      return;
    }

    res.json({
      success: true,
      webhookUrl: url || null,
      // Only return secret when newly generated
      webhookSecret: newSecret,
      message: newSecret
        ? 'Webhook configured. Save your secret - it won\'t be shown again.'
        : url ? 'Webhook URL updated.' : 'Webhook removed.',
    });
  } catch (error) {
    console.error('Update webhook error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/admin/facilitators/:id/webhook/regenerate - Regenerate webhook secret
 */
router.post('/facilitators/:id/webhook/regenerate', requireAuth, async (req: Request, res: Response) => {
  try {
    const facilitator = getFacilitatorById(req.params.id);
    if (!facilitator) {
      res.status(404).json({ error: 'Facilitator not found' });
      return;
    }

    if (!facilitator.webhook_url) {
      res.status(400).json({ error: 'No webhook URL configured' });
      return;
    }

    const newSecret = generateWebhookSecret();
    const updated = updateFacilitator(req.params.id, { webhook_secret: newSecret });

    if (!updated) {
      res.status(500).json({ error: 'Failed to regenerate secret' });
      return;
    }

    res.json({
      success: true,
      webhookSecret: newSecret,
      message: 'Secret regenerated. Update your webhook handler with the new secret.',
    });
  } catch (error) {
    console.error('Regenerate webhook secret error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/admin/facilitators/:id/webhook/test - Send a test webhook
 */
router.post('/facilitators/:id/webhook/test', requireAuth, async (req: Request, res: Response) => {
  try {
    const facilitator = getFacilitatorById(req.params.id);
    if (!facilitator) {
      res.status(404).json({ error: 'Facilitator not found' });
      return;
    }

    if (!facilitator.webhook_url || !facilitator.webhook_secret) {
      res.status(400).json({ error: 'Webhook not configured' });
      return;
    }

    const testPayload = {
      event: 'payment.settled' as const,
      facilitatorId: facilitator.id,
      timestamp: new Date().toISOString(),
      transaction: {
        id: 'test_' + Date.now(),
        fromAddress: '0x0000000000000000000000000000000000000000',
        toAddress: facilitator.owner_address,
        amount: '1000000',
        asset: '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913', // USDC on Base
        network: 'base',
        transactionHash: '0x' + '0'.repeat(64),
        settledAt: new Date().toISOString(),
      },
    };

    const result = await deliverWebhook(
      facilitator.webhook_url,
      facilitator.webhook_secret,
      testPayload,
      1 // Only 1 attempt for test
    );

    if (result.success) {
      res.json({
        success: true,
        message: 'Test webhook delivered successfully',
        statusCode: result.statusCode,
      });
    } else {
      res.json({
        success: false,
        message: 'Test webhook delivery failed',
        error: result.error,
        statusCode: result.statusCode,
      });
    }
  } catch (error) {
    console.error('Test webhook error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ============= FIRST-CLASS WEBHOOKS ENDPOINTS =============

const createWebhookSchema = z.object({
  name: z.string().min(1).max(100),
  url: z.string().url().max(2048),
  events: z.array(z.string()).optional(),
  actionType: z.string().max(50).optional().nullable(),
});

const updateWebhookSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  url: z.string().url().max(2048).optional(),
  events: z.array(z.string()).optional(),
  actionType: z.string().max(50).optional().nullable(),
  active: z.boolean().optional(),
});

/**
 * GET /api/admin/facilitators/:id/webhooks - List all webhooks for a facilitator
 */
router.get('/facilitators/:id/webhooks', requireAuth, async (req: Request, res: Response) => {
  try {
    const facilitator = getFacilitatorById(req.params.id);
    if (!facilitator) {
      res.status(404).json({ error: 'Facilitator not found' });
      return;
    }

    const webhooks = getWebhooksByFacilitator(req.params.id);

    res.json({
      webhooks: webhooks.map((w) => ({
        id: w.id,
        name: w.name,
        url: w.url,
        events: JSON.parse(w.events),
        actionType: w.action_type,
        active: w.active === 1,
        createdAt: formatSqliteDate(w.created_at),
        updatedAt: formatSqliteDate(w.updated_at),
      })),
    });
  } catch (error) {
    console.error('List webhooks error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/admin/facilitators/:id/webhooks - Create a new webhook
 */
router.post('/facilitators/:id/webhooks', requireAuth, async (req: Request, res: Response) => {
  try {
    const parsed = createWebhookSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: 'Invalid request',
        details: parsed.error.issues,
      });
      return;
    }

    const facilitator = getFacilitatorById(req.params.id);
    if (!facilitator) {
      res.status(404).json({ error: 'Facilitator not found' });
      return;
    }

    const webhook = createWebhook({
      facilitator_id: req.params.id,
      name: parsed.data.name,
      url: parsed.data.url,
      events: parsed.data.events,
      action_type: parsed.data.actionType,
    });

    res.status(201).json({
      id: webhook.id,
      name: webhook.name,
      url: webhook.url,
      secret: webhook.secret, // Only shown on creation
      events: JSON.parse(webhook.events),
      actionType: webhook.action_type,
      active: webhook.active === 1,
      createdAt: formatSqliteDate(webhook.created_at),
      message: 'Webhook created. Save your secret - it won\'t be shown again.',
    });
  } catch (error) {
    console.error('Create webhook error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/admin/facilitators/:id/webhooks/:webhookId - Get a specific webhook
 */
router.get('/facilitators/:id/webhooks/:webhookId', requireAuth, async (req: Request, res: Response) => {
  try {
    const facilitator = getFacilitatorById(req.params.id);
    if (!facilitator) {
      res.status(404).json({ error: 'Facilitator not found' });
      return;
    }

    const webhook = getWebhookById(req.params.webhookId);
    if (!webhook || webhook.facilitator_id !== req.params.id) {
      res.status(404).json({ error: 'Webhook not found' });
      return;
    }

    res.json({
      id: webhook.id,
      name: webhook.name,
      url: webhook.url,
      hasSecret: !!webhook.secret,
      events: JSON.parse(webhook.events),
      actionType: webhook.action_type,
      active: webhook.active === 1,
      createdAt: formatSqliteDate(webhook.created_at),
      updatedAt: formatSqliteDate(webhook.updated_at),
    });
  } catch (error) {
    console.error('Get webhook error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * PATCH /api/admin/facilitators/:id/webhooks/:webhookId - Update a webhook
 */
router.patch('/facilitators/:id/webhooks/:webhookId', requireAuth, async (req: Request, res: Response) => {
  try {
    const parsed = updateWebhookSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: 'Invalid request',
        details: parsed.error.issues,
      });
      return;
    }

    const facilitator = getFacilitatorById(req.params.id);
    if (!facilitator) {
      res.status(404).json({ error: 'Facilitator not found' });
      return;
    }

    const existingWebhook = getWebhookById(req.params.webhookId);
    if (!existingWebhook || existingWebhook.facilitator_id !== req.params.id) {
      res.status(404).json({ error: 'Webhook not found' });
      return;
    }

    const updates: Parameters<typeof updateWebhook>[1] = {};
    if (parsed.data.name !== undefined) updates.name = parsed.data.name;
    if (parsed.data.url !== undefined) updates.url = parsed.data.url;
    if (parsed.data.events !== undefined) updates.events = parsed.data.events;
    if (parsed.data.actionType !== undefined) updates.action_type = parsed.data.actionType;
    if (parsed.data.active !== undefined) updates.active = parsed.data.active ? 1 : 0;

    const webhook = updateWebhook(req.params.webhookId, updates);
    if (!webhook) {
      res.status(500).json({ error: 'Failed to update webhook' });
      return;
    }

    res.json({
      id: webhook.id,
      name: webhook.name,
      url: webhook.url,
      events: JSON.parse(webhook.events),
      actionType: webhook.action_type,
      active: webhook.active === 1,
      createdAt: formatSqliteDate(webhook.created_at),
      updatedAt: formatSqliteDate(webhook.updated_at),
    });
  } catch (error) {
    console.error('Update webhook error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * DELETE /api/admin/facilitators/:id/webhooks/:webhookId - Delete a webhook
 */
router.delete('/facilitators/:id/webhooks/:webhookId', requireAuth, async (req: Request, res: Response) => {
  try {
    const facilitator = getFacilitatorById(req.params.id);
    if (!facilitator) {
      res.status(404).json({ error: 'Facilitator not found' });
      return;
    }

    const webhook = getWebhookById(req.params.webhookId);
    if (!webhook || webhook.facilitator_id !== req.params.id) {
      res.status(404).json({ error: 'Webhook not found' });
      return;
    }

    const deleted = deleteWebhook(req.params.webhookId);
    if (!deleted) {
      res.status(500).json({ error: 'Failed to delete webhook' });
      return;
    }

    res.status(204).send();
  } catch (error) {
    console.error('Delete webhook error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/admin/facilitators/:id/webhooks/:webhookId/regenerate-secret - Regenerate webhook secret
 */
router.post('/facilitators/:id/webhooks/:webhookId/regenerate-secret', requireAuth, async (req: Request, res: Response) => {
  try {
    const facilitator = getFacilitatorById(req.params.id);
    if (!facilitator) {
      res.status(404).json({ error: 'Facilitator not found' });
      return;
    }

    const existingWebhook = getWebhookById(req.params.webhookId);
    if (!existingWebhook || existingWebhook.facilitator_id !== req.params.id) {
      res.status(404).json({ error: 'Webhook not found' });
      return;
    }

    const webhook = regenerateWebhookSecret(req.params.webhookId);
    if (!webhook) {
      res.status(500).json({ error: 'Failed to regenerate secret' });
      return;
    }

    res.json({
      success: true,
      secret: webhook.secret,
      message: 'Secret regenerated. Update your webhook handler with the new secret.',
    });
  } catch (error) {
    console.error('Regenerate webhook secret error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/admin/facilitators/:id/webhooks/:webhookId/test - Send a test webhook
 */
router.post('/facilitators/:id/webhooks/:webhookId/test', requireAuth, async (req: Request, res: Response) => {
  try {
    const facilitator = getFacilitatorById(req.params.id);
    if (!facilitator) {
      res.status(404).json({ error: 'Facilitator not found' });
      return;
    }

    const webhook = getWebhookById(req.params.webhookId);
    if (!webhook || webhook.facilitator_id !== req.params.id) {
      res.status(404).json({ error: 'Webhook not found' });
      return;
    }

    const testPayload = {
      event: 'webhook.test' as const,
      facilitatorId: facilitator.id,
      webhookId: webhook.id,
      timestamp: new Date().toISOString(),
      test: true,
      message: 'This is a test webhook delivery from OpenFacilitator.',
    };

    const result = await deliverWebhook(
      webhook.url,
      webhook.secret,
      testPayload,
      1 // Only 1 attempt for test
    );

    if (result.success) {
      res.json({
        success: true,
        message: 'Test webhook delivered successfully',
        statusCode: result.statusCode,
      });
    } else {
      res.json({
        success: false,
        message: 'Test webhook delivery failed',
        error: result.error,
        statusCode: result.statusCode,
      });
    }
  } catch (error) {
    console.error('Test webhook error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ============= PAYMENT LINKS ENDPOINTS =============

// Schema for required field definitions (product customization fields)
const requiredFieldDefinitionSchema = z.object({
  name: z.string().min(1).max(50).regex(/^[a-z0-9_]+$/, 'Field name must be lowercase alphanumeric with underscores'),
  type: z.enum(['text', 'select', 'address', 'email', 'number']),
  label: z.string().max(100).optional(),
  options: z.array(z.string().max(100)).optional(), // For select type
  required: z.boolean().optional().default(true),
  placeholder: z.string().max(200).optional(),
});

const createProductSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  imageUrl: z.string().url().max(2048).optional(), // Product image for storefront
  slug: z.string().min(1).max(100).regex(/^[a-z0-9-]+$/, 'Slug must be lowercase alphanumeric with dashes').optional(),
  linkType: z.enum(['payment', 'redirect', 'proxy']).optional().default('payment'),
  amount: z.string().min(1), // Atomic units
  asset: z.string().min(1),  // Token address
  network: z.string().min(1), // e.g., 'base', 'base-sepolia', 'solana'
  payToAddress: z.string().min(1), // Wallet address to receive payments
  successRedirectUrl: z.string().url().max(2048).optional(), // Target URL for redirect/proxy
  method: z.enum(['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'ANY']).optional().default('GET'), // For proxy type
  headersForward: z.array(z.string()).optional(), // Headers to forward for proxy type
  accessTtl: z.number().int().min(0).optional().default(0), // Seconds of access after payment (0 = pay per visit)
  requiredFields: z.array(requiredFieldDefinitionSchema).optional(), // Fields customer must provide at checkout
  groupName: z.string().max(100).optional(), // Group name for variant products
  webhookId: z.string().optional(), // Reference to first-class webhook
  webhookUrl: z.string().url().max(2048).optional(), // Deprecated: inline webhook URL
});

const updateProductSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional().nullable(),
  imageUrl: z.string().url().max(2048).optional().nullable(), // Product image for storefront
  slug: z.string().min(1).max(100).regex(/^[a-z0-9-]+$/, 'Slug must be lowercase alphanumeric with dashes').optional(),
  linkType: z.enum(['payment', 'redirect', 'proxy']).optional(),
  amount: z.string().min(1).optional(),
  asset: z.string().min(1).optional(),
  network: z.string().min(1).optional(),
  payToAddress: z.string().min(1).optional(),
  successRedirectUrl: z.string().url().max(2048).optional().nullable(),
  method: z.enum(['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'ANY']).optional(),
  headersForward: z.array(z.string()).optional(),
  accessTtl: z.number().int().min(0).optional(), // Seconds of access after payment (0 = pay per visit)
  requiredFields: z.array(requiredFieldDefinitionSchema).optional().nullable(), // Fields customer must provide at checkout
  groupName: z.string().max(100).optional().nullable(), // Group name for variant products
  webhookId: z.string().optional().nullable(), // Reference to first-class webhook
  webhookUrl: z.string().url().max(2048).optional().nullable(), // Deprecated: inline webhook URL
  active: z.boolean().optional(),
});

// Helper to build payment link URL based on environment
function getProductUrl(subdomain: string, customDomain: string | null, linkIdOrSlug: string): string {
  if (process.env.NODE_ENV === 'development') {
    return `http://localhost:5002/pay/${linkIdOrSlug}?_subdomain=${subdomain}`;
  }
  // Use custom domain if available, otherwise use subdomain
  if (customDomain) {
    return `https://${customDomain}/pay/${linkIdOrSlug}`;
  }
  return `https://${subdomain}.openfacilitator.io/pay/${linkIdOrSlug}`;
}

/**
 * GET /api/admin/facilitators/:id/payment-links - List payment links
 */
router.get('/facilitators/:id/payment-links', requireAuth, async (req: Request, res: Response) => {
  try {
    const facilitator = getFacilitatorById(req.params.id);
    if (!facilitator) {
      res.status(404).json({ error: 'Facilitator not found' });
      return;
    }

    const links = getProductsByFacilitator(req.params.id);
    const aggregateStats = getFacilitatorProductsStats(req.params.id);

    // Get stats for each link
    const linksWithStats = links.map((link) => {
      const stats = getProductStats(link.id);
      // Use slug for URL if available, otherwise use ID
      const urlPath = link.slug || link.id;
      return {
        id: link.id,
        name: link.name,
        description: link.description,
        imageUrl: link.image_url,
        slug: link.slug,
        linkType: link.link_type,
        amount: link.amount,
        asset: link.asset,
        network: link.network,
        payToAddress: link.pay_to_address,
        successRedirectUrl: link.success_redirect_url,
        method: link.method,
        headersForward: JSON.parse(link.headers_forward || '[]'),
        accessTtl: link.access_ttl,
        requiredFields: JSON.parse(link.required_fields || '[]'),
        groupName: link.group_name,
        webhookId: link.webhook_id,
        webhookUrl: link.webhook_url,
        active: link.active === 1,
        url: getProductUrl(facilitator.subdomain, facilitator.custom_domain, urlPath),
        stats: {
          totalPayments: stats.totalPayments,
          successfulPayments: stats.successfulPayments,
          totalAmountCollected: stats.totalAmountCollected,
        },
        createdAt: formatSqliteDate(link.created_at),
        updatedAt: formatSqliteDate(link.updated_at),
      };
    });

    res.json({
      products: linksWithStats,
      stats: aggregateStats,
    });
  } catch (error) {
    console.error('List payment links error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/admin/facilitators/:id/payment-links - Create payment link
 */
router.post('/facilitators/:id/payment-links', requireAuth, async (req: Request, res: Response) => {
  try {
    const parsed = createProductSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: 'Invalid request',
        details: parsed.error.issues,
      });
      return;
    }

    const facilitator = getFacilitatorById(req.params.id);
    if (!facilitator) {
      res.status(404).json({ error: 'Facilitator not found' });
      return;
    }

    // Validate slug uniqueness if provided
    if (parsed.data.slug && !isProductSlugUnique(req.params.id, parsed.data.slug)) {
      res.status(400).json({ error: 'Slug already in use' });
      return;
    }

    // Validate that proxy/redirect types have a target URL
    if ((parsed.data.linkType === 'proxy' || parsed.data.linkType === 'redirect') && !parsed.data.successRedirectUrl) {
      res.status(400).json({ error: `${parsed.data.linkType} type requires a target URL` });
      return;
    }

    // Generate webhook secret if webhook URL provided
    let webhookSecret: string | undefined;
    if (parsed.data.webhookUrl) {
      webhookSecret = generateWebhookSecret();
    }

    const link = createProduct({
      facilitator_id: req.params.id,
      name: parsed.data.name,
      description: parsed.data.description,
      image_url: parsed.data.imageUrl,
      slug: parsed.data.slug,
      link_type: parsed.data.linkType,
      amount: parsed.data.amount,
      asset: parsed.data.asset,
      network: parsed.data.network,
      pay_to_address: parsed.data.payToAddress,
      success_redirect_url: parsed.data.successRedirectUrl,
      method: parsed.data.method,
      headers_forward: parsed.data.headersForward,
      access_ttl: parsed.data.accessTtl,
      required_fields: parsed.data.requiredFields,
      group_name: parsed.data.groupName,
      webhook_id: parsed.data.webhookId,
      webhook_url: parsed.data.webhookUrl,
      webhook_secret: webhookSecret,
    });

    // Use slug for URL if available, otherwise use ID
    const urlPath = link.slug || link.id;

    res.status(201).json({
      id: link.id,
      name: link.name,
      description: link.description,
      imageUrl: link.image_url,
      slug: link.slug,
      linkType: link.link_type,
      amount: link.amount,
      asset: link.asset,
      network: link.network,
      payToAddress: link.pay_to_address,
      successRedirectUrl: link.success_redirect_url,
      method: link.method,
      headersForward: JSON.parse(link.headers_forward || '[]'),
      accessTtl: link.access_ttl,
      requiredFields: JSON.parse(link.required_fields || '[]'),
      groupName: link.group_name,
      webhookId: link.webhook_id,
      webhookUrl: link.webhook_url,
      active: link.active === 1,
      url: getProductUrl(facilitator.subdomain, facilitator.custom_domain, urlPath),
      createdAt: formatSqliteDate(link.created_at),
    });
  } catch (error) {
    console.error('Create payment link error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/admin/facilitators/:id/payment-links/:linkId - Get payment link details
 */
router.get('/facilitators/:id/payment-links/:linkId', requireAuth, async (req: Request, res: Response) => {
  try {
    const facilitator = getFacilitatorById(req.params.id);
    if (!facilitator) {
      res.status(404).json({ error: 'Facilitator not found' });
      return;
    }

    const link = getProductById(req.params.linkId);
    if (!link || link.facilitator_id !== req.params.id) {
      res.status(404).json({ error: 'Payment link not found' });
      return;
    }

    const stats = getProductStats(link.id);
    const limit = parseInt(req.query.limit as string) || 20;
    const offset = parseInt(req.query.offset as string) || 0;
    const payments = getProductPayments(link.id, limit, offset);

    // Use slug for URL if available, otherwise use ID
    const urlPath = link.slug || link.id;

    res.json({
      id: link.id,
      name: link.name,
      description: link.description,
      imageUrl: link.image_url,
      slug: link.slug,
      linkType: link.link_type,
      amount: link.amount,
      asset: link.asset,
      network: link.network,
      payToAddress: link.pay_to_address,
      successRedirectUrl: link.success_redirect_url,
      method: link.method,
      headersForward: JSON.parse(link.headers_forward || '[]'),
      accessTtl: link.access_ttl,
      requiredFields: JSON.parse(link.required_fields || '[]'),
      groupName: link.group_name,
      webhookId: link.webhook_id,
      webhookUrl: link.webhook_url,
      active: link.active === 1,
      url: getProductUrl(facilitator.subdomain, facilitator.custom_domain, urlPath),
      stats,
      payments: payments.map((p) => ({
        id: p.id,
        payerAddress: p.payer_address,
        amount: p.amount,
        transactionHash: p.transaction_hash,
        status: p.status,
        errorMessage: p.error_message,
        metadata: JSON.parse(p.metadata || '{}'),
        createdAt: formatSqliteDate(p.created_at),
      })),
      createdAt: formatSqliteDate(link.created_at),
      updatedAt: formatSqliteDate(link.updated_at),
    });
  } catch (error) {
    console.error('Get payment link error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * PATCH /api/admin/facilitators/:id/payment-links/:linkId - Update payment link
 */
router.patch('/facilitators/:id/payment-links/:linkId', requireAuth, async (req: Request, res: Response) => {
  try {
    const parsed = updateProductSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: 'Invalid request',
        details: parsed.error.issues,
      });
      return;
    }

    const facilitator = getFacilitatorById(req.params.id);
    if (!facilitator) {
      res.status(404).json({ error: 'Facilitator not found' });
      return;
    }

    const existingLink = getProductById(req.params.linkId);
    if (!existingLink || existingLink.facilitator_id !== req.params.id) {
      res.status(404).json({ error: 'Payment link not found' });
      return;
    }

    // Validate slug uniqueness if being changed
    if (parsed.data.slug !== undefined && parsed.data.slug !== existingLink.slug) {
      if (!isProductSlugUnique(req.params.id, parsed.data.slug, existingLink.id)) {
        res.status(400).json({ error: 'Slug already in use' });
        return;
      }
    }

    // Determine effective link type
    const effectiveLinkType = parsed.data.linkType || existingLink.link_type;
    const effectiveRedirectUrl = parsed.data.successRedirectUrl !== undefined
      ? parsed.data.successRedirectUrl
      : existingLink.success_redirect_url;

    // Validate that proxy/redirect types have a target URL
    if ((effectiveLinkType === 'proxy' || effectiveLinkType === 'redirect') && !effectiveRedirectUrl) {
      res.status(400).json({ error: `${effectiveLinkType} type requires a target URL` });
      return;
    }

    const updates: Parameters<typeof updateProduct>[1] = {};
    if (parsed.data.name !== undefined) updates.name = parsed.data.name;
    if (parsed.data.description !== undefined) updates.description = parsed.data.description;
    if (parsed.data.imageUrl !== undefined) updates.image_url = parsed.data.imageUrl;
    if (parsed.data.slug !== undefined) updates.slug = parsed.data.slug;
    if (parsed.data.linkType !== undefined) updates.link_type = parsed.data.linkType;
    if (parsed.data.amount !== undefined) updates.amount = parsed.data.amount;
    if (parsed.data.asset !== undefined) updates.asset = parsed.data.asset;
    if (parsed.data.network !== undefined) updates.network = parsed.data.network;
    if (parsed.data.payToAddress !== undefined) updates.pay_to_address = parsed.data.payToAddress;
    if (parsed.data.successRedirectUrl !== undefined) updates.success_redirect_url = parsed.data.successRedirectUrl;
    if (parsed.data.method !== undefined) updates.method = parsed.data.method;
    if (parsed.data.headersForward !== undefined) updates.headers_forward = parsed.data.headersForward;
    if (parsed.data.accessTtl !== undefined) updates.access_ttl = parsed.data.accessTtl;
    if (parsed.data.requiredFields !== undefined) updates.required_fields = parsed.data.requiredFields ?? [];
    if (parsed.data.groupName !== undefined) updates.group_name = parsed.data.groupName;
    if (parsed.data.webhookId !== undefined) updates.webhook_id = parsed.data.webhookId;
    if (parsed.data.webhookUrl !== undefined) {
      updates.webhook_url = parsed.data.webhookUrl;
      // Generate new secret if setting webhook for the first time
      if (parsed.data.webhookUrl && !existingLink.webhook_secret) {
        updates.webhook_secret = generateWebhookSecret();
      }
    }
    if (parsed.data.active !== undefined) updates.active = parsed.data.active ? 1 : 0;

    const link = updateProduct(req.params.linkId, updates);
    if (!link) {
      res.status(500).json({ error: 'Failed to update payment link' });
      return;
    }

    // Use slug for URL if available, otherwise use ID
    const urlPath = link.slug || link.id;

    res.json({
      id: link.id,
      name: link.name,
      description: link.description,
      imageUrl: link.image_url,
      slug: link.slug,
      linkType: link.link_type,
      amount: link.amount,
      asset: link.asset,
      network: link.network,
      payToAddress: link.pay_to_address,
      successRedirectUrl: link.success_redirect_url,
      method: link.method,
      headersForward: JSON.parse(link.headers_forward || '[]'),
      accessTtl: link.access_ttl,
      requiredFields: JSON.parse(link.required_fields || '[]'),
      groupName: link.group_name,
      webhookId: link.webhook_id,
      webhookUrl: link.webhook_url,
      active: link.active === 1,
      url: getProductUrl(facilitator.subdomain, facilitator.custom_domain, urlPath),
      createdAt: formatSqliteDate(link.created_at),
      updatedAt: formatSqliteDate(link.updated_at),
    });
  } catch (error) {
    console.error('Update payment link error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * DELETE /api/admin/facilitators/:id/payment-links/:linkId - Delete payment link
 */
router.delete('/facilitators/:id/payment-links/:linkId', requireAuth, async (req: Request, res: Response) => {
  try {
    const facilitator = getFacilitatorById(req.params.id);
    if (!facilitator) {
      res.status(404).json({ error: 'Facilitator not found' });
      return;
    }

    const link = getProductById(req.params.linkId);
    if (!link || link.facilitator_id !== req.params.id) {
      res.status(404).json({ error: 'Payment link not found' });
      return;
    }

    const deleted = deleteProduct(req.params.linkId);
    if (!deleted) {
      res.status(500).json({ error: 'Failed to delete payment link' });
      return;
    }

    res.status(204).send();
  } catch (error) {
    console.error('Delete payment link error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// =============================================================================
// Proxy URLs (API Gateway)
// =============================================================================

const createProxyUrlSchema = z.object({
  name: z.string().min(1).max(100),
  slug: z.string().min(1).max(63).regex(/^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/, 'Invalid slug format (lowercase, numbers, hyphens)'),
  targetUrl: z.string().url().max(2048),
  method: z.enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'ANY']).optional(),
  priceAmount: z.string().min(1), // Atomic units
  priceAsset: z.string().min(1),  // Token address
  priceNetwork: z.string().min(1), // e.g., 'base', 'solana'
  payToAddress: z.string().min(1), // Wallet address to receive payments
  headersForward: z.array(z.string()).optional(),
});

const updateProxyUrlSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  slug: z.string().min(1).max(63).regex(/^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/, 'Invalid slug format').optional(),
  targetUrl: z.string().url().max(2048).optional(),
  method: z.enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'ANY']).optional(),
  priceAmount: z.string().min(1).optional(),
  priceAsset: z.string().min(1).optional(),
  priceNetwork: z.string().min(1).optional(),
  payToAddress: z.string().min(1).optional(),
  headersForward: z.array(z.string()).optional(),
  active: z.boolean().optional(),
});

/**
 * Helper to build proxy URL
 */
function getProxyUrlEndpoint(subdomain: string, customDomain: string | null, slug: string): string {
  const baseUrl = customDomain
    ? `https://${customDomain}`
    : `https://${subdomain}.openfacilitator.io`;
  return `${baseUrl}/u/${slug}`;
}

/**
 * GET /api/admin/facilitators/:id/urls - List proxy URLs
 */
router.get('/facilitators/:id/urls', requireAuth, async (req: Request, res: Response) => {
  try {
    const facilitator = getFacilitatorById(req.params.id);
    if (!facilitator) {
      res.status(404).json({ error: 'Facilitator not found' });
      return;
    }

    const urls = getProxyUrlsByFacilitator(req.params.id);

    const urlsResponse = urls.map((url) => ({
      id: url.id,
      name: url.name,
      slug: url.slug,
      targetUrl: url.target_url,
      method: url.method,
      priceAmount: url.price_amount,
      priceAsset: url.price_asset,
      priceNetwork: url.price_network,
      payToAddress: url.pay_to_address,
      headersForward: JSON.parse(url.headers_forward),
      active: url.active === 1,
      url: getProxyUrlEndpoint(facilitator.subdomain, facilitator.custom_domain, url.slug),
      createdAt: formatSqliteDate(url.created_at),
      updatedAt: formatSqliteDate(url.updated_at),
    }));

    res.json({ urls: urlsResponse });
  } catch (error) {
    console.error('List proxy URLs error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/admin/facilitators/:id/urls - Create proxy URL
 */
router.post('/facilitators/:id/urls', requireAuth, async (req: Request, res: Response) => {
  try {
    const parsed = createProxyUrlSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: 'Invalid request',
        details: parsed.error.issues,
      });
      return;
    }

    const facilitator = getFacilitatorById(req.params.id);
    if (!facilitator) {
      res.status(404).json({ error: 'Facilitator not found' });
      return;
    }

    // Check slug uniqueness
    if (!isProxySlugUnique(req.params.id, parsed.data.slug)) {
      res.status(400).json({ error: 'Slug already exists for this facilitator' });
      return;
    }

    const url = createProxyUrl({
      facilitator_id: req.params.id,
      name: parsed.data.name,
      slug: parsed.data.slug,
      target_url: parsed.data.targetUrl,
      method: parsed.data.method,
      price_amount: parsed.data.priceAmount,
      price_asset: parsed.data.priceAsset,
      price_network: parsed.data.priceNetwork,
      pay_to_address: parsed.data.payToAddress,
      headers_forward: parsed.data.headersForward,
    });

    res.status(201).json({
      id: url.id,
      name: url.name,
      slug: url.slug,
      targetUrl: url.target_url,
      method: url.method,
      priceAmount: url.price_amount,
      priceAsset: url.price_asset,
      priceNetwork: url.price_network,
      payToAddress: url.pay_to_address,
      headersForward: JSON.parse(url.headers_forward),
      active: url.active === 1,
      url: getProxyUrlEndpoint(facilitator.subdomain, facilitator.custom_domain, url.slug),
      createdAt: formatSqliteDate(url.created_at),
    });
  } catch (error) {
    console.error('Create proxy URL error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/admin/facilitators/:id/urls/:urlId - Get proxy URL details
 */
router.get('/facilitators/:id/urls/:urlId', requireAuth, async (req: Request, res: Response) => {
  try {
    const facilitator = getFacilitatorById(req.params.id);
    if (!facilitator) {
      res.status(404).json({ error: 'Facilitator not found' });
      return;
    }

    const url = getProxyUrlById(req.params.urlId);
    if (!url || url.facilitator_id !== req.params.id) {
      res.status(404).json({ error: 'URL not found' });
      return;
    }

    res.json({
      id: url.id,
      name: url.name,
      slug: url.slug,
      targetUrl: url.target_url,
      method: url.method,
      priceAmount: url.price_amount,
      priceAsset: url.price_asset,
      priceNetwork: url.price_network,
      payToAddress: url.pay_to_address,
      headersForward: JSON.parse(url.headers_forward),
      active: url.active === 1,
      url: getProxyUrlEndpoint(facilitator.subdomain, facilitator.custom_domain, url.slug),
      createdAt: formatSqliteDate(url.created_at),
      updatedAt: formatSqliteDate(url.updated_at),
    });
  } catch (error) {
    console.error('Get proxy URL error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * PATCH /api/admin/facilitators/:id/urls/:urlId - Update proxy URL
 */
router.patch('/facilitators/:id/urls/:urlId', requireAuth, async (req: Request, res: Response) => {
  try {
    const parsed = updateProxyUrlSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: 'Invalid request',
        details: parsed.error.issues,
      });
      return;
    }

    const facilitator = getFacilitatorById(req.params.id);
    if (!facilitator) {
      res.status(404).json({ error: 'Facilitator not found' });
      return;
    }

    const existingUrl = getProxyUrlById(req.params.urlId);
    if (!existingUrl || existingUrl.facilitator_id !== req.params.id) {
      res.status(404).json({ error: 'URL not found' });
      return;
    }

    // Check slug uniqueness if being updated
    if (parsed.data.slug && !isProxySlugUnique(req.params.id, parsed.data.slug, req.params.urlId)) {
      res.status(400).json({ error: 'Slug already exists for this facilitator' });
      return;
    }

    const updates: Parameters<typeof updateProxyUrl>[1] = {};
    if (parsed.data.name !== undefined) updates.name = parsed.data.name;
    if (parsed.data.slug !== undefined) updates.slug = parsed.data.slug;
    if (parsed.data.targetUrl !== undefined) updates.target_url = parsed.data.targetUrl;
    if (parsed.data.method !== undefined) updates.method = parsed.data.method;
    if (parsed.data.priceAmount !== undefined) updates.price_amount = parsed.data.priceAmount;
    if (parsed.data.priceAsset !== undefined) updates.price_asset = parsed.data.priceAsset;
    if (parsed.data.priceNetwork !== undefined) updates.price_network = parsed.data.priceNetwork;
    if (parsed.data.payToAddress !== undefined) updates.pay_to_address = parsed.data.payToAddress;
    if (parsed.data.headersForward !== undefined) updates.headers_forward = parsed.data.headersForward;
    if (parsed.data.active !== undefined) updates.active = parsed.data.active;

    const url = updateProxyUrl(req.params.urlId, updates);
    if (!url) {
      res.status(500).json({ error: 'Failed to update URL' });
      return;
    }

    res.json({
      id: url.id,
      name: url.name,
      slug: url.slug,
      targetUrl: url.target_url,
      method: url.method,
      priceAmount: url.price_amount,
      priceAsset: url.price_asset,
      priceNetwork: url.price_network,
      payToAddress: url.pay_to_address,
      headersForward: JSON.parse(url.headers_forward),
      active: url.active === 1,
      url: getProxyUrlEndpoint(facilitator.subdomain, facilitator.custom_domain, url.slug),
      createdAt: formatSqliteDate(url.created_at),
      updatedAt: formatSqliteDate(url.updated_at),
    });
  } catch (error) {
    console.error('Update proxy URL error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * DELETE /api/admin/facilitators/:id/urls/:urlId - Delete proxy URL
 */
router.delete('/facilitators/:id/urls/:urlId', requireAuth, async (req: Request, res: Response) => {
  try {
    const facilitator = getFacilitatorById(req.params.id);
    if (!facilitator) {
      res.status(404).json({ error: 'Facilitator not found' });
      return;
    }

    const url = getProxyUrlById(req.params.urlId);
    if (!url || url.facilitator_id !== req.params.id) {
      res.status(404).json({ error: 'URL not found' });
      return;
    }

    const deleted = deleteProxyUrl(req.params.urlId);
    if (!deleted) {
      res.status(500).json({ error: 'Failed to delete URL' });
      return;
    }

    res.status(204).send();
  } catch (error) {
    console.error('Delete proxy URL error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// =============================================================================
// Storefront Routes
// =============================================================================

const createStorefrontSchema = z.object({
  name: z.string().min(1).max(255),
  slug: z.string().min(1).max(100).regex(/^[a-z0-9-]+$/, 'Slug must be lowercase alphanumeric with dashes'),
  description: z.string().max(2048).optional(),
  imageUrl: z.string().url().max(2048).optional(),
});

const updateStorefrontSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  slug: z.string().min(1).max(100).regex(/^[a-z0-9-]+$/, 'Slug must be lowercase alphanumeric with dashes').optional(),
  description: z.string().max(2048).optional().nullable(),
  imageUrl: z.string().url().max(2048).optional().nullable(),
  active: z.boolean().optional(),
});

// Helper to build storefront URL
function getStorefrontUrl(subdomain: string, customDomain: string | null, slug: string): string {
  if (process.env.NODE_ENV === 'development') {
    return `http://localhost:5002/store/${slug}?_subdomain=${subdomain}`;
  }
  if (customDomain) {
    return `https://${customDomain}/store/${slug}`;
  }
  return `https://${subdomain}.openfacilitator.io/store/${slug}`;
}

/**
 * GET /api/admin/facilitators/:id/storefronts - List storefronts
 */
router.get('/facilitators/:id/storefronts', requireAuth, async (req: Request, res: Response) => {
  try {
    const facilitator = getFacilitatorById(req.params.id);
    if (!facilitator) {
      res.status(404).json({ error: 'Facilitator not found' });
      return;
    }

    const storefronts = getStorefrontsByFacilitator(req.params.id);
    const stats = getFacilitatorStorefrontsStats(req.params.id);

    res.json({
      storefronts: storefronts.map((sf) => {
        const sfStats = getStorefrontStats(sf.id);
        return {
          id: sf.id,
          name: sf.name,
          slug: sf.slug,
          description: sf.description,
          imageUrl: sf.image_url,
          active: sf.active === 1,
          url: getStorefrontUrl(facilitator.subdomain, facilitator.custom_domain, sf.slug),
          productCount: sfStats.totalProducts,
          createdAt: formatSqliteDate(sf.created_at),
          updatedAt: formatSqliteDate(sf.updated_at),
        };
      }),
      stats,
    });
  } catch (error) {
    console.error('List storefronts error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/admin/facilitators/:id/storefronts - Create storefront
 */
router.post('/facilitators/:id/storefronts', requireAuth, async (req: Request, res: Response) => {
  try {
    const parsed = createStorefrontSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid request', details: parsed.error.issues });
      return;
    }

    const facilitator = getFacilitatorById(req.params.id);
    if (!facilitator) {
      res.status(404).json({ error: 'Facilitator not found' });
      return;
    }

    // Check slug uniqueness
    if (!isStorefrontSlugUnique(req.params.id, parsed.data.slug)) {
      res.status(400).json({ error: 'Slug already in use' });
      return;
    }

    const storefront = createStorefront({
      facilitator_id: req.params.id,
      name: parsed.data.name,
      slug: parsed.data.slug,
      description: parsed.data.description,
      image_url: parsed.data.imageUrl,
    });

    res.status(201).json({
      id: storefront.id,
      name: storefront.name,
      slug: storefront.slug,
      description: storefront.description,
      imageUrl: storefront.image_url,
      active: storefront.active === 1,
      url: getStorefrontUrl(facilitator.subdomain, facilitator.custom_domain, storefront.slug),
      stats: { totalProducts: 0, activeProducts: 0 },
      createdAt: formatSqliteDate(storefront.created_at),
      updatedAt: formatSqliteDate(storefront.updated_at),
    });
  } catch (error) {
    console.error('Create storefront error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/admin/facilitators/:id/storefronts/:storefrontId - Get storefront details
 */
router.get('/facilitators/:id/storefronts/:storefrontId', requireAuth, async (req: Request, res: Response) => {
  try {
    const facilitator = getFacilitatorById(req.params.id);
    if (!facilitator) {
      res.status(404).json({ error: 'Facilitator not found' });
      return;
    }

    const storefront = getStorefrontById(req.params.storefrontId);
    if (!storefront || storefront.facilitator_id !== req.params.id) {
      res.status(404).json({ error: 'Storefront not found' });
      return;
    }

    const products = getStorefrontProducts(storefront.id);
    const stats = getStorefrontStats(storefront.id);

    res.json({
      id: storefront.id,
      name: storefront.name,
      slug: storefront.slug,
      description: storefront.description,
      imageUrl: storefront.image_url,
      active: storefront.active === 1,
      url: getStorefrontUrl(facilitator.subdomain, facilitator.custom_domain, storefront.slug),
      products: products.map((p) => ({
        id: p.id,
        name: p.name,
        description: p.description,
        imageUrl: p.image_url,
        amount: p.amount,
        asset: p.asset,
        network: p.network,
      })),
      stats,
      createdAt: formatSqliteDate(storefront.created_at),
      updatedAt: formatSqliteDate(storefront.updated_at),
    });
  } catch (error) {
    console.error('Get storefront error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * PATCH /api/admin/facilitators/:id/storefronts/:storefrontId - Update storefront
 */
router.patch('/facilitators/:id/storefronts/:storefrontId', requireAuth, async (req: Request, res: Response) => {
  try {
    const parsed = updateStorefrontSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid request', details: parsed.error.issues });
      return;
    }

    const facilitator = getFacilitatorById(req.params.id);
    if (!facilitator) {
      res.status(404).json({ error: 'Facilitator not found' });
      return;
    }

    const storefront = getStorefrontById(req.params.storefrontId);
    if (!storefront || storefront.facilitator_id !== req.params.id) {
      res.status(404).json({ error: 'Storefront not found' });
      return;
    }

    // Check slug uniqueness if changing
    if (parsed.data.slug && parsed.data.slug !== storefront.slug) {
      if (!isStorefrontSlugUnique(req.params.id, parsed.data.slug, storefront.id)) {
        res.status(400).json({ error: 'Slug already in use' });
        return;
      }
    }

    const updated = updateStorefront(storefront.id, {
      name: parsed.data.name,
      slug: parsed.data.slug,
      description: parsed.data.description,
      image_url: parsed.data.imageUrl,
      active: parsed.data.active,
    });

    if (!updated) {
      res.status(500).json({ error: 'Failed to update storefront' });
      return;
    }

    const stats = getStorefrontStats(updated.id);

    res.json({
      id: updated.id,
      name: updated.name,
      slug: updated.slug,
      description: updated.description,
      imageUrl: updated.image_url,
      active: updated.active === 1,
      url: getStorefrontUrl(facilitator.subdomain, facilitator.custom_domain, updated.slug),
      stats,
      createdAt: formatSqliteDate(updated.created_at),
      updatedAt: formatSqliteDate(updated.updated_at),
    });
  } catch (error) {
    console.error('Update storefront error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * DELETE /api/admin/facilitators/:id/storefronts/:storefrontId - Delete storefront
 */
router.delete('/facilitators/:id/storefronts/:storefrontId', requireAuth, async (req: Request, res: Response) => {
  try {
    const facilitator = getFacilitatorById(req.params.id);
    if (!facilitator) {
      res.status(404).json({ error: 'Facilitator not found' });
      return;
    }

    const storefront = getStorefrontById(req.params.storefrontId);
    if (!storefront || storefront.facilitator_id !== req.params.id) {
      res.status(404).json({ error: 'Storefront not found' });
      return;
    }

    const deleted = deleteStorefront(storefront.id);
    if (!deleted) {
      res.status(500).json({ error: 'Failed to delete storefront' });
      return;
    }

    res.status(204).send();
  } catch (error) {
    console.error('Delete storefront error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/admin/facilitators/:id/storefronts/:storefrontId/products - Add product to storefront
 */
router.post('/facilitators/:id/storefronts/:storefrontId/products', requireAuth, async (req: Request, res: Response) => {
  try {
    const { productId, position } = req.body;
    if (!productId || typeof productId !== 'string') {
      res.status(400).json({ error: 'productId is required' });
      return;
    }

    const facilitator = getFacilitatorById(req.params.id);
    if (!facilitator) {
      res.status(404).json({ error: 'Facilitator not found' });
      return;
    }

    const storefront = getStorefrontById(req.params.storefrontId);
    if (!storefront || storefront.facilitator_id !== req.params.id) {
      res.status(404).json({ error: 'Storefront not found' });
      return;
    }

    const product = getProductById(productId);
    if (!product || product.facilitator_id !== req.params.id) {
      res.status(404).json({ error: 'Product not found' });
      return;
    }

    const association = addProductToStorefront(storefront.id, productId, position);

    res.status(201).json({
      storefrontId: association.storefront_id,
      productId: association.product_id,
      position: association.position,
    });
  } catch (error) {
    console.error('Add product to storefront error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * DELETE /api/admin/facilitators/:id/storefronts/:storefrontId/products/:productId - Remove product from storefront
 */
router.delete('/facilitators/:id/storefronts/:storefrontId/products/:productId', requireAuth, async (req: Request, res: Response) => {
  try {
    const facilitator = getFacilitatorById(req.params.id);
    if (!facilitator) {
      res.status(404).json({ error: 'Facilitator not found' });
      return;
    }

    const storefront = getStorefrontById(req.params.storefrontId);
    if (!storefront || storefront.facilitator_id !== req.params.id) {
      res.status(404).json({ error: 'Storefront not found' });
      return;
    }

    const removed = removeProductFromStorefront(storefront.id, req.params.productId);
    if (!removed) {
      res.status(404).json({ error: 'Product not in storefront' });
      return;
    }

    res.status(204).send();
  } catch (error) {
    console.error('Remove product from storefront error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ============================================
// REFUND MANAGEMENT ENDPOINTS
// ============================================

/**
 * GET /api/admin/facilitators/:id/refunds/config - Get refund configuration
 */
router.get('/facilitators/:id/refunds/config', requireAuth, async (req: Request, res: Response) => {
  try {
    const facilitator = getFacilitatorById(req.params.id);
    if (!facilitator) {
      res.status(404).json({ error: 'Facilitator not found' });
      return;
    }

    const config = getOrCreateRefundConfig(req.params.id);

    res.json({
      enabled: config.enabled === 1,
      createdAt: formatSqliteDate(config.created_at),
      updatedAt: formatSqliteDate(config.updated_at),
    });
  } catch (error) {
    console.error('Get refund config error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/admin/facilitators/:id/refunds/config - Update refund configuration
 */
router.post('/facilitators/:id/refunds/config', requireAuth, async (req: Request, res: Response) => {
  try {
    const { enabled } = req.body;

    const facilitator = getFacilitatorById(req.params.id);
    if (!facilitator) {
      res.status(404).json({ error: 'Facilitator not found' });
      return;
    }

    // Ensure config exists
    getOrCreateRefundConfig(req.params.id);

    // Update config
    const config = updateRefundConfig(req.params.id, {
      enabled: enabled ? 1 : 0,
    });

    if (!config) {
      res.status(500).json({ error: 'Failed to update refund config' });
      return;
    }

    res.json({
      enabled: config.enabled === 1,
      createdAt: formatSqliteDate(config.created_at),
      updatedAt: formatSqliteDate(config.updated_at),
    });
  } catch (error) {
    console.error('Update refund config error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ============================================
// RESOURCE OWNER OVERVIEW ENDPOINTS (for facilitator admins)
// Resource owners manage their own wallets/servers/claims via the public API
// ============================================

/**
 * GET /api/admin/facilitators/:id/resource-owners - List all resource owners
 */
router.get('/facilitators/:id/resource-owners', requireAuth, async (req: Request, res: Response) => {
  try {
    const facilitator = getFacilitatorById(req.params.id);
    if (!facilitator) {
      res.status(404).json({ error: 'Facilitator not found' });
      return;
    }

    const resourceOwners = getResourceOwnersByFacilitator(req.params.id);

    // Get stats for each resource owner
    const ownersWithStats = await Promise.all(
      resourceOwners.map(async (owner) => {
        const wallets = await getRefundWalletBalances(owner.id);
        const servers = getRegisteredServersByResourceOwner(owner.id);
        const claimStats = getClaimStats(owner.id);

        return {
          id: owner.id,
          userId: owner.user_id,
          refundAddress: owner.refund_address,
          name: owner.name,
          createdAt: formatSqliteDate(owner.created_at),
          stats: {
            wallets: wallets.length,
            servers: servers.filter(s => s.active === 1).length,
            totalClaims: claimStats.totalClaims,
            pendingClaims: claimStats.pendingClaims,
            paidClaims: claimStats.paidClaims,
            totalPaidAmount: claimStats.totalPaidAmount,
          },
        };
      })
    );

    res.json({
      resourceOwners: ownersWithStats,
      total: resourceOwners.length,
    });
  } catch (error) {
    console.error('Get resource owners error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/admin/facilitators/:id/resource-owners/:ownerId - Get a specific resource owner with details
 */
router.get('/facilitators/:id/resource-owners/:ownerId', requireAuth, async (req: Request, res: Response) => {
  try {
    const facilitator = getFacilitatorById(req.params.id);
    if (!facilitator) {
      res.status(404).json({ error: 'Facilitator not found' });
      return;
    }

    const owner = getResourceOwnerById(req.params.ownerId);
    if (!owner || owner.facilitator_id !== req.params.id) {
      res.status(404).json({ error: 'Resource owner not found' });
      return;
    }

    const wallets = await getRefundWalletBalances(owner.id);
    const servers = getRegisteredServersByResourceOwner(owner.id);
    const claimStats = getClaimStats(owner.id);
    const claims = getClaimsByResourceOwner(owner.id, { limit: 20 });

    res.json({
      id: owner.id,
      userId: owner.user_id,
      refundAddress: owner.refund_address,
      name: owner.name,
      createdAt: formatSqliteDate(owner.created_at),
      wallets,
      servers: servers.map(s => ({
        id: s.id,
        url: s.url,
        name: s.name,
        active: s.active === 1,
        createdAt: formatSqliteDate(s.created_at),
      })),
      claimStats,
      recentClaims: claims.map((c) => ({
        id: c.id,
        originalTxHash: c.original_tx_hash,
        userWallet: c.user_wallet,
        amount: c.amount,
        asset: c.asset,
        network: c.network,
        reason: c.reason,
        status: c.status,
        payoutTxHash: c.payout_tx_hash,
        reportedAt: formatSqliteDate(c.reported_at),
        paidAt: formatSqliteDate(c.paid_at),
        expiresAt: formatSqliteDate(c.expires_at),
      })),
    });
  } catch (error) {
    console.error('Get resource owner error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/admin/facilitators/:id/refunds/overview - Get aggregate refund stats across all resource owners
 */
router.get('/facilitators/:id/refunds/overview', requireAuth, async (req: Request, res: Response) => {
  try {
    const facilitator = getFacilitatorById(req.params.id);
    if (!facilitator) {
      res.status(404).json({ error: 'Facilitator not found' });
      return;
    }

    const resourceOwners = getResourceOwnersByFacilitator(req.params.id);

    // Aggregate stats across all resource owners
    let totalClaims = 0;
    let pendingClaims = 0;
    let approvedClaims = 0;
    let paidClaims = 0;
    let rejectedClaims = 0;
    let totalPaidAmount = 0;
    let totalWallets = 0;
    let totalServers = 0;
    let totalWalletBalance = 0;

    for (const owner of resourceOwners) {
      const stats = getClaimStats(owner.id);
      totalClaims += stats.totalClaims;
      pendingClaims += stats.pendingClaims;
      approvedClaims += stats.approvedClaims;
      paidClaims += stats.paidClaims;
      rejectedClaims += stats.rejectedClaims;
      totalPaidAmount += parseFloat(stats.totalPaidAmount);

      const wallets = await getRefundWalletBalances(owner.id);
      totalWallets += wallets.length;
      totalWalletBalance += wallets.reduce((sum, w) => sum + parseFloat(w.balance), 0);

      const servers = getRegisteredServersByResourceOwner(owner.id);
      totalServers += servers.filter(s => s.active === 1).length;
    }

    res.json({
      resourceOwners: resourceOwners.length,
      totalWallets,
      totalServers,
      totalWalletBalance: totalWalletBalance.toFixed(2),
      claims: {
        total: totalClaims,
        pending: pendingClaims,
        approved: approvedClaims,
        paid: paidClaims,
        rejected: rejectedClaims,
        totalPaidAmount: totalPaidAmount.toFixed(2),
      },
      supportedNetworks: SUPPORTED_REFUND_NETWORKS,
    });
  } catch (error) {
    console.error('Get refunds overview error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ==================== NONCE MANAGEMENT (ADMIN) ====================

/**
 * Get nonce status for a facilitator's EVM wallet
 * GET /api/admin/facilitators/:id/nonce-status/:chainId
 */
router.get('/facilitators/:id/nonce-status/:chainId', requireAuth, async (req: Request, res: Response) => {
  try {
    const { chainId } = req.params;

    const facilitator = getFacilitatorById(req.params.id);
    if (!facilitator) {
      res.status(404).json({ error: 'Facilitator not found' });
      return;
    }

    if (!facilitator.encrypted_private_key) {
      res.status(400).json({ error: 'Facilitator does not have an EVM wallet configured' });
      return;
    }

    const chainIdNum = parseInt(chainId, 10);
    if (isNaN(chainIdNum)) {
      res.status(400).json({ error: 'Invalid chain ID' });
      return;
    }

    const privateKey = decryptPrivateKey(facilitator.encrypted_private_key);
    const address = getWalletAddress(privateKey as `0x${string}`);
    const status = await getNonceStatus(chainIdNum, address);

    res.json({
      chainId: chainIdNum,
      address,
      ...status,
    });
  } catch (error) {
    console.error('Get nonce status error:', error);
    res.status(500).json({ error: error instanceof Error ? error.message : 'Internal server error' });
  }
});

/**
 * Force reset nonce manager for a facilitator's EVM wallet
 * POST /api/admin/facilitators/:id/reset-nonce/:chainId
 */
router.post('/facilitators/:id/reset-nonce/:chainId', requireAuth, async (req: Request, res: Response) => {
  try {
    const { chainId } = req.params;

    const facilitator = getFacilitatorById(req.params.id);
    if (!facilitator) {
      res.status(404).json({ error: 'Facilitator not found' });
      return;
    }

    if (!facilitator.encrypted_private_key) {
      res.status(400).json({ error: 'Facilitator does not have an EVM wallet configured' });
      return;
    }

    const chainIdNum = parseInt(chainId, 10);
    if (isNaN(chainIdNum)) {
      res.status(400).json({ error: 'Invalid chain ID' });
      return;
    }

    const privateKey = decryptPrivateKey(facilitator.encrypted_private_key);
    const address = getWalletAddress(privateKey as `0x${string}`);
    const result = await forceResetNonce(chainIdNum, address);

    console.log(`[Admin] Nonce reset for ${address} on chain ${chainIdNum}: ${result.previousNonce} -> ${result.newNonce}`);

    res.json({
      chainId: chainIdNum,
      address,
      ...result,
      message: `Nonce reset from ${result.previousNonce ?? 'uninitialized'} to ${result.newNonce}`,
    });
  } catch (error) {
    console.error('Reset nonce error:', error);
    res.status(500).json({ error: error instanceof Error ? error.message : 'Internal server error' });
  }
});

export { router as adminRouter };

