/**
 * Facilitator database record
 */
export interface FacilitatorRecord {
  id: string;
  name: string;
  subdomain: string;
  custom_domain: string | null;
  additional_domains: string; // JSON string array of additional domains
  owner_address: string;
  supported_chains: string; // JSON string
  supported_tokens: string; // JSON string
  encrypted_private_key: string | null; // EVM (Ethereum/Base) private key
  encrypted_solana_private_key: string | null; // Solana private key
  encrypted_stacks_private_key: string | null; // Stacks private key
  favicon: string | null; // Base64-encoded favicon image
  webhook_url: string | null; // URL to POST settlement notifications
  webhook_secret: string | null; // Secret for HMAC signing webhook payloads
  created_at: string;
  updated_at: string;
}

/**
 * Transaction database record
 */
export interface TransactionRecord {
  id: string;
  facilitator_id: string;
  type: 'verify' | 'settle';
  network: string;
  from_address: string;
  to_address: string;
  amount: string;
  asset: string;
  transaction_hash: string | null;
  status: 'pending' | 'success' | 'failed';
  error_message: string | null;
  created_at: string;
}

/**
 * User database record
 */
export interface UserRecord {
  id: string;
  email: string | null;
  wallet_address: string;
  tier: 'free' | 'starter' | 'pro';
  created_at: string;
  updated_at: string;
}

/**
 * Domain verification record
 */
export interface DomainVerificationRecord {
  id: string;
  facilitator_id: string;
  domain: string;
  verification_token: string;
  verified_at: string | null;
  created_at: string;
}

/**
 * Multi-settle signature database record
 * Tracks a pre-authorized spending cap that can be settled multiple times
 */
export interface MultiSettleSignatureRecord {
  id: string;
  facilitator_id: string;
  network: string;
  asset: string;
  from_address: string;
  cap_amount: string;          // Original spending cap
  remaining_amount: string;    // Remaining balance
  valid_until: number;         // Unix timestamp
  nonce: string;               // Original signature nonce
  signature: string;           // The signature
  payment_payload: string;     // Full payment payload for settlements
  status: 'active' | 'exhausted' | 'expired' | 'revoked';
  deposited: number;           // 0 = not yet deposited, 1 = funds deposited to facilitator
  created_at: string;
}

/**
 * Multi-settle settlement database record
 * Tracks individual settlements against a multi-settle signature
 */
export interface MultiSettleSettlementRecord {
  id: string;
  signature_id: string;        // Reference to multisettle_signatures
  facilitator_id: string;
  pay_to: string;              // Recipient address for this settlement
  amount: string;              // Amount settled
  transaction_hash: string | null;
  status: 'pending' | 'success' | 'failed';
  error_message: string | null;
  created_at: string;
}

/**
 * Required field definition for products
 * Used for variants, shipping info, and other user-provided data
 */
export interface RequiredFieldDefinition {
  name: string;
  type: 'text' | 'select' | 'address' | 'email' | 'number';
  label?: string;              // Display label (defaults to name)
  options?: string[];          // For select type
  required?: boolean;          // Defaults to true
  placeholder?: string;
}

/**
 * Product database record
 * x402 resources that can be purchased via payment page or API
 * Types: payment (simple), redirect (after payment), proxy (API gateway)
 */
export interface ProductRecord {
  id: string;
  facilitator_id: string;
  name: string;
  description: string | null;
  image_url: string | null;    // Product image for storefront display
  slug: string | null;         // URL slug (e.g., /pay/my-product)
  link_type: 'payment' | 'redirect' | 'proxy';  // What happens after payment
  amount: string;              // Atomic units (e.g., "1000000" for $1 USDC)
  asset: string;               // Token contract address
  network: string;             // e.g., 'base', 'base-sepolia', 'solana'
  pay_to_address: string;      // Wallet address to receive payments
  success_redirect_url: string | null;  // Target URL (redirect or proxy target)
  method: string;              // HTTP method for proxy type (GET, POST, etc.)
  headers_forward: string;     // JSON array of headers to forward for proxy type
  access_ttl: number;          // Seconds of access after payment (0 = pay per visit)
  required_fields: string;     // JSON array of RequiredFieldDefinition
  group_name: string | null;   // Group name for variant products (e.g., "mountain-art")
  webhook_id: string | null;   // Reference to webhooks table
  webhook_url: string | null;  // (deprecated, use webhook_id)
  webhook_secret: string | null; // (deprecated, use webhook_id)
  active: number;              // 0 = inactive, 1 = active
  created_at: string;
  updated_at: string;
}

/**
 * Product payment database record
 * Tracks individual payments made for a product
 */
export interface ProductPaymentRecord {
  id: string;
  product_id: string;
  payer_address: string;
  amount: string;
  transaction_hash: string | null;
  status: 'pending' | 'success' | 'failed';
  error_message: string | null;
  metadata: string;            // JSON object with submitted field values
  created_at: string;
}

