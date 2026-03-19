/**
 * Starknet x402 Payment Protocol Library
 *
 * A pure library providing core functionality for implementing
 * the x402 payment protocol on Starknet.
 *
 * Spec compliance: x402 v2
 *
 * @module x402-starknet
 * @version 1.0.0
 */

// ============================================================================
// Payment Operations (Core API)
// ============================================================================

export { createPaymentPayload } from './payment/create.js';
export { verifyPayment } from './payment/verify.js';
export { settlePayment } from './payment/settle.js';

// ============================================================================
// Encoding Utilities
// ============================================================================

export {
  encodePaymentSignature,
  decodePaymentSignature,
  encodePaymentRequired,
  decodePaymentRequired,
  encodePaymentResponse,
  decodePaymentResponse,
  HTTP_HEADERS,
} from './payment/create.js';

// ============================================================================
// Network Utilities
// ============================================================================

export {
  getNetworkConfig,
  getTransactionUrl,
  getAddressUrl,
  isTestnet,
  isMainnet,
  getSupportedNetworks,
  // New network utilities (IMPROVEMENT_SPEC section 2)
  isStarknetNetwork,
  parseStarknetNetwork,
  buildStarknetCAIP2,
  getNetworkReference,
  validateNetwork,
} from './networks/index.js';

// Network constants
export {
  STARKNET_NETWORKS,
  NETWORK_REFERENCES,
  NETWORK_NAMES,
  DEFAULT_RPC_URLS,
  type NetworkReference,
} from './networks/index.js';

// ============================================================================
// Token Constants & Utilities
// ============================================================================

export {
  // Token addresses
  ETH_ADDRESSES,
  STRK_ADDRESSES,
  USDC_ADDRESSES,
  TOKEN_ADDRESSES,
  TOKEN_DECIMALS,
  // Token utilities
  getTokenAddress,
  getTokenDecimals,
  getTokenSymbol,
  toAtomicUnits,
  fromAtomicUnits,
  isTokenAvailable,
  getAvailableTokens,
  // Types
  type TokenSymbol,
} from './tokens/index.js';

// ============================================================================
// Constants
// ============================================================================

/**
 * Library version
 */
export const VERSION = '1.0.0';

/**
 * Supported x402 protocol version
 */
export const X402_VERSION = 2;

/**
 * Default AVNU paymaster endpoints for each network
 */
export { DEFAULT_PAYMASTER_ENDPOINTS } from './paymaster/helpers.js';

/**
 * Paymaster configuration utilities
 */
export {
  createPaymasterConfig,
  createSettlementOptions,
  hasPublicPaymaster,
  type SettlementOptions,
  type PaymasterConfigOptions,
} from './paymaster/helpers.js';

/**
 * Network configurations for all supported Starknet networks
 */
export { NETWORK_CONFIGS } from './networks/constants.js';

// ============================================================================
// Provider Factory
// ============================================================================

export { createProvider, getChainId } from './utils/provider.js';

// ============================================================================
// Payment Builder Utilities
// ============================================================================

export {
  buildPaymentRequirements,
  buildETHPayment,
  buildSTRKPayment,
  buildUSDCPayment,
  type PaymentRequirementsParams,
  type ETHPaymentParams,
  type STRKPaymentParams,
  type USDCPaymentParams,
} from './builders/index.js';

// ============================================================================
// TypeScript Types (All Public)
// ============================================================================

// Network types
export type {
  StarknetNetwork,
  StarknetNetworkId,
  NetworkConfig,
  ProviderOptions,
} from './types/network.js';

// Payment types
export type {
  PaymentScheme,
  Signature,
  PaymentAuthorization,
  ResourceInfo,
  ExtensionData,
  PaymentRequirements,
  PaymentRequired,
  ExactStarknetPayload,
  PaymentPayload,
} from './types/payment.js';

