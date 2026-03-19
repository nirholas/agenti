/**
 * Example A: Register then transfer
 *
 * Platform (e.g. server wallet) registers an identity with the ERC-8004
 * Identity Registry, then immediately transfers it to a user's EVM address.
 * Full register-then-transfer flow.
 *
 * This example uses a viem WalletClient from a private key. For Coinbase CDP
 * (Lucid MCP / xgate), use a WalletClient backed by your CDP server account
 * (same interface: account.address, writeContract). See xgate-mcp-server
 * createLucidWalletAdapter and EvmServerAccount for the CDP pattern.
 *
 * Required env: RPC_URL, CHAIN_ID, PRIVATE_KEY, AGENT_URI, TRANSFER_TO (EVM address)
 *
 * Run from repo root: bun run packages/identity/examples/register-then-transfer.ts
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
    throw new Error('PRIVATE_KEY is required');
  }
  if (!TRANSFER_TO) {
    throw new Error('TRANSFER_TO (recipient EVM address) is required');
  }

  const account = privateKeyToAccount(PRIVATE_KEY as Hex);
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
    account: signerAccount,
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

  console.log('Registering identity...');
  const result = await client.register({ agentURI: AGENT_URI });
  console.log('Registered. Transaction:', result.transactionHash);
  const agentId = result.agentId;
  if (agentId === undefined) {
    throw new Error('Register did not return agentId (check event parsing)');
  }
  console.log('Agent ID:', agentId.toString());

  console.log('Transferring to', TRANSFER_TO, '...');
  const transferTx = await client.transfer(TRANSFER_TO, agentId);
  console.log('Transferred. Transaction:', transferTx);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
