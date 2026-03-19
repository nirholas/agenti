# SDK API Reference

Package: `@openfacilitator/sdk` v1.0.0
Supports: ESM (`dist/index.mjs`) and CJS (`dist/index.js`)

## All Exports

```typescript
// Main client
export { OpenFacilitator } from './client';

// Types
export type {
  FacilitatorConfig,
  PaymentPayload,
  PaymentPayloadV1,
  PaymentPayloadV2,
  PaymentAuthorization,
  PaymentRequirements,
  PaymentRequirementsV1,
  PaymentRequirementsV2,
  VerifyResponse,
  SettleResponse,
  SupportedResponse,
  PaymentKind,
  NetworkType,
  NetworkInfo,
} from './types';

// Error classes
export {
  FacilitatorError,
  NetworkError,
  VerificationError,
  SettlementError,
  ConfigurationError,
} from './errors';

// Network utilities
export {
  NETWORKS,
  getNetwork,
  getNetworkType,
  toV1NetworkId,
  toV2NetworkId,
  isValidNetwork,
  getMainnets,
  getTestnets,
} from './networks';

// Type guards & utilities
export {
  isPaymentPayload,
  isPaymentPayloadV1,
  isPaymentPayloadV2,
  isPaymentRequirementsV1,
  isPaymentRequirementsV2,
  getSchemeNetwork,
  getVersion,
  getVersionSafe,
  assertNever,
} from './utils';

// Claims / Refunds
export {
  reportFailure,
  getClaimable,
  getClaimHistory,
  executeClaim,
  type ReportFailureParams,
  type ReportFailureResponse,
  type GetClaimableParams,
  type ClaimableItem,
  type GetClaimableResponse,
  type ClaimHistoryItem,
  type GetClaimHistoryResponse,
  type ExecuteClaimParams,
  type ExecuteClaimResponse,
} from './claims';

// Middleware
export {
  withRefundProtection,
  createPaymentContext,
  createPaymentMiddleware,
  createRefundMiddleware,
  honoPaymentMiddleware,
  honoRefundMiddleware,
  type RefundProtectionConfig,
  type MiddlewareRefundConfig,
  type PaymentContext,
  type PaymentRequest,
  type PaymentMiddlewareConfig,
  type HonoRefundConfig,
  type HonoPaymentConfig,
} from './middleware';
```

---

## OpenFacilitator Class

```typescript
class OpenFacilitator {
  constructor(config?: FacilitatorConfig)

  /** The facilitator URL */
  get url(): string

  /**
   * Verify a payment payload against requirements.
   * Does NOT settle — use this for manual verify+settle flows.
   */
  async verify(
    payment: PaymentPayload,
    requirements: PaymentRequirements
  ): Promise<VerifyResponse>

  /**
   * Settle a verified payment on-chain.
   * Async — waits for on-chain confirmation before returning.
   * Returns the transaction hash on success.
   */
  async settle(
    payment: PaymentPayload,
    requirements: PaymentRequirements
  ): Promise<SettleResponse>

  /** Get supported networks and payment kinds */
  async supported(): Promise<SupportedResponse>

  /** Health check — returns true if facilitator is reachable */
  async health(): Promise<boolean>

  /** Get Solana fee payer address for a network (gas-free txs) */
  async getFeePayer(network: string): Promise<string | undefined>

  /** Get all fee payer addresses keyed by network */
  async getFeePayerMap(): Promise<Record<string, string>>

  /** Clear internal caches */
  clearCache(): void
}
```

### FacilitatorConfig

```typescript
interface FacilitatorConfig {
  /** Facilitator URL. Default: "https://pay.openfacilitator.io" */
  url?: string;
  /** Request timeout in ms. Default: 30000 */
  timeout?: number;
  /** Custom headers for all requests */
  headers?: Record<string, string>;
}
```

---

## Middleware Functions

### createPaymentMiddleware (Express)

