import dotenv from 'dotenv';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// anet stores config in ~/.anet/
export const ANET_HOME = process.env.ANET_HOME || path.join(os.homedir(), '.anet');

// Load .env from anet home or project root
dotenv.config({ path: path.join(ANET_HOME, '.env') });
dotenv.config(); // fallback to cwd

export const config = {
  // Paths
  home: ANET_HOME,
  configPath: path.join(ANET_HOME, 'config.yaml'),
  hooksPath: path.join(ANET_HOME, 'hooks.yaml'),
  friendsDbPath: path.join(ANET_HOME, 'friends.db3'),

  // Network
  network: (process.env.NETWORK || 'testnet') as 'mainnet' | 'testnet',
  baseRpcUrl: process.env.BASE_RPC_URL || 'https://mainnet.base.org',
  baseSepoliaRpcUrl: process.env.BASE_SEPOLIA_RPC_URL || 'https://sepolia.base.org',

  get rpcUrl() {
    return this.network === 'mainnet' ? this.baseRpcUrl : this.baseSepoliaRpcUrl;
  },

  get chainId() {
    return this.network === 'mainnet' ? 8453 : 84532;
  },

  // Wallet
  privateKey: process.env.PRIVATE_KEY || '',
  walletPassword: process.env.WALLET_PASSWORD || 'default-password',
  walletPath: process.env.WALLET_PATH || path.join(ANET_HOME, 'wallet.json'),

  // Contracts
  identityRegistry: {
    mainnet: '0x8004A169FB4a3325136EB29fA0ceB6D2e539a432',
    sepolia: '0x8004A818BFB912233c491871b3d84c89A494BD9e',
  },
  reputationRegistry: '0x8004BAa17C55a88189AE136b182e5fdA19dE9b63',
  usdcAddress: process.env.USDC_ADDRESS || '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',

  get identityRegistryAddress() {
    return this.network === 'mainnet'
      ? this.identityRegistry.mainnet
      : this.identityRegistry.sepolia;
  },

  // Agent — name resolved lazily from config.yaml via SettingsManager in CLI context
  agentName: process.env.AGENT_NAME || 'anet-agent',
  agentPort: parseInt(process.env.AGENT_PORT || '3000', 10),
  agentDbPath: process.env.AGENT_DB_PATH || path.join(ANET_HOME, 'agent-index.db3'),

  // XMTP
  xmtpEnv: (process.env.XMTP_ENV || 'production') as 'production' | 'dev',
  xmtpEncryptionKey: process.env.XMTP_ENCRYPTION_KEY || '',

  // Budget
  maxPerTransaction: parseFloat(process.env.MAX_PER_TRANSACTION || '1.00'),
  maxPerSession: parseFloat(process.env.MAX_PER_SESSION || '10.00'),

  // Sync
  syncStartBlock: parseInt(process.env.SYNC_START_BLOCK || '37700000', 10),
  graphApiKey: process.env.GRAPH_API_KEY || '',

  // Social defaults
  defaultMinReputation: parseInt(process.env.MIN_REPUTATION || '50', 10),
  signingPolicy: (process.env.SIGNING_POLICY || 'prompt') as 'always' | 'prompt' | 'never',
};
