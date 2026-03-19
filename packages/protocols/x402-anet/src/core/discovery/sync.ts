import { ethers } from 'ethers';
import { AgentIndexer } from './indexer.js';
import { syncFromGraph, lookupAgent, type GraphNetwork, type SyncOptions } from './graph.js';
import { config } from '../../config.js';

// 8004scan API — fallback when Graph API key is not configured
const SCAN_API = 'https://api.8004scan.io/api/v1';

// Chain IDs for 8004scan API
const CHAIN_IDS = {
  mainnet: 8453,   // Base mainnet
  testnet: 84532,  // Base Sepolia
} as const;

export type SyncNetwork = 'mainnet' | 'testnet';

export async function syncFromAPI(
  indexer: AgentIndexer,
  network: SyncNetwork = 'mainnet',
  opts?: { quiet?: boolean },
): Promise<number> {
  const chainId = CHAIN_IDS[network];
  const pageSize = 100;
  let offset = 0;
  let total = 0;
  let indexed = 0;
  const log = opts?.quiet ? () => {} : console.log.bind(console);
  const write = opts?.quiet ? () => {} : process.stdout.write.bind(process.stdout);

  // First request to get total count
  const firstPage = await fetchAgents(chainId, pageSize, 0);
  total = firstPage.total;
  log(`${network}: ${total} agents registered on 8004`);

  if (total === 0) return 0;

  // Paginate through all results
  while (offset < total) {
    const page = offset === 0 ? firstPage : await fetchAgents(chainId, pageSize, offset);

    for (const agent of page.items) {
      try {
        indexer.indexAgent(Number(agent.token_id), {
          name: agent.name || null,
          description: agent.description || null,
          capabilities: extractCapabilities(agent),
          agentURI: '', // not needed when we have structured data
          paymentAddress: agent.agent_wallet || agent.owner_address,
          walletAddress: agent.owner_address,
          endpoints: {
            http: agent.endpoints?.web?.endpoint || agent.services?.web?.endpoint || null,
            mcp: agent.endpoints?.mcp?.endpoint || agent.services?.mcp?.endpoint || null,
            a2a: agent.endpoints?.a2a?.endpoint || agent.services?.a2a?.endpoint || null,
            xmtp: agent.agent_wallet || null,
          },
          // Preserve the full API data for rich queries
          x402Support: agent.x402_supported,
          protocols: agent.supported_protocols,
          verified: agent.is_endpoint_verified,
          image: agent.image_url,
          chainId: agent.chain_id,
          network,
        }, agent.total_score || 0);

        indexed++;
      } catch {
        // Skip bad entries
      }
    }

    offset += pageSize;
    if (offset < total) {
      write(`  Indexed ${indexed}/${total}\r`);
    }
  }

  indexer.setSyncState(`lastSyncTime_${network}`, Date.now().toString());
  indexer.setSyncState(`total_${network}`, String(total));

  log(`Indexed ${indexed} agents (${network})`);
  return indexed;
}

