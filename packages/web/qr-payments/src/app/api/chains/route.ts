import { NextRequest, NextResponse } from 'next/server';
import type { ApiResponse } from '@/types';
import { getMainnets, getPopularChains, getChain, type ChainConfig } from '@/lib/chains/config';
import { checkRateLimit } from '@/lib/rateLimit';
import { logApiCall, logError } from '../../../lib/monitoring';

// Chain info type for API response
interface ChainInfo {
  id: number;
  name: string;
  shortName: string;
  isActive: boolean;
  nativeCurrency: { name: string; symbol: string; decimals: number };
  rpcUrl: string;
  blockExplorerUrl: string;
  iconUrl?: string;
  averageBlockTime: number;
}

// Chain groups for UI organization
const CHAIN_GROUPS = [
  { category: 'popular', label: 'Popular', chains: [1, 137, 42161, 10, 8453, 56, 43114] },
  { category: 'layer2', label: 'Layer 2', chains: [10, 42161, 8453, 324, 59144, 534352, 81457] },
  { category: 'alt-l1', label: 'Alternative L1s', chains: [56, 43114, 250, 100, 42220] },
];

export async function GET(request: NextRequest) {
  const startTime = Date.now();
  const requestId = crypto.randomUUID();

  try {
    // Rate limiting
    const clientIp = request.headers.get('x-forwarded-for') || 'unknown';
    const rateLimitResult = await checkRateLimit(clientIp, 'chains');
    
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

    // Get query parameters
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category');
    const includeTestnets = searchParams.get('includeTestnets') === 'true';
    const search = searchParams.get('search')?.toLowerCase();

    // Get all mainnet chains
    const allChains = getMainnets();
    let chainIds: number[] = allChains.map((c: ChainConfig) => c.chainId);

    // Filter by category if specified
    if (category) {
      const group = CHAIN_GROUPS.find((g: { category: string }) => g.category === category);
      if (group) {
        chainIds = chainIds.filter((id: number) => group.chains.includes(id));
      }
    }

    // Build chain info array
    const mappedChains = chainIds
      .map((id: number): ChainInfo | null => {
        const config = getChain(id);
        if (!config) return null;
        
        // Filter out testnets if not requested
        if (!includeTestnets && config.isTestnet) return null;

        return {
          id: config.chainId,
          name: config.name,
          shortName: config.shortName,
          isActive: true,
          nativeCurrency: config.nativeCurrency,
          rpcUrl: config.rpcUrls[0],
          blockExplorerUrl: config.blockExplorers[0]?.url || '',
          iconUrl: config.iconUrl,
          averageBlockTime: getAverageBlockTime(config.chainId),
        };
      });
    
    let chains: ChainInfo[] = mappedChains.filter((c: ChainInfo | null): c is ChainInfo => c !== null);

    // Apply search filter
    if (search) {
      chains = chains.filter(c =>
        c.name.toLowerCase().includes(search) ||
        c.shortName.toLowerCase().includes(search) ||
        c.id.toString().includes(search)
      );
    }

    // Sort by popularity (manual ordering for popular chains)
    const popularOrder = [1, 137, 42161, 10, 8453, 56, 43114, 324, 59144, 81457];
    chains.sort((a, b) => {
      const aIndex = popularOrder.indexOf(a.id);
      const bIndex = popularOrder.indexOf(b.id);
      if (aIndex >= 0 && bIndex >= 0) return aIndex - bIndex;
      if (aIndex >= 0) return -1;
      if (bIndex >= 0) return 1;
      return a.name.localeCompare(b.name);
    });

    // Log API call
    logApiCall({
      endpoint: '/api/chains',
      method: 'GET',
      requestId,
      latency: Date.now() - startTime,
      status: 200,
      chainCount: chains.length,
    });

    return NextResponse.json<ApiResponse<{ chains: ChainInfo[]; total: number; groups: typeof CHAIN_GROUPS }>>({
      success: true,
      data: {
        chains,
        total: chains.length,
        groups: CHAIN_GROUPS,
      },
      meta: {
        requestId,
        timestamp: new Date().toISOString(),
        latency: Date.now() - startTime,
        rateLimit: rateLimitResult.info,
      },
    });

  } catch (error) {
    logError('Chain list error', { error, requestId });

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

// Helper function to get average block time per chain
function getAverageBlockTime(chainId: number): number {
  const blockTimes: Record<number, number> = {
    1: 12, // Ethereum
    10: 2, // Optimism
    137: 2, // Polygon
    42161: 0.25, // Arbitrum
    8453: 2, // Base
    56: 3, // BSC
    43114: 2, // Avalanche
    250: 1, // Fantom
    324: 1, // zkSync Era
    59144: 2, // Linea
    534352: 3, // Scroll
    81457: 2, // Blast
    100: 5, // Gnosis
    42220: 5, // Celo
    5000: 2, // Mantle
  };
  return blockTimes[chainId] || 12;
}
