import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import type { ApiResponse, TokenPrice } from '@/types';
import { getChain } from '@/lib/chains/config';
import { checkRateLimit } from '@/lib/rateLimit';
import { logApiCall, logError } from '@/lib/monitoring';

// Helper function for chain support check
function isChainSupported(chainId: number): boolean {
  return getChain(chainId) !== undefined;
}

// Request validation schema
const PriceRequestSchema = z.object({
  tokens: z.array(z.object({
    address: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
    chainId: z.number().int().positive(),
  })).min(1).max(50),
});

// Simple in-memory cache for prices
const priceCache: Map<string, { price: TokenPrice; expiry: number }> = new Map();
const CACHE_TTL_MS = 30 * 1000; // 30 seconds

// CoinGecko chain ID mapping
const COINGECKO_PLATFORMS: Record<number, string> = {
  1: 'ethereum',
  10: 'optimistic-ethereum',
  137: 'polygon-pos',
  42161: 'arbitrum-one',
  8453: 'base',
  56: 'binance-smart-chain',
  43114: 'avalanche',
  250: 'fantom',
  324: 'zksync',
  59144: 'linea',
  100: 'xdai',
  42220: 'celo',
};

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  const requestId = crypto.randomUUID();

  try {
    // Rate limiting
    const clientIp = request.headers.get('x-forwarded-for') || 'unknown';
    const rateLimitResult = await checkRateLimit(clientIp, 'prices');
    
    if (!rateLimitResult.allowed) {
      return NextResponse.json<ApiResponse<null>>({
        success: false,
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: 'Too many requests. Please try again later.',
          statusCode: 429,
        },
        meta: {
          requestId,
          timestamp: new Date().toISOString(),
          latency: Date.now() - startTime,
          rateLimit: rateLimitResult.info,
        },
      }, { status: 429 });
    }

    // Parse and validate request body
    const body = await request.json();
    const validationResult = PriceRequestSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json<ApiResponse<null>>({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid request parameters',
          details: validationResult.error.flatten(),
          statusCode: 400,
        },
        meta: {
          requestId,
          timestamp: new Date().toISOString(),
          latency: Date.now() - startTime,
        },
      }, { status: 400 });
    }

    const { tokens } = validationResult.data;

    // Check cache and identify tokens needing fresh prices
    const now = Date.now();
    const prices: TokenPrice[] = [];
    const tokensToFetch: { address: string; chainId: number }[] = [];

    for (const token of tokens) {
      const cacheKey = `${token.chainId}:${token.address.toLowerCase()}`;
      const cached = priceCache.get(cacheKey);

      if (cached && cached.expiry > now) {
        prices.push(cached.price);
      } else {
        tokensToFetch.push(token);
      }
    }

    // Fetch prices for tokens not in cache
    if (tokensToFetch.length > 0) {
      const fetchedPrices = await fetchPricesFromProviders(tokensToFetch);
      
      for (const price of fetchedPrices) {
        const cacheKey = `${price.chainId}:${price.address.toLowerCase()}`;
        priceCache.set(cacheKey, {
          price,
          expiry: now + CACHE_TTL_MS,
        });
        prices.push(price);
      }
    }

    // Log API call
    logApiCall({
      endpoint: '/api/prices',
      method: 'POST',
      requestId,
      latency: Date.now() - startTime,
      status: 200,
      tokenCount: tokens.length,
      cacheHits: tokens.length - tokensToFetch.length,
    });

    return NextResponse.json<ApiResponse<{ prices: TokenPrice[]; timestamp: Date }>>({
      success: true,
      data: {
        prices,
        timestamp: new Date(),
      },
      meta: {
        requestId,
        timestamp: new Date().toISOString(),
        latency: Date.now() - startTime,
        rateLimit: rateLimitResult.info,
      },
    });

  } catch (error) {
    logError('Price fetch error', { error, requestId });

    return NextResponse.json<ApiResponse<null>>({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: error instanceof Error ? error.message : 'An unexpected error occurred',
        statusCode: 500,
      },
      meta: {
        requestId,
        timestamp: new Date().toISOString(),
        latency: Date.now() - startTime,
      },
    }, { status: 500 });
  }
}

