const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5002';

// Rewards Program types
export interface RewardsStatus {
  isEnrolled: boolean;
  isAdmin: boolean;
  isFacilitatorOwner: boolean;
  addresses: Array<{
    id: string;
    user_id: string;
    chain_type: 'solana' | 'evm';
    address: string;
    verification_status: 'pending' | 'verified';
    verified_at: string | null;
    created_at: string;
  }>;
}

export interface RewardsEnrollResponse {
  id: string;
  user_id: string;
  chain_type: 'solana' | 'evm';
  address: string;
  verification_status: 'pending' | 'verified';
  verified_at: string | null;
  created_at: string;
}

// Campaign types
export interface Campaign {
  id: string;
  name: string;
  pool_amount: string;
  threshold_amount: string;
  multiplier_facilitator: number;
  starts_at: string;
  ends_at: string;
  status: 'draft' | 'published' | 'active' | 'ended';
  distributed_amount?: string;
  created_at: string;
  updated_at: string;
}

export interface CampaignAudit {
  id: string;
  campaign_id: string;
  admin_user_id: string;
  action: 'create' | 'update' | 'publish' | 'end';
  changes: string;
  created_at: string;
}

export interface CampaignWithAudit extends Campaign {
  audit: CampaignAudit[];
}

export interface CampaignStats {
  totalVolume: string;
  participantCount: number;
  userRank?: number;
  userVolume?: string;
}

export interface VolumeBreakdown {
  userId: string;
  campaignId: string;
  totalVolume: string;
  addresses: Array<{
    id: string;
    address: string;
    chain_type: 'solana' | 'evm' | 'facilitator';
    volume: string;
    uniquePayers: number;
  }>;
}

export interface CampaignHistoryItem {
  campaign: Campaign;
  userVolume: string;
  userRank: number | null;
  metThreshold: boolean;
  multiplierApplied: number;
  estimatedReward: string | null;
  claimed: boolean;
}

