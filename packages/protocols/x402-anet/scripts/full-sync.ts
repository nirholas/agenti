import { AgentIndexer } from '../src/core/discovery/indexer.js';
import { syncFromAPI } from '../src/core/discovery/sync.js';
import { config } from '../src/config.js';

const indexer = new AgentIndexer(config.home);
console.log('Starting full mainnet sync...');
const count = await syncFromAPI(indexer, 'mainnet');
console.log(`\nTotal indexed: ${count}`);
indexer.close();
process.exit(0);