// Settlement types
export type {
  InvalidPaymentReason,
  VerifyResponse,
  SettleResponse,
  SupportedKind,
  SupportedResponse,
} from './types/settlement.js';

// Paymaster types
export type { PaymasterConfig } from './types/paymaster.js';

// Facilitator types
export type {
  FacilitatorClientConfig,
  IFacilitatorClient,
} from './facilitator/client.js';

// Discovery types
export type {
  DiscoveryClientConfig,
  IDiscoveryClient,
} from './discovery/client.js';

export type {
  ResourceType,
  ResourceMetadata,
  DiscoveredResource,
  DiscoveryPagination,
  DiscoveryResponse,
  DiscoveryParams,
  RegisterResourceRequest,
  RegisterResourceResponse,
} from './types/discovery.js';

// Extension types
export type {
  Extension,
  IExtensionRegistry,
  ValidationResult,
  JSONSchema,
} from './extensions/types.js';

// ============================================================================
// Facilitator Client
// ============================================================================

export {
  FacilitatorClient,
  createFacilitatorClient,
} from './facilitator/index.js';

// ============================================================================
// Discovery Client (Bazaar API)
// ============================================================================

export { DiscoveryClient, createDiscoveryClient } from './discovery/index.js';

// ============================================================================
// Extensions System
// ============================================================================

export {
  ExtensionRegistry,
  createExtensionRegistry,
  globalRegistry,
  createExtensionData,
  getExtensionInfo,
  hasExtension,
  getExtensionNames,
  mergeExtensions,
  filterRegisteredExtensions,
  validateExtensions,
  defineExtension,
} from './extensions/index.js';

// ============================================================================
// Zod Validation Schemas
// ============================================================================

export {
  // Network schemas
  STARKNET_NETWORK_ID_SCHEMA,
  STARKNET_NETWORK_SCHEMA,
  // Common schemas
  PAYMENT_SCHEME_SCHEMA,
  SIGNATURE_SCHEMA,
  PAYMENT_AUTHORIZATION_SCHEMA,
  // Payment schemas
  RESOURCE_INFO_SCHEMA,
  EXTENSION_DATA_SCHEMA,
  PAYMENT_REQUIREMENTS_SCHEMA,
  PAYMENT_REQUIREMENTS_V2_SCHEMA,
  EXACT_STARKNET_PAYLOAD_SCHEMA,
  PAYMENT_PAYLOAD_SCHEMA,
  PAYMENT_PAYLOAD_V2_SCHEMA,
  PAYMENT_REQUIRED_SCHEMA,
  // Settlement schemas
  INVALID_PAYMENT_REASON_SCHEMA,
  VERIFY_RESPONSE_SCHEMA,
  VERIFY_RESPONSE_V2_SCHEMA,
  SETTLE_RESPONSE_SCHEMA,
  SETTLE_RESPONSE_V2_SCHEMA,
  SUPPORTED_KIND_SCHEMA,
  SUPPORTED_RESPONSE_SCHEMA,
  // Config schemas
  NETWORK_CONFIG_SCHEMA,
  ACCOUNT_CONFIG_SCHEMA,
  PROVIDER_OPTIONS_SCHEMA,
  // Discovery schemas
  RESOURCE_TYPE_SCHEMA,
  RESOURCE_METADATA_SCHEMA,
  DISCOVERED_RESOURCE_SCHEMA,
  DISCOVERY_PAGINATION_SCHEMA,
  DISCOVERY_RESPONSE_SCHEMA,
  DISCOVERY_PARAMS_SCHEMA,
  REGISTER_RESOURCE_REQUEST_SCHEMA,
  REGISTER_RESOURCE_RESPONSE_SCHEMA,
} from './types/schemas.js';

// ============================================================================
// Error Classes
// ============================================================================

export {
  X402Error,
  PaymentError,
  NetworkError,
  ERROR_CODES,
  type ErrorCode,
} from './errors.js';
