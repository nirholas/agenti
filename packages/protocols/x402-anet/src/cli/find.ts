import { Command } from 'commander';
import { getIndexer } from './context.js';
import { smartSync, refreshCache } from '../core/discovery/sync.js';

export function registerFindCommand(program: Command) {
  program
    .command('find [query]')
    .description('Find agents by skill, name, or description')
    .option('--skill <name>', 'Exact skill match')
    .option('--min-rep <n>', 'Minimum feedback count', parseInt)
    .option('--limit <n>', 'Max results', parseInt)
    .option('--refresh', 'Force index refresh')
    .action(async (query: string | undefined, opts: any) => {
      const indexer = getIndexer();
      const count = indexer.getAgentCount();
      const limit = opts.limit || 20;

      // Ensure we have data
      if (opts.refresh || count === 0) {
        const label = count === 0 ? 'First run — fetching' : 'Refreshing';
        console.log(`${label} agents...`);
        try {
          await Promise.race([
            smartSync(indexer, 'mainnet', { minFeedback: 3 }),
            new Promise<number>((_, reject) => setTimeout(() => reject(new Error('sync timeout (60s) — try again later')), 60000)),
          ]);
        } catch (e: any) {
          if (count === 0) {
            console.error(`Sync failed: ${e.message}`);
            console.error('Tip: Set GRAPH_API_KEY in ~/.anet/.env for faster, more reliable syncs.');
            indexer.close();
            return;
          }
          console.log('Refresh failed, using cached data.');
        }
      } else if (indexer.isCacheStale('mainnet')) {
        refreshCache(indexer, 'mainnet').catch(() => {});
      }

      // Search
      let agents: any[];

      if (opts.skill) {
        // Exact skill match in capabilities
        agents = indexer.searchAgents({
          capability: opts.skill,
          minReputation: opts.minRep,
          limit,
        });
      } else if (query) {
        // Search capabilities, name, AND description
        const byCapability = indexer.searchAgents({ capability: query, limit: limit * 2 });
        const byName = indexer.searchAgents({ limit: limit * 2 });

        // Merge: capability matches first, then name/description matches
        const seen = new Set<number>();
        agents = [];

        for (const a of byCapability) {
          if (!seen.has(a.agent_id)) {
            seen.add(a.agent_id);
            agents.push(a);
          }
        }

        const queryLower = query.toLowerCase();
        for (const a of byName) {
          if (seen.has(a.agent_id)) continue;
          const name = (a.name || '').toLowerCase();
          const desc = (a.description || '').toLowerCase();
          if (name.includes(queryLower) || desc.includes(queryLower)) {
            seen.add(a.agent_id);
            agents.push(a);
          }
        }

        if (opts.minRep) {
          agents = agents.filter(a => (a.reputation || 0) >= opts.minRep);
        }
        agents = agents.slice(0, limit);
      } else {
        // Curated: agents with 3+ feedback, has endpoints
        agents = indexer.searchAgents({
          minReputation: opts.minRep || 3,
          limit,
        }).filter(a => a.http_endpoint || a.xmtp_address);
      }

      if (agents.length === 0) {
        console.log('No agents found.');
        if (query) console.log(`Try: anet search --capability ${query}`);
        indexer.close();
        return;
      }

      console.log(`Found ${agents.length} agents:\n`);

      for (const a of agents) {
        const caps = parseCaps(a.capabilities);
        const topCaps = caps.filter(c => !c.includes(':')).slice(0, 3).join(', ');
        const price = extractPrice(a);
        const priceLabel = price ? `${price}/call` : '';

        console.log(`  #${String(a.agent_id).padEnd(5)} ${(a.name || 'Unknown').padEnd(20)} ${topCaps.padEnd(30)} ${priceLabel}`);
      }

      if (agents.length > 0) {
        console.log(`\nCall one: anet call ${agents[0].agent_id} <skill>`);
      }

      indexer.close();
    });
}

function parseCaps(capabilities: any): string[] {
  if (Array.isArray(capabilities)) return capabilities;
  if (typeof capabilities === 'string') {
    try { return JSON.parse(capabilities); } catch { return [capabilities]; }
  }
  return [];
}

function extractPrice(agent: any): string | null {
  // Try to find price from agent URI metadata
  try {
    if (agent.agent_uri?.startsWith('data:')) {
      const b64 = agent.agent_uri.split(',')[1];
      const json = JSON.parse(Buffer.from(b64, 'base64').toString('utf8'));
      const paidService = json.services?.find((s: any) => s.version && s.version.startsWith('$'));
      if (paidService) return paidService.version;
    }
  } catch { /* ignore */ }
  return null;
}
