import { AgentIndexer } from './indexer.js';

// Agent0 subgraph endpoints (The Graph Network)
const SUBGRAPH_IDS: Record<string, string> = {
  base: '43s9hQRurMGjuYnC1r2ZwS6xSQktbFyXMPMqGKUFJojb',
  mainnet: 'FV6RR6y13rsnCxBAicKuQEwDp8ioEGiNaWaZUmvr1F8k',
};

const GRAPH_GATEWAY = 'https://gateway.thegraph.com/api';

const AGENT_FIELDS = `
  agentId
  owner
  agentWallet
  agentURI
  totalFeedback
  lastActivity
  createdAt
  registrationFile {
    name
    description
    image
    active
    x402Support
    supportedTrusts
    mcpEndpoint
    mcpVersion
    a2aEndpoint
    a2aVersion
    webEndpoint
    oasfEndpoint
    hasOASF
    emailEndpoint
    ens
    did
    mcpTools
    a2aSkills
    oasfSkills
    oasfDomains
    endpointsRawJson
  }
`;

// Curated query: only agents with minimum feedback
const CURATED_AGENTS_QUERY = `
  query GetCuratedAgents($first: Int!, $skip: Int!, $minFeedback: BigInt!) {
    agents(
      first: $first
      skip: $skip
      orderBy: totalFeedback
      orderDirection: desc
      where: { totalFeedback_gte: $minFeedback }
    ) {
      ${AGENT_FIELDS}
    }
  }
`;

// Unfiltered query for --all mode
const ALL_AGENTS_QUERY = `
  query GetAllAgents($first: Int!, $skip: Int!) {
    agents(
      first: $first
      skip: $skip
      orderBy: totalFeedback
      orderDirection: desc
    ) {
      ${AGENT_FIELDS}
    }
  }
`;

// Single agent lookup by ID
const AGENT_BY_ID_QUERY = `
  query GetAgent($id: ID!) {
    agent(id: $id) {
      ${AGENT_FIELDS}
    }
  }
`;

const STATS_QUERY = `
  query GetStats {
    globalStats(id: "global") {
      totalAgents
      totalFeedback
    }
  }
`;

export type GraphNetwork = 'base' | 'mainnet';

export interface SyncOptions {
  quiet?: boolean;
  minFeedback?: number;  // default: 3
  all?: boolean;         // ignore minFeedback, index everything
}

function getEndpoint(apiKey: string, network: GraphNetwork): string {
  const subgraphId = SUBGRAPH_IDS[network];
  if (!subgraphId) throw new Error(`No subgraph for network: ${network}`);
  return `${GRAPH_GATEWAY}/${apiKey}/subgraphs/id/${subgraphId}`;
}

async function graphQuery(endpoint: string, query: string, variables: Record<string, any> = {}): Promise<any> {
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables }),
    signal: AbortSignal.timeout(30000),
  });

  if (!response.ok) {
    throw new Error(`Graph API error: ${response.status} ${response.statusText}`);
  }

  const json = await response.json();
  if (json.errors) {
    throw new Error(`GraphQL error: ${json.errors[0].message}`);
  }

  return json.data;
}

/**
 * Sync agents from The Graph into local index.
 * Default: only indexes agents with feedback >= minFeedback AND at least one endpoint.
 * Use opts.all = true to index everything (not recommended).
 */
