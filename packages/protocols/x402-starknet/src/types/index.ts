/**
 * Type definitions for Starknet x402
 * Spec compliance: x402 v2
 * @module types
 */

// Network types
export type {
  StarknetNetwork,
  StarknetNetworkId,
  NetworkConfig,
  AccountConfig,
  ProviderOptions,
} from './network.js';

// Network utilities
export {
  isCAIP2Network,
  toCAIP2Network,
  normalizeNetwork,
  networksEqual,
} from './network.js';

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
  PaymentRequirementsSelector,
} from './payment.js';

// Settlement types
export type {
  InvalidPaymentReason,
  VerifyResponse,
  SettleResponse,
  SettleRequest,
  VerifyRequest,
  SupportedKind,
  SupportedResponse,
} from './settlement.js';

// Discovery types
export type {
  ResourceType,
  ResourceMetadata,
  DiscoveredResource,
  DiscoveryPagination,
  DiscoveryResponse,
  DiscoveryParams,
  RegisterResourceRequest,
  RegisterResourceResponse,
} from './discovery.js';

// Paymaster types
export type {
  PaymasterConfig,
  PaymasterFeeMode,
  InvokeParameters,
  TransactionParameters,
  ExecutionParameters,
  FeeEstimate,
  BuildTransactionRequest,
  InvokeTransactionResponse,
  BuildTransactionResponse,
  ExecuteTransactionRequest,
  ExecuteTransactionResponse,
  SupportedTokensResponse,
  IsAvailableResponse,
  JsonRpcRequest,
  JsonRpcResponse,
} from './paymaster.js';

// Zod schemas
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
} from './schemas.js';
