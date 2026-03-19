import dotenv from "dotenv";
import {
  parseNetworkList,
  validateNetworks,
  validateSvmNetworks,
  validateStarknetNetworks,
  resolveRpcUrl,
  resolveSvmRpcUrl,
  resolveStarknetRpcUrl,
  getNetworkCaip,
  getSvmNetworkCaip,
  getStarknetNetworkCaip,
  supportsV1,
  STARKNET_CAIP_IDS,
  toStarknetCanonicalCaip,
} from "./networks.js";

dotenv.config();

// ============================================================================
// Server Configuration
// ============================================================================

export const PORT = parseInt(process.env.PORT || "8090", 10);

// ============================================================================
// CDP Configuration (preferred signer)
// ============================================================================

export const CDP_API_KEY_ID = process.env.CDP_API_KEY_ID;
export const CDP_API_KEY_SECRET = process.env.CDP_API_KEY_SECRET;
export const CDP_WALLET_SECRET = process.env.CDP_WALLET_SECRET;
export const CDP_ACCOUNT_NAME = process.env.CDP_ACCOUNT_NAME;

// ============================================================================
// Private Key Configuration (fallback signer)
// ============================================================================

export const EVM_PRIVATE_KEY = process.env.EVM_PRIVATE_KEY;
export const SVM_PRIVATE_KEY = process.env.SVM_PRIVATE_KEY;

// ============================================================================
// RPC Provider API Keys (simplified setup)
// ============================================================================

// EVM providers
export const ALCHEMY_API_KEY = process.env.ALCHEMY_API_KEY;
export const INFURA_API_KEY = process.env.INFURA_API_KEY;

// SVM providers
export const HELIUS_API_KEY = process.env.HELIUS_API_KEY;

// Starknet providers / paymaster
export const STARKNET_PAYMASTER_API_KEY = process.env.STARKNET_PAYMASTER_API_KEY;
export const STARKNET_SPONSOR_ADDRESS = process.env.STARKNET_SPONSOR_ADDRESS;

// ============================================================================
// EVM Network Configuration
// ============================================================================

// Networks to enable (comma-separated, e.g., "base,base-sepolia")
// Defaults to Base mainnet and testnet
const DEFAULT_EVM_NETWORKS = ["base", "base-sepolia"];
const configuredEvmNetworks = parseNetworkList(process.env.EVM_NETWORKS);
export const EVM_NETWORKS_LIST = validateNetworks(
  configuredEvmNetworks.length > 0 ? configuredEvmNetworks : DEFAULT_EVM_NETWORKS
);

// ============================================================================
// SVM Network Configuration
// ============================================================================

// Solana networks to enable (comma-separated, e.g., "solana-mainnet,solana-devnet")
// Defaults to devnet only (for safety)
const DEFAULT_SVM_NETWORKS = ["solana-devnet"];
const configuredSvmNetworks = parseNetworkList(process.env.SVM_NETWORKS);
export const SVM_NETWORKS_LIST = validateSvmNetworks(
  configuredSvmNetworks.length > 0 ? configuredSvmNetworks : DEFAULT_SVM_NETWORKS
);

// ============================================================================
// Starknet Network Configuration
// ============================================================================

// Starknet networks to enable (comma-separated, e.g., "starknet-mainnet,starknet-sepolia")
// Defaults to empty list (opt-in)
const DEFAULT_STARKNET_NETWORKS: string[] = [];
const configuredStarknetNetworks = parseNetworkList(process.env.STARKNET_NETWORKS);
export const STARKNET_NETWORKS_LIST = validateStarknetNetworks(
  configuredStarknetNetworks.length > 0
    ? configuredStarknetNetworks
    : DEFAULT_STARKNET_NETWORKS
);

// Legacy explicit RPC URLs (still supported for backwards compatibility)
export const EVM_RPC_URL_BASE = process.env.EVM_RPC_URL_BASE;
export const EVM_RPC_URL_BASE_SEPOLIA = process.env.EVM_RPC_URL_BASE_SEPOLIA;

// ============================================================================
// EVM RPC URL Resolution
// ============================================================================

/**
 * Get the RPC URL for an EVM network.
 *
 * Resolution order:
 * 1. Explicit env var (EVM_RPC_URL_BASE, EVM_RPC_URL_BASE_SEPOLIA, etc.)
 * 2. Alchemy (if ALCHEMY_API_KEY is set)
 * 3. Infura (if INFURA_API_KEY is set)
 * 4. Public RPC fallback
 */
