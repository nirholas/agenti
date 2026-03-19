import { AgentIndexer } from '../src/core/discovery/indexer.js';
import { config } from '../src/config.js';

const idx = new AgentIndexer(config.agentDbPath);
console.log('Total indexed:', idx.getAgentCount());

const top = idx.getTopAgents(20);
console.log('\nTop 20:');
for (const a of top) {
  const caps = typeof a.capabilities === 'string'
    ? (() => { try { return JSON.parse(a.capabilities).join(', '); } catch { return a.capabilities; } })()
    : (a.capabilities || []).join(', ');
  console.log(`  [${a.agent_id}] ${(a.name || 'Unknown').padEnd(28)} — ${caps}`);
  if (a.http_endpoint) console.log(`       ${a.http_endpoint}`);
}

const x402 = idx.searchAgents({ capability: 'x402', limit: 10 });
console.log(`\nX402-enabled: ${x402.length}`);
for (const a of x402) {
  console.log(`  [${a.agent_id}] ${a.name || 'Unknown'}`);
}

const mcp = idx.searchAgents({ capability: 'mcp', limit: 10 });
console.log(`\nMCP servers: ${mcp.length}`);
for (const a of mcp) {
  console.log(`  [${a.agent_id}] ${a.name || 'Unknown'}`);
}

idx.close();
