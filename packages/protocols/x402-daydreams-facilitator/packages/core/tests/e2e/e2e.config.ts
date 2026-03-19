/**
 * E2E Test Configuration
 *
 * Sprint 1: EVM + Solana only (Starknet deferred)
 */

export const E2E_CONFIG = {
  // Networks (Sprint 1)
  evm: {
    network: "eip155:84532" as const, // Base Sepolia
    networkName: "base-sepolia" as const,
    rpcUrl: process.env.BASE_SEPOLIA_RPC ?? "https://sepolia.base.org",
    usdc: "0x036CbD53842c5426634e7929541eC2318f3dCF7e" as `0x${string}`,
    chainId: 84532,
  },
  solana: {
    network: "solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1" as const, // Devnet
    rpcUrl: process.env.SOLANA_DEVNET_RPC ?? "https://api.devnet.solana.com",
  },

  // Timeouts
  settlementTimeoutMs: 60_000,
  healthCheckTimeoutMs: 10_000,

  // Upto (shortened for tests with mock time)
  upto: {
    intervalMs: 100,
    idleSettleMs: 5_000,
    deadlineBufferSec: 10,
  },

  // Server ports (random offset to avoid conflicts)
  getRandomPort: (base: number) => base + Math.floor(Math.random() * 1000),
};
