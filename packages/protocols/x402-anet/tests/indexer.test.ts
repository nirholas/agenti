import path from 'path';
import { AgentIndexer } from '../src/core/discovery/indexer.js';
import { assert, summary, tmpDir, cleanup } from './utils.js';

const TEST_DIR = tmpDir('indexer-test');
const DB_PATH = path.join(TEST_DIR, 'test-index.db3');

console.log('Indexer Tests\n');

// --- Basic CRUD ---

const indexer = new AgentIndexer(DB_PATH);

// Test: empty index
assert(indexer.getAgentCount() === 0, 'empty index has 0 agents');
assert(indexer.getAgent(1) === undefined, 'missing agent returns undefined');

// Test: index an agent
indexer.indexAgent(1, {
  name: 'TestAgent',
  description: 'A test agent',
  capabilities: ['x402', 'mcp'],
  agentURI: 'data:application/json;base64,e30=',
  paymentAddress: '0xabc',
  walletAddress: '0xabc',
  endpoints: {
    http: 'https://example.com',
    mcp: 'https://example.com/mcp',
    a2a: null,
    xmtp: '0xabc',
  },
}, 42);

assert(indexer.getAgentCount() === 1, 'count after indexing 1 agent');

const agent = indexer.getAgent(1);
assert(agent !== undefined, 'agent found by ID');
assert(agent!.name === 'TestAgent', 'agent name correct');
assert(agent!.reputation === 42, 'agent reputation correct');
assert(agent!.http_endpoint === 'https://example.com', 'http endpoint correct');
assert(Array.isArray(agent!.capabilities), 'capabilities is array');
assert(agent!.capabilities.includes('x402'), 'capabilities contain x402');

// Test: index multiple agents
indexer.indexAgent(2, {
  name: 'Agent2',
  description: 'Second agent',
  capabilities: ['a2a'],
  agentURI: '',
  paymentAddress: '0xdef',
  walletAddress: '0xdef',
  endpoints: { http: null, mcp: null, a2a: 'https://a2a.dev', xmtp: null },
}, 10);

indexer.indexAgent(3, {
  name: 'Agent3',
  description: 'Third agent with x402',
  capabilities: ['x402', 'oasf'],
  agentURI: '',
  paymentAddress: '0xghi',
  walletAddress: '0xghi',
  endpoints: { http: 'https://agent3.com', mcp: null, a2a: null, xmtp: null },
}, 88);

assert(indexer.getAgentCount() === 3, 'count after indexing 3 agents');

// --- Search ---

// Search all
const all = indexer.searchAgents({ limit: 100 });
assert(all.length === 3, 'search all returns 3');
assert(all[0].agent_id === 3, 'sorted by reputation desc (agent3 first)');

// Search by capability
const x402 = indexer.searchAgents({ capability: 'x402' });
assert(x402.length === 2, 'search x402 returns 2 agents');

// Search by min reputation
const highRep = indexer.searchAgents({ minReputation: 40 });
assert(highRep.length === 2, 'min reputation 40 returns 2 agents');

// Top agents
const top1 = indexer.getTopAgents(1);
assert(top1.length === 1, 'top 1 returns 1');
assert(top1[0].agent_id === 3, 'top agent is agent3 (rep 88)');

// --- Update (upsert) ---

indexer.indexAgent(1, {
  name: 'TestAgent Updated',
  description: 'Updated',
  capabilities: ['x402', 'mcp', 'web'],
  agentURI: '',
  paymentAddress: '0xabc',
  walletAddress: '0xabc',
  endpoints: { http: 'https://new.example.com', mcp: null, a2a: null, xmtp: null },
}, 99);

const updated = indexer.getAgent(1);
assert(updated!.name === 'TestAgent Updated', 'upsert updates name');
assert(updated!.reputation === 99, 'upsert updates reputation');
assert(indexer.getAgentCount() === 3, 'upsert does not increase count');

// --- Remove ---

indexer.removeAgent(2);
assert(indexer.getAgentCount() === 2, 'count after remove');
assert(indexer.getAgent(2) === undefined, 'removed agent returns undefined');

// --- Cache staleness ---

assert(indexer.isCacheStale('mainnet', 3600000) === true, 'cache is stale when no sync recorded');

indexer.setSyncState('lastSyncTime_mainnet', Date.now().toString());
assert(indexer.isCacheStale('mainnet', 3600000) === false, 'cache is fresh after sync');

indexer.setSyncState('lastSyncTime_mainnet', (Date.now() - 7200000).toString());
assert(indexer.isCacheStale('mainnet', 3600000) === true, 'cache is stale after TTL');

// --- Sync state ---

indexer.setSyncState('testKey', 'testValue');
assert(indexer.getSyncState('testKey') === 'testValue', 'sync state get/set');
assert(indexer.getSyncState('missing') === undefined, 'missing sync state returns undefined');

indexer.close();
cleanup(TEST_DIR);

summary();
