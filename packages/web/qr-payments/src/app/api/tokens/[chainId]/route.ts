import { NextRequest, NextResponse } from 'next/server';
import type { ApiResponse, TokenInfo } from '@/types';
import { getChain } from '@/lib/chains/config';
import { checkRateLimit } from '@/lib/rateLimit';
import { logApiCall, logError } from '@/lib/monitoring';

// Helper function for chain support check
function isChainSupported(chainId: number): boolean {
  return getChain(chainId) !== undefined;
}

// Popular tokens per chain - this would typically come from a database or external API
const CHAIN_TOKENS: Record<number, TokenInfo[]> = {
  // Ethereum Mainnet
  1: [
    { address: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE', chainId: 1, name: 'Ether', symbol: 'ETH', decimals: 18, logoURI: '/tokens/eth.svg', tags: ['native'] },
    { address: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', chainId: 1, name: 'Wrapped Ether', symbol: 'WETH', decimals: 18, logoURI: '/tokens/weth.svg', tags: ['wrapped'] },
    { address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', chainId: 1, name: 'USD Coin', symbol: 'USDC', decimals: 6, logoURI: '/tokens/usdc.svg', tags: ['stablecoin', 'verified'] },
    { address: '0xdAC17F958D2ee523a2206206994597C13D831ec7', chainId: 1, name: 'Tether USD', symbol: 'USDT', decimals: 6, logoURI: '/tokens/usdt.svg', tags: ['stablecoin', 'verified'] },
    { address: '0x6B175474E89094C44Da98b954EescdeCB5BE33d7', chainId: 1, name: 'Dai Stablecoin', symbol: 'DAI', decimals: 18, logoURI: '/tokens/dai.svg', tags: ['stablecoin', 'verified'] },
    { address: '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599', chainId: 1, name: 'Wrapped BTC', symbol: 'WBTC', decimals: 8, logoURI: '/tokens/wbtc.svg', tags: ['verified'] },
    { address: '0x514910771AF9Ca656af840dff83E8264EcF986CA', chainId: 1, name: 'Chainlink', symbol: 'LINK', decimals: 18, logoURI: '/tokens/link.svg', tags: ['verified'] },
    { address: '0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984', chainId: 1, name: 'Uniswap', symbol: 'UNI', decimals: 18, logoURI: '/tokens/uni.svg', tags: ['governance', 'verified'] },
  ],
  
  // Polygon
  137: [
    { address: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE', chainId: 137, name: 'MATIC', symbol: 'MATIC', decimals: 18, logoURI: '/tokens/matic.svg', tags: ['native'] },
    { address: '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270', chainId: 137, name: 'Wrapped MATIC', symbol: 'WMATIC', decimals: 18, logoURI: '/tokens/wmatic.svg', tags: ['wrapped'] },
    { address: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359', chainId: 137, name: 'USD Coin', symbol: 'USDC', decimals: 6, logoURI: '/tokens/usdc.svg', tags: ['stablecoin', 'verified'] },
    { address: '0xc2132D05D31c914a87C6611C10748AEb04B58e8F', chainId: 137, name: 'Tether USD', symbol: 'USDT', decimals: 6, logoURI: '/tokens/usdt.svg', tags: ['stablecoin', 'verified'] },
    { address: '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619', chainId: 137, name: 'Wrapped Ether', symbol: 'WETH', decimals: 18, logoURI: '/tokens/weth.svg', tags: ['wrapped', 'verified'] },
    { address: '0x1BFD67037B42Cf73acF2047067bd4F2C47D9BfD6', chainId: 137, name: 'Wrapped BTC', symbol: 'WBTC', decimals: 8, logoURI: '/tokens/wbtc.svg', tags: ['verified'] },
  ],
  
  // Arbitrum
  42161: [
    { address: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE', chainId: 42161, name: 'Ether', symbol: 'ETH', decimals: 18, logoURI: '/tokens/eth.svg', tags: ['native'] },
    { address: '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1', chainId: 42161, name: 'Wrapped Ether', symbol: 'WETH', decimals: 18, logoURI: '/tokens/weth.svg', tags: ['wrapped'] },
    { address: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831', chainId: 42161, name: 'USD Coin', symbol: 'USDC', decimals: 6, logoURI: '/tokens/usdc.svg', tags: ['stablecoin', 'verified'] },
    { address: '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9', chainId: 42161, name: 'Tether USD', symbol: 'USDT', decimals: 6, logoURI: '/tokens/usdt.svg', tags: ['stablecoin', 'verified'] },
    { address: '0x912CE59144191C1204E64559FE8253a0e49E6548', chainId: 42161, name: 'Arbitrum', symbol: 'ARB', decimals: 18, logoURI: '/tokens/arb.svg', tags: ['governance', 'verified'] },
    { address: '0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f', chainId: 42161, name: 'Wrapped BTC', symbol: 'WBTC', decimals: 8, logoURI: '/tokens/wbtc.svg', tags: ['verified'] },
  ],
  
  // Optimism
  10: [
    { address: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE', chainId: 10, name: 'Ether', symbol: 'ETH', decimals: 18, logoURI: '/tokens/eth.svg', tags: ['native'] },
    { address: '0x4200000000000000000000000000000000000006', chainId: 10, name: 'Wrapped Ether', symbol: 'WETH', decimals: 18, logoURI: '/tokens/weth.svg', tags: ['wrapped'] },
    { address: '0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85', chainId: 10, name: 'USD Coin', symbol: 'USDC', decimals: 6, logoURI: '/tokens/usdc.svg', tags: ['stablecoin', 'verified'] },
    { address: '0x94b008aA00579c1307B0EF2c499aD98a8ce58e58', chainId: 10, name: 'Tether USD', symbol: 'USDT', decimals: 6, logoURI: '/tokens/usdt.svg', tags: ['stablecoin', 'verified'] },
    { address: '0x4200000000000000000000000000000000000042', chainId: 10, name: 'Optimism', symbol: 'OP', decimals: 18, logoURI: '/tokens/op.svg', tags: ['governance', 'verified'] },
  ],
  
  // Base
  8453: [
    { address: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE', chainId: 8453, name: 'Ether', symbol: 'ETH', decimals: 18, logoURI: '/tokens/eth.svg', tags: ['native'] },
    { address: '0x4200000000000000000000000000000000000006', chainId: 8453, name: 'Wrapped Ether', symbol: 'WETH', decimals: 18, logoURI: '/tokens/weth.svg', tags: ['wrapped'] },
    { address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', chainId: 8453, name: 'USD Coin', symbol: 'USDC', decimals: 6, logoURI: '/tokens/usdc.svg', tags: ['stablecoin', 'verified'] },
    { address: '0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb', chainId: 8453, name: 'Dai Stablecoin', symbol: 'DAI', decimals: 18, logoURI: '/tokens/dai.svg', tags: ['stablecoin', 'verified'] },
  ],
  
  // BSC
  56: [
    { address: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE', chainId: 56, name: 'BNB', symbol: 'BNB', decimals: 18, logoURI: '/tokens/bnb.svg', tags: ['native'] },
    { address: '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c', chainId: 56, name: 'Wrapped BNB', symbol: 'WBNB', decimals: 18, logoURI: '/tokens/wbnb.svg', tags: ['wrapped'] },
    { address: '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d', chainId: 56, name: 'USD Coin', symbol: 'USDC', decimals: 18, logoURI: '/tokens/usdc.svg', tags: ['stablecoin', 'verified'] },
    { address: '0x55d398326f99059fF775485246999027B3197955', chainId: 56, name: 'Tether USD', symbol: 'USDT', decimals: 18, logoURI: '/tokens/usdt.svg', tags: ['stablecoin', 'verified'] },
    { address: '0x2170Ed0880ac9A755fd29B2688956BD959F933F8', chainId: 56, name: 'Wrapped Ether', symbol: 'ETH', decimals: 18, logoURI: '/tokens/eth.svg', tags: ['bridged', 'verified'] },
  ],
  
  // Avalanche
  43114: [
    { address: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE', chainId: 43114, name: 'Avalanche', symbol: 'AVAX', decimals: 18, logoURI: '/tokens/avax.svg', tags: ['native'] },
    { address: '0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7', chainId: 43114, name: 'Wrapped AVAX', symbol: 'WAVAX', decimals: 18, logoURI: '/tokens/wavax.svg', tags: ['wrapped'] },
    { address: '0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E', chainId: 43114, name: 'USD Coin', symbol: 'USDC', decimals: 6, logoURI: '/tokens/usdc.svg', tags: ['stablecoin', 'verified'] },
    { address: '0x9702230A8Ea53601f5cD2dc00fDBc13d4dF4A8c7', chainId: 43114, name: 'Tether USD', symbol: 'USDT', decimals: 6, logoURI: '/tokens/usdt.svg', tags: ['stablecoin', 'verified'] },
  ],
};

interface TokensRouteParams {
  params: Promise<{ chainId: string }>;
}

export async function GET(
  request: NextRequest,
  { params }: TokensRouteParams
) {
  const startTime = Date.now();
  const requestId = crypto.randomUUID();

  try {
    // Rate limiting
    const clientIp = request.headers.get('x-forwarded-for') || 'unknown';
    const rateLimitResult = await checkRateLimit(clientIp, 'tokens');
    
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

    const resolvedParams = await params;
    const chainId = parseInt(resolvedParams.chainId);

    // Validate chain ID
    if (isNaN(chainId) || chainId <= 0) {
      return NextResponse.json<ApiResponse<null>>({
        success: false,
        error: {
          code: 'INVALID_CHAIN_ID',
          message: 'Chain ID must be a positive integer',
          statusCode: 400,
        },
        meta: {
          requestId,
          timestamp: new Date().toISOString(),
          latency: Date.now() - startTime,
        },
      }, { status: 400 });
    }

    // Check if chain is supported
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

    // Get query parameters
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search')?.toLowerCase();
    const tags = searchParams.get('tags')?.split(',');
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100);
    const offset = parseInt(searchParams.get('offset') || '0');

    // Get tokens for the chain
    let tokens = CHAIN_TOKENS[chainId] || [];

    // Apply search filter
    if (search) {
      tokens = tokens.filter(t => 
        t.symbol.toLowerCase().includes(search) ||
        t.name.toLowerCase().includes(search) ||
        t.address.toLowerCase().includes(search)
      );
    }

    // Apply tag filter
    if (tags && tags.length > 0) {
      tokens = tokens.filter(t => 
        t.tags?.some((tag: string) => tags.includes(tag))
      );
    }

    // Apply pagination
    const total = tokens.length;
    tokens = tokens.slice(offset, offset + limit);

    // Log API call
    logApiCall({
      endpoint: `/api/tokens/${chainId}`,
      method: 'GET',
      requestId,
      latency: Date.now() - startTime,
      status: 200,
      chainId,
      tokenCount: tokens.length,
    });

    return NextResponse.json<ApiResponse<{ tokens: TokenInfo[]; total: number; hasMore: boolean }>>({
      success: true,
      data: {
        tokens,
        total,
        hasMore: offset + limit < total,
      },
      meta: {
        requestId,
        timestamp: new Date().toISOString(),
        latency: Date.now() - startTime,
        rateLimit: rateLimitResult.info,
      },
    });

  } catch (error) {
    logError('Token list error', { error, requestId });

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