export function getRpcUrl(network: string): string | undefined {
  // Check for explicit override first (legacy support)
  const envKey = `EVM_RPC_URL_${network.toUpperCase().replace(/-/g, "_")}`;
  const explicitUrl = process.env[envKey];

  return resolveRpcUrl(network, {
    explicitUrl,
    alchemyApiKey: ALCHEMY_API_KEY,
    infuraApiKey: INFURA_API_KEY,
  });
}

/**
 * Get EVM network configuration for setup
 */
export interface NetworkSetup {
  name: string;
  caip: string;
  rpcUrl: string | undefined;
  supportsV1: boolean;
}

export function getNetworkSetups(): NetworkSetup[] {
  return EVM_NETWORKS_LIST.map((name) => ({
    name,
    caip: getNetworkCaip(name)!,
    rpcUrl: getRpcUrl(name),
    supportsV1: supportsV1(name),
  }));
}

// ============================================================================
// Starknet RPC + Paymaster Resolution
// ============================================================================

/**
 * Get the RPC URL for a Starknet network.
 *
 * Resolution order:
 * 1. Explicit env var (STARKNET_RPC_URL_STARKNET_MAINNET, etc.)
 * 2. Alchemy (if ALCHEMY_API_KEY is set)
 * 3. Public RPC fallback
 */
export function getStarknetRpcUrl(network: string): string | undefined {
  const envKey = `STARKNET_RPC_URL_${network.toUpperCase().replace(/-/g, "_")}`;
  const explicitUrl = process.env[envKey];

  return resolveStarknetRpcUrl(network, {
    explicitUrl,
    alchemyApiKey: ALCHEMY_API_KEY,
  });
}

function getStarknetPaymasterEndpoint(network: string): string | undefined {
  const envKey = `STARKNET_PAYMASTER_ENDPOINT_${network
    .toUpperCase()
    .replace(/-/g, "_")}`;
  const explicitUrl = process.env[envKey];
  if (explicitUrl) return explicitUrl;

  const caip = getStarknetNetworkCaip(network);
  if (!caip) return undefined;

  const canonicalCaip = caip ? toStarknetCanonicalCaip(caip) : undefined;

  return canonicalCaip === STARKNET_CAIP_IDS.MAINNET
    ? "https://starknet.paymaster.avnu.fi"
    : "http://localhost:12777";
}

function getStarknetPaymasterApiKey(network: string): string | undefined {
  const envKey = `STARKNET_PAYMASTER_API_KEY_${network
    .toUpperCase()
    .replace(/-/g, "_")}`;
  return process.env[envKey] ?? STARKNET_PAYMASTER_API_KEY;
}

function getStarknetSponsorAddress(network: string): string | undefined {
  const envKey = `STARKNET_SPONSOR_ADDRESS_${network
    .toUpperCase()
    .replace(/-/g, "_")}`;
  return process.env[envKey] ?? STARKNET_SPONSOR_ADDRESS;
}

function requireStarknetSponsorAddress(network: string): string {
  const envKey = `STARKNET_SPONSOR_ADDRESS_${network
    .toUpperCase()
    .replace(/-/g, "_")}`;
  const sponsorAddress = getStarknetSponsorAddress(network);
  if (!sponsorAddress) {
    throw new Error(
      `Missing Starknet sponsor address for ${network}. Set ${envKey} or STARKNET_SPONSOR_ADDRESS.`
    );
  }
  return sponsorAddress;
}

/**
 * Get Starknet network configuration for setup
 */
export interface StarknetNetworkSetup {
  name: string;
  caip: string;
  rpcUrl: string | undefined;
  paymasterEndpoint: string | undefined;
  paymasterApiKey?: string;
  sponsorAddress: string;
}

export function getStarknetNetworkSetups(): StarknetNetworkSetup[] {
  return STARKNET_NETWORKS_LIST.map((name) => ({
    name,
    caip: getStarknetNetworkCaip(name)!,
    rpcUrl: getStarknetRpcUrl(name),
    paymasterEndpoint: getStarknetPaymasterEndpoint(name),
    paymasterApiKey: getStarknetPaymasterApiKey(name),
    sponsorAddress: requireStarknetSponsorAddress(name),
  }));
}

// ============================================================================
// SVM RPC URL Resolution
// ============================================================================

/**
 * Get the RPC URL for a Solana network.
 *
 * Resolution order:
 * 1. Explicit env var (SVM_RPC_URL_SOLANA_MAINNET, etc.)
 * 2. Helius (if HELIUS_API_KEY is set)
 * 3. Public RPC fallback
 */