export interface RewardClaim {
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

export interface CreateCampaignRequest {
  name: string;
  pool_amount: string;
  threshold_amount: string;
  multiplier_facilitator?: number;
  starts_at: string;
  ends_at: string;
}

export interface Facilitator {
  id: string;
  name: string;
  subdomain: string;
  customDomain?: string;
  additionalDomains?: string[];
  ownerAddress: string;
  supportedChains: number[];
  supportedTokens: TokenConfig[];
  url: string;
  favicon?: string | null;
  domainStatus?: 'active' | 'pending' | 'not_added' | null;
  dnsRecords?: { type: string; name: string; value: string }[] | null;
  stats?: {
    totalSettled: string;
    totalVerifications: number;
    totalSettlements: number;
  };
  createdAt: string;
  updatedAt: string;
}

export interface TokenConfig {
  address: string;
  symbol: string;
  decimals: number;
  chainId: number;
}

export interface Transaction {
  id: string;
  type: 'verify' | 'settle';
  network: string;
  fromAddress: string;
  toAddress: string;
  amount: string;
  asset: string;
  transactionHash?: string;
  status: 'pending' | 'success' | 'failed';
  errorMessage?: string;
  createdAt: string;
}

export interface ChartDataPoint {
  date: string;
  settlements: number;
  verifications: number;
  amount: number;
}

export interface CreateFacilitatorRequest {
  name: string;
  subdomain: string;
  customDomain?: string;
  ownerAddress?: string;
  supportedChains?: number[];
  supportedTokens?: TokenConfig[];
}

export interface ExportConfig {
  dockerCompose: string;
  envFile: string;
  instructions: string;
}

export interface User {
  id: string;
  email: string;
  name?: string;
  emailVerified: boolean;
  createdAt: string;
}

export interface WalletInfo {
  hasWallet: boolean;
  address: string | null;
  balances: Record<string, { balance: string; formatted: string }>;
}

export interface SolanaWalletInfo {
  hasWallet: boolean;
  address: string | null;
  balance: { sol: string; lamports: string } | null;
}

export interface StacksWalletInfo {
  hasWallet: boolean;
  address: string | null;
  balance: { stx: string; microStx: string } | null;
}

export interface WalletGenerateResponse {
  success: boolean;
  address: string;
  message: string;
}

export interface BillingWallet {
  hasWallet: boolean;
  address: string;
  network: string;
  balance: string;
  token: string;
}

export interface BillingWalletCreateResponse {
  address: string;
  network: string;
  created: boolean;
  message: string;
}

export interface SubscriptionWallet {
  network: 'solana' | 'base';
  address: string;
  balance: string;
  token: string;
}

export interface SubscriptionWalletCreateResponse {
  address: string;
  network: string;
  created: boolean;
  message: string;
}

export interface WalletBalanceResponse {
  balance: string;
  token: string;
}

export interface ChainPreference {
  preferredChain: 'base' | 'solana' | 'stacks';
}

export interface ChainPreferenceUpdateResponse {
  preferredChain: 'base' | 'solana' | 'stacks';
  updated: boolean;
}

// Notification types
export interface Notification {
  id: string;
  user_id: string;
  type: 'payment_success' | 'payment_failed' | 'low_balance' | 'expiration_reminder' | 'subscription_restored' | 'subscription_expired';
  title: string;
  message: string;
  severity: 'success' | 'warning' | 'error' | 'info';
  read: boolean;
  dismissed: boolean;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface NotificationsResponse {
  notifications: Notification[];
  unreadCount: number;
}

export interface SubscriptionStatus {
  active: boolean;
  tier: 'starter' | 'basic' | 'pro' | null; // 'basic' and 'pro' for backwards compatibility
  expires: string | null;
}

export interface SubscriptionStatusResponse {
  active: boolean;
  tier: string | null;
  expires: string | null;
  state: 'active' | 'pending' | 'inactive' | 'never';
  facilitatorCount: number;
  monthlyCost: number;
  gracePeriod?: {
    daysRemaining: number;
    expiredAt: string;
  };
}

export interface SubscriptionPayment {
  id: string;
  date: string;
  amount: string;
  chain: string;
  txHash: string | null;
  tier: string;
  expiresAt: string;
}

export interface SubscriptionPaymentAttempt {
  id: string;
  date: string;
  amount: string;
  chain: 'solana' | 'base';
  status: 'success' | 'failed' | 'pending';
  txHash: string | null;
  isFallback: boolean;
}

export interface SubscriptionHistoryResponse {
  payments: SubscriptionPayment[];
}

export interface SubscriptionPricing {
  starter: { price: number; priceFormatted: string; currency: string; period: string };
}

export interface PurchaseResult {
  success: boolean;
  message?: string;
  tier?: 'starter';
  error?: string;
  insufficientBalance?: boolean;
  required?: string;
  available?: string;
  txHash?: string;
}

export interface Webhook {
  id: string;
  name: string;
  url: string;
  secret?: string; // Only returned on creation
  hasSecret?: boolean;
  events: string[];
  actionType: string | null;
  active: boolean;
  createdAt: string;
  updatedAt?: string;
}

export interface CreateWebhookRequest {
  name: string;
  url: string;
  events?: string[];
  actionType?: string | null;
}

export interface WebhooksResponse {
  webhooks: Webhook[];
}

// Proxy URLs (API Gateway)
export interface ProxyUrl {
  id: string;
  name: string;
  slug: string;
  targetUrl: string;
  method: string;
  priceAmount: string;
  priceAsset: string;
  priceNetwork: string;
  payToAddress: string;
  headersForward: string[];
  active: boolean;
  url: string;
  createdAt: string;
  updatedAt?: string;
}

export interface CreateProxyUrlRequest {
  name: string;
  slug: string;
  targetUrl: string;
  method?: string;
  priceAmount: string;
  priceAsset: string;
  priceNetwork: string;
  payToAddress: string;
  headersForward?: string[];
}

export interface ProxyUrlsResponse {
  urls: ProxyUrl[];
}

export type ProductType = 'payment' | 'redirect' | 'proxy';
/** @deprecated Use ProductType instead */
export type LinkType = ProductType;

export interface Product {
  id: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  slug: string | null;
  linkType: ProductType;  // Keep as linkType for API compatibility
  amount: string;
  asset: string;
  network: string;
  payToAddress: string;
  successRedirectUrl: string | null;
  method: string;
  headersForward: string[];
  accessTtl: number;
  groupName: string | null;  // Group name for product variants
  webhookId: string | null;
  webhookUrl: string | null;
  active: boolean;
  url: string;
  stats?: {
    totalPayments: number;
    successfulPayments: number;
    totalAmountCollected: string;
  };
  createdAt: string;
  updatedAt?: string;
}

/** @deprecated Use Product instead */
export type PaymentLink = Product;

export interface ProductPayment {
  id: string;
  payerAddress: string;
  amount: string;
  transactionHash: string | null;
  status: 'pending' | 'success' | 'failed';
  errorMessage: string | null;
  createdAt: string;
}

/** @deprecated Use ProductPayment instead */
export type PaymentLinkPayment = ProductPayment;

export interface CreateProductRequest {
  name: string;
  description?: string;
  imageUrl?: string;
  slug?: string;
  linkType?: ProductType;
  amount: string;
  asset: string;
  network: string;
  payToAddress: string;
  successRedirectUrl?: string;
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'ANY';
  headersForward?: string[];
  accessTtl?: number;
  groupName?: string;  // Group name for product variants
  webhookId?: string;
  webhookUrl?: string;
}

/** @deprecated Use CreateProductRequest instead */
export type CreatePaymentLinkRequest = CreateProductRequest;

export interface ProductsResponse {
  products: Product[];
  stats: {
    totalProducts: number;
    activeProducts: number;
    totalPayments: number;
    totalAmountCollected: string;
  };
}

/** @deprecated Use ProductsResponse instead */
export type PaymentLinksResponse = ProductsResponse;

export interface ProductDetailResponse extends Product {
  payments: ProductPayment[];
}

/** @deprecated Use ProductDetailResponse instead */
export type PaymentLinkDetailResponse = ProductDetailResponse;

// Storefronts (product collections)
export interface Storefront {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  imageUrl: string | null;
  active: boolean;
  url: string;
  productCount?: number;
  createdAt: string;
  updatedAt?: string;
}

export interface StorefrontProduct {
  id: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  amount: string;
  asset: string;
  network: string;
  active: boolean;
}

export interface CreateStorefrontRequest {
  name: string;
  slug: string;
  description?: string;
  imageUrl?: string;
}

export interface StorefrontsResponse {
  storefronts: Storefront[];
  stats: {
    totalStorefronts: number;
    activeStorefronts: number;
  };
}

export interface StorefrontDetailResponse extends Storefront {
  products: StorefrontProduct[];
}

// Refund types
export interface RefundConfig {
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface RefundWallet {
  network: string;
  address: string;
  balance: string;
  createdAt: string;
}

export interface RefundWalletsResponse {
  wallets: RefundWallet[];
  supportedNetworks: string[];
}

export interface RegisteredServer {
  id: string;
  url: string;
  name: string | null;
  active: boolean;
  apiKey?: string; // Only on creation
  createdAt: string;
}

export interface RegisteredServersResponse {
  servers: RegisteredServer[];
}

export interface Claim {
  id: string;
  serverId: string;
  originalTxHash: string;
  userWallet: string;
  amount: string;
  asset: string;
  network: string;
  reason: string | null;
  status: 'pending' | 'approved' | 'paid' | 'rejected' | 'expired';
  payoutTxHash: string | null;
  reportedAt: string;
  paidAt: string | null;
  expiresAt: string | null;
}

export interface ClaimStats {
  totalClaims: number;
  pendingClaims: number;
  approvedClaims: number;
  paidClaims: number;
  rejectedClaims: number;
  expiredClaims: number;
  totalPaidAmount: string;
}

export interface ClaimsResponse {
  claims: Claim[];
  stats: ClaimStats;
  pagination?: { limit: number; offset: number };
}

// Resource Owner types (for overview)
export interface ResourceOwnerStats {
  wallets: number;
  servers: number;
  totalClaims: number;
  pendingClaims: number;
  paidClaims: number;
  totalPaidAmount: string;
}

export interface ResourceOwner {
  id: string;
  userId: string;
  refundAddress: string | null;
  name: string | null;
  createdAt: string;
  stats: ResourceOwnerStats;
}

export interface MyResourceOwner {
  id: string;
  facilitatorId: string;
  userId: string;
  refundAddress: string | null;
  name: string | null;
  createdAt: string;
}

export interface ResourceOwnersResponse {
  resourceOwners: ResourceOwner[];
  total: number;
}

export interface ResourceOwnerDetail {
  id: string;
  userId: string;
  refundAddress: string | null;
  name: string | null;
  createdAt: string;
  wallets: RefundWallet[];
  servers: RegisteredServer[];
  claimStats: ClaimStats;
  recentClaims: Claim[];
}

export interface RefundsOverview {
  resourceOwners: number;
  totalWallets: number;
  totalServers: number;
  totalWalletBalance: string;
  claims: {
    total: number;
    pending: number;
    approved: number;
    paid: number;
    rejected: number;
    totalPaidAmount: string;
  };
  supportedNetworks: string[];
}

class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  private async request<T>(path: string, options?: RequestInit): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      ...options,
      credentials: 'include', // Include cookies for auth
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(error.error || `HTTP ${response.status}`);
    }

