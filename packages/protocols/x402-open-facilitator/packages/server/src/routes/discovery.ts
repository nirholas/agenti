/**
 * Discovery API - Service discovery for x402-enabled resources (Bazaar)
 *
 * GET /discovery/resources - Returns all published workflows/resources from x402jobs
 *
 * No authentication required (per x402 spec for service discovery)
 */
import { Router, type Request, type Response, type IRouter } from 'express';
import { X402Jobs } from '@x402jobs/sdk';

const router: IRouter = Router();

// Cache configuration
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

// Network to USDC asset mapping
const NETWORK_ASSETS: Record<string, string> = {
  solana: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', // USDC on Solana
  base: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', // USDC on Base
};

// Initialize x402jobs client
const x402 = new X402Jobs({
  apiKey: process.env.X402JOBS_API_KEY || '',
});

// x402jobs SDK resource type
interface X402SdkResource {
  name: string;
  url: string;
  network: string;
  price: string;
  description?: string;
  // Trust/reliability fields
  success_rate?: number;
  calls?: number;
  value_processed?: string;
  last_called?: string;
  // Additional metadata
  x402jobs_url?: string;
  avatar_url?: string;
  slug?: string;
  server_slug?: string;
  [key: string]: unknown;
}

// Output types
interface Resource {
  url: string;
  name: string;
  description: string;
  paymentRequirements: {
    scheme: string;
    network: string;
    asset: string;
    amount: string;
  };
  // Trust scores
  trustScore: {
    successRate: number;
    calls: number;
    valueProcessed: string;
    lastCalled: string;
  };
  // Metadata
  x402jobsUrl?: string;
  avatarUrl?: string;
}

interface ListResponse {
  resources: Resource[];
  cachedAt: string;
  ttlSeconds: number;
}

// In-memory cache
interface CacheEntry {
  data: ListResponse;
  timestamp: number;
}

let cache: CacheEntry | null = null;

/**
 * Map x402jobs resource to our Resource format
 */
function mapResource(r: X402SdkResource): Resource {
  const network = r.network || 'solana';
  return {
    url: r.url,
    name: r.name,
    description: r.description || '',
    paymentRequirements: {
      scheme: 'exact',
      network,
      asset: NETWORK_ASSETS[network] || NETWORK_ASSETS.solana,
      amount: r.price || '0',
    },
    trustScore: {
      successRate: r.success_rate ?? 0,
      calls: r.calls ?? 0,
      valueProcessed: r.value_processed ?? '$0',
      lastCalled: r.last_called ?? 'never',
    },
    x402jobsUrl: r.x402jobs_url,
    avatarUrl: r.avatar_url,
  };
}

/**
 * Fetch resources from x402jobs using SDK
 */
async function fetchResourcesFromX402Jobs(): Promise<Resource[]> {
  try {
    const x402Resources = (await x402.resources.list({ limit: 100 })) as unknown as X402SdkResource[];
    const resources = (x402Resources || []).map(mapResource);

    console.log(`[Discovery] Fetched ${resources.length} resources from x402jobs`);

    return resources;
  } catch (error) {
    console.error('[Discovery] Error fetching from x402jobs:', error);
    return [];
  }
}

/**
 * Check if cache is valid
 */
function isCacheValid(): boolean {
  if (!cache) return false;
  return Date.now() - cache.timestamp < CACHE_TTL_MS;
}

/**
 * Get resources with caching
 */
async function getResources(): Promise<ListResponse> {
  // Return cached data if valid
  if (isCacheValid() && cache) {
    return cache.data;
  }

  // Fetch fresh data
  const resources = await fetchResourcesFromX402Jobs();

  const response: ListResponse = {
    resources,
    cachedAt: new Date().toISOString(),
    ttlSeconds: CACHE_TTL_MS / 1000,
  };

  // Update cache
  cache = {
    data: response,
    timestamp: Date.now(),
  };

  return response;
}

/**
 * GET /discovery/resources - List all x402-enabled resources (Bazaar)
 *
 * Returns a list of available paid APIs/workflows that can be accessed via x402 payments.
 * This endpoint requires no authentication and is designed for service discovery.
 */
router.get('/discovery/resources', async (_req: Request, res: Response) => {
  try {
    const data = await getResources();

    res.json({
      success: true,
      ...data,
    });
  } catch (error) {
    console.error('[Discovery] Error fetching resources:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch resources',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /discovery/info - Metadata about the discovery endpoint
 */
router.get('/discovery/info', (_req: Request, res: Response) => {
  res.json({
    endpoint: '/discovery/resources',
    description: 'Service discovery for x402-enabled resources (Bazaar)',
    caching: {
      ttlSeconds: CACHE_TTL_MS / 1000,
      strategy: 'in-memory',
    },
    source: 'x402jobs',
    authentication: 'none required',
  });
});

export { router as discoveryRouter };