export function getSvmRpcUrl(network: string): string | undefined {
  // Check for explicit override first
  const envKey = `SVM_RPC_URL_${network.toUpperCase().replace(/-/g, "_")}`;
  const explicitUrl = process.env[envKey];

  return resolveSvmRpcUrl(network, {
    explicitUrl,
    heliusApiKey: HELIUS_API_KEY,
  });
}

/**
 * Get SVM network configuration for setup
 */
export interface SvmNetworkSetup {
  name: string;
  caip: string;
  rpcUrl: string | undefined;
}

export function getSvmNetworkSetups(): SvmNetworkSetup[] {
  return SVM_NETWORKS_LIST.map((name) => ({
    name,
    caip: getSvmNetworkCaip(name)!,
    rpcUrl: getSvmRpcUrl(name),
  }));
}

// ============================================================================
// Signer Mode Detection
// ============================================================================

export const USE_CDP = !!(
  CDP_API_KEY_ID &&
  CDP_API_KEY_SECRET &&
  CDP_WALLET_SECRET &&
  CDP_ACCOUNT_NAME
);
export const USE_PRIVATE_KEY = !!EVM_PRIVATE_KEY;

// ============================================================================
// Validation
// ============================================================================

if (!USE_CDP && !USE_PRIVATE_KEY) {
  console.error("❌ Missing signer configuration. Provide either:");
  console.error("   CDP: CDP_API_KEY_ID, CDP_API_KEY_SECRET, CDP_WALLET_SECRET, CDP_ACCOUNT_NAME");
  console.error("   Or private key: EVM_PRIVATE_KEY");
  process.exit(1);
}

// Log configuration summary
if (USE_CDP) {
  console.info("✅ Using CDP signer (EVM)");
} else {
  console.info("✅ Using private key signer (EVM)");
}

if (SVM_PRIVATE_KEY) {
  console.info("✅ Using private key signer (SVM)");
}

// Log EVM networks
console.info(`✅ EVM Networks: ${EVM_NETWORKS_LIST.join(", ")}`);
for (const network of EVM_NETWORKS_LIST) {
  const envKey = `EVM_RPC_URL_${network.toUpperCase().replace(/-/g, "_")}`;
  const hasExplicit = !!process.env[envKey];
  const source = hasExplicit
    ? "explicit"
    : ALCHEMY_API_KEY
      ? "Alchemy"
      : INFURA_API_KEY
        ? "Infura"
        : "public";
  console.info(`   ${network}: ${source} RPC`);
}

// Log SVM networks (only if SVM_PRIVATE_KEY is set)
if (SVM_PRIVATE_KEY && SVM_NETWORKS_LIST.length > 0) {
  console.info(`✅ SVM Networks: ${SVM_NETWORKS_LIST.join(", ")}`);
  for (const network of SVM_NETWORKS_LIST) {
    const envKey = `SVM_RPC_URL_${network.toUpperCase().replace(/-/g, "_")}`;
    const hasExplicit = !!process.env[envKey];
    const source = hasExplicit ? "explicit" : HELIUS_API_KEY ? "Helius" : "public";
    console.info(`   ${network}: ${source} RPC`);
  }
}

// Log Starknet networks (opt-in)
if (STARKNET_NETWORKS_LIST.length > 0) {
  console.info(`✅ Starknet Networks: ${STARKNET_NETWORKS_LIST.join(", ")}`);
  for (const network of STARKNET_NETWORKS_LIST) {
    const rpcKey = `STARKNET_RPC_URL_${network.toUpperCase().replace(/-/g, "_")}`;
    const hasRpcOverride = !!process.env[rpcKey];
    const rpcSource = hasRpcOverride
      ? "explicit"
      : ALCHEMY_API_KEY
        ? "Alchemy"
        : "public";

    const paymasterKey = `STARKNET_PAYMASTER_ENDPOINT_${network
      .toUpperCase()
      .replace(/-/g, "_")}`;
    const paymasterSource = process.env[paymasterKey] ? "explicit" : "default";

    const sponsorKey = `STARKNET_SPONSOR_ADDRESS_${network
      .toUpperCase()
      .replace(/-/g, "_")}`;
    const sponsorAddress = process.env[sponsorKey] ?? STARKNET_SPONSOR_ADDRESS;

    console.info(
      `   ${network}: ${rpcSource} RPC, ${paymasterSource} paymaster, sponsor ${sponsorAddress ? "set" : "missing"}`
    );
  }
}