```typescript
function createPaymentMiddleware(config: PaymentMiddlewareConfig): ExpressMiddleware

interface PaymentMiddlewareConfig {
  /** OpenFacilitator instance or URL string */
  facilitator: OpenFacilitator | string;

  /**
   * Return payment requirements for this request.
   * Can return a single object or an array (multi-network).
   */
  getRequirements: (req: Request) =>
    | PaymentRequirements
    | PaymentRequirements[]
    | Promise<PaymentRequirements | PaymentRequirements[]>;

  /** Optional refund protection config */
  refundProtection?: MiddlewareRefundConfig;

  /** Optional callback when 402 is returned */
  on402?: (req: Request, res: Response, requirements: PaymentRequirements[]) => void | Promise<void>;
}
```

**After middleware runs, access payment context via:**
```typescript
req.paymentContext    // PaymentContext
res.locals.paymentContext  // same object
```

### honoPaymentMiddleware (Hono)

```typescript
function honoPaymentMiddleware(config: HonoPaymentConfig): HonoMiddleware

interface HonoPaymentConfig {
  facilitator: OpenFacilitator | string;
  getRequirements: (c: Context) =>
    | PaymentRequirements
    | PaymentRequirements[]
    | Promise<PaymentRequirements | PaymentRequirements[]>;
  refundProtection?: MiddlewareRefundConfig;
}
```

**After middleware runs, access payment context via:**
```typescript
c.get('paymentContext')  // PaymentContext
```

### PaymentContext (injected by middleware)

```typescript
interface PaymentContext {
  transactionHash: string;  // On-chain tx hash
  userWallet: string;       // Payer address
  amount: string;           // Amount in smallest units
  asset: string;            // Token contract address
  network: string;          // Network identifier
}
```

### Refund Middleware

```typescript
// Express
function createRefundMiddleware(config: RefundProtectionConfig): ExpressMiddleware

// Hono
function honoRefundMiddleware(config: HonoRefundConfig): HonoMiddleware

// Standalone wrapper
function withRefundProtection<T>(
  config: RefundProtectionConfig,
  handler: (context: PaymentContext) => Promise<T>
): (context: PaymentContext) => Promise<T>
```

### MiddlewareRefundConfig

```typescript
interface MiddlewareRefundConfig {
  /** API key from OpenFacilitator dashboard */
  apiKey: string;
  /** Facilitator URL. Defaults to middleware's facilitator URL */
  facilitatorUrl?: string;
  /** Filter which errors trigger refund reports. Default: all errors */
  shouldReport?: (error: Error) => boolean;
  /** Called when failure is successfully reported */
  onReport?: (claimId: string | undefined, error: Error) => void;
  /** Called if the report itself fails */
  onReportError?: (reportError: Error, originalError: Error) => void;
}
```

### RefundProtectionConfig (standalone)

```typescript
interface RefundProtectionConfig {
  apiKey: string;
  facilitatorUrl: string;
  shouldReport?: (error: Error) => boolean;
  onReport?: (claimId: string | undefined, error: Error) => void;
  onReportError?: (reportError: Error, originalError: Error) => void;
}
```

---

## Claims Functions

