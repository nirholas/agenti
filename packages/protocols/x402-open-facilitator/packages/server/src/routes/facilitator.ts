import { Router, type Request, type Response, type IRouter } from 'express';
import { createFacilitator, type FacilitatorConfig, type TokenConfig, getSolanaPublicKey, networkToCaip2, isStacksNetwork } from '@openfacilitator/core';
import { z } from 'zod';
import crypto from 'crypto';
import { requireFacilitator } from '../middleware/tenant.js';
import { createTransaction, updateTransactionStatus } from '../db/transactions.js';
import { getFacilitatorById } from '../db/facilitators.js';
import {
  getProductById,
  getProductByIdOrSlug,
  getProductBySlug,
  getActiveProducts,
  createProductPayment,
  updateProductPaymentStatus,
} from '../db/products.js';
import {
  getStorefrontBySlug,
  getStorefrontProducts,
} from '../db/storefronts.js';
import type { RequiredFieldDefinition } from '../db/types.js';
import { decryptPrivateKey } from '../utils/crypto.js';
import { sendSettlementWebhook, deliverWebhook, generateWebhookSecret, type ProductWebhookPayload } from '../services/webhook.js';
import { executeAction, type ActionResult } from '../services/actions.js';
import { getWebhookById } from '../db/webhooks.js';
import { getProxyUrlBySlug } from '../db/proxy-urls.js';
import type { Hex } from 'viem';

const router: IRouter = Router();

// Access token secret (use env var or fallback to a derived key)
const ACCESS_TOKEN_SECRET = process.env.ACCESS_TOKEN_SECRET ||
  crypto.createHash('sha256').update(process.env.ENCRYPTION_KEY || 'openfacilitator-access-default').digest('hex');

/**
 * Create a signed access token for a product
 */
function createAccessToken(productId: string, expiresAt: number): string {
  const payload = JSON.stringify({ productId, exp: expiresAt });
  const signature = crypto.createHmac('sha256', ACCESS_TOKEN_SECRET).update(payload).digest('base64url');
  return Buffer.from(payload).toString('base64url') + '.' + signature;
}

/**
 * Verify an access token and return the product ID if valid
 */
function verifyAccessToken(token: string, expectedProductId: string): boolean {
  try {
    const [payloadB64, signature] = token.split('.');
    if (!payloadB64 || !signature) return false;

    const payload = Buffer.from(payloadB64, 'base64url').toString('utf-8');
    const expectedSig = crypto.createHmac('sha256', ACCESS_TOKEN_SECRET).update(payload).digest('base64url');

    if (signature !== expectedSig) return false;

    // Support both old (linkId) and new (productId) token formats
    const data = JSON.parse(payload) as { productId?: string; linkId?: string; exp: number };
    const tokenProductId = data.productId || data.linkId;
    if (tokenProductId !== expectedProductId) return false;
    if (Date.now() > data.exp * 1000) return false;

    return true;
  } catch {
    return false;
  }
}

/**
 * Parse cookies from Cookie header
 */
function parseCookies(cookieHeader: string | undefined): Record<string, string> {
  if (!cookieHeader) return {};
  const cookies: Record<string, string> = {};
  for (const cookie of cookieHeader.split(';')) {
    const [name, ...rest] = cookie.trim().split('=');
    if (name && rest.length > 0) {
      cookies[name] = rest.join('=');
    }
  }
  return cookies;
}

// Payment requirements schema (shared) - supports both v1 and v2 formats
// v1 uses maxAmountRequired, v2 uses amount
const paymentRequirementsSchema = z.object({
  scheme: z.string(),
  network: z.string(),
  // v1 field (optional for v2 compatibility)
  maxAmountRequired: z.string().optional(),
  // v2 field (optional for v1 compatibility)
  amount: z.string().optional(),
  resource: z.string().default(''),
  asset: z.string(), // Token contract address
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

/**
 * Get the amount from payment requirements, supporting both v1 and v2 formats.
 * v1 uses maxAmountRequired, v2 uses amount.
 */
function getRequiredAmount(requirements: { maxAmountRequired?: string; amount?: string }): string {
  return requirements.maxAmountRequired ?? requirements.amount ?? '0';
}

// Validation schemas - accept both string (base64) and object for paymentPayload
const verifyRequestSchema = z.object({
  x402Version: z.number().optional(), // Some clients omit this
  paymentPayload: z.union([z.string(), z.object({}).passthrough()]),
  paymentRequirements: paymentRequirementsSchema,
});

const settleRequestSchema = verifyRequestSchema;

// Schema for payment metadata header (base64 or plain JSON)
const paymentMetadataHeaderSchema = z.string().transform((val, ctx) => {
  // Try base64 first
  try {
    return JSON.parse(Buffer.from(val, 'base64').toString('utf-8')) as Record<string, unknown>;
  } catch {
    // Try plain JSON
    try {
      return JSON.parse(val) as Record<string, unknown>;
    } catch {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Invalid X-Payment-Metadata header encoding (expected base64-encoded JSON or plain JSON)',
      });
      return z.NEVER;
    }
  }
});

/**
 * Build a dynamic Zod schema for validating payment metadata against required fields
 */
function buildMetadataSchema(requiredFields: RequiredFieldDefinition[]): z.ZodObject<z.ZodRawShape> {
  const shape: z.ZodRawShape = {};

  for (const field of requiredFields) {
    let fieldSchema: z.ZodTypeAny;

    switch (field.type) {
      case 'email':
        fieldSchema = z.string().email(`${field.label || field.name} must be a valid email`);
        break;
      case 'number':
        fieldSchema = z.coerce.number({
          invalid_type_error: `${field.label || field.name} must be a number`,
        });
        break;
      case 'select':
        if (field.options && field.options.length > 0) {
          fieldSchema = z.enum(field.options as [string, ...string[]], {
            errorMap: () => ({
              message: `${field.label || field.name} must be one of: ${field.options?.join(', ')}`,
            }),
          });
        } else {
          fieldSchema = z.string();
        }
        break;
      case 'address':
      case 'text':
      default:
        fieldSchema = z.string();
        break;
    }

    // Apply required/optional
    const isRequired = field.required !== false;
    if (!isRequired) {
      fieldSchema = fieldSchema.optional().or(z.literal(''));
    }

    shape[field.name] = fieldSchema;
  }

  return z.object(shape).passthrough();
}

/**
 * Normalize paymentPayload to string format
 * Accepts both base64 string and object, returns string
 */
function normalizePaymentPayload(payload: string | object): string {
  if (typeof payload === 'string') {
    return payload;
  }
  // If it's an object, base64 encode it
  return Buffer.from(JSON.stringify(payload)).toString('base64');
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

/**
 * Handle product webhook with action execution
 * Supports both first-class webhooks (by ID) and inline webhooks (legacy)
 */
interface ProductWebhookContext {
  product: {
    id: string;
    name: string;
    amount: string;
    asset: string;
    network: string;
    webhook_id: string | null;
    webhook_url: string | null;
    webhook_secret: string | null;
  };
  facilitator: {
    id: string;
    webhook_url: string | null;
    webhook_secret: string | null;
  };
  payment: {
    id: string;
    payerAddress: string;
    transactionHash: string;
  };
  metadata?: Record<string, string>;
}

async function deliverProductWebhook(ctx: ProductWebhookContext): Promise<void> {
  const { product, facilitator, payment, metadata } = ctx;

  let webhookUrl: string | null = null;
  let webhookSecret: string | null = null;
  let actionType: string | null = null;

  // Check for first-class webhook (by ID)
  if (product.webhook_id) {
    const webhook = getWebhookById(product.webhook_id);
    if (webhook && webhook.active === 1) {
      webhookUrl = webhook.url;
      webhookSecret = webhook.secret;
      actionType = webhook.action_type;
    }
  }

  // Fall back to inline webhook (legacy)
  if (!webhookUrl) {
    webhookUrl = product.webhook_url || facilitator.webhook_url;
    webhookSecret = product.webhook_secret || facilitator.webhook_secret;
  }

  // No webhook configured
  if (!webhookUrl || !webhookSecret) {
    return;
  }

  // Execute action if configured
  let actionResult: ActionResult | undefined;
  if (actionType) {
    actionResult = await executeAction(actionType, {
      payerAddress: payment.payerAddress,
      productId: product.id,
      amount: product.amount,
      asset: product.asset,
      network: product.network,
      transactionHash: payment.transactionHash,
    });
  }

  // Build webhook payload
  const webhookPayload: ProductWebhookPayload & { action?: { type: string; status: string; result?: Record<string, unknown> }; metadata?: Record<string, string> } = {
    event: 'product.payment',
    productId: product.id,
    productName: product.name,
    timestamp: new Date().toISOString(),
    payment: {
      id: payment.id,
      payerAddress: payment.payerAddress,
      amount: product.amount,
      asset: product.asset,
      network: product.network,
      transactionHash: payment.transactionHash,
    },
    metadata,
  };

  // Include action result in payload
  if (actionType && actionResult) {
    webhookPayload.action = {
      type: actionType,
      status: actionResult.success ? 'success' : 'failed',
      result: actionResult.data,
    };
  }

  // Deliver webhook (fire and forget)
  deliverWebhook(webhookUrl, webhookSecret, webhookPayload, 3).catch((err) => {
    console.error('Product webhook delivery failed:', err);
  });
}

/**
 * GET /favicon.ico - Serve facilitator's custom favicon (or default)
 */
router.get('/favicon.ico', requireFacilitator, (req: Request, res: Response) => {
  const record = req.facilitator!;

  if (record.favicon) {
    // Decode base64 favicon and serve it
    const isDataUrl = record.favicon.startsWith('data:');
    let mimeType = 'image/x-icon';
    let base64Data = record.favicon;

    if (isDataUrl) {
      // Extract mime type and data from data URL
      const match = record.favicon.match(/^data:(image\/[^;]+);base64,(.+)$/);
      if (match) {
        mimeType = match[1];
        base64Data = match[2];
      }
    }

    const buffer = Buffer.from(base64Data, 'base64');
    res.set('Content-Type', mimeType);
    res.set('Cache-Control', 'public, max-age=86400'); // Cache for 1 day
    res.send(buffer);
    return;
  }

  // No custom favicon - redirect to default or serve a default
  // Serve the OpenFacilitator default favicon
  res.redirect('https://openfacilitator.io/favicon.ico');
});

/**
 * GET /supported - Get supported payment networks and tokens
 */
router.get('/supported', requireFacilitator, (req: Request, res: Response) => {
  const record = req.facilitator!;

  // Build facilitator config from database record
  const config: FacilitatorConfig = {
    id: record.id,
    name: record.name,
    subdomain: record.subdomain,
    customDomain: record.custom_domain || undefined,
    ownerAddress: record.owner_address as `0x${string}`,
    supportedChains: JSON.parse(record.supported_chains),
    supportedTokens: JSON.parse(record.supported_tokens) as TokenConfig[],
    createdAt: new Date(record.created_at),
    updatedAt: new Date(record.updated_at),
  };

  const facilitator = createFacilitator(config);
  const supported = facilitator.getSupported();

  // Build signers object with namespace prefixes
  const signers: Record<string, string[]> = {};

  // Add EVM signer address if available
  if (record.owner_address) {
    signers['eip155:*'] = [record.owner_address];
  }

  // Add feePayer for Solana networks and build signers
  if (record.encrypted_solana_private_key) {
    try {
      const solanaPrivateKey = decryptPrivateKey(record.encrypted_solana_private_key);
      const solanaFeePayer = getSolanaPublicKey(solanaPrivateKey);

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
 * POST /verify - Verify a payment payload
 */
router.post('/verify', requireFacilitator, async (req: Request, res: Response) => {
  try {
    const parsed = verifyRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: 'Invalid request',
        details: parsed.error.issues,
      });
      return;
    }

    // Normalize payload - accept both string and object format
    const paymentPayload = normalizePaymentPayload(parsed.data.paymentPayload);
    const { paymentRequirements } = parsed.data;
    const record = req.facilitator!;

    // Build facilitator config
    const config: FacilitatorConfig = {
      id: record.id,
      name: record.name,
      subdomain: record.subdomain,
      customDomain: record.custom_domain || undefined,
      ownerAddress: record.owner_address as `0x${string}`,
      supportedChains: JSON.parse(record.supported_chains),
      supportedTokens: JSON.parse(record.supported_tokens) as TokenConfig[],
      createdAt: new Date(record.created_at),
      updatedAt: new Date(record.updated_at),
    };

    const facilitator = createFacilitator(config);
    const result = await facilitator.verify(paymentPayload, paymentRequirements);

    // Log the verification attempt
    if (result.payer) {
      createTransaction({
        facilitator_id: record.id,
        type: 'verify',
        network: paymentRequirements.network,
        from_address: result.payer,
        to_address: record.owner_address,
        amount: getRequiredAmount(paymentRequirements),
        asset: paymentRequirements.asset,
        status: result.isValid ? 'success' : 'failed',
        error_message: result.invalidReason,
      });
    }

    res.json(result);
  } catch (error) {
    console.error('Verify error:', error);
    res.status(500).json({
      isValid: false,
      invalidReason: 'Internal server error',
    });
  }
});

/**
 * POST /settle - Settle a payment
 */
router.post('/settle', requireFacilitator, async (req: Request, res: Response) => {
  // Extract network early for error responses
  let networkForError = '';
  try {
    const parsed = settleRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: 'Invalid request',
        details: parsed.error.issues,
      });
      return;
    }

    // Normalize payload - accept both string and object format
    const paymentPayload = normalizePaymentPayload(parsed.data.paymentPayload);
    const { paymentRequirements } = parsed.data;
    networkForError = paymentRequirements.network;
    const record = req.facilitator!;

    // Build facilitator config
    const config: FacilitatorConfig = {
      id: record.id,
      name: record.name,
      subdomain: record.subdomain,
      customDomain: record.custom_domain || undefined,
      ownerAddress: record.owner_address as `0x${string}`,
      supportedChains: JSON.parse(record.supported_chains),
      supportedTokens: JSON.parse(record.supported_tokens) as TokenConfig[],
      createdAt: new Date(record.created_at),
      updatedAt: new Date(record.updated_at),
    };

    const facilitator = createFacilitator(config);

    // Determine which private key to use based on network (supports both v1 and CAIP-2 formats)
    const isSolana = isSolanaNetwork(paymentRequirements.network);
    const isStacks = isStacksNetwork(paymentRequirements.network);

    let privateKey: string | undefined;

    if (isSolana) {
      // Use Solana wallet for Solana networks
      if (record.encrypted_solana_private_key) {
        try {
          privateKey = decryptPrivateKey(record.encrypted_solana_private_key);
        } catch (e) {
          console.error('Failed to decrypt Solana private key:', e);
          res.status(500).json({
            success: false,
            transaction: '',
            payer: '',
            network: paymentRequirements.network,
            errorReason: 'Failed to decrypt Solana wallet',
          });
          return;
        }
      } else {
        res.status(400).json({
          success: false,
          transaction: '',
          payer: '',
          network: paymentRequirements.network,
          errorReason: 'Solana wallet not configured. Please set up a Solana wallet in the dashboard.',
        });
        return;
      }
    } else if (isStacks) {
      // Use Stacks wallet for Stacks networks
      if (record.encrypted_stacks_private_key) {
        try {
          privateKey = decryptPrivateKey(record.encrypted_stacks_private_key);
        } catch (e) {
          console.error('Failed to decrypt Stacks private key:', e);
          res.status(500).json({
            success: false,
            transaction: '',
            payer: '',
            network: paymentRequirements.network,
            errorReason: 'Failed to decrypt Stacks wallet',
          });
          return;
        }
      } else {
        res.status(400).json({
          success: false,
          transaction: '',
          payer: '',
          network: paymentRequirements.network,
          errorReason: 'Stacks wallet not configured. Please set up a Stacks wallet in the dashboard.',
        });
        return;
      }
    } else {
      // Use EVM wallet for EVM networks (Base, Ethereum, etc.)
      if (record.encrypted_private_key) {
        try {
          privateKey = decryptPrivateKey(record.encrypted_private_key);
        } catch (e) {
          console.error('Failed to decrypt EVM private key:', e);
          res.status(500).json({
            success: false,
            transaction: '',
            payer: '',
            network: paymentRequirements.network,
            errorReason: 'Failed to decrypt EVM wallet',
          });
          return;
        }
      } else {
        res.status(400).json({
          success: false,
          transaction: '',
          payer: '',
          network: paymentRequirements.network,
          errorReason: 'EVM wallet not configured. Please set up an EVM wallet in the dashboard.',
        });
        return;
      }
    }

    const result = await facilitator.settle(paymentPayload, paymentRequirements, privateKey);

    // Parse payload to get from address
    const decoded = Buffer.from(paymentPayload, 'base64').toString('utf-8');
    const parsedPayload = JSON.parse(decoded);
    
    // Extract from_address based on network type
    // Handle both flat and nested payload structures
    let fromAddress = 'unknown';
    if (isSolana) {
      // For Solana, the payer is the fee payer - use payTo from requirements as fallback
      // In x402, the payer signs the transaction, we don't have direct access to their address
      // Use the configured feePayer or payTo as identifier
      fromAddress = paymentRequirements.payTo || 'solana-payer';
    } else {
      // For EVM, use authorization.from - handle both nested and flat formats
      // Format 1: { authorization: { from: ... } }
      // Format 2: { payload: { authorization: { from: ... } } }
      const authorization = parsedPayload.authorization || parsedPayload.payload?.authorization;
      fromAddress = authorization?.from || 'unknown';
    }
    
    // Log the settlement attempt
    const txRecord = createTransaction({
      facilitator_id: record.id,
      type: 'settle',
      network: paymentRequirements.network,
      from_address: fromAddress,
      to_address: record.owner_address,
      amount: getRequiredAmount(paymentRequirements),
      asset: paymentRequirements.asset,
      status: result.success ? 'pending' : 'failed',
      transaction_hash: result.transaction,
      error_message: result.errorReason,
    });

    if (result.success && txRecord) {
      // Update to success after transaction is confirmed
      // TODO: Implement transaction confirmation monitoring
      updateTransactionStatus(txRecord.id, 'success');

      // Send webhook notification (fire and forget)
      if (record.webhook_url && record.webhook_secret) {
        sendSettlementWebhook(
          record.webhook_url,
          record.webhook_secret,
          record.id,
          {
            id: txRecord.id,
            fromAddress: fromAddress,
            toAddress: record.owner_address,
            amount: getRequiredAmount(paymentRequirements),
            asset: paymentRequirements.asset,
            network: paymentRequirements.network,
            transactionHash: result.transaction || null,
          }
        );
      }
    }

    res.json(result);
  } catch (error) {
    console.error('Settle error:', error);
    res.status(500).json({
      success: false,
      transaction: '',
      payer: '',
      network: networkForError,
      errorReason: 'Internal server error',
    });
  }
});

