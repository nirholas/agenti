/**
 * @fileoverview Configuration file management
 * @copyright Copyright (c) 2024-2026 nirholas
 * @license MIT
 */

import Conf from 'conf';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';
import { CLIConfig, TransactionRecord, Network, Token } from '../types.js';

/**
 * Default configuration
 */
const DEFAULT_CONFIG: CLIConfig = {
  network: 'arbitrum',
  defaultToken: 'USDs',
  facilitatorUrl: 'http://localhost:3002',
  gaslessEnabled: true,
};

/**
 * Config directory path
 */
export const CONFIG_DIR = join(homedir(), '.x402');

/**
 * Config file path
 */
export const CONFIG_FILE = join(CONFIG_DIR, 'config.json');

/**
 * History file path
 */
export const HISTORY_FILE = join(CONFIG_DIR, 'history.json');

/**
 * Configuration store using Conf
 */
const store = new Conf<CLIConfig>({
  projectName: 'x402',
  defaults: DEFAULT_CONFIG,
  cwd: CONFIG_DIR,
  configName: 'config',
});

/**
 * Ensure config directory exists
 */
export function ensureConfigDir(): void {
  if (!existsSync(CONFIG_DIR)) {
    mkdirSync(CONFIG_DIR, { recursive: true });
  }
}

/**
 * Check if CLI is initialized
 */
export function isInitialized(): boolean {
  return existsSync(CONFIG_FILE) && !!store.get('walletAddress');
}

/**
 * Get full configuration
 */
export function getConfig(): CLIConfig {
  ensureConfigDir();
  return store.store;
}

/**
 * Get a specific config value
 */
export function getConfigValue<K extends keyof CLIConfig>(key: K): CLIConfig[K] {
  return store.get(key);
}

/**
 * Set a specific config value
 */
export function setConfigValue<K extends keyof CLIConfig>(key: K, value: CLIConfig[K]): void {
  ensureConfigDir();
  store.set(key, value);
  store.set('lastUsed', Date.now());
}

/**
 * Set multiple config values
 */
export function setConfig(values: Partial<CLIConfig>): void {
  ensureConfigDir();
  for (const [key, value] of Object.entries(values)) {
    store.set(key as keyof CLIConfig, value);
  }
  store.set('lastUsed', Date.now());
}

/**
 * Delete a config value
 */
export function deleteConfigValue(key: keyof CLIConfig): void {
  store.delete(key);
}

/**
 * Reset configuration to defaults
 */
export function resetConfig(): void {
  store.clear();
  for (const [key, value] of Object.entries(DEFAULT_CONFIG)) {
    store.set(key as keyof CLIConfig, value);
  }
}

/**
 * Get transaction history
 */
export function getHistory(): TransactionRecord[] {
  ensureConfigDir();
  if (!existsSync(HISTORY_FILE)) {
    return [];
  }
  try {
    const data = readFileSync(HISTORY_FILE, 'utf-8');
    return JSON.parse(data);
  } catch {
    return [];
  }
}

/**
 * Add transaction to history
 */
export function addToHistory(tx: TransactionRecord): void {
  ensureConfigDir();
  const history = getHistory();
  history.unshift(tx);
  // Keep last 1000 transactions
  const trimmedHistory = history.slice(0, 1000);
  writeFileSync(HISTORY_FILE, JSON.stringify(trimmedHistory, null, 2));
}

/**
 * Get transaction by hash
 */
export function getTransaction(hash: string): TransactionRecord | undefined {
  const history = getHistory();
  return history.find(tx => tx.hash.toLowerCase() === hash.toLowerCase());
}

/**
 * Update transaction status
 */
export function updateTransactionStatus(hash: string, status: 'pending' | 'confirmed' | 'failed'): void {
  const history = getHistory();
  const txIndex = history.findIndex(tx => tx.hash.toLowerCase() === hash.toLowerCase());
  if (txIndex !== -1) {
    history[txIndex].status = status;
    writeFileSync(HISTORY_FILE, JSON.stringify(history, null, 2));
  }
}

/**
 * Get RPC URL for current network
 */
export function getRpcUrl(): string {
  const customRpc = getConfigValue('rpcUrl');
  if (customRpc) return customRpc;
  
  const network = getConfigValue('network');
  switch (network) {
    case 'arbitrum':
      return 'https://arb1.arbitrum.io/rpc';
    case 'arbitrum-sepolia':
      return 'https://sepolia-rollup.arbitrum.io/rpc';
    default:
      return 'https://arb1.arbitrum.io/rpc';
  }
}

/**
 * Get chain ID for current network
 */
export function getChainId(): number {
  const network = getConfigValue('network');
  switch (network) {
    case 'arbitrum':
      return 42161;
    case 'arbitrum-sepolia':
      return 421614;
    default:
      return 42161;
  }
}

/**
 * List all config keys
 */
export function listConfigKeys(): string[] {
  return Object.keys(store.store);
}

/**
 * Export configuration
 */
export { store };