/**
 * Storefront database record
 * A collection of products (catalog/store)
 */
export interface StorefrontRecord {
  id: string;
  facilitator_id: string;
  name: string;
  slug: string;
  description: string | null;
  image_url: string | null;
  active: number;              // 0 = inactive, 1 = active
  created_at: string;
  updated_at: string;
}

/**
 * Storefront-Product join record (many-to-many)
 */
export interface StorefrontProductRecord {
  storefront_id: string;
  product_id: string;
  position: number;            // For ordering products in storefront
  created_at: string;
}

// Backwards compatibility aliases (deprecated)
/** @deprecated Use ProductRecord instead */
export type PaymentLinkRecord = ProductRecord;
/** @deprecated Use ProductPaymentRecord instead */
export type PaymentLinkPaymentRecord = ProductPaymentRecord;

/**
 * Webhook database record
 * First-class webhook entities that can be linked to payment links
 */
export interface WebhookRecord {
  id: string;
  facilitator_id: string;
  name: string;
  url: string;
  secret: string;
  events: string;                // JSON array of event types
  action_type: string | null;    // e.g., 'activate_subscription' | null
  active: number;                // 0 = inactive, 1 = active
  created_at: string;
  updated_at: string;
}

/**
 * Refund configuration per facilitator (global enable/disable)
 */
export interface RefundConfigRecord {
  id: string;
  facilitator_id: string;
  enabled: number;               // 0 = disabled, 1 = enabled
  created_at: string;
  updated_at: string;
}

/**
 * Resource owner: third party who uses a facilitator and wants refund protection
 */
export interface ResourceOwnerRecord {
  id: string;
  facilitator_id: string;
  user_id: string;
  refund_address: string | null;
  name: string | null;
  created_at: string;
}

/**
 * Refund wallet record (one per resource owner per network)
 */
export interface RefundWalletRecord {
  id: string;
  resource_owner_id: string;
  network: string;               // e.g., 'base', 'solana'
  wallet_address: string;
  encrypted_private_key: string;
  created_at: string;
}

/**
 * API key for servers that can report failures (owned by resource owner)
 */
export interface RegisteredServerRecord {
  id: string;
  resource_owner_id: string;
  url: string;                   // Server URL (empty string if not provided)
  name: string | null;           // Label for identifying the key
  api_key_hash: string;
  active: number;                // 0 = revoked, 1 = active
  created_at: string;
}

/**
 * Claim for refund (scoped to resource owner)
 */
export interface ClaimRecord {
  id: string;
  resource_owner_id: string;
  server_id: string | null;      // Null if API key was revoked
  original_tx_hash: string;
  user_wallet: string;
  amount: string;
  asset: string;
  network: string;
  reason: string | null;
  status: 'pending' | 'approved' | 'paid' | 'rejected' | 'expired';
  payout_tx_hash: string | null;
  reported_at: string;
  paid_at: string | null;
  expires_at: string | null;
}

/**
 * Reward address database record
 * Pay-to addresses tracked for volume rewards
 * chain_type 'facilitator' is used as enrollment marker for facilitator owners
 */
export interface RewardAddressRecord {
  id: string;
  user_id: string;
  chain_type: 'solana' | 'evm' | 'facilitator';
  address: string;
  verification_status: 'pending' | 'verified';
  verified_at: string | null;
  created_at: string;
}

/**
 * Campaign database record
 * Reward campaign configuration
 */
export interface CampaignRecord {
  id: string;
  name: string;
  pool_amount: string;
  threshold_amount: string;
  multiplier_facilitator: number;
  starts_at: string;
  ends_at: string;
  status: 'draft' | 'published' | 'active' | 'ended';
  distributed_amount: string;
  created_at: string;
  updated_at: string;
}

/**
 * Campaign audit database record
 * Tracks all admin changes to campaigns
 */
export interface CampaignAuditRecord {
  id: string;
  campaign_id: string;
  admin_user_id: string;
  action: 'create' | 'update' | 'publish' | 'end';
  changes: string; // JSON string
  created_at: string;
}

/**
 * Reward claim database record
 * Tracks user claims against campaigns
 */
export interface RewardClaimRecord {
  id: string;
  user_id: string;
  campaign_id: string;
  volume_amount: string;
  base_reward_amount: string;
  multiplier: number;
  final_reward_amount: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  claim_wallet: string | null;
  tx_signature: string | null;
  claimed_at: string | null;
  created_at: string;
}

/**
 * Volume snapshot database record
 * Daily aggregated volume per reward address per campaign
 */
export interface VolumeSnapshotRecord {
  id: string;
  reward_address_id: string;
  campaign_id: string;
  snapshot_date: string;
  volume: string;
  unique_payers: number;
  created_at: string;
}