// ============= PRODUCTS PUBLIC ROUTES =============
// Note: These routes do NOT use requireFacilitator middleware
// because they need to work on localhost (no subdomain).
// Instead, we look up the facilitator from the product.

/**
 * GET /pay/:productId - Serve the payment page (HTML) or handle x402 protocol (JSON)
 *
 * Content negotiation:
 * - Accept: text/html (or browser) → renders payment UI
 * - Accept: application/json (or X-Payment header) → x402 protocol
 *
 * x402 flow:
 * - No X-Payment header → 402 with payment requirements
 * - With X-Payment header → verify, settle, record payment, return success
 */
router.get('/pay/:productId', async (req: Request, res: Response) => {
  // Try to get product by ID first, then by slug if we have facilitator context
  const facilitatorId = req.facilitator?.id;
  let product = getProductById(req.params.productId);
  if (!product && facilitatorId) {
    product = getProductBySlug(facilitatorId, req.params.productId);
  }

  const acceptHeader = req.get('Accept') || '';
  const paymentHeader = req.get('X-Payment');
  const wantsJson = acceptHeader.includes('application/json') || paymentHeader;

  // Handle not found
  if (!product) {
    if (wantsJson) {
      res.status(404).json({ error: 'Product not found' });
    } else {
      res.status(404).send(`
        <!DOCTYPE html>
        <html><head><title>Not Found</title></head>
        <body style="font-family: system-ui; text-align: center; padding: 50px;">
          <h1>Product Not Found</h1>
          <p>This product doesn't exist or has been deleted.</p>
        </body></html>
      `);
    }
    return;
  }

  const record = getFacilitatorById(product.facilitator_id);

  if (!record) {
    if (wantsJson) {
      res.status(404).json({ error: 'Facilitator not found' });
    } else {
      res.status(404).send(`
        <!DOCTYPE html>
        <html><head><title>Not Found</title></head>
        <body style="font-family: system-ui; text-align: center; padding: 50px;">
          <h1>Facilitator Not Found</h1>
          <p>The facilitator for this product no longer exists.</p>
        </body></html>
      `);
    }
    return;
  }

  if (!product.active) {
    if (wantsJson) {
      res.status(410).json({ error: 'Product is inactive' });
    } else {
      res.status(410).send(`
        <!DOCTYPE html>
        <html><head><title>Inactive</title></head>
        <body style="font-family: system-ui; text-align: center; padding: 50px;">
          <h1>Product Inactive</h1>
          <p>This product is no longer active.</p>
        </body></html>
      `);
    }
    return;
  }

  // === Check for valid access cookie (if access_ttl is set) ===
  const cookies = parseCookies(req.get('Cookie'));
  const accessToken = cookies[`x402_access_${product.id}`];
  const hasValidAccess = accessToken && product.access_ttl > 0 && verifyAccessToken(accessToken, product.id);

  // === x402 Protocol Handler ===
  if (wantsJson) {
    // Build facilitator URL
    const facilitatorUrl = record.custom_domain
      ? `https://${record.custom_domain}`
      : `https://${record.subdomain}.openfacilitator.io`;

    // Check if this is a Solana network
    const isSolanaNet = product.network === 'solana' ||
                        product.network === 'solana-mainnet' ||
                        product.network === 'solana-devnet' ||
                        product.network.startsWith('solana:');

    // Build payment requirements (x402 v2 with CAIP-2 network identifier)
    const caip2Network = networkToCaip2[product.network] || product.network;
    const productResourceUrl = `https://${record.custom_domain || record.subdomain + '.openfacilitator.io'}/pay/${product.id}`;
    const paymentRequirements: Record<string, unknown> = {
      scheme: 'exact',
      network: caip2Network,
      amount: product.amount,
      asset: product.asset,
      payTo: product.pay_to_address,
      maxTimeoutSeconds: 300,
    };

    // For Solana, add fee payer
    if (isSolanaNet && record.encrypted_solana_private_key) {
      try {
        const solanaPrivateKey = decryptPrivateKey(record.encrypted_solana_private_key);
        const solanaFeePayer = getSolanaPublicKey(solanaPrivateKey);
        paymentRequirements.extra = { feePayer: solanaFeePayer };
      } catch (e) {
        console.error('Failed to get Solana fee payer:', e);
        res.status(500).json({ error: 'Solana wallet not configured properly' });
        return;
      }
    } else if (isSolanaNet) {
      res.status(500).json({ error: 'Solana wallet not configured for this facilitator' });
      return;
    }

    // No payment provided - check for valid access or return 402
    if (!paymentHeader) {
      // If user has valid access from a previous payment, serve content directly
      if (hasValidAccess) {
        // For proxy type: forward to target
        if (product.link_type === 'proxy' && product.success_redirect_url) {
          const headersForward = JSON.parse(product.headers_forward || '[]') as string[];
          const forwardHeaders: Record<string, string> = {
            'Content-Type': req.get('Content-Type') || 'application/json',
          };
          for (const header of headersForward) {
            const value = req.get(header);
            if (value) forwardHeaders[header] = value;
          }
          try {
            const targetResponse = await fetch(product.success_redirect_url, {
              method: product.method || 'GET',
              headers: forwardHeaders,
            });
            const targetContentType = targetResponse.headers.get('Content-Type') || 'application/json';
            const targetBody = await targetResponse.text();
            res.setHeader('Content-Type', targetContentType);
            res.setHeader('X-Access-Granted', 'cookie');
            res.status(targetResponse.status).send(targetBody);
            return;
          } catch (proxyError) {
            console.error('[x402 Proxy] Error forwarding request:', proxyError);
            res.status(502).json({ error: 'Proxy error', message: 'Failed to forward to target' });
            return;
          }
        }
        // For redirect type: return the redirect URL
        if (product.link_type === 'redirect' && product.success_redirect_url) {
          res.json({ success: true, redirectUrl: product.success_redirect_url, accessGranted: 'cookie' });
          return;
        }
        // For payment type with valid access: just confirm access
        res.json({ success: true, accessGranted: 'cookie', message: 'Access granted via previous payment' });
        return;
      }

      // Parse required fields for the response
      const productRequiredFields: RequiredFieldDefinition[] = JSON.parse(product.required_fields || '[]');

      res.status(402).json({
        x402Version: 2,
        accepts: [paymentRequirements],
        resource: { url: productResourceUrl },
        error: 'Payment Required',
        message: product.description || product.name,
        requiredFields: productRequiredFields.length > 0 ? productRequiredFields : undefined,
      });
      return;
    }

    // Payment provided - verify and settle
    try {
      // Parse required fields for validation
      const productRequiredFields: RequiredFieldDefinition[] = JSON.parse(product.required_fields || '[]');

      // Parse and validate payment metadata from header
      let paymentMetadata: Record<string, unknown> = {};
      const metadataHeader = req.get('X-Payment-Metadata');

      if (metadataHeader) {
        const headerParsed = paymentMetadataHeaderSchema.safeParse(metadataHeader);
        if (!headerParsed.success) {
          res.status(400).json({
            error: 'Invalid X-Payment-Metadata header',
            details: headerParsed.error.issues,
          });
          return;
        }
        paymentMetadata = headerParsed.data;
      }

      // Validate required fields using dynamic Zod schema
      if (productRequiredFields.length > 0) {
        const metadataSchema = buildMetadataSchema(productRequiredFields);
        const validationResult = metadataSchema.safeParse(paymentMetadata);

        if (!validationResult.success) {
          res.status(400).json({
            error: 'Invalid or missing required fields',
            details: validationResult.error.issues.map(issue => ({
              field: issue.path.join('.'),
              message: issue.message,
            })),
            requiredFields: productRequiredFields,
            hint: 'Include required fields in X-Payment-Metadata header (base64-encoded JSON or plain JSON)',
          });
          return;
        }
        // Use validated data
        paymentMetadata = validationResult.data;
      }

      // Decode payment payload
      let paymentPayload: unknown;
      try {
        const decoded = Buffer.from(paymentHeader, 'base64').toString('utf-8');
        paymentPayload = JSON.parse(decoded);
      } catch {
        res.status(400).json({ error: 'Invalid X-Payment header encoding' });
        return;
      }

      // Verify payment with facilitator
      const verifyResponse = await fetch(`${facilitatorUrl}/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          x402Version: 2,
          paymentPayload,
          paymentRequirements,
        }),
      });

      const verifyResult = (await verifyResponse.json()) as {
        valid?: boolean;
        invalidReason?: string;
        payer?: string;
      };

      if (!verifyResult.valid) {
        res.status(402).json({
          x402Version: 2,
          error: 'Payment verification failed',
          reason: verifyResult.invalidReason,
          accepts: [paymentRequirements],
        });
        return;
      }

      // Settle payment
      const settleResponse = await fetch(`${facilitatorUrl}/settle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          x402Version: 2,
          paymentPayload,
          paymentRequirements,
        }),
      });

      const settleResult = (await settleResponse.json()) as {
        success?: boolean;
        transaction?: string;
        errorReason?: string;
        payer?: string;
      };

      if (!settleResult.success) {
        res.status(402).json({
          x402Version: 2,
          error: 'Payment settlement failed',
          reason: settleResult.errorReason,
          accepts: [paymentRequirements],
        });
        return;
      }

      // Record the payment with metadata
      const payerAddress = settleResult.payer || verifyResult.payer || 'unknown';
      const payment = createProductPayment({
        product_id: product.id,
        payer_address: payerAddress,
        amount: product.amount,
        transaction_hash: settleResult.transaction,
        status: 'success',
        metadata: paymentMetadata,
      });

      // Set access cookie if access_ttl is configured
      if (product.access_ttl > 0) {
        const expiresAt = Math.floor(Date.now() / 1000) + product.access_ttl;
        const token = createAccessToken(product.id, expiresAt);
        res.setHeader('Set-Cookie', `x402_access_${product.id}=${token}; Path=/; Max-Age=${product.access_ttl}; HttpOnly; SameSite=Lax${process.env.NODE_ENV === 'production' ? '; Secure' : ''}`);
      }

      // Fire webhook and execute actions if configured
      if (settleResult.transaction) {
        deliverProductWebhook({
          product: {
            id: product.id,
            name: product.name,
            amount: product.amount,
            asset: product.asset,
            network: product.network,
            webhook_id: product.webhook_id,
            webhook_url: product.webhook_url,
            webhook_secret: product.webhook_secret,
          },
          facilitator: {
            id: record.id,
            webhook_url: record.webhook_url,
            webhook_secret: record.webhook_secret,
          },
          payment: {
            id: payment.id,
            payerAddress,
            transactionHash: settleResult.transaction,
          },
        });
      }

      // Handle response based on product type
      if (product.link_type === 'proxy' && product.success_redirect_url) {
        // For proxy type: forward request to target URL and return response
        const headersForward = JSON.parse(product.headers_forward || '[]') as string[];
        const forwardHeaders: Record<string, string> = {
          'Content-Type': req.get('Content-Type') || 'application/json',
        };

        for (const header of headersForward) {
          const value = req.get(header);
          if (value) {
            forwardHeaders[header] = value;
          }
        }

        try {
          const targetResponse = await fetch(product.success_redirect_url, {
            method: product.method || 'GET',
            headers: forwardHeaders,
            body: ['GET', 'HEAD'].includes(product.method || 'GET') ? undefined : JSON.stringify(req.body),
          });

          const targetContentType = targetResponse.headers.get('Content-Type') || 'application/json';
          const targetBody = await targetResponse.text();

          res.setHeader('Content-Type', targetContentType);
          res.setHeader('X-Payment-TxHash', settleResult.transaction || '');
          res.status(targetResponse.status).send(targetBody);
          return;
        } catch (proxyError) {
          console.error('[x402 Proxy] Error forwarding request:', proxyError);
          res.status(502).json({
            error: 'Proxy error',
            message: 'Payment succeeded but failed to forward to target',
            transactionHash: settleResult.transaction,
          });
          return;
        }
      }

      // Return success with payment details (for payment and redirect types)
      const response: Record<string, unknown> = {
        success: true,
        transactionHash: settleResult.transaction,
        paymentId: payment.id,
        message: 'Payment successful',
      };

      // Include redirect URL for redirect type
      if (product.link_type === 'redirect' && product.success_redirect_url) {
        response.redirectUrl = product.success_redirect_url;
      }

      res.json(response);
      return;

    } catch (error) {
      console.error('[x402 Payment] Error:', error);
      res.status(500).json({
        error: 'Payment processing error',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
      return;
    }
  }

  // === Check for valid access cookie (browser flow) ===
  console.log('[Browser Flow] Checking access:', { productId: product.id, linkType: product.link_type, accessTtl: product.access_ttl, hasValidAccess, cookieName: `x402_access_${product.id}`, hasCookie: !!accessToken });
  if (hasValidAccess) {
    console.log('[Browser Flow] Valid access cookie found, handling product type:', product.link_type);
    // For proxy type: fetch and return the content directly
    if (product.link_type === 'proxy' && product.success_redirect_url) {
      try {
        const targetResponse = await fetch(product.success_redirect_url, {
          method: 'GET',
          headers: { 'Accept': '*/*' },
        });
        const targetContentType = targetResponse.headers.get('Content-Type') || 'text/html';
        const targetBody = await targetResponse.text();
        res.setHeader('Content-Type', targetContentType);
        res.status(targetResponse.status).send(targetBody);
        return;
      } catch (proxyError) {
        console.error('[Browser Proxy] Error:', proxyError);
        // Fall through to payment page on error
      }
    }
    // For redirect type: redirect to success URL
    if (product.link_type === 'redirect' && product.success_redirect_url) {
      res.redirect(product.success_redirect_url);
      return;
    }
    // For payment type: show simple "already paid" page
    if (product.link_type === 'payment') {
      res.send(`
        <!DOCTYPE html>
        <html><head><title>Access Granted</title>
        <style>body{font-family:system-ui;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#f0fdf4;}
        .card{background:#fff;padding:48px;border-radius:12px;text-align:center;box-shadow:0 4px 6px rgba(0,0,0,0.1);}
        h1{color:#16a34a;margin-bottom:16px;}p{color:#666;}</style></head>
        <body><div class="card"><h1>✓ Access Granted</h1><p>You have already paid for this content.</p></div></body></html>
      `);
      return;
    }
  }

  // === HTML Payment Page ===
  // Set CSP headers for the HTML page
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://unpkg.com https://cdn.jsdelivr.net; style-src 'self' 'unsafe-inline'; connect-src 'self' https://*.openfacilitator.io https://api.mainnet-beta.solana.com https://api.devnet.solana.com https://*.solana.com https://*.helius-rpc.com https://*.helius.xyz https://*.quicknode.com https://*.alchemy.com https://cdn.jsdelivr.net; img-src 'self' data:; font-src 'self';"
  );

  // Format amount for display
  const amountNum = parseFloat(product.amount) / 1e6;
  const formattedAmount = amountNum.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  // Generate the payment page HTML (Stripe-like two-column layout)
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Pay ${record.name} - $${formattedAmount}</title>
  <link rel="icon" href="/favicon.ico">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      min-height: 100vh;
      display: flex;
    }

    /* Left Column - Primary Blue */
    .left-col {
      width: 50%;
      min-height: 100vh;
      background: #0B64F4;
      color: #fff;
      padding: 48px;
      display: flex;
      justify-content: flex-end;
    }
    .left-inner {
      width: 100%;
      max-width: 420px;
      display: flex;
      flex-direction: column;
      padding-right: 48px;
    }
    .brand {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 48px;
    }
    .brand-logo {
      width: 32px;
      height: 32px;
    }
    .brand-name {
      font-size: 18px;
      font-weight: 600;
      color: rgba(255,255,255,0.9);
    }
    .back-link {
      color: rgba(255,255,255,0.6);
      text-decoration: none;
      font-size: 14px;
      display: flex;
      align-items: center;
      gap: 6px;
      margin-bottom: 24px;
    }
    .back-link:hover { color: #fff; }
    .payment-header {
      font-size: 14px;
      color: rgba(255,255,255,0.6);
      margin-bottom: 8px;
    }
    .payment-title {
      font-size: 20px;
      font-weight: 500;
      margin-bottom: 4px;
    }
    .payment-amount {
      font-size: 36px;
      font-weight: 600;
      margin-bottom: 32px;
    }
    .payment-amount span {
      font-size: 18px;
      color: rgba(255,255,255,0.6);
      font-weight: 400;
    }

    .order-summary {
      background: rgba(255,255,255,0.05);
      border-radius: 12px;
      padding: 20px;
      margin-bottom: 24px;
    }
    .order-item {
      display: flex;
      align-items: center;
      gap: 16px;
      padding-bottom: 16px;
      border-bottom: 1px solid rgba(255,255,255,0.1);
      margin-bottom: 16px;
    }
    .order-icon {
      width: 48px;
      height: 48px;
      border-radius: 8px;
      background: rgba(255,255,255,0.1);
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .order-icon img {
      width: 32px;
      height: 32px;
      border-radius: 6px;
    }
    .order-details {
      flex: 1;
    }
    .order-name {
      font-weight: 500;
      margin-bottom: 2px;
    }
    .order-desc {
      font-size: 13px;
      color: rgba(255,255,255,0.5);
    }
    .order-price {
      font-weight: 500;
    }
    .order-total {
      display: flex;
      justify-content: space-between;
      font-size: 15px;
    }
    .order-total-label {
      color: rgba(255,255,255,0.7);
    }
    .order-total-value {
      font-weight: 600;
    }

    .network-badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      background: rgba(255,255,255,0.1);
      padding: 6px 12px;
      border-radius: 20px;
      font-size: 12px;
    }
    .network-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: #00d4aa;
    }

    .spacer { flex: 1; }

    .powered-by {
      font-size: 12px;
      color: rgba(255,255,255,0.4);
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .powered-by a {
      color: rgba(255,255,255,0.6);
      text-decoration: none;
      display: flex;
      align-items: center;
      gap: 4px;
    }
    .powered-by a:hover { color: #fff; }

    /* Right Column - White */
    .right-col {
      width: 50%;
      min-height: 100vh;
      background: #fff;
      color: #1a1a1a;
      padding: 48px;
      display: flex;
    }
    .right-inner {
      width: 100%;
      max-width: 420px;
      display: flex;
      flex-direction: column;
      padding-left: 48px;
    }
    .right-header {
      font-size: 20px;
      font-weight: 600;
      margin-bottom: 32px;
      color: #1a1a1a;
    }

    .wallet-section {
      background: #f7f7f7;
      border-radius: 12px;
      padding: 24px;
      margin-bottom: 24px;
    }
    .wallet-label {
      font-size: 13px;
      color: #666;
      margin-bottom: 12px;
      font-weight: 500;
    }
    .wallet-status {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .wallet-icon {
      width: 40px;
      height: 40px;
      background: #fff;
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
      border: 1px solid #e5e5e5;
    }
    .wallet-address {
      font-family: monospace;
      font-size: 14px;
      color: #333;
    }
    .wallet-placeholder {
      color: #999;
      font-size: 14px;
    }

    .pay-button {
      width: 100%;
      padding: 16px 24px;
      font-size: 16px;
      font-weight: 600;
      border: none;
      border-radius: 8px;
      cursor: pointer;
      background: #0B64F4;
      color: white;
      transition: background 0.2s;
      margin-bottom: 16px;
    }
    .pay-button:hover:not(:disabled) {
      background: #0A5AD8;
    }
    .pay-button:disabled {
      background: #ccc;
      cursor: not-allowed;
    }

    .status {
      padding: 12px 16px;
      border-radius: 8px;
      font-size: 14px;
      margin-bottom: 16px;
    }
    .status.error { background: #fef2f2; color: #dc2626; border: 1px solid #fecaca; }
    .status.success { background: #f0fdf4; color: #16a34a; border: 1px solid #bbf7d0; }
    .status.pending { background: #fffbeb; color: #d97706; border: 1px solid #fde68a; }

    .info-text {
      font-size: 13px;
      color: #666;
      line-height: 1.5;
    }

    .spinner {
      display: inline-block;
      width: 16px;
      height: 16px;
      border: 2px solid rgba(255,255,255,0.3);
      border-top-color: white;
      border-radius: 50%;
      animation: spin 1s linear infinite;
      margin-right: 8px;
      vertical-align: middle;
    }
    @keyframes spin { to { transform: rotate(360deg); } }

    /* Mobile responsive */
    @media (max-width: 768px) {
      body { flex-direction: column; }
      .left-col, .right-col {
        width: 100%;
        min-height: auto;
        padding: 32px 24px;
        justify-content: flex-start;
      }
      .left-inner, .right-inner {
        max-width: 100%;
        padding: 0;
      }
      .left-col { padding-bottom: 24px; }
      .spacer { display: none; }
    }
  </style>
</head>
<body>
  <div class="left-col">
    <div class="left-inner">
      <div class="brand">
        <svg class="brand-logo" viewBox="0 0 180 180" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect width="180" height="180" rx="24" fill="rgba(255,255,255,0.2)"/>
          <path d="M130 94.9983C130 119.998 112.5 132.498 91.7 139.748C90.6108 140.117 89.4277 140.1 88.35 139.698C67.5 132.498 50 119.998 50 94.9983V59.9983C50 58.6723 50.5268 57.4005 51.4645 56.4628C52.4021 55.5251 53.6739 54.9983 55 54.9983C65 54.9983 77.5 48.9983 86.2 41.3983C87.2593 40.4933 88.6068 39.9961 90 39.9961C91.3932 39.9961 92.7407 40.4933 93.8 41.3983C102.55 49.0483 115 54.9983 125 54.9983C126.326 54.9983 127.598 55.5251 128.536 56.4628C129.473 57.4005 130 58.6723 130 59.9983V94.9983Z" stroke="white" stroke-width="10" stroke-linecap="round" stroke-linejoin="round"/>
          <path d="M75 90L85 100L105 80" stroke="white" stroke-width="10" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        <span class="brand-name">OpenFacilitator</span>
      </div>

    <div class="payment-header">Pay ${record.name}</div>
    <div class="payment-title">${product.name}</div>
    <div class="payment-amount">$${formattedAmount} <span>USDC</span></div>

    <div class="order-summary">
      <div class="order-item">
        <div class="order-icon">
          <img src="/favicon.ico" alt="" onerror="this.parentElement.innerHTML='<svg width=\\'24\\' height=\\'24\\' viewBox=\\'0 0 24 24\\' fill=\\'none\\'><rect width=\\'24\\' height=\\'24\\' rx=\\'4\\' fill=\\'#635bff\\'/><path d=\\'M12 6L16 9V15L12 18L8 15V9L12 6Z\\' stroke=\\'white\\' stroke-width=\\'1.5\\' fill=\\'none\\'/></svg>'">
        </div>
        <div class="order-details">
          <div class="order-name">${product.name}</div>
          <div class="order-desc">${product.description || 'One-time payment'}</div>
        </div>
        <div class="order-price">$${formattedAmount}</div>
      </div>
      <div class="order-total">
        <span class="order-total-label">Total due today</span>
        <span class="order-total-value">$${formattedAmount}</span>
      </div>
    </div>

    <div class="network-badge">
      <span class="network-dot"></span>
      ${product.network.charAt(0).toUpperCase() + product.network.slice(1)} Network
    </div>

    <div class="spacer"></div>

    <div class="powered-by">
      Powered by
      <a href="https://openfacilitator.io" target="_blank">
        <svg width="16" height="16" viewBox="0 0 180 180" fill="none"><rect width="180" height="180" rx="24" fill="rgba(255,255,255,0.3)"/><path d="M130 94.9983C130 119.998 112.5 132.498 91.7 139.748C90.6108 140.117 89.4277 140.1 88.35 139.698C67.5 132.498 50 119.998 50 94.9983V59.9983C50 58.6723 50.5268 57.4005 51.4645 56.4628C52.4021 55.5251 53.6739 54.9983 55 54.9983C65 54.9983 77.5 48.9983 86.2 41.3983C87.2593 40.4933 88.6068 39.9961 90 39.9961C91.3932 39.9961 92.7407 40.4933 93.8 41.3983C102.55 49.0483 115 54.9983 125 54.9983C126.326 54.9983 127.598 55.5251 128.536 56.4628C129.473 57.4005 130 58.6723 130 59.9983V94.9983Z" stroke="white" stroke-width="10" stroke-linecap="round" stroke-linejoin="round"/><path d="M75 90L85 100L105 80" stroke="white" stroke-width="10" stroke-linecap="round" stroke-linejoin="round"/></svg>
        OpenFacilitator
      </a>
      <span style="color: rgba(255,255,255,0.3);">|</span>
      <a href="https://github.com/rawgroundbeef/openfacilitator" target="_blank" title="View source on GitHub">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="rgba(255,255,255,0.6)"><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/></svg>
        Open Source
      </a>
    </div>
    </div>
  </div>

  <div class="right-col">
    <div class="right-inner">
      <div class="right-header">Pay with crypto</div>

      <div class="wallet-section">
        <div class="wallet-label">Wallet</div>
        <div class="wallet-status" id="walletStatus">
          <div class="wallet-icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#666" stroke-width="2"><rect x="2" y="6" width="20" height="14" rx="2"/><path d="M16 14a2 2 0 100-4 2 2 0 000 4z"/></svg>
          </div>
          <span class="wallet-placeholder">No wallet connected</span>
        </div>
      </div>

      <div id="status" class="status" style="display: none;"></div>

      <button id="payButton" class="pay-button">
        Connect Wallet
      </button>

      <p class="info-text">
        You'll be asked to connect your wallet and sign a payment authorization.
        The payment will be processed on the ${product.network.charAt(0).toUpperCase() + product.network.slice(1)} network using USDC.
      </p>
    </div>
  </div>

  <script>
    const PRODUCT_ID = '${product.id}';
    const AMOUNT = '${product.amount}';
    const ASSET = '${product.asset}';
    const NETWORK = '${product.network}';
    const PRODUCT_TYPE = '${product.link_type}';
    const ACCESS_TTL = ${product.access_ttl || 0};
    const SUCCESS_REDIRECT = ${product.success_redirect_url ? `'${product.success_redirect_url}'` : 'null'};
    const IS_SOLANA = NETWORK === 'solana' || NETWORK === 'solana-devnet' || NETWORK.startsWith('solana:');

    // Debug logging
    console.log('[PaymentPage] PRODUCT_TYPE:', PRODUCT_TYPE, 'ACCESS_TTL:', ACCESS_TTL, 'SUCCESS_REDIRECT:', SUCCESS_REDIRECT);

    // Capture URL params for metadata (e.g., pendingId for facilitator creation)
    const urlParams = new URLSearchParams(window.location.search);
    const METADATA = {};
    if (urlParams.get('pendingId')) METADATA.pendingId = urlParams.get('pendingId');

    function showStatus(message, type) {
      const el = document.getElementById('status');
      el.textContent = message;
      el.className = 'status ' + type;
      el.style.display = 'block';
    }

    let connectedAddress = null;

    function setLoading(loading, text) {
      const btn = document.getElementById('payButton');
      btn.disabled = loading;
      if (loading) {
        btn.innerHTML = '<span class="spinner"></span>' + (text || 'Processing...');
      } else if (connectedAddress) {
        btn.innerHTML = 'Pay $${formattedAmount}';
      } else {
        btn.innerHTML = 'Connect Wallet';
      }
    }

    function updateWalletUI(address) {
      const walletStatus = document.getElementById('walletStatus');
      if (address) {
        const short = address.slice(0, 6) + '...' + address.slice(-4);
        walletStatus.innerHTML = \`
          <div class="wallet-icon" style="background: #f0fdf4; border-color: #bbf7d0;">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#16a34a" stroke-width="2"><path d="M20 6L9 17l-5-5"/></svg>
          </div>
          <span class="wallet-address">\${short}</span>
        \`;
      }
    }

    // Solana wallet detection
    function getSolanaWallet() {
      if (window.phantom?.solana?.isPhantom) return window.phantom.solana;
      if (window.solana?.isPhantom) return window.solana;
      if (window.solflare?.isSolflare) return window.solflare;
      return null;
    }

    async function connectAndPaySolana() {
      try {
        const wallet = getSolanaWallet();
        if (!wallet) {
          showStatus('Please install Phantom or another Solana wallet', 'error');
          return;
        }

        setLoading(true, 'Connecting...');

        // Connect to wallet
        const resp = await wallet.connect();
        const userPublicKey = resp.publicKey.toString();
        connectedAddress = userPublicKey;
        updateWalletUI(userPublicKey);

        setLoading(true, 'Preparing payment...');

        // Get payment requirements
        const reqRes = await fetch('/pay/' + PRODUCT_ID + '/requirements');
        if (!reqRes.ok) throw new Error('Failed to get payment requirements');
        const { paymentRequirements, facilitatorUrl, solanaRpcUrl } = await reqRes.json();

        // Get USDC mint and recipient from requirements
        const usdcMint = ASSET;
        const recipientAddress = paymentRequirements.payTo;
        const feePayer = paymentRequirements.extra?.feePayer;

        if (!feePayer) {
          throw new Error('Facilitator fee payer not configured');
        }

        // Use Solana web3.js via CDN for transaction building
        // We need to dynamically load it
        if (!window.solanaWeb3) {
          setLoading(true, 'Loading Solana libraries...');
          await loadSolanaLibs();
        }

        const { Connection, PublicKey, Transaction, SystemProgram } = window.solanaWeb3;
        const { getAssociatedTokenAddress, createTransferInstruction, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID, createAssociatedTokenAccountInstruction, getAccount } = window.splToken;

        // Connect to Solana RPC
        const rpcUrl = solanaRpcUrl || 'https://api.mainnet-beta.solana.com';
        const connection = new Connection(rpcUrl, 'confirmed');

        // Get recent blockhash
        const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');

        // Get token accounts
        const senderPubkey = new PublicKey(userPublicKey);
        const recipientPubkey = new PublicKey(recipientAddress);
        const feePayerPubkey = new PublicKey(feePayer);
        const mintPubkey = new PublicKey(usdcMint);

        const senderATA = await getAssociatedTokenAddress(mintPubkey, senderPubkey);
        const recipientATA = await getAssociatedTokenAddress(mintPubkey, recipientPubkey);

        // Build transaction
        const transaction = new Transaction();
        transaction.recentBlockhash = blockhash;
        transaction.lastValidBlockHeight = lastValidBlockHeight;
        transaction.feePayer = feePayerPubkey; // Facilitator pays fees

        // Check if recipient ATA exists, create if not
        try {
          await getAccount(connection, recipientATA);
        } catch {
          // Add instruction to create recipient's ATA
          transaction.add(
            createAssociatedTokenAccountInstruction(
              feePayerPubkey,  // payer
              recipientATA,    // ata
              recipientPubkey, // owner
              mintPubkey       // mint
            )
          );
        }

        // Add transfer instruction
        transaction.add(
          createTransferInstruction(
            senderATA,                    // source
            recipientATA,                 // destination
            senderPubkey,                 // owner
            BigInt(AMOUNT)                // amount (atomic units)
          )
        );

        setLoading(true, 'Waiting for signature...');

        // Sign with user's wallet (partial sign - fee payer will sign on backend)
        const signedTransaction = await wallet.signTransaction(transaction);

        // Serialize the transaction
        const serializedTx = signedTransaction.serialize({
          requireAllSignatures: false,
          verifySignatures: false
        });
        const signedTxBase64 = btoa(String.fromCharCode(...serializedTx));

        // Build payment payload for Solana
        const paymentPayload = {
          x402Version: 2,
          scheme: 'exact',
          network: NETWORK,
          payload: {
            transaction: signedTxBase64
          }
        };

        setLoading(true, 'Processing payment...');

        // Submit to facilitator
        const settleRes = await fetch(facilitatorUrl + '/settle', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            x402Version: 2,
            paymentPayload: btoa(JSON.stringify(paymentPayload)),
            paymentRequirements
          })
        });

        const settleResult = await settleRes.json();

        if (settleResult.success) {
          // Record the payment (include credentials so cookie is stored)
          const completeRes = await fetch('/pay/' + PRODUCT_ID + '/complete', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'same-origin',
            body: JSON.stringify({
              payerAddress: userPublicKey,
              transactionHash: settleResult.transaction,
              metadata: Object.keys(METADATA).length > 0 ? METADATA : undefined
            })
          });
          console.log('Complete response:', completeRes.status, 'headers:', [...completeRes.headers.entries()]);

          showStatus('Payment successful!', 'success');

          // For proxy links with access_ttl, reload to show the proxied content
          if (PRODUCT_TYPE === 'proxy' && ACCESS_TTL > 0) {
            console.log('Proxy link with access_ttl, reloading in 1.5s...');
            showStatus('Payment successful! Loading content...', 'success');
            setTimeout(() => { window.location.reload(); }, 1500);
          } else if (PRODUCT_TYPE === 'redirect' && SUCCESS_REDIRECT) {
            setTimeout(() => { window.location.href = SUCCESS_REDIRECT; }, 2000);
          } else if (SUCCESS_REDIRECT) {
            setTimeout(() => { window.location.href = SUCCESS_REDIRECT; }, 2000);
          }
        } else {
          throw new Error(settleResult.errorReason || 'Payment failed');
        }
      } catch (err) {
        console.error('Payment error:', err);
        showStatus(err.message || 'Payment failed', 'error');
      } finally {
        setLoading(false);
      }
    }

    async function loadSolanaLibs() {
      // Load Solana web3.js from jsDelivr
      await new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/@solana/web3.js@1.95.3/lib/index.iife.min.js';
        script.onload = () => {
          console.log('Solana web3.js loaded');
          resolve();
        };
        script.onerror = (e) => {
          console.error('Failed to load Solana web3.js:', e);
          reject(new Error('Failed to load Solana web3.js'));
        };
        document.head.appendChild(script);
      });

      // SPL Token program IDs
      const TOKEN_PROGRAM_ID = new window.solanaWeb3.PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA');
      const ASSOCIATED_TOKEN_PROGRAM_ID = new window.solanaWeb3.PublicKey('ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL');

      // Implement SPL Token functions inline (no external dependency needed)
      window.splToken = {
        TOKEN_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID,

        // Get associated token address (PDA derivation)
        getAssociatedTokenAddress: async function(mint, owner) {
          const [address] = await window.solanaWeb3.PublicKey.findProgramAddress(
            [owner.toBuffer(), TOKEN_PROGRAM_ID.toBuffer(), mint.toBuffer()],
            ASSOCIATED_TOKEN_PROGRAM_ID
          );
          return address;
        },

        // Create transfer instruction
        createTransferInstruction: function(source, destination, owner, amount) {
          const keys = [
            { pubkey: source, isSigner: false, isWritable: true },
            { pubkey: destination, isSigner: false, isWritable: true },
            { pubkey: owner, isSigner: true, isWritable: false }
          ];
          // Transfer instruction = index 3, followed by u64 amount (little endian)
          const data = new Uint8Array(9);
          data[0] = 3; // Transfer instruction
          const amountBigInt = BigInt(amount);
          for (let i = 0; i < 8; i++) {
            data[1 + i] = Number((amountBigInt >> BigInt(i * 8)) & BigInt(0xff));
          }
          return new window.solanaWeb3.TransactionInstruction({
            keys,
            programId: TOKEN_PROGRAM_ID,
            data: data
          });
        },

        // Create associated token account instruction
        createAssociatedTokenAccountInstruction: function(payer, associatedToken, owner, mint) {
          const keys = [
            { pubkey: payer, isSigner: true, isWritable: true },
            { pubkey: associatedToken, isSigner: false, isWritable: true },
            { pubkey: owner, isSigner: false, isWritable: false },
            { pubkey: mint, isSigner: false, isWritable: false },
            { pubkey: window.solanaWeb3.SystemProgram.programId, isSigner: false, isWritable: false },
            { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false }
          ];
          return new window.solanaWeb3.TransactionInstruction({
            keys,
            programId: ASSOCIATED_TOKEN_PROGRAM_ID,
            data: new Uint8Array(0)
          });
        },

        // Check if token account exists
        getAccount: async function(connection, address) {
          const info = await connection.getAccountInfo(address);
          if (!info) throw new Error('Account not found');
          return info;
        }
      };

      console.log('SPL Token helpers initialized');
    }

    async function connectAndPayEVM() {
      try {
        // Check for wallet
        if (!window.ethereum) {
          showStatus('Please install MetaMask or another Web3 wallet', 'error');
          return;
        }

        setLoading(true, 'Connecting...');

        // Request account access
        const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
        const userAddress = accounts[0];
        connectedAddress = userAddress;
        updateWalletUI(userAddress);

        // Switch to correct network
        const targetChainId = NETWORK === 'base' ? '0x2105' : '0x14a34'; // 8453 or 84532
        try {
          await window.ethereum.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: targetChainId }]
          });
        } catch (switchError) {
          // Chain not added, try to add it
          if (switchError.code === 4902) {
            const chainConfig = NETWORK === 'base' ? {
              chainId: '0x2105',
              chainName: 'Base',
              nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
              rpcUrls: ['https://mainnet.base.org'],
              blockExplorerUrls: ['https://basescan.org']
            } : {
              chainId: '0x14a34',
              chainName: 'Base Sepolia',
              nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
              rpcUrls: ['https://sepolia.base.org'],
              blockExplorerUrls: ['https://sepolia.basescan.org']
            };
            await window.ethereum.request({
              method: 'wallet_addEthereumChain',
              params: [chainConfig]
            });
          } else {
            throw switchError;
          }
        }

        setLoading(true, 'Preparing payment...');

        // Get payment requirements
        const reqRes = await fetch('/pay/' + PRODUCT_ID + '/requirements');
        if (!reqRes.ok) throw new Error('Failed to get payment requirements');
        const { paymentRequirements } = await reqRes.json();

        // Build ERC-20 transfer call data
        // transfer(address to, uint256 amount) selector: 0xa9059cbb
        const toAddress = paymentRequirements.payTo.slice(2).padStart(64, '0');
        const amountHex = BigInt(AMOUNT).toString(16).padStart(64, '0');
        const transferData = '0xa9059cbb' + toAddress + amountHex;

        setLoading(true, 'Confirm in wallet...');

        // Send transaction directly - user pays gas
        const txHash = await window.ethereum.request({
          method: 'eth_sendTransaction',
          params: [{
            from: userAddress,
            to: ASSET,
            data: transferData,
          }]
        });

        setLoading(true, 'Waiting for confirmation...');

        // Poll for transaction receipt
        let receipt = null;
        for (let i = 0; i < 60; i++) {
          receipt = await window.ethereum.request({
            method: 'eth_getTransactionReceipt',
            params: [txHash]
          });
          if (receipt) break;
          await new Promise(r => setTimeout(r, 2000));
        }

        if (!receipt) {
          throw new Error('Transaction not confirmed in time');
        }

        if (receipt.status !== '0x1') {
          throw new Error('Transaction failed');
        }

        // Record the payment (include credentials so cookie is stored)
        const completeRes = await fetch('/pay/' + PRODUCT_ID + '/complete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'same-origin',
          body: JSON.stringify({
            payerAddress: userAddress,
            transactionHash: txHash,
            metadata: Object.keys(METADATA).length > 0 ? METADATA : undefined
          })
        });
        console.log('Complete response:', completeRes.status, 'headers:', [...completeRes.headers.entries()]);

        showStatus('Payment successful!', 'success');

        // For proxy links with access_ttl, reload to show the proxied content
        if (PRODUCT_TYPE === 'proxy' && ACCESS_TTL > 0) {
          console.log('Proxy link with access_ttl, reloading in 1.5s...');
          showStatus('Payment successful! Loading content...', 'success');
          setTimeout(() => { window.location.reload(); }, 1500);
        } else if (PRODUCT_TYPE === 'redirect' && SUCCESS_REDIRECT) {
          setTimeout(() => { window.location.href = SUCCESS_REDIRECT; }, 2000);
        } else if (SUCCESS_REDIRECT) {
          setTimeout(() => { window.location.href = SUCCESS_REDIRECT; }, 2000);
        }
      } catch (err) {
        console.error('Payment error:', err);
        showStatus(err.message || 'Payment failed', 'error');
      } finally {
        setLoading(false);
      }
    }

    function connectAndPay() {
      if (IS_SOLANA) {
        connectAndPaySolana();
      } else {
        connectAndPayEVM();
      }
    }

    // Attach event listener (CSP-safe, no inline onclick)
    document.getElementById('payButton').addEventListener('click', connectAndPay);
  </script>
</body>
</html>`;

  res.type('html').send(html);
});

/**
 * GET /pay/:productId/requirements - Get payment requirements for a product
 */
router.get('/pay/:productId/requirements', async (req: Request, res: Response) => {
  // Try to get product by ID first, then by slug if we have facilitator context
  const facilitatorId = req.facilitator?.id;
  let product = getProductById(req.params.productId);
  if (!product && facilitatorId) {
    product = getProductBySlug(facilitatorId, req.params.productId);
  }

  if (!product) {
    res.status(404).json({ error: 'Product not found' });
    return;
  }

  const record = getFacilitatorById(product.facilitator_id);

  if (!record) {
    res.status(404).json({ error: 'Facilitator not found' });
    return;
  }

  if (!product.active) {
    res.status(410).json({ error: 'Product is inactive' });
    return;
  }

  // Build facilitator URL
  const facilitatorUrl = record.custom_domain
    ? `https://${record.custom_domain}`
    : `https://${record.subdomain}.openfacilitator.io`;

  // Check if this is a Solana network
  const isSolanaNet = product.network === 'solana' ||
                      product.network === 'solana-mainnet' ||
                      product.network === 'solana-devnet' ||
                      product.network.startsWith('solana:');

  // Build payment requirements (x402 v2 with CAIP-2 network identifier)
  const caip2Network = networkToCaip2[product.network] || product.network;
  const paymentRequirements: Record<string, unknown> = {
    scheme: 'exact',
    network: caip2Network,
    amount: product.amount,
    asset: product.asset,
    payTo: product.pay_to_address, // Payments go to user-specified address
    maxTimeoutSeconds: 300,
  };

  // For Solana, we also need the fee payer (facilitator's Solana wallet pays gas)
  let solanaRpcUrl: string | undefined;
  if (isSolanaNet && record.encrypted_solana_private_key) {
    try {
      const solanaPrivateKey = decryptPrivateKey(record.encrypted_solana_private_key);
      const solanaFeePayer = getSolanaPublicKey(solanaPrivateKey);
      // Fee payer is the facilitator wallet (pays gas), but payTo is the product's address (receives funds)
      paymentRequirements.extra = { feePayer: solanaFeePayer };

      // Provide RPC URL for frontend
      solanaRpcUrl = product.network === 'solana-devnet'
        ? (process.env.SOLANA_DEVNET_RPC_URL || 'https://api.devnet.solana.com')
        : (process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com');
    } catch (e) {
      console.error('Failed to get Solana fee payer:', e);
      res.status(500).json({ error: 'Solana wallet not configured properly' });
      return;
    }
  } else if (isSolanaNet) {
    res.status(500).json({ error: 'Solana wallet not configured for this facilitator' });
    return;
  }

  res.json({
    paymentRequirements,
    facilitatorUrl,
    ...(solanaRpcUrl && { solanaRpcUrl }),
  });
});

/**
 * POST /pay/:productId/complete - Record a completed payment
 */
router.post('/pay/:productId/complete', async (req: Request, res: Response) => {
  // Try to get product by ID first, then by slug if we have facilitator context
  const facilitatorId = req.facilitator?.id;
  let product = getProductById(req.params.productId);
  if (!product && facilitatorId) {
    product = getProductBySlug(facilitatorId, req.params.productId);
  }

  if (!product) {
    res.status(404).json({ error: 'Product not found' });
    return;
  }

  const record = getFacilitatorById(product.facilitator_id);

  if (!record) {
    res.status(404).json({ error: 'Facilitator not found' });
    return;
  }

  const { payerAddress, transactionHash, errorMessage, metadata } = req.body;

  if (!payerAddress) {
    res.status(400).json({ error: 'Payer address is required' });
    return;
  }

  // Create payment record with metadata
  const payment = createProductPayment({
    product_id: product.id,
    payer_address: payerAddress,
    amount: product.amount,
    transaction_hash: transactionHash,
    status: transactionHash ? 'success' : 'failed',
    error_message: errorMessage,
    metadata: metadata as Record<string, unknown> | undefined,
  });

  // Set access cookie if access_ttl is configured and payment was successful
  console.log('[Complete] Checking cookie:', { productId: product.id, hasTransactionHash: !!transactionHash, accessTtl: product.access_ttl });
  if (transactionHash && product.access_ttl > 0) {
    const expiresAt = Math.floor(Date.now() / 1000) + product.access_ttl;
    const token = createAccessToken(product.id, expiresAt);
    const cookieValue = `x402_access_${product.id}=${token}; Path=/; Max-Age=${product.access_ttl}; HttpOnly; SameSite=Lax${process.env.NODE_ENV === 'production' ? '; Secure' : ''}`;
    console.log('[Complete] Setting cookie:', { cookieName: `x402_access_${product.id}`, maxAge: product.access_ttl, expiresAt });
    res.setHeader('Set-Cookie', cookieValue);
  }

  // Fire webhook and execute actions if configured
  if (transactionHash) {
    deliverProductWebhook({
      product: {
        id: product.id,
        name: product.name,
        amount: product.amount,
        asset: product.asset,
        network: product.network,
        webhook_id: product.webhook_id,
        webhook_url: product.webhook_url,
        webhook_secret: product.webhook_secret,
      },
      facilitator: {
        id: record.id,
        webhook_url: record.webhook_url,
        webhook_secret: record.webhook_secret,
      },
      payment: {
        id: payment.id,
        payerAddress,
        transactionHash,
      },
      metadata,
    });
  }

  res.json({
    success: true,
    paymentId: payment.id,
  });
});

// =============================================================================
// Proxy URLs (API Gateway with x402)
// =============================================================================

/**
 * Helper to build proxy URL payment requirements
 */
function buildProxyUrlPaymentRequirements(
  proxyUrl: { price_network: string; price_amount: string; price_asset: string; pay_to_address: string; name: string; slug: string },
  record: { encrypted_solana_private_key: string | null; custom_domain: string | null; subdomain: string }
): { requirements: Record<string, unknown>; error?: string } {
  const facilitatorUrl = record.custom_domain
    ? `https://${record.custom_domain}`
    : `https://${record.subdomain}.openfacilitator.io`;

  const isSolana = proxyUrl.price_network === 'solana' ||
                   proxyUrl.price_network === 'solana-mainnet' ||
                   proxyUrl.price_network === 'solana-devnet' ||
                   proxyUrl.price_network.startsWith('solana:');

  // Convert to CAIP-2 network identifier for x402 v2
  const caip2Network = networkToCaip2[proxyUrl.price_network] || proxyUrl.price_network;
  const requirements: Record<string, unknown> = {
    scheme: 'exact',
    network: caip2Network,
    amount: proxyUrl.price_amount,
    asset: proxyUrl.price_asset,
    payTo: proxyUrl.pay_to_address,
    maxTimeoutSeconds: 300,
  };

  if (isSolana && record.encrypted_solana_private_key) {
    try {
      const solanaPrivateKey = decryptPrivateKey(record.encrypted_solana_private_key);
      const solanaFeePayer = getSolanaPublicKey(solanaPrivateKey);
      requirements.extra = { feePayer: solanaFeePayer };
    } catch (e) {
      return { requirements, error: 'Solana wallet not configured properly' };
    }
  } else if (isSolana) {
    return { requirements, error: 'Solana wallet not configured for this facilitator' };
  }

  return { requirements };
}

/**
 * Generate the proxy URL payment page HTML
 */
function generateProxyUrlPaymentPage(
  proxyUrl: { id: string; name: string; slug: string; target_url: string; price_amount: string; price_asset: string; price_network: string },
  record: { name: string; subdomain: string; custom_domain: string | null }
): string {
  const amountNum = parseFloat(proxyUrl.price_amount) / 1e6;
  const formattedAmount = amountNum.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const networkDisplay = proxyUrl.price_network.charAt(0).toUpperCase() + proxyUrl.price_network.slice(1);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Access ${proxyUrl.name} - $${formattedAmount}</title>
  <link rel="icon" href="/favicon.ico">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      min-height: 100vh;
      display: flex;
    }
    .left-col {
      width: 50%;
      min-height: 100vh;
      background: #0B64F4;
      color: #fff;
      padding: 48px;
      display: flex;
      justify-content: flex-end;
    }
    .left-inner {
      width: 100%;
      max-width: 420px;
      display: flex;
      flex-direction: column;
      padding-right: 48px;
    }
    .brand {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 48px;
    }
    .brand-logo {
      width: 32px;
      height: 32px;
    }
    .brand-name {
      font-size: 18px;
      font-weight: 600;
      color: rgba(255,255,255,0.9);
    }
    .payment-header {
      font-size: 14px;
      color: rgba(255,255,255,0.6);
      margin-bottom: 8px;
    }
    .payment-title {
      font-size: 20px;
      font-weight: 500;
      margin-bottom: 4px;
    }
    .payment-amount {
      font-size: 36px;
      font-weight: 600;
      margin-bottom: 32px;
    }
    .payment-amount span {
      font-size: 18px;
      color: rgba(255,255,255,0.6);
      font-weight: 400;
    }
    .order-summary {
      background: rgba(255,255,255,0.05);
      border-radius: 12px;
      padding: 20px;
      margin-bottom: 24px;
    }
    .order-item {
      display: flex;
      align-items: center;
      gap: 16px;
      padding-bottom: 16px;
      border-bottom: 1px solid rgba(255,255,255,0.1);
      margin-bottom: 16px;
    }
    .order-icon {
      width: 48px;
      height: 48px;
      border-radius: 8px;
      background: rgba(255,255,255,0.1);
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .order-details { flex: 1; }
    .order-name { font-weight: 500; margin-bottom: 2px; }
    .order-desc { font-size: 13px; color: rgba(255,255,255,0.5); }
    .order-price { font-weight: 500; }
    .order-total {
      display: flex;
      justify-content: space-between;
      font-size: 15px;
    }
    .order-total-label { color: rgba(255,255,255,0.7); }
    .order-total-value { font-weight: 600; }
    .network-badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      background: rgba(255,255,255,0.1);
      padding: 6px 12px;
      border-radius: 20px;
      font-size: 12px;
    }
    .network-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: #00d4aa;
    }
    .spacer { flex: 1; }
    .powered-by {
      font-size: 12px;
      color: rgba(255,255,255,0.4);
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .powered-by a {
      color: rgba(255,255,255,0.6);
      text-decoration: none;
      display: flex;
      align-items: center;
      gap: 4px;
    }
    .powered-by a:hover { color: #fff; }
    .right-col {
      width: 50%;
      min-height: 100vh;
      background: #fff;
      color: #1a1a1a;
      padding: 48px;
      display: flex;
    }
    .right-inner {
      width: 100%;
      max-width: 420px;
      display: flex;
      flex-direction: column;
      padding-left: 48px;
    }
    .right-header {
      font-size: 20px;
      font-weight: 600;
      margin-bottom: 32px;
      color: #1a1a1a;
    }
    .wallet-section {
      background: #f7f7f7;
      border-radius: 12px;
      padding: 24px;
      margin-bottom: 24px;
    }
    .wallet-label {
      font-size: 13px;
      color: #666;
      margin-bottom: 12px;
      font-weight: 500;
    }
    .wallet-status {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .wallet-icon {
      width: 40px;
      height: 40px;
      background: #fff;
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
      border: 1px solid #e5e5e5;
    }
    .wallet-placeholder {
      color: #999;
      font-size: 14px;
    }
    .wallet-address {
      font-family: monospace;
      font-size: 14px;
      color: #333;
    }
    .pay-button {
      width: 100%;
      padding: 16px 24px;
      font-size: 16px;
      font-weight: 600;
      border: none;
      border-radius: 8px;
      cursor: pointer;
      background: #0B64F4;
      color: white;
      transition: background 0.2s;
      margin-bottom: 16px;
    }
    .pay-button:hover:not(:disabled) { background: #0A5AD8; }
    .pay-button:disabled { background: #ccc; cursor: not-allowed; }
    .status {
      padding: 12px 16px;
      border-radius: 8px;
      font-size: 14px;
      margin-bottom: 16px;
    }
    .status.error { background: #fef2f2; color: #dc2626; border: 1px solid #fecaca; }
    .status.success { background: #f0fdf4; color: #16a34a; border: 1px solid #bbf7d0; }
    .status.pending { background: #fffbeb; color: #d97706; border: 1px solid #fde68a; }
    .info-text {
      font-size: 13px;
      color: #666;
      line-height: 1.5;
    }
    .spinner {
      display: inline-block;
      width: 16px;
      height: 16px;
      border: 2px solid rgba(255,255,255,0.3);
      border-top-color: white;
      border-radius: 50%;
      animation: spin 1s linear infinite;
      margin-right: 8px;
      vertical-align: middle;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
    @media (max-width: 768px) {
      body { flex-direction: column; }
      .left-col, .right-col {
        width: 100%;
        min-height: auto;
        padding: 32px 24px;
        justify-content: flex-start;
      }
      .left-inner, .right-inner {
        max-width: 100%;
        padding: 0;
      }
      .left-col { padding-bottom: 24px; }
      .spacer { display: none; }
    }
  </style>
</head>
<body>
  <div class="left-col">
    <div class="left-inner">
      <div class="brand">
        <svg class="brand-logo" viewBox="0 0 180 180" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect width="180" height="180" rx="24" fill="rgba(255,255,255,0.2)"/>
          <path d="M130 94.9983C130 119.998 112.5 132.498 91.7 139.748C90.6108 140.117 89.4277 140.1 88.35 139.698C67.5 132.498 50 119.998 50 94.9983V59.9983C50 58.6723 50.5268 57.4005 51.4645 56.4628C52.4021 55.5251 53.6739 54.9983 55 54.9983C65 54.9983 77.5 48.9983 86.2 41.3983C87.2593 40.4933 88.6068 39.9961 90 39.9961C91.3932 39.9961 92.7407 40.4933 93.8 41.3983C102.55 49.0483 115 54.9983 125 54.9983C126.326 54.9983 127.598 55.5251 128.536 56.4628C129.473 57.4005 130 58.6723 130 59.9983V94.9983Z" stroke="white" stroke-width="10" stroke-linecap="round" stroke-linejoin="round"/>
          <path d="M75 90L85 100L105 80" stroke="white" stroke-width="10" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        <span class="brand-name">${record.name}</span>
      </div>

      <div class="payment-header">Pay to access</div>
      <div class="payment-title">${proxyUrl.name}</div>
      <div class="payment-amount">$${formattedAmount} <span>USDC</span></div>

      <div class="order-summary">
        <div class="order-item">
          <div class="order-icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2">
              <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
              <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
            </svg>
          </div>
          <div class="order-details">
            <div class="order-name">${proxyUrl.name}</div>
            <div class="order-desc">One-time access</div>
          </div>
          <div class="order-price">$${formattedAmount}</div>
        </div>
        <div class="order-total">
          <span class="order-total-label">Total</span>
          <span class="order-total-value">$${formattedAmount}</span>
        </div>
      </div>

      <div class="network-badge">
        <span class="network-dot"></span>
        ${networkDisplay} Network
      </div>

      <div class="spacer"></div>

      <div class="powered-by">
        Powered by
        <a href="https://openfacilitator.io" target="_blank">
          <svg width="16" height="16" viewBox="0 0 180 180" fill="none"><rect width="180" height="180" rx="24" fill="rgba(255,255,255,0.3)"/><path d="M130 94.9983C130 119.998 112.5 132.498 91.7 139.748C90.6108 140.117 89.4277 140.1 88.35 139.698C67.5 132.498 50 119.998 50 94.9983V59.9983C50 58.6723 50.5268 57.4005 51.4645 56.4628C52.4021 55.5251 53.6739 54.9983 55 54.9983C65 54.9983 77.5 48.9983 86.2 41.3983C87.2593 40.4933 88.6068 39.9961 90 39.9961C91.3932 39.9961 92.7407 40.4933 93.8 41.3983C102.55 49.0483 115 54.9983 125 54.9983C126.326 54.9983 127.598 55.5251 128.536 56.4628C129.473 57.4005 130 58.6723 130 59.9983V94.9983Z" stroke="white" stroke-width="10" stroke-linecap="round" stroke-linejoin="round"/><path d="M75 90L85 100L105 80" stroke="white" stroke-width="10" stroke-linecap="round" stroke-linejoin="round"/></svg>
          OpenFacilitator
        </a>
      </div>
    </div>
  </div>

  <div class="right-col">
    <div class="right-inner">
      <div class="right-header">Pay with crypto</div>

      <div class="wallet-section">
        <div class="wallet-label">Wallet</div>
        <div class="wallet-status" id="walletStatus">
          <div class="wallet-icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#666" stroke-width="2"><rect x="2" y="6" width="20" height="14" rx="2"/><path d="M16 14a2 2 0 100-4 2 2 0 000 4z"/></svg>
          </div>
          <span class="wallet-placeholder">No wallet connected</span>
        </div>
      </div>

      <div id="status" class="status" style="display: none;"></div>

      <button id="payButton" class="pay-button">Connect Wallet</button>

      <p class="info-text">
        You'll be asked to connect your wallet and sign a payment authorization.
        After payment, you'll be redirected to access the content.
      </p>
    </div>
  </div>

  <script>
    const SLUG = '${proxyUrl.slug}';
    const AMOUNT = '${proxyUrl.price_amount}';
    const ASSET = '${proxyUrl.price_asset}';
    const NETWORK = '${proxyUrl.price_network}';
    const TARGET_URL = '${proxyUrl.target_url}';
    const IS_SOLANA = NETWORK === 'solana' || NETWORK === 'solana-devnet' || NETWORK.startsWith('solana:');

    function showStatus(message, type) {
      const el = document.getElementById('status');
      el.textContent = message;
      el.className = 'status ' + type;
      el.style.display = 'block';
    }

    let connectedAddress = null;

    function setLoading(loading, text) {
      const btn = document.getElementById('payButton');
      btn.disabled = loading;
      if (loading) {
        btn.innerHTML = '<span class="spinner"></span>' + (text || 'Processing...');
      } else if (connectedAddress) {
        btn.innerHTML = 'Pay $${formattedAmount}';
      } else {
        btn.innerHTML = 'Connect Wallet';
      }
    }

    function updateWalletUI(address) {
      const walletStatus = document.getElementById('walletStatus');
      if (address) {
        const short = address.slice(0, 6) + '...' + address.slice(-4);
        walletStatus.innerHTML = \`
          <div class="wallet-icon" style="background: #f0fdf4; border-color: #bbf7d0;">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#16a34a" stroke-width="2"><path d="M20 6L9 17l-5-5"/></svg>
          </div>
          <span class="wallet-address">\${short}</span>
        \`;
      }
    }

    function getSolanaWallet() {
      if (window.phantom?.solana?.isPhantom) return window.phantom.solana;
      if (window.solana?.isPhantom) return window.solana;
      if (window.solflare?.isSolflare) return window.solflare;
      return null;
    }

    async function loadSolanaLibs() {
      if (window.solanaWeb3 && window.splToken) return;

      // Load Solana web3.js
      await new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/@solana/web3.js@1.95.3/lib/index.iife.min.js';
        script.onload = resolve;
        script.onerror = reject;
        document.head.appendChild(script);
      });

      // Implement SPL Token functions inline (no external dependency needed)
      const TOKEN_PROGRAM_ID = new window.solanaWeb3.PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA');
      const ASSOCIATED_TOKEN_PROGRAM_ID = new window.solanaWeb3.PublicKey('ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL');

      window.splToken = {
        TOKEN_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID,
        getAssociatedTokenAddress: async function(mint, owner) {
          const [address] = await window.solanaWeb3.PublicKey.findProgramAddress(
            [owner.toBuffer(), TOKEN_PROGRAM_ID.toBuffer(), mint.toBuffer()],
            ASSOCIATED_TOKEN_PROGRAM_ID
          );
          return address;
        },
        createTransferInstruction: function(source, destination, owner, amount) {
          const keys = [
            { pubkey: source, isSigner: false, isWritable: true },
            { pubkey: destination, isSigner: false, isWritable: true },
            { pubkey: owner, isSigner: true, isWritable: false }
          ];
          const data = new Uint8Array(9);
          data[0] = 3;
          const amountBigInt = BigInt(amount);
          for (let i = 0; i < 8; i++) {
            data[1 + i] = Number((amountBigInt >> BigInt(i * 8)) & BigInt(0xff));
          }
          return new window.solanaWeb3.TransactionInstruction({
            keys,
            programId: TOKEN_PROGRAM_ID,
            data: data
          });
        },
        createAssociatedTokenAccountInstruction: function(payer, associatedToken, owner, mint) {
          const keys = [
            { pubkey: payer, isSigner: true, isWritable: true },
            { pubkey: associatedToken, isSigner: false, isWritable: true },
            { pubkey: owner, isSigner: false, isWritable: false },
            { pubkey: mint, isSigner: false, isWritable: false },
            { pubkey: window.solanaWeb3.SystemProgram.programId, isSigner: false, isWritable: false },
            { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false }
          ];
          return new window.solanaWeb3.TransactionInstruction({
            keys,
            programId: ASSOCIATED_TOKEN_PROGRAM_ID,
            data: new Uint8Array(0)
          });
        },
        getAccount: async function(connection, address) {
          const info = await connection.getAccountInfo(address);
          if (!info) throw new Error('Account not found');
          return info;
        }
      };
    }

    async function connectAndPaySolana() {
      try {
        const wallet = getSolanaWallet();
        if (!wallet) {
          showStatus('Please install Phantom or another Solana wallet', 'error');
          return;
        }

        setLoading(true, 'Connecting...');

        const resp = await wallet.connect();
        const userPublicKey = resp.publicKey.toString();
        connectedAddress = userPublicKey;
        updateWalletUI(userPublicKey);

        setLoading(true, 'Preparing payment...');

        const reqRes = await fetch('/u/' + SLUG + '/requirements');
        if (!reqRes.ok) throw new Error('Failed to get payment requirements');
        const { paymentRequirements, facilitatorUrl, solanaRpcUrl } = await reqRes.json();

        const usdcMint = ASSET;
        const recipientAddress = paymentRequirements.payTo;
        const feePayer = paymentRequirements.extra?.feePayer;

        if (!feePayer) throw new Error('Facilitator fee payer not configured');

        if (!window.solanaWeb3) {
          setLoading(true, 'Loading Solana libraries...');
          await loadSolanaLibs();
        }

        const { Connection, PublicKey, Transaction } = window.solanaWeb3;
        const { getAssociatedTokenAddress, createTransferInstruction, createAssociatedTokenAccountInstruction, getAccount } = window.splToken;

        const rpcUrl = solanaRpcUrl || 'https://api.mainnet-beta.solana.com';
        const connection = new Connection(rpcUrl, 'confirmed');

        const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');

        const senderPubkey = new PublicKey(userPublicKey);
        const recipientPubkey = new PublicKey(recipientAddress);
        const feePayerPubkey = new PublicKey(feePayer);
        const mintPubkey = new PublicKey(usdcMint);

        const senderATA = await getAssociatedTokenAddress(mintPubkey, senderPubkey);
        const recipientATA = await getAssociatedTokenAddress(mintPubkey, recipientPubkey);

        const transaction = new Transaction();
        transaction.recentBlockhash = blockhash;
        transaction.lastValidBlockHeight = lastValidBlockHeight;
        transaction.feePayer = feePayerPubkey;

        try {
          await getAccount(connection, recipientATA);
        } catch {
          transaction.add(
            createAssociatedTokenAccountInstruction(feePayerPubkey, recipientATA, recipientPubkey, mintPubkey)
          );
        }

        transaction.add(
          createTransferInstruction(senderATA, recipientATA, senderPubkey, BigInt(AMOUNT))
        );

        setLoading(true, 'Waiting for signature...');

        const signedTransaction = await wallet.signTransaction(transaction);
        const serializedTx = signedTransaction.serialize({ requireAllSignatures: false, verifySignatures: false });
        const signedTxBase64 = btoa(String.fromCharCode(...serializedTx));

        const paymentPayload = {
          x402Version: 2,
          scheme: 'exact',
          network: NETWORK,
          payload: { transaction: signedTxBase64 }
        };

        setLoading(true, 'Processing payment...');

        const settleRes = await fetch(facilitatorUrl + '/settle', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            x402Version: 2,
            paymentPayload: btoa(JSON.stringify(paymentPayload)),
            paymentRequirements
          })
        });

        const settleResult = await settleRes.json();

        if (settleResult.success) {
          showStatus('Payment successful! Redirecting...', 'success');
          setTimeout(() => {
            window.location.href = TARGET_URL;
          }, 1500);
        } else {
          throw new Error(settleResult.errorReason || 'Settlement failed');
        }
      } catch (error) {
        console.error('Payment error:', error);
        showStatus(error.message || 'Payment failed', 'error');
        setLoading(false);
      }
    }

    async function connectAndPayEVM() {
      try {
        if (!window.ethereum) {
          showStatus('Please install MetaMask or another Ethereum wallet', 'error');
          return;
        }

        setLoading(true, 'Connecting...');

        const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
        const userAddress = accounts[0];
        connectedAddress = userAddress;
        updateWalletUI(userAddress);

        setLoading(true, 'Preparing payment...');

        const reqRes = await fetch('/u/' + SLUG + '/requirements');
        if (!reqRes.ok) throw new Error('Failed to get payment requirements');
        const { paymentRequirements, facilitatorUrl } = await reqRes.json();

        const deadline = Math.floor(Date.now() / 1000) + 3600;
        const nonce = '0x' + [...crypto.getRandomValues(new Uint8Array(32))].map(b => b.toString(16).padStart(2, '0')).join('');

        // Support both v2 (amount) and v1 (maxAmountRequired) formats
        const paymentAmount = paymentRequirements.amount || paymentRequirements.maxAmountRequired;
        const authorization = {
          from: userAddress,
          to: paymentRequirements.payTo,
          value: paymentAmount,
          validAfter: 0,
          validBefore: deadline,
          nonce: nonce
        };

        setLoading(true, 'Waiting for signature...');

        const domain = {
          name: 'USD Coin',
          version: '2',
          chainId: 8453,
          verifyingContract: ASSET
        };

        const types = {
          TransferWithAuthorization: [
            { name: 'from', type: 'address' },
            { name: 'to', type: 'address' },
            { name: 'value', type: 'uint256' },
            { name: 'validAfter', type: 'uint256' },
            { name: 'validBefore', type: 'uint256' },
            { name: 'nonce', type: 'bytes32' }
          ]
        };

        const signature = await window.ethereum.request({
          method: 'eth_signTypedData_v4',
          params: [userAddress, JSON.stringify({ types, primaryType: 'TransferWithAuthorization', domain, message: authorization })]
        });

        const paymentPayload = {
          x402Version: 2,
          scheme: 'exact',
          network: NETWORK,
          payload: { signature, authorization }
        };

        setLoading(true, 'Processing payment...');

        const settleRes = await fetch(facilitatorUrl + '/settle', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            x402Version: 2,
            paymentPayload: btoa(JSON.stringify(paymentPayload)),
            paymentRequirements
          })
        });

        const settleResult = await settleRes.json();

        if (settleResult.success) {
          showStatus('Payment successful! Redirecting...', 'success');
          setTimeout(() => {
            window.location.href = TARGET_URL;
          }, 1500);
        } else {
          throw new Error(settleResult.errorReason || 'Settlement failed');
        }
      } catch (error) {
        console.error('Payment error:', error);
        showStatus(error.message || 'Payment failed', 'error');
        setLoading(false);
      }
    }

    document.getElementById('payButton').addEventListener('click', () => {
      if (IS_SOLANA) {
        connectAndPaySolana();
      } else {
        connectAndPayEVM();
      }
    });
  </script>
</body>
</html>`;
}

/**
 * GET /u/:slug/requirements - Get payment requirements for a proxy URL
 */
router.get('/u/:slug/requirements', async (req: Request, res: Response) => {
  const facilitatorId = req.facilitator?.id;
  if (!facilitatorId) {
    res.status(500).json({ error: 'Facilitator context not available' });
    return;
  }

  const record = getFacilitatorById(facilitatorId);
  if (!record) {
    res.status(404).json({ error: 'Facilitator not found' });
    return;
  }

  const proxyUrl = getProxyUrlBySlug(facilitatorId, req.params.slug);
  if (!proxyUrl || !proxyUrl.active) {
    res.status(404).json({ error: 'URL not found' });
    return;
  }

  const facilitatorUrl = record.custom_domain
    ? `https://${record.custom_domain}`
    : `https://${record.subdomain}.openfacilitator.io`;

  const { requirements, error } = buildProxyUrlPaymentRequirements(proxyUrl, record);
  if (error) {
    res.status(500).json({ error });
    return;
  }

  res.json({
    paymentRequirements: requirements,
    facilitatorUrl,
    solanaRpcUrl: process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com',
  });
});

/**
 * ALL /u/:slug - Proxy endpoint with x402 payment
 *
 * Content negotiation:
 * - Accept: text/html (browser) → renders payment UI
 * - Accept: application/json (or X-Payment header) → x402 protocol
 */
router.all('/u/:slug', async (req: Request, res: Response) => {
  const facilitatorId = req.facilitator?.id;
  if (!facilitatorId) {
    res.status(500).json({ error: 'Facilitator context not available' });
    return;
  }

  const record = getFacilitatorById(facilitatorId);
  if (!record) {
    res.status(404).json({ error: 'Facilitator not found' });
    return;
  }

  const proxyUrl = getProxyUrlBySlug(facilitatorId, req.params.slug);
  if (!proxyUrl) {
    res.status(404).json({ error: 'URL not found' });
    return;
  }

  if (!proxyUrl.active) {
    res.status(410).json({ error: 'URL is inactive' });
    return;
  }

  // Content negotiation
  const acceptHeader = req.get('Accept') || '';
  const paymentHeader = req.get('X-Payment');
  const wantsJson = acceptHeader.includes('application/json') || paymentHeader;

  // Check method if not ANY (only for API requests, browsers always GET)
  if (wantsJson && proxyUrl.method !== 'ANY' && req.method !== proxyUrl.method) {
    res.status(405).json({ error: `Method ${req.method} not allowed. Expected ${proxyUrl.method}` });
    return;
  }

  const facilitatorUrl = record.custom_domain
    ? `https://${record.custom_domain}`
    : `https://${record.subdomain}.openfacilitator.io`;

  const { requirements: paymentRequirements, error: reqError } = buildProxyUrlPaymentRequirements(proxyUrl, record);
  if (reqError) {
    if (wantsJson) {
      res.status(500).json({ error: reqError });
    } else {
      res.status(500).send(`<html><body><h1>Error</h1><p>${reqError}</p></body></html>`);
    }
    return;
  }

  // === HTML Payment Page (for browsers) ===
  if (!wantsJson && !paymentHeader) {
    res.setHeader(
      'Content-Security-Policy',
      "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://unpkg.com https://cdn.jsdelivr.net; style-src 'self' 'unsafe-inline'; connect-src 'self' https://*.openfacilitator.io https://api.mainnet-beta.solana.com https://api.devnet.solana.com https://*.solana.com https://*.helius-rpc.com https://*.helius.xyz https://*.quicknode.com https://*.alchemy.com https://cdn.jsdelivr.net; img-src 'self' data:; font-src 'self';"
    );
    res.send(generateProxyUrlPaymentPage(proxyUrl, record));
    return;
  }

  // === x402 Protocol Handler (for API clients) ===
  if (!paymentHeader) {
    res.status(402).json({
      x402Version: 2,
      accepts: [paymentRequirements],
      resource: { url: `${facilitatorUrl}/u/${proxyUrl.slug}` },
      error: 'Payment Required',
      message: proxyUrl.name,
    });
    return;
  }

  // Payment provided - verify and settle
  try {
    let paymentPayload: unknown;
    try {
      const decoded = Buffer.from(paymentHeader, 'base64').toString('utf-8');
      paymentPayload = JSON.parse(decoded);
    } catch {
      res.status(400).json({ error: 'Invalid X-Payment header encoding' });
      return;
    }

    const verifyResponse = await fetch(`${facilitatorUrl}/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        x402Version: 2,
        paymentPayload,
        paymentRequirements,
      }),
    });

    const verifyResult = (await verifyResponse.json()) as {
      valid?: boolean;
      invalidReason?: string;
      payer?: string;
    };

    if (!verifyResult.valid) {
      res.status(402).json({
        x402Version: 2,
        error: 'Payment verification failed',
        reason: verifyResult.invalidReason,
        accepts: [paymentRequirements],
      });
      return;
    }

    const settleResponse = await fetch(`${facilitatorUrl}/settle`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        x402Version: 2,
        paymentPayload,
        paymentRequirements,
      }),
    });

    const settleResult = (await settleResponse.json()) as {
      success?: boolean;
      transaction?: string;
      errorReason?: string;
      payer?: string;
    };

    if (!settleResult.success) {
      res.status(402).json({
        x402Version: 2,
        error: 'Payment settlement failed',
        reason: settleResult.errorReason,
        accepts: [paymentRequirements],
      });
      return;
    }

    console.log(`[Proxy URL] Payment settled for ${proxyUrl.slug}: ${settleResult.transaction}`);

    // === Payment successful - forward request to target URL ===
    const headersForward = JSON.parse(proxyUrl.headers_forward) as string[];
    const forwardHeaders: Record<string, string> = {
      'Content-Type': req.get('Content-Type') || 'application/json',
    };

    for (const header of headersForward) {
      const value = req.get(header);
      if (value) {
        forwardHeaders[header] = value;
      }
    }

    const targetResponse = await fetch(proxyUrl.target_url, {
      method: req.method,
      headers: forwardHeaders,
      body: ['GET', 'HEAD'].includes(req.method) ? undefined : JSON.stringify(req.body),
    });

    const targetContentType = targetResponse.headers.get('Content-Type') || 'application/json';
    const targetBody = await targetResponse.text();

    res.setHeader('Content-Type', targetContentType);
    res.setHeader('X-Payment-TxHash', settleResult.transaction || '');

    res.status(targetResponse.status).send(targetBody);

  } catch (error) {
    console.error('[Proxy URL] Error:', error);
    res.status(500).json({
      error: 'Proxy error',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * Storefront by slug - Public endpoint for a specific storefront
 * Dual-interface: JSON for agents (Accept: application/json), HTML for browsers
 */
router.get('/store/:slug', requireFacilitator, (req: Request, res: Response) => {
  const facilitator = req.facilitator;
  if (!facilitator) {
    res.status(404).json({ error: 'Facilitator not found' });
    return;
  }

  const storefront = getStorefrontBySlug(facilitator.id, req.params.slug);
  if (!storefront || storefront.active !== 1) {
    res.status(404).json({ error: 'Storefront not found' });
    return;
  }

  const products = getStorefrontProducts(storefront.id);

  // Build base URL for products
  const baseUrl = process.env.NODE_ENV === 'development'
    ? `http://localhost:5002`
    : facilitator.custom_domain
      ? `https://${facilitator.custom_domain}`
      : `https://${facilitator.subdomain}.openfacilitator.io`;

  // Check if client wants JSON (agent/API request)
  const acceptHeader = req.headers.accept || '';
  const wantsJson = acceptHeader.includes('application/json');

  if (wantsJson) {
    // Return JSON for agents
    res.json({
      id: storefront.id,
      name: storefront.name,
      slug: storefront.slug,
      description: storefront.description,
      imageUrl: storefront.image_url,
      products: products.map(p => {
        const productUrl = p.slug ? `${baseUrl}/pay/${p.slug}` : `${baseUrl}/pay/${p.id}`;
        const requiredFields: RequiredFieldDefinition[] = JSON.parse(p.required_fields || '[]');
        return {
          id: p.id,
          name: p.name,
          description: p.description,
          imageUrl: p.image_url,
          price: p.amount,
          asset: p.asset,
          network: p.network,
          url: productUrl,
          groupName: p.group_name || undefined,
          requiredFields: requiredFields.length > 0 ? requiredFields : undefined,
        };
      }),
    });
    return;
  }

  // Return HTML for browsers
  const formatPrice = (amount: string, decimals = 6) => {
    const num = parseFloat(amount) / Math.pow(10, decimals);
    return num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  // Sort products so grouped items appear together
  const sortedProducts = [...products].sort((a, b) => {
    if (a.group_name && b.group_name) return a.group_name.localeCompare(b.group_name);
    if (a.group_name) return -1;
    if (b.group_name) return 1;
    return 0;
  });

  const productCards = sortedProducts.map(product => {
    const price = formatPrice(product.amount);
    const imageUrl = product.image_url || 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300"%3E%3Crect fill="%23f3f4f6" width="400" height="300"/%3E%3C/svg%3E';
    const productUrl = product.slug ? `${baseUrl}/pay/${product.slug}` : `${baseUrl}/pay/${product.id}`;
    const groupBadge = product.group_name ? `<span class="group-badge">${product.group_name}</span>` : '';

    return `
      <a href="${productUrl}" class="product-card">
        <div class="product-image">
          ${groupBadge}
          <img src="${imageUrl}" alt="${product.name}" onerror="this.src='data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 400 300%22%3E%3Crect fill=%22%23f3f4f6%22 width=%22400%22 height=%22300%22/%3E%3C/svg%3E'" />
        </div>
        <div class="product-info">
          <h3 class="product-name">${product.name}</h3>
          ${product.description ? `<p class="product-description">${product.description}</p>` : ''}
          <div class="product-price">$${price} USDC</div>
        </div>
      </a>
    `;
  }).join('');

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${storefront.name} - ${facilitator.name}</title>
  ${facilitator.favicon ? `<link rel="icon" href="data:image/png;base64,${facilitator.favicon}" type="image/png">` : ''}
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #fafafa; color: #111; min-height: 100vh; }
    .header { background: #fff; border-bottom: 1px solid #eee; padding: 1.5rem 2rem; position: sticky; top: 0; z-index: 100; }
    .header-content { max-width: 1200px; margin: 0 auto; display: flex; align-items: center; justify-content: space-between; }
    .store-name { font-size: 1.5rem; font-weight: 700; }
    .store-description { color: #666; font-size: 0.875rem; margin-top: 0.25rem; }
    .powered-by { font-size: 0.75rem; color: #888; }
    .powered-by a { color: #666; text-decoration: none; }
    .container { max-width: 1200px; margin: 0 auto; padding: 2rem; }
    .product-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 1.5rem; }
    .product-card { background: #fff; border-radius: 12px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.08); transition: transform 0.2s, box-shadow 0.2s; text-decoration: none; color: inherit; }
    .product-card:hover { transform: translateY(-4px); box-shadow: 0 8px 24px rgba(0,0,0,0.12); }
    .product-image { aspect-ratio: 4/3; overflow: hidden; background: #f3f4f6; position: relative; }
    .product-image img { width: 100%; height: 100%; object-fit: cover; }
    .group-badge { position: absolute; top: 0.5rem; left: 0.5rem; background: rgba(0,0,0,0.7); color: #fff; font-size: 0.7rem; padding: 0.25rem 0.5rem; border-radius: 4px; z-index: 1; }
    .product-info { padding: 1rem; }
    .product-name { font-size: 1rem; font-weight: 600; margin-bottom: 0.25rem; }
    .product-description { font-size: 0.875rem; color: #666; margin-bottom: 0.5rem; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
    .product-price { font-size: 1rem; font-weight: 700; }
    .empty-state { text-align: center; padding: 4rem 2rem; color: #666; }
    .empty-state h2 { font-size: 1.25rem; margin-bottom: 0.5rem; color: #333; }
    @media (max-width: 640px) { .product-grid { grid-template-columns: repeat(2, 1fr); gap: 1rem; } .container { padding: 1rem; } }
  </style>
</head>
<body>
  <header class="header">
    <div class="header-content">
      <div>
        <h1 class="store-name">${storefront.name}</h1>
        ${storefront.description ? `<p class="store-description">${storefront.description}</p>` : ''}
      </div>
      <div class="powered-by">
        Powered by <a href="https://openfacilitator.io" target="_blank">OpenFacilitator</a>
      </div>
    </div>
  </header>
  <main class="container">
    ${products.length > 0 ? `<div class="product-grid">${productCards}</div>` : `<div class="empty-state"><h2>No products available</h2><p>Check back soon!</p></div>`}
  </main>
</body>
</html>
  `;

  res.setHeader('Content-Type', 'text/html');
  res.send(html);
});

/**
 * Storefront - Public page showing all active payment links for a facilitator
 */
router.get('/store', requireFacilitator, (req: Request, res: Response) => {
  const facilitator = req.facilitator;
  if (!facilitator) {
    res.status(404).send('Facilitator not found');
    return;
  }

  // Get all active products for this facilitator
  const products = getActiveProducts(facilitator.id);

  // Build base URL for products
  const baseUrl = facilitator.custom_domain
    ? `https://${facilitator.custom_domain}`
    : `https://${facilitator.subdomain}.openfacilitator.io`;

  // Helper to format price
  const formatPrice = (amount: string, decimals = 6) => {
    const num = parseFloat(amount) / Math.pow(10, decimals);
    return num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  // Sort products so grouped items appear together
  const sortedProducts = [...products].sort((a, b) => {
    if (a.group_name && b.group_name) return a.group_name.localeCompare(b.group_name);
    if (a.group_name) return -1;
    if (b.group_name) return 1;
    return 0;
  });

  // Generate product cards HTML
  const productCards = sortedProducts.map(product => {
    const price = formatPrice(product.amount);
    const imageUrl = product.image_url || 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300"%3E%3Crect fill="%23f3f4f6" width="400" height="300"/%3E%3Ctext x="50%25" y="50%25" dominant-baseline="middle" text-anchor="middle" fill="%239ca3af" font-family="system-ui" font-size="48"%3E%3C/text%3E%3C/svg%3E';
    const productUrl = product.slug ? `${baseUrl}/pay/${product.slug}` : `${baseUrl}/pay/${product.id}`;
    const groupBadge = product.group_name ? `<span class="group-badge">${product.group_name}</span>` : '';

    return `
      <a href="${productUrl}" class="product-card">
        <div class="product-image">
          ${groupBadge}
          <img src="${imageUrl}" alt="${product.name}" onerror="this.src='data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 400 300%22%3E%3Crect fill=%22%23f3f4f6%22 width=%22400%22 height=%22300%22/%3E%3Ctext x=%2250%25%22 y=%2250%25%22 dominant-baseline=%22middle%22 text-anchor=%22middle%22 fill=%22%239ca3af%22 font-family=%22system-ui%22 font-size=%2248%22%3E%3C/text%3E%3C/svg%3E'" />
        </div>
        <div class="product-info">
          <h3 class="product-name">${product.name}</h3>
          ${product.description ? `<p class="product-description">${product.description}</p>` : ''}
          <div class="product-price">$${price} USDC</div>
        </div>
      </a>
    `;
  }).join('');

  // Render storefront HTML
  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${facilitator.name} - Store</title>
  ${facilitator.favicon ? `<link rel="icon" href="data:image/png;base64,${facilitator.favicon}" type="image/png">` : ''}
  <style>
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      background: #fafafa;
      color: #111;
      min-height: 100vh;
    }

    .header {
      background: #fff;
      border-bottom: 1px solid #eee;
      padding: 1.5rem 2rem;
      position: sticky;
      top: 0;
      z-index: 100;
    }

    .header-content {
      max-width: 1200px;
      margin: 0 auto;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    .store-name {
      font-size: 1.5rem;
      font-weight: 700;
      color: #111;
    }

    .powered-by {
      font-size: 0.75rem;
      color: #888;
    }

    .powered-by a {
      color: #666;
      text-decoration: none;
    }

    .powered-by a:hover {
      text-decoration: underline;
    }

    .container {
      max-width: 1200px;
      margin: 0 auto;
      padding: 2rem;
    }

    .product-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
      gap: 1.5rem;
    }

    .product-card {
      background: #fff;
      border-radius: 12px;
      overflow: hidden;
      box-shadow: 0 1px 3px rgba(0,0,0,0.08);
      transition: transform 0.2s, box-shadow 0.2s;
      text-decoration: none;
      color: inherit;
      display: block;
    }

    .product-card:hover {
      transform: translateY(-4px);
      box-shadow: 0 8px 24px rgba(0,0,0,0.12);
    }

    .product-image {
      aspect-ratio: 4/3;
      overflow: hidden;
      background: #f3f4f6;
      position: relative;
    }

    .product-image img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }

    .group-badge {
      position: absolute;
      top: 0.5rem;
      left: 0.5rem;
      background: rgba(0,0,0,0.7);
      color: #fff;
      font-size: 0.7rem;
      padding: 0.25rem 0.5rem;
      border-radius: 4px;
      z-index: 1;
    }

    .product-info {
      padding: 1rem;
    }

    .product-name {
      font-size: 1rem;
      font-weight: 600;
      margin-bottom: 0.25rem;
      color: #111;
    }

    .product-description {
      font-size: 0.875rem;
      color: #666;
      margin-bottom: 0.5rem;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }

    .product-price {
      font-size: 1rem;
      font-weight: 700;
      color: #111;
    }

    .empty-state {
      text-align: center;
      padding: 4rem 2rem;
      color: #666;
    }

    .empty-state h2 {
      font-size: 1.25rem;
      margin-bottom: 0.5rem;
      color: #333;
    }

    @media (max-width: 640px) {
      .product-grid {
        grid-template-columns: repeat(2, 1fr);
        gap: 1rem;
      }

      .container {
        padding: 1rem;
      }

      .header {
        padding: 1rem;
      }

      .store-name {
        font-size: 1.25rem;
      }
    }
  </style>
</head>
<body>
  <header class="header">
    <div class="header-content">
      <h1 class="store-name">${facilitator.name}</h1>
      <div class="powered-by">
        Powered by <a href="https://openfacilitator.io" target="_blank" rel="noopener">OpenFacilitator</a>
      </div>
    </div>
  </header>

  <main class="container">
    ${products.length > 0 ? `
      <div class="product-grid">
        ${productCards}
      </div>
    ` : `
      <div class="empty-state">
        <h2>No products available</h2>
        <p>Check back soon for new items!</p>
      </div>
    `}
  </main>
</body>
</html>
  `;

  res.setHeader('Content-Type', 'text/html');
  res.send(html);
});

export { router as facilitatorRouter };