```typescript
/** Report a failed payment for refund */
async function reportFailure(params: ReportFailureParams): Promise<ReportFailureResponse>

interface ReportFailureParams {
  facilitatorUrl: string;
  apiKey: string;
  originalTxHash: string;
  userWallet: string;
  amount: string;
  asset: string;
  network: string;
  reason?: string;
}

interface ReportFailureResponse {
  success: boolean;
  claimId?: string;
  error?: string;
}

/** Get pending refund claims for a wallet */
async function getClaimable(params: GetClaimableParams): Promise<GetClaimableResponse>

interface GetClaimableParams {
  facilitatorUrl: string;
  wallet: string;
  facilitator?: string;
}

interface GetClaimableResponse {
  claims: ClaimableItem[];
}

interface ClaimableItem {
  id: string;
  originalTxHash: string;
  amount: string;
  asset: string;
  network: string;
  reason?: string;
  status: 'pending' | 'approved';
  reportedAt: string;
  expiresAt?: string;
}

/** Get full claim history for a wallet */
async function getClaimHistory(params: GetClaimableParams): Promise<GetClaimHistoryResponse>

interface GetClaimHistoryResponse {
  claims: ClaimHistoryItem[];
}

interface ClaimHistoryItem extends ClaimableItem {
  status: 'pending' | 'approved' | 'paid' | 'rejected' | 'expired';
  payoutTxHash?: string;
  paidAt?: string;
}

/** Execute an approved refund claim */
async function executeClaim(params: ExecuteClaimParams): Promise<ExecuteClaimResponse>

interface ExecuteClaimParams {
  facilitatorUrl: string;
  claimId: string;
  signature?: string;
}

interface ExecuteClaimResponse {
  success: boolean;
  transactionHash?: string;
  error?: string;
}
```

---

## Network Utilities

```typescript
/** All known networks */
const NETWORKS: NetworkInfo[];

interface NetworkInfo {
  v1Id: string;       // Short name: "base", "solana", "stacks"
  v2Id: string;       // CAIP-2: "eip155:8453", "solana:5eykt4..."
  name: string;       // Human name: "Base", "Solana"
  type: NetworkType;  // "evm" | "solana" | "stacks"
  chainId?: number;   // EVM chain ID (undefined for non-EVM)
  testnet: boolean;
}

type NetworkType = 'evm' | 'solana' | 'stacks';

/** Look up a network by either v1 or v2 ID */
function getNetwork(id: string): NetworkInfo | undefined

/** Get the network type from any ID */
function getNetworkType(id: string): NetworkType | undefined

/** Convert v1 short name to CAIP-2 */
function toV2NetworkId(id: string): string

/** Convert CAIP-2 to v1 short name */
function toV1NetworkId(id: string): string

/** Check if a network ID is recognized */
function isValidNetwork(id: string): boolean

/** Get all mainnet networks */
function getMainnets(): NetworkInfo[]

/** Get all testnet networks */
function getTestnets(): NetworkInfo[]
```

---

## Error Classes

```typescript
class FacilitatorError extends Error {
  code: string;
  statusCode?: number;
  details?: unknown;
}

class NetworkError extends FacilitatorError {
  // code: 'NETWORK_ERROR'
  // Network connectivity, timeouts, unreachable facilitator
}

class VerificationError extends FacilitatorError {
  // code: 'VERIFICATION_ERROR'
  // Payment signature invalid, expired, wrong amount, etc.
}

class SettlementError extends FacilitatorError {
  // code: 'SETTLEMENT_ERROR'
  // On-chain settlement failed, insufficient gas, reverted tx
}

class ConfigurationError extends FacilitatorError {
  // code: 'CONFIGURATION_ERROR'
  // Invalid SDK config, missing required fields
}
```

---

## Type Guards

```typescript
/** Check if a value is a valid PaymentPayload (v1 or v2) */
function isPaymentPayload(value: unknown): value is PaymentPayload

/** Narrow to v1 payload */
function isPaymentPayloadV1(value: unknown): value is PaymentPayloadV1

/** Narrow to v2 payload */
function isPaymentPayloadV2(value: unknown): value is PaymentPayloadV2

/** Check for v1 requirements (has maxAmountRequired) */
function isPaymentRequirementsV1(value: unknown): value is PaymentRequirementsV1

/** Check for v2 requirements (has amount, no maxAmountRequired) */
function isPaymentRequirementsV2(value: unknown): value is PaymentRequirementsV2

/** Extract x402 version as literal 1 | 2 */
function getVersion(payload: PaymentPayload): 1 | 2

/** Safe version extraction with backward compat (defaults to 1) */
function getVersionSafe(payload: unknown): 1 | 2

/** Version-agnostic scheme + network extraction */
function getSchemeNetwork(payload: PaymentPayload): { scheme: string; network: string }
```
