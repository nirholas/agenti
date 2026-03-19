/**
 * Bittensor Subnet Mining Integration
 * Barrel exports for the bittensor module.
 */

import type { BittensorService } from './types.js';

export type {
  BittensorConfig,
  BittensorNetwork,
  SubnetMinerConfig,
  SubnetType,
  ChutesConfig,
  GpuNode,
  TaoWalletInfo,
  HotkeyInfo,
  TaoBalance,
  MinerStatus,
  SubnetInfo,
  MinerEarnings,
  EarningsPeriod,
  CostLogEntry,
  ChutesStatus,
  GpuNodeStatus,
  InvocationStats,
  BittensorService,
  BittensorServiceStatus,
  ActiveMinerSummary,
  PythonRunner,
  PythonExecResult,
  PythonProcess,
  BittensorPersistence,
} from './types';

// Used by gateway/index.ts
export { createBittensorService } from './service.js';

// Server routes are private (gitignored) — lazy import for hosted deployment only
// server module is private (gitignored) — use variable path to skip TS resolution
const _serverPath = './server.js';
export async function createBittensorRouter(service: BittensorService) {
  const { createBittensorRouter: create } = await import(_serverPath);
  return create(service);
}
