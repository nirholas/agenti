import fs from 'fs';
import path from 'path';
import { ethers } from 'ethers';
import { ANET_HOME, config } from '../config.js';
import { SettingsManager } from '../settings/manager.js';
import { loadWallet, walletFromPrivateKey } from '../core/wallet/index.js';
import { createEthersProvider, createEthersSigner } from '../core/wallet/provider.js';
import { AgentIndexer } from '../core/discovery/indexer.js';

/**
 * Shared CLI context — wallet is the core primitive.
 * Everything else (identity, signing, payments, messaging) derives from the wallet.
 */
export interface AnetContext {
  home: string;
  settings: SettingsManager;
  wallet?: {
    address: string;
    privateKey: string;
  };
  registration?: {
    agentId: string;
    txHash: string;
    registryAddress: string;
    network: string;
    chainId: number;
    walletAddress: string;
    blockNumber: number;
  };
}

export function ensureHome(): string {
  if (!fs.existsSync(ANET_HOME)) {
    console.error(`anet not initialized. Run:\n\n  anet init --gen\n`);
    process.exit(1);
  }
  return ANET_HOME;
}

/**
 * Validate that anet is initialized before running a command.
 * Call at the top of any command that needs wallet/config.
 */
export function ensureInit(): void {
  if (!fs.existsSync(ANET_HOME)) {
    console.error(`anet not initialized. Run:\n\n  anet init --gen\n`);
    process.exit(1);
  }
  const envPath = path.join(ANET_HOME, '.env');
  if (!fs.existsSync(envPath) && !config.privateKey) {
    console.error(`No wallet configured. Run:\n\n  anet init --gen            Generate a new keypair\n  anet init --private-key    Import existing key\n`);
    process.exit(1);
  }
}

export function loadContext(requireWallet = false): AnetContext {
  if (requireWallet) ensureInit();
  const home = ANET_HOME;
  const settings = new SettingsManager();

  const ctx: AnetContext = { home, settings };

  // Load wallet — the core primitive
  if (config.privateKey) {
    const w = walletFromPrivateKey(config.privateKey);
    ctx.wallet = { address: w.address, privateKey: config.privateKey };
  } else {
    const walletPath = path.join(home, 'wallet.json');
    if (fs.existsSync(walletPath)) {
      try {
        const w = loadWallet(walletPath, config.walletPassword);
        ctx.wallet = { address: w.address, privateKey: w.privateKey };
      } catch (e) {
        if (requireWallet) {
          console.error(`Failed to load wallet: ${e}`);
          process.exit(1);
        }
      }
    }
  }

  if (requireWallet && !ctx.wallet) {
    console.error('No wallet found. Run: anet init');
    process.exit(1);
  }

  // Load registration data
  const regPath = path.join(home, 'registration.json');
  if (fs.existsSync(regPath)) {
    try {
      ctx.registration = JSON.parse(fs.readFileSync(regPath, 'utf8'));
    } catch { /* no registration yet */ }
  }

  return ctx;
}

export function getProvider(): ethers.JsonRpcProvider {
  return createEthersProvider();
}

export function getSigner(privateKey: string): ethers.Wallet {
  return createEthersSigner(privateKey);
}

export function getIndexer(): AgentIndexer {
  return new AgentIndexer(config.agentDbPath);
}
