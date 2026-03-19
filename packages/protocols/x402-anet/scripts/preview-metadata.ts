import { buildAgentMetadata, toDataURI, validateMetadata } from '../src/core/registry/metadata.js';

const m = buildAgentMetadata({
  name: 'birdbamboo-agent',
  description: 'An autonomous agent for research, payments, and agent-to-agent coordination',
  walletAddress: '0x7Eec5fab4C3937Fa3331177ABa1d987b50a457fE',
  xmtpEnv: 'production',
  x402Support: true,
  agentId: 692,
  chainId: 84532,
});

console.log(JSON.stringify(m, null, 2));
console.log('\nValidation:', validateMetadata(m));
console.log('\nData URI length:', toDataURI(m).length, 'bytes');
