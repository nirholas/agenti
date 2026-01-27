/**
 * Lyra Ecosystem Constants
 * @description Configuration constants and defaults for Lyra services
 * @author nirholas
 * @license Apache-2.0
 */

// ============================================================================
// Service URLs
// ============================================================================

export const LYRA_SERVICE_URLS = {
  intel: {
    production: "https://api.lyra-intel.dev",
    staging: "https://staging.lyra-intel.dev",
  },
  registry: {
    production: "https://api.lyra-registry.dev",
    staging: "https://staging.lyra-registry.dev",
  },
  discovery: {
    production: "https://api.lyra-discovery.dev",
    staging: "https://staging.lyra-discovery.dev",
  },
} as const;

// ============================================================================
// GitHub Repos (reference)
// ============================================================================

export const LYRA_REPOS = {
  intel: "nirholas/lyra-intel",
  registry: "nirholas/lyra-registry",
  discovery: "nirholas/lyra-tool-discovery",
} as const;

// ============================================================================
// Pricing Configuration (USD)
// ============================================================================

export const LYRA_PRICES = {
  // Lyra Intel
  intel: {
    fileAnalysis: "0.00",
    securityScan: "0.05",
    repoAudit: "0.10",
    enterpriseAnalysis: "1.00",
  },
  // Lyra Registry
  registry: {
    browse: "0.00",
    toolDetails: "0.01",
    privateRegistration: "0.05",
    featuredListing: "10.00", // Monthly
  },
  // Lyra Tool Discovery
  discovery: {
    basicDiscovery: "0.00",
    compatibility: "0.02",
    generateConfig: "0.10",
    fullAssistance: "0.50",
  },
} as const;

// ============================================================================
// Rate Limits (requests per minute for free tier)
// ============================================================================

export const LYRA_RATE_LIMITS = {
  intel: {
    free: 10,
    paid: 100,
  },
  registry: {
    free: 60,
    paid: 600,
  },
  discovery: {
    free: 30,
    paid: 300,
  },
} as const;

// ============================================================================
// Payment Networks
// ============================================================================

export const LYRA_SUPPORTED_NETWORKS = [
  "eip155:8453",      // Base Mainnet
  "eip155:84532",     // Base Sepolia
  "eip155:42161",     // Arbitrum One
  "solana:mainnet",   // Solana Mainnet
] as const;

export const LYRA_DEFAULT_NETWORK = "eip155:8453"; // Base Mainnet

// ============================================================================
// Facilitator Configuration
// ============================================================================

export const LYRA_FACILITATOR_URL = "https://x402.org/facilitator";

// ============================================================================
// Default Wallet Address for Lyra Ecosystem
// ============================================================================

export const LYRA_TREASURY_ADDRESS = "0x742d35Cc6634C0532925a3b844Bc9e7595f50a1a";

// ============================================================================
// API Version
// ============================================================================

export const LYRA_API_VERSION = "v1";

// ============================================================================
// Cache Configuration
// ============================================================================

export const LYRA_CACHE_CONFIG = {
  defaultTtlMs: 5 * 60 * 1000, // 5 minutes
  maxEntries: 1000,
  enabledByDefault: true,
} as const;

// ============================================================================
// Supported Languages for Lyra Intel
// ============================================================================

export const SUPPORTED_LANGUAGES = [
  "typescript",
  "javascript",
  "python",
  "rust",
  "go",
  "java",
  "kotlin",
  "swift",
  "c",
  "cpp",
  "csharp",
  "ruby",
  "php",
  "solidity",
  "move",
  "cairo",
] as const;

// ============================================================================
// Tool Categories for Lyra Registry
// ============================================================================

export const TOOL_CATEGORIES = [
  "ai-ml",
  "blockchain",
  "data",
  "devops",
  "finance",
  "gaming",
  "media",
  "productivity",
  "security",
  "social",
  "utilities",
  "web3",
] as const;

// ============================================================================
// Protocol Types for Lyra Discovery
// ============================================================================

export const DISCOVERABLE_PROTOCOLS = [
  "mcp",
  "openapi",
  "graphql",
  "grpc",
  "rest",
  "websocket",
] as const;
