/**
 * Quote Generation Route
 * 
 * POST /quote - Return 402 Payment Required with pricing
 */

import { Router, type Request, type Response } from 'express';
import type { Address } from 'viem';
import type { QuoteRequest, QuoteResponse, ErrorResponse, Network, PaymentToken } from '../types.js';
import { logger } from '../middleware/logger.js';
import { createQuoteRateLimiter } from '../middleware/rateLimit.js';

/**
 * Service pricing configuration (in USD)
 */
const SERVICE_PRICING: Record<string, string> = {
  // AI Models
  'gpt-4': '0.001',
  'gpt-4-turbo': '0.0008',
  'gpt-3.5-turbo': '0.0002',
  'claude-3-opus': '0.0015',
  'claude-3-sonnet': '0.0008',
  'claude-3-haiku': '0.0002',
  'gemini-pro': '0.0005',
  'llama-3': '0.0003',
  
  // Image Generation
  'dall-e-3': '0.004',
  'dall-e-2': '0.002',
  'stable-diffusion': '0.001',
  'midjourney': '0.005',
  
  // Code & Tools
  'code-interpreter': '0.0005',
  'web-search': '0.0001',
  'file-analysis': '0.0003',
  
  // Default
  'default': '0.0001',
};

/**
 * Quote router configuration
 */
export interface QuoteRouterConfig {
  recipientAddress: Address;
  network: Network;
  defaultToken: PaymentToken;
  facilitatorUrl: string;
  quoteValiditySeconds: number;
}

/**
 * Create quote router
 */
export function createQuoteRouter(config: QuoteRouterConfig): Router {
  const router = Router();

  // Apply rate limiting
  router.use(createQuoteRateLimiter());

  /**
   * POST /quote - Generate payment quote
   */
  router.post('/', (req: Request, res: Response) => {
    const body = req.body as Partial<QuoteRequest>;

    // Validate required fields
    if (!body.service) {
      return res.status(400).json({
        error: 'Missing required field: service',
        code: 'MISSING_SERVICE',
      } satisfies ErrorResponse);
    }

    const { service, params, network, token } = body;

    logger.info('Generating quote', { service, params, network, token });

    // Determine price based on service
    let price = SERVICE_PRICING[service.toLowerCase()] || SERVICE_PRICING['default'];

    // Apply multipliers based on params
    if (params) {
      // Token count multiplier for AI models
      if (typeof params.maxTokens === 'number' && params.maxTokens > 1000) {
        const multiplier = Math.ceil(params.maxTokens / 1000);
        price = (parseFloat(price) * multiplier).toFixed(6);
      }

      // Image size multiplier
      if (typeof params.size === 'string') {
        if (params.size === '1024x1024') {
          price = (parseFloat(price) * 2).toFixed(6);
        } else if (params.size === '1792x1024' || params.size === '1024x1792') {
          price = (parseFloat(price) * 3).toFixed(6);
        }
      }

      // Quantity multiplier
      if (typeof params.quantity === 'number' && params.quantity > 1) {
        price = (parseFloat(price) * params.quantity).toFixed(6);
      }
    }

    // Build quote response
    const quote: QuoteResponse = {
      price,
      token: (token as PaymentToken) || config.defaultToken,
      chain: (network as Network) || config.network,
      recipient: config.recipientAddress,
      deadline: Math.floor(Date.now() / 1000) + config.quoteValiditySeconds,
      description: `${service} API call`,
      facilitatorUrl: config.facilitatorUrl,
      x402Version: 1,
    };

    logger.info('Quote generated', {
      service,
      price: quote.price,
      token: quote.token,
      deadline: quote.deadline,
    });

    // Return 402 Payment Required status
    res.status(402).json(quote);
  });

  /**
   * GET /quote/pricing - Get all service pricing
   */
  router.get('/pricing', (_req: Request, res: Response) => {
    res.json({
      pricing: SERVICE_PRICING,
      defaultToken: config.defaultToken,
      defaultNetwork: config.network,
      quoteValiditySeconds: config.quoteValiditySeconds,
    });
  });

  return router;
}