    if (response.status === 204) {
      return undefined as T;
    }

    return response.json();
  }

  // User
  async getMe(): Promise<User> {
    return this.request('/api/admin/me');
  }

  // Facilitators - now uses authenticated user, owner param is optional
  async getFacilitators(): Promise<Facilitator[]> {
    return this.request('/api/admin/facilitators');
  }

  async getFacilitator(id: string): Promise<Facilitator> {
    return this.request(`/api/admin/facilitators/${id}`);
  }

  async createFacilitator(data: CreateFacilitatorRequest): Promise<Facilitator> {
    return this.request('/api/admin/facilitators', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async createPendingFacilitator(data: { name: string; customDomain: string }): Promise<{
    id: string;
    name: string;
    customDomain: string;
    subdomain: string;
    createdAt: string;
  }> {
    return this.request('/api/admin/pending-facilitator', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateFacilitator(
    id: string,
    data: Partial<{
      name: string;
      customDomain: string | null;
      additionalDomains: string[];
      supportedChains: number[];
      supportedTokens: TokenConfig[];
    }>
  ): Promise<Facilitator> {
    return this.request(`/api/admin/facilitators/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async deleteFacilitator(id: string): Promise<void> {
    return this.request(`/api/admin/facilitators/${id}`, {
      method: 'DELETE',
    });
  }

  // Transactions
  async getTransactions(
    facilitatorId: string,
    limit = 50,
    offset = 0
  ): Promise<{ 
    transactions: Transaction[]; 
    stats: { 
      totalVerifications: number; 
      totalSettlements: number; 
      totalFailed: number; 
      total: number;
      totalAmountSettled: string;
    };
    pagination: { limit: number; offset: number } 
  }> {
    return this.request(
      `/api/admin/facilitators/${facilitatorId}/transactions?limit=${limit}&offset=${offset}`
    );
  }

  // Chart Data
  async getChartData(
    facilitatorId: string,
    days: number = 30
  ): Promise<{ days: number; data: ChartDataPoint[] }> {
    return this.request(`/api/admin/facilitators/${facilitatorId}/chart-data?days=${days}`);
  }

  // Export
  async exportConfig(facilitatorId: string): Promise<ExportConfig> {
    return this.request(`/api/admin/facilitators/${facilitatorId}/export`, {
      method: 'POST',
    });
  }

  // Domain Management
  async setupDomain(facilitatorId: string): Promise<{ success: boolean; domain?: string; status?: string; message?: string; error?: string }> {
    return this.request(`/api/admin/facilitators/${facilitatorId}/domain`, {
      method: 'POST',
    });
  }

  async removeDomain(facilitatorId: string): Promise<{ success: boolean; message?: string; error?: string }> {
    return this.request(`/api/admin/facilitators/${facilitatorId}/domain`, {
      method: 'DELETE',
    });
  }

  async getDomainStatus(facilitatorId: string): Promise<{
    domain: string;
    status: 'pending' | 'active' | 'not_added' | 'unconfigured' | 'manual_setup';
    railwayConfigured: boolean;
    message?: string;
    dnsRecords?: { type: string; name: string; value: string }[];
  }> {
    return this.request(`/api/admin/facilitators/${facilitatorId}/domain/status`);
  }

  async getSubdomainStatus(facilitatorId: string): Promise<{
    domain: string;
    status: 'pending' | 'active' | 'not_added' | 'unconfigured';
    railwayConfigured: boolean;
    message?: string;
    dnsRecords?: { type: string; name: string; value: string }[];
  }> {
    return this.request(`/api/admin/facilitators/${facilitatorId}/subdomain/status`);
  }

  // Wallet Management
  async getWallet(facilitatorId: string): Promise<WalletInfo> {
    return this.request(`/api/admin/facilitators/${facilitatorId}/wallet`);
  }

  async generateWallet(facilitatorId: string): Promise<WalletGenerateResponse> {
    return this.request(`/api/admin/facilitators/${facilitatorId}/wallet`, {
      method: 'POST',
    });
  }

  async importWallet(facilitatorId: string, privateKey: string): Promise<WalletGenerateResponse> {
    return this.request(`/api/admin/facilitators/${facilitatorId}/wallet/import`, {
      method: 'POST',
      body: JSON.stringify({ privateKey }),
    });
  }

  async deleteWallet(facilitatorId: string): Promise<{ success: boolean; message: string }> {
    return this.request(`/api/admin/facilitators/${facilitatorId}/wallet`, {
      method: 'DELETE',
    });
  }

  // Solana Wallet Management
  async getSolanaWallet(facilitatorId: string): Promise<SolanaWalletInfo> {
    return this.request(`/api/admin/facilitators/${facilitatorId}/wallet/solana`);
  }

  async generateSolanaWallet(facilitatorId: string): Promise<WalletGenerateResponse> {
    return this.request(`/api/admin/facilitators/${facilitatorId}/wallet/solana`, {
      method: 'POST',
    });
  }

  async importSolanaWallet(facilitatorId: string, privateKey: string): Promise<WalletGenerateResponse> {
    return this.request(`/api/admin/facilitators/${facilitatorId}/wallet/solana/import`, {
      method: 'POST',
      body: JSON.stringify({ privateKey }),
    });
  }

  async deleteSolanaWallet(facilitatorId: string): Promise<{ success: boolean; message: string }> {
    return this.request(`/api/admin/facilitators/${facilitatorId}/wallet/solana`, {
      method: 'DELETE',
    });
  }

  // ============ Stacks Wallet ============

  async getStacksWallet(facilitatorId: string): Promise<StacksWalletInfo> {
    return this.request(`/api/admin/facilitators/${facilitatorId}/wallet/stacks`);
  }

  async generateStacksWallet(facilitatorId: string): Promise<WalletGenerateResponse> {
    return this.request(`/api/admin/facilitators/${facilitatorId}/wallet/stacks`, {
      method: 'POST',
    });
  }

  async importStacksWallet(
    facilitatorId: string,
    privateKey: string
  ): Promise<WalletGenerateResponse> {
    return this.request(`/api/admin/facilitators/${facilitatorId}/wallet/stacks/import`, {
      method: 'POST',
      body: JSON.stringify({ privateKey }),
    });
  }

  async deleteStacksWallet(
    facilitatorId: string
  ): Promise<{ success: boolean; message: string }> {
    return this.request(`/api/admin/facilitators/${facilitatorId}/wallet/stacks`, {
      method: 'DELETE',
    });
  }

  // Favicon Management
  async getFavicon(facilitatorId: string): Promise<{ hasFavicon: boolean; favicon: string | null }> {
    return this.request(`/api/admin/facilitators/${facilitatorId}/favicon`);
  }

  async uploadFavicon(facilitatorId: string, faviconBase64: string): Promise<{ success: boolean; message?: string; error?: string }> {
    return this.request(`/api/admin/facilitators/${facilitatorId}/favicon`, {
      method: 'POST',
      body: JSON.stringify({ favicon: faviconBase64 }),
    });
  }

  async removeFavicon(facilitatorId: string): Promise<{ success: boolean; message?: string; error?: string }> {
    return this.request(`/api/admin/facilitators/${facilitatorId}/favicon`, {
      method: 'DELETE',
    });
  }

  // Webhook Management
  async getWebhook(facilitatorId: string): Promise<{ webhookUrl: string | null; hasSecret: boolean }> {
    return this.request(`/api/admin/facilitators/${facilitatorId}/webhook`);
  }

  async setWebhook(facilitatorId: string, url: string | null): Promise<{
    success: boolean;
    webhookUrl: string | null;
    webhookSecret: string | null;
    message: string;
  }> {
    return this.request(`/api/admin/facilitators/${facilitatorId}/webhook`, {
      method: 'PUT',
      body: JSON.stringify({ url }),
    });
  }

  async regenerateWebhookSecret(facilitatorId: string): Promise<{
    success: boolean;
    webhookSecret: string;
    message: string;
  }> {
    return this.request(`/api/admin/facilitators/${facilitatorId}/webhook/regenerate`, {
      method: 'POST',
    });
  }

  async testWebhook(facilitatorId: string): Promise<{
    success: boolean;
    message: string;
    error?: string;
    statusCode?: number;
  }> {
    return this.request(`/api/admin/facilitators/${facilitatorId}/webhook/test`, {
      method: 'POST',
    });
  }

  // Billing Wallet (user's subscription wallet) - legacy single wallet
  async getBillingWallet(): Promise<BillingWallet> {
    return this.request('/api/admin/wallet');
  }

  async createBillingWallet(): Promise<BillingWalletCreateResponse> {
    return this.request('/api/admin/wallet/create', {
      method: 'POST',
    });
  }

  // Multi-chain Subscription Wallets
  async getSubscriptionWallets(): Promise<SubscriptionWallet[]> {
    return this.request('/api/admin/wallets');
  }

  async getSubscriptionWallet(chain: 'solana' | 'base'): Promise<SubscriptionWallet | null> {
    try {
      return await this.request(`/api/admin/wallets/${chain}`);
    } catch {
      return null;
    }
  }

  async createSubscriptionWallet(chain: 'solana' | 'base'): Promise<SubscriptionWalletCreateResponse> {
    return this.request(`/api/admin/wallets/${chain}/create`, {
      method: 'POST',
    });
  }

  async refreshWalletBalance(chain: 'solana' | 'base'): Promise<WalletBalanceResponse> {
    return this.request(`/api/admin/wallets/${chain}/balance`);
  }

  // Subscription Management
  async getSubscriptionStatus(): Promise<SubscriptionStatusResponse> {
    return this.request('/api/subscriptions/status');
  }

  async getSubscriptionPricing(): Promise<SubscriptionPricing> {
    return this.request('/api/subscriptions/pricing');
  }

  async purchaseSubscription(): Promise<PurchaseResult> {
    const response = await fetch(`${this.baseUrl}/api/subscriptions/purchase`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tier: 'starter' }),
    });

    const data = await response.json();

    if (response.status === 402) {
      return {
        success: false,
        insufficientBalance: true,
        required: data.required,
        available: data.available,
        error: data.message || 'Insufficient balance',
      };
    }

    if (!response.ok) {
      return {
        success: false,
        error: data.error || data.message || `HTTP ${response.status}`,
      };
    }

    return data;
  }

  async getSubscriptionHistory(): Promise<SubscriptionHistoryResponse> {
    return this.request('/api/subscriptions/history');
  }

  async getSubscriptionPayments(limit?: number, offset?: number): Promise<{ payments: SubscriptionPaymentAttempt[]; total: number }> {
    const params = new URLSearchParams();
    if (limit) params.append('limit', limit.toString());
    if (offset) params.append('offset', offset.toString());
    const query = params.toString();
    return this.request(`/api/subscriptions/payments${query ? `?${query}` : ''}`);
  }

  async reactivateSubscription(): Promise<{ success: boolean; error?: string; subscription?: { tier: string; expires: string } }> {
    const response = await fetch(`${this.baseUrl}/api/subscriptions/reactivate`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
    });

    const data = await response.json();

    if (!response.ok) {
      return {
        success: false,
        error: data.error || data.message || `HTTP ${response.status}`,
      };
    }

    return data;
  }

  // Notifications
  async getNotifications(): Promise<NotificationsResponse> {
    return this.request('/api/notifications');
  }

  async markNotificationAsRead(id: string): Promise<{ success: boolean }> {
    return this.request(`/api/notifications/${id}/read`, { method: 'POST' });
  }

  async dismissNotification(id: string): Promise<{ success: boolean }> {
    return this.request(`/api/notifications/${id}/dismiss`, { method: 'POST' });
  }

  async markAllNotificationsAsRead(): Promise<{ success: boolean }> {
    return this.request('/api/notifications/mark-all-read', { method: 'POST' });
  }

  // Chain Preference
  async getChainPreference(): Promise<ChainPreference> {
    return this.request('/api/admin/preference');
  }

  async updateChainPreference(chain: 'base' | 'solana' | 'stacks'): Promise<ChainPreferenceUpdateResponse> {
    return this.request('/api/admin/preference', {
      method: 'PUT',
      body: JSON.stringify({ preferredChain: chain }),
    });
  }

  // Products (x402 resources)
  async getProducts(facilitatorId: string): Promise<ProductsResponse> {
    return this.request(`/api/admin/facilitators/${facilitatorId}/payment-links`);
  }

  async createProduct(facilitatorId: string, data: CreateProductRequest): Promise<Product> {
    return this.request(`/api/admin/facilitators/${facilitatorId}/payment-links`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getProduct(facilitatorId: string, productId: string): Promise<ProductDetailResponse> {
    return this.request(`/api/admin/facilitators/${facilitatorId}/payment-links/${productId}`);
  }

  async updateProduct(
    facilitatorId: string,
    productId: string,
    data: Partial<{
      name: string;
      description: string | null;
      slug: string;
      linkType: ProductType;
      amount: string;
      asset: string;
      network: string;
      payToAddress: string;
      successRedirectUrl: string | null;
      method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'ANY';
      headersForward: string[];
      accessTtl: number;
      groupName: string | null;
      webhookId: string | null;
      webhookUrl: string | null;
      imageUrl: string | null;
      active: boolean;
    }>
  ): Promise<Product> {
    return this.request(`/api/admin/facilitators/${facilitatorId}/payment-links/${productId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async deleteProduct(facilitatorId: string, productId: string): Promise<void> {
    return this.request(`/api/admin/facilitators/${facilitatorId}/payment-links/${productId}`, {
      method: 'DELETE',
    });
  }

  // Backwards compatibility aliases
  /** @deprecated Use getProducts instead */
  getPaymentLinks = this.getProducts;
  /** @deprecated Use createProduct instead */
  createPaymentLink = this.createProduct;
  /** @deprecated Use getProduct instead */
  getPaymentLink = this.getProduct;
  /** @deprecated Use updateProduct instead */
  updatePaymentLink = this.updateProduct;
  /** @deprecated Use deleteProduct instead */
  deletePaymentLink = this.deleteProduct;

  // First-Class Webhooks
  async getWebhooks(facilitatorId: string): Promise<WebhooksResponse> {
    return this.request(`/api/admin/facilitators/${facilitatorId}/webhooks`);
  }

  async createWebhook(facilitatorId: string, data: CreateWebhookRequest): Promise<Webhook> {
    return this.request(`/api/admin/facilitators/${facilitatorId}/webhooks`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getWebhookDetail(facilitatorId: string, webhookId: string): Promise<Webhook> {
    return this.request(`/api/admin/facilitators/${facilitatorId}/webhooks/${webhookId}`);
  }

  async updateWebhookEntity(
    facilitatorId: string,
    webhookId: string,
    data: Partial<{
      name: string;
      url: string;
      events: string[];
      actionType: string | null;
      active: boolean;
    }>
  ): Promise<Webhook> {
    return this.request(`/api/admin/facilitators/${facilitatorId}/webhooks/${webhookId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async deleteWebhookEntity(facilitatorId: string, webhookId: string): Promise<void> {
    return this.request(`/api/admin/facilitators/${facilitatorId}/webhooks/${webhookId}`, {
      method: 'DELETE',
    });
  }

  async regenerateWebhookEntitySecret(facilitatorId: string, webhookId: string): Promise<{
    success: boolean;
    secret: string;
    message: string;
  }> {
    return this.request(`/api/admin/facilitators/${facilitatorId}/webhooks/${webhookId}/regenerate-secret`, {
      method: 'POST',
    });
  }

  async testWebhookEntity(facilitatorId: string, webhookId: string): Promise<{
    success: boolean;
    message: string;
    error?: string;
    statusCode?: number;
  }> {
    return this.request(`/api/admin/facilitators/${facilitatorId}/webhooks/${webhookId}/test`, {
      method: 'POST',
    });
  }

  // Proxy URLs (API Gateway)
  async getProxyUrls(facilitatorId: string): Promise<ProxyUrlsResponse> {
    return this.request(`/api/admin/facilitators/${facilitatorId}/urls`);
  }

  async createProxyUrl(facilitatorId: string, data: CreateProxyUrlRequest): Promise<ProxyUrl> {
    return this.request(`/api/admin/facilitators/${facilitatorId}/urls`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getProxyUrl(facilitatorId: string, urlId: string): Promise<ProxyUrl> {
    return this.request(`/api/admin/facilitators/${facilitatorId}/urls/${urlId}`);
  }

  async updateProxyUrl(
    facilitatorId: string,
    urlId: string,
    data: Partial<{
      name: string;
      slug: string;
      targetUrl: string;
      method: string;
      priceAmount: string;
      priceAsset: string;
      priceNetwork: string;
      payToAddress: string;
      headersForward: string[];
      active: boolean;
    }>
  ): Promise<ProxyUrl> {
    return this.request(`/api/admin/facilitators/${facilitatorId}/urls/${urlId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async deleteProxyUrl(facilitatorId: string, urlId: string): Promise<void> {
    return this.request(`/api/admin/facilitators/${facilitatorId}/urls/${urlId}`, {
      method: 'DELETE',
    });
  }

  // Storefronts (product collections)
  async getStorefronts(facilitatorId: string): Promise<StorefrontsResponse> {
    return this.request(`/api/admin/facilitators/${facilitatorId}/storefronts`);
  }

  async createStorefront(facilitatorId: string, data: CreateStorefrontRequest): Promise<Storefront> {
    return this.request(`/api/admin/facilitators/${facilitatorId}/storefronts`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getStorefront(facilitatorId: string, storefrontId: string): Promise<StorefrontDetailResponse> {
    return this.request(`/api/admin/facilitators/${facilitatorId}/storefronts/${storefrontId}`);
  }

  async updateStorefront(
    facilitatorId: string,
    storefrontId: string,
    data: Partial<{
      name: string;
      slug: string;
      description: string | null;
      imageUrl: string | null;
      active: boolean;
    }>
  ): Promise<Storefront> {
    return this.request(`/api/admin/facilitators/${facilitatorId}/storefronts/${storefrontId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async deleteStorefront(facilitatorId: string, storefrontId: string): Promise<void> {
    return this.request(`/api/admin/facilitators/${facilitatorId}/storefronts/${storefrontId}`, {
      method: 'DELETE',
    });
  }

  async addProductToStorefront(facilitatorId: string, storefrontId: string, productId: string): Promise<void> {
    return this.request(`/api/admin/facilitators/${facilitatorId}/storefronts/${storefrontId}/products`, {
      method: 'POST',
      body: JSON.stringify({ productId }),
    });
  }

  async removeProductFromStorefront(facilitatorId: string, storefrontId: string, productId: string): Promise<void> {
    return this.request(`/api/admin/facilitators/${facilitatorId}/storefronts/${storefrontId}/products/${productId}`, {
      method: 'DELETE',
    });
  }

  // Refund Config
  async getRefundConfig(facilitatorId: string): Promise<RefundConfig> {
    return this.request(`/api/admin/facilitators/${facilitatorId}/refunds/config`);
  }

  async updateRefundConfig(facilitatorId: string, data: { enabled: boolean }): Promise<RefundConfig> {
    return this.request(`/api/admin/facilitators/${facilitatorId}/refunds/config`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // Refunds Overview (for facilitator admins)
  async getRefundsOverview(facilitatorId: string): Promise<RefundsOverview> {
    return this.request(`/api/admin/facilitators/${facilitatorId}/refunds/overview`);
  }

  // Resource Owners (for facilitator admins)
  async getResourceOwners(facilitatorId: string): Promise<ResourceOwnersResponse> {
    return this.request(`/api/admin/facilitators/${facilitatorId}/resource-owners`);
  }

  async getResourceOwner(facilitatorId: string, resourceOwnerId: string): Promise<ResourceOwnerDetail> {
    return this.request(`/api/admin/facilitators/${facilitatorId}/resource-owners/${resourceOwnerId}`);
  }

  // Current user's resource owner management
  async getMyResourceOwner(facilitatorSubdomain: string): Promise<MyResourceOwner | null> {
    try {
      return await this.request(`/api/resource-owners/me?facilitator=${facilitatorSubdomain}`);
    } catch {
      return null;
    }
  }

  async registerAsResourceOwner(facilitatorSubdomain: string, data: { name?: string; refundAddress?: string }): Promise<MyResourceOwner> {
    return this.request('/api/resource-owners/register', {
      method: 'POST',
      body: JSON.stringify({ facilitator: facilitatorSubdomain, ...data }),
    });
  }

  async getMyWallets(resourceOwnerId: string): Promise<{ wallets: RefundWallet[]; supportedNetworks: string[] }> {
    return this.request(`/api/resource-owners/${resourceOwnerId}/wallets`);
  }

  async generateMyWallet(resourceOwnerId: string, network: string): Promise<RefundWallet> {
    return this.request(`/api/resource-owners/${resourceOwnerId}/wallets`, {
      method: 'POST',
      body: JSON.stringify({ network }),
    });
  }

  async deleteMyWallet(resourceOwnerId: string, network: string): Promise<void> {
    return this.request(`/api/resource-owners/${resourceOwnerId}/wallets/${network}`, {
      method: 'DELETE',
    });
  }

  async getMyServers(resourceOwnerId: string): Promise<{ servers: RegisteredServer[] }> {
    return this.request(`/api/resource-owners/${resourceOwnerId}/servers`);
  }

  async registerMyServer(resourceOwnerId: string, data: { url?: string; name?: string }): Promise<{ server: RegisteredServer; apiKey: string }> {
    return this.request(`/api/resource-owners/${resourceOwnerId}/servers`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async deleteMyServer(resourceOwnerId: string, serverId: string): Promise<void> {
    return this.request(`/api/resource-owners/${resourceOwnerId}/servers/${serverId}`, {
      method: 'DELETE',
    });
  }

  async regenerateMyServerApiKey(resourceOwnerId: string, serverId: string): Promise<{ apiKey: string }> {
    return this.request(`/api/resource-owners/${resourceOwnerId}/servers/${serverId}/regenerate-key`, {
      method: 'POST',
    });
  }

  async renameMyServer(resourceOwnerId: string, serverId: string, name: string): Promise<RegisteredServer> {
    return this.request(`/api/resource-owners/${resourceOwnerId}/servers/${serverId}`, {
      method: 'PATCH',
      body: JSON.stringify({ name }),
    });
  }

  async getMyClaims(resourceOwnerId: string, status?: string): Promise<{ claims: Claim[]; stats: ClaimStats }> {
    const url = status && status !== 'all'
      ? `/api/resource-owners/${resourceOwnerId}/claims?status=${status}`
      : `/api/resource-owners/${resourceOwnerId}/claims`;
    return this.request(url);
  }

  async approveMyClaim(resourceOwnerId: string, claimId: string): Promise<void> {
    return this.request(`/api/resource-owners/${resourceOwnerId}/claims/${claimId}/approve`, {
      method: 'POST',
    });
  }

  async rejectMyClaim(resourceOwnerId: string, claimId: string): Promise<void> {
    return this.request(`/api/resource-owners/${resourceOwnerId}/claims/${claimId}/reject`, {
      method: 'POST',
    });
  }

  async executeMyClaimPayout(resourceOwnerId: string, claimId: string): Promise<void> {
    return this.request(`/api/resource-owners/${resourceOwnerId}/claims/${claimId}/payout`, {
      method: 'POST',
    });
  }

  // Rewards Program
  async getRewardsStatus(): Promise<RewardsStatus> {
    return this.request('/api/rewards/status');
  }

  async enrollInRewards(data: {
    chain_type: 'solana' | 'evm';
    address: string;
    signature: string;
    message: string;
  }): Promise<RewardsEnrollResponse> {
    const response = await fetch(`${this.baseUrl}/api/rewards/enroll`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Unknown error' }));
      // Handle 409 Conflict for duplicate addresses
      if (response.status === 409) {
        throw new Error(error.error || 'Address already enrolled');
      }
      throw new Error(error.error || `HTTP ${response.status}`);
    }

    return response.json();
  }

  async deleteRewardAddress(addressId: string): Promise<void> {
    return this.request(`/api/rewards/addresses/${addressId}`, {
      method: 'DELETE',
    });
  }

  // Admin Campaign Management
  async getCampaigns(status?: string): Promise<Campaign[]> {
    const url = status ? `/api/rewards/campaigns?status=${status}` : '/api/rewards/campaigns';
    return this.request(url);
  }

  async getCampaign(id: string): Promise<CampaignWithAudit> {
    return this.request(`/api/rewards/campaigns/${id}`);
  }

  async createCampaign(data: CreateCampaignRequest): Promise<Campaign> {
    return this.request('/api/rewards/campaigns', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateCampaign(id: string, data: Partial<CreateCampaignRequest>): Promise<Campaign> {
    return this.request(`/api/rewards/campaigns/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async publishCampaign(id: string): Promise<Campaign> {
    return this.request(`/api/rewards/campaigns/${id}/publish`, {
      method: 'POST',
    });
  }

  async endCampaign(id: string): Promise<Campaign> {
    return this.request(`/api/rewards/campaigns/${id}/end`, {
      method: 'POST',
    });
  }

  async deleteCampaign(id: string): Promise<void> {
    return this.request(`/api/rewards/campaigns/${id}`, {
      method: 'DELETE',
    });
  }

  // Public Campaign Endpoints
  async getActiveCampaign(): Promise<{ campaign: Campaign | null; totalVolume: string }> {
    return this.request('/api/rewards/campaigns/active');
  }

  async getCampaignHistory(): Promise<CampaignHistoryItem[]> {
    return this.request('/api/rewards/campaigns/history');
  }

  async getCampaignStats(id: string): Promise<CampaignStats> {
    return this.request(`/api/rewards/campaigns/${id}/stats`);
  }

  async getRewardsVolume(campaignId: string): Promise<{
    userId: string;
    campaignId: string;
    totalVolume: string;
    uniquePayers: number;
    snapshotVolume: string;
    liveVolume: string;
    lastSnapshotDate: string | null;
  }> {
    return this.request(`/api/rewards/volume?campaignId=${campaignId}`);
  }

  async getVolumeBreakdown(campaignId: string): Promise<VolumeBreakdown> {
    return this.request(`/api/rewards/volume/breakdown?campaignId=${campaignId}`);
  }

  async getFacilitatorVolume(facilitatorId: string, campaignId: string): Promise<{
    facilitatorId: string;
    campaignId: string;
    volume: string;
    uniquePayers: number;
    enrolled: boolean;
    enrolledAt?: string;
  }> {
    return this.request(`/api/rewards/volume/facilitator/${facilitatorId}?campaignId=${campaignId}`);
  }

  // Claim endpoints
  async initiateClaim(
    claimId: string,
    claimWallet: string
  ): Promise<{
    success: boolean;
    claim?: RewardClaim;
    error?: string;
  }> {
    return this.request(`/api/rewards/claims/${claimId}/initiate`, {
      method: 'POST',
      body: JSON.stringify({ claim_wallet: claimWallet }),
    });
  }

  async getMyClaim(campaignId: string): Promise<{ claim: RewardClaim | null }> {
    return this.request(`/api/rewards/campaigns/${campaignId}/my-claim`);
  }

  async getClaimEligibility(campaignId: string): Promise<{
    eligible: boolean;
    reason?: string;
    claim: RewardClaim | null;
    calculatedReward: {
      baseReward: string;
      finalReward: string;
      multiplier: number;
    } | null;
  }> {
    return this.request(`/api/rewards/campaigns/${campaignId}/eligibility`);
  }

  async getClaimHistory(): Promise<{
    claims: Array<RewardClaim & { campaign_name: string }>;
  }> {
    return this.request('/api/rewards/claims/history');
  }
}

export const api = new ApiClient(API_BASE);

