/**
 * Example B: Transfer only
 *
 * The signer (e.g. CDP server wallet) already owns an identity token.
 * Transfer that identity to another EVM address.
 *
 * This example uses a viem WalletClient from a private key. For Coinbase CDP
 * (Lucid MCP / xgate), use a WalletClient backed by your CDP server account.
 *
 * Required env: RPC_URL, CHAIN_ID, PRIVATE_KEY, AGENT_ID (token ID), TRANSFER_TO (EVM address)
 *
 * Run from repo root: bun run packages/identity/examples/transfer-only.ts
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
const AGENT_ID = process.env.AGENT_ID; // bigint or number as string
const TRANSFER_TO = process.env.TRANSFER_TO as Hex | undefined;

async function main() {
  if (!PRIVATE_KEY) {
    throw new Error('PRIVATE_KEY is required');
  }
  if (!AGENT_ID) {
    throw new Error('AGENT_ID (identity token ID) is required');
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

  const agentId = BigInt(AGENT_ID);
  console.log(
    'Transferring identity',
    agentId.toString(),
    'to',
    TRANSFER_TO,
    '...'
  );
  const txHash = await client.transfer(TRANSFER_TO, agentId);
  console.log('Transferred. Transaction:', txHash);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
