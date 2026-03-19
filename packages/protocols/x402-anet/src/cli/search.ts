import { Command } from 'commander';
import { loadContext, getProvider, getIndexer } from './context.js';
import { smartSync, syncFromAPI, syncFromChain, refreshCache, lookupAgentById, SyncNetwork } from '../core/discovery/sync.js';

export function registerSearchCommand(program: Command) {
  program
    .command('search')
    .description('Search the 8004 registry — agents, services, MCP servers, tools, anything')
    .option('--capability <cap>', 'Filter by capability')
    .option('--min-rep <n>', 'Minimum feedback count', parseInt)
    .option('--min-feedback <n>', 'Minimum feedback to index (default: 3)', parseInt)
    .option('--top <n>', 'Top N by reputation', parseInt)
    .option('--agent <id>', 'Look up a specific agent by ID (live query)')
    .option('--anet-only', 'Only show anet-compatible services')
    .option('--all', 'Include all agents (unfiltered, including spam)')
    .option('--refresh', 'Force cache refresh')
    .option('--mainnet', 'Search mainnet/Base registry (default)')
    .option('--testnet', 'Search testnet registry')
    .action(async (opts) => {
      const indexer = getIndexer();
      const network: SyncNetwork = opts.testnet ? 'testnet' : 'mainnet';

      // Single agent lookup — live query, no sync needed
      if (opts.agent) {
        const agentId = parseInt(opts.agent);
        console.log(`Looking up agent ${agentId}...`);
        const agent = await lookupAgentById(indexer, agentId, network);
        if (!agent) {
          console.log(`Agent ${agentId} not found.`);
        } else {
          printDetailedEntry(agent);
        }
        indexer.close();
        return;
      }

      // Hybrid approach: query cache, refresh if stale
      const count = indexer.getAgentCount();

      if (opts.refresh || count === 0) {
        const label = count === 0 ? 'First run — fetching' : 'Refreshing';
        console.log(`${label} agents (${network})...`);
        try {
          await smartSync(indexer, network, {
            all: opts.all,
            minFeedback: opts.minFeedback,
          });
        } catch (e: any) {
          if (count === 0) {
            console.error(`Sync failed: ${e.message}`);
            indexer.close();
            return;
          }
          console.log(`Refresh failed, using cached data.`);
        }
      } else if (indexer.isCacheStale(network)) {
        console.log(`Searching cached index (background refresh started)...`);
        refreshCache(indexer, network).catch(() => {});
      }

      // Search from local cache
      if (opts.top) {
        const agents = indexer.getTopAgents(opts.top);
        console.log(`Top ${opts.top} by feedback:\n`);
        for (const a of agents) {
          printEntry(a);
        }
      } else {
        const agents = indexer.searchAgents({
          capability: opts.capability,
          minReputation: opts.minRep,
          limit: opts.all ? 1000 : 50,
        });

        const filtered = opts.anetOnly
          ? agents.filter((a: any) => {
              try {
                const caps = typeof a.capabilities === 'string' ? JSON.parse(a.capabilities) : a.capabilities;
                return caps.includes('anet-compatible') || a.agent_uri?.includes('anet');
              } catch { return false; }
            })
          : agents;

        const label = opts.capability ? `offering '${opts.capability}'` : '';
        const repLabel = opts.minRep ? ` (min-feedback: ${opts.minRep})` : '';
        const anetLabel = opts.anetOnly ? ' [anet-only]' : '';
        console.log(`Found ${filtered.length} agents ${label}${repLabel}${anetLabel}:\n`);

        for (const a of filtered) {
          printEntry(a);
        }
      }

      indexer.close();
    });

  program
    .command('sync')
    .description('Sync from 8004 registry (The Graph → 8004scan → RPC)')
    .option('--all', 'Index all agents (including spam)')
    .option('--min-feedback <n>', 'Minimum feedback to index (default: 3)', parseInt)
    .option('--rpc', 'Force RPC sync (slowest, direct from chain)')
    .option('--8004scan', 'Force 8004scan API (skip The Graph)')
    .option('--mainnet', 'Sync mainnet/Base registry (default)')
    .option('--testnet', 'Sync testnet registry')
    .action(async (opts: any) => {
      const indexer = getIndexer();
      const network: SyncNetwork = opts.testnet ? 'testnet' : 'mainnet';

      if (opts.rpc) {
        console.log(`Syncing from 8004 ${network} registry via RPC...`);
        try {
          const provider = getProvider();
          const count = await syncFromChain(provider, indexer, { network });
          console.log(`\nSynced ${count} entries`);
          console.log(`Total indexed: ${indexer.getAgentCount()}`);
        } catch (e: any) {
          console.error(`Sync failed: ${e.message}`);
        }
      } else if (opts['8004scan']) {
        console.log(`Syncing from 8004scan API (${network})...`);
        try {
          await syncFromAPI(indexer, network);
          console.log(`\nTotal indexed: ${indexer.getAgentCount()}`);
        } catch (e: any) {
          console.error(`Sync failed: ${e.message}`);
        }
      } else {
        console.log(`Syncing ${network} agents...`);
        try {
          await smartSync(indexer, network, {
            all: opts.all,
            minFeedback: opts.minFeedback,
          });
          console.log(`\nTotal indexed: ${indexer.getAgentCount()}`);
        } catch (e: any) {
          console.error(`Sync failed: ${e.message}`);
        }
      }

      indexer.close();
    });
}

function printEntry(a: any) {
  const caps = typeof a.capabilities === 'string'
    ? (() => { try { return JSON.parse(a.capabilities); } catch { return [a.capabilities]; } })()
    : (a.capabilities || []);

  // Show only the top-level capabilities (not mcp:tool, a2a:skill, etc.)
  const topCaps = caps.filter((c: string) => !c.includes(':') || c === 'x402').join(', ');

  console.log(`  [${a.agent_id}] ${(a.name || 'Unknown').padEnd(24)} feedback:${String(a.reputation).padEnd(5)} ${topCaps}`);
  if (a.http_endpoint) console.log(`         ${a.http_endpoint}`);
}

function printDetailedEntry(a: any) {
  const caps = Array.isArray(a.capabilities) ? a.capabilities : [];
  const topCaps = caps.filter((c: string) => !c.includes(':')).join(', ');
  const tools = caps.filter((c: string) => c.startsWith('mcp:')).map((c: string) => c.slice(4));
  const skills = caps.filter((c: string) => c.startsWith('a2a:')).map((c: string) => c.slice(4));

  console.log(`\n  Agent #${a.agent_id}`);
  console.log(`  Name:      ${a.name || 'Unknown'}`);
  if (a.description) console.log(`  About:     ${a.description.slice(0, 120)}`);
  console.log(`  Feedback:  ${a.reputation}`);
  console.log(`  Wallet:    ${a.wallet_address}`);
  if (a.http_endpoint) console.log(`  Web:       ${a.http_endpoint}`);
  if (a.mcp_endpoint) console.log(`  MCP:       ${a.mcp_endpoint}`);
  if (a.a2a_endpoint) console.log(`  A2A:       ${a.a2a_endpoint}`);
  if (a.xmtp_address) console.log(`  XMTP:      ${a.xmtp_address}`);
  if (topCaps) console.log(`  Caps:      ${topCaps}`);
  if (tools.length) console.log(`  MCP Tools: ${tools.join(', ')}`);
  if (skills.length) console.log(`  A2A Skills:${skills.join(', ')}`);
  if (a.x402Support) console.log(`  X402:      yes`);
  console.log('');
}