export async function syncFromGraph(
  indexer: AgentIndexer,
  apiKey: string,
  network: GraphNetwork = 'base',
  opts?: SyncOptions,
): Promise<number> {
  const endpoint = getEndpoint(apiKey, network);
  const log = opts?.quiet ? () => {} : console.log.bind(console);
  const write = opts?.quiet ? () => {} : process.stdout.write.bind(process.stdout);
  const minFeedback = opts?.all ? 0 : (opts?.minFeedback ?? 3);

  // Get total count for context
  const stats = await graphQuery(endpoint, STATS_QUERY);
  const totalRegistered = parseInt(stats.globalStats?.totalAgents || '0');

  if (opts?.all) {
    log(`${network}: indexing all ${totalRegistered} agents (via The Graph)`);
  } else {
    log(`${network}: ${totalRegistered} registered, indexing those with ${minFeedback}+ feedback`);
  }

  const PAGE_SIZE = 1000;
  let skip = 0;
  let indexed = 0;
  let skippedNoEndpoint = 0;

  while (true) {
    const query = opts?.all ? ALL_AGENTS_QUERY : CURATED_AGENTS_QUERY;
    const variables: Record<string, any> = { first: PAGE_SIZE, skip };
    if (!opts?.all) variables.minFeedback = String(minFeedback);

    const data = await graphQuery(endpoint, query, variables);
    const agents = data.agents || [];
    if (agents.length === 0) break;

    for (const agent of agents) {
      try {
        const reg = agent.registrationFile || {};

        // Quality filter: skip agents with no endpoints (unless --all)
        if (!opts?.all) {
          const hasEndpoint = reg.mcpEndpoint || reg.a2aEndpoint || reg.webEndpoint || reg.oasfEndpoint || reg.emailEndpoint;
          if (!hasEndpoint) {
            skippedNoEndpoint++;
            continue;
          }
        }

        const capabilities = extractCapabilities(agent, reg);

        indexer.indexAgent(Number(agent.agentId), {
          name: reg.name || null,
          description: reg.description || null,
          capabilities,
          agentURI: agent.agentURI || '',
          paymentAddress: agent.agentWallet || agent.owner,
          walletAddress: agent.owner,
          endpoints: {
            http: reg.webEndpoint || null,
            mcp: reg.mcpEndpoint || null,
            a2a: reg.a2aEndpoint || null,
            xmtp: agent.agentWallet || null,
          },
          x402Support: reg.x402Support,
          protocols: reg.supportedTrusts,
          image: reg.image,
          network,
        }, parseInt(agent.totalFeedback) || 0);

        indexed++;
      } catch {
        // Skip bad entries
      }
    }

    skip += agents.length;
    if (!opts?.quiet) {
      write(`  Indexed ${indexed} agents\r`);
    }

    // If we got fewer than PAGE_SIZE, we're done
    if (agents.length < PAGE_SIZE) break;
  }

  indexer.setSyncState(`lastSyncTime_${network}`, Date.now().toString());
  indexer.setSyncState(`total_${network}`, String(totalRegistered));
  indexer.setSyncState(`indexed_${network}`, String(indexed));
  indexer.setSyncState(`source_${network}`, 'thegraph');
  indexer.setSyncState(`minFeedback_${network}`, String(minFeedback));

  if (skippedNoEndpoint > 0 && !opts?.quiet) {
    log(`Indexed ${indexed} quality agents, skipped ${skippedNoEndpoint} with no endpoints (${network})`);
  } else {
    log(`Indexed ${indexed} agents (${network} via The Graph)`);
  }

  return indexed;
}

/**
 * Lookup a single agent by ID from The Graph (live, not cached).
 * Used for on-demand queries when an agent isn't in the local index.
 */
export async function lookupAgent(
  apiKey: string,
  agentId: number,
  network: GraphNetwork = 'base',
): Promise<any | null> {
  const endpoint = getEndpoint(apiKey, network);

  // The Graph uses composite IDs: "chainId:agentId"
  const chainId = network === 'base' ? '8453' : '1';
  const id = `${chainId}:${agentId}`;

  const data = await graphQuery(endpoint, AGENT_BY_ID_QUERY, { id });
  const agent = data.agent;
  if (!agent) return null;

  const reg = agent.registrationFile || {};
  return {
    agent_id: Number(agent.agentId),
    name: reg.name || null,
    description: reg.description || null,
    capabilities: extractCapabilities(agent, reg),
    wallet_address: agent.owner,
    xmtp_address: agent.agentWallet || null,
    http_endpoint: reg.webEndpoint || null,
    mcp_endpoint: reg.mcpEndpoint || null,
    a2a_endpoint: reg.a2aEndpoint || null,
    payment_address: agent.agentWallet || agent.owner,
    reputation: parseInt(agent.totalFeedback) || 0,
    x402Support: reg.x402Support,
    supportedTrusts: reg.supportedTrusts,
    image: reg.image,
  };
}

function extractCapabilities(agent: any, reg: any): string[] {
  const caps: string[] = [];

  if (reg.supportedTrusts) {
    for (const t of reg.supportedTrusts) {
      caps.push(t.toLowerCase());
    }
  }
  if (reg.x402Support) caps.push('x402');
  if (reg.mcpEndpoint) caps.push('mcp');
  if (reg.a2aEndpoint) caps.push('a2a');
  if (reg.webEndpoint) caps.push('web');
  if (reg.hasOASF) caps.push('oasf');
  if (reg.emailEndpoint) caps.push('email');

  if (reg.mcpTools?.length) {
    for (const tool of reg.mcpTools) {
      caps.push(`mcp:${tool}`);
    }
  }
  if (reg.a2aSkills?.length) {
    for (const skill of reg.a2aSkills) {
      caps.push(`a2a:${skill}`);
    }
  }
  if (reg.oasfSkills?.length) {
    for (const skill of reg.oasfSkills) {
      caps.push(`oasf:${skill}`);
    }
  }

  return [...new Set(caps)];
}
