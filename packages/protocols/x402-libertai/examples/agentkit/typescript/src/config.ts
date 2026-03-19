import "dotenv/config";
import { type Hex } from "viem";
import { base } from "viem/chains";

function requireEnv(name: string): string {
  const val = process.env[name];
  if (!val) throw new Error(`Missing env var: ${name}`);
  return val;
}

export const config = {
  privateKey: requireEnv("WALLET_PRIVATE_KEY") as Hex,
  chain: base,
  model: process.env.MODEL || "qwen3-coder-next",
  cycleIntervalMs: parseInt(process.env.CYCLE_INTERVAL_MS || "60000", 10) || 60000,
  rpcUrl: process.env.RPC_URL || undefined,
} as const;
