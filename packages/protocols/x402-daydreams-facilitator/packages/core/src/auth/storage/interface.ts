/**
 * API Token representation
 */
export interface ApiToken {
  id: string; // UUID
  token: string; // Full token: fac_live_...
  tokenHash: string; // SHA256 hash for secure lookup
  name: string | null; // Human-readable name
  userId: string | null; // Optional user identifier
  tier: "free" | "starter" | "pro" | "enterprise";

  // Rate limits
  requestsPerMinute: number;
  requestsPerDay: number;

  // Quotas (optional)
  monthlyRequestLimit: number | null;
  monthlySettlementLimit: number | null; // In USD/USDC

  // Status
  isActive: boolean;

  // Timestamps
  createdAt: Date;
  updatedAt: Date;
  expiresAt: Date | null;
  lastUsedAt: Date | null;

  // Metadata (flexible)
  metadata: Record<string, unknown>;
}

/**
 * Input for creating a new token
 */
export interface CreateTokenInput {
  name?: string;
  userId?: string;
  tier?: "free" | "starter" | "pro" | "enterprise";
  requestsPerMinute?: number;
  requestsPerDay?: number;
  monthlyRequestLimit?: number | null;
  monthlySettlementLimit?: number | null;
  expiresAt?: Date | null;
  metadata?: Record<string, unknown>;
}

/**
 * Token storage interface
 * Abstract persistence and retrieval of API tokens
 */
export interface TokenStorage {
  /**
   * Retrieve token by token string or hash
   * Returns null if not found or inactive
   */
  getToken(tokenOrHash: string): Promise<ApiToken | null>;

  /**
   * Create new API token
   * Generates token string automatically
   */
  createToken(
    input: CreateTokenInput,
    environment: "test" | "live",
  ): Promise<ApiToken>;

  /**
   * Update token properties
   */
  updateToken(id: string, data: Partial<ApiToken>): Promise<ApiToken>;

  /**
   * Soft delete - set isActive = false
   */
  revokeToken(id: string): Promise<void>;

  /**
   * Update lastUsedAt timestamp
   */
  touchToken(id: string): Promise<void>;
}
