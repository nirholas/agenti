/**
 * Resource Call Tracking Types
 *
 * Type definitions for tracking 100% of payment settlements
 * with full metadata capture.
 */

/**
 * MaybePromise type for sync/async flexibility
 * Allows stores to be implemented synchronously (in-memory) or asynchronously (Postgres)
 */
export type MaybePromise<T> = T | Promise<T>;

/**
 * Payment details captured from verified payments
 */
export interface TrackedPayment {
  /** Payment scheme: "exact" for immediate settlement, "upto" for batched */
  scheme: "exact" | "upto";
  /** CAIP-2 network identifier (e.g., "eip155:8453", "solana:...", "starknet:...") */
  network: string;
  /** Network type for categorization */
  networkType: "evm" | "svm" | "starknet";
  /** Token/asset address or "native" for native currency */
  asset: string;
  /** Amount in smallest unit (wei, lamports, etc.) */
  amount: string;
  /** Human-readable amount with decimals */
  amountDecimal: string;
  /** Currency symbol (e.g., "USDC", "ETH") */
  currency: string;
  /** Payer's wallet address */
  payer: string;
  /** Recipient's wallet address */
  payTo: string;
}

/**
 * Settlement outcome details (for exact scheme)
 */
export interface TrackedSettlement {
  /** Whether settlement was attempted */
  attempted: boolean;
  /** Whether settlement succeeded */
  success: boolean;
  /** Blockchain transaction hash */
  transactionHash?: string;
  /** Error message if settlement failed */
  errorMessage?: string;
  /** Gas used for the transaction */
  gasUsed?: string;
  /** Timestamp when settlement completed */
  settledAtMs: number;
}

/**
 * Upto session tracking details (for upto scheme)
 */
export interface TrackedUptoSession {
  /** Unique session identifier for batched payments */
  sessionId: string;
  /** Whether session tracking succeeded */
  trackingSuccess: boolean;
  /** Error type if tracking failed */
  trackingError?: string;
}

/**
 * Request metadata captured from HTTP request
 */
export interface TrackedRequest {
  /** Client IP address (from x-forwarded-for or x-real-ip) */
  clientIp?: string;
  /** User-Agent header */
  userAgent?: string;
  /** All captured request headers */
  headers: Record<string, string>;
  /** URL query parameters */
  queryParams: Record<string, string | string[]>;
  /** Content-Type header */
  contentType?: string;
  /** Request body size in bytes */
  contentLength?: number;
  /** Accept header */
  acceptHeader?: string;
}

/**
 * Route configuration at time of request
 */
export interface TrackedRouteConfig {
  /** Route description from payment config */
  description?: string;
  /** Expected response MIME type */
  mimeType?: string;
  /** Maximum amount required (for upto scheme) */
  maxAmountRequired?: string;
}

/**
 * Complete record of a resource call through the facilitator
 */
export interface ResourceCallRecord {
  /** Unique record ID (UUID) */
  id: string;
  /** HTTP method (GET, POST, etc.) */
  method: string;
  /** Request path (e.g., /api/premium) */
  path: string;
  /** x402 route key format (e.g., "GET /api/[premium]") */
  routeKey: string;
  /** Full URL including query parameters */
  url: string;
  /** When request was received */
  timestamp: Date;

  /** Was payment required for this route? */
  paymentRequired: boolean;
  /** Did payment verification succeed? */
  paymentVerified: boolean;
  /** Error message if verification failed */
  verificationError?: string;

  /** Payment details (when payment was verified) */
  payment?: TrackedPayment;
  /** Settlement details (for exact scheme) */
  settlement?: TrackedSettlement;
  /** Upto session details (for upto scheme) */
  uptoSession?: TrackedUptoSession;
  /** x402 protocol version */
  x402Version?: number;
  /** Authorization nonce from x402 payload */
  paymentNonce?: string;
  /** Authorization valid-before value from x402 payload */
  paymentValidBefore?: string;
  /** SHA-256 hash of canonicalized payment payload */
  payloadHash?: string;
  /** SHA-256 hash of canonicalized payment requirements */
  requirementsHash?: string;
  /** SHA-256 hash of payment signature */
  paymentSignatureHash?: string;

  /** HTTP response status code */
  responseStatus: number;
  /** Total request duration in milliseconds */
  responseTimeMs: number;
  /** Did the route handler execute? */
  handlerExecuted: boolean;

  /** Full request context */
  request: TrackedRequest;
  /** Route configuration at time of request */
  routeConfig?: TrackedRouteConfig;
  /** Custom user-defined metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Filter options for listing records
 */
export interface ListFilters {
  /** Filter by request path */
  path?: string;
  /** Filter by HTTP method */
  method?: string;
  /** Filter by network (e.g., "eip155:8453") */
  network?: string;
  /** Filter by network type */
  networkType?: "evm" | "svm" | "starknet";
  /** Filter by payment scheme */
  scheme?: "exact" | "upto";
  /** Filter by whether payment was required */
  paymentRequired?: boolean;
  /** Filter by whether payment was verified */
  paymentVerified?: boolean;
  /** Filter by settlement success */
  settlementSuccess?: boolean;
  /** Filter records after this time */
  startTime?: Date;
  /** Filter records before this time */
  endTime?: Date;
  /** Filter by minimum response time */
  minResponseTimeMs?: number;
  /** Filter by maximum response time */
  maxResponseTimeMs?: number;
  /** Filter by payer address */
  payer?: string;
}

/**
 * Sort options for listing records
 */
export interface ListSort {
  /** Field to sort by */
  field: "timestamp" | "responseTimeMs" | "path";
  /** Sort direction */
  direction: "asc" | "desc";
}

/**
 * Pagination and filtering options for list queries
 */
export interface ListOptions {
  /** Filter criteria */
  filters?: ListFilters;
  /** Sort options */
  sort?: ListSort;
  /** Maximum records to return (default: 50, max: 100) */
  limit?: number;
  /** Number of records to skip */
  offset?: number;
  /** Cursor for cursor-based pagination */
  cursor?: string;
}

/**
 * Paginated list result
 */
export interface ListResult {
  /** Records matching the query */
  records: ResourceCallRecord[];
  /** Total count of matching records */
  total: number;
  /** Whether more records exist */
  hasMore: boolean;
  /** Cursor for next page (if hasMore is true) */
  nextCursor?: string;
}

/**
 * Aggregated statistics for a time period
 */
export interface TrackingStats {
  /** Time period for these stats */
  period: { start: Date; end: Date };

  /** Total number of resource calls */
  totalRequests: number;
  /** Requests where payment was required */
  paymentRequiredRequests: number;
  /** Successfully verified payments */
  verifiedPayments: number;
  /** Successful settlements (exact scheme) */
  successfulSettlements: number;
  /** Failed settlements */
  failedSettlements: number;

  /** Total payment volume by network */
  totalVolumeByNetwork: Record<string, string>;
  /** Total payment volume by asset */
  totalVolumeByAsset: Record<string, string>;

  /** Average response time in milliseconds */
  avgResponseTimeMs: number;
  /** 95th percentile response time */
  p95ResponseTimeMs: number;

  /** Request count by path */
  requestsByPath: Record<string, number>;
  /** Request count by network */
  requestsByNetwork: Record<string, number>;
  /** Request count by scheme */
  requestsByScheme: Record<string, number>;
}