// GET method for single token price
export async function GET(request: NextRequest) {
  const startTime = Date.now();
  const requestId = crypto.randomUUID();

  try {
    const { searchParams } = new URL(request.url);
    const address = searchParams.get('address');
    const chainIdStr = searchParams.get('chainId');

    if (!address || !chainIdStr) {
      return NextResponse.json<ApiResponse<null>>({
        success: false,
        error: {
          code: 'MISSING_PARAMS',
          message: 'address and chainId are required',
          statusCode: 400,
        },
        meta: {
          requestId,
          timestamp: new Date().toISOString(),
          latency: Date.now() - startTime,
        },
      }, { status: 400 });
    }

    const chainId = parseInt(chainIdStr);

    if (!isChainSupported(chainId)) {
      return NextResponse.json<ApiResponse<null>>({
        success: false,
        error: {
          code: 'UNSUPPORTED_CHAIN',
          message: `Chain ${chainId} is not supported`,
          statusCode: 400,
        },
        meta: {
          requestId,
          timestamp: new Date().toISOString(),
          latency: Date.now() - startTime,
        },
      }, { status: 400 });
    }

    // Convert to POST request internally
    const syntheticBody = {
      tokens: [{ address, chainId }],
    };

    // Check rate limit
    const clientIp = request.headers.get('x-forwarded-for') || 'unknown';
    const rateLimitResult = await checkRateLimit(clientIp, 'prices');
    
    if (!rateLimitResult.allowed) {
      return NextResponse.json<ApiResponse<null>>({
        success: false,
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: 'Too many requests. Please try again later.',
          statusCode: 429,
        },
        meta: {
          requestId,
          timestamp: new Date().toISOString(),
          latency: Date.now() - startTime,
          rateLimit: rateLimitResult.info,
        },
      }, { status: 429 });
    }

    // Check cache
    const now = Date.now();
    const cacheKey = `${chainId}:${address.toLowerCase()}`;
    const cached = priceCache.get(cacheKey);

    if (cached && cached.expiry > now) {
      return NextResponse.json<ApiResponse<TokenPrice>>({
        success: true,
        data: cached.price,
        meta: {
          requestId,
          timestamp: new Date().toISOString(),
          latency: Date.now() - startTime,
          rateLimit: rateLimitResult.info,
        },
      });
    }

    // Fetch fresh price
    const prices = await fetchPricesFromProviders([{ address, chainId }]);
    const price = prices[0];

    if (price) {
      priceCache.set(cacheKey, {
        price,
        expiry: now + CACHE_TTL_MS,
      });
    }

    logApiCall({
      endpoint: '/api/prices',
      method: 'GET',
      requestId,
      latency: Date.now() - startTime,
      status: 200,
      address,
      chainId,
    });

    return NextResponse.json<ApiResponse<TokenPrice | null>>({
      success: true,
      data: price || null,
      meta: {
        requestId,
        timestamp: new Date().toISOString(),
        latency: Date.now() - startTime,
        rateLimit: rateLimitResult.info,
      },
    });

  } catch (error) {
    logError('Price fetch error', { error, requestId });

    return NextResponse.json<ApiResponse<null>>({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: error instanceof Error ? error.message : 'An unexpected error occurred',
        statusCode: 500,
      },
      meta: {
        requestId,
        timestamp: new Date().toISOString(),
        latency: Date.now() - startTime,
      },
    }, { status: 500 });
  }
}

// Fetch prices from multiple providers
async function fetchPricesFromProviders(
  tokens: { address: string; chainId: number }[]
): Promise<TokenPrice[]> {
  const prices: TokenPrice[] = [];

  // Group tokens by chain for efficient API calls
  const tokensByChain = new Map<number, string[]>();
  for (const token of tokens) {
    const existing = tokensByChain.get(token.chainId) || [];
    existing.push(token.address.toLowerCase());
    tokensByChain.set(token.chainId, existing);
  }

  // Fetch from CoinGecko (free tier)
  for (const [chainId, addresses] of tokensByChain) {
    const platform = COINGECKO_PLATFORMS[chainId];
    if (!platform) continue;

    try {
      const url = `https://api.coingecko.com/api/v3/simple/token_price/${platform}?contract_addresses=${addresses.join(',')}&vs_currencies=usd&include_24hr_change=true&include_market_cap=true`;
      
      const response = await fetch(url, {
        headers: {
          'Accept': 'application/json',
          ...(process.env.COINGECKO_API_KEY && {
            'x-cg-demo-api-key': process.env.COINGECKO_API_KEY,
          }),
        },
        next: { revalidate: 30 }, // Next.js cache
      });

      if (response.ok) {
        const data = await response.json();
        
        for (const address of addresses) {
          const priceData = data[address];
          if (priceData) {
            prices.push({
              address,
              chainId: chainId,
              priceUSD: priceData.usd?.toString() || '0',
              priceChange24h: priceData.usd_24h_change,
              marketCap: priceData.usd_market_cap?.toString(),
              lastUpdated: new Date(),
            });
          }
        }
      }
    } catch (error) {
      logError('CoinGecko price fetch error', { error, chainId });
    }
  }

  // Fallback: Add zero prices for tokens we couldn't fetch
  for (const token of tokens) {
    const exists = prices.find(
      p => p.address.toLowerCase() === token.address.toLowerCase() && p.chainId === token.chainId
    );
    if (!exists) {
      prices.push({
        address: token.address.toLowerCase(),
        chainId: token.chainId,
        priceUSD: '0',
        lastUpdated: new Date(),
      });
    }
  }

  return prices;
}