// Fetch a page of agents from 8004scan API with exponential backoff on 429
async function fetchAgents(chainId: number, limit: number, offset: number): Promise<{
  items: any[];
  total: number;
}> {
  const url = `${SCAN_API}/agents?chain_id=${chainId}&limit=${limit}&offset=${offset}`;
  let delay = 1000;

  for (let attempt = 0; attempt < 8; attempt++) {
    const response = await fetch(url, { signal: AbortSignal.timeout(30000) });

    if (response.status === 429) {
      await new Promise(r => setTimeout(r, delay));
      delay = Math.min(delay * 2, 30000);
      continue;
    }

    if (!response.ok) {
      throw new Error(`8004scan API error: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  throw new Error('8004scan API rate-limited — try again in a minute, or set GRAPH_API_KEY for faster syncs');
}

/**
 * Smart sync: tries The Graph first (richer data, no rate limits),
 * falls back to 8004scan API, then RPC.
 */
export async function smartSync(
  indexer: AgentIndexer,
  network: SyncNetwork = 'mainnet',
  opts?: SyncOptions,
): Promise<number> {
  // Try The Graph first (if API key configured)
  if (config.graphApiKey) {
    try {
      const graphNetwork: GraphNetwork = network === 'mainnet' ? 'base' : 'base';
      return await syncFromGraph(indexer, config.graphApiKey, graphNetwork, opts);
    } catch (e: any) {
      if (!opts?.quiet) console.log(`Graph sync failed: ${e.message}, trying 8004scan...`);
    }
  }

  // Fallback to 8004scan API
  return syncFromAPI(indexer, network, opts);
}

/**
 * Lookup a single agent by ID. Checks local cache first, then queries The Graph live.
 */
export async function lookupAgentById(
  indexer: AgentIndexer,
  agentId: number,
  network: SyncNetwork = 'mainnet',
): Promise<any | null> {
  // Check local cache first
  const cached = indexer.getAgent(agentId);
  if (cached) return cached;

  // Live lookup from The Graph
  if (!config.graphApiKey) return null;
  const graphNetwork: GraphNetwork = network === 'mainnet' ? 'base' : 'base';
  return lookupAgent(config.graphApiKey, agentId, graphNetwork);
}

/**
 * Refresh the local cache if stale.
 * Non-blocking: returns cached results immediately if fresh.
 * Called by `anet search` on every invocation.
 */
export async function refreshCache(
  indexer: AgentIndexer,
  network: SyncNetwork = 'mainnet',
  ttlMs: number = 3600_000,
): Promise<{ synced: boolean; count: number }> {
  if (!indexer.isCacheStale(network, ttlMs)) {
    return { synced: false, count: indexer.getAgentCount() };
  }

  const count = await smartSync(indexer, network, { quiet: true });
  return { synced: true, count };
}

// Extract capabilities from the rich API data
function extractCapabilities(agent: any): string[] {
  const caps: string[] = [];

  if (agent.supported_protocols) {
    for (const p of agent.supported_protocols) {
      caps.push(p.toLowerCase());
    }
  }
  if (agent.x402_supported) caps.push('x402');
  if (agent.services?.mcp) caps.push('mcp-server');
  if (agent.services?.a2a) caps.push('a2a');
  if (agent.tags) caps.push(...agent.tags);
  if (agent.categories) caps.push(...agent.categories);

  return [...new Set(caps)];
}

// Legacy: sync directly from chain via RPC (fallback if API is down)
export async function syncFromChain(
  provider: ethers.Provider,
  indexer: AgentIndexer,
  opts?: { network?: SyncNetwork; fromBlock?: number },
): Promise<number> {
  const { IDENTITY_REGISTRY_ABI } = await import('../registry/register.js');

  const SYNC_CONFIG = {
    mainnet: { rpcUrl: 'https://mainnet.base.org', registryAddress: '0x8004A169FB4a3325136EB29fA0ceB6D2e539a432', startBlock: 41_000_000 },
    testnet: { rpcUrl: 'https://sepolia.base.org', registryAddress: '0x8004A818BFB912233c491871b3d84c89A494BD9e', startBlock: 37_700_000 },
  };

  const network = opts?.network || (config.network === 'mainnet' ? 'mainnet' : 'testnet');
  const syncConfig = SYNC_CONFIG[network];

  const syncProvider = (network === 'mainnet' && config.network !== 'mainnet')
    ? new ethers.JsonRpcProvider(syncConfig.rpcUrl)
    : (network === 'testnet' && config.network !== 'testnet')
      ? new ethers.JsonRpcProvider(syncConfig.rpcUrl)
      : provider;

  const contract = new ethers.Contract(syncConfig.registryAddress, IDENTITY_REGISTRY_ABI, syncProvider);

  const stateKey = `lastBlock_${network}`;
  const lastSynced = opts?.fromBlock ?? parseInt(indexer.getSyncState(stateKey) || String(syncConfig.startBlock));
  const currentBlock = await syncProvider.getBlockNumber();

  if (lastSynced >= currentBlock) {
    console.log(`Already synced to latest block (${network})`);
    return 0;
  }

  console.log(`Syncing ${network} from block ${lastSynced} to ${currentBlock} via RPC...`);

  const CHUNK_SIZE = 9999;
  const mintFilter = contract.filters.Transfer(ethers.ZeroAddress);

  const events: ethers.EventLog[] = [];
  for (let from = lastSynced; from <= currentBlock; from += CHUNK_SIZE + 1) {
    const to = Math.min(from + CHUNK_SIZE, currentBlock);
    try {
      const chunk = await contract.queryFilter(mintFilter, from, to);
      events.push(...(chunk as ethers.EventLog[]));
    } catch {
      for (let f2 = from; f2 <= to; f2 += 2000) {
        const t2 = Math.min(f2 + 1999, to);
        try {
          const chunk = await contract.queryFilter(mintFilter, f2, t2);
          events.push(...(chunk as ethers.EventLog[]));
        } catch { /* skip */ }
      }
    }
  }

  console.log(`Found ${events.length} new registrations`);

  let indexed = 0;
  for (const event of events) {
    try {
      const log = event as ethers.EventLog;
      const owner = log.args?.[1] as string;
      const agentId = Number(log.args?.[2]);

      let agentURI = '';
      let metadata: any = { capabilities: [] };

      try { agentURI = await contract.tokenURI(agentId); } catch {}

      if (agentURI) {
        try {
          const dataJson = parseDataURI(agentURI);
          if (dataJson) {
            metadata = { ...metadata, ...dataJson };
          } else {
            const resolved = resolveURI(agentURI);
            if (resolved) {
              const response = await fetch(resolved, { signal: AbortSignal.timeout(10000) });
              if (response.ok) metadata = { ...metadata, ...(await response.json()) };
            }
          }
        } catch {}
      }

      indexer.indexAgent(agentId, { ...metadata, agentURI, paymentAddress: owner, walletAddress: owner, network }, 0);
      indexed++;
    } catch {}
  }

  indexer.setSyncState(stateKey, currentBlock.toString());
  if (indexed > 0) console.log(`Indexed ${indexed} agents (${network})`);
  return indexed;
}

export async function fullSync(
  provider: ethers.Provider,
  indexer: AgentIndexer,
  network?: SyncNetwork,
): Promise<number> {
  // Use the API — it's faster and gives richer data
  return syncFromAPI(indexer, network || 'mainnet');
}

export function startPeriodicSync(
  provider: ethers.Provider,
  indexer: AgentIndexer,
  intervalMs: number = 3600_000
): ReturnType<typeof setInterval> {
  console.log(`Starting periodic sync every ${intervalMs / 1000}s`);

  const timer = setInterval(async () => {
    try {
      await smartSync(indexer, 'mainnet', { quiet: true });
    } catch {
      // Fallback to RPC if all APIs are down
      try { await syncFromChain(provider, indexer, { network: 'mainnet' }); } catch {}
    }
  }, intervalMs);

  // Initial sync
  smartSync(indexer, 'mainnet', { quiet: true }).catch(() =>
    syncFromChain(provider, indexer, { network: 'mainnet' }).catch(() => {})
  );

  return timer;
}

function resolveURI(uri: string): string | null {
  if (!uri) return null;
  if (uri.startsWith('data:')) return null;
  if (uri.startsWith('ipfs://')) return `https://ipfs.io/ipfs/${uri.replace('ipfs://', '')}`;
  if (uri.startsWith('http://') || uri.startsWith('https://')) return uri;
  if (uri.startsWith('ar://')) return `https://arweave.net/${uri.replace('ar://', '')}`;
  return null;
}

export function parseDataURI(uri: string): any | null {
  if (!uri.startsWith('data:')) return null;
  try {
    const match = uri.match(/^data:[^;]*;base64,(.+)$/);
    if (match) return JSON.parse(Buffer.from(match[1], 'base64').toString('utf8'));
    const jsonMatch = uri.match(/^data:[^,]*,(.+)$/);
    if (jsonMatch) return JSON.parse(decodeURIComponent(jsonMatch[1]));
  } catch {}
  return null;
}
