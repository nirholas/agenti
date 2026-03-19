/**
 * Deploy agent identity: register on the ERC-8004 Identity Registry and
 * optionally transfer to a user address.
 *
 * Uses a wallet that can sign transactions (private key here; for Coinbase CDP
 * use a WalletClient backed by your CDP server account, same pattern as
 * Lucid MCP / xgate).
 *
 * Required env:
 *   RPC_URL       - EVM RPC URL (e.g. https://sepolia.base.org)
 *   CHAIN_ID      - Chain ID (e.g. 84532 for Base Sepolia)
 *   PRIVATE_KEY   - Wallet private key (or configure CDP wallet)
 *   AGENT_URI     - Agent metadata URI (e.g. https://my-agent.example.com/.well-known/agent-metadata.json)
 *
 * Optional env:
 *   TRANSFER_TO   - If set, transfer the new identity to this EVM address after registration
 *
 * Run from repo root:
 *   bun run packages/identity/examples/deploy-agent.ts
 *
 * Example with transfer:
 *   TRANSFER_TO=0x1234... bun run packages/identity/examples/deploy-agent.ts
 */

import {
  createIdentityRegistryClient,
  getRegistryAddress,
} from '@lucid-agents/identity';
import { createPublicClient, createWalletClient, http, type Hex } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';

const RPC_URL = process.env.RPC_URL ?? 'https://sepolia.base.org';
const CHAIN_ID = Number(process.env.CHAIN_ID ?? 84532);
const PRIVATE_KEY = process.env.PRIVATE_KEY as Hex | undefined;
const AGENT_URI =
  process.env.AGENT_URI ??
  'https://my-agent.example.com/.well-known/agent-metadata.json';
const TRANSFER_TO = process.env.TRANSFER_TO as Hex | undefined;

async function main() {
  if (!PRIVATE_KEY) {
    throw new Error(
      'PRIVATE_KEY is required. For CDP wallet, pass a WalletClient that wraps your CDP server account.'
    );
  }

  const account = privateKeyToAccount(PRIVATE_KEY);
  const publicClient = createPublicClient({
    chain: {
      id: CHAIN_ID,
      name: 'Unknown',
      nativeCurrency: { decimals: 18, name: 'ETH', symbol: 'ETH' },
      rpcUrls: { default: { http: [RPC_URL] } },
    },
    transport: http(RPC_URL),
  });
  const walletClient = createWalletClient({
    account,
    chain: {
      id: CHAIN_ID,
      name: 'Unknown',
      nativeCurrency: { decimals: 18, name: 'ETH', symbol: 'ETH' },
      rpcUrls: { default: { http: [RPC_URL] } },
    },
    transport: http(RPC_URL),
  });

  const registryAddress = getRegistryAddress('identity', CHAIN_ID);
  const client = createIdentityRegistryClient({
    address: registryAddress,
    chainId: CHAIN_ID,
    publicClient,
    walletClient,
  });

  console.log('Registering identity with agentURI:', AGENT_URI);
  const result = await client.register({ agentURI: AGENT_URI });
  console.log('Registered. Transaction:', result.transactionHash);

  const agentId = result.agentId;
  if (agentId === undefined) {
    throw new Error('Register did not return agentId');
  }
  console.log('Agent ID:', agentId.toString());

  if (TRANSFER_TO) {
    console.log('Transferring to', TRANSFER_TO, '...');
    const transferTx = await client.transfer(TRANSFER_TO, agentId);
    console.log('Transferred. Transaction:', transferTx);
  } else {
    console.log(
      'Skipping transfer (set TRANSFER_TO to transfer to a user address).'
    );
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
